/**
 * csvEnrichmentPatch.js
 * @version 1.0.0 (v1.55.1 — issue #240)
 * @description Helper puro: monta patch de enrichment para um trade existente
 *   a partir de um tradeData vindo do CSV de performance. **Só preenche campos
 *   que o trade existente não tem** — nunca sobrescreve.
 *
 * Hoje o patch carrega apenas campos de excursão (issue #187):
 *   - mepPrice
 *   - menPrice
 *   - excursionSource
 *
 * Outros campos do tradeData (entry/exit/qty/_partials/etc.) são intencionalmente
 * ignorados aqui — eles já foram fixados pelo pipeline original (manual ou
 * order_import) e não devem ser recalculados a partir da performance.
 *
 * Uso:
 *   const patch = computeExcursionEnrichmentPatch(tradeData, existingTrade);
 *   if (patch) await updateTradeFn(existingTrade.id, patch);
 */

const FIELDS = ['mepPrice', 'menPrice', 'excursionSource'];

/**
 * @param {Object} tradeData — staging do CSV (já com mepPrice/menPrice/excursionSource opcionais)
 * @param {Object} existingTrade — trade existente em `trades` (criado por manual/csv/order_import)
 * @returns {{ patch: Object, fields: string[] } | null}
 *   `null` quando não há nada para enriquecer (existente já completo OU CSV sem dados).
 *   Caso contrário, `patch` é objeto pronto pra updateDoc/updateTrade e `fields`
 *   lista os nomes preenchidos (para auditoria/log).
 */
export function computeExcursionEnrichmentPatch(tradeData, existingTrade) {
  if (!tradeData || !existingTrade) return null;

  const patch = {};
  const fields = [];

  for (const f of FIELDS) {
    const incoming = tradeData[f];
    const current = existingTrade[f];
    // Pula se CSV não trouxe valor.
    if (incoming == null || incoming === '') continue;
    // Pula se trade existente já tem — nunca sobrescreve.
    if (current != null && current !== '') continue;
    patch[f] = incoming;
    fields.push(f);
  }

  // Se mepPrice ou menPrice entraram no patch, sempre marca excursionSource
  // (mesmo que CSV não tenha mandado) — origem é a importação de performance.
  if ((patch.mepPrice != null || patch.menPrice != null) && patch.excursionSource == null) {
    if (existingTrade.excursionSource == null) {
      patch.excursionSource = tradeData.excursionSource || 'profitpro';
      if (!fields.includes('excursionSource')) fields.push('excursionSource');
    }
  }

  if (fields.length === 0) return null;
  return { patch, fields };
}

export default computeExcursionEnrichmentPatch;
