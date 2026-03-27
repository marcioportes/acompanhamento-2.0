/**
 * AssessmentToggle.jsx
 *
 * Toggle que o mentor usa na tela de alunos para marcar que um aluno
 * precisa fazer o assessment. Grava requiresAssessment no doc do student.
 *
 * DEC-023: Assessment acionado pelo mentor, não automático.
 * DEC-026 (24/03/2026): Mentor pode resetar assessment mesmo após conclusão
 * (onboardingStatus = active). Reset requer confirmação explícita e volta
 * o aluno para lead + requiresAssessment: false. Histórico (initial_assessment,
 * questionnaire, probing) é preservado no Firestore — não é deletado.
 *
 * Uso: <AssessmentToggle studentId={id} currentValue={bool} onboardingStatus={status} />
 *
 * @version 1.1.0 — mentor reset habilitado (DEC-026)
 */

import React, { useState, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function AssessmentToggle({ studentId, currentValue = false, onboardingStatus }) {
  const [loading, setLoading] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const isActive = onboardingStatus === 'active' || onboardingStatus === 'mentor_validated';
  const isInProgress = onboardingStatus &&
    !['lead', 'active', 'mentor_validated'].includes(onboardingStatus) &&
    onboardingStatus !== undefined;

  // Status label
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

  const handleToggle = useCallback(async () => {
    if (loading || isInProgress) return;

    // Se assessment está completo (active), exige confirmação de reset
    if (isActive) {
      setConfirmingReset(true);
      return;
    }

    // Fluxo normal: ativar/desativar
    setLoading(true);
    try {
      const studentRef = doc(db, 'students', studentId);
      const newValue = !currentValue;
      const updates = { requiresAssessment: newValue };

      // Se ativando e ainda não tem onboardingStatus, setar como lead
      if (newValue && (!onboardingStatus || onboardingStatus === undefined)) {
        updates.onboardingStatus = 'lead';
      }

      await updateDoc(studentRef, updates);
    } catch (err) {
      console.error('Erro ao atualizar assessment flag:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId, currentValue, onboardingStatus, loading, isInProgress, isActive]);

  const handleConfirmReset = useCallback(async () => {
    setConfirmingReset(false);
    setLoading(true);
    try {
      const studentRef = doc(db, 'students', studentId);
      // Reset: volta para lead, desativa assessment
      // Histórico (initial_assessment, questionnaire, probing) é preservado
      await updateDoc(studentRef, {
        onboardingStatus: 'lead',
        requiresAssessment: false,
      });
    } catch (err) {
      console.error('Erro ao resetar assessment:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const handleCancelReset = useCallback(() => {
    setConfirmingReset(false);
  }, []);

  // Modal de confirmação de reset
  if (confirmingReset) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-[10px] text-amber-400 text-right max-w-[160px]">
          Resetar assessment? O aluno precisará refazer o processo. Histórico preservado.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancelReset}
            className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmReset}
            className="px-2 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Confirmar reset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        disabled={loading || isInProgress}
        title={
          isInProgress
            ? 'Assessment em andamento — não pode alterar'
            : isActive
              ? 'Clique para resetar o assessment'
              : currentValue
                ? 'Desativar assessment'
                : 'Ativar assessment para este aluno'
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
