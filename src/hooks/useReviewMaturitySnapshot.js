/**
 * useReviewMaturitySnapshot
 * @description Retorna o `frozenSnapshot.maturitySnapshot` da review atual
 *              (review N) + o da review CLOSED/ARCHIVED imediatamente anterior
 *              do MESMO plano (review N-1). Usado pelo MaturityComparisonSection
 *              na WeeklyReviewPage (issue #119 task 16 / Fase E2).
 *
 * Estratégia de query (DEC-AUTO-16-01): segue o mesmo padrão de
 * `useLatestClosedReview.js` — query broader `where(status in [CLOSED,
 * ARCHIVED]) + orderBy(weekStart desc) + limit(20)` e filtra planId client-side
 * (match em `planId` top-level OU `frozenSnapshot.planContext.planId`, para
 * tolerar stale). Vantagem: evita exigência de índice composto e é resiliente
 * a review.planId renomeado.
 *
 * Tipo: `getDocs` (one-shot). Revisão anterior é por definição imutável
 * (CLOSED/ARCHIVED), então não há valor em onSnapshot. Refetch só acontece
 * quando muda studentId / planId / currentReview.status|weekStart.
 *
 * Dispara SOMENTE quando currentReview.status === 'CLOSED'.
 * Em DRAFT o snapshot ainda não foi congelado → nada a comparar.
 *
 * @param {string|null} studentId
 * @param {Object|null} currentReview — doc completo (precisa de frozenSnapshot, weekStart, status, id)
 * @param {string|null} planId
 * @returns {{
 *   current: Object|null,   // maturitySnapshot da review N (ou null)
 *   previous: Object|null,  // maturitySnapshot da review N-1 (ou null)
 *   loading: boolean,
 *   error: Error|null,
 * }}
 */

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

export function useReviewMaturitySnapshot(studentId, currentReview, planId) {
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sem studentId o hook é no-op completo (current também retorna null).
  // Semanticamente não faz sentido "apenas extrair frozenSnapshot" sem contexto de aluno.
  const currentSnapshot = studentId ? (currentReview?.frozenSnapshot?.maturitySnapshot ?? null) : null;
  const currentWeekStart = currentReview?.weekStart ?? null;
  const currentReviewId = currentReview?.id ?? null;
  const currentStatus = currentReview?.status ?? null;

  useEffect(() => {
    if (
      !studentId
      || !planId
      || !currentWeekStart
      || currentStatus !== 'CLOSED'
    ) {
      setPrevious(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const colRef = collection(db, 'students', studentId, 'reviews');
    const q = query(
      colRef,
      where('status', 'in', ['CLOSED', 'ARCHIVED']),
      orderBy('weekStart', 'desc'),
      limit(20),
    );

    let cancelled = false;

    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const match = docs.find((r) => {
          if (r.id === currentReviewId) return false;
          if (!r.weekStart || r.weekStart >= currentWeekStart) return false;
          const top = r.planId;
          const frozen = r.frozenSnapshot?.planContext?.planId;
          return top === planId || frozen === planId;
        }) ?? null;
        setPrevious(match?.frozenSnapshot?.maturitySnapshot ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useReviewMaturitySnapshot] error:', err);
        setError(err instanceof Error ? err : new Error(err?.message ?? 'Erro ao buscar revisão anterior'));
        setPrevious(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [studentId, planId, currentWeekStart, currentStatus, currentReviewId]);

  return { current: currentSnapshot, previous, loading, error };
}

export default useReviewMaturitySnapshot;
