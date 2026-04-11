import { describe, it, expect } from 'vitest';
import {
  calculateDrawdownState,
  initializePropFirmState,
  resolveLockAt,
  getPeakUpdateMode,
  calculateEvalDaysRemaining,
  isEvalDeadlineNear,
  DRAWDOWN_FLAGS,
  DD_NEAR_THRESHOLD
} from '../../utils/propFirmDrawdownEngine';
import { DRAWDOWN_TYPES } from '../../constants/propFirmDefaults';

// ============================================
// Templates de referência
// ============================================
const APEX_EOD_25K = {
  drawdown: { type: DRAWDOWN_TYPES.TRAILING_EOD, maxAmount: 1000, lockAt: null, lockFormula: 'BALANCE + DD + 100' },
  dailyLossLimit: 500,
  profitTarget: 1500,
  evalTimeLimit: 30,
  accountSize: 25000
};

const APEX_INTRADAY_25K = {
  drawdown: { type: DRAWDOWN_TYPES.TRAILING_INTRADAY, maxAmount: 1500, lockAt: null, lockFormula: null },
  dailyLossLimit: 500,
  profitTarget: 1500,
  evalTimeLimit: 30,
  accountSize: 25000
};

const STATIC_50K = {
  drawdown: { type: DRAWDOWN_TYPES.STATIC, maxAmount: 2500, lockAt: null, lockFormula: null },
  dailyLossLimit: 1000,
  profitTarget: 3000,
  evalTimeLimit: 30,
  accountSize: 50000
};

const TRAILING_EOD_NO_LOCK = {
  drawdown: { type: DRAWDOWN_TYPES.TRAILING_EOD, maxAmount: 2000, lockAt: null, lockFormula: null },
  dailyLossLimit: 800,
  profitTarget: 3000,
  evalTimeLimit: 30,
  accountSize: 50000
};

const NO_DAILY_LOSS_TEMPLATE = {
  drawdown: { type: DRAWDOWN_TYPES.TRAILING_INTRADAY, maxAmount: 2500, lockAt: null, lockFormula: null },
  dailyLossLimit: null,
  profitTarget: 3000,
  evalTimeLimit: 30,
  accountSize: 50000
};

// ============================================
// Helpers do estado inicial
// ============================================
function freshState(template) {
  return initializePropFirmState(template, template.accountSize);
}

// ============================================
// resolveLockAt
// ============================================
describe('resolveLockAt', () => {
  it('lockAt numérico explícito tem prioridade', () => {
    const tpl = { drawdown: { lockAt: 30000, maxAmount: 1000 } };
    expect(resolveLockAt(tpl, 25000)).toBe(30000);
  });

  it("fórmula 'BALANCE + DD + 100' retorna accountSize + DD + 100", () => {
    expect(resolveLockAt(APEX_EOD_25K, 25000)).toBe(26100);
  });

  it('sem lockAt nem lockFormula → null', () => {
    expect(resolveLockAt(STATIC_50K, 50000)).toBeNull();
  });

  it('template inválido → null', () => {
    expect(resolveLockAt(null, 25000)).toBeNull();
    expect(resolveLockAt({}, 25000)).toBeNull();
  });
});

// ============================================
// getPeakUpdateMode
// ============================================
describe('getPeakUpdateMode', () => {
  it('STATIC → never', () => {
    expect(getPeakUpdateMode(DRAWDOWN_TYPES.STATIC)).toBe('never');
  });
  it('TRAILING_EOD → eod', () => {
    expect(getPeakUpdateMode(DRAWDOWN_TYPES.TRAILING_EOD)).toBe('eod');
  });
  it('TRAILING_INTRADAY → intraday', () => {
    expect(getPeakUpdateMode(DRAWDOWN_TYPES.TRAILING_INTRADAY)).toBe('intraday');
  });
  it('TRAILING_WITH_LOCK → intraday (legacy)', () => {
    expect(getPeakUpdateMode(DRAWDOWN_TYPES.TRAILING_WITH_LOCK)).toBe('intraday');
  });
  it('valor desconhecido → intraday (default seguro)', () => {
    expect(getPeakUpdateMode('FOO')).toBe('intraday');
  });
});

// ============================================
// initializePropFirmState
// ============================================
describe('initializePropFirmState', () => {
  it('Apex EOD 25K → peak 25K, threshold 24K', () => {
    const s = initializePropFirmState(APEX_EOD_25K, 25000);
    expect(s.peakBalance).toBe(25000);
    expect(s.currentDrawdownThreshold).toBe(24000);
    expect(s.lockLevel).toBeNull();
    expect(s.isDayPaused).toBe(false);
    expect(s.tradingDays).toBe(0);
    expect(s.dailyPnL).toBe(0);
    expect(s.lastTradeDate).toBeNull();
  });

  it('Static 50K DD 2500 → threshold 47.5K', () => {
    const s = initializePropFirmState(STATIC_50K, 50000);
    expect(s.peakBalance).toBe(50000);
    expect(s.currentDrawdownThreshold).toBe(47500);
  });

  it('lança erro sem template.drawdown', () => {
    expect(() => initializePropFirmState(null, 25000)).toThrow();
    expect(() => initializePropFirmState({}, 25000)).toThrow();
  });
});

// ============================================
// calculateDrawdownState — STATIC
// ============================================
describe('calculateDrawdownState — STATIC', () => {
  const tpl = STATIC_50K;
  const accountSize = 50000;

  it('init + win 200 → threshold permanece 47.5K', () => {
    const result = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 50000,
      tradeNet: 200,
      tradeDate: '2026-04-09'
    });
    expect(result.newBalance).toBe(50200);
    expect(result.peakBalance).toBe(50000); // STATIC nunca move
    expect(result.currentDrawdownThreshold).toBe(47500); // fixo
    expect(result.flags).toEqual([]);
    expect(result.tradingDays).toBe(1); // primeiro trade do dia
  });

  it('loss leve → threshold permanece, sem flag', () => {
    const result = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 50000,
      tradeNet: -100,
      tradeDate: '2026-04-09'
    });
    expect(result.newBalance).toBe(49900);
    expect(result.currentDrawdownThreshold).toBe(47500);
    expect(result.flags).not.toContain(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  });

  it('loss até bust → flag ACCOUNT_BUST', () => {
    const result = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 50000,
      tradeNet: -2600, // novo balance 47.4K < 47.5K
      tradeDate: '2026-04-09'
    });
    expect(result.newBalance).toBe(47400);
    expect(result.flags).toContain(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  });

  it('múltiplos trades em sequência: peak nunca move', () => {
    let state = freshState(tpl);
    const trades = [+200, +500, -100, +300, -50];
    let balance = accountSize;
    for (const net of trades) {
      const r = calculateDrawdownState({
        propFirm: state,
        template: tpl,
        accountSize,
        balanceBefore: balance,
        tradeNet: net,
        tradeDate: '2026-04-09'
      });
      state = { ...state, ...r };
      balance = r.newBalance;
    }
    expect(state.peakBalance).toBe(50000);
    expect(state.currentDrawdownThreshold).toBe(47500);
  });
});

// ============================================
// calculateDrawdownState — TRAILING_INTRADAY
// ============================================
describe('calculateDrawdownState — TRAILING_INTRADAY', () => {
  const tpl = APEX_INTRADAY_25K;
  const accountSize = 25000;

  it('init: peak 25K, threshold 23.5K', () => {
    const s = freshState(tpl);
    expect(s.peakBalance).toBe(25000);
    expect(s.currentDrawdownThreshold).toBe(23500);
  });

  it('win 200: peak sobe para 25.2K, threshold 23.7K', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 200,
      tradeDate: '2026-04-09'
    });
    expect(r.peakBalance).toBe(25200);
    expect(r.currentDrawdownThreshold).toBe(23700);
  });

  it('loss após win NÃO baixa o peak (trailing one-way)', () => {
    let state = freshState(tpl);
    // win 300
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 25000, tradeNet: 300, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    expect(state.peakBalance).toBe(25300);

    // loss 100
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: r.newBalance, tradeNet: -100, tradeDate: '2026-04-09'
    });
    expect(r.peakBalance).toBe(25300); // não desce
    expect(r.currentDrawdownThreshold).toBe(23800); // 25300 - 1500
    expect(r.newBalance).toBe(25200);
  });

  it('sequência de wins: peak vai subindo a cada um', () => {
    let state = freshState(tpl);
    let balance = accountSize;
    const wins = [100, 200, 150, 300];
    for (const w of wins) {
      const r = calculateDrawdownState({
        propFirm: state, template: tpl, accountSize,
        balanceBefore: balance, tradeNet: w, tradeDate: '2026-04-09'
      });
      state = { ...state, ...r };
      balance = r.newBalance;
    }
    expect(state.peakBalance).toBe(25750); // 25K + 750
    expect(state.currentDrawdownThreshold).toBe(24250); // 25750 - 1500
  });

  it('flag DD_NEAR quando margem < 20%', () => {
    // peak 25K, threshold 23.5K. distância = (newBalance - 23500) / 1500
    // queremos distância 0.10 (= 10%) → newBalance = 23500 + 150 = 23650
    // tradeNet = 23650 - 25000 = -1350
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -1350,
      tradeDate: '2026-04-09'
    });
    expect(r.newBalance).toBe(23650);
    expect(r.distanceToDD).toBeCloseTo(0.10, 2);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.DD_NEAR);
  });

  it('loss até bust → ACCOUNT_BUST', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -1500, // newBalance = 23500 = threshold (≤)
      tradeDate: '2026-04-09'
    });
    expect(r.flags).toContain(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  });
});

// ============================================
// calculateDrawdownState — TRAILING_EOD
// ============================================
describe('calculateDrawdownState — TRAILING_EOD', () => {
  const tpl = TRAILING_EOD_NO_LOCK;
  const accountSize = 50000;

  it('vários trades no MESMO dia: peak NÃO atualiza intraday', () => {
    let state = freshState(tpl);
    let balance = accountSize;

    // 3 wins no mesmo dia
    for (const w of [200, 300, 400]) {
      const r = calculateDrawdownState({
        propFirm: state, template: tpl, accountSize,
        balanceBefore: balance, tradeNet: w, tradeDate: '2026-04-09'
      });
      state = { ...state, ...r };
      balance = r.newBalance;
    }

    // peak permanece accountSize (snapshot só acontece na virada do dia)
    expect(state.peakBalance).toBe(50000);
    expect(state.currentDrawdownThreshold).toBe(48000); // 50K - 2K
    expect(balance).toBe(50900);
  });

  it('virada do dia: peak snapshot do saldo de fechamento do dia anterior', () => {
    let state = freshState(tpl);
    let balance = accountSize;

    // Dia 1: termina em +900
    for (const w of [200, 300, 400]) {
      const r = calculateDrawdownState({
        propFirm: state, template: tpl, accountSize,
        balanceBefore: balance, tradeNet: w, tradeDate: '2026-04-09'
      });
      state = { ...state, ...r };
      balance = r.newBalance;
    }
    expect(state.peakBalance).toBe(50000); // ainda não atualizou

    // Dia 2: primeiro trade — peak deve atualizar para o saldo de fechamento do dia anterior
    const r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: balance, // 50900
      tradeNet: 100,
      tradeDate: '2026-04-10'
    });
    expect(r.peakBalance).toBe(50900); // snapshot do saldo do dia anterior
    expect(r.currentDrawdownThreshold).toBe(48900); // 50900 - 2000
    expect(r.tradingDays).toBe(2);
    expect(r.isNewDay).toBe(true);
  });

  it('virada do dia com saldo MENOR não baixa o peak', () => {
    let state = freshState(tpl);
    // dia 1: vai pra 51K depois cai pra 50.5K
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 50000, tradeNet: 1000, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 51000, tradeNet: -500, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    // dia 2: peak snapshot do fechamento (50.5K) — mas peak começou em 50K, então max(50K, 50.5K) = 50.5K
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 50500, tradeNet: 100, tradeDate: '2026-04-10'
    });
    expect(r.peakBalance).toBe(50500);
  });

  it('múltiplos dias em sequência: peak escala monotonicamente', () => {
    let state = freshState(tpl);
    let balance = accountSize;
    const dailyResults = [+800, +400, -200, +600];
    const dates = ['2026-04-09', '2026-04-10', '2026-04-11', '2026-04-12'];

    dailyResults.forEach((dailyNet, i) => {
      const r = calculateDrawdownState({
        propFirm: state, template: tpl, accountSize,
        balanceBefore: balance, tradeNet: dailyNet, tradeDate: dates[i]
      });
      state = { ...state, ...r };
      balance = r.newBalance;
    });

    // Dia 1 fechou em 50800, dia 2 em 51200, dia 3 em 51000, dia 4 em 51600
    // Peak no início do dia 4 deveria ser max sobre fechamentos vistos: 51200
    // No dia 4 (último processado), peak já atualizou para 51000 (fechamento do dia 3)
    // Mas peakMax monotonicamente: 50000 → 50800 (d2) → 51200 (d3) → 51200 (d4)
    expect(state.peakBalance).toBe(51200);
    expect(state.tradingDays).toBe(4);
  });
});

// ============================================
// calculateDrawdownState — Lock (Apex EOD com lockFormula)
// ============================================
describe('calculateDrawdownState — Lock (Apex EOD 25K)', () => {
  const tpl = APEX_EOD_25K;
  const accountSize = 25000;

  it('lockAt = accountSize + DD + 100 = 26100', () => {
    expect(resolveLockAt(tpl, accountSize)).toBe(26100);
  });

  it('peak abaixo do lockAt → lockLevel ainda null', () => {
    let state = freshState(tpl);
    // dia 1: ganha 500 → 25500
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 25000, tradeNet: 500, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    // dia 2: snapshot peak para 25500
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 25500, tradeNet: 100, tradeDate: '2026-04-10'
    });
    expect(r.peakBalance).toBe(25500);
    expect(r.lockLevel).toBeNull();
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.LOCK_ACTIVATED);
  });

  it('peak atinge lockAt 26100 → lock ativado, threshold congela em accountSize', () => {
    let state = freshState(tpl);
    // dia 1: fechou em 26200 (> lockAt 26100)
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 25000, tradeNet: 1200, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    // No fim do dia 1 ainda não disparou (peak = 25000 ainda — só atualiza no dia seguinte)
    expect(state.peakBalance).toBe(25000);

    // dia 2: snapshot peak = 26200, dispara lock (>= 26100)
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 26200, tradeNet: 100, tradeDate: '2026-04-10'
    });
    expect(r.peakBalance).toBe(26200);
    expect(r.lockLevel).toBe(25000); // congela em accountSize
    expect(r.currentDrawdownThreshold).toBe(25000);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.LOCK_ACTIVATED);
  });

  it('após lock: novos peaks não movem mais o threshold', () => {
    let state = freshState(tpl);
    // ativa o lock
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 25000, tradeNet: 1500, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 26500, tradeNet: 100, tradeDate: '2026-04-10'
    });
    state = { ...state, ...r };
    expect(state.lockLevel).toBe(25000);
    expect(state.currentDrawdownThreshold).toBe(25000);

    // Mais wins não devem mover o threshold
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 26600, tradeNet: 500, tradeDate: '2026-04-10'
    });
    expect(r.lockLevel).toBe(25000);
    expect(r.currentDrawdownThreshold).toBe(25000);
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.LOCK_ACTIVATED); // já estava ativo
  });
});

// ============================================
// calculateDrawdownState — Daily Loss (soft)
// ============================================
describe('calculateDrawdownState — Daily Loss', () => {
  const tpl = APEX_EOD_25K; // dailyLossLimit = 500
  const accountSize = 25000;

  it('dailyPnL > -limit: isDayPaused false', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -300,
      tradeDate: '2026-04-09'
    });
    expect(r.dailyPnL).toBe(-300);
    expect(r.isDayPaused).toBe(false);
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.DAILY_LOSS_HIT);
  });

  it('dailyPnL = -limit exato: isDayPaused true', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -500,
      tradeDate: '2026-04-09'
    });
    expect(r.dailyPnL).toBe(-500);
    expect(r.isDayPaused).toBe(true);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.DAILY_LOSS_HIT);
  });

  it('soma cumulativa atinge limite: isDayPaused true', () => {
    let state = freshState(tpl);
    // -200 -200 -150 = -550 ≤ -500
    let balance = 25000;
    let r;
    for (const net of [-200, -200, -150]) {
      r = calculateDrawdownState({
        propFirm: state, template: tpl, accountSize,
        balanceBefore: balance, tradeNet: net, tradeDate: '2026-04-09'
      });
      state = { ...state, ...r };
      balance = r.newBalance;
    }
    expect(state.dailyPnL).toBe(-550);
    expect(state.isDayPaused).toBe(true);
  });

  it('reset no dia seguinte: isDayPaused false e dailyPnL zera', () => {
    let state = freshState(tpl);
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 25000, tradeNet: -500, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    expect(state.isDayPaused).toBe(true);

    // Próximo dia
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: 24500, tradeNet: 100, tradeDate: '2026-04-10'
    });
    expect(r.isDayPaused).toBe(false);
    expect(r.dailyPnL).toBe(100); // só este trade
    expect(r.tradingDays).toBe(2);
  });

  it('template sem dailyLossLimit: nunca pausa o dia', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(NO_DAILY_LOSS_TEMPLATE),
      template: NO_DAILY_LOSS_TEMPLATE,
      accountSize: 50000,
      balanceBefore: 50000,
      tradeNet: -2000,
      tradeDate: '2026-04-09'
    });
    expect(r.isDayPaused).toBe(false);
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.DAILY_LOSS_HIT);
  });
});

// ============================================
// calculateDrawdownState — distanceToDD
// ============================================
describe('calculateDrawdownState — distanceToDD', () => {
  const tpl = APEX_INTRADAY_25K; // DD 1500
  const accountSize = 25000;

  it('inicial: distância 100% (1.0)', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 0,
      tradeDate: '2026-04-09'
    });
    expect(r.distanceToDD).toBe(1);
  });

  it('loss de metade do DD: distância ~50%', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -750,
      tradeDate: '2026-04-09'
    });
    expect(r.distanceToDD).toBeCloseTo(0.5, 2);
  });

  it('distância < 20% → flag DD_NEAR', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -1300, // distância (23700-23500)/1500 = 0.133
      tradeDate: '2026-04-09'
    });
    expect(r.distanceToDD).toBeLessThan(DD_NEAR_THRESHOLD);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.DD_NEAR);
  });

  it('distância exatamente 20%: SEM flag (threshold é estrito <)', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -1200, // distância 0.20 exato
      tradeDate: '2026-04-09'
    });
    expect(r.distanceToDD).toBeCloseTo(0.2, 2);
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.DD_NEAR);
  });

  it('bust → distância 0', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize,
      balanceBefore: 25000,
      tradeNet: -1500,
      tradeDate: '2026-04-09'
    });
    expect(r.distanceToDD).toBe(0);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  });
});

// ============================================
// calculateDrawdownState — edge cases / validações
// ============================================
describe('calculateDrawdownState — edge cases', () => {
  const tpl = APEX_INTRADAY_25K;

  it('lança erro sem template.drawdown', () => {
    expect(() => calculateDrawdownState({
      propFirm: {}, template: null, accountSize: 25000,
      balanceBefore: 25000, tradeNet: 0, tradeDate: '2026-04-09'
    })).toThrow();
  });

  it('lança erro sem accountSize válido', () => {
    expect(() => calculateDrawdownState({
      propFirm: {}, template: tpl, accountSize: 0,
      balanceBefore: 25000, tradeNet: 0, tradeDate: '2026-04-09'
    })).toThrow();
  });

  it('lança erro sem tradeDate', () => {
    expect(() => calculateDrawdownState({
      propFirm: {}, template: tpl, accountSize: 25000,
      balanceBefore: 25000, tradeNet: 0, tradeDate: null
    })).toThrow();
  });

  it('primeiro trade ever (lastTradeDate null): isNewDay true, tradingDays 1', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize: 25000,
      balanceBefore: 25000,
      tradeNet: 100,
      tradeDate: '2026-04-09'
    });
    expect(r.isNewDay).toBe(true);
    expect(r.tradingDays).toBe(1);
    expect(r.dailyPnL).toBe(100);
  });

  it('mesmo dia (segundo trade): isNewDay false, tradingDays não incrementa', () => {
    let state = freshState(tpl);
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize: 25000,
      balanceBefore: 25000, tradeNet: 100, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize: 25000,
      balanceBefore: 25100, tradeNet: 200, tradeDate: '2026-04-09'
    });
    expect(r.isNewDay).toBe(false);
    expect(r.tradingDays).toBe(1); // ainda 1
    expect(r.dailyPnL).toBe(300); // soma dos dois
  });

  it('tradeNet 0: estado quase imutável, mas tradingDays incrementa se isNewDay', () => {
    const r = calculateDrawdownState({
      propFirm: freshState(tpl),
      template: tpl,
      accountSize: 25000,
      balanceBefore: 25000,
      tradeNet: 0,
      tradeDate: '2026-04-09'
    });
    expect(r.newBalance).toBe(25000);
    expect(r.dailyPnL).toBe(0);
    expect(r.tradingDays).toBe(1);
  });
});

// ============================================
// calculateEvalDaysRemaining + isEvalDeadlineNear
// ============================================
describe('calculateEvalDaysRemaining', () => {
  it('deadline em 10 dias corridos: retorna 10', () => {
    const start = new Date('2026-04-09');
    const now = new Date('2026-04-09');
    expect(calculateEvalDaysRemaining(start, 10, now)).toBe(10);
  });

  it('5 dias após início, eval 30: retorna 25', () => {
    const start = new Date('2026-04-01');
    const now = new Date('2026-04-06');
    expect(calculateEvalDaysRemaining(start, 30, now)).toBe(25);
  });

  it('expirado: retorna 0 (não negativo)', () => {
    const start = new Date('2026-03-01');
    const now = new Date('2026-04-09');
    expect(calculateEvalDaysRemaining(start, 30, now)).toBe(0);
  });

  it('inputs inválidos: retorna null', () => {
    expect(calculateEvalDaysRemaining(null, 30)).toBeNull();
    expect(calculateEvalDaysRemaining('2026-04-01', 0)).toBeNull();
    expect(calculateEvalDaysRemaining('not-a-date', 30)).toBeNull();
  });

  it('aceita string ISO', () => {
    const now = new Date('2026-04-09');
    expect(calculateEvalDaysRemaining('2026-04-01', 30, now)).toBe(22);
  });
});

describe('isEvalDeadlineNear', () => {
  it('null/undefined → false', () => {
    expect(isEvalDeadlineNear(null)).toBe(false);
    expect(isEvalDeadlineNear(undefined)).toBe(false);
  });

  it('expirado (0) → false (não é "near", já passou)', () => {
    expect(isEvalDeadlineNear(0)).toBe(false);
  });

  it('5 dias com threshold 7 → true', () => {
    expect(isEvalDeadlineNear(5, 7)).toBe(true);
  });

  it('7 dias com threshold 7 → true (limite incluso)', () => {
    expect(isEvalDeadlineNear(7, 7)).toBe(true);
  });

  it('10 dias com threshold 7 → false', () => {
    expect(isEvalDeadlineNear(10, 7)).toBe(false);
  });
});

// ============================================
// Cenário integrado — Apex 25K eval realista
// ============================================
describe('Cenário integrado — Apex EOD 25K eval realista', () => {
  it('5 dias de trading com mix de wins/losses, sem disparar nada', () => {
    const tpl = APEX_EOD_25K;
    const accountSize = 25000;
    let state = freshState(tpl);
    let balance = accountSize;

    const days = [
      { date: '2026-04-09', trades: [+150, +100] },     // +250
      { date: '2026-04-10', trades: [-200, +300] },     // +100
      { date: '2026-04-13', trades: [+200] },            // +200
      { date: '2026-04-14', trades: [-100, -150] },     // -250
      { date: '2026-04-15', trades: [+250, +200] }      // +450
    ];

    for (const day of days) {
      for (const net of day.trades) {
        const r = calculateDrawdownState({
          propFirm: state, template: tpl, accountSize,
          balanceBefore: balance, tradeNet: net, tradeDate: day.date
        });
        state = { ...state, ...r };
        balance = r.newBalance;
      }
    }

    expect(balance).toBe(25750); // 25K + 750
    expect(state.tradingDays).toBe(5);
    expect(state.peakBalance).toBeGreaterThan(25000);
    expect(state.lockLevel).toBeNull(); // longe do lockAt 26100
    expect(state.flags).not.toContain(DRAWDOWN_FLAGS.ACCOUNT_BUST);
    expect(state.flags).not.toContain(DRAWDOWN_FLAGS.DAILY_LOSS_HIT);
  });

  it('dia ruim que estoura daily loss + bust no mesmo dia', () => {
    const tpl = APEX_EOD_25K;
    const accountSize = 25000;
    let state = freshState(tpl);
    let balance = accountSize;

    // -300 -250 = -550 (estoura daily loss)
    let r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: balance, tradeNet: -300, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    balance = r.newBalance;
    expect(state.isDayPaused).toBe(false);

    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: balance, tradeNet: -250, tradeDate: '2026-04-09'
    });
    state = { ...state, ...r };
    balance = r.newBalance;
    expect(state.isDayPaused).toBe(true);
    expect(state.flags).toContain(DRAWDOWN_FLAGS.DAILY_LOSS_HIT);

    // Trader segue operando mesmo com isDayPaused (engine não bloqueia)
    // Trade adicional empurra para bust: balance 24450 → -500 = 23950
    // threshold inicial 24000, então 23950 < 24000 → bust
    r = calculateDrawdownState({
      propFirm: state, template: tpl, accountSize,
      balanceBefore: balance, tradeNet: -500, tradeDate: '2026-04-09'
    });
    expect(r.flags).toContain(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  });
});

// ============================================
// TRAILING_TO_STATIC (Ylos Funded) — issue #136 Fase B
// ============================================
const YLOS_FUNDED_25K = {
  drawdown: {
    type: DRAWDOWN_TYPES.TRAILING_TO_STATIC,
    maxAmount: 1500,
    staticTrigger: 100,
    lockAt: null,
    lockFormula: null
  },
  dailyLossLimit: null,
  profitTarget: 1500,
  evalTimeLimit: 30,
  accountSize: 25000
};

describe('calculateDrawdownState — TRAILING_TO_STATIC (Ylos freeze)', () => {
  const accountSize = 25000;

  it('trail sobe normalmente antes do trigger', () => {
    const state = freshState(YLOS_FUNDED_25K);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_FUNDED_25K,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 1000,
      tradeDate: '2026-04-10'
    });
    expect(r.peakBalance).toBe(26000);
    expect(r.currentDrawdownThreshold).toBe(24500);
    expect(r.trailFrozen).toBe(false);
    expect(r.flags).not.toContain('TRAIL_FROZEN');
  });

  it('freeze exato no trigger (balance == accountSize + DD + staticTrigger)', () => {
    const state = freshState(YLOS_FUNDED_25K);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_FUNDED_25K,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 1600,
      tradeDate: '2026-04-10'
    });
    expect(r.trailFrozen).toBe(true);
    expect(r.currentDrawdownThreshold).toBe(25100);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
  });

  it('freeze após salto grande (balance ultrapassa trigger)', () => {
    const state = freshState(YLOS_FUNDED_25K);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_FUNDED_25K,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 2000,
      tradeDate: '2026-04-10'
    });
    expect(r.trailFrozen).toBe(true);
    expect(r.currentDrawdownThreshold).toBe(25500);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
  });

  it('balance cai após freeze: threshold permanece, peak não se move', () => {
    let state = freshState(YLOS_FUNDED_25K);
    let r = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 25000, tradeNet: 2000, tradeDate: '2026-04-10'
    });
    state = { ...state, ...r };

    r = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 27000, tradeNet: -1000, tradeDate: '2026-04-10'
    });
    expect(r.trailFrozen).toBe(true);
    expect(r.peakBalance).toBe(27000);
    expect(r.currentDrawdownThreshold).toBe(25500);
    expect(r.flags).not.toContain('TRAIL_FROZEN');
  });

  it('balance sobe após freeze: threshold NÃO sobe mais (congelado)', () => {
    let state = freshState(YLOS_FUNDED_25K);
    let r = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 25000, tradeNet: 2000, tradeDate: '2026-04-10'
    });
    state = { ...state, ...r };

    r = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 27000, tradeNet: 1000, tradeDate: '2026-04-10'
    });
    expect(r.trailFrozen).toBe(true);
    expect(r.peakBalance).toBe(27000);
    expect(r.currentDrawdownThreshold).toBe(25500);
  });

  it('bust detection após freeze: balance abaixo do threshold congelado', () => {
    let state = freshState(YLOS_FUNDED_25K);
    let r = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 25000, tradeNet: 2000, tradeDate: '2026-04-10'
    });
    state = { ...state, ...r };

    r = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 27000, tradeNet: -2000, tradeDate: '2026-04-10'
    });
    expect(r.newBalance).toBe(25000);
    expect(r.currentDrawdownThreshold).toBe(25500);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.ACCOUNT_BUST);
  });

  it('flag TRAIL_FROZEN emitida uma única vez', () => {
    let state = freshState(YLOS_FUNDED_25K);
    let r1 = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 25000, tradeNet: 2000, tradeDate: '2026-04-10'
    });
    state = { ...state, ...r1 };
    expect(r1.flags).toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);

    const r2 = calculateDrawdownState({
      propFirm: state, template: YLOS_FUNDED_25K, accountSize,
      balanceBefore: 27000, tradeNet: 500, tradeDate: '2026-04-10'
    });
    expect(r2.flags).not.toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
  });

  it('staticTrigger custom (500) desloca o trigger', () => {
    const tplCustom = {
      ...YLOS_FUNDED_25K,
      drawdown: { ...YLOS_FUNDED_25K.drawdown, staticTrigger: 500 }
    };
    const state = freshState(tplCustom);
    const rBefore = calculateDrawdownState({
      propFirm: state, template: tplCustom, accountSize,
      balanceBefore: 25000, tradeNet: 1999, tradeDate: '2026-04-10'
    });
    expect(rBefore.trailFrozen).toBe(false);

    const rAt = calculateDrawdownState({
      propFirm: state, template: tplCustom, accountSize,
      balanceBefore: 25000, tradeNet: 2000, tradeDate: '2026-04-10'
    });
    expect(rAt.trailFrozen).toBe(true);
  });

  it('staticTrigger ausente → default 100', () => {
    const tplNoTrigger = {
      ...YLOS_FUNDED_25K,
      drawdown: { type: DRAWDOWN_TYPES.TRAILING_TO_STATIC, maxAmount: 1500, lockAt: null, lockFormula: null }
    };
    const state = freshState(tplNoTrigger);
    const r = calculateDrawdownState({
      propFirm: state, template: tplNoTrigger, accountSize,
      balanceBefore: 25000, tradeNet: 1600, tradeDate: '2026-04-10'
    });
    expect(r.trailFrozen).toBe(true);
  });

  it('regressão Apex EOD 25K: path antigo intocado — lock Apex não afetado', () => {
    let state = freshState(APEX_EOD_25K);
    let r = calculateDrawdownState({
      propFirm: state, template: APEX_EOD_25K, accountSize: 25000,
      balanceBefore: 25000, tradeNet: 1200, tradeDate: '2026-04-10'
    });
    state = { ...state, ...r };
    r = calculateDrawdownState({
      propFirm: state, template: APEX_EOD_25K, accountSize: 25000,
      balanceBefore: 26200, tradeNet: 0, tradeDate: '2026-04-11'
    });
    expect(r.lockLevel).toBe(25000);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.LOCK_ACTIVATED);
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
    expect(r.trailFrozen).toBe(false);
  });
});

// ============================================
// Phase-aware drawdown (Ylos fundedDrawdown) — issue #136 Fase C
// ============================================
const YLOS_25K_PHASE_AWARE = {
  firm: 'YLOS',
  accountSize: 25000,
  dailyLossLimit: null,
  profitTarget: 1500,
  evalTimeLimit: 30,
  // EVALUATION (Challenge): TRAILING_EOD, sem lock
  drawdown: {
    type: DRAWDOWN_TYPES.TRAILING_EOD,
    maxAmount: 1500,
    lockAt: null,
    lockFormula: null
  },
  // SIM_FUNDED/LIVE: TRAILING_TO_STATIC com freeze
  fundedDrawdown: {
    type: DRAWDOWN_TYPES.TRAILING_TO_STATIC,
    maxAmount: 1500,
    staticTrigger: 100,
    lockAt: null,
    lockFormula: null
  }
};

describe('calculateDrawdownState — phase-aware (fundedDrawdown)', () => {
  const accountSize = 25000;

  it('phase EVALUATION: Ylos lê template.drawdown (TRAILING_EOD), não fundedDrawdown', () => {
    const state = freshState(YLOS_25K_PHASE_AWARE);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_25K_PHASE_AWARE,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 2000, // 27000 — acima do trigger funded, mas EVAL não aplica
      tradeDate: '2026-04-10',
      phase: 'EVALUATION'
    });
    expect(r.trailFrozen).toBe(false);
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
    // EOD não atualiza peak intraday no primeiro trade
    expect(r.peakBalance).toBe(25000);
  });

  it('phase SIM_FUNDED: Ylos lê fundedDrawdown (TRAILING_TO_STATIC), freeze dispara', () => {
    const state = freshState(YLOS_25K_PHASE_AWARE);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_25K_PHASE_AWARE,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 2000, // 27000 — acima do trigger
      tradeDate: '2026-04-10',
      phase: 'SIM_FUNDED'
    });
    expect(r.trailFrozen).toBe(true);
    expect(r.currentDrawdownThreshold).toBe(25500);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
  });

  it('phase LIVE: mesma lógica de SIM_FUNDED', () => {
    const state = freshState(YLOS_25K_PHASE_AWARE);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_25K_PHASE_AWARE,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 2000,
      tradeDate: '2026-04-10',
      phase: 'LIVE'
    });
    expect(r.trailFrozen).toBe(true);
    expect(r.flags).toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
  });

  it('phase ausente: default EVALUATION (back-compat com chamadas antigas)', () => {
    const state = freshState(YLOS_25K_PHASE_AWARE);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_25K_PHASE_AWARE,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 2000,
      tradeDate: '2026-04-10'
      // phase omitido
    });
    expect(r.trailFrozen).toBe(false); // EVAL default → usa drawdown (EOD)
  });

  it('template sem fundedDrawdown (Apex) em phase SIM_FUNDED: cai no drawdown default', () => {
    const state = freshState(APEX_EOD_25K);
    const r = calculateDrawdownState({
      propFirm: state,
      template: APEX_EOD_25K,
      accountSize: 25000,
      balanceBefore: 25000,
      tradeNet: 500,
      tradeDate: '2026-04-10',
      phase: 'SIM_FUNDED'
    });
    // Apex não tem fundedDrawdown → usa template.drawdown (TRAILING_EOD) normal
    expect(r.trailFrozen).toBe(false);
    expect(r.flags).not.toContain(DRAWDOWN_FLAGS.TRAIL_FROZEN);
  });

  it('phase SIM_FUNDED: trail sobe antes do trigger Ylos', () => {
    const state = freshState(YLOS_25K_PHASE_AWARE);
    const r = calculateDrawdownState({
      propFirm: state,
      template: YLOS_25K_PHASE_AWARE,
      accountSize,
      balanceBefore: 25000,
      tradeNet: 1000, // 26000, abaixo do trigger 26600
      tradeDate: '2026-04-10',
      phase: 'SIM_FUNDED'
    });
    expect(r.peakBalance).toBe(26000); // intraday, trail ativo
    expect(r.currentDrawdownThreshold).toBe(24500);
    expect(r.trailFrozen).toBe(false);
  });
});
