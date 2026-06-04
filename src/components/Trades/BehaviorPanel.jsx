/**
 * BehaviorPanel — leitura consolidada do comportamento por trade (CHUNK-11 Fase 2, #301).
 * Consome `trade.behaviorProfile` (motor unificado detectBehavior) + `trade.redFlags`.
 * Substitui ShadowBehaviorPanel + ExecutionPatternsPanel + redFlags inline.
 *
 * Hierarquia: ① Adesão ao plano (fato) → ② Padrões comportamentais (opinião/motor) →
 * ③ Trava de gate → camada do mentor (slot). Aluno vê os dados; só os controles de
 * limpar violação / editar são gated por isMentor (decisão Marcio: aluno vê tudo).
 */
import React, { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { effectiveRedFlags, isViolationCleared } from '../../utils/violationFilter';
import {
  familyStyle, SEVERITY_LABELS, EMOTION_LABELS,
  BEHAVIOR_LABELS, narrativeFor, UndersizedBody,
  emotionConfrontDisplay, CONFRONT_TONE_STYLES,
} from './behaviorDisplay';

const FamilyCard = ({ family, currency }) => {
  const [expanded, setExpanded] = useState(false);
  const isPositive = family.valence === 'positive';
  const isUndersized = family.canonicalCode === 'SUB_SIZING';
  const label = BEHAVIOR_LABELS[family.canonicalCode] ?? family.family;

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-white/5 ${familyStyle(family)}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{isPositive ? '✦' : '⚠'} {label}</span>
          {!isPositive && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${familyStyle(family)}`}>
              {SEVERITY_LABELS[family.severity] ?? family.severity}
            </span>
          )}
          {family.isGate && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/40 inline-flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" /> gate
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
          {family.emotionMapping && <span>{EMOTION_LABELS[family.emotionMapping] ?? family.emotionMapping}</span>}
          {family.confidence != null && <span>{Math.round(family.confidence * 100)}%</span>}
          <span className="text-zinc-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {isUndersized ? (
        <UndersizedBody evidence={family.evidence || {}} currency={currency} expanded={expanded} />
      ) : (
        <>
          {/* Narrativa semântica (não despeja campos técnicos) — o aluno lê o que aconteceu. */}
          <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{narrativeFor({ ...family, currency })}</p>
          {expanded && family.evidence && Object.keys(family.evidence).length > 0 && (
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

const BehaviorPanel = ({ trade, isMentor = false, embedded = false, onToggleViolation, mentorSlot = null }) => {
  if (!trade) return null;
  const currency = trade.currency || 'USD';
  const profile = trade.behaviorProfile;

  // ① Adesão ao plano (redFlags)
  const hasFlags = Array.isArray(trade.redFlags) && trade.redFlags.length > 0;
  const effective = hasFlags ? effectiveRedFlags(trade) : [];
  const cleared = hasFlags ? trade.redFlags.filter((f) => isViolationCleared(trade, f.type)) : [];

  // ② Padrões (já ordenados no profile: negativos por severidade, positivos por último)
  const families = profile?.families ?? [];
  const negatives = families.filter((f) => f.valence !== 'positive');
  const positives = families.filter((f) => f.valence === 'positive');

  // ③ Gate
  const gateInputs = profile?.gateInputs ?? [];

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

        {/* ① Adesão ao plano */}
        {(effective.length > 0 || cleared.length > 0) && (
          <section>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Adesão ao plano</p>
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
            {cleared.length > 0 && (
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3">
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
        )}

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
              {negatives.map((f, i) => <FamilyCard key={`n-${i}`} family={f} currency={currency} />)}
              {positives.map((f, i) => <FamilyCard key={`p-${i}`} family={f} currency={currency} />)}
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
