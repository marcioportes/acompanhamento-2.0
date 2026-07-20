import { describe, it, expect } from 'vitest';
import { visibleStudentIds } from '../../utils/mentorAccountsVisibility';

// Fixtures de sub — shape idêntica ao que useSubscriptions entrega (status já enriquecido).
const sub = (studentId, over = {}) => ({
  studentId,
  status: 'active',
  type: 'paid',
  plan: 'alpha',
  renewalDate: new Date('2099-01-01'),
  ...over,
});

describe('visibleStudentIds (#341 — Contas do mentor)', () => {
  it('inclui aluno com sub Alpha paga ativa', () => {
    const students = [{ id: 'a' }];
    const subs = [sub('a')];
    expect(visibleStudentIds(students, subs).has('a')).toBe(true);
  });

  it('inclui Espelho (self_service pago) e Trial de alpha', () => {
    const students = [{ id: 'esp' }, { id: 'tri' }];
    const subs = [
      sub('esp', { plan: 'self_service' }),
      sub('tri', { type: 'trial', status: 'trial', trialEndsAt: new Date('2099-01-01') }),
    ];
    const v = visibleStudentIds(students, subs);
    expect(v.has('esp')).toBe(true);
    expect(v.has('tri')).toBe(true);
  });

  it('esconde VIP ativo (classifyStudent → null)', () => {
    const students = [{ id: 'vip' }];
    const subs = [sub('vip', { type: 'vip', plan: 'none' })];
    expect(visibleStudentIds(students, subs).has('vip')).toBe(false);
  });

  it('esconde aluno sem nenhuma sub', () => {
    const students = [{ id: 'nada' }];
    expect(visibleStudentIds(students, []).has('nada')).toBe(false);
  });

  it('esconde aluno só com sub expired/cancelled', () => {
    const students = [{ id: 'exp' }, { id: 'can' }];
    const subs = [
      sub('exp', { status: 'expired' }),
      sub('can', { status: 'cancelled' }),
    ];
    const v = visibleStudentIds(students, subs);
    expect(v.has('exp')).toBe(false);
    expect(v.has('can')).toBe(false);
  });

  it('mantém aluno overdue (grace) — paridade com Acompanhamento', () => {
    const students = [{ id: 'ovd' }];
    const subs = [sub('ovd', { status: 'overdue' })];
    expect(visibleStudentIds(students, subs).has('ovd')).toBe(true);
  });

  it('não inclui studentId órfão (sub sem doc de aluno) — grupo "unknown" some', () => {
    const students = [{ id: 'a' }];
    const subs = [sub('a'), sub('unknown')];
    const v = visibleStudentIds(students, subs);
    expect(v.has('a')).toBe(true);
    expect(v.has('unknown')).toBe(false);
  });

  it('esconde aluno com conta mas sem sub atribuída (doc existe, subs vazias)', () => {
    const students = [{ id: 'semSub' }];
    const subs = [sub('outro')];
    expect(visibleStudentIds(students, subs).has('semSub')).toBe(false);
  });

  it('ignora sub sem studentId e é resiliente a entradas nulas', () => {
    expect(visibleStudentIds(null, null).size).toBe(0);
    expect(visibleStudentIds([{ id: 'a' }], [{ status: 'active', type: 'paid', plan: 'alpha' }]).has('a')).toBe(false);
  });
});
