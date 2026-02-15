/**
 * useTrades
 * @version 5.6.0
 * @description Hook responsável pelo gerenciamento de trades (CRUD).
 * 
 * CHANGELOG:
 * - 5.6.0: Suporte a overrideStudentId para View As Student
 * - 5.5.0: Suporte Swing Trade, cálculo de duração
 * 
 * @firestore-index REQUERIDO: trades (studentId ASC, date DESC)
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDocs, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, TRADE_STATUS } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { calculateTradeResult, calculateResultPercent } from '../utils/calculations';

/**
 * @param {string|null} overrideStudentId - UID do aluno para View As Student
 */
export const useTrades = (overrideStudentId = null) => {
  const { user, isMentor } = useAuth();
  const [trades, setTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper: Calcula Duração em Minutos (Swing Ready)
  const calculateDuration = (entryISO, exitISO) => {
    if (!entryISO || !exitISO) return 0;
    try {
      const start = new Date(entryISO);
      const end = new Date(exitISO);
      const diffMs = end - start;
      return Math.floor(diffMs / 60000);
    } catch (e) {
      console.error('[useTrades] Erro duração:', e);
      return 0;
    }
  };

  // Efeito de Carregamento
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
        // MODO: Mentor visualizando como aluno específico
        console.log('[useTrades] Override mode:', overrideStudentId);
        
        const studentQuery = query(
          collection(db, 'trades'), 
          where('studentId', '==', overrideStudentId), 
          orderBy('date', 'desc')
        );

        unsubscribeStudent = onSnapshot(studentQuery, 
          (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setTrades(data);
            setAllTrades(data);
            setLoading(false);
          }, 
          (err) => {
            console.warn('[useTrades] Fallback override:', err.message);
            // Fallback sem orderBy
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
        // MODO: Mentor normal (vê TODOS os trades)
        console.log('[useTrades] Mentor mode - all trades');
        
        const allQuery = query(collection(db, 'trades'), orderBy('date', 'desc'));
        
        unsubscribeAll = onSnapshot(allQuery, 
          (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllTrades(data);
            setTrades(data); // Mentor também usa trades para componentes que dependem dele
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
        // MODO: Aluno normal
        console.log('[useTrades] Student mode:', user.email);
        
        const studentQuery = query(
          collection(db, 'trades'), 
          where('studentEmail', '==', user.email), 
          orderBy('date', 'desc')
        );

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

    return () => { 
      unsubscribeStudent(); 
      unsubscribeAll(); 
    };
  }, [user, isMentor, overrideStudentId]);

  const uploadImage = async (file, tradeId, type) => {
    if (!file) return null;
    const path = `trades/${tradeId}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const snap = await uploadBytes(ref(storage, path), file);
    return await getDownloadURL(snap.ref);
  };

  // ADD TRADE
  const addTrade = useCallback(async (tradeData, htfFile, ltfFile) => {
    if (!user) throw new Error('Usuário não autenticado');
    setLoading(true); 
    setError(null);
    
    console.log('[useTrades] addTrade iniciando...');

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
      
      if (tradeData.tickerRule && tradeData.tickerRule.tickSize && tradeData.tickerRule.tickValue) {
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
        date: legacyDate, 
        entryTime,
        exitTime,
        duration,
        ticker: tradeData.ticker?.toUpperCase() || '',
        entry, exit, qty, result: Math.round(result * 100) / 100,
        resultPercent: calculateResultPercent(side, entry, exit),
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        studentId: user.uid,
        status: TRADE_STATUS?.PENDING_REVIEW || 'PENDING_REVIEW',
        accountId: derivedAccountId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        htfUrl: null, ltfUrl: null, mentorFeedback: null,
      };

      const docRef = await addDoc(collection(db, 'trades'), newTrade);
      console.log('[useTrades] Trade gravado:', docRef.id);
      
      if (htfFile) { const url = await uploadImage(htfFile, docRef.id, 'htf'); await updateDoc(docRef, { htfUrl: url }); }
      if (ltfFile) { const url = await uploadImage(ltfFile, docRef.id, 'ltf'); await updateDoc(docRef, { ltfUrl: url }); }

      // Cria Movimento (Ledger)
      if (derivedAccountId && result !== 0) {
        const qMoves = query(collection(db, 'movements'), where('accountId', '==', derivedAccountId));
        const snapMoves = await getDocs(qMoves);
        const moves = snapMoves.docs.map(d => d.data()).sort((a,b) => (b.dateTime||'').localeCompare(a.dateTime||''));
        const balanceBefore = moves[0]?.balanceAfter || 0;

        await addDoc(collection(db, 'movements'), {
          accountId: derivedAccountId,
          type: 'TRADE_RESULT',
          amount: result,
          balanceBefore,
          balanceAfter: balanceBefore + result,
          description: `${tradeData.side} ${tradeData.ticker} (${tradeData.qty}x)`,
          date: legacyDate, 
          dateTime: exitTime || new Date().toISOString(), 
          tradeId: docRef.id,
          studentId: user.uid,
          studentEmail: user.email,
          createdBy: user.uid,
          createdAt: serverTimestamp()
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

  // UPDATE TRADE
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

      const entry = parseFloat(updates.entry !== undefined ? updates.entry : currentTrade.entry);
      const exit = parseFloat(updates.exit !== undefined ? updates.exit : currentTrade.exit);
      const qty = parseFloat(updates.qty !== undefined ? updates.qty : currentTrade.qty);
      const side = updates.side || currentTrade.side;
      const tickerRule = updates.tickerRule || currentTrade.tickerRule;

      let newResult = currentTrade.result;

      if (updates.entry !== undefined || updates.exit !== undefined || updates.qty !== undefined || updates.side !== undefined) {
        if (tickerRule && tickerRule.tickSize && tickerRule.tickValue) {
          const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
          const ticks = rawDiff / tickerRule.tickSize;
          newResult = ticks * tickerRule.tickValue * qty;
        } else {
          newResult = calculateTradeResult(side, entry, exit, qty);
        }
        updateData.result = Math.round(newResult * 100) / 100;
        updateData.resultPercent = calculateResultPercent(side, entry, exit);
        updateData.entry = entry; updateData.exit = exit; updateData.qty = qty;
      }

      await updateDoc(tradeRef, updateData);

      // Sincronia de Ledger
      if (currentTrade.accountId && Math.abs(newResult - currentTrade.result) > 0.01) {
        const qMov = query(collection(db, 'movements'), where('tradeId', '==', tradeId));
        const snapMov = await getDocs(qMov);
        if (!snapMov.empty) {
          await Promise.all(snapMov.docs.map(d => deleteDoc(d.ref)));
        }

        if (newResult !== 0) {
          const qMoves = query(collection(db, 'movements'), where('accountId', '==', currentTrade.accountId));
          const snapMoves = await getDocs(qMoves);
          const moves = snapMoves.docs.map(d => d.data()).sort((a,b) => (b.dateTime||'').localeCompare(a.dateTime||''));
          const balanceBefore = moves[0]?.balanceAfter || 0;

          await addDoc(collection(db, 'movements'), {
            accountId: currentTrade.accountId,
            type: 'TRADE_RESULT',
            amount: newResult,
            balanceBefore, 
            balanceAfter: balanceBefore + newResult,
            description: `${side} ${updateData.ticker || currentTrade.ticker} (${qty}x) [Edit]`,
            date: updateData.date || currentTrade.date,
            dateTime: newExitTime || new Date().toISOString(),
            tradeId: tradeId,
            studentId: user.uid,
            studentEmail: user.email,
            createdBy: user.uid,
            createdAt: serverTimestamp()
          });
        }
      }

      return { id: tradeId, ...currentTrade, ...updateData };
    } catch (err) { console.error(err); setError(err.message); throw err; } finally { setLoading(false); }
  }, [user]);

  // DELETE TRADE
  const deleteTrade = useCallback(async (tradeId) => {
     if (!user) throw new Error('Auth required');
     setLoading(true);
     console.log('[useTrades] Deletando:', tradeId);

     try {
         const qMov = query(collection(db, 'movements'), where('tradeId', '==', tradeId));
         const snapMov = await getDocs(qMov);
         console.log(`[useTrades] ${snapMov.size} movimentos encontrados`);

         try {
            await Promise.all(snapMov.docs.map(d => deleteDoc(d.ref)));
         } catch (movErr) {
            console.error('[useTrades] Erro movimentos:', movErr);
         }

         await deleteDoc(doc(db, 'trades', tradeId));
         console.log('[useTrades] Trade deletado');
         return true;

     } catch(err) { 
         console.error('[useTrades] Erro fatal:', err);
         throw err; 
     } finally { 
         setLoading(false); 
     }
  }, [user]);

  const addFeedback = useCallback(async (tradeId, feedback) => {
     if (!user || !isMentor()) throw new Error('Apenas mentores');
     await updateDoc(doc(db, 'trades', tradeId), { mentorFeedback: feedback, status: 'REVIEWED', updatedAt: serverTimestamp() });
  }, [user, isMentor]);

  // HELPERS para o App.jsx
  const getTradesByStudent = useCallback((email) => allTrades.filter(t => t.studentEmail === email), [allTrades]);
  
  const getTradesAwaitingFeedback = useCallback(() => {
    return allTrades.filter(t => t.status === 'PENDING_REVIEW');
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
  
  return { 
    trades, 
    allTrades, 
    loading, 
    error, 
    addTrade, 
    updateTrade, 
    deleteTrade, 
    addFeedback, 
    getTradesByStudent,
    getTradesAwaitingFeedback,
    getTradesGroupedByStudent
  };
};

export default useTrades;
