/**
 * shadowDetectors — detectores shadow PUROS (sem firebase-functions/admin).
 * Extraído de analyzeShadowBehavior.js (Fase 2 #301) para reuso por buildBehaviorProfile
 * sem acoplar o framework de Cloud Functions.
 *
 * #392 — o cabeçalho antigo afirmava "mesma lógica de src/utils/shadowBehaviorAnalysis.js".
 * NÃO era: vieram 10 dos 15 detectores em junho (#301) e ninguém corrigiu a frase. Foi por
 * acreditar nela que se procurou divergência de motor onde não havia. Hoje este arquivo é
 * a ÚNICA implementação que roda — o motor ESM foi aposentado. `FOMO_ENTRY` ficou
 * deliberadamente de fora (decisão de Marcio, 23/08/2026: entrada a mercado é viável e nem
 * sempre é corrida atrás do preço).
 */

// ============================================
// Shadow behavior analysis — inlined for CF
// (Same logic as src/utils/shadowBehaviorAnalysis.js)
// ============================================

const SHADOW_VERSION = '1.0';

const RESOLUTION = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };
const SEVERITY = { NONE: 'NONE', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };

const EMOTION_MAPPING = {
  HOLD_ASYMMETRY: 'FEAR',
  REVENGE_CLUSTER: 'REVENGE',
  GREED_CLUSTER: 'GREED',
  OVERTRADING: 'ANXIETY',
  IMPULSE_CLUSTER: 'IMPULSIVITY',
  CLEAN_EXECUTION: 'DISCIPLINE',
  TARGET_HIT: 'PATIENCE',
  DIRECTION_FLIP: 'CONFUSION',
  UNDERSIZED_TRADE: 'AVOIDANCE',
  HESITATION: 'FEAR',
  STOP_PANIC: 'PANIC',
  LATE_EXIT: 'HOPE',
  AVERAGING_DOWN: 'DENIAL',
  STOP_PANIC: 'PANIC',
  FOMO_ENTRY: 'FOMO',
  EARLY_EXIT: 'FEAR',
  LATE_EXIT: 'HOPE',
  AVERAGING_DOWN: 'DENIAL'
};

const DEFAULT_CONFIG = {
  holdAsymmetry: { multiplier: 3.0, minSampleSize: 3 },
  revengeCluster: { maxIntervalMinutes: 5, minTrades: 2 },
  greedCluster: { maxIntervalMinutes: 10, minTrades: 3 },
  overtrading: { windowMinutes: 60, maxTradesInWindow: 5 },
  impulseCluster: { maxIntervalMinutes: 2, minTrades: 2 },
  targetHit: { tolerancePct: 0.05 },
  earlyExit: { rrThresholdPct: 0.50 },
  directionFlip: { maxIntervalMinutes: 120 },
  undersizedTrade: { ratioThreshold: 0.65, highRatio: 0.30, mediumRatio: 0.50 },
  hesitation: { minCancels: 2 },
  stopPanic: { maxExitMinutes: 5 },
  fomoEntry: { minDelayMinutes: 10, orderType: 'MARKET' },
  lateExit: { minDelayMinutes: 15 },
  lowResolutionPenalty: 0.3
};

// --- Helpers ---

const getMinutesBetween = (tradeA, tradeB) => {
  const timeA = new Date(tradeA.exitTime || tradeA.entryTime || tradeA.date);
  const timeB = new Date(tradeB.entryTime || tradeB.date);
  return Math.abs(timeB - timeA) / 60000;
};

const sortChronologically = (trades) => {
  return [...trades].sort((a, b) => {
    const dateA = new Date(a.entryTime || a.date);
    const dateB = new Date(b.entryTime || b.date);
    return dateA - dateB;
  });
};

const getTradeDurationMinutes = (trade) => {
  if (!trade.entryTime || !trade.exitTime) return null;
  const entry = new Date(trade.entryTime);
  const exit = new Date(trade.exitTime);
  if (isNaN(entry) || isNaN(exit)) return null;
  return (exit - entry) / 60000;
};

const getResult = (trade) => Number(trade.result) || 0;

// #383 — a conta virou SSoT compartilhada; três cópias foi o defeito que o #383 fechou.
const { realizedRR } = require('../shared/realizedRR');
const { orderInstantMs } = require('../shared/orderInstant');

/** Instante de um campo do TRADE (já traz offset explícito desde #285/#292). */
const tradeMs = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/** #381 — `planRR` nunca existiu no modelo; o campo anexado é `planRrTarget` (AP-07). */
const planRrTargetOf = (trade) => Number((trade && (trade.planRrTarget != null ? trade.planRrTarget : trade.planRR)) || 2) || 2;


const applyPenalty = (confidence, trade) => {
  if (trade.lowResolution) return Math.max(0, confidence - DEFAULT_CONFIG.lowResolutionPenalty);
  return confidence;
};

// --- Layer 1 detectors (simplified for CF — same logic as client) ---

const detectHoldAsymmetry = (trade, adjacent) => {
  const duration = getTradeDurationMinutes(trade);
  if (duration == null || duration <= 0 || getResult(trade) >= 0) return null;
  const winDurations = adjacent
    .map(t => ({ d: getTradeDurationMinutes(t), r: getResult(t) }))
    .filter(t => t.d > 0 && t.r > 0).map(t => t.d);
  if (winDurations.length < DEFAULT_CONFIG.holdAsymmetry.minSampleSize) return null;
  const avg = winDurations.reduce((a, b) => a + b, 0) / winDurations.length;
  if (avg <= 0) return null;
  const ratio = duration / avg;
  if (ratio <= DEFAULT_CONFIG.holdAsymmetry.multiplier) return null;
  return {
    code: 'HOLD_ASYMMETRY',
    severity: ratio >= 6 ? 'HIGH' : ratio >= 4 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(Math.min(0.95, 0.6 + (ratio - 3) * 0.1), trade),
    emotionMapping: EMOTION_MAPPING.HOLD_ASYMMETRY,
    layer: 1,
    evidence: { tradeDurationMinutes: Math.round(duration * 10) / 10, avgWinDurationMinutes: Math.round(avg * 10) / 10, ratio: Math.round(ratio * 10) / 10 }
  };
};

const detectRevengeCluster = (trade, adjacent) => {
  if (!trade.entryTime) return null;
  const sorted = sortChronologically([...adjacent, trade]);
  const idx = sorted.findIndex(t => t.id === trade.id);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1];
  if (getResult(prev) >= 0) return null;
  const interval = getMinutesBetween(prev, trade);
  if (interval > DEFAULT_CONFIG.revengeCluster.maxIntervalMinutes) return null;
  let count = 1;
  for (let i = idx + 1; i < sorted.length; i++) {
    if (getMinutesBetween(sorted[i - 1], sorted[i]) <= DEFAULT_CONFIG.revengeCluster.maxIntervalMinutes) count++;
    else break;
  }
  if (count < DEFAULT_CONFIG.revengeCluster.minTrades) return null;
  return {
    code: 'REVENGE_CLUSTER', severity: count >= 4 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(Math.min(0.95, 0.7 + count * 0.05), trade),
    emotionMapping: EMOTION_MAPPING.REVENGE_CLUSTER, layer: 1,
    evidence: { previousLoss: getResult(prev), intervalMinutes: Math.round(interval * 10) / 10, clusterCount: count }
  };
};

const detectOvertrading = (trade, adjacent) => {
  if (!trade.entryTime) return null;
  const cfg = DEFAULT_CONFIG.overtrading;
  const sameDayAll = [...adjacent.filter(t => t.date === trade.date), trade];
  if (sameDayAll.length <= cfg.maxTradesInWindow) return null;
  const tradeTime = new Date(trade.entryTime);
  const inWindow = sameDayAll.filter(t => t.entryTime && Math.abs(new Date(t.entryTime) - tradeTime) / 60000 <= cfg.windowMinutes);
  if (inWindow.length <= cfg.maxTradesInWindow) return null;
  return {
    code: 'OVERTRADING',
    severity: inWindow.length >= cfg.maxTradesInWindow * 2 ? 'HIGH' : inWindow.length >= cfg.maxTradesInWindow * 1.5 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(0.85, trade), emotionMapping: EMOTION_MAPPING.OVERTRADING, layer: 1,
    evidence: { tradesInWindow: inWindow.length, threshold: cfg.maxTradesInWindow }
  };
};

const detectImpulseCluster = (trade, adjacent) => {
  if (!trade.entryTime) return null;
  const cfg = DEFAULT_CONFIG.impulseCluster;
  const sorted = sortChronologically([...adjacent, trade]);
  const idx = sorted.findIndex(t => t.id === trade.id);
  let count = 1;
  for (let i = idx - 1; i >= 0; i--) {
    if (getMinutesBetween(sorted[i], sorted[i + 1]) <= cfg.maxIntervalMinutes) count++;
    else break;
  }
  for (let i = idx + 1; i < sorted.length; i++) {
    if (getMinutesBetween(sorted[i - 1], sorted[i]) <= cfg.maxIntervalMinutes) count++;
    else break;
  }
  if (count < cfg.minTrades) return null;
  return {
    code: 'IMPULSE_CLUSTER',
    severity: count >= 4 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(Math.min(0.85, 0.6 + count * 0.08), trade),
    emotionMapping: EMOTION_MAPPING.IMPULSE_CLUSTER, layer: 1,
    evidence: { clusterCount: count }
  };
};

const detectCleanExecution = (trade, otherPatterns) => {
  if (otherPatterns.some(p => p && p.code !== 'CLEAN_EXECUTION' && p.code !== 'TARGET_HIT')) return null;
  if (!trade.stopLoss || trade.stopLoss <= 0 || getResult(trade) <= 0) return null;
  const rr = realizedRR(trade);
  const rrRespected = rr != null && rr >= 1.0;
  return {
    code: 'CLEAN_EXECUTION', severity: 'NONE',
    confidence: applyPenalty(rrRespected ? 0.90 : 0.70, trade),
    emotionMapping: EMOTION_MAPPING.CLEAN_EXECUTION, layer: 1,
    evidence: { hasStop: true, rrRatio: rr, result: getResult(trade) }
  };
};

const detectTargetHit = (trade) => {
  if (getResult(trade) <= 0 || realizedRR(trade) == null || trade.rrAssumed) return null;
  const { stopLoss, entry, exit } = trade;
  if (!stopLoss || !entry || !exit) return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0) return null;
  const planRR = planRrTargetOf(trade);
  const side = trade.side === 'SHORT' ? -1 : 1;
  const target = entry + (side * risk * planRR);
  const tolerance = risk * planRR * DEFAULT_CONFIG.targetHit.tolerancePct;
  if (Math.abs(exit - target) > tolerance) return null;
  return {
    code: 'TARGET_HIT', severity: 'NONE',
    confidence: applyPenalty(0.85, trade),
    emotionMapping: EMOTION_MAPPING.TARGET_HIT, layer: 1,
    evidence: { exitPrice: exit, targetPrice: Math.round(target * 100) / 100, planRR }
  };
};

const detectDirectionFlip = (trade, adjacent) => {
  if (!trade.entryTime || !trade.side) return null;
  const sorted = sortChronologically([...adjacent, trade]);
  const idx = sorted.findIndex(t => t.id === trade.id);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1];
  if (getResult(prev) >= 0) return null;
  const prevTicker = prev.ticker || prev.instrument;
  const currTicker = trade.ticker || trade.instrument;
  if (!prevTicker || !currTicker || prevTicker !== currTicker) return null;
  if (!prev.side || prev.side === trade.side) return null;
  const interval = getMinutesBetween(prev, trade);
  if (interval > DEFAULT_CONFIG.directionFlip.maxIntervalMinutes) return null;
  return {
    code: 'DIRECTION_FLIP',
    severity: interval <= 15 ? 'HIGH' : interval <= 60 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(0.90, trade),
    emotionMapping: EMOTION_MAPPING.DIRECTION_FLIP, layer: 1,
    evidence: {
      previousSide: prev.side, previousResult: getResult(prev),
      currentSide: trade.side, instrument: currTicker,
      intervalMinutes: Math.round(interval * 10) / 10
    }
  };
};

const detectUndersizedTrade = (trade) => {
  const actualPct = trade.riskPercent;
  const planPct = trade.planRoPct;
  if (actualPct == null || planPct == null || planPct <= 0 || actualPct <= 0) return null;
  const cfg = DEFAULT_CONFIG.undersizedTrade;
  const ratio = actualPct / planPct;
  if (ratio >= cfg.ratioThreshold) return null;

  const hasPl = trade.planPl != null && trade.planPl > 0;
  const planRoAmount = hasPl ? trade.planPl * planPct / 100 : null;
  const actualRiskAmount = hasPl ? trade.planPl * actualPct / 100 : null;
  const planRrTarget = trade.planRrTarget ?? 2;
  const expectedGainAtPlanRR = planRoAmount != null ? planRoAmount * planRrTarget : null;

  const result = (typeof trade.result === 'number') ? trade.result : null;
  const isWin = result != null && result > 0;

  const planRsDelivered = isWin && planRoAmount ? result / planRoAmount : null;
  const rGapVsPlan = isWin && expectedGainAtPlanRR != null ? expectedGainAtPlanRR - result : null;
  const rrLocalAchieved = isWin && actualRiskAmount ? result / actualRiskAmount : null;
  const hiddenRrInflation = ratio > 0 ? 1 / ratio : null;

  let scenario;
  if (!isWin) scenario = 'LOSS_BE';
  else if (rrLocalAchieved != null && rrLocalAchieved >= planRrTarget) scenario = 'WIN_RR_HIT';
  else scenario = 'WIN_RR_MISS';

  return {
    code: 'UNDERSIZED_TRADE',
    severity: ratio <= cfg.highRatio ? 'HIGH' : ratio <= cfg.mediumRatio ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(0.90, trade),
    emotionMapping: EMOTION_MAPPING.UNDERSIZED_TRADE,
    layer: 1,
    evidence: {
      actualRiskPct: Math.round(actualPct * 100) / 100,
      planRoPct: Math.round(planPct * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      utilizationPct: Math.round(ratio * 10000) / 100,
      planRoAmount: planRoAmount != null ? Math.round(planRoAmount * 100) / 100 : null,
      actualRiskAmount: actualRiskAmount != null ? Math.round(actualRiskAmount * 100) / 100 : null,
      expectedGainAtPlanRR: expectedGainAtPlanRR != null ? Math.round(expectedGainAtPlanRR * 100) / 100 : null,
      actualGain: result,
      planRsDelivered: planRsDelivered != null ? Math.round(planRsDelivered * 100) / 100 : null,
      rGapVsPlan: rGapVsPlan != null ? Math.round(rGapVsPlan * 100) / 100 : null,
      hiddenRrInflation: hiddenRrInflation != null ? Math.round(hiddenRrInflation * 100) / 100 : null,
      rrLocalAchieved: rrLocalAchieved != null ? Math.round(rrLocalAchieved * 100) / 100 : null,
      planRrTarget,
      scenario
    }
  };
};

// --- Layer 2 detectors ---

const detectHesitation = (trade, orders) => {
  if (!orders || !orders.length || !trade.entryTime) return null;
  const entryTime = new Date(trade.entryTime);
  // #388 — TERCEIRA cópia da comparação hora-de-ordem × hora-de-trade que o #375
  // corrigiu em `executionBehaviorEngine` e `executionBehaviorMirror`, e que passou
  // batida aqui. `orders` guarda instante INGÊNUO e `trades` guarda com offset: em UTC,
  // que é onde a Cloud Function roda, o cancelamento de um bracket às 11:27 vira
  // 11:27Z e a entrada das 11:25-03:00 vira 14:25Z — as pernas de proteção canceladas
  // NO ALVO passavam a contar como "ordens canceladas antes de entrar" e o trade
  // ganhava HESITATION. Caso real: WINV26 de 21/08, +R$ 520, marcado com hesitação
  // depois de o feedback já ter sido enviado ao aluno.
  const cancels = orders.filter(o => o.status === 'CANCELLED'
    && orderInstantMs(trade, o.cancelledAt || o.submittedAt) < entryTime.getTime());
  if (cancels.length < DEFAULT_CONFIG.hesitation.minCancels) return null;
  return {
    code: 'HESITATION',
    severity: cancels.length >= 4 ? 'HIGH' : cancels.length >= 3 ? 'MEDIUM' : 'LOW',
    confidence: 0.90, emotionMapping: EMOTION_MAPPING.HESITATION, layer: 2,
    evidence: { cancelledOrdersCount: cancels.length }
  };
};

const detectEarlyExit = (trade, orders) => {
  const rr = realizedRR(trade);
  if (getResult(trade) <= 0 || rr == null || trade.rrAssumed) return null;
  const planRR = planRrTargetOf(trade);
  if (rr >= planRR * DEFAULT_CONFIG.earlyExit.rrThresholdPct) return null;
  if (orders && orders.some(o => o.isStopOrder && o.status === 'FILLED')) return null;
  return {
    code: 'EARLY_EXIT',
    severity: rr < planRR * 0.25 ? 'HIGH' : rr < planRR * 0.40 ? 'MEDIUM' : 'LOW',
    confidence: orders && orders.length > 0 ? 0.85 : 0.65,
    emotionMapping: EMOTION_MAPPING.EARLY_EXIT, layer: orders && orders.length > 0 ? 2 : 1,
    evidence: { actualRR: rr, planRR, rrAchievedPct: Math.round((rr / planRR) * 100) }
  };
};

// --- Main analyzer (CF version) ---


// ============================================
// #392 — quatro detectores que existiam só no lado morto
//
// Escritos em junho (#301) no motor ESM e NUNCA portados para cá. O cabeçalho deste
// arquivo afirmava "mesma lógica" do cliente; vieram 10 de 15. A decisão da época
// (DEC-AUTO-301-01) dizia que a maturidade server-side não consumia comportamento por
// trade — premissa que caducou: hoje o card do trade, o gate e a taxa de padrões leem
// exatamente este registro. Ninguém revisitou, e quatro análises ficaram escritas,
// testadas e desligadas.
//
// Marcio, 23/08/2026: "ninguém tá passando porque ninguém está acreditando no processo
// e estou perdendo aluno. Implementa piramidação, pânico no stop, saída tardia e cluster
// de ganância." FOMO na entrada ficou de fora por decisão dele — entrada a mercado é
// viável e nem sempre é corrida atrás do preço.
//
// Toda comparação entre hora de ORDEM e hora de TRADE usa `orderInstantMs` desde o
// nascimento aqui: as versões do cliente comparavam cru e é esse o bug que produziu a
// "Hesitação" fantasma (#388).
// ============================================

/**
 * Entradas separadas por menos que isto são a MESMA leva — entrada escalonada, não
 * piramidação. No trade de 21/08 as duas pernas saíram com 3 segundos de diferença
 * (174.050 e 174.010) e o detector original as leu como "aumentou em preço pior".
 */
const MESMA_LEVA_MS = 60000;

/** Piramidação contra a posição — aumentar em preço pior enquanto o mercado vai contra. */
const detectAveragingDown = (trade, orders) => {
  if (!orders || !orders.length || !trade.side) return null;
  const ladoEntrada = trade.side === 'LONG' ? 'BUY' : 'SELL';

  // Só conta execução DENTRO da vida da posição. Aumentar posição é, por definição, algo
  // que acontece com a posição aberta — e isto blinda contra ordem correlacionada ao trade
  // errado: em 18/05 uma execução das 12:26 estava amarrada a um trade que fechou 11:31, e
  // o detector a leu como piramidação.
  const abre = tradeMs(trade.entryTime);
  const fecha = tradeMs(trade.exitTime);
  const dentroDaPosicao = (o) => {
    if (abre == null || fecha == null) return true;   // sem janela, não descarta
    const ts = orderInstantMs(trade, o.filledAt || o.submittedAt);
    return ts == null || (ts >= abre - MESMA_LEVA_MS && ts <= fecha + MESMA_LEVA_MS);
  };

  const mesmaDirecao = orders
    .filter((o) => (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED')
      && !o.isStopOrder && o.side === ladoEntrada && dentroDaPosicao(o))
    .sort((a, b) => (orderInstantMs(trade, a.filledAt || a.submittedAt) || 0)
      - (orderInstantMs(trade, b.filledAt || b.submittedAt) || 0));

  if (mesmaDirecao.length < 2) return null;

  let piramidadas = 0;
  for (let i = 1; i < mesmaDirecao.length; i++) {
    const antOrd = mesmaDirecao[i - 1];
    const atualOrd = mesmaDirecao[i];
    const ant = Number(antOrd.filledPrice != null ? antOrd.filledPrice : antOrd.price);
    const atual = Number(atualOrd.filledPrice != null ? atualOrd.filledPrice : atualOrd.price);
    if (!isFinite(ant) || !isFinite(atual)) continue;

    // Entrada escalonada não é piramidação: duas pernas da mesma leva saem em segundos.
    const tAnt = orderInstantMs(trade, antOrd.filledAt || antOrd.submittedAt);
    const tAtual = orderInstantMs(trade, atualOrd.filledAt || atualOrd.submittedAt);
    if (tAnt != null && tAtual != null && (tAtual - tAnt) < MESMA_LEVA_MS) continue;

    // LONG: comprar mais barato depois de cair. SHORT: vender mais caro depois de subir.
    const contra = trade.side === 'LONG' ? atual < ant : atual > ant;
    if (contra) piramidadas++;
  }
  if (piramidadas === 0) return null;

  return {
    code: 'AVERAGING_DOWN',
    severity: piramidadas >= 3 ? 'HIGH' : piramidadas >= 2 ? 'MEDIUM' : 'LOW',
    confidence: 0.85, emotionMapping: EMOTION_MAPPING.AVERAGING_DOWN, layer: 2,
    evidence: { averagingCount: piramidadas, totalSameDirectionOrders: mesmaDirecao.length, side: trade.side },
  };
};

/** Cancelamento dentro desta janela da saída é OCO fechando no alvo, não decisão. */
const OCO_TOLERANCIA_MIN = 0.5;

/** Pânico no stop — afastou/cancelou a proteção e saiu logo em seguida. */
const detectStopPanic = (trade, orders) => {
  if (!orders || !orders.length) return null;
  const mexidos = orders.filter((o) => o.isStopOrder && (o.status === 'MODIFIED' || o.status === 'CANCELLED'));
  if (!mexidos.length) return null;

  const saida = tradeMs(trade.exitTime);
  if (saida == null) return null;

  const ultimoMexido = mexidos
    .map((o) => orderInstantMs(trade, o.lastUpdatedAt || o.cancelledAt || o.submittedAt))
    .filter((ms) => ms != null)
    .sort((a, b) => b - a)[0];
  if (ultimoMexido == null) return null;

  const minutos = (saida - ultimoMexido) / 60000;
  // Proteção cancelada NO instante da saída é o OCO fechando o bracket no alvo — desfecho
  // normal, não pânico. No trade de 21/08 as duas pernas morreram junto com a saída e o
  // detector original gritava pânico num trade que atingiu o alvo. Pânico é tirar a
  // proteção e desistir LOGO EM SEGUIDA, não simultaneamente.
  if (minutos <= OCO_TOLERANCIA_MIN) return null;
  if (minutos > DEFAULT_CONFIG.stopPanic.maxExitMinutes) return null;

  return {
    code: 'STOP_PANIC',
    severity: minutos <= 1 ? 'HIGH' : minutos <= 3 ? 'MEDIUM' : 'LOW',
    confidence: 0.85, emotionMapping: EMOTION_MAPPING.STOP_PANIC, layer: 2,
    evidence: { widenedStopCount: mexidos.length, exitAfterWidenMinutes: Math.round(minutos * 10) / 10 },
  };
};

/** Saída tardia — cancelou o stop e segurou o prejuízo muito além. */
const detectLateExit = (trade, orders) => {
  if (!orders || !orders.length) return null;
  const resultado = getResult(trade);
  if (resultado >= 0) return null;   // é sobre segurar PERDA

  const cancelados = orders.filter((o) => o.isStopOrder && o.status === 'CANCELLED');
  if (!cancelados.length) return null;

  const saida = tradeMs(trade.exitTime);
  if (saida == null) return null;

  const ultimoCancelamento = cancelados
    .map((o) => orderInstantMs(trade, o.cancelledAt || o.lastUpdatedAt || o.submittedAt))
    .filter((ms) => ms != null)
    .sort((a, b) => b - a)[0];
  if (ultimoCancelamento == null) return null;

  const minutos = (saida - ultimoCancelamento) / 60000;
  if (minutos < DEFAULT_CONFIG.lateExit.minDelayMinutes) return null;

  return {
    code: 'LATE_EXIT',
    severity: minutos >= 60 ? 'HIGH' : minutos >= 30 ? 'MEDIUM' : 'LOW',
    confidence: 0.85, emotionMapping: EMOTION_MAPPING.LATE_EXIT, layer: 2,
    evidence: {
      delayMinutes: Math.round(minutos * 10) / 10,
      cancelledStopCount: cancelados.length,
      tradeResult: resultado,
    },
  };
};

/** Cluster de ganância — sequência rápida de entradas depois de ganhar. */
const detectGreedCluster = (trade, adjacent) => {
  if (!trade.entryTime) return null;
  const cfg = DEFAULT_CONFIG.greedCluster;
  const sorted = sortChronologically([...(adjacent || []), trade]);
  const idx = sorted.findIndex((t) => t.id === trade.id);
  if (idx <= 0) return null;

  let ganhosSeguidos = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (getResult(sorted[i]) > 0) ganhosSeguidos++; else break;
  }
  if (ganhosSeguidos === 0) return null;

  const inicio = sorted[idx - ganhosSeguidos];
  let rapidos = 0;
  for (let i = idx - ganhosSeguidos; i <= idx; i++) {
    if (getMinutesBetween(inicio, sorted[i]) <= cfg.maxIntervalMinutes) rapidos++;
  }
  if (rapidos < cfg.minTrades) return null;

  return {
    code: 'GREED_CLUSTER',
    severity: rapidos >= 5 ? 'HIGH' : rapidos >= 4 ? 'MEDIUM' : 'LOW',
    confidence: applyPenalty(Math.min(0.90, 0.6 + rapidos * 0.05), trade), layer: 1,
    emotionMapping: EMOTION_MAPPING.GREED_CLUSTER,
    evidence: { consecutiveWinsBefore: ganhosSeguidos, rapidTradesInWindow: rapidos, windowMinutes: cfg.maxIntervalMinutes },
  };
};

const analyzeShadowForTradeCF = (trade, adjacent, orders) => {
  if (!trade || !trade.id) return null;
  const patterns = [];

  const h = detectHoldAsymmetry(trade, adjacent);
  if (h) patterns.push(h);
  const r = detectRevengeCluster(trade, adjacent);
  if (r) patterns.push(r);
  const o = detectOvertrading(trade, adjacent);
  if (o) patterns.push(o);
  const imp = detectImpulseCluster(trade, adjacent);
  if (imp) patterns.push(imp);
  const t = detectTargetHit(trade);
  if (t) patterns.push(t);
  const df = detectDirectionFlip(trade, adjacent);
  if (df) patterns.push(df);
  const gc = detectGreedCluster(trade, adjacent);
  if (gc) patterns.push(gc);
  const us = detectUndersizedTrade(trade);
  if (us) patterns.push(us);
  const e = detectEarlyExit(trade, orders);
  if (e) patterns.push(e);

  if (orders && orders.length > 0) {
    const hes = detectHesitation(trade, orders);
    if (hes) patterns.push(hes);
    // #392 — dependem das ordens da corretora: só marcam trade vindo do import.
    const ad = detectAveragingDown(trade, orders);
    if (ad) patterns.push(ad);
    const sp = detectStopPanic(trade, orders);
    if (sp) patterns.push(sp);
    const le = detectLateExit(trade, orders);
    if (le) patterns.push(le);
  }

  const clean = detectCleanExecution(trade, patterns);
  if (clean) patterns.push(clean);

  const resolution = (orders && orders.length > 0) ? RESOLUTION.HIGH
    : trade.enrichedByImport ? RESOLUTION.MEDIUM : RESOLUTION.LOW;

  return {
    patterns,
    resolution,
    marketContext: {
      instrument: trade.ticker || null,
      session: null,
      atr: null
    },
    analyzedAt: new Date().toISOString(),
    orderCount: orders ? orders.length : 0,
    version: SHADOW_VERSION
  };
};

module.exports = { analyzeShadowForTradeCF, sortChronologically, SHADOW_VERSION, DEFAULT_CONFIG, RESOLUTION };
