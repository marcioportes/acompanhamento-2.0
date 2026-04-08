// ============================================
// PROP FIRM — CONSTANTES E TEMPLATES DEFAULT
// ============================================
// Catálogo de templates de mesas proprietárias.
// Collection raiz `propFirmTemplates` (INV-15 aprovado).
// Ref: issue #52, DEC-053

// --- Fases da conta prop ---
export const PROP_FIRM_PHASES = {
  EVALUATION: 'EVALUATION',
  SIM_FUNDED: 'SIM_FUNDED',
  LIVE: 'LIVE',
  EXPIRED: 'EXPIRED'
};

export const PROP_FIRM_PHASE_LABELS = {
  EVALUATION: 'Avaliação',
  SIM_FUNDED: 'Simulado Funded',
  LIVE: 'Live',
  EXPIRED: 'Expirada'
};

// --- Tipos de drawdown ---
export const DRAWDOWN_TYPES = {
  TRAILING_INTRADAY: 'TRAILING_INTRADAY',
  TRAILING_EOD: 'TRAILING_EOD',
  STATIC: 'STATIC',
  TRAILING_WITH_LOCK: 'TRAILING_WITH_LOCK'
};

export const DRAWDOWN_TYPE_LABELS = {
  TRAILING_INTRADAY: 'Trailing Intraday',
  TRAILING_EOD: 'Trailing EOD',
  STATIC: 'Estático',
  TRAILING_WITH_LOCK: 'Trailing com Lock'
};

// --- Firmas ---
export const PROP_FIRMS = {
  APEX: 'APEX',
  MFF: 'MFF',
  LUCID: 'LUCID',
  TRADEIFY: 'TRADEIFY',
  CUSTOM: 'CUSTOM'
};

export const PROP_FIRM_LABELS = {
  APEX: 'Apex Trader Funding',
  MFF: 'MyFundedFutures',
  LUCID: 'Lucid Markets',
  TRADEIFY: 'Tradeify',
  CUSTOM: 'Personalizada'
};

// --- Fee model ---
export const FEE_MODELS = {
  ONE_TIME: 'ONE_TIME',
  RECURRING: 'RECURRING'
};

// --- Daily loss action ---
export const DAILY_LOSS_ACTIONS = {
  PAUSE_DAY: 'PAUSE_DAY',
  FAIL_ACCOUNT: 'FAIL_ACCOUNT'
};

// --- Attack plan profiles ---
export const ATTACK_PLAN_PROFILES = {
  CONSERVATIVE: 'conservative',
  AGGRESSIVE: 'aggressive'
};

export const ATTACK_PLAN_PROFILE_LABELS = {
  conservative: 'Conservador',
  aggressive: 'Agressivo'
};

// --- Attack plan data sources ---
export const ATTACK_PLAN_DATA_SOURCES = {
  FULL_4D: '4d_full',
  INDICATORS: 'indicators',
  DEFAULTS: 'defaults'
};

// ============================================
// TEMPLATES DEFAULT POR MESA
// ============================================
// Ref: issue #52 body — comparativo Apex Mar/2026, MFF, Lucid
//
// IMPORTANTE: `restrictedInstruments` é DERIVADO da instrumentsTable via
// `getRestrictedInstrumentsForFirm()`. NÃO duplicar listas hardcoded aqui.
// Os helpers `enrichTemplate()` e `enrichTemplates()` no final deste arquivo
// adicionam o campo dinamicamente quando os templates são consumidos.

import { getRestrictedInstrumentsForFirm } from './instrumentsTable';

const APEX_BASE = {
  firm: PROP_FIRMS.APEX,
  feeModel: FEE_MODELS.ONE_TIME,
  bracketOrderRequired: true,
  newsTrading: true,
  dcaAllowed: false,
  // restrictedInstruments derivado em runtime via enrichTemplate()
  tradingHours: { close: '16:59', timezone: 'America/New_York' },
  phases: ['EVALUATION', 'SIM_FUNDED', 'LIVE'],
  consistency: { evalRule: 0.50, fundedRule: null },
  payout: {
    minAmount: 500,
    minTradingDays: 8,
    qualifyingDays: { count: 5, minProfit: 100, maxProfit: 300 },
    split: 0.90,
    firstTierAmount: 25000,
    firstTierSplit: 1.00
  }
};

const MFF_BASE = {
  firm: PROP_FIRMS.MFF,
  feeModel: FEE_MODELS.RECURRING,
  bracketOrderRequired: false,
  newsTrading: false,
  dcaAllowed: true,
  restrictedInstruments: [],
  tradingHours: { close: '16:10', timezone: 'America/New_York' },
  phases: ['EVALUATION', 'SIM_FUNDED', 'LIVE'],
  payout: {
    minAmount: 250,
    minTradingDays: 5,
    qualifyingDays: { count: null, minProfit: null, maxProfit: null },
    split: 0.80,
    firstTierAmount: null,
    firstTierSplit: null
  }
};

const LUCID_BASE = {
  firm: PROP_FIRMS.LUCID,
  feeModel: FEE_MODELS.RECURRING,
  bracketOrderRequired: false,
  newsTrading: true,
  dcaAllowed: true,
  restrictedInstruments: [],
  tradingHours: { close: '16:45', timezone: 'America/New_York' },
  phases: ['EVALUATION', 'SIM_FUNDED', 'LIVE'],
  payout: {
    minAmount: 500,
    minTradingDays: 5,
    qualifyingDays: { count: null, minProfit: null, maxProfit: null },
    split: 0.90,
    firstTierAmount: null,
    firstTierSplit: null
  }
};

const TRADEIFY_BASE = {
  firm: PROP_FIRMS.TRADEIFY,
  feeModel: FEE_MODELS.RECURRING,
  bracketOrderRequired: false,
  newsTrading: true,
  dcaAllowed: true,
  restrictedInstruments: [],
  tradingHours: { close: '16:10', timezone: 'America/New_York' },
  phases: ['EVALUATION', 'SIM_FUNDED', 'LIVE'],
  consistency: { evalRule: 0.40, fundedRule: null },
  payout: {
    minAmount: 250,
    minTradingDays: 3,
    qualifyingDays: { count: null, minProfit: null, maxProfit: null },
    split: 0.80,
    firstTierAmount: null,
    firstTierSplit: null
  }
};

// --- Templates concretos ---

export const DEFAULT_TEMPLATES = [
  // ==================== APEX EOD ====================
  {
    id: 'apex-eod-25k',
    name: 'Apex EOD 25K',
    ...APEX_BASE,
    accountSize: 25000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 1000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: 500,
    dailyLossType: 'FIXED',
    dailyLossAction: DAILY_LOSS_ACTIONS.PAUSE_DAY,
    profitTarget: 1500,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 4, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-eod-50k',
    name: 'Apex EOD 50K',
    ...APEX_BASE,
    accountSize: 50000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 2500,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: 1000,
    dailyLossType: 'FIXED',
    dailyLossAction: DAILY_LOSS_ACTIONS.PAUSE_DAY,
    profitTarget: 3000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 10, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-eod-100k',
    name: 'Apex EOD 100K',
    ...APEX_BASE,
    accountSize: 100000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 3000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: 1500,
    dailyLossType: 'FIXED',
    dailyLossAction: DAILY_LOSS_ACTIONS.PAUSE_DAY,
    profitTarget: 6000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 14, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-eod-150k',
    name: 'Apex EOD 150K',
    ...APEX_BASE,
    accountSize: 150000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 5000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: 2250,
    dailyLossType: 'FIXED',
    dailyLossAction: DAILY_LOSS_ACTIONS.PAUSE_DAY,
    profitTarget: 9000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 17, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-eod-250k',
    name: 'Apex EOD 250K',
    ...APEX_BASE,
    accountSize: 250000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 6500,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: 3000,
    dailyLossType: 'FIXED',
    dailyLossAction: DAILY_LOSS_ACTIONS.PAUSE_DAY,
    profitTarget: 15000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 27, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-eod-300k',
    name: 'Apex EOD 300K',
    ...APEX_BASE,
    accountSize: 300000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 7500,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: 3500,
    dailyLossType: 'FIXED',
    dailyLossAction: DAILY_LOSS_ACTIONS.PAUSE_DAY,
    profitTarget: 20000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 35, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },

  // ==================== APEX INTRADAY ====================
  {
    id: 'apex-intraday-25k',
    name: 'Apex Intraday 25K',
    ...APEX_BASE,
    accountSize: 25000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_INTRADAY,
      maxAmount: 1000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 1500,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 4, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-intraday-50k',
    name: 'Apex Intraday 50K',
    ...APEX_BASE,
    accountSize: 50000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_INTRADAY,
      maxAmount: 2500,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 3000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 10, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-intraday-100k',
    name: 'Apex Intraday 100K',
    ...APEX_BASE,
    accountSize: 100000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_INTRADAY,
      maxAmount: 3000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 6000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 14, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-intraday-150k',
    name: 'Apex Intraday 150K',
    ...APEX_BASE,
    accountSize: 150000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_INTRADAY,
      maxAmount: 5000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 9000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 17, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-intraday-250k',
    name: 'Apex Intraday 250K',
    ...APEX_BASE,
    accountSize: 250000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_INTRADAY,
      maxAmount: 6500,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 15000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 27, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },
  {
    id: 'apex-intraday-300k',
    name: 'Apex Intraday 300K',
    ...APEX_BASE,
    accountSize: 300000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_INTRADAY,
      maxAmount: 7500,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 20000,
    evalTimeLimit: 30,
    evalMinTradingDays: 0,
    contracts: { max: 35, scalingRule: '50_PERCENT_UNTIL_SAFETY_NET', scalingThreshold: null }
  },

  // ==================== MFF ====================
  {
    id: 'mff-starter-50k',
    name: 'MFF Starter 50K',
    ...MFF_BASE,
    accountSize: 50000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 2500,
      lockAt: null,
      lockFormula: 'BALANCE + 100'
    },
    dailyLossLimit: 1200,
    dailyLossType: 'FIXED',
    dailyLossAction: DAILY_LOSS_ACTIONS.FAIL_ACCOUNT,
    profitTarget: 3000,
    evalTimeLimit: null,
    evalMinTradingDays: 5,
    consistency: { evalRule: 0.50, fundedRule: 0.40 },
    contracts: { max: 10, scalingRule: null, scalingThreshold: null }
  },
  {
    id: 'mff-core-50k',
    name: 'MFF Core 50K',
    ...MFF_BASE,
    accountSize: 50000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 2000,
      lockAt: null,
      lockFormula: 'BALANCE + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 3000,
    evalTimeLimit: null,
    evalMinTradingDays: 5,
    consistency: { evalRule: 0.50, fundedRule: 0.40 },
    contracts: { max: 10, scalingRule: null, scalingThreshold: null }
  },
  {
    id: 'mff-core-100k',
    name: 'MFF Core 100K',
    ...MFF_BASE,
    accountSize: 100000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 3000,
      lockAt: null,
      lockFormula: 'BALANCE + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 6000,
    evalTimeLimit: null,
    evalMinTradingDays: 5,
    consistency: { evalRule: 0.50, fundedRule: 0.40 },
    contracts: { max: 14, scalingRule: null, scalingThreshold: null }
  },
  {
    id: 'mff-scale-150k',
    name: 'MFF Scale 150K',
    ...MFF_BASE,
    accountSize: 150000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 5000,
      lockAt: null,
      lockFormula: 'BALANCE + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 9000,
    evalTimeLimit: null,
    evalMinTradingDays: 5,
    consistency: { evalRule: 0.50, fundedRule: 0.40 },
    contracts: { max: 17, scalingRule: 'DYNAMIC_BY_PROFIT', scalingThreshold: null }
  },

  // ==================== LUCID ====================
  {
    id: 'lucid-pro-50k',
    name: 'Lucid Pro 50K',
    ...LUCID_BASE,
    accountSize: 50000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 2000,
      lockAt: null,
      lockFormula: null
    },
    dailyLossLimit: 500,
    dailyLossType: 'PERCENT_PROFIT',
    dailyLossAction: DAILY_LOSS_ACTIONS.FAIL_ACCOUNT,
    profitTarget: 2500,
    evalTimeLimit: null,
    evalMinTradingDays: 5,
    consistency: { evalRule: 0.50, fundedRule: 0.35 },
    contracts: { max: 10, scalingRule: 'DYNAMIC_BY_PROFIT', scalingThreshold: null }
  },
  {
    id: 'lucid-flex-50k',
    name: 'Lucid Flex 50K',
    ...LUCID_BASE,
    accountSize: 50000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 2000,
      lockAt: null,
      lockFormula: null
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 2500,
    evalTimeLimit: null,
    evalMinTradingDays: 8,
    consistency: { evalRule: null, fundedRule: null },
    contracts: { max: 10, scalingRule: 'DYNAMIC_BY_PROFIT', scalingThreshold: null }
  },
  {
    id: 'lucid-pro-100k',
    name: 'Lucid Pro 100K',
    ...LUCID_BASE,
    accountSize: 100000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 3000,
      lockAt: null,
      lockFormula: null
    },
    dailyLossLimit: 750,
    dailyLossType: 'PERCENT_PROFIT',
    dailyLossAction: DAILY_LOSS_ACTIONS.FAIL_ACCOUNT,
    profitTarget: 5000,
    evalTimeLimit: null,
    evalMinTradingDays: 5,
    consistency: { evalRule: 0.50, fundedRule: 0.35 },
    contracts: { max: 14, scalingRule: 'DYNAMIC_BY_PROFIT', scalingThreshold: null }
  },

  // ==================== TRADEIFY SELECT ====================
  {
    id: 'tradeify-select-25k',
    name: 'Tradeify Select 25K',
    ...TRADEIFY_BASE,
    accountSize: 25000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 1000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 1500,
    evalTimeLimit: null,
    evalMinTradingDays: 3,
    contracts: { max: 2, scalingRule: null, scalingThreshold: null }
  },
  {
    id: 'tradeify-select-50k',
    name: 'Tradeify Select 50K',
    ...TRADEIFY_BASE,
    accountSize: 50000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 2000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 3000,
    evalTimeLimit: null,
    evalMinTradingDays: 3,
    contracts: { max: 4, scalingRule: null, scalingThreshold: null }
  },
  {
    id: 'tradeify-select-100k',
    name: 'Tradeify Select 100K',
    ...TRADEIFY_BASE,
    accountSize: 100000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 3000,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 6000,
    evalTimeLimit: null,
    evalMinTradingDays: 3,
    contracts: { max: 8, scalingRule: null, scalingThreshold: null }
  },
  {
    id: 'tradeify-select-150k',
    name: 'Tradeify Select 150K',
    ...TRADEIFY_BASE,
    accountSize: 150000,
    drawdown: {
      type: DRAWDOWN_TYPES.TRAILING_EOD,
      maxAmount: 4500,
      lockAt: null,
      lockFormula: 'BALANCE + DD + 100'
    },
    dailyLossLimit: null,
    dailyLossType: null,
    dailyLossAction: null,
    profitTarget: 9000,
    evalTimeLimit: null,
    evalMinTradingDays: 3,
    contracts: { max: 12, scalingRule: null, scalingThreshold: null }
  }
];

// ============================================
// ENRICH — adicionar restrictedInstruments derivado da instrumentsTable
// ============================================
// Os templates são definidos sem `restrictedInstruments` (fonte de verdade
// é instrumentsTable.availability). Antes de consumir, enrichTemplate adiciona
// o campo derivado para manter compatibilidade com UI atual.

/**
 * Adiciona `restrictedInstruments` derivado a um template.
 * Se o template já tem o campo (ex: custom criado pelo mentor), preserva.
 *
 * @param {Object} template
 * @returns {Object} template enriquecido
 */
export const enrichTemplate = (template) => {
  if (!template) return template;
  if (Array.isArray(template.restrictedInstruments)) return template;
  const firmKey = (template.firm ?? '').toLowerCase();
  return {
    ...template,
    restrictedInstruments: getRestrictedInstrumentsForFirm(firmKey)
  };
};

/**
 * Aplica enrichTemplate a um array de templates.
 */
export const enrichTemplates = (templates) => {
  if (!Array.isArray(templates)) return templates;
  return templates.map(enrichTemplate);
};

/**
 * DEFAULT_TEMPLATES já enriquecido com restrictedInstruments derivado.
 * Use este nas UIs (fallback do usePropFirmTemplates) para garantir
 * que o campo restrictedInstruments esteja sempre presente.
 */
export const DEFAULT_TEMPLATES_ENRICHED = DEFAULT_TEMPLATES.map(enrichTemplate);

// Agrupar templates por firma para o seletor de UI
// (assume que templates já vêm enriquecidos do hook)
export const getTemplatesByFirm = (templates) => {
  const grouped = {};
  for (const t of templates) {
    if (!grouped[t.firm]) grouped[t.firm] = [];
    grouped[t.firm].push(t);
  }
  return grouped;
};

// Template vazio para criação de mesa custom
export const EMPTY_TEMPLATE = {
  name: '',
  firm: PROP_FIRMS.CUSTOM,
  accountSize: 0,
  drawdown: {
    type: DRAWDOWN_TYPES.TRAILING_EOD,
    maxAmount: 0,
    lockAt: null,
    lockFormula: null
  },
  dailyLossLimit: null,
  dailyLossType: null,
  dailyLossAction: null,
  profitTarget: null,
  evalTimeLimit: null,
  evalMinTradingDays: 0,
  consistency: { evalRule: null, fundedRule: null },
  contracts: { max: 0, scalingRule: null, scalingThreshold: null },
  tradingHours: { close: '16:59', timezone: 'America/New_York' },
  payout: {
    minAmount: 0,
    minTradingDays: 0,
    qualifyingDays: { count: null, minProfit: null, maxProfit: null },
    split: 0.90,
    firstTierAmount: null,
    firstTierSplit: null
  },
  bracketOrderRequired: false,
  newsTrading: true,
  dcaAllowed: true,
  restrictedInstruments: [],
  feeModel: FEE_MODELS.ONE_TIME,
  phases: ['EVALUATION', 'SIM_FUNDED', 'LIVE']
};
