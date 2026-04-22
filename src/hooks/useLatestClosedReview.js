/**
 * useLatestClosedReview
 * @version 1.0.0
 * @description Retorna em real-time a última review com status === 'CLOSED' do aluno
 *              (opcionalmente filtrada por planId). Usado pelo SwotAnalysis do
 *              StudentDashboard para exibir o SWOT persistido pelo mentor
 *              (issue #164 — E1).
 *
 * @param {string|null} studentId - UID do aluno. Se null, não dispara listener.
 * @param {string|null} [planId=null] - Se fornecido, filtra reviews pelo plano.
 * @returns {{ review: Object|null, loading: boolean, error: Error|null }}
 */

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

const useLatestClosedReview = (studentId, planId = null) => {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!studentId) {
      setReview(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const reviewsRef = collection(db, 'students', studentId, 'reviews');
    const clauses = [where('status', '==', 'CLOSED')];
    if (planId) clauses.push(where('planId', '==', planId));
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
  }, [studentId, planId]);

  return { review, loading, error };
};

export default useLatestClosedReview;
