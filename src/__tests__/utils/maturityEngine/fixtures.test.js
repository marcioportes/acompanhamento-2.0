import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeTrade,
  makeTradeSeries,
  makeBaselineScores,
  resetFixtureCounter,
} from '../../../utils/maturityEngine/fixtures';

describe('fixtures builder', () => {
  beforeEach(() => {
    resetFixtureCounter();
  });

  it('makeTrade retorna objeto com defaults razoáveis', () => {
    const t = makeTrade();
    expect(t.id).toBe('trade-000001');
    expect(t.date).toBe('2026-01-15');
    expect(t.pl).toBe(100);
    expect(t.setup).toBe('rompimento');
    expect(t.status).toBe('CLOSED');
    expect(t.stopLoss).toBe(95);
    expect(t.emotionEntry).toBe('neutro');
    expect(t.emotionExit).toBe('neutro');
    expect(t.notes).toBe('');
    expect(t.planId).toBe('plan-default');
    expect(t.symbol).toBe('WIN');
  });

  it('makeTrade aceita merge raso de overrides', () => {
    const t = makeTrade({ pl: -50, setup: 'pullback', notes: 'abc' });
    expect(t.pl).toBe(-50);
    expect(t.setup).toBe('pullback');
    expect(t.notes).toBe('abc');
    expect(t.date).toBe('2026-01-15'); // default preservado
  });

  it('makeTradeSeries gera trades em dias úteis consecutivos, pulando sábado e domingo', () => {
    // 2026-01-01 é quinta-feira; 01-03 sáb; 01-04 dom; 01-05 seg
    const series = makeTradeSeries({ count: 5, startDate: '2026-01-01' });
    const dates = series.map((t) => t.date);
    expect(dates).toEqual([
      '2026-01-01', // Thu
      '2026-01-02', // Fri
      '2026-01-05', // Mon (skip Sat/Sun)
      '2026-01-06', // Tue
      '2026-01-07', // Wed
    ]);
  });

  it('makeTradeSeries ajusta startDate que cai em fim-de-semana para próximo dia útil', () => {
    // 2026-01-03 é sábado → deve começar em 2026-01-05 (segunda)
    const series = makeTradeSeries({ count: 2, startDate: '2026-01-03' });
    expect(series[0].date).toBe('2026-01-05');
    expect(series[1].date).toBe('2026-01-06');
  });

  it('makeTradeSeries aplica plPattern positive', () => {
    const series = makeTradeSeries({ count: 5, plPattern: 'positive' });
    expect(series.map((t) => t.pl)).toEqual([50, 60, 70, 80, 90]);
  });

  it('makeTradeSeries aplica plPattern negative, mixed e flat', () => {
    const neg = makeTradeSeries({ count: 3, plPattern: 'negative' });
    expect(neg.map((t) => t.pl)).toEqual([-50, -60, -70]);

    const mixed = makeTradeSeries({ count: 4, plPattern: 'mixed' });
    expect(mixed.map((t) => t.pl)).toEqual([80, -60, 80, -60]);

    const flat = makeTradeSeries({ count: 3, plPattern: 'flat' });
    expect(flat.map((t) => t.pl)).toEqual([0, 0, 0]);
  });

  it('makeTradeSeries aceita função custom em plPattern e setup', () => {
    const series = makeTradeSeries({
      count: 3,
      plPattern: (i) => i * 10,
      setup: (i) => (i % 2 === 0 ? 'A' : 'B'),
    });
    expect(series.map((t) => t.pl)).toEqual([0, 10, 20]);
    expect(series.map((t) => t.setup)).toEqual(['A', 'B', 'A']);
  });

  it('resetFixtureCounter reinicia numeração de ids', () => {
    const t1 = makeTrade();
    const t2 = makeTrade();
    expect(t1.id).toBe('trade-000001');
    expect(t2.id).toBe('trade-000002');
    resetFixtureCounter();
    const t3 = makeTrade();
    expect(t3.id).toBe('trade-000001');
  });

  it('makeBaselineScores retorna defaults 50 e aceita overrides', () => {
    expect(makeBaselineScores()).toEqual({ emotional: 50, financial: 50, operational: 50 });
    expect(makeBaselineScores({ emotional: 70 })).toEqual({
      emotional: 70,
      financial: 50,
      operational: 50,
    });
  });

  it('makeTradeSeries lança para count inválido', () => {
    expect(() => makeTradeSeries({ count: -1 })).toThrow();
    expect(() => makeTradeSeries({ count: 2.5 })).toThrow();
  });
});
