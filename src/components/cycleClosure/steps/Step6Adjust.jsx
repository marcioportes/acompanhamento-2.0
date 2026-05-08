/**
 * Step6Adjust.jsx — Etapa 6: Plan Adjustment (Kelly + MC + IA stub)
 *
 * Coração matemático do ritual. Calcula Kelly real, Monte Carlo bootstrap, IA stub
 * recommendation. Aluno escolhe: Aceitar / Editar manualmente / Manter.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Edit3, MinusCircle, CheckCircle, Zap, BarChart2 } from 'lucide-react';
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
    }),
    [kelly, metrics, plan, maturityRegression],
  );

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
        rationale: advice.rationale, risks: advice.risks,
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
      {/* Kelly + MC */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" /> Kelly fraction (Quarter)
            </h4>
            <span className="badge badge-purple text-[10px]">matemática</span>
          </div>
          {kelly.reason ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
              {kelly.reason === 'insufficient_sample' && `Sample n=${kelly.sampleSize} < 10 — esperar mais trades.`}
              {kelly.reason === 'no_trades' && 'Sem trades históricos no plano.'}
              {kelly.reason === 'no_plan' && 'Plano sem capital ou risco definido.'}
              {kelly.reason === 'zero_variance' && 'Variância zero — todos os trades iguais (sample suspeito).'}
            </div>
          ) : (
            <>
              <div className="bg-slate-800/40 rounded-lg p-3 mb-3">
                <p className="text-[11px] text-slate-500">Risco/trade — Quarter-Kelly</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-purple-400 mono">
                    {(kelly.kellySafe * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500">vs atual <span className="mono text-slate-300">{plan.riskPerOperation}%</span></p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mono">
                edge {fmtR(kelly.expectancy_R * 1)} · sample {kelly.sampleSize} trades
              </p>
            </>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-sky-400" /> Monte Carlo — próximo ciclo
            </h4>
            <span className="badge badge-sky text-[10px]">{mc.nSims || '—'} sims</span>
          </div>
          {mc.reason ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
              {mc.reason === 'empty_pool' && 'Sem trades pra bootstrap.'}
              {mc.reason === 'invalid_n_per_sim' && 'Número de trades por simulação inválido.'}
            </div>
          ) : (
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-[11px] text-slate-500 mb-2">
                Distribuição (sample = {mc.samplePool === 'priorCycle' ? 'ciclo anterior' : 'últimos 100'})
              </p>
              <McHistogram mc={mc} />
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
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Capital (PL)</p>
                <p className="font-mono text-slate-100">
                  R$ {(advice.newPl ?? plan.pl).toLocaleString('pt-BR')}
                  <span className="text-slate-500 text-xs ml-1">{advice.changed && advice.newPl !== plan.pl ? '↺' : '→ manter'}</span>
                </p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Risco / trade</p>
                <p className="font-mono text-slate-100">
                  {advice.newRiskPerOp ?? plan.riskPerOperation}%
                  <span className="text-slate-500 text-xs ml-1">{advice.changed && advice.newRiskPerOp !== plan.riskPerOperation ? '↺' : '→ manter'}</span>
                </p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">RR alvo</p>
                <p className="font-mono text-slate-100">
                  {advice.newRRTarget ?? plan.rrTarget}
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
