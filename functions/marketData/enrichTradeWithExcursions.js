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
const { computePostExitOutcome, precoAlvoDoPlano } = require('./computePostExitOutcome');

const MENTOR_EMAILS = ['marcio.portes@me.com'];
const isMentorEmail = (email) => MENTOR_EMAILS.includes(email?.toLowerCase?.());

// Horários de trade são gravados pela UI como string naive (`YYYY-MM-DDTHH:MM:SS`,
// sem offset), no horário local do aluno = Brasília. A CF roda em UTC: parsear a
// string naive como UTC deslocaria a janela em 3h e buscaria os minutos errados no
// Yahoo. Normalizar para America/Sao_Paulo (UTC-3 fixo — Brasil sem DST desde 2019).
// Strings que já tragam offset/Z são absolutas e passam sem alteração.
const BRASILIA_OFFSET = '-03:00';
const HAS_TZ = /[zZ]$|[+-]\d{2}:?\d{2}$/;
function toBrasiliaISO(value) {
  if (typeof value !== 'string' || value === '') return value;
  return HAS_TZ.test(value) ? value : `${value}${BRASILIA_OFFSET}`;
}

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

  // Idempotente: já tem MEP e MEN → nada a computar de excursão.
  //
  // #101 — mas o APONTADOR PÓS-SAÍDA é posterior a esses 20 trades já enriquecidos,
  // e o early return os deixaria fora para sempre. Se falta `postExit`, calcula só
  // ele e devolve; se tem os dois, aí sim é no-op de verdade.
  if (trade.mepPrice != null && trade.menPrice != null) {
    if (trade.postExit) {
      return { ok: true, skipped: true, source: trade.excursionSource };
    }
    const somentePostExit = await computePostExit(trade, deps);
    if (somentePostExit) await tradeRef.update({ postExit: somentePostExit });
    return { ok: true, skipped: true, postExit: somentePostExit ?? null, source: trade.excursionSource };
  }

  const yahooSymbol = mapToYahoo(trade.ticker);
  if (!yahooSymbol) {
    await tradeRef.update({ excursionSource: 'unavailable' });
    return { ok: false, reason: `sem mapping Yahoo para ${trade.ticker}`, source: 'unavailable' };
  }

  // Premissa: trade tem entryTime E exitTime. Faltando qualquer um, abortar — sem
  // fallback pra trade.date (gerava janela do dia inteiro → min/max errados) nem pra
  // entryTime (janela de duração zero). bug 1 #267.
  if (!trade.entryTime || !trade.exitTime) {
    await tradeRef.update({ excursionSource: 'unavailable' });
    return { ok: false, reason: 'trade sem entryTime/exitTime', source: 'unavailable' };
  }

  const from = toBrasiliaISO(trade.entryTime);
  const to = toBrasiliaISO(trade.exitTime);

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

  // #101 — APONTADOR PÓS-SAÍDA. Mesma matéria-prima, janela estendida: depois da
  // saída, dentro do mesmo dia, o preço tocou primeiro o stop declarado ou o alvo
  // do plano? Sem isso o motor lê toda saída antecipada como medo, quando ela pode
  // ter sido proteção de uma posição que ia virar (regra de Marcio, 29/08).
  const postExit = await computePostExit(trade, deps);

  await tradeRef.update({
    mepPrice,
    menPrice,
    excursionSource: 'yahoo',
    ...(postExit ? { postExit } : {}),
  });
  return { ok: true, mepPrice, menPrice, postExit: postExit ?? null, source: 'yahoo' };
}

/**
 * Pós-saída: busca as barras do fim da saída até o fim do dia e responde o que veio
 * primeiro. Isolado (INV-03): qualquer falha aqui devolve null e o enriquecimento de
 * MEP/MEN segue — o apontador é evidência adicional, não pré-requisito.
 */
async function computePostExit(trade, deps = {}) {
  try {
    const db = deps.db;
    if (!db) return null;
    if (!trade?.planId || !trade?.exitTime || !trade?.stopLoss) return null;

    const planSnap = await db.collection('plans').doc(trade.planId).get();
    if (!planSnap.exists) return null;
    const alvo = precoAlvoDoPlano(trade, planSnap.data());
    if (alvo == null) return null;

    const inicio = toBrasiliaISO(trade.exitTime);
    // Fim do dia do trade: o pregão termina antes disso e o Yahoo só devolve barras
    // de sessão, então não é preciso codificar horário de bolsa por ativo aqui.
    const fim = toBrasiliaISO(`${String(trade.exitTime).slice(0, 10)}T23:59:00`);

    const r = await fetchYahooBars(
      { yahooSymbol: mapToYahoo(trade.ticker), from: inicio, to: fim },
      { fetchFn: deps.fetchFn, now: deps.now },
    );
    if (!r.ok || !r.bars?.length) return { outcome: 'NENHUM', source: 'unavailable', alvoPreco: alvo, stopPreco: Number(trade.stopLoss) };

    const resultado = computePostExitOutcome({
      bars: r.bars,
      side: trade.side,
      stopPrice: Number(trade.stopLoss),
      targetPrice: alvo,
    });

    return {
      outcome: resultado.outcome,
      touchedAt: resultado.touchedAtMs ? new Date(resultado.touchedAtMs).toISOString() : null,
      alvoPreco: Math.round(alvo * 100) / 100,
      stopPreco: Number(trade.stopLoss),
      barsAvaliadas: resultado.bars,
      source: 'yahoo',
    };
  } catch (e) {
    console.warn('[enrichTradeWithExcursions] pós-saída falhou:', e?.message ?? e);
    return null;
  }
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
module.exports.toBrasiliaISO = toBrasiliaISO;
