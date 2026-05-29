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
 * @param {string|null} [cycleKey=null] - quando truthy, restringe à review daquele
 *   ciclo (review.cycleKey ou frozenSnapshot.planContext.cycleKey). null → sem filtro
 *   de ciclo (última review fechada). Passe null para "Todos os ciclos" (#289).
 * @returns {{ review: Object|null, loading: boolean, error: Error|null }}
 */

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

const useLatestClosedReview = (studentId, planFilter = null, cycleKey = null) => {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState(null);

  const planFilterKey = Array.isArray(planFilter)
    ? `arr:${planFilter.join(',')}`
    : (planFilter || '');
  const cycleKeyDep = cycleKey || '';

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

    const matchesPlan = (data) => {
      if (!allowedSet) return true;
      const top = data?.planId;
      const frozen = data?.frozenSnapshot?.planContext?.planId;
      return (top && allowedSet.has(top)) || (frozen && allowedSet.has(frozen));
    };

    // Filtro de ciclo (#289): só quando cycleKey truthy. Aceita match no topo
    // ou no snapshot congelado (planContext.cycleKey).
    const matchesCycle = (data) => {
      if (!cycleKey) return true;
      const top = data?.cycleKey;
      const frozen = data?.frozenSnapshot?.planContext?.cycleKey;
      return top === cycleKey || frozen === cycleKey;
    };

    const matches = (data) => matchesPlan(data) && matchesCycle(data);

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
  }, [studentId, planFilterKey, cycleKeyDep]); // eslint-disable-line react-hooks/exhaustive-deps

  return { review, loading, error };
};

export default useLatestClosedReview;
