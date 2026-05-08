/**
 * Step3Reflect.jsx — Etapa 3: AAR (After-Action Review) 4 perguntas
 *
 * Q1, Q2: auto-preenchidas (read-only) com base em snapshot/metrics.
 * Q3: por que a diferença? — multi-attribution (max 4) + texto livre opcional 280 chars.
 * Q4: o que sustentar e o que melhorar? — chips de sugestão + livre, max 2 cada.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo } from 'react';
import { Plus, X } from 'lucide-react';

const ATTRIBUTIONS = [
  { value: 'edge', label: 'Edge real do meu sistema', hint: 'matemática consistente, padrão esperado' },
  { value: 'luck', label: 'Sorte', hint: 'resultado fora do meu controle' },
  { value: 'error', label: 'Erro próprio', hint: 'violei regras, senti antes de pensar' },
  { value: 'market', label: 'Mercado / contexto', hint: 'regime atípico, baixa liquidez, evento' },
];

const MAX_TEXT_CHARS = 280;
const MAX_ITEMS_PER_GROUP = 2;

function buildSuggestions(metrics, patterns) {
  const sustain = [];
  const improve = [];

  if (typeof metrics?.ruleAdherenceRate === 'number' && metrics.ruleAdherenceRate >= 0.85) {
    sustain.push(`Disciplina nos ${metrics.count - (metrics.violationsCount || 0)} primeiros trades — RR e SL respeitados`);
  }
  if (metrics?.bestTradeR != null && metrics.bestTradeR >= 1.5) {
    sustain.push(`Melhor trade do ciclo (${metrics.bestTradeR.toFixed(1)}R) — replicar setup`);
  }
  if (typeof patterns?.eventCounts?.tilt === 'number' && patterns.eventCounts.tilt === 0) {
    sustain.push('Zero detecção comportamental no ciclo');
  }

  if (Array.isArray(patterns?.topErrors)) {
    for (const errorType of patterns.topErrors.slice(0, 2)) {
      improve.push(`Reduzir ocorrências de ${errorType}`);
    }
  }
  if (typeof patterns?.eventCounts?.revenge === 'number' && patterns.eventCounts.revenge > 0) {
    improve.push('Hard stop após 3 losses (auto-lock pelo app)');
  }
  return { sustain, improve };
}

function ChipPicker({ items, selected, onAdd, onRemove, max, color = 'emerald' }) {
  const colorMap = {
    emerald: { selected: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', label: 'Sustentar' },
    amber: { selected: 'bg-amber-500/20 border-amber-500/40 text-amber-300', label: 'Melhorar' },
  };
  const cls = colorMap[color] || colorMap.emerald;
  const remaining = max - selected.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.map((item, idx) => (
          <button
            key={`${item}-${idx}`}
            type="button"
            onClick={() => onRemove(idx)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${cls.selected} hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-300 transition`}
            title="Remover"
          >
            ✓ {item}
            <X className="w-3 h-3" />
          </button>
        ))}
        {remaining > 0 && items.filter((s) => !selected.includes(s)).map((sug) => (
          <button
            key={sug}
            type="button"
            onClick={() => onAdd(sug)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:bg-slate-700/60 transition"
          >
            <Plus className="w-3 h-3" /> {sug}
          </button>
        ))}
      </div>
      <FreeAddInput
        disabled={remaining <= 0}
        placeholder={remaining > 0 ? 'Ou escreva o seu...' : `${max}/${max} — máximo atingido`}
        onAdd={onAdd}
      />
    </div>
  );
}

function FreeAddInput({ onAdd, placeholder, disabled }) {
  const [val, setVal] = React.useState('');
  return (
    <div className="flex gap-2">
      <input
        type="text"
        disabled={disabled}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && val.trim()) {
            onAdd(val.trim());
            setVal('');
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        type="button"
        disabled={disabled || !val.trim()}
        onClick={() => { onAdd(val.trim()); setVal(''); }}
        className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>
  );
}

export default function Step3Reflect({ snapshot, metrics, patterns, aar, onChange }) {
  const expectedText = useMemo(() => {
    const cfg = snapshot?.planConfigSnapshot;
    if (!cfg) return 'Aguardando dados do plano.';
    return `Goal: +${cfg.cycleGoal}% (R$ ${(cfg.pl * cfg.cycleGoal / 100).toLocaleString('pt-BR')}); ` +
           `Stop: −${cfg.cycleStop}% (R$ ${(cfg.pl * cfg.cycleStop / 100).toLocaleString('pt-BR')}); ` +
           `PL R$${cfg.pl?.toLocaleString('pt-BR')}, RR ${cfg.rrTarget}:1, Risk ${cfg.riskPerOperation}% por trade.`;
  }, [snapshot]);

  const actualText = useMemo(() => {
    if (!snapshot || !metrics) return 'Aguardando dados.';
    const sign = snapshot.resultPercent >= 0 ? '+' : '';
    const expSign = metrics.expectancy_R >= 0 ? '+' : '';
    return `Resultado: ${sign}${snapshot.resultPercent?.toFixed(1)}% em ${snapshot.tradesCount} trades. ` +
           `${metrics.winners} vit / ${metrics.losers} perd. ` +
           `Edge ${expSign}${metrics.expectancy_R?.toFixed(2)}R · ` +
           `Rule adherence ${(metrics.ruleAdherenceRate * 100)?.toFixed(1)}%.`;
  }, [snapshot, metrics]);

  // Side effect: cacheia textos auto-fill no aar
  useEffect(() => {
    if (aar?.expected !== expectedText || aar?.actual !== actualText) {
      onChange({ ...aar, expected: expectedText, actual: actualText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedText, actualText]);

  const suggestions = useMemo(() => buildSuggestions(metrics, patterns), [metrics, patterns]);

  const toggleAttribution = (val) => {
    const cur = aar.whyDifference?.attributions || [];
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
    onChange({
      ...aar,
      whyDifference: { ...aar.whyDifference, attributions: next },
    });
  };

  const setText = (text) => {
    onChange({
      ...aar,
      whyDifference: { ...aar.whyDifference, text: text.slice(0, MAX_TEXT_CHARS) },
    });
  };

  const addSustain = (item) => {
    if ((aar.sustain?.length ?? 0) >= MAX_ITEMS_PER_GROUP) return;
    onChange({ ...aar, sustain: [...(aar.sustain || []), item] });
  };
  const removeSustain = (idx) => {
    onChange({ ...aar, sustain: aar.sustain.filter((_, i) => i !== idx) });
  };

  const addImprove = (item) => {
    if ((aar.improve?.length ?? 0) >= MAX_ITEMS_PER_GROUP) return;
    onChange({ ...aar, improve: [...(aar.improve || []), item] });
  };
  const removeImprove = (idx) => {
    onChange({ ...aar, improve: aar.improve.filter((_, i) => i !== idx) });
  };

  const text = aar.whyDifference?.text || '';
  const attrs = aar.whyDifference?.attributions || [];

  return (
    <div className="space-y-4">
      {/* Q1 — auto-fill */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3">
          <div className="bg-slate-700/50 text-slate-300 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">Q1</div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-200 mb-2">O que <em>devia</em> ter acontecido?</h4>
            <div className="bg-slate-800/40 rounded-lg p-3 text-sm text-slate-300">{expectedText}</div>
            <p className="text-[11px] text-slate-600 mt-1.5">📌 auto-preenchido do plano</p>
          </div>
        </div>
      </div>

      {/* Q2 — auto-fill */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3">
          <div className="bg-slate-700/50 text-slate-300 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">Q2</div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-200 mb-2">O que <em>aconteceu</em>?</h4>
            <div className="bg-slate-800/40 rounded-lg p-3 text-sm text-slate-300">{actualText}</div>
            <p className="text-[11px] text-slate-600 mt-1.5">📌 auto-preenchido das métricas</p>
          </div>
        </div>
      </div>

      {/* Q3 — multi-attribution + texto */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3">
          <div className="bg-blue-500/20 text-blue-400 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">Q3</div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-200 mb-1">Por que a <em>diferença</em>?</h4>
            <p className="text-xs text-slate-500 mb-3">Marque uma ou mais. Se múltiplas, indique a principal no texto.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {ATTRIBUTIONS.map((a) => {
                const checked = attrs.includes(a.value);
                return (
                  <label
                    key={a.value}
                    className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer border transition ${
                      checked ? 'bg-blue-500/10 border-blue-500/40' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleAttribution(a.value)} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{a.label}</p>
                      <p className="text-[11px] text-slate-500">{a.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Explique em 1-3 frases (opcional)"
              maxLength={MAX_TEXT_CHARS}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="text-[11px] text-slate-600 mt-1 text-right">{text.length} / {MAX_TEXT_CHARS}</p>
          </div>
        </div>
      </div>

      {/* Q4 — sustain/improve com chips */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3">
          <div className="bg-blue-500/20 text-blue-400 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">Q4</div>
          <div className="flex-1 space-y-5">
            <div>
              <h4 className="font-semibold text-slate-200 mb-1">O que <em>sustentar</em> e o que <em>melhorar</em>?</h4>
              <p className="text-xs text-slate-500">Máximo {MAX_ITEMS_PER_GROUP} de cada — overload mata follow-through (regra retro).</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-400 mb-2 font-semibold">Sustentar (max {MAX_ITEMS_PER_GROUP})</p>
              <ChipPicker
                items={suggestions.sustain}
                selected={aar.sustain || []}
                onAdd={addSustain}
                onRemove={removeSustain}
                max={MAX_ITEMS_PER_GROUP}
                color="emerald"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-400 mb-2 font-semibold">Melhorar (max {MAX_ITEMS_PER_GROUP})</p>
              <ChipPicker
                items={suggestions.improve}
                selected={aar.improve || []}
                onAdd={addImprove}
                onRemove={removeImprove}
                max={MAX_ITEMS_PER_GROUP}
                color="amber"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
