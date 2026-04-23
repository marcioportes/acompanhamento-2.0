/**
 * src/utils/maturityEngine/constants.js
 *
 * Constantes do motor de maturidade 4D × 5 stages (issue #119).
 *
 * Task 03: STAGE_BASES, STAGE_NAMES.
 * Task 04: GATES_BY_TRANSITION (catálogo literal da §3.1 D9).
 *
 * Demais constantes (STAGE_WINDOWS, COMPOSITE_WEIGHTS) chegam em A5.
 */

// Pontuação base por stage atual (§3.1 D3). Componente principal de M.
export const STAGE_BASES = {
  1: 0,
  2: 20,
  3: 40,
  4: 60,
  5: 80,
};

export const STAGE_NAMES = {
  1: 'CHAOS',
  2: 'REACTIVE',
  3: 'METHODICAL',
  4: 'PROFESSIONAL',
  5: 'MASTERY',
};

/**
 * Catálogo de gates por transição (§3.1 D9 literal).
 *
 * Ordem preservada conforme tabela do control file — determinística para UI.
 * Chaves: `${stageAtual}-${stageProximo}`. Stage 5 (Mastery) não tem transição.
 *
 * Schema de cada gate:
 *   { id, label, dim: 'emo'|'fin'|'op', metric, op: '>='|'<='|'<'|'=='|'>', threshold }
 */
export const GATES_BY_TRANSITION = {
  '1-2': [
    { id: 'maxdd-under-20', label: 'MaxDD < 20%', dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 20 },
    { id: 'rule-compliance-80', label: 'Compliance ≥ 80%', dim: 'op', metric: 'complianceRate', op: '>=', threshold: 80 },
    { id: 'emotional-out-of-fragile', label: 'Emocional ≥ 30', dim: 'emo', metric: 'E', op: '>=', threshold: 30 },
    { id: 'basic-journal', label: 'Journal em 50%+ dos trades', dim: 'op', metric: 'journalRate', op: '>=', threshold: 0.50 },
    { id: 'stop-usage', label: 'Stop em 80%+ dos trades', dim: 'fin', metric: 'stopUsageRate', op: '>=', threshold: 0.80 },
    { id: 'plan-linked-trades', label: 'Plan-linked ≥ 70%', dim: 'op', metric: 'planAdherence', op: '>=', threshold: 70 },
  ],
  '2-3': [
    { id: 'emotional-55', label: 'Emocional ≥ 55', dim: 'emo', metric: 'E', op: '>=', threshold: 55 },
    { id: 'financial-solid', label: 'Financial ≥ 70 (SOLID)', dim: 'fin', metric: 'F', op: '>=', threshold: 70 },
    { id: 'operational-65', label: 'Operacional ≥ 65', dim: 'op', metric: 'O', op: '>=', threshold: 65 },
    { id: 'strategy-8-weeks', label: '8 semanas sem trocar estratégia', dim: 'op', metric: 'strategyConsWks', op: '>=', threshold: 8 },
    { id: 'journal-90', label: 'Journal ≥ 90%', dim: 'op', metric: 'journalRate', op: '>=', threshold: 0.90 },
    { id: 'compliance-95', label: 'Compliance ≥ 95%', dim: 'op', metric: 'complianceRate', op: '>=', threshold: 95 },
    { id: 'winrate-45', label: 'Win rate ≥ 45%', dim: 'fin', metric: 'winRate', op: '>=', threshold: 45 },
    { id: 'payoff-1_2', label: 'Payoff ≥ 1.2', dim: 'fin', metric: 'payoff', op: '>=', threshold: 1.2 },
  ],
  '3-4': [
    { id: 'emotional-75', label: 'Emocional ≥ 75', dim: 'emo', metric: 'E', op: '>=', threshold: 75 },
    { id: 'financial-fortified', label: 'Financial ≥ 85 (FORTIFIED)', dim: 'fin', metric: 'F', op: '>=', threshold: 85 },
    { id: 'operational-80', label: 'Operacional ≥ 80', dim: 'op', metric: 'O', op: '>=', threshold: 80 },
    { id: 'strategy-12-months', label: '12 meses sem trocar estratégia', dim: 'op', metric: 'strategyConsMonths', op: '>=', threshold: 12 },
    { id: 'advanced-metrics', label: 'MFE/MAE/Sharpe rastreados', dim: 'op', metric: 'advancedMetricsPresent', op: '==', threshold: true },
    { id: 'compliance-100', label: 'Compliance = 100% nos últimos 100', dim: 'op', metric: 'complianceRate100', op: '>=', threshold: 100 },
    { id: 'winrate-55', label: 'Win rate ≥ 55%', dim: 'fin', metric: 'winRate', op: '>=', threshold: 55 },
    { id: 'payoff-2', label: 'Payoff ≥ 2.0', dim: 'fin', metric: 'payoff', op: '>=', threshold: 2.0 },
    { id: 'maxdd-5', label: 'MaxDD ≤ 5%', dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 5 },
    { id: 'sharpe-1_2', label: 'Sharpe mensal ≥ 1.2', dim: 'fin', metric: 'monthlySharpe', op: '>=', threshold: 1.2 },
  ],
  '4-5': [
    { id: 'emotional-85', label: 'Emocional ≥ 85 (SAGE)', dim: 'emo', metric: 'E', op: '>=', threshold: 85 },
    { id: 'financial-90', label: 'Financial ≥ 90', dim: 'fin', metric: 'F', op: '>=', threshold: 90 },
    { id: 'payoff-2_5', label: 'Payoff ≥ 2.5', dim: 'fin', metric: 'payoff', op: '>=', threshold: 2.5 },
    { id: 'winrate-55-stable', label: 'Win rate ≥ 55% em 100+ trades', dim: 'fin', metric: 'winRate', op: '>=', threshold: 55 },
    { id: 'maxdd-3', label: 'MaxDD ≤ 3%', dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 3 },
    { id: 'cv-low', label: 'CV consistência < 0.5', dim: 'fin', metric: 'cv', op: '<', threshold: 0.5 },
    { id: 'zero-tilt-revenge', label: 'Zero tilt/revenge 90 dias', dim: 'emo', metric: 'tiltRevengeCount', op: '==', threshold: 0 },
    { id: 'annual-return-15', label: 'Retorno anualizado ≥ 15%', dim: 'fin', metric: 'annualizedReturn', op: '>=', threshold: 15 },
    { id: 'sharpe-1_5', label: 'Sharpe anual ≥ 1.5', dim: 'fin', metric: 'annualSharpe', op: '>=', threshold: 1.5 },
  ],
};
