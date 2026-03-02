/**
 * Tests: calculateTradeCompliance
 * @description Testa regras de compliance de trade contra plano
 * 
 * Cenários críticos:
 * - T1: Trade sem stop → riskPercent=100%, sem RR calculado
 * - T2: RO acima do permitido → roStatus FORA_DO_PLANO
 * - RR abaixo do mínimo → rrStatus NAO_CONFORME
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
  // T1: Trade sem stop loss
  // =============================================
  describe('T1 — TRADE_SEM_STOP', () => {
    it('trade sem stopLoss → riskPercent = 100% (pior cenário)', () => {
      const trade = { 
        entry: 5000, exit: 5010, qty: 1, side: 'LONG', 
        stopLoss: null, result: 10, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(100);
    });

    it('trade sem stopLoss → roStatus FORA_DO_PLANO (100% > qualquer limite)', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });

    it('trade sem stopLoss → rrRatio null (impossível calcular sem stop)', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBeNull();
    });

    it('trade sem stopLoss → generateComplianceRedFlags inclui TRADE_SEM_STOP', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).toContainEqual(
        expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP })
      );
    });

    it('trade com stopLoss = 0 (falsy mas numérico) → trata como sem stop', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: 0, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      // stopLoss = 0 é falsy em JS → cai no else → 100%
      expect(result.riskPercent).toBe(100);
    });
  });

  // =============================================
  // T2: Risco Operacional acima do permitido
  // =============================================
  describe('T2 — RISCO_ACIMA_PERMITIDO', () => {
    it('RO dentro do limite → roStatus CONFORME', () => {
      // RO = |5000 - 4990| / 5 * 1 * 1 = 2 ticks * R$1 * 1 contrato = R$2
      // RO% = 2 / 20000 = 0.01% < 0.4% ✓
      const trade = { 
        entry: 5000, stopLoss: 4990, qty: 1, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeCloseTo(0.01, 2);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('RO exatamente no limite → ainda CONFORME (> não >=)', () => {
      // Precisamos de RO = 0.4% exatamente
      // 0.4% de R$20.000 = R$80
      // R$80 = (dist / 5) * 1 * qty → dist=50, qty=8 → (50/5)*1*8 = 80 ✓
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 8, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeCloseTo(0.4, 2);
      // 0.4 > 0.4 é false → CONFORME
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('RO acima do limite → roStatus FORA_DO_PLANO', () => {
      // RO = |5000 - 4950| / 5 * 1 * 50 = 10 ticks * R$1 * 50 = R$500
      // RO% = 500 / 20000 = 2.5% > 0.4% ✗
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
      // SHORT: entry 5000, stop 5050 → distância = 50 pts
      // RO = (50/5) * 1 * 10 = R$100 → 100/20000 = 0.5%
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
  // RR (Risk-Reward)
  // =============================================
  describe('Risk-Reward (RR)', () => {
    it('RR via takeProfit acima do target → CONFORME', () => {
      // risk = |5000 - 4950| = 50 pts
      // reward = |5100 - 5000| = 100 pts → RR = 2.0 >= 2.0 ✓
      const trade = { 
        entry: 5000, stopLoss: 4950, takeProfit: 5100, qty: 1,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(2.0);
      expect(result.compliance.rrStatus).toBe('CONFORME');
    });

    it('RR via takeProfit abaixo do target → NAO_CONFORME', () => {
      // risk = 50 pts, reward = 50 pts → RR = 1.0 < 2.0 ✗
      const trade = { 
        entry: 5000, stopLoss: 4950, takeProfit: 5050, qty: 1,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(1.0);
      expect(result.compliance.rrStatus).toBe('NAO_CONFORME');
    });

    it('RR via resultado efetivo (sem takeProfit, trade positivo)', () => {
      // risk = |5000 - 4950| = 50 pts
      // result = R$20 (positivo) → pts = (20 / (1 * 1)) * 5 = 100 pts → RR = 100/50 = 2.0
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
      // takeProfit diz RR = 2.0, mas result sugeriria diferente
      const trade = { 
        entry: 5000, stopLoss: 4950, takeProfit: 5100, 
        qty: 1, result: 5,  // resultado diferente do TP
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      // Deve usar takeProfit (planejado), não resultado efetivo
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

      expect(result.riskPercent).toBe(0);
      expect(result.rrRatio).toBeNull();
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('trade null → retorna defaults seguros', () => {
      const result = calculateTradeCompliance(null, basePlan);

      expect(result.riskPercent).toBe(0);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('planPl = 0 → retorna defaults (divisão por zero evitada)', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { ...basePlan, currentPl: 0, pl: 0 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBe(0);
    });

    it('planPl negativo → retorna defaults', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { ...basePlan, currentPl: -5000, pl: -5000 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBe(0);
    });

    it('sem tickerRule → usa defaults (tickSize=1, tickValue=1)', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1 };
      // Sem tickerRule: dist=50, risk=(50/1)*1*1=50, 50/20000=0.25%

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0.25);
    });

    it('plan sem riskPerOperation → roStatus sempre CONFORME', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 50, tickerRule: winfutTicker };
      const plan = { currentPl: 20000 };  // sem riskPerOperation

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBe(2.5);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('plan.currentPl fallback para plan.pl via nullish coalescing', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { pl: 10000, riskPerOperation: 0.4, rrTarget: 2 };
      // currentPl undefined → usa pl=10000

      const result = calculateTradeCompliance(trade, plan);

      // RO = (50/5)*1*1 = R$10 → 10/10000 = 0.1%
      expect(result.riskPercent).toBeCloseTo(0.1, 2);
    });
  });
});
