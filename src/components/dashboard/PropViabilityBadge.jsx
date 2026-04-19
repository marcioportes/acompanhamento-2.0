/**
 * PropViabilityBadge — badge visual do estado de viabilidade do plano mecânico
 * @description 6 estados, phase-aware (EVALUATION / PA / SIM_FUNDED / LIVE).
 *   Lógica em `src/utils/propViabilityBadge.js`.
 *
 * Ref: issue #145 Fase F, spec v2 §4.3
 */

import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { classifyViability, VIABILITY_STATES } from '../../utils/propViabilityBadge';

const COLOR_CLASSES = {
  green:  'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  amber:  'bg-amber-500/10 text-amber-300 border-amber-500/30',
  orange: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  red:    'bg-red-500/10 text-red-300 border-red-500/30',
  gray:   'bg-slate-500/10 text-slate-300 border-slate-500/30',
};

const ICONS = {
  [VIABILITY_STATES.CONFORTAVEL]:      CheckCircle2,
  [VIABILITY_STATES.APERTADO]:         AlertTriangle,
  [VIABILITY_STATES.RESTRITO]:         AlertTriangle,
  [VIABILITY_STATES.STOP_RUIDO]:       XCircle,
  [VIABILITY_STATES.RESTRICAO_HARD]:   XCircle,
  [VIABILITY_STATES.ERRO]:             HelpCircle,
};

const PropViabilityBadge = ({ plan, phase = 'EVALUATION' }) => {
  const { state, color, text, recommendation } = classifyViability(plan, phase);
  const Icon = ICONS[state] ?? HelpCircle;
  const classes = COLOR_CLASSES[color] ?? COLOR_CLASSES.gray;

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${classes}`}>
      <Icon size={14} className="shrink-0 mt-0.5" />
      <div className="flex-1 space-y-0.5">
        <div className="font-medium leading-tight">{text}</div>
        {recommendation && (
          <div className="text-[11px] opacity-80">→ {recommendation}</div>
        )}
      </div>
    </div>
  );
};

export default PropViabilityBadge;
