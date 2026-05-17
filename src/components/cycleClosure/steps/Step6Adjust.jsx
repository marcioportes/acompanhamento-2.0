/**
 * Step6Adjust.jsx — Etapa 6: Plan Adjustment (Kelly + MC + IA stub)
 *
 * Coração matemático do ritual. Calcula Kelly real, Monte Carlo bootstrap, IA stub
 * recommendation. Aluno escolhe: Aceitar / Editar manualmente / Manter.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Edit3, MinusCircle, CheckCircle, Zap, BarChart2, AlertOctagon } from 'lucide-react';
import { useTrades } from '../../../hooks/useTrades';
import { usePlans } from '../../../hooks/usePlans';
import { computeKelly } from '../../../utils/cycleClosure/kellyCalculator';
import { projectNextCycle } from '../../../utils/cycleClosure/monteCarlo';
import { advisePlanAdjustment } from '../../../utils/cycleClosure/closurePlanAdvisor';

const isInRange = (date, start, end) => date >= start && date <= end;

function fmtPct(v, digits = 2) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}
function fmtR(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
}

function McHistogram({ mc }) {
  // Histograma simples baseado nos percentis (16 bars)
  if (!mc || mc.reason) return null;
  const { p10, p50, p90, min, max } = mc;
  // Distribuição estilizada — não temos os outcomes brutos, mas mostramos a "forma"
  const bars = 17;
  return (
    <div>
      <div className="flex items-end h-16 mb-1">
        {Array.from({ length: bars }, (_, i) => {
          const dist = Math.abs(i - bars / 2) / (bars / 2);
          const h = Math.max(8, Math.round((1 - dist * 0.95) * 100));
          const isPeak = Math.abs(i - bars / 2) < 1.5;
          const isTail = dist > 0.7;
          const cls = isPeak ? 'bg-blue-500' : isTail ? 'bg-red-500/40' : 'bg-blue-500/50';
          return <span key={i} className={`inline-block w-2 mr-px rounded-t ${cls}`} style={{ height: `${h}%` }} />;
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 mono">
        <span>p10 {fmtPct((p10 / 1000) * 100, 1)}</span>
        <span>p50 {fmtPct((p50 / 1000) * 100, 1)}</span>
        <span>p90 {fmtPct((p90 / 1000) * 100, 1)}</span>
      </div>
    </div>
  );
}

export default function Step6Adjust({
  studentId,
  planId,
  cycleStart,
  cycleEnd,
  metrics,
  snapshot,
  patterns,
  forward,
  maturityRegression,
  onChange,
}) {
  const { trades = [] } = useTrades(studentId);
  const { plans = [] } = usePlans(studentId);
  const plan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId]);

  const cycleTrades = useMemo(
    () => trades.filter((t) => t.planId === planId && t.date && isInRange(t.date, cycleStart, cycleEnd)),
    [trades, planId, cycleStart, cycleEnd],
  );

  // Pool pra Kelly: histórico do plano (max útil)
  const planTrades = useMemo(
    () => trades.filter((t) => t.planId === planId).slice(-200),
    [trades, planId],
  );

  const kelly = useMemo(() => computeKelly(planTrades, plan), [planTrades, plan]);

  const mc = useMemo(
    () => projectNextCycle({
      priorCycleTrades: cycleTrades,
      allTrades: planTrades,
      nPerSim: cycleTrades.length || 18,
      options: { nSims: 1000 },
    }),
    [cycleTrades, planTrades],
  );

  const advice = useMemo(
    () => advisePlanAdjustment({
      kelly,
      cycleMetrics: metrics,
      maxDDPercent: metrics?.maxDrawdown?.percent,
      ruleAdherenceRate: metrics?.ruleAdherenceRate,
      currentPlan: plan ? {
        pl: plan.pl, riskPerOperation: plan.riskPerOperation,
        rrTarget: plan.rrTarget, cycleStop: plan.cycleStop,
      } : null,
      regression: maturityRegression || [],
      behavioralCounts: patterns?.eventCounts || {},
      stopBreach: snapshot?.stopBreach || null,
      snapshotPlEnd: snapshot?.plEnd,
      cycleResultPct: snapshot?.resultPercent,
    }),
    [kelly, metrics, plan, maturityRegression, patterns, snapshot],
  );

  const isCritical = advice.triggeredRule === 'pause_restructure';
  const baseCapital = advice.baseCapital ?? plan?.pl;

  // Snapshot info no draft.forward
  useEffect(() => {
    if (!plan) return;
    onChange({
      ...forward,
      kellyRecommendation: kelly && kelly.reason === null ? {
        edge: kelly.edge, variance: kelly.variance,
        kellyFull: kelly.kellyFull, kellySafe: kelly.kellySafe,
      } : null,
      mcSimulation: mc && mc.reason === null ? {
        samplePool: mc.samplePool, samplePoolSize: mc.samplePoolSize, n: mc.nSims,
        p10: mc.p10, p50: mc.p50, p90: mc.p90,
      } : null,
      aiSuggestion: {
        newPl: advice.newPl, newRisk: advice.newRiskPerOp, newRRTarget: advice.newRRTarget,
        newRiskRS: advice.newRiskRS, baseCapital: advice.baseCapital,
        rationale: advice.rationale, risks: advice.risks,
        triggeredRule: advice.triggeredRule, notifyMentor: advice.notifyMentor,
        source: advice.source,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelly, mc, advice, plan]);

  const [editing, setEditing] = useState(false);
  const [editPl, setEditPl] = useState('');
  const [editRisk, setEditRisk] = useState('');
  const [editRR, setEditRR] = useState('');

  const startEdit = () => {
    setEditPl(String(plan?.pl ?? ''));
    setEditRisk(String(plan?.riskPerOperation ?? ''));
    setEditRR(String(plan?.rrTarget ?? ''));
    setEditing(true);
  };

  const acceptSuggestion = () => {
    onChange({
      ...forward,
      planAdjustment: {
        changed: !!advice.changed,
        newPl: advice.newPl,
        newRiskPerOp: advice.newRiskPerOp,
        newRRTarget: advice.newRRTarget,
        decisionSource: advice.changed ? 'suggestion_accepted' : 'kept',
      },
    });
  };

  const keepPlan = () => {
    onChange({
      ...forward,
      planAdjustment: {
        changed: false,
        newPl: plan?.pl ?? null,
        newRiskPerOp: plan?.riskPerOperation ?? null,
        newRRTarget: plan?.rrTarget ?? null,
        decisionSource: 'kept',
      },
    });
  };

  const submitEdit = () => {
    const newPl = parseFloat(editPl);
    const newRisk = parseFloat(editRisk);
    const newRR = parseFloat(editRR);
    onChange({
      ...forward,
      planAdjustment: {
        changed: newPl !== plan?.pl || newRisk !== plan?.riskPerOperation || newRR !== plan?.rrTarget,
        newPl: Number.isFinite(newPl) ? newPl : plan?.pl,
        newRiskPerOp: Number.isFinite(newRisk) ? newRisk : plan?.riskPerOperation,
        newRRTarget: Number.isFinite(newRR) ? newRR : plan?.rrTarget,
        decisionSource: 'manual_edit',
      },
    });
    setEditing(false);
  };

  if (!plan) {
    return <div className="glass-card p-8 text-center text-red-300">Plano não encontrado.</div>;
  }

  const decision = forward?.planAdjustment?.decisionSource;

  return (
    <div className="space-y-4">
      {/* Banner crítico — PAUSAR (REGRA 0) */}
      {isCritical && (
        <div className="glass-card p-5 border-2 border-red-500/60 bg-gradient-to-br from-red-500/15 to-red-500/5">
          <div className="flex items-start gap-3">
            <div className="bg-red-500/30 text-red-300 rounded-xl p-2.5 flex-shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <h4 className="text-lg font-bold text-red-200">🚨 PAUSAR antes de operar o próximo ciclo</h4>
                <span className="badge bg-red-500/30 text-red-200 border border-red-500/60 text-[10px]">crítico</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{advice.rationale}</p>
              {advice.risks?.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-red-200/80 pl-4 list-disc">
                  {advice.risks.map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              )}
              <p className="text-[11px] text-red-200/70 mt-3">
                Mentor notificado automaticamente no inbox · você ainda pode editar manualmente abaixo, mas isso fica registrado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Capital base — mostra comparação quando difere */}
      {typeof baseCapital === 'number' && typeof plan?.pl === 'number' && baseCapital !== plan.pl && (
        <div className="glass-card p-4 border border-slate-700/50 bg-slate-800/30">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Capital base para o próximo ciclo</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-2xl font-bold text-slate-100 mono">R$ {baseCapital.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-slate-500">
              capital pré-ciclo R$ {plan.pl.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              {' · '}
              <span className={baseCapital < plan.pl ? 'text-red-400' : 'text-emerald-400'}>
                {baseCapital < plan.pl ? '−' : '+'}{Math.abs(((baseCapital - plan.pl) / plan.pl) * 100).toFixed(1)}%
              </span>
            </p>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            R do próximo ciclo recalculado sobre o saldo real — não sobre o capital inicial do plano.
          </p>
        </div>
      )}

      {/* Kelly + MC */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" /> Risco ótimo (Kelly ¼)
            </h4>
            <span className="badge badge-purple text-[10px]">matemática</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
            Quanto do capital arriscar por trade, calculado do seu histórico. Versão fracionada (¼) — mais conservadora que o Kelly puro.
          </p>
          {kelly.reason ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
              {kelly.reason === 'insufficient_sample' && `Amostra muito pequena (${kelly.sampleSize} trades < 10) — aguarde mais trades.`}
              {kelly.reason === 'no_trades' && 'Sem trades históricos no plano.'}
              {kelly.reason === 'no_plan' && 'Plano sem capital ou risco definido.'}
              {kelly.reason === 'zero_variance' && 'Todos os trades têm o mesmo resultado — amostra suspeita.'}
            </div>
          ) : (
            <>
              <div className="bg-slate-800/40 rounded-lg p-3 mb-3">
                <p className="text-[11px] text-slate-500">Recomendado por trade</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-purple-400 mono">
                    {(kelly.kellySafe * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500">vs atual <span className="mono text-slate-300">{plan.riskPerOperation}%</span></p>
                </div>
                {typeof baseCapital === 'number' && (
                  <p className="text-[11px] text-slate-400 mt-1 mono">
                    R$ {baseCapital.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} × {(kelly.kellySafe * 100).toFixed(1)}% = R$ {Math.round(baseCapital * kelly.kellySafe).toLocaleString('pt-BR')} por trade
                  </p>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mono">
                ganho médio {fmtR(kelly.expectancy_R * 1)} · base de {kelly.sampleSize} trades
              </p>
            </>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-sky-400" /> Simulação do próximo ciclo
            </h4>
            <span className="badge badge-sky text-[10px]">{mc.nSims || '—'} cenários</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
            Projeta milhares de cenários possíveis para o próximo ciclo, sorteando dos seus trades reais. Mostra a faixa esperada de resultado.
          </p>
          {mc.reason ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
              {mc.reason === 'empty_pool' && 'Sem trades suficientes para projetar cenários.'}
              {mc.reason === 'invalid_n_per_sim' && 'Configuração inválida (trades por cenário).'}
            </div>
          ) : (
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-[11px] text-slate-500 mb-2">
                Distribuição (base = {mc.samplePool === 'priorCycle' ? 'ciclo anterior' : 'últimos 100 trades'})
              </p>
              <McHistogram mc={mc} />
              {typeof baseCapital === 'number' && typeof mc.p50 === 'number' && (
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Sobre o capital base R$ {baseCapital.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}:{' '}
                  mediana <span className="text-slate-200 mono">{((mc.p50 / 1000) * 100) >= 0 ? '+' : ''}{((mc.p50 / 1000) * 100).toFixed(1)}%</span>,
                  cenário ruim (p10) <span className="text-red-300 mono">{((mc.p10 / 1000) * 100).toFixed(1)}%</span>,
                  cenário bom (p90) <span className="text-emerald-300 mono">+{((mc.p90 / 1000) * 100).toFixed(1)}%</span>.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* IA suggestion */}
      <div className="glass-card p-6 border border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-blue-500/20 text-blue-400 rounded-xl p-2.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-slate-100">Recomendação para o próximo ciclo</h4>
              <span className="badge badge-purple text-[10px]">heurística v1.58</span>
              <span className="text-[10px] text-slate-600 italic">[em v1.59 vira IA real]</span>
            </div>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              {advice.rationale}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Capital base</p>
                <p className="font-mono text-slate-100">
                  R$ {Math.round(baseCapital ?? plan.pl).toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] text-slate-500">saldo pós-ciclo</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Risco por trade</p>
                <p className="font-mono text-slate-100">
                  {advice.newRiskPerOp ?? plan.riskPerOperation}%
                  {typeof advice.newRiskRS === 'number' && advice.newRiskRS > 0 && (
                    <span className="text-slate-400 text-xs ml-1 mono">· R$ {advice.newRiskRS.toLocaleString('pt-BR')}</span>
                  )}
                  <span className="text-slate-500 text-xs ml-1 block">{advice.changed && advice.newRiskPerOp !== plan.riskPerOperation ? (advice.newRiskPerOp === 0 ? '⛔ pausa' : '↺ alterar') : '→ manter'}</span>
                </p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Vitória vale × perda</p>
                <p className="font-mono text-slate-100">
                  {advice.newRRTarget ?? plan.rrTarget}×
                  <span className="text-slate-500 text-xs ml-1">{advice.changed && advice.newRRTarget !== plan.rrTarget ? '↺' : '→ manter'}</span>
                </p>
              </div>
            </div>

            {advice.risks?.length > 0 && (
              <details>
                <summary className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
                  ⚠️ Riscos identificados ({advice.risks.length})
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-400 pl-4 list-disc">
                  {advice.risks.map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              </details>
            )}
          </div>
        </div>

        {/* Decisão */}
        <div className="border-t border-slate-700/50 pt-4">
          <p className="text-xs text-slate-500 mb-3">Sua decisão:</p>
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Capital (PL)</label>
                  <input value={editPl} onChange={(e) => setEditPl(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white" type="number" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Risco/trade (%)</label>
                  <input value={editRisk} onChange={(e) => setEditRisk(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white" type="number" step="0.1" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">RR alvo</label>
                  <input value={editRR} onChange={(e) => setEditRR(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white" type="number" step="0.1" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitEdit} className="btn-primary text-sm flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Salvar manual
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={acceptSuggestion}
                className={`btn-success text-sm flex items-center justify-center gap-2 ${decision === 'suggestion_accepted' ? 'ring-2 ring-emerald-400/50' : ''}`}
              >
                <CheckCircle className="w-4 h-4" /> Aceitar sugestão
              </button>
              <button
                type="button"
                onClick={startEdit}
                className={`btn-secondary text-sm flex items-center justify-center gap-2 ${decision === 'manual_edit' ? 'ring-2 ring-blue-400/50' : ''}`}
              >
                <Edit3 className="w-4 h-4" /> Editar manualmente
              </button>
              <button
                type="button"
                onClick={keepPlan}
                className={`btn-secondary text-sm flex items-center justify-center gap-2 ${decision === 'kept' ? 'ring-2 ring-slate-400/50' : ''}`}
              >
                <MinusCircle className="w-4 h-4" /> Manter sem aceitar
              </button>
            </div>
          )}

          {decision && (
            <p className="text-[11px] text-slate-500 mt-3 text-right">
              Decisão registrada: <span className="text-slate-300 mono">{decision}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
