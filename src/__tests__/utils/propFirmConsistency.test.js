// Tests for propFirmConsistency (issue #273 — regras Zero7)
import { describe, it, expect } from 'vitest';
import {
  aggregateDailyPL,
  checkMaxDayPercentOfTarget,
  filterIneligibleTrades,
  countWithdrawalsInPhase,
  checkWithdrawalLimit,
  isPayoutWindowOpen
} from '../../utils/propFirmConsistency';

describe('aggregateDailyPL', () => {
  it('agrupa trades por tradeDate somando netPL', () => {
    const trades = [
      { tradeDate: '2026-05-01', netPL: 100 },
      { tradeDate: '2026-05-01', netPL: 200 },
      { tradeDate: '2026-05-02', netPL: -50 }
    ];
    const result = aggregateDailyPL(trades);
    expect(result).toEqual([
      { date: '2026-05-01', pl: 300 },
      { date: '2026-05-02', pl: -50 }
    ]);
  });

  it('fallback para exitDate (ISO) quando tradeDate ausente', () => {
    const trades = [{ exitDate: '2026-05-01T15:30:00Z', netPL: 50 }];
    expect(aggregateDailyPL(trades)).toEqual([{ date: '2026-05-01', pl: 50 }]);
  });

  it('ignora trades sem data', () => {
    const trades = [
      { tradeDate: '2026-05-01', netPL: 100 },
      { netPL: 999 } // sem data
    ];
    expect(aggregateDailyPL(trades)).toEqual([{ date: '2026-05-01', pl: 100 }]);
  });

  it('retorna [] para entradas inválidas', () => {
    expect(aggregateDailyPL(null)).toEqual([]);
    expect(aggregateDailyPL([])).toEqual([]);
  });
});

describe('checkMaxDayPercentOfTarget — EVALUATION (Zero7 desclassifica)', () => {
  const tplZero7 = { consistency: { maxDayPercentOfTarget: 0.50 } };

  it('viola quando dia ultrapassa 50% da meta', () => {
    const trades = [{ tradeDate: '2026-05-01', netPL: 510 }]; // > 498.50
    const r = checkMaxDayPercentOfTarget({
      trades, template: tplZero7, phase: 'EVALUATION', profitTarget: 997
    });
    expect(r.applicable).toBe(true);
    expect(r.violated).toBe(true);
    expect(r.violatingDay).toEqual({ date: '2026-05-01', pl: 510 });
    expect(r.limit).toBeCloseTo(498.50, 2);
  });

  it('não viola quando dia exatamente igual ao limite (estritamente >)', () => {
    const trades = [{ tradeDate: '2026-05-01', netPL: 498.50 }];
    const r = checkMaxDayPercentOfTarget({
      trades, template: tplZero7, phase: 'EVALUATION', profitTarget: 997
    });
    expect(r.violated).toBe(false);
  });

  it('não viola sem trades', () => {
    const r = checkMaxDayPercentOfTarget({
      trades: [], template: tplZero7, phase: 'EVALUATION', profitTarget: 997
    });
    expect(r.applicable).toBe(true);
    expect(r.violated).toBe(false);
  });

  it('não aplicável quando rule não está no template', () => {
    const r = checkMaxDayPercentOfTarget({
      trades: [{ tradeDate: '2026-05-01', netPL: 999 }],
      template: { consistency: {} },
      phase: 'EVALUATION',
      profitTarget: 997
    });
    expect(r.applicable).toBe(false);
    expect(r.violated).toBe(false);
  });

  it('não aplicável com profitTarget <= 0', () => {
    const r = checkMaxDayPercentOfTarget({
      trades: [{ tradeDate: '2026-05-01', netPL: 999 }],
      template: tplZero7, phase: 'EVALUATION', profitTarget: 0
    });
    expect(r.applicable).toBe(true);
    expect(r.violated).toBe(false);
  });
});

describe('checkMaxDayPercentOfTarget — SIM_FUNDED (Incubadora descarta dia inflado)', () => {
  const tplZero7 = { consistency: { maxDayPercentOfTarget: 0.50 } };

  it('marca dia inflado e calcula eligiblePL', () => {
    const trades = [
      { tradeDate: '2026-05-01', netPL: 400 },
      { tradeDate: '2026-05-02', netPL: 800 },
      { tradeDate: '2026-05-03', netPL: 1800 }, // >= 50% de 3000 → descarta
    ];
    const r = checkMaxDayPercentOfTarget({
      trades, template: tplZero7, phase: 'SIM_FUNDED', profitTarget: 19997
    });
    expect(r.cyclePL).toBe(3000);
    expect(r.limit).toBe(1500);
    expect(r.inflatedDays).toEqual([{ date: '2026-05-03', pl: 1800 }]);
    expect(r.eligiblePL).toBe(1200);
  });

  it('sem dia inflado quando todos abaixo do limite', () => {
    // 3 dias distribuídos: 300+300+400=1000, limite=500, nenhum >= 500
    const trades = [
      { tradeDate: '2026-05-01', netPL: 300 },
      { tradeDate: '2026-05-02', netPL: 300 },
      { tradeDate: '2026-05-03', netPL: 400 }
    ];
    const r = checkMaxDayPercentOfTarget({
      trades, template: tplZero7, phase: 'SIM_FUNDED', profitTarget: 19997
    });
    expect(r.cyclePL).toBe(1000);
    expect(r.inflatedDays).toEqual([]);
    expect(r.eligiblePL).toBe(1000);
  });

  it('cyclePL <= 0 → eligiblePL = cyclePL e sem descarte', () => {
    const trades = [
      { tradeDate: '2026-05-01', netPL: 100 },
      { tradeDate: '2026-05-02', netPL: -200 }
    ];
    const r = checkMaxDayPercentOfTarget({
      trades, template: tplZero7, phase: 'SIM_FUNDED', profitTarget: 19997
    });
    expect(r.cyclePL).toBe(-100);
    expect(r.inflatedDays).toEqual([]);
    expect(r.eligiblePL).toBe(-100);
  });
});

describe('filterIneligibleTrades — saldos inaptos Zero7', () => {
  const filter = { WIN: 10, WDO: 0.5, BIT: 1000 };

  it('filtra WIN < 10pt e mantém WIN >= 10pt', () => {
    const trades = [
      { instrument: 'WIN', netPoints: 5 }, // descarta
      { instrument: 'WIN', netPoints: 20 } // mantém
    ];
    const { eligible, ineligible } = filterIneligibleTrades(trades, filter);
    expect(eligible).toHaveLength(1);
    expect(ineligible).toHaveLength(1);
    expect(ineligible[0].netPoints).toBe(5);
  });

  it('considera valor absoluto (perda também conta)', () => {
    const trades = [{ instrument: 'WIN', netPoints: -15 }];
    const { eligible } = filterIneligibleTrades(trades, filter);
    expect(eligible).toHaveLength(1);
  });

  it('instrumentos sem regra passam direto', () => {
    const trades = [{ instrument: 'ES', netPoints: 1 }]; // ES não está no filter
    const { eligible, ineligible } = filterIneligibleTrades(trades, filter);
    expect(eligible).toHaveLength(1);
    expect(ineligible).toHaveLength(0);
  });

  it('filter ausente preserva todos os trades', () => {
    const trades = [{ instrument: 'WIN', netPoints: 1 }];
    const { eligible } = filterIneligibleTrades(trades, null);
    expect(eligible).toHaveLength(1);
  });
});

describe('countWithdrawalsInPhase e checkWithdrawalLimit', () => {
  const movements = [
    { type: 'WITHDRAWAL', phase: 'SIM_FUNDED', accountId: 'A1' },
    { type: 'WITHDRAWAL', phase: 'SIM_FUNDED', accountId: 'A1' },
    { type: 'WITHDRAWAL', phase: 'LIVE', accountId: 'A1' },
    { type: 'DEPOSIT', phase: 'SIM_FUNDED', accountId: 'A1' }, // não conta
    { type: 'WITHDRAWAL', phase: 'SIM_FUNDED', accountId: 'A2' } // outra conta
  ];

  it('countWithdrawalsInPhase isola por conta e fase', () => {
    expect(countWithdrawalsInPhase(movements, 'A1', 'SIM_FUNDED')).toBe(2);
    expect(countWithdrawalsInPhase(movements, 'A1', 'LIVE')).toBe(1);
    expect(countWithdrawalsInPhase(movements, 'A2', 'SIM_FUNDED')).toBe(1);
  });

  it('checkWithdrawalLimit detecta limite 4 saques na Incubadora', () => {
    const tpl = { payout: { maxWithdrawalsByPhase: { SIM_FUNDED: 4 } } };
    const r = checkWithdrawalLimit({
      movements, accountId: 'A1', phase: 'SIM_FUNDED', template: tpl
    });
    expect(r.used).toBe(2);
    expect(r.max).toBe(4);
    expect(r.remaining).toBe(2);
    expect(r.limitReached).toBe(false);
  });

  it('limitReached=true quando atinge ou ultrapassa', () => {
    const tpl = { payout: { maxWithdrawalsByPhase: { SIM_FUNDED: 2 } } };
    const r = checkWithdrawalLimit({
      movements, accountId: 'A1', phase: 'SIM_FUNDED', template: tpl
    });
    expect(r.limitReached).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('sem regra no template → max=null, sem limite', () => {
    const r = checkWithdrawalLimit({
      movements, accountId: 'A1', phase: 'SIM_FUNDED', template: { payout: {} }
    });
    expect(r.max).toBe(null);
    expect(r.limitReached).toBe(false);
  });
});

describe('isPayoutWindowOpen — calendário fixo Zero7 [10, 20, 30]', () => {
  const fixedDays = [10, 20, 30];

  it('dia 20 está aberto', () => {
    const r = isPayoutWindowOpen('2026-05-20T12:00:00Z', fixedDays);
    expect(r.open).toBe(true);
    expect(r.dayOfMonth).toBe(20);
  });

  it('dia 15 → próxima janela é dia 20 do mesmo mês', () => {
    const r = isPayoutWindowOpen('2026-05-15T12:00:00Z', fixedDays);
    expect(r.open).toBe(false);
    expect(r.nextDay).toBe('2026-05-20');
  });

  it('dia 25 → próxima janela é dia 30 do mesmo mês', () => {
    const r = isPayoutWindowOpen('2026-05-25T12:00:00Z', fixedDays);
    expect(r.open).toBe(false);
    expect(r.nextDay).toBe('2026-05-30');
  });

  it('dia 31 (após último dia da janela) → próxima é dia 10 do mês seguinte', () => {
    const r = isPayoutWindowOpen('2026-05-31T12:00:00Z', fixedDays);
    expect(r.open).toBe(false);
    expect(r.nextDay).toBe('2026-06-10');
  });

  it('fixedDays vazio → não aplicável', () => {
    const r = isPayoutWindowOpen('2026-05-15', []);
    expect(r.open).toBe(false);
    expect(r.nextDay).toBe(null);
  });
});
