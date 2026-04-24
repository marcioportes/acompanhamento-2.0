/**
 * maturityAITrigger
 * @description Helpers puros para determinar quando invocar a CF
 *              `classifyMaturityProgression` a partir do snapshot de maturidade
 *              (§3.1 D12 cache policy — issue #119 task 14).
 *
 * Regra:
 *   - `currentTrigger(maturity)` retorna 'UP' | 'REGRESSION' | null
 *   - `shouldGenerateAI(maturity)` retorna true quando há trigger ativo E
 *     (cache vazio OR cache carregado sob trigger diferente)
 *
 * Cache hit: trigger atual === `aiTrigger` gravado no doc E `aiNarrative` presente.
 */

export function currentTrigger(maturity) {
  if (!maturity) return null;
  if (maturity.signalRegression?.detected === true) return 'REGRESSION';
  if (maturity.proposedTransition?.proposed === 'UP') return 'UP';
  return null;
}

export function shouldGenerateAI(maturity) {
  const trig = currentTrigger(maturity);
  if (!trig) return false;

  const cachedTrigger = maturity.aiTrigger ?? null;
  const cachedNarrative = maturity.aiNarrative ?? null;

  if (cachedTrigger === trig && cachedNarrative) return false;
  return true;
}
