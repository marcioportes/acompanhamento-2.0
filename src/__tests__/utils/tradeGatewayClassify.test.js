/**
 * tradeGatewayClassify.test.js — issue #219 (Phase A do épico #218)
 * Cobre classifyTradeAsMentor: validações, idempotência, formato do patch.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  classifyTradeAsMentor,
  MENTOR_CLASSIFICATION_VALUES,
  MENTOR_CLASSIFICATION_FLAGS,
} from '../../utils/tradeGateway';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    serverTimestamp: () => '__SERVER_TS__',
    arrayUnion: (...entries) => ({ __arrayUnion: entries }),
  };
});

const mentorCtx = { uid: 'mentor-1', email: 'm@test.com', isMentor: true };
const studentCtx = { uid: 'aluno-1', email: 'a@test.com', isMentor: false };

const makeTrade = (overrides = {}) => ({
  studentId: 'aluno-1',
  ticker: 'WIN',
  ...overrides,
});

const makeDeps = (tradeData) => {
  const updateDocFn = vi.fn();
  return {
    updateDocFn,
    getDocFn: vi.fn().mockResolvedValue({
      exists: () => tradeData !== null,
      data: () => tradeData,
    }),
    docFn: vi.fn(() => 'trades/abc'),
  };
};

describe('classifyTradeAsMentor', () => {
  it('exporta enums esperados', () => {
    expect(MENTOR_CLASSIFICATION_VALUES).toEqual(['tecnico', 'sorte']);
    expect(MENTOR_CLASSIFICATION_FLAGS).toEqual(['narrativa', 'sizing', 'desvio_modelo', 'outro']);
  });

  it('rejeita quando não autenticado', async () => {
    await expect(
      classifyTradeAsMentor('t1', { classification: 'tecnico' }, {}, makeDeps(makeTrade()))
    ).rejects.toThrow(/autenticado/i);
  });

  it('rejeita quando não é mentor', async () => {
    const deps = makeDeps(makeTrade());
    await expect(
      classifyTradeAsMentor('t1', { classification: 'tecnico' }, studentCtx, deps)
    ).rejects.toThrow(/mentor/i);
    expect(deps.updateDocFn).not.toHaveBeenCalled();
  });

  it('rejeita classification fora do enum', async () => {
    const deps = makeDeps(makeTrade());
    await expect(
      classifyTradeAsMentor('t1', { classification: 'mecanico' }, mentorCtx, deps)
    ).rejects.toThrow(/classification inválida/i);
  });

  it('rejeita flags fora do enum', async () => {
    const deps = makeDeps(makeTrade());
    await expect(
      classifyTradeAsMentor('t1', { classification: 'sorte', flags: ['inventada'] }, mentorCtx, deps)
    ).rejects.toThrow(/flags inválidas/i);
  });

  it('rejeita flags quando classification === "tecnico"', async () => {
    const deps = makeDeps(makeTrade());
    await expect(
      classifyTradeAsMentor('t1', { classification: 'tecnico', flags: ['narrativa'] }, mentorCtx, deps)
    ).rejects.toThrow(/só são aceitas quando classification === "sorte"/);
  });

  it('rejeita flags ou reason quando limpando (classification: null)', async () => {
    const deps = makeDeps(makeTrade());
    await expect(
      classifyTradeAsMentor('t1', { classification: null, reason: 'qualquer' }, mentorCtx, deps)
    ).rejects.toThrow(/limpar classificação/);
  });

  it('rejeita reason não-string', async () => {
    const deps = makeDeps(makeTrade());
    await expect(
      classifyTradeAsMentor('t1', { classification: 'sorte', reason: 123 }, mentorCtx, deps)
    ).rejects.toThrow(/string ou null/);
  });

  it('rejeita quando trade não existe', async () => {
    const deps = makeDeps(null);
    await expect(
      classifyTradeAsMentor('t1', { classification: 'tecnico' }, mentorCtx, deps)
    ).rejects.toThrow(/não encontrado/i);
  });

  it('grava classificação tecnico com flags vazio + reason null', async () => {
    const deps = makeDeps(makeTrade());
    const result = await classifyTradeAsMentor('t1', { classification: 'tecnico' }, mentorCtx, deps);

    expect(deps.updateDocFn).toHaveBeenCalledOnce();
    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch.mentorClassification).toBe('tecnico');
    expect(patch.mentorClassificationFlags).toEqual([]);
    expect(patch.mentorClassificationReason).toBeNull();
    expect(patch.mentorClassifiedAt).toBe('__SERVER_TS__');
    expect(patch.mentorClassifiedBy).toEqual({ uid: 'mentor-1', email: 'm@test.com' });
    expect(result.id).toBe('t1');
  });

  it('grava classificação sorte com flags + reason', async () => {
    const deps = makeDeps(makeTrade());
    await classifyTradeAsMentor(
      't1',
      { classification: 'sorte', flags: ['narrativa', 'sizing'], reason: 'sem entrada definida' },
      mentorCtx,
      deps
    );

    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch.mentorClassification).toBe('sorte');
    expect(patch.mentorClassificationFlags).toEqual(['narrativa', 'sizing']);
    expect(patch.mentorClassificationReason).toBe('sem entrada definida');
  });

  it('limpa classificação (idempotente) com classification: null', async () => {
    const deps = makeDeps(
      makeTrade({
        mentorClassification: 'sorte',
        mentorClassificationFlags: ['narrativa'],
        mentorClassificationReason: 'algo',
      })
    );
    await classifyTradeAsMentor('t1', { classification: null }, mentorCtx, deps);

    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch.mentorClassification).toBeNull();
    expect(patch.mentorClassificationFlags).toEqual([]);
    expect(patch.mentorClassificationReason).toBeNull();
    expect(patch.mentorClassifiedAt).toBeNull();
    expect(patch.mentorClassifiedBy).toBeNull();
  });

  it('sempre seta updatedAt', async () => {
    const deps = makeDeps(makeTrade());
    await classifyTradeAsMentor('t1', { classification: 'tecnico' }, mentorCtx, deps);
    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch.updatedAt).toBe('__SERVER_TS__');
  });
});
