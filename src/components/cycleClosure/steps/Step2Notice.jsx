/**
 * Step2Notice.jsx — Etapa 2: Qualitative Pattern Review
 *
 * Read-only. Top 3 erros, contagem de eventos comportamentais V2,
 * curva emocional (avg/peak/valley), correlação tilt vs clean days.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, Smile, Frown, BarChart3 } from 'lucide-react';
import { useTrades } from '../../../hooks/useTrades';
import { topErrors } from '../../../utils/cycleClosure/cycleMetrics';
import { analyzeEmotionsV2 } from '../../../utils/emotionalAnalysisV2';
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
  const { getEmotionConfig } = useMasterData();

  const cycleTrades = useMemo(
    () => trades.filter((t) => t.planId === planId && t.date && isInRange(t.date, cycleStart, cycleEnd)),
    [trades, planId, cycleStart, cycleEnd],
  );

  const top3 = useMemo(() => topErrors(cycleTrades, 3), [cycleTrades]);

  const emotionalAnalysis = useMemo(() => {
    if (cycleTrades.length === 0) return null;
    try {
      return analyzeEmotionsV2(cycleTrades, getEmotionConfig);
    } catch (e) {
      console.warn('[Step2Notice] erro ao analisar emoções:', e);
      return null;
    }
  }, [cycleTrades, getEmotionConfig]);

  // Curva emocional simplificada por dia
  const emotionalByDay = useMemo(() => {
    const buckets = new Map();
    for (const t of cycleTrades) {
      if (!t.date) continue;
      if (!buckets.has(t.date)) buckets.set(t.date, { date: t.date, results: [], scores: [] });
      buckets.get(t.date).results.push(typeof t.result === 'number' ? t.result : 0);
    }
    const days = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
    return days;
  }, [cycleTrades]);

  // Eventos por tipo (aggregação)
  const eventCounts = useMemo(() => {
    if (!emotionalAnalysis) return { tilt: 0, revenge: 0, overtrading: 0, stopTampering: 0 };
    return {
      tilt: emotionalAnalysis.tilt?.events?.length ?? 0,
      revenge: emotionalAnalysis.revenge?.events?.length ?? 0,
      overtrading: emotionalAnalysis.overtrading?.events?.length ?? 0,
      stopTampering: 0,    // execution sensors integram em A5+ se necessário
    };
  }, [emotionalAnalysis]);

  // Correlação simples: result em dias com tilt vs sem
  const correlation = useMemo(() => {
    if (!emotionalAnalysis?.tilt?.events?.length) {
      return {
        performanceOnTiltDays: 0,
        performanceOnCleanDays: cycleTrades.reduce((s, t) => s + (typeof t.result === 'number' ? t.result : 0), 0),
        tiltDaysCount: 0,
        cleanDaysCount: emotionalByDay.length,
      };
    }
    const tiltDates = new Set(emotionalAnalysis.tilt.events.map((e) => e.date));
    let onTilt = 0, onClean = 0, tiltDays = 0, cleanDays = 0;
    for (const day of emotionalByDay) {
      const dayResult = day.results.reduce((s, v) => s + v, 0);
      if (tiltDates.has(day.date)) { onTilt += dayResult; tiltDays++; }
      else { onClean += dayResult; cleanDays++; }
    }
    return {
      performanceOnTiltDays: onTilt,
      performanceOnCleanDays: onClean,
      tiltDaysCount: tiltDays,
      cleanDaysCount: cleanDays,
    };
  }, [emotionalAnalysis, emotionalByDay]);

  const patterns = useMemo(() => ({
    topErrors: top3.map((e) => e.type),
    eventCounts,
    emotional: {
      avg: null,         // calculado por daily score; deferido pra A5.x quando integrarmos
      peak: null,
      valley: null,
    },
    correlation,
    bestTradeId: null,
    worstTradeId: null,
  }), [top3, eventCounts, correlation]);

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
        <p className="text-sm text-slate-400">Auto-detectado dos motores Compliance V2 + Emotional V2.</p>
      </div>

      {/* Top errors */}
      <section>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Top 3 erros do ciclo
        </h4>
        {top3.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Nenhuma violação registrada — limpo.</p>
        ) : (
          <div className="space-y-1.5">
            {top3.map((e, idx) => (
              <div key={e.type} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-2.5">
                <span className="text-sm text-slate-200">
                  <span className="text-slate-500 mr-2">#{idx + 1}</span>
                  {e.type}
                </span>
                <span className="badge badge-amber text-[10px]">{e.count}×</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Event counts */}
      <section>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Eventos comportamentais
        </h4>
        <div className="grid grid-cols-4 gap-3">
          <StatChip label="TILT" value={eventCounts.tilt} tone={eventCounts.tilt > 0 ? 'red' : 'slate'} />
          <StatChip label="REVENGE" value={eventCounts.revenge} tone={eventCounts.revenge > 0 ? 'red' : 'slate'} />
          <StatChip label="OVERTRADING" value={eventCounts.overtrading} tone={eventCounts.overtrading > 0 ? 'amber' : 'slate'} />
          <StatChip label="STOP TAMPER" value={eventCounts.stopTampering} tone={eventCounts.stopTampering > 0 ? 'amber' : 'slate'} />
        </div>
      </section>

      {/* Correlação tilt vs clean */}
      <section>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          {correlation.performanceOnTiltDays < 0 ? <Frown className="w-4 h-4" /> : <Smile className="w-4 h-4" />}
          Custo emocional do ciclo
        </h4>
        {correlation.tiltDaysCount === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Sem dias detectados em TILT — performance dos {correlation.cleanDaysCount} dias clean: {' '}
            <span className={`mono font-semibold ${correlation.performanceOnCleanDays >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {correlation.performanceOnCleanDays >= 0 ? '+' : ''}R$ {correlation.performanceOnCleanDays.toFixed(0)}
            </span>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/30 rounded-xl p-3 border border-red-500/20">
              <p className="text-[11px] text-slate-500 mb-1">Em dias com TILT ({correlation.tiltDaysCount})</p>
              <p className={`text-xl font-bold mono ${correlation.performanceOnTiltDays >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {correlation.performanceOnTiltDays >= 0 ? '+' : ''}R$ {correlation.performanceOnTiltDays.toFixed(0)}
              </p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-3 border border-emerald-500/20">
              <p className="text-[11px] text-slate-500 mb-1">Em dias clean ({correlation.cleanDaysCount})</p>
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
