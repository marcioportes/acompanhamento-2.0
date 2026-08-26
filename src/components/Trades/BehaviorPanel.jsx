/**
 * BehaviorPanel — leitura consolidada do comportamento por trade (CHUNK-11 Fase 2, #301).
 * Consome `trade.behaviorProfile` (motor unificado detectBehavior) + `trade.redFlags`.
 * Substitui ShadowBehaviorPanel + ExecutionPatternsPanel + redFlags inline.
 *
 * Hierarquia: ① Adesão ao plano (fato) → ② Padrões comportamentais (opinião/motor) →
 * ③ Trava de gate → camada do mentor (slot). Aluno vê a narrativa humanizada; os
 * controles de limpar violação / editar E o accordion "Evidência técnica" cru são
 * mentor-only (isMentor) — #315: o dump de campos do schema não tem leitura pro aluno.
 */
import React, { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { effectiveRedFlags, isViolationCleared, isRevokedRedFlag } from '../../utils/violationFilter';
import { rrBreakdown } from '../../utils/rrBreakdown';
import { authorizationFor } from '../../utils/dayState';
import { authorizationNotice } from '../metrics/dayMetricTiles';
import { formatCurrencyDynamic } from '../../utils/currency';
import {
  familyStyle, SEVERITY_LABELS, EMOTION_LABELS,
  BEHAVIOR_LABELS, narrativeFor, UndersizedBody,
  emotionConfrontDisplay, CONFRONT_TONE_STYLES,
} from './behaviorDisplay';

// Tons do aviso de autorização (#402). `warn` é laranja discreto — SEM_FOLGA é aviso
// sobre a aritmética do plano, não acusação ao aluno; `alert` é vermelho — abrir
// depois do orçamento fechado é decisão dele.
const AUTH_TONE_STYLES = {
  warn: 'bg-orange-500/5 border-orange-500/20 text-orange-300',
  alert: 'bg-red-500/5 border-red-500/25 text-red-300',
  neutral: 'bg-slate-800/30 border-slate-700/30 text-zinc-300',
};

const FamilyCard = ({ family, currency, trade, isMentor = false, onToggleViolation }) => {
  const [expanded, setExpanded] = useState(false);
  const isPositive = family.valence === 'positive';
  const isUndersized = family.canonicalCode === 'SUB_SIZING';
  const label = BEHAVIOR_LABELS[family.canonicalCode] ?? family.family;
  // Clearing estendido (#305 Fase 2 C): mentor dispensa o finding → para de penalizar.
  const clearKey = `${family.canonicalCode}:${trade?.id}`;
  const cleared = !isPositive && isViolationCleared(trade, clearKey);

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-white/5 ${familyStyle(family)} ${cleared ? 'opacity-50' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${cleared ? 'line-through' : ''}`}>{isPositive ? '✦' : '⚠'} {label}</span>
          {!isPositive && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${familyStyle(family)}`}>
              {SEVERITY_LABELS[family.severity] ?? family.severity}
            </span>
          )}
          {family.isGate && !cleared && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/40 inline-flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" /> gate
            </span>
          )}
          {cleared && <span className="text-[10px] text-slate-400">dispensado pelo mentor</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
          {!isPositive && isMentor && onToggleViolation && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleViolation(clearKey); }}
              title={cleared ? 'Restaurar — volta a penalizar a maturidade' : 'Dispensar — não penaliza a maturidade'}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${cleared ? 'border-slate-600/40 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200' : 'border-white/20 text-zinc-300 hover:bg-white/10'}`}
            >
              {cleared ? '↺ Restaurar' : '✕ Dispensar'}
            </button>
          )}
          {family.emotionMapping && <span>{EMOTION_LABELS[family.emotionMapping] ?? family.emotionMapping}</span>}
          {family.confidence != null && <span>{Math.round(family.confidence * 100)}%</span>}
          <span className="text-zinc-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {isUndersized ? (
        <UndersizedBody evidence={family.evidence || {}} currency={currency} expanded={expanded} isMentor={isMentor} />
      ) : (
        <>
          {/* Narrativa semântica (não despeja campos técnicos) — o aluno lê o que aconteceu. */}
          <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{narrativeFor({ ...family, currency })}</p>
          {/* Evidência técnica crua é mentor-only (#315): campos do schema do motor não têm leitura pro aluno. */}
          {isMentor && expanded && family.evidence && Object.keys(family.evidence).length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Evidência técnica</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(family.evidence).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-zinc-500">{key}: </span>
                    <span className="text-zinc-300">{value == null ? '—' : (Array.isArray(value) ? `${value.length} items` : String(value))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ViolationRow = ({ flag, isMentor, onToggleViolation, cleared }) => (
  <div className="flex items-center justify-between gap-2">
    <p className={`text-xs flex-1 ${cleared ? 'text-slate-500 line-through' : 'text-amber-300/80'}`}>
      • {typeof flag === 'string' ? flag : flag.message || flag.rule || 'Violação'}
    </p>
    {isMentor && flag.type && onToggleViolation && (
      <button
        type="button"
        onClick={() => onToggleViolation(flag.type)}
        title={cleared ? 'Restaurar — volta a contar como violação' : 'Limpar esta violação (toggle)'}
        className={`shrink-0 text-[10px] px-2 py-0.5 rounded border transition-colors ${
          cleared
            ? 'border-slate-600/40 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
            : 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200'
        }`}
      >
        {cleared ? '↺ Restaurar' : '✕ Limpar'}
      </button>
    )}
  </div>
);

/**
 * R:R em dinheiro (#373). O painel dizia só "RR 1.2x abaixo do mínimo (2x)" — múltiplo
 * abstrato, sem dizer de quanto dinheiro se tratava. Os dois denominadores aparecem
 * lado a lado: o risco TOMADO (que governa a conformidade) e o RO que o plano autoriza,
 * que mostra o que o trade teria sido dentro do sizing correto.
 */
const RrEmDinheiro = ({ trade, plan }) => {
  const r = rrBreakdown(trade, plan);
  if (r.riskAmount == null && r.roAmount == null) return null;

  const dinheiro = (v) => (v == null ? '—' : formatCurrencyDynamic(v, r.currency));
  // Decimal em pt-BR: o produto inteiro fala português.
  const dec = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mult = (v) => (v == null ? '—' : `${dec(v)}x`);

  return (
    <div className="mt-2 rounded-lg border border-slate-700/40 bg-slate-800/30 p-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Risco × retorno, em dinheiro</p>

      {r.riskAmount != null && (
        <p className="text-xs text-zinc-300">
          Arriscou <span className="font-semibold text-white">{dinheiro(r.riskAmount)}</span>
          {r.riskPercent != null && <span className="text-zinc-500">{` (${dec(r.riskPercent)}% do capital)`}</span>}
          {r.resultAmount != null && (
            <> para {r.resultAmount >= 0 ? 'ganhar' : 'perder'}{' '}
              <span className={`font-semibold ${r.resultAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {dinheiro(Math.abs(r.resultAmount))}
              </span>
            </>
          )}
          {/* O múltiplo só aparece como veredicto quando HÁ veredicto. `meetsTarget`
              null nunca pinta âmbar — só `false` pinta. */}
          {r.rrTaken != null && r.rrEvaluable && (
            <> — <span className={`font-semibold ${r.meetsTarget === false ? 'text-amber-400' : 'text-emerald-400'}`}>
              {mult(r.rrTaken)}
            </span></>
          )}
        </p>
      )}

      {/* Perda com stop respeitado: o motor se abstém de julgar R:R ("perder 1R é o
          risco planejado"). O painel dizia o contrário na mesma tela — imprimia
          "−1,00x · mínimo 2,00x" em âmbar. Agora diz o que de fato aconteceu. */}
      {!r.rrEvaluable && r.resultAmount != null && r.resultAmount < 0 && (
        <p className="text-[11px] text-zinc-400">
          Perda dentro do risco planejado — o stop foi respeitado.
        </p>
      )}

      {/* Stop informado no próprio preço de saída: risco = |entrada − stop| = a perda,
          então o múltiplo é −1,00R por construção. Identidade aritmética não é medida. */}
      {r.riskIsTautological && (
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          O stop informado coincide com a saída, então o {mult(-1)} é aritmética, não medida.
        </p>
      )}

      {r.roAmount != null && (
        <p className="text-[11px] text-zinc-500">
          O plano autoriza <span className="text-zinc-300">{dinheiro(r.roAmount)}</span> por operação
          {r.rrVsPlan != null && r.rrEvaluable && (
            <> — nesse risco, o mesmo resultado seria <span className="text-zinc-300">{mult(r.rrVsPlan)}</span></>
          )}
          {/* O mínimo é propriedade do ALVO DECLARADO. Sem alvo declarado, cobrá-lo é
              acusar o aluno de não ter atingido algo com que nunca se comprometeu. */}
          {r.rrTarget != null && r.rrEvaluable && <span className="text-zinc-600"> · mínimo {mult(r.rrTarget)}</span>}
        </p>
      )}
    </div>
  );
};

const BehaviorPanel = ({ trade, plan = null, periodState = null, isMentor = false, embedded = false, onToggleViolation, mentorSlot = null }) => {
  if (!trade) return null;
  const currency = trade.currency || 'USD';
  const profile = trade.behaviorProfile;

  // ① Adesão ao plano (redFlags)
  const hasFlags = Array.isArray(trade.redFlags) && trade.redFlags.length > 0;
  const effective = hasFlags ? effectiveRedFlags(trade) : [];
  // #376 — violação revogada não reaparece nem na lista de "limpas pelo mentor".
  const cleared = hasFlags
    ? trade.redFlags.filter((f) => !isRevokedRedFlag(f.type) && isViolationCleared(trade, f.type))
    : [];

  // ② Padrões (já ordenados no profile: negativos por severidade, positivos por último)
  const families = profile?.families ?? [];
  const negatives = families.filter((f) => f.valence !== 'positive');
  const positives = families.filter((f) => f.valence === 'positive');

  // ③ Gate
  const gateInputs = profile?.gateInputs ?? [];

  // #402 — o que ESTA operação decidiu ao abrir (fato atômico derivado do período)
  // e o que o PERÍODO fez (fato do período). Coisas diferentes, blocos diferentes.
  const periodRow = authorizationFor(trade, periodState);
  const authNotice = authorizationNotice(periodRow, periodState, currency);

  const computed = !!profile; // o motor já rodou neste trade?

  return (
    <div className="mt-4">
      {!embedded && <DebugBadge component="BehaviorPanel" />}
      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-200">Comportamento do trade</h3>

        {/* Confronto emocional: emoção declarada × emoção que a execução sugere (manchete). */}
        {(() => {
          const c = emotionConfrontDisplay(profile?.emotionConfront);
          if (!c) return null;
          const icon = c.tone === 'red' ? '⚠' : c.tone === 'amber' ? '◐' : '✓';
          return (
            <div className={`flex items-start gap-2 rounded-lg p-3 border ${CONFRONT_TONE_STYLES[c.tone]}`}>
              <span className="text-sm leading-none mt-0.5">{icon}</span>
              <div>
                <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Confronto emocional</p>
                <p className="text-xs leading-relaxed">{c.text}</p>
              </div>
            </div>
          );
        })()}

        {/* ① ESTA OPERAÇÃO — só o que é propriedade dela.
            Antes o R:R em dinheiro ficava DENTRO da caixa de violações: um trade
            limpo não mostrava risco nenhum, e um trade acusado por um fato do DIA
            mostrava. Agora o dinheiro é sempre dito e a acusação é separada. */}
        <section>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Esta operação</p>

          {effective.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Violações ({effective.length})</span>
              </div>
              <div className="space-y-1">
                {effective.map((flag, i) => (
                  <ViolationRow key={`eff-${i}`} flag={flag} isMentor={isMentor} onToggleViolation={onToggleViolation} cleared={false} />
                ))}
              </div>
            </div>
          )}

          {/* Autorização para abrir: fato atômico derivado do período (#402).
              Aviso factual com os dois números lado a lado — não acusação. */}
          {authNotice && (
            <div className={`rounded-lg p-3 mb-2 border ${AUTH_TONE_STYLES[authNotice.tone]}`}>
              <p className="text-xs font-semibold mb-0.5">{authNotice.title}</p>
              <p className="text-[11px] opacity-80 leading-relaxed">{authNotice.detail}</p>
            </div>
          )}

          {effective.length === 0 && !authNotice && (
            <p className="text-xs text-emerald-300/80 mb-2">Nenhuma violação de plano nesta operação.</p>
          )}

          <RrEmDinheiro trade={trade} plan={plan} />

          {cleared.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 mt-2">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Limpas pelo mentor ({cleared.length})</span>
              </div>
              <div className="space-y-1">
                {cleared.map((flag, i) => (
                  <ViolationRow key={`cl-${i}`} flag={flag} isMentor={isMentor} onToggleViolation={onToggleViolation} cleared />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* O fato do PERÍODO não mora aqui. Ele tem um lugar só — o `DayResultCard`,
            montado acima deste painel. Uma faixa aqui repetia o mesmo número em cada
            trade do dia e, na FeedbackPage, ficava logo abaixo do próprio card. O que
            este painel diz sobre o período é apenas o que ESTA operação decidiu ao
            abrir (`authNotice`, acima), que é fato atômico. */}

        {/* ② Padrões comportamentais — sempre informa o estado do motor (independente de ①) */}
        <section>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Padrões comportamentais</p>
          {!computed ? (
            // Motor ainda não rodou neste trade (legado sem recompute) — mesmo com violações acima.
            <p className="text-xs text-zinc-500">
              Comportamento ainda não calculado neste trade{isMentor ? ' — use “Recalcular Comportamento”.' : '.'}
            </p>
          ) : families.length > 0 ? (
            <div className="space-y-2">
              {negatives.map((f, i) => <FamilyCard key={`n-${i}`} family={f} currency={currency} trade={trade} isMentor={isMentor} onToggleViolation={onToggleViolation} />)}
              {positives.map((f, i) => <FamilyCard key={`p-${i}`} family={f} currency={currency} trade={trade} isMentor={isMentor} onToggleViolation={onToggleViolation} />)}
            </div>
          ) : (effective.length === 0 && cleared.length === 0) ? (
            // Motor rodou, nada negativo e sem violação → afirmação de execução alinhada.
            <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <span className="text-emerald-300 text-sm leading-none mt-0.5">✓</span>
              <p className="text-xs text-emerald-300/80">Nenhuma violação de plano nem padrão de risco neste trade — execução alinhada.</p>
            </div>
          ) : (
            // Motor rodou, sem padrão comportamental, mas há violação de plano em ①.
            <p className="text-xs text-zinc-500">Nenhum padrão comportamental detectado.</p>
          )}
        </section>

        {/* ③ Trava de gate */}
        {gateInputs.length > 0 && (
          <section className="bg-red-500/5 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-300 mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">Trava progressão de estágio</span>
            </div>
            <p className="text-xs text-red-300/70">{gateInputs.map((g) => BEHAVIOR_LABELS[g] ?? g).join(' · ')}</p>
          </section>
        )}

        {/* Camada do mentor (slot) */}
        {mentorSlot && (
          <section className="pt-3 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Interpretação do mentor</p>
            {mentorSlot}
          </section>
        )}
      </div>
    </div>
  );
};

export default BehaviorPanel;
