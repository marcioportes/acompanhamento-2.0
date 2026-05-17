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
  computeStopBreach,
  topErrors,
} from '../../../utils/cycleClosure/cycleMetrics';
import {
  computeTPS,
  computeWinRateConsistency,
  TPS_WEIGHTS,
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

// Tom dos cards de composição da Nota geral (TPS).
// <33% = vermelho (puxa pra baixo), 33–66% = âmbar, ≥66% = verde.
function tpsComponentTone(filled) {
  if (filled === null || filled === undefined) return 'slate';
  if (filled < 0.33) return 'red';
  if (filled < 0.66) return 'amber';
  return 'emerald';
}

function TPSComponentCard({ label, rawValue, ptsGot, ptsMax, filled, hint, missing }) {
  const tone = missing ? 'slate' : tpsComponentTone(filled);
  const toneMap = {
    red:     { border: 'border-red-500/30',     bar: 'bg-red-500',     text: 'text-red-300' },
    amber:   { border: 'border-amber-500/30',   bar: 'bg-amber-500',   text: 'text-amber-300' },
    emerald: { border: 'border-emerald-500/30', bar: 'bg-emerald-500', text: 'text-emerald-300' },
    slate:   { border: 'border-slate-700/40',   bar: 'bg-slate-600',   text: 'text-slate-400' },
  };
  const c = toneMap[tone];
  const pct = missing ? 0 : Math.round(filled * 100);

  return (
    <div className={`bg-slate-800/30 rounded-xl p-3 border ${c.border}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-[11px] text-slate-400 leading-tight">{label}</p>
        <p className={`text-[11px] mono font-semibold ${c.text}`}>
          {missing ? 'sem dado' : `${ptsGot.toFixed(1)}/${ptsMax} pts`}
        </p>
      </div>
      <p className="text-base font-bold text-slate-100 mono mb-2">
        {missing ? '—' : rawValue}
      </p>
      <div className="h-1.5 bg-slate-900/60 rounded-full overflow-hidden">
        <div
          className={`h-full ${c.bar} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!missing && hint && filled < 0.5 && (
        <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{hint}</p>
      )}
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
  const stopBreach = useMemo(() => computeStopBreach(cycleTrades, plan), [cycleTrades, plan]);

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
      stopBreach,
      tradesCount: cycleTrades.length,
      planConfigSnapshot: {
        pl: plan.pl, periodGoal: plan.periodGoal, periodStop: plan.periodStop,
        cycleGoal: plan.cycleGoal, cycleStop: plan.cycleStop,
        operationPeriod: plan.operationPeriod, adjustmentCycle: plan.adjustmentCycle,
        riskPerOperation: plan.riskPerOperation, rrTarget: plan.rrTarget,
      },
    };
  }, [plan, cycleTrades, tradesLoading, stopBreach]);

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
          label="Como terminou"
          primary={
            snapshot?.cycleStatus === 'GOAL_HIT' ? 'Meta batida' :
            snapshot?.cycleStatus === 'STOP_HIT' ? 'Stop atingido' :
            snapshot?.cycleStatus === 'NEUTRAL' ? 'No meio do caminho' :
            '—'
          }
          secondary={
            snapshot?.cycleStatus === 'GOAL_HIT' ? 'você bateu a meta do ciclo' :
            snapshot?.cycleStatus === 'STOP_HIT' ? 'o stop do ciclo foi atingido' :
            'nem meta nem stop foram tocados'
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
        <Activity className="w-4 h-4" /> Como você operou no ciclo
      </h4>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SmallStat
          label="Ganho médio por trade"
          value={metrics.expectancy_R != null ? `${metrics.expectancy_R >= 0 ? '+' : ''}${metrics.expectancy_R.toFixed(2)}R` : '—'}
          secondary={
            metrics.expectancy_R != null && metrics.expectancy_R >= 0.5 ? 'excelente · cada trade rende em média 0,5R+' :
            metrics.expectancy_R >= 0.3 ? 'no alvo · saldo positivo consistente' :
            'abaixo do ideal · ganho médio fraco'
          }
        />
        <SmallStat
          label="Taxa de acerto"
          value={metrics.winRate != null ? formatPct(metrics.winRate * 100) : '—'}
          secondary={`${metrics.winners} vitórias em ${metrics.count} trades`}
        />
        <SmallStat
          label="Ganho médio / Perda média (em R)"
          value={`${metrics.avgWinR != null ? metrics.avgWinR.toFixed(2) : '—'} / ${metrics.avgLossR != null ? metrics.avgLossR.toFixed(2) : '—'}`}
          secondary={metrics.avgLossR && metrics.avgLossR !== 0 ? `vitória vale ${(metrics.avgWinR / Math.abs(metrics.avgLossR)).toFixed(2)}× a perda` : ''}
        />
        <SmallStat
          label="Maior queda do capital"
          value={formatPct(Math.abs(maxDD.percent * 100))}
          secondary={formatBRL(maxDD.value)}
          danger={Math.abs(maxDD.percent) > 0.04}
        />
        <SmallStat
          label="Lucro ÷ Prejuízo"
          value={metrics.profitFactor != null ? metrics.profitFactor.toFixed(2) : '—'}
          secondary={metrics.profitFactor != null
            ? (metrics.profitFactor >= 1.5 ? 'sólido' : metrics.profitFactor >= 1 ? 'no positivo' : 'no negativo')
            : ''}
        />
        <SmallStat
          label="Disciplina (regras respeitadas)"
          value={ruleAdherenceRate != null ? formatPct(ruleAdherenceRate * 100) : '—'}
          secondary={top3Errors.length > 0 ? `${top3Errors.length} tipos de violação` : 'sem violações'}
          danger={ruleAdherenceRate != null && ruleAdherenceRate < 0.9}
        />
      </div>

      {/* Stop breach alert — só renderiza se houve violação */}
      {stopBreach.stopBreachIndex !== -1 && (
        <div className={`rounded-xl p-4 mb-4 border ${
          stopBreach.severity === 'critical' ? 'bg-red-500/10 border-red-500/50' :
          stopBreach.severity === 'major' ? 'bg-red-500/5 border-red-500/30' :
          'bg-amber-500/5 border-amber-500/30'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${
              stopBreach.severity === 'critical' ? 'text-red-400' :
              stopBreach.severity === 'major' ? 'text-red-300' :
              'text-amber-300'
            }`}>
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${
                stopBreach.severity === 'critical' ? 'text-red-300' :
                stopBreach.severity === 'major' ? 'text-red-200' :
                'text-amber-200'
              }`}>
                Stop do ciclo atingido no trade #{stopBreach.stopBreachIndex + 1}
                {stopBreach.tradesAfterStop > 0 && (
                  <> · operou +{stopBreach.tradesAfterStop} trade{stopBreach.tradesAfterStop > 1 ? 's' : ''} depois</>
                )}
              </p>
              <p className="text-[12px] text-slate-300 mt-1">
                Stop planejado: {formatBRL(stopBreach.stopValue)}.{' '}
                {stopBreach.tradesAfterStop === 0
                  ? <>Você respeitou o cap — encerrou no trade do breach. <span className="text-emerald-300">Disciplina firme.</span></>
                  : stopBreach.pnlAfterStop < 0
                    ? <>Resultado dos trades pós-stop: <span className="text-red-300 font-semibold">{formatBRL(stopBreach.pnlAfterStop)}</span>. Continuou queimando capital após cap.</>
                    : <>Resultado dos trades pós-stop: <span className="text-emerald-300 font-semibold">{formatBRL(stopBreach.pnlAfterStop)}</span>. Recuperou parcial mas violou o protocolo.</>}
                {stopBreach.pnlPctOfStop != null && stopBreach.pnlPctOfStop >= 1.2 && (
                  <> Perda final = <span className="text-red-300 font-semibold">{stopBreach.pnlPctOfStop.toFixed(1)}×</span> o stop planejado.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TPS gauge */}
      <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl p-4 border border-blue-500/20">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Nota geral do ciclo</h4>
            <p className="text-[11px] text-slate-500">
              de 0 a 100 · combina lucro÷prejuízo, queda do capital, ganho médio, taxa de acerto e disciplina
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
            ⚠ Faltam dados para: {tps.missing.join(', ')}
          </p>
        )}

        {/* Composição da nota — desdobra os 5 fatores que somam o TPS */}
        {tps.score != null && tps.breakdown && (
          <details className="mt-4 group">
            <summary className="text-[11px] text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 select-none flex items-center gap-1.5">
              <span className="transition group-open:rotate-90 inline-block">▸</span>
              Ver composição (peso de cada fator no total de 100)
            </summary>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
              <TPSComponentCard
                label="Lucro ÷ Prejuízo"
                rawValue={metrics.profitFactor != null ? metrics.profitFactor.toFixed(2) : '—'}
                ptsGot={tps.breakdown.pf * 100}
                ptsMax={TPS_WEIGHTS.profitFactor * 100}
                filled={tps.breakdown.pf / TPS_WEIGHTS.profitFactor}
                missing={tps.missing.includes('profitFactor')}
                hint="ganhos médios menores que perdas — alvo escalonado ou alvo maior"
              />
              <TPSComponentCard
                label="Queda do capital"
                rawValue={`${(Math.abs(maxDD.percent) * 100).toFixed(1)}%`}
                ptsGot={tps.breakdown.dd * 100}
                ptsMax={TPS_WEIGHTS.drawdown * 100}
                filled={tps.breakdown.dd / TPS_WEIGHTS.drawdown}
                missing={tps.missing.includes('maxDDPercent')}
                hint="ficou perto/passou do stop — reduzir size ou parar antes"
              />
              <TPSComponentCard
                label="Ganho médio"
                rawValue={metrics.expectancy_R != null ? `${metrics.expectancy_R >= 0 ? '+' : ''}${metrics.expectancy_R.toFixed(2)}R` : '—'}
                ptsGot={tps.breakdown.exp * 100}
                ptsMax={TPS_WEIGHTS.expectancy * 100}
                filled={tps.breakdown.exp / TPS_WEIGHTS.expectancy}
                missing={tps.missing.includes('expectancy_R')}
                hint="< 0,5R por trade — saiu cedo dos vencedores"
              />
              <TPSComponentCard
                label="Consistência semanal"
                rawValue={`${tpsInput.winRateConsistency.toFixed(2)} (placeholder)`}
                ptsGot={tps.breakdown.consistency * 100}
                ptsMax={TPS_WEIGHTS.consistency * 100}
                filled={tps.breakdown.consistency / TPS_WEIGHTS.consistency}
                missing={tps.missing.includes('winRateConsistency')}
                hint="winrate semanal oscila muito — buscar regime estável"
              />
              <TPSComponentCard
                label="Disciplina (regras)"
                rawValue={ruleAdherenceRate != null ? `${(ruleAdherenceRate * 100).toFixed(1)}%` : '—'}
                ptsGot={tps.breakdown.rule * 100}
                ptsMax={TPS_WEIGHTS.rule * 100}
                filled={tps.breakdown.rule / TPS_WEIGHTS.rule}
                missing={tps.missing.includes('ruleAdherenceRate')}
                hint="violações de RO/RR — gate na entrada antes do envio"
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
              Cards em vermelho puxam a nota pra baixo; em verde, sustentam.
              Soma das contribuições = nota final.
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
