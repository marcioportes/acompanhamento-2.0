/**
 * Tests: diagnosePlan — v1.19.1
 * @description Testa diagnóstico bidirecional de plano (leitura pura)
 * 
 * Ida:   PL do plano ← soma dos trades
 * Volta: Compliance dos trades ← parâmetros do plano
 */

import { describe, it, expect, vi } from 'vitest';
import { calculateTradeCompliance } from '../../utils/compliance';

// ============================================================
// diagnosePlan é um useCallback dentro de usePlans — para testar
// a lógica pura sem React, extraímos a essência aqui.
// ============================================================

/**
 * Replica a lógica de diagnosePlan para testes puros.
 * Em produção esta lógica vive em usePlans.diagnosePlan.
 */
const diagnosePlanPure = (plan, planTrades) => {
  const basePl = Number(plan.pl) || 0;
  const currentPl = Number(plan.currentPl ?? plan.pl) || 0;

  // Ida: PL calculado
  const totalResult = planTrades.reduce((sum, t) => sum + (Number(t.result) || 0), 0);
  const calculatedPl = Math.round((basePl + totalResult) * 100) / 100;
  const plDivergent = Math.abs(currentPl - calculatedPl) > 0.01;

  // Volta: Compliance
  const divergentTrades = [];
  for (const trade of planTrades) {
    const fresh = calculateTradeCompliance(trade, plan);
    const currentRisk = trade.riskPercent;
    const newRisk = fresh.riskPercent;

    const riskChanged = currentRisk == null && newRisk != null
      || currentRisk != null && newRisk == null
      || (currentRisk != null && newRisk != null && Math.abs(currentRisk - newRisk) > 0.01);

    const currentRR = trade.rrRatio;
    const newRR = (trade.rrAssumed && fresh.rrRatio == null) ? currentRR : fresh.rrRatio;
    const rrChanged = currentRR == null && newRR != null
      || currentRR != null && newRR == null
      || (currentRR != null && newRR != null && Math.abs(currentRR - newRR) > 0.01);

    const roChanged = (trade.compliance?.roStatus ?? 'CONFORME') !== fresh.compliance.roStatus;
    const rrStatusChanged = (trade.compliance?.rrStatus ?? 'CONFORME') !== fresh.compliance.rrStatus;

    if (riskChanged || rrChanged || roChanged || rrStatusChanged) {
      divergentTrades.push({
        id: trade.id,
        ticker: trade.ticker || '-',
        oldRisk: currentRisk != null ? `${currentRisk.toFixed(1)}%` : 'N/A',
        newRisk: newRisk != null ? `${newRisk.toFixed(1)}%` : 'N/A',
      });
    }
  }

  return {
    pl: { current: currentPl, calculated: calculatedPl, divergent: plDivergent },
    trades: { total: planTrades.length, divergent: divergentTrades.length, details: divergentTrades },
  };
};

// Fixtures
const basePlan = {
  id: 'plan1',
  pl: 10000,
  currentPl: 10200,
  riskPerOperation: 1,
  rrTarget: 2,
};

const winfutTicker = { tickSize: 5, tickValue: 1 };

describe('diagnosePlan — diagnóstico bidirecional', () => {

  describe('Ida: PL do plano ← trades', () => {
    it('PL confere → divergent: false', () => {
      const plan = { ...basePlan, currentPl: 10200 };
      const trades = [
        { id: 't1', planId: 'plan1', result: 200 },
      ];

      const result = diagnosePlanPure(plan, trades);

      expect(result.pl.divergent).toBe(false);
      expect(result.pl.current).toBe(10200);
      expect(result.pl.calculated).toBe(10200);
    });

    it('PL divergente → divergent: true com valores corretos', () => {
      const plan = { ...basePlan, currentPl: 10500 }; // errado
      const trades = [
        { id: 't1', planId: 'plan1', result: 200 },
      ];

      const result = diagnosePlanPure(plan, trades);

      expect(result.pl.divergent).toBe(true);
      expect(result.pl.current).toBe(10500);
      expect(result.pl.calculated).toBe(10200);
    });

    it('plano sem trades → PL = basePl, confere se currentPl == pl', () => {
      const plan = { ...basePlan, currentPl: 10000 };
      const trades = [];

      const result = diagnosePlanPure(plan, trades);

      expect(result.pl.divergent).toBe(false);
      expect(result.pl.calculated).toBe(10000);
      expect(result.trades.total).toBe(0);
      expect(result.trades.divergent).toBe(0);
    });

    it('tolerância de centavo → 0.01 diferença não é divergente', () => {
      const plan = { ...basePlan, currentPl: 10200.005 };
      const trades = [{ id: 't1', planId: 'plan1', result: 200 }];

      const result = diagnosePlanPure(plan, trades);

      expect(result.pl.divergent).toBe(false);
    });
  });

  describe('Volta: Compliance dos trades ← plano', () => {
    it('trades com compliance atualizado → divergent: 0', () => {
      const plan = { ...basePlan, currentPl: 10200 };
      // Trade com stop, compliance já correto
      // RR via resultado efetivo: result=200, risk=50pts, (200/(1*1))*5=1000pts, 1000/50=20.0
      const trades = [{
        id: 't1', planId: 'plan1', result: 200,
        entry: 5000, stopLoss: 4950, qty: 1,
        tickerRule: winfutTicker,
        riskPercent: 0.1, // (50/5)*1*1=10, 10/10000=0.1%
        rrRatio: 20.0, // resultado efetivo
        compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
      }];

      const result = diagnosePlanPure(plan, trades);

      expect(result.trades.divergent).toBe(0);
    });

    it('trade pré DEC-006 com riskPercent=100 → detecta divergência', () => {
      const plan = { ...basePlan, currentPl: 9800 };
      // Trade sem stop, loss, com riskPercent=100 antigo
      const trades = [{
        id: 't1', planId: 'plan1', result: -200,
        entry: 5000, stopLoss: null, qty: 1,
        tickerRule: winfutTicker,
        riskPercent: 100, // antigo, pré DEC-006
        compliance: { roStatus: 'FORA_DO_PLANO', rrStatus: 'CONFORME' },
      }];

      const result = diagnosePlanPure(plan, trades);

      expect(result.trades.divergent).toBe(1);
      // Novo riskPercent deveria ser 200/10000 = 2%, não 100%
      expect(result.trades.details[0].oldRisk).toBe('100.0%');
      expect(result.trades.details[0].newRisk).toBe('2.0%');
    });

    it('trade sem stop + win com riskPercent=100 → detecta divergência (deveria ser N/A)', () => {
      const plan = { ...basePlan, currentPl: 10200 };
      const trades = [{
        id: 't1', planId: 'plan1', result: 200,
        entry: 5000, stopLoss: null, qty: 1,
        tickerRule: winfutTicker,
        riskPercent: 100, // antigo
        compliance: { roStatus: 'FORA_DO_PLANO', rrStatus: 'CONFORME' },
      }];

      const result = diagnosePlanPure(plan, trades);

      expect(result.trades.divergent).toBe(1);
      expect(result.trades.details[0].oldRisk).toBe('100.0%');
      expect(result.trades.details[0].newRisk).toBe('N/A');
    });

    it('trade com rrAssumed → respeita guard, não marca como divergente', () => {
      const plan = { ...basePlan, currentPl: 10200 };
      const trades = [{
        id: 't1', planId: 'plan1', result: 200,
        entry: 5000, stopLoss: null, qty: 1,
        tickerRule: winfutTicker,
        riskPercent: null, // correto DEC-006 win
        rrRatio: 2.0,
        rrAssumed: true,
        compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
      }];

      const result = diagnosePlanPure(plan, trades);

      // rrAssumed trade: CF guard preserva rrRatio, não diverge
      expect(result.trades.divergent).toBe(0);
    });
  });

  describe('Combinações ida + volta', () => {
    it('PL divergente + compliance divergente → ambos reportados', () => {
      const plan = { ...basePlan, currentPl: 10500 }; // PL errado
      const trades = [{
        id: 't1', planId: 'plan1', result: -200,
        entry: 5000, stopLoss: null, qty: 1,
        riskPercent: 100, // compliance desatualizado
        compliance: { roStatus: 'FORA_DO_PLANO', rrStatus: 'CONFORME' },
      }];

      const result = diagnosePlanPure(plan, trades);

      expect(result.pl.divergent).toBe(true);
      expect(result.trades.divergent).toBe(1);
    });

    it('tudo saudável → pl.divergent false + trades.divergent 0', () => {
      const plan = { ...basePlan, currentPl: 10200 };
      // RR via resultado efetivo: 200/(1*1)*5=1000, 1000/50=20.0
      const trades = [{
        id: 't1', planId: 'plan1', result: 200,
        entry: 5000, stopLoss: 4950, qty: 1,
        tickerRule: winfutTicker,
        riskPercent: 0.1,
        rrRatio: 20.0,
        compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
      }];

      const result = diagnosePlanPure(plan, trades);

      expect(result.pl.divergent).toBe(false);
      expect(result.trades.divergent).toBe(0);
    });
  });
});
