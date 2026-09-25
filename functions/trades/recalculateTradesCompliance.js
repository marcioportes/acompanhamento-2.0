/**
 * recalculateTradesCompliance — laço de recálculo de compliance dos trades de um plano.
 *
 * Extraído de `recalculateCompliance` (functions/index.js) para ser testável (#451).
 * `calculateTradeCompliance` e `RED_FLAG_TYPES` moram em index.js e chegam por injeção.
 *
 * #451 — trade `DISCUSSED` é imutável: pulado ANTES de calcular, contado em `preserved`.
 * Trades não discutidos recebem exatamente o mesmo patch de antes. A escrita passa pelo helper
 * (cerca de `tradeWriteBoundary.test.js`); o `continue` do laço só evita calcular à toa.
 */

const { isTradeImmutable, updateIfMutable } = require('../_shared/tradeImmutability');
const { stopDistanceOf } = require('../shared/orderProtection');

/**
 * @param {Object[]} tradeDocs — DocumentSnapshots (`.data()` + `.ref.update`)
 * @param {Object} plan
 * @param {Object} deps — { calculateTradeCompliance, RED_FLAG_TYPES }
 * @returns {Promise<{updated:number, preserved:number}>}
 */
async function recalculateTradesCompliance(tradeDocs, plan, { calculateTradeCompliance, RED_FLAG_TYPES }) {
  let updated = 0;
  let preserved = 0;
  for (const doc of tradeDocs) {
    const trade = doc.data();
    if (isTradeImmutable(trade)) {
      preserved++;
      continue;
    }
    const compliance = calculateTradeCompliance(trade, plan);

    const updateData = {
      riskPercent: compliance.riskPercent,
      rrRatio: compliance.rrRatio,
      rrAssumed: compliance.rrAssumed,
      compliance: compliance.compliance
    };

    // Recalcular red flags — remove os flags de compliance antigos e recria
    const existingFlags = Array.isArray(trade.redFlags) ? trade.redFlags : [];
    let newFlags = existingFlags.filter(f => {
      const type = typeof f === 'string' ? f : f.type;
      return type !== 'RISCO_ACIMA_PERMITIDO' && type !== 'RR_ABAIXO_MINIMO' && type !== 'TRADE_SEM_STOP';
    });

    // #467 — stop do lado errado da entrada conta como sem stop (mesma conta do risco).
    if (stopDistanceOf(trade.side, trade.entry, trade.stopLoss) == null) {
      // DEC-AUTO-208-04: stop implícito (loss sem stop) não emite NO_STOP.
      const tradeResult = trade.result ?? 0;
      const isImplicitStop = tradeResult < 0;
      if (!isImplicitStop) {
        let noStopMsg = 'Trade sem stop loss definido';
        if (tradeResult > 0) noStopMsg += ' — risco não mensurado (win sem stop)';
        newFlags.push({ type: RED_FLAG_TYPES.NO_STOP, message: noStopMsg, timestamp: new Date().toISOString() });
      }
    }
    if (compliance.riskPercent != null && compliance.compliance.roStatus === 'FORA_DO_PLANO') {
      newFlags.push({ type: RED_FLAG_TYPES.RISK_EXCEEDED, message: 'Risco ' + compliance.riskPercent.toFixed(1) + '% excede maximo (' + plan.riskPerOperation + '%)', timestamp: new Date().toISOString() });
    }

    updateData.redFlags = newFlags;
    updateData.hasRedFlags = newFlags.length > 0;

    await updateIfMutable(doc.ref, doc, updateData, 'recalculateCompliance');
    updated++;
  }
  return { updated, preserved };
}

module.exports = { recalculateTradesCompliance };
