import { describe, it, expect, vi, beforeEach } from 'vitest';

import cfModule from '../../../../functions/maturity/recomputeStudentMaturity.js';

const runRecompute = cfModule._runRecompute;

/**
 * Mock admin + firestore. Simula:
 *  - students/{id}/maturity/_rateLimit → read/write
 *  - students/{id}/maturity/current → read (após recompute)
 */
function makeFakeAdmin({ rateLimitData = null, currentDoc = null, rateSetImpl } = {}) {
  const rateSetSpy = vi.fn(rateSetImpl ?? (async () => undefined));
  const rateGetSpy = vi.fn(async () => ({
    exists: rateLimitData !== null,
    data: () => rateLimitData,
  }));
  const currentGetSpy = vi.fn(async () => ({
    exists: currentDoc !== null,
    data: () => currentDoc,
  }));

  const firestoreInstance = {
    collection: (root) => {
      if (root !== 'students') throw new Error(`unexpected root collection ${root}`);
      return {
        doc: (_studentId) => ({
          collection: (sub) => {
            if (sub !== 'maturity') throw new Error(`unexpected sub ${sub}`);
            return {
              doc: (docId) => {
                if (docId === '_rateLimit') {
                  return { get: rateGetSpy, set: rateSetSpy };
                }
                if (docId === 'current') {
                  return { get: currentGetSpy };
                }
                throw new Error(`unexpected maturity doc ${docId}`);
              },
            };
          },
        }),
      };
    },
  };

  const firestore = () => firestoreInstance;
  firestore.FieldValue = { serverTimestamp: () => '__serverTs__' };
  firestore.Timestamp = {
    fromMillis: (ms) => ({ __ts: true, ms }),
    fromDate: (d) => ({ __ts: true, ms: d.getTime() }),
  };

  return {
    admin: { firestore },
    rateGetSpy,
    rateSetSpy,
    currentGetSpy,
  };
}

function buildRequest(overrides = {}) {
  return {
    auth: {
      uid: 'student-1',
      token: { email: 'student@example.com' },
    },
    data: { studentId: 'student-1' },
    ...overrides,
  };
}

describe('recomputeStudentMaturity (callable)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('rejeita sem auth com HttpsError unauthenticated', async () => {
    const { admin } = makeFakeAdmin();
    const recomputeSpy = vi.fn();

    await expect(
      runRecompute(
        { auth: null, data: { studentId: 'student-1' } },
        { adminOverride: admin, recomputeOverride: recomputeSpy }
      )
    ).rejects.toMatchObject({ code: 'unauthenticated' });

    expect(recomputeSpy).not.toHaveBeenCalled();
  });

  it('rejeita studentId ausente com invalid-argument', async () => {
    const { admin } = makeFakeAdmin();
    const recomputeSpy = vi.fn();

    await expect(
      runRecompute(
        { auth: { uid: 'student-1', token: { email: 'student@example.com' } }, data: {} },
        { adminOverride: admin, recomputeOverride: recomputeSpy }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(recomputeSpy).not.toHaveBeenCalled();
  });

  it('aluno tentando recalcular outro aluno: permission-denied', async () => {
    const { admin } = makeFakeAdmin();
    const recomputeSpy = vi.fn();

    const req = {
      auth: { uid: 'student-1', token: { email: 'student@example.com' } },
      data: { studentId: 'student-2' },
    };

    await expect(
      runRecompute(req, { adminOverride: admin, recomputeOverride: recomputeSpy })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    expect(recomputeSpy).not.toHaveBeenCalled();
  });

  it('mentor (email whitelist) pode recalcular qualquer aluno', async () => {
    const currentDoc = {
      currentStage: 3,
      gatesMet: 4,
      gatesTotal: 5,
      computedAt: { __ts: true, ms: 123 },
    };
    const { admin, rateSetSpy } = makeFakeAdmin({ currentDoc });
    const recomputeSpy = vi.fn(async () => ({ skipped: false, studentId: 'student-42', currentStage: 3 }));

    const req = {
      auth: { uid: 'mentor-uid', token: { email: 'marcio.portes@me.com' } },
      data: { studentId: 'student-42' },
    };

    const result = await runRecompute(req, {
      adminOverride: admin,
      recomputeOverride: recomputeSpy,
    });

    expect(recomputeSpy).toHaveBeenCalledWith(expect.anything(), 'student-42', expect.objectContaining({ admin: admin }));
    expect(result.success).toBe(true);
    expect(result.stageCurrent).toBe(3);
    expect(result.gatesMet).toBe(4);
    expect(result.gatesTotal).toBe(5);
    expect(rateSetSpy).toHaveBeenCalledTimes(1);
  });

  it('happy path: aluno recalcula a si mesmo → snapshot retornado e rate-limit gravado', async () => {
    const currentDoc = {
      currentStage: 2,
      gatesMet: 3,
      gatesTotal: 6,
      computedAt: { __ts: true, ms: 999 },
    };
    const { admin, rateSetSpy, rateGetSpy } = makeFakeAdmin({ currentDoc });
    const recomputeSpy = vi.fn(async () => ({ skipped: false, studentId: 'student-1', currentStage: 2 }));

    const result = await runRecompute(buildRequest(), {
      adminOverride: admin,
      recomputeOverride: recomputeSpy,
    });

    expect(rateGetSpy).toHaveBeenCalledTimes(1);
    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(rateSetSpy).toHaveBeenCalledTimes(1);

    const [writePayload, writeOpts] = rateSetSpy.mock.calls[0];
    expect(writePayload.calls['student-1']).toBe('__serverTs__');
    expect(writePayload.lastRecomputeAt).toBe('__serverTs__');
    expect(writeOpts).toEqual({ merge: true });

    expect(result).toEqual({
      success: true,
      stageCurrent: 2,
      gatesMet: 3,
      gatesTotal: 6,
      timestamp: { __ts: true, ms: 999 },
    });
  });

  it('rate limit: segunda chamada em <1h retorna throttled', async () => {
    // lastCall = agora → dentro da janela
    const recentTs = { toMillis: () => Date.now() - 60 * 1000 };
    const rateLimitData = { calls: { 'student-1': recentTs } };

    const { admin, rateSetSpy } = makeFakeAdmin({ rateLimitData });
    const recomputeSpy = vi.fn();

    const result = await runRecompute(buildRequest(), {
      adminOverride: admin,
      recomputeOverride: recomputeSpy,
    });

    expect(result.throttled).toBe(true);
    expect(result.nextAllowedAt).toBeDefined();
    expect(result.nextAllowedAt.__ts).toBe(true);
    expect(recomputeSpy).not.toHaveBeenCalled();
    expect(rateSetSpy).not.toHaveBeenCalled();
  });

  it('rate limit: chamada > 1h atrás permite recompute', async () => {
    const oldTs = { toMillis: () => Date.now() - (60 * 60 * 1000 + 5_000) };
    const rateLimitData = { calls: { 'student-1': oldTs } };

    const currentDoc = { currentStage: 1, gatesMet: 0, gatesTotal: 4, computedAt: null };
    const { admin, rateSetSpy } = makeFakeAdmin({ rateLimitData, currentDoc });
    const recomputeSpy = vi.fn(async () => ({ skipped: false, studentId: 'student-1', currentStage: 1 }));

    const result = await runRecompute(buildRequest(), {
      adminOverride: admin,
      recomputeOverride: recomputeSpy,
    });

    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(rateSetSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('rate limit é por (callerUid): mentor não é bloqueado pelo stamp do aluno', async () => {
    // Aluno tem stamp recente, mas quem chama é mentor com uid diferente.
    const recentTs = { toMillis: () => Date.now() - 60 * 1000 };
    const rateLimitData = { calls: { 'student-1': recentTs } };

    const currentDoc = { currentStage: 2, gatesMet: 2, gatesTotal: 5, computedAt: null };
    const { admin } = makeFakeAdmin({ rateLimitData, currentDoc });
    const recomputeSpy = vi.fn(async () => ({ skipped: false, studentId: 'student-1', currentStage: 2 }));

    const req = {
      auth: { uid: 'mentor-uid', token: { email: 'marcio.portes@me.com' } },
      data: { studentId: 'student-1' },
    };

    const result = await runRecompute(req, {
      adminOverride: admin,
      recomputeOverride: recomputeSpy,
    });

    expect(recomputeSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('engine retorna skipped → HttpsError internal', async () => {
    const { admin, rateSetSpy } = makeFakeAdmin();
    const recomputeSpy = vi.fn(async () => ({ skipped: true, reason: 'schema validation failed' }));

    await expect(
      runRecompute(buildRequest(), { adminOverride: admin, recomputeOverride: recomputeSpy })
    ).rejects.toMatchObject({ code: 'internal' });

    expect(rateSetSpy).not.toHaveBeenCalled();
  });

  it('engine lança exceção → HttpsError internal', async () => {
    const { admin } = makeFakeAdmin();
    const recomputeSpy = vi.fn(async () => {
      throw new Error('db offline');
    });

    await expect(
      runRecompute(buildRequest(), { adminOverride: admin, recomputeOverride: recomputeSpy })
    ).rejects.toMatchObject({ code: 'internal', message: 'db offline' });
  });

  it('studentId com tipo errado (number): invalid-argument', async () => {
    const { admin } = makeFakeAdmin();
    const recomputeSpy = vi.fn();

    await expect(
      runRecompute(
        {
          auth: { uid: 'student-1', token: { email: 'student@example.com' } },
          data: { studentId: 123 },
        },
        { adminOverride: admin, recomputeOverride: recomputeSpy }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(recomputeSpy).not.toHaveBeenCalled();
  });
});
