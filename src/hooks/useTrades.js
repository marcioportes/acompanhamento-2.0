/**
 * useTrades
 * @see version.js para versão do produto
 * @description Hook responsável pelo gerenciamento de trades (CRUD) + Sistema de Feedback + Parciais
 * 
 * CHANGELOG (produto):
 * - 1.10.0: stopLoss field — persiste no addTrade e updateTrade
 * - 1.6.0: Sistema de parciais (1 Trade → N Parciais)
 *   - Parciais são campo _partials (array) no documento do trade — NÃO subcollection
 *   - getPartials(): Lê _partials do documento do trade
 *   - recalculateFromPartials(): Recalcula resultado a partir de _partials
 *   - addPartial/updatePartial/deletePartial: REMOVIDOS (22/03/2026) — eram código morto que operava em subcollection inexistente
 *   - Edição de parciais via updateTrade({ _partials: [...] })
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDocs, getDoc, serverTimestamp, arrayUnion, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { calculateTradeResult, calculateResultPercent } from '../utils/calculations';
import { calculateFromPartials, calculateAssumedRR } from '../utils/tradeCalculations';
import { createTrade } from '../utils/tradeGateway';

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

  // Flag para suspender processamento de snapshots durante batch operations
  // Usa useRef para não causar re-render e para ser visível dentro do callback do listener
  const suspendedRef = useRef(false);
  const pendingSnapshotRef = useRef(null);

  const setSuspendListener = useCallback((suspended) => {
    suspendedRef.current = suspended;
    // Quando reativa, processar snapshot pendente se houver
    if (!suspended && pendingSnapshotRef.current) {
      const { data, isAll } = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      if (isAll) {
        setAllTrades(data);
        setTrades(data);
      } else {
        setTrades(data);
      }
    }
  }, []);

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
            if (suspendedRef.current) {
              pendingSnapshotRef.current = { data, isAll: true };
              return;
            }
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
            if (suspendedRef.current) {
              pendingSnapshotRef.current = { data, isAll: true };
              return;
            }
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
            if (suspendedRef.current) {
              pendingSnapshotRef.current = { data, isAll: false };
              return;
            }
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
      // Delega lógica core para tradeGateway.createTrade (INV-02: gateway único)
      const result = await createTrade(tradeData, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });

      // Upload de imagens permanece no wrapper (closure do hook)
      if (htfFile) { const url = await uploadImage(htfFile, result.id, 'htf'); await updateDoc(doc(db, 'trades', result.id), { htfUrl: url }); }
      if (ltfFile) { const url = await uploadImage(ltfFile, result.id, 'ltf'); await updateDoc(doc(db, 'trades', result.id), { ltfUrl: url }); }

      return result;
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
      const { _partials, ...cleanUpdates } = updates;
      const updateData = { ...cleanUpdates, updatedAt: serverTimestamp() };

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

      // Propagar stopLoss se presente no update
      if (updates.stopLoss !== undefined) {
        updateData.stopLoss = updates.stopLoss != null ? parseFloat(updates.stopLoss) : null;
      }

      let newResult = currentTrade.result;

      // === PARCIAIS SÃO A FONTE DA VERDADE ===
      // Quando _partials existe, TODO o recálculo vem delas. Campos entry/exit/qty/result são derivados.
      if (_partials && _partials.length > 0) {
        // Recalcular a partir das parciais
        const parsedPartials = _partials.map(p => ({ ...p, price: parseFloat(p.price), qty: parseFloat(p.qty) }));
        const calc = calculateFromPartials({
          side,
          partials: parsedPartials,
          tickerRule: tickerRule || null
        });

        // Gravar parciais e campos derivados no documento
        updateData._partials = parsedPartials;
        updateData.hasPartials = true;
        updateData.partialsCount = _partials.length;
        updateData.avgEntry = calc.avgEntry;
        updateData.avgExit = calc.avgExit;
        updateData.entry = calc.avgEntry;
        updateData.exit = calc.avgExit;
        updateData.qty = calc.realizedQty;
        updateData.totalQty = calc.realizedQty;
        updateData.resultCalculated = calc.result;
        updateData.resultInPoints = calc.resultInPoints;
        updateData.entryTime = calc.entryTime || currentTrade.entryTime;
        updateData.exitTime = calc.exitTime || currentTrade.exitTime;
        updateData.date = calc.entryTime ? calc.entryTime.split('T')[0] : currentTrade.date;
        updateData.resultPercent = calc.avgEntry > 0 ? calculateResultPercent(side, calc.avgEntry, calc.avgExit) : 0;

        if (updates.resultOverride != null && !isNaN(parseFloat(updates.resultOverride))) {
          updateData.result = Math.round(parseFloat(updates.resultOverride) * 100) / 100;
          updateData.resultEdited = true;
          updateData.resultInPoints = null; // C5: pontos não representam o override
        } else {
          updateData.result = calc.result;
          updateData.resultEdited = false;
        }

        newResult = updateData.result;
        console.log(`[useTrades] updateTrade via parciais: ${_partials.length} legs, result=${calc.result}`);

      } else {
        // Caminho legado: sem parciais, recálculo direto dos campos
        if (updates.entry !== undefined || updates.exit !== undefined || updates.qty !== undefined || updates.side !== undefined) {
          const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
          if (tickerRule?.tickSize && tickerRule?.tickValue) {
            newResult = (rawDiff / tickerRule.tickSize) * tickerRule.tickValue * qty;
          } else {
            newResult = calculateTradeResult(side, entry, exit, qty);
          }
          updateData.resultCalculated = Math.round(newResult * 100) / 100;
          updateData.resultPercent = calculateResultPercent(side, entry, exit);
          updateData.resultInPoints = Math.round(rawDiff * 100) / 100;
          updateData.entry = entry; updateData.exit = exit; updateData.qty = qty;
        }

        // Aplicar override se presente
        if (updates.resultOverride != null && !isNaN(parseFloat(updates.resultOverride))) {
          const overrideVal = Math.round(parseFloat(updates.resultOverride) * 100) / 100;
          updateData.result = overrideVal;
          updateData.resultEdited = true;
          updateData.resultInPoints = null; // C5: pontos não representam o override
          newResult = overrideVal;
        } else {
          updateData.result = Math.round(newResult * 100) / 100;
          updateData.resultEdited = false;
        }
      }

      // Firestore rejeita undefined — stripar antes do write
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

      // Write único do trade pai
      await updateDoc(tradeRef, updateData);

      // C-RR3 (DEC-007): Recalcular RR
      const resultChanged = Math.abs((updateData.result ?? currentTrade.result) - (currentTrade.result || 0)) > 0.01;
      const stopChanged = updates.stopLoss !== undefined;
      const priceChanged = updates.entry !== undefined || updates.exit !== undefined || updates.qty !== undefined || _partials?.length > 0;
      
      if (resultChanged || stopChanged || priceChanged) {
        const effectiveStop = updateData.stopLoss !== undefined ? updateData.stopLoss : currentTrade.stopLoss;
        const effectiveEntry = parseFloat(updateData.entry ?? currentTrade.entry);
        const effectiveResult = updateData.result ?? currentTrade.result;
        const effectiveQty = parseFloat(updateData.qty ?? currentTrade.qty);
        
        let newRrRatio = null;
        let newRrAssumed = false;
        
        if (effectiveStop != null && effectiveStop !== 0 && effectiveEntry) {
          const risk = Math.abs(effectiveEntry - effectiveStop);
          if (risk > 0) {
            const pointValue = (updates.tickerRule || currentTrade.tickerRule)?.pointValue || 1;
            newRrRatio = Math.round((effectiveResult / (risk * pointValue * effectiveQty)) * 100) / 100;
          }
        } else {
          try {
            const planId = currentTrade.planId;
            if (planId) {
              const planSnap = await getDoc(doc(db, 'plans', planId));
              if (planSnap.exists()) {
                const planData = planSnap.data();
                const assumed = calculateAssumedRR({
                  result: effectiveResult,
                  planPl: Number(planData.pl) || 0,
                  planRiskPerOperation: Number(planData.riskPerOperation) || 0,
                  planRrTarget: Number(planData.rrTarget) || 0,
                });
                if (assumed) {
                  newRrRatio = assumed.rrRatio;
                  newRrAssumed = true;
                }
              }
            }
          } catch (rrErr) {
            console.warn('[useTrades] updateTrade: erro recalculando RR assumido:', rrErr);
          }
        }
        
        await updateDoc(tradeRef, { rrRatio: newRrRatio, rrAssumed: newRrAssumed });
      }

      // Sanitizar newResult para uso no movement
      const effectiveUpdateResult = Math.round(newResult * 100) / 100;

      if (currentTrade.accountId && Math.abs(effectiveUpdateResult - (currentTrade.result || 0)) > 0.01) {
        const qMov = query(collection(db, 'movements'), where('tradeId', '==', tradeId));
        const snapMov = await getDocs(qMov);
        if (!snapMov.empty) await Promise.all(snapMov.docs.map(d => deleteDoc(d.ref)));

        if (effectiveUpdateResult !== 0) {
          const qMoves = query(collection(db, 'movements'), where('accountId', '==', currentTrade.accountId));
          const snapMoves = await getDocs(qMoves);
          const moves = snapMoves.docs.map(d => d.data()).sort((a,b) => (b.dateTime||'').localeCompare(a.dateTime||''));
          const balanceBefore = moves[0]?.balanceAfter || 0;

          await addDoc(collection(db, 'movements'), {
            accountId: currentTrade.accountId, type: 'TRADE_RESULT', amount: effectiveUpdateResult,
            balanceBefore, balanceAfter: balanceBefore + effectiveUpdateResult,
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
  const addFeedbackComment = useCallback(async (tradeId, content, isQuestion = false, imageUrl = null) => {
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

    // Inclui imageUrl no comment se presente
    if (imageUrl) {
      comment.imageUrl = imageUrl;
    }
    
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
    console.log(`[useTrades] Feedback: ${trade.status} → ${newStatus}${imageUrl ? ' (com imagem)' : ''}`);
    
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

  /**
   * Aplica feedback em massa para múltiplos trades via Firestore batch write.
   * Todos os trades recebem o mesmo comentário e transitam OPEN → REVIEWED.
   * 
   * @param {string[]} tradeIds - IDs dos trades (todos devem ser OPEN e do mesmo aluno)
   * @param {string} content - Texto do feedback
   * @returns {Promise<{success: boolean, count: number}>}
   */
  const addBulkFeedback = useCallback(async (tradeIds, content) => {
    if (!user || !isMentor()) throw new Error('Apenas mentores');
    if (!tradeIds?.length || !content?.trim()) throw new Error('IDs e conteúdo obrigatórios');

    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const tradeId of tradeIds) {
      const tradeRef = doc(db, 'trades', tradeId);
      const comment = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        author: user.email,
        authorName: user.displayName || user.email.split('@')[0],
        authorRole: 'mentor',
        content: content.trim(),
        isQuestion: false,
        isBulk: true,
        bulkCount: tradeIds.length,
        createdAt: now,
      };

      batch.update(tradeRef, {
        feedbackHistory: arrayUnion(comment),
        mentorFeedback: content.trim(),
        feedbackDate: now,
        status: STATUS.REVIEWED,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`[useTrades] Bulk feedback: ${tradeIds.length} trades → REVIEWED`);
    return { success: true, count: tradeIds.length };
  }, [user, isMentor]);

  /**
   * Faz upload de imagem de feedback para Firebase Storage
   * @param {File} file - Arquivo de imagem
   * @param {string} tradeId - ID do trade para organizar no Storage
   * @returns {Promise<string>} URL da imagem
   */
  const uploadFeedbackImage = useCallback(async (file, tradeId) => {
    if (!user) throw new Error('Auth required');
    if (!file) throw new Error('Arquivo obrigatório');

    const ext = file.name?.split('.').pop() || 'png';
    const path = `feedback/${tradeId}/${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    console.log(`[useTrades] Feedback image uploaded: ${path}`);
    return url;
  }, [user]);

  // ============================================
  // SISTEMA DE PARCIAIS v1.6.0
  // ============================================

  /**
   * Busca parciais de um trade (campo _partials no documento)
   * @param {string} tradeId
   * @returns {Promise<Array>} Lista de parciais ordenadas por seq
   */
  const getPartials = useCallback(async (tradeId) => {
    const tradeRef = doc(db, 'trades', tradeId);
    const tradeSnap = await getDoc(tradeRef);
    if (!tradeSnap.exists()) return [];
    const data = tradeSnap.data();
    const partials = data._partials || [];
    return [...partials].sort((a, b) => (a.seq || 0) - (b.seq || 0));
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

    const partials = trade._partials || [];
    
    if (partials.length === 0) {
      return { id: tradeId, ...trade };
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
      resultCalculated: calc.result,
      result: calc.result,         // recalculate reseta o override
      resultInPoints: calc.resultInPoints,
      resultEdited: false,
      // Derivar tempos das parciais
      entryTime: calc.entryTime || trade.entryTime,
      exitTime: calc.exitTime || trade.exitTime,
      date: calc.entryTime ? calc.entryTime.split('T')[0] : trade.date,
      resultPercent: calc.avgEntry > 0 
        ? calculateResultPercent(trade.side, calc.avgEntry, calc.avgExit) 
        : 0,
      updatedAt: serverTimestamp()
    };

    await updateDoc(tradeRef, updateData);
    console.log(`[useTrades] Trade ${tradeId} recalculado: result=${calc.result}, partials=${partials.length}`);

    return { id: tradeId, ...trade, ...updateData };
  }, []);

  // addPartial, updatePartial, deletePartial REMOVIDOS (22/03/2026)
  // Parciais são campo _partials no documento do trade.
  // Edição de parciais acontece via updateTrade com _partials no payload.
  // Subcollection trades/{id}/partials foi um erro (sessão 11-12/03/2026) — nunca deveria ter existido.

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
    addTrade, updateTrade, deleteTrade, setSuspendListener,
    addFeedback, addFeedbackComment, updateTradeStatus, addBulkFeedback, uploadFeedbackImage,
    // Parciais (campo _partials no documento — NÃO subcollection)
    getPartials, recalculateFromPartials,
    // Helpers
    getTradesByStudent, getTradesAwaitingFeedback, getTradesGroupedByStudent,
    getUniqueStudents, getStudentFeedbackCounts, getTradesByStudentAndStatus
  };
};

export default useTrades;
