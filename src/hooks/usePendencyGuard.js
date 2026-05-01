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
 * Persistência por *fingerprint* (não boolean):
 *   - Quando o usuário clica OK/Escape/X, gravamos o fingerprint do conjunto atual de
 *     pendências em `sessionStorage`. Modal não reabre enquanto o conjunto for o mesmo
 *     (F5 mantém dispensado).
 *   - Quando uma nova pendência surge (ex.: mentor revisa novo trade), o fingerprint
 *     muda → modal reabre automaticamente, mesmo na sessão atual.
 *   - `closeForNow()` (clique em item da lista) é estado local e auto-resetado quando
 *     o conjunto de pendências muda.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTrades } from './useTrades';
import { useWeeklyReviews } from './useWeeklyReviews';

const fingerprintKeyFor = (studentId) =>
  studentId ? `pendency_dismissed_${studentId}` : null;

const readFingerprint = (key) => {
  if (!key) return null;
  try {
    return globalThis?.sessionStorage?.getItem(key) || null;
  } catch {
    return null;
  }
};

const writeFingerprint = (key, value) => {
  if (!key) return;
  try {
    if (value == null) {
      globalThis?.sessionStorage?.removeItem(key);
    } else {
      globalThis?.sessionStorage?.setItem(key, value);
    }
  } catch {
    /* ignore */
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

/** Stable string for the current pending set (sorted ids). Empty set → empty string. */
export const computeFingerprint = (pendingTrades, pendingTakeaways) => {
  if (pendingTrades.length === 0 && pendingTakeaways.length === 0) return '';
  const t = pendingTrades.map(x => x.id).sort();
  const k = pendingTakeaways.map(x => `${x.reviewId}:${x.id}`).sort();
  return JSON.stringify({ t, k });
};

export const usePendencyGuard = (studentId) => {
  const { trades, isLoading: tradesLoading } = useTrades(studentId);
  const { reviews, isLoading: reviewsLoading } = useWeeklyReviews(studentId);

  const fingerprintKey = fingerprintKeyFor(studentId);

  const [closedForNow, setClosedForNow] = useState(false);
  const [dismissedFingerprint, setDismissedFingerprint] = useState(() =>
    readFingerprint(fingerprintKey),
  );

  const { pendingTrades, pendingTakeaways } = useMemo(
    () => computePendencies({ trades, reviews }),
    [trades, reviews],
  );

  const currentFingerprint = useMemo(
    () => computeFingerprint(pendingTrades, pendingTakeaways),
    [pendingTrades, pendingTakeaways],
  );

  // Quando o conjunto de pendências muda, closedForNow não vale mais (era pra outro set).
  const lastFpRef = useRef(currentFingerprint);
  useEffect(() => {
    if (lastFpRef.current !== currentFingerprint) {
      setClosedForNow(false);
      lastFpRef.current = currentFingerprint;
    }
  }, [currentFingerprint]);

  const dismiss = useCallback(() => {
    writeFingerprint(fingerprintKey, currentFingerprint);
    setDismissedFingerprint(currentFingerprint);
  }, [fingerprintKey, currentFingerprint]);

  const closeForNow = useCallback(() => {
    setClosedForNow(true);
  }, []);

  const loading = tradesLoading || reviewsLoading;
  const hasPendencies = pendingTrades.length > 0 || pendingTakeaways.length > 0;
  const isDismissedForCurrentSet =
    !!currentFingerprint && currentFingerprint === dismissedFingerprint;

  const shouldShow =
    !!studentId
    && !loading
    && hasPendencies
    && !isDismissedForCurrentSet
    && !closedForNow;

  return {
    shouldShow,
    loading,
    pendingTrades,
    pendingTakeaways,
    dismiss,
    closeForNow,
    dismissed: isDismissedForCurrentSet,
    currentFingerprint,
  };
};

export default usePendencyGuard;
