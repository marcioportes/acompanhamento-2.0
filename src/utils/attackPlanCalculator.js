// ============================================
// ATTACK PLAN CALCULATOR — Determinístico (5 perfis) — DEPRECATED
// ============================================
// @deprecated Substituído por `src/utils/calculatePlanMechanics.js` (issue #201).
// Este arquivo é mantido como wrapper de back-compat enquanto os 6 call sites
// migram para o motor novo. Novos consumidores DEVEM usar `calculatePlanMechanics`,
// que recebe `style` (scalp|day|swing|conviction) + `instrument` mandatórios e
// computa stop estrutural por ATR + sizing dinâmico (em vez do back-calc fixo
// de `stopPoints = roUSD / pointValue` × `sizing = 1` deste módulo).
//
// MODELO LEGADO (Fase 1.5 v2 — 07/04/2026):
//   RO por trade = drawdownMax × profile.roPct (10%, 15%, 20%, 25%, 30%)
//   stopPoints   = roUSD / instrument.pointValue   ← back-calculado do RO
//   targetPoints = stopPoints × profile.rr (RR fixo 1:2)
//   maxTradesPerDay = profile.maxTradesPerDay (2 conservadores, 1 agressivos)
//
// INVERSÃO INTENCIONAL: quanto mais arrisca, MENOS opera.
// Disciplina forçada pelo sizing.
//
// VIABILIDADE:
//   - Se stopPoints < MIN_VIABLE_STOP[type] → INVIÁVEL → sugere micro
//   - Se stopNyPct > MAX_STOP_NY_PCT (75%) → INVIÁVEL (vela única consome stop)
//   - Se roUSD > dailyLossLimit → INVIÁVEL
//   - Se roUSD × maxTradesPerDay > dailyLossLimit → reduz maxTradesPerDay
//
// MODOS:
//   - SEM instrumento: modo 'abstract' (apenas constraints da mesa + perfil)
//   - COM instrumento: modo 'execution' (plano completo com sizing/stop/RO)
//
// Ref: issue #52 Fase 1.5, Temp/attack-plan-deterministic-table.md v2.0

import {
  ATTACK_PROFILES,
  ATTACK_PLAN_DATA_SOURCES,
  PROP_FIRM_PHASES,
  MIN_VIABLE_STOP,
  MAX_STOP_NY_PCT,
  MIN_STOP_NY_PCT,
  NY_MIN_VIABLE_STOP_PCT,
  NY_RANGE_FRACTION,
  DEFAULT_ASSUMED_WR,
  RR2_BREAKEVEN_WR,
  DEFAULT_ATTACK_PROFILE,
  normalizeAttackProfile
} from '../constants/propFirmDefaults';
import {
  getInstrument,
  suggestMicroAlternative,
  isInstrumentAllowed
} from '../constants/instrumentsTable';
import { getActiveDrawdown } from './propFirmDrawdownEngine';

// Quando mesa não tem dailyLossLimit, usar fração do drawdown como proxy
const DEFAULT_DAILY_LOSS_FRACTION = 0.25;

// Conversão dias corridos → dias úteis
const BUSINESS_DAYS_RATIO = 5 / 7;

// Defaults de adjustmentFactor (transparência da calibragem, não usado no cálculo principal)
const DEFAULT_ADJUSTMENT_FACTORS = {
  conservative: 0.3, // pessimista
  aggressive: 0.6    // moderado
};

// ============================================
// resolveDataSource — cascata 4D > indicadores > defaults
// ============================================

/**
 * Resolve fonte de dados, adjustmentFactor (0..1) e WR efetivo (para EV).
 *
 * @param {Object|null} profile4D
 * @param {Object|null} indicators
 * @param {string} profileFamily - 'conservative' | 'aggressive'
 */
export function resolveDataSource(profile4D, indicators, profileFamily = 'conservative') {
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

    // WR pode vir de indicators se disponível, senão default
    const assumedWR = (indicators && typeof indicators.winRate === 'number')
      ? indicators.winRate
      : DEFAULT_ASSUMED_WR;

    return {
      dataSource: ATTACK_PLAN_DATA_SOURCES.FULL_4D,
      adjustmentFactor: clamp(adjustmentFactor, 0, 1),
      assumedWR
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
      adjustmentFactor: clamp(adjustmentFactor, 0, 1),
      assumedWR: indicators.winRate
    };
  }

  // 3ª prioridade: Defaults
  return {
    dataSource: ATTACK_PLAN_DATA_SOURCES.DEFAULTS,
    adjustmentFactor: DEFAULT_ADJUSTMENT_FACTORS[profileFamily] ?? 0.3,
    assumedWR: DEFAULT_ASSUMED_WR
  };
}

// ============================================
// calculateMesaConstraints — apenas constraints da mesa
// ============================================

export function calculateMesaConstraints(templateRules, phase = 'EVALUATION') {
  if (!templateRules) {
    throw new Error('templateRules é obrigatório');
  }

  // Phase-aware: SIM_FUNDED/LIVE usa fundedDrawdown se disponível (issue #145 Fase C)
  const activeDrawdown = getActiveDrawdown(templateRules, phase);
  const drawdownMax = activeDrawdown?.maxAmount ?? 0;
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
// calculateAttackPlan — modos abstract / execution — DEPRECATED
// ============================================

/**
 * Calcula plano de ataque determinístico (modelo legado, back-calc).
 *
 * @deprecated Use `calculatePlanMechanics` (src/utils/calculatePlanMechanics.js).
 * O modelo back-calc deste módulo produz `stopPoints = roUSD / pointValue` e
 * `sizing = 1`, o que gera stops desconectados da volatilidade real do
 * instrumento (ex: 187pts × 1 contrato MNQ em conta 50K). O motor novo
 * substitui por stop estrutural ATR-based + sizing dinâmico.
 *
 * @param {Object} templateRules - template da mesa
 * @param {Object|null} profile4D
 * @param {Object|null} indicators - { winRate, coefficientOfVariation, ... }
 * @param {string} planProfile - código do perfil (CONS_A..AGRES_B). Aceita legados 'conservative'/'aggressive'
 * @param {string} phase - fase da conta (EVALUATION/SIM_FUNDED/LIVE)
 * @param {string|null} instrumentSymbol - símbolo do instrumento (null = modo abstract)
 */
export function calculateAttackPlan(templateRules, profile4D, indicators, planProfile, phase, instrumentSymbol = null) {
  if (!templateRules) {
    throw new Error('templateRules é obrigatório');
  }

  // Normalizar perfil (suporta legados) e fase
  const profileKey = normalizeAttackProfile(planProfile);
  const profile = ATTACK_PROFILES[profileKey] ?? ATTACK_PROFILES[DEFAULT_ATTACK_PROFILE];

  const validPhase = Object.values(PROP_FIRM_PHASES).includes(phase)
    ? phase
    : PROP_FIRM_PHASES.EVALUATION;

  // Constraints da mesa — phase-aware (issue #145 Fase C)
  const mesaConstraints = calculateMesaConstraints(templateRules, validPhase);
  const { drawdownMax, dailyLossLimit, profitTarget, evalBusinessDays, dailyTarget } = mesaConstraints;

  // Calibragem por perfil do aluno (transparência + WR para EV)
  const { dataSource, adjustmentFactor, assumedWR } = resolveDataSource(profile4D, indicators, profile.family);

  // ============================================
  // CÁLCULO DETERMINÍSTICO BASE (sem instrumento)
  // ============================================
  const roUSD = round(drawdownMax * profile.roPct, 2);
  const winUSD = round(roUSD * profile.rr, 2);
  const lossesToBust = roUSD > 0 ? Math.floor(drawdownMax / roUSD) : 0;
  const evPerTrade = round((assumedWR * winUSD) - ((1 - assumedWR) * roUSD), 2);
  const wrBelowBreakeven = assumedWR < RR2_BREAKEVEN_WR;

  // ============================================
  // MODO ABSTRACT — sem instrumento selecionado
  // ============================================
  if (!instrumentSymbol) {
    return {
      mode: 'abstract',
      profile: profileKey,
      profileName: profile.name,
      profileFamily: profile.family,
      profileRecommended: profile.recommended === true,
      dataSource,
      adjustmentFactor: round(adjustmentFactor, 4),
      assumedWR,
      wrBelowBreakeven,

      // Constraints da mesa
      drawdownMax,
      dailyLossLimit,
      profitTarget,
      evalBusinessDays,
      dailyTarget,
      phase: validPhase,

      // Plano determinístico (sem instrumento — apenas USD)
      roPerTrade: roUSD,
      roPct: profile.roPct,
      rrMinimum: profile.rr,
      winUSD,
      lossesToBust,
      evPerTrade,
      maxTradesPerDay: profile.maxTradesPerDay,

      // Sem instrumento, valores em pontos são null
      instrument: null,
      stopPoints: null,
      stopPerTrade: null,
      targetPoints: null,
      targetPerTrade: null,
      stopNyPct: null,
      sizing: null,

      message: 'Selecione um instrumento para gerar o plano de execução completo.',
      incompatible: false,
      microSuggestion: null,
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
      profile: profileKey,
      dataSource,
      error: `Instrumento '${instrumentSymbol}' não encontrado na tabela`,
      constraintsViolated: ['instrument_not_found'],
      generatedAt: new Date().toISOString()
    };
  }

  // Verificar disponibilidade na mesa
  const firm = (templateRules.firm ?? '').toLowerCase();
  const allowed = !firm || isInstrumentAllowed(instrumentSymbol, firm);

  // Stop em pontos = back-calculated do RO em USD
  const stopPoints = round(roUSD / instrument.pointValue, 4);
  const targetPoints = round(stopPoints * profile.rr, 4);

  // Stop como % do range esperado da sessão NY
  const nyRange = instrument.avgDailyRange * NY_RANGE_FRACTION;
  const stopNyPct = nyRange > 0 ? round((stopPoints / nyRange) * 100, 2) : 0;

  // Stop USD efetivo (idêntico a roUSD por construção, mas explícito)
  const stopUSD = round(stopPoints * instrument.pointValue, 2);
  const targetUSD = round(targetPoints * instrument.pointValue, 2);

  // ============================================
  // CHECAGENS DE VIABILIDADE
  // ============================================
  const minViableStop = MIN_VIABLE_STOP[instrument.type] ?? 0;
  const constraintsViolated = [];
  let incompatible = false;
  let microSuggestion = null;
  let inviabilityReason = null;

  // V1: Stop em pontos abaixo do mínimo viável → ruído no instrumento
  if (stopPoints < minViableStop) {
    incompatible = true;
    inviabilityReason = `stop ${stopPoints}pts abaixo do mínimo viável ${minViableStop}pts para ${instrument.type}`;
    constraintsViolated.push('stop_below_min_viable');
  }

  // V2: Stop excede 75% do range NY → vela única consome
  if (stopNyPct > MAX_STOP_NY_PCT) {
    incompatible = true;
    inviabilityReason = inviabilityReason
      ?? `stop ${stopNyPct.toFixed(1)}% do range NY excede limite ${MAX_STOP_NY_PCT}%`;
    constraintsViolated.push('stop_exceeds_ny_range');
  }

  // V3: RO maior que daily loss → 1 trade estoura o dia
  if (roUSD > dailyLossLimit) {
    incompatible = true;
    inviabilityReason = inviabilityReason
      ?? `RO $${roUSD} excede daily loss $${dailyLossLimit}`;
    constraintsViolated.push('ro_exceeds_daily_loss');
  }

  // Sugerir micro alternative se incompatível e instrumento é full size
  if (incompatible && !instrument.isMicro) {
    const micro = suggestMicroAlternative(instrumentSymbol);
    if (micro && (!firm || isInstrumentAllowed(micro.symbol, firm))) {
      microSuggestion = micro.symbol;
    }
  }

  // V4: maxTradesPerDay × RO não pode exceder daily loss → reduzir
  let maxTradesPerDay = incompatible ? 0 : profile.maxTradesPerDay;
  if (!incompatible && roUSD * maxTradesPerDay > dailyLossLimit) {
    maxTradesPerDay = Math.max(1, Math.floor(dailyLossLimit / roUSD));
  }

  // V5: instrumento não permitido na mesa
  if (!allowed) {
    constraintsViolated.push(`instrumento '${instrumentSymbol}' não permitido na mesa '${firm}'`);
  }

  // Stop notavelmente pequeno (< 5% do range NY) — warning, não inviabiliza
  const stopIsNoise = !incompatible && stopNyPct < MIN_STOP_NY_PCT && stopNyPct > 0;

  // Restrição de sessão: stop pequeno relativo ao range NY → operar fora de NY.
  // Threshold 12.5% (≈30 pts no NQ). NY consome stops abaixo disso por volatilidade.
  // Não inviabiliza — restringe sessões recomendadas.
  const nySessionViable = !incompatible && stopNyPct >= NY_MIN_VIABLE_STOP_PCT;
  const recommendedSessions = incompatible
    ? []
    : (nySessionViable ? ['ny', 'london', 'asia'] : ['london', 'asia']);
  const sessionRestricted = !incompatible && !nySessionViable;

  // Sizing: 1 contrato fixo (escalar = Fase futura)
  const sizing = incompatible ? 0 : 1;

  // Days to target (sanity)
  const daysToTarget = dailyTarget > 0
    ? Math.ceil(profitTarget / dailyTarget)
    : evalBusinessDays;
  const bufferDays = Math.max(0, evalBusinessDays - daysToTarget);

  return {
    mode: 'execution',
    profile: profileKey,
    profileName: profile.name,
    profileFamily: profile.family,
    profileRecommended: profile.recommended === true,
    dataSource,
    adjustmentFactor: round(adjustmentFactor, 4),
    assumedWR,
    wrBelowBreakeven,

    // Hard limits da mesa
    drawdownMax,
    dailyLossLimit,
    profitTarget,
    phase: validPhase,

    // Instrumento
    instrument: {
      symbol: instrument.symbol,
      name: instrument.name,
      isMicro: instrument.isMicro,
      pointValue: instrument.pointValue,
      avgDailyRange: instrument.avgDailyRange,
      type: instrument.type,
      minViableStop
    },

    // Por trade (back-calculated do RO)
    roPct: profile.roPct,
    roPerTrade: roUSD,
    stopPoints,
    stopPerTrade: stopUSD,
    targetPoints,
    targetPerTrade: targetUSD,
    rrMinimum: profile.rr,
    stopNyPct,
    nyRangePoints: round(nyRange, 2),

    // Estatísticas e EV
    winUSD,
    lossesToBust,
    evPerTrade,
    maxTradesPerDay,

    // Diário / total
    dailyTarget,
    evalBusinessDays,
    daysToTarget,
    bufferDays,

    // Sizing
    sizing,

    // Viabilidade
    incompatible,
    inviabilityReason,
    microSuggestion,
    stopIsNoise,
    nySessionViable,
    sessionRestricted,
    recommendedSessions,
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

// Re-export do motor novo para facilitar migração dos call sites.
// Novos consumidores DEVEM usar este path em vez de `calculateAttackPlan`.
export {
  calculatePlanMechanics,
  buildMesaConstraints,
  buildRetailConstraints
} from './calculatePlanMechanics';
