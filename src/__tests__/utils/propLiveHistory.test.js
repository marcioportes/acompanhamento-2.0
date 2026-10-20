import { describe, it, expect } from 'vitest';
import { liveDrawdownHistory } from '../../utils/propLiveHistory';
import { drawdownUsage } from '../../utils/propFirmDisplay';

// Caso real da Lucid Flex 25K (20/10/2026): dois trades de 02/10 apagados, três vivos.
const historyLucid = [
  { tradeId: 'gTo0', date: '2026-10-02', balance: 26000, dailyPnL: 1000 },
  { tradeId: '3uOF', date: '2026-10-02', balance: 27000, dailyPnL: 2000 },
  { tradeId: 'AqKL', date: '2026-10-20', balance: 24983.75, dailyPnL: -16.25 },
  { tradeId: 'tsMB', date: '2026-10-20', balance: 24995, dailyPnL: -5 },
  { tradeId: 'm594', date: '2026-10-20', balance: 25053.5, dailyPnL: 53.5 },
];
const tradesLucid = [
  { id: 'm594', date: '2026-10-20', entryTime: '2026-10-20T15:00:00', result: 58.5 },
  { id: 'AqKL', date: '2026-10-20', entryTime: '2026-10-20T10:00:00', result: -16.25 },
  { id: 'tsMB', date: '2026-10-20', entryTime: '2026-10-20T11:00:00', result: 11.25 },
];

describe('liveDrawdownHistory', () => {
  it('descarta snapshot de trade apagado e refaz o saldo dos trades vivos', () => {
    const r = liveDrawdownHistory(historyLucid, tradesLucid, 25000);
    expect(r.snapshots.map(s => s.tradeId)).toEqual(['AqKL', 'tsMB', 'm594']);
    expect(r.snapshots.map(s => s.balance)).toEqual([24983.75, 24995, 25053.5]);
    expect(r.snapshots.map(s => s.dailyPnL)).toEqual([-16.25, -5, 53.5]);
  });

  it('conta dias, melhor e pior dia só com trades vivos', () => {
    const r = liveDrawdownHistory(historyLucid, tradesLucid, 25000);
    expect(r.tradingDays).toBe(1);
    expect(r.bestDay).toEqual({ date: '2026-10-20', pnl: 53.5 });
    expect(r.worstDay).toEqual({ date: '2026-10-20', pnl: 53.5 });
  });

  it('saldo usa o resultado atual do trade, não o gravado no snapshot', () => {
    // trade apagado ANTES de um trade vivo: o snapshot vivo carrega o +1000 fantasma
    const history = [
      { tradeId: 'dead', date: '2026-10-01', balance: 26000, dailyPnL: 1000 },
      { tradeId: 'a', date: '2026-10-02', balance: 26050, dailyPnL: 50 },
    ];
    const r = liveDrawdownHistory(history, [{ id: 'a', date: '2026-10-02', result: 50 }], 25000);
    expect(r.snapshots).toEqual([{ tradeId: 'a', date: '2026-10-02', balance: 25050, dailyPnL: 50 }]);
  });

  it('trade editado (snapshot -edit-) vira um ponto só, com o resultado atual', () => {
    const history = [
      { tradeId: 'a', date: '2026-10-02', balance: 25100, dailyPnL: 100 },
      { tradeId: 'a', date: '2026-10-02', balance: 25080, dailyPnL: 80 },
    ];
    const r = liveDrawdownHistory(history, [{ id: 'a', date: '2026-10-02', result: 80 }], 25000);
    expect(r.snapshots).toHaveLength(1);
    expect(r.snapshots[0].balance).toBe(25080);
  });

  it('separa dias e acha o pior dia negativo', () => {
    const history = [{ tradeId: 'a' }, { tradeId: 'b' }, { tradeId: 'c' }];
    const trades = [
      { id: 'a', date: '2026-10-01', result: 300 },
      { id: 'b', date: '2026-10-02', result: -120 },
      { id: 'c', date: '2026-10-02', result: 20 },
    ];
    const r = liveDrawdownHistory(history, trades, 25000);
    expect(r.days).toEqual([{ date: '2026-10-01', pnl: 300 }, { date: '2026-10-02', pnl: -100 }]);
    expect(r.bestDay.pnl).toBe(300);
    expect(r.worstDay.pnl).toBe(-100);
    expect(r.snapshots.map(s => s.balance)).toEqual([25300, 25180, 25200]);
  });

  it('trade vivo sem snapshot e snapshot legado sem tradeId ficam de fora', () => {
    const r = liveDrawdownHistory(
      [{ date: '2026-10-01', balance: 25500 }],
      [{ id: 'x', date: '2026-10-01', result: 500 }],
      25000,
    );
    expect(r.snapshots).toEqual([]);
    expect(r.tradingDays).toBe(0);
    expect(r.bestDay).toBeNull();
  });

  it('entradas vazias', () => {
    expect(liveDrawdownHistory(null, null, 25000).snapshots).toEqual([]);
  });
});

describe('drawdownUsage', () => {
  it('saldo acima do pico (trailing EOD, antes do fechamento) → 0% usado, folga real', () => {
    expect(drawdownUsage({ balance: 25053.5, threshold: 24000, drawdownMax: 1000 }))
      .toEqual({ usedPct: 0, margin: 1053.5, aboveMax: true });
  });
  it('uso parcial', () => {
    const r = drawdownUsage({ balance: 24750, threshold: 24000, drawdownMax: 1000 });
    expect(r.usedPct).toBe(25);
    expect(r.margin).toBe(750);
    expect(r.aboveMax).toBe(false);
  });
  it('saldo no limite ou abaixo → 100%, folga zero', () => {
    expect(drawdownUsage({ balance: 23900, threshold: 24000, drawdownMax: 1000 }))
      .toEqual({ usedPct: 100, margin: 0, aboveMax: false });
  });
  it('sem drawdown na mesa', () => {
    expect(drawdownUsage({ balance: 25000, threshold: 0, drawdownMax: 0 }).usedPct).toBe(0);
  });
});
