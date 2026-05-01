/**
 * tradeGatewayToggleViolation.test.js — issue #221 (Phase B).
 * Cobre toggleViolationClearedAsMentor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => {
  const arrayUnion = vi.fn((...args) => ({ __arrayUnion: args }));
  const arrayRemove = vi.fn((...args) => ({ __arrayRemove: args }));
  const serverTimestamp = vi.fn(() => ({ __serverTimestamp: true }));
  return {
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    addDoc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(),
    serverTimestamp,
    updateDoc: vi.fn(),
    arrayUnion,
    arrayRemove,
  };
});

import { toggleViolationClearedAsMentor } from '../../utils/tradeGateway';

const mockMentor = { uid: 'mentor-1', email: 'm@x.com', isMentor: true };
const mockStudent = { uid: 'student-1', email: 's@x.com', isMentor: false };

const makeDeps = (tradeData) => {
  const updates = [];
  return {
    deps: {
      getDocFn: vi.fn(async () => ({
        exists: () => !!tradeData,
        data: () => tradeData,
      })),
      updateDocFn: vi.fn(async (_ref, patch) => {
        updates.push(patch);
      }),
      docFn: vi.fn((_db, _col, id) => ({ __ref: id })),
    },
    updates,
  };
};

describe('toggleViolationClearedAsMentor — autenticação e validação', () => {
  it('rejeita sem userContext', async () => {
    await expect(
      toggleViolationClearedAsMentor('t1', 'NO_STOP', null)
    ).rejects.toThrow(/autenticado/);
  });

  it('rejeita aluno (não-mentor)', async () => {
    await expect(
      toggleViolationClearedAsMentor('t1', 'NO_STOP', mockStudent)
    ).rejects.toThrow(/mentor/i);
  });

  it('rejeita tradeId vazio', async () => {
    await expect(
      toggleViolationClearedAsMentor('', 'NO_STOP', mockMentor)
    ).rejects.toThrow(/tradeId/);
  });

  it('rejeita violationKey vazio', async () => {
    await expect(
      toggleViolationClearedAsMentor('t1', '', mockMentor)
    ).rejects.toThrow(/violationKey/);
  });

  it('rejeita violationKey não-string', async () => {
    await expect(
      toggleViolationClearedAsMentor('t1', 123, mockMentor)
    ).rejects.toThrow(/violationKey/);
  });

  it('rejeita trade inexistente', async () => {
    const { deps } = makeDeps(null);
    await expect(
      toggleViolationClearedAsMentor('t-missing', 'NO_STOP', mockMentor, deps)
    ).rejects.toThrow(/não encontrado/);
  });
});

describe('toggleViolationClearedAsMentor — toggle behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adiciona quando violationKey ausente', async () => {
    const { deps, updates } = makeDeps({ mentorClearedViolations: [] });
    const out = await toggleViolationClearedAsMentor('t1', 'NO_STOP', mockMentor, deps);
    expect(out).toEqual({ id: 't1', action: 'added', violationKey: 'NO_STOP' });
    expect(updates).toHaveLength(1);
    expect(updates[0].mentorClearedViolations).toEqual({ __arrayUnion: ['NO_STOP'] });
  });

  it('remove quando violationKey presente', async () => {
    const { deps, updates } = makeDeps({ mentorClearedViolations: ['NO_STOP', 'TILT:T1'] });
    const out = await toggleViolationClearedAsMentor('t1', 'NO_STOP', mockMentor, deps);
    expect(out).toEqual({ id: 't1', action: 'removed', violationKey: 'NO_STOP' });
    expect(updates[0].mentorClearedViolations).toEqual({ __arrayRemove: ['NO_STOP'] });
  });

  it('lida com mentorClearedViolations ausente (cria com union)', async () => {
    const { deps, updates } = makeDeps({});
    const out = await toggleViolationClearedAsMentor('t1', 'RR_BELOW_MINIMUM', mockMentor, deps);
    expect(out.action).toBe('added');
    expect(updates[0].mentorClearedViolations).toEqual({ __arrayUnion: ['RR_BELOW_MINIMUM'] });
  });

  it('grava updatedAt: serverTimestamp', async () => {
    const { deps, updates } = makeDeps({ mentorClearedViolations: [] });
    await toggleViolationClearedAsMentor('t1', 'NO_STOP', mockMentor, deps);
    expect(updates[0].updatedAt).toEqual({ __serverTimestamp: true });
  });

  it('aceita chave emocional ${type}:${tradeId}', async () => {
    const { deps, updates } = makeDeps({ mentorClearedViolations: [] });
    const out = await toggleViolationClearedAsMentor('t1', 'TILT:t1', mockMentor, deps);
    expect(out.action).toBe('added');
    expect(updates[0].mentorClearedViolations).toEqual({ __arrayUnion: ['TILT:t1'] });
  });

  it('toggle idempotente — adicionar+remover repete', async () => {
    // Primeiro toggle: add
    const { deps: d1, updates: u1 } = makeDeps({ mentorClearedViolations: [] });
    const r1 = await toggleViolationClearedAsMentor('t1', 'NO_STOP', mockMentor, d1);
    expect(r1.action).toBe('added');

    // Segundo toggle (estado simulado pós-add): remove
    const { deps: d2, updates: u2 } = makeDeps({ mentorClearedViolations: ['NO_STOP'] });
    const r2 = await toggleViolationClearedAsMentor('t1', 'NO_STOP', mockMentor, d2);
    expect(r2.action).toBe('removed');

    // Terceiro toggle (volta a vazio): add de novo
    const { deps: d3, updates: u3 } = makeDeps({ mentorClearedViolations: [] });
    const r3 = await toggleViolationClearedAsMentor('t1', 'NO_STOP', mockMentor, d3);
    expect(r3.action).toBe('added');
  });
});
