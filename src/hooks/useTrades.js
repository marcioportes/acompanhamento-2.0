/**
 * useTrades
 * @see version.js para versão do produto
 * @description Hook responsável pelo gerenciamento de trades (CRUD) + Sistema de Feedback + Parciais
 * 
 * CHANGELOG (produto):
 * - 1.6.0: Sistema de parciais (1 Trade → N Parciais)
 *   - addPartial(): Adiciona parcial a um trade existente
 *   - updatePartial(): Atualiza parcial existente
 *   - deletePartial(): Remove parcial e recalcula
 *   - getPartials(): Busca parciais de um trade
 *   - recalculateFromPartials(): Recalcula resultado do trade a partir das parciais
 * - 1.5.0: Plan-centric ledger
 * - 1.4.0: Sistema completo de feedback com máquina de estados
 * 
 * MÁQUINA DE ESTADOS:
 * OPEN → Mentor dá feedback → REVIEWED
 * REVIEWED → Aluno pergunta → QUESTION
 * REVIEWED → Aluno encerra → CLOSED
 * QUESTION → Mentor responde → REVIEWED
 * 
 * @firestore-index REQUERIDO: trades (studentId ASC, date DESC)
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDocs, getDoc, serverTimestamp, arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { calculateTradeResult, calculateResultPercent } from '../utils/calculations';
import { calculateFromPartials, validatePartials } from '../utils/tradeCalculations';

// Status constants
const STATUS = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  QUESTION: 'QUESTION',
  CLOSED: 'CLOSED'
};

const DEFAULT_STATUS = STATUS.OPEN;

/**
 * @param {string|null} overrideStudentId - UID do aluno para View As Student
 */
export const useTrades = (overrideStudentId = null) => {
  const { user, isMentor } = useAuth();
  const [trades, setTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateDuration = (entryISO, exitISO) => {
    if (!entryISO || !exitISO) return 0;
    try {
      const start = new Date(entryISO);
      const end = new Date(exitISO);
      return Math.floor((end - start) / 60000);
    } catch (e) {
      console.error('[useTrades] Erro duração:', e);
      return 0;
    }
  };

  useEffect(() => {
    if (!user) { 
      setTrades([]); 
      setAllTrades([]); 
      setLoading(false); 
      return; 
    }
    
    setLoading(true); 
    setError(null);

    let unsubscribeStudent = () => {};
    let unsubscribeAll = () => {};

    try {
      if (overrideStudentId) {
        console.log('[useTrades] Override mode:', overrideStudentId);
        const studentQuery = query(collection(db, 'trades'), where('studentId', '==', overrideStudentId), orderBy('date', 'desc'));
        unsubscribeStudent = onSnapshot(studentQuery, 
          (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setTrades(data);
            setAllTrades(data);
            setLoading(false);
          }, 
          (err) => {
            console.warn('[useTrades] Fallback override:', err.message);
            const fallback = query(collection(db, 'trades'), where('studentId', '==', overrideStudentId));
            onSnapshot(fallback, (snap) => {
              const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              setTrades(data);
              setAllTrades(data);
              setLoading(false);
            });
          }
        );
      } else if (isMentor()) {
        console.log('[useTrades] Mentor mode - all trades');
        const allQuery = query(collection(db, 'trades'), orderBy('date', 'desc'));
        unsubscribeAll = onSnapshot(allQuery, 
          (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllTrades(data);
            setTrades(data);
            setLoading(false);
          }, 
          (err) => {
            console.warn('[useTrades] Fallback mentor:', err.message);
            const fallback = query(collection(db, 'trades'));
            onSnapshot(fallback, (snap) => {
              const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              setAllTrades(data);
              setTrades(data);
              setLoading(false);
            });
          }
        );
      } else {
        console.log('[useTrades] Student mode:', user.email);
        const studentQuery = query(collection(db, 'trades'), where('studentEmail', '==', user.email), orderBy('date', 'desc'));
        unsubscribeStudent = onSnapshot(studentQuery, 
          (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setTrades(data);
            setLoading(false);
          }, 
          (err) => {
            console.warn('[useTrades] Fallback student:', err.message);
            const fallback = query(collection(db, 'trades'), where('studentEmail', '==', user.email));
            onSnapshot(fallback, (snap) => {
              const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              setTrades(data);
              setLoading(false);
            });
          }
        );
      }
    } catch (err) {
      console.error('[useTrades] Setup error:', err);
      setError(err.message);
      setLoading(false);
    }

    return () => { unsubscribeStudent(); unsubscribeAll(); };
  }, [user, isMentor, overrideStudentId]);

  const uploadImage = async (file, tradeId, type) => {
    if (!file) return null;
    const path = `trades/${tradeId}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const snap = await uploadBytes(ref(storage, path), file);
    return await getDownloadURL(snap.ref);
  };

  const addTrade = useCallback(async (tradeData, htfFile, ltfFile) => {
    if (!user) throw new Error('Usuário não autenticado');
    setLoading(true); 
    setError(null);

    try {
      if (!tradeData.planId) throw new Error('Selecione um Plano.');
      const planRef = doc(db, 'plans', tradeData.planId);
      const planSnap = await getDoc(planRef);
      if (!planSnap.exists()) throw new Error('Plano não encontrado.');
      const derivedAccountId = planSnap.data().accountId;
      if (!derivedAccountId) throw new Error('Plano sem conta vinculada.');

      const entry = parseFloat(tradeData.entry);
      const exit = parseFloat(tradeData.exit);
      const qty = parseFloat(tradeData.qty);
      const side = tradeData.side;
      let result;
      
      if (tradeData.tickerRule?.tickSize && tradeData.tickerRule?.tickValue) {
        const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
        const ticks = rawDiff / tradeData.tickerRule.tickSize;
        result = ticks * tradeData.tickerRule.tickValue * qty;
      } else {
        result = calculateTradeResult(side, entry, exit, qty);
      }
      
      const entryTime = tradeData.entryTime; 
      const exitTime = tradeData.exitTime || null;
      const duration = calculateDuration(entryTime, exitTime);
      const legacyDate = entryTime ? entryTime.split('T')[0] : new Date().toISOString().split('T')[0];

      const newTrade = {
        ...tradeData,
        date: legacyDate, entryTime, exitTime, duration,
        ticker: tradeData.ticker?.toUpperCase() || '',
        entry, exit, qty, 
        result: Math.round(result * 100) / 100,
        resultPercent: calculateResultPercent(side, entry, exit),
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        studentId: user.uid,
        status: DEFAULT_STATUS,
        accountId: derivedAccountId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        htfUrl: null, ltfUrl: null, mentorFeedback: null,
        feedbackHistory: []
      };

      const docRef = await addDoc(collection(db, 'trades'), newTrade);
      
      if (htfFile) { const url = await uploadImage(htfFile, docRef.id, 'htf'); await updateDoc(docRef, { htfUrl: url }); }
      if (ltfFile) { const url = await uploadImage(ltfFile, docRef.id, 'ltf'); await updateDoc(docRef, { ltfUrl: url }); }

      if (derivedAccountId && result !== 0) {
        const qMoves = query(collection(db, 'movements'), where('accountId', '==', derivedAccountId));
        const snapMoves = await getDocs(qMoves);
        const moves = snapMoves.docs.map(d => d.data()).sort((a,b) => (b.dateTime||'').localeCompare(a.dateTime||''));
        const balanceBefore = moves[0]?.balanceAfter || 0;

        await addDoc(collection(db, 'movements'), {
          accountId: derivedAccountId, type: 'TRADE_RESULT', amount: result,
          balanceBefore, balanceAfter: balanceBefore + result,
          description: `${tradeData.side} ${tradeData.ticker} (${tradeData.qty}x)`,
          date: legacyDate, dateTime: exitTime || new Date().toISOString(), 
          tradeId: docRef.id, studentId: user.uid, studentEmail: user.email,
          createdBy: user.uid, createdAt: serverTimestamp()
        });
      }
      return { id: docRef.id, ...newTrade };
    } catch (err) { 
      console.error('[useTrades] Erro:', err);
      setError(err.message); 
      throw err; 
    } finally { 
      setLoading(false); 
    }
  }, [user]);

  const updateTrade = useCallback(async (tradeId, updates, htfFile, ltfFile) => {
    if (!user) throw new Error('Auth required');
    setLoading(true); setError(null);

    try {
      const tradeRef = doc(db, 'trades', tradeId);
      const tradeSnap = await getDoc(tradeRef);
      if (!tradeSnap.exists()) throw new Error('Trade não encontrado');
      
      const currentTrade = tradeSnap.data();
      const updateData = { ...updates, updatedAt: serverTimestamp() };

      const newEntryTime = updates.entryTime || currentTrade.entryTime;
      const newExitTime = updates.exitTime || currentTrade.exitTime;
      if (newEntryTime && newExitTime) updateData.duration = calculateDuration(newEntryTime, newExitTime);
      if (updates.entryTime) updateData.date = updates.entryTime.split('T')[0];

      if (htfFile) updateData.htfUrl = await uploadImage(htfFile, tradeId, 'htf');
      if (ltfFile) updateData.ltfUrl = await uploadImage(ltfFile, tradeId, 'ltf');

      const entry = parseFloat(updates.entry ?? currentTrade.entry);
      const exit = parseFloat(updates.exit ?? currentTrade.exit);
      const qty = parseFloat(updates.qty ?? currentTrade.qty);
      const side = updates.side || currentTrade.side;
      const tickerRule = updates.tickerRule || currentTrade.tickerRule;

      let newResult = currentTrade.result;

      if (updates.entry !== undefined || updates.exit !== undefined || updates.qty !== undefined || updates.side !== undefined) {
        if (tickerRule?.tickSize && tickerRule?.tickValue) {
          const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
          newResult = (rawDiff / tickerRule.tickSize) * tickerRule.tickValue * qty;
        } else {
          newResult = calculateTradeResult(side, entry, exit, qty);
        }
        updateData.result = Math.round(newResult * 100) / 100;
        updateData.resultPercent = calculateResultPercent(side, entry, exit);
        updateData.entry = entry; updateData.exit = exit; updateData.qty = qty;
      }

      await updateDoc(tradeRef, updateData);

      if (currentTrade.accountId && Math.abs(newResult - currentTrade.result) > 0.01) {
        const qMov = query(collection(db, 'movements'), where('tradeId', '==', tradeId));
        const snapMov = await getDocs(qMov);
        if (!snapMov.empty) await Promise.all(snapMov.docs.map(d => deleteDoc(d.ref)));

        if (newResult !== 0) {
          const qMoves = query(collection(db, 'movements'), where('accountId', '==', currentTrade.accountId));
          const snapMoves = await getDocs(qMoves);
          const moves = snapMoves.docs.map(d => d.data()).sort((a,b) => (b.dateTime||'').localeCompare(a.dateTime||''));
          const balanceBefore = moves[0]?.balanceAfter || 0;

          await addDoc(collection(db, 'movements'), {
            accountId: currentTrade.accountId, type: 'TRADE_RESULT', amount: newResult,
            balanceBefore, balanceAfter: balanceBefore + newResult,
            description: `${side} ${updateData.ticker || currentTrade.ticker} (${qty}x) [Edit]`,
            date: updateData.date || currentTrade.date,
            dateTime: newExitTime || new Date().toISOString(),
            tradeId, studentId: user.uid, studentEmail: user.email,
            createdBy: user.uid, createdAt: serverTimestamp()
          });
        }
      }

      return { id: tradeId, ...currentTrade, ...updateData };
    } catch (err) { console.error(err); setError(err.message); throw err; } finally { setLoading(false); }
  }, [user]);

  const deleteTrade = useCallback(async (tradeId) => {
    if (!user) throw new Error('Auth required');
    setLoading(true);

    try {
      const qMov = query(collection(db, 'movements'), where('tradeId', '==', tradeId));
      const snapMov = await getDocs(qMov);
      try { await Promise.all(snapMov.docs.map(d => deleteDoc(d.ref))); } catch (e) { console.error(e); }
      await deleteDoc(doc(db, 'trades', tradeId));
      return true;
    } catch(err) { 
      console.error('[useTrades] Erro fatal:', err);
      throw err; 
    } finally { 
      setLoading(false); 
    }
  }, [user]);

  // ============================================
  // SISTEMA DE FEEDBACK v1.3.0
  // ============================================

  const addFeedback = useCallback(async (tradeId, feedback) => {
    if (!user || !isMentor()) throw new Error('Apenas mentores');
    
    const comment = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      author: user.email,
      authorName: user.displayName || user.email.split('@')[0],
      authorRole: 'mentor',
      content: feedback.trim(),
      isQuestion: false,
      createdAt: new Date().toISOString(),
    };
    
    await updateDoc(doc(db, 'trades', tradeId), { 
      mentorFeedback: feedback, 
      feedbackDate: new Date().toISOString(),
      feedbackHistory: arrayUnion(comment),
      status: STATUS.REVIEWED, 
      updatedAt: serverTimestamp() 
    });
  }, [user, isMentor]);

  /**
   * Adiciona comentário ao histórico com transição de status automática
   */
  const addFeedbackComment = useCallback(async (tradeId, content, isQuestion = false) => {
    if (!user) throw new Error('Auth required');
    
    const tradeRef = doc(db, 'trades', tradeId);
    const tradeSnap = await getDoc(tradeRef);
    if (!tradeSnap.exists()) throw new Error('Trade não encontrado');
    
    const trade = tradeSnap.data();
    const userIsMentor = isMentor();
    
    // Determina o novo status
    let newStatus = trade.status;
    if (userIsMentor) {
      // Mentor: OPEN → REVIEWED, QUESTION → REVIEWED
      if (trade.status === STATUS.OPEN || trade.status === STATUS.QUESTION) {
        newStatus = STATUS.REVIEWED;
      }
    } else {
      // Aluno: se é dúvida, REVIEWED → QUESTION
      if (isQuestion && trade.status === STATUS.REVIEWED) {
        newStatus = STATUS.QUESTION;
      }
    }
    
    const comment = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      author: user.email,
      authorName: user.displayName || user.email.split('@')[0],
      authorRole: userIsMentor ? 'mentor' : 'student',
      content: content.trim(),
      isQuestion,
      createdAt: new Date().toISOString(),
    };
    
    const updateData = {
      feedbackHistory: arrayUnion(comment),
      status: newStatus,
      updatedAt: serverTimestamp(),
    };
    
    // Primeiro feedback do mentor também atualiza campo legado
    if (userIsMentor && trade.status === STATUS.OPEN) {
      updateData.mentorFeedback = content.trim();
      updateData.feedbackDate = new Date().toISOString();
    }
    
    await updateDoc(tradeRef, updateData);
    console.log(`[useTrades] Feedback: ${trade.status} → ${newStatus}`);
    
    return { 
      ...trade, id: tradeId, ...updateData, 
      feedbackHistory: [...(trade.feedbackHistory || []), comment] 
    };
  }, [user, isMentor]);

  /**
   * Atualiza apenas o status do trade
   */
  const updateTradeStatus = useCallback(async (tradeId, newStatus) => {
    if (!user) throw new Error('Auth required');
    await updateDoc(doc(db, 'trades', tradeId), { status: newStatus, updatedAt: serverTimestamp() });
    console.log(`[useTrades] Status → ${newStatus}`);
  }, [user]);

  // ============================================
  // SISTEMA DE PARCIAIS v1.6.0
  // ============================================

  /**
   * Busca parciais de um trade (subcollection)
   * @param {string} tradeId
   * @returns {Promise<Array>} Lista de parciais ordenadas por seq
   */
  const getPartials = useCallback(async (tradeId) => {
    const partialsRef = collection(db, 'trades', tradeId, 'partials');
    const q = query(partialsRef, orderBy('seq', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);

  /**
   * Recalcula resultado do trade a partir das parciais e atualiza o doc
   * @param {string} tradeId
   * @returns {Promise<Object>} Trade atualizado
   */
  const recalculateFromPartials = useCallback(async (tradeId) => {
    const tradeRef = doc(db, 'trades', tradeId);
    const tradeSnap = await getDoc(tradeRef);
    if (!tradeSnap.exists()) throw new Error('Trade não encontrado');
    const trade = tradeSnap.data();

    const partials = await getPartials(tradeId);
    
    if (partials.length === 0) {
      // Sem parciais → reverter para trade simples
      await updateDoc(tradeRef, {
        hasPartials: false,
        partialsCount: 0,
        updatedAt: serverTimestamp()
      });
      return { id: tradeId, ...trade, hasPartials: false, partialsCount: 0 };
    }

    const calc = calculateFromPartials({
      side: trade.side,
      partials,
      tickerRule: trade.tickerRule || null
    });

    const updateData = {
      hasPartials: true,
      partialsCount: partials.length,
      avgEntry: calc.avgEntry,
      avgExit: calc.avgExit,
      totalQty: calc.realizedQty,
      entry: calc.avgEntry,        // retrocompat: entry = avgEntry
      exit: calc.avgExit,          // retrocompat: exit = avgExit
      qty: calc.realizedQty,       // retrocompat: qty = realizedQty
      result: calc.result,
      resultPercent: calc.avgEntry > 0 
        ? calculateResultPercent(trade.side, calc.avgEntry, calc.avgExit) 
        : 0,
      updatedAt: serverTimestamp()
    };

    await updateDoc(tradeRef, updateData);
    console.log(`[useTrades] Trade ${tradeId} recalculado: result=${calc.result}, partials=${partials.length}`);

    return { id: tradeId, ...trade, ...updateData };
  }, [getPartials]);

  /**
   * Adiciona parcial a um trade
   * @param {string} tradeId
   * @param {Object} partialData - { type: 'ENTRY'|'EXIT', price, qty, dateTime?, notes? }
   * @returns {Promise<Object>} Parcial criada
   */
  const addPartial = useCallback(async (tradeId, partialData) => {
    if (!user) throw new Error('Auth required');

    // Buscar parciais existentes para calcular seq
    const existing = await getPartials(tradeId);
    const nextSeq = existing.length > 0 
      ? Math.max(...existing.map(p => p.seq || 0)) + 1 
      : 1;

    const partial = {
      seq: nextSeq,
      type: partialData.type,  // 'ENTRY' ou 'EXIT'
      price: parseFloat(partialData.price),
      qty: parseFloat(partialData.qty),
      dateTime: partialData.dateTime || new Date().toISOString(),
      notes: partialData.notes || '',
      createdAt: serverTimestamp()
    };

    // Validar antes de salvar
    const allPartials = [...existing, partial];
    const tradeSnap = await getDoc(doc(db, 'trades', tradeId));
    const validation = validatePartials(allPartials, tradeSnap.data()?.side);
    if (!validation.valid) {
      throw new Error(`Parcial inválida: ${validation.errors.join(', ')}`);
    }

    const partialsRef = collection(db, 'trades', tradeId, 'partials');
    const docRef = await addDoc(partialsRef, partial);
    console.log(`[useTrades] Parcial ${docRef.id} adicionada ao trade ${tradeId} (seq=${nextSeq})`);

    // Recalcular trade
    await recalculateFromPartials(tradeId);

    return { id: docRef.id, ...partial };
  }, [user, getPartials, recalculateFromPartials]);

  /**
   * Atualiza uma parcial existente
   * @param {string} tradeId
   * @param {string} partialId
   * @param {Object} updates - { price?, qty?, type?, dateTime?, notes? }
   */
  const updatePartial = useCallback(async (tradeId, partialId, updates) => {
    if (!user) throw new Error('Auth required');

    const partialRef = doc(db, 'trades', tradeId, 'partials', partialId);
    const updateData = { ...updates, updatedAt: serverTimestamp() };
    if (updates.price !== undefined) updateData.price = parseFloat(updates.price);
    if (updates.qty !== undefined) updateData.qty = parseFloat(updates.qty);

    await updateDoc(partialRef, updateData);
    console.log(`[useTrades] Parcial ${partialId} atualizada`);

    // Recalcular trade
    await recalculateFromPartials(tradeId);
  }, [user, recalculateFromPartials]);

  /**
   * Remove uma parcial
   * @param {string} tradeId
   * @param {string} partialId
   */
  const deletePartial = useCallback(async (tradeId, partialId) => {
    if (!user) throw new Error('Auth required');

    await deleteDoc(doc(db, 'trades', tradeId, 'partials', partialId));
    console.log(`[useTrades] Parcial ${partialId} deletada`);

    // Recalcular trade (pode reverter para simples se 0 parciais)
    await recalculateFromPartials(tradeId);
  }, [user, recalculateFromPartials]);

  // ============================================
  // HELPERS
  // ============================================
  
  const getTradesByStudent = useCallback((email) => allTrades.filter(t => t.studentEmail === email), [allTrades]);
  
  const getTradesAwaitingFeedback = useCallback(() => {
    return allTrades.filter(t => t.status === STATUS.OPEN || t.status === STATUS.QUESTION);
  }, [allTrades]);

  const getTradesGroupedByStudent = useCallback(() => {
    const grouped = {};
    allTrades.forEach(t => {
      const key = t.studentEmail || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });
    return grouped;
  }, [allTrades]);

  const getUniqueStudents = useCallback(() => {
    const map = {};
    allTrades.forEach(t => {
      if (t.studentEmail && !map[t.studentEmail]) {
        map[t.studentEmail] = {
          email: t.studentEmail,
          name: t.studentName || t.studentEmail.split('@')[0],
          studentId: t.studentId
        };
      }
    });
    return Object.values(map);
  }, [allTrades]);

  const getStudentFeedbackCounts = useCallback((studentEmail) => {
    const studentTrades = allTrades.filter(t => t.studentEmail === studentEmail);
    return {
      open: studentTrades.filter(t => t.status === STATUS.OPEN).length,
      question: studentTrades.filter(t => t.status === STATUS.QUESTION).length,
      reviewed: studentTrades.filter(t => t.status === STATUS.REVIEWED).length,
      closed: studentTrades.filter(t => t.status === STATUS.CLOSED).length,
      total: studentTrades.length
    };
  }, [allTrades]);

  const getTradesByStudentAndStatus = useCallback((studentEmail, status) => {
    return allTrades.filter(t => t.studentEmail === studentEmail && t.status === status);
  }, [allTrades]);
  
  return { 
    trades, allTrades, loading, error, 
    addTrade, updateTrade, deleteTrade, 
    addFeedback, addFeedbackComment, updateTradeStatus,
    // Parciais
    addPartial, updatePartial, deletePartial, getPartials, recalculateFromPartials,
    // Helpers
    getTradesByStudent, getTradesAwaitingFeedback, getTradesGroupedByStudent,
    getUniqueStudents, getStudentFeedbackCounts, getTradesByStudentAndStatus
  };
};

export default useTrades;
