/**
 * AssessmentToggle.jsx
 *
 * Toggle que o mentor usa na tela de Acompanhamento para marcar que um aluno
 * precisa fazer o assessment. Grava requiresAssessment no doc do student.
 *
 * DEC-023: Assessment acionado pelo mentor, não automático.
 * DEC-026 (24/03/2026): Mentor pode resetar assessment mesmo após conclusão
 * (onboardingStatus = active). Reset requer confirmação explícita e volta
 * o aluno para lead + requiresAssessment: false. Histórico (initial_assessment,
 * questionnaire, probing) é preservado no Firestore — não é deletado.
 * DEC-AUTO-263-05 (08/05/2026): Confirmação inline em TODA mudança de estado
 * (ativar / desativar / resetar) — não só reset. Evita acionamento acidental
 * em lista densa.
 *
 * Uso: <AssessmentToggle studentId={id} currentValue={bool} onboardingStatus={status} />
 *
 * @version 1.2.0 — guard universal (DEC-AUTO-263-05)
 */

import React, { useState, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function AssessmentToggle({ studentId, currentValue = false, onboardingStatus }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isActive = onboardingStatus === 'active' || onboardingStatus === 'mentor_validated';
  const isInProgress = onboardingStatus &&
    !['lead', 'active', 'mentor_validated'].includes(onboardingStatus) &&
    onboardingStatus !== undefined;

  // Ação que será aplicada se confirmar.
  // - reset:      assessment completo → volta o aluno para lead + desativa
  // - deactivate: flag ligado, sem progresso → apenas desliga
  // - activate:   flag desligado → liga e (se necessário) seta lead
  const action = isActive ? 'reset' : (currentValue ? 'deactivate' : 'activate');

  // Status label (leitura, sem confirmação)
  let statusLabel = '';
  let statusColor = '';
  if (isActive) {
    statusLabel = 'Completo';
    statusColor = 'text-emerald-400';
  } else if (isInProgress) {
    statusLabel = 'Em andamento';
    statusColor = 'text-amber-400';
  } else if (currentValue) {
    statusLabel = 'Pendente';
    statusColor = 'text-blue-400';
  }

  const handleToggle = useCallback(() => {
    if (loading || isInProgress) return;
    setConfirming(true);
  }, [loading, isInProgress]);

  const handleConfirm = useCallback(async () => {
    setConfirming(false);
    setLoading(true);
    try {
      const studentRef = doc(db, 'students', studentId);

      if (action === 'reset') {
        // Histórico (initial_assessment, questionnaire, probing) é preservado.
        await updateDoc(studentRef, {
          onboardingStatus: 'lead',
          requiresAssessment: false,
        });
      } else if (action === 'deactivate') {
        await updateDoc(studentRef, { requiresAssessment: false });
      } else {
        // activate
        const updates = { requiresAssessment: true };
        if (!onboardingStatus) updates.onboardingStatus = 'lead';
        await updateDoc(studentRef, updates);
      }
    } catch (err) {
      console.error('Erro ao atualizar assessment:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId, action, onboardingStatus]);

  const handleCancel = useCallback(() => {
    setConfirming(false);
  }, []);

  // Painel inline de confirmação
  if (confirming) {
    const promptByAction = {
      reset: 'Resetar assessment? O aluno precisará refazer o processo. Histórico preservado.',
      deactivate: 'Desativar assessment deste aluno?',
      activate: 'Ativar assessment para este aluno?',
    };
    const labelByAction = {
      reset: 'Confirmar reset',
      deactivate: 'Confirmar desativar',
      activate: 'Confirmar ativar',
    };
    const buttonClassByAction = {
      reset: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
      deactivate: 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30',
      activate: 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30',
    };
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-[10px] text-slate-300 text-right max-w-[200px]">
          {promptByAction[action]}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${buttonClassByAction[action]}`}
          >
            {labelByAction[action]}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">Assessment</span>
      <button
        onClick={handleToggle}
        disabled={loading || isInProgress}
        title={
          isInProgress
            ? 'Assessment em andamento — não pode alterar'
            : isActive
              ? 'Clique para resetar o assessment'
              : currentValue
                ? 'Clique para desativar o assessment'
                : 'Clique para ativar o assessment deste aluno'
        }
        className={`
          relative w-9 h-5 rounded-full transition-all duration-200
          ${loading || isInProgress ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${currentValue || isActive
            ? 'bg-blue-600'
            : 'bg-white/10'
          }
        `}
      >
        <div
          className={`
            absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200
            ${currentValue || isActive ? 'translate-x-4' : 'translate-x-0.5'}
          `}
        />
      </button>
      {statusLabel && (
        <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
      )}
    </div>
  );
}
