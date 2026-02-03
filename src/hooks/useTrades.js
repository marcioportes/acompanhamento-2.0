import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, TRADE_STATUS } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { calculateResultPercent } from '../utils/calculations';

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
    // CORREÇÃO AQUI: Mudado de 'StudentId' para 'studentId'
    const studentQuery = query(
      collection(db, 'trades'),
      where('studentId', '==', user.uid), 
      orderBy('date', 'desc')
    );
    
    unsubscribeStudent = onSnapshot(studentQuery, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTrades(data);
        setLoading(false);
      }, (err) => {
        console.error("Erro query aluno (tentando fallback):", err);
        // Fallback: Se der erro de índice no 'orderBy', tenta buscar sem ordenação
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
    // Adicionei verificação de segurança no nome do arquivo
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const path = `trades/${tradeId}/${type}_${Date.now()}_${safeName}`;
    const snap = await uploadBytes(ref(storage, path), file);
    return await getDownloadURL(snap.ref);
  };

  // --- 2. ADICIONAR TRADE ---
  const addTrade = useCallback(async (tradeData, htfFile, ltfFile) => {
    if (!user) throw new Error('Usuário não autenticado');
    // Não setamos loading=true aqui para não piscar a tela inteira, 
    // deixamos o componente lidar com o loading do botão (isSubmitting)
    
    try {
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
        studentId: user.uid, // Mantido minúsculo (correto)
        status: TRADE_STATUS?.PENDING_REVIEW || 'PENDING_REVIEW',
        redFlags: [],
        hasRedFlags: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        htfUrl: null, ltfUrl: null, mentorFeedback: null
      };

      // Salva Trade
      const docRef = await addDoc(collection(db, 'trades'), newTrade);
      
      // Upload Imagens em paralelo para ser mais rápido
      const uploads = [];
      if (htfFile) uploads.push(uploadImage(htfFile, docRef.id, 'htf'));
      else uploads.push(Promise.resolve(null));
      
      if (ltfFile) uploads.push(uploadImage(ltfFile, docRef.id, 'ltf'));
      else uploads.push(Promise.resolve(null));

      const [htfUrl, ltfUrl] = await Promise.all(uploads);

      if (htfUrl || ltfUrl) {
        await updateDoc(doc(db, 'trades', docRef.id), { htfUrl, ltfUrl });
      }

      // GERA O MOVIMENTO FINANCEIRO
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

      // O onSnapshot cuidará de atualizar a lista automaticamente agora que o ID bate!
      return { id: docRef.id, ...newTrade, htfUrl, ltfUrl };
    } catch (err) {
      console.error('Erro ao adicionar trade:', err);
      throw err;
    }
  }, [user]);

  // --- 3. ATUALIZAR TRADE ---
  const updateTrade = useCallback(async (id, updates, htf, ltf) => {
      if(!user) throw new Error('No user');
      try {
        const data = {...updates};
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
      }
  }, [user]);

  // --- 4. DELETAR TRADE ---
  const deleteTrade = useCallback(async (id, htf, ltf) => {
      try {
        if(htf) try { await deleteObject(ref(storage, htf)) } catch(e){}
        if(ltf) try { await deleteObject(ref(storage, ltf)) } catch(e){}
        await deleteDoc(doc(db, 'trades', id));
        return true;
      } catch (err) {
        console.error(err);
        throw err;
      }
  }, []); // Removido dependencia desnecessária

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

  // --- 6. GETTERS E FILTROS ---

  const getTradesByStudent = useCallback((studentId) => {
    // CORRIGIDO: usava 'uid' que não existia, agora usa o argumento
    return allTrades.filter(t => t.studentId === studentId);
  }, [allTrades]);

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
    addTrade, 
    updateTrade, 
    deleteTrade, 
    addFeedback,
    getTradesByStudent,
    getUniqueStudents,
    getTradesGroupedByStudent,
    getTradesAwaitingFeedback,
    getTradesWithRedFlags,
    getTradesByStatus,
    getReviewedTrades
  };
};

export default useTrades;