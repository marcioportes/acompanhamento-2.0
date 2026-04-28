/**
 * symbolMapper.js — issue #187 Fase 4
 *
 * Mapeia tickers internos do Espelho para tickers Yahoo Finance continuous
 * (sufixo `=F`). Yahoo retorna sempre o front-month vigente — adequado pra
 * import "do dia/da semana", limitação aceita (DEC-AUTO-187-02).
 *
 * Cobertura inicial: micro futures CME que clientes Tradovate usam.
 * Expansão futura por demanda real, não especulativa.
 *
 * BR futures (WIN, WDO, IND): SEM mapping aqui — não há fonte 1m gratuita
 * de B3, e ProfitPro já entrega MEP/MEN nativamente (Fase 3).
 */

// Map ordem-sensitiva: prefixos de micro contratos primeiro pra não casar
// com os cheios. Ex: 'MNQ' precisa vir antes de 'NQ', senão 'MNQH6' casa em 'NQ'.
const MAPPINGS = [
  // CME Micro
  { prefix: 'MNQ', yahoo: 'MNQ=F' },
  { prefix: 'MES', yahoo: 'MES=F' },
  { prefix: 'MGC', yahoo: 'MGC=F' },
  { prefix: 'MCL', yahoo: 'MCL=F' },
  { prefix: 'MYM', yahoo: 'MYM=F' },
  { prefix: 'M2K', yahoo: 'M2K=F' },
  // CME Cheio
  { prefix: 'NQ',  yahoo: 'NQ=F' },
  { prefix: 'ES',  yahoo: 'ES=F' },
  { prefix: 'GC',  yahoo: 'GC=F' },
  { prefix: 'CL',  yahoo: 'CL=F' },
  { prefix: 'YM',  yahoo: 'YM=F' },
  { prefix: 'RTY', yahoo: 'RTY=F' },
];

/**
 * Mapeia um ticker do trade (ex: 'MNQH6', 'ES', 'PETR4') para o ticker Yahoo
 * correspondente, ou retorna null se não há cobertura.
 *
 * @param {string} ticker
 * @returns {string|null}
 */
function mapToYahoo(ticker) {
  if (!ticker || typeof ticker !== 'string') return null;
  const upper = ticker.toUpperCase().trim();
  for (const { prefix, yahoo } of MAPPINGS) {
    if (upper.startsWith(prefix)) return yahoo;
  }
  return null;
}

module.exports = {
  mapToYahoo,
  MAPPINGS,
};
