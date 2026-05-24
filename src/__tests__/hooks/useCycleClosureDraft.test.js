import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Captura do payload enviado pra closeCycle CF
const mockCloseCycleCallable = vi.fn(() => Promise.resolve({ data: { closureId: 'planX_2026-04', success: true } }));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fn, name) => {
    if (name === 'closeCycle') return mockCloseCycleCallable;
    return vi.fn(() => Promise.resolve({ data: {} }));
  },
}));

import useCycleClosureDraft from '../../hooks/useCycleClosureDraft';

const STORAGE_PREFIX = 'closure-draft';

const HOOK_ARGS = {
  studentId: 'aluno-1',
  planId: 'plan-1',
  cycleKey: '2026-04',
  cycleNumber: 5,
  cycleStart: '2026-04-01',
  cycleEnd: '2026-04-30',
  accountId: 'acc-1',
};

const storageKey = `${STORAGE_PREFIX}:${HOOK_ARGS.studentId}:${HOOK_ARGS.planId}:${HOOK_ARGS.cycleKey}`;

function lastSubmitPayload() {
  const calls = mockCloseCycleCallable.mock.calls;
  if (calls.length === 0) throw new Error('closeCycle não foi chamado');
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  window.localStorage.clear();
  mockCloseCycleCallable.mockClear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('useCycleClosureDraft — closeMode resolution', () => {
  it('student role: submit sempre envia closeMode=self mesmo se draft tem demonstrated', async () => {
    // Simula draft contaminado de sessão mentor anterior
    window.localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 1,
      step: 8,
      closeMode: 'demonstrated',
    }));

    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'student' }));

    await act(async () => {
      await result.current.submit();
    });

    expect(lastSubmitPayload().closeMode).toBe('self');
  });

  it('student role: submit envia closeMode=self quando draft.closeMode é co_edited', async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 1,
      step: 8,
      closeMode: 'co_edited',
    }));

    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'student' }));

    await act(async () => {
      await result.current.submit();
    });

    expect(lastSubmitPayload().closeMode).toBe('self');
  });

  it('student role: submit envia closeMode=self quando não há draft no storage', async () => {
    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'student' }));

    await act(async () => {
      await result.current.submit();
    });

    expect(lastSubmitPayload().closeMode).toBe('self');
  });

  it('mentor role: submit envia demonstrated por default', async () => {
    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'mentor' }));

    await act(async () => {
      await result.current.submit();
    });

    expect(lastSubmitPayload().closeMode).toBe('demonstrated');
  });

  it('mentor role: submit envia co_edited quando setCloseMode(co_edited) foi chamado', async () => {
    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'mentor' }));

    act(() => {
      result.current.setCloseMode('co_edited');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(lastSubmitPayload().closeMode).toBe('co_edited');
  });

  it('mentor role: submit envia demonstrated quando draft tem valor inválido', async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 1,
      step: 8,
      closeMode: 'lixo-invalido',
    }));

    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'mentor' }));

    await act(async () => {
      await result.current.submit();
    });

    expect(lastSubmitPayload().closeMode).toBe('demonstrated');
  });
});

describe('useCycleClosureDraft — sanitize de closeMode no load', () => {
  it('descarta closeMode inválido do localStorage e usa defaultMode da role atual', () => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 1,
      step: 3,
      closeMode: 'modo-fantasma',
      notes: 'preservado',
    }));

    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'student' }));

    expect(result.current.draft.closeMode).toBe('self');
    expect(result.current.draft.notes).toBe('preservado');
  });

  it('preserva closeMode válido no draft (mas submit ainda força self pra student)', async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 1,
      step: 3,
      closeMode: 'demonstrated',
    }));

    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'student' }));

    expect(result.current.draft.closeMode).toBe('demonstrated');

    await act(async () => {
      await result.current.submit();
    });

    expect(lastSubmitPayload().closeMode).toBe('self');
  });

  it('descarta draft inteiro quando schemaVersion não bate', () => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 999,
      closeMode: 'self',
      notes: 'old-version',
    }));

    const { result } = renderHook(() => useCycleClosureDraft({ ...HOOK_ARGS, role: 'student' }));

    expect(result.current.draft.notes).toBe('');
    expect(result.current.draft.closeMode).toBe('self');
  });
});
