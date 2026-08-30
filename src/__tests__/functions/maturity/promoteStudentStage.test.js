/**
 * #376 — o ato de promover.
 *
 * Regra de Marcio: o motor sinaliza, o mentor decide. Nada roda automático, e o
 * cliente não é autoridade: a prontidão é revalidada no servidor.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { promoteStudentStage } = require('../../../../functions/maturity/promoteStudentStage.js');
const callable = require('../../../../functions/maturity/promoteStudentStageCallable.js');

const maturidadePronta = {
  currentStage: 2,
  gatesMet: 9,
  gatesTotal: 9,
  proposedTransition: { proposed: 'UP', nextStage: 3, blockers: [] },
};

// #101 — a promoção passou a carimbar `stageSince`: é a data em que a vida nova
// começa, e o recompute mede o aluno só a partir dela ("promoção zera tudo").
const fakeAdmin = {
  firestore: {
    FieldValue: {
      arrayUnion: (x) => ({ __arrayUnion: x }),
      serverTimestamp: () => ({ __serverTimestamp: true }),
    },
  },
};

const fakeDb = (dados) => {
  const set = vi.fn(async () => {});
  const ref = { get: async () => ({ exists: dados !== null, data: () => dados }), set };
  return {
    _set: set,
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ref }) }) }),
  };
};

describe('promoteStudentStage', () => {
  it('aluno pronto → grava o estágio novo e registra quem promoveu', async () => {
    const db = fakeDb(maturidadePronta);
    const r = await promoteStudentStage(db, fakeAdmin, {
      studentId: 'aluno1',
      promotedByEmail: 'marcio.portes@me.com',
    });

    expect(r).toMatchObject({ ok: true, fromStage: 2, toStage: 3 });
    expect(db._set).toHaveBeenCalledTimes(1);
    const [payload] = db._set.mock.calls[0];
    expect(payload.currentStage).toBe(3);
    const entrada = payload.stageHistory.__arrayUnion;
    expect(entrada).toMatchObject({ fromStage: 2, toStage: 3, promotedBy: 'marcio.portes@me.com', gatesMet: 9 });
    expect(typeof entrada.promotedAt).toBe('string');
  });

  it('aluno que deixou de estar pronto entre a tela e o clique → recusa sem gravar', async () => {
    const db = fakeDb({ ...maturidadePronta, gatesMet: 8 });
    const r = await promoteStudentStage(db, fakeAdmin, { studentId: 'aluno1', promotedByEmail: 'm@x' });
    expect(r.ok).toBe(false);
    expect(r.gatesMet).toBe(8);
    expect(db._set).not.toHaveBeenCalled();
  });

  it('aluno sem maturidade calculada → recusa sem gravar', async () => {
    const db = fakeDb(null);
    const r = await promoteStudentStage(db, fakeAdmin, { studentId: 'aluno1', promotedByEmail: 'm@x' });
    expect(r.ok).toBe(false);
    expect(db._set).not.toHaveBeenCalled();
  });
});

describe('promoteStudentStage — callable', () => {
  const chamar = (request, promoteOverride) =>
    callable._runPromote(request, {
      adminOverride: { ...fakeAdmin, firestore: Object.assign(() => fakeDb(maturidadePronta), fakeAdmin.firestore) },
      promoteOverride,
    });

  it('sem auth → unauthenticated', async () => {
    await expect(chamar({ data: { studentId: 'a1' } })).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('aluno tentando se promover → permission-denied', async () => {
    await expect(
      chamar({ auth: { uid: 'a1', token: { email: 'aluno@x.com' } }, data: { studentId: 'a1' } }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('mentor promove → sucesso', async () => {
    const promote = vi.fn(async () => ({ ok: true, fromStage: 2, toStage: 3 }));
    const r = await chamar(
      { auth: { uid: 'mentor', token: { email: 'marcio.portes@me.com' } }, data: { studentId: 'a1' } },
      promote,
    );
    expect(r).toEqual({ success: true, fromStage: 2, toStage: 3 });
    expect(promote).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      studentId: 'a1',
      promotedByEmail: 'marcio.portes@me.com',
    });
  });

  it('não pronto → failed-precondition (não é falha de sistema)', async () => {
    const promote = vi.fn(async () => ({ ok: false, reason: 'aluno não está pronto para promoção' }));
    await expect(
      chamar({ auth: { uid: 'mentor', token: { email: 'marcio.portes@me.com' } }, data: { studentId: 'a1' } }, promote),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('promoção zera a régua (#101)', () => {
  it('carimba stageSince, limpa a proposta consumida e o sinal de regressão', async () => {
    const db = fakeDb(maturidadePronta);
    await promoteStudentStage(db, fakeAdmin, {
      studentId: 'aluno1',
      promotedByEmail: 'marcio.portes@me.com',
    });
    const gravado = db._set.mock.calls[0][0];
    expect(gravado.stageSince).toEqual({ __serverTimestamp: true });
    expect(gravado.proposedTransition).toBeNull();
    expect(gravado.signalRegression).toBeNull();
  });

  it('o histórico de promoções é acrescentado, nunca substituído', async () => {
    const db = fakeDb(maturidadePronta);
    await promoteStudentStage(db, fakeAdmin, {
      studentId: 'aluno1',
      promotedByEmail: 'marcio.portes@me.com',
    });
    const gravado = db._set.mock.calls[0][0];
    expect(gravado.stageHistory.__arrayUnion).toBeTruthy();
    expect(gravado.stageHistory.__arrayUnion.promotedBy).toBe('marcio.portes@me.com');
  });
});
