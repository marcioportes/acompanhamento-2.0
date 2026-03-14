/**
 * Trade Compliance — Cálculos puros
 * @version 3.1.0 (v1.19.4)
 * 
 * Lógica extraída de functions/index.js (calculateTradeCompliance)
 * para permitir testes unitários no frontend.
 * 
 * IMPORTANTE: Manter sincronizado com functions/index.js.
 * TODO: Fase futura — unificar em módulo shared.
 * 
 * CHANGELOG:
 * - 3.1.0 (v1.19.4): DEC-009 — riskPercent usa plan.pl (capital base) como denominador.
 *   Corrige bug onde currentPl (flutuante) distorcia o cálculo de RO%.
 * - 3.0.0 (v1.19.2): DEC-007 — RR assumido integrado no calculateTradeCompliance.
 *   Trades sem stop agora calculam rrRatio via plan.pl (capital base) × RO%.
 *   Guard C4 removido — CF e frontend recalculam RR assumido em todos os pontos.
 * - 2.0.0 (v1.19.1): DEC-006 — RO sem stop: loss → risco retroativo, win → N/A, breakeven → 0
 * - 1.0.0 (v1.17.0): Extração inicial, sem stop = 100% (substituído por DEC-006)
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
 * === DEC-006 (v1.19.1): Lógica sem stop ===
 * - Com stop: risco = (distância / tickSize) * tickValue * qty / planPl * 100
 * - Sem stop + loss: risco retroativo = |result| / planPl * 100
 * - Sem stop + win:  riskPercent = null (N/A — impossível inferir risco)
 * - Sem stop + breakeven (result = 0): riskPercent = 0
 * 
 * === DEC-007 (v1.19.2): RR assumido para trades sem stop ===
 * Quando trade não tem stop, calcula RR assumido:
 *   RO$ = plan.pl (capital base) × plan.riskPerOperation / 100
 *   rrRatio = result / RO$
 * Usa plan.pl (não currentPl) porque o risco é definido sobre o capital alocado ao ciclo.
 * 
 * @param {Object} trade - { entry, stopLoss, takeProfit, qty, result, tickerRule: { tickSize, tickValue } }
 * @param {Object} plan - { currentPl, pl, riskPerOperation, rrTarget }
 * @returns {{ riskPercent: number|null, rrRatio: number|null, rrAssumed: boolean, compliance: { roStatus: string, rrStatus: string } }}
 */
export const calculateTradeCompliance = (trade, plan) => {
  const result = { 
    riskPercent: null, 
    rrRatio: null,
    rrAssumed: false,
    compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' } 
  };
  
  if (!plan || !trade) return result;
  
  // DEC-009 (v1.19.4): riskPercent usa plan.pl (capital base do ciclo), não currentPl.
  // Consistente com DEC-007 (RR assumido já usava plan.pl).
  // Fallback para currentPl apenas se plan.pl não existir (planos legados).
  const planPl = plan.pl ?? plan.currentPl ?? 0;
  if (planPl <= 0) return result;
  
  // === Risco Operacional (RO) ===
  if (trade.stopLoss && trade.entry) {
    // Com stop: risco = (distância / tickSize) * tickValue * qty
    const tickSize = trade.tickerRule?.tickSize || 1;
    const tickValue = trade.tickerRule?.tickValue || 1;
    const distanceInPoints = Math.abs(trade.entry - trade.stopLoss);
    const riskAmount = (distanceInPoints / tickSize) * tickValue * (trade.qty ?? 1);
    result.riskPercent = (riskAmount / planPl) * 100;
  } else {
    // DEC-006: Sem stop — risco retroativo baseado no resultado
    const tradeResult = trade.result ?? 0;
    if (tradeResult < 0) {
      // Loss: risco materializado = |result| / planPl
      result.riskPercent = (Math.abs(tradeResult) / planPl) * 100;
    } else if (tradeResult === 0) {
      // Breakeven: sem materialização de risco
      result.riskPercent = 0;
    } else {
      // Win: impossível inferir risco sem stop — N/A
      result.riskPercent = null;
    }
  }
  
  // RO compliance: só avalia se riskPercent é numérico
  if (result.riskPercent != null && plan.riskPerOperation && result.riskPercent > plan.riskPerOperation) {
    result.compliance.roStatus = 'FORA_DO_PLANO';
  }
  
  // === Razão Risco-Retorno (RR) ===
  if (trade.stopLoss && trade.entry) {
    // COM stop: RR real baseado na distância do stop
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
        const resultInPoints = (trade.result / (tickValue * (trade.qty ?? 1))) * tickSize;
        result.rrRatio = resultInPoints / risk;
      }
    }
  } else {
    // DEC-007: SEM stop — RR assumido via plan.pl (capital base) × RO%
    const basePl = Number(plan.pl) || 0;
    const roPercent = Number(plan.riskPerOperation) || 0;
    if (basePl > 0 && roPercent > 0) {
      const roAmount = basePl * (roPercent / 100);
      const tradeResult = trade.result ?? 0;
      result.rrRatio = Math.round((tradeResult / roAmount) * 100) / 100;
      result.rrAssumed = true;
    }
  }

  // RR compliance: 
  // - Com takeProfit: sempre avalia (métrica planejada, independe do resultado)
  // - Sem takeProfit + win (result > 0): avalia (win que não atingiu alvo)
  // - Sem takeProfit + loss/breakeven (result <= 0): NÃO avalia (perder 1R é o risco planejado)
  const tradeResultForRR = trade.result ?? 0;
  const hasPlannedRR = !!(trade.takeProfit || trade.stopLoss && trade.takeProfit);
  const shouldEvaluateRR = hasPlannedRR || tradeResultForRR > 0;
  if (result.rrRatio != null && plan.rrTarget && shouldEvaluateRR && result.rrRatio < plan.rrTarget) {
    result.compliance.rrStatus = 'NAO_CONFORME';
  }
  
  return result;
};

/**
 * Gera lista de red flags de compliance para um trade
 * Usado para reconstruir flags após recálculo.
 * 
 * DEC-006 (v1.19.1): Red flag NO_STOP continua existindo (trade sem stop É uma violação
 * de disciplina), mas a mensagem é contextualizada e NÃO implica risco de 100%.
 * A flag RISK_EXCEEDED só é gerada quando riskPercent é numérico.
 * 
 * @param {Object} trade - Trade com dados completos
 * @param {Object} plan - Plano vinculado
 * @param {Object} complianceResult - Resultado de calculateTradeCompliance
 * @returns {Array<{type: string, message: string, timestamp: string}>}
 */
export const generateComplianceRedFlags = (trade, plan, complianceResult) => {
  const flags = [];
  
  if (!trade.stopLoss) {
    // DEC-006: Mensagem contextualizada — não afirma mais "risco ilimitado"
    const tradeResult = trade.result ?? 0;
    let noStopMessage = 'Trade sem stop loss definido';
    if (tradeResult < 0 && complianceResult.riskPercent != null) {
      noStopMessage += ` — risco retroativo: ${complianceResult.riskPercent.toFixed(1)}%`;
    } else if (tradeResult > 0) {
      noStopMessage += ' — risco não mensurado (win sem stop)';
    }
    
    flags.push({ 
      type: RED_FLAG_TYPES.NO_STOP, 
      message: noStopMessage, 
      timestamp: new Date().toISOString() 
    });
  }
  
  // RISK_EXCEEDED: só quando riskPercent é numérico (com stop ou loss retroativo)
  if (complianceResult.riskPercent != null && complianceResult.compliance.roStatus === 'FORA_DO_PLANO') {
    flags.push({ 
      type: RED_FLAG_TYPES.RISK_EXCEEDED, 
      message: `Risco ${complianceResult.riskPercent.toFixed(1)}% excede máximo do plano (${plan.riskPerOperation}%)`, 
      timestamp: new Date().toISOString() 
    });
  }
  
  if (complianceResult.compliance.rrStatus === 'NAO_CONFORME' && complianceResult.rrRatio != null) {
    flags.push({ 
      type: RED_FLAG_TYPES.RR_BELOW_MINIMUM, 
      message: `RR ${complianceResult.rrRatio.toFixed(2)}x abaixo do mínimo (${plan.rrTarget}x)`, 
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
