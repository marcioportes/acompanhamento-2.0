/**
 * src/utils/maturityEngine/constants.js
 *
 * Constantes do motor de maturidade 4D × 5 stages (issue #119).
 *
 * Esta task (03) introduz apenas STAGE_BASES e STAGE_NAMES — usados por
 * computeMaturity. Outras constantes (STAGE_WINDOWS, GATES_BY_TRANSITION,
 * COMPOSITE_WEIGHTS) chegam em A4/A5.
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
