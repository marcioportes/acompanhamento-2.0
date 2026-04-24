import { describe, it, expect } from 'vitest';
import { mapMetricsToStage } from '../../../utils/maturityEngine/helpers';

describe('mapMetricsToStage', () => {
  it('retorna 1 quando todas as três métricas encaixam em CHAOS', () => {
    expect(mapMetricsToStage({ winRate: 20, payoff: 0.5, maxDD: 30 })).toBe(1);
  });

  it('retorna 5 quando todas as três métricas encaixam em MASTERY', () => {
    expect(mapMetricsToStage({ winRate: 70, payoff: 3.0, maxDD: 2 })).toBe(5);
  });

  it('usa o pior stage entre as três métricas (mix)', () => {
    // WR=70 → 5, payoff=3.0 → 5, maxDD=30 → 1 → min = 1
    expect(mapMetricsToStage({ winRate: 70, payoff: 3.0, maxDD: 30 })).toBe(1);
  });

  it('fronteira prefere stage superior (WR=45 vira 3, payoff=1.2 vira 3, maxDD=15 vira 3)', () => {
    expect(mapMetricsToStage({ winRate: 45, payoff: 1.2, maxDD: 15 })).toBe(3);
    expect(mapMetricsToStage({ winRate: 55, payoff: 2.0, maxDD: 5 })).toBe(4);
    expect(mapMetricsToStage({ winRate: 65, payoff: 2.5, maxDD: 3 })).toBe(5);
  });

  it('ignora métricas ausentes — considera só as presentes', () => {
    // Só WR=60 → stageFromWinRate(60) = 4
    expect(mapMetricsToStage({ winRate: 60 })).toBe(4);
    expect(mapMetricsToStage({ winRate: 60, payoff: undefined, maxDD: null })).toBe(4);
  });

  it('retorna 1 quando todas as três estão ausentes', () => {
    expect(mapMetricsToStage({})).toBe(1);
    expect(mapMetricsToStage()).toBe(1);
  });

  it('ignora valores não-finitos (NaN, Infinity)', () => {
    expect(mapMetricsToStage({ winRate: NaN, payoff: 3.0, maxDD: 2 })).toBe(5);
    expect(mapMetricsToStage({ winRate: 70, payoff: Infinity, maxDD: 2 })).toBe(5);
  });
});
