/**
 * Tests: calculateMaxDrawdown
 * @description Testa cálculo peak-to-trough de drawdown máximo
 * 
 * Cenários:
 * - Série com drawdown conhecido → valor, %, data corretos
 * - Série só positiva → maxDD = 0
 * - Lista vazia → defaults seguros
 * - Single trade → edge case
 * - Múltiplos drawdowns → pega o maior
 */

import { describe, it, expect } from 'vitest';
import { calculateMaxDrawdown } from '../../utils/dashboardMetrics';

describe('calculateMaxDrawdown', () => {

  it('série com drawdown conhecido → peak-to-trough correto', () => {
    const trades = [
      { result: 100, date: '2026-01-01' },   // cumPnL: 100, peak: 100
      { result: 200, date: '2026-01-02' },   // cumPnL: 300, peak: 300
      { result: -150, date: '2026-01-03' },  // cumPnL: 150, DD: 150
      { result: -100, date: '2026-01-04' },  // cumPnL: 50,  DD: 250 ← max
      { result: 500, date: '2026-01-05' },   // cumPnL: 550, peak: 550
    ];

    const { maxDD, maxDDDate } = calculateMaxDrawdown(trades);

    expect(maxDD).toBe(250);
    expect(maxDDDate).toBe('2026-01-04');
  });

  it('calcula maxDDPercent corretamente com initialBalance', () => {
    const trades = [
      { result: 100, date: '2026-01-01' },
      { result: -200, date: '2026-01-02' },  // cumPnL: -100, peak was 100, DD: 200
    ];

    const { maxDD, maxDDPercent } = calculateMaxDrawdown(trades, 10000);

    expect(maxDD).toBe(200);
    expect(maxDDPercent).toBe(2.0);  // 200/10000 * 100
  });

  it('série sem drawdown (só trades positivos) → maxDD = 0', () => {
    const trades = [
      { result: 100, date: '2026-01-01' },
      { result: 200, date: '2026-01-02' },
      { result: 50, date: '2026-01-03' },
    ];

    const { maxDD, maxDDDate } = calculateMaxDrawdown(trades);

    expect(maxDD).toBe(0);
    expect(maxDDDate).toBeNull();
  });

  it('lista vazia → defaults seguros', () => {
    const result = calculateMaxDrawdown([]);

    expect(result.maxDD).toBe(0);
    expect(result.maxDDPercent).toBe(0);
    expect(result.maxDDDate).toBeNull();
  });

  it('null/undefined → defaults seguros', () => {
    expect(calculateMaxDrawdown(null).maxDD).toBe(0);
    expect(calculateMaxDrawdown(undefined).maxDD).toBe(0);
  });

  it('single trade negativo → drawdown = abs(result)', () => {
    const trades = [{ result: -50, date: '2026-01-01' }];

    const { maxDD, maxDDDate } = calculateMaxDrawdown(trades);

    // cumPnL: -50, peak: 0 (starts at 0), DD: 50
    expect(maxDD).toBe(50);
    expect(maxDDDate).toBe('2026-01-01');
  });

  it('single trade positivo → maxDD = 0', () => {
    const trades = [{ result: 100, date: '2026-01-01' }];

    expect(calculateMaxDrawdown(trades).maxDD).toBe(0);
  });

  it('múltiplos drawdowns → pega o maior', () => {
    const trades = [
      { result: 500, date: '2026-01-01' },   // peak: 500
      { result: -200, date: '2026-01-02' },  // DD: 200
      { result: 400, date: '2026-01-03' },   // peak: 700
      { result: -300, date: '2026-01-04' },  // DD: 300 ← maior
      { result: 100, date: '2026-01-05' },   // DD: 200
    ];

    const { maxDD, maxDDDate } = calculateMaxDrawdown(trades);

    expect(maxDD).toBe(300);
    expect(maxDDDate).toBe('2026-01-04');
  });

  it('trades desordenados → ordena internamente por data', () => {
    // Mesmo cenário do primeiro teste, mas fora de ordem
    const trades = [
      { result: 500, date: '2026-01-05' },
      { result: 100, date: '2026-01-01' },
      { result: -100, date: '2026-01-04' },
      { result: -150, date: '2026-01-03' },
      { result: 200, date: '2026-01-02' },
    ];

    const { maxDD, maxDDDate } = calculateMaxDrawdown(trades);

    expect(maxDD).toBe(250);
    expect(maxDDDate).toBe('2026-01-04');
  });

  it('initialBalance = 0 → maxDDPercent = 0 (evita divisão por zero)', () => {
    const trades = [
      { result: 100, date: '2026-01-01' },
      { result: -200, date: '2026-01-02' },
    ];

    const { maxDDPercent } = calculateMaxDrawdown(trades, 0);

    expect(maxDDPercent).toBe(0);
  });

  it('trades com result undefined/null → trata como 0', () => {
    const trades = [
      { result: 100, date: '2026-01-01' },
      { result: undefined, date: '2026-01-02' },
      { result: null, date: '2026-01-03' },
      { result: -50, date: '2026-01-04' },
    ];

    const { maxDD } = calculateMaxDrawdown(trades);

    // cumPnL: 100, 100, 100, 50 → peak=100, DD=50
    expect(maxDD).toBe(50);
  });

  it('drawdown progressivo sem recuperação → rastreia pior ponto', () => {
    const trades = [
      { result: -100, date: '2026-01-01' },
      { result: -100, date: '2026-01-02' },
      { result: -100, date: '2026-01-03' },
    ];

    const { maxDD, maxDDDate } = calculateMaxDrawdown(trades);

    // peak=0, cumPnL: -100, -200, -300 → DD=300 no último
    expect(maxDD).toBe(300);
    expect(maxDDDate).toBe('2026-01-03');
  });
});
