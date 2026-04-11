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
  TRAILING_WITH_LOCK: 'TRAILING_WITH_LOCK',
  TRAILING_TO_STATIC: 'TRAILING_TO_STATIC'
};

export const DRAWDOWN_TYPE_LABELS = {
  TRAILING_INTRADAY: 'Trailing Intraday',
  TRAILING_EOD: 'Trailing EOD',
  STATIC: 'Estático',
  TRAILING_WITH_LOCK: 'Trailing com Lock',
  TRAILING_TO_STATIC: 'Trailing → Static (freeze)'
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

// --- Attack plan profiles (5 perfis) ---
// Ref: Temp/attack-plan-deterministic-table.md v2.0
//
// Lógica invertida: quanto mais arrisca, MENOS opera. Disciplina forçada pelo sizing.
// RO = percentual fixo do drawdown. RR fixo 1:2.
//
// Probabilidades de aprovação (Apex EOD 25K, 21 dias úteis, RR 1:2, 200k simulações):
//   CONS_A: WR50% → 81.6% aprovação, bust 0.7%
//   CONS_B: WR50% → 91.2% aprovação, bust 3.4%   ← RECOMENDADO
//   CONS_C: WR50% → 89.5% aprovação, bust 8.8%
//   AGRES_A: WR50% → 80.7% aprovação, bust 13.2%
//   AGRES_B: WR50% → 83.0% aprovação, bust 13.1%
export const ATTACK_PLAN_PROFILES = {
  CONS_A: 'CONS_A',
  CONS_B: 'CONS_B',
  CONS_C: 'CONS_C',
  AGRES_A: 'AGRES_A',
  AGRES_B: 'AGRES_B'
};

export const ATTACK_PLAN_PROFILE_LABELS = {
  CONS_A: 'Conservador Leve',
  CONS_B: 'Conservador Sweet Spot',
  CONS_C: 'Conservador Firme',
  AGRES_A: 'Agressivo',
  AGRES_B: 'Agressivo Máximo'
};

export const ATTACK_PROFILES = {
  CONS_A: {
    code: 'CONS_A',
    name: 'Conservador Leve',
    family: 'conservative',
    roPct: 0.10,             // 10% do drawdown
    rr: 2,
    maxTradesPerDay: 2,
    description: 'Scalp com margem. Máxima resiliência.',
    idealFor: 'Stage 1-2, emocional baixo, sem histórico consistente',
    minWR: 0.40
  },
  CONS_B: {
    code: 'CONS_B',
    name: 'Conservador Sweet Spot',
    family: 'conservative',
    roPct: 0.15,             // 15% do drawdown
    rr: 2,
    maxTradesPerDay: 2,
    description: 'Day trade clássico. Melhor relação aprovação/bust/tempo.',
    idealFor: 'Stage 2-3, WR ≥ 45%',
    minWR: 0.45,
    recommended: true
  },
  CONS_C: {
    code: 'CONS_C',
    name: 'Conservador Firme',
    family: 'conservative',
    roPct: 0.20,             // 20% do drawdown
    rr: 2,
    maxTradesPerDay: 2,
    description: 'Swing intraday. Mais rápido mas exige disciplina.',
    idealFor: 'Stage 3+, WR ≥ 50%',
    minWR: 0.50
  },
  AGRES_A: {
    code: 'AGRES_A',
    name: 'Agressivo',
    family: 'aggressive',
    roPct: 0.25,             // 25% do drawdown
    rr: 2,
    maxTradesPerDay: 1,
    description: 'Swing com convicção. 1 trade/dia — o melhor setup.',
    idealFor: 'Stage 3-4, WR ≥ 55%, disciplina comprovada',
    minWR: 0.55
  },
  AGRES_B: {
    code: 'AGRES_B',
    name: 'Agressivo Máximo',
    family: 'aggressive',
    roPct: 0.30,             // 30% do drawdown
    rr: 2,
    maxTradesPerDay: 1,
    description: 'Trade de convicção máxima. Sem margem para erro.',
    idealFor: 'Stage 4+, WR ≥ 55%, controle emocional alto',
    minWR: 0.55
  }
};

export const DEFAULT_ATTACK_PROFILE = 'CONS_B';

// --- Viabilidade do stop por tipo de instrumento ---
// Ref: Temp/attack-plan-deterministic-table.md §3
// Stop em pontos abaixo desses valores é "ruído" no instrumento — sugerir micro variant.
export const MIN_VIABLE_STOP = {
  equity_index: 15,    // pontos — abaixo disso é ruído no MNQ/MES
  energy: 0.10,        // pontos — CL/MCL
  metals: 3,           // pontos — GC/MGC
  currency: 0.0003,    // pontos — 6E/6B/6J
  agriculture: 3,      // pontos — ZC/ZW/ZS
  crypto: 500          // pontos — MBT
};

// Stop > MAX_STOP_NY_PCT do range NY = inviável (vela única consome o stop).
// Stop < MIN_STOP_NY_PCT do range NY = ruído puro.
export const MAX_STOP_NY_PCT = 75;
export const MIN_STOP_NY_PCT = 5;

// Stop < NY_MIN_VIABLE_STOP_PCT do range NY = não viável NA SESSÃO NY,
// mas viável em sessões mais calmas (Ásia/London).
// Threshold 12.5% genérico — abaixo disso, NY consome o stop por volatilidade.
// Calibração com ATR real (v2 09/04/2026): NQ NY range = 549 × 0.60 = 329.4 pts,
// 12.5% = ~41 pts. Stops menores que 41 pts em NQ → operar Ásia/London.
export const NY_MIN_VIABLE_STOP_PCT = 12.5;

// Fração do ATR diário consumido pela sessão NY (usado para stopNyPct).
// Ref: SESSION_PROFILES.ny.rangePct = 0.60.
export const NY_RANGE_FRACTION = 0.60;

// WR padrão quando o trader não tem indicadores nem 4D.
export const DEFAULT_ASSUMED_WR = 0.50;

// Breakeven com RR 1:2. Abaixo disso a EV é negativa — plano matematicamente inviável.
export const RR2_BREAKEVEN_WR = 1 / 3;

/**
 * Normaliza chave de perfil — aceita os 5 novos códigos E os legados
 * 'conservative'/'aggressive' (mapeados para CONS_B/AGRES_A respectivamente).
 *
 * @param {string|null|undefined} profileKey
 * @returns {string} código de perfil válido (default: CONS_B)
 */
export function normalizeAttackProfile(profileKey) {
  if (!profileKey) return DEFAULT_ATTACK_PROFILE;
  if (ATTACK_PROFILES[profileKey]) return profileKey;
  // Legacy mapping (Fase 1.5 → 5 profiles)
  if (profileKey === 'conservative') return 'CONS_B';
  if (profileKey === 'aggressive') return 'AGRES_A';
  return DEFAULT_ATTACK_PROFILE;
}

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
