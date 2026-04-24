import { describe, it, expect } from 'vitest';
import { computeDailyReturns } from '../../../utils/maturityEngine/helpers';

describe('computeDailyReturns', () => {
  it('retorna array vazio para lista de trades vazia', () => {
    expect(computeDailyReturns([], 10000)).toEqual([]);
    expect(computeDailyReturns(null, 10000)).toEqual([]);
    expect(computeDailyReturns(undefined, 10000)).toEqual([]);
  });

  it('calcula retorno do dia único como PL/initialBalance', () => {
    const trades = [{ date: '2026-01-15', pl: 100 }];
    const out = computeDailyReturns(trades, 10000);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-01-15');
    expect(out[0].r).toBeCloseTo(0.01, 10);
  });

  it('rola balance_inicio_dia ao longo de múltiplos dias', () => {
    const trades = [
      { date: '2026-01-15', pl: 100 },
      { date: '2026-01-16', pl: 200 },
      { date: '2026-01-19', pl: -50 },
    ];
    const out = computeDailyReturns(trades, 10000);
    expect(out).toHaveLength(3);
    expect(out[0].r).toBeCloseTo(100 / 10000, 10);
    expect(out[1].r).toBeCloseTo(200 / 10100, 10);
    expect(out[2].r).toBeCloseTo(-50 / 10300, 10);
    expect(out.map((x) => x.date)).toEqual(['2026-01-15', '2026-01-16', '2026-01-19']);
  });

  it('ignora trades sem data e sem PL numérico', () => {
    const trades = [
      { pl: 100 }, // sem date
      { date: '2026-01-15', pl: 'nope' }, // pl não-numérico
      { date: '2026-01-15' }, // sem pl
      { date: '2026-01-15', pl: 75 }, // válido
    ];
    const out = computeDailyReturns(trades, 10000);
    expect(out).toHaveLength(1);
    expect(out[0].r).toBeCloseTo(75 / 10000, 10);
  });

  it('aceita data BR (DD/MM/YYYY) e ISO (YYYY-MM-DD), normalizando para ISO', () => {
    const trades = [
      { date: '15/01/2026', pl: 60 },
      { date: '2026-01-15', pl: 40 },
      { date: '16/01/2026', pl: 100 },
    ];
    const out = computeDailyReturns(trades, 10000);
    expect(out).toHaveLength(2);
    expect(out[0].date).toBe('2026-01-15');
    expect(out[0].r).toBeCloseTo(100 / 10000, 10);
    expect(out[1].date).toBe('2026-01-16');
    expect(out[1].r).toBeCloseTo(100 / 10100, 10);
  });

  it('agrega múltiplos trades do mesmo dia', () => {
    const trades = [
      { date: '2026-01-15', pl: 30 },
      { date: '2026-01-15', pl: 70 },
    ];
    const out = computeDailyReturns(trades, 10000);
    expect(out).toHaveLength(1);
    expect(out[0].r).toBeCloseTo(100 / 10000, 10);
  });

  it('aceita PL zero (não é tratado como ausente)', () => {
    const trades = [{ date: '2026-01-15', pl: 0 }];
    const out = computeDailyReturns(trades, 10000);
    expect(out).toHaveLength(1);
    expect(out[0].r).toBe(0);
  });
});
