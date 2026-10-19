/**
 * useLatestClosedReview
 * @version 1.2.0
 * @description Retorna em real-time a última review com status === 'CLOSED' do aluno,
 *              opcionalmente filtrada por plano único ou lista de planos (usado pelo
 *              SwotAnalysis quando o aluno está em "Todas as contas" + conta específica
 *              sem plano selecionado: filtra reviews pelos planos daquela conta).
 *
 * @param {string|null} studentId - UID do aluno. Se null, não dispara listener.
 * @param {string|string[]|null} [planFilter=null] - string → where(planId ==);
 *   array → where(planId in) (máx 30); array vazio → sem review; null → sem filtro.
 * @param {{startISO: string, endISO: string}|null} [cycleWindow=null] - janela do ciclo
 *   selecionado: restringe às reviews cujo período cruza a janela (#486). null → sem
 *   filtro de ciclo (última review fechada). Passe null para "Todos os ciclos" (#289).
 * @returns {{ review: Object|null, loading: boolean, error: Error|null }}
 */

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

// Ciclo da review sai das datas dela (#486). O `cycleKey` gravado não serve: as
// revisões nascidas do feedback (#269 v2) gravam null, e nas antigas o campo é raro e
// vem em formato de data ('2026-04-01'), enquanto a barra usa '2026-04'.
// Pertence ⇔ o período [periodStart||weekStart, periodEnd||weekEnd] cruza a janela.
export const reviewInCycleWindow = (data, cycleWindow) => {
  if (!cycleWindow) return true;
  const isISO = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const start = [data?.periodStart, data?.weekStart].find(isISO);
  const end = [data?.periodEnd, data?.weekEnd, start].find(isISO);
  if (!start || !end) return false;
  return start <= cycleWindow.endISO && end >= cycleWindow.startISO;
};

const useLatestClosedReview = (studentId, planFilter = null, cycleWindow = null) => {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState(null);

  const planFilterKey = Array.isArray(planFilter)
    ? `arr:${planFilter.join(',')}`
    : (planFilter || '');
  const cycleWindowKey = cycleWindow ? `${cycleWindow.startISO}~${cycleWindow.endISO}` : '';

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

    const matches = (data) => matchesPlan(data) && reviewInCycleWindow(data, cycleWindow);

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
  }, [studentId, planFilterKey, cycleWindowKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { review, loading, error };
};

export default useLatestClosedReview;
