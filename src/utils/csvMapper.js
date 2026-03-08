/**
 * csvMapper.js
 * @version 1.2.0 (v1.18.1)
 * @description Aplica template de mapeamento aos rows parseados do CSV.
 *   Transforma colunas CSV → campos do sistema, aplica valueMap e parse de datas.
 *
 * CHANGELOG:
 * - 1.2.0: Inferência genérica de direção quando side não mapeado.
 *          Novos SYSTEM_FIELDS: buyTimestamp, sellTimestamp.
 *          Parse de PnL com parênteses/dólar: $(93.00) → -93.00.
 *          Flag directionInferred para rastreabilidade.
 * - 1.1.0: getMissingFields — critério trade completo = emotionEntry + emotionExit + setup (stopLoss opcional)
 * - 1.0.0: Versão inicial
 *
 * EXPORTS:
 *   applyMapping(rows, template) → { trades: MappedTrade[], errors: MappingError[] }
 *   parseDateTime(value, format) → string (ISO) | null
 *   buildTradeFromRow(row, mapping, valueMap, defaults, dateFormat) → MappedTrade | null
 *   getMissingFields(trade) → string[]
 *   inferDirection(buyPrice, sellPrice, buyTimestamp, sellTimestamp) → { side, entry, exit, entryTime, exitTime, directionInferred }
 *   parseNumericValue(value) → number | null
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
// NUMERIC PARSING (inclui PnL com parênteses/dólar)
// ============================================

/**
 * Parse de valor numérico do CSV.
 * Suporta:
 * - Formato BR: "1.234,56" → 1234.56
 * - Formato US: "1,234.56" → 1234.56
 * - PnL com parênteses: "$(93.00)" → -93.00
 * - PnL com parênteses sem $: "(93.00)" → -93.00
 * - PnL com $: "$17.00" → 17.00
 *
 * @param {string} value
 * @returns {number|null}
 */
export const parseNumericValue = (value) => {
  if (value == null) return null;
  let v = String(value).trim();
  if (!v) return null;

  // Detectar negativo por parênteses: $(93.00) ou (93.00)
  let isNegative = false;
  const parenMatch = v.match(/^\$?\((.+)\)$/);
  if (parenMatch) {
    isNegative = true;
    v = parenMatch[1];
  }

  // Remover símbolo de moeda ($ R$ € etc)
  v = v.replace(/^[R$€£¥]+\s*/i, '').replace(/\s*[R$€£¥]+$/i, '');

  // Sinal negativo explícito
  if (v.startsWith('-')) {
    isNegative = true;
    v = v.slice(1);
  }

  // Limpar whitespace restante
  v = v.replace(/\s/g, '');

  // Detectar formato BR vs US
  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');

  if (lastComma > lastDot && lastComma !== -1) {
    // Formato BR: vírgula é o decimal, pontos são milhar
    v = v.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastDot !== -1) {
    // Formato US ou simples: ponto é decimal, vírgulas são milhar
    v = v.replace(/,/g, '');
  } else if (lastComma !== -1 && lastDot === -1) {
    // Só vírgula — pode ser decimal BR
    v = v.replace(',', '.');
  }

  const num = parseFloat(v);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
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
  if (map[value]) return map[value];
  if (map[normalized]) return map[normalized];
  for (const [k, v] of Object.entries(map)) {
    if (k.toUpperCase() === normalized) return v;
  }
  return value;
};

// ============================================
// DIRECTION INFERENCE
// ============================================

/**
 * Infere a direção do trade quando o CSV não traz coluna de lado/direction.
 *
 * Heurística cronológica: quem comprou primeiro (buyTimestamp < sellTimestamp)
 * é LONG; quem vendeu primeiro é SHORT.
 *
 * @param {number} buyPrice
 * @param {number} sellPrice
 * @param {string} buyTimestamp - ISO datetime da compra
 * @param {string} sellTimestamp - ISO datetime da venda
 * @returns {{ side: string|null, entry: number, exit: number, entryTime: string, exitTime: string, directionInferred: boolean }}
 */
export const inferDirection = (buyPrice, sellPrice, buyTimestamp, sellTimestamp) => {
  if (buyPrice == null || sellPrice == null) {
    return { side: null, entry: null, exit: null, entryTime: null, exitTime: null, directionInferred: false };
  }

  if (!buyTimestamp || !sellTimestamp) {
    return { side: null, entry: null, exit: null, entryTime: null, exitTime: null, directionInferred: false };
  }

  const buyTime = new Date(buyTimestamp);
  const sellTime = new Date(sellTimestamp);

  if (isNaN(buyTime.getTime()) || isNaN(sellTime.getTime())) {
    return { side: null, entry: null, exit: null, entryTime: null, exitTime: null, directionInferred: false };
  }

  if (buyTime < sellTime) {
    return {
      side: 'LONG',
      entry: buyPrice,
      exit: sellPrice,
      entryTime: buyTimestamp,
      exitTime: sellTimestamp,
      directionInferred: true,
    };
  } else if (sellTime < buyTime) {
    return {
      side: 'SHORT',
      entry: sellPrice,
      exit: buyPrice,
      entryTime: sellTimestamp,
      exitTime: buyTimestamp,
      directionInferred: true,
    };
  } else {
    return { side: null, entry: null, exit: null, entryTime: buyTimestamp, exitTime: sellTimestamp, directionInferred: false };
  }
};

// ============================================
// ROW → TRADE MAPPING
// ============================================

/** Campos do sistema com metadados */
export const SYSTEM_FIELDS = [
  { key: 'ticker', label: 'Ticker / Ativo', required: true, type: 'string' },
  { key: 'side', label: 'Lado (Compra/Venda)', required: false, type: 'string', hasValueMap: true,
    requiredUnless: 'directionInferred',
    hint: 'Se não mapeado, o sistema infere a partir dos timestamps de compra/venda' },
  { key: 'buyPrice', label: 'Preço Compra', required: false, type: 'number', group: 'price' },
  { key: 'sellPrice', label: 'Preço Venda', required: false, type: 'number', group: 'price' },
  { key: 'entry', label: 'Preço Entrada (se não há Compra/Venda)', required: false, type: 'number', group: 'price', alt: true },
  { key: 'exit', label: 'Preço Saída (se não há Compra/Venda)', required: false, type: 'number', group: 'price', alt: true },
  { key: 'qty', label: 'Quantidade', required: true, type: 'number' },
  { key: 'entryTime', label: 'Data/Hora Abertura', required: false, type: 'datetime',
    requiredUnless: 'directionInferred',
    hint: 'Se não mapeado, calculado a partir dos timestamps de compra/venda' },
  { key: 'exitTime', label: 'Data/Hora Fechamento', required: false, type: 'datetime' },
  { key: 'buyTimestamp', label: 'Timestamp Compra (para inferência)', required: false, type: 'datetime', group: 'inference' },
  { key: 'sellTimestamp', label: 'Timestamp Venda (para inferência)', required: false, type: 'datetime', group: 'inference' },
  { key: 'result', label: 'Resultado (R$)', required: false, type: 'number' },
  { key: 'stopLoss', label: 'Stop Loss', required: false, type: 'number' },
];

/** Campos obrigatórios mínimos (sem inferência) */
export const REQUIRED_FIELDS = ['ticker', 'side', 'qty', 'entryTime'];

/** Campos obrigatórios quando há inferência de direção */
export const REQUIRED_FIELDS_INFERRED = ['ticker', 'qty'];

/**
 * Converte uma row do CSV em trade data usando o mapeamento.
 */
export const buildTradeFromRow = (row, mapping, valueMap = {}, defaults = {}, dateFormat = '') => {
  const errors = [];
  const trade = {};

  // Detectar modo inferência: side não mapeado, mas buyTimestamp/sellTimestamp/buyPrice/sellPrice sim
  const sideIsMapped = !!mapping.side;
  const hasInferenceFields = !!mapping.buyTimestamp && !!mapping.sellTimestamp && !!mapping.buyPrice && !!mapping.sellPrice;
  const useInference = !sideIsMapped && hasInferenceFields;

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
          const num = parseNumericValue(value);
          if (num === null) {
            const isRequired = useInference
              ? REQUIRED_FIELDS_INFERRED.includes(field.key)
              : field.required;
            if (isRequired) errors.push(`${field.label}: valor numérico inválido "${value}"`);
            value = null;
          } else {
            value = num;
          }
          break;
        }
        case 'datetime': {
          const parsed = parseDateTime(String(value), dateFormat);
          if (!parsed) {
            const isRequired = useInference
              ? REQUIRED_FIELDS_INFERRED.includes(field.key)
              : field.required;
            if (isRequired) errors.push(`${field.label}: data/hora inválida "${value}"`);
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

    // Validar required (ajustado para inferência)
    const isFieldRequired = useInference
      ? REQUIRED_FIELDS_INFERRED.includes(field.key)
      : field.required;
    if (isFieldRequired && (value === null || value === undefined || value === '')) {
      errors.push(`${field.label}: campo obrigatório não mapeado ou vazio`);
    }

    if (value !== null && value !== undefined && value !== '') {
      trade[field.key] = value;
    }
  }

  // ================================================
  // MODO INFERÊNCIA
  // ================================================
  if (useInference && trade.buyPrice != null && trade.sellPrice != null) {
    const inferred = inferDirection(
      trade.buyPrice,
      trade.sellPrice,
      trade.buyTimestamp,
      trade.sellTimestamp
    );

    if (inferred.side) {
      trade.side = inferred.side;
      trade.entry = inferred.entry;
      trade.exit = inferred.exit;
      trade.entryTime = inferred.entryTime;
      trade.exitTime = inferred.exitTime;
      trade.directionInferred = true;
    } else {
      errors.push('Impossível inferir direção: timestamps de compra e venda são iguais ou inválidos');
    }

    delete trade.buyPrice;
    delete trade.sellPrice;
    delete trade.buyTimestamp;
    delete trade.sellTimestamp;
  }
  // ================================================
  // MODO PADRÃO
  // ================================================
  else if (!useInference) {
    // Normalizar side
    if (trade.side) {
      const s = String(trade.side).toUpperCase();
      if (['LONG', 'BUY', 'COMPRA', 'C'].includes(s)) trade.side = 'LONG';
      else if (['SHORT', 'SELL', 'VENDA', 'V'].includes(s)) trade.side = 'SHORT';
      else errors.push(`Lado: valor não reconhecido "${trade.side}"`);
    }

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
      if (trade.side === 'LONG') trade.entry = trade.entry ?? trade.buyPrice;
      else trade.exit = trade.exit ?? trade.buyPrice;
      delete trade.buyPrice;
    } else if (trade.sellPrice != null && trade.buyPrice == null) {
      if (trade.side === 'LONG') trade.exit = trade.exit ?? trade.sellPrice;
      else trade.entry = trade.entry ?? trade.sellPrice;
      delete trade.sellPrice;
    }
  }

  // Limpar campos de inferência residuais
  delete trade.buyTimestamp;
  delete trade.sellTimestamp;

  // Validar entry/exit
  if (trade.entry == null) errors.push('Preço de entrada não resolvido (mapeie Preço Compra/Venda ou Entrada)');
  if (trade.exit == null) errors.push('Preço de saída não resolvido (mapeie Preço Compra/Venda ou Saída)');

  // Validar side
  if (!trade.side && !useInference) {
    // Já reportado como obrigatório
  } else if (!trade.side && useInference) {
    errors.push('Lado não determinado — verifique os timestamps de compra e venda');
  }

  // Validar entryTime
  if (!trade.entryTime) {
    errors.push('Data/hora de abertura não resolvida');
  }

  // Normalizar ticker
  if (trade.ticker) {
    trade.ticker = trade.ticker.toUpperCase().trim();
  }

  // Aplicar defaults para campos não em SYSTEM_FIELDS
  for (const [key, val] of Object.entries(defaults)) {
    if (trade[key] === undefined && val != null) {
      trade[key] = val;
    }
  }

  if (errors.length > 0) {
    return { trade: Object.keys(trade).length > 0 ? trade : null, errors };
  }

  return { trade, errors: [] };
};

// ============================================
// BULK MAPPING
// ============================================

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
 * stopLoss é OPCIONAL.
 */
export const getMissingFields = (trade) => {
  const missing = [];
  if (!trade.emotionEntry) missing.push('emotionEntry');
  if (!trade.emotionExit) missing.push('emotionExit');
  if (!trade.setup) missing.push('setup');
  return missing;
};
