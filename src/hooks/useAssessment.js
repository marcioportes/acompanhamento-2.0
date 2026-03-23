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
 * @version 1.0.0 — CHUNK-09 Fase A
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

  const updateOnboardingStatus = useCallback(async (newStatus) => {
    if (!studentId) return;
    const validTransitions = {
      lead: ['pre_assessment'],
      pre_assessment: ['ai_assessed'],
      ai_assessed: ['probing'],
      probing: ['probing_complete'],
      probing_complete: ['mentor_validated'],
      mentor_validated: ['active'],
    };

    const allowed = validTransitions[onboardingStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Transição inválida: ${onboardingStatus} → ${newStatus}. Permitidas: ${(allowed || []).join(', ')}`
      );
    }

    const studentRef = doc(db, 'students', studentId);
    await updateDoc(studentRef, { onboardingStatus: newStatus });
  }, [studentId, onboardingStatus]);

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

  // ── Mentor Validation ─────────────────────────────────────

  const saveInitialAssessment = useCallback(async (assessmentData) => {
    if (!studentId) return;
    const iaRef = doc(db, 'students', studentId, 'assessment', 'initial_assessment');
    await setDoc(iaRef, {
      timestamp: serverTimestamp(),
      assessmentMethod: 'three_stage_v1',
      ...assessmentData,
    });
    // Two-step transition: probing_complete → mentor_validated → active
    await updateOnboardingStatus('mentor_validated');
    await updateOnboardingStatus('active');
  }, [studentId, updateOnboardingStatus]);

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
  };
}
