/**
 * PlanoMecanicoCard — Zona 3 da PropFirmPage: plano mecânico determinístico
 * @description Exibe output de calculateAttackPlan read-only + ViabilityBadge.
 *   RO USD, stop pts, target pts, daily goal/stop derivados, max trades/dia, RR.
 *   Se incompatible: bloco de erro compacto + recomendação.
 *
 * Ref: issue #145 Fase F, spec v2 §4.1
 */

import { Target } from 'lucide-react';
import PropViabilityBadge from './PropViabilityBadge';
import { formatCurrencyDynamic } from '../../utils/currency';

const Row = ({ label, value, emphasize = false, muted = false }) => (
  <div className="flex items-baseline justify-between text-xs py-1 border-b border-slate-800/50 last:border-b-0">
    <span className="text-slate-500">{label}</span>
    <span className={
      emphasize
        ? 'text-emerald-300 font-semibold'
        : muted
          ? 'text-slate-400'
          : 'text-white font-medium'
    }>{value}</span>
  </div>
);

const PlanoMecanicoCard = ({ plan, phase = 'EVALUATION', currency = 'USD' }) => {
  const fmt = (v) => formatCurrencyDynamic(v, currency);

  if (!plan) {
    return (
      <div className="glass-card border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Plano mecânico</h3>
        </div>
        <div className="text-xs text-slate-500">Plano não calculado — selecione instrumento e perfil.</div>
      </div>
    );
  }

  const dailyStop = (plan.roPerTrade ?? 0) * (plan.maxTradesPerDay ?? 0);
  const dailyGoal = dailyStop * (plan.rrMinimum ?? 0);

  return (
    <div className="glass-card border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Plano mecânico</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {plan.profileName ?? plan.profile ?? '—'}
        </span>
      </div>

      <div className="space-y-0">
        <Row label="Instrumento" value={plan.instrument?.symbol ?? '—'} />
        <Row label="RO por trade" value={fmt(plan.roPerTrade ?? 0)} />
        <Row label="Stop" value={`${plan.stopPoints ?? 0} pts · ${fmt(plan.stopPerTrade ?? 0)}`} />
        <Row label="Target" value={`${plan.targetPoints ?? 0} pts · ${fmt(plan.targetPerTrade ?? 0)}`} />
        <Row label="R:R" value={`1 : ${plan.rrMinimum ?? 0}`} />
        <Row label="Max trades/dia" value={plan.maxTradesPerDay ?? 0} />
        <Row label="Daily goal (derivado)" value={fmt(dailyGoal)} emphasize />
        <Row label="Daily stop (derivado)" value={fmt(dailyStop)} />
        <Row label="Daily target (ritmo)" value={fmt(plan.dailyTarget ?? 0)} muted />
        <Row label="Losses até bust" value={plan.lossesToBust ?? 0} />
      </div>

      <PropViabilityBadge plan={plan} phase={phase} />
    </div>
  );
};

export default PlanoMecanicoCard;
