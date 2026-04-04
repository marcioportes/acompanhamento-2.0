/**
 * useSubscriptions
 * @description Hook para gestão de assinaturas da mentoria (issue #094)
 * @see version.js para versão do produto
 *
 * CHANGELOG:
 * - 2.0.0: Refactor DEC-055/DEC-056 — subcollection students/{id}/subscriptions,
 *          collectionGroup para reads, type trial/paid, getStudentsWithoutSubscription
 * - 1.0.0: CRUD completo — listener real-time, add, update, registerPayment, renew
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, collectionGroup, query, onSnapshot, addDoc, updateDoc, doc,
  getDocs, serverTimestamp, orderBy, Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// ── Helpers ──────────────────────────────────────────────

const toDate = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

const daysUntil = (date) => {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

/**
 * Extrai studentId do path do documento de subscription.
 * Path: students/{studentId}/subscriptions/{subId}
 */
const getStudentIdFromRef = (docRef) => {
  // docRef.path = "students/abc123/subscriptions/xyz456"
  const segments = docRef.path.split('/');
  return segments[1]; // students/{THIS}/subscriptions/...
};

// ── Hook ─────────────────────────────────────────────────

export const useSubscriptions = () => {
  const { user, isMentor } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Listener real-time — collectionGroup('subscriptions') ──

  useEffect(() => {
    if (!user || !isMentor()) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collectionGroup(db, 'subscriptions'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const data = snapshot.docs.map(d => {
          const raw = d.data();
          const studentId = getStudentIdFromRef(d.ref);
          return {
            id: d.id,
            studentId,
            _path: d.ref.path, // para operações de escrita
            ...raw,
            type: raw.type ?? 'paid',
            startDate: toDate(raw.startDate),
            endDate: toDate(raw.endDate),
            renewalDate: toDate(raw.renewalDate),
            lastPaymentDate: toDate(raw.lastPaymentDate),
            trialEndsAt: toDate(raw.trialEndsAt),
            createdAt: toDate(raw.createdAt),
            updatedAt: toDate(raw.updatedAt),
          };
        });
        setSubscriptions(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useSubscriptions] Erro:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isMentor]);

  // ── Listener students (para nomes e seletor) ──

  useEffect(() => {
    if (!user || !isMentor()) {
      setStudents([]);
      return;
    }

    const q = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setStudents(data);
    });

    return () => unsubscribe();
  }, [user, isMentor]);

  // ── Enriquecer subscriptions com dados do student ──

  const enrichedSubscriptions = useMemo(() => {
    const studentMap = new Map(students.map(s => [s.id, s]));
    return subscriptions.map(sub => {
      const student = studentMap.get(sub.studentId);
      return {
        ...sub,
        studentName: student?.name ?? sub.studentId,
        studentEmail: student?.email ?? '',
      };
    });
  }, [subscriptions, students]);

  // ── Students sem subscription (para seletor "Nova Assinatura") ──

  const studentsWithoutSubscription = useMemo(() => {
    const studentIdsWithSub = new Set(subscriptions.map(s => s.studentId));
    return students.filter(s => !studentIdsWithSub.has(s.id));
  }, [students, subscriptions]);

  // ── Summary (computado) ──

  const summary = useMemo(() => {
    const active = enrichedSubscriptions.filter(s => s.status === 'active').length;
    const overdue = enrichedSubscriptions.filter(s => s.status === 'overdue').length;
    const expiringSoon = enrichedSubscriptions.filter(s => {
      if (s.status !== 'active') return false;
      if (s.type === 'trial') {
        const days = daysUntil(s.trialEndsAt);
        return days !== null && days >= 0 && days <= 7;
      }
      const days = daysUntil(s.renewalDate);
      return days !== null && days >= 0 && days <= 7;
    }).length;
    const monthlyRevenue = enrichedSubscriptions
      .filter(s => s.status === 'active' && s.type === 'paid')
      .reduce((sum, s) => sum + (s.amount ?? 0), 0);

    return { active, overdue, expiringSoon, monthlyRevenue, total: enrichedSubscriptions.length };
  }, [enrichedSubscriptions]);

  // ── Criar assinatura (subcollection do student) ──

  const addSubscription = useCallback(async (data) => {
    if (!user) throw new Error('Usuário não autenticado');
    if (!data.studentId) throw new Error('studentId obrigatório');

    const isTrial = data.type === 'trial';
    const startDate = new Date(data.startDate ?? new Date());

    const newSub = {
      type: data.type ?? 'paid',
      plan: data.plan ?? 'alpha',
      status: isTrial ? 'active' : 'pending',
      startDate: Timestamp.fromDate(startDate),
      notes: data.notes ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (isTrial) {
      const trialEnd = new Date(data.trialEndsAt ?? startDate);
      if (!data.trialEndsAt) trialEnd.setDate(trialEnd.getDate() + 30);
      newSub.trialEndsAt = Timestamp.fromDate(trialEnd);
    } else {
      const endDate = new Date(data.endDate ?? startDate);
      if (!data.endDate) endDate.setDate(endDate.getDate() + 30);
      newSub.endDate = Timestamp.fromDate(endDate);
      newSub.renewalDate = Timestamp.fromDate(new Date(data.renewalDate ?? endDate));
      newSub.lastPaymentDate = null;
      newSub.amount = parseFloat(data.amount) || 0;
      newSub.currency = data.currency ?? 'BRL';
      newSub.gracePeriodDays = parseInt(data.gracePeriodDays) || 5;
      newSub.billingPeriodMonths = parseInt(data.billingPeriodMonths) || 1;
    }

    // Escrita na subcollection: students/{studentId}/subscriptions
    const subColRef = collection(db, 'students', data.studentId, 'subscriptions');
    const docRef = await addDoc(subColRef, newSub);

    // Atualiza accessTier no student
    const tierValue = newSub.status === 'active' ? (data.plan ?? 'alpha') : 'none';
    await updateDoc(doc(db, 'students', data.studentId), {
      accessTier: tierValue,
      updatedAt: serverTimestamp(),
    });

    console.log('[useSubscriptions] Assinatura criada:', docRef.id, 'student:', data.studentId);
    return docRef.id;
  }, [user]);

  // ── Atualizar assinatura ──

  const updateSubscription = useCallback(async (sub, updates) => {
    if (!user) throw new Error('Usuário não autenticado');

    // sub deve ter studentId e id
    const ref = doc(db, 'students', sub.studentId, 'subscriptions', sub.id);
    const cleanUpdates = { ...updates, updatedAt: serverTimestamp() };

    for (const field of ['startDate', 'endDate', 'renewalDate', 'lastPaymentDate', 'trialEndsAt']) {
      if (cleanUpdates[field] && typeof cleanUpdates[field] === 'string') {
        cleanUpdates[field] = Timestamp.fromDate(new Date(cleanUpdates[field]));
      }
    }

    await updateDoc(ref, cleanUpdates);
    console.log('[useSubscriptions] Assinatura atualizada:', sub.id);
  }, [user]);

  // ── Registrar pagamento ──

  // ── Upload de recibo (imagem ou PDF) ──

  const uploadReceipt = useCallback(async (file, studentId, subscriptionId) => {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const path = `subscriptions/${studentId}/${subscriptionId}/receipt_${Date.now()}.${ext}`;
    const snap = await uploadBytes(ref(storage, path), file);
    return await getDownloadURL(snap.ref);
  }, []);

  // ── Registrar pagamento ──

  const registerPayment = useCallback(async (sub, paymentData, receiptFile = null) => {
    if (!user) throw new Error('Usuário não autenticado');

    // Upload do recibo se fornecido
    let receiptUrl = '';
    if (receiptFile) {
      receiptUrl = await uploadReceipt(receiptFile, sub.studentId, sub.id);
    }

    // sub deve ter studentId, id, amount, currency, renewalDate
    const paymentRef = collection(db, 'students', sub.studentId, 'subscriptions', sub.id, 'payments');
    const paymentDate = new Date(paymentData.date);
    const billingMonths = sub.billingPeriodMonths ?? 1;
    const periodEnd = new Date(paymentDate);
    periodEnd.setMonth(periodEnd.getMonth() + billingMonths);

    await addDoc(paymentRef, {
      date: Timestamp.fromDate(paymentDate),
      amount: parseFloat(paymentData.amount) || sub.amount,
      currency: paymentData.currency ?? sub.currency ?? 'BRL',
      method: paymentData.method ?? 'pix',
      reference: paymentData.reference ?? '',
      receiptUrl,
      periodStart: Timestamp.fromDate(paymentDate),
      periodEnd: Timestamp.fromDate(periodEnd),
      registeredBy: user.uid,
      createdAt: serverTimestamp(),
    });

    const subRef = doc(db, 'students', sub.studentId, 'subscriptions', sub.id);
    const newRenewalDate = new Date(sub.renewalDate ?? paymentDate);
    newRenewalDate.setMonth(newRenewalDate.getMonth() + billingMonths);

    await updateDoc(subRef, {
      lastPaymentDate: Timestamp.fromDate(paymentDate),
      renewalDate: Timestamp.fromDate(newRenewalDate),
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    // Sincroniza accessTier
    await updateDoc(doc(db, 'students', sub.studentId), {
      accessTier: sub.plan ?? 'alpha',
      updatedAt: serverTimestamp(),
    });

    console.log('[useSubscriptions] Pagamento registrado:', sub.id);
  }, [user]);

  // ── Renovar (sem pagamento) ──

  const renewSubscription = useCallback(async (sub) => {
    if (!user) throw new Error('Usuário não autenticado');

    const subRef = doc(db, 'students', sub.studentId, 'subscriptions', sub.id);
    const currentRenewal = sub.renewalDate ?? new Date();
    const newRenewalDate = new Date(currentRenewal);
    newRenewalDate.setDate(newRenewalDate.getDate() + 30);

    await updateDoc(subRef, {
      renewalDate: Timestamp.fromDate(newRenewalDate),
      endDate: Timestamp.fromDate(newRenewalDate),
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    // Sincroniza accessTier
    await updateDoc(doc(db, 'students', sub.studentId), {
      accessTier: sub.plan ?? 'alpha',
      updatedAt: serverTimestamp(),
    });

    console.log('[useSubscriptions] Assinatura renovada:', sub.id);
  }, [user]);

  // ── Buscar pagamentos de uma assinatura ──

  const getPayments = useCallback(async (sub) => {
    const q = query(
      collection(db, 'students', sub.studentId, 'subscriptions', sub.id, 'payments'),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      date: toDate(d.data().date),
      periodStart: toDate(d.data().periodStart),
      periodEnd: toDate(d.data().periodEnd),
      createdAt: toDate(d.data().createdAt),
    }));
  }, []);

  return {
    subscriptions: enrichedSubscriptions,
    students,
    studentsWithoutSubscription,
    loading,
    error,
    summary,
    addSubscription,
    updateSubscription,
    registerPayment,
    renewSubscription,
    getPayments,
  };
};

export default useSubscriptions;
