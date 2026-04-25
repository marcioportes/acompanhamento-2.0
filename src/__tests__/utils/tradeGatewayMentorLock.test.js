/**
 * tradeGatewayMentorLock.test.js — Fase D issue #188 F1a
 * Cobre editTradeAsMentor, lockTradeByMentor, unlockTradeByMentor.
 * Mock via injeção de deps (getDocFn, updateDocFn, docFn).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  editTradeAsMentor,
  lockTradeByMentor,
  unlockTradeByMentor,
  MENTOR_EDITABLE_FIELDS,
} from '../../utils/tradeGateway';

// arrayUnion do firestore é chamada inline — o mock retorna um sentinel previsível
// para o test inspecionar o shape do patch sem executar a semântica real.
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    serverTimestamp: () => '__SERVER_TS__',
    arrayUnion: (...entries) => ({ __arrayUnion: entries }),
  };
});

const mentorCtx = {
  uid: 'mentor-001',
  email: 'mentor@test.com',
  displayName: 'Mentor',
  isMentor: true,
};

const studentCtx = {
  uid: 'aluno-001',
  email: 'aluno@test.com',
  displayName: 'Aluno',
  isMentor: false,
};

const makeTrade = (overrides = {}) => ({
  studentId: 'aluno-001',
  emotionEntry: 'FOMO',
  emotionExit: 'Regret',
  setup: 'Breakout',
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
    now: () => '2026-04-24T14:36:00.000Z',
  };
};

// ============================================
// editTradeAsMentor
// ============================================

describe('editTradeAsMentor', () => {
  it('rejeita quando userContext.isMentor é falsy', async () => {
    const deps = makeDeps(makeTrade());
    await expect(editTradeAsMentor('trade-1', { emotionEntry: 'Calmo' }, studentCtx, deps))
      .rejects.toThrow(/mentor/i);
    expect(deps.updateDocFn).not.toHaveBeenCalled();
  });

  it('rejeita quando trade já está locked', async () => {
    const deps = makeDeps(makeTrade({ _lockedByMentor: true }));
    await expect(editTradeAsMentor('trade-1', { emotionEntry: 'Calmo' }, mentorCtx, deps))
      .rejects.toThrow(/travado/i);
    expect(deps.updateDocFn).not.toHaveBeenCalled();
  });

  it('rejeita quando trade não existe', async () => {
    const deps = makeDeps(null);
    await expect(editTradeAsMentor('trade-x', { setup: 'Pullback' }, mentorCtx, deps))
      .rejects.toThrow(/não encontrado/i);
  });

  it('edita emotionEntry + setup, grava _studentOriginal e _mentorEdits', async () => {
    const deps = makeDeps(makeTrade());
    const result = await editTradeAsMentor(
      'trade-1',
      { emotionEntry: 'Calmo', setup: 'Pullback' },
      mentorCtx,
      deps,
    );

    expect(result.editedFields).toEqual(['emotionEntry', 'setup']);
    expect(deps.updateDocFn).toHaveBeenCalledTimes(1);

    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch.emotionEntry).toBe('Calmo');
    expect(patch.setup).toBe('Pullback');
    expect(patch.emotionExit).toBeUndefined(); // não incluído na edição

    expect(patch._studentOriginal).toEqual({
      emotionEntry: 'FOMO',
      emotionExit: 'Regret',
      setup: 'Breakout',
      capturedAt: '2026-04-24T14:36:00.000Z',
    });

    expect(patch._mentorEdits.__arrayUnion).toHaveLength(2);
    expect(patch._mentorEdits.__arrayUnion[0]).toMatchObject({
      field: 'emotionEntry',
      oldValue: 'FOMO',
      newValue: 'Calmo',
      editedAt: '2026-04-24T14:36:00.000Z',
      editedBy: { uid: 'mentor-001', email: 'mentor@test.com' },
    });
    expect(patch._mentorEdits.__arrayUnion[1]).toMatchObject({
      field: 'setup',
      oldValue: 'Breakout',
      newValue: 'Pullback',
    });
  });

  it('não grava _studentOriginal em segunda edição (preserva o original do aluno)', async () => {
    const tradeComOriginal = makeTrade({
      emotionEntry: 'Calmo', // já foi editado uma vez
      _studentOriginal: {
        emotionEntry: 'FOMO',
        emotionExit: 'Regret',
        setup: 'Breakout',
        capturedAt: '2026-04-24T14:30:00.000Z',
      },
    });
    const deps = makeDeps(tradeComOriginal);
    await editTradeAsMentor('trade-1', { emotionEntry: 'Confiante' }, mentorCtx, deps);

    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch._studentOriginal).toBeUndefined();
    expect(patch._mentorEdits.__arrayUnion[0]).toMatchObject({
      field: 'emotionEntry',
      oldValue: 'Calmo',
      newValue: 'Confiante',
    });
  });

  it('ignora campos fora da whitelist', async () => {
    const deps = makeDeps(makeTrade());
    await editTradeAsMentor(
      'trade-1',
      { emotionEntry: 'Calmo', result: 999, stopLoss: 100 },
      mentorCtx,
      deps,
    );
    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch.result).toBeUndefined();
    expect(patch.stopLoss).toBeUndefined();
    expect(patch.emotionEntry).toBe('Calmo');
  });

  it('noop quando edits não mudam nenhum valor (retorna sem chamar updateDoc)', async () => {
    const deps = makeDeps(makeTrade({ emotionEntry: 'FOMO' }));
    const result = await editTradeAsMentor('trade-1', { emotionEntry: 'FOMO' }, mentorCtx, deps);
    expect(result.editedFields).toEqual([]);
    expect(deps.updateDocFn).not.toHaveBeenCalled();
  });

  it('aceita null como newValue (mentor remove emoção)', async () => {
    const deps = makeDeps(makeTrade());
    await editTradeAsMentor('trade-1', { emotionExit: null }, mentorCtx, deps);
    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch.emotionExit).toBeNull();
    expect(patch._mentorEdits.__arrayUnion[0]).toMatchObject({
      field: 'emotionExit',
      oldValue: 'Regret',
      newValue: null,
    });
  });
});

// ============================================
// lockTradeByMentor
// ============================================

describe('lockTradeByMentor', () => {
  it('rejeita usuário não-mentor', async () => {
    const deps = makeDeps(makeTrade());
    await expect(lockTradeByMentor('trade-1', studentCtx, deps)).rejects.toThrow(/mentor/i);
    expect(deps.updateDocFn).not.toHaveBeenCalled();
  });

  it('grava _lockedByMentor, _lockedAt, _lockedBy', async () => {
    const deps = makeDeps(makeTrade());
    await lockTradeByMentor('trade-1', mentorCtx, deps);
    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch._lockedByMentor).toBe(true);
    expect(patch._lockedAt).toBe('__SERVER_TS__');
    expect(patch._lockedBy).toEqual({
      uid: 'mentor-001',
      email: 'mentor@test.com',
      name: 'Mentor',
    });
  });
});

// ============================================
// unlockTradeByMentor
// ============================================

describe('unlockTradeByMentor', () => {
  it('rejeita usuário não-mentor', async () => {
    const deps = makeDeps(makeTrade({ _lockedByMentor: true }));
    await expect(unlockTradeByMentor('trade-1', studentCtx, deps)).rejects.toThrow(/mentor/i);
  });

  it('seta _lockedByMentor=false preservando campos de auditoria', async () => {
    const deps = makeDeps(
      makeTrade({
        _lockedByMentor: true,
        _lockedAt: '__SERVER_TS__',
        _mentorEdits: [{ field: 'emotionEntry', oldValue: 'FOMO', newValue: 'Calmo' }],
        _studentOriginal: { emotionEntry: 'FOMO' },
      }),
    );
    await unlockTradeByMentor('trade-1', { ...mentorCtx, unlockReason: 'admin-manual' }, deps);
    const [, patch] = deps.updateDocFn.mock.calls[0];
    expect(patch._lockedByMentor).toBe(false);
    expect(patch._unlockedBy).toEqual({
      uid: 'mentor-001',
      email: 'mentor@test.com',
      reason: 'admin-manual',
    });
    // Auditoria NÃO é tocada (preservada no doc original, não no patch)
    expect(patch._mentorEdits).toBeUndefined();
    expect(patch._studentOriginal).toBeUndefined();
  });
});

describe('MENTOR_EDITABLE_FIELDS', () => {
  it('expõe exatamente os 3 campos comportamentais', () => {
    expect(MENTOR_EDITABLE_FIELDS).toEqual(['emotionEntry', 'emotionExit', 'setup']);
  });
});
