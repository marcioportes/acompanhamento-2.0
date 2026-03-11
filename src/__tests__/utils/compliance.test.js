/**
 * Tests: calculateTradeCompliance — DEC-006 (v1.19.1)
 * @description Testa regras de compliance de trade contra plano
 * 
 * DEC-006 mudou a lógica sem stop:
 * - Sem stop + loss → riskPercent = |result| / planPl * 100 (retroativo)
 * - Sem stop + win → riskPercent = null (N/A)
 * - Sem stop + breakeven → riskPercent = 0
 * 
 * Cenários:
 * - T1: Trade sem stop (DEC-006: loss retroativo, win N/A, breakeven 0)
 * - T2: RO acima do permitido → roStatus FORA_DO_PLANO
 * - RR abaixo do mínimo → rrStatus NAO_CONFORME
 * - T3: Red flags DEC-006
 * - Edge cases: plan sem PL, trade sem dados, etc.
 */

import { describe, it, expect } from 'vitest';
import { calculateTradeCompliance, generateComplianceRedFlags, RED_FLAG_TYPES } from '../../utils/compliance';

// Fixture: Plano "Clear-DT" do ambiente de teste
const basePlan = {
  currentPl: 20000,
  pl: 20000,
  riskPerOperation: 0.4,  // 0.4% max RO
  rrTarget: 2              // 2x RR mínimo
};

// Fixture: WINFUT tickerRule
const winfutTicker = { tickSize: 5, tickValue: 1, pointValue: 0.2 };

describe('calculateTradeCompliance', () => {

  // =============================================
  // T1: Trade sem stop loss — DEC-006
  // =============================================
  describe('T1 — DEC-006: TRADE_SEM_STOP', () => {
    it('sem stop + loss → riskPercent = risco retroativo (|result| / planPl)', () => {
      // Loss de R$200, PL = 20000 → 200/20000 = 1%
      const trade = { 
        entry: 5000, exit: 4990, qty: 1, side: 'LONG', 
        stopLoss: null, result: -200, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(1.0);
    });

    it('sem stop + loss pequeno → riskPercent pequeno, CONFORME', () => {
      // Loss de R$10, PL = 20000 → 10/20000 = 0.05% < 0.4%
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: -10,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0.05);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('sem stop + loss grande → riskPercent grande, FORA_DO_PLANO', () => {
      // Loss de R$500, PL = 20000 → 500/20000 = 2.5% > 0.4%
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: -500,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(2.5);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });

    it('sem stop + win → riskPercent = null (N/A)', () => {
      const trade = { 
        entry: 5000, exit: 5010, qty: 1, side: 'LONG', 
        stopLoss: null, result: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeNull();
    });

    it('sem stop + win → roStatus CONFORME (N/A não penaliza)', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('sem stop + breakeven (result=0) → riskPercent = 0', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: 0,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('sem stop + result undefined → treat as breakeven', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      // result ?? 0 → 0 → breakeven path
      expect(result.riskPercent).toBe(0);
    });

    it('sem stopLoss → rrRatio null (impossível calcular sem stop)', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBeNull();
    });

    it('stopLoss = 0 (falsy mas numérico) → trata como sem stop, aplica DEC-006', () => {
      // stopLoss = 0 falsy → sem stop, result = -100 → retroativo = 100/20000 = 0.5%
      const trade = { 
        entry: 5000, qty: 1, stopLoss: 0, result: -100,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0.5);
    });
  });

  // =============================================
  // T2: Risco Operacional com stop (inalterado)
  // =============================================
  describe('T2 — RISCO_ACIMA_PERMITIDO (com stop)', () => {
    it('RO dentro do limite → roStatus CONFORME', () => {
      const trade = { 
        entry: 5000, stopLoss: 4990, qty: 1, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeCloseTo(0.01, 2);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('RO exatamente no limite → ainda CONFORME (> não >=)', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 8, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeCloseTo(0.4, 2);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('RO acima do limite → roStatus FORA_DO_PLANO', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(2.5);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });

    it('FORA_DO_PLANO → generateComplianceRedFlags inclui RISCO_ACIMA_PERMITIDO', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 50,
        tickerRule: winfutTicker 
      };

      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).toContainEqual(
        expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED })
      );
    });

    it('SHORT trade: distância calculada como abs(entry - stop)', () => {
      const trade = { 
        entry: 5000, stopLoss: 5050, qty: 10, side: 'SHORT',
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0.5);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });
  });

  // =============================================
  // T3: Red Flags DEC-006
  // =============================================
  describe('T3 — Red Flags DEC-006', () => {
    it('sem stop + loss → red flag NO_STOP com mensagem retroativa', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -200, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      const noStopFlag = flags.find(f => f.type === RED_FLAG_TYPES.NO_STOP);
      expect(noStopFlag).toBeTruthy();
      expect(noStopFlag.message).toContain('risco retroativo');
      expect(noStopFlag.message).toContain('1.0%');
    });

    it('sem stop + loss FORA_DO_PLANO → gera AMBAS flags NO_STOP + RISK_EXCEEDED', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -500, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP }));
      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
    });

    it('sem stop + win → red flag NO_STOP com mensagem "risco não mensurado"', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 50, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      const noStopFlag = flags.find(f => f.type === RED_FLAG_TYPES.NO_STOP);
      expect(noStopFlag).toBeTruthy();
      expect(noStopFlag.message).toContain('risco não mensurado');
    });

    it('sem stop + win → NÃO gera RISK_EXCEEDED (riskPercent null)', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 50, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
    });

    it('sem stop + breakeven → red flag NO_STOP genérica, sem RISK_EXCEEDED', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 0, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP }));
      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
    });

    it('sem stop + loss pequeno CONFORME → NO_STOP sem RISK_EXCEEDED', () => {
      // Loss R$10, 0.05% < 0.4% → CONFORME mas ainda tem NO_STOP
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -10, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP }));
      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
      expect(flags.length).toBe(1);
    });

    it('com stop CONFORME → NENHUMA flag', () => {
      const trade = { entry: 5000, stopLoss: 4990, qty: 1, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags.length).toBe(0);
    });
  });

  // =============================================
  // RR (Risk-Reward) — inalterado
  // =============================================
  describe('Risk-Reward (RR)', () => {
    it('RR via takeProfit acima do target → CONFORME', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, takeProfit: 5100, qty: 1,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(2.0);
      expect(result.compliance.rrStatus).toBe('CONFORME');
    });

    it('RR via takeProfit abaixo do target → NAO_CONFORME', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, takeProfit: 5050, qty: 1,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(1.0);
      expect(result.compliance.rrStatus).toBe('NAO_CONFORME');
    });

    it('RR via resultado efetivo (sem takeProfit, trade positivo)', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 1, result: 20,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(2.0);
    });

    it('trade perdedor (result < 0) sem takeProfit → rrRatio null', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 1, result: -10,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBeNull();
    });

    it('takeProfit tem prioridade sobre resultado efetivo', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, takeProfit: 5100, 
        qty: 1, result: 5,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(2.0);
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  describe('Edge cases', () => {
    it('plan null → retorna defaults seguros', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1 };
      const result = calculateTradeCompliance(trade, null);

      expect(result.riskPercent).toBeNull();
      expect(result.rrRatio).toBeNull();
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('trade null → retorna defaults seguros', () => {
      const result = calculateTradeCompliance(null, basePlan);

      expect(result.riskPercent).toBeNull();
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('planPl = 0 → retorna defaults (divisão por zero evitada)', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { ...basePlan, currentPl: 0, pl: 0 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBeNull();
    });

    it('planPl negativo → retorna defaults', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { ...basePlan, currentPl: -5000, pl: -5000 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBeNull();
    });

    it('sem tickerRule → usa defaults (tickSize=1, tickValue=1)', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1 };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0.25);
    });

    it('plan sem riskPerOperation → roStatus sempre CONFORME', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 50, tickerRule: winfutTicker };
      const plan = { currentPl: 20000 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBe(2.5);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('plan.currentPl fallback para plan.pl via nullish coalescing', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { pl: 10000, riskPerOperation: 0.4, rrTarget: 2 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBeCloseTo(0.1, 2);
    });

    it('sem stop + loss em moeda diferente (USD) → retroativo funciona igual', () => {
      // Loss USD 100, PL = 5000 → 100/5000 = 2%
      const trade = { entry: 15000, qty: 1, stopLoss: null, result: -100 };
      const plan = { currentPl: 5000, riskPerOperation: 1, rrTarget: 2 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBe(2);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });
  });
});
