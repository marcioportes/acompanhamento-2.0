// ============================================
// MATURITY ENGINE — Cloud Function orchestrator (issue #119 task 07)
// ============================================
//
// Orquestra fetch + compute + write para `students/{uid}/maturity/{current|history/...}`.
// Isolamento (INV-03): falhas internas NÃO propagam — sempre retorna { skipped, ... }.
// Gate: roda apenas para trades com resultado registrado (execução fechada).
// Antes filtrávamos por trade.status === 'CLOSED', mas isso é semântica de
// revisão (lifecycle OPEN→REVIEWED→CLOSED no fluxo de feedback do mentor) —
// não de execução. Trade é monolítico desde a criação; o que importa para o
// motor é que tenha resultado fechado (result numérico).
//
// Path D10 (literal, sub-sub-collection):
//   students/{uid}/maturity/current                                ← doc
//   students/{uid}/maturity/_historyBucket/history/{YYYY-MM-DD}    ← sub-sub-collection
// firestore.rules cobre via {docId=**} recursivo.

const { evaluateMaturity } = require('./evaluateMaturity');
const { validateCurrentDoc, validateHistoryDoc } = require('./maturityDocSchema');
const { preComputeShapes } = require('./preComputeShapes');
const { recomputeBehaviorProfiles } = require('../behavior/recomputeBehaviorProfiles');

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
/**
 * A janela do estágio atual — #101, "promoção zera tudo".
 *
 * Devolve só os trades a partir da entrada no estágio. Sem promoção registrada
 * (`stageSince` ausente), a janela é o histórico inteiro: aluno que nunca foi
 * promovido não teve vida nova.
 *
 * @param {Array} trades
 * @param {any} stageSince — Timestamp do Firestore, Date ou 'YYYY-MM-DD'
 * @returns {Array}
 */
function tradesDoEstagioAtual(trades, stageSince) {
  const lista = Array.isArray(trades) ? trades : [];
  const desde = stageSince?.toDate?.()?.toISOString?.().slice(0, 10)
    ?? (stageSince instanceof Date ? stageSince.toISOString().slice(0, 10) : null)
    ?? (typeof stageSince === 'string' ? stageSince.slice(0, 10) : null);
  if (!desde) return lista;
  return lista.filter((t) => typeof t?.date === 'string' && t.date >= desde);
}

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
  executionEvents,
  tradesWithOrderData,
  lastTradeId,
  serverTimestamp,
  asOfTimestamp,
  stageHistory = [],
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
    executionEvents,
    tradesWithOrderData,
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
    // #101 — aqui era `stageHistory: []` fixo, e `{merge: true}` NÃO protege array:
    // o merge substitui o campo pelo valor novo. Todo recompute zerava o histórico
    // de promoções — foi por isso que o Wilson apareceu com `stageHistory: []`
    // minutos depois de ser promovido, sem registro de quem promoveu nem quando.
    // Agora o histórico existente entra de volta no payload; o campo continua no
    // schema, mas o recompute deixou de ser o lugar que o apaga.
    stageHistory: Array.isArray(stageHistory) ? stageHistory : [],
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
 * Gate: trade tem resultado registrado (execução fechada) E trade.studentId presente.
 */
async function runMaturityRecompute(db, { tradeId, trade, admin: adminOverride } = {}) {
  if (!trade) {
    return { skipped: true, reason: 'no trade' };
  }
  const hasResult = typeof trade.result === 'number' && Number.isFinite(trade.result);
  if (!hasResult) {
    return { skipped: true, reason: 'no result registered' };
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

    // #101 — desde quando o aluno está NESTE estágio. Sem esta marca não há como
    // separar "regrediu" de "acabou de ser promovido", e o motor emitia regressão
    // na primeira execução depois de toda promoção (o gatilho 3 compara métricas
    // com o estágio atual, que subiu sem os dados mudarem).
    // Grava na primeira vez que faltar: a carência começa hoje para quem já está
    // no meio do caminho.
    const dadosAtuais = currentSnap.exists ? currentSnap.data() : null;
    const stageSince = dadosAtuais?.stageSince ?? null;

    // NOTA: query NÃO filtra por status (semântica de revisão, não execução).
    // O engine consume trades com resultado fechado; o filtro semântico de
    // execução é o `result` numérico finito, feito downstream em preComputeShapes.
    const tradesSnap = await db.collection('trades')
      .where('studentId', '==', studentId)
      .get();
    const trades = tradesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // #101 — PROMOÇÃO ZERA TUDO (Marcio, 29/08): "uma vez promovido, tudo deve ser
    // zerado, é como se ele começasse de novo".
    //
    // O motor passa a enxergar SÓ os trades a partir da entrada no estágio. Não é
    // filtro cosmético: gates, métricas, composite e regressão são recalculados
    // sobre a vida nova. Sem isso o gatilho 3 do detector — que compara métricas
    // com o estágio ATUAL — acusava regressão em toda promoção, porque o estágio
    // subia e os dados eram os mesmos. Foi o que aconteceu com o Wilson.
    //
    // O histórico anterior não some do produto: continua nos trades, no extrato e
    // no `_historyBucket`. O que muda é a régua — ela mede o estágio atual.
    const tradesDoEstagio = tradesDoEstagioAtual(trades, stageSince);

    const plansSnap = await db.collection('plans')
      .where('studentId', '==', studentId)
      .get();
    const plans = plansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Issue #208 — orders só têm valor se correlacionadas. Carrega todas e o
    // sensor filtra por `correlatedTradeId` populado pela pipeline.
    let orders = [];
    try {
      const ordersSnap = await db.collection('orders')
        .where('studentId', '==', studentId)
        .get();
      orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (ordErr) {
      console.warn('[maturityRecompute] failed to load orders, executionEvents=[]:',
        ordErr.message);
    }

    // Issue #189: carrega tabela de emoções para o mirror emocional consumir.
    // Sem isso, preComputeShapes cai no fallback { 50, 0, 0 } (D6 preservada).
    let emotions = [];
    try {
      const emotionsSnap = await db.collection('emotions').get();
      emotions = emotionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (emErr) {
      console.warn('[maturityRecompute] failed to load emotions, fallback neutral:',
        emErr.message);
    }

    // CHUNK-11 Fase 2 (#301): recomputa trade.behaviorProfile (motor unificado) a partir
    // dos mesmos dados já carregados. Isolado (INV-03): falha aqui não afeta a maturidade.
    // Grava só o delta por fingerprint; behaviorProfile está fora do guard de
    // onTradeUpdated (index.js:1446) → o write não re-dispara recompute.
    try {
      await recomputeBehaviorProfiles(db, admin, { trades, plans, orders, emotions });
    } catch (behErr) {
      console.warn('[maturityRecompute] behaviorProfile recompute failed:', behErr.message);
    }

    const now = new Date();
    // A partir daqui, a régua é a do ESTÁGIO ATUAL: `tradesDoEstagio`, não `trades`.
    // O `recomputeBehaviorProfiles` acima continua vendo tudo de propósito — o perfil
    // comportamental do trade é fato do trade, não da fase do aluno.
    const preComputed = preComputeShapes({ trades: tradesDoEstagio, plans, now, emotions, orders });

    const payloads = buildMaturityPayloads({
      trades: tradesDoEstagio,
      plans,
      now,
      stageCurrent,
      baselineStage,
      baseline,
      ...preComputed,
      lastTradeId,
      stageHistory: dadosAtuais?.stageHistory ?? [],
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

    // `stageSince` nasce aqui quando falta e NUNCA é sobrescrito depois: quem o
    // move é a promoção (`promoteStudentStage`), não o recompute.
    const docParaGravar = stageSince
      ? payloads.currentDoc
      : { ...payloads.currentDoc, stageSince: admin.firestore.FieldValue.serverTimestamp() };

    batch.set(currentRef, docParaGravar, { merge: true });
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

module.exports = { buildMaturityPayloads, runMaturityRecompute, recomputeForStudent, tradesDoEstagioAtual };
