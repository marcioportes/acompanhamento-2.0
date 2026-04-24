/**
 * onboardingMaturityPipeline
 * @description Sequência executada ao concluir o assessment 4D do onboarding
 *              (marco zero — `saveInitialAssessment`) para garantir que o aluno
 *              chegue ao dashboard com um snapshot de maturidade fresco ANTES do
 *              primeiro trade (§3.1 D11 — gatilho pós-onboarding, issue #119
 *              task 22 H3).
 *
 *                1. Dispara callable `recomputeStudentMaturity` — engine gera o
 *                   primeiro doc `students/{uid}/maturity/current` usando o
 *                   baseline recém-gravado em `assessment/initial_assessment`.
 *                   Throttled (1×/h por caller) é no-op silencioso; não bloqueia
 *                   a conclusão do onboarding.
 *                2. Dispara `classifyMaturityProgression` com `trigger:
 *                   'ONBOARDING_INITIAL'` — welcome narrative em tom "espelho"
 *                   sobre o stage diagnosticado. É **fire-and-forget**: a IA
 *                   persiste `aiNarrative` via cache (§3.1 D12); o próximo
 *                   render do StudentDashboard detecta via listener.
 *
 * Semântica do trigger `ONBOARDING_INITIAL` (DEC-AUTO-119-16):
 *   - Não é derivado de `currentTrigger(maturity)` — é forçado pelo caller.
 *     `currentTrigger` NUNCA retorna `ONBOARDING_INITIAL` (continua apenas
 *     `'UP' | 'REGRESSION' | null`), então `shouldGenerateAI` segue a mesma
 *     lógica existente nos demais paths. O próprio callsite deste pipeline
 *     dispara a IA incondicionalmente (não passa por `shouldGenerateAI`).
 *   - O campo `aiTrigger` persistido em `maturity/current` passa a aceitar o
 *     terceiro valor. Após o primeiro trade real, `currentTrigger` devolverá
 *     `'UP'` ou `'REGRESSION'` (ou null); `shouldGenerateAI` comparará com o
 *     cached `'ONBOARDING_INITIAL'`, concluirá que são diferentes e disparará
 *     a nova narrativa. Cache policy preservada.
 *
 * Isolamento: nunca lança. O close do onboarding (transição para
 * `onboardingStatus: 'active'`) NÃO pode depender da saúde do motor/IA —
 * qualquer erro aqui vira log + return `{ maturity: null, aiDispatched: false }`.
 * Engine recompute, por outro lado, é aguardado (`await`) — se falhar por
 * throttle, seguimos; se falhar por outra razão, ainda seguimos, mas o aluno
 * pode chegar ao dashboard sem snapshot fresh (caso raro — fallback para o
 * path antigo `onTradeCreated`).
 *
 * @see Issue #119 task 22 (H3) — escopo adicional
 */

import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

export const ONBOARDING_INITIAL_TRIGGER = 'ONBOARDING_INITIAL';

/**
 * Monta input para `classifyMaturityProgression` no trigger `ONBOARDING_INITIAL`.
 * Usa scores do próprio doc maturity como baseline (o baseline "real" veio do
 * assessment e já foi aplicado pelo engine no primeiro recompute — mesmo padrão
 * do `closeReviewMaturityPipeline.buildClassifyInput`, DEC-AUTO-119-14).
 *
 * `tradesSummary` é quase todo nulo no marco zero: o aluno ainda não tem trades
 * registrados. Passamos `windowSize: 0` e demais campos null — a CF aceita
 * porque `tradesSummary` precisa só ser um object; os formatters internos
 * devolvem 'n/a' em null.
 *
 * @param {Object} maturity — doc students/{uid}/maturity/current após recompute inicial
 * @param {string} studentId
 * @returns {Object|null} input validado para CF, ou null se inputs inválidos
 */
export function buildOnboardingClassifyInput(maturity, studentId) {
  if (!maturity || !studentId) return null;
  const scores = maturity.dimensionScores ?? {};
  const gates = Array.isArray(maturity.gates) ? maturity.gates : [];
  return {
    studentId,
    currentStage: maturity.currentStage,
    baselineStage: maturity.baselineStage ?? maturity.currentStage,
    scores,
    baselineScores: scores,
    gates,
    tradesSummary: {
      windowSize: 0,
      winRate: null,
      payoff: null,
      expectancy: null,
      maxDDPercent: null,
      avgDuration: null,
      tiltCount: 0,
      revengeCount: 0,
      complianceRate: null,
      journalRate: null,
    },
    trigger: ONBOARDING_INITIAL_TRIGGER,
  };
}

/**
 * Executa recompute do motor de maturidade para o aluno recém-onboarded.
 *
 * Aguarda (await) — o dashboard pós-onboarding precisa ler o doc fresh. Se o
 * callable lançar ou throttlar, logamos e prosseguimos: o doc atual (se já
 * recomputado em outra ocasião) ainda é representativo do baseline. Nunca
 * relança.
 *
 * @param {Object} opts
 * @param {string} opts.studentId
 * @param {Object} [opts.recomputeCallable] — override para testes
 * @param {Object} [opts.dbRef]             — override do Firestore client
 * @returns {Promise<{ maturity: Object|null, throttled: boolean }>}
 */
export async function recomputeAndReadMaturityForOnboarding({
  studentId,
  recomputeCallable,
  dbRef,
} = {}) {
  if (!studentId) return { maturity: null, throttled: false };

  const recompute = recomputeCallable
    ?? httpsCallable(functions, 'recomputeStudentMaturity');
  const firestore = dbRef ?? db;

  let throttled = false;
  try {
    const res = await recompute({ studentId });
    if (res?.data?.throttled) throttled = true;
  } catch (err) {
    console.warn('[onboardingMaturityPipeline] recompute call failed:', err?.message || err);
  }

  let maturity = null;
  try {
    const snap = await getDoc(doc(firestore, 'students', studentId, 'maturity', 'current'));
    maturity = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[onboardingMaturityPipeline] maturity read failed:', err?.message || err);
  }

  return { maturity, throttled };
}

/**
 * Fire-and-forget da welcome narrative no trigger `ONBOARDING_INITIAL`.
 *
 * Não passa por `shouldGenerateAI` — o pipeline de onboarding força o disparo
 * uma vez, independente do estado do `proposedTransition`/`signalRegression`
 * (que no marco zero valem `null`/`false`). Isso é o único caller que
 * bypassa a policy de cache, por design.
 *
 * Retorna `true` se o dispatch foi iniciado (promise in-flight), `false` se
 * inputs inválidos. Nunca lança.
 *
 * @param {Object} opts
 * @param {string} opts.studentId
 * @param {Object} opts.maturity           — doc fresh pós-recompute
 * @param {Object} [opts.classifyCallable] — override para testes
 * @returns {boolean}
 */
export function dispatchOnboardingMaturityAI({
  studentId,
  maturity,
  classifyCallable,
}) {
  if (!maturity || !studentId) return false;

  const input = buildOnboardingClassifyInput(maturity, studentId);
  if (!input) return false;

  const classify = classifyCallable
    ?? httpsCallable(functions, 'classifyMaturityProgression');

  // Fire-and-forget: não await.
  Promise.resolve()
    .then(() => classify(input))
    .catch((err) => {
      console.warn('[onboardingMaturityPipeline] classify dispatch failed:', err?.message || err);
    });

  return true;
}

/**
 * Pipeline completo pós-saveInitialAssessment: recompute (await) + IA (fire-and-forget).
 *
 * Retorna `{ maturity, aiDispatched, throttled }` para o caller inspecionar (testes/UI),
 * mas o caller deve prosseguir com navegação para dashboard mesmo em caso de falha total.
 *
 * @param {Object} opts
 * @param {string} opts.studentId
 * @param {Object} [opts.recomputeCallable]
 * @param {Object} [opts.classifyCallable]
 * @param {Object} [opts.dbRef]
 * @returns {Promise<{ maturity: Object|null, aiDispatched: boolean, throttled: boolean }>}
 */
export async function runOnboardingMaturityPipeline({
  studentId,
  recomputeCallable,
  classifyCallable,
  dbRef,
} = {}) {
  const { maturity, throttled } = await recomputeAndReadMaturityForOnboarding({
    studentId,
    recomputeCallable,
    dbRef,
  });

  const aiDispatched = dispatchOnboardingMaturityAI({
    studentId,
    maturity,
    classifyCallable,
  });

  return { maturity, aiDispatched, throttled };
}
