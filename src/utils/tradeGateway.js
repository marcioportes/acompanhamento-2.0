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
  updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTradeResult, calculateResultPercent } from './calculations';
import { calculateFromPartials, calculateAssumedRR } from './tradeCalculations';

// Campos comportamentais editáveis pelo mentor + protegidos pelo lock (#188 F1).
export const MENTOR_EDITABLE_FIELDS = ['emotionEntry', 'emotionExit', 'setup'];

// Status constants (espelhado de useTrades)
const DEFAULT_STATUS = 'OPEN';

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
