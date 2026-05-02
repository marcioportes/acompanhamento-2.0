/**
 * CycleConsistencyCard
 * @version 1.0.0 (v1.54.0 — issue #235 F2.2)
 * @description Card "Consistência Operacional" do StudentDashboard. Substitui
 *   CV puro + ΔT W/L (que confundiam concentração/estabilidade/aderência) por
 *   4 métricas científicas: Sharpe per-ciclo (Selic descontada), CV normalizado
 *   (cv_obs / cv_exp(plan.targetRR, WR)), MEP médio e MEN médio em % por entry.
 *
 *   Spec / mockup: docs/dev/issues/issue-235-cycle-consistency-redesign.md
 *   Hook orquestrador: src/hooks/useCycleConsistency.js (commit 10b941ec)
 *
 *   ΔT W/L e tempo médio geral foram removidos do card (DEC-AUTO-235-T09-B —
 *   se voltarem, será em outro card / outro issue, conforme spec do issue).
 */
/* eslint-disable react/prop-types */

import { Activity } from 'lucide-react';
import { useCycleConsistency } from '../../hooks/useCycleConsistency';
import DebugBadge from '../DebugBadge';

const MONTH_PT_BR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function deriveCycleLabel(cycleStart) {
  if (typeof cycleStart !== 'string' || cycleStart.length < 7) return null;
  const m = /^(\d{4})-(\d{2})/.exec(cycleStart);
  if (!m) return null;
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  return `${MONTH_PT_BR[monthIdx]}/${m[1]}`;
}

function sharpeTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value >= 1.5) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value >= 1.2) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value >= 0) return { text: 'text-orange-400', dot: 'bg-orange-400' };
  return { text: 'text-red-400', dot: 'bg-red-400' };
}

function cvTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value < 0.5) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value <= 1.2) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value <= 1.5) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value <= 2.0) return { text: 'text-orange-400', dot: 'bg-orange-400' };
  return { text: 'text-red-400', dot: 'bg-red-400' };
}

function mepTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value < 0) return { text: 'text-red-400', dot: 'bg-red-400' };
  if (value >= 1.0) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value >= 0.5) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  return { text: 'text-orange-400', dot: 'bg-orange-400' };
}

function menTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value >= -0.5) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value >= -1.0) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value >= -2.0) return { text: 'text-orange-400', dot: 'bg-orange-400' };
  return { text: 'text-red-400', dot: 'bg-red-400' };
}

function selicBadge(source) {
  if (source === 'BCB') {
    return (
      <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
        📊 BCB
      </span>
    );
  }
  if (source === 'FALLBACK') {
    return (
      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
        ⚠ fallback
      </span>
    );
  }
  if (source === 'MIXED') {
    return (
      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
        ⚠ misto
      </span>
    );
  }
  return null;
}

function MetricRow({ label, value, theme, badge, tooltip, valueClassName }) {
  return (
    <div className="flex items-center justify-between py-2.5" title={tooltip}>
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold font-mono ${valueClassName ?? theme.text}`}>{value}</span>
        {badge}
        <span className={`w-2 h-2 rounded-full ${theme.dot}`} aria-hidden="true" />
      </div>
    </div>
  );
}

function sharpeContent(sharpe, opts) {
  if (!sharpe) return { value: '-', theme: sharpeTheme(null), badge: null };
  if (sharpe.value == null) {
    if (sharpe.insufficientReason === 'min_days') {
      const min = opts.minDays ?? 5;
      return {
        value: `Insuficiente · ≥${min} dias`,
        theme: sharpeTheme(null),
        badge: null,
        valueClassName: 'text-xs font-medium text-slate-500',
      };
    }
    if (sharpe.insufficientReason === 'no_pl_start') {
      return {
        value: 'Plano sem saldo inicial registrado',
        theme: sharpeTheme(null),
        badge: null,
        valueClassName: 'text-xs font-medium text-slate-500',
      };
    }
    if (sharpe.insufficientReason === 'zero_variance') {
      return {
        value: 'Variância zero — operações idênticas',
        theme: sharpeTheme(null),
        badge: null,
        valueClassName: 'text-xs font-medium text-slate-500',
      };
    }
    return { value: '-', theme: sharpeTheme(null), badge: null };
  }
  return {
    value: sharpe.value.toFixed(2),
    theme: sharpeTheme(sharpe.value),
    badge: selicBadge(sharpe.source),
  };
}

function cvContent(cv) {
  if (!cv) return { value: '-', theme: cvTheme(null) };
  if (cv.value == null) {
    const label = cv.label ?? '-';
    return {
      value: label,
      theme: cvTheme(null),
      valueClassName: 'text-xs font-medium text-slate-500',
    };
  }
  return {
    value: cv.value.toFixed(2),
    theme: cvTheme(cv.value),
  };
}

function mepContent(avg) {
  if (!avg || avg.avgMEP == null) {
    const label = avg?.insufficientReason === 'no_excursion_data'
      ? 'Sem dado MEP/MEN nos trades do ciclo'
      : avg?.insufficientReason === 'no_trades'
        ? 'Sem trades no ciclo'
        : '-';
    return {
      value: label,
      theme: mepTheme(null),
      valueClassName: 'text-xs font-medium text-slate-500',
    };
  }
  const v = avg.avgMEP;
  return {
    value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}% / entry`,
    theme: mepTheme(v),
  };
}

function menContent(avg) {
  if (!avg || avg.avgMEN == null) {
    const label = avg?.insufficientReason === 'no_excursion_data'
      ? 'Sem dado MEP/MEN nos trades do ciclo'
      : avg?.insufficientReason === 'no_trades'
        ? 'Sem trades no ciclo'
        : '-';
    return {
      value: label,
      theme: menTheme(null),
      valueClassName: 'text-xs font-medium text-slate-500',
    };
  }
  const v = avg.avgMEN;
  return {
    value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}% / entry`,
    theme: menTheme(v),
  };
}

function buildSharpeTooltip(sharpe, cycleLabel) {
  const days = sharpe?.daysWithTrade ?? 0;
  return (
    'Sharpe = (retorno médio diário − Selic do dia) ÷ desvio padrão dos retornos × √252. ' +
    'Mede o quanto seu retorno compensa o risco descontando a oportunidade de ganhar Selic ' +
    `sem risco. Anualizado √252. Selic descontada apenas em dias com trade. Janela: ${cycleLabel ?? '—'} ` +
    `(${days} dias operados).`
  );
}

function buildCvTooltip(cv, plan) {
  const rrText = plan && typeof plan.targetRR === 'number' ? plan.targetRR.toFixed(1) : '?';
  const wrText = cv && typeof cv.cvObs === 'number' && plan && typeof plan.expectedWinRate === 'number'
    ? `${(plan.expectedWinRate * 100).toFixed(0)}%`
    : '—';
  return (
    `CV normalizado compara a variabilidade do seu P&L com a esperada pelo seu plano (RR ${rrText}, ` +
    `WR ${wrText}). 1.0 = executando exatamente o plano · >1.5 = mais errático · <0.8 = mais estável ` +
    '(verificar amostra ou overfitting).'
  );
}

const MEP_TOOLTIP =
  'MEP médio (Máxima Excursão Positiva): em média seus trades chegaram a +X% durante a vida do ' +
  'trade. Comparado com o resultado final, mostra quanto você deixou na mesa.';

const MEN_TOOLTIP =
  'MEN médio (Máxima Excursão Negativa): em média seus trades chegaram a −X% antes de fechar. ' +
  'Mostra quanto risco você aceitou correr antes do desfecho.';

const CycleConsistencyCard = ({ trades, plan, cycleStart, cycleEnd, cycleLabel, opts }) => {
  const state = useCycleConsistency({ trades, plan, cycleStart, cycleEnd, opts });
  const { sharpe, cvNormalized, avgExcursion, loading, error } = state;

  const label = cycleLabel ?? deriveCycleLabel(cycleStart);

  const sharpeView = sharpeContent(sharpe, opts ?? {});
  const cvView = cvContent(cvNormalized);
  const mepView = mepContent(avgExcursion);
  const menView = menContent(avgExcursion);

  return (
    <div className="glass-card p-5 relative h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Consistencia Operacional
          </span>
          {label && (
            <span className="text-[11px] text-slate-500 normal-case">({label})</span>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-400/80">Não foi possível carregar métricas do ciclo</p>
      ) : loading ? (
        <div className="flex-1 space-y-3" data-testid="cycle-consistency-skeleton">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-slate-700/30 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col divide-y divide-slate-700/30">
          <MetricRow
            label={`Sharpe${label ? ` (${label})` : ''}`}
            value={sharpeView.value}
            theme={sharpeView.theme}
            badge={sharpeView.badge}
            tooltip={buildSharpeTooltip(sharpe, label)}
            valueClassName={sharpeView.valueClassName}
          />
          <MetricRow
            label="CV normalizado"
            value={cvView.value}
            theme={cvView.theme}
            tooltip={buildCvTooltip(cvNormalized, plan)}
            valueClassName={cvView.valueClassName}
          />
          <MetricRow
            label="MEP médio"
            value={mepView.value}
            theme={mepView.theme}
            tooltip={MEP_TOOLTIP}
            valueClassName={mepView.valueClassName}
          />
          <MetricRow
            label="MEN médio"
            value={menView.value}
            theme={menView.theme}
            tooltip={MEN_TOOLTIP}
            valueClassName={menView.valueClassName}
          />

          {avgExcursion?.coverageBelowThreshold && avgExcursion.coverageLabel && (
            <p className="text-[10px] text-amber-400/80 mt-2 pt-2 border-0">
              {avgExcursion.coverageLabel}
            </p>
          )}
        </div>
      )}

      <DebugBadge component="CycleConsistencyCard" embedded />
    </div>
  );
};

export default CycleConsistencyCard;
