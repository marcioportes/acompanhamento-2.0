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

    const reviewsRef = collection(db, 'students', studentId, 'reviews');
    const clauses = [where('status', '==', 'CLOSED')];
    if (typeof planFilter === 'string' && planFilter) {
      clauses.push(where('planId', '==', planFilter));
    } else if (Array.isArray(planFilter)) {
      if (planFilter.length === 1) {
        clauses.push(where('planId', '==', planFilter[0]));
      } else {
        clauses.push(where('planId', 'in', planFilter.slice(0, 30)));
      }
    }
    clauses.push(orderBy('weekStart', 'desc'));
    clauses.push(limit(1));
    const q = query(reviewsRef, ...clauses);

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty || snap.docs.length === 0) {
          setReview(null);
        } else {
          const d = snap.docs[0];
          setReview({ id: d.id, ...d.data() });
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
