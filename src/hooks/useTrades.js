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
  getDocs,
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

      // ======== CRIAR MOVIMENTO NO LEDGER ========
      if (tradeData.accountId && result !== 0) {
        try {
          // Buscar último movimento da conta para calcular saldo
          const movementsQuery = query(
            collection(db, 'movements'),
            where('accountId', '==', tradeData.accountId)
          );
          const movementsSnapshot = await getDocs(movementsQuery);
          
          let balanceBefore = 0;
          if (!movementsSnapshot.empty) {
            const allMovements = movementsSnapshot.docs.map(d => ({
              ...d.data(),
              id: d.id
            }));
            // Ordenar por dateTime descendente
            allMovements.sort((a, b) => {
              const dtA = a.dateTime || a.date || '';
              const dtB = b.dateTime || b.date || '';
              return dtB.localeCompare(dtA);
            });
            balanceBefore = allMovements[0].balanceAfter || 0;
          }

          const balanceAfter = balanceBefore + result;
          const tradeDescription = `${tradeData.side} ${tradeData.ticker} (${tradeData.qty}x)`;
          const tradeDate = tradeData.date || new Date().toISOString().split('T')[0];

          // Criar movimento TRADE_RESULT com dateTime
          await addDoc(collection(db, 'movements'), {
            accountId: tradeData.accountId,
            type: 'TRADE_RESULT',
            amount: result,
            balanceBefore,
            balanceAfter,
            description: tradeDescription,
            date: tradeDate,
            dateTime: `${tradeDate}T${new Date().toISOString().split('T')[1]}`, // Data do trade + hora atual
            tradeId: docRef.id,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

          // Atualizar saldo da conta
          await updateDoc(doc(db, 'accounts', tradeData.accountId), {
            currentBalance: balanceAfter,
            updatedAt: serverTimestamp()
          });

          console.log('[useTrades] Movimento TRADE_RESULT criado para conta:', tradeData.accountId);
        } catch (movementErr) {
          console.error('[useTrades] Erro ao criar movimento (não crítico):', movementErr);
          // Não falha o trade se o movimento falhar
        }
      }
      // ============================================

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
      let newResult = null;
      let oldResult = null;

      // Recalcular resultado se necessário
      if (updates.entry !== undefined || updates.exit !== undefined || updates.qty !== undefined || updates.side !== undefined) {
        newResult = calculateTradeResult(
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

        updateData.result = newResult;
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

      // ======== ATUALIZAR MOVIMENTO NO LEDGER (se resultado mudou) ========
      if (updates.accountId && newResult !== null) {
        try {
          // Buscar movimento existente deste trade
          const movementsQuery = query(
            collection(db, 'movements'),
            where('tradeId', '==', tradeId)
          );
          const movementsSnapshot = await getDocs(movementsQuery);

          if (!movementsSnapshot.empty) {
            // Atualizar movimento existente
            const existingMovement = movementsSnapshot.docs[0];
            const existingData = existingMovement.data();
            oldResult = existingData.amount;
            
            const resultDiff = newResult - oldResult;
            const newBalanceAfter = existingData.balanceAfter + resultDiff;

            const tradeDescription = `${updates.side} ${updates.ticker} (${updates.qty}x)`;
            const tradeDate = updates.date || existingData.date;

            await updateDoc(doc(db, 'movements', existingMovement.id), {
              amount: newResult,
              balanceAfter: newBalanceAfter,
              description: tradeDescription,
              date: tradeDate,
              dateTime: existingData.dateTime || `${tradeDate}T${new Date().toISOString().split('T')[1]}`,
              updatedAt: serverTimestamp()
            });

            // Atualizar saldo da conta
            // Buscar todos movimentos para recalcular saldo
            const allMovementsQuery = query(
              collection(db, 'movements'),
              where('accountId', '==', updates.accountId)
            );
            const allMovementsSnapshot = await getDocs(allMovementsQuery);
            
            let totalBalance = 0;
            allMovementsSnapshot.docs.forEach(d => {
              const data = d.data();
              // Para o movimento atualizado, usar o novo valor
              if (d.id === existingMovement.id) {
                totalBalance += newResult;
              } else {
                totalBalance += data.amount || 0;
              }
            });

            await updateDoc(doc(db, 'accounts', updates.accountId), {
              currentBalance: totalBalance,
              updatedAt: serverTimestamp()
            });

            console.log('[useTrades] Movimento TRADE_RESULT atualizado');
          } else {
            // Criar novo movimento se não existe (migração de trades antigos)
            const accountMovementsQuery = query(
              collection(db, 'movements'),
              where('accountId', '==', updates.accountId)
            );
            const accountMovementsSnapshot = await getDocs(accountMovementsQuery);
            
            let balanceBefore = 0;
            if (!accountMovementsSnapshot.empty) {
              const allMovements = accountMovementsSnapshot.docs.map(d => ({
                ...d.data(),
                id: d.id
              }));
              // Ordenar por dateTime descendente
              allMovements.sort((a, b) => {
                const dtA = a.dateTime || a.date || '';
                const dtB = b.dateTime || b.date || '';
                return dtB.localeCompare(dtA);
              });
              balanceBefore = allMovements[0].balanceAfter || 0;
            }

            const balanceAfter = balanceBefore + newResult;
            const tradeDescription = `${updates.side} ${updates.ticker} (${updates.qty}x)`;
            const tradeDate = updates.date || new Date().toISOString().split('T')[0];

            await addDoc(collection(db, 'movements'), {
              accountId: updates.accountId,
              type: 'TRADE_RESULT',
              amount: newResult,
              balanceBefore,
              balanceAfter,
              description: tradeDescription,
              date: tradeDate,
              dateTime: `${tradeDate}T${new Date().toISOString().split('T')[1]}`,
              tradeId: tradeId,
              createdAt: serverTimestamp(),
              createdBy: user.uid
            });

            await updateDoc(doc(db, 'accounts', updates.accountId), {
              currentBalance: balanceAfter,
              updatedAt: serverTimestamp()
            });

            console.log('[useTrades] Novo movimento TRADE_RESULT criado para trade existente');
          }
        } catch (movementErr) {
          console.error('[useTrades] Erro ao atualizar movimento (não crítico):', movementErr);
        }
      }
      // =====================================================================

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
      // Buscar trade para pegar accountId antes de deletar
      const trade = trades.find(t => t.id === tradeId) || allTrades.find(t => t.id === tradeId);
      const accountId = trade?.accountId;

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

      // ======== REMOVER MOVIMENTO DO LEDGER ========
      if (accountId) {
        try {
          // Buscar movimento deste trade
          const movementsQuery = query(
            collection(db, 'movements'),
            where('tradeId', '==', tradeId)
          );
          const movementsSnapshot = await getDocs(movementsQuery);

          if (!movementsSnapshot.empty) {
            const movementDoc = movementsSnapshot.docs[0];
            const movementData = movementDoc.data();
            const movementAmount = movementData.amount || 0;

            // Deletar o movimento
            await deleteDoc(doc(db, 'movements', movementDoc.id));

            // Recalcular saldo da conta (somar todos movimentos restantes)
            const remainingMovementsQuery = query(
              collection(db, 'movements'),
              where('accountId', '==', accountId)
            );
            const remainingSnapshot = await getDocs(remainingMovementsQuery);
            
            let newBalance = 0;
            remainingSnapshot.docs.forEach(d => {
              // Ignorar o movimento que acabamos de deletar (caso ainda apareça)
              if (d.id !== movementDoc.id) {
                newBalance += d.data().amount || 0;
              }
            });

            // Atualizar saldo da conta
            await updateDoc(doc(db, 'accounts', accountId), {
              currentBalance: newBalance,
              updatedAt: serverTimestamp()
            });

            console.log('[useTrades] Movimento TRADE_RESULT removido do ledger');
          }
        } catch (movementErr) {
          console.error('[useTrades] Erro ao remover movimento (não crítico):', movementErr);
        }
      }
      // =============================================

      // Deletar documento do trade
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
  }, [user, trades, allTrades]);

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
