/**
 * useTrades
 * @version 5.2.0 (Robust Update & Ledger Sync)
 * @description Hook responsável pelo gerenciamento de trades (CRUD).
 * * CHANGE LOG 5.2.0:
 * - FEAT: 'updateTrade' agora recalcula o resultado financeiro (WINFUT/WDOFUT) mesclando dados atuais + edições.
 * - FIX: Sincronização automática do Ledger. Ao editar um trade, o movimento anterior é deletado e um novo é criado.
 * - SECURITY: 'deleteTrade' garante a remoção de movimentos vinculados para evitar extratos inconsistentes.
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

export const useTrades = () => {
  const { user, isMentor } = useAuth();
  const [trades, setTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Efeito de Carregamento (Mantido) ---
  useEffect(() => {
    if (!user) { setTrades([]); setAllTrades([]); setLoading(false); return; }
    setLoading(true); setError(null);

    let unsubscribeStudent = () => {};
    let unsubscribeAll = () => {};

    const studentQuery = query(collection(db, 'trades'), where('studentEmail', '==', user.email), orderBy('date', 'desc'));
    unsubscribeStudent = onSnapshot(studentQuery, (snapshot) => {
        const tradesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTrades(tradesData); setLoading(false);
      }, (err) => {
        // Fallback para query simples se índice composto falhar
        const fallbackQuery = query(collection(db, 'trades'), where('studentEmail', '==', user.email));
        onSnapshot(fallbackQuery, (snapshot) => {
          const tradesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          tradesData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          setTrades(tradesData); setLoading(false);
        });
      }
    );

    if (isMentor()) {
      const allQuery = query(collection(db, 'trades'), orderBy('date', 'desc'));
      unsubscribeAll = onSnapshot(allQuery, (snapshot) => {
          setAllTrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, () => {}
      );
    }
    return () => { unsubscribeStudent(); unsubscribeAll(); };
  }, [user, isMentor]);

  const uploadImage = async (file, tradeId, type) => {
    if (!file) return null;
    const path = `trades/${tradeId}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const snap = await uploadBytes(ref(storage, path), file);
    return await getDownloadURL(snap.ref);
  };

  // --- ADD TRADE (Mantido - já estava na arquitetura v4) ---
  const addTrade = useCallback(async (tradeData, htfFile, ltfFile) => {
    if (!user) throw new Error('Usuário não autenticado');
    setLoading(true); setError(null);
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
      
      // Cálculo inteligente com regra de Ticker
      if (tradeData.tickerRule && tradeData.tickerRule.tickSize && tradeData.tickerRule.tickValue) {
        const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
        const ticks = rawDiff / tradeData.tickerRule.tickSize;
        result = ticks * tradeData.tickerRule.tickValue * qty;
      } else {
        result = calculateTradeResult(side, entry, exit, qty);
      }
      
      const newTrade = {
        ...tradeData,
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
      
      if (htfFile) { const url = await uploadImage(htfFile, docRef.id, 'htf'); await updateDoc(docRef, { htfUrl: url }); }
      if (ltfFile) { const url = await uploadImage(ltfFile, docRef.id, 'ltf'); await updateDoc(docRef, { ltfUrl: url }); }

      // Cria Movimento Inicial (Backend atualizará o saldo)
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
          balanceAfter: balanceBefore + result, // Informativo
          description: `${tradeData.side} ${tradeData.ticker} (${tradeData.qty}x)`,
          date: tradeData.date,
          dateTime: `${tradeData.date}T${new Date().toISOString().split('T')[1]}`,
          tradeId: docRef.id,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
      }
      return { id: docRef.id, ...newTrade };
    } catch (err) { setError(err.message); throw err; } finally { setLoading(false); }
  }, [user]);

  // --- UPDATE TRADE (REESCRITA v5.2.0) ---
  const updateTrade = useCallback(async (tradeId, updates, htfFile, ltfFile) => {
    if (!user) throw new Error('Auth required');
    setLoading(true); setError(null);

    try {
      // 1. Fetch Seguro: Pegar dados atuais para não perder info
      const tradeRef = doc(db, 'trades', tradeId);
      const tradeSnap = await getDoc(tradeRef);
      if (!tradeSnap.exists()) throw new Error('Trade não encontrado');
      
      const currentTrade = tradeSnap.data();
      const updateData = { ...updates, updatedAt: serverTimestamp() };

      // 2. Upload de Imagens
      if (htfFile) updateData.htfUrl = await uploadImage(htfFile, tradeId, 'htf');
      if (ltfFile) updateData.ltfUrl = await uploadImage(ltfFile, tradeId, 'ltf');

      // 3. Recálculo Robusto de Resultado
      // Mescla updates com dados existentes para garantir fórmula completa
      const entry = parseFloat(updates.entry !== undefined ? updates.entry : currentTrade.entry);
      const exit = parseFloat(updates.exit !== undefined ? updates.exit : currentTrade.exit);
      const qty = parseFloat(updates.qty !== undefined ? updates.qty : currentTrade.qty);
      const side = updates.side || currentTrade.side;
      const tickerRule = updates.tickerRule || currentTrade.tickerRule; // Fundamental para WINFUT

      let newResult = currentTrade.result;

      // Se parâmetros financeiros mudaram, recalcula
      if (updates.entry !== undefined || updates.exit !== undefined || updates.qty !== undefined || updates.side !== undefined) {
        
        if (tickerRule && tickerRule.tickSize && tickerRule.tickValue) {
          // Lógica de Futuros
          const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
          const ticks = rawDiff / tickerRule.tickSize;
          newResult = ticks * tickerRule.tickValue * qty;
        } else {
          // Lógica Ações/Crypto
          newResult = calculateTradeResult(side, entry, exit, qty);
        }

        updateData.result = Math.round(newResult * 100) / 100;
        updateData.resultPercent = calculateResultPercent(side, entry, exit);
        
        // Persiste valores numéricos normalizados
        updateData.entry = entry;
        updateData.exit = exit;
        updateData.qty = qty;
      }

      // 4. Grava no Banco
      await updateDoc(tradeRef, updateData);

      // 5. Sincronização de Ledger (Movimentos)
      // Se houve mudança financeira, o extrato precisa refletir.
      if (currentTrade.accountId && Math.abs(newResult - currentTrade.result) > 0.01) {
        // A. Busca movimentos vinculados a este trade
        const qMov = query(collection(db, 'movements'), where('tradeId', '==', tradeId));
        const snapMov = await getDocs(qMov);
        
        // B. Deleta todos (O Backend 'onMovementDeleted' fará o estorno do saldo)
        if (!snapMov.empty) {
          const deletePromises = snapMov.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
        }

        // C. Cria novo movimento com valor corrigido (O Backend 'onMovementCreated' somará o novo saldo)
        if (newResult !== 0) {
          // Busca último snapshot para balanceBefore (apenas visual/histórico)
          const qMoves = query(collection(db, 'movements'), where('accountId', '==', currentTrade.accountId));
          const snapMoves = await getDocs(qMoves);
          const moves = snapMoves.docs.map(d => d.data()).sort((a,b) => (b.dateTime||'').localeCompare(a.dateTime||''));
          const balanceBefore = moves[0]?.balanceAfter || 0;

          await addDoc(collection(db, 'movements'), {
            accountId: currentTrade.accountId,
            type: 'TRADE_RESULT',
            amount: newResult,
            balanceBefore, 
            balanceAfter: balanceBefore + newResult, // Estimativa visual
            description: `${side} ${updateData.ticker || currentTrade.ticker} (${qty}x) [Edit]`,
            date: updateData.date || currentTrade.date,
            dateTime: new Date().toISOString(), // Joga para o fim da fila para consistência cronológica
            tradeId: tradeId,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
        }
      }

      return { id: tradeId, ...currentTrade, ...updateData };
    } catch (err) { 
      console.error(err);
      setError(err.message); 
      throw err; 
    } finally { 
      setLoading(false); 
    }
  }, [user]);

  // --- DELETE TRADE (Crosscheck de Integridade) ---
  const deleteTrade = useCallback(async (tradeId) => {
     if (!user) throw new Error('Auth required');
     setLoading(true);
     try {
         // Antes de apagar o trade, precisamos limpar o ledger
         const qMov = query(collection(db, 'movements'), where('tradeId', '==', tradeId));
         const snapMov = await getDocs(qMov);
         
         // Deletar movimentos dispara gatilho de estorno no backend
         const deletePromises = snapMov.docs.map(d => deleteDoc(d.ref));
         await Promise.all(deletePromises);

         // Agora é seguro apagar o trade
         await deleteDoc(doc(db, 'trades', tradeId));
         return true;
     } catch(err) { throw err; } finally { setLoading(false); }
  }, [user]);

  const addFeedback = useCallback(async (tradeId, feedback) => {
     if (!user || !isMentor()) throw new Error('Apenas mentores');
     await updateDoc(doc(db, 'trades', tradeId), { mentorFeedback: feedback, status: 'REVIEWED', updatedAt: serverTimestamp() });
  }, [user, isMentor]);

  const getTradesByStudent = useCallback((email) => allTrades.filter(t => t.studentEmail === email), [allTrades]);
  
  return { trades, allTrades, loading, error, addTrade, updateTrade, deleteTrade, addFeedback, getTradesByStudent };
};

export default useTrades;