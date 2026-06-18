/**
 * reviewBacklog.test.js — Issue #269 (Fase D)
 *
 * Cobre groupBacklogByDay (agrupamento do backlog NONE por dia para o NewReviewDialog).
 */

import { describe, it, expect } from 'vitest';
import { groupBacklogByDay, tradeDayKey } from '../../utils/reviewHelpers';

const trade = (id, entryTime, reviewState = 'NONE', extra = {}) =>
  ({ id, entryTime, reviewState, ...extra });

describe('tradeDayKey', () => {
  it('prioriza entryTime, cai em date', () => {
    expect(tradeDayKey({ entryTime: '2026-06-10T09:00:00-03:00' })).toBe('2026-06-10');
    expect(tradeDayKey({ date: '2026-06-09' })).toBe('2026-06-09');
    expect(tradeDayKey({})).toBe(null);
  });
});

describe('groupBacklogByDay', () => {
  it('filtra só NONE (trata reviewState ausente como NONE)', () => {
    const trades = [
      trade('a', '2026-06-10T09:00:00-03:00', 'NONE'),
      trade('b', '2026-06-10T10:00:00-03:00', 'DRAFT'),
      trade('c', '2026-06-10T11:00:00-03:00', 'DISCUSSED'),
      { id: 'd', entryTime: '2026-06-10T08:00:00-03:00' }, // sem reviewState → NONE
    ];
    const groups = groupBacklogByDay(trades);
    const ids = groups.flatMap(g => g.trades.map(t => t.id));
    expect(ids.sort()).toEqual(['a', 'd']);
  });

  it('agrupa por dia (mais recente primeiro) e ordena trades do dia por horário asc', () => {
    const trades = [
      trade('x1', '2026-06-12T14:00:00-03:00'),
      trade('x2', '2026-06-12T09:00:00-03:00'),
      trade('y1', '2026-06-10T10:00:00-03:00'),
    ];
    const groups = groupBacklogByDay(trades);
    expect(groups.map(g => g.day)).toEqual(['2026-06-12', '2026-06-10']);
    expect(groups[0].trades.map(t => t.id)).toEqual(['x2', 'x1']); // horário asc
  });

  it('backlog vazio → []', () => {
    expect(groupBacklogByDay([])).toEqual([]);
    expect(groupBacklogByDay(null)).toEqual([]);
    expect(groupBacklogByDay([trade('a', '2026-06-10T09:00', 'DISCUSSED')])).toEqual([]);
  });
});
