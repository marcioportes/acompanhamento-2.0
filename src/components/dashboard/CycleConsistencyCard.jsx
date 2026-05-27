/**
 * CycleConsistencyCard
 * @version 1.0.0 (v1.54.0 — issue #235 F2.2)
 * @description Card "Consistência Operacional" do StudentDashboard. Substitui
 *   CV puro + ΔT W/L (que confundiam concentração/estabilidade/aderência) por
 *   4 métricas científicas: Sharpe per-ciclo (Selic descontada), CV normalizado
 *   (cv_obs / cv_exp(plan.rrTarget, WR)), MEP médio e MEN médio em % por entry.
 *
 *   Spec / mockup: docs/dev/issues/issue-235-cycle-consistency-redesign.md
 *   Hook orquestrador: src/hooks/useCycleConsistency.js (commit 10b941ec)
 *
 *   ΔT W/L removido (sem substituto direto no novo modelo). Tempo medio geral
 *   preservado como sub-linha (info universal, sem indicadores de tempo
 *   ainda assertivos pro aluno — DEC-AUTO-235-T09-B revisada em review).
 */
/* eslint-disable react/prop-types */

import { Activity, Clock } from 'lucide-react';
import { useCycleConsistency } from '../../hooks/useCycleConsistency';
import DebugBadge from '../DebugBadge';
import {
  MetricTile,
  sharpeContent, cvContent, mepContent, menContent,
  buildSharpeTooltip, buildCvTooltip, MEP_TOOLTIP, MEN_TOOLTIP,
} from '../metrics/cycleMetricTiles';

const MONTH_PT_BR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function deriveCycleLabel(cycleStart) {
  if (typeof cycleStart !== 'string' || cycleStart.length < 7) return null;
  const m = /^(\d{4})-(\d{2})/.exec(cycleStart);
  if (!m) return null;
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  return `${MONTH_PT_BR[monthIdx]}/${m[1]}`;
}

function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '-';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function classifyDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  if (minutes < 5) return { label: 'Scalping', color: 'text-purple-400' };
  if (minutes <= 60) return { label: 'Day Trade', color: 'text-blue-400' };
  return { label: 'Swing', color: 'text-emerald-400' };
}

function deltaTTheme(level) {
  if (level === 'winners-run') return { text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Winners run' };
  if (level === 'neutral') return { text: 'text-amber-400', dot: 'bg-amber-400', label: 'Equilibrado' };
  if (level === 'holding-losses') return { text: 'text-red-400', dot: 'bg-red-400', label: 'Segura loss' };
  return { text: 'text-slate-500', dot: 'bg-slate-500', label: '-' };
}

function deltaTTooltip(level, deltaPercent) {
  if (level === 'winners-run') {
    return `Você segura ganhos e corta perdas (W ${Math.abs(deltaPercent).toFixed(0)}% mais longos que L) — comportamento saudável.`;
  }
  if (level === 'neutral') {
    return `Tempos de W e L similares (delta ${deltaPercent.toFixed(0)}%). Sem padrão claro de gestão em posição.`;
  }
  if (level === 'holding-losses') {
    return `Você segura losses (W ${Math.abs(deltaPercent).toFixed(0)}% mais curtos que L) — corta ganho cedo, espera loss virar. Padrão clássico de aversão à perda.`;
  }
  return 'Precisa de wins e losses com duração registrada.';
}

const CycleConsistencyCard = ({ trades, plan, cycleStart, cycleEnd, cycleLabel, opts, avgTradeDuration, durationDelta }) => {
  const state = useCycleConsistency({ trades, plan, cycleStart, cycleEnd, opts });
  const { sharpe, cvNormalized, avgExcursion, loading, error } = state;

  const label = cycleLabel ?? deriveCycleLabel(cycleStart);

  const sharpeView = sharpeContent(sharpe, opts ?? {});
  const cvView = cvContent(cvNormalized);
  const mepView = mepContent(avgExcursion);
  const menView = menContent(avgExcursion);

  return (
    <div className="glass-card p-5 relative h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Consistencia Operacional
          </span>
          {label && (
            <span className="text-[11px] text-slate-600 normal-case">· {label}</span>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-400/80">Não foi possível carregar métricas do ciclo</p>
      ) : loading ? (
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="cycle-consistency-skeleton">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-slate-700/30 rounded animate-pulse" />
              <div className="h-7 bg-slate-700/30 rounded animate-pulse" />
              <div className="h-3 bg-slate-700/30 rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricTile
              label="Sharpe"
              value={sharpeView.value}
              theme={sharpeView.theme}
              bandLabel={sharpeView.bandLabel}
              badge={sharpeView.badge}
              tooltip={buildSharpeTooltip(sharpe, label)}
              isInsufficient={!!sharpeView.valueClassName}
            />
            <MetricTile
              label="CV norm."
              value={cvView.value}
              theme={cvView.theme}
              bandLabel={cvView.bandLabel}
              tooltip={buildCvTooltip(cvNormalized, plan)}
              isInsufficient={!!cvView.valueClassName}
            />
            <MetricTile
              label="MEP médio"
              value={mepView.value}
              theme={mepView.theme}
              caption="por entry"
              tooltip={MEP_TOOLTIP}
              isInsufficient={!!mepView.valueClassName}
            />
            <MetricTile
              label="MEN médio"
              value={menView.value}
              theme={menView.theme}
              caption="por entry"
              tooltip={MEN_TOOLTIP}
              isInsufficient={!!menView.valueClassName}
            />
          </div>

          {durationDelta && (() => {
            const t = deltaTTheme(durationDelta.level);
            const dPct = durationDelta.deltaPercent;
            const sign = dPct >= 0 ? '+' : '';
            return (
              <div className="border-t border-slate-700/30 mt-4 pt-3" title={deltaTTooltip(durationDelta.level, dPct)}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Tempo W vs L</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-bold font-mono ${t.text}`}>{sign}{dPct.toFixed(0)}%</span>
                    <span className={`text-[10px] font-bold ${t.text}`}>{t.label}</span>
                    <span className={`w-2 h-2 rounded-full ${t.dot}`} aria-hidden="true" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                  <span>W: <span className="font-mono text-emerald-400/80">{formatDuration(durationDelta.durationWin)}</span></span>
                  <span className="text-slate-700">·</span>
                  <span>L: <span className="font-mono text-red-400/80">{formatDuration(durationDelta.durationLoss)}</span></span>
                </div>
              </div>
            );
          })()}

          {avgExcursion?.coverageBelowThreshold && avgExcursion.coverageLabel && (
            <p className="text-[10px] text-amber-400/80 mt-3">
              {avgExcursion.coverageLabel}
            </p>
          )}
        </div>
      )}

      {(() => {
        const allMin = avgTradeDuration?.all;
        const klass = classifyDuration(allMin);
        if (!klass) return null;
        return (
          <div className="border-t border-slate-700/50 mt-4 pt-3">
            <div className="flex items-center gap-3 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500">Tempo medio geral:</span>
              <span className={`font-bold ${klass.color}`}>{formatDuration(allMin)}</span>
              <span className={`px-1.5 py-0.5 rounded ${klass.color} bg-slate-800/50`}>
                {klass.label}
              </span>
            </div>
          </div>
        );
      })()}

      <DebugBadge component="CycleConsistencyCard" embedded />
    </div>
  );
};

export default CycleConsistencyCard;
