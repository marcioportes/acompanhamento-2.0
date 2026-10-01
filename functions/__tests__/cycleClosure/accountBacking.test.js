/**
 * accountBacking.test.js — issue #480
 *
 * O lastro da conta lido pelo `closeCycle`: saldo, PL dos outros planos ativos e
 * resultado dos trades posteriores ao ciclo. A conta vem do plano gravado.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readAccountBacking } = require('../../cycleClosure/accountBacking');

const snap = (id, data) => ({ id, exists: data != null, data: () => data });

/** Firestore de mentira: só o que `readAccountBacking` usa. */
const fakeDb = (base) => ({
  collection: (name) => ({
    doc: (id) => ({ get: async () => snap(id, base[name]?.[id] ?? null) }),
    where: (field, _op, value) => ({
      select: () => ({
        get: async () => {
          const docs = Object.entries(base[name] || {})
            .filter(([, d]) => d[field] === value)
            .map(([id, d]) => snap(id, d));
          return { forEach: (fn) => docs.forEach(fn) };
        },
      }),
    }),
  }),
});

const BASE = {
  plans: {
    p1: { accountId: 'a1', pl: 25645.6, active: true },
    p2: { accountId: 'a1', pl: 20000, active: true },
    p3: { accountId: 'a1', pl: 9000, active: false },
    p4: { accountId: 'a2', pl: 7000, active: true },
  },
  accounts: { a1: { currentBalance: 81500, initialBalance: 1997 } },
  trades: {
    t1: { planId: 'p1', date: '2026-09-15', result: -287.8 },
    t2: { planId: 'p1', date: '2026-09-30', result: 100 },
    t3: { planId: 'p1', date: '2026-10-01', result: 1500 },
    t4: { planId: 'p2', date: '2026-10-01', result: 999 },
  },
};

describe('#480 · readAccountBacking', () => {
  it('soma só os outros planos ATIVOS da mesma conta e só os trades pós-ciclo deste plano', async () => {
    const out = await readAccountBacking(fakeDb(BASE), { planId: 'p1', cycleEnd: '2026-09-30' });
    expect(out).toEqual({ accountId: 'a1', accountBalance: 81500, otherPlansPl: 20000, postCycleResult: 1500 });
  });

  it('cai no initialBalance quando a conta ainda não tem currentBalance', async () => {
    const base = { ...BASE, accounts: { a1: { initialBalance: 30000 } } };
    const out = await readAccountBacking(fakeDb(base), { planId: 'p1', cycleEnd: '2026-09-30' });
    expect(out.accountBalance).toBe(30000);
  });

  it('saldo ilegível vira null — o teto cai no equity do ciclo', async () => {
    const base = { ...BASE, accounts: { a1: { currentBalance: 'abc' } } };
    const out = await readAccountBacking(fakeDb(base), { planId: 'p1', cycleEnd: '2026-09-30' });
    expect(out.accountBalance).toBeNull();
  });

  it('plano sem conta, conta inexistente ou plano inexistente: null', async () => {
    const semConta = { ...BASE, plans: { p1: { pl: 100, active: true } } };
    expect(await readAccountBacking(fakeDb(semConta), { planId: 'p1', cycleEnd: '2026-09-30' })).toBeNull();
    const contaSumiu = { ...BASE, accounts: {} };
    expect(await readAccountBacking(fakeDb(contaSumiu), { planId: 'p1', cycleEnd: '2026-09-30' })).toBeNull();
    expect(await readAccountBacking(fakeDb(BASE), { planId: 'nao-existe', cycleEnd: '2026-09-30' })).toBeNull();
  });
});
