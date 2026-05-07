/**
 * CycleClosureWizard.jsx — orchestrator do ritual de fechamento
 *
 * 8 etapas: Read · Notice · Reflect · Map · Check · Adjust · Commit · Seal.
 * Aceita modos student (default) e mentor (closeMode 'demonstrated' ou 'co_edited').
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Props:
 *   - studentId, planId, cycleKey, cycleNumber, cycleStart, cycleEnd, accountId
 *   - role: 'student' | 'mentor'
 *   - studentName: string  (mostrado no header em modo mentor)
 *   - planName: string
 *   - onSealed(closureId): callback após selar com sucesso
 *   - onCancel(): callback ao desistir
 */

import React, { useState } from 'react';
import DebugBadge from '../DebugBadge';
import useCycleClosureDraft from '../../hooks/useCycleClosureDraft';
import WizardHeader from './WizardHeader';
import WizardFooter from './WizardFooter';
import Step1Read from './steps/Step1Read';
import Step2Notice from './steps/Step2Notice';
import Step5Check from './steps/Step5Check';

// Placeholders pra etapas ainda não implementadas (A5.6+)
function StepPlaceholder({ stepNumber, label }) {
  return (
    <div className="glass-card p-8 text-center">
      <p className="text-slate-300 font-semibold mb-2">
        Etapa {stepNumber} — {label}
      </p>
      <p className="text-sm text-slate-500">
        Em construção (A5.6+). Skeleton funcional permite navegação completa do wizard.
      </p>
    </div>
  );
}

export default function CycleClosureWizard({
  studentId,
  planId,
  cycleKey,
  cycleNumber,
  cycleStart,
  cycleEnd,
  accountId = null,
  role = 'student',
  studentName = null,
  planName = '—',
  onSealed,
  onCancel,
}) {
  const closure = useCycleClosureDraft({
    studentId, planId, cycleKey, cycleNumber, cycleStart, cycleEnd, accountId, role,
  });

  const {
    draft, step, setStep,
    updateSection, replaceSection, setCloseMode,
    submit, submitting, submitError,
    stepStatus, canSeal,
  } = closure;

  const [error, setError] = useState(null);

  const handleSeal = async () => {
    try {
      const result = await submit();
      if (result?.closureId && onSealed) onSealed(result.closureId);
    } catch (e) {
      setError(e?.message || 'Erro ao selar ciclo');
    }
  };

  const goNext = () => setStep(Math.min(8, step + 1));
  const goBack = () => setStep(Math.max(1, step - 1));

  // Result badge dinâmico baseado em snapshot
  const resultBadge = draft.snapshot
    ? (() => {
        const pct = draft.snapshot.resultPercent;
        const status = draft.snapshot.cycleStatus;
        const tone = status === 'GOAL_HIT' ? 'emerald' : status === 'STOP_HIT' ? 'red' : 'amber';
        const sign = pct >= 0 ? '+' : '';
        return { label: `${sign}${pct?.toFixed(1) ?? '?'}% ${status || 'NEUTRAL'}`, tone };
      })()
    : null;

  const cycleLabel = `${cycleStart} → ${cycleEnd}`;

  return (
    <div className="relative pb-20 max-w-5xl mx-auto p-4">
      <DebugBadge component="CycleClosureWizard" />

      <WizardHeader
        planName={planName}
        cycleLabel={cycleLabel}
        resultBadge={resultBadge}
        currentStep={step}
        stepStatus={stepStatus}
        onStepClick={setStep}
        role={role}
        studentName={studentName}
        closeMode={draft.closeMode}
        onCloseModeChange={setCloseMode}
        draftUpdatedAt={draft._updatedAt}
      />

      {(error || submitError) && (
        <div className="glass-card p-4 mb-4 border border-red-500/40 bg-red-500/5">
          <p className="text-sm text-red-300">⚠️ {error || submitError}</p>
        </div>
      )}

      {step === 1 && (
        <Step1Read
          studentId={studentId}
          planId={planId}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          onSnapshot={(snap) => replaceSection('snapshot', snap)}
          onMetrics={(m) => replaceSection('metrics', m)}
        />
      )}
      {step === 2 && (
        <Step2Notice
          studentId={studentId}
          planId={planId}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          onPatterns={(p) => replaceSection('patterns', p)}
        />
      )}
      {step === 3 && <StepPlaceholder stepNumber={3} label="Reflect (AAR)" />}
      {step === 4 && <StepPlaceholder stepNumber={4} label="Map (SWOT)" />}
      {step === 5 && (
        <Step5Check
          studentId={studentId}
          role={role}
          onMaturity={(m) => replaceSection('maturity', m)}
        />
      )}
      {step === 6 && <StepPlaceholder stepNumber={6} label="Adjust (Plano)" />}
      {step === 7 && <StepPlaceholder stepNumber={7} label="Commit (Forward)" />}
      {step === 8 && <StepPlaceholder stepNumber={8} label="Seal (Confirmar)" />}

      <WizardFooter
        currentStep={step}
        totalSteps={8}
        onBack={goBack}
        onNext={goNext}
        onCancel={onCancel}
        onSeal={handleSeal}
        canSeal={canSeal}
        submitting={submitting}
      />
    </div>
  );
}
