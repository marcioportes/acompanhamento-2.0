/**
 * validators.test.js — Issue #259 (1A)
 *
 * Cobre helpers puros de cycleClosure/validators.js.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isMentor,
  isCycleKey,
  isCloseRole,
  isCloseMode,
  validateRoleCloseMode,
  validateClosurePayload,
  buildClosureId,
} = require('../../cycleClosure/validators');

// ── Fixture: payload válido mínimo ─────────────────────────────────

const validPayload = () => ({
  planId: 'plan-abc',
  studentId: 'student-xyz',
  accountId: 'acc-123',
  cycleKey: '2026-04',
  cycleNumber: 3,
  cycleStart: '2026-04-01',
  cycleEnd: '2026-04-30',
  closeMode: 'self',
  snapshot: { plStart: 50000, plEnd: 52800 },
  metrics: { sharpe: { value: 1.42 } },
  patterns: { topErrors: [] },
  aar: { sustain: [], improve: [] },
  maturity: { scores: {} },
  swot: { strengths: [] },
  mentor: { closingComment: null },
  forward: { behavioralCommitments: [] },
  notes: null,
});

// ── isMentor ───────────────────────────────────────────────────────

describe('isMentor', () => {
  it('reconhece o email canônico do mentor', () => {
    expect(isMentor('marcio.portes@me.com')).toBe(true);
    expect(isMentor('Marcio.Portes@ME.com')).toBe(true);
  });
  it('rejeita outros emails e valores não-string', () => {
    expect(isMentor('aluno@email.com')).toBe(false);
    expect(isMentor('')).toBe(false);
    expect(isMentor(null)).toBe(false);
    expect(isMentor(undefined)).toBe(false);
  });
});

// ── isCycleKey ─────────────────────────────────────────────────────

describe('isCycleKey', () => {
  it('aceita Mensal (YYYY-MM)', () => {
    expect(isCycleKey('2026-01')).toBe(true);
    expect(isCycleKey('2026-12')).toBe(true);
  });
  it('aceita Trimestral (YYYY-Q1..Q4)', () => {
    expect(isCycleKey('2026-Q1')).toBe(true);
    expect(isCycleKey('2026-Q4')).toBe(true);
  });
  it('aceita Semestral (YYYY-S1|S2)', () => {
    expect(isCycleKey('2026-S1')).toBe(true);
    expect(isCycleKey('2026-S2')).toBe(true);
  });
  it('aceita Anual (YYYY)', () => {
    expect(isCycleKey('2026')).toBe(true);
  });
  it('rejeita formatos inválidos', () => {
    expect(isCycleKey('2026-13')).toBe(false);   // mês inválido
    expect(isCycleKey('2026-Q5')).toBe(false);   // trimestre inválido
    expect(isCycleKey('2026-S3')).toBe(false);   // semestre inválido
    expect(isCycleKey('26-01')).toBe(false);     // ano truncado
    expect(isCycleKey('')).toBe(false);
    expect(isCycleKey(null)).toBe(false);
  });
});

// ── isCloseRole / isCloseMode ──────────────────────────────────────

describe('isCloseRole / isCloseMode', () => {
  it('aceita roles válidos', () => {
    expect(isCloseRole('student')).toBe(true);
    expect(isCloseRole('mentor')).toBe(true);
    expect(isCloseRole('admin')).toBe(false);
  });
  it('aceita modes válidos', () => {
    expect(isCloseMode('self')).toBe(true);
    expect(isCloseMode('demonstrated')).toBe(true);
    expect(isCloseMode('co_edited')).toBe(true);
    expect(isCloseMode('auto')).toBe(false);
  });
});

// ── validateRoleCloseMode ─────────────────────────────────────────

describe('validateRoleCloseMode', () => {
  it('student → self é válido', () => {
    expect(validateRoleCloseMode('student', 'self')).toBe(true);
  });
  it('student com closeMode != self lança', () => {
    expect(() => validateRoleCloseMode('student', 'demonstrated')).toThrow(/student/);
    expect(() => validateRoleCloseMode('student', 'co_edited')).toThrow(/student/);
  });
  it('mentor → demonstrated|co_edited é válido', () => {
    expect(validateRoleCloseMode('mentor', 'demonstrated')).toBe(true);
    expect(validateRoleCloseMode('mentor', 'co_edited')).toBe(true);
  });
  it('mentor com closeMode=self lança', () => {
    expect(() => validateRoleCloseMode('mentor', 'self')).toThrow(/mentor/);
  });
});

// ── validateClosurePayload ────────────────────────────────────────

describe('validateClosurePayload', () => {
  it('aceita payload completo válido', () => {
    expect(validateClosurePayload(validPayload())).toBe(true);
  });
  it('rejeita payload null/undefined', () => {
    expect(() => validateClosurePayload(null)).toThrow(/obrigatório/);
    expect(() => validateClosurePayload(undefined)).toThrow(/obrigatório/);
  });
  it('rejeita planId/studentId ausente ou vazio', () => {
    expect(() => validateClosurePayload({ ...validPayload(), planId: '' })).toThrow(/planId/);
    expect(() => validateClosurePayload({ ...validPayload(), studentId: '   ' })).toThrow(/studentId/);
  });
  it('rejeita cycleKey inválido', () => {
    expect(() => validateClosurePayload({ ...validPayload(), cycleKey: '2026-13' })).toThrow(/cycleKey/);
  });
  it('rejeita datas mal-formatadas', () => {
    expect(() => validateClosurePayload({ ...validPayload(), cycleStart: '01/04/2026' })).toThrow(/cycleStart/);
    expect(() => validateClosurePayload({ ...validPayload(), cycleEnd: '2026-4-30' })).toThrow(/cycleEnd/);
  });
  it('rejeita cycleNumber inválido', () => {
    expect(() => validateClosurePayload({ ...validPayload(), cycleNumber: 0 })).toThrow(/cycleNumber/);
    expect(() => validateClosurePayload({ ...validPayload(), cycleNumber: '3' })).toThrow(/cycleNumber/);
  });
  it('rejeita seção ausente', () => {
    const p = validPayload();
    delete p.aar;
    expect(() => validateClosurePayload(p)).toThrow(/aar/);
  });
  it('aceita payload com closeMode inválido (servidor sobrescreve em closeCycle.js)', () => {
    // validateClosurePayload deixou de validar closeMode — quem manda é closeCycle.js
    // que reescreve a partir do role autenticado. Garbage de cliente é ignorado.
    expect(validateClosurePayload({ ...validPayload(), closeMode: 'auto' })).toBe(true);
    expect(validateClosurePayload({ ...validPayload(), closeMode: undefined })).toBe(true);
  });
});

// ── buildClosureId ────────────────────────────────────────────────

describe('buildClosureId', () => {
  it('concatena planId_cycleKey', () => {
    expect(buildClosureId('plan-abc', '2026-04')).toBe('plan-abc_2026-04');
    expect(buildClosureId('clear-dt', '2026-Q2')).toBe('clear-dt_2026-Q2');
  });
  it('lança em planId vazio ou cycleKey inválido', () => {
    expect(() => buildClosureId('', '2026-04')).toThrow();
    expect(() => buildClosureId('plan-abc', '2026-13')).toThrow();
  });
});
