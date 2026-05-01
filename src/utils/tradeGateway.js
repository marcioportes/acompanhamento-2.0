/**
 * tradeGateway — Gateway único para escrita em trades (INV-02)
 * @see version.js para versão do produto
 *
 * Funções puras de escrita na collection `trades`:
 *   - createTrade: criação de novo trade + movement
 *   - enrichTrade: enriquecimento de trade existente com dados da corretora
 *
 * Pipeline createTrade: addDoc(trades) → CF onTradeCreated (PL, compliance)
 *                       addDoc(movements) → CF onMovementCreated (account balance)
 *
 * Pipeline enrichTrade: updateDoc(trades) → CF onTradeUpdated (PL diff, compliance)
 *                       Preserva campos comportamentais (emoção, setup, feedback)
 *                       _enrichmentSnapshot inline para rollback manual
 *
 * O hook useTrades.addTrade é wrapper fino que chama createTrade
 * e adiciona: setLoading, setError, uploadImage.
 */

import {
  collection, query, where, addDoc, getDoc, getDocs, doc, serverTimestamp,
  updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTradeResult, calculateResultPercent } from './calculations';
import { calculateFromPartials, calculateAssumedRR } from './tradeCalculations';

// Campos comportamentais editáveis pelo mentor + protegidos pelo lock (#188 F1).
export const MENTOR_EDITABLE_FIELDS = ['emotionEntry', 'emotionExit', 'setup'];

// Issue #219 — classificação discricionária do mentor sobre o trade.
// 'tecnico' = seguiu modelo operacional. 'sorte' = narrativa solta, sizing fora,
// alucinação. Maturity v1 NÃO consome; KPI diagnóstico apenas.
export const MENTOR_CLASSIFICATION_VALUES = ['tecnico', 'sorte'];
export const MENTOR_CLASSIFICATION_FLAGS = ['narrativa', 'sizing', 'desvio_modelo', 'outro'];

// Fontes válidas de MEP/MEN (issue #187 — DEC-AUTO-187-01).
export const EXCURSION_SOURCES = ['manual', 'profitpro', 'yahoo', 'unavailable'];

// Status constants (espelhado de useTrades)
const DEFAULT_STATUS = 'OPEN';

/**
 * Valida MEP/MEN como preço (DEC-AUTO-187-01) coerente com o lado do trade.
 *
 * Regras:
 *   LONG  → mepPrice >= max(entry, exit), menPrice <= min(entry, exit)
 *   SHORT → mepPrice <= min(entry, exit), menPrice >= max(entry, exit)
 *
 * Aceita null em ambos (nenhum dado de excursão).
 * Aceita apenas um dos dois preenchido (validação por campo independente).
 *
 * @param {Object} input — { side, entry, exit, mepPrice, menPrice }
 * @throws {Error} mensagem clara em caso de inconsistência
 */
export function validateExcursionPrices({ side, entry, exit, mepPrice, menPrice }) {
  if (mepPrice == null && menPrice == null) return;

  const e = parseFloat(entry);
  const x = parseFloat(exit);
  if (!Number.isFinite(e) || !Number.isFinite(x)) {
    throw new Error('MEP/MEN exigem entry e exit numéricos válidos para validação');
  }
  if (side !== 'LONG' && side !== 'SHORT') {
    throw new Error(`MEP/MEN: side desconhecido (${side})`);
  }

  const hi = Math.max(e, x);
  const lo = Math.min(e, x);

  if (side === 'LONG') {
    if (mepPrice != null && mepPrice < hi) {
      throw new Error(`MEP de LONG (${mepPrice}) deve ser >= max(entry, exit) (${hi})`);
    }
    if (menPrice != null && menPrice > lo) {
      throw new Error(`MEN de LONG (${menPrice}) deve ser <= min(entry, exit) (${lo})`);
    }
  } else {
    if (mepPrice != null && mepPrice > lo) {
      throw new Error(`MEP de SHORT (${mepPrice}) deve ser <= min(entry, exit) (${lo})`);
    }
    if (menPrice != null && menPrice < hi) {
      throw new Error(`MEN de SHORT (${menPrice}) deve ser >= max(entry, exit) (${hi})`);
    }
  }
}

/**
 * Normaliza tripla MEP/MEN/source vinda do caller para forma persistente.
 * Aceita strings numéricas vazias → null. Source desconhecida → null.
 */
function normalizeExcursionInput({ mepPrice, menPrice, excursionSource }) {
  const parsePriceOrNull = (v) => {
    if (v == null || v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const mep = parsePriceOrNull(mepPrice);
  const men = parsePriceOrNull(menPrice);
  let source = null;
  if (excursionSource && EXCURSION_SOURCES.includes(excursionSource)) {
    source = excursionSource;
  }
  // Sem dado e sem source → tudo null. Com pelo menos um dado e sem source → 'manual' default.
  if ((mep != null || men != null) && source == null) source = 'manual';
  return { mepPrice: mep, menPrice: men, excursionSource: source };
}

/**
 * Calcula duração em minutos entre dois ISO timestamps
 * @param {string|null} entryISO
 * @param {string|null} exitISO
 * @returns {number} minutos
 */
const calculateDuration = (entryISO, exitISO) => {
  if (!entryISO || !exitISO) return 0;
  try {
    const start = new Date(entryISO);
    const end = new Date(exitISO);
    return Math.floor((end - start) / 60000);
  } catch (e) {
    console.error('[tradeGateway] Erro duração:', e);
    return 0;
  }
};

/**
 * Cria um trade na collection `trades` + movement correspondente.
 *
 * Contrato de retorno idêntico ao antigo addTrade: { id: string, ...tradeFields }
 *
 * @param {Object} tradeData - Dados do trade (ticker, side, entry, exit, qty, planId, etc.)
 * @param {Object} userContext - { uid, email, displayName }
 * @returns {Promise<{ id: string, [key: string]: any }>}
 */
export async function createTrade(tradeData, userContext) {
  if (!userContext?.uid) throw new Error('Usuário não autenticado');

  // === 1. VALIDAÇÃO PLANO/CONTA ===
  if (!tradeData.planId) throw new Error('Selecione um Plano.');
  const planRef = doc(db, 'plans', tradeData.planId);
  const planSnap = await getDoc(planRef);
  if (!planSnap.exists()) throw new Error('Plano não encontrado.');
  const planData = planSnap.data();
  const derivedAccountId = planData.accountId;
  if (!derivedAccountId) throw new Error('Plano sem conta vinculada.');

  // Busca moeda da conta para persistir no trade
  const accountRef = doc(db, 'accounts', derivedAccountId);
  const accountSnap = await getDoc(accountRef);
  const derivedCurrency = accountSnap.exists() ? (accountSnap.data().currency || 'BRL') : 'BRL';

  // === 2. CÁLCULO DE RESULT ===
  const entry = parseFloat(tradeData.entry);
  const exit = parseFloat(tradeData.exit);
  const qty = parseFloat(tradeData.qty);
  const side = tradeData.side;
  let result;
  let resultInPoints = 0;

  if (tradeData._partials?.length > 0) {
    // Cálculo via parciais (SEMPRE preferido)
    const calc = calculateFromPartials({
      side,
      partials: tradeData._partials,
      tickerRule: tradeData.tickerRule || null
    });
    result = calc.result;
    resultInPoints = calc.resultInPoints;
  } else if (tradeData.tickerRule?.tickSize && tradeData.tickerRule?.tickValue) {
    const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
    resultInPoints = Math.round(rawDiff * 100) / 100;
    const ticks = rawDiff / tradeData.tickerRule.tickSize;
    result = Math.round(ticks * tradeData.tickerRule.tickValue * qty);
  } else {
    result = Math.round(calculateTradeResult(side, entry, exit, qty));
    resultInPoints = side === 'LONG' ? exit - entry : entry - exit;
  }

  // === 2.1. EXCURSION (MEP/MEN — issue #187) ===
  const excursion = normalizeExcursionInput({
    mepPrice: tradeData.mepPrice,
    menPrice: tradeData.menPrice,
    excursionSource: tradeData.excursionSource,
  });
  validateExcursionPrices({
    side, entry, exit,
    mepPrice: excursion.mepPrice,
    menPrice: excursion.menPrice,
  });

  // === 3. TIMESTAMPS ===
  const entryTime = tradeData.entryTime;
  const exitTime = tradeData.exitTime || null;
  const duration = calculateDuration(entryTime, exitTime);
  const legacyDate = entryTime ? entryTime.split('T')[0] : new Date().toISOString().split('T')[0];

  // === 4. CÁLCULO DE RR ===
  const stopLoss = tradeData.stopLoss != null ? parseFloat(tradeData.stopLoss) : null;
  const effectiveResult = (tradeData.resultOverride != null && !isNaN(parseFloat(tradeData.resultOverride)))
    ? Math.round(parseFloat(tradeData.resultOverride) * 100) / 100
    : Math.round(result * 100) / 100;

  let rrRatio = null;
  let rrAssumed = false;
  if (stopLoss != null && stopLoss !== 0 && entry) {
    // RR real: baseado no stop loss efetivo
    const risk = Math.abs(entry - stopLoss);
    if (risk > 0) {
      rrRatio = Math.round((effectiveResult / (risk * (tradeData.tickerRule?.pointValue || 1) * qty)) * 100) / 100;
    }
  } else {
    // RR assumido: baseado no RO$ do plano (DEC-007: usa plan.pl = capital base)
    const assumed = calculateAssumedRR({
      result: effectiveResult,
      planPl: Number(planData.pl) || 0,
      planRiskPerOperation: Number(planData.riskPerOperation) || 0,
      planRrTarget: Number(planData.rrTarget) || 0,
    });
    if (assumed) {
      rrRatio = assumed.rrRatio;
      rrAssumed = true;
    }
  }

  // === 5. MONTAGEM DO DOCUMENTO ===
  const newTrade = {
    ...tradeData,
    date: legacyDate, entryTime, exitTime, duration,
    ticker: tradeData.ticker?.toUpperCase() || '',
    entry, exit, qty,
    stopLoss,
    resultCalculated: Math.round(result * 100) / 100,
    result: effectiveResult,
    resultInPoints: (tradeData.resultOverride != null) ? null : resultInPoints,
    resultEdited: tradeData.resultOverride != null,
    resultPercent: calculateResultPercent(side, entry, exit),
    rrRatio,
    rrAssumed,
    hasPartials: (tradeData._partials?.length || 0) > 0,
    partialsCount: tradeData._partials?.length || 0,
    studentEmail: userContext.email,
    studentName: userContext.displayName || userContext.email.split('@')[0],
    studentId: userContext.uid,
    status: DEFAULT_STATUS,
    accountId: derivedAccountId,
    currency: derivedCurrency,
    mepPrice: excursion.mepPrice,
    menPrice: excursion.menPrice,
    excursionSource: excursion.excursionSource,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    htfUrl: null, ltfUrl: null, mentorFeedback: null,
    feedbackHistory: []
  };

  // === 6. ESCRITA EM TRADES ===
  const docRef = await addDoc(collection(db, 'trades'), newTrade);

  // _partials já está no documento via spread de tradeData
  // Não existe subcollection — parciais são campo array no documento do trade (INV-12)
  console.log(`[tradeGateway] Trade criado: ${docRef.id} com ${tradeData._partials?.length || 0} parciais`);

  // === 7. CRIAÇÃO DE MOVEMENT ===
  if (derivedAccountId && effectiveResult !== 0) {
    const qMoves = query(collection(db, 'movements'), where('accountId', '==', derivedAccountId));
    const snapMoves = await getDocs(qMoves);
    const moves = snapMoves.docs.map(d => d.data()).sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));
    const balanceBefore = moves[0]?.balanceAfter || 0;

    await addDoc(collection(db, 'movements'), {
      accountId: derivedAccountId, type: 'TRADE_RESULT', amount: effectiveResult,
      balanceBefore, balanceAfter: balanceBefore + effectiveResult,
      description: `${tradeData.side} ${tradeData.ticker} (${tradeData.qty}x)`,
      date: legacyDate, dateTime: exitTime || new Date().toISOString(),
      tradeId: docRef.id, studentId: userContext.uid, studentEmail: userContext.email,
      createdBy: userContext.uid, createdAt: serverTimestamp()
    });
  }

  return { id: docRef.id, ...newTrade };
}

// ============================================
// ENRIQUECIMENTO (Modo Confronto — issue #93 redesign V1.1b)
// ============================================

/**
 * Enriquece um trade existente com dados reais de ordens da corretora.
 *
 * Campos atualizados: _partials, entry, exit, qty, stopLoss, result,
 * resultCalculated, resultInPoints, resultPercent, rrRatio, rrAssumed,
 * hasPartials, partialsCount, tickerRule.
 *
 * Campos preservados: emotionEntry, emotionExit, setup, notes, mentorFeedback,
 * feedbackHistory, htfUrl, ltfUrl, status, source, planId, accountId,
 * studentId, date, entryTime, exitTime, createdAt.
 *
 * _enrichmentSnapshot inline guarda estado anterior para rollback manual.
 * Segundo enriquecimento sobrescreve snapshot anterior (Decisão E).
 *
 * @param {string} tradeId
 * @param {Object} enrichment — { _partials, entry, exit, qty, stopLoss, tickerRule, importBatchId }
 * @param {Object} userContext — { uid }
 * @param {Object} [deps] — injeção de Firestore fns para testes
 * @returns {Promise<{ id: string, before: Object, after: Object }>}
 */
export async function enrichTrade(tradeId, enrichment, userContext, deps = {}) {
  const getDocFn = deps.getDocFn ?? getDoc;
  const updateDocFn = deps.updateDocFn ?? updateDoc;
  const docFn = deps.docFn ?? doc;

  if (!userContext?.uid) throw new Error('Usuário não autenticado');
  if (!tradeId) throw new Error('tradeId obrigatório');

  // 1. Buscar trade atual
  const tradeRef = docFn(db, 'trades', tradeId);
  const tradeSnap = await getDocFn(tradeRef);
  if (!tradeSnap.exists()) throw new Error(`Trade ${tradeId} não encontrado`);
  const before = tradeSnap.data();

  // 2. Validar ownership (defesa em profundidade)
  if (before.studentId && before.studentId !== userContext.uid) {
    throw new Error('Trade não pertence ao usuário atual');
  }

  // 3. Dedup de enriquecimento por batch
  if (before.enrichedByImport && before.importBatchId === enrichment.importBatchId) {
    throw new Error('Trade já enriquecido por este batch');
  }

  // 4. Parse dos campos financeiros
  const entry = parseFloat(enrichment.entry);
  const exit = parseFloat(enrichment.exit);
  const qty = parseFloat(enrichment.qty);
  const stopLoss = enrichment.stopLoss != null ? parseFloat(enrichment.stopLoss) : null;
  const side = before.side; // preserva side do trade original
  const tickerRule = enrichment.tickerRule || before.tickerRule || null;

  // 4.1. Excursion (MEP/MEN — issue #187): aditivo. Quando o caller fornece, valida
  // contra entry/exit pós-enrichment e passa para o patch. Quando ausente, preserva
  // valores existentes no trade (mepPrice/menPrice/excursionSource ficam de fora do patch).
  const hasExcursionPayload = enrichment.mepPrice !== undefined
    || enrichment.menPrice !== undefined
    || enrichment.excursionSource !== undefined;
  let excursionPatch = null;
  if (hasExcursionPayload) {
    const norm = normalizeExcursionInput({
      mepPrice: enrichment.mepPrice,
      menPrice: enrichment.menPrice,
      excursionSource: enrichment.excursionSource,
    });
    validateExcursionPrices({
      side, entry, exit,
      mepPrice: norm.mepPrice,
      menPrice: norm.menPrice,
    });
    excursionPatch = norm;
  }

  // 5. Recalcular result (mesma lógica de createTrade)
  let result;
  let resultInPoints = 0;
  if (enrichment._partials?.length > 0) {
    const calc = calculateFromPartials({ side, partials: enrichment._partials, tickerRule });
    result = calc.result;
    resultInPoints = calc.resultInPoints;
  } else if (tickerRule?.tickSize && tickerRule?.tickValue) {
    const rawDiff = side === 'LONG' ? exit - entry : entry - exit;
    resultInPoints = Math.round(rawDiff * 100) / 100;
    const ticks = rawDiff / tickerRule.tickSize;
    result = Math.round(ticks * tickerRule.tickValue * qty);
  } else {
    result = Math.round(calculateTradeResult(side, entry, exit, qty));
    resultInPoints = side === 'LONG' ? exit - entry : entry - exit;
  }

  // 6. RR (usa planPl do plano atual — preserva DEC-007/009)
  const planRef = docFn(db, 'plans', before.planId);
  const planSnap = await getDocFn(planRef);
  const planData = planSnap.exists() ? planSnap.data() : {};
  const effectiveResult = Math.round(result * 100) / 100;

  let rrRatio = null;
  let rrAssumed = false;
  if (stopLoss != null && stopLoss !== 0 && entry) {
    const risk = Math.abs(entry - stopLoss);
    if (risk > 0) {
      rrRatio = Math.round((effectiveResult / (risk * (tickerRule?.pointValue || 1) * qty)) * 100) / 100;
    }
  } else {
    const assumed = calculateAssumedRR({
      result: effectiveResult,
      planPl: Number(planData.pl) || 0,
      planRiskPerOperation: Number(planData.riskPerOperation) || 0,
      planRrTarget: Number(planData.rrTarget) || 0,
    });
    if (assumed) { rrRatio = assumed.rrRatio; rrAssumed = true; }
  }

  // 7. Snapshot inline (Decisão E — sobrescreve anterior, sem histórico infinito)
  const snapshot = {
    entry: before.entry,
    exit: before.exit,
    qty: before.qty,
    stopLoss: before.stopLoss ?? null,
    _partials: before._partials || [],
    result: before.result,
    resultInPoints: before.resultInPoints,
    rrRatio: before.rrRatio,
    rrAssumed: before.rrAssumed,
    hasPartials: before.hasPartials || false,
    partialsCount: before.partialsCount || 0,
    snapshotAt: new Date().toISOString(),
  };

  // 8. Patch — apenas campos enriquecidos. Preserva emoção/setup/feedback/etc.
  // Destrava do lock comportamental (DEC-AUTO-188-03) é executada server-side
  // pela CF onTradeUpdated quando detecta novo importBatchId — preserva
  // firestore.rules estrita (aluno não pode tocar metadados de lock direto).
  const patch = {
    _partials: enrichment._partials || [],
    entry, exit, qty, stopLoss,
    resultCalculated: Math.round(result * 100) / 100,
    result: effectiveResult,
    resultInPoints,
    resultPercent: calculateResultPercent(side, entry, exit),
    rrRatio, rrAssumed,
    hasPartials: (enrichment._partials?.length || 0) > 0,
    partialsCount: enrichment._partials?.length || 0,
    tickerRule,
    enrichedByImport: true,
    enrichedAt: serverTimestamp(),
    importBatchId: enrichment.importBatchId || null,
    _enrichmentSnapshot: snapshot,
    updatedAt: serverTimestamp(),
    ...(excursionPatch ? {
      mepPrice: excursionPatch.mepPrice,
      menPrice: excursionPatch.menPrice,
      excursionSource: excursionPatch.excursionSource,
    } : {}),
  };

  // 9. updateDoc — CF onTradeUpdated dispara PL diff + compliance + redFlags
  await updateDocFn(tradeRef, patch);

  console.log(`[tradeGateway] Trade ${tradeId} enriquecido (batch ${enrichment.importBatchId})`);
  return { id: tradeId, before, after: { ...before, ...patch } };
}

// ============================================
// EDIÇÃO PELO MENTOR + LOCK COMPORTAMENTAL (#188 F1)
// ============================================

/**
 * Edita campos comportamentais de um trade como MENTOR (DEC-AUTO-188-02).
 * Whitelist: emotionEntry, emotionExit, setup. Primeira edição grava
 * `_studentOriginal` (imutável depois). Cada campo alterado gera entry
 * em `_mentorEdits[]` (append-only, auditável).
 *
 * Bloqueia edição se trade já está locked (rule client-side + server-side).
 *
 * Chama CF onTradeUpdated — que agora recompila compliance em mudança de
 * emotionEntry (fix pré-existente aplicado na Fase E do mesmo issue).
 *
 * @param {string} tradeId
 * @param {Object} edits - { emotionEntry?, emotionExit?, setup? }. Campos ausentes preservados.
 * @param {Object} userContext - { uid, email, displayName, isMentor }
 * @param {Object} [deps]
 * @returns {Promise<{ id, before, after, editedFields: string[] }>}
 */
export async function editTradeAsMentor(tradeId, edits, userContext, deps = {}) {
  const getDocFn = deps.getDocFn ?? getDoc;
  const updateDocFn = deps.updateDocFn ?? updateDoc;
  const docFn = deps.docFn ?? doc;
  const timestamp = deps.now ?? (() => new Date().toISOString());

  if (!userContext?.uid) throw new Error('Usuário não autenticado');
  if (!userContext?.isMentor) throw new Error('Apenas o mentor pode editar campos comportamentais');
  if (!tradeId) throw new Error('tradeId obrigatório');
  if (!edits || typeof edits !== 'object') throw new Error('edits obrigatório');

  const tradeRef = docFn(db, 'trades', tradeId);
  const tradeSnap = await getDocFn(tradeRef);
  if (!tradeSnap.exists()) throw new Error(`Trade ${tradeId} não encontrado`);
  const before = tradeSnap.data();

  if (before._lockedByMentor === true) {
    throw new Error('Trade travado — destrave antes de editar');
  }

  const editedFields = [];
  const patch = { updatedAt: serverTimestamp() };
  const mentorEditEntries = [];
  const editedAt = timestamp();
  const editedBy = { uid: userContext.uid, email: userContext.email || null };

  MENTOR_EDITABLE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(edits, field)) {
      const newValue = edits[field];
      const oldValue = before[field] ?? null;
      if (newValue !== oldValue) {
        patch[field] = newValue ?? null;
        editedFields.push(field);
        mentorEditEntries.push({ field, oldValue, newValue: newValue ?? null, editedAt, editedBy });
      }
    }
  });

  if (editedFields.length === 0) {
    return { id: tradeId, before, after: before, editedFields: [] };
  }

  // Preserva valor originalmente declarado pelo aluno (1ª edição congela, imutável depois).
  if (!before._studentOriginal) {
    patch._studentOriginal = {
      emotionEntry: before.emotionEntry ?? null,
      emotionExit: before.emotionExit ?? null,
      setup: before.setup ?? null,
      capturedAt: editedAt,
    };
  }

  patch._mentorEdits = arrayUnion(...mentorEditEntries);

  await updateDocFn(tradeRef, patch);
  console.log(`[tradeGateway] Trade ${tradeId} editado por mentor: ${editedFields.join(', ')}`);
  return { id: tradeId, before, after: { ...before, ...patch }, editedFields };
}

/**
 * Trava o trade — após isso ninguém edita campos comportamentais (nem aluno nem mentor
 * via fluxo normal). Admin destrava via unlockTradeByMentor ou edit direto.
 * Import (CSV/Order) destrava automaticamente na Fase G.
 *
 * @returns {Promise<{ id, before, after }>}
 */
export async function lockTradeByMentor(tradeId, userContext, deps = {}) {
  const getDocFn = deps.getDocFn ?? getDoc;
  const updateDocFn = deps.updateDocFn ?? updateDoc;
  const docFn = deps.docFn ?? doc;

  if (!userContext?.uid) throw new Error('Usuário não autenticado');
  if (!userContext?.isMentor) throw new Error('Apenas o mentor pode travar o trade');
  if (!tradeId) throw new Error('tradeId obrigatório');

  const tradeRef = docFn(db, 'trades', tradeId);
  const tradeSnap = await getDocFn(tradeRef);
  if (!tradeSnap.exists()) throw new Error(`Trade ${tradeId} não encontrado`);
  const before = tradeSnap.data();

  const patch = {
    _lockedByMentor: true,
    _lockedAt: serverTimestamp(),
    _lockedBy: {
      uid: userContext.uid,
      email: userContext.email || null,
      name: userContext.displayName || null,
    },
    updatedAt: serverTimestamp(),
  };

  await updateDocFn(tradeRef, patch);
  console.log(`[tradeGateway] Trade ${tradeId} travado por mentor ${userContext.email}`);
  return { id: tradeId, before, after: { ...before, ...patch } };
}

/**
 * Destrava o trade — preserva auditoria (_mentorEdits/_studentOriginal intactos).
 * Admin destrava manualmente; import destrava automaticamente (Fase G).
 */
export async function unlockTradeByMentor(tradeId, userContext, deps = {}) {
  const getDocFn = deps.getDocFn ?? getDoc;
  const updateDocFn = deps.updateDocFn ?? updateDoc;
  const docFn = deps.docFn ?? doc;

  if (!userContext?.uid) throw new Error('Usuário não autenticado');
  if (!userContext?.isMentor) throw new Error('Apenas o mentor pode destravar o trade');
  if (!tradeId) throw new Error('tradeId obrigatório');

  const tradeRef = docFn(db, 'trades', tradeId);
  const tradeSnap = await getDocFn(tradeRef);
  if (!tradeSnap.exists()) throw new Error(`Trade ${tradeId} não encontrado`);
  const before = tradeSnap.data();

  const patch = {
    _lockedByMentor: false,
    _unlockedAt: serverTimestamp(),
    _unlockedBy: {
      uid: userContext.uid,
      email: userContext.email || null,
      reason: userContext.unlockReason || 'manual',
    },
    updatedAt: serverTimestamp(),
  };

  await updateDocFn(tradeRef, patch);
  console.log(`[tradeGateway] Trade ${tradeId} destravado por ${userContext.email}`);
  return { id: tradeId, before, after: { ...before, ...patch } };
}

/**
 * Classifica o trade sob ótica do mentor (issue #219, parte 1/3 do épico #218).
 *
 * Mentor registra julgamento qualitativo: 'tecnico' (seguiu modelo operacional)
 * ou 'sorte' (narrativa solta, sizing fora do plano, desvio do modelo). Quando
 * 'sorte', flags estruturadas (subset de MENTOR_CLASSIFICATION_FLAGS) qualificam.
 * Motivo livre opcional. Aluno read-only via firestore.rules.
 *
 * Discricionário — sistema NÃO infere. Maturity engine v1 NÃO consome (defer v2).
 * Campo serve diagnóstico (% técnico vs % sorte por aluno/setup/período).
 *
 * Idempotente: passar `classification: null` limpa a classificação (e flags/reason).
 *
 * @param {string} tradeId
 * @param {Object} input - { classification: 'tecnico'|'sorte'|null, flags?: string[], reason?: string|null }
 * @param {Object} userContext - { uid, email, isMentor }
 * @param {Object} [deps]
 * @returns {Promise<{ id, before, after }>}
 */
export async function classifyTradeAsMentor(tradeId, input, userContext, deps = {}) {
  const getDocFn = deps.getDocFn ?? getDoc;
  const updateDocFn = deps.updateDocFn ?? updateDoc;
  const docFn = deps.docFn ?? doc;

  if (!userContext?.uid) throw new Error('Usuário não autenticado');
  if (!userContext?.isMentor) throw new Error('Apenas o mentor pode classificar o trade');
  if (!tradeId) throw new Error('tradeId obrigatório');
  if (!input || typeof input !== 'object') throw new Error('input obrigatório');

  const { classification = null, flags = [], reason = null } = input;

  if (classification !== null && !MENTOR_CLASSIFICATION_VALUES.includes(classification)) {
    throw new Error(`classification inválida: '${classification}' (esperado: 'tecnico'|'sorte'|null)`);
  }
  if (!Array.isArray(flags)) throw new Error('flags deve ser array');
  if (flags.some(f => !MENTOR_CLASSIFICATION_FLAGS.includes(f))) {
    throw new Error(`flags inválidas — subset esperado: ${MENTOR_CLASSIFICATION_FLAGS.join('|')}`);
  }
  if (classification === 'tecnico' && flags.length > 0) {
    throw new Error('flags só são aceitas quando classification === "sorte"');
  }
  if (classification === null && (flags.length > 0 || (reason !== null && reason !== ''))) {
    throw new Error('limpar classificação (null) zera flags e reason — não envie valor');
  }
  if (reason !== null && typeof reason !== 'string') {
    throw new Error('reason deve ser string ou null');
  }

  const tradeRef = docFn(db, 'trades', tradeId);
  const tradeSnap = await getDocFn(tradeRef);
  if (!tradeSnap.exists()) throw new Error(`Trade ${tradeId} não encontrado`);
  const before = tradeSnap.data();

  const patch = {
    mentorClassification: classification,
    mentorClassificationFlags: classification === null ? [] : flags,
    mentorClassificationReason: classification === null ? null : (reason || null),
    mentorClassifiedAt: classification === null ? null : serverTimestamp(),
    mentorClassifiedBy: classification === null
      ? null
      : { uid: userContext.uid, email: userContext.email || null },
    updatedAt: serverTimestamp(),
  };

  await updateDocFn(tradeRef, patch);
  console.log(
    `[tradeGateway] Trade ${tradeId} classificado por mentor: ${classification ?? 'null'}` +
    (flags.length ? ` flags=[${flags.join(',')}]` : '')
  );
  return { id: tradeId, before, after: { ...before, ...patch } };
}

/**
 * Toggle de "limpar violação" (issue #221, Phase B do épico #218).
 *
 * Mentor adiciona/remove uma chave de violação ao array `mentorClearedViolations`.
 * Quando presente, agregadores (complianceRate, calculatePeriodScore, gates de
 * maturity) filtram a violação correspondente via `effectiveRedFlags` /
 * `effectiveEmotionalEventsForPeriod`.
 *
 * Sem audit metadata (sem reason/clearedAt/clearedBy) — DEC-AUTO-221-02. Refactor
 * trivial pra `Array<{key,reason?,by?,at?}>` se necessário no futuro.
 *
 * Cliente faz só `arrayUnion`/`arrayRemove`; recompute server-side é responsabilidade
 * da CF `onTradeUpdated` que detecta mudança no campo e dispara pipeline igual à
 * de mudança de plano (`recomputeStudentMaturity`).
 *
 * Schema de chaves:
 *  - Compliance: o próprio code (`NO_STOP`, `RR_BELOW_MINIMUM`, `RISK_EXCEEDED`,
 *    `DAILY_LOSS_EXCEEDED`, `BLOCKED_EMOTION`).
 *  - Emocional: `${eventType}:${tradeId}` — ver `getEventKey` em violationFilter.js.
 *
 * @param {string} tradeId
 * @param {string} violationKey - chave da violação a alternar
 * @param {Object} userContext - { uid, email, isMentor }
 * @param {Object} [deps]
 * @returns {Promise<{ id, action: 'added'|'removed', violationKey }>}
 */
export async function toggleViolationClearedAsMentor(tradeId, violationKey, userContext, deps = {}) {
  const getDocFn = deps.getDocFn ?? getDoc;
  const updateDocFn = deps.updateDocFn ?? updateDoc;
  const docFn = deps.docFn ?? doc;

  if (!userContext?.uid) throw new Error('Usuário não autenticado');
  if (!userContext?.isMentor) throw new Error('Apenas o mentor pode limpar violações');
  if (!tradeId) throw new Error('tradeId obrigatório');
  if (!violationKey || typeof violationKey !== 'string') {
    throw new Error('violationKey obrigatório (string não-vazia)');
  }

  const tradeRef = docFn(db, 'trades', tradeId);
  const tradeSnap = await getDocFn(tradeRef);
  if (!tradeSnap.exists()) throw new Error(`Trade ${tradeId} não encontrado`);
  const before = tradeSnap.data();

  const current = Array.isArray(before.mentorClearedViolations)
    ? before.mentorClearedViolations
    : [];
  const isCurrentlyCleared = current.includes(violationKey);
  const action = isCurrentlyCleared ? 'removed' : 'added';

  const patch = {
    mentorClearedViolations: isCurrentlyCleared
      ? arrayRemove(violationKey)
      : arrayUnion(violationKey),
    updatedAt: serverTimestamp(),
  };

  await updateDocFn(tradeRef, patch);
  console.log(`[tradeGateway] Trade ${tradeId} violation ${action}: ${violationKey}`);
  return { id: tradeId, action, violationKey };
}
