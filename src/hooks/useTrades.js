import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, TRADE_STATUS } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { calculateTradeResult, calculateResultPercent } from '../utils/calculations';

export const useTrades = () => {
  const { user, isMentor } = useAuth();
  const [trades, setTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Buscar trades do usuário logado ou todos (mentor)
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

    // FIX #8: Query simplificada para aluno - usar studentEmail (mais confiável)
    // porque nem todos os trades antigos têm studentId
    const studentQuery = query(
      collection(db, 'trades'),
      where('studentEmail', '==', user.email),
      orderBy('date', 'desc')
    );

    unsubscribeStudent = onSnapshot(
      studentQuery,
      (snapshot) => {
        const tradesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log(`[useTrades] Carregados ${tradesData.length} trades para ${user.email}`);
        setTrades(tradesData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching student trades:', err);
        // Se falhar (índice não existe), tentar sem orderBy
        const fallbackQuery = query(
          collection(db, 'trades'),
          where('studentEmail', '==', user.email)
        );
        
        onSnapshot(fallbackQuery, (snapshot) => {
          const tradesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          // Ordenar no cliente
          tradesData.sort((a, b) => {
            const dateA = a.date || '';
            const dateB = b.date || '';
            return dateB.localeCompare(dateA);
          });
          console.log(`[useTrades] Fallback: Carregados ${tradesData.length} trades`);
          setTrades(tradesData);
          setLoading(false);
        }, (fallbackErr) => {
          console.error('Fallback query also failed:', fallbackErr);
          setError('Erro ao carregar trades. Verifique sua conexão.');
          setLoading(false);
        });
      }
    );

    // Se for mentor, buscar todos os trades
    if (isMentor()) {
      const allQuery = query(
        collection(db, 'trades'),
        orderBy('date', 'desc')
      );

      unsubscribeAll = onSnapshot(
        allQuery,
        (snapshot) => {
          const allTradesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log(`[useTrades] Mentor: Carregados ${allTradesData.length} trades totais`);
          setAllTrades(allTradesData);
        },
        (err) => {
          console.error('Error fetching all trades:', err);
          // Fallback sem orderBy
          const fallbackAllQuery = query(collection(db, 'trades'));
          onSnapshot(fallbackAllQuery, (snapshot) => {
            const allTradesData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            allTradesData.sort((a, b) => {
              const dateA = a.date || '';
              const dateB = b.date || '';
              return dateB.localeCompare(dateA);
            });
            setAllTrades(allTradesData);
          });
        }
      );
    }

    return () => {
      unsubscribeStudent();
      unsubscribeAll();
    };
  }, [user, isMentor]);

  // Upload de imagem para o Firebase Storage
  const uploadImage = async (file, tradeId, type) => {
    if (!file) return null;

    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const path = `trades/${tradeId}/${type}_${timestamp}.${extension}`;
    const storageRef = ref(storage, path);

    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      throw new Error('Erro ao fazer upload da imagem');
    }
  };

  // Adicionar novo trade
  const addTrade = useCallback(async (tradeData, htfFile, ltfFile) => {
    if (!user) throw new Error('Usuário não autenticado');

    setLoading(true);
    setError(null);

    try {
      // Calcular resultado
      const result = calculateTradeResult(
        tradeData.side,
        tradeData.entry,
        tradeData.exit,
        tradeData.qty
      );
      
      const resultPercent = calculateResultPercent(
        tradeData.side,
        tradeData.entry,
        tradeData.exit
      );

      // Criar documento com nova estrutura
      const newTrade = {
        // Dados do trade
        ...tradeData,
        entry: parseFloat(tradeData.entry),
        exit: parseFloat(tradeData.exit),
        qty: parseFloat(tradeData.qty),
        result,
        resultPercent,
        
        // Dados do aluno
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        studentId: user.uid,
        
        // Novos campos da v2
        status: TRADE_STATUS?.PENDING_REVIEW || 'PENDING_REVIEW',
        accountId: tradeData.accountId || null,
        planId: tradeData.planId || null,
        setupId: tradeData.setupId || null,
        
        // Stop e alvo (para cálculo de R:R)
        stopLoss: tradeData.stopLoss ? parseFloat(tradeData.stopLoss) : null,
        takeProfit: tradeData.takeProfit ? parseFloat(tradeData.takeProfit) : null,
        
        // Red flags serão preenchidas pela Cloud Function
        redFlags: [],
        hasRedFlags: false,
        
        // Timestamps
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        // Imagens
        htfUrl: null,
        ltfUrl: null,
        
        // Feedback (será preenchido pelo mentor)
        mentorFeedback: null,
        feedbackDate: null,
        feedbackBy: null,
      };

      const docRef = await addDoc(collection(db, 'trades'), newTrade);
      console.log('[useTrades] Trade criado:', docRef.id);

      // Upload das imagens
      let htfUrl = null;
      let ltfUrl = null;

      if (htfFile) {
        htfUrl = await uploadImage(htfFile, docRef.id, 'htf');
      }
      
      if (ltfFile) {
        ltfUrl = await uploadImage(ltfFile, docRef.id, 'ltf');
      }

      // Atualizar documento com URLs das imagens
      if (htfUrl || ltfUrl) {
        await updateDoc(doc(db, 'trades', docRef.id), {
          htfUrl,
          ltfUrl,
        });
      }

      return { id: docRef.id, ...newTrade, htfUrl, ltfUrl };
    } catch (err) {
      console.error('Error adding trade:', err);
      setError('Erro ao adicionar trade');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Atualizar trade existente
  const updateTrade = useCallback(async (tradeId, updates, htfFile, ltfFile) => {
    if (!user) throw new Error('Usuário não autenticado');

    setLoading(true);
    setError(null);

    try {
      const updateData = { ...updates };

      // Recalcular resultado se necessário
      if (updates.entry !== undefined || updates.exit !== undefined || updates.qty !== undefined || updates.side !== undefined) {
        const result = calculateTradeResult(
          updates.side,
          updates.entry,
          updates.exit,
          updates.qty
        );
        
        const resultPercent = calculateResultPercent(
          updates.side,
          updates.entry,
          updates.exit
        );

        updateData.result = result;
        updateData.resultPercent = resultPercent;
        updateData.entry = parseFloat(updates.entry);
        updateData.exit = parseFloat(updates.exit);
        updateData.qty = parseFloat(updates.qty);
      }

      // Upload novas imagens se fornecidas
      if (htfFile) {
        const htfUrl = await uploadImage(htfFile, tradeId, 'htf');
        updateData.htfUrl = htfUrl;
      }

      if (ltfFile) {
        const ltfUrl = await uploadImage(ltfFile, tradeId, 'ltf');
        updateData.ltfUrl = ltfUrl;
      }

      updateData.updatedAt = serverTimestamp();

      await updateDoc(doc(db, 'trades', tradeId), updateData);
      console.log('[useTrades] Trade atualizado:', tradeId);

      return { id: tradeId, ...updateData };
    } catch (err) {
      console.error('Error updating trade:', err);
      setError('Erro ao atualizar trade');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Deletar trade
  const deleteTrade = useCallback(async (tradeId, htfUrl, ltfUrl) => {
    if (!user) throw new Error('Usuário não autenticado');

    setLoading(true);
    setError(null);

    try {
      // Deletar imagens do Storage
      if (htfUrl) {
        try {
          const htfRef = ref(storage, htfUrl);
          await deleteObject(htfRef);
        } catch (e) {
          console.warn('Could not delete HTF image:', e);
        }
      }

      if (ltfUrl) {
        try {
          const ltfRef = ref(storage, ltfUrl);
          await deleteObject(ltfRef);
        } catch (e) {
          console.warn('Could not delete LTF image:', e);
        }
      }

      // Deletar documento
      await deleteDoc(doc(db, 'trades', tradeId));
      console.log('[useTrades] Trade deletado:', tradeId);

      return true;
    } catch (err) {
      console.error('Error deleting trade:', err);
      setError('Erro ao deletar trade');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // FIX #10 e #13: Adicionar feedback (mentor) - garantir atualização do status
  const addFeedback = useCallback(async (tradeId, feedback) => {
    if (!user) throw new Error('Usuário não autenticado');
    if (!isMentor()) throw new Error('Apenas mentores podem adicionar feedback');
    if (!tradeId) throw new Error('ID do trade não fornecido');
    if (!feedback || !feedback.trim()) throw new Error('Feedback não pode estar vazio');

    console.log('[useTrades] Adicionando feedback ao trade:', tradeId);

    try {
      const updateData = {
        mentorFeedback: feedback.trim(),
        feedbackDate: serverTimestamp(),
        feedbackBy: user.email,
        status: TRADE_STATUS?.REVIEWED || 'REVIEWED',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'trades', tradeId), updateData);
      console.log('[useTrades] Feedback adicionado com sucesso');

      return true;
    } catch (err) {
      console.error('Error adding feedback:', err);
      throw new Error('Erro ao adicionar feedback: ' + err.message);
    }
  }, [user, isMentor]);

  // Buscar trades por aluno (mentor)
  const getTradesByStudent = useCallback((studentEmail) => {
    return allTrades.filter(trade => trade.studentEmail === studentEmail);
  }, [allTrades]);

  // Agrupar trades por aluno
  const getTradesGroupedByStudent = useCallback(() => {
    const grouped = {};
    allTrades.forEach(trade => {
      const email = trade.studentEmail;
      if (!grouped[email]) {
        grouped[email] = [];
      }
      grouped[email].push(trade);
    });
    return grouped;
  }, [allTrades]);

  // Obter lista única de alunos
  const getUniqueStudents = useCallback(() => {
    const students = new Map();
    allTrades.forEach(trade => {
      if (!students.has(trade.studentEmail)) {
        students.set(trade.studentEmail, {
          email: trade.studentEmail,
          name: trade.studentName || trade.studentEmail.split('@')[0],
          studentId: trade.studentId,
        });
      }
    });
    return Array.from(students.values());
  }, [allTrades]);

  // FIX #13: Trades aguardando feedback - melhorar lógica
  const getTradesAwaitingFeedback = useCallback(() => {
    return allTrades.filter(trade => {
      // Se tem status definido, usar status
      if (trade.status) {
        return trade.status === (TRADE_STATUS?.PENDING_REVIEW || 'PENDING_REVIEW');
      }
      // Compatibilidade: trades antigos sem status
      return !trade.mentorFeedback;
    });
  }, [allTrades]);

  // Trades com red flags
  const getTradesWithRedFlags = useCallback(() => {
    return allTrades.filter(trade => trade.hasRedFlags || (trade.redFlags && trade.redFlags.length > 0));
  }, [allTrades]);

  // Trades por status
  const getTradesByStatus = useCallback((status) => {
    return allTrades.filter(trade => trade.status === status);
  }, [allTrades]);

  // Trades revisados
  const getReviewedTrades = useCallback(() => {
    return allTrades.filter(trade => {
      if (trade.status) {
        return trade.status === (TRADE_STATUS?.REVIEWED || 'REVIEWED');
      }
      return !!trade.mentorFeedback;
    });
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
    getTradesGroupedByStudent,
    getUniqueStudents,
    getTradesAwaitingFeedback,
    getTradesWithRedFlags,
    getTradesByStatus,
    getReviewedTrades,
  };
};

export default useTrades;
