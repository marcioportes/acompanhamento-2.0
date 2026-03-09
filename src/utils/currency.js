/**
 * currency.js
 * @version 1.1.0 (v1.19.0)
 * @description Utilitários de formatação e agrupamento multi-moeda.
 * 
 * DEC-004 (09/03/2026): Locale SEMPRE pt-BR para qualquer moeda.
 * Usuário brasileiro deve ver separador de milhar com ponto e decimal com vírgula,
 * independente da moeda (R$ 10.000,50 / US$ 10.000,50 / € 10.000,50).
 * 
 * NOTA: calculations.js e TradesList.jsx possuíam formatCurrency locais duplicados.
 * Ambos devem usar formatCurrencyDynamic deste módulo (single source of truth).
 * 
 * USAGE:
 * import { formatCurrencyDynamic, groupByCurrency, isSameCurrency, getCurrencySymbol } from '../utils/currency';
 */

const LOCALE_BR = 'pt-BR';

const CURRENCY_CONFIG = {
  BRL: { locale: LOCALE_BR, currency: 'BRL', symbol: 'R$' },
  USD: { locale: LOCALE_BR, currency: 'USD', symbol: 'US$' },
  EUR: { locale: LOCALE_BR, currency: 'EUR', symbol: '€' },
  GBP: { locale: LOCALE_BR, currency: 'GBP', symbol: '£' },
  ARS: { locale: LOCALE_BR, currency: 'ARS', symbol: 'ARS$' },
};

const DEFAULT_CURRENCY = 'BRL';

/**
 * Resolve o código de moeda, com fallback para BRL.
 * @param {string|undefined|null} code
 * @returns {string} Código de moeda válido
 */
export const resolveCurrency = (code) => {
  if (!code || typeof code !== 'string') return DEFAULT_CURRENCY;
  const upper = code.toUpperCase().trim();
  return CURRENCY_CONFIG[upper] ? upper : DEFAULT_CURRENCY;
};

/**
 * Formata valor monetário com moeda dinâmica.
 * @param {number} value
 * @param {string} currencyCode - 'BRL', 'USD', 'EUR', etc.
 * @returns {string} Valor formatado (ex: "R$ 1.234,56", "$1,234.56")
 */
export const formatCurrencyDynamic = (value, currencyCode = DEFAULT_CURRENCY) => {
  try {
    const resolved = resolveCurrency(currencyCode);
    const config = CURRENCY_CONFIG[resolved] || CURRENCY_CONFIG[DEFAULT_CURRENCY];
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
    }).format(value || 0);
  } catch (e) {
    return `${currencyCode || 'R$'} ${(value || 0).toFixed(2)}`;
  }
};

/**
 * Formata valor monetário compacto (para eixos de gráfico).
 * @param {number} value
 * @param {string} currencyCode
 * @returns {string} Valor compacto (ex: "R$ 25 mil", "$25K")
 */
export const formatCurrencyCompact = (value, currencyCode = DEFAULT_CURRENCY) => {
  try {
    const resolved = resolveCurrency(currencyCode);
    const config = CURRENCY_CONFIG[resolved] || CURRENCY_CONFIG[DEFAULT_CURRENCY];
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value || 0);
  } catch (e) {
    return formatCurrencyDynamic(value, currencyCode);
  }
};

/**
 * Retorna o símbolo da moeda.
 * @param {string} currencyCode
 * @returns {string} Símbolo (ex: 'R$', '$', '€')
 */
export const getCurrencySymbol = (currencyCode) => {
  const resolved = resolveCurrency(currencyCode);
  return CURRENCY_CONFIG[resolved]?.symbol || 'R$';
};

/**
 * Verifica se todas as contas possuem a mesma moeda.
 * @param {Array} accounts - Array de objetos com campo `currency`
 * @returns {boolean}
 */
export const isSameCurrency = (accounts) => {
  if (!Array.isArray(accounts) || accounts.length === 0) return true;
  const currencies = new Set(accounts.map(a => resolveCurrency(a?.currency)));
  return currencies.size <= 1;
};

/**
 * Agrupa contas por moeda.
 * @param {Array} accounts - Array de objetos com campo `currency`
 * @returns {Map<string, Array>} Mapa moeda → contas
 */
export const groupByCurrency = (accounts) => {
  const groups = new Map();
  if (!Array.isArray(accounts)) return groups;

  accounts.forEach(acc => {
    const currency = resolveCurrency(acc?.currency);
    if (!groups.has(currency)) groups.set(currency, []);
    groups.get(currency).push(acc);
  });

  return groups;
};

/**
 * Agrega saldos por moeda a partir de um array de contas.
 * Retorna um mapa moeda → { initial, current, pnl, count }.
 * Nunca soma cross-currency.
 * 
 * @param {Array} accounts - Contas com initialBalance, currentBalance, currency
 * @returns {Map<string, { initial: number, current: number, pnl: number, count: number, currency: string }>}
 */
export const aggregateBalancesByCurrency = (accounts) => {
  const result = new Map();
  if (!Array.isArray(accounts)) return result;

  accounts.forEach(acc => {
    const currency = resolveCurrency(acc?.currency);
    const initial = Number(acc?.initialBalance) || 0;
    // CRITICAL: usar ?? em vez de || para não descartar zero
    const current = acc?.currentBalance ?? acc?.initialBalance ?? 0;

    if (!result.has(currency)) {
      result.set(currency, { initial: 0, current: 0, pnl: 0, count: 0, currency });
    }

    const group = result.get(currency);
    group.initial += initial;
    group.current += Number(current);
    group.pnl += Number(current) - initial;
    group.count += 1;
  });

  return result;
};

/**
 * Resolve a moeda de um plano a partir da conta-pai.
 * @param {Object} plan - Plano com accountId
 * @param {Array} accounts - Lista de contas
 * @returns {string} Código de moeda
 */
export const getPlanCurrency = (plan, accounts) => {
  if (!plan || !Array.isArray(accounts)) return DEFAULT_CURRENCY;
  const account = accounts.find(a => a.id === plan.accountId);
  return resolveCurrency(account?.currency);
};

export default {
  formatCurrencyDynamic,
  formatCurrencyCompact,
  getCurrencySymbol,
  resolveCurrency,
  isSameCurrency,
  groupByCurrency,
  aggregateBalancesByCurrency,
  getPlanCurrency,
};
