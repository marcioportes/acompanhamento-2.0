// ============================================
// calculatePlanMechanics — Motor universal de plano (mesa + retail)
// ============================================
// Substitui o back-calc linear de `attackPlanCalculator.js` (sizing fixo=1,
// stop derivado de RO/pointValue) por estrutura de 4 camadas:
//
//   1. Constraints — normaliza inputs (mesa OR retail) num shape único
//   2. Tactical Stop — stop estrutural baseado em fração de ATR por estilo
//                       (independente do profile), com modulação ±10% por profile
//   3. Sizing Dinâmico — contracts = floor(roBudget / (stopBase × pointValue))
//   4. Viability — gates hard (incompatible) + soft (sessionRestricted)
//
// Hard conditions:
//   - `instrument` é mandatório (mode 'abstract' deprecated)
//   - `style` é mandatório
//
// Reuso retail (#116): mesmo motor com `constraints.type = 'retail'`,
// `drawdownBudget` derivado de Kelly em vez de mesa.
//
// Refs:
//   - docs/dev/research/spec-original-attack-plan-2026-04-07.md (fundamento Monte Carlo)
//   - docs/dev/issues/issue-201-calculate-plan-mechanics.md (memória de cálculo)
//   - DEC-060, DEC-068 (phase-aware drawdown), DEC-072 (Path A/B sizing)
//   - DT-042 (consolidação MIN_VIABLE_STOP / minStopPoints)

import {
  ATTACK_PROFILES,
  DEFAULT_ATTACK_PROFILE,
  STYLE_ATR_FRACTIONS,
  PROFILE_STOP_VARIANCE,
  MIN_VIABLE_STOP,
  MAX_STOP_NY_PCT,
  MIN_STOP_NY_PCT,
  NY_MIN_VIABLE_STOP_PCT,
  NY_RANGE_FRACTION,
  DEFAULT_ASSUMED_WR,
  RR2_BREAKEVEN_WR,
  PROP_FIRM_PHASES,
  ATTACK_PLAN_DATA_SOURCES,
  normalizeAttackProfile
} from '../constants/propFirmDefaults';
import {
  isInstrumentAllowed,
  suggestMicroAlternative
} from '../constants/instrumentsTable';
import { getActiveDrawdown } from './propFirmDrawdownEngine';

// Quando templateRules.dailyLossLimit é null (típico Apex Intraday — não há cap
// per-rules; a trailing intraday DD é o cap natural), usar o drawdown inteiro
// como cap para o sizing. Evita reduzir maxTradesPerDay artificialmente.
// Ref: docs/dev/research/spec-original-attack-plan-2026-04-07.md §3.2
const NULL_DAILY_LOSS_FALLBACK_FRACTION = 1.0;
const BUSINESS_DAYS_RATIO = 5 / 7;

const VALID_STYLES = Object.keys(STYLE_ATR_FRACTIONS);

// ============================================
// Camada 1 — Normalize Constraints
// ============================================

/**
 * Constrói shape de constraints da mesa a partir do template + phase.
 * Preserva DEC-068 (fundedDrawdown phase-aware) e fallback de dailyLossLimit.
 */
export function buildMesaConstraints(templateRules, phase = PROP_FIRM_PHASES.EVALUATION) {
  if (!templateRules) {
    throw new Error('templateRules é obrigatório para constraints de mesa');
  }
  const validPhase = Object.values(PROP_FIRM_PHASES).includes(phase)
    ? phase
    : PROP_FIRM_PHASES.EVALUATION;

  const activeDrawdown = getActiveDrawdown(templateRules, validPhase);
  const drawdownBudget = activeDrawdown?.maxAmount ?? 0;
  const targetGoal = templateRules.profitTarget ?? 0;
  const evalTimeLimit = templateRules.evalTimeLimit ?? 30;

  const rawDailyLossLimit = templateRules.dailyLossLimit;
  const dailyLossLimit = rawDailyLossLimit && rawDailyLossLimit > 0
    ? rawDailyLossLimit
    : Math.max(1, Math.round(drawdownBudget * NULL_DAILY_LOSS_FALLBACK_FRACTION));

  const evalBusinessDays = evalTimeLimit > 0
    ? Math.max(1, Math.floor(evalTimeLimit * BUSINESS_DAYS_RATIO))
    : 21;

  const contractsMax = templateRules.contracts?.max ?? Infinity;
  const firm = (templateRules.firm ?? '').toLowerCase();

  return {
    type: 'prop',
    drawdownBudget,
    targetGoal,
    dailyLossLimit,
    evalTimeLimit,
    evalBusinessDays,
    contractsMax,
    phase: validPhase,
    firm
  };
}

/**
 * Constrói shape de constraints retail a partir de Kelly + balance.
 * Para uso futuro pelo issue #116 (Fase F do roadmap). Stub de placement.
 */
export function buildRetailConstraints({ balance, kellyFraction, dailyLossPct = 0.02, targetGoal = null }) {
  if (!balance || balance <= 0) {
    throw new Error('balance > 0 é obrigatório para constraints retail');
  }
  if (!kellyFraction || kellyFraction <= 0 || kellyFraction > 1) {
    throw new Error('kellyFraction ∈ (0, 1] é obrigatório para constraints retail');
  }
  return {
    type: 'retail',
    drawdownBudget: balance * kellyFraction,
    targetGoal,
    dailyLossLimit: balance * dailyLossPct,
    evalTimeLimit: null,
    evalBusinessDays: null,
    contractsMax: Infinity,
    phase: null,
    firm: null
  };
}

// ============================================
// Camada 2 — Tactical Stop
// ============================================

/**
 * Calcula `stopBase` em pontos baseado em fração de ATR do estilo,
 * modulada pela banda do profile (±PROFILE_STOP_VARIANCE).
 *
 * Floor: max(MIN_VIABLE_STOP[type], instrument.minStopPoints)
 * Ceiling: MAX_STOP_NY_PCT × nyRange
 *
 * Resolução de DT-042: consume tanto MIN_VIABLE_STOP[type] quanto
 * instrument.minStopPoints (per-instrument), tomando o maior como floor.
 */
function calculateTacticalStop(instrument, profile, style) {
  const atrFraction = STYLE_ATR_FRACTIONS[style];
  const stopBaseRaw = instrument.avgDailyRange * atrFraction;

  // Profile variance: CONS_B (15%) é referência. CONS mais largo, AGRES mais apertado.
  // Linearização: ((roPct - 0.15) / 0.15) ∈ [-0.33, 1.0] → varia ±PROFILE_STOP_VARIANCE
  const variancePct = ((profile.roPct - 0.15) / 0.15) * (-PROFILE_STOP_VARIANCE);
  const profileVariance = clamp(1 + variancePct, 1 - PROFILE_STOP_VARIANCE, 1 + PROFILE_STOP_VARIANCE);
  const stopBaseAdjusted = stopBaseRaw * profileVariance;

  // Floor type-level + per-instrument (DT-042)
  const typeFloor = MIN_VIABLE_STOP[instrument.type] ?? 0;
  const instrumentFloor = instrument.minStopPoints ?? 0;
  const effectiveMinStop = Math.max(typeFloor, instrumentFloor);

  const nyRange = instrument.avgDailyRange * NY_RANGE_FRACTION;
  const ceilingByNy = (MAX_STOP_NY_PCT / 100) * nyRange;

  const stopBase = clamp(stopBaseAdjusted, effectiveMinStop, ceilingByNy);

  return {
    stopBase: round(stopBase, 2),
    stopBaseRaw: round(stopBaseRaw, 2),
    profileVariance: round(profileVariance, 4),
    effectiveMinStop,
    nyRange: round(nyRange, 2),
    clippedByFloor: stopBaseAdjusted < effectiveMinStop,
    clippedByCeiling: stopBaseAdjusted > ceilingByNy
  };
}

// ============================================
// Camada 3 — Sizing Dinâmico
// ============================================

/**
 * Calcula contracts = floor(roBudget / (stopBase × pointValue)).
 * Cap em contractsMax. Retorna `incompatible` se contracts < 1.
 */
function calculateSizing(constraints, profile, stopBase, instrument) {
  const roBudget = round(constraints.drawdownBudget * profile.roPct, 2);
  const stopUSDPerContract = round(stopBase * instrument.pointValue, 2);
  const rawContracts = stopUSDPerContract > 0 ? roBudget / stopUSDPerContract : 0;
  const flooredContracts = Math.floor(rawContracts);
  const cappedContracts = Math.min(flooredContracts, constraints.contractsMax);
  const contracts = Math.max(0, cappedContracts);

  const roEffective = round(contracts * stopUSDPerContract, 2);

  return {
    roBudget,
    stopUSDPerContract,
    contracts,
    rawContracts: round(rawContracts, 2),
    cappedByContractsMax: flooredContracts > constraints.contractsMax,
    roEffective
  };
}

// ============================================
// Camada 4 — Viability Gates
// ============================================

function calculateViability({ stopMeta, sizingMeta, constraints, profile, instrument, style }) {
  const violations = [];
  let incompatible = false;
  let inviabilityReason = null;
  let microSuggestion = null;

  // Hard: stopBase abaixo do floor após clamp (clamp vai forçar para floor mas marca clippedByFloor)
  if (stopMeta.clippedByFloor) {
    incompatible = true;
    inviabilityReason = `Stop estrutural ${stopMeta.stopBaseRaw}pts abaixo do mínimo viável ${stopMeta.effectiveMinStop}pts para ${instrument.type} (estilo ${style} muito apertado neste instrumento)`;
    violations.push('stop_below_min_viable');
  }

  // Hard: stopBase clipado por ceiling
  if (stopMeta.clippedByCeiling) {
    incompatible = true;
    inviabilityReason = inviabilityReason
      ?? `Stop estrutural excederia ${MAX_STOP_NY_PCT}% do range NY (${stopMeta.nyRange}pts) — estilo ${style} excessivo neste instrumento`;
    violations.push('stop_exceeds_ny_range');
  }

  // Hard: roBudget excede dailyLossLimit
  if (sizingMeta.roBudget > constraints.dailyLossLimit) {
    incompatible = true;
    inviabilityReason = inviabilityReason
      ?? `RO $${sizingMeta.roBudget} excede daily loss $${constraints.dailyLossLimit}`;
    violations.push('ro_exceeds_daily_loss');
  }

  // Hard: contracts < 1 (RO insuficiente para 1 contrato no stop tático)
  if (sizingMeta.contracts < 1 && !incompatible) {
    incompatible = true;
    inviabilityReason = `RO $${sizingMeta.roBudget} insuficiente para 1 contrato no estilo ${style} (custo: $${sizingMeta.stopUSDPerContract}/contrato)`;
    violations.push('insufficient_ro_for_one_contract');
  }

  // Hard: maxTradesPerDay × roBudget excede dailyLossLimit (reduz maxTradesPerDay)
  let effectiveMaxTrades = profile.maxTradesPerDay;
  if (sizingMeta.roBudget > 0 && sizingMeta.roBudget * effectiveMaxTrades > constraints.dailyLossLimit) {
    effectiveMaxTrades = Math.max(1, Math.floor(constraints.dailyLossLimit / sizingMeta.roBudget));
  }

  // Sugestão de micro alternativa quando incompatível e instrumento é full-size
  if (incompatible && !instrument.isMicro && constraints.firm) {
    const micro = suggestMicroAlternative(instrument.symbol);
    if (micro && isInstrumentAllowed(micro.symbol, constraints.firm)) {
      microSuggestion = micro.symbol;
    }
  }

  // Soft: instrumento não permitido na mesa
  let allowed = true;
  if (constraints.firm) {
    allowed = isInstrumentAllowed(instrument.symbol, constraints.firm);
    if (!allowed) {
      violations.push(`instrumento '${instrument.symbol}' não permitido na mesa '${constraints.firm}'`);
    }
  }

  // Soft: stopNyPct define recommendedSessions
  const stopNyPct = stopMeta.nyRange > 0
    ? round((stopMeta.stopBase / stopMeta.nyRange) * 100, 2)
    : 0;
  const stopIsNoise = !incompatible && stopNyPct < MIN_STOP_NY_PCT && stopNyPct > 0;
  const nySessionViable = !incompatible && stopNyPct >= NY_MIN_VIABLE_STOP_PCT;
  const sessionRestricted = !incompatible && !nySessionViable;
  const recommendedSessions = incompatible
    ? []
    : (nySessionViable ? ['ny', 'london', 'asia'] : ['london', 'asia']);

  return {
    incompatible,
    inviabilityReason,
    violations,
    microSuggestion,
    allowed,
    stopNyPct,
    stopIsNoise,
    nySessionViable,
    sessionRestricted,
    recommendedSessions,
    effectiveMaxTrades: incompatible ? 0 : effectiveMaxTrades
  };
}

// ============================================
// resolveDataSource — preserva semântica de adjustmentFactor (informativo)
// ============================================

export function resolveDataSource(profile4D, indicators, profileFamily = 'conservative') {
  if (profile4D
      && typeof profile4D.emotionalScore === 'number'
      && typeof profile4D.stage === 'number'
      && typeof profile4D.coefficientOfVariation === 'number') {
    const emotionalFactor = profile4D.emotionalScore / 100;
    const maturityFactor = profile4D.stage / 5;
    const consistencyFactor = Math.max(0, 1 - profile4D.coefficientOfVariation);
    const adjustmentFactor = (emotionalFactor * 0.4) + (maturityFactor * 0.3) + (consistencyFactor * 0.3);
    const assumedWR = (indicators && typeof indicators.winRate === 'number')
      ? indicators.winRate
      : DEFAULT_ASSUMED_WR;
    return {
      dataSource: ATTACK_PLAN_DATA_SOURCES.FULL_4D,
      adjustmentFactor: clamp(adjustmentFactor, 0, 1),
      assumedWR
    };
  }

  if (indicators
      && typeof indicators.winRate === 'number'
      && typeof indicators.coefficientOfVariation === 'number') {
    const consistencyFactor = Math.max(0, 1 - indicators.coefficientOfVariation);
    const adjustmentFactor = (0.5 * 0.4) + (indicators.winRate * 0.3) + (consistencyFactor * 0.3);
    return {
      dataSource: ATTACK_PLAN_DATA_SOURCES.INDICATORS,
      adjustmentFactor: clamp(adjustmentFactor, 0, 1),
      assumedWR: indicators.winRate
    };
  }

  return {
    dataSource: ATTACK_PLAN_DATA_SOURCES.DEFAULTS,
    adjustmentFactor: profileFamily === 'aggressive' ? 0.6 : 0.3,
    assumedWR: DEFAULT_ASSUMED_WR
  };
}

// ============================================
// calculatePlanMechanics — entry point principal
// ============================================

/**
 * Motor universal de cálculo de plano. Hard conditions:
 *  - `input.instrument` mandatório
 *  - `input.style` mandatório (scalp | day | swing | conviction)
 *
 * @param {Object} input
 * @param {Object} input.constraints  - shape de mesa (buildMesaConstraints) OU retail (buildRetailConstraints)
 * @param {Object|string} input.profile - código do profile (CONS_A..AGRES_B) OU objeto ATTACK_PROFILES[code]
 * @param {string} input.style        - 'scalp' | 'day' | 'swing' | 'conviction'
 * @param {Object} input.instrument   - shape de getInstrument() — pointValue, atrDaily, type, isMicro, minStopPoints, symbol
 * @param {Object} [input.profile4D]  - opcional, para `resolveDataSource`
 * @param {Object} [input.indicators] - opcional, para `resolveDataSource`
 *
 * @returns {Object} mechanicalPlan completo
 */
export function calculatePlanMechanics(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('calculatePlanMechanics: input é obrigatório');
  }
  const { constraints, profile, style, instrument, profile4D = null, indicators = null } = input;

  if (!constraints) {
    throw new Error('calculatePlanMechanics: constraints é obrigatório (use buildMesaConstraints ou buildRetailConstraints)');
  }
  if (!instrument) {
    throw new Error('calculatePlanMechanics: instrument é obrigatório (sem mode abstract)');
  }
  if (!instrument.pointValue || instrument.pointValue <= 0) {
    throw new Error('calculatePlanMechanics: instrument.pointValue inválido');
  }
  if (!instrument.avgDailyRange || instrument.avgDailyRange <= 0) {
    throw new Error('calculatePlanMechanics: instrument.avgDailyRange inválido');
  }
  if (!style || !VALID_STYLES.includes(style)) {
    throw new Error(`calculatePlanMechanics: style inválido. Use um de: ${VALID_STYLES.join(', ')}`);
  }

  const profileObj = typeof profile === 'string'
    ? ATTACK_PROFILES[normalizeAttackProfile(profile)]
    : profile ?? ATTACK_PROFILES[DEFAULT_ATTACK_PROFILE];

  if (!profileObj || typeof profileObj.roPct !== 'number') {
    throw new Error('calculatePlanMechanics: profile inválido');
  }

  // Camada 2 — Tactical Stop
  const stopMeta = calculateTacticalStop(instrument, profileObj, style);

  // Camada 3 — Sizing Dinâmico
  const sizingMeta = calculateSizing(constraints, profileObj, stopMeta.stopBase, instrument);

  // Camada 4 — Viability
  const viability = calculateViability({
    stopMeta,
    sizingMeta,
    constraints,
    profile: profileObj,
    instrument,
    style
  });

  // Métricas derivadas
  const targetPoints = round(stopMeta.stopBase * profileObj.rr, 2);
  const targetUSDPerContract = round(targetPoints * instrument.pointValue, 2);
  const targetUSDTotal = round(viability.effectiveMaxTrades > 0 ? sizingMeta.contracts * targetUSDPerContract : 0, 2);

  const dailyStop = round(viability.effectiveMaxTrades * sizingMeta.roBudget, 2);
  const dailyGoal = round(dailyStop * profileObj.rr, 2);

  // Stats informativos (preserva semântica do calculator atual)
  const dataSourceMeta = resolveDataSource(profile4D, indicators, profileObj.family);
  const winUSD = round(sizingMeta.roBudget * profileObj.rr, 2);
  const lossesToBust = sizingMeta.roBudget > 0
    ? Math.floor(constraints.drawdownBudget / sizingMeta.roBudget)
    : 0;
  const evPerTrade = round(
    (dataSourceMeta.assumedWR * winUSD) - ((1 - dataSourceMeta.assumedWR) * sizingMeta.roBudget),
    2
  );
  const wrBelowBreakeven = dataSourceMeta.assumedWR < RR2_BREAKEVEN_WR;

  return {
    constraintsType: constraints.type,
    profile: {
      code: profileObj.code,
      name: profileObj.name,
      family: profileObj.family,
      recommended: profileObj.recommended === true,
      roPct: profileObj.roPct,
      maxTradesPerDay: profileObj.maxTradesPerDay,
      rrMinimum: profileObj.rr
    },
    style,
    instrument: {
      symbol: instrument.symbol,
      name: instrument.name,
      type: instrument.type,
      isMicro: instrument.isMicro === true,
      pointValue: instrument.pointValue,
      avgDailyRange: instrument.avgDailyRange,
      minStopPoints: instrument.minStopPoints ?? null
    },
    mechanicalPlan: {
      // Stop
      stopBase: stopMeta.stopBase,
      stopUSDPerContract: sizingMeta.stopUSDPerContract,
      // Target
      targetPoints,
      targetUSDPerContract,
      targetUSDTotal,
      rrMinimum: profileObj.rr,
      // Sizing
      contracts: sizingMeta.contracts,
      roBudget: sizingMeta.roBudget,
      roEffective: sizingMeta.roEffective,
      // Diário
      maxTradesPerDay: viability.effectiveMaxTrades,
      maxTradesReducedFromProfile: viability.effectiveMaxTrades < profileObj.maxTradesPerDay,
      dailyStop,
      dailyGoal,
      // Estatística informativa
      lossesToBust,
      evPerTrade,
      assumedWR: dataSourceMeta.assumedWR,
      wrBelowBreakeven,
      winUSD
    },
    viability: {
      incompatible: viability.incompatible,
      inviabilityReason: viability.inviabilityReason,
      violations: viability.violations,
      microSuggestion: viability.microSuggestion,
      stopNyPct: viability.stopNyPct,
      nyRangePoints: stopMeta.nyRange,
      stopIsNoise: viability.stopIsNoise,
      nySessionViable: viability.nySessionViable,
      sessionRestricted: viability.sessionRestricted,
      recommendedSessions: viability.recommendedSessions,
      allowed: viability.allowed,
      clippedByFloor: stopMeta.clippedByFloor,
      clippedByCeiling: stopMeta.clippedByCeiling
    },
    meta: {
      dataSource: dataSourceMeta.dataSource,
      adjustmentFactor: round(dataSourceMeta.adjustmentFactor, 4),
      profileVariance: stopMeta.profileVariance,
      stopBaseRaw: stopMeta.stopBaseRaw,
      effectiveMinStop: stopMeta.effectiveMinStop,
      generatedAt: new Date().toISOString()
    }
  };
}

// ============================================
// toLegacyAttackPlanShape — adapter para consumers legados
// ============================================
// Mapeia o output novo de `calculatePlanMechanics` para o shape esperado por
// PlanoMecanicoCard / propPlanDefaults / propViabilityBadge / hooks que ainda
// consomem o formato `calculateAttackPlan` legado. Permite migração faseada
// sem tocar nos consumers até que sejam refatorados naturalmente.
//
// @param {Object} plan - output de calculatePlanMechanics
// @param {Object} templateRules - template original (para campos do mesa-only)
// @returns {Object} shape compatível com `mode: 'execution'` legado
export function toLegacyAttackPlanShape(plan, templateRules = null) {
  if (!plan) return null;
  const evalTimeLimit = templateRules?.evalTimeLimit ?? 30;
  const evalBusinessDays = evalTimeLimit > 0
    ? Math.max(1, Math.floor(evalTimeLimit * BUSINESS_DAYS_RATIO))
    : 21;
  const profitTarget = templateRules?.profitTarget ?? 0;
  const dailyTarget = profitTarget > 0
    ? Math.ceil(profitTarget / evalBusinessDays)
    : 0;
  const daysToTarget = dailyTarget > 0
    ? Math.ceil(profitTarget / dailyTarget)
    : evalBusinessDays;
  const drawdownMax = plan.constraintsType === 'prop'
    ? (templateRules?.drawdown?.maxAmount ?? 0)
    : 0;
  const dailyLossLimitFromRules = templateRules?.dailyLossLimit;
  const dailyLossLimit = dailyLossLimitFromRules && dailyLossLimitFromRules > 0
    ? dailyLossLimitFromRules
    : Math.max(1, Math.round(drawdownMax * NULL_DAILY_LOSS_FALLBACK_FRACTION));

  return {
    mode: 'execution',
    profile: plan.profile.code,
    profileName: plan.profile.name,
    profileFamily: plan.profile.family,
    profileRecommended: plan.profile.recommended,
    style: plan.style,
    dataSource: plan.meta.dataSource,
    adjustmentFactor: plan.meta.adjustmentFactor,
    assumedWR: plan.mechanicalPlan.assumedWR,
    wrBelowBreakeven: plan.mechanicalPlan.wrBelowBreakeven,

    drawdownMax,
    dailyLossLimit,
    profitTarget,
    phase: null,

    instrument: {
      symbol: plan.instrument.symbol,
      name: plan.instrument.name,
      isMicro: plan.instrument.isMicro,
      pointValue: plan.instrument.pointValue,
      avgDailyRange: plan.instrument.avgDailyRange,
      type: plan.instrument.type,
      minViableStop: plan.meta.effectiveMinStop
    },

    roPct: plan.profile.roPct,
    roPerTrade: plan.mechanicalPlan.roBudget,
    stopPoints: plan.mechanicalPlan.stopBase,
    stopPerTrade: plan.mechanicalPlan.stopUSDPerContract,
    targetPoints: plan.mechanicalPlan.targetPoints,
    targetPerTrade: plan.mechanicalPlan.targetUSDPerContract,
    rrMinimum: plan.mechanicalPlan.rrMinimum,
    stopNyPct: plan.viability.stopNyPct,
    nyRangePoints: plan.viability.nyRangePoints,

    winUSD: plan.mechanicalPlan.winUSD,
    lossesToBust: plan.mechanicalPlan.lossesToBust,
    evPerTrade: plan.mechanicalPlan.evPerTrade,
    maxTradesPerDay: plan.mechanicalPlan.maxTradesPerDay,

    dailyTarget,
    evalBusinessDays,
    daysToTarget,
    bufferDays: Math.max(0, evalBusinessDays - daysToTarget),

    sizing: plan.mechanicalPlan.contracts,
    contracts: plan.mechanicalPlan.contracts,

    incompatible: plan.viability.incompatible,
    inviabilityReason: plan.viability.inviabilityReason,
    microSuggestion: plan.viability.microSuggestion,
    stopIsNoise: plan.viability.stopIsNoise,
    nySessionViable: plan.viability.nySessionViable,
    sessionRestricted: plan.viability.sessionRestricted,
    recommendedSessions: plan.viability.recommendedSessions,
    constraintsViolated: plan.viability.violations,

    generatedAt: plan.meta.generatedAt
  };
}

// ============================================
// Helpers
// ============================================

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
