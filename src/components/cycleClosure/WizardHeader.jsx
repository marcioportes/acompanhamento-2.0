/**
 * WizardHeader.jsx — sticky header do wizard de Fechamento de Ciclo
 *
 * - Identidade do ciclo (plano + cycleKey + status)
 * - Step dots clicáveis (vai pra qualquer etapa já visitada)
 * - Indicador "modo mentor" quando role=mentor
 * - Indicador draft autosave
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useMemo, useState } from 'react';
import { GraduationCap, Trash2 } from 'lucide-react';

const STEP_LABELS = ['Ler', 'Observar', 'Refletir', 'Mapear', 'Avaliar', 'Ajustar', 'Comprometer', 'Selar'];

// Etapas 3, 4, 7 são opcionais — aluno pode pular sem bloquear o selo.
const OPTIONAL_STEPS = new Set([3, 4, 7]);

function StepDot({ index, status, currentStep, onClick }) {
  const stepNum = index + 1;
  const isOptional = OPTIONAL_STEPS.has(stepNum);
  const baseCls = 'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all';
  let cls;
  if (status === 'done') cls = `${baseCls} bg-emerald-500 text-white`;
  else if (stepNum === currentStep) cls = `${baseCls} bg-blue-500 text-white ring-4 ring-blue-500/25`;
  else cls = `${baseCls} bg-slate-800/60 text-slate-500 border ${isOptional ? 'border-slate-700/50 border-dashed' : 'border-slate-700/50'}`;

  const clickable = status === 'done' || stepNum === currentStep;
  const requirementLabel = isOptional ? 'opcional' : 'obrigatória';
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={clickable ? () => onClick(stepNum) : undefined}
        disabled={!clickable}
        className={`${cls} ${clickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}`}
        aria-label={`Etapa ${stepNum} ${STEP_LABELS[index]} (${requirementLabel}) — ${status}`}
        title={`${stepNum}. ${STEP_LABELS[index]} (${requirementLabel})`}
      >
        {status === 'done' ? '✓' : stepNum}
      </button>
      <span className={`text-[9px] uppercase tracking-wider ${isOptional ? 'text-slate-600' : 'text-slate-500'}`}>
        {STEP_LABELS[index]}
      </span>
    </div>
  );
}

function StepLine({ done }) {
  return <div className={`flex-1 h-0.5 ${done ? 'bg-emerald-500' : 'bg-slate-800/60'} mx-1`} />;
}

function formatTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function WizardHeader({
  planName,
  cycleLabel,
  resultBadge,         // { label, tone: 'emerald'|'amber'|'red' }
  currentStep,
  stepStatus,
  onStepClick,
  role = 'student',
  studentName = null,
  closeMode = 'self',
  onCloseModeChange,
  draftUpdatedAt = null,
  onDiscardDraft,
}) {
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const toneClass = useMemo(() => {
    switch (resultBadge?.tone) {
      case 'emerald': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'amber': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'red': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  }, [resultBadge]);

  const isMentor = role === 'mentor';

  return (
    <div
      className={`glass-card p-4 mb-4 sticky top-0 z-30 ${
        isMentor ? 'border border-purple-500/40 bg-gradient-to-r from-purple-500/5 to-transparent' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-3 text-sm flex-wrap">
        {isMentor && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold">
            <GraduationCap className="w-3.5 h-3.5" /> modo mentor
          </span>
        )}

        {isMentor && studentName && (
          <>
            <span className="text-slate-400">fechando para</span>
            <span className="font-semibold text-slate-100">{studentName}</span>
            <span className="text-slate-700">·</span>
          </>
        )}

        <span className="text-slate-300 font-medium">{planName}</span>
        <span className="text-slate-700">·</span>
        <span className="text-slate-400">{cycleLabel}</span>

        {resultBadge && (
          <>
            <span className="text-slate-700">·</span>
            <span className={`badge text-[10px] ${toneClass}`}>
              {resultBadge.label}
            </span>
          </>
        )}

        <span className="text-slate-700">·</span>
        <span className="text-xs text-slate-500">
          {currentStep} de {STEP_LABELS.length} etapas
        </span>

        <div className="ml-auto flex items-center gap-2">
          {isMentor && onCloseModeChange && (
            <select
              value={closeMode}
              onChange={(e) => onCloseModeChange(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-slate-200 cursor-pointer"
              aria-label="Modo de fechamento"
            >
              <option value="demonstrated">demonstrado (mentor sozinho)</option>
              <option value="co_edited">co-fechado (juntos)</option>
            </select>
          )}
          {draftUpdatedAt && (
            <span className="text-xs text-slate-600">
              💾 salvo às {formatTimestamp(draftUpdatedAt)}
            </span>
          )}
          {onDiscardDraft && (
            discardConfirm ? (
              <span className="inline-flex items-center gap-1 text-[11px]">
                <span className="text-slate-400">Apagar rascunho?</span>
                <button
                  type="button"
                  onClick={() => { setDiscardConfirm(false); onDiscardDraft(); }}
                  className="px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
                >
                  Sim, apagar
                </button>
                <button
                  type="button"
                  onClick={() => setDiscardConfirm(false)}
                  className="px-2 py-0.5 rounded border border-slate-700/40 text-slate-400 hover:bg-slate-800/40 transition"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setDiscardConfirm(true)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-300 transition"
                title="Apaga snapshot/AAR/SWOT/commitments deste rascunho"
              >
                <Trash2 className="w-3 h-3" />
                Descartar rascunho
              </button>
            )
          )}
        </div>
      </div>

      {/* Step dots */}
      <div className="flex items-center">
        {STEP_LABELS.map((_, idx) => (
          <React.Fragment key={idx}>
            <StepDot
              index={idx}
              status={stepStatus[idx + 1]}
              currentStep={currentStep}
              onClick={onStepClick}
            />
            {idx < STEP_LABELS.length - 1 && (
              <StepLine done={stepStatus[idx + 1] === 'done'} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
