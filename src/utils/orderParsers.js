/**
 * orderParsers.js
 * @version 1.0.0 (v1.20.0)
 * @description Parsers para exportações de ordens de corretoras.
 *   Cada parser recebe rows (output do Papaparse) e retorna array de ordens normalizadas.
 *
 * FORMATO SUPORTADO:
 *   - Tradovate (prioridade): Order ID, Account, Contract, B/S, Qty, Order Type,
 *     Limit Price, Stop Price, Fill Price, Status, Date/Time, Fill Date/Time
 *   - Genérico: Mapeamento manual de colunas
 *
 * PRINCÍPIO: Parser não valida regras de negócio — apenas extrai e normaliza tipos.
 *   Validação de domínio fica em orderValidation.js.
 *
 * EXPORTS:
 *   detectFormat(headers) → { format, confidence, mappedHeaders }
 *   parseTradovate(rows, headers) → RawOrder[]
 *   parseGeneric(rows, columnMapping) → RawOrder[]
 *   TRADOVATE_HEADER_MAP — mapeamento de colunas Tradovate
 *
 * @see orderNormalizer.js para normalização de tipos/enums
 */

import { parseCSVString, detectDelimiter, validateStructure, detectPreamble } from './csvParser.js';

// ============================================
// CONSTANTES
// ============================================

/**
 * Mapeamento de headers Tradovate → campo interno.
 * Keys: nomes de coluna normalizados (lowercase, trimmed).
 * Values: campo no schema interno RawOrder.
 */
export const TRADOVATE_HEADER_MAP = {
  'order id': 'orderId',
  'orderid': 'orderId',
  'order #': 'orderId',
  'account': 'account',
  'contract': 'instrument',
  'symbol': 'instrument',
  'instrument': 'instrument',
  'b/s': 'side',
  'side': 'side',
  'buy/sell': 'side',
  'action': 'side',
  'qty': 'quantity',
  'quantity': 'quantity',
  'size': 'quantity',
  'order type': 'orderType',
  'ordertype': 'orderType',
  'type': 'orderType',
  'limit price': 'limitPrice',
  'limitprice': 'limitPrice',
  'limit': 'limitPrice',
  'stop price': 'stopPrice',
  'stopprice': 'stopPrice',
  'stop': 'stopPrice',
  'fill price': 'filledPrice',
  'fillprice': 'filledPrice',
  'avg fill price': 'filledPrice',
  'avgfillprice': 'filledPrice',
  'filled price': 'filledPrice',
  'fill qty': 'filledQuantity',
  'fillqty': 'filledQuantity',
  'filled qty': 'filledQuantity',
  'filled quantity': 'filledQuantity',
  'status': 'status',
  'state': 'status',
  'order status': 'status',
  'date/time': 'submittedAt',
  'datetime': 'submittedAt',
  'date': 'submittedAt',
  'time': 'submittedAt',
  'submitted': 'submittedAt',
  'created': 'submittedAt',
  'fill date/time': 'filledAt',
  'filldatetime': 'filledAt',
  'fill date': 'filledAt',
  'fill time': 'filledAt',
  'filled at': 'filledAt',
  'cancelled date/time': 'cancelledAt',
  'canceled date/time': 'cancelledAt',
  'cancel time': 'cancelledAt',
};

/** Campos mínimos obrigatórios para detecção Tradovate */
const TRADOVATE_REQUIRED = ['instrument', 'side', 'quantity', 'orderType', 'status', 'submittedAt'];

/** Threshold de match para detecção automática */
const FORMAT_DETECTION_THRESHOLD = 0.6;

// ============================================
// DETECÇÃO DE FORMATO
// ============================================

/**
 * Detecta formato da corretora a partir dos headers do CSV.
 *
 * @param {string[]} headers — nomes das colunas (originais)
 * @returns {{ format: 'tradovate'|'generic', confidence: number, mappedHeaders: Object }}
 */
export const detectFormat = (headers) => {
  if (!headers?.length) {
    return { format: 'generic', confidence: 0, mappedHeaders: {} };
  }

  // Tentar Tradovate
  const mapped = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  for (let i = 0; i < normalizedHeaders.length; i++) {
    const nh = normalizedHeaders[i];
    if (TRADOVATE_HEADER_MAP[nh]) {
      mapped[TRADOVATE_HEADER_MAP[nh]] = headers[i]; // valor original para lookup
    }
  }

  const matchedRequiredCount = TRADOVATE_REQUIRED.filter(f => mapped[f]).length;
  const confidence = matchedRequiredCount / TRADOVATE_REQUIRED.length;

  if (confidence >= FORMAT_DETECTION_THRESHOLD) {
    return { format: 'tradovate', confidence, mappedHeaders: mapped };
  }

  return { format: 'generic', confidence, mappedHeaders: mapped };
};

// ============================================
// PARSER HELPERS
// ============================================

/**
 * Parse numérico robusto — suporta formatos US e BR.
 * @param {*} value
 * @returns {number|null}
 */
export const parseNumeric = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  const str = String(value).trim();
  if (!str) return null;

  // Remover símbolos de moeda e espaços
  let cleaned = str.replace(/[$R\s]/g, '');

  // Formato com parênteses = negativo: (93.00) → -93.00
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Se tem vírgula e ponto, determinar qual é decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Último separador é o decimal
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // BR: 1.000,50 → 1000.50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,000.50 → 1000.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Só vírgula: pode ser BR decimal
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

/**
 * Normaliza side/B/S para enum padrão.
 * @param {string} raw
 * @returns {'BUY'|'SELL'|null}
 */
export const normalizeSide = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (['BUY', 'B', 'LONG', 'C', 'COMPRA'].includes(s)) return 'BUY';
  if (['SELL', 'S', 'SHORT', 'V', 'VENDA'].includes(s)) return 'SELL';
  return null;
};

/**
 * Normaliza order type para enum padrão.
 * @param {string} raw
 * @returns {'MARKET'|'LIMIT'|'STOP'|'STOP_LIMIT'|null}
 */
export const normalizeOrderType = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase().replace(/[_\-\s]+/g, '');
  if (['MARKET', 'MKT', 'MERCADO'].includes(s)) return 'MARKET';
  if (['LIMIT', 'LMT', 'LIMITE'].includes(s)) return 'LIMIT';
  if (['STOP', 'STP'].includes(s)) return 'STOP';
  if (['STOPLIMIT', 'STPLMT', 'STPLIMIT', 'STMLT'].includes(s)) return 'STOP_LIMIT';
  return null;
};

/**
 * Normaliza status da ordem para enum padrão.
 * @param {string} raw
 * @returns {string|null}
 */
export const normalizeOrderStatus = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase().replace(/[_\-\s]+/g, '');
  const STATUS_MAP = {
    'FILLED': 'FILLED',
    'FILL': 'FILLED',
    'COMPLETE': 'FILLED',
    'COMPLETED': 'FILLED',
    'CANCELLED': 'CANCELLED',
    'CANCELED': 'CANCELLED',
    'CANCEL': 'CANCELLED',
    'REJECTED': 'REJECTED',
    'REJECT': 'REJECTED',
    'EXPIRED': 'EXPIRED',
    'EXPIRE': 'EXPIRED',
    'SUBMITTED': 'SUBMITTED',
    'NEW': 'SUBMITTED',
    'PENDING': 'SUBMITTED',
    'WORKING': 'SUBMITTED',
    'OPEN': 'SUBMITTED',
    'MODIFIED': 'MODIFIED',
    'REPLACED': 'MODIFIED',
    'PARTIALLYFILLED': 'PARTIALLY_FILLED',
    'PARTIAL': 'PARTIALLY_FILLED',
    'PARTFILL': 'PARTIALLY_FILLED',
  };
  return STATUS_MAP[s] ?? null;
};

/**
 * Parse de timestamp — suporta múltiplos formatos.
 * Retorna ISO string ou null.
 * @param {string} raw
 * @returns {string|null}
 */
export const parseTimestamp = (raw) => {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Tentar parse direto (ISO, US standard)
  const directParse = new Date(str);
  if (!isNaN(directParse.getTime())) {
    return directParse.toISOString();
  }

  // Formato BR: DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY HH:mm
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (brMatch) {
    const [, day, month, year, hour, minute, second] = brMatch;
    const d = new Date(year, month - 1, day, hour, minute, second || 0);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Formato US: MM/DD/YYYY HH:mm:ss
  const usMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (usMatch) {
    const [, month, day, year, hour, minute, second] = usMatch;
    const d = new Date(year, month - 1, day, hour, minute, second || 0);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return null;
};

// ============================================
// TRADOVATE PARSER
// ============================================

/**
 * Parse de CSV de ordens no formato Tradovate.
 *
 * @param {Object[]} rows — output do Papaparse (header mode)
 * @param {string[]} headers — nomes originais das colunas
 * @returns {{ orders: RawOrder[], errors: Array<{ row: number, message: string }> }}
 */
export const parseTradovate = (rows, headers) => {
  const { mappedHeaders } = detectFormat(headers);
  const orders = [];
  const errors = [];

  // Construir reverse map: campo interno → nome da coluna original
  const colMap = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const field = TRADOVATE_HEADER_MAP[normalizedHeaders[i]];
    if (field && !colMap[field]) {
      colMap[field] = headers[i];
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Pular linhas completamente vazias
    if (Object.values(row).every(v => !v || String(v).trim() === '')) continue;

    const getValue = (field) => {
      const col = colMap[field];
      return col ? row[col] : undefined;
    };

    const side = normalizeSide(getValue('side'));
    const orderType = normalizeOrderType(getValue('orderType'));
    const status = normalizeOrderStatus(getValue('status'));
    const submittedAt = parseTimestamp(getValue('submittedAt'));

    // Validação mínima do parser — erros estruturais
    if (!side && !orderType && !status) {
      errors.push({ row: i + 1, message: 'Linha sem side, orderType e status — provável linha inválida' });
      continue;
    }

    const limitPrice = parseNumeric(getValue('limitPrice'));
    const stopPrice = parseNumeric(getValue('stopPrice'));

    // isStopOrder: ordem de proteção (STOP ou STOP_LIMIT)
    const isStopOrder = orderType === 'STOP' || orderType === 'STOP_LIMIT' || (stopPrice != null && stopPrice > 0);

    const order = {
      _rowIndex: i + 1,
      externalOrderId: getValue('orderId') || null,
      account: getValue('account') || null,
      instrument: (getValue('instrument') || '').trim().toUpperCase() || null,
      side,
      quantity: parseNumeric(getValue('quantity')),
      orderType,
      limitPrice,
      stopPrice,
      filledPrice: parseNumeric(getValue('filledPrice')),
      filledQuantity: parseNumeric(getValue('filledQuantity')),
      status,
      submittedAt,
      filledAt: parseTimestamp(getValue('filledAt')),
      cancelledAt: parseTimestamp(getValue('cancelledAt')),
      isStopOrder,
      _raw: row, // manter referência para debug
    };

    orders.push(order);
  }

  return { orders, errors };
};

// ============================================
// GENERIC PARSER
// ============================================

/**
 * Parse genérico com mapeamento manual de colunas.
 *
 * @param {Object[]} rows — output do Papaparse
 * @param {Object} columnMapping — { instrument: 'Nome da Coluna', side: 'Nome', ... }
 * @returns {{ orders: RawOrder[], errors: Array<{ row: number, message: string }> }}
 */
export const parseGeneric = (rows, columnMapping) => {
  if (!columnMapping || !Object.keys(columnMapping).length) {
    return { orders: [], errors: [{ row: 0, message: 'Mapeamento de colunas não fornecido' }] };
  }

  const orders = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (Object.values(row).every(v => !v || String(v).trim() === '')) continue;

    const getValue = (field) => {
      const col = columnMapping[field];
      return col ? row[col] : undefined;
    };

    const side = normalizeSide(getValue('side'));
    const orderType = normalizeOrderType(getValue('orderType'));
    const status = normalizeOrderStatus(getValue('status'));

    if (!side && !status) {
      errors.push({ row: i + 1, message: 'Linha sem side e status — ignorada' });
      continue;
    }

    const limitPrice = parseNumeric(getValue('limitPrice'));
    const stopPrice = parseNumeric(getValue('stopPrice'));
    const isStopOrder = orderType === 'STOP' || orderType === 'STOP_LIMIT' || (stopPrice != null && stopPrice > 0);

    const order = {
      _rowIndex: i + 1,
      externalOrderId: getValue('orderId') || null,
      account: getValue('account') || null,
      instrument: (getValue('instrument') || '').trim().toUpperCase() || null,
      side,
      quantity: parseNumeric(getValue('quantity')),
      orderType,
      limitPrice,
      stopPrice,
      filledPrice: parseNumeric(getValue('filledPrice')),
      filledQuantity: parseNumeric(getValue('filledQuantity')),
      status,
      submittedAt: parseTimestamp(getValue('submittedAt')),
      filledAt: parseTimestamp(getValue('filledAt')),
      cancelledAt: parseTimestamp(getValue('cancelledAt')),
      isStopOrder,
      _raw: row,
    };

    orders.push(order);
  }

  return { orders, errors };
};
