/**
 * EmotionAnalysis — Matriz Emocional 4D (issue #164 E3)
 *
 * Agrupa trades por emotionEntry (fallback emotion legado). Cada emoção vira
 * um card com grid 2×2 de micro-KPIs, um por dimensão do framework 4D:
 *   - Financial   → expectancy + payoff
 *   - Operational → shiftRate
 *   - Emotional   → WR e Δ WR (vs globalWR)
 *   - Maturity    → sparkline de PL acumulado (últimos 10 trades da emoção)
 *
 * Rodapé traz insight acionável: prioriza shift rate alto em ofensor,
 * depois melhor performer com payoff, depois WR baixo com Δ positivo, e
 * por fim fallback "seu melhor estado é X".
 */

import React, { useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';
import { buildEmotionMatrix4D } from '../utils/emotionMatrix4D';
import DebugBadge from './DebugBadge';

const fmtSignedCurrency = (v) => (v >= 0 ? `+${formatCurrency(v)}` : formatCurrency(v));
const fmtPct = (v, digits = 0) => `${v >= 0 ? '' : ''}${v.toFixed(digits)}%`;
const fmtSignedPct = (v, digits = 0) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;

const shiftColor = (rate) => {
  if (rate < 20) return 'text-emerald-400';
  if (rate < 40) return 'text-amber-400';
  return 'text-red-400';
};

const Sparkline = ({ series, positive }) => {
  if (!series || series.length === 0) return null;
  const width = 60;
  const height = 24;
  const padding = 2;

  if (series.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        data-testid="emotion-sparkline"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="overflow-visible"
      >
        <polyline
          fill="none"
          stroke={positive ? '#34d399' : '#f87171'}
          strokeWidth="1.5"
          points={`${cx - 4},${cy} ${cx + 4},${cy}`}
        />
      </svg>
    );
  }

  const values = series.map((p) => p.cumPL);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const points = series
    .map((p, i) => {
      const x = padding + (i / (series.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((p.cumPL - min) / range) * (height - 2 * padding);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const zeroY = height - padding - ((0 - min) / range) * (height - 2 * padding);

  return (
    <svg
      data-testid="emotion-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
    >
      <line
        x1={padding}
        x2={width - padding}
        y1={zeroY}
        y2={zeroY}
        stroke="#334155"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      <polyline
        fill="none"
        stroke={positive ? '#34d399' : '#f87171'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
};

const Quadrant = ({ label, children }) => (
  <div className="flex-1 min-w-0">
    <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1 font-semibold">
      {label}
    </p>
    <div className="space-y-0.5 text-xs">{children}</div>
  </div>
);

const KPI = ({ label, value, valueClassName = 'text-slate-200' }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[10px] text-slate-500">{label}</span>
    <span className={`font-mono font-semibold ${valueClassName}`}>{value}</span>
  </div>
);

const buildInsight = (cards) => {
  if (!cards || cards.length === 0) return null;

  // 1. Maior ofensor (totalPL < 0) com shift rate alto (>40%)
  const offenders = cards.filter((c) => c.totalPL < 0).sort((a, b) => a.totalPL - b.totalPL);
  const worstShift = offenders.find((c) => c.shiftRate > 40);
  if (worstShift) {
    return {
      kind: 'shift',
      name: worstShift.name,
      text: (
        <>
          Shift rate alto em <span className="text-red-400 font-bold">{worstShift.name}</span>{' '}
          ({worstShift.shiftRate.toFixed(0)}%) — você entra com uma emoção e sai com outra, e essa
          transição costuma virar perda.
        </>
      ),
    };
  }

  // 2. Melhor performer com payoff ≥ 1.5
  const best = cards[0];
  if (best && best.totalPL > 0 && best.payoff !== null && best.payoff >= 1.5) {
    return {
      kind: 'payoff',
      name: best.name,
      text: (
        <>
          Seu melhor estado é <span className="text-emerald-400 font-bold">{best.name}</span>, com
          payoff {best.payoff.toFixed(1)}x — sustentado por gestão de saída.
        </>
      ),
    };
  }

  // 3. WR baixo (<50%) mas Δ positivo alto (≥10) → "aumentar exposição"
  const undervalued = cards.find(
    (c) => c.wrEmotion < 50 && c.wrDelta !== null && c.wrDelta >= 10 && c.count >= 3,
  );
  if (undervalued) {
    return {
      kind: 'undervalued',
      name: undervalued.name,
      text: (
        <>
          <span className="text-blue-400 font-bold">{undervalued.name}</span> tem WR baixo mas
          excelente vs sua média ({fmtSignedPct(undervalued.wrDelta)}) — pondere aumentar
          exposição.
        </>
      ),
    };
  }

  // 4. Fallback: seu melhor estado é X
  const bestFallback = cards[0];
  return {
    kind: 'fallback',
    name: bestFallback.name,
    text: (
      <>
        Seu melhor estado é <span className="text-emerald-400 font-bold">{bestFallback.name}</span>
        {cards.length > 1 && cards[cards.length - 1].totalPL < 0 && (
          <>
            . Atenção redobrada com{' '}
            <span className="text-red-400 font-bold">{cards[cards.length - 1].name}</span>, que é
            seu maior ofensor
          </>
        )}
        .
      </>
    ),
  };
};

const EmotionAnalysis = ({ trades, globalWR }) => {
  const cards = useMemo(
    () => buildEmotionMatrix4D(trades, { globalWR, sparklineWindow: 10 }),
    [trades, globalWR],
  );

  const insight = useMemo(() => buildInsight(cards), [cards]);

  if (!trades || trades.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500 relative">
        <Brain className="w-12 h-12 mb-3 opacity-20" />
        <p>Sem dados emocionais suficientes.</p>
        <DebugBadge component="EmotionAnalysis" embedded />
      </div>
    );
  }

  return (
    <div className="glass-card p-6 h-full flex flex-col min-h-[350px] relative">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6 flex-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Matriz Emocional 4D</h3>
            <p className="text-xs text-slate-500">
              Financial · Operational · Emotional · Maturity por emoção de entrada
            </p>
          </div>
        </div>
      </div>

      {/* Grid de cards (2 colunas ≥ md, 1 coluna em telas menores) */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
        {cards.map((c) => {
          const profitable = c.totalPL >= 0;
          const borderClass = profitable ? 'border-emerald-500/20' : 'border-red-500/20';
          const bgClass = profitable ? 'bg-emerald-500/5' : 'bg-red-500/5';
          const totalColor = profitable ? 'text-emerald-400' : 'text-red-400';

          return (
            <div
              key={c.name}
              data-testid={`emotion-card-${c.name}`}
              className={`relative p-3 rounded-xl border ${borderClass} ${bgClass} transition-all`}
            >
              {/* Header do card */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 text-sm">{c.name}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded-full border border-slate-700/50">
                    {c.count}x
                  </span>
                </div>
                <span className={`font-mono font-bold text-sm ${totalColor}`}>
                  {fmtSignedCurrency(c.totalPL)}
                </span>
              </div>

              {/* Grid 2×2 de quadrantes 4D */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Quadrant label="Financial">
                  <KPI
                    label="Expect"
                    value={fmtSignedCurrency(c.expectancy)}
                    valueClassName={c.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}
                  />
                  <KPI
                    label="Payoff"
                    value={c.payoff === null ? '—' : `${c.payoff.toFixed(1)}x`}
                  />
                </Quadrant>

                <Quadrant label="Operational">
                  <KPI
                    label="Shift"
                    value={fmtPct(c.shiftRate)}
                    valueClassName={shiftColor(c.shiftRate)}
                  />
                </Quadrant>

                <Quadrant label="Emotional">
                  <KPI label="WR" value={fmtPct(c.wrEmotion)} />
                  {c.wrDelta !== null && (
                    <KPI
                      label="Δ"
                      value={fmtSignedPct(c.wrDelta)}
                      valueClassName={c.wrDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}
                    />
                  )}
                </Quadrant>

                <Quadrant label="Maturity">
                  <div className="flex items-center gap-2">
                    <Sparkline series={c.sparklineSeries} positive={profitable} />
                    {profitable ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400 opacity-60" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400 opacity-60" />
                    )}
                  </div>
                </Quadrant>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé: Insight Acionável */}
      {insight && (
        <div className="mt-4 pt-4 border-t border-slate-800/50 flex-none">
          <div
            data-testid="emotion-insight"
            className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed"
          >
            <Activity className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>{insight.text}</p>
          </div>
        </div>
      )}

      <DebugBadge component="EmotionAnalysis" embedded />
    </div>
  );
};

export default EmotionAnalysis;
