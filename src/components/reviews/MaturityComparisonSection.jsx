/**
 * MaturityComparisonSection
 * @description Seção exibida em revisões CLOSED mostrando a evolução de
 *              maturidade 4D entre a review atual (N) e a CLOSED/ARCHIVED
 *              imediatamente anterior do mesmo plano (N-1).
 *
 *              Issue #119 task 16 / Fase E2.
 *
 * Renderiza:
 *   - Stage change (badge UP/DOWN/SAME)
 *   - Deltas dos 5 scores (emotional, financial, operational, maturity, composite)
 *   - Gates conquistados (GAINED), perdidos (LOST) e ainda pendentes (STAGNANT_UNMET)
 *
 * Casos:
 *   - loading        → skeleton
 *   - error          → fallback "Comparativo indisponível"
 *   - !hasData       → null (nada a mostrar)
 *   - previous=null  → "Primeira revisão fechada — sem comparativo ainda"
 *   - normal         → seção completa
 */

import { useMemo } from 'react';
import DebugBadge from '../DebugBadge';
import { computeMaturityDelta } from '../../utils/maturityDelta';
import { STAGE_NAMES } from '../../utils/maturityEngine/constants';

const fmtDelta = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`);

const scoreDeltaCls = (v) => {
  if (v == null) return 'text-slate-400';
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-red-400';
  return 'text-slate-300';
};

const stageBadgeCls = (change) => {
  if (change === 'UP') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (change === 'DOWN') return 'bg-red-500/20 text-red-300 border-red-500/30';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
};

const stageName = (n) => (n == null ? '—' : (STAGE_NAMES[n] ?? String(n)));

const MaturityComparisonSection = ({
  current,
  previous,
  loading = false,
  error = null,
  embedded = false,
}) => {
  const delta = useMemo(() => computeMaturityDelta(current, previous), [current, previous]);

  if (loading) {
    return (
      <section className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 mb-4">
        <div className="animate-pulse text-slate-500 text-sm">Carregando comparativo…</div>
        {!embedded && <DebugBadge component="MaturityComparisonSection" />}
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 mb-4">
        <div className="text-slate-400 text-sm">Comparativo indisponível.</div>
        {!embedded && <DebugBadge component="MaturityComparisonSection" />}
      </section>
    );
  }

  if (!delta.hasData) return null;

  if (!previous) {
    return (
      <section className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Evolução desde a revisão anterior</h3>
        <p className="text-slate-400 text-sm">Primeira revisão fechada — sem comparativo ainda.</p>
        {!embedded && <DebugBadge component="MaturityComparisonSection" />}
      </section>
    );
  }

  const gained = delta.gateDeltas.filter((g) => g.change === 'GAINED');
  const lost = delta.gateDeltas.filter((g) => g.change === 'LOST');
  const stagnantUnmet = delta.gateDeltas.filter((g) => g.change === 'STAGNANT_UNMET');

  const stageLine = delta.stageChange === 'UP'
    ? `Stage avançou: ${stageName(delta.previousStage)} → ${stageName(delta.currentStage)}`
    : delta.stageChange === 'DOWN'
      ? `Stage regrediu: ${stageName(delta.previousStage)} → ${stageName(delta.currentStage)}`
      : `Stage mantido: ${stageName(delta.currentStage)}`;

  return (
    <section className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 mb-4">
      <header className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-lg font-semibold text-white">Evolução desde a revisão anterior</h3>
        <span className={`text-xs px-2 py-0.5 rounded border ${stageBadgeCls(delta.stageChange)}`}>
          {stageLine}
        </span>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4" data-testid="score-deltas">
        {['emotional', 'financial', 'operational', 'maturity', 'composite'].map((k) => (
          <div
            key={k}
            className="bg-slate-800/50 rounded p-2 text-center"
            data-testid={`score-delta-${k}`}
          >
            <div className="text-xs text-slate-500 uppercase tracking-wide">{k}</div>
            <div className={`text-base font-semibold ${scoreDeltaCls(delta.scoreDeltas[k])}`}>
              {fmtDelta(delta.scoreDeltas[k])}
            </div>
          </div>
        ))}
      </div>

      {gained.length > 0 && (
        <div className="mb-2" data-testid="gates-gained">
          <div className="text-xs text-emerald-500 uppercase tracking-wide mb-1">
            Gates conquistados ({gained.length})
          </div>
          <ul className="text-sm text-emerald-300 space-y-0.5">
            {gained.map((g) => <li key={g.id}>· {g.label}</li>)}
          </ul>
        </div>
      )}

      {lost.length > 0 && (
        <div className="mb-2" data-testid="gates-lost">
          <div className="text-xs text-red-500 uppercase tracking-wide mb-1">
            Gates perdidos ({lost.length})
          </div>
          <ul className="text-sm text-red-300 space-y-0.5">
            {lost.map((g) => <li key={g.id}>· {g.label}</li>)}
          </ul>
        </div>
      )}

      {stagnantUnmet.length > 0 && (
        <div className="mb-2" data-testid="gates-stagnant">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            Ainda pendentes ({stagnantUnmet.length})
          </div>
          <ul className="text-sm text-slate-400 space-y-0.5">
            {stagnantUnmet.slice(0, 5).map((g) => <li key={g.id}>· {g.label}</li>)}
            {stagnantUnmet.length > 5 && (
              <li className="text-xs italic">... e mais {stagnantUnmet.length - 5}</li>
            )}
          </ul>
        </div>
      )}

      {!embedded && <DebugBadge component="MaturityComparisonSection" />}
    </section>
  );
};

export default MaturityComparisonSection;
