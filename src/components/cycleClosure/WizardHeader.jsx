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

import React, { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';

const STEP_LABELS = ['Read', 'Notice', 'Reflect', 'Map', 'Check', 'Adjust', 'Commit', 'Seal'];

function StepDot({ index, status, currentStep, onClick }) {
  const stepNum = index + 1;
  const baseCls = 'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all';
  let cls;
  if (status === 'done') cls = `${baseCls} bg-emerald-500 text-white`;
  else if (stepNum === currentStep) cls = `${baseCls} bg-blue-500 text-white ring-4 ring-blue-500/25`;
  else cls = `${baseCls} bg-slate-800/60 text-slate-500 border border-slate-700/50`;

  const clickable = status === 'done' || stepNum === currentStep;
  return (
    <button
      type="button"
      onClick={clickable ? () => onClick(stepNum) : undefined}
      disabled={!clickable}
      className={`${cls} ${clickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}`}
      aria-label={`Etapa ${stepNum} ${STEP_LABELS[index]} — ${status}`}
      title={`${stepNum}. ${STEP_LABELS[index]}`}
    >
      {status === 'done' ? '✓' : stepNum}
    </button>
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
}) {
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
              <option value="demonstrated">demonstrated (mentor sozinho)</option>
              <option value="co_edited">co_edited (juntos)</option>
            </select>
          )}
          {draftUpdatedAt && (
            <span className="text-xs text-slate-600">
              💾 salvo às {formatTimestamp(draftUpdatedAt)}
            </span>
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
