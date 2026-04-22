/**
 * Tests: buildEmotionMatrix4D -- issue #164 E3
 *
 * Agrega trades por emoção de entrada e calcula 4 micro-KPIs por dimensão 4D:
 *  - FINANCIAL    → expectancy + payoff
 *  - OPERATIONAL  → shiftRate (emotionEntry ≠ emotionExit)
 *  - EMOTIONAL    → wrEmotion + wrDelta (vs globalWR)
 *  - MATURITY     → sparklineSeries (últimos N trades da emoção, PL acumulado)
 */

import { describe, it, expect } from 'vitest';
import { buildEmotionMatrix4D } from '../../utils/emotionMatrix4D';

const mkTrade = (overrides = {}) => ({
  result: 0,
  emotionEntry: 'Calmo',
  date: '2026-04-01',
  ...overrides,
});

describe('buildEmotionMatrix4D', () => {
  it('trades vazio devolve []', () => {
    expect(buildEmotionMatrix4D([])).toEqual([]);
    expect(buildEmotionMatrix4D(null)).toEqual([]);
    expect(buildEmotionMatrix4D(undefined)).toEqual([]);
  });

  it('calcula expectancy, wr e totalPL para 1 emoção', () => {
    const trades = [
      mkTrade({ result: 100 }),
      mkTrade({ result: 200 }),
      mkTrade({ result: -50 }),
      mkTrade({ result: -50 }),
    ];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.name).toBe('Calmo');
    expect(calmo.count).toBe(4);
    expect(calmo.wins).toBe(2);
    expect(calmo.totalPL).toBe(200);
    expect(calmo.expectancy).toBe(50); // 200/4
    expect(calmo.wrEmotion).toBe(50);
  });

  it('ordena resultado por totalPL desc', () => {
    const trades = [
      mkTrade({ emotionEntry: 'Ansioso', result: -100 }),
      mkTrade({ emotionEntry: 'Calmo', result: 300 }),
      mkTrade({ emotionEntry: 'Focado', result: 50 }),
    ];
    const result = buildEmotionMatrix4D(trades);
    expect(result.map((r) => r.name)).toEqual(['Calmo', 'Focado', 'Ansioso']);
  });

  it('shiftRate = % trades com emotionExit diferente de emotionEntry', () => {
    // 5 trades 'Calmo' entry, 2 deles encerram 'Ansioso' → shiftRate 40%
    const trades = [
      mkTrade({ emotionEntry: 'Calmo', emotionExit: 'Calmo', result: 10 }),
      mkTrade({ emotionEntry: 'Calmo', emotionExit: 'Calmo', result: 10 }),
      mkTrade({ emotionEntry: 'Calmo', emotionExit: 'Calmo', result: 10 }),
      mkTrade({ emotionEntry: 'Calmo', emotionExit: 'Ansioso', result: -5 }),
      mkTrade({ emotionEntry: 'Calmo', emotionExit: 'Ansioso', result: -5 }),
    ];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.shiftRate).toBe(40);
  });

  it('shiftRate ignora diferença de case (calmo === Calmo)', () => {
    const trades = [
      mkTrade({ emotionEntry: 'Calmo', emotionExit: 'calmo', result: 10 }),
      mkTrade({ emotionEntry: 'Calmo', emotionExit: 'CALMO', result: 10 }),
    ];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.shiftRate).toBe(0);
  });

  it('trades sem emotionExit contam como shift=false', () => {
    const trades = [
      mkTrade({ emotionEntry: 'Calmo', result: 10 }),
      mkTrade({ emotionEntry: 'Calmo', result: 10 }),
      mkTrade({ emotionEntry: 'Calmo', emotionExit: '', result: -5 }),
    ];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.shiftRate).toBe(0);
  });

  it('payoff = |avgWin| / |avgLoss|', () => {
    const trades = [
      mkTrade({ result: 300 }), // avgWin = 250
      mkTrade({ result: 200 }),
      mkTrade({ result: -100 }), // avgLoss = 100
      mkTrade({ result: -100 }),
    ];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.payoff).toBeCloseTo(2.5, 2);
  });

  it('payoff é null se só há wins', () => {
    const trades = [mkTrade({ result: 100 }), mkTrade({ result: 200 })];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.payoff).toBeNull();
  });

  it('payoff é null se só há losses', () => {
    const trades = [mkTrade({ result: -100 }), mkTrade({ result: -200 })];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.payoff).toBeNull();
  });

  it('payoff é null se avgLoss = 0 (loss de valor zero)', () => {
    const trades = [mkTrade({ result: 100 }), mkTrade({ result: 0 })];
    const [calmo] = buildEmotionMatrix4D(trades);
    // 0 não conta como win nem loss → só 1 win → payoff null
    expect(calmo.payoff).toBeNull();
  });

  it('wrDelta = wrEmotion - globalWR', () => {
    const trades = [
      mkTrade({ result: 10 }),
      mkTrade({ result: 10 }),
      mkTrade({ result: 10 }),
      mkTrade({ result: -5 }),
      mkTrade({ result: -5 }),
    ];
    // WR dessa emoção = 60%
    const [calmo] = buildEmotionMatrix4D(trades, { globalWR: 50 });
    expect(calmo.wrDelta).toBeCloseTo(10, 2);
  });

  it('wrDelta é null quando globalWR ausente', () => {
    const trades = [mkTrade({ result: 10 }), mkTrade({ result: -5 })];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.wrDelta).toBeNull();
  });

  it('sparklineSeries com sparklineWindow=10 devolve últimos 10 trades cumulativos', () => {
    // 15 trades de result=10 cada → últimos 10 → cumPL final = 100
    const trades = Array.from({ length: 15 }, (_, i) => ({
      result: 10,
      emotionEntry: 'Calmo',
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
    }));
    const [calmo] = buildEmotionMatrix4D(trades, { sparklineWindow: 10 });
    expect(calmo.sparklineSeries).toHaveLength(10);
    expect(calmo.sparklineSeries[0].cumPL).toBe(10);
    expect(calmo.sparklineSeries[9].cumPL).toBe(100);
  });

  it('sparklineSeries com 1 trade devolve 1 ponto', () => {
    const trades = [mkTrade({ result: 42, date: '2026-04-01' })];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.sparklineSeries).toHaveLength(1);
    expect(calmo.sparklineSeries[0].cumPL).toBe(42);
  });

  it('sparklineSeries ordenada por data ASC', () => {
    const trades = [
      mkTrade({ result: 30, date: '2026-04-10' }),
      mkTrade({ result: 10, date: '2026-04-01' }),
      mkTrade({ result: 20, date: '2026-04-05' }),
    ];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.sparklineSeries.map((p) => p.date)).toEqual([
      '2026-04-01',
      '2026-04-05',
      '2026-04-10',
    ]);
    expect(calmo.sparklineSeries.map((p) => p.cumPL)).toEqual([10, 30, 60]);
  });

  it('normaliza CALMO/calmo/Calmo no mesmo grupo', () => {
    const trades = [
      mkTrade({ emotionEntry: 'CALMO', result: 10 }),
      mkTrade({ emotionEntry: 'calmo', result: 20 }),
      mkTrade({ emotionEntry: 'Calmo', result: 30 }),
    ];
    const result = buildEmotionMatrix4D(trades);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Calmo');
    expect(result[0].count).toBe(3);
    expect(result[0].totalPL).toBe(60);
  });

  it('fallback para emotion legado quando emotionEntry ausente', () => {
    const trades = [
      { result: 100, emotion: 'Focado', date: '2026-04-01' },
      { result: 200, emotion: 'focado', date: '2026-04-02' },
    ];
    const [focado] = buildEmotionMatrix4D(trades);
    expect(focado.name).toBe('Focado');
    expect(focado.count).toBe(2);
  });

  it('emotionEntry e emotion ausentes → "Não Informado"', () => {
    const trades = [
      { result: 10, date: '2026-04-01' },
      { result: 20, date: '2026-04-02' },
    ];
    const [ni] = buildEmotionMatrix4D(trades);
    expect(ni.name).toBe('Não Informado');
    expect(ni.count).toBe(2);
  });

  it('preserva múltiplas emoções com cálculos independentes', () => {
    const trades = [
      // Calmo: 2 wins, 1 loss
      mkTrade({ emotionEntry: 'Calmo', result: 100 }),
      mkTrade({ emotionEntry: 'Calmo', result: 200 }),
      mkTrade({ emotionEntry: 'Calmo', result: -50 }),
      // Ansioso: 1 win, 2 losses
      mkTrade({ emotionEntry: 'Ansioso', result: 50 }),
      mkTrade({ emotionEntry: 'Ansioso', result: -100 }),
      mkTrade({ emotionEntry: 'Ansioso', result: -100 }),
    ];
    const result = buildEmotionMatrix4D(trades, { globalWR: 50 });
    const calmo = result.find((r) => r.name === 'Calmo');
    const ansioso = result.find((r) => r.name === 'Ansioso');
    expect(calmo.wrEmotion).toBeCloseTo(66.67, 1);
    expect(ansioso.wrEmotion).toBeCloseTo(33.33, 1);
    expect(calmo.wrDelta).toBeCloseTo(16.67, 1);
    expect(ansioso.wrDelta).toBeCloseTo(-16.67, 1);
  });

  it('expectancy com valores mistos', () => {
    const trades = [
      mkTrade({ result: 200 }),
      mkTrade({ result: -100 }),
      mkTrade({ result: -100 }),
    ];
    const [calmo] = buildEmotionMatrix4D(trades);
    expect(calmo.expectancy).toBeCloseTo(0, 2); // (200-100-100)/3 = 0
  });
});
