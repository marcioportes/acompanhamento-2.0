/**
 * studentActivation.test.js
 * @description Política de ativação no 1º login do aluno — issue #271.
 * @see src/utils/studentActivation.js
 */

import { describe, it, expect } from 'vitest';
import { shouldActivateStudent, buildActivatePayload } from '../../utils/studentActivation';

describe('shouldActivateStudent', () => {
  it('aluno já ativo (accessStatus="active") → false (idempotente)', () => {
    expect(shouldActivateStudent({ id: 'u1', accessStatus: 'active' })).toBe(false);
  });

  it('issue #271 — accessStatus="pending" + status="active" (doc inconsistente) → true', () => {
    // Regressão central: antes do #271 o guard era status === 'pending'.
    // Alunos com status='active' (legado, ou createInlineStudent → promote) mas
    // accessStatus='pending' (porque rules bloqueou a escrita no 1º login)
    // ficavam fora da auto-recuperação. Agora o guard usa accessStatus.
    expect(shouldActivateStudent({ id: 'u1', accessStatus: 'pending', status: 'active' })).toBe(true);
  });

  it('aluno novo (accessStatus="pending" + status="pending") → true', () => {
    expect(shouldActivateStudent({ id: 'u1', accessStatus: 'pending', status: 'pending' })).toBe(true);
  });

  it('aluno sem accessStatus (doc legado pré-DEC-AUTO-263-07) → true', () => {
    expect(shouldActivateStudent({ id: 'u1', status: 'pending' })).toBe(true);
    expect(shouldActivateStudent({ id: 'u1' })).toBe(true);
  });

  it('accessStatus="none" (criado via createInlineStudent, sem Auth ainda) → true', () => {
    // Cobertura: se o doc foi promovido (createInlineStudent → createStudent
    // modo PROMOTE) o accessStatus vira 'pending'. Mas se algum caminho der
    // login ao aluno antes (improvável), com accessStatus='none', ainda assim
    // queremos que activate dispare. Política: !== 'active' ativa.
    expect(shouldActivateStudent({ id: 'u1', accessStatus: 'none' })).toBe(true);
  });

  it('student null/undefined/sem id → false (defesa contra input inválido)', () => {
    expect(shouldActivateStudent(null)).toBe(false);
    expect(shouldActivateStudent(undefined)).toBe(false);
    expect(shouldActivateStudent({})).toBe(false);
    expect(shouldActivateStudent({ accessStatus: 'pending' })).toBe(false);
  });
});

describe('buildActivatePayload', () => {
  it('payload contém exatamente os 3 campos da allowlist em firestore.rules', () => {
    const sentinel = Symbol('serverTimestamp');
    const payload = buildActivatePayload(sentinel);
    expect(Object.keys(payload).sort()).toEqual(['accessStatus', 'firstLoginAt', 'status']);
    expect(payload.status).toBe('active');
    expect(payload.accessStatus).toBe('active');
    expect(payload.firstLoginAt).toBe(sentinel);
  });

  it('regression — payload NÃO inclui campos fora da allowlist (rules quebraria)', () => {
    // Allowlist em firestore.rules:45 (após #271): status, firstLoginAt,
    // onboardingStatus, accessStatus. Se alguém adicionar um 4º campo aqui
    // sem propagar para a regra, repete o bug do DEC-AUTO-263-07. Esse teste
    // protege a invariante.
    const ALLOWED_FIELDS = new Set(['status', 'firstLoginAt', 'onboardingStatus', 'accessStatus']);
    const payload = buildActivatePayload(null);
    Object.keys(payload).forEach((k) => {
      expect(ALLOWED_FIELDS.has(k)).toBe(true);
    });
  });
});
