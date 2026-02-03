import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
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

  // --- 1. CARREGAMENTO DE DADOS ---
  useEffect(() => {
    if (!user) {
      setTrades([]);
      setAllTrades([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsubscribeStudent = () => {};
    let unsubscribeAll = () => {};

    // Listener do Aluno (Seus próprios trades)
    const studentQuery = query(
      collection(db, 'trades'),
      where('StudentId', '==', user.uid),
      orderBy('date', 'desc')
    );
    
    unsubscribeStudent = onSnapshot(studentQuery, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTrades(data);
        setLoading(false);
      }, (err) => {
        console.error("Erro query aluno:", err);
        // Fallback se der erro de índice
        const fbQ = query(collection(db, 'trades'), where('studentId', '==', user.uid));
        onSnapshot(fbQ, (snap) => {
           const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
           // Ordenação manual no cliente
           data.sort((a,b) => (b.date||'').localeCompare(a.date||''));
           setTrades(data);
           setLoading(false);
        });
      }
    );

    // Listener do Mentor (Ver tudo)
    if (isMentor()) {
       const allQuery = query(collection(db, 'trades'), orderBy('date', 'desc'));
       unsubscribeAll = onSnapshot(allQuery, (snap) => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAllTrades(data);
       }, (err) => {
          console.error("Erro query mentor:", err);
          const fbQ = query(collection(db, 'trades'));
          onSnapshot(fbQ, (snap) => {
             const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             data.sort((a,b) => (b.date||'').localeCompare(a.date||''));
             setAllTrades(data);
          });
       });
    }

    return () => { unsubscribeStudent(); unsubscribeAll(); };
  }, [user, isMentor]);

  // --- HELPER: UPLOAD IMAGEM ---
  const uploadImage = async (file, tradeId, type) => {
    if (!file) return null;
    const path = `trades/${tradeId}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const snap = await uploadBytes(ref(storage, path), file);
    return await getDownloadURL(snap.ref);
  };

  // --- 2. ADICIONAR TRADE (COM MOVIMENTO FINANCEIRO) ---
  const addTrade = useCallback(async (tradeData, htfFile, ltfFile) => {
    if (!user) throw new Error('Usuário não autenticado');
    setLoading(true);
    try {
      // 'result' já vem calculado do Modal (usando regra de Ticks ou Simples)
      const result = parseFloat(tradeData.result); 
      
      const newTrade = {
        ...tradeData,
        entry: parseFloat(tradeData.entry),
        exit: parseFloat(tradeData.exit),
        qty: parseFloat(tradeData.qty),
        result, 
        resultPercent: calculateResultPercent(tradeData.side, tradeData.entry, tradeData.exit),
        
        studentEmail: user.email,
        studentName: user.displayName || user.email.split('@')[0],
        studentId: user.uid,
        status: TRADE_STATUS?.PENDING_REVIEW || 'PENDING_REVIEW',
        redFlags: [],
        hasRedFlags: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        htfUrl: null, ltfUrl: null, mentorFeedback: null
      };

      // Salva Trade
      const docRef = await addDoc(collection(db, 'trades'), newTrade);
      
      // Upload Imagens
      let htfUrl = null, ltfUrl = null;
      if (htfFile) htfUrl = await uploadImage(htfFile, docRef.id, 'htf');
      if (ltfFile) ltfUrl = await uploadImage(ltfFile, docRef.id, 'ltf');
      if (htfUrl || ltfUrl) await updateDoc(doc(db, 'trades', docRef.id), { htfUrl, ltfUrl });

      // GERA O MOVIMENTO FINANCEIRO (Atualiza Saldo Automaticamente)
      if (newTrade.accountId) {
        await addDoc(collection(db, 'movements'), {
          type: 'TRADE_RESULT',
          amount: result,
          accountId: newTrade.accountId,
          tradeId: docRef.id,
          date: newTrade.date,
          description: `Trade ${newTrade.ticker} (${newTrade.side})`,
          studentId: user.uid,
          studentEmail: user.email,
          studentName: user.displayName || user.email.split('@')[0],
          createdAt: serverTimestamp()
        });
      }

      return { id: docRef.id, ...newTrade, htfUrl, ltfUrl };
    } catch (err) {
      console.error('Erro ao adicionar trade:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // --- 3. ATUALIZAR TRADE ---
  const updateTrade = useCallback(async (id, updates, htf, ltf) => {
      if(!user) throw new Error('No user');
      setLoading(true);
      try {
        const data = {...updates};
        // Recalcula percentual se houver mudança de preços
        if(updates.entry || updates.exit) {
            data.resultPercent = calculateResultPercent(
                updates.side || data.side, 
                updates.entry || data.entry, 
                updates.exit || data.exit
            );
        }
        
        if(htf) data.htfUrl = await uploadImage(htf, id, 'htf');
        if(ltf) data.ltfUrl = await uploadImage(ltf, id, 'ltf');
        data.updatedAt = serverTimestamp();
        
        await updateDoc(doc(db, 'trades', id), data);
        return {id, ...data};
      } catch (err) {
        console.error(err);
        throw err;
      } finally {
        setLoading(false);
      }
  }, [user]);

  // --- 4. DELETAR TRADE ---
  const deleteTrade = useCallback(async (id, htf, ltf) => {
      setLoading(true);
      try {
        if(htf) try { await deleteObject(ref(storage, htf)) } catch(e){}
        if(ltf) try { await deleteObject(ref(storage, ltf)) } catch(e){}
        await deleteDoc(doc(db, 'trades', id));
        // Nota: O movimento financeiro permanece para histórico ou deve ser removido manualmente se desejado
        return true;
      } catch (err) {
        console.error(err);
        throw err;
      } finally {
        setLoading(false);
      }
  }, [user]);

  // --- 5. FUNÇÕES DE MENTORIA ---
  
  const addFeedback = useCallback(async (id, fb) => {
      if(!isMentor()) throw new Error('Apenas mentores');
      await updateDoc(doc(db, 'trades', id), {
          mentorFeedback: fb, 
          feedbackDate: serverTimestamp(), 
          feedbackBy: user.email, 
          status: 'REVIEWED'
      });
  }, [user, isMentor]);

  // --- 6. GETTERS E FILTROS (Recuperados!) ---

  const getTradesByStudent = useCallback((email) => {
    return allTrades.filter(t => t.studentId === uid);
  }, [allTrades]);

  // Esta era a função que estava faltando e causou o erro:
  const getUniqueStudents = useCallback(() => {
    const studentsMap = new Map();
    allTrades.forEach(trade => {
      if (trade.studentEmail && !studentsMap.has(trade.studentEmail)) {
        studentsMap.set(trade.studentEmail, {
          email: trade.studentEmail,
          name: trade.studentName || trade.studentEmail.split('@')[0],
          id: trade.studentId
        });
      }
    });
    return Array.from(studentsMap.values());
  }, [allTrades]);

  const getTradesGroupedByStudent = useCallback(() => {
    const grouped = {};
    allTrades.forEach(trade => {
      const email = trade.studentEmail;
      if (!grouped[email]) grouped[email] = [];
      grouped[email].push(trade);
    });
    return grouped;
  }, [allTrades]);

  const getTradesAwaitingFeedback = useCallback(() => {
    return allTrades.filter(t => !t.mentorFeedback && t.status !== 'REVIEWED');
  }, [allTrades]);

  const getTradesWithRedFlags = useCallback(() => {
    return allTrades.filter(t => t.hasRedFlags);
  }, [allTrades]);

  const getTradesByStatus = useCallback((status) => {
    return allTrades.filter(t => t.status === status);
  }, [allTrades]);

  const getReviewedTrades = useCallback(() => {
    return allTrades.filter(t => t.mentorFeedback || t.status === 'REVIEWED');
  }, [allTrades]);

  return {
    trades, 
    allTrades, 
    loading, 
    error,
    // Actions
    addTrade, 
    updateTrade, 
    deleteTrade, 
    addFeedback,
    // Getters (Agora completos)
    getTradesByStudent,
    getUniqueStudents,         // <--- O erro sumirá agora
    getTradesGroupedByStudent,
    getTradesAwaitingFeedback,
    getTradesWithRedFlags,
    getTradesByStatus,
    getReviewedTrades
  };
};

export default useTrades;