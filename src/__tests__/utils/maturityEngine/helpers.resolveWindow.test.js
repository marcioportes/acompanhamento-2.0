import { describe, it, expect } from 'vitest';
import { resolveWindow } from '../../../utils/maturityEngine/helpers';
import { STAGE_WINDOWS } from '../../../utils/maturityEngine/constants';

// Helper: gera ISO YYYY-MM-DD subtraindo `daysAgo` de `refIso`.
function isoMinus(refIso, daysAgo) {
  const d = new Date(`${refIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const NOW = '2026-04-23';

describe('resolveWindow', () => {
  it('lista vazia → windowSize 0 e sparseSample true', () => {
    const { window, windowSize, sparseSample } = resolveWindow([], 3, NOW);
    expect(window).toEqual([]);
    expect(windowSize).toBe(0);
    expect(sparseSample).toBe(true);
  });

  it('3 trades (abaixo do floor=5) → sparseSample true', () => {
    const trades = [
      { id: 'a', date: isoMinus(NOW, 1), pl: 10 },
      { id: 'b', date: isoMinus(NOW, 2), pl: 20 },
      { id: 'c', date: isoMinus(NOW, 3), pl: 30 },
    ];
    const out = resolveWindow(trades, 1, NOW);
    expect(out.windowSize).toBe(3);
    expect(out.sparseSample).toBe(true);
  });

  it('stage 1 (minTrades=20, minDays=30): 40 trades em 100 dias → pega o MAIOR (byDays preferencialmente)', () => {
    // 40 trades espaçados 2.5 dias (100 dias total, mais recente é ontem)
    const trades = Array.from({ length: 40 }, (_, i) => ({
      id: `t${i}`,
      date: isoMinus(NOW, Math.round((39 - i) * 2.5)),
      pl: 10,
    }));
    const out = resolveWindow(trades, 1, NOW);
    // minDays=30 → cutoff = NOW - 30 dias. Trades com daysAgo <= 30 entram.
    // daysAgo = (39 - i) * 2.5 ≤ 30 → i ≥ 27 → 13 trades últimos por data.
    // byCount = 20 trades (minTrades). byDays=13. chosen = byCount (13 é menor).
    // Mas a regra é "pega o MAIOR" → byCount=20 vence.
    expect(out.windowSize).toBe(20);
    expect(out.sparseSample).toBe(false);
    // Resultado em ordem cronológica ASC
    const dates = out.window.map((t) => t.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('stage 1 (minDays=30): 40 trades todos nos últimos 10 dias → byDays vence (40 > byCount=20)', () => {
    const trades = Array.from({ length: 40 }, (_, i) => ({
      id: `t${i}`,
      date: isoMinus(NOW, i % 10),
      pl: 10,
    }));
    const out = resolveWindow(trades, 1, NOW);
    // Todos os 40 estão dentro de 30 dias → byDays=40, byCount=20 (slice últimos).
    expect(out.windowSize).toBe(40);
    expect(out.sparseSample).toBe(false);
  });

  it('stage inválido → fallback STAGE_WINDOWS[1]', () => {
    const trades = Array.from({ length: 25 }, (_, i) => ({
      id: `t${i}`,
      date: isoMinus(NOW, i),
      pl: 10,
    }));
    const out = resolveWindow(trades, 99, NOW);
    // STAGE_WINDOWS[1] minTrades=20, minDays=30. Todos os 25 dentro de 30 dias → byDays=25.
    expect(out.windowSize).toBe(STAGE_WINDOWS[1].minTrades > 25 ? 25 : 25);
    expect(out.sparseSample).toBe(false);
  });

  it('trades com data inválida são descartados', () => {
    const trades = [
      { id: 'ok1', date: isoMinus(NOW, 1), pl: 10 },
      { id: 'ok2', date: isoMinus(NOW, 2), pl: 10 },
      { id: 'bad1', date: 'nao-eh-data', pl: 10 },
      { id: 'bad2', date: null, pl: 10 },
      { id: 'bad3', pl: 10 },
      { id: 'ok3', date: isoMinus(NOW, 3), pl: 10 },
    ];
    const out = resolveWindow(trades, 1, NOW);
    expect(out.windowSize).toBe(3);
    expect(out.window.map((t) => t.id)).toEqual(['ok3', 'ok2', 'ok1']);
  });

  it('aceita Date object para now', () => {
    const trades = [
      { id: 'a', date: isoMinus(NOW, 1), pl: 10 },
      { id: 'b', date: isoMinus(NOW, 2), pl: 10 },
    ];
    const now = new Date(`${NOW}T12:00:00Z`);
    const out = resolveWindow(trades, 1, now);
    expect(out.windowSize).toBe(2);
  });
});
