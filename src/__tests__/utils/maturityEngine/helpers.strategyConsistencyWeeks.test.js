import { describe, it, expect } from 'vitest';
import { computeStrategyConsistencyWeeks } from '../../../utils/maturityEngine/helpers';

// 2026-01-05 é segunda-feira. Usamos essa ancoragem para gerar trades alinhados.
const MON_JAN_05 = '2026-01-05';
const TUE_JAN_06 = '2026-01-06';
const MON_JAN_12 = '2026-01-12';
const TUE_JAN_13 = '2026-01-13';
const MON_JAN_19 = '2026-01-19';
const TUE_JAN_20 = '2026-01-20';
const MON_JAN_26 = '2026-01-26';
const TUE_JAN_27 = '2026-01-27';
const MON_FEB_02 = '2026-02-02';

function wk(date, setup, count) {
  return Array.from({ length: count }, () => ({ date, setup, pl: 10 }));
}

describe('computeStrategyConsistencyWeeks', () => {
  it('retorna 0 para lista vazia', () => {
    expect(computeStrategyConsistencyWeeks([], [])).toBe(0);
    expect(computeStrategyConsistencyWeeks(null, [])).toBe(0);
  });

  it('retorna 1 para uma semana com dominant claro', () => {
    const trades = [
      ...wk(MON_JAN_05, 'rompimento', 4),
      ...wk(TUE_JAN_06, 'pullback', 1),
    ];
    expect(computeStrategyConsistencyWeeks(trades, [])).toBe(1);
  });

  it('retorna 4 para 4 semanas consecutivas com mesmo dominant', () => {
    const trades = [
      ...wk(MON_JAN_05, 'rompimento', 4), ...wk(TUE_JAN_06, 'outro', 1),
      ...wk(MON_JAN_12, 'rompimento', 4), ...wk(TUE_JAN_13, 'outro', 1),
      ...wk(MON_JAN_19, 'rompimento', 4), ...wk(TUE_JAN_20, 'outro', 1),
      ...wk(MON_JAN_26, 'rompimento', 4), ...wk(TUE_JAN_27, 'outro', 1),
    ];
    expect(computeStrategyConsistencyWeeks(trades, [])).toBe(4);
  });

  it('run máximo é reiniciado quando dominant muda no meio', () => {
    const trades = [
      ...wk(MON_JAN_05, 'rompimento', 5),
      ...wk(MON_JAN_12, 'rompimento', 5),
      ...wk(MON_JAN_19, 'pullback', 5),
      ...wk(MON_JAN_26, 'pullback', 5),
      ...wk(MON_FEB_02, 'rompimento', 5),
    ];
    // runs: rompimento x2, pullback x2, rompimento x1 → max 2
    expect(computeStrategyConsistencyWeeks(trades, [])).toBe(2);
  });

  it('semana sem dominant > 60% conta como gap (quebra o run)', () => {
    const trades = [
      // Semana 1: dominante rompimento
      ...wk(MON_JAN_05, 'rompimento', 5),
      // Semana 2: 2 rompimento, 2 pullback, 1 outro → ninguém > 60%
      ...wk(MON_JAN_12, 'rompimento', 2), ...wk(TUE_JAN_13, 'pullback', 2), ...wk(MON_JAN_12, 'outro', 1),
      // Semana 3: dominante rompimento
      ...wk(MON_JAN_19, 'rompimento', 5),
    ];
    expect(computeStrategyConsistencyWeeks(trades, [])).toBe(1);
  });

  it('semana com todos setups dispersos → zero dominant', () => {
    const trades = [
      ...wk(MON_JAN_05, 'a', 2), ...wk(TUE_JAN_06, 'b', 2), ...wk(MON_JAN_05, 'c', 1),
    ];
    expect(computeStrategyConsistencyWeeks(trades, [])).toBe(0);
  });

  it('ignora trades sem setup ou sem date', () => {
    const trades = [
      { date: MON_JAN_05, pl: 10 }, // sem setup
      { setup: 'a', pl: 10 }, // sem date
      ...wk(MON_JAN_05, 'rompimento', 4),
      ...wk(TUE_JAN_06, 'pullback', 1),
    ];
    expect(computeStrategyConsistencyWeeks(trades, [])).toBe(1);
  });
});
