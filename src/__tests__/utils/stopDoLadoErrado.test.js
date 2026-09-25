/**
 * #467 (épico #462 F4) — stop do lado ERRADO da entrada é "sem stop", nunca risco.
 *
 * Antes, todo cálculo de risco era `Math.abs(entrada − stop)`: um SHORT a 185.070 com stop
 * digitado a 184.000 (abaixo da entrada, do lado do ganho) virava 1.070 pts de "risco",
 * risco % inflado, R:R com denominador inventado e nenhuma flag de sem stop. A conta é
 * uma só agora — `stopDistanceOf` — no cliente e no servidor (espelho CJS).
 */
import { describe, it, expect } from 'vitest';
import { stopDistanceOf } from '../../utils/orderProtection';
import { calculateTradeCompliance, generateComplianceRedFlags, realizedRR } from '../../utils/compliance';
import { rrBreakdown } from '../../utils/rrBreakdown';
import { calculateRiskPercent, calculateRiskReward } from '../../utils/tradeCalculations';

const cjsProtection = require('../../../functions/shared/orderProtection');
const cjsRR = require('../../../functions/shared/realizedRR');

const plan = { pl: 10000, riskPerOperation: 1, rrTarget: 2 };
const tickerRule = { tickSize: 5, tickValue: 1, pointValue: 0.2 };

describe('stopDistanceOf — a conta única (ESM e CJS)', () => {
  const casos = [
    ['LONG', 100, 95, 5],
    ['SHORT', 100, 105, 5],
    ['LONG', 100, 105, null],   // stop acima da entrada num LONG: de ganho
    ['SHORT', 100, 95, null],   // stop abaixo da entrada num SHORT: de ganho
    ['LONG', 100, 100, null],   // na entrada: não arrisca nada
    ['SHORT', '100', '105', 5], // string do formulário
    ['LONG', 100, null, null],
    ['LONG', 100, 0, null],
    ['LONG', 100, '', null],
    [undefined, 100, 95, null], // lado desconhecido não prova nada
  ];
  it.each(casos)('%s entrada %s stop %s → %s', (side, entry, stop, esperado) => {
    expect(stopDistanceOf(side, entry, stop)).toBe(esperado);
    expect(cjsProtection.stopDistanceOf(side, entry, stop)).toBe(esperado);
  });
});

describe('compliance — stop do lado errado segue o caminho "sem stop"', () => {
  const base = { entry: 185070, exit: 184900, qty: 5, tickerRule };

  it('SHORT com stop abaixo da entrada, em ganho: sem risco inventado, NO_STOP', () => {
    const trade = { ...base, side: 'SHORT', stopLoss: 184000, result: 170 };
    const errado = calculateTradeCompliance(trade, plan);
    const semStop = calculateTradeCompliance({ ...trade, stopLoss: null }, plan);
    expect(errado).toEqual(semStop);
    expect(errado.riskPercent).toBeNull();
    expect(errado.rrAssumed).toBe(true);
    const flags = generateComplianceRedFlags(trade, plan, errado).map(f => f.type);
    expect(flags).toContain('TRADE_SEM_STOP');
  });

  it('LONG com stop acima da entrada, em loss: risco retroativo (stop implícito), sem NO_STOP', () => {
    const trade = { entry: 100, exit: 90, qty: 1, side: 'LONG', stopLoss: 110, result: -50 };
    const c = calculateTradeCompliance(trade, plan);
    expect(c).toEqual(calculateTradeCompliance({ ...trade, stopLoss: null }, plan));
    expect(c.riskPercent).toBeCloseTo(0.5);
    expect(generateComplianceRedFlags(trade, plan, c).map(f => f.type)).not.toContain('TRADE_SEM_STOP');
  });

  it('stop do lado certo continua medindo risco', () => {
    const trade = { ...base, side: 'SHORT', stopLoss: 185135, result: 170 };
    const c = calculateTradeCompliance(trade, plan);
    // 65 pts / 5 × 1 × 5 contratos = R$ 65 → 0,65% de 10.000
    expect(c.riskPercent).toBeCloseTo(0.65);
    expect(c.rrAssumed).toBe(false);
    expect(generateComplianceRedFlags(trade, plan, c).map(f => f.type)).not.toContain('TRADE_SEM_STOP');
  });
});

describe('R:R, risco % e decomposição usam a mesma conta', () => {
  it('realizedRR (ESM e CJS): stop do lado errado → null', () => {
    const t = { side: 'SHORT', entry: 100, exit: 90, stopLoss: 95 };
    expect(realizedRR(t)).toBeNull();
    expect(cjsRR.realizedRR(t)).toBeNull();
    const ok = { ...t, stopLoss: 105 };
    expect(realizedRR(ok)).toBe(2);
    expect(cjsRR.realizedRR(ok)).toBe(2);
  });

  it('rrBreakdown: stop do lado errado não vira risco assumido', () => {
    const r = rrBreakdown({ side: 'LONG', entry: 100, exit: 110, stopLoss: 105, qty: 1, result: 10 }, plan);
    expect(r.riskAmount).toBeNull();
    expect(r.rrTaken).toBeNull();
  });

  it('tradeCalculations: risco % 0 e R:R null com stop do lado errado', () => {
    expect(calculateRiskPercent({ side: 'LONG', entry: 100, stopLoss: 105, qty: 1, accountBalance: 1000 })).toBe(0);
    expect(calculateRiskPercent({ side: 'LONG', entry: 100, stopLoss: 95, qty: 1, accountBalance: 1000 })).toBeCloseTo(0.5);
    expect(calculateRiskReward({ side: 'SHORT', entry: 100, stopLoss: 95, takeProfit: 90 })).toBeNull();
    expect(calculateRiskReward({ side: 'SHORT', entry: 100, stopLoss: 105, takeProfit: 90 })).toBe(2);
  });
});
