/**
 * excursionParsing.js — issue #187 Fase 3
 * @description Conversão de MEP/MEN brutos (pontos para futures, % para ações) → preço.
 *
 * Reutilizável por:
 *   - csvMapper.js (import via mapeamento manual)
 *   - parsers dedicados de Performance Reports (ProfitPro, futuro)
 *   - CF de enrichment Yahoo (Fase 4 do mesmo issue, contexto diferente — bars OHLC)
 *
 * Convenção ProfitPro (validada na amostra real do CSV WINM26 fornecida pelo Marcio):
 *   - MEP em pontos (futures) ou % (ações) — favorável (positivo do ponto-de-vista do trader)
 *   - MEN em pontos ou % — adverso (negativo do ponto-de-vista do trader)
 *
 * Storage final: preço (DEC-AUTO-187-01).
 */

/**
 * Prefixos de futures conhecidos (B3 + CME).
 * Match por `ticker.startsWith(prefix)`.
 * Ordem importa: prefixos mais longos primeiro (para evitar match ambíguo
 * entre "MNQ" e "NQ", "MES" e "ES", "MGC" e "GC", etc).
 */
export const FUTURES_PREFIXES = [
  // B3 (mini- e cheio)
  'WIN', 'WDO', 'IND', 'DOL', 'BIT', 'BGI', 'CCM', 'ICF',
  // CME (micro primeiro para não casar com cheio)
  'MNQ', 'MES', 'MGC', 'MCL', 'MYM', 'M2K',
  'NQ', 'ES', 'GC', 'CL', 'YM', 'RTY',
];

/**
 * Classifica um ticker como 'futures' ou 'equity'.
 * @param {string} ticker
 * @returns {'futures' | 'equity'}
 */
export function detectInstrumentType(ticker) {
  if (!ticker || typeof ticker !== 'string') return 'equity';
  const upper = ticker.toUpperCase().trim();
  for (const prefix of FUTURES_PREFIXES) {
    if (upper.startsWith(prefix)) return 'futures';
  }
  return 'equity';
}

/**
 * Converte MEP/MEN brutos (pontos ou %) em preço, baseado em entry + side + tipo do ativo.
 *
 * Regras de sinal (independente do sinal vindo no CSV — sempre `Math.abs()`):
 *   LONG  → mepPrice = entry + |mep|         menPrice = entry - |men|
 *   SHORT → mepPrice = entry - |mep|         menPrice = entry + |men|
 *
 * Para ações (equity) substitui adição por multiplicação proporcional:
 *   LONG  → mepPrice = entry × (1 + |mep|/100)  menPrice = entry × (1 - |men|/100)
 *   SHORT → mepPrice = entry × (1 - |mep|/100)  menPrice = entry × (1 + |men|/100)
 *
 * @param {Object} input
 * @param {number} input.entry - preço de abertura
 * @param {'LONG'|'SHORT'} input.side
 * @param {number|null|undefined} input.mepRaw - MEP em pontos (futures) ou % (equity)
 * @param {number|null|undefined} input.menRaw - MEN
 * @param {'futures'|'equity'} input.instrumentType
 * @returns {{ mepPrice: number|null, menPrice: number|null }}
 */
export function convertExcursionRawToPrice({ entry, side, mepRaw, menRaw, instrumentType }) {
  const e = Number(entry);
  if (!Number.isFinite(e)) return { mepPrice: null, menPrice: null };
  if (side !== 'LONG' && side !== 'SHORT') return { mepPrice: null, menPrice: null };

  const mep = mepRaw == null || !Number.isFinite(Number(mepRaw)) ? null : Math.abs(Number(mepRaw));
  const men = menRaw == null || !Number.isFinite(Number(menRaw)) ? null : Math.abs(Number(menRaw));

  const mepSign = side === 'LONG' ? 1 : -1;
  const menSign = side === 'LONG' ? -1 : 1;

  if (instrumentType === 'equity') {
    return {
      mepPrice: mep == null ? null : roundPrice(e * (1 + (mepSign * mep) / 100)),
      menPrice: men == null ? null : roundPrice(e * (1 + (menSign * men) / 100)),
    };
  }

  // futures: pontos somam direto
  return {
    mepPrice: mep == null ? null : roundPrice(e + mepSign * mep),
    menPrice: men == null ? null : roundPrice(e + menSign * men),
  };
}

function roundPrice(n) {
  return Math.round(n * 100000) / 100000;
}
