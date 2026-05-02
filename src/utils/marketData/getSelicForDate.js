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
 * Resolve `rateDaily` para `dateIso`.
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
