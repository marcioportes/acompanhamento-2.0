/**
 * src/utils/marketData/getSelicForDate.js — issue #235 Fase F0.3
 *
 * Resolve a taxa Selic diária (`rateDaily`, fração) para uma data ISO,
 * lendo `systemConfig/selic/history/<YYYY-MM-DD>` (gravado pela CF F0.1
 * `fetchSelicDaily` e backfill F0.2). Aplica carry-forward em
 * fim-de-semana / feriado e cai em fallback hardcoded em gap longo
 * ou erro de Firestore — NUNCA throw.
 *
 * ⚠️ ESPELHO de functions/marketData/getSelicForDate.js — MANTER SINCRONIZADO ⚠️
 * Qualquer mudança aqui replica no CJS, e vice-versa (padrão #119/#191).
 *
 * ⚠️ DIVERGÊNCIA INTENCIONAL com o espelho CJS (issue #387, DEC-AUTO-387-07) ⚠️
 * A memoização abaixo (`clearSelicCache` + cache de promise por db/parâmetros/data)
 * existe SÓ deste lado. Motivo: ela ataca reentrada de UI — recálculo do Sharpe a
 * cada render do card de Consistência, um `getDoc` por dia operado por passada. Numa
 * invocação de Cloud Function o processo é efêmero e não há reentrada, então o cache
 * não pagaria seu custo lá; replicá-lo arrastaria deploy de CF para uma issue de
 * layout. O CONTRATO DE VALORES permanece idêntico nos dois lados — o cache é
 * transparente (mesmo shape, mesmas regras, NUNCA throw) e só suprime leituras
 * repetidas. Paridade semântica preservada; paridade de performance, não.
 *
 * Schema esperado (lock INV-10 com fetchSelicDaily.js):
 *   { date: 'YYYY-MM-DD', rateDaily: number, source: string, fetchedAt: Timestamp }
 *
 * INV-15: leitura apenas, namespace já aprovado em F0.1.
 */

import {
  getDoc,
  doc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db as defaultDb } from '../../firebase';

// Fonte: /mnt/c/000-Marcio/Temp/bcb-mock-spec.md (Selic 14.75% a.a. ÷ 252 d.u. ÷ 100).
// Última calibração: 2026-05-02. Revisar se Selic se mover ±2 p.p.
export const SELIC_FALLBACK_DAILY = 14.75 / 252 / 100;
export const SELIC_HISTORY_PATH = 'systemConfig/selic/history';
const FALLBACK_SOURCE = 'FALLBACK';
const DEFAULT_MAX_CARRY_FORWARD_DAYS = 7;

/**
 * Diferença em dias inteiros entre duas datas ISO `YYYY-MM-DD`.
 * Usa UTC midnight pra evitar drift de timezone (DST etc.).
 *
 * @param {string} isoA — data final
 * @param {string} isoB — data inicial
 * @returns {number} isoA - isoB em dias
 */
export function daysDiffIso(isoA, isoB) {
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

/**
 * Resolve `rateDaily` para `dateIso` — leitura crua, sem passar pelo cache.
 *
 * @param {string} dateIso           — `YYYY-MM-DD`
 * @param {Object} dbRef             — instância Firestore já resolvida
 * @param {number} maxCarryForwardDays
 * @param {number} fallbackRateDaily
 * @returns {Promise<SelicLookup>}
 */
async function fetchSelicForDate(dateIso, dbRef, maxCarryForwardDays, fallbackRateDaily) {
  try {
    const exactRef = doc(dbRef, `${SELIC_HISTORY_PATH}/${dateIso}`);
    const exactSnap = await getDoc(exactRef);
    if (exactSnap.exists()) {
      const data = exactSnap.data();
      return {
        rateDaily: data.rateDaily,
        source: data.source,
        dateUsed: dateIso,
        isCarryForward: false,
        isFallback: false,
      };
    }

    const colRef = collection(dbRef, SELIC_HISTORY_PATH);
    const q = query(
      colRef,
      where('date', '<=', dateIso),
      orderBy('date', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty || !snap.docs?.length) {
      return makeFallback(fallbackRateDaily);
    }

    const data = snap.docs[0].data();
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


// ── Memoização de escopo de módulo (issue #387) ─────────────
//
// A Selic de uma data passada é fato imutável: `computeCycleSharpe` faz um lookup por
// dia operado e é reexecutado a cada recálculo do card de Consistência. Sem cache, um
// ciclo de 20 dias custa 20 `getDoc` POR passada.
//
// Estrutura: Map externo por INSTÂNCIA de `db` → Map interno por
// `maxCarryForwardDays|fallbackRateDaily|dateIso`. A data sozinha não serve de chave —
// os parâmetros mudam o resultado para a mesma data, e testes injetam `db` mockados
// distintos que se contaminariam entre si.
//
// Guarda-se a PROMISE, não o valor resolvido: `computeCycleSharpe` dispara os lookups
// em `Promise.all`, então N chamadas concorrentes para a mesma data precisam
// compartilhar uma única leitura in-flight — cachear só o resultado final não dedupa
// nada nesse cenário.
const selicCacheByDb = new Map();

/**
 * Zera a memoização. Existe para os testes (`beforeEach`) — sem isso o resultado de um
 * teste vaza para o seguinte.
 */
export function clearSelicCache() {
  selicCacheByDb.clear();
}

function cacheBucketFor(dbRef) {
  let bucket = selicCacheByDb.get(dbRef);
  if (bucket === undefined) {
    bucket = new Map();
    selicCacheByDb.set(dbRef, bucket);
  }
  return bucket;
}

/** Data de hoje em `YYYY-MM-DD` no fuso de Brasília — a CF `fetchSelicDaily` roda 09h BRT. */
function todayIsoBrt() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Decide se um resultado pode ser congelado na sessão.
 *
 * - Acerto exato (`isCarryForward:false, isFallback:false`) → fato histórico, cacheia.
 * - Fallback → estado TRANSITÓRIO (erro de Firestore ou gap de dados). Congelar fixaria
 *   uma taxa errada pelo resto da sessão; a chamada seguinte deve reconsultar.
 * - Carry-forward para a data corrente (ou futura) → ainda pode virar acerto exato assim
 *   que a CF gravar o doc do dia. Só cacheia carry-forward de data estritamente passada,
 *   onde o doc exato nunca vai existir (fim-de-semana / feriado).
 */
function isCacheableResult(result, dateIso) {
  if (result.isFallback === true) return false;
  if (result.isCarryForward === true && dateIso >= todayIsoBrt()) return false;
  return true;
}

/**
 * Resolve `rateDaily` para `dateIso`, memoizando por (db, parâmetros, data).
 *
 * @param {string} dateIso                                    — `YYYY-MM-DD`
 * @param {Object} [opts]
 * @param {Object} [opts.db]                                  — Firestore instance (default: client web SDK)
 * @param {number} [opts.maxCarryForwardDays=7]               — gap máximo aceito antes do fallback
 * @param {number} [opts.fallbackRateDaily=SELIC_FALLBACK_DAILY]
 * @returns {Promise<{rateDaily:number, source:string, dateUsed:string|null, isCarryForward:boolean, isFallback:boolean}>}
 */
export async function getSelicForDate(dateIso, opts = {}) {
  const dbRef = opts.db ?? defaultDb;
  const maxCarryForwardDays = opts.maxCarryForwardDays ?? DEFAULT_MAX_CARRY_FORWARD_DAYS;
  const fallbackRateDaily = opts.fallbackRateDaily ?? SELIC_FALLBACK_DAILY;

  const bucket = cacheBucketFor(dbRef);
  const key = `${maxCarryForwardDays}|${fallbackRateDaily}|${dateIso}`;

  const cached = bucket.get(key);
  if (cached !== undefined) return cached;

  const pending = fetchSelicForDate(dateIso, dbRef, maxCarryForwardDays, fallbackRateDaily)
    .then((result) => {
      if (!isCacheableResult(result, dateIso)) bucket.delete(key);
      return result;
    })
    .catch((err) => {
      // `fetchSelicForDate` já converte qualquer falha em fallback, então este ramo é
      // inalcançável na prática. Ele existe para que uma rejeição inesperada não fique
      // GRUDADA no cache pelo resto da sessão — a entrada sai e a próxima chamada tenta
      // de novo. O throw preserva a rejeição original em vez de mascará-la.
      bucket.delete(key);
      throw err;
    });

  bucket.set(key, pending);
  return pending;
}
