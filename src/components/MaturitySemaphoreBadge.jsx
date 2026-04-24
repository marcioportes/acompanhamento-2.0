/**
 * MaturitySemaphoreBadge
 * @description Bolinha colorida 🟢🟡🔴⚪ do estado de maturidade do aluno,
 *              com tooltip descritivo e suporte a label textual opcional.
 *              Uso principal: linha de aluno na MentorDashboard (embedded).
 *
 * Ref: issue #119 task 17 — Fase F (Mentor).
 *      Regras de classificação em `src/utils/maturitySemaphore.js` (D15 §3.1).
 */

import React from 'react';
import {
  getMaturitySemaphore,
  SEMAPHORE_LABELS,
  SEMAPHORE_COLORS,
} from '../utils/maturitySemaphore';
import DebugBadge from './DebugBadge';

const MaturitySemaphoreBadge = ({ maturity, showLabel = false, embedded = true }) => {
  const state = getMaturitySemaphore(maturity);
  const colorClass = SEMAPHORE_COLORS[state];
  const label = SEMAPHORE_LABELS[state];

  const gatesMet = maturity?.gatesMet ?? 0;
  const gatesTotal = maturity?.gatesTotal ?? 0;
  const firstReason = maturity?.signalRegression?.reasons?.[0];

  let tooltip;
  if (state === 'UNKNOWN') {
    tooltip = 'Sem dados de maturidade';
  } else if (state === 'RED') {
    tooltip = firstReason ? `${label} — ${firstReason}` : label;
  } else if (gatesTotal > 0) {
    tooltip = `${label} · ${gatesMet}/${gatesTotal} gates`;
  } else {
    tooltip = label;
  }

  return (
    <div
      className="inline-flex items-center gap-1.5"
      data-testid={`semaphore-${state.toLowerCase()}`}
      title={tooltip}
      role="status"
      aria-label={`Maturidade: ${label}`}
    >
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />
      {showLabel && <span className="text-xs text-slate-400">{label}</span>}
      {!embedded && <DebugBadge component="MaturitySemaphoreBadge" />}
    </div>
  );
};

export default MaturitySemaphoreBadge;
