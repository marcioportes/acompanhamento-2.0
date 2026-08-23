// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/constants.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

const STAGE_BASES = {
  1: 0,
  2: 20,
  3: 40,
  4: 60,
  5: 80,
};

const STAGE_NAMES = {
  1: 'CHAOS',
  2: 'REACTIVE',
  3: 'METHODICAL',
  4: 'PROFESSIONAL',
  5: 'MASTERY',
};

const GATES_BY_TRANSITION = {
  '1-2': [
    { id: 'maxdd-under-20', label: 'MaxDD < 25%', dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 25},
    { id: 'rule-compliance-80', label: 'Compliance ≥ 60%', dim: 'op', metric: 'complianceRate', op: '>=', threshold: 60},
    { id: 'emotional-out-of-fragile', label: 'Emocional ≥ 25', dim: 'emo', metric: 'E', op: '>=', threshold: 25},
    { id: 'basic-journal', label: 'Journal em 40%+ dos trades', dim: 'op', metric: 'journalRate', op: '>=', threshold: 0.40},
    { id: 'stop-usage', label: 'Stop em 60%+ dos trades', dim: 'fin', metric: 'stopUsageRate', op: '>=', threshold: 0.60},
    { id: 'plan-linked-trades', label: 'Plan-linked ≥ 60%', dim: 'op', metric: 'planAdherence', op: '>=', threshold: 60},
    { id: 'rule-violation-rate-30', label: 'Padrões de risco ≤ 45%', dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.45},
  ],
  '2-3': [
    { id: 'emotional-55', label: 'Emocional ≥ 45', dim: 'emo', metric: 'E', op: '>=', threshold: 45},
    { id: 'financial-solid', label: 'Financial ≥ 55', dim: 'fin', metric: 'F', op: '>=', threshold: 55},
    { id: 'operational-65', label: 'Operacional ≥ 55', dim: 'op', metric: 'O', op: '>=', threshold: 55},
    { id: 'strategy-8-weeks', label: '6 semanas sem trocar estratégia', dim: 'op', metric: 'strategyConsWks', op: '>=', threshold: 6},
    { id: 'journal-90', label: 'Journal ≥ 75%', dim: 'op', metric: 'journalRate', op: '>=', threshold: 0.75},
    { id: 'compliance-95', label: 'Compliance ≥ 70%', dim: 'op', metric: 'complianceRate', op: '>=', threshold: 70},
    { id: 'winrate-45', label: 'Win rate ≥ 40%', dim: 'fin', metric: 'winRate', op: '>=', threshold: 40},
    { id: 'payoff-1_2', label: 'Payoff ≥ 1.0', dim: 'fin', metric: 'payoff', op: '>=', threshold: 1.0},
    { id: 'rule-violation-rate-15', label: 'Padrões de risco ≤ 35%', dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.35},
  ],
  '3-4': [
    { id: 'emotional-75', label: 'Emocional ≥ 65', dim: 'emo', metric: 'E', op: '>=', threshold: 65},
    { id: 'financial-fortified', label: 'Financial ≥ 70', dim: 'fin', metric: 'F', op: '>=', threshold: 70},
    { id: 'operational-80', label: 'Operacional ≥ 70', dim: 'op', metric: 'O', op: '>=', threshold: 70},
    { id: 'strategy-12-months', label: '6 meses com a mesma estratégia', dim: 'op', metric: 'strategyConsMonths', op: '>=', threshold: 6},
    { id: 'advanced-metrics', label: 'MEP/MEN/Sharpe rastreados', dim: 'op', metric: 'advancedMetricsPresent', op: '==', threshold: true },
    { id: 'compliance-100', label: 'Compliance ≥ 85%', dim: 'op', metric: 'complianceRate100', op: '>=', threshold: 85},
    { id: 'winrate-55', label: 'Win rate ≥ 48%', dim: 'fin', metric: 'winRate', op: '>=', threshold: 48},
    { id: 'payoff-2', label: 'Payoff ≥ 1.5', dim: 'fin', metric: 'payoff', op: '>=', threshold: 1.5},
    { id: 'maxdd-5', label: 'MaxDD < 12%', dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 12},
    { id: 'sharpe-1_2', label: 'Sharpe ≥ 0.8', dim: 'fin', metric: 'monthlySharpe', op: '>=', threshold: 0.8},
    // Issue #208 — gates comportamentais. METRIC_UNAVAILABLE quando <30 trades
    // com order data linked (DEC-AUTO-208-03).
    { id: 'no-stop-tampering', label: 'No máximo 2 mexidas no stop', dim: 'op', metric: 'stopTamperingCount', op: '<=', threshold: 2},
    { id: 'no-chase', label: 'No máximo 2 chase reentries', dim: 'op', metric: 'chaseCount', op: '<=', threshold: 2},
    { id: 'disciplined-sizing', label: 'No máximo 2 saídas parciais por desconforto', dim: 'op', metric: 'partialStopCount', op: '<=', threshold: 2},
    { id: 'rule-violation-rate-5', label: 'Padrões de risco ≤ 20%', dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.20},
  ],
  '4-5': [
    { id: 'emotional-85', label: 'Emocional ≥ 80 (SAGE)', dim: 'emo', metric: 'E', op: '>=', threshold: 80},
    { id: 'financial-90', label: 'Financial ≥ 80', dim: 'fin', metric: 'F', op: '>=', threshold: 80},
    { id: 'payoff-2_5', label: 'Payoff ≥ 2.0', dim: 'fin', metric: 'payoff', op: '>=', threshold: 2.0},
    { id: 'winrate-55-stable', label: 'Win rate ≥ 52% estável', dim: 'fin', metric: 'winRate', op: '>=', threshold: 52},
    { id: 'maxdd-3', label: 'MaxDD < 8%', dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 8},
    { id: 'cv-low', label: 'CV < 0.8', dim: 'fin', metric: 'cv', op: '<', threshold: 0.8},
    { id: 'zero-tilt-revenge', label: 'No máximo 1 tilt/revenge', dim: 'emo', metric: 'tiltRevengeCount', op: '<=', threshold: 1},
    { id: 'annual-return-15', label: 'Retorno anual ≥ 12%', dim: 'fin', metric: 'annualizedReturn', op: '>=', threshold: 12},
    { id: 'sharpe-1_5', label: 'Sharpe anual ≥ 1.2', dim: 'fin', metric: 'annualSharpe', op: '>=', threshold: 1.2},
    { id: 'rule-violation-rate-1', label: 'Padrões de risco ≤ 10%', dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.10},
  ],
};

const STAGE_WINDOWS = {
  1: { minTrades: 20, minDays: 30, floorTrades: 5 },
  2: { minTrades: 30, minDays: 45, floorTrades: 5 },
  3: { minTrades: 50, minDays: 60, floorTrades: 5 },
  4: { minTrades: 80, minDays: 90, floorTrades: 5 },
  5: { minTrades: 100, minDays: 90, floorTrades: 5 },
};

const COMPOSITE_WEIGHTS = {
  emotional: 0.25,
  financial: 0.25,
  operational: 0.20,
  maturity: 0.30,
};

const ENGINE_VERSION = '1.43.0-engine-a';

module.exports = {
  STAGE_BASES,
  STAGE_NAMES,
  GATES_BY_TRANSITION,
  STAGE_WINDOWS,
  COMPOSITE_WEIGHTS,
  ENGINE_VERSION,
};
