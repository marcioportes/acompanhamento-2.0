// ============================================
// ATTACK PLAN CALCULATOR — Hard Constraints
// ============================================
// Plano de ataque para conta prop firm. 100% rule-based.
//
// PRINCÍPIO FUNDAMENTAL:
// As regras da mesa (drawdownMax, dailyLossLimit, profitTarget) são HARD CONSTRAINTS
// absolutas — NUNCA inputs para fórmulas de percentual genérico.
//
// CONSTRAINTS INVIOLÁVEIS:
//   1. roPerTrade NUNCA pode exceder dailyLossLimit
//   2. stopPerTrade NUNCA pode exceder dailyLossLimit
//   3. roPerTrade × maxTradesPerDay NUNCA pode exceder dailyLossLimit
//   4. metaDiaria × diasUteis deve ser >= profitTarget
//
// Ref: issue #52, sessão revisão crítica 06/04/2026
// Spec aprovada: AccountsPage → calculateAttackPlan(template, profile4D, indicators, planProfile, phase)

import {
  ATTACK_PLAN_PROFILES,
  ATTACK_PLAN_DATA_SOURCES,
  PROP_FIRM_PHASES
} from '../constants/propFirmDefaults';

// --- Fator do RO sobre dailyLossLimit, por perfil ---
// RO por trade = dailyLossLimit × fator. Conservador usa fração menor.
const RO_FACTOR_RANGES = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: { min: 0.08, max: 0.12 }, // 8-12% do daily loss
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: { min: 0.15, max: 0.20 }    // 15-20% do daily loss
};

// --- Cap operacional de trades/dia ---
const MAX_TRADES_CAP = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: 8,
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: 10
};

// --- RR mínimo por perfil ---
const RR_MINIMUM = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: 1.5,
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: 2.0
};

// --- Defaults de adjustmentFactor (sem 4D nem indicadores) ---
const DEFAULT_ADJUSTMENT_FACTORS = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: 0.3, // pessimista
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: 0.6    // moderado
};

// --- Quando mesa não tem dailyLossLimit, usar fração do drawdown como proxy ---
// Apex Intraday e MFF Core não têm daily loss explícito → conservador: 25% do drawdown.
const DEFAULT_DAILY_LOSS_FRACTION = 0.25;

// --- Conversão dias corridos → dias úteis (5 dias úteis a cada 7) ---
const BUSINESS_DAYS_RATIO = 5 / 7;

/**
 * Resolve fonte de dados e calcula adjustmentFactor (0..1).
 * Cascata: 4D completo > indicadores > defaults.
 */
export function resolveDataSource(profile4D, indicators, planProfile) {
  // 1ª prioridade: Perfil 4D completo
  if (profile4D &&
      typeof profile4D.emotionalScore === 'number' &&
      typeof profile4D.stage === 'number' &&
      typeof profile4D.coefficientOfVariation === 'number') {
    const emotionalFactor = profile4D.emotionalScore / 100;
    const maturityFactor = profile4D.stage / 5;
    const consistencyFactor = Math.max(0, 1 - profile4D.coefficientOfVariation);

    const adjustmentFactor =
      (emotionalFactor * 0.4) +
      (maturityFactor * 0.3) +
      (consistencyFactor * 0.3);

    return {
      dataSource: ATTACK_PLAN_DATA_SOURCES.FULL_4D,
      adjustmentFactor: clamp(adjustmentFactor, 0, 1)
    };
  }

  // 2ª prioridade: Indicadores sem 4D
  if (indicators &&
      typeof indicators.winRate === 'number' &&
      typeof indicators.coefficientOfVariation === 'number') {
    const maturityProxy = indicators.winRate;
    const consistencyFactor = Math.max(0, 1 - indicators.coefficientOfVariation);
    const emotionalDefault = 0.5;

    const adjustmentFactor =
      (emotionalDefault * 0.4) +
      (maturityProxy * 0.3) +
      (consistencyFactor * 0.3);

    return {
      dataSource: ATTACK_PLAN_DATA_SOURCES.INDICATORS,
      adjustmentFactor: clamp(adjustmentFactor, 0, 1)
    };
  }

  // 3ª prioridade: Defaults
  return {
    dataSource: ATTACK_PLAN_DATA_SOURCES.DEFAULTS,
    adjustmentFactor: DEFAULT_ADJUSTMENT_FACTORS[planProfile]
  };
}

/**
 * Calcula plano de ataque com hard constraints da mesa.
 *
 * @param {Object} templateRules - Template da mesa (propFirmTemplates doc)
 * @param {Object|null} profile4D - Perfil 4D do aluno
 * @param {Object|null} indicators - Indicadores derivados de trades
 * @param {string} planProfile - 'conservative' | 'aggressive'
 * @param {string} phase - Fase atual da conta (EVALUATION, SIM_FUNDED, LIVE)
 * @returns {Object} Plano de ataque
 */
export function calculateAttackPlan(templateRules, profile4D, indicators, planProfile, phase) {
  if (!templateRules) {
    throw new Error('templateRules é obrigatório');
  }

  // Normalizar perfil/fase com defaults seguros
  const validProfile = Object.values(ATTACK_PLAN_PROFILES).includes(planProfile)
    ? planProfile
    : ATTACK_PLAN_PROFILES.CONSERVATIVE;

  const validPhase = Object.values(PROP_FIRM_PHASES).includes(phase)
    ? phase
    : PROP_FIRM_PHASES.EVALUATION;

  // ============================================
  // HARD CONSTRAINTS DA MESA (valores absolutos)
  // ============================================
  const drawdownMax = templateRules.drawdown?.maxAmount ?? 0;
  const profitTarget = templateRules.profitTarget ?? 0;
  const evalTimeLimit = templateRules.evalTimeLimit ?? 30;

  // Daily loss limit: usar valor da mesa se existir, senão proxy
  // Mínimo absoluto de $1 para evitar divisão por zero / RO inválido
  const rawDailyLossLimit = templateRules.dailyLossLimit;
  const effectiveDailyLossLimit = rawDailyLossLimit && rawDailyLossLimit > 0
    ? rawDailyLossLimit
    : Math.max(1, Math.round(drawdownMax * DEFAULT_DAILY_LOSS_FRACTION));

  // ============================================
  // CALIBRAGEM POR PERFIL DO ALUNO
  // ============================================
  const { dataSource, adjustmentFactor } = resolveDataSource(profile4D, indicators, validProfile);

  // Fator do RO = % do daily loss, escalado pelo adjustment
  const range = RO_FACTOR_RANGES[validProfile];
  const roFactor = range.min + (adjustmentFactor * (range.max - range.min));

  // ============================================
  // CÁLCULO COM CONSTRAINTS
  // ============================================

  // 1. RO por trade = % do daily loss limit (NUNCA do drawdown)
  let roPerTrade = Math.max(1, Math.floor(effectiveDailyLossLimit * roFactor));

  // 2. Max trades por dia: cap operacional + constraint
  const operationalCap = MAX_TRADES_CAP[validProfile];
  let maxTradesPerDay = Math.min(
    operationalCap,
    Math.max(1, Math.floor(effectiveDailyLossLimit / roPerTrade))
  );

  // 3. CONSTRAINT: roPerTrade × maxTradesPerDay ≤ dailyLossLimit
  // Já garantido pela divisão acima (floor garante que ⌊x/y⌋ × y ≤ x).
  // Mas verificar explicitamente por segurança:
  if (roPerTrade * maxTradesPerDay > effectiveDailyLossLimit) {
    roPerTrade = Math.floor(effectiveDailyLossLimit / maxTradesPerDay);
  }

  // 4. CONSTRAINT: roPerTrade ≤ dailyLossLimit (trivialmente garantido pelo cálculo)
  if (roPerTrade > effectiveDailyLossLimit) {
    roPerTrade = effectiveDailyLossLimit;
    maxTradesPerDay = 1;
  }

  // 5. RR mínimo por perfil (conservador 1.5:1, agressivo 2:1)
  const rrMinimum = RR_MINIMUM[validProfile];

  // 6. Stop por trade = roPerTrade / rrMinimum (spec literal do user)
  // Interpretação: roPerTrade é o "orçamento" do trade, stopPerTrade é o stop loss real
  // proporcional ao RR desejado. Stop sempre ≤ RO.
  const stopPerTrade = Math.max(1, Math.floor(roPerTrade / rrMinimum));

  // CONSTRAINT: stopPerTrade ≤ dailyLossLimit (trivialmente garantido)
  // (stopPerTrade < roPerTrade < dailyLossLimit por construção)

  // ============================================
  // META DIÁRIA — derivada do profitTarget e dias úteis
  // ============================================

  // Dias úteis efetivos no prazo de avaliação
  const evalBusinessDays = evalTimeLimit > 0
    ? Math.max(1, Math.floor(evalTimeLimit * BUSINESS_DAYS_RATIO))
    : 21;

  // Meta diária: usar Math.ceil para garantir constraint metaDiaria × diasUteis >= profitTarget
  const dailyTarget = profitTarget > 0
    ? Math.ceil(profitTarget / evalBusinessDays)
    : 0;

  // Days to target — quantos dias bem-sucedidos para bater o profit
  const daysToTarget = dailyTarget > 0
    ? Math.ceil(profitTarget / dailyTarget)
    : evalBusinessDays;

  // Buffer = margem de segurança em dias
  const bufferDays = Math.max(0, evalBusinessDays - daysToTarget);

  // ============================================
  // VALIDAÇÃO DAS CONSTRAINTS (sanity check)
  // ============================================
  const constraintsViolated = [];
  if (roPerTrade > effectiveDailyLossLimit) {
    constraintsViolated.push('roPerTrade excede dailyLossLimit');
  }
  if (stopPerTrade > effectiveDailyLossLimit) {
    constraintsViolated.push('stopPerTrade excede dailyLossLimit');
  }
  if (roPerTrade * maxTradesPerDay > effectiveDailyLossLimit) {
    constraintsViolated.push('roPerTrade × maxTradesPerDay excede dailyLossLimit');
  }
  if (dailyTarget * evalBusinessDays < profitTarget) {
    constraintsViolated.push('metaDiaria × diasUteis < profitTarget');
  }

  return {
    profile: validProfile,
    dataSource,
    adjustmentFactor: round(adjustmentFactor, 4),

    // Hard limits da mesa (valores absolutos, referência para alerta)
    drawdownMax,
    dailyLossLimit: effectiveDailyLossLimit,
    profitTarget,

    // Por trade (valores absolutos em USD)
    roPerTrade,        // ex: $50
    stopPerTrade,      // ex: $33 (= roPerTrade / rrMinimum)
    rrMinimum,         // ex: 1.5
    roFactor: round(roFactor, 4), // ex: 0.10

    // Diário
    maxTradesPerDay,   // ex: 8 (cap operacional)
    dailyTarget,       // ex: $72 (profitTarget / dias úteis)

    // Total avaliação
    evalBusinessDays,  // ex: 21 dias úteis
    daysToTarget,      // ex: 21 dias
    bufferDays,        // ex: 0 dias

    // Sizing depende do instrumento (calculado depois)
    sizing: null,

    // Validação
    constraintsViolated,

    generatedAt: new Date().toISOString()
  };
}

// --- Helpers ---

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
