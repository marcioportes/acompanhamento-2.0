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
import { Plus, X, AlertOctagon } from 'lucide-react';

const ATTRIBUTIONS = [
  { value: 'edge',   label: 'Minha estratégia funcionou', hint: 'vantagem matemática real, padrão esperado se repete' },
  { value: 'luck',   label: 'Sorte',                       hint: 'resultado fora do meu controle' },
  { value: 'error',  label: 'Erro próprio',                hint: 'violei regras, agi por emoção antes de pensar' },
  { value: 'market', label: 'Mercado / contexto',          hint: 'regime atípico, baixa liquidez, evento de notícia' },
];

const MAX_TEXT_CHARS = 280;
const MAX_ITEMS_PER_GROUP = 2;

/**
 * Evidência derivada por atribuição. Ancorar em FATOS antes de pedir
 * interpretação evita narrativa coerente-mas-falsa (Kahneman; framework §1).
 *
 * Retorna `{ text, tone }` onde tone é:
 *   - 'strong'  → evidência sustenta marcar essa atribuição (◉)
 *   - 'weak'    → atribuição contrariada/sem evidência (esmaecer)
 *   - 'neutral' → sem viés
 */
function buildAttributionEvidence(key, { metrics, patterns, snapshot }) {
  const counts = patterns?.eventCounts || {};
  const breach = snapshot?.stopBreach || {};
  const pf = metrics?.profitFactor;
  const exp = metrics?.expectancy_R;
  const bestR = metrics?.bestTradeR;
  const total = typeof snapshot?.result === 'number' ? snapshot.result : null;

  switch (key) {
    case 'error': {
      const errors = [];
      const adherence = metrics?.ruleAdherenceRate;
      const violations = Array.isArray(patterns?.topErrors) ? patterns.topErrors.length : 0;
      if (typeof adherence === 'number' && adherence < 0.9) {
        errors.push(`${Math.round((1 - adherence) * (metrics?.count || 0))} violações de regras`);
      } else if (violations > 0) {
        errors.push(`${violations} tipo(s) de violação`);
      }
      if ((counts.tiltDaysCount || 0) > 0) errors.push(`${counts.tiltDaysCount} dia(s) com tilt`);
      if ((counts.revenge || 0) > 0) errors.push(`${counts.revenge} instância(s) de vingança`);
      if ((counts.stopTampering || 0) > 0) errors.push(`stop deslocado ${counts.stopTampering}×`);
      if (breach.stopBreachIndex !== -1 && breach.tradesAfterStop > 0) {
        errors.push(`+${breach.tradesAfterStop} trade(s) após hit do stop`);
      }
      if (errors.length === 0) {
        return { text: 'Sem violações de regras ou eventos comportamentais detectados.', tone: 'weak' };
      }
      return { text: `Detectado: ${errors.slice(0, 3).join(', ')}.`, tone: 'strong' };
    }

    case 'market':
      // O app não tem leitura de regime macro hoje — sinalizar honestamente.
      return {
        text: 'Sem evidência de regime atípico no app — vale verificar macro do período com o mentor.',
        tone: 'weak',
      };

    case 'luck': {
      if (typeof bestR === 'number' && typeof total === 'number' && total !== 0 && typeof metrics?.R === 'number' && metrics.R > 0) {
        const bestRS = bestR * metrics.R;
        const pct = total !== 0 ? Math.abs(bestRS / total) * 100 : 0;
        if (pct > 50) {
          return {
            text: `Melhor trade rendeu ${bestR.toFixed(1)}R (${pct.toFixed(0)}% do resultado) — um único trade dominou.`,
            tone: 'strong',
          };
        }
        return {
          text: `Melhor trade rendeu ${bestR.toFixed(1)}R (${pct.toFixed(0)}% do resultado) — resultado distribuído, não dominado por sorte.`,
          tone: 'weak',
        };
      }
      return { text: 'Sem dados suficientes pra avaliar concentração do resultado.', tone: 'neutral' };
    }

    case 'edge': {
      const expSign = typeof exp === 'number' && exp >= 0 ? '+' : '';
      const sample = metrics?.count;
      if (typeof exp === 'number' && exp > 0 && typeof pf === 'number' && pf >= 1.2) {
        return {
          text: `Expectancy ${expSign}${exp.toFixed(2)}R, profit factor ${pf.toFixed(2)} em ${sample || '?'} trades — edge sustenta.`,
          tone: 'strong',
        };
      }
      if (typeof exp === 'number' && exp <= 0) {
        return {
          text: `Expectancy ${expSign}${exp.toFixed(2)}R — edge NÃO confirmado neste ciclo.`,
          tone: 'weak',
        };
      }
      return { text: 'Edge não tem confirmação clara neste ciclo.', tone: 'neutral' };
    }

    default:
      return { text: '', tone: 'neutral' };
  }
}

/**
 * Sugestões de Q4 (sustain + improve).
 *
 * R2 (#259): sustain agora exige SINAL POSITIVO MEDIDO — nunca "zero detecção".
 * Em ciclo com pipeline cego (sem orders, antes do redesign), zero contagem ≠
 * zero problema. Não dá pra sustentar ausência de sinal.
 *
 * Improve prioriza pausa/auto-bloqueio quando há violação de stop ou padrão
 * crítico — antes de listar erros menores.
 */
function buildSuggestions({ metrics, patterns, snapshot }) {
  const sustain = [];
  const improve = [];
  const counts = patterns?.eventCounts || {};
  const breach = snapshot?.stopBreach;
  const hasCriticalSignal =
    (breach && breach.stopBreachIndex !== -1 && breach.tradesAfterStop > 0) ||
    (counts.tilt || 0) > 0 || (counts.revenge || 0) > 0 || (counts.stopTampering || 0) > 0;

  // SUSTAIN — só com positivo medido
  if (
    typeof metrics?.ruleAdherenceRate === 'number' && metrics.ruleAdherenceRate >= 0.95 &&
    !hasCriticalSignal
  ) {
    sustain.push(`Aderência ${(metrics.ruleAdherenceRate * 100).toFixed(0)}% — disciplina pré-trade firme`);
  }
  if (metrics?.bestTradeR != null && metrics.bestTradeR >= 1.5) {
    sustain.push(`Melhor trade ${metrics.bestTradeR.toFixed(1)}R — replicar a configuração de entrada`);
  }
  if (typeof metrics?.profitFactor === 'number' && metrics.profitFactor >= 2) {
    sustain.push(`Profit factor ${metrics.profitFactor.toFixed(2)} — vantagem matemática sustentada`);
  }
  const bestClean = patterns?.dayBreakdown?.bestCleanDay;
  if (bestClean && typeof bestClean.pnl === 'number' && bestClean.pnl > 0) {
    sustain.push(`Dia ${bestClean.date} sem tilt/vingança: +R$${bestClean.pnl.toFixed(0)} — versão sob controle existe`);
  }

  // IMPROVE — prioriza pausa/bloqueio quando crítico
  if (breach && breach.stopBreachIndex !== -1 && breach.tradesAfterStop > 0) {
    improve.push('Auto-bloqueio: após hit do stop do ciclo, app rejeita add-trade até o próximo ciclo');
  }
  if ((counts.revenge || 0) >= 2) {
    improve.push('Hard stop após 3 losses consecutivos no dia (auto-lock)');
  }
  if ((counts.stopTampering || 0) >= 1) {
    improve.push('Stop é commit pré-trade: alterar SL depois da entrada não é permitido');
  }
  if ((counts.tiltDaysCount || 0) >= 3) {
    improve.push('Pausa de 24h após qualquer dia com tilt detectado');
  }
  if (Array.isArray(patterns?.topErrors)) {
    for (const errorType of patterns.topErrors.slice(0, 2)) {
      improve.push(`Reduzir ocorrências de ${errorType}`);
    }
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

export default function Step3Reflect({ snapshot, metrics, patterns, forward, aar, onChange, onVisited }) {
  // Ciclo crítico — framework manda calibrar tom + evitar exigir interpretação
  // de aluno em alta carga emocional. Cobertura ampla (qualquer um basta).
  const isCritical = useMemo(() => {
    const breach = snapshot?.stopBreach;
    if (breach && (breach.severity === 'critical' || breach.severity === 'major')) return true;
    if (forward?.aiSuggestion?.triggeredRule === 'pause_restructure') return true;
    if (
      typeof snapshot?.resultPercent === 'number' &&
      typeof snapshot?.stopPercent === 'number' &&
      snapshot.stopPercent > 0 &&
      Math.abs(snapshot.resultPercent) >= 1.5 * snapshot.stopPercent
    ) return true;
    return false;
  }, [snapshot, forward]);

  const evidence = useMemo(() => ({
    edge:   buildAttributionEvidence('edge',   { metrics, patterns, snapshot }),
    luck:   buildAttributionEvidence('luck',   { metrics, patterns, snapshot }),
    error:  buildAttributionEvidence('error',  { metrics, patterns, snapshot }),
    market: buildAttributionEvidence('market', { metrics, patterns, snapshot }),
  }), [metrics, patterns, snapshot]);
  const expectedText = useMemo(() => {
    const cfg = snapshot?.planConfigSnapshot;
    if (!cfg) return 'Aguardando dados do plano.';
    return `Meta: +${cfg.cycleGoal}% (R$ ${(cfg.pl * cfg.cycleGoal / 100).toLocaleString('pt-BR')}); ` +
           `Stop: −${cfg.cycleStop}% (R$ ${(cfg.pl * cfg.cycleStop / 100).toLocaleString('pt-BR')}); ` +
           `Capital R$ ${cfg.pl?.toLocaleString('pt-BR')}, vitória vale ${cfg.rrTarget}× a perda, ${cfg.riskPerOperation}% de risco por trade.`;
  }, [snapshot]);

  const actualText = useMemo(() => {
    if (!snapshot || !metrics) return 'Aguardando dados.';
    const sign = snapshot.resultPercent >= 0 ? '+' : '';
    const expSign = metrics.expectancy_R >= 0 ? '+' : '';
    const parts = [
      `Resultado: ${sign}${snapshot.resultPercent?.toFixed(1)}% em ${snapshot.tradesCount} trades. ` +
      `${metrics.winners} vitórias / ${metrics.losers} perdas. ` +
      `Ganho médio ${expSign}${metrics.expectancy_R?.toFixed(2)}R por trade · ` +
      `${(metrics.ruleAdherenceRate * 100)?.toFixed(1)}% de disciplina nas regras.`,
    ];
    const breach = snapshot.stopBreach;
    if (breach && breach.stopBreachIndex !== -1 && breach.tradesAfterStop > 0) {
      parts.push(
        `Stop do ciclo atingido no trade #${breach.stopBreachIndex + 1} — ` +
        `operou +${breach.tradesAfterStop} trade(s) depois${
          breach.pnlPctOfStop != null && breach.pnlPctOfStop >= 1.2
            ? `, perda final ${breach.pnlPctOfStop.toFixed(1)}× o cap planejado`
            : ''
        }.`,
      );
    }
    const counts = patterns?.eventCounts || {};
    const behavioral = [];
    if ((counts.tilt || 0) > 0) behavioral.push(`${counts.tilt} evento(s) de tilt em ${counts.tiltDaysCount || 0} dia(s)`);
    if ((counts.revenge || 0) > 0) behavioral.push(`${counts.revenge} instância(s) de vingança`);
    if ((counts.stopTampering || 0) > 0) behavioral.push(`${counts.stopTampering}× stop deslocado`);
    if ((counts.overtrading || 0) > 0) behavioral.push(`${counts.overtrading} dia(s) com excesso de trades`);
    if (behavioral.length > 0) parts.push(`Detectado: ${behavioral.join(', ')}.`);
    return parts.join(' ');
  }, [snapshot, metrics, patterns]);

  // Side effect: cacheia textos auto-fill no aar
  useEffect(() => {
    if (aar?.expected !== expectedText || aar?.actual !== actualText) {
      onChange({ ...aar, expected: expectedText, actual: actualText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedText, actualText]);

  useEffect(() => {
    onVisited?.();
  }, [onVisited]);

  const suggestions = useMemo(
    () => buildSuggestions({ metrics, patterns, snapshot }),
    [metrics, patterns, snapshot],
  );

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
      <div className="glass-card p-4 border border-slate-700/40 bg-slate-800/20">
        <div className="flex items-center gap-2 text-xs">
          <span className="badge bg-slate-700/40 text-slate-300 border border-slate-600/50 text-[10px] uppercase tracking-wider">opcional</span>
          <p className="text-slate-400">Se preferir não comentar, pode pular esta etapa — o ciclo fecha sem isso.</p>
        </div>
      </div>

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

      {/* Q3 — hipóteses ancoradas em evidência (framework: fato → interpretação) */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3">
          <div className="bg-blue-500/20 text-blue-400 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">Q3</div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-200 mb-1">O que <em>encaixa</em> com o que você viu?</h4>
            <p className="text-xs text-slate-500 mb-3">
              Marque o que faz sentido com os dados dos passos anteriores. Pode marcar zero — você vai conversar com o mentor.
            </p>

            {isCritical && (
              <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200 leading-relaxed">
                  <strong className="font-semibold">Esse ciclo foi duro.</strong> Não precisa entender agora.
                  As hipóteses abaixo são pontos de partida pra conversa com o mentor — sem cobrança de certeza.
                  Marcar nenhuma é uma resposta válida.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {ATTRIBUTIONS.map((a) => {
                const checked = attrs.includes(a.value);
                const ev = evidence[a.value] || { text: '', tone: 'neutral' };
                const dimmed = !checked && ev.tone === 'weak';
                const showHighlight = isCritical && ev.tone === 'strong';
                return (
                  <label
                    key={a.value}
                    className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer border transition ${
                      checked
                        ? 'bg-blue-500/10 border-blue-500/40'
                        : dimmed
                          ? 'bg-slate-800/15 border-slate-700/30 opacity-60 hover:opacity-100'
                          : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleAttribution(a.value)} className="mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-100 flex items-center gap-1.5">
                        {showHighlight && <span className="text-amber-300" title="evidência sustenta esta hipótese">◉</span>}
                        {a.label}
                      </p>
                      <p className="text-[11px] text-slate-500 italic">{a.hint}</p>
                      {ev.text && (
                        <p className={`text-[11px] mt-1.5 leading-relaxed ${
                          ev.tone === 'strong' ? 'text-amber-200/90' :
                          ev.tone === 'weak'   ? 'text-slate-500' :
                          'text-slate-400'
                        }`}>
                          {ev.text}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Quer deixar uma nota pro mentor? <span className="text-slate-600">(opcional)</span>
            </label>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pode ficar vazio. Pode ser uma frase, uma palavra, ou nada."
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
