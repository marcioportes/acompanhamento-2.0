/**
 * AssessmentToggle.jsx
 * 
 * Toggle que o mentor usa na tela de alunos para marcar que um aluno
 * precisa fazer o assessment. Grava requiresAssessment no doc do student.
 * 
 * DEC-023: Assessment acionado pelo mentor, não automático.
 * 
 * Uso: <AssessmentToggle studentId={id} currentValue={bool} />
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React, { useState, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AssessmentToggle({ studentId, currentValue = false, onboardingStatus }) {
  const [loading, setLoading] = useState(false);
  const isActive = onboardingStatus === 'active' || onboardingStatus === 'mentor_validated';
  const isInProgress = onboardingStatus && !['lead', 'active', 'mentor_validated'].includes(onboardingStatus) && onboardingStatus !== undefined;

  const handleToggle = useCallback(async () => {
    if (loading) return;
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
  }, [studentId, currentValue, onboardingStatus, loading]);

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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        disabled={loading || isInProgress}
        title={
          isInProgress
            ? 'Assessment em andamento — não pode desativar'
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
