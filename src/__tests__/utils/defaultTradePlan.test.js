/**
 * Issue #484 — o formulário de novo trade gravava no plano mais recente, não no da tela.
 *
 * Caso real (02/10/2026): barra de contexto na conta Demo (BRL); o aluno lançou dois trades de
 * WIN e eles caíram no plano da conta PROP em USD criada na véspera (`plans[0]`). Sumiram do
 * dashboard e somaram +2.000 no saldo da prop.
 */

import { describe, it, expect } from 'vitest';
import { resolveDefaultTradePlanId } from '../../utils/defaultTradePlan';

// Ordem do usePlans: createdAt desc — o plano da prop (mais recente) vem primeiro.
const plans = [
  { id: 'lucid', name: 'Plano Lucid Flex 25K', accountId: 'acc-prop', active: true, createdAt: '2026-10-01T21:13:31Z' },
  { id: 'demo', name: 'PL-Demo ao-vivo', accountId: 'acc-demo', active: true, createdAt: '2026-03-10T12:00:00Z' },
  { id: 'demo-antigo', name: 'PL-Demo 2025', accountId: 'acc-demo', active: true, createdAt: '2025-11-01T12:00:00Z' },
];

describe('resolveDefaultTradePlanId (#484)', () => {
  it('usa o plano da barra de contexto, mesmo não sendo o mais recente (caso real)', () => {
    expect(resolveDefaultTradePlanId({ plans, contextPlanId: 'demo', contextAccountId: 'acc-demo' })).toBe('demo');
  });

  it('plano na barra com "Todas as contas" (accountId null) ainda vale', () => {
    expect(resolveDefaultTradePlanId({ plans, contextPlanId: 'demo-antigo', contextAccountId: null })).toBe('demo-antigo');
  });

  it('só a conta na barra → plano ativo mais recente DAQUELA conta', () => {
    expect(resolveDefaultTradePlanId({ plans, contextPlanId: null, contextAccountId: 'acc-demo' })).toBe('demo');
  });

  it('"Todas as contas" com mais de um plano → não chuta, devolve vazio', () => {
    expect(resolveDefaultTradePlanId({ plans, contextPlanId: null, contextAccountId: null })).toBe('');
    expect(resolveDefaultTradePlanId({ plans })).toBe('');
  });

  it('plano único → pré-seleciona (não há ambiguidade)', () => {
    expect(resolveDefaultTradePlanId({ plans: [plans[1]] })).toBe('demo');
  });

  it('plano da barra inexistente ou inativo cai para a conta da barra', () => {
    expect(resolveDefaultTradePlanId({ plans, contextPlanId: 'sumiu', contextAccountId: 'acc-demo' })).toBe('demo');
    const comInativo = plans.map(p => (p.id === 'demo' ? { ...p, active: false } : p));
    expect(resolveDefaultTradePlanId({ plans: comInativo, contextPlanId: 'demo', contextAccountId: 'acc-demo' })).toBe('demo-antigo');
  });

  it('conta da barra sem plano ativo e mais de um plano no total → vazio', () => {
    expect(resolveDefaultTradePlanId({ plans, contextPlanId: null, contextAccountId: 'acc-sem-plano' })).toBe('');
  });

  it('plano inativo não conta como "plano único"', () => {
    const umAtivo = [{ ...plans[0], active: false }, plans[1]];
    expect(resolveDefaultTradePlanId({ plans: umAtivo })).toBe('demo');
  });

  it('entradas vazias/ausentes → vazio, sem estourar', () => {
    expect(resolveDefaultTradePlanId()).toBe('');
    expect(resolveDefaultTradePlanId({ plans: null })).toBe('');
    expect(resolveDefaultTradePlanId({ plans: [] , contextPlanId: 'x', contextAccountId: 'y' })).toBe('');
  });
});
