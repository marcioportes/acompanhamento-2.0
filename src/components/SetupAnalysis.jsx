/**
 * SetupAnalysis V2 — issue #170
 *
 * Substitui a versão anterior (barra proporcional + WR) por card de
 * diagnóstico operacional com 4 KPIs por setup:
 *   - Financial · EV por trade
 *   - Financial · Payoff (avgWin / |avgLoss|)
 *   - Operational · ΔT W vs L (semáforo ±20%/±10%)
 *   - Impact · Contribuição ao EV total (%)
 *
 * Sparkline 6m (PL acumulado) + Aderência RR condicional (quando setupsMeta
 * traz targetRR) + Insight 1-linha no rodapé.
 *
 * Ordenação por |contribEV| desc. Setups com n<3 vão para accordion
 * "Esporádicos (N)" colapsado (expandido quando nenhum setup tem n≥3).
 *
 * API preservada: prop `trades`. Nova prop opcional `setupsMeta`.
 */

import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, ChevronRight, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';
import { analyzeBySetupV2 } from '../utils/setupAnalysisV2';
import DebugBadge from './DebugBadge';

const fmtSignedCurrency = (v) => (v >= 0 ? `+${formatCurrency(v)}` : formatCurrency(v));
const fmtPct = (v, digits = 0) => `${v.toFixed(digits)}%`;
const fmtSignedPct = (v, digits = 0) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;

// Semáforo ΔT (spec #170): >+20% verde / -10%..+20% âmbar / <-10% vermelho
const deltaTColor = (deltaT) => {
  if (deltaT === null) return 'text-slate-500';
  if (deltaT > 20) return 'text-emerald-400';
  if (deltaT >= -10) return 'text-amber-400';
  return 'text-red-400';
};

// Sparkline local (mesmo visual do EmotionAnalysis). Recebe values: number[].
const Sparkline = ({ values, positive, testId }) => {
  if (!values || values.length === 0) return null;
  const width = 60;
  const height = 24;
  const padding = 2;

  if (values.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        data-testid={testId}
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

  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((v - min) / range) * (height - 2 * padding);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const zeroY = height - padding - ((0 - min) / range) * (height - 2 * padding);

  return (
    <svg
      data-testid={testId}
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

const Quadrant = ({ label, sublabel, children }) => (
  <div className="flex-1 min-w-0">
    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold leading-tight">
      {label}
    </p>
    {sublabel && (
      <p className="text-[9px] text-slate-600 mb-1 leading-tight">{sublabel}</p>
    )}
    {!sublabel && <div className="mb-1" />}
    <div className="space-y-0.5 text-xs">{children}</div>
  </div>
);

const KPI = ({ label, value, valueClassName = 'text-slate-200' }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[10px] text-slate-500">{label}</span>
    <span className={`font-mono font-semibold ${valueClassName}`}>{value}</span>
  </div>
);

// Insight 1-linha: ofensor com contribEV<-20%, best performer payoff ≥ 1.5,
// aderência RR baixa, fallback positivo.
const buildInsight = (cards) => {
  if (!cards || cards.length === 0) return null;

  const worstOffender = cards.find((c) => c.contribEV < -20 && c.n >= 3);
  if (worstOffender) {
    return (
      <>
        <span className="text-red-400 font-bold">{worstOffender.setup}</span> é seu maior
        ofensor ({fmtSignedPct(worstOffender.contribEV)} do EV total) — revisar critério de
        entrada antes de seguir operando.
      </>
    );
  }

  const best = cards.find(
    (c) => c.totalPL > 0 && c.payoff !== null && c.payoff >= 1.5 && c.n >= 3,
  );
  if (best) {
    return (
      <>
        Seu setup mais consistente é{' '}
        <span className="text-emerald-400 font-bold">{best.setup}</span>, payoff{' '}
        {best.payoff.toFixed(1)}x — sustentado por gestão de saída.
      </>
    );
  }

  const lowAdherence = cards.find(
    (c) => c.adherenceRR && c.adherenceRR.pct < 50 && c.n >= 3,
  );
  if (lowAdherence) {
    return (
      <>
        <span className="text-amber-400 font-bold">{lowAdherence.setup}</span> está entregando
        RR fora da banda em{' '}
        {(100 - lowAdherence.adherenceRR.pct).toFixed(0)}% dos trades — o setup não está sendo
        executado como idealizado.
      </>
    );
  }

  const positive = cards.find((c) => c.totalPL > 0);
  if (positive) {
    return (
      <>
        <span className="text-emerald-400 font-bold">{positive.setup}</span> puxa seu EV
        agregado ({fmtSignedPct(positive.contribEV)}).
      </>
    );
  }

  return null;
};

const SetupCard = ({ card }) => {
  const profitable = card.totalPL >= 0;
  const borderClass = profitable ? 'border-emerald-500/20' : 'border-red-500/20';
  const bgClass = profitable ? 'bg-emerald-500/5' : 'bg-red-500/5';
  const totalColor = profitable ? 'text-emerald-400' : 'text-red-400';

  return (
    <div
      data-testid={`setup-card-${card.setup}`}
      className={`relative p-3 rounded-xl border ${borderClass} ${bgClass} transition-all`}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-200 text-sm">{card.setup}</span>
          <span className="text-[10px] text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded-full border border-slate-700/50">
            {card.n} {card.n === 1 ? 'trade' : 'trades'}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-mono font-bold text-sm ${totalColor}`}>
            {fmtSignedCurrency(card.totalPL)}
          </span>
          <span className="text-[10px] text-slate-500">{fmtPct(card.wr, 0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Quadrant label="Financial" sublabel="EV por trade">
          <KPI
            label="EV"
            value={fmtSignedCurrency(card.ev)}
            valueClassName={card.ev >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
          <KPI
            label="Payoff"
            value={card.payoff === null ? '—' : `${card.payoff.toFixed(1)}x`}
          />
        </Quadrant>

        <Quadrant label="Operational" sublabel="ΔT W vs L">
          <KPI
            label="ΔT"
            value={card.deltaT === null ? '—' : fmtSignedPct(card.deltaT, 0)}
            valueClassName={deltaTColor(card.deltaT)}
          />
          {card.durationWin !== null && card.durationLoss !== null && (
            <div className="text-[10px] text-slate-500 leading-tight">
              W {card.durationWin.toFixed(0)}min · L {card.durationLoss.toFixed(0)}min
            </div>
          )}
        </Quadrant>

        <Quadrant label="Impact" sublabel="Contribuição ao EV">
          <KPI
            label="Contrib"
            value={fmtSignedPct(card.contribEV, 0)}
            valueClassName={card.contribEV >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
        </Quadrant>

        <Quadrant label="Maturidade" sublabel="PL 6m">
          <div className="flex items-center gap-2">
            <Sparkline
              values={card.sparkline6m}
              positive={profitable}
              testId={`setup-sparkline-${card.setup}`}
            />
            {profitable ? (
              <TrendingUp className="w-3 h-3 text-emerald-400 opacity-60" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-400 opacity-60" />
            )}
          </div>
        </Quadrant>
      </div>

      {card.adherenceRR && (
        <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Aderência RR
          </span>
          <span
            className={`text-xs font-mono font-semibold ${
              card.adherenceRR.pct >= 70
                ? 'text-emerald-400'
                : card.adherenceRR.pct >= 40
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          >
            {card.adherenceRR.inBand}/{card.adherenceRR.total} ({fmtPct(card.adherenceRR.pct, 0)})
          </span>
        </div>
      )}
    </div>
  );
};

const SetupAnalysis = ({ trades, setupsMeta }) => {
  const cards = useMemo(
    () => analyzeBySetupV2(trades, { setupsMeta }),
    [trades, setupsMeta],
  );

  const { regulars, sporadics } = useMemo(() => {
    const reg = cards.filter((c) => !c.isSporadic);
    const spo = cards.filter((c) => c.isSporadic);
    return { regulars: reg, sporadics: spo };
  }, [cards]);

  const [expanded, setExpanded] = useState(regulars.length === 0 && sporadics.length > 0);

  const insight = useMemo(() => buildInsight(cards), [cards]);

  if (!trades || trades.length === 0 || cards.length === 0) {
    return (
      <div className="glass-card p-6 relative">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Análise por Setup</h3>
        </div>
        <p className="text-slate-500 text-center py-8">
          Nenhum trade registrado ainda
        </p>
        <DebugBadge component="SetupAnalysis" embedded />
      </div>
    );
  }

  return (
    <div className="glass-card p-6 h-full flex flex-col min-h-[350px] relative">
      <div className="flex items-center justify-between mb-6 flex-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <div
            title="Cada setup é uma hipótese operacional — tem RR esperado, frequência ideal e tempo médio. Esta análise responde: o setup está entregando o que promete? EV, Payoff, ΔT W/L (semáforo ±20%/±10%) e Contribuição ao EV total, ordenados por impacto absoluto."
          >
            <h3 className="text-lg font-bold text-white leading-tight">Análise por Setup</h3>
            <p className="text-xs text-slate-500">
              Financial · Operational · Impact · Maturidade por setup
            </p>
          </div>
        </div>
      </div>

      {regulars.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 content-start">
          {regulars.map((c) => (
            <SetupCard key={c.setup} card={c} />
          ))}
        </div>
      )}

      {sporadics.length > 0 && (
        <div className={regulars.length > 0 ? 'mt-4' : ''}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 font-semibold uppercase tracking-wider"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Esporádicos ({sporadics.length})
            <span className="text-[10px] text-slate-600 normal-case tracking-normal">
              setups com menos de 3 trades
            </span>
          </button>
          {expanded && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 content-start">
              {sporadics.map((c) => (
                <SetupCard key={c.setup} card={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {insight && (
        <div className="mt-4 pt-4 border-t border-slate-700/40 flex-none">
          <p className="text-xs text-slate-400 leading-relaxed">
            <span className="text-slate-500 font-semibold uppercase tracking-wider mr-2">
              Insight
            </span>
            {insight}
          </p>
        </div>
      )}

      <DebugBadge component="SetupAnalysis" embedded />
    </div>
  );
};

export default SetupAnalysis;
