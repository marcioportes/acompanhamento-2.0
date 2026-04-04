/**
 * useSubscriptions
 * @description Hook para gestão de assinaturas da mentoria (issue #094)
 * @see version.js para versão do produto
 *
 * CHANGELOG:
 * - 1.0.0: CRUD completo — listener real-time, add, update, registerPayment, renew
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, doc,
  getDocs, serverTimestamp, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
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

// ── Hook ─────────────────────────────────────────────────

export const useSubscriptions = () => {
  const { user, isMentor } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Listener real-time ──

  useEffect(() => {
    if (!user || !isMentor()) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'subscriptions'),
      orderBy('renewalDate', 'asc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          // Normaliza timestamps para Date objects para UI
          startDate: toDate(d.data().startDate),
          endDate: toDate(d.data().endDate),
          renewalDate: toDate(d.data().renewalDate),
          lastPaymentDate: toDate(d.data().lastPaymentDate),
          createdAt: toDate(d.data().createdAt),
          updatedAt: toDate(d.data().updatedAt),
        }));
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

  // ── Summary (computado) ──

  const summary = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active').length;
    const overdue = subscriptions.filter(s => s.status === 'overdue').length;
    const expiringSoon = subscriptions.filter(s => {
      if (s.status !== 'active') return false;
      const days = daysUntil(s.renewalDate);
      return days !== null && days >= 0 && days <= 7;
    }).length;
    const monthlyRevenue = subscriptions
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + (s.amount ?? 0), 0);

    return { active, overdue, expiringSoon, monthlyRevenue, total: subscriptions.length };
  }, [subscriptions]);

  // ── Criar assinatura ──

  const addSubscription = useCallback(async (data) => {
    if (!user) throw new Error('Usuário não autenticado');

    const newSub = {
      studentId: data.studentId,
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      plan: data.plan ?? 'alpha',
      status: 'pending',
      startDate: Timestamp.fromDate(new Date(data.startDate)),
      endDate: Timestamp.fromDate(new Date(data.endDate)),
      renewalDate: Timestamp.fromDate(new Date(data.renewalDate ?? data.endDate)),
      lastPaymentDate: null,
      amount: parseFloat(data.amount) || 0,
      currency: data.currency ?? 'BRL',
      gracePeriodDays: parseInt(data.gracePeriodDays) || 5,
      notes: data.notes ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'subscriptions'), newSub);
    console.log('[useSubscriptions] Assinatura criada:', docRef.id);
    return docRef.id;
  }, [user]);

  // ── Atualizar assinatura ──

  const updateSubscription = useCallback(async (subscriptionId, updates) => {
    if (!user) throw new Error('Usuário não autenticado');

    const ref = doc(db, 'subscriptions', subscriptionId);
    const cleanUpdates = { ...updates, updatedAt: serverTimestamp() };

    // Converte datas string para Timestamp
    for (const field of ['startDate', 'endDate', 'renewalDate', 'lastPaymentDate']) {
      if (cleanUpdates[field] && typeof cleanUpdates[field] === 'string') {
        cleanUpdates[field] = Timestamp.fromDate(new Date(cleanUpdates[field]));
      }
    }

    await updateDoc(ref, cleanUpdates);
    console.log('[useSubscriptions] Assinatura atualizada:', subscriptionId);
  }, [user]);

  // ── Registrar pagamento ──

  const registerPayment = useCallback(async (subscriptionId, paymentData) => {
    if (!user) throw new Error('Usuário não autenticado');

    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (!sub) throw new Error('Assinatura não encontrada');

    // Cria payment na subcollection
    const paymentRef = collection(db, 'subscriptions', subscriptionId, 'payments');
    const paymentDate = new Date(paymentData.date);
    const periodEnd = new Date(paymentDate);
    periodEnd.setDate(periodEnd.getDate() + 30);

    await addDoc(paymentRef, {
      date: Timestamp.fromDate(paymentDate),
      amount: parseFloat(paymentData.amount) || sub.amount,
      currency: paymentData.currency ?? sub.currency ?? 'BRL',
      method: paymentData.method ?? 'pix',
      reference: paymentData.reference ?? '',
      periodStart: Timestamp.fromDate(paymentDate),
      periodEnd: Timestamp.fromDate(periodEnd),
      registeredBy: user.uid,
      createdAt: serverTimestamp(),
    });

    // Atualiza subscription: avança renewalDate +30 dias, status active
    const newRenewalDate = new Date(sub.renewalDate ?? paymentDate);
    newRenewalDate.setDate(newRenewalDate.getDate() + 30);

    await updateDoc(doc(db, 'subscriptions', subscriptionId), {
      lastPaymentDate: Timestamp.fromDate(paymentDate),
      renewalDate: Timestamp.fromDate(newRenewalDate),
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    console.log('[useSubscriptions] Pagamento registrado:', subscriptionId);
  }, [user, subscriptions]);

  // ── Renovar (sem pagamento) ──

  const renewSubscription = useCallback(async (subscriptionId) => {
    if (!user) throw new Error('Usuário não autenticado');

    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (!sub) throw new Error('Assinatura não encontrada');

    const currentRenewal = sub.renewalDate ?? new Date();
    const newRenewalDate = new Date(currentRenewal);
    newRenewalDate.setDate(newRenewalDate.getDate() + 30);

    await updateDoc(doc(db, 'subscriptions', subscriptionId), {
      renewalDate: Timestamp.fromDate(newRenewalDate),
      endDate: Timestamp.fromDate(newRenewalDate),
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    console.log('[useSubscriptions] Assinatura renovada:', subscriptionId);
  }, [user, subscriptions]);

  // ── Buscar pagamentos de uma assinatura ──

  const getPayments = useCallback(async (subscriptionId) => {
    const q = query(
      collection(db, 'subscriptions', subscriptionId, 'payments'),
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
    subscriptions,
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
