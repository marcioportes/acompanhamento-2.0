/**
 * useOrders.js
 * @version 1.0.0 (v1.20.0)
 * @description Hook para leitura de ordens da collection `orders`.
 *   Ordens são IMUTÁVEIS após ingestão — este hook é read-only.
 *
 * EXPORTS (via hook):
 *   orders, loading, error
 *   getOrdersByPlan(planId) — filtra do cache
 *   getOrdersByBatch(batchId) — filtra do cache
 *
 * @firestore orders — index composto: studentId + planId + submittedAt
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const COLLECTION = 'orders';

/**
 * @param {string|null} overrideStudentId - UID do aluno (para mentor view-as-student)
 */
const useOrders = (overrideStudentId = null) => {
  const { user, isMentor } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const targetId = overrideStudentId ?? user.uid;
    let q;

    if (isMentor() && !overrideStudentId) {
      q = query(collection(db, COLLECTION), orderBy('importedAt', 'desc'));
    } else {
      q = query(
        collection(db, COLLECTION),
        where('studentId', '==', targetId),
        orderBy('importedAt', 'desc')
      );
    }

    let fallbackUnsub = null;

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useOrders] Listener error:', err);
        const fallbackQ = overrideStudentId || !isMentor()
          ? query(collection(db, COLLECTION), where('studentId', '==', targetId))
          : query(collection(db, COLLECTION));

        fallbackUnsub = onSnapshot(
          fallbackQ,
          (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (b.importedAt?.seconds ?? 0) - (a.importedAt?.seconds ?? 0));
            setOrders(data);
            setLoading(false);
          },
          (fallbackErr) => {
            console.error('[useOrders] Fallback error:', fallbackErr);
            setOrders([]);
            setLoading(false);
            setError(fallbackErr.message);
          }
        );
      }
    );

    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [user, isMentor, overrideStudentId]);

  const getOrdersByPlan = useCallback((planId) => {
    return orders.filter(o => o.planId === planId);
  }, [orders]);

  const getOrdersByBatch = useCallback((batchId) => {
    return orders.filter(o => o.batchId === batchId);
  }, [orders]);

  /** Estatísticas rápidas */
  const stats = useMemo(() => {
    const filled = orders.filter(o => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED');
    const stops = orders.filter(o => o.isStopOrder);
    const correlated = orders.filter(o => o.correlatedTradeId != null);

    return {
      total: orders.length,
      filled: filled.length,
      stops: stops.length,
      correlated: correlated.length,
      ghost: filled.length - correlated.length,
    };
  }, [orders]);

  return {
    orders,
    loading,
    error,
    stats,
    getOrdersByPlan,
    getOrdersByBatch,
  };
};

export default useOrders;
