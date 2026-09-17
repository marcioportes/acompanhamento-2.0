/**
 * #451 — trade discutido é imutável também no servidor; a auditoria do plano reflete isso.
 *
 *  - `diagnosePlan` não conta trade `DISCUSSED` como divergente: o servidor nunca o
 *    recalcula, então ele ficaria "desatualizado" para sempre e o plano nunca ficaria saudável.
 *  - `auditPlan` repassa `preserved` da callable como `compliancePreserved`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const PLAN = { id: 'plan-1', studentId: 'aluno-1', pl: 20000, currentPl: 20000, riskPerOperation: 1, rrTarget: 2 };

vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __type: 'collection', path: args.slice(1).join('/') }),
  doc: (...args) => ({ __type: 'doc', path: args.slice(1).join('/') }),
  query: (...args) => ({ __type: 'query', args }),
  where: (...args) => ({ __type: 'where', args }),
  orderBy: (...args) => ({ __type: 'orderBy', args }),
  onSnapshot: (q, onNext) => {
    const { id, ...data } = PLAN;
    onNext({ docs: [{ id, data: () => data }] });
    return () => {};
  },
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-plan-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
  arrayUnion: (...items) => ({ __type: 'arrayUnion', items }),
}));

const mockRecalc = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => (...args) => mockRecalc(...args),
}));

vi.mock('../../firebase', () => ({ db: { __type: 'db' } }));

// Objeto estável: `user`/`isMentor` são deps do effect de assinatura — identidade nova a
// cada render reassinaria em loop.
const mockAuth = { user: { uid: 'aluno-1', email: 'aluno@exemplo.com' }, isMentor: () => false };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

import { usePlans } from '../../hooks/usePlans';

// Compliance gravado obsoleto (riskPercent absurdo) → divergente se não for discutido.
const stale = (id, status) => ({
  id, planId: 'plan-1', status, ticker: 'WIN', date: '2026-09-01',
  entry: 120000, exit: 120100, stopLoss: 119900, qty: 1, side: 'LONG', result: 0,
  riskPercent: 999, rrRatio: 999, compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
});

const renderPlans = async () => {
  const hook = renderHook(() => usePlans());
  await waitFor(() => expect(hook.result.current.plans).toHaveLength(1));
  return hook;
};

beforeEach(() => mockRecalc.mockReset());

describe('#451 — diagnosePlan ignora trade discutido', () => {
  it('discutido obsoleto não entra em divergentTrades; não discutido obsoleto entra', async () => {
    const { result } = await renderPlans();
    const trades = [stale('d1', 'DISCUSSED'), stale('c1', 'CLOSED'), stale('s1', undefined)];
    const diag = result.current.diagnosePlan('plan-1', trades);
    expect(diag.trades.details.map((t) => t.id).sort()).toEqual(['c1', 's1']);
    expect(diag.trades.divergent).toBe(2);
    expect(diag.trades.total).toBe(3);
  });

  it('só discutidos obsoletos → plano sem divergência de compliance', async () => {
    const { result } = await renderPlans();
    const diag = result.current.diagnosePlan('plan-1', [stale('d1', 'DISCUSSED'), stale('d2', 'DISCUSSED')]);
    expect(diag.trades.divergent).toBe(0);
  });
});

describe('#451 — auditPlan repassa preservados', () => {
  it('compliancePreserved vem de result.data.preserved', async () => {
    mockRecalc.mockResolvedValue({ data: { updated: 3, preserved: 5, oldPl: 100, newPl: 120, plRecalculated: true } });
    const { result } = await renderPlans();
    const onProgress = vi.fn();
    let report;
    await act(async () => { report = await result.current.auditPlan('plan-1', onProgress); });
    expect(report).toEqual({ oldPl: 100, newPl: 120, plRecalculated: true, complianceUpdated: 3, compliancePreserved: 5 });
    expect(onProgress.mock.calls.at(-1)[0].message).toContain('5 discutidos preservados');
  });

  it('callable antiga sem preserved → 0', async () => {
    mockRecalc.mockResolvedValue({ data: { updated: 2, oldPl: 0, newPl: 0, plRecalculated: false } });
    const { result } = await renderPlans();
    let report;
    await act(async () => { report = await result.current.auditPlan('plan-1'); });
    expect(report.compliancePreserved).toBe(0);
  });
});
