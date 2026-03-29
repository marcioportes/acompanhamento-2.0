/**
 * useAssessment.js
 *
 * Hook para gestão do assessment no Firestore.
 * Gerencia o ciclo de vida do assessment: questionnaire, probing, initial_assessment.
 *
 * Paths Firestore:
 * - students/{studentId}/assessment/questionnaire
 * - students/{studentId}/assessment/probing
 * - students/{studentId}/assessment/initial_assessment
 *
 * State machine:
 * lead → pre_assessment → ai_assessed → probing → probing_complete → mentor_validated → active
 *
 * DEC-026 (24/03/2026): saveInitialAssessment escreve onboardingStatus: 'active' diretamente
 * via updateDoc, sem passar por updateOnboardingStatus. Motivo: a dupla transição
 * probing_complete → mentor_validated → active causava stale closure — o segundo
 * updateOnboardingStatus lia onboardingStatus do closure (probing_complete) e lançava
 * erro de transição inválida, deixando o aluno preso em mentor_validated.
 * mentor_validated continua existindo na state machine para transições manuais futuras,
 * mas o fluxo normal do saveInitialAssessment vai direto para active.
 *
 * @version 1.1.0 — fix saveInitialAssessment stale closure
 */

import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @param {string} studentId
 * @returns {Object} Assessment state and actions
 */
export function useAssessment(studentId) {
  const [questionnaire, setQuestionnaire] = useState(null);
  const [probing, setProbing] = useState(null);
  const [initialAssessment, setInitialAssessment] = useState(null);
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Listeners ──────────────────────────────────────────────

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribers = [];

    // Listen to student doc for onboardingStatus
    const studentRef = doc(db, 'students', studentId);
    unsubscribers.push(
      onSnapshot(studentRef, (snap) => {
        if (snap.exists()) {
          setOnboardingStatus(snap.data().onboardingStatus || 'lead');
        }
      }, (err) => setError(err.message))
    );

    // Listen to questionnaire
    const qRef = doc(db, 'students', studentId, 'assessment', 'questionnaire');
    unsubscribers.push(
      onSnapshot(qRef, (snap) => {
        setQuestionnaire(snap.exists() ? snap.data() : null);
      }, (err) => setError(err.message))
    );

    // Listen to probing
    const pRef = doc(db, 'students', studentId, 'assessment', 'probing');
    unsubscribers.push(
      onSnapshot(pRef, (snap) => {
        setProbing(snap.exists() ? snap.data() : null);
      }, (err) => setError(err.message))
    );

    // Listen to initial_assessment
    const iaRef = doc(db, 'students', studentId, 'assessment', 'initial_assessment');
    unsubscribers.push(
      onSnapshot(iaRef, (snap) => {
        setInitialAssessment(snap.exists() ? snap.data() : null);
        setLoading(false);
      }, (err) => {
        setError(err.message);
        setLoading(false);
      })
    );

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [studentId]);

  // ── Status Transitions ────────────────────────────────────

  /**
   * Transição de status via state machine.
   * Recebe fromStatus como parâmetro para evitar stale closure.
   * Se fromStatus não for passado, usa onboardingStatus do hook (pode ser stale).
   */
  const updateOnboardingStatus = useCallback(async (newStatus, fromStatus) => {
    if (!studentId) return;

    const currentStatus = fromStatus ?? onboardingStatus;

    const validTransitions = {
      lead: ['pre_assessment'],
      pre_assessment: ['ai_assessed'],
      ai_assessed: ['probing'],
      probing: ['probing_complete'],
      probing_complete: ['mentor_validated'],
      mentor_validated: ['active'],
    };

    const allowed = validTransitions[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Transição inválida: ${currentStatus} → ${newStatus}. Permitidas: ${(allowed || []).join(', ')}`
      );
    }

    const studentRef = doc(db, 'students', studentId);
    await updateDoc(studentRef, { onboardingStatus: newStatus });
  }, [studentId, onboardingStatus]);

  /**
   * Reset do assessment pelo mentor.
   * Seta onboardingStatus: 'lead' e requiresAssessment: false diretamente,
   * sem passar pela state machine (reset é operação administrativa, não fluxo normal).
   * O mentor deve reativar o assessment via AssessmentToggle após o reset.
   */
  const resetAssessment = useCallback(async () => {
    if (!studentId) return;
    const studentRef = doc(db, 'students', studentId);
    await updateDoc(studentRef, {
      onboardingStatus: 'lead',
      requiresAssessment: false,
    });
  }, [studentId]);

  // ── Questionnaire Actions ─────────────────────────────────

  const startQuestionnaire = useCallback(async () => {
    if (!studentId) return;
    const qRef = doc(db, 'students', studentId, 'assessment', 'questionnaire');
    await setDoc(qRef, {
      startedAt: serverTimestamp(),
      completedAt: null,
      responses: [],
      incongruenceFlags: [],
      gamingSuspect: false,
      aiProcessedAt: null,
      aiModelVersion: null,
    });
    await updateOnboardingStatus('pre_assessment');
  }, [studentId, updateOnboardingStatus]);

  const saveResponse = useCallback(async (response) => {
    if (!studentId) return;
    const qRef = doc(db, 'students', studentId, 'assessment', 'questionnaire');
    const snap = await getDoc(qRef);
    if (!snap.exists()) throw new Error('Questionnaire not started');

    const data = snap.data();
    const responses = data.responses || [];

    // Upsert: replace if same questionId exists, append otherwise
    const idx = responses.findIndex((r) => r.questionId === response.questionId);
    if (idx >= 0) {
      responses[idx] = response;
    } else {
      responses.push(response);
    }

    await updateDoc(qRef, { responses });
  }, [studentId]);

  const completeQuestionnaire = useCallback(async (processedData) => {
    if (!studentId) return;
    const qRef = doc(db, 'students', studentId, 'assessment', 'questionnaire');
    await updateDoc(qRef, {
      completedAt: serverTimestamp(),
      incongruenceFlags: processedData.incongruenceFlags || [],
      gamingSuspect: processedData.gamingSuspect || false,
      aiProcessedAt: serverTimestamp(),
      aiModelVersion: processedData.aiModelVersion || 'claude-sonnet-4-20250514',
    });
    await updateOnboardingStatus('ai_assessed');
  }, [studentId, updateOnboardingStatus]);

  // ── Probing Actions ───────────────────────────────────────

  const saveProbing = useCallback(async (probingData) => {
    if (!studentId) return;
    const pRef = doc(db, 'students', studentId, 'assessment', 'probing');
    await setDoc(pRef, {
      generatedAt: serverTimestamp(),
      completedAt: null,
      ...probingData,
    });
    await updateOnboardingStatus('probing');
  }, [studentId, updateOnboardingStatus]);

  const completeProbingQuestion = useCallback(async (probingId, response) => {
    if (!studentId) return;
    const pRef = doc(db, 'students', studentId, 'assessment', 'probing');
    const snap = await getDoc(pRef);
    if (!snap.exists()) throw new Error('Probing not started');

    const data = snap.data();
    const questions = data.questions || [];
    const qIdx = questions.findIndex((q) => q.probingId === probingId);
    if (qIdx < 0) throw new Error(`Probing question ${probingId} not found`);

    questions[qIdx].response = response;
    await updateDoc(pRef, { questions });
  }, [studentId]);

  const completeProbing = useCallback(async (summary) => {
    if (!studentId) return;
    const pRef = doc(db, 'students', studentId, 'assessment', 'probing');
    await updateDoc(pRef, {
      completedAt: serverTimestamp(),
      summary,
    });
    await updateOnboardingStatus('probing_complete');
  }, [studentId, updateOnboardingStatus]);

  /**
   * Persiste stageDiagnosis no documento questionnaire para rehydration futura.
   * Chamado após generateAssessmentReport retornar o diagnóstico de stage.
   * Permite que mentor re-abra a página e veja o relatório sem re-gerar.
   */
  const saveStageDiagnosis = useCallback(async (stageDiagnosis) => {
    if (!studentId || !stageDiagnosis) return;
    const qRef = doc(db, 'students', studentId, 'assessment', 'questionnaire');
    await updateDoc(qRef, { stageDiagnosis });
  }, [studentId]);

  /**
   * Persiste reportData no documento questionnaire para rehydration futura.
   * Chamado após generateAssessmentReport retornar o relatório.
   * Permite que mentor re-abra a página e veja developmentPriorities, profileName,
   * reportSummary, mentorFocusAreas e riskFlags sem re-gerar.
   */
  const saveReportData = useCallback(async (reportData) => {
    if (!studentId || !reportData) return;
    const qRef = doc(db, 'students', studentId, 'assessment', 'questionnaire');
    await updateDoc(qRef, { reportData });
  }, [studentId]);

  // ── Mentor Validation ─────────────────────────────────────

  /**
   * Salva o assessment validado pelo mentor e transiciona para 'active'.
   *
   * DEC-026: Transição vai direto para 'active' via updateDoc explícito,
   * sem passar por updateOnboardingStatus. Evita o bug de stale closure
   * que deixava o aluno preso em 'mentor_validated'.
   *
   * Fluxo correto:
   * 1. Mentor conduz entrevista e ajusta scores no MentorValidation
   * 2. Mentor clica "Validar Assessment"
   * 3. initial_assessment é gravado no Firestore
   * 4. onboardingStatus vai para 'active' atomicamente
   * 5. Aluno acessa dashboard e vê link para BaselineReport
   */
  const saveInitialAssessment = useCallback(async (assessmentData) => {
    if (!studentId) return;

    const studentRef = doc(db, 'students', studentId);
    const iaRef = doc(db, 'students', studentId, 'assessment', 'initial_assessment');

    // Gravar o assessment
    await setDoc(iaRef, {
      timestamp: serverTimestamp(),
      assessmentMethod: 'three_stage_v1',
      ...assessmentData,
    });

    // Transição direta para 'active' — sem passar pela state machine
    // para evitar stale closure (DEC-026)
    await updateDoc(studentRef, { onboardingStatus: 'active' });
  }, [studentId]);

  // ── Return ────────────────────────────────────────────────

  return {
    // State
    questionnaire,
    probing,
    initialAssessment,
    onboardingStatus,
    loading,
    error,

    // Actions
    startQuestionnaire,
    saveResponse,
    completeQuestionnaire,
    saveProbing,
    completeProbingQuestion,
    completeProbing,
    saveInitialAssessment,
    updateOnboardingStatus,
    resetAssessment,
    saveStageDiagnosis,
    saveReportData,
  };
}
