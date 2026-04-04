/**
 * tradeGateway — Gateway único para criação de trades (INV-02)
 * @see version.js para versão do produto
 *
 * Função pura extraída de useTrades.addTrade.
 * Toda escrita na collection `trades` DEVE passar por createTrade.
 *
 * Pipeline: createTrade → addDoc(trades) → CF onTradeCreated (PL, compliance)
 *           createTrade → addDoc(movements) → CF onMovementCreated (account balance)
 *
 * O hook useTrades.addTrade é wrapper fino que chama createTrade
 * e adiciona: setLoading, setError, uploadImage.
 */

import {
  collection, query, where, addDoc, getDoc, getDocs, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTradeResult, calculateResultPercent } from './calculations';
import { calculateFromPartials, calculateAssumedRR } from './tradeCalculations';

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
