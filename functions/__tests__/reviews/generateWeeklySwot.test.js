/**
 * generateWeeklySwot.test.js — #331
 *
 * Cobre resolveSwotSnapshot: a CF aceita snapshot montado no cliente (revisão DRAFT sem
 * frozenSnapshot) e cai no frozenSnapshot persistido (revisão publicada). Regressão original:
 * a CF exigia frozenSnapshot e retornava HTTP 400 em toda revisão DRAFT.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let resolveSwotSnapshot;
beforeAll(() => {
  // O módulo instancia `new Anthropic()` no load; a chave só precisa existir (sem rede na construção).
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
  ({ resolveSwotSnapshot } = require('../../reviews/generateWeeklySwot'));
});

describe('resolveSwotSnapshot (#331)', () => {
  const clientSnapshot = { planContext: { planId: 'p1' }, kpis: { pl: 100 } };
  const frozen = { planContext: { planId: 'pF' }, kpis: { pl: 42 } };

  it('usa o snapshot do cliente quando presente (DRAFT, frozenSnapshot null)', () => {
    const review = { status: 'DRAFT', frozenSnapshot: null };
    expect(resolveSwotSnapshot(clientSnapshot, review)).toBe(clientSnapshot);
  });

  it('cai no frozenSnapshot quando o cliente não envia snapshot (revisão publicada)', () => {
    const review = { status: 'CLOSED', frozenSnapshot: frozen };
    expect(resolveSwotSnapshot(null, review)).toBe(frozen);
  });

  it('prioriza o snapshot do cliente mesmo com frozenSnapshot presente (regen em DRAFT)', () => {
    const review = { status: 'DRAFT', frozenSnapshot: frozen };
    expect(resolveSwotSnapshot(clientSnapshot, review)).toBe(clientSnapshot);
  });

  it('retorna null quando ambos ausentes → a CF lança failed-precondition (400)', () => {
    const review = { status: 'DRAFT', frozenSnapshot: null };
    expect(resolveSwotSnapshot(null, review)).toBeNull();
    expect(resolveSwotSnapshot(undefined, review)).toBeNull();
  });

  it('ignora clientSnapshot não-objeto (defensivo) e cai no frozenSnapshot', () => {
    const review = { status: 'CLOSED', frozenSnapshot: frozen };
    expect(resolveSwotSnapshot('lixo', review)).toBe(frozen);
    expect(resolveSwotSnapshot(123, review)).toBe(frozen);
  });
});
