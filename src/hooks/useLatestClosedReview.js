/**
 * useLatestClosedReview
 * @version 1.1.0
 * @description Retorna em real-time a última review com status === 'CLOSED' do aluno,
 *              opcionalmente filtrada por plano único ou lista de planos (usado pelo
 *              SwotAnalysis quando o aluno está em "Todas as contas" + conta específica
 *              sem plano selecionado: filtra reviews pelos planos daquela conta).
 *
 * @param {string|null} studentId - UID do aluno. Se null, não dispara listener.
 * @param {string|string[]|null} [planFilter=null] - string → where(planId ==);
 *   array → where(planId in) (máx 30); array vazio → sem review; null → sem filtro.
 * @returns {{ review: Object|null, loading: boolean, error: Error|null }}
 */

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

const useLatestClosedReview = (studentId, planFilter = null) => {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState(null);

  const planFilterKey = Array.isArray(planFilter)
    ? `arr:${planFilter.join(',')}`
    : (planFilter || '');

  useEffect(() => {
    if (!studentId) {
      setReview(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    // Array vazio = conta sem planos → fallback "aguardando revisão"
    if (Array.isArray(planFilter) && planFilter.length === 0) {
      setReview(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    // Query broader (últimas N reviews CLOSED do aluno) e filtra client-side.
    // Motivo: review.planId pode estar stale (plano renomeado/recriado); o
    // valor canônico também vive em review.frozenSnapshot.planContext.planId.
    const reviewsRef = collection(db, 'students', studentId, 'reviews');
    const q = query(
      reviewsRef,
      where('status', '==', 'CLOSED'),
      orderBy('weekStart', 'desc'),
      limit(20)
    );

    const allowedSet = (() => {
      if (typeof planFilter === 'string' && planFilter) return new Set([planFilter]);
      if (Array.isArray(planFilter) && planFilter.length > 0) return new Set(planFilter);
      return null; // null = sem filtro
    })();

    const matches = (data) => {
      if (!allowedSet) return true;
      const top = data?.planId;
      const frozen = data?.frozenSnapshot?.planContext?.planId;
      return (top && allowedSet.has(top)) || (frozen && allowedSet.has(frozen));
    };

    const unsub = onSnapshot(
      q,
      (snap) => {
        const picked = snap.docs.find(d => matches(d.data()));
        if (picked) {
          setReview({ id: picked.id, ...picked.data() });
        } else {
          setReview(null);
        }
        setLoading(false);
      },
      (err) => {
        setReview(null);
        setError(err instanceof Error ? err : new Error(err?.message || 'Erro ao carregar revisão'));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [studentId, planFilterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { review, loading, error };
};

export default useLatestClosedReview;
