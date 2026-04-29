/**
 * onTradeCreatedAutoEnrich.js — issue #187 Fase 5
 *
 * Trigger Firestore que dispara `runEnrichment` automaticamente para trades
 * recém-criados que: (a) não têm MEP/MEN ainda, (b) ticker mapeia para Yahoo,
 * (c) janela ≤7d. Falha silenciosa (log warn, sem rethrow) — import de trade
 * NUNCA falha por causa de enrichment opcional.
 *
 * Decoupled do onTradeCreated principal: rodam em paralelo, sem ordem.
 */

const { mapToYahoo } = require('./symbolMapper');
const { runEnrichment } = require('./enrichTradeWithExcursions');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const handler = async (snap, context) => {
  try {
    const trade = snap.data();
    const tradeId = context.params.tradeId;

    // Skip se já tem dado
    if (trade.mepPrice != null && trade.menPrice != null) return;
    if (trade.excursionSource === 'manual') return; // respeita override humano
    if (trade.excursionSource === 'profitpro') return; // import já trouxe via parser

    // Skip se ticker não mapeia
    if (!mapToYahoo(trade.ticker)) return;

    // Skip se trade fora da janela 7d
    const exitTime = trade.exitTime || trade.entryTime || trade.date;
    if (!exitTime) return;
    const exitMs = new Date(exitTime).getTime();
    if (!Number.isFinite(exitMs)) return;
    if (Date.now() - exitMs > SEVEN_DAYS_MS) return;

    const admin = require('firebase-admin');
    const db = admin.firestore();

    const result = await runEnrichment({ tradeId }, { db });
    if (!result.ok) {
      console.warn(`[onTradeCreatedAutoEnrich] ${tradeId}: ${result.reason}`);
    }
  } catch (err) {
    // Falha silenciosa por design (trade já criado; enrichment é best-effort)
    console.warn('[onTradeCreatedAutoEnrich] erro (suprimido):', err.message);
  }
};

let trigger;
try {
  const functions = require('firebase-functions');
  trigger = functions.firestore.document('trades/{tradeId}').onCreate(handler);
} catch (_e) {
  trigger = handler; // fallback pra teste
}

module.exports = trigger;
module.exports.handler = handler;
module.exports.SEVEN_DAYS_MS = SEVEN_DAYS_MS;
