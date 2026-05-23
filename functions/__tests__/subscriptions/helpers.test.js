/**
 * Tests: helpers de subscription (issue #266)
 *
 * Cobre:
 *  - getBrazilToday (calendar day em BRT, robusto contra TZ do servidor)
 *  - daysBetweenSigned (assinado, baseado em calendar day BRT)
 *  - formatDateLabel (futuro/hoje/passado + plural)
 *  - classifyOverdueSub (auto-recovery)
 *
 * Convenção dos testes: instâncias de Date usam o construtor Date.UTC com 03:00
 * para representar BRT-midnight (mesma forma que getBrazilToday devolve).
 * Isso isola os testes da timezone do shell rodando vitest.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getBrazilToday,
  daysBetweenSigned,
  formatDateLabel,
  classifyOverdueSub,
} = require('../../subscriptions/helpers.js');

// BRT midnight para a calendar day informada (UTC 03:00).
const brtMidnight = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));

describe('getBrazilToday', () => {
  it('11/05/2026 às 11:00 UTC (08:00 BRT) → BRT midnight 11/05/2026', () => {
    const now = new Date('2026-05-11T11:00:00Z');
    expect(getBrazilToday(now).toISOString()).toBe(brtMidnight(2026, 5, 11).toISOString());
  });
  it('11/05/2026 às 02:00 UTC (= 10/05 23:00 BRT) → BRT midnight 10/05/2026', () => {
    const now = new Date('2026-05-11T02:00:00Z');
    expect(getBrazilToday(now).toISOString()).toBe(brtMidnight(2026, 5, 10).toISOString());
  });
  it('11/05/2026 às 23:00 UTC (= 11/05 20:00 BRT) → BRT midnight 11/05/2026', () => {
    const now = new Date('2026-05-11T23:00:00Z');
    expect(getBrazilToday(now).toISOString()).toBe(brtMidnight(2026, 5, 11).toISOString());
  });
});

describe('daysBetweenSigned (BRT calendar day)', () => {
  it('retorna 0 para o mesmo dia BRT', () => {
    expect(daysBetweenSigned(brtMidnight(2026, 5, 11), brtMidnight(2026, 5, 11))).toBe(0);
  });
  it('retorna positivo quando to é no futuro', () => {
    expect(daysBetweenSigned(brtMidnight(2026, 5, 11), brtMidnight(2026, 5, 21))).toBe(10);
  });
  it('retorna negativo quando to é no passado', () => {
    expect(daysBetweenSigned(brtMidnight(2026, 5, 11), brtMidnight(2026, 5, 1))).toBe(-10);
  });
  it('hora do instante não afeta o resultado (mesma calendar day BRT)', () => {
    const t1 = new Date('2026-05-11T11:00:00Z'); // BRT 08:00 May 11
    const t2 = new Date('2026-05-11T23:00:00Z'); // BRT 20:00 May 11
    expect(daysBetweenSigned(t1, t2)).toBe(0);
  });
});

describe('formatDateLabel (issue #266)', () => {
  const today = brtMidnight(2026, 5, 11);

  it('data futura > 1 dia: "vence em N dias (DD/MM/YYYY)"', () => {
    expect(formatDateLabel(today, brtMidnight(2026, 5, 21))).toBe('vence em 10 dias (21/05/2026)');
  });
  it('data futura 1 dia: "vence amanhã"', () => {
    expect(formatDateLabel(today, brtMidnight(2026, 5, 12))).toBe('vence amanhã (12/05/2026)');
  });
  it('data hoje: "vence hoje"', () => {
    expect(formatDateLabel(today, brtMidnight(2026, 5, 11))).toBe('vence hoje (11/05/2026)');
  });
  it('data ontem: "venceu ontem"', () => {
    expect(formatDateLabel(today, brtMidnight(2026, 5, 10))).toBe('venceu ontem (10/05/2026)');
  });
  it('data passada > 1 dia: "venceu há N dias"', () => {
    expect(formatDateLabel(today, brtMidnight(2026, 5, 1))).toBe('venceu há 10 dias (01/05/2026)');
  });
  it('caso do bug Wilson Fu — antes saía "venceu 21/05/2026 (10 dias)" para data futura', () => {
    const label = formatDateLabel(today, brtMidnight(2026, 5, 21));
    expect(label).not.toMatch(/^venceu/);
    expect(label).toMatch(/^vence em/);
  });
});

describe('classifyOverdueSub (auto-recovery #266)', () => {
  const today = brtMidnight(2026, 5, 11);

  // ── Casos de RECOVERY ──

  it('renewalDate 10 dias no futuro → recover, urgency=silent (caso Wilson Fu)', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 21), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('recover');
    expect(r.urgency).toBe('silent');
    expect(r.daysToRenewal).toBe(10);
  });

  it('renewalDate 206 dias no futuro → recover, urgency=silent (caso Yoaquim)', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 12, 3), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('recover');
    expect(r.urgency).toBe('silent');
    expect(r.daysToRenewal).toBe(206);
  });

  it('renewalDate em 7 dias → recover, urgency=soon', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 18), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('recover');
    expect(r.urgency).toBe('soon');
  });

  it('renewalDate hoje → recover, urgency=today', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 11), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('recover');
    expect(r.urgency).toBe('today');
  });

  it('renewalDate -3 dias (dentro do grace de 5) → recover, urgency=today', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 8), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('recover');
    expect(r.urgency).toBe('today');
    expect(r.daysToRenewal).toBe(-3);
  });

  it('renewalDate exatamente -5 dias (limite do grace) → recover', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 6), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('recover');
    expect(r.urgency).toBe('today');
  });

  // ── Casos de KEEP_OVERDUE ──

  it('renewalDate -6 dias (1 dia além do grace) → keep_overdue', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 5), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('keep_overdue');
  });

  it('renewalDate -97 dias (caso João Paulo) → keep_overdue', () => {
    const r = classifyOverdueSub({ renewalDate: brtMidnight(2026, 2, 3), gracePeriodDays: 5 }, today);
    expect(r.action).toBe('keep_overdue');
    expect(r.daysToRenewal).toBe(-97);
  });

  it('renewalDate ausente → keep_overdue (nada a recuperar)', () => {
    const r = classifyOverdueSub({ renewalDate: null, gracePeriodDays: 5 }, today);
    expect(r.action).toBe('keep_overdue');
    expect(r.daysToRenewal).toBe(null);
  });

  // ── Default de grace ──

  it('gracePeriodDays ausente usa default 5', () => {
    expect(classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 6) }, today).action).toBe('recover');
    expect(classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 5) }, today).action).toBe('keep_overdue');
  });

  it('gracePeriodDays 0 → qualquer atraso mantém overdue', () => {
    expect(classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 11), gracePeriodDays: 0 }, today).action).toBe('recover');
    expect(classifyOverdueSub({ renewalDate: brtMidnight(2026, 5, 10), gracePeriodDays: 0 }, today).action).toBe('keep_overdue');
  });
});
