/**
 * Tests: calculateTradeCompliance -- DEC-006 (v1.19.1)
 * @description Testa regras de compliance de trade contra plano
 * 
 * DEC-006 mudou a logica sem stop:
 * - Sem stop + loss -> riskPercent = |result| / planPl * 100 (retroativo)
 * - Sem stop + win -> riskPercent = null (N/A)
 * - Sem stop + breakeven -> riskPercent = 0
 * 
 * Cenarios:
 * - T1: Trade sem stop (DEC-006: loss retroativo, win N/A, breakeven 0)
 * - T2: RO acima do permitido -> roStatus FORA_DO_PLANO
 * - RR abaixo do minimo -> rrStatus NAO_CONFORME
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
  rrTarget: 2              // 2x RR minimo
};

// Fixture: WINFUT tickerRule
const winfutTicker = { tickSize: 5, tickValue: 1, pointValue: 0.2 };

describe('calculateTradeCompliance', () => {

  // =============================================
  // T1: Trade sem stop loss -- DEC-006
  // =============================================
  describe('T1 -- DEC-006: TRADE_SEM_STOP', () => {
    it('sem stop + loss -> riskPercent = risco retroativo (|result| / planPl)', () => {
      // Loss de R$200, PL = 20000 -> 200/20000 = 1%
      const trade = { 
        entry: 5000, exit: 4990, qty: 1, side: 'LONG', 
        stopLoss: null, result: -200, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(1.0);
    });

    it('sem stop + loss pequeno -> riskPercent pequeno, CONFORME', () => {
      // Loss de R$10, PL = 20000 -> 10/20000 = 0.05% < 0.4%
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: -10,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0.05);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('sem stop + loss grande -> riskPercent grande, FORA_DO_PLANO', () => {
      // Loss de R$500, PL = 20000 -> 500/20000 = 2.5% > 0.4%
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: -500,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(2.5);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });

    it('sem stop + win -> riskPercent = null (N/A)', () => {
      const trade = { 
        entry: 5000, exit: 5010, qty: 1, side: 'LONG', 
        stopLoss: null, result: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeNull();
    });

    it('sem stop + win -> roStatus CONFORME (N/A nao penaliza)', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('sem stop + breakeven (result=0) -> riskPercent = 0', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: 0,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('sem stop + result undefined -> treat as breakeven', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      // result ?? 0 -> 0 -> breakeven path
      expect(result.riskPercent).toBe(0);
    });

    it('sem stopLoss -> rrRatio calculado via DEC-007 (RR assumido)', () => {
      const trade = { 
        entry: 5000, qty: 1, stopLoss: null, result: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      // DEC-007: sem stop -> RR assumido = result / (plan.pl x RO%)
      // RO$ = 20000 * 0.4% = 80, RR = 50/80 = 0.625 -> 0.63
      expect(result.rrRatio).toBe(0.63);
      expect(result.rrAssumed).toBe(true);
    });

    it('stopLoss = 0 (falsy mas numerico) -> trata como sem stop, aplica DEC-006', () => {
      // stopLoss = 0 falsy -> sem stop, result = -100 -> retroativo = 100/20000 = 0.5%
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
  describe('T2 -- RISCO_ACIMA_PERMITIDO (com stop)', () => {
    it('RO dentro do limite -> roStatus CONFORME', () => {
      const trade = { 
        entry: 5000, stopLoss: 4990, qty: 1, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeCloseTo(0.01, 2);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('RO exatamente no limite -> ainda CONFORME (> nao >=)', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 8, 
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBeCloseTo(0.4, 2);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('RO acima do limite -> roStatus FORA_DO_PLANO', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, qty: 50,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(2.5);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });

    it('FORA_DO_PLANO -> generateComplianceRedFlags inclui RISCO_ACIMA_PERMITIDO', () => {
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

    it('SHORT trade: distancia calculada como abs(entry - stop)', () => {
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
  describe('T3 -- Red Flags DEC-006', () => {
    it('sem stop + loss -> red flag NO_STOP com mensagem retroativa', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -200, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      const noStopFlag = flags.find(f => f.type === RED_FLAG_TYPES.NO_STOP);
      expect(noStopFlag).toBeTruthy();
      expect(noStopFlag.message).toContain('risco retroativo');
      expect(noStopFlag.message).toContain('1.0%');
    });

    it('sem stop + loss FORA_DO_PLANO -> gera AMBAS flags NO_STOP + RISK_EXCEEDED', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -500, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP }));
      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
    });

    it('sem stop + win -> red flag NO_STOP com mensagem "risco nao mensurado"', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 50, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      const noStopFlag = flags.find(f => f.type === RED_FLAG_TYPES.NO_STOP);
      expect(noStopFlag).toBeTruthy();
      expect(noStopFlag.message).toContain('win sem stop');
    });

    it('sem stop + win -> NAO gera RISK_EXCEEDED (riskPercent null)', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 50, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
    });

    it('sem stop + breakeven -> red flag NO_STOP generica, sem RISK_EXCEEDED', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 0, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP }));
      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
    });

    it('sem stop + loss pequeno CONFORME -> NO_STOP only (loss nao viola RR)', () => {
      // Loss R$10, 0.05% < 0.4% -> RO CONFORME
      // DEC-007: RR assumido = -10/80 = -0.13, mas loss -> rrStatus CONFORME (nao avalia RR em loss)
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -10, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(compliance.compliance.rrStatus).toBe('CONFORME');
      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP }));
      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RISK_EXCEEDED }));
      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RR_BELOW_MINIMUM }));
      expect(flags.length).toBe(1);
    });

    it('com stop CONFORME -> NENHUMA flag', () => {
      const trade = { entry: 5000, stopLoss: 4990, qty: 1, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(flags.length).toBe(0);
    });
  });

  // =============================================
  // RR (Risk-Reward) -- inalterado
  // =============================================
  describe('Risk-Reward (RR) -- com stop', () => {
    it('RR via takeProfit acima do target -> CONFORME', () => {
      const trade = { 
        entry: 5000, stopLoss: 4950, takeProfit: 5100, qty: 1,
        tickerRule: winfutTicker 
      };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(2.0);
      expect(result.compliance.rrStatus).toBe('CONFORME');
    });

    it('RR via takeProfit abaixo do target -> NAO_CONFORME', () => {
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

    it('trade perdedor (result < 0) sem takeProfit -> rrRatio null', () => {
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
  // T4: DEC-007 -- RR Assumido (sem stop)
  // =============================================
  describe('T4 -- DEC-007: RR Assumido (sem stop)', () => {
    // basePlan: pl=20000, riskPerOperation=0.4%, rrTarget=2
    // RO$ = 20000 * 0.4% = R$80

    it('sem stop + win -> calcula RR assumido via plan.pl x RO%', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 160, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(2.0); // 160 / 80 = 2.0
      expect(result.rrAssumed).toBe(true);
      expect(result.compliance.rrStatus).toBe('CONFORME');
    });

    it('sem stop + win abaixo do alvo -> NAO_CONFORME', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 100, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(1.25); // 100 / 80 = 1.25
      expect(result.rrAssumed).toBe(true);
      expect(result.compliance.rrStatus).toBe('NAO_CONFORME');
    });

    it('sem stop + loss -> RR negativo assumido, CONFORME (loss nao viola RR)', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -200, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(-2.5); // -200 / 80 = -2.5
      expect(result.rrAssumed).toBe(true);
      expect(result.compliance.rrStatus).toBe('CONFORME'); // loss -> nao avalia RR
    });

    it('sem stop + breakeven -> RR = 0 assumido', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 0, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(0);
      expect(result.rrAssumed).toBe(true);
    });

    it('usa plan.pl (base) e NAO currentPl para RO$', () => {
      // Plan com currentPl=25000 mas pl=20000
      const plan = { ...basePlan, currentPl: 25000, pl: 20000 };
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 160, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, plan);

      // RO$ = 20000 * 0.4% = 80 (usa pl, nao currentPl)
      expect(result.rrRatio).toBe(2.0); // 160 / 80
      expect(result.rrAssumed).toBe(true);
    });

    it('plan sem riskPerOperation -> rrRatio null (nao pode calcular)', () => {
      const plan = { currentPl: 20000, pl: 20000, rrTarget: 2 };
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 200, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, plan);

      expect(result.rrRatio).toBeNull();
      expect(result.rrAssumed).toBe(false);
    });

    it('plan com pl=0 -> rrRatio null', () => {
      const plan = { currentPl: 20000, pl: 0, riskPerOperation: 1, rrTarget: 2 };
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 200, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, plan);

      // planPl (currentPl) > 0 so function proceeds, but basePl=0 -> can't calc RR
      expect(result.rrRatio).toBeNull();
      expect(result.rrAssumed).toBe(false);
    });

    it('arredonda RR assumido para 2 casas decimais', () => {
      // RO$ = 20000 * 0.4% = 80, result=100 -> 100/80 = 1.25
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 100, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(1.25);
    });

    it('com stop -> rrAssumed = false (RR real)', () => {
      const trade = { entry: 5000, stopLoss: 4950, takeProfit: 5100, qty: 1, tickerRule: winfutTicker };
      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.rrRatio).toBe(2.0);
      expect(result.rrAssumed).toBe(false);
    });

    it('RR assumido funciona para moeda diferente (USD)', () => {
      // Plan pl=5000 USD, RO=2% -> RO$=100, result=250 -> RR=2.5
      const plan = { currentPl: 5500, pl: 5000, riskPerOperation: 2, rrTarget: 2 };
      const trade = { entry: 15000, qty: 1, stopLoss: null, result: 250 };
      const result = calculateTradeCompliance(trade, plan);

      expect(result.rrRatio).toBe(2.5);
      expect(result.rrAssumed).toBe(true);
      expect(result.compliance.rrStatus).toBe('CONFORME');
    });

    it('RR assumido gera red flag RR_BELOW_MINIMUM quando abaixo do alvo', () => {
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: 50, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(compliance.rrRatio).toBe(0.63); // 50/80
      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RR_BELOW_MINIMUM }));
    });

    it('RR assumido em loss NAO gera red flag RR_BELOW_MINIMUM (B1)', () => {
      // Loss de R$100, RR = -1.25 -- mas loss nao e violacao de RR
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -100, tickerRule: winfutTicker };
      const compliance = calculateTradeCompliance(trade, basePlan);
      const flags = generateComplianceRedFlags(trade, basePlan, compliance);

      expect(compliance.rrRatio).toBe(-1.25); // -100/80
      expect(compliance.compliance.rrStatus).toBe('CONFORME');
      expect(flags).not.toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.RR_BELOW_MINIMUM }));
      // Deve ter apenas NO_STOP + RISK_EXCEEDED (100/20000=0.5% > 0.4%)
      expect(flags).toContainEqual(expect.objectContaining({ type: RED_FLAG_TYPES.NO_STOP }));
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  describe('Edge cases', () => {
    it('plan null -> retorna defaults seguros', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1 };
      const result = calculateTradeCompliance(trade, null);

      expect(result.riskPercent).toBeNull();
      expect(result.rrRatio).toBeNull();
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('trade null -> retorna defaults seguros', () => {
      const result = calculateTradeCompliance(null, basePlan);

      expect(result.riskPercent).toBeNull();
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('planPl = 0 -> retorna defaults (divisao por zero evitada)', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { ...basePlan, currentPl: 0, pl: 0 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBeNull();
    });

    it('planPl negativo -> retorna defaults', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { ...basePlan, currentPl: -5000, pl: -5000 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBeNull();
    });

    it('sem tickerRule -> usa defaults (tickSize=1, tickValue=1)', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 1 };

      const result = calculateTradeCompliance(trade, basePlan);

      expect(result.riskPercent).toBe(0.25);
    });

    it('plan sem riskPerOperation -> roStatus sempre CONFORME', () => {
      const trade = { entry: 5000, stopLoss: 4950, qty: 50, tickerRule: winfutTicker };
      const plan = { currentPl: 20000 };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBe(2.5);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('plan sem pl -> fallback para currentPl via nullish coalescing', () => {
      // DEC-009: pl e primario, mas quando nao existe, faz fallback para currentPl
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };
      const plan = { currentPl: 10000, riskPerOperation: 0.4, rrTarget: 2 };

      const result = calculateTradeCompliance(trade, plan);

      // 10 / 10000 * 100 = 0.1%
      expect(result.riskPercent).toBeCloseTo(0.1, 2);
    });

    it('sem stop + loss em moeda diferente (USD) -> retroativo funciona igual', () => {
      // Loss USD 100, PL base = 5000 -> 100/5000 = 2%
      const trade = { entry: 15000, qty: 1, stopLoss: null, result: -100 };
      const plan = { pl: 5000, currentPl: 5500, riskPerOperation: 1, rrTarget: 2 };

      const result = calculateTradeCompliance(trade, plan);

      // DEC-009: usa pl (5000), nao currentPl (5500)
      expect(result.riskPercent).toBe(2);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });
  });

  // =============================================
  // DEC-009: riskPercent usa plan.pl (capital base), nao currentPl
  // =============================================
  describe('DEC-009 -- riskPercent usa plan.pl (capital base)', () => {
    it('com stop: riskPercent calculado sobre plan.pl, nao currentPl', () => {
      // Plan: pl=200000 (base), currentPl=115939 (corrompido/flutuante)
      // Stop distance: 50pts, tickSize=5, tickValue=1, qty=1 -> riskAmount = 10
      const plan = { pl: 200000, currentPl: 115939, riskPerOperation: 0.5, rrTarget: 2 };
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };

      const result = calculateTradeCompliance(trade, plan);

      // DEC-009: 10 / 200000 * 100 = 0.005%
      // Bug antigo: 10 / 115939 * 100 = 0.0086%
      expect(result.riskPercent).toBeCloseTo(0.005, 4);
    });

    it('sem stop + loss: riskPercent retroativo sobre plan.pl, nao currentPl', () => {
      // Reproduz o bug reportado: WINFUT loss -885, pl=200k, currentPl=115939
      const plan = { pl: 200000, currentPl: 115939, riskPerOperation: 0.5, rrTarget: 2 };
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -885, tickerRule: winfutTicker };

      const result = calculateTradeCompliance(trade, plan);

      // DEC-009: 885 / 200000 * 100 = 0.4425% -> CONFORME (< 0.5%)
      // Bug antigo: 885 / 115939 * 100 = 0.763% -> seria arredondado para 0.8%
      expect(result.riskPercent).toBeCloseTo(0.4425, 3);
      expect(result.compliance.roStatus).toBe('CONFORME');
    });

    it('sem stop + loss que excede RO quando calculado sobre plan.pl', () => {
      // Loss R$1200, pl=200000 -> 0.6% > 0.5% -> FORA_DO_PLANO
      const plan = { pl: 200000, currentPl: 250000, riskPerOperation: 0.5, rrTarget: 2 };
      const trade = { entry: 5000, qty: 1, stopLoss: null, result: -1200, tickerRule: winfutTicker };

      const result = calculateTradeCompliance(trade, plan);

      expect(result.riskPercent).toBeCloseTo(0.6, 2);
      expect(result.compliance.roStatus).toBe('FORA_DO_PLANO');
    });

    it('currentPl divergente nao afeta riskPercent quando plan.pl existe', () => {
      // Mesmo trade, currentPl muito diferente do pl -> resultado deve ser identico
      const trade = { entry: 5000, stopLoss: 4950, qty: 5, tickerRule: winfutTicker };
      const plan1 = { pl: 20000, currentPl: 20000, riskPerOperation: 0.4, rrTarget: 2 };
      const plan2 = { pl: 20000, currentPl: 50000, riskPerOperation: 0.4, rrTarget: 2 };
      const plan3 = { pl: 20000, currentPl: 5000, riskPerOperation: 0.4, rrTarget: 2 };

      const r1 = calculateTradeCompliance(trade, plan1);
      const r2 = calculateTradeCompliance(trade, plan2);
      const r3 = calculateTradeCompliance(trade, plan3);

      // Todos devem dar o mesmo resultado: 50 / 20000 * 100 = 0.25%
      expect(r1.riskPercent).toBe(0.25);
      expect(r2.riskPercent).toBe(0.25);
      expect(r3.riskPercent).toBe(0.25);
    });

    it('plan legado sem pl -> fallback para currentPl funciona', () => {
      // Planos antigos podem nao ter campo pl
      const plan = { currentPl: 20000, riskPerOperation: 0.4, rrTarget: 2 };
      const trade = { entry: 5000, stopLoss: 4950, qty: 1, tickerRule: winfutTicker };

      const result = calculateTradeCompliance(trade, plan);

      // Fallback: 10 / 20000 * 100 = 0.05%
      expect(result.riskPercent).toBeCloseTo(0.05, 3);
    });
  });

});
