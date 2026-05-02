// ============================================
// MARKET DATA — Cloud Functions copy
// ============================================
//
// ⚠️ ESPELHO de src/utils/marketData/getSelicForDate.js — MANTER SINCRONIZADO ⚠️
// Qualquer alteração aqui deve replicar em src/, e vice-versa (#119/#191).
//
// Resolve a taxa Selic diária (`rateDaily`, fração) para uma data ISO,
// lendo `systemConfig/selic/history/<YYYY-MM-DD>` (gravado pela CF F0.1
// `fetchSelicDaily` e backfill F0.2). Carry-forward para fim-de-semana /
// feriado; fallback hardcoded para gap longo ou erro de Firestore.
// NUNCA throw.
//
// Schema esperado (lock INV-10 com fetchSelicDaily.js):
//   { date: 'YYYY-MM-DD', rateDaily: number, source: string, fetchedAt: Timestamp }
//
// INV-15: leitura apenas, namespace já aprovado em F0.1.

const SELIC_FALLBACK_DAILY = 14.75 / 252 / 100;
const SELIC_HISTORY_PARENT = 'systemConfig';
const SELIC_DOC = 'selic';
const SELIC_HISTORY_SUB = 'history';
const FALLBACK_SOURCE = 'FALLBACK';
const DEFAULT_MAX_CARRY_FORWARD_DAYS = 7;

function daysDiffIso(isoA, isoB) {
  const a = Date.parse(`${isoA}T00:00:00Z`);
  const b = Date.parse(`${isoB}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

function makeFallback(rateDaily) {
  return {
    rateDaily,
    source: FALLBACK_SOURCE,
    dateUsed: null,
    isCarryForward: false,
    isFallback: true,
  };
}

function getDefaultDb() {
  const admin = require('firebase-admin');
  return admin.firestore();
}

/**
 * Resolve `rateDaily` para `dateIso`.
 *
 * @param {string} dateIso                                    — `YYYY-MM-DD`
 * @param {Object} [opts]
 * @param {Object} [opts.db]                                  — admin.firestore() instance
 * @param {number} [opts.maxCarryForwardDays=7]
 * @param {number} [opts.fallbackRateDaily=SELIC_FALLBACK_DAILY]
 * @returns {Promise<{rateDaily:number, source:string, dateUsed:string|null, isCarryForward:boolean, isFallback:boolean}>}
 */
async function getSelicForDate(dateIso, opts = {}) {
  const db = opts.db ?? getDefaultDb();
  const maxCarryForwardDays = opts.maxCarryForwardDays ?? DEFAULT_MAX_CARRY_FORWARD_DAYS;
  const fallbackRateDaily = opts.fallbackRateDaily ?? SELIC_FALLBACK_DAILY;

  try {
    const historyCol = db
      .collection(SELIC_HISTORY_PARENT)
      .doc(SELIC_DOC)
      .collection(SELIC_HISTORY_SUB);

    const exactSnap = await historyCol.doc(dateIso).get();
    if (exactSnap.exists) {
      const data = exactSnap.data();
      return {
        rateDaily: data.rateDaily,
        source: data.source,
        dateUsed: dateIso,
        isCarryForward: false,
        isFallback: false,
      };
    }

    const querySnap = await historyCol
      .where('date', '<=', dateIso)
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    if (querySnap.empty || !querySnap.docs?.length) {
      return makeFallback(fallbackRateDaily);
    }

    const data = querySnap.docs[0].data();
    const foundDate = data.date;
    const daysBack = daysDiffIso(dateIso, foundDate);
    if (daysBack >= 0 && daysBack <= maxCarryForwardDays) {
      return {
        rateDaily: data.rateDaily,
        source: data.source,
        dateUsed: foundDate,
        isCarryForward: daysBack > 0,
        isFallback: false,
      };
    }
    return makeFallback(fallbackRateDaily);
  } catch (err) {
    const code = err?.code ?? 'firestore_error';
    const message = err?.message ?? String(err);
    console.error(`[getSelicForDate] ${code}: ${message} (date=${dateIso})`);
    return makeFallback(fallbackRateDaily);
  }
}

module.exports = getSelicForDate;
module.exports.getSelicForDate = getSelicForDate;
module.exports.daysDiffIso = daysDiffIso;
module.exports.SELIC_FALLBACK_DAILY = SELIC_FALLBACK_DAILY;
module.exports.SELIC_HISTORY_PATH = `${SELIC_HISTORY_PARENT}/${SELIC_DOC}/${SELIC_HISTORY_SUB}`;
