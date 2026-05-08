/**
 * Step4Map.jsx — Etapa 4: SWOT do ciclo
 *
 * Strengths/Weaknesses semi-auto (best/worst trade, top errors).
 * Opportunities/Threats via buildSWOT (heurísticas).
 * Cada quadrante: chips do auto-fill + add livre + skip.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { useTrades } from '../../../hooks/useTrades';
import { usePlans } from '../../../hooks/usePlans';
import { computeR } from '../../../utils/cycleClosure/cycleMetrics';
import { buildSWOT } from '../../../utils/cycleClosure/swotHeuristics';

const isInRange = (date, start, end) => date >= start && date <= end;

function buildAutoStrengthsWeaknesses({ trades, metrics, patterns }) {
  const strengths = [];
  const weaknesses = [];

  if (typeof metrics?.bestTradeR === 'number' && metrics.bestTradeR >= 1.5) {
    strengths.push(`Melhor trade do ciclo (${metrics.bestTradeR.toFixed(1)}R) — replicar setup`);
  }
  if (typeof metrics?.profitFactor === 'number' && metrics.profitFactor >= 2) {
    strengths.push(`Profit factor ${metrics.profitFactor.toFixed(2)} — edge sustentado`);
  }
  if (patterns?.eventCounts?.tilt === 0 && patterns?.eventCounts?.revenge === 0) {
    strengths.push('Zero detecção comportamental — disciplina firme');
  }

  if (typeof metrics?.worstTradeR === 'number' && metrics.worstTradeR <= -1.5) {
    weaknesses.push(`Pior trade ${metrics.worstTradeR.toFixed(1)}R — outlier de risco`);
  }
  if (Array.isArray(patterns?.topErrors) && patterns.topErrors.length > 0) {
    weaknesses.push(`Violações recorrentes: ${patterns.topErrors.join(', ')}`);
  }
  if (typeof metrics?.avgWinR === 'number' && metrics.avgWinR < 1) {
    weaknesses.push(`avgWinR ${metrics.avgWinR.toFixed(2)} < 1.0 — saio cedo de vencedores`);
  }

  return { strengths, weaknesses };
}

function Quadrant({ title, color, items, suggestions, onAdd, onRemove, onSkip, skipped }) {
  const colorMap = {
    emerald: { ring: 'border-emerald-500/30', label: 'text-emerald-300', icon: '💪' },
    red:     { ring: 'border-red-500/30', label: 'text-red-300', icon: '⚠️' },
    sky:     { ring: 'border-sky-500/30', label: 'text-sky-300', icon: '🚀' },
    amber:   { ring: 'border-amber-500/30', label: 'text-amber-300', icon: '🛡️' },
  };
  const c = colorMap[color] || colorMap.emerald;
  const [val, setVal] = useState('');
  const remaining = suggestions.filter((s) => !items.includes(s));

  if (skipped) {
    return (
      <div className={`bg-slate-800/20 border ${c.ring} rounded-xl p-4 opacity-60`}>
        <div className="flex items-center justify-between">
          <h4 className={`font-semibold ${c.label}`}>{c.icon} {title}</h4>
          <button type="button" onClick={() => onSkip(false)} className="text-xs text-slate-400 hover:text-slate-200 underline">
            cancelar skip
          </button>
        </div>
        <p className="text-xs text-slate-500 italic mt-2">Quadrante pulado.</p>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800/30 border ${c.ring} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`font-semibold ${c.label}`}>{c.icon} {title}</h4>
        <button type="button" onClick={() => onSkip(true)} className="text-[11px] text-slate-500 hover:text-slate-300 underline">
          pular
        </button>
      </div>

      <ul className="space-y-1.5 mb-3">
        {items.map((item, idx) => (
          <li key={`${item}-${idx}`} className="flex items-start gap-2 bg-slate-900/40 rounded-lg p-2.5 text-sm text-slate-200">
            <span className="flex-1">{item}</span>
            <button type="button" onClick={() => onRemove(idx)} className="text-slate-500 hover:text-red-300" title="Remover">
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {remaining.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> sugestões automáticas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {remaining.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAdd(s)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-slate-700/40 border border-slate-600/40 text-slate-300 hover:bg-slate-700/70"
              >
                <Plus className="w-3 h-3" /> {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && val.trim()) {
              onAdd(val.trim());
              setVal('');
            }
          }}
          placeholder="Adicionar próprio..."
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <button
          type="button"
          disabled={!val.trim()}
          onClick={() => { onAdd(val.trim()); setVal(''); }}
          className="btn-secondary text-xs disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function Step4Map({ studentId, planId, cycleStart, cycleEnd, snapshot, metrics, patterns, swot, onChange, onVisited }) {
  const { trades = [] } = useTrades(studentId);
  const { plans = [] } = usePlans(studentId);

  const plan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId]);
  const cycleTrades = useMemo(
    () => trades.filter((t) => t.planId === planId && t.date && isInRange(t.date, cycleStart, cycleEnd)),
    [trades, planId, cycleStart, cycleEnd],
  );
  const R = useMemo(() => computeR(plan), [plan]);

  // Auto-suggestions
  const { strengths: autoStrengths, weaknesses: autoWeaknesses } = useMemo(
    () => buildAutoStrengthsWeaknesses({ trades: cycleTrades, metrics, patterns }),
    [cycleTrades, metrics, patterns],
  );
  const { opportunities: autoOpps, threats: autoThreats } = useMemo(
    () => buildSWOT({
      trades: cycleTrades,
      R,
      maxDDPercent: metrics?.maxDrawdown?.percent,
      cycleStopPercent: snapshot?.stopPercent,
    }),
    [cycleTrades, R, metrics, snapshot],
  );

  // Marca etapa como visitada
  useEffect(() => {
    onVisited?.();
  }, [onVisited]);

  const skipped = swot._skipped || {};

  const updateQuad = (key, items) => onChange({ ...swot, [key]: items });
  const setSkip = (key, value) => onChange({
    ...swot,
    _skipped: { ...skipped, [key]: value },
    [key]: value ? [] : (swot[key] || []),
  });

  const handleAdd = (key) => (item) => {
    const cur = swot[key] || [];
    if (cur.includes(item)) return;
    updateQuad(key, [...cur, item]);
  };
  const handleRemove = (key) => (idx) => {
    updateQuad(key, (swot[key] || []).filter((_, i) => i !== idx));
  };

  return (
    <div className="glass-card p-8">
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-1">SWOT do ciclo</h3>
        <p className="text-sm text-slate-400">
          Forças e fraquezas auto-derivam dos números. Oportunidades e ameaças vêm de regras heurísticas — você edita ou ignora.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Quadrant
          title="Strengths"
          color="emerald"
          items={swot.strengths || []}
          suggestions={autoStrengths}
          onAdd={handleAdd('strengths')}
          onRemove={handleRemove('strengths')}
          onSkip={(v) => setSkip('strengths', v)}
          skipped={skipped.strengths}
        />
        <Quadrant
          title="Weaknesses"
          color="red"
          items={swot.weaknesses || []}
          suggestions={autoWeaknesses}
          onAdd={handleAdd('weaknesses')}
          onRemove={handleRemove('weaknesses')}
          onSkip={(v) => setSkip('weaknesses', v)}
          skipped={skipped.weaknesses}
        />
        <Quadrant
          title="Opportunities"
          color="sky"
          items={swot.opportunities || []}
          suggestions={autoOpps}
          onAdd={handleAdd('opportunities')}
          onRemove={handleRemove('opportunities')}
          onSkip={(v) => setSkip('opportunities', v)}
          skipped={skipped.opportunities}
        />
        <Quadrant
          title="Threats"
          color="amber"
          items={swot.threats || []}
          suggestions={autoThreats}
          onAdd={handleAdd('threats')}
          onRemove={handleRemove('threats')}
          onSkip={(v) => setSkip('threats', v)}
          skipped={skipped.threats}
        />
      </div>
    </div>
  );
}
