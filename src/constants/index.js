/**
 * Constantes e tipos do sistema Acompanhamento 2.0
 */

// ============================================
// STATUS DO TRADE
// ============================================
export const TRADE_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  REVIEWED: 'REVIEWED',
  IN_REVISION: 'IN_REVISION'
};

export const TRADE_STATUS_LABELS = {
  PENDING_REVIEW: 'Aguardando Revisão',
  REVIEWED: 'Revisado',
  IN_REVISION: 'Em Revisão'
};

export const TRADE_STATUS_COLORS = {
  PENDING_REVIEW: 'yellow',
  REVIEWED: 'green',
  IN_REVISION: 'orange'
};

// ============================================
// RED FLAGS
// ============================================
export const RED_FLAG_TYPES = {
  NO_PLAN: 'TRADE_SEM_PLANO',
  RISK_EXCEEDED: 'RISCO_ACIMA_PERMITIDO',
  RR_BELOW_MINIMUM: 'RR_ABAIXO_MINIMO',
  DAILY_LOSS_EXCEEDED: 'LOSS_DIARIO_EXCEDIDO',
  BLOCKED_EMOTION: 'EMOCIONAL_BLOQUEADO'
};

export const RED_FLAG_LABELS = {
  TRADE_SEM_PLANO: 'Trade sem plano',
  RISCO_ACIMA_PERMITIDO: 'Risco excedido',
  RR_ABAIXO_MINIMO: 'R:R abaixo do mínimo',
  LOSS_DIARIO_EXCEDIDO: 'Loss diário excedido',
  EMOCIONAL_BLOQUEADO: 'Estado emocional bloqueado'
};

// ============================================
// TIPOS DE CONTA
// ============================================
export const ACCOUNT_TYPES = {
  REAL: 'REAL',
  DEMO: 'DEMO',
  PROP: 'PROP'
};

export const ACCOUNT_TYPE_LABELS = {
  REAL: 'Conta Real',
  DEMO: 'Conta Demo',
  PROP: 'Mesa Proprietária'
};

// ============================================
// TIPOS DE MOVIMENTAÇÃO
// ============================================
export const MOVEMENT_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL'
};

export const MOVEMENT_TYPE_LABELS = {
  DEPOSIT: 'Depósito',
  WITHDRAWAL: 'Saque'
};

// ============================================
// TIPOS DE NOTIFICAÇÃO
// ============================================
export const NOTIFICATION_TYPES = {
  NEW_TRADE: 'NEW_TRADE',
  RED_FLAG: 'RED_FLAG',
  FEEDBACK_RECEIVED: 'FEEDBACK_RECEIVED',
  TRADE_REVIEWED: 'TRADE_REVIEWED'
};

// ============================================
// LADOS DO TRADE
// ============================================
export const TRADE_SIDES = {
  LONG: 'LONG',
  SHORT: 'SHORT'
};

// ============================================
// CATEGORIAS DE EMOÇÃO
// ============================================
export const EMOTION_CATEGORIES = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative'
};

// ============================================
// ROLES DE USUÁRIO
// ============================================
export const USER_ROLES = {
  MENTOR: 'mentor',
  STUDENT: 'student'
};

// ============================================
// MENTOR EMAIL (configuração)
// ============================================
export const MENTOR_EMAIL = 'marcio.portes@me.com';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Retorna a role do usuário baseado no email
 */
export const getUserRole = (email) => {
  return email === MENTOR_EMAIL ? USER_ROLES.MENTOR : USER_ROLES.STUDENT;
};

/**
 * Verifica se o usuário é mentor
 */
export const isMentorEmail = (email) => {
  return email === MENTOR_EMAIL;
};

/**
 * Formata moeda
 */
export const formatCurrency = (value, currency = 'BRL') => {
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  
  const { locale, currency: curr } = config[currency] || config.BRL;
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 2
  }).format(value || 0);
};

/**
 * Formata percentual
 */
export const formatPercent = (value) => {
  return `${(value || 0).toFixed(2)}%`;
};

/**
 * Formata data
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
};

/**
 * Formata data e hora
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR');
};

/**
 * Calcula resultado do trade
 */
export const calculateTradeResult = (trade) => {
  const { side, entry, exit, qty } = trade;
  if (!entry || !exit || !qty) return 0;
  
  return side === 'LONG'
    ? (exit - entry) * qty
    : (entry - exit) * qty;
};

/**
 * Calcula resultado percentual do trade
 */
export const calculateTradeResultPercent = (trade) => {
  const { side, entry, exit } = trade;
  if (!entry || !exit || entry === 0) return 0;
  
  const percent = ((exit - entry) / entry) * 100;
  return side === 'LONG' ? percent : -percent;
};

/**
 * Calcula Risk:Reward
 */
export const calculateRiskReward = (entry, stopLoss, takeProfit, side) => {
  if (!entry || !stopLoss || !takeProfit) return null;
  
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  
  if (risk === 0) return null;
  return reward / risk;
};

/**
 * Cores para resultado
 */
export const getResultColor = (result) => {
  if (result > 0) return 'text-emerald-400';
  if (result < 0) return 'text-red-400';
  return 'text-slate-400';
};

/**
 * Background para resultado
 */
export const getResultBg = (result) => {
  if (result > 0) return 'bg-emerald-500/20';
  if (result < 0) return 'bg-red-500/20';
  return 'bg-slate-500/20';
};
