/**
 * tradeGatewaySelfReview.test.js — issue #308
 * Cobre submitTradeReview: ownership, imutabilidade DISCUSSED, validação de respostas
 * por quadrante derivado, limpeza de vazias, formato do patch.
 */

import { describe, it, expect, vi } from 'vitest';
import { submitTradeReview } from '../../utils/tradeGateway';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    serverTimestamp: () => '__SERVER_TS__',
  };
});

const studentCtx = { uid: 'aluno-1', email: 'a@test.com' };

const makeTrade = (overrides = {}) => ({ studentId: 'aluno-1', ticker: 'WIN', result: 150, ...overrides });

const makeDeps = (tradeData) => ({
  updateDocFn: vi.fn(),
  getDocFn: vi.fn().mockResolvedValue({ exists: () => tradeData !== null, data: () => tradeData }),
  docFn: vi.fn(() => 'trades/abc'),
});

describe('submitTradeReview', () => {
  it('rejeita não autenticado', async () => {
    await expect(submitTradeReview('t1', { wouldRepeat: true }, {}, makeDeps(makeTrade())))
      .rejects.toThrow(/autenticado/i);
  });

  it('rejeita wouldRepeat não-boolean', async () => {
    await expect(submitTradeReview('t1', { wouldRepeat: 'sim' }, studentCtx, makeDeps(makeTrade())))
      .rejects.toThrow(/wouldRepeat/);
  });

  it('rejeita quando não é o autor do trade', async () => {
    const deps = makeDeps(makeTrade({ studentId: 'outro' }));
    await expect(submitTradeReview('t1', { wouldRepeat: true }, studentCtx, deps))
      .rejects.toThrow(/autor/i);
    expect(deps.updateDocFn).not.toHaveBeenCalled();
  });

  it('rejeita trade já DISCUSSED (imutável)', async () => {
    const deps = makeDeps(makeTrade({ reviewState: 'DISCUSSED' }));
    await expect(submitTradeReview('t1', { wouldRepeat: true }, studentCtx, deps))
      .rejects.toThrow(/imutável/i);
  });

  it('rejeita pergunta fora do quadrante derivado', async () => {
    // result>0 + wouldRepeat=true → good_win; gl_avoid é de good_loss
    const deps = makeDeps(makeTrade({ result: 150 }));
    await expect(submitTradeReview('t1', { wouldRepeat: true, answers: { gl_avoid: 'x' } }, studentCtx, deps))
      .rejects.toThrow(/pergunta inválida/i);
  });

  it('grava selfReview com answers limpas (descarta vazias) e timestamps', async () => {
    const deps = makeDeps(makeTrade({ result: -80 })); // loss + false → bad_loss
    const res = await submitTradeReview(
      't1',
      { wouldRepeat: false, answers: { bl_signals: '  atento  ', bl_deviate: '   ', bl_contagion: 'sim' } },
      studentCtx,
      deps,
    );
    expect(res.quadrant).toBe('bad_loss');
    const patch = deps.updateDocFn.mock.calls[0][1];
    expect(patch.selfReview.version).toBe(1);
    expect(patch.selfReview.wouldRepeat).toBe(false);
    expect(patch.selfReview.answers).toEqual({ bl_signals: 'atento', bl_contagion: 'sim' });
    expect(patch.selfReview.reviewedBy).toEqual({ uid: 'aluno-1', email: 'a@test.com' });
    expect(patch.selfReview.reviewedAt).toBe('__SERVER_TS__');
    expect(patch.updatedAt).toBe('__SERVER_TS__');
  });
});
