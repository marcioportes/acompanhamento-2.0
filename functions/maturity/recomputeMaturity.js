// ============================================
// MATURITY ENGINE — Cloud Function orchestrator (issue #119 task 07)
// ============================================
//
// Orquestra fetch + compute + write para `students/{uid}/maturity/{current|history/...}`.
// Isolamento (INV-03): falhas internas NÃO propagam — sempre retorna { skipped, ... }.
// Gate: roda apenas quando trade.status === 'CLOSED' (§3.1 D11).
//
// Path D10 (literal, sub-sub-collection):
//   students/{uid}/maturity/current                                ← doc
//   students/{uid}/maturity/_historyBucket/history/{YYYY-MM-DD}    ← sub-sub-collection
// firestore.rules cobre via {docId=**} recursivo.

const { evaluateMaturity } = require('./evaluateMaturity');
const { validateCurrentDoc, validateHistoryDoc } = require('./maturityDocSchema');
const { preComputeShapes } = require('./preComputeShapes');

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoDate(d) {
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  return `${yyyy}-${mm}-${dd}`;
}

function tradeIsoDay(value) {
  if (value instanceof Date) return isoDate(value);
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/**
 * Lógica pura — recebe dados pré-fetched, retorna payloads para current+history.
 * Zero side-effects. Testável diretamente sem mocks de Firestore.
 */
function buildMaturityPayloads({
  trades,
  plans,
  now,
  stageCurrent,
  baselineStage,
  baseline,
  emotionalAnalysis,
  complianceRate,
  stats,
  evLeakage,
  payoff,
  consistencyCV,
  maxDrawdown,
  advancedMetricsPresent,
  complianceRate100,
  lastTradeId,
  serverTimestamp,
  asOfTimestamp,
}) {
  const engineOutput = evaluateMaturity({
    trades,
    plans,
    now,
    stageCurrent,
    baseline,
    emotionalAnalysis,
    complianceRate,
    stats,
    evLeakage,
    payoff,
    consistencyCV,
    maxDrawdown,
    advancedMetricsPresent,
    complianceRate100,
  });

  const todayIso = isoDate(now);
  const tradesInDay = (Array.isArray(trades) ? trades : []).filter(
    (t) => tradeIsoDay(t?.date) === todayIso,
  ).length;

  const computedAt = serverTimestamp ?? null;

  const currentDoc = {
    ...engineOutput,
    currentStage: stageCurrent,
    baselineStage: baselineStage ?? stageCurrent,
    stageHistory: [],
    lastTradeId: lastTradeId ?? null,
    computedAt,
    asOf: asOfTimestamp ?? null,
    aiNarrative: null,
    aiPatternsDetected: [],
    aiNextStageGuidance: null,
    aiGeneratedAt: null,
    aiTrigger: null,
  };

  const historyDoc = {
    date: todayIso,
    dimensionScores: engineOutput.dimensionScores,
    currentStage: stageCurrent,
    gatesMet: engineOutput.gatesMet,
    gatesTotal: engineOutput.gatesTotal,
    confidence: engineOutput.confidence,
    tradesInDay,
    computedAt,
    engineVersion: engineOutput.engineVersion,
  };

  const currentValidation = validateCurrentDoc(currentDoc);
  const historyValidation = validateHistoryDoc(historyDoc);

  return {
    currentDoc,
    historyDoc,
    valid: currentValidation.valid && historyValidation.valid,
    errors: [...currentValidation.errors, ...historyValidation.errors],
  };
}

/**
 * Handler CF — orquestra fetch + compute + write. Isolamento total (INV-03).
 * Gate: trade.status === 'CLOSED' E trade.studentId presente.
 */
async function runMaturityRecompute(db, { tradeId, trade, admin: adminOverride } = {}) {
  if (!trade || trade.status !== 'CLOSED') {
    return { skipped: true, reason: 'status != CLOSED' };
  }

  const studentId = trade.studentId;
  if (!studentId) {
    return { skipped: true, reason: 'missing studentId' };
  }

  return recomputeForStudent(db, studentId, { lastTradeId: tradeId, admin: adminOverride });
}

/**
 * Student-level recompute. Reusável por CF trigger (via `runMaturityRecompute`)
 * ou por script de backfill (iterando todos os alunos).
 * Isolamento total: exceções viram `{ skipped: true, reason: 'exception' }`.
 */
async function recomputeForStudent(db, studentId, { lastTradeId = null, admin: adminOverride = null } = {}) {
  // Lazy require: mantém buildMaturityPayloads testável sem firebase-admin instalado.
  // Tests podem injetar `admin` via param para evitar depender do package real.
  const admin = adminOverride ?? require('firebase-admin');

  try {
    const assessmentSnap = await db
      .collection('students').doc(studentId)
      .collection('assessment').doc('initial_assessment').get();
    const assessment = assessmentSnap.exists ? assessmentSnap.data() : null;
    // Schema do initial_assessment (StudentOnboardingPage.jsx:437):
    // - experience.stage (1..5) — stage diagnosticado pela IA + validado pelo mentor
    // - emotional.score, financial.score, operational.fit_score — dimensões 0..100
    // Fallback para `assessment.stage` / `assessment.dimensionScores` mantido por
    // compatibilidade caso schema evolua; default neutro (stage=1 / scores=50).
    const baselineStage = assessment?.experience?.stage
      ?? assessment?.stage_diagnosis?.stage
      ?? assessment?.stage
      ?? 1;
    const baseline = assessment
      ? {
        emotional: assessment.emotional?.score ?? 50,
        financial: assessment.financial?.score ?? 50,
        operational: assessment.operational?.fit_score ?? 50,
      }
      : (assessment?.dimensionScores ?? { emotional: 50, financial: 50, operational: 50 });

    const currentSnap = await db
      .collection('students').doc(studentId)
      .collection('maturity').doc('current').get();
    // DEC-020: regressão nunca automática. Stage atual é MAX(gravado, baseline) —
    // engine jamais coloca o aluno abaixo do stage diagnosticado no assessment,
    // a não ser que um reset manual do mentor apague/resete o baseline.
    // Corrige bug onde primeiro recompute pré-fix (f4c72941) havia gravado
    // stage=1 (Caos), prendendo alunos legados abaixo do baseline real.
    const storedStage = currentSnap.exists
      ? (currentSnap.data().currentStage ?? baselineStage)
      : baselineStage;
    const stageCurrent = Math.max(storedStage, baselineStage);

    const tradesSnap = await db.collection('trades')
      .where('studentId', '==', studentId)
      .where('status', '==', 'CLOSED')
      .get();
    const trades = tradesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const plansSnap = await db.collection('plans')
      .where('studentId', '==', studentId)
      .get();
    const plans = plansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const preComputed = preComputeShapes({ trades, plans });

    const now = new Date();
    const payloads = buildMaturityPayloads({
      trades,
      plans,
      now,
      stageCurrent,
      baselineStage,
      baseline,
      ...preComputed,
      lastTradeId,
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      asOfTimestamp: admin.firestore.Timestamp.fromDate(now),
    });

    if (!payloads.valid) {
      console.error('[maturityRecompute] schema validation failed:', payloads.errors);
      return { skipped: true, reason: 'schema validation failed', errors: payloads.errors };
    }

    const batch = db.batch();
    const currentRef = db.collection('students').doc(studentId)
      .collection('maturity').doc('current');
    const historyRef = db.collection('students').doc(studentId)
      .collection('maturity').doc('_historyBucket')
      .collection('history').doc(payloads.historyDoc.date);

    batch.set(currentRef, payloads.currentDoc, { merge: true });
    batch.set(historyRef, payloads.historyDoc, { merge: true });
    await batch.commit();

    return {
      skipped: false,
      tradeId: lastTradeId,
      studentId,
      windowSize: payloads.currentDoc.windowSize,
      currentStage: payloads.currentDoc.currentStage,
    };
  } catch (err) {
    console.error('[maturityRecompute] exception:', studentId, lastTradeId, err);
    return { skipped: true, reason: 'exception', error: err.message };
  }
}

module.exports = { buildMaturityPayloads, runMaturityRecompute, recomputeForStudent };
