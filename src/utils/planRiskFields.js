/**
 * planRiskFields — SSoT dos parâmetros de risco do plano.
 *
 * Issue #416 (C2). Estes campos definem o "contrato de risco" que o aluno assinou
 * com ele mesmo. Duas coisas dependem da MESMA lista, e por isso ela mora aqui:
 *
 *  1. `usePlans.updatePlan` — mudança em qualquer um dispara recálculo de compliance
 *     em cascata (B1), porque a régua do trade muda junto.
 *  2. `computeStrategyConsistencyMonths` — o gate `strategy-12-months` mede meses
 *     desde a última mudança nesses campos.
 *
 * Duas listas que podem divergir foi exatamente o defeito que o #416 catalogou:
 * o motor cobrando uma coisa e a tela dizendo outra. Uma lista só.
 *
 * ⚠️ Espelhada em `functions/maturity/helpers.js` (CJS não consegue importar de src/
 * — functions/ é deployado sozinho). A divergência é travada pelo teste de paridade
 * em `src/__tests__/functions/maturity/helpers.strategyConsistencyMonths.parity.test.js`.
 */

/** Campos do plano que afetam compliance e constância de estratégia. */
export const RISK_FIELDS = Object.freeze([
  'riskPerOperation',
  'rrTarget',
  'periodStop',
  'cycleStop',
]);
