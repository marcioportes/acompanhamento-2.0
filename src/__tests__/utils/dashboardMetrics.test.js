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
import {
  calculateMaxDrawdown,
  calculateConsistencyCV,
  calculateDurationDelta,
} from '../../utils/dashboardMetrics';

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

/**
 * Tests: calculateConsistencyCV (E2 — issue #164)
 * @description Coeficiente de Variação do P&L por trade.
 * CV = std(results) / |mean(results)|
 * Semáforo (DEC-050): <0.5 consistent · 0.5–1.0 moderate · >1.0 erratic
 */
describe('calculateConsistencyCV', () => {

  it('série uniforme com expectância positiva → CV baixo (consistente)', () => {
    const trades = [
      { result: 100 },
      { result: 110 },
      { result: 90 },
      { result: 105 },
      { result: 95 },
    ];

    const cv = calculateConsistencyCV(trades);

    expect(cv).not.toBeNull();
    expect(cv.cv).toBeLessThan(0.5);
    expect(cv.level).toBe('consistent');
    expect(cv.mean).toBe(100);
    expect(cv.count).toBe(5);
  });

  it('série moderadamente dispersa → level moderate', () => {
    // mean = 100, dispersão tal que CV cai entre 0.5 e 1.0
    const trades = [
      { result: 200 },
      { result: 50 },
      { result: 150 },
      { result: 30 },
      { result: 70 },
    ];

    const cv = calculateConsistencyCV(trades);

    expect(cv).not.toBeNull();
    expect(cv.cv).toBeGreaterThanOrEqual(0.5);
    expect(cv.cv).toBeLessThanOrEqual(1.0);
    expect(cv.level).toBe('moderate');
  });

  it('série altamente dispersa → level erratic', () => {
    // Mistura grande de wins/losses com magnitudes muito diferentes
    const trades = [
      { result: 500 },
      { result: -300 },
      { result: 50 },
      { result: -400 },
      { result: 700 },
      { result: -50 },
    ];

    const cv = calculateConsistencyCV(trades);

    expect(cv).not.toBeNull();
    expect(cv.cv).toBeGreaterThan(1.0);
    expect(cv.level).toBe('erratic');
  });

  it('lista vazia → null', () => {
    expect(calculateConsistencyCV([])).toBeNull();
    expect(calculateConsistencyCV(null)).toBeNull();
    expect(calculateConsistencyCV(undefined)).toBeNull();
  });

  it('1 trade só → null (CV exige variância)', () => {
    expect(calculateConsistencyCV([{ result: 100 }])).toBeNull();
  });

  it('mean = 0 (wins e losses se anulam) → null (CV indefinido)', () => {
    const trades = [
      { result: 100 },
      { result: -100 },
    ];

    expect(calculateConsistencyCV(trades)).toBeNull();
  });

  it('ignora result inválido (null, undefined, NaN) sem quebrar', () => {
    const trades = [
      { result: 100 },
      { result: null },
      { result: undefined },
      { result: NaN },
      { result: 110 },
      { result: 90 },
    ];

    const cv = calculateConsistencyCV(trades);

    expect(cv).not.toBeNull();
    expect(cv.count).toBe(3);
    expect(cv.mean).toBe(100);
  });

  it('expectância negativa (mean < 0) usa |mean| no denominador', () => {
    // Trader perdedor — toda a série negativa, ainda dá pra medir consistência da perda
    const trades = [
      { result: -100 },
      { result: -110 },
      { result: -90 },
      { result: -105 },
      { result: -95 },
    ];

    const cv = calculateConsistencyCV(trades);

    expect(cv).not.toBeNull();
    expect(cv.mean).toBe(-100);
    expect(cv.cv).toBeLessThan(0.5);
    expect(cv.level).toBe('consistent');
  });

  it('coverage do limite exato 0.5 → moderate (inclusive)', () => {
    // Construir série com CV exatamente 0.5: mean=100, std=50
    // Para n=2: std=|x1-x2|/2 (com divisão por n, não n-1). |x1-x2|/2 = 50 → |x1-x2|=100
    // x1=150, x2=50 → mean=100, var=2500, std=50, CV=0.5
    const trades = [{ result: 150 }, { result: 50 }];

    const cv = calculateConsistencyCV(trades);

    expect(cv.cv).toBe(0.5);
    expect(cv.level).toBe('moderate');
  });

  it('coverage do limite exato 1.0 → moderate (inclusive)', () => {
    // mean=100, std=100. Para n=2: |x1-x2|/2 = 100 → |x1-x2|=200
    // x1=200, x2=0 → mean=100, var=10000, std=100, CV=1.0
    const trades = [{ result: 200 }, { result: 0 }];

    const cv = calculateConsistencyCV(trades);

    expect(cv.cv).toBe(1.0);
    expect(cv.level).toBe('moderate');
  });
});

/**
 * Tests: calculateDurationDelta (E2 — issue #164)
 * @description Delta de tempo médio entre wins e losses.
 * deltaPercent = (durationWin - durationLoss) / durationLoss × 100
 * Semáforo: >+20% winners-run · -10% a +20% neutral · <-10% holding-losses
 */
describe('calculateDurationDelta', () => {

  it('winners run (W muito > L) → level winners-run', () => {
    const avgTradeDuration = { win: 12, loss: 5, all: 8.5, count: 10 };

    const delta = calculateDurationDelta(avgTradeDuration);

    expect(delta).not.toBeNull();
    expect(delta.deltaPercent).toBe(140); // (12-5)/5 * 100
    expect(delta.level).toBe('winners-run');
    expect(delta.durationWin).toBe(12);
    expect(delta.durationLoss).toBe(5);
  });

  it('tempos próximos (delta entre -10% e +20%) → level neutral', () => {
    const avgTradeDuration = { win: 10.5, loss: 10, all: 10.25, count: 8 };

    const delta = calculateDurationDelta(avgTradeDuration);

    expect(delta.deltaPercent).toBe(5);
    expect(delta.level).toBe('neutral');
  });

  it('aluno segura loss (W < L) → level holding-losses', () => {
    const avgTradeDuration = { win: 5, loss: 15, all: 10, count: 6 };

    const delta = calculateDurationDelta(avgTradeDuration);

    expect(delta.deltaPercent).toBeCloseTo(-66.67, 2);
    expect(delta.level).toBe('holding-losses');
  });

  it('input null/undefined → null', () => {
    expect(calculateDurationDelta(null)).toBeNull();
    expect(calculateDurationDelta(undefined)).toBeNull();
  });

  it('win ou loss null → null', () => {
    expect(calculateDurationDelta({ win: null, loss: 10 })).toBeNull();
    expect(calculateDurationDelta({ win: 10, loss: null })).toBeNull();
    expect(calculateDurationDelta({ win: undefined, loss: 5 })).toBeNull();
  });

  it('loss = 0 → null (divisão por zero)', () => {
    expect(calculateDurationDelta({ win: 10, loss: 0 })).toBeNull();
  });

  it('limite exato +20% → neutral (inclusive — boundary >20 é winners-run)', () => {
    // (12 - 10) / 10 * 100 = 20%
    const avgTradeDuration = { win: 12, loss: 10 };

    const delta = calculateDurationDelta(avgTradeDuration);

    expect(delta.deltaPercent).toBe(20);
    expect(delta.level).toBe('neutral');
  });

  it('limite exato -10% → neutral (inclusive — boundary <-10 é holding-losses)', () => {
    // (9 - 10) / 10 * 100 = -10%
    const avgTradeDuration = { win: 9, loss: 10 };

    const delta = calculateDurationDelta(avgTradeDuration);

    expect(delta.deltaPercent).toBe(-10);
    expect(delta.level).toBe('neutral');
  });

  it('logo acima de +20% → winners-run', () => {
    // (12.1 - 10) / 10 = 21%
    const avgTradeDuration = { win: 12.1, loss: 10 };

    const delta = calculateDurationDelta(avgTradeDuration);

    expect(delta.level).toBe('winners-run');
  });

  it('logo abaixo de -10% → holding-losses', () => {
    // (8.9 - 10) / 10 = -11%
    const avgTradeDuration = { win: 8.9, loss: 10 };

    const delta = calculateDurationDelta(avgTradeDuration);

    expect(delta.level).toBe('holding-losses');
  });
});
