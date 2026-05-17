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

import React, { useState, useCallback } from 'react';
import DebugBadge from '../DebugBadge';
import useCycleClosureDraft from '../../hooks/useCycleClosureDraft';
import WizardHeader from './WizardHeader';
import WizardFooter from './WizardFooter';
import Step1Read from './steps/Step1Read';
import Step2Notice from './steps/Step2Notice';
import Step3Reflect from './steps/Step3Reflect';
import Step4Map from './steps/Step4Map';
import Step5Check from './steps/Step5Check';
import Step6Adjust from './steps/Step6Adjust';
import Step7Commit from './steps/Step7Commit';
import Step8Seal from './steps/Step8Seal';

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
    reset,
    submit, submitting, submitError,
    stepStatus, canSeal,
  } = closure;

  const [error, setError] = useState(null);
  const [sealConfirmed, setSealConfirmed] = useState(false);

  // Descartar rascunho: limpa localStorage e sai. Sem prompt — o botão no
  // WizardHeader já tem confirmação inline própria.
  const handleDiscardDraft = () => {
    reset();
    onCancel?.();
  };

  const handleSeal = async () => {
    if (!sealConfirmed) {
      setError('Marque o checkbox de confirmação antes de selar.');
      return;
    }
    setError(null);
    try {
      const result = await submit();
      if (result?.closureId && onSealed) onSealed(result.closureId);
    } catch (e) {
      setError(e?.message || 'Erro ao selar ciclo');
    }
  };

  const goNext = () => setStep(Math.min(8, step + 1));
  const goBack = () => setStep(Math.max(1, step - 1));

  const markSwotVisited = useCallback(() => {
    if (!draft._visitedSwot) replaceSection('_visitedSwot', true);
  }, [draft._visitedSwot, replaceSection]);

  const markReflectVisited = useCallback(() => {
    if (!draft._visitedReflect) replaceSection('_visitedReflect', true);
  }, [draft._visitedReflect, replaceSection]);

  const markCommitVisited = useCallback(() => {
    if (!draft._visitedCommit) replaceSection('_visitedCommit', true);
  }, [draft._visitedCommit, replaceSection]);

  // Result badge dinâmico baseado em snapshot
  const resultBadge = draft.snapshot
    ? (() => {
        const pct = draft.snapshot.resultPercent;
        const status = draft.snapshot.cycleStatus;
        const tone = status === 'GOAL_HIT' ? 'emerald' : status === 'STOP_HIT' ? 'red' : 'amber';
        const sign = pct >= 0 ? '+' : '';
        const statusLabel =
          status === 'GOAL_HIT' ? 'meta batida' :
          status === 'STOP_HIT' ? 'stop atingido' :
          'no meio';
        return { label: `${sign}${pct?.toFixed(1) ?? '—'}% · ${statusLabel}`, tone };
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
        onDiscardDraft={handleDiscardDraft}
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
      {step === 3 && (
        <Step3Reflect
          snapshot={draft.snapshot}
          metrics={draft.metrics}
          patterns={draft.patterns}
          forward={draft.forward}
          aar={draft.aar}
          onChange={(aar) => replaceSection('aar', aar)}
          onVisited={markReflectVisited}
        />
      )}
      {step === 4 && (
        <Step4Map
          studentId={studentId}
          planId={planId}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          snapshot={draft.snapshot}
          metrics={draft.metrics}
          patterns={draft.patterns}
          swot={draft.swot}
          onChange={(swot) => replaceSection('swot', swot)}
          onVisited={markSwotVisited}
        />
      )}
      {step === 5 && (
        <Step5Check
          studentId={studentId}
          role={role}
          metrics={draft.metrics}
          snapshot={draft.snapshot}
          patterns={draft.patterns}
          onMaturity={(m) => replaceSection('maturity', m)}
        />
      )}
      {step === 6 && (
        <Step6Adjust
          studentId={studentId}
          planId={planId}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          metrics={draft.metrics}
          snapshot={draft.snapshot}
          patterns={draft.patterns}
          forward={draft.forward}
          maturityRegression={draft.maturity?.regression}
          onChange={(forward) => replaceSection('forward', forward)}
        />
      )}
      {step === 7 && (
        <Step7Commit
          cycleEnd={cycleEnd}
          metrics={draft.metrics}
          patterns={draft.patterns}
          snapshot={draft.snapshot}
          forward={draft.forward}
          notes={draft.notes}
          onChange={(forward) => replaceSection('forward', forward)}
          onChangeNotes={(notes) => replaceSection('notes', notes)}
          onVisited={markCommitVisited}
        />
      )}
      {step === 8 && (
        <Step8Seal
          draft={draft}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          confirmed={sealConfirmed}
          onConfirm={setSealConfirmed}
        />
      )}

      <WizardFooter
        currentStep={step}
        totalSteps={8}
        onBack={goBack}
        onNext={goNext}
        onCancel={onCancel}
        onSeal={handleSeal}
        canSeal={canSeal && sealConfirmed}
        submitting={submitting}
      />
    </div>
  );
}
