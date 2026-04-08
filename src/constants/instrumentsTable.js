// ============================================
// INSTRUMENTS TABLE — Catálogo curado de futuros
// ============================================
// Tabela de referência para AI Approach Plan e calculateAttackPlan instrument-aware.
// Volume baixo, mudança trimestral → hardcoded em código (não em masterData).
// Revisão trimestral recomendada para ATR.
//
// Ref: issue #52 Fase 1.5, Temp/instruments-table-prop-firms.md v1.0
// Fonte ATR: estimativas baseadas em dados dos últimos 12 meses
// Fonte Session Profile: AM Trades framework — dados estatísticos de sessões CME

// ============================================
// SESSION PROFILES — distribuição estatística
// ============================================

export const SESSION_PROFILES = {
  asia: {
    name: 'Ásia',
    rangePct: 0.17,
    directionalPct: 0.58,
    bodyRangePct: 0.40,
    hours: '18:00-01:00 EST'
  },
  london: {
    name: 'London',
    rangePct: 0.23,
    directionalPct: 0.62,
    bodyRangePct: 0.55,
    hours: '01:00-08:00 EST'
  },
  ny: {
    name: 'New York',
    rangePct: 0.60,
    directionalPct: 0.86,
    bodyRangePct: 0.65,
    hours: '08:00-close EST'
  }
};

// ============================================
// DAILY PROFILES FRAMEWORK — padrões operacionais
// ============================================
// Usados pela IA (Fase 2.5) como framework operacional no plano de ataque.

export const DAILY_PROFILES = {
  ASIA_REVERSAL: {
    id: 'ASIA_REVERSAL',
    name: '18:00 Reversal',
    description: 'Ásia faz high/low intraday, London expande, NY continua na direção de London',
    action: 'NY é continuação. Entrar a favor na primeira retração. Não esperar reteste do extremo de Ásia',
    conservative: true,
    aggressive: true
  },
  LONDON_REVERSAL: {
    id: 'LONDON_REVERSAL',
    name: '01:00 Reversal',
    description: 'Ásia consolida ou faz run raso contra o bias. London penetra no range de Ásia e reverte',
    action: 'Profile ideal. London definiu o high/low do dia. NY tem expectativa direcional definida',
    conservative: true,
    aggressive: true
  },
  NY_REVERSAL: {
    id: 'NY_REVERSAL',
    name: '08:00 Reversal',
    description: 'Nem Ásia nem London estabelecem reversão clara. NY forma a reversão antes de expandir',
    action: 'Esperar NY reverter antes de entrar. Não antecipar. Exigir confirmação do mercado',
    conservative: false, // muito arriscado para conservador
    aggressive: true
  },
  INVALIDATION: {
    id: 'INVALIDATION',
    name: 'Invalidação',
    description: 'Ásia + London combinadas já produziram range igual ou maior que o range diário esperado',
    action: 'Não operar. Independente do bias ou setup. Dia perdido é melhor que conta perdida',
    conservative: false,
    aggressive: false
  }
};

// ============================================
// CONSTANTES DE STOP NATURAL
// ============================================
// Stop natural em pontos para um setup viável no instrumento.
// Fórmula: max(ATR × STOP_PERCENT_OF_ATR, minStopPoints da tabela).
// Razão: ATR escala com volatilidade real, minStop garante chão para casos de baixa volatilidade.

export const STOP_PERCENT_OF_ATR = 0.05; // 5% do ATR diário

// ============================================
// TABELA DE INSTRUMENTOS
// ============================================
// Cada entrada representa o instrumento "full size".
// Micro variants (quando existem) compartilham ATR e minStopPoints,
// diferindo apenas em pointValue e tickValue.

export const INSTRUMENTS_TABLE = [
  // ==================== EQUITY INDEX ====================
  {
    symbol: 'ES', name: 'S&P 500 E-mini', exchange: 'CME', type: 'equity_index',
    tickSize: 0.25, tickValue: 12.50, pointValue: 50.00,
    micro: 'MES', microPointValue: 5.00, microTickValue: 1.25,
    avgDailyRange: 55,
    minStopPoints: 4, // ~$200 full / ~$20 micro
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: 'NQ', name: 'Nasdaq 100 E-mini', exchange: 'CME', type: 'equity_index',
    tickSize: 0.25, tickValue: 5.00, pointValue: 20.00,
    micro: 'MNQ', microPointValue: 2.00, microTickValue: 0.50,
    avgDailyRange: 400,
    minStopPoints: 20, // ~$400 full / ~$40 micro
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: 'YM', name: 'Dow Jones E-mini', exchange: 'CBOT', type: 'equity_index',
    tickSize: 1.00, tickValue: 5.00, pointValue: 5.00,
    micro: 'MYM', microPointValue: 0.50, microTickValue: 0.50,
    avgDailyRange: 420,
    minStopPoints: 25, // ~$125 full / ~$12.50 micro
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: 'RTY', name: 'Russell 2000 E-mini', exchange: 'CME', type: 'equity_index',
    tickSize: 0.10, tickValue: 5.00, pointValue: 50.00,
    micro: 'M2K', microPointValue: 5.00, microTickValue: 0.50,
    avgDailyRange: 30,
    minStopPoints: 3, // ~$150 full / ~$15 micro
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },

  // ==================== ENERGY ====================
  {
    symbol: 'CL', name: 'Crude Oil WTI', exchange: 'NYMEX', type: 'energy',
    tickSize: 0.01, tickValue: 10.00, pointValue: 1000.00,
    micro: 'MCL', microPointValue: 100.00, microTickValue: 1.00,
    avgDailyRange: 2.5,
    minStopPoints: 0.20, // ~$200 full / ~$20 micro
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: 'NG', name: 'Natural Gas', exchange: 'NYMEX', type: 'energy',
    tickSize: 0.001, tickValue: 10.00, pointValue: 10000.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 0.20,
    minStopPoints: 0.020, // ~$200
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },

  // ==================== METALS (Apex suspended Apr/2026) ====================
  {
    symbol: 'GC', name: 'Gold', exchange: 'COMEX', type: 'metals',
    tickSize: 0.10, tickValue: 10.00, pointValue: 100.00,
    micro: 'MGC', microPointValue: 10.00, microTickValue: 1.00,
    avgDailyRange: 40,
    minStopPoints: 3, // ~$300 full / ~$30 micro
    availability: { apex: false, mff: true, lucid: true, tradeify: true },
    note: 'Suspenso na Apex desde Abr/2026 por volatilidade extrema'
  },
  {
    symbol: 'SI', name: 'Silver', exchange: 'COMEX', type: 'metals',
    tickSize: 0.005, tickValue: 25.00, pointValue: 5000.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 0.60,
    minStopPoints: 0.05, // ~$250
    availability: { apex: false, mff: true, lucid: true, tradeify: true },
    note: 'Suspenso na Apex desde Abr/2026'
  },
  {
    symbol: 'HG', name: 'Copper', exchange: 'COMEX', type: 'metals',
    tickSize: 0.0005, tickValue: 12.50, pointValue: 25000.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 0.08,
    minStopPoints: 0.005, // ~$125
    availability: { apex: false, mff: false, lucid: true, tradeify: true },
    note: 'Suspenso na Apex desde Abr/2026'
  },

  // ==================== CURRENCY (FX) ====================
  {
    symbol: '6E', name: 'Euro FX', exchange: 'CME', type: 'currency',
    tickSize: 0.00005, tickValue: 6.25, pointValue: 125000.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 0.0090,
    minStopPoints: 0.0008, // ~$100
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: '6B', name: 'British Pound', exchange: 'CME', type: 'currency',
    tickSize: 0.0001, tickValue: 6.25, pointValue: 62500.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 0.0110,
    minStopPoints: 0.0010, // ~$62.50
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: '6J', name: 'Japanese Yen', exchange: 'CME', type: 'currency',
    tickSize: 0.0000005, tickValue: 6.25, pointValue: 12500000.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 0.00070,
    minStopPoints: 0.000060, // ~$750
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: '6A', name: 'Australian Dollar', exchange: 'CME', type: 'currency',
    tickSize: 0.0001, tickValue: 10.00, pointValue: 100000.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 0.0070,
    minStopPoints: 0.0006, // ~$60
    availability: { apex: true, mff: false, lucid: true, tradeify: false }
  },

  // ==================== AGRICULTURE ====================
  {
    symbol: 'ZC', name: 'Corn', exchange: 'CBOT', type: 'agriculture',
    tickSize: 0.25, tickValue: 12.50, pointValue: 50.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 10,
    minStopPoints: 1, // ~$50
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },
  {
    symbol: 'ZW', name: 'Wheat', exchange: 'CBOT', type: 'agriculture',
    tickSize: 0.25, tickValue: 12.50, pointValue: 50.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 15,
    minStopPoints: 1.5, // ~$75
    availability: { apex: true, mff: true, lucid: false, tradeify: true }
  },
  {
    symbol: 'ZS', name: 'Soybeans', exchange: 'CBOT', type: 'agriculture',
    tickSize: 0.25, tickValue: 12.50, pointValue: 50.00,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 18,
    minStopPoints: 2, // ~$100
    availability: { apex: true, mff: true, lucid: true, tradeify: true }
  },

  // ==================== CRYPTO ====================
  {
    symbol: 'MBT', name: 'Micro Bitcoin', exchange: 'CME', type: 'crypto',
    tickSize: 5.00, tickValue: 0.50, pointValue: 0.10,
    micro: null, microPointValue: null, microTickValue: null,
    avgDailyRange: 4000,
    minStopPoints: 200, // ~$20
    availability: { apex: true, mff: false, lucid: false, tradeify: true }
  }
];

// ============================================
// HELPERS
// ============================================

/**
 * Busca instrumento por símbolo. Suporta full size E micro variants.
 * Para micro, retorna o objeto pai com pointValue/tickValue substituídos.
 *
 * @param {string} symbol - ex: 'NQ', 'MNQ', 'ES', 'MES'
 * @returns {Object|null} instrumento ou null se não encontrado
 */
export function getInstrument(symbol) {
  const upper = (symbol || '').toUpperCase();

  // Busca direta (full size)
  const direct = INSTRUMENTS_TABLE.find(i => i.symbol === upper);
  if (direct) {
    return {
      ...direct,
      isMicro: false,
      parentSymbol: null
    };
  }

  // Busca como micro
  const parent = INSTRUMENTS_TABLE.find(i => i.micro === upper);
  if (parent) {
    return {
      ...parent,
      symbol: parent.micro,
      name: `Micro ${parent.name.replace('E-mini ', '').replace(' E-mini', '')}`,
      pointValue: parent.microPointValue,
      tickValue: parent.microTickValue,
      isMicro: true,
      parentSymbol: parent.symbol
    };
  }

  return null;
}

/**
 * Calcula range esperado de uma sessão para um instrumento.
 *
 * @param {string} symbol
 * @param {string} session - 'asia' | 'london' | 'ny'
 * @returns {{ rangePoints, rangeUSD, bodyRangePoints, directionalPct, hours, sessionName }|null}
 */
export function getSessionRange(symbol, session) {
  const instrument = getInstrument(symbol);
  if (!instrument || !SESSION_PROFILES[session]) return null;

  const profile = SESSION_PROFILES[session];
  const rangePoints = round(instrument.avgDailyRange * profile.rangePct, 4);
  const rangeUSD = round(rangePoints * instrument.pointValue, 2);
  const bodyRangePoints = round(rangePoints * profile.bodyRangePct, 4);

  return {
    rangePoints,
    rangeUSD,
    bodyRangePoints,
    directionalPct: profile.directionalPct,
    hours: profile.hours,
    sessionName: profile.name
  };
}

/**
 * Verifica se um instrumento é permitido em uma mesa proprietária.
 *
 * @param {string} symbol
 * @param {string} firm - 'apex' | 'mff' | 'lucid' | 'tradeify'
 * @returns {boolean}
 */
export function isInstrumentAllowed(symbol, firm) {
  const instrument = getInstrument(symbol);
  if (!instrument) return false;
  const firmKey = (firm || '').toLowerCase();
  return instrument.availability[firmKey] === true;
}

/**
 * Retorna lista de símbolos restritos (NÃO permitidos) em uma mesa.
 * Usado para compatibilidade com UI atual que lê `template.restrictedInstruments`.
 *
 * @param {string} firm - 'apex' | 'mff' | 'lucid' | 'tradeify' (case insensitive)
 * @returns {string[]} símbolos restritos (full + micro). Inclui ambos os símbolos quando o full está restrito.
 */
export function getRestrictedInstrumentsForFirm(firm) {
  const firmKey = (firm || '').toLowerCase();
  const restricted = [];
  for (const inst of INSTRUMENTS_TABLE) {
    if (inst.availability[firmKey] === false) {
      restricted.push(inst.symbol);
      if (inst.micro) restricted.push(inst.micro);
    }
  }
  return restricted;
}

/**
 * Retorna lista de instrumentos disponíveis em uma mesa.
 * Inclui full e micro variants quando ambos são permitidos.
 *
 * @param {string} firm
 * @returns {Array<{ symbol, name, type, isMicro, parentSymbol }>}
 */
export function getAllowedInstrumentsForFirm(firm) {
  const firmKey = (firm || '').toLowerCase();
  const result = [];
  for (const inst of INSTRUMENTS_TABLE) {
    if (inst.availability[firmKey] !== true) continue;
    // Full size
    result.push({
      symbol: inst.symbol,
      name: inst.name,
      type: inst.type,
      isMicro: false,
      parentSymbol: null,
      pointValue: inst.pointValue,
      avgDailyRange: inst.avgDailyRange
    });
    // Micro variant (se existir)
    if (inst.micro) {
      result.push({
        symbol: inst.micro,
        name: `Micro ${inst.name.replace('E-mini ', '').replace(' E-mini', '')}`,
        type: inst.type,
        isMicro: true,
        parentSymbol: inst.symbol,
        pointValue: inst.microPointValue,
        avgDailyRange: inst.avgDailyRange
      });
    }
  }
  return result;
}

/**
 * Sugere o micro variant de um instrumento full size, se existir.
 * Usado quando o stop natural do full excede o orçamento da mesa.
 *
 * @param {string} symbol - símbolo full size
 * @returns {Object|null} micro variant ou null se não há micro disponível
 */
export function suggestMicroAlternative(symbol) {
  const inst = getInstrument(symbol);
  if (!inst || inst.isMicro || !inst.micro) return null;
  return getInstrument(inst.micro);
}

/**
 * Calcula o stop natural recomendado em pontos para um instrumento.
 * Fórmula: max(ATR × STOP_PERCENT_OF_ATR, minStopPoints).
 *
 * @param {Object} instrument - retorno de getInstrument
 * @returns {{ stopPoints, stopUSD, source }}
 *   source: 'atr' (5% do ATR foi maior que minStop) ou 'min' (minStop prevaleceu)
 */
export function getRecommendedStop(instrument) {
  if (!instrument) return null;
  const atrBased = instrument.avgDailyRange * STOP_PERCENT_OF_ATR;
  const stopPoints = Math.max(atrBased, instrument.minStopPoints);
  const source = atrBased >= instrument.minStopPoints ? 'atr' : 'min';
  return {
    stopPoints: round(stopPoints, 4),
    stopUSD: round(stopPoints * instrument.pointValue, 2),
    source
  };
}

// --- internal helper ---
function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
