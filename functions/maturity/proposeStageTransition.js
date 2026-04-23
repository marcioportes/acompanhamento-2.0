// ============================================
// MATURITY ENGINE — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/maturityEngine/proposeStageTransition.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa.
//

function proposeStageTransition({ stageCurrent, gatesResult, signalRegression, confidence }) {
  const regressionDetected = signalRegression?.detected === true;

  if (regressionDetected) {
    return {
      proposed: 'DOWN_DETECTED',
      nextStage: stageCurrent,
      blockers: [],
      confidence,
    };
  }

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

  if (gatesTotal > 0 && gatesMet === gatesTotal) {
    return {
      proposed: 'UP',
      nextStage: stageCurrent + 1,
      blockers: [],
      confidence,
    };
  }

  const blockers = gates.filter((g) => g.met !== true).map((g) => g.id);
  return {
    proposed: 'STAY',
    nextStage: stageCurrent + 1,
    blockers,
    confidence,
  };
}

module.exports = { proposeStageTransition };
