import { describe, it, expect } from 'vitest';
import {
  getCycleKey,
  parseCycleKey,
  detectActiveCycle,
  resolveCycle,
  getPeriodRange,
  getDefaultContext,
  getDefaultPlanForAccount,
  PERIOD_KIND,
  CYCLE_STATUS
} from '../../utils/cycleResolver';

// ============================================
// getCycleKey
// ============================================

describe('getCycleKey', () => {
  it('Mensal gera "YYYY-MM"', () => {
    expect(getCycleKey('Mensal', new Date(2026, 3, 15))).toBe('2026-04');
  });

  it('Trimestral gera "YYYY-Qn"', () => {
    expect(getCycleKey('Trimestral', new Date(2026, 0, 15))).toBe('2026-Q1');
    expect(getCycleKey('Trimestral', new Date(2026, 3, 15))).toBe('2026-Q2');
    expect(getCycleKey('Trimestral', new Date(2026, 6, 15))).toBe('2026-Q3');
    expect(getCycleKey('Trimestral', new Date(2026, 10, 15))).toBe('2026-Q4');
  });

  it('default Mensal quando não especificado', () => {
    expect(getCycleKey(undefined, new Date(2026, 3, 15))).toBe('2026-04');
  });

  it('retorna null para data inválida', () => {
    expect(getCycleKey('Mensal', new Date('invalid'))).toBeNull();
  });
});

// ============================================
// parseCycleKey
// ============================================

describe('parseCycleKey', () => {
  it('parseia "YYYY-MM" para início do mês', () => {
    const d = parseCycleKey('2026-04');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(1);
  });

  it('parseia "YYYY-Qn" para início do trimestre', () => {
    const d = parseCycleKey('2026-Q2');
    expect(d.getMonth()).toBe(3); // abril
    expect(d.getDate()).toBe(1);
  });

  it('retorna null para formato inválido', () => {
    expect(parseCycleKey('invalid')).toBeNull();
    expect(parseCycleKey(null)).toBeNull();
    expect(parseCycleKey('')).toBeNull();
  });

  it('roundtrip getCycleKey → parseCycleKey preserva mês/trimestre', () => {
    const key1 = getCycleKey('Mensal', new Date(2026, 5, 20));
    const back = parseCycleKey(key1);
    expect(back.getMonth()).toBe(5);
  });
});

// ============================================
// detectActiveCycle
// ============================================

describe('detectActiveCycle', () => {
  it('Mensal: retorna ciclo ativo do mês atual', () => {
    const plan = { id: 'p1', adjustmentCycle: 'Mensal' };
    const now = new Date(2026, 3, 15);
    const cycle = detectActiveCycle(plan, now);
    expect(cycle).not.toBeNull();
    expect(cycle.cycleKey).toBe('2026-04');
    expect(cycle.start.getMonth()).toBe(3);
    expect(cycle.start.getDate()).toBe(1);
    expect(cycle.end.getMonth()).toBe(3);
    expect(cycle.end.getDate()).toBe(30);
    expect(cycle.status).toBe(CYCLE_STATUS.ACTIVE);
  });

  it('Trimestral: retorna ciclo ativo do trimestre atual', () => {
    const plan = { id: 'p1', adjustmentCycle: 'Trimestral' };
    const now = new Date(2026, 4, 15); // maio = Q2
    const cycle = detectActiveCycle(plan, now);
    expect(cycle.cycleKey).toBe('2026-Q2');
    expect(cycle.start.getMonth()).toBe(3); // abril
    expect(cycle.end.getMonth()).toBe(5); // junho
  });

  it('default Mensal quando plan.adjustmentCycle ausente', () => {
    const plan = { id: 'p1' };
    const cycle = detectActiveCycle(plan, new Date(2026, 3, 15));
    expect(cycle.cycleKey).toBe('2026-04');
  });

  it('retorna null para plan null', () => {
    expect(detectActiveCycle(null)).toBeNull();
  });
});

// ============================================
// resolveCycle
// ============================================

describe('resolveCycle', () => {
  it('reconstrói range de cycleKey persistido', () => {
    const plan = { adjustmentCycle: 'Mensal' };
    const cycle = resolveCycle('2026-04', plan, new Date(2026, 3, 15));
    expect(cycle.cycleKey).toBe('2026-04');
    expect(cycle.start.getMonth()).toBe(3);
    expect(cycle.status).toBe(CYCLE_STATUS.ACTIVE);
  });

  it('marca como FINALIZED se now > cycleEnd', () => {
    const plan = { adjustmentCycle: 'Mensal' };
    const now = new Date(2026, 5, 15); // 2 meses depois
    const cycle = resolveCycle('2026-04', plan, now);
    expect(cycle.status).toBe(CYCLE_STATUS.FINALIZED);
  });

  it('retorna null para cycleKey inválido', () => {
    expect(resolveCycle('foo', { adjustmentCycle: 'Mensal' })).toBeNull();
  });
});

// ============================================
// getPeriodRange
// ============================================

describe('getPeriodRange', () => {
  const cycle = {
    start: new Date(2026, 3, 1),
    end: new Date(2026, 3, 30, 23, 59, 59, 999)
  };

  it('CYCLE retorna range inteiro do ciclo', () => {
    const r = getPeriodRange(cycle, PERIOD_KIND.CYCLE, new Date(2026, 3, 15));
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getDate()).toBe(30);
    expect(r.kind).toBe(PERIOD_KIND.CYCLE);
  });

  it('WEEK retorna semana ISO atual clamped ao ciclo', () => {
    const now = new Date(2026, 3, 15); // quarta-feira
    const r = getPeriodRange(cycle, PERIOD_KIND.WEEK, now);
    expect(r.start.getDay()).toBe(1); // segunda
    expect(r.kind).toBe(PERIOD_KIND.WEEK);
  });

  it('MONTH retorna mês atual (intersectado com ciclo)', () => {
    const r = getPeriodRange(cycle, PERIOD_KIND.MONTH, new Date(2026, 3, 15));
    expect(r.start.getMonth()).toBe(3);
    expect(r.end.getMonth()).toBe(3);
    expect(r.kind).toBe(PERIOD_KIND.MONTH);
  });

  it('WEEK fora do ciclo é clamped', () => {
    // Semana terminando no domingo que atravessa o fim do mês
    const cycleApril = {
      start: new Date(2026, 3, 1),
      end: new Date(2026, 3, 30, 23, 59, 59, 999)
    };
    const r = getPeriodRange(cycleApril, PERIOD_KIND.WEEK, new Date(2026, 3, 30));
    expect(r.end.getMonth()).toBe(3); // não ultrapassa abril
  });

  it('retorna null se cycle ausente', () => {
    expect(getPeriodRange(null, PERIOD_KIND.CYCLE)).toBeNull();
  });
});

// ============================================
// getDefaultContext
// ============================================

describe('getDefaultContext', () => {
  const accounts = [
    { id: 'a1', active: true },
    { id: 'a2', active: true },
    { id: 'a3', active: false }
  ];

  it('escolhe conta com plano mais recente', () => {
    const plans = [
      { id: 'p1', accountId: 'a1', createdAt: '2026-01-01', adjustmentCycle: 'Mensal' },
      { id: 'p2', accountId: 'a2', createdAt: '2026-04-01', adjustmentCycle: 'Mensal' }
    ];
    const now = new Date(2026, 3, 15);
    const ctx = getDefaultContext(accounts, plans, now);
    // a1 é a primeira conta na lista E tem plano → a1 vence (per implementação atual)
    expect(ctx.accountId).toBe('a1');
    expect(ctx.planId).toBe('p1');
    expect(ctx.cycleKey).toBe('2026-04');
  });

  it('ignora contas inativas', () => {
    const plans = [
      { id: 'p3', accountId: 'a3', createdAt: '2026-04-01', adjustmentCycle: 'Mensal' }
    ];
    const ctx = getDefaultContext(accounts, plans, new Date(2026, 3, 15));
    // a3 é inativa → não entra. Sem plano em a1/a2 → primeira conta ativa (a1) sem plano
    expect(ctx.accountId).toBe('a1');
    expect(ctx.planId).toBeNull();
  });

  it('sem contas retorna tudo null', () => {
    const ctx = getDefaultContext([], []);
    expect(ctx.accountId).toBeNull();
    expect(ctx.planId).toBeNull();
  });

  it('conta sem plano retorna planId null mas accountId setado', () => {
    const ctx = getDefaultContext([{ id: 'a1', active: true }], []);
    expect(ctx.accountId).toBe('a1');
    expect(ctx.planId).toBeNull();
    expect(ctx.cycleKey).toBeNull();
    expect(ctx.period).toBeNull();
  });

  it('ordena planos por createdAt DESC com id DESC como tiebreaker', () => {
    const plans = [
      { id: 'pA', accountId: 'a1', createdAt: '2026-04-01', adjustmentCycle: 'Mensal' },
      { id: 'pB', accountId: 'a1', createdAt: '2026-04-01', adjustmentCycle: 'Mensal' }
    ];
    const ctx = getDefaultContext([{ id: 'a1', active: true }], plans, new Date(2026, 3, 15));
    expect(ctx.planId).toBe('pB'); // id DESC
  });

  it('inclui period default = CYCLE com start/end ISO', () => {
    const plans = [{ id: 'p1', accountId: 'a1', createdAt: '2026-04-01', adjustmentCycle: 'Mensal' }];
    const ctx = getDefaultContext([{ id: 'a1', active: true }], plans, new Date(2026, 3, 15));
    expect(ctx.period.kind).toBe(PERIOD_KIND.CYCLE);
    expect(ctx.period.start).toBe('2026-04-01');
    expect(ctx.period.end).toBe('2026-04-30');
  });
});

// ============================================
// getDefaultPlanForAccount
// ============================================

describe('getDefaultPlanForAccount', () => {
  it('retorna plano mais recente da conta', () => {
    const plans = [
      { id: 'p1', accountId: 'a1', createdAt: '2026-01-01' },
      { id: 'p2', accountId: 'a1', createdAt: '2026-03-01' },
      { id: 'p3', accountId: 'a2', createdAt: '2026-04-01' }
    ];
    expect(getDefaultPlanForAccount(plans, 'a1').id).toBe('p2');
    expect(getDefaultPlanForAccount(plans, 'a2').id).toBe('p3');
  });

  it('retorna null sem accountId', () => {
    expect(getDefaultPlanForAccount([], null)).toBeNull();
  });

  it('retorna null se conta não tem planos', () => {
    expect(getDefaultPlanForAccount([{ accountId: 'a2' }], 'a1')).toBeNull();
  });
});
