/**
 * Step1Read.jsx — Etapa 1 do Wizard: Snapshot operacional + Quantitative Review
 *
 * Read-only. Auto-popula draft.snapshot e draft.metrics on mount.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useTrades } from '../../../hooks/useTrades';
import { usePlans } from '../../../hooks/usePlans';
import {
  computeCycleMetrics,
  computeRuleAdherenceRate,
  topErrors,
} from '../../../utils/cycleClosure/cycleMetrics';
import {
  computeTPS,
  computeWinRateConsistency,
} from '../../../utils/cycleClosure/tradingPerformanceScore';

const isInRange = (date, start, end) => date >= start && date <= end;

function formatBRL(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function formatPct(v, digits = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

function StatCard({ label, primary, secondary, tone = 'slate' }) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-400' :
    tone === 'red' ? 'text-red-400' :
    tone === 'amber' ? 'text-amber-400' :
    'text-slate-100';
  return (
    <div className="bg-slate-800/30 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold mono ${toneCls}`}>{primary}</p>
      {secondary && <p className="text-xs text-slate-500 mono">{secondary}</p>}
    </div>
  );
}

function SmallStat({ label, value, secondary, danger }) {
  return (
    <div className={`bg-slate-800/30 rounded-xl p-3 ${danger ? 'border border-red-500/30' : ''}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`font-semibold mono ${danger ? 'text-red-400' : 'text-slate-100'}`}>{value}</p>
      {secondary && <p className="text-[10px] text-slate-600">{secondary}</p>}
    </div>
  );
}

export default function Step1Read({ studentId, planId, cycleStart, cycleEnd, onSnapshot, onMetrics }) {
  const { trades = [], loading: tradesLoading } = useTrades(studentId);
  const { plans = [], loading: plansLoading } = usePlans(studentId);

  const plan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId]);

  const cycleTrades = useMemo(
    () => trades.filter((t) => t.planId === planId && t.date && isInRange(t.date, cycleStart, cycleEnd)),
    [trades, planId, cycleStart, cycleEnd],
  );

  const metrics = useMemo(() => computeCycleMetrics(cycleTrades, plan), [cycleTrades, plan]);
  const ruleAdherenceRate = useMemo(() => computeRuleAdherenceRate(cycleTrades), [cycleTrades]);
  const top3Errors = useMemo(() => topErrors(cycleTrades, 3), [cycleTrades]);

  // Snapshot
  const snapshot = useMemo(() => {
    if (!plan || cycleTrades.length === 0 && tradesLoading) return null;
    const plStart = plan.pl ?? null;
    const result = cycleTrades.reduce((s, t) => s + (typeof t.result === 'number' ? t.result : 0), 0);
    const plEnd = plStart != null ? plStart + result : null;
    const resultPercent = plStart && plStart > 0 ? (result / plStart) * 100 : null;
    const goalAchieved = resultPercent != null && plan.cycleGoal != null && resultPercent >= plan.cycleGoal;
    const stopHit = resultPercent != null && plan.cycleStop != null && resultPercent <= -plan.cycleStop;
    const cycleStatus = goalAchieved ? 'GOAL_HIT' : stopHit ? 'STOP_HIT' : 'NEUTRAL';
    return {
      plStart, plEnd, result, resultPercent,
      goalPercent: plan.cycleGoal ?? null,
      stopPercent: plan.cycleStop ?? null,
      cycleStatus,
      tradesCount: cycleTrades.length,
      planConfigSnapshot: {
        pl: plan.pl, periodGoal: plan.periodGoal, periodStop: plan.periodStop,
        cycleGoal: plan.cycleGoal, cycleStop: plan.cycleStop,
        operationPeriod: plan.operationPeriod, adjustmentCycle: plan.adjustmentCycle,
        riskPerOperation: plan.riskPerOperation, rrTarget: plan.rrTarget,
      },
    };
  }, [plan, cycleTrades, tradesLoading]);

  // Drawdown — peak-to-trough simples sobre cumulative result
  const maxDD = useMemo(() => {
    if (cycleTrades.length === 0 || !plan?.pl) return { value: 0, percent: 0 };
    const sorted = [...cycleTrades].sort((a, b) => a.date.localeCompare(b.date));
    let peak = plan.pl;
    let running = plan.pl;
    let worstDD = 0;
    let worstDDPct = 0;
    for (const t of sorted) {
      running += typeof t.result === 'number' ? t.result : 0;
      if (running > peak) peak = running;
      const dd = running - peak;
      const ddPct = peak > 0 ? dd / peak : 0;
      if (dd < worstDD) { worstDD = dd; worstDDPct = ddPct; }
    }
    return { value: worstDD, percent: worstDDPct };
  }, [cycleTrades, plan]);

  // TPS
  const tpsInput = useMemo(() => ({
    profitFactor: metrics.profitFactor,
    maxDDPercent: Math.abs(maxDD.percent),
    expectancy_R: metrics.expectancy_R,
    winRateConsistency: 0.7,    // placeholder — TODO A5.x: bucketize cycleTrades por semana
    ruleAdherenceRate,
  }), [metrics, maxDD, ruleAdherenceRate]);

  const tps = useMemo(() => computeTPS(tpsInput), [tpsInput]);

  // Bubble up to draft (only when ready)
  useEffect(() => {
    if (snapshot) onSnapshot?.(snapshot);
  }, [snapshot, onSnapshot]);

  useEffect(() => {
    if (metrics.count > 0 || metrics.R != null) {
      onMetrics?.({
        ...metrics,
        ruleAdherenceRate,
        topErrors: top3Errors,
        maxDrawdown: { value: maxDD.value, percent: maxDD.percent },
        tradingPerformanceScore: tps.score,
        tpsBreakdown: tps.breakdown,
      });
    }
  }, [metrics, ruleAdherenceRate, top3Errors, maxDD, tps, onMetrics]);

  if (tradesLoading || plansLoading) {
    return <div className="glass-card p-8 text-center text-slate-400">Carregando dados do ciclo...</div>;
  }
  if (!plan) {
    return <div className="glass-card p-8 text-center text-red-300">Plano não encontrado.</div>;
  }
  if (cycleTrades.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-slate-300 font-semibold mb-2">Nenhum trade no ciclo</p>
        <p className="text-sm text-slate-500">
          Ciclo de {cycleStart} a {cycleEnd} sem trades. Não há ritual a fechar.
        </p>
      </div>
    );
  }

  const tone = snapshot?.cycleStatus === 'GOAL_HIT' ? 'emerald' : snapshot?.cycleStatus === 'STOP_HIT' ? 'red' : 'amber';

  return (
    <div className="glass-card p-8">
      <h3 className="text-xl font-bold mb-1">Os números do seu ciclo</h3>
      <p className="text-sm text-slate-400 mb-6">Foto contábil — imutável depois de selada.</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Resultado"
          primary={snapshot && snapshot.resultPercent != null ? `${snapshot.resultPercent >= 0 ? '+' : ''}${snapshot.resultPercent.toFixed(1)}%` : '—'}
          secondary={snapshot ? formatBRL(snapshot.result) : ''}
          tone={tone}
        />
        <StatCard
          label="Status"
          primary={snapshot?.cycleStatus || '—'}
          secondary={
            snapshot?.cycleStatus === 'GOAL_HIT' ? 'meta atingida' :
            snapshot?.cycleStatus === 'STOP_HIT' ? 'stop bateu' :
            'meta não atingida, stop não bateu'
          }
          tone={tone}
        />
        <StatCard
          label="Capital fim"
          primary={snapshot ? formatBRL(snapshot.plEnd) : '—'}
          secondary={snapshot ? `início ${formatBRL(snapshot.plStart)}` : ''}
        />
        <StatCard
          label="Atividade"
          primary={`${cycleTrades.length}`}
          secondary={`trades em ${new Set(cycleTrades.map((t) => t.date)).size} dias`}
        />
      </div>

      <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4" /> Qualidade do edge realizado
      </h4>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SmallStat
          label="Expectancy"
          value={metrics.expectancy_R != null ? `${metrics.expectancy_R >= 0 ? '+' : ''}${metrics.expectancy_R.toFixed(2)}R` : '—'}
          secondary={metrics.expectancy_R != null && metrics.expectancy_R >= 0.5 ? 'excelente' : metrics.expectancy_R >= 0.3 ? 'no alvo' : 'subótimo'}
        />
        <SmallStat
          label="Win rate"
          value={metrics.winRate != null ? formatPct(metrics.winRate * 100) : '—'}
          secondary={`${metrics.winners} / ${metrics.count}`}
        />
        <SmallStat
          label="avgWinR / avgLossR"
          value={`${metrics.avgWinR != null ? metrics.avgWinR.toFixed(2) : '—'} / ${metrics.avgLossR != null ? metrics.avgLossR.toFixed(2) : '—'}`}
          secondary={metrics.avgLossR && metrics.avgLossR !== 0 ? `razão ${(metrics.avgWinR / Math.abs(metrics.avgLossR)).toFixed(2)}` : ''}
        />
        <SmallStat
          label="DD máximo"
          value={formatPct(Math.abs(maxDD.percent * 100))}
          secondary={formatBRL(maxDD.value)}
          danger={Math.abs(maxDD.percent) > 0.04}
        />
        <SmallStat
          label="Profit factor"
          value={metrics.profitFactor != null ? metrics.profitFactor.toFixed(2) : '—'}
        />
        <SmallStat
          label="Rule adherence"
          value={ruleAdherenceRate != null ? formatPct(ruleAdherenceRate * 100) : '—'}
          secondary={top3Errors.length > 0 ? `${top3Errors.length} tipos de violação` : 'limpo'}
          danger={ruleAdherenceRate != null && ruleAdherenceRate < 0.9}
        />
      </div>

      {/* TPS gauge */}
      <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl p-4 border border-blue-500/20">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Trading Performance Score</h4>
            <p className="text-[11px] text-slate-500">
              composite ponderado · PF 20% · DD 25% · Exp 20% · WR 15% · Rule 20%
            </p>
          </div>
          <p className="text-3xl font-bold gradient-text mono">
            {tps.score != null ? Math.round(tps.score) : '—'}
            <span className="text-base text-slate-500">/100</span>
          </p>
        </div>
        <div className="gauge-bar">
          <div
            className="gauge-fill bg-gradient-to-r from-blue-500 to-cyan-400"
            style={{ width: `${tps.score ?? 0}%` }}
          />
        </div>
        {tps.missing.length > 0 && (
          <p className="text-[11px] text-slate-500 mt-2">
            ⚠ Métricas indisponíveis: {tps.missing.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
