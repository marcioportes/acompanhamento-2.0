/**
 * csvMapper.js
 * @version 1.1.0 (v1.18.0)
 * @description Aplica template de mapeamento aos rows parseados do CSV.
 *   Transforma colunas CSV → campos do sistema, aplica valueMap e parse de datas.
 *
 * CHANGELOG:
 * - 1.1.0: getMissingFields — critério trade completo = emotionEntry + emotionExit + setup (stopLoss opcional)
 * - 1.0.0: Versão inicial
 *
 * EXPORTS:
 *   applyMapping(rows, template) → { trades: MappedTrade[], errors: MappingError[] }
 *   parseDateTime(value, format) → string (ISO) | null
 *   buildTradeFromRow(row, mapping, valueMap, defaults, dateFormat) → MappedTrade | null
 *   getMissingFields(trade) → string[]
 */

// ============================================
// DATE PARSING
// ============================================

/**
 * Parse de data/hora em vários formatos brasileiros e internacionais.
 * @param {string} value - Valor do CSV (ex: "03/03/2026 10:30:00")
 * @param {string} [format] - Hint de formato (ex: "DD/MM/YYYY HH:mm:ss")
 * @returns {string|null} ISO datetime string ou null se inválido
 */
export const parseDateTime = (value, format) => {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  // Já é ISO?
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(v)) return v.replace(' ', 'T');

  // MM/DD/YYYY HH:mm:ss (formato US — testar ANTES do BR se hint indica)
  if (format && format.startsWith('MM/DD')) {
    const usFull = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (usFull) {
      const [, mm, dd, yyyy, hh, min, ss] = usFull;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min}:${(ss || '00').padStart(2, '0')}`;
    }
    const usDate = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (usDate) {
      const [, mm, dd, yyyy] = usDate;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T12:00:00`;
    }
  }

  // DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY HH:mm (formato BR — default)
  const brFull = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (brFull) {
    const [, dd, mm, yyyy, hh, min, ss] = brFull;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min}:${(ss || '00').padStart(2, '0')}`;
  }

  // DD/MM/YYYY (sem hora)
  const brDate = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (brDate) {
    const [, dd, mm, yyyy] = brDate;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T12:00:00`;
  }

  // YYYY-MM-DD (ISO date sem hora)
  const isoDate = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return `${v}T12:00:00`;
  }

  return null;
};

// ============================================
// VALUE MAPPING
// ============================================

/**
 * Aplica valueMap a um valor.
 * @param {string} value - Valor original do CSV
 * @param {Object} [map] - Mapa de transformação { "C": "LONG", "V": "SHORT" }
 * @returns {string} Valor transformado
 */
export const applyValueMap = (value, map) => {
  if (!map || !value) return value;
  const normalized = String(value).trim().toUpperCase();
  // Tentar match exato primeiro, depois case-insensitive
  if (map[value]) return map[value];
  if (map[normalized]) return map[normalized];
  for (const [k, v] of Object.entries(map)) {
    if (k.toUpperCase() === normalized) return v;
  }
  return value;
};

// ============================================
// ROW → TRADE MAPPING
// ============================================

/** Campos do sistema com metadados */
export const SYSTEM_FIELDS = [
  { key: 'ticker', label: 'Ticker / Ativo', required: true, type: 'string' },
  { key: 'side', label: 'Lado (Compra/Venda)', required: true, type: 'string', hasValueMap: true },
  { key: 'buyPrice', label: 'Preço Compra', required: false, type: 'number', group: 'price' },
  { key: 'sellPrice', label: 'Preço Venda', required: false, type: 'number', group: 'price' },
  { key: 'entry', label: 'Preço Entrada (se não há Compra/Venda)', required: false, type: 'number', group: 'price', alt: true },
  { key: 'exit', label: 'Preço Saída (se não há Compra/Venda)', required: false, type: 'number', group: 'price', alt: true },
  { key: 'qty', label: 'Quantidade', required: true, type: 'number' },
  { key: 'entryTime', label: 'Data/Hora Abertura', required: true, type: 'datetime' },
  { key: 'exitTime', label: 'Data/Hora Fechamento', required: false, type: 'datetime' },
  { key: 'result', label: 'Resultado (R$)', required: false, type: 'number' },
  { key: 'stopLoss', label: 'Stop Loss', required: false, type: 'number' },
];

/** Campos obrigatórios: ticker, side, qty, entryTime + (buyPrice/sellPrice OU entry/exit) */
export const REQUIRED_FIELDS = ['ticker', 'side', 'qty', 'entryTime'];

/**
 * Converte uma row do CSV em trade data usando o mapeamento.
 * @param {Object} row - Linha do CSV (chave = header original)
 * @param {Object} mapping - { ticker: "Ativo", side: "C/V", ... }
 * @param {Object} [valueMap] - { side: { "C": "LONG", "V": "SHORT" } }
 * @param {Object} [defaults] - { exchange: "B3" }
 * @param {string} [dateFormat] - Hint de formato de data
 * @returns {{ trade: Object|null, errors: string[] }}
 */
export const buildTradeFromRow = (row, mapping, valueMap = {}, defaults = {}, dateFormat = '') => {
  const errors = [];
  const trade = {};

  for (const field of SYSTEM_FIELDS) {
    const csvColumn = mapping[field.key];
    let value = null;

    if (csvColumn && row[csvColumn] !== undefined && row[csvColumn] !== '') {
      value = row[csvColumn];
    } else if (defaults[field.key] !== undefined && defaults[field.key] !== null) {
      value = defaults[field.key];
    }

    // Aplicar valueMap
    if (value !== null && valueMap[field.key]) {
      value = applyValueMap(value, valueMap[field.key]);
    }

    // Parse por tipo
    if (value !== null && value !== '') {
      switch (field.type) {
        case 'number': {
          // Limpar formatação BR: "1.234,56" → "1234.56"
          const cleaned = String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          if (isNaN(num)) {
            if (field.required) errors.push(`${field.label}: valor numérico inválido "${value}"`);
            value = null;
          } else {
            value = num;
          }
          break;
        }
        case 'datetime': {
          const parsed = parseDateTime(String(value), dateFormat);
          if (!parsed) {
            if (field.required) errors.push(`${field.label}: data/hora inválida "${value}"`);
            value = null;
          } else {
            value = parsed;
          }
          break;
        }
        case 'string':
          value = String(value).trim();
          break;
      }
    }

    // Validar required
    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push(`${field.label}: campo obrigatório não mapeado ou vazio`);
    }

    if (value !== null && value !== undefined && value !== '') {
      trade[field.key] = value;
    }
  }

  // Normalizar side
  if (trade.side) {
    const s = String(trade.side).toUpperCase();
    if (['LONG', 'BUY', 'COMPRA', 'C'].includes(s)) trade.side = 'LONG';
    else if (['SHORT', 'SELL', 'VENDA', 'V'].includes(s)) trade.side = 'SHORT';
    else errors.push(`Lado: valor não reconhecido "${trade.side}"`);
  }

  // Normalizar ticker
  if (trade.ticker) {
    trade.ticker = trade.ticker.toUpperCase().trim();
  }

  // Aplicar defaults para campos não listados em SYSTEM_FIELDS (exchange, setup, etc)
  for (const [key, val] of Object.entries(defaults)) {
    if (trade[key] === undefined && val != null) {
      trade[key] = val;
    }
  }

  // ================================================
  // Resolver entry/exit a partir de buyPrice/sellPrice + side
  // Se o CSV tem Preço Compra e Preço Venda (padrão corretoras BR):
  //   LONG  → entry = buyPrice, exit = sellPrice
  //   SHORT → entry = sellPrice, exit = buyPrice
  // Se o CSV já tem entry/exit direto, manter.
  // ================================================
  if (trade.buyPrice != null && trade.sellPrice != null && trade.side) {
    if (trade.side === 'LONG') {
      trade.entry = trade.buyPrice;
      trade.exit = trade.sellPrice;
    } else if (trade.side === 'SHORT') {
      trade.entry = trade.sellPrice;
      trade.exit = trade.buyPrice;
    }
    delete trade.buyPrice;
    delete trade.sellPrice;
  } else if (trade.buyPrice != null && trade.sellPrice == null) {
    // Só tem preço compra — entry se LONG, exit se SHORT
    if (trade.side === 'LONG') trade.entry = trade.entry ?? trade.buyPrice;
    else trade.exit = trade.exit ?? trade.buyPrice;
    delete trade.buyPrice;
  } else if (trade.sellPrice != null && trade.buyPrice == null) {
    // Só tem preço venda — exit se LONG, entry se SHORT
    if (trade.side === 'LONG') trade.exit = trade.exit ?? trade.sellPrice;
    else trade.entry = trade.entry ?? trade.sellPrice;
    delete trade.sellPrice;
  }

  // Validar que entry e exit existem após resolução
  if (trade.entry == null) errors.push('Preço de entrada não resolvido (mapeie Preço Compra/Venda ou Entrada)');
  if (trade.exit == null) errors.push('Preço de saída não resolvido (mapeie Preço Compra/Venda ou Saída)');

  if (errors.length > 0) {
    return { trade: Object.keys(trade).length > 0 ? trade : null, errors };
  }

  return { trade, errors: [] };
};

// ============================================
// BULK MAPPING
// ============================================

/**
 * Aplica mapeamento a todas as rows.
 * @param {Object[]} rows - Rows do CSV parseado
 * @param {Object} template - Template de mapeamento { mapping, valueMap, defaults, dateFormat }
 * @returns {{ trades: Object[], errors: { row: number, errors: string[] }[], valid: number, invalid: number }}
 */
export const applyMapping = (rows, template) => {
  const { mapping = {}, valueMap = {}, defaults = {}, dateFormat = '' } = template;
  const trades = [];
  const errors = [];
  let valid = 0;
  let invalid = 0;

  for (let i = 0; i < rows.length; i++) {
    const { trade, errors: rowErrors } = buildTradeFromRow(rows[i], mapping, valueMap, defaults, dateFormat);

    if (rowErrors.length > 0) {
      errors.push({ row: i + 1, errors: rowErrors });
      invalid++;
      // Incluir trade parcial mesmo com erros (para preview)
      if (trade) trades.push({ ...trade, _rowIndex: i + 1, _hasErrors: true, _errors: rowErrors });
    } else if (trade) {
      trades.push({ ...trade, _rowIndex: i + 1, _hasErrors: false });
      valid++;
    }
  }

  return { trades, errors, valid, invalid };
};

/**
 * Determina quais campos ficam "incompletos" para um trade importado.
 * Critério para trade completo: emotionEntry + emotionExit + setup
 * stopLoss é OPCIONAL — não faz parte do critério de completude.
 * 
 * @param {Object} trade - Trade mapeado
 * @returns {string[]} Lista de campos faltantes que precisam ser preenchidos manualmente
 */
export const getMissingFields = (trade) => {
  const missing = [];
  if (!trade.emotionEntry) missing.push('emotionEntry');
  if (!trade.emotionExit) missing.push('emotionExit');
  if (!trade.setup) missing.push('setup');
  return missing;
};
