/**
 * usePendencyGuard
 * @description Agrega 2 categorias de pendência do aluno (trades REVIEWED não fechados +
 * takeaways abertos em revisões) e gerencia dismiss session-scoped via `sessionStorage`.
 * Issue #220, parte 2/3 de #218.
 *
 * Categorias derivadas de estado existente (zero campo Firestore novo).
 *   - Trades pendentes: `t.status === 'REVIEWED'`.
 *   - Takeaways pendentes: por revisão, item.done=false E item.id não em alunoDoneIds.
 *
 * Dismiss: chave `pendency_dismissed_${studentId}` em sessionStorage. F5 mantém dismiss;
 * fechar aba/janela e abrir nova → aparece de novo se categorias persistirem.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTrades } from './useTrades';
import { useWeeklyReviews } from './useWeeklyReviews';

const dismissKeyFor = (studentId) =>
  studentId ? `pendency_dismissed_${studentId}` : null;

const readDismissed = (key) => {
  if (!key) return true;
  try {
    return globalThis?.sessionStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeDismissed = (key) => {
  if (!key) return;
  try {
    globalThis?.sessionStorage?.setItem(key, '1');
  } catch {
    /* ignore — modo privado ou sandbox sem storage */
  }
};

export const computePendencies = ({ trades, reviews }) => {
  const pendingTrades = (Array.isArray(trades) ? trades : [])
    .filter(t => t && t.status === 'REVIEWED');

  const pendingTakeaways = (Array.isArray(reviews) ? reviews : []).flatMap(r => {
    if (!r || (r.status !== 'CLOSED' && r.status !== 'ARCHIVED')) return [];
    const items = Array.isArray(r.takeawayItems) ? r.takeawayItems : [];
    const alunoDone = new Set(Array.isArray(r.alunoDoneIds) ? r.alunoDoneIds : []);
    return items
      .filter(it => it && !it.done && !alunoDone.has(it.id))
      .map(it => ({
        ...it,
        reviewId: r.id,
        reviewWeekStart: r.weekStart || null,
        reviewPeriodKey: r.periodKey || null,
      }));
  });

  return { pendingTrades, pendingTakeaways };
};

export const usePendencyGuard = (studentId) => {
  const { trades, isLoading: tradesLoading } = useTrades(studentId);
  const { reviews, isLoading: reviewsLoading } = useWeeklyReviews(studentId);

  const dismissKey = dismissKeyFor(studentId);
  const [dismissed, setDismissed] = useState(() => readDismissed(dismissKey));

  const { pendingTrades, pendingTakeaways } = useMemo(
    () => computePendencies({ trades, reviews }),
    [trades, reviews],
  );

  const dismiss = useCallback(() => {
    writeDismissed(dismissKey);
    setDismissed(true);
  }, [dismissKey]);

  const loading = tradesLoading || reviewsLoading;
  const hasPendencies = pendingTrades.length > 0 || pendingTakeaways.length > 0;
  const shouldShow = !!studentId && !loading && !dismissed && hasPendencies;

  return {
    shouldShow,
    loading,
    pendingTrades,
    pendingTakeaways,
    dismiss,
    dismissed,
  };
};

export default usePendencyGuard;
