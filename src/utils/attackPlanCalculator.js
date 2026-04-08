// ============================================
// ATTACK PLAN CALCULATOR — Instrument-Aware
// ============================================
// Plano de ataque para conta prop firm. 100% rule-based.
//
// PRINCÍPIO FUNDAMENTAL:
// As regras da mesa (drawdownMax, dailyLossLimit, profitTarget) são HARD CONSTRAINTS
// absolutas. O instrumento operado define o stop natural realista (via ATR + minStop).
// O plano back-calcula RO real partindo do stop natural × pointValue.
//
// CONSTRAINTS INVIOLÁVEIS:
//   1. roPerTrade NUNCA pode exceder dailyLossLimit
//   2. stopPerTrade NUNCA pode exceder dailyLossLimit
//   3. roPerTrade × maxTradesPerDay NUNCA pode exceder dailyLossLimit
//   4. metaDiaria × diasUteis deve ser >= profitTarget
//
// MODOS DE OPERAÇÃO:
//   - SEM instrumento: retorna apenas constraints da mesa (modo 'abstract')
//   - COM instrumento: retorna plano completo de execução (modo 'execution')
//
// Ref: issue #52 Fase 1.5, sessão revisão 06/04/2026

import {
  ATTACK_PLAN_PROFILES,
  ATTACK_PLAN_DATA_SOURCES,
  PROP_FIRM_PHASES
} from '../constants/propFirmDefaults';
import {
  getInstrument,
  getRecommendedStop,
  suggestMicroAlternative,
  isInstrumentAllowed
} from '../constants/instrumentsTable';

// --- RR mínimo por perfil ---
const RR_MINIMUM = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: 1.5,
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: 2.0
};

// --- Cap operacional de trades/dia (independe da fórmula matemática) ---
const MAX_TRADES_CAP = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: 8,
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: 10
};

// --- Defaults de adjustmentFactor (sem 4D nem indicadores) ---
const DEFAULT_ADJUSTMENT_FACTORS = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: 0.3, // pessimista
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: 0.6    // moderado
};

// --- Margem do RO sobre o stop natural (gordura para slippage) ---
// roPerTrade = stopUSD × (1 + ROUND_UP_FACTOR). Ex: stop $40 + 25% = RO $50
const RO_OVERHEAD = {
  [ATTACK_PLAN_PROFILES.CONSERVATIVE]: 0.10, // +10% conservador (pouca gordura)
  [ATTACK_PLAN_PROFILES.AGGRESSIVE]: 0.20    // +20% agressivo (mais espaço)
};

// --- Quando mesa não tem dailyLossLimit, usar fração do drawdown como proxy ---
const DEFAULT_DAILY_LOSS_FRACTION = 0.25;

// --- Conversão dias corridos → dias úteis ---
const BUSINESS_DAYS_RATIO = 5 / 7;

// ============================================
// resolveDataSource — cascata 4D > indicadores > defaults
// ============================================

/**
 * Resolve fonte de dados e calcula adjustmentFactor (0..1).
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

// ============================================
// calculateMesaConstraints — modo abstract (sem instrumento)
// ============================================

/**
 * Calcula apenas as constraints da mesa, sem entrar em sizing/stop/RO.
 * Útil quando o aluno ainda não selecionou instrumento.
 *
 * @param {Object} templateRules - template da mesa
 * @returns {Object} constraints abstratas + dailyTarget
 */
export function calculateMesaConstraints(templateRules) {
  if (!templateRules) {
    throw new Error('templateRules é obrigatório');
  }

  const drawdownMax = templateRules.drawdown?.maxAmount ?? 0;
  const profitTarget = templateRules.profitTarget ?? 0;
  const evalTimeLimit = templateRules.evalTimeLimit ?? 30;

  const rawDailyLossLimit = templateRules.dailyLossLimit;
  const effectiveDailyLossLimit = rawDailyLossLimit && rawDailyLossLimit > 0
    ? rawDailyLossLimit
    : Math.max(1, Math.round(drawdownMax * DEFAULT_DAILY_LOSS_FRACTION));

  const evalBusinessDays = evalTimeLimit > 0
    ? Math.max(1, Math.floor(evalTimeLimit * BUSINESS_DAYS_RATIO))
    : 21;

  const dailyTarget = profitTarget > 0
    ? Math.ceil(profitTarget / evalBusinessDays)
    : 0;

  return {
    drawdownMax,
    dailyLossLimit: effectiveDailyLossLimit,
    profitTarget,
    evalTimeLimit,
    evalBusinessDays,
    dailyTarget
  };
}

// ============================================
// calculateAttackPlan — modo execution (com instrumento) ou abstract (sem)
// ============================================

/**
 * Calcula plano de ataque.
 *
 * @param {Object} templateRules - Template da mesa (propFirmTemplates doc)
 * @param {Object|null} profile4D - Perfil 4D do aluno
 * @param {Object|null} indicators - Indicadores derivados de trades
 * @param {string} planProfile - 'conservative' | 'aggressive'
 * @param {string} phase - Fase atual da conta
 * @param {string|null} instrumentSymbol - símbolo do instrumento (ex: 'MNQ', 'NQ', 'ES')
 *                                          OU null/undefined para modo abstract
 * @returns {Object} Plano de ataque
 */
export function calculateAttackPlan(templateRules, profile4D, indicators, planProfile, phase, instrumentSymbol = null) {
  if (!templateRules) {
    throw new Error('templateRules é obrigatório');
  }

  // Normalizar perfil/fase
  const validProfile = Object.values(ATTACK_PLAN_PROFILES).includes(planProfile)
    ? planProfile
    : ATTACK_PLAN_PROFILES.CONSERVATIVE;

  const validPhase = Object.values(PROP_FIRM_PHASES).includes(phase)
    ? phase
    : PROP_FIRM_PHASES.EVALUATION;

  // Constraints da mesa (sempre presentes)
  const mesaConstraints = calculateMesaConstraints(templateRules);
  const { drawdownMax, dailyLossLimit, profitTarget, evalBusinessDays, dailyTarget } = mesaConstraints;

  // Calibragem por perfil do aluno
  const { dataSource, adjustmentFactor } = resolveDataSource(profile4D, indicators, validProfile);

  // ============================================
  // MODO ABSTRACT — sem instrumento selecionado
  // ============================================
  if (!instrumentSymbol) {
    return {
      mode: 'abstract',
      profile: validProfile,
      dataSource,
      adjustmentFactor: round(adjustmentFactor, 4),

      // Constraints da mesa (sempre presentes)
      drawdownMax,
      dailyLossLimit,
      profitTarget,
      evalBusinessDays,
      dailyTarget,

      // Sem instrumento, valores de execução são null
      instrument: null,
      stopPoints: null,
      stopPerTrade: null,
      roPerTrade: null,
      rrMinimum: RR_MINIMUM[validProfile],
      maxTradesPerDay: null,
      sizing: null,

      // Mensagem informativa
      message: 'Selecione um instrumento para gerar o plano de execução completo.',

      constraintsViolated: [],
      generatedAt: new Date().toISOString()
    };
  }

  // ============================================
  // MODO EXECUTION — com instrumento
  // ============================================
  const instrument = getInstrument(instrumentSymbol);
  if (!instrument) {
    return {
      mode: 'error',
      profile: validProfile,
      dataSource,
      error: `Instrumento '${instrumentSymbol}' não encontrado na tabela`,
      constraintsViolated: ['instrument_not_found'],
      generatedAt: new Date().toISOString()
    };
  }

  // Verificar disponibilidade na mesa
  const firm = (templateRules.firm ?? '').toLowerCase();
  const allowed = !firm || isInstrumentAllowed(instrumentSymbol, firm);

  // Stop natural recomendado (max(ATR×5%, minStop))
  const stop = getRecommendedStop(instrument);
  const stopPoints = stop.stopPoints;
  const stopUSD = stop.stopUSD;

  // RR mínimo por perfil
  const rrMinimum = RR_MINIMUM[validProfile];

  // RO por trade = stop natural + overhead (gordura para slippage/comissão)
  const overhead = RO_OVERHEAD[validProfile];
  const adjustedOverhead = overhead * (1 + (1 - adjustmentFactor) * 0.5); // aluno fraco = mais gordura
  let roPerTrade = Math.ceil(stopUSD * (1 + adjustedOverhead));

  // ============================================
  // VERIFICAR FACTIBILIDADE
  // ============================================
  // Se RO por trade > daily loss limit, instrumento é incompatível
  // (1 trade já estoura o dia inteiro)
  let incompatible = false;
  let microSuggestion = null;

  if (roPerTrade > dailyLossLimit) {
    incompatible = true;
    // Sugerir micro variant se disponível
    if (!instrument.isMicro) {
      const micro = suggestMicroAlternative(instrumentSymbol);
      if (micro && (!firm || isInstrumentAllowed(micro.symbol, firm))) {
        microSuggestion = micro.symbol;
      }
    }
  }

  // Max trades por dia: cap operacional + constraint do daily loss
  const operationalCap = MAX_TRADES_CAP[validProfile];
  let maxTradesPerDay = incompatible
    ? 0
    : Math.min(
        operationalCap,
        Math.max(1, Math.floor(dailyLossLimit / roPerTrade))
      );

  // CONSTRAINT: roPerTrade × maxTradesPerDay ≤ dailyLossLimit
  // (já garantido pela divisão acima — sanity check)
  if (!incompatible && roPerTrade * maxTradesPerDay > dailyLossLimit) {
    roPerTrade = Math.floor(dailyLossLimit / maxTradesPerDay);
  }

  // Sizing: 1 contrato é o default seguro
  // (escalar para mais contratos = aumentar pointValue efetivo, não entra na Fase 1.5)
  const sizing = incompatible ? 0 : 1;

  // Days to target
  const daysToTarget = dailyTarget > 0
    ? Math.ceil(profitTarget / dailyTarget)
    : evalBusinessDays;
  const bufferDays = Math.max(0, evalBusinessDays - daysToTarget);

  // ============================================
  // VALIDAÇÃO DAS CONSTRAINTS
  // ============================================
  const constraintsViolated = [];
  if (!incompatible) {
    if (roPerTrade > dailyLossLimit) {
      constraintsViolated.push('roPerTrade excede dailyLossLimit');
    }
    if (stopUSD > dailyLossLimit) {
      constraintsViolated.push('stopPerTrade excede dailyLossLimit');
    }
    if (roPerTrade * maxTradesPerDay > dailyLossLimit) {
      constraintsViolated.push('roPerTrade × maxTradesPerDay excede dailyLossLimit');
    }
    if (dailyTarget * evalBusinessDays < profitTarget) {
      constraintsViolated.push('metaDiaria × diasUteis < profitTarget');
    }
  }

  if (!allowed) {
    constraintsViolated.push(`instrumento '${instrumentSymbol}' não permitido na mesa '${firm}'`);
  }

  return {
    mode: 'execution',
    profile: validProfile,
    dataSource,
    adjustmentFactor: round(adjustmentFactor, 4),

    // Hard limits da mesa
    drawdownMax,
    dailyLossLimit,
    profitTarget,

    // Instrumento
    instrument: {
      symbol: instrument.symbol,
      name: instrument.name,
      isMicro: instrument.isMicro,
      pointValue: instrument.pointValue,
      avgDailyRange: instrument.avgDailyRange,
      type: instrument.type
    },

    // Por trade (instrument-aware)
    stopPoints,                          // pontos no instrumento (ex: 20 pts MNQ)
    stopPerTrade: round(stopUSD, 2),     // USD (ex: $40 MNQ, $400 NQ)
    stopSource: stop.source,             // 'atr' ou 'min'
    roPerTrade,                          // USD (stop + overhead, ex: $44 ou $48)
    rrMinimum,
    targetPerTrade: round(stopUSD * rrMinimum, 2), // USD esperado por trade ganho

    // Diário
    maxTradesPerDay,
    dailyTarget,

    // Total avaliação
    evalBusinessDays,
    daysToTarget,
    bufferDays,

    // Sizing (1 contrato fixo na Fase 1.5)
    sizing,

    // Factibilidade
    incompatible,
    microSuggestion,

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
