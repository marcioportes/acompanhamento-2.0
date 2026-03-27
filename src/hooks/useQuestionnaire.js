/**
 * useQuestionnaire.js
 * 
 * Hook para estado do questionário na UI.
 * Gerencia: pergunta atual, progresso, persistência de optionOrder,
 * tracking de responseTime, navegação entre perguntas.
 * 
 * Separado do useAssessment (que faz CRUD Firestore) para manter
 * concerns isolados — este hook é UI-focused.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ALL_QUESTIONS, QUESTIONS_BY_DIMENSION, getOptionsForDisplay } from '../utils/assessmentQuestions.js';
import { getOptionOrder } from '../utils/questionRandomizer.js';

/**
 * @param {Object} params
 * @param {Array|null} params.savedResponses - Respostas já salvas (do Firestore via useAssessment)
 * @param {Function} params.onSaveResponse - Callback para persistir resposta (via useAssessment.saveResponse)
 * @returns {Object} Questionnaire UI state and actions
 */
export function useQuestionnaire({ savedResponses = null, onSaveResponse }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [optionOrders, setOptionOrders] = useState({});
  const responseStartTime = useRef(null);

  // ── Initialize from saved state ───────────────────────────

  // Reconstruct state from saved responses (para retomada)
  useEffect(() => {
    if (!savedResponses || savedResponses.length === 0) return;
    const restoredResponses = {};
    const restoredOrders = {};
    for (const r of savedResponses) {
      restoredResponses[r.questionId] = r;
      if (r.optionOrder) {
        restoredOrders[r.questionId] = r.optionOrder;
      }
    }
    setResponses(restoredResponses);
    setOptionOrders(restoredOrders);
    // Resume at first unanswered question
    const answeredIds = new Set(savedResponses.map((r) => r.questionId));
    const resumeIdx = ALL_QUESTIONS.findIndex((q) => !answeredIds.has(q.id));
    if (resumeIdx >= 0) setCurrentIndex(resumeIdx);
  }, [savedResponses]);

  // ── Current question ──────────────────────────────────────

  const currentQuestion = ALL_QUESTIONS[currentIndex] || null;
  const totalQuestions = ALL_QUESTIONS.length;
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // ── Progress ──────────────────────────────────────────────

  const answeredCount = Object.keys(responses).length;
  const progress = totalQuestions > 0 ? answeredCount / totalQuestions : 0;

  const progressByDimension = useMemo(() => {
    const result = {};
    for (const [dim, questions] of Object.entries(QUESTIONS_BY_DIMENSION)) {
      const total = questions.length;
      const answered = questions.filter((q) => responses[q.id]).length;
      result[dim] = { total, answered, progress: total > 0 ? answered / total : 0 };
    }
    return result;
  }, [responses]);

  // ── Option order (randomization with persistence) ─────────

  const pendingOrders = useRef({});

  const getOrderedOptions = useCallback((questionId) => {
    const displayOptions = getOptionsForDisplay(questionId);
    if (displayOptions.length === 0) return []; // Pergunta aberta

    const optionIds = displayOptions.map((o) => o.id);
    const savedOrder = optionOrders[questionId] || pendingOrders.current[questionId] || null;
    const { order, isNew } = getOptionOrder(optionIds, savedOrder);

    // Se é nova ordem, armazenar no ref (será persistido no state via useEffect)
    if (isNew) {
      pendingOrders.current[questionId] = order;
    }

    // Reordenar as opções conforme a ordem
    const optionMap = Object.fromEntries(displayOptions.map((o) => [o.id, o]));
    return order.map((id) => optionMap[id]).filter(Boolean);
  }, [optionOrders]);

  // Flush pending orders to state after render
  useEffect(() => {
    const pending = pendingOrders.current;
    if (Object.keys(pending).length > 0) {
      setOptionOrders((prev) => ({ ...prev, ...pending }));
      pendingOrders.current = {};
    }
  });

  // ── Response time tracking ────────────────────────────────

  const startTimer = useCallback(() => {
    responseStartTime.current = Date.now();
  }, []);

  const getElapsedSeconds = useCallback(() => {
    if (!responseStartTime.current) return null;
    return Math.round((Date.now() - responseStartTime.current) / 1000);
  }, []);

  // ── Answer submission ─────────────────────────────────────

  const answerClosed = useCallback(async (questionId, selectedOptionId) => {
    const responseTime = getElapsedSeconds();
    const response = {
      questionId,
      dimension: currentQuestion?.dimension,
      subDimension: currentQuestion?.subDimension,
      type: 'closed',
      selectedOption: selectedOptionId,
      optionOrder: optionOrders[questionId] || null,
      responseTime,
    };

    setResponses((prev) => ({ ...prev, [questionId]: response }));

    if (onSaveResponse) {
      await onSaveResponse(response);
    }
  }, [currentQuestion, optionOrders, getElapsedSeconds, onSaveResponse]);

  const answerOpen = useCallback(async (questionId, text) => {
    const responseTime = getElapsedSeconds();
    const response = {
      questionId,
      dimension: currentQuestion?.dimension,
      subDimension: currentQuestion?.subDimension,
      type: 'open',
      text,
      charCount: text.length,
      responseTime,
      // aiScore, aiClassification, aiJustification, aiConfidence — preenchidos pela CF depois
    };

    setResponses((prev) => ({ ...prev, [questionId]: response }));

    if (onSaveResponse) {
      await onSaveResponse(response);
    }
  }, [currentQuestion, getElapsedSeconds, onSaveResponse]);

  // ── Navigation ────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      startTimer();
    }
  }, [currentIndex, totalQuestions, startTimer]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      startTimer();
    }
  }, [currentIndex, startTimer]);

  const goToQuestion = useCallback((index) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      startTimer();
    }
  }, [totalQuestions, startTimer]);

  // ── Completion check ──────────────────────────────────────

  const isComplete = answeredCount === totalQuestions;

  const getMissingQuestions = useCallback(() => {
    return ALL_QUESTIONS.filter((q) => !responses[q.id]).map((q) => q.id);
  }, [responses]);

  const getAllResponses = useCallback(() => {
    return ALL_QUESTIONS
      .map((q) => responses[q.id])
      .filter(Boolean);
  }, [responses]);

  // ── Return ────────────────────────────────────────────────

  return {
    // Current state
    currentQuestion,
    currentIndex,
    totalQuestions,
    isFirstQuestion,
    isLastQuestion,

    // Progress
    answeredCount,
    progress,
    progressByDimension,

    // Options (randomized)
    getOrderedOptions,

    // Responses
    responses,
    answerClosed,
    answerOpen,

    // Navigation
    goNext,
    goPrev,
    goToQuestion,
    startTimer,

    // Completion
    isComplete,
    getMissingQuestions,
    getAllResponses,
  };
}
