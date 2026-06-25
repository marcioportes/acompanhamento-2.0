/**
 * studentClassify.test.js — porta server do classificador canônico (#269 filtro matriz).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyStudent, inReviewScope } = require('../../_shared/studentClassify');

const sub = (o) => ({ status: 'active', ...o });

describe('classifyStudent (server)', () => {
  it('paid alpha → alpha; paid self_service → espelho', () => {
    expect(classifyStudent([sub({ type: 'paid', plan: 'alpha' })])).toBe('alpha');
    expect(classifyStudent([sub({ type: 'paid', plan: 'self_service' })])).toBe('espelho');
  });

  it('trial alpha → trial-alpha; trial self_service → trial-espelho', () => {
    expect(classifyStudent([sub({ type: 'trial', plan: 'alpha' })])).toBe('trial-alpha');
    expect(classifyStudent([sub({ type: 'trial', plan: 'self_service' })])).toBe('trial-espelho');
  });

  it('VIP ativo → null (mesmo com outra sub)', () => {
    expect(classifyStudent([sub({ type: 'vip', plan: 'vip' }), sub({ type: 'paid', plan: 'alpha' })])).toBe(null);
  });

  it('sem sub ativa (todas cancelled/expired) → null', () => {
    expect(classifyStudent([sub({ type: 'paid', plan: 'alpha', status: 'cancelled' })])).toBe(null);
    expect(classifyStudent([])).toBe(null);
    expect(classifyStudent(null)).toBe(null);
  });

  it('múltiplas ativas → vence a de data mais futura', () => {
    const subs = [
      sub({ type: 'paid', plan: 'self_service', renewalDate: '2026-01-01' }),
      sub({ type: 'paid', plan: 'alpha', renewalDate: '2026-12-01' }),
    ];
    expect(classifyStudent(subs)).toBe('alpha');
  });
});

describe('inReviewScope — filtro matriz', () => {
  it('só alpha e trial-alpha entram', () => {
    expect(inReviewScope('alpha')).toBe(true);
    expect(inReviewScope('trial-alpha')).toBe(true);
    expect(inReviewScope('espelho')).toBe(false);
    expect(inReviewScope('trial-espelho')).toBe(false);
    expect(inReviewScope(null)).toBe(false);
  });
});
