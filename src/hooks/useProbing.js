/**
 * useProbing.js
 * 
 * Hook para estado da sondagem adaptativa na UI.
 * Gerencia: geração de perguntas via CF, respostas do aluno, análise via CF.
 * 
 * Fluxo:
 * 1. generateQuestions() — chama CF generateProbingQuestions com triggers
 * 2. Aluno responde cada pergunta (mínimo 80 chars)
 * 3. analyzeResponse() — chama CF analyzeProbingResponse para cada resposta
 * 4. complete() — finaliza sondagem com summary
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { calculateRehydrationIndex } from '../utils/probingUtils';

/**
 * @param {Object} params
 * @param {Function} params.onSaveProbing - Callback para persistir probing doc (via useAssessment.saveProbing)
 * @param {Function} params.onCompleteProbingQuestion - Callback para persistir resposta individual
 * @param {Function} params.onCompleteProbing - Callback para finalizar sondagem
 * @param {Array|null} params.savedQuestions - perguntas salvas no Firestore (rehydration)
 * @returns {Object} Probing UI state and actions
 */
export function useProbing({ onSaveProbing, onCompleteProbingQuestion, onCompleteProbing, savedQuestions }) {
  const [questions, setQuestions] = useState([]);
  const [currentProbingIndex, setCurrentProbingIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const responseStartTime = useRef(null);
  const rehydrated = useRef(false);

  // ── Rehydrate from Firestore when returning to page ──────
  // savedQuestions comes from useAssessment's onSnapshot listener.
  // Only rehydrate once to avoid overwriting in-session state.
  useEffect(() => {
    if (savedQuestions?.length > 0 && !rehydrated.current) {
      rehydrated.current = true;
      const answered = calculateRehydrationIndex(savedQuestions);
      setQuestions(savedQuestions);
      setCurrentProbingIndex(answered);
      responseStartTime.current = Date.now();
    }
  }, [savedQuestions]);

  // ── Generate probing questions ────────────────────────────

  const generateQuestions = useCallback(async (probingPayload) => {
    setGenerating(true);
    setError(null);

    try {
      const generateProbingQuestionsCF = httpsCallable(functions, 'generateProbingQuestions');
      const result = await generateProbingQuestionsCF(probingPayload);

      const generatedQuestions = result.data.questions || [];

      // Persist to Firestore
      if (onSaveProbing) {
        await onSaveProbing({
          triggeredBy: probingPayload.triggers || [],
          questions: generatedQuestions,
          aiModelVersion: 'claude-sonnet-4-20250514',
        });
      }

      setQuestions(generatedQuestions);
      setCurrentProbingIndex(0);
      responseStartTime.current = Date.now();
    } catch (err) {
      setError(`Erro ao gerar perguntas de aprofundamento: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }, [onSaveProbing]);

  // ── Current question ──────────────────────────────────────

  const currentProbingQuestion = questions[currentProbingIndex] || null;
  const totalProbingQuestions = questions.length;
  const isProbingComplete = currentProbingIndex >= totalProbingQuestions && totalProbingQuestions > 0;

  // ── Answer a probing question ─────────────────────────────

  const answerProbingQuestion = useCallback(async (text) => {
    if (!currentProbingQuestion) return;

    const responseTime = responseStartTime.current
      ? Math.round((Date.now() - responseStartTime.current) / 1000)
      : null;

    setAnalyzing(true);
    setError(null);

    try {
      // Call CF to analyze the response
      const analyzeProbingResponseCF = httpsCallable(functions, 'analyzeProbingResponse');
      const result = await analyzeProbingResponseCF({
        probingId: currentProbingQuestion.probingId,
        probingText: currentProbingQuestion.text,
        triggeredByFlag: currentProbingQuestion.triggeredByFlag,
        sourceQuestions: currentProbingQuestion.sourceQuestions,
        rubric: currentProbingQuestion.rubric,
        responseText: text,
        responseTime,
      });

      const analysis = result.data;

      const response = {
        text,
        charCount: text.length,
        responseTime,
        aiAnalysis: {
          finding: analysis.finding || '',
          flagResolution: analysis.flagResolution || 'inconclusive',
          emotionalInsight: analysis.emotionalInsight || '',
          confidence: analysis.confidence || 0,
        },
      };

      // Persist to Firestore
      if (onCompleteProbingQuestion) {
        await onCompleteProbingQuestion(currentProbingQuestion.probingId, response);
      }

      // Update local state
      setQuestions((prev) => {
        const updated = [...prev];
        updated[currentProbingIndex] = {
          ...updated[currentProbingIndex],
          response,
        };
        return updated;
      });

      // Move to next question
      setCurrentProbingIndex((prev) => prev + 1);
      responseStartTime.current = Date.now();

    } catch (err) {
      setError(`Erro ao analisar resposta: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [currentProbingQuestion, currentProbingIndex, onCompleteProbingQuestion]);

  // ── Complete probing ──────────────────────────────────────

  const completeAllProbing = useCallback(async () => {
    const answeredQuestions = questions.filter((q) => q.response);
    
    const resolved = answeredQuestions.filter(
      (q) => q.response?.aiAnalysis?.flagResolution === 'resolved'
    ).length;
    const reinforced = answeredQuestions.filter(
      (q) => q.response?.aiAnalysis?.flagResolution === 'reinforced'
    ).length;
    const inconclusive = answeredQuestions.filter(
      (q) => q.response?.aiAnalysis?.flagResolution === 'inconclusive'
    ).length;

    const summary = {
      totalFlags: questions.length,
      flagsResolved: resolved,
      flagsReinforced: reinforced,
      flagsInconclusive: inconclusive,
      overallAssessment: '', // Será preenchido pela CF generateAssessmentReport
      mentorFocusAreas: [],
    };

    if (onCompleteProbing) {
      await onCompleteProbing(summary);
    }
  }, [questions, onCompleteProbing]);

  // ── Return ────────────────────────────────────────────────

  return {
    // State
    questions,
    currentProbingQuestion,
    currentProbingIndex,
    totalProbingQuestions,
    isProbingComplete,
    generating,
    analyzing,
    error,

    // Actions
    generateQuestions,
    answerProbingQuestion,
    completeAllProbing,
  };
}
