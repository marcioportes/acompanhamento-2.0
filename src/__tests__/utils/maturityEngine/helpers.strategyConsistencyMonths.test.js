import { describe, it, expect } from 'vitest';
import { computeStrategyConsistencyMonths } from '../../../utils/maturityEngine/helpers';

function trade(date, setup, count = 1) {
  return Array.from({ length: count }, () => ({ date, setup, pl: 10 }));
}

describe('computeStrategyConsistencyMonths', () => {
  it('retorna 0 para lista vazia/null', () => {
    expect(computeStrategyConsistencyMonths([], [])).toBe(0);
    expect(computeStrategyConsistencyMonths(null, [])).toBe(0);
  });

  it('retorna 1 para um mês com dominante claro', () => {
    const trades = [
      ...trade('2026-01-05', 'rompimento', 8),
      ...trade('2026-01-20', 'pullback', 2),
    ];
    expect(computeStrategyConsistencyMonths(trades, [])).toBe(1);
  });

  it('retorna 3 para 3 meses consecutivos com mesmo dominante', () => {
    const trades = [
      ...trade('2026-01-10', 'rompimento', 8), ...trade('2026-01-20', 'outro', 2),
      ...trade('2026-02-10', 'rompimento', 8), ...trade('2026-02-20', 'outro', 2),
      ...trade('2026-03-10', 'rompimento', 8), ...trade('2026-03-20', 'outro', 2),
    ];
    expect(computeStrategyConsistencyMonths(trades, [])).toBe(3);
  });

  it('run reinicia quando dominante muda', () => {
    const trades = [
      ...trade('2026-01-10', 'rompimento', 10),
      ...trade('2026-02-10', 'rompimento', 10),
      ...trade('2026-03-10', 'pullback', 10),
      ...trade('2026-04-10', 'rompimento', 10),
    ];
    // Runs: rompimento x2, pullback x1, rompimento x1 → max 2
    expect(computeStrategyConsistencyMonths(trades, [])).toBe(2);
  });

  it('mês sem dominante > 60% quebra o run', () => {
    const trades = [
      ...trade('2026-01-10', 'rompimento', 10),
      // Fev: 5 rompimento, 5 pullback → nenhum >60%
      ...trade('2026-02-10', 'rompimento', 5), ...trade('2026-02-20', 'pullback', 5),
      ...trade('2026-03-10', 'rompimento', 10),
    ];
    expect(computeStrategyConsistencyMonths(trades, [])).toBe(1);
  });

  it('aceita datas BR (DD/MM/YYYY)', () => {
    const trades = [
      ...trade('10/01/2026', 'rompimento', 8),
      ...trade('10/02/2026', 'rompimento', 8),
    ];
    expect(computeStrategyConsistencyMonths(trades, [])).toBe(2);
  });

  it('ignora trades sem setup ou sem date', () => {
    const trades = [
      { date: '2026-01-10', pl: 10 },      // sem setup
      { setup: 'rompimento', pl: 10 },      // sem date
      ...trade('2026-01-10', 'rompimento', 8),
      ...trade('2026-02-10', 'rompimento', 8),
    ];
    expect(computeStrategyConsistencyMonths(trades, [])).toBe(2);
  });
});
