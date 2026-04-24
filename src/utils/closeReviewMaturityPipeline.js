/**
 * closeReviewMaturityPipeline
 * @description Sequência executada no close (DRAFT→CLOSED) da revisão semanal
 *              ANTES de montar o `frozenSnapshot`:
 *
 *                1. Dispara callable `recomputeStudentMaturity` — snapshot fresh
 *                   do motor (§3.1 D11). Throttled (1×/h por caller) é tratado
 *                   como no-op silencioso: significa que o doc atual já foi
 *                   recomputado recentemente, pode ser lido direto.
 *                2. Lê `students/{uid}/maturity/current` pós-recompute.
 *                3. Se `shouldGenerateAI(fresh)` → dispara
 *                   `classifyMaturityProgression` (fire-and-forget) com tradesSummary
 *                   derivado do `kpis` já calculado pelo caller (a narrativa vem
 *                   via cache do próximo render; não bloqueia o publish).
 *                4. Retorna o doc fresco do maturity — o caller passa para
 *                   `buildClientSnapshot({ maturity })`, que congela via
 *                   `freezeMaturity` preservando TODO o schema (incluindo o array
 *                   completo de `gates` com `{ met, value, threshold, gap }`,
 *                   `gatesMet`, `gatesTotal`).
 *
 * Policy de IA trigger: reusa `shouldGenerateAI` de `./maturityAITrigger` — nenhuma
 * duplicação. Entrada cacheada (trigger atual === aiTrigger gravado E aiNarrative
 * presente) → IA NÃO é chamada.
 *
 * Isolamento: nunca lança — falhas são logadas e o caller recebe `null` no campo
 * `maturity`. Close da revisão não pode depender da saúde do motor de maturidade.
 *
 * @see Issue #119 task 21 (H2)
 */

import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { currentTrigger, shouldGenerateAI } from './maturityAITrigger';

/**
 * Monta o input esperado por `classifyMaturityProgression` a partir do doc
 * `maturity/current` + `kpis` do snapshot em construção. É o mínimo necessário
 * para satisfazer o validator da CF sem replicar engines emotional/compliance.
 *
 * @param {Object} maturity  — doc students/{uid}/maturity/current
 * @param {Object} kpis      — payload gerado por buildClientSnapshot
 * @param {string} trigger   — 'UP' | 'REGRESSION' (derivado do maturity)
 * @param {number} windowSize — quantos trades no período (filteredTrades.length)
 * @returns {Object|null} input validado ou null se faltar campo obrigatório
 */
export function buildClassifyInput(maturity, kpis, trigger, windowSize, studentId) {
  if (!maturity || !studentId || !trigger) return null;
  const scores = maturity.dimensionScores ?? {};
  const gates = Array.isArray(maturity.gates) ? maturity.gates : [];
  return {
    studentId,
    currentStage: maturity.currentStage,
    baselineStage: maturity.baselineStage ?? maturity.currentStage,
    scores,
    // Baseline real viria de assessment/initial_assessment. Placeholder = scores
    // atuais (mesmo padrão do StudentDashboard — DEC-AUTO-119-14 refina em follow-up).
    baselineScores: scores,
    gates,
    tradesSummary: {
      windowSize,
      winRate: kpis?.wr ?? null,
      payoff: kpis?.payoff ?? null,
      expectancy: kpis?.evPerTrade ?? null,
      maxDDPercent: null,
      avgDuration: kpis?.avgHoldTimeMin ?? null,
      tiltCount: kpis?.emotional?.tiltCount ?? 0,
      revengeCount: kpis?.emotional?.revengeCount ?? 0,
      complianceRate: kpis?.compliance?.overall != null
        ? kpis.compliance.overall / 100
        : null,
      journalRate: null,
    },
    trigger,
  };
}

/**
 * Executa recompute + (opcional) dispatch de narrativa IA, retornando o doc
 * fresco. Nunca lança: falhas viram log + return `{ maturity: null }`.
 *
 * @param {Object} opts
 * @param {string} opts.studentId
 * @param {Object} [opts.recomputeCallable] — override para testes
 * @param {Object} [opts.classifyCallable]  — override para testes
 * @param {Object} [opts.dbRef]             — override do Firestore client
 * @returns {Promise<{ maturity: Object|null, aiDispatched: boolean, throttled: boolean }>}
 */
export async function recomputeAndReadMaturity({
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
    // Rate limit OU falha transitória: continua para ler doc atual — a sessão
    // pode ter recomputado minutos atrás e o snapshot ainda é representativo.
    console.warn('[closeReviewMaturityPipeline] recompute call failed:', err?.message || err);
  }

  let maturity = null;
  try {
    const snap = await getDoc(doc(firestore, 'students', studentId, 'maturity', 'current'));
    maturity = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[closeReviewMaturityPipeline] maturity read failed:', err?.message || err);
  }

  return { maturity, throttled };
}

/**
 * Fire-and-forget da narrativa IA quando `shouldGenerateAI` retorna true.
 *
 * Retorna `true` se o dispatch foi iniciado (promise in-flight), `false` se
 * nenhuma condição foi satisfeita (cache hit, maturity null, ou input inválido).
 * Nunca lança — qualquer erro de callable é capturado e logado.
 *
 * O caller NÃO deve aguardar — a CF persiste `aiNarrative` em maturity/current,
 * e o próximo render do StudentDashboard/ReviewPage detecta via listener.
 */
export function maybeDispatchMaturityAI({
  studentId,
  maturity,
  kpis,
  windowSize,
  classifyCallable,
}) {
  if (!maturity || !studentId) return false;
  if (!shouldGenerateAI(maturity)) return false;
  const trig = currentTrigger(maturity);
  if (!trig) return false;

  const input = buildClassifyInput(maturity, kpis, trig, windowSize ?? 0, studentId);
  if (!input) return false;

  const classify = classifyCallable
    ?? httpsCallable(functions, 'classifyMaturityProgression');

  // Fire-and-forget: não await.
  Promise.resolve()
    .then(() => classify(input))
    .catch((err) => {
      console.warn('[closeReviewMaturityPipeline] classify dispatch failed:', err?.message || err);
    });

  return true;
}
