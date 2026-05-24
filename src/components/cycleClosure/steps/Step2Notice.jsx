/**
 * Step2Notice.jsx — Etapa 2: Qualitative Pattern Review
 *
 * Read-only. Top 3 erros, contagem de eventos comportamentais V2 + execution,
 * curva emocional (dias tilt vs limpos), correlação tilt vs clean days.
 *
 * Pipeline (issue #259 R2):
 *   orders + trades → detectExecutionEvents → executionEvents[]
 *   trades + executionEvents → analyzeEmotionsV2 → tilt/revenge/overtrading
 *   eventos → counts agregados → patterns exposto ao draft
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, Smile, Frown, BarChart3 } from 'lucide-react';
import { useTrades } from '../../../hooks/useTrades';
import useOrders from '../../../hooks/useOrders';
import { topErrors, topUnifiedErrors } from '../../../utils/cycleClosure/cycleMetrics';
import { analyzeEmotionsV2 } from '../../../utils/emotionalAnalysisV2';
import { detectExecutionEvents, EVENT_TYPES } from '../../../utils/executionBehaviorEngine';
import useMasterData from '../../../hooks/useMasterData';

const isInRange = (date, start, end) => date >= start && date <= end;

function StatChip({ label, value, tone = 'slate' }) {
  const map = {
    slate: 'bg-slate-700/40 text-slate-300',
    amber: 'bg-amber-500/20 text-amber-300',
    red:   'bg-red-500/20 text-red-300',
    emerald: 'bg-emerald-500/20 text-emerald-300',
  };
  return (
    <div className={`rounded-lg px-3 py-2 text-xs font-medium ${map[tone] || map.slate}`}>
      <span className="text-[10px] uppercase tracking-wider opacity-70 block">{label}</span>
      <span className="text-base font-bold">{value}</span>
    </div>
  );
}

export default function Step2Notice({ studentId, planId, cycleStart, cycleEnd, onPatterns }) {
  const { trades = [], loading } = useTrades(studentId);
  const { orders = [] } = useOrders(studentId);
  const { getEmotionConfig } = useMasterData();

  const cycleTrades = useMemo(
    () => trades.filter((t) => t.planId === planId && t.date && isInRange(t.date, cycleStart, cycleEnd)),
    [trades, planId, cycleStart, cycleEnd],
  );

  const cycleOrders = useMemo(
    () => orders.filter((o) => o.planId === planId),
    [orders, planId],
  );

  // Execution events — STOP_TAMPERING, RAPID_REENTRY_POST_STOP, HESITATION, etc.
  // Sem isso, tilt/revenge ficam só com sinal de losses sequenciais — perde os padrões críticos.
  const executionEvents = useMemo(() => {
    if (cycleTrades.length === 0) return [];
    try {
      return detectExecutionEvents({ trades: cycleTrades, orders: cycleOrders });
    } catch (e) {
      console.warn('[Step2Notice] erro ao detectar execution events:', e);
      return [];
    }
  }, [cycleTrades, cycleOrders]);

  const top3 = useMemo(() => topErrors(cycleTrades, 3), [cycleTrades]);

  const emotionalAnalysis = useMemo(() => {
    if (cycleTrades.length === 0) return null;
    try {
      return analyzeEmotionsV2(cycleTrades, getEmotionConfig, undefined, { executionEvents });
    } catch (e) {
      console.warn('[Step2Notice] erro ao analisar emoções:', e);
      return null;
    }
  }, [cycleTrades, getEmotionConfig, executionEvents]);

  // Buckets por dia (resultado financeiro)
  const tradesByDay = useMemo(() => {
    const buckets = new Map();
    for (const t of cycleTrades) {
      if (!t.date) continue;
      if (!buckets.has(t.date)) buckets.set(t.date, { date: t.date, trades: [] });
      buckets.get(t.date).trades.push(t);
    }
    return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [cycleTrades]);

  // Contadores agregados por tipo de execution event
  const executionCounts = useMemo(() => {
    const acc = {
      stopTampering: 0, partialSizing: 0, rapidReentry: 0,
      hesitationPreEntry: 0, chaseReentry: 0, breakevenTooEarly: 0, stopHesitation: 0,
    };
    for (const ev of executionEvents) {
      switch (ev.type) {
        case EVENT_TYPES.STOP_TAMPERING:           acc.stopTampering++; break;
        case EVENT_TYPES.STOP_PARTIAL_SIZING:      acc.partialSizing++; break;
        case EVENT_TYPES.RAPID_REENTRY_POST_STOP:  acc.rapidReentry++; break;
        case EVENT_TYPES.HESITATION_PRE_ENTRY:     acc.hesitationPreEntry++; break;
        case EVENT_TYPES.CHASE_REENTRY:            acc.chaseReentry++; break;
        case EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY: acc.breakevenTooEarly++; break;
        case EVENT_TYPES.STOP_HESITATION:          acc.stopHesitation++; break;
        default: break;
      }
    }
    return acc;
  }, [executionEvents]);

  // Datas com tilt/revenge — usado pra cruzar com dias e medir custo emocional
  const tiltDates = useMemo(() => {
    const set = new Set();
    if (emotionalAnalysis?.tilt?.sequences) {
      for (const seq of emotionalAnalysis.tilt.sequences) {
        if (Array.isArray(seq.trades)) {
          for (const t of seq.trades) if (t.date) set.add(t.date);
        }
      }
    }
    return set;
  }, [emotionalAnalysis]);

  const revengeDates = useMemo(() => {
    const set = new Set();
    if (emotionalAnalysis?.revenge?.instances) {
      for (const inst of emotionalAnalysis.revenge.instances) {
        const t = inst.trade || inst.triggerTrade;
        if (t?.date) set.add(t.date);
      }
    }
    return set;
  }, [emotionalAnalysis]);

  // Cleanest sequence + best day (insumos pra B2 Opportunities)
  const dayBreakdown = useMemo(() => {
    const clean = [];
    const dirty = [];
    let bestCleanDay = null;
    let bestCleanPnl = -Infinity;
    let cleanPnlSum = 0;
    let dirtyPnlSum = 0;
    for (const day of tradesByDay) {
      const pnl = day.trades.reduce((s, t) => s + (typeof t.result === 'number' ? t.result : 0), 0);
      const isDirty = tiltDates.has(day.date) || revengeDates.has(day.date);
      if (isDirty) {
        dirty.push({ date: day.date, pnl, trades: day.trades.length });
        dirtyPnlSum += pnl;
      } else {
        clean.push({ date: day.date, pnl, trades: day.trades.length });
        cleanPnlSum += pnl;
        if (pnl > bestCleanPnl) { bestCleanPnl = pnl; bestCleanDay = { date: day.date, pnl, trades: day.trades.length }; }
      }
    }
    return { cleanDays: clean, dirtyDays: dirty, bestCleanDay, cleanPnl: cleanPnlSum, dirtyPnl: dirtyPnlSum };
  }, [tradesByDay, tiltDates, revengeDates]);

  // Contagens centrais (consumidas por B2/B3/B4 via patterns no draft)
  const eventCounts = useMemo(() => ({
    tilt: emotionalAnalysis?.tilt?.sequences?.length ?? 0,
    tiltDaysCount: tiltDates.size,
    revenge: emotionalAnalysis?.revenge?.instances?.length ?? 0,
    revengeDaysCount: revengeDates.size,
    overtrading: emotionalAnalysis?.overtrading?.days?.filter((d) => d.isExceeded).length ?? 0,
    overtradingWarnings: emotionalAnalysis?.overtrading?.days?.filter((d) => d.isWarning && !d.isExceeded).length ?? 0,
    stopTampering: executionCounts.stopTampering,
    rapidReentry: executionCounts.rapidReentry,
    hesitation: executionCounts.hesitationPreEntry + executionCounts.stopHesitation,
    chaseReentry: executionCounts.chaseReentry,
    breakevenTooEarly: executionCounts.breakevenTooEarly,
    partialSizing: executionCounts.partialSizing,
  }), [emotionalAnalysis, tiltDates, revengeDates, executionCounts]);

  // Lista unificada (compliance violations + behavioral events) — autoridade pro
  // que a UI rotula como "erros do ciclo". `top3` permanece pra preservar
  // semântica de downstream (swotHeuristics filtra só violations declaradas).
  const unifiedTop = useMemo(
    () => topUnifiedErrors(cycleTrades, eventCounts, 5),
    [cycleTrades, eventCounts],
  );

  // Correlação dias tilt × dias limpos (custo emocional)
  const correlation = useMemo(() => ({
    performanceOnTiltDays: dayBreakdown.dirtyPnl,
    performanceOnCleanDays: dayBreakdown.cleanPnl,
    tiltDaysCount: dayBreakdown.dirtyDays.length,
    cleanDaysCount: dayBreakdown.cleanDays.length,
  }), [dayBreakdown]);

  const patterns = useMemo(() => ({
    topErrors: top3.map((e) => e.type),
    unifiedErrors: unifiedTop,
    eventCounts,
    executionEvents: executionEvents.map((e) => ({
      type: e.type, severity: e.severity, tradeId: e.tradeId, timestamp: e.timestamp,
    })),
    emotional: { avg: null, peak: null, valley: null },
    correlation,
    dayBreakdown: {
      cleanDays: dayBreakdown.cleanDays,
      dirtyDays: dayBreakdown.dirtyDays,
      bestCleanDay: dayBreakdown.bestCleanDay,
    },
    bestTradeId: null,
    worstTradeId: null,
  }), [top3, unifiedTop, eventCounts, executionEvents, correlation, dayBreakdown]);

  useEffect(() => {
    if (cycleTrades.length > 0) onPatterns?.(patterns);
  }, [patterns, cycleTrades.length, onPatterns]);

  if (loading) {
    return <div className="glass-card p-8 text-center text-slate-400">Carregando padrões...</div>;
  }

  if (cycleTrades.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-slate-300 font-semibold">Sem trades, sem padrões.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-1">Padrões observados</h3>
        <p className="text-sm text-slate-400">
          Auto-detectado dos motores Compliance V2 + Emotional V2 + Execution Behavior.
          {cycleOrders.length === 0 && (
            <span className="block text-[11px] text-amber-300/80 mt-1">
              ⚠ Sem orders ingestadas neste plano — STOP_TAMPERING e RAPID_REENTRY não puderam ser detectados (ingestão por CSV é pré-requisito).
            </span>
          )}
        </p>
      </div>

      {/* Erros do ciclo — lista unificada: compliance violations + eventos comportamentais.
          Comportamento repetido sob pressão (revenge, overtrading) pesa igual a regra escrita. */}
      <section>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Erros do ciclo
        </h4>
        {unifiedTop.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Nenhum erro detectado neste ciclo.</p>
        ) : (
          <div className="space-y-1.5">
            {unifiedTop.map((e, idx) => (
              <div key={`${e.source}-${e.type}`} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-2.5">
                <span className="text-sm text-slate-200 flex items-center gap-2">
                  <span className="text-slate-500">#{idx + 1}</span>
                  {e.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${e.source === 'compliance' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    {e.source === 'compliance' ? 'regra' : 'comportamento'}
                  </span>
                </span>
                <span className="badge badge-amber text-[10px]">×{e.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Event counts — comportamental + execução */}
      <section>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Eventos comportamentais
        </h4>
        <div className="grid grid-cols-4 gap-3">
          <StatChip label="Tilt"               value={eventCounts.tilt}              tone={eventCounts.tilt > 0 ? 'red' : 'slate'} />
          <StatChip label="Vingança"           value={eventCounts.revenge}           tone={eventCounts.revenge > 0 ? 'red' : 'slate'} />
          <StatChip label="Excesso de trades"  value={eventCounts.overtrading}       tone={eventCounts.overtrading > 0 ? 'amber' : 'slate'} />
          <StatChip label="Stop deslocado"     value={eventCounts.stopTampering}     tone={eventCounts.stopTampering > 0 ? 'red' : 'slate'} />
        </div>
        {(eventCounts.rapidReentry > 0 || eventCounts.hesitation > 0 || eventCounts.chaseReentry > 0 || eventCounts.breakevenTooEarly > 0) && (
          <div className="grid grid-cols-4 gap-3 mt-2">
            <StatChip label="Reentrada pós-stop" value={eventCounts.rapidReentry}    tone={eventCounts.rapidReentry > 0 ? 'red' : 'slate'} />
            <StatChip label="Perseguição preço"  value={eventCounts.chaseReentry}    tone={eventCounts.chaseReentry > 0 ? 'amber' : 'slate'} />
            <StatChip label="Hesitação"          value={eventCounts.hesitation}      tone={eventCounts.hesitation > 0 ? 'amber' : 'slate'} />
            <StatChip label="Breakeven cedo"     value={eventCounts.breakevenTooEarly} tone={eventCounts.breakevenTooEarly > 0 ? 'amber' : 'slate'} />
          </div>
        )}
      </section>

      {/* Correlação tilt vs clean */}
      <section>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          {correlation.performanceOnTiltDays < 0 ? <Frown className="w-4 h-4" /> : <Smile className="w-4 h-4" />}
          Custo emocional do ciclo
        </h4>
        {correlation.tiltDaysCount === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Sem dias em tilt/vingança — resultado dos {correlation.cleanDaysCount} dias limpos:{' '}
            <span className={`mono font-semibold ${correlation.performanceOnCleanDays >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {correlation.performanceOnCleanDays >= 0 ? '+' : ''}R$ {correlation.performanceOnCleanDays.toFixed(0)}
            </span>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/30 rounded-xl p-3 border border-red-500/20">
              <p className="text-[11px] text-slate-500 mb-1">Em dias com tilt/vingança ({correlation.tiltDaysCount})</p>
              <p className={`text-xl font-bold mono ${correlation.performanceOnTiltDays >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {correlation.performanceOnTiltDays >= 0 ? '+' : ''}R$ {correlation.performanceOnTiltDays.toFixed(0)}
              </p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-3 border border-emerald-500/20">
              <p className="text-[11px] text-slate-500 mb-1">Em dias limpos ({correlation.cleanDaysCount})</p>
              <p className={`text-xl font-bold mono ${correlation.performanceOnCleanDays >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {correlation.performanceOnCleanDays >= 0 ? '+' : ''}R$ {correlation.performanceOnCleanDays.toFixed(0)}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
