/**
 * orderParsers.js
 * @version 2.0.0 (v1.20.0)
 * @description Parsers para exportações de ordens de corretoras brasileiras.
 *
 * FORMATOS SUPORTADOS:
 *   - ProfitChart-Pro (prioridade): CSV hierárquico master+events, PT-BR, encoding Latin-1,
 *     delimiter `;`, preamble hash+data. Exportado pela plataforma ProfitChart-Pro (Clear, XP, Rico, etc).
 *   - Genérico: Mapeamento manual de colunas para prop firms futuras.
 *
 * ESTRUTURA PROFITCHART-PRO:
 *   Linha 1: preamble (hash,data_inicio,data_fim) — ignorada
 *   Linha 2: header (26 colunas separadas por ;)
 *   Linhas 3+: dados — cada ordem tem:
 *     - Linha MASTER: dados completos (Corretora;Conta;...;Origem)
 *     - Linhas EVENT: 6 campos vazios + Status(Trade/Cancel);Timestamp;...;Preço;Qtd
 *
 * REUTILIZA: parseDateTime e parseNumericValue de csvMapper.js (DRY)
 *
 * EXPORTS:
 *   detectOrderFormat(headers) → { format, confidence }
 *   parseProfitChartPro(text) → { orders[], meta, errors[] }
 *   parseGenericOrders(rows, columnMapping) → { orders[], errors[] }
 *   normalizeSide(raw) → 'BUY'|'SELL'|null
 *   normalizeOrderType(raw) → string|null
 *   normalizeOrderStatus(raw) → string|null
 *   PROFITCHART_HEADER_SIGNATURE
 */

import { parseDateTime, parseNumericValue } from './csvMapper.js';
import { detectLowResolution } from './orderTemporalResolution.js';

// ============================================
// CLEAR/PROFIT — CONSTANTS
// ============================================

/** Headers esperados no CSV ProfitChart-Pro (para detecção automática, sem acentos) */
export const PROFITCHART_HEADER_SIGNATURE = [
  'corretora', 'conta', 'titular', 'clordid', 'ativo', 'lado',
  'status', 'criacao', 'ultima atualizacao', 'preco', 'preco stop',
  'qtd', 'preco medio', 'qtd executada', 'qtd restante', 'total',
  'total executado', 'validade', 'data validade', 'estrategia',
  'mensagem', 'carteira', 'tipo de ordem', 'taskid', 'bolsa', 'origem',
];

const PROFITCHART_DETECTION_THRESHOLD = 0.5;

/** Mapeamento de status PT-BR → enum interno */
const PROFITCHART_STATUS_MAP = {
  'executada': 'FILLED',
  'cancelada': 'CANCELLED',
  'rejeitada': 'REJECTED',
  'parcial': 'PARTIALLY_FILLED',
  'parcialmente executada': 'PARTIALLY_FILLED',
  'pendente': 'SUBMITTED',
  'aberta': 'SUBMITTED',
  'nova': 'SUBMITTED',
  'expirada': 'EXPIRED',
  // Sub-event statuses
  'trade': 'TRADE_EVENT',
  'cancel': 'CANCEL_EVENT',
  'modify': 'MODIFY_EVENT',
  'replace': 'MODIFY_EVENT',
};

const SIDE_MAP = {
  'c': 'BUY', 'v': 'SELL',
  'compra': 'BUY', 'venda': 'SELL',
  'buy': 'BUY', 'sell': 'SELL',
  'b': 'BUY', 's': 'SELL',
  'long': 'BUY', 'short': 'SELL',
};

const ORDER_TYPE_MAP = {
  'limite': 'LIMIT', 'mercado': 'MARKET',
  'stop': 'STOP', 'stop limite': 'STOP_LIMIT', 'stop limitado': 'STOP_LIMIT',
  'market': 'MARKET', 'limit': 'LIMIT',
  'stop limit': 'STOP_LIMIT', 'stop_limit': 'STOP_LIMIT',
};

// ============================================
// NORMALIZERS (exported for reuse)
// ============================================

export const normalizeSide = (raw) => {
  if (!raw) return null;
  return SIDE_MAP[raw.trim().toLowerCase()] ?? null;
};

export const normalizeOrderType = (raw) => {
  if (!raw) return null;
  return ORDER_TYPE_MAP[raw.trim().toLowerCase()] ?? null;
};

export const normalizeOrderStatus = (raw) => {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const mapped = PROFITCHART_STATUS_MAP[s];
  if (!mapped) return null;
  // Event-level statuses (TRADE_EVENT, CANCEL_EVENT, MODIFY_EVENT) are not order statuses
  if (mapped.endsWith('_EVENT')) return null;
  return mapped;
};

// ============================================
// PARSE HELPERS
// ============================================

const parsePriceBR = (raw) => {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null;
  return parseNumericValue(raw);
};

const parseQty = (raw) => {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null;
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : n;
};

const parseDateTimeBR = (raw) => {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null;
  return parseDateTime(raw.trim(), 'DD/MM/YYYY');
};

/**
 * Strip acentos para comparação de headers.
 */
const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ============================================
// FORMAT DETECTION
// ============================================

/**
 * Detecta formato da corretora a partir dos headers.
 * @param {string[]} headers
 * @returns {{ format: 'profitchart_pro'|'generic', confidence: number }}
 */
export const detectOrderFormat = (headers) => {
  if (!headers?.length) return { format: 'generic', confidence: 0 };

  const normalized = headers.map(h => stripAccents(h.toLowerCase().trim()));

  let matched = 0;
  for (const sig of PROFITCHART_HEADER_SIGNATURE) {
    if (normalized.some(n => n === sig || n.includes(sig) || sig.includes(n))) {
      matched++;
    }
  }

  const confidence = matched / PROFITCHART_HEADER_SIGNATURE.length;
  if (confidence >= PROFITCHART_DETECTION_THRESHOLD) {
    return { format: 'profitchart_pro', confidence };
  }

  return { format: 'generic', confidence };
};

// ============================================
// CLEAR/PROFIT — MAIN PARSER
// ============================================

/**
 * Parse CSV de ordens no formato ProfitChart-Pro.
 * Trata estrutura hierárquica master + sub-events (Trade/Cancel).
 *
 * @param {string} text — conteúdo CSV (UTF-8)
 * @returns {{
 *   orders: OrderRecord[],
 *   meta: { corretora, conta, titular, totalOrders, totalEvents },
 *   errors: Array<{ row: number, message: string }>
 * }}
 */
export const parseProfitChartPro = (text) => {
  if (!text || !text.trim()) {
    return { orders: [], meta: {}, errors: [{ row: 0, message: 'Arquivo vazio' }] };
  }

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const orders = [];
  const errors = [];

  // Step 1: Find header line (skip preamble)
  let headerLineIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if ((line.match(/;/g) || []).length >= 10) {
      headerLineIndex = i;
      break;
    }
  }

  if (headerLineIndex === -1) {
    return { orders: [], meta: {}, errors: [{ row: 0, message: 'Header não encontrado no CSV' }] };
  }

  // Step 2: Build column index map
  const headers = lines[headerLineIndex].split(';').map(h => h.trim());
  const colIdx = {};

  const COL_MAP = {
    'corretora': 'corretora', 'conta': 'conta', 'titular': 'titular',
    'clordid': 'clordid', 'ativo': 'ativo', 'lado': 'lado',
    'status': 'status', 'criacao': 'criacao', 'ultima atualizacao': 'ultimaAtualizacao',
    'preco': 'preco', 'preco stop': 'precoStop', 'qtd': 'qtd',
    'preco medio': 'precoMedio', 'qtd executada': 'qtdExecutada',
    'qtd restante': 'qtdRestante', 'total': 'total',
    'total executado': 'totalExecutado', 'validade': 'validade',
    'data validade': 'dataValidade', 'estrategia': 'estrategia',
    'mensagem': 'mensagem', 'carteira': 'carteira',
    'tipo de ordem': 'tipoOrdem', 'taskid': 'taskid',
    'bolsa': 'bolsa', 'origem': 'origem',
  };

  for (let i = 0; i < headers.length; i++) {
    const key = stripAccents(headers[i].toLowerCase());
    if (COL_MAP[key]) colIdx[COL_MAP[key]] = i;
  }

  // Step 3: Parse data (master + event rows)
  let currentOrder = null;
  let meta = {};

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(';');
    const isMasterRow = cols[0] && cols[0].trim() !== '';

    if (isMasterRow) {
      if (currentOrder) orders.push(currentOrder);

      const getCol = (field) => {
        const idx = colIdx[field];
        return idx != null && idx < cols.length ? cols[idx].trim() : null;
      };

      const side = normalizeSide(getCol('lado'));
      const rawStatus = getCol('status');
      const status = normalizeOrderStatus(rawStatus);
      const orderType = normalizeOrderType(getCol('tipoOrdem'));
      const stopPrice = parsePriceBR(getCol('precoStop'));
      const isStopOrder = orderType === 'STOP' || orderType === 'STOP_LIMIT' ||
                          (stopPrice != null && stopPrice > 0);

      if (!meta.corretora) {
        meta = {
          corretora: getCol('corretora') || '',
          conta: getCol('conta') || '',
          titular: getCol('titular') || '',
        };
      }

      currentOrder = {
        _rowIndex: i + 1,
        externalOrderId: getCol('clordid') || null,
        account: getCol('conta') || null,
        instrument: (getCol('ativo') || '').toUpperCase(),
        side,
        status,
        orderType: orderType || 'LIMIT',
        submittedAt: parseDateTimeBR(getCol('criacao')),
        lastUpdatedAt: parseDateTimeBR(getCol('ultimaAtualizacao')),
        price: parsePriceBR(getCol('preco')),
        stopPrice,
        quantity: parseQty(getCol('qtd')),
        avgFillPrice: parsePriceBR(getCol('precoMedio')),
        filledQuantity: parseQty(getCol('qtdExecutada')),
        remainingQuantity: parseQty(getCol('qtdRestante')),
        totalValue: parsePriceBR(getCol('total')),
        totalExecutedValue: parsePriceBR(getCol('totalExecutado')),
        validity: getCol('validade') || null,
        strategy: getCol('estrategia') || null,
        exchange: getCol('bolsa') || null,
        origin: (getCol('origem') || '').replace(/\r/, '').trim() || null,
        isStopOrder,
        events: [],
        filledPrice: null,
        filledAt: null,
        cancelledAt: null,
      };

    } else {
      // Event row (;;;;;;EventType;Timestamp;...;Price;Qty)
      if (!currentOrder) {
        errors.push({ row: i + 1, message: 'Evento sem ordem master — ignorado' });
        continue;
      }

      const eventStatus = (cols[6] || '').trim().toLowerCase();
      const eventTimestamp = parseDateTimeBR((cols[7] || '').trim());
      const eventPrice = parsePriceBR((cols[12] || '').trim());
      const eventQty = parseQty((cols[13] || '').trim());

      if (eventStatus === 'trade') {
        currentOrder.events.push({ type: 'TRADE', timestamp: eventTimestamp, price: eventPrice, quantity: eventQty });
        if (!currentOrder.filledAt && eventTimestamp) currentOrder.filledAt = eventTimestamp;
        if (!currentOrder.filledPrice && eventPrice) currentOrder.filledPrice = eventPrice;
      } else if (eventStatus === 'cancel') {
        currentOrder.events.push({ type: 'CANCEL', timestamp: eventTimestamp, price: eventPrice, quantity: eventQty });
        if (!currentOrder.cancelledAt && eventTimestamp) currentOrder.cancelledAt = eventTimestamp;
      } else if (eventStatus === 'modify' || eventStatus === 'replace') {
        currentOrder.events.push({ type: 'MODIFY', timestamp: eventTimestamp, price: eventPrice, quantity: eventQty });
      } else if (eventStatus) {
        errors.push({ row: i + 1, message: `Tipo de evento desconhecido: "${eventStatus}"` });
      }
    }
  }

  if (currentOrder) orders.push(currentOrder);

  // Post-processing
  for (const order of orders) {
    if (!order.filledPrice && order.avgFillPrice) order.filledPrice = order.avgFillPrice;
    if (!order.filledQuantity) {
      const tradeEvents = order.events.filter(e => e.type === 'TRADE');
      if (tradeEvents.length > 0) {
        order.filledQuantity = tradeEvents.reduce((sum, e) => sum + (e.quantity || 0), 0);
      }
    }
  }

  meta.totalOrders = orders.length;
  meta.totalEvents = orders.reduce((sum, o) => sum + o.events.length, 0);

  // Detecta resolução temporal para shadow detection futuro (issue #93 redesign)
  const lowResolution = detectLowResolution(orders);

  return { orders, meta, errors, lowResolution };
};

// ============================================
// GENERIC PARSER (for future prop firms)
// ============================================

/**
 * Parse genérico com mapeamento manual de colunas.
 * @param {Object[]} rows — output do Papaparse (header mode)
 * @param {Object} columnMapping — { instrument: 'Column Name', side: 'Column Name', ... }
 * @returns {{ orders: Object[], errors: Array<{ row: number, message: string }> }}
 */
export const parseGenericOrders = (rows, columnMapping) => {
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
    const status = normalizeOrderStatus(getValue('status'));

    if (!side && !status) {
      errors.push({ row: i + 1, message: 'Linha sem lado e status — ignorada' });
      continue;
    }

    const orderType = normalizeOrderType(getValue('orderType'));
    const stopPrice = parsePriceBR(getValue('stopPrice'));
    const isStopOrder = orderType === 'STOP' || orderType === 'STOP_LIMIT' ||
                        (stopPrice != null && stopPrice > 0);

    orders.push({
      _rowIndex: i + 1,
      externalOrderId: getValue('externalOrderId') || null,
      account: getValue('account') || null,
      instrument: (getValue('instrument') || '').trim().toUpperCase() || null,
      side,
      quantity: parseQty(getValue('quantity')),
      orderType: orderType || null,
      price: parsePriceBR(getValue('price')),
      stopPrice,
      filledPrice: parsePriceBR(getValue('filledPrice')),
      filledQuantity: parseQty(getValue('filledQuantity')),
      status,
      submittedAt: parseDateTimeBR(getValue('submittedAt')),
      filledAt: parseDateTimeBR(getValue('filledAt')),
      cancelledAt: parseDateTimeBR(getValue('cancelledAt')),
      isStopOrder,
      events: [],
      origin: null,
    });
  }

  // Detecta resolução temporal para shadow detection futuro (issue #93 redesign)
  const lowResolution = detectLowResolution(orders);

  return { orders, errors, lowResolution };
};
