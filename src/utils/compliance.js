/**
 * Trade Compliance — Cálculos puros
 * @version 1.0.0
 * 
 * Lógica extraída de functions/index.js (calculateTradeCompliance)
 * para permitir testes unitários no frontend.
 * 
 * IMPORTANTE: Manter sincronizado com functions/index.js.
 * TODO: Fase futura — unificar em módulo shared.
 */

/**
 * Tipos de Red Flag
 */
export const RED_FLAG_TYPES = {
  NO_PLAN: 'TRADE_SEM_PLANO',
  NO_STOP: 'TRADE_SEM_STOP',
  RISK_EXCEEDED: 'RISCO_ACIMA_PERMITIDO',
  RR_BELOW_MINIMUM: 'RR_ABAIXO_MINIMO',
  DAILY_LOSS_EXCEEDED: 'LOSS_DIARIO_EXCEDIDO',
  BLOCKED_EMOTION: 'EMOCIONAL_BLOQUEADO'
};

/**
 * Calcula compliance do trade contra o plano
 * Risco Operacional (RO) e Razão Risco-Retorno (RR)
 * 
 * Sem stopLoss → riskPercent = 100 (todo o PL em risco)
 * RR: prefere takeProfit se disponível, fallback para resultado efetivo
 * 
 * @param {Object} trade - { entry, stopLoss, takeProfit, qty, result, tickerRule: { tickSize, tickValue } }
 * @param {Object} plan - { currentPl, pl, riskPerOperation, rrTarget }
 * @returns {{ riskPercent: number, rrRatio: number|null, compliance: { roStatus: string, rrStatus: string } }}
 */
export const calculateTradeCompliance = (trade, plan) => {
  const result = { 
    riskPercent: 0, 
    rrRatio: null, 
    compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' } 
  };
  
  if (!plan || !trade) return result;
  
  const planPl = plan.currentPl ?? plan.pl ?? 0;
  if (planPl <= 0) return result;
  
  // === Risco Operacional (RO) ===
  if (trade.stopLoss && trade.entry) {
    // Com stop: risco = (distância / tickSize) * tickValue * qty
    const tickSize = trade.tickerRule?.tickSize || 1;
    const tickValue = trade.tickerRule?.tickValue || 1;
    const distanceInPoints = Math.abs(trade.entry - trade.stopLoss);
    const riskAmount = (distanceInPoints / tickSize) * tickValue * trade.qty;
    result.riskPercent = (riskAmount / planPl) * 100;
  } else {
    // Sem stop: 100% do PL em risco (pior cenário)
    result.riskPercent = 100;
  }
  
  if (plan.riskPerOperation && result.riskPercent > plan.riskPerOperation) {
    result.compliance.roStatus = 'FORA_DO_PLANO';
  }
  
  // === Razão Risco-Retorno (RR) ===
  if (trade.stopLoss && trade.entry) {
    const risk = Math.abs(trade.entry - trade.stopLoss);
    if (risk > 0) {
      if (trade.takeProfit) {
        // Via takeProfit (planejado)
        const reward = Math.abs(trade.takeProfit - trade.entry);
        result.rrRatio = reward / risk;
      } else if (trade.result > 0) {
        // Via resultado efetivo (realizado) — converter result R$ para pontos
        const tickSize = trade.tickerRule?.tickSize || 1;
        const tickValue = trade.tickerRule?.tickValue || 1;
        const resultInPoints = (trade.result / (tickValue * trade.qty)) * tickSize;
        result.rrRatio = resultInPoints / risk;
      }
      
      if (result.rrRatio != null && plan.rrTarget && result.rrRatio < plan.rrTarget) {
        result.compliance.rrStatus = 'NAO_CONFORME';
      }
    }
  }
  
  return result;
};

/**
 * Gera lista de red flags de compliance para um trade
 * Usado para reconstruir flags após recálculo.
 * 
 * @param {Object} trade - Trade com dados completos
 * @param {Object} plan - Plano vinculado
 * @param {Object} complianceResult - Resultado de calculateTradeCompliance
 * @returns {Array<{type: string, message: string, timestamp: string}>}
 */
export const generateComplianceRedFlags = (trade, plan, complianceResult) => {
  const flags = [];
  
  if (!trade.stopLoss) {
    flags.push({ 
      type: RED_FLAG_TYPES.NO_STOP, 
      message: 'Trade sem stop loss definido — risco ilimitado', 
      timestamp: new Date().toISOString() 
    });
  }
  
  if (complianceResult.compliance.roStatus === 'FORA_DO_PLANO') {
    flags.push({ 
      type: RED_FLAG_TYPES.RISK_EXCEEDED, 
      message: `Risco ${complianceResult.riskPercent.toFixed(1)}% excede máximo do plano (${plan.riskPerOperation}%)`, 
      timestamp: new Date().toISOString() 
    });
  }
  
  if (complianceResult.compliance.rrStatus === 'NAO_CONFORME' && complianceResult.rrRatio != null) {
    flags.push({ 
      type: RED_FLAG_TYPES.RR_BELOW_MINIMUM, 
      message: `RR ${complianceResult.rrRatio.toFixed(1)}x abaixo do mínimo (${plan.rrTarget}x)`, 
      timestamp: new Date().toISOString() 
    });
  }
  
  return flags;
};

export default {
  calculateTradeCompliance,
  generateComplianceRedFlags,
  RED_FLAG_TYPES
};
