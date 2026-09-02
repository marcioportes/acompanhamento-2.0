/**
 * computeStrategyConsistencyMonths (espelho CJS) — #416 C2 / D-11.
 *
 * Quem GRAVA `strategyConsMonths` em `students/{uid}/maturity/current` é a CF (INV-03), e a
 * suíte do root não cobre este runner. Aqui o dado chega como Timestamp do admin SDK, não
 * como Date do client — é exatamente o ponto onde a coerção quebraria em silêncio.
 *
 * A paridade ESM ≡ CJS fica em
 * src/__tests__/functions/maturity/helpers.strategyConsistencyMonths.parity.test.js.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeStrategyConsistencyMonths, RISK_FIELDS } = require('../../maturity/helpers');

const NOW = new Date('2026-09-15T12:00:00Z');
const opts = { now: NOW };

/** Timestamp do admin SDK: expõe toMillis() e toDate(). */
const adminTs = (iso) => ({ toMillis: () => Date.parse(iso), toDate: () => new Date(iso) });

describe('computeStrategyConsistencyMonths (CJS) — meses sem mudança de risco', () => {
  it('mudança de rrTarget há 3 meses → 3', () => {
    const plan = {
      active: true,
      createdAt: adminTs('2025-01-01T00:00:00Z'),
      editHistory: [{ by: 'student', fields: ['rrTarget'], timestamp: '2026-06-15T10:00:00.000Z' }],
    };
    expect(computeStrategyConsistencyMonths([plan], opts)).toBe(3);
  });

  it('campo não-risco não zera a contagem', () => {
    const plan = {
      active: true,
      createdAt: adminTs('2025-01-01T00:00:00Z'),
      editHistory: [
        { by: 'mentor', fields: ['riskPerOperation'], timestamp: '2026-01-15T10:00:00.000Z' },
        { by: 'student', fields: ['notes'], timestamp: '2026-08-15T10:00:00.000Z' },
      ],
    };
    expect(computeStrategyConsistencyMonths([plan], opts)).toBe(8);
  });

  it('sem editHistory conta desde createdAt (Timestamp do admin)', () => {
    const plan = { active: true, createdAt: adminTs('2026-05-15T00:00:00Z') };
    expect(computeStrategyConsistencyMonths([plan], opts)).toBe(4);
  });

  it('dois planos ativos → o menor', () => {
    const a = { active: true, createdAt: adminTs('2025-01-01T00:00:00Z'),
      editHistory: [{ fields: ['cycleStop'], timestamp: '2026-07-15T10:00:00.000Z' }] };
    const b = { active: true, createdAt: adminTs('2025-01-01T00:00:00Z'),
      editHistory: [{ fields: ['periodStop'], timestamp: '2026-02-15T10:00:00.000Z' }] };
    expect(computeStrategyConsistencyMonths([a, b], opts)).toBe(2);
  });

  it('plano inativo fora, sem plano → 0', () => {
    expect(computeStrategyConsistencyMonths([{ active: false, createdAt: adminTs('2020-01-01T00:00:00Z') }], opts)).toBe(0);
    expect(computeStrategyConsistencyMonths([], opts)).toBe(0);
    expect(computeStrategyConsistencyMonths(null, opts)).toBe(0);
  });

  it('lixo em timestamp é ignorado sem quebrar', () => {
    const plan = {
      active: true,
      createdAt: adminTs('2026-03-15T00:00:00Z'),
      editHistory: [{ fields: ['rrTarget'], timestamp: 'não é data' }, null, { fields: 'rrTarget' }],
    };
    expect(computeStrategyConsistencyMonths([plan], opts)).toBe(6);
  });

  it('RISK_FIELDS é a lista canônica dos 4 parâmetros', () => {
    expect([...RISK_FIELDS]).toEqual(['riskPerOperation', 'rrTarget', 'periodStop', 'cycleStop']);
  });
});
