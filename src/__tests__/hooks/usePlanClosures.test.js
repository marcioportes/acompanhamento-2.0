/**
 * usePlanClosures.test.js
 * Regressão: a query precisa filtrar por `studentId`, senão a rule de
 * `cycleClosures` (isMentor() || isOwner(resource.data.studentId)) rejeita o
 * lote inteiro para qualquer aluno — permission-denied silencioso que zerava
 * os closures e quebrava o carry-over do extrato.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const calls = { where: [], snapshot: null };

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ name }),
  query: (col, ...clauses) => ({ col, clauses }),
  where: (field, op, value) => {
    calls.where.push({ field, op, value });
    return { field, op, value };
  },
  onSnapshot: (_q, onNext) => {
    calls.snapshot = onNext;
    return () => {};
  },
}));

const { usePlanClosures } = await import('../../hooks/usePlanClosures');

const snap = (docs) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });

beforeEach(() => { calls.where = []; calls.snapshot = null; });

describe('usePlanClosures', () => {
  it('filtra por studentId — é o único predicado que a rule sabe validar', () => {
    renderHook(() => usePlanClosures('plan1', 'student1'));
    expect(calls.where).toEqual([{ field: 'studentId', op: '==', value: 'student1' }]);
  });

  it('NÃO consulta por planId no servidor (rejeitado pela rule)', () => {
    renderHook(() => usePlanClosures('plan1', 'student1'));
    expect(calls.where.some((w) => w.field === 'planId')).toBe(false);
  });

  it('resolve o planId em memória', async () => {
    const { result } = renderHook(() => usePlanClosures('plan1', 'student1'));
    calls.snapshot(snap([
      { id: 'c1', planId: 'plan1', studentId: 'student1', status: 'CLOSED' },
      { id: 'c2', planId: 'plan2', studentId: 'student1', status: 'CLOSED' },
      { id: 'c3', planId: 'plan1', studentId: 'student1', status: 'REOPENED' },
    ]));
    await waitFor(() => expect(result.current.closures).toHaveLength(2));
    expect(result.current.closures.map((c) => c.id)).toEqual(['c1', 'c3']);
  });

  it('não consulta sem studentId — evita o permission-denied silencioso', () => {
    renderHook(() => usePlanClosures('plan1', null));
    expect(calls.where).toHaveLength(0);
    expect(calls.snapshot).toBeNull();
  });
});
