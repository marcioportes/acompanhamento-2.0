/**
 * enrichTradeWithExcursions.js — issue #187 Fase 4
 *
 * CF callable (e helper puro `runEnrichment` reusável por triggers Firestore).
 * Lê um trade, busca 1m OHLC do Yahoo entre `entryTime` e `exitTime`, computa
 * MEP/MEN, escreve no doc, descarta as bars (DEC-AUTO-187-02 compute&discard).
 *
 * Política de erro:
 *   - Trade inexistente → throw (callable retorna error pro client; trigger captura)
 *   - Sem mapping Yahoo → grava `excursionSource: 'unavailable'`, retorna { ok:false, reason }
 *   - Trade > 7d → idem
 *   - Yahoo falha → idem
 *   - Trade já tem MEP/MEN não-null → no-op (idempotente), retorna { ok:true, skipped:true }
 *
 * Auth (callable):
 *   - Aluno só pode enrichear trades que ele criou (auth.uid === trade.studentId)
 *   - Mentor (isMentorEmail) pode enrichear qualquer um
 */

const { onCall, HttpsError } = (() => {
  try { return require('firebase-functions/v2/https'); }
  catch (_e) {
    class HttpsError extends Error {
      constructor(code, message) { super(message); this.code = code; }
    }
    return { onCall: (_opts, fn) => fn, HttpsError };
  }
})();

const { mapToYahoo } = require('./symbolMapper');
const { fetchYahooBars } = require('./fetchYahooBars');
const { computeExcursionFromBars } = require('./computeExcursionFromBars');

const MENTOR_EMAILS = ['marcio.portes@me.com'];
const isMentorEmail = (email) => MENTOR_EMAILS.includes(email?.toLowerCase?.());

/**
 * Helper puro reusável fora do callable (ex.: trigger onTradeCreated).
 *
 * @param {Object} input
 * @param {string} input.tradeId
 * @param {Object} input.deps — { db, fetchFn?, now? }
 * @returns {Promise<{ok: true, mepPrice, menPrice, source: 'yahoo'|'skipped'} |
 *                  {ok: false, reason: string, source: 'unavailable'}>}
 */
async function runEnrichment({ tradeId }, deps = {}) {
  if (!tradeId) throw new Error('tradeId obrigatório');
  if (!deps.db) throw new Error('deps.db obrigatório');

  const tradeRef = deps.db.collection('trades').doc(tradeId);
  const snap = await tradeRef.get();
  if (!snap.exists) throw new Error(`Trade ${tradeId} não encontrado`);
  const trade = snap.data();

  // Idempotente: já tem MEP e MEN → no-op
  if (trade.mepPrice != null && trade.menPrice != null) {
    return { ok: true, skipped: true, source: trade.excursionSource };
  }

  const yahooSymbol = mapToYahoo(trade.ticker);
  if (!yahooSymbol) {
    await tradeRef.update({ excursionSource: 'unavailable' });
    return { ok: false, reason: `sem mapping Yahoo para ${trade.ticker}`, source: 'unavailable' };
  }

  const from = trade.entryTime || trade.date;
  const to = trade.exitTime || trade.entryTime;
  if (!from || !to) {
    await tradeRef.update({ excursionSource: 'unavailable' });
    return { ok: false, reason: 'trade sem entryTime/exitTime', source: 'unavailable' };
  }

  const fetchResult = await fetchYahooBars(
    { yahooSymbol, from, to },
    { fetchFn: deps.fetchFn, now: deps.now }
  );

  if (!fetchResult.ok) {
    await tradeRef.update({ excursionSource: 'unavailable' });
    return { ok: false, reason: fetchResult.reason, source: 'unavailable' };
  }

  const { mepPrice, menPrice } = computeExcursionFromBars({
    bars: fetchResult.bars,
    side: trade.side,
  });

  if (mepPrice == null && menPrice == null) {
    await tradeRef.update({ excursionSource: 'unavailable' });
    return { ok: false, reason: 'bars vazias dentro do range', source: 'unavailable' };
  }

  await tradeRef.update({
    mepPrice,
    menPrice,
    excursionSource: 'yahoo',
  });
  return { ok: true, mepPrice, menPrice, source: 'yahoo' };
}

const enrichTradeWithExcursions = onCall(
  { region: 'us-central1' },
  async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    const { tradeId } = data;

    if (!auth?.uid) throw new HttpsError('unauthenticated', 'Login necessário');
    if (!tradeId) throw new HttpsError('invalid-argument', 'tradeId obrigatório');

    const admin = require('firebase-admin');
    const db = admin.firestore();

    // Authz: dono do trade ou mentor
    const tradeSnap = await db.collection('trades').doc(tradeId).get();
    if (!tradeSnap.exists) throw new HttpsError('not-found', 'Trade não encontrado');
    const trade = tradeSnap.data();
    if (trade.studentId !== auth.uid && !isMentorEmail(auth.token?.email)) {
      throw new HttpsError('permission-denied', 'Sem permissão para este trade');
    }

    return runEnrichment({ tradeId }, { db });
  }
);

module.exports = enrichTradeWithExcursions;
module.exports.runEnrichment = runEnrichment;
