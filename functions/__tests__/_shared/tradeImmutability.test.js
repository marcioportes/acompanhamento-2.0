/**
 * tradeImmutability.test.js — trade discutido é imutável no servidor (#451).
 */

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isTradeImmutable, updateTradeIfMutable, guardedUpdate } = require('../../_shared/tradeImmutability');

const snap = (data) => ({ exists: data !== undefined, data: () => data });
const docRef = (data) => ({ get: vi.fn(async () => snap(data)), update: vi.fn(async () => {}) });
const writer = () => ({ update: vi.fn() });
const ref = { id: 't1' };

describe('isTradeImmutable', () => {
  it('DISCUSSED → true', () => {
    expect(isTradeImmutable({ status: 'DISCUSSED' })).toBe(true);
  });

  it.each(['OPEN', 'CLOSED', 'REVIEWED', 'QUESTION'])('%s → false', (status) => {
    expect(isTradeImmutable({ status })).toBe(false);
  });

  it('doc sem status (legado) → false', () => {
    expect(isTradeImmutable({ result: 10 })).toBe(false);
  });

  it('null / undefined → false', () => {
    expect(isTradeImmutable(null)).toBe(false);
    expect(isTradeImmutable(undefined)).toBe(false);
  });
});

describe('updateTradeIfMutable (avulsa)', () => {
  it('DISCUSSED: não escreve e conta preservado', async () => {
    const r = docRef({ status: 'DISCUSSED' });
    expect(await updateTradeIfMutable(r, { compliance: {} })).toEqual({ written: false, preserved: true });
    expect(r.update).not.toHaveBeenCalled();
  });

  it.each(['OPEN', 'CLOSED', 'REVIEWED', 'QUESTION'])('%s: escreve', async (status) => {
    const r = docRef({ status });
    const patch = { riskPercent: 1 };
    expect(await updateTradeIfMutable(r, patch)).toEqual({ written: true, preserved: false });
    expect(r.update).toHaveBeenCalledWith(patch);
  });

  it('doc sem status: escreve', async () => {
    const r = docRef({ result: 5 });
    expect((await updateTradeIfMutable(r, { rrRatio: 2 })).written).toBe(true);
  });

  it('doc inexistente: não escreve e não conta preservado', async () => {
    const r = docRef(undefined);
    expect(await updateTradeIfMutable(r, { rrRatio: 2 })).toEqual({ written: false, preserved: false });
    expect(r.update).not.toHaveBeenCalled();
  });

  it('transição REVIEWED → DISCUSSED é permitida', async () => {
    const r = docRef({ status: 'REVIEWED' });
    expect((await updateTradeIfMutable(r, { status: 'DISCUSSED' })).written).toBe(true);
    expect(r.update).toHaveBeenCalledWith({ status: 'DISCUSSED' });
  });

  it('DISCUSSED recebendo { status: DISCUSSED } é barrado', async () => {
    const r = docRef({ status: 'DISCUSSED' });
    expect((await updateTradeIfMutable(r, { status: 'DISCUSSED' })).preserved).toBe(true);
    expect(r.update).not.toHaveBeenCalled();
  });
});

describe('guardedUpdate (batch / transação)', () => {
  it('DISCUSSED via snapshot: não enfileira', () => {
    const w = writer();
    expect(guardedUpdate(w, snap({ status: 'DISCUSSED' }), ref, { behaviorProfile: {} }))
      .toEqual({ written: false, preserved: true });
    expect(w.update).not.toHaveBeenCalled();
  });

  it('DISCUSSED via objeto plano: não enfileira', () => {
    const w = writer();
    expect(guardedUpdate(w, { status: 'DISCUSSED' }, ref, { behaviorProfile: {} }).preserved).toBe(true);
    expect(w.update).not.toHaveBeenCalled();
  });

  it.each(['OPEN', 'CLOSED', 'REVIEWED', 'QUESTION'])('%s: enfileira (snapshot e objeto plano)', (status) => {
    const patch = { behaviorProfile: { x: 1 } };
    const w1 = writer();
    expect(guardedUpdate(w1, snap({ status }), ref, patch)).toEqual({ written: true, preserved: false });
    expect(w1.update).toHaveBeenCalledWith(ref, patch);
    const w2 = writer();
    expect(guardedUpdate(w2, { status }, ref, patch)).toEqual({ written: true, preserved: false });
    expect(w2.update).toHaveBeenCalledWith(ref, patch);
  });

  it('doc sem status: enfileira', () => {
    const w = writer();
    expect(guardedUpdate(w, {}, ref, { a: 1 }).written).toBe(true);
  });

  it('snapshot inexistente ou dado nulo: não enfileira', () => {
    const w = writer();
    expect(guardedUpdate(w, snap(undefined), ref, { a: 1 })).toEqual({ written: false, preserved: false });
    expect(guardedUpdate(w, null, ref, { a: 1 })).toEqual({ written: false, preserved: false });
    expect(w.update).not.toHaveBeenCalled();
  });

  it('transição REVIEWED → DISCUSSED é permitida', () => {
    const w = writer();
    expect(guardedUpdate(w, snap({ status: 'REVIEWED' }), ref, { status: 'DISCUSSED' }).written).toBe(true);
    expect(w.update).toHaveBeenCalledWith(ref, { status: 'DISCUSSED' });
  });

  it('DISCUSSED recebendo { status: DISCUSSED } é barrado', () => {
    const w = writer();
    expect(guardedUpdate(w, { status: 'DISCUSSED' }, ref, { status: 'DISCUSSED' }).preserved).toBe(true);
    expect(w.update).not.toHaveBeenCalled();
  });
});
