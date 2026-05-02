/**
 * useCycleConsistency
 * @version 1.0.0 (v1.54.0 — issue #235 F2.1)
 * @description Orquestra os 3 helpers F1 do redesign do card "Consistência
 *   Operacional" — Sharpe per-ciclo (Selic descontada), CV normalizado e
 *   MEP/MEN médio. Recebe trades/plan/janela como props e retorna shape
 *   pronto para consumo pelo componente F2.2.
 *
 *   Híbrido: CV e MEP/MEN são síncronos (puros); Sharpe é async porque
 *   consulta Selic via Firestore. Usa cancelled flag para evitar setState
 *   pós-unmount.
 *
 *   Spec: docs/dev/issues/issue-235-cycle-consistency-redesign.md
 *   Helpers F1: src/utils/cycleConsistency/* (commits a9d1bed6, ba81cfa9, df672e9a)
 *   Lookup Selic: src/utils/marketData/getSelicForDate.js (commit 8ecafac9)
 *
 * @param {Object} args
 * @param {Array} args.trades                — trades do escopo (já filtrados por conta/plano)
 * @param {Object} args.plan                 — plano ativo (lê targetRR + pl inicial)
 * @param {string} args.cycleStart           — ISO `YYYY-MM-DD` (inclusive)
 * @param {string} args.cycleEnd             — ISO `YYYY-MM-DD` (inclusive)
 * @param {Object} [args.opts]               — overrides (testabilidade)
 * @param {number} [args.opts.minDays]       — mínimo de dias com trade (Sharpe + CV)
 * @param {number} [args.opts.coverageThreshold] — threshold MEP/MEN (default 0.7)
 * @param {Function} [args.opts.getSelicForDateFn] — override de lookup Selic
 *
 * @returns {{
 *   sharpe: Object|null,
 *   cvNormalized: Object|null,
 *   avgExcursion: Object|null,
 *   loading: boolean,
 *   error: Error|null
 * }}
 */

import { useState, useEffect } from 'react';
import { computeCycleSharpe } from '../utils/cycleConsistency/computeCycleSharpe';
import { computeCVNormalized } from '../utils/cycleConsistency/computeCVNormalized';
import { computeAvgExcursion } from '../utils/cycleConsistency/computeAvgExcursion';

const NULL_METRICS = {
  sharpe: null,
  cvNormalized: null,
  avgExcursion: null,
};

export function useCycleConsistency({ trades, plan, cycleStart, cycleEnd, opts = {} }) {
  const [state, setState] = useState({
    ...NULL_METRICS,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!cycleStart || !cycleEnd || !Array.isArray(trades)) {
      setState({ ...NULL_METRICS, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    let cvNormalized;
    let avgExcursion;
    try {
      cvNormalized = computeCVNormalized(trades, plan ?? {}, cycleStart, cycleEnd, opts);
      avgExcursion = computeAvgExcursion(trades, cycleStart, cycleEnd, opts);
    } catch (err) {
      if (!cancelled) {
        setState({
          ...NULL_METRICS,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
      return () => {
        cancelled = true;
      };
    }

    const plStart = plan && typeof plan.pl === 'number' && Number.isFinite(plan.pl) ? plan.pl : null;

    const sharpePromise = plStart === null
      ? Promise.resolve({
          value: null,
          daysWithTrade: 0,
          source: 'BCB',
          fallbackUsed: false,
          insufficientReason: 'no_pl_start',
        })
      : computeCycleSharpe(trades, cycleStart, cycleEnd, plStart, opts);

    sharpePromise
      .then((sharpe) => {
        if (cancelled) return;
        setState({
          sharpe,
          cvNormalized,
          avgExcursion,
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          ...NULL_METRICS,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, plan, cycleStart, cycleEnd]);

  return state;
}

export default useCycleConsistency;
