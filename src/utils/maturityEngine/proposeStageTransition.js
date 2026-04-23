/**
 * src/utils/maturityEngine/proposeStageTransition.js
 *
 * Proposta de transição de stage (§3.1 D7) do motor de maturidade (issue #119 task 05).
 *
 * Função pura: zero I/O. Combina gates avaliados + sinal de regressão + confidence
 * em uma recomendação final ('UP' | 'STAY' | 'DOWN_DETECTED').
 *
 * Precedência (§3.1 D7 + DEC-020):
 *   1. signalRegression.detected === true → DOWN_DETECTED. stageCurrent NUNCA
 *      é mutado — a sugestão fica em signalRegression.suggestedStage.
 *   2. stageCurrent === 5 (Mastery) → STAY. Não há UP possível.
 *   3. Todos os gates met (1..4) → UP para stageCurrent + 1.
 *   4. Qualquer outro caso (1..4) → STAY, blockers com ids dos gates
 *      com met === false OU met === null (ambos são "ainda não confirmado").
 *
 * `confidence` é propagado do caller (orchestrator já agrega E/F/O/M).
 */

/**
 * @param {{
 *   stageCurrent: 1|2|3|4|5,
 *   gatesResult: {
 *     gates: Array<{id:string, met: boolean|null}>,
 *     gatesMet: number,
 *     gatesTotal: number,
 *   },
 *   signalRegression: { detected: boolean },
 *   confidence: 'HIGH'|'MED'|'LOW',
 * }} input
 * @returns {{
 *   proposed: 'UP'|'STAY'|'DOWN_DETECTED',
 *   nextStage: 1|2|3|4|5,
 *   blockers: string[],
 *   confidence: 'HIGH'|'MED'|'LOW',
 * }}
 */
export function proposeStageTransition({ stageCurrent, gatesResult, signalRegression, confidence }) {
  const regressionDetected = signalRegression?.detected === true;

  // Precedência absoluta: regressão detectada vence tudo (inclusive mastery).
  if (regressionDetected) {
    return {
      proposed: 'DOWN_DETECTED',
      nextStage: stageCurrent,
      blockers: [],
      confidence,
    };
  }

  // Mastery (stage 5) sem regressão → STAY (não há UP possível).
  if (stageCurrent === 5) {
    return {
      proposed: 'STAY',
      nextStage: 5,
      blockers: [],
      confidence,
    };
  }

  const gates = gatesResult?.gates ?? [];
  const gatesMet = gatesResult?.gatesMet ?? 0;
  const gatesTotal = gatesResult?.gatesTotal ?? 0;

  // UP somente se há gates E todos foram met.
  if (gatesTotal > 0 && gatesMet === gatesTotal) {
    return {
      proposed: 'UP',
      nextStage: stageCurrent + 1,
      blockers: [],
      confidence,
    };
  }

  // STAY: blockers = gates com met !== true (false OU null).
  const blockers = gates.filter((g) => g.met !== true).map((g) => g.id);
  return {
    proposed: 'STAY',
    nextStage: stageCurrent + 1,
    blockers,
    confidence,
  };
}
