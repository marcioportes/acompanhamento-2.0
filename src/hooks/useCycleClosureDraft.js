/**
 * useCycleClosureDraft.js — state machine do wizard de Fechamento de Ciclo
 *
 * Centraliza:
 *   - estado das 8 etapas (snapshot, metrics, patterns, aar, maturity, swot, mentor, forward, notes)
 *   - autosave em localStorage (draft persistente entre sessions, por aluno×plano×ciclo)
 *   - validação por etapa (gating do Seal)
 *   - chamada da CF closeCycle (commit final) e descarte do draft
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Storage key: `closure-draft:{studentId}:{planId}:{cycleKey}`
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const STORAGE_PREFIX = 'closure-draft';
const SCHEMA_VERSION = 1;

const buildStorageKey = ({ studentId, planId, cycleKey }) =>
  `${STORAGE_PREFIX}:${studentId}:${planId}:${cycleKey}`;

const buildEmptyDraft = () => ({
  schemaVersion: SCHEMA_VERSION,
  step: 1,
  // A — snapshot (auto-populado pela etapa 1)
  snapshot: null,
  // B — metrics (auto)
  metrics: null,
  // C — patterns (auto)
  patterns: null,
  // D — AAR (input do aluno em Q3 + Q4)
  aar: {
    expected: null,
    actual: null,
    whyDifference: { attributions: [], text: '' },
    sustain: [],
    improve: [],
  },
  // E — maturity (read-only do framework)
  maturity: null,
  // F — SWOT (auto + edição)
  swot: {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  },
  // G — mentor (read-only no wizard; mentor adiciona em janela 7d)
  mentor: null,
  // H — forward (input + IA stub)
  forward: {
    behavioralCommitments: [],
    nextReviewDate: null,
    kellyRecommendation: null,
    mcSimulation: null,
    aiSuggestion: null,
    planAdjustment: { changed: false, newPl: null, newRiskPerOp: null, newRRTarget: null, decisionSource: 'kept' },
  },
  // I — notas livres
  notes: '',
  // closeMode definido pelo modo do wizard
  closeMode: 'self',
  // updatedAt local pra UI ("salvo às HH:MM")
  _updatedAt: null,
});

const loadDraftFromStorage = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[useCycleClosureDraft] erro ao parsear draft, descartando:', e);
    return null;
  }
};

const saveDraftToStorage = (key, draft) => {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...draft, _updatedAt: Date.now() }));
  } catch (e) {
    console.warn('[useCycleClosureDraft] localStorage indisponível:', e);
  }
};

const clearDraftFromStorage = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch (e) { /* ignora */ }
};

/**
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} params.planId
 * @param {string} params.cycleKey
 * @param {number} params.cycleNumber
 * @param {string} params.cycleStart        — 'YYYY-MM-DD'
 * @param {string} params.cycleEnd          — 'YYYY-MM-DD'
 * @param {string} [params.accountId]
 * @param {'student'|'mentor'} [params.role='student']
 * @param {'self'|'demonstrated'|'co_edited'} [params.initialCloseMode]
 *
 * @returns {Object}
 *   {
 *     draft,                        // estado atual
 *     step, setStep,                // navegação
 *     updateSection(name, patch),   // mescla mudanças numa seção
 *     replaceSection(name, value),  // substitui inteira
 *     setCloseMode,
 *     reset,                        // limpa o draft (cancelar wizard)
 *     submit,                       // chama closeCycle CF + limpa draft
 *     submitting, submitError,
 *     stepStatus,                   // { 1: 'done'|'current'|'pending', ... }
 *     canSeal,                      // bool — todas etapas required completas
 *   }
 */
export function useCycleClosureDraft({
  studentId,
  planId,
  cycleKey,
  cycleNumber,
  cycleStart,
  cycleEnd,
  accountId = null,
  role = 'student',
  initialCloseMode = null,
}) {
  const storageKey = useMemo(
    () => buildStorageKey({ studentId, planId, cycleKey }),
    [studentId, planId, cycleKey],
  );

  const defaultMode = initialCloseMode || (role === 'mentor' ? 'demonstrated' : 'self');

  const [draft, setDraft] = useState(() => {
    const restored = typeof window !== 'undefined' ? loadDraftFromStorage(storageKey) : null;
    if (restored) return restored;
    return { ...buildEmptyDraft(), closeMode: defaultMode };
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Autosave debounced (300ms) — evita spam em digitação rápida
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraftToStorage(storageKey, draft);
    }, 300);
    return () => clearTimeout(saveTimerRef.current);
  }, [draft, storageKey]);

  const setStep = useCallback((step) => {
    setDraft((d) => ({ ...d, step }));
  }, []);

  const updateSection = useCallback((name, patch) => {
    setDraft((d) => ({
      ...d,
      [name]: typeof d[name] === 'object' && d[name] !== null && !Array.isArray(d[name])
        ? { ...d[name], ...patch }
        : patch,
    }));
  }, []);

  const replaceSection = useCallback((name, value) => {
    setDraft((d) => ({ ...d, [name]: value }));
  }, []);

  const setCloseMode = useCallback((mode) => {
    setDraft((d) => ({ ...d, closeMode: mode }));
  }, []);

  const reset = useCallback(() => {
    clearDraftFromStorage(storageKey);
    setDraft({ ...buildEmptyDraft(), closeMode: defaultMode });
  }, [storageKey, defaultMode]);

  /**
   * Status por etapa, baseado em presença de dados/inputs requeridos.
   *  - 1 (Read), 2 (Notice), 5 (Check): auto-populated → 'done' assim que dados chegam
   *  - 3 (Reflect AAR Q3 + Q4): requer attributions ou improve preenchido
   *  - 4 (Map SWOT): aceita skip por quadrante → sempre 'done' depois de visitada
   *  - 6 (Adjust): requer planAdjustment.decisionSource ≠ null
   *  - 7 (Commit): requer ≥1 commitment ou notes preenchido
   *  - 8 (Seal): final — só vira 'done' depois de submit
   */
  const stepStatus = useMemo(() => {
    const status = { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending', 7: 'pending', 8: 'pending' };

    if (draft.snapshot && draft.metrics) status[1] = 'done';
    if (draft.patterns) status[2] = 'done';
    if (draft.aar?.whyDifference?.attributions?.length > 0 || (draft.aar?.improve?.length ?? 0) > 0) status[3] = 'done';
    if (draft._visitedSwot) status[4] = 'done';
    if (draft.maturity) status[5] = 'done';
    if (draft.forward?.planAdjustment?.decisionSource && draft.forward.planAdjustment.decisionSource !== null) status[6] = 'done';
    if ((draft.forward?.behavioralCommitments?.length ?? 0) > 0 || (draft.notes ?? '').trim().length > 0) status[7] = 'done';

    if (draft.step >= 1 && draft.step <= 8) status[draft.step] = status[draft.step] === 'done' ? 'done' : 'current';
    return status;
  }, [draft]);

  const canSeal = useMemo(
    () =>
      stepStatus[1] === 'done' &&
      stepStatus[2] === 'done' &&
      stepStatus[3] === 'done' &&
      stepStatus[5] === 'done' &&
      stepStatus[6] === 'done' &&
      stepStatus[7] === 'done',
    [stepStatus],
  );

  const submit = useCallback(async () => {
    if (submitting) return null;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const functions = getFunctions();
      const closeCycle = httpsCallable(functions, 'closeCycle');

      const payload = {
        planId,
        studentId,
        accountId,
        cycleKey,
        cycleNumber,
        cycleStart,
        cycleEnd,
        closeMode: draft.closeMode,
        snapshot: draft.snapshot,
        metrics: draft.metrics,
        patterns: draft.patterns,
        aar: draft.aar,
        maturity: draft.maturity,
        swot: draft.swot,
        mentor: draft.mentor || { closingComment: null, pendingFeedbackCount: 0, reviewedCount: 0, threadsHighlighted: [] },
        forward: draft.forward,
        notes: draft.notes || null,
      };

      const result = await closeCycle(payload);
      clearDraftFromStorage(storageKey);
      setSubmitting(false);
      return result.data;
    } catch (e) {
      setSubmitError(e?.message || 'Erro ao fechar ciclo');
      setSubmitting(false);
      throw e;
    }
  }, [
    submitting, planId, studentId, accountId, cycleKey, cycleNumber,
    cycleStart, cycleEnd, draft, storageKey,
  ]);

  return {
    draft,
    step: draft.step,
    setStep,
    updateSection,
    replaceSection,
    setCloseMode,
    reset,
    submit,
    submitting,
    submitError,
    stepStatus,
    canSeal,
  };
}

export default useCycleClosureDraft;
