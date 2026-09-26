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
const { stopFlagOf, withStopFlag, violationCountOf } = require('../shared/stopFlag');

/**
 * @param {Object[]} tradeDocs — DocumentSnapshots (`.data()` + `.ref.update`)
 * @param {Object} plan
 * @param {Object} deps — { calculateTradeCompliance, RED_FLAG_TYPES, stopFlagFor? }
 *   `stopFlagFor(tradeId, trade)` (#475) resolve o aviso de stop consultando as ordens do
 *   trade (violação × pendência). Ausente → sem ordens: o aviso é a violação de antes.
 * @returns {Promise<{updated:number, preserved:number}>}
 */
async function recalculateTradesCompliance(tradeDocs, plan, { calculateTradeCompliance, RED_FLAG_TYPES, stopFlagFor }) {
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
    // #475 — o aviso de stop (violação ou pendência) sai por `withStopFlag`.
    let newFlags = withStopFlag(existingFlags, null).filter(f => {
      const type = typeof f === 'string' ? f : f.type;
      return type !== 'RISCO_ACIMA_PERMITIDO' && type !== 'RR_ABAIXO_MINIMO';
    });

    // #467 — stop do lado errado da entrada conta como sem stop (mesma conta do risco).
    // DEC-AUTO-208-04: stop implícito (loss sem stop) não emite aviso.
    // #475 — protegido pelas ordens do trade → pendência STOP_INICIAL_A_INFORMAR.
    const stopFlag = stopFlagFor
      ? await stopFlagFor(doc.id ?? doc.ref?.id, trade)
      : stopFlagOf(trade, false);
    if (stopFlag) newFlags.push(stopFlag);
    if (compliance.riskPercent != null && compliance.compliance.roStatus === 'FORA_DO_PLANO') {
      newFlags.push({ type: RED_FLAG_TYPES.RISK_EXCEEDED, message: 'Risco ' + compliance.riskPercent.toFixed(1) + '% excede maximo (' + plan.riskPerOperation + '%)', timestamp: new Date().toISOString() });
    }

    updateData.redFlags = newFlags;
    // #475 — pendência não é violação: não acende hasRedFlags.
    updateData.hasRedFlags = violationCountOf(newFlags) > 0;

    await updateIfMutable(doc.ref, doc, updateData, 'recalculateCompliance');
    updated++;
  }
  return { updated, preserved };
}

module.exports = { recalculateTradesCompliance };
