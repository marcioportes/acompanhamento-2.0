/**
 * Tests: Subscription logic — issue #094
 * @description Testa lógica de negócio de assinaturas:
 *   - Transição de status (active → overdue via grace period)
 *   - Cálculo de dias restantes / em atraso
 *   - Regra de receita (apenas ativos)
 *   - Classificação de assinaturas (vencendo hoje, em 7 dias, inadimplentes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers extraídos da lógica de negócio ──────────────

/**
 * Calcula dias entre hoje e uma data-alvo.
 * Positivo = futuro, negativo = passado.
 */
const daysUntil = (date, now = new Date()) => {
  if (!date) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

/**
 * Determina se uma assinatura deveria ser marcada como overdue.
 * Regra: renewalDate + gracePeriodDays < hoje
 */
const shouldBeOverdue = (sub, now = new Date()) => {
  if (sub.status !== 'active') return false;
  if (!sub.renewalDate) return false;
  const days = daysUntil(sub.renewalDate, now);
  const grace = sub.gracePeriodDays ?? 5;
  return days < -grace;
};

/**
 * Classifica assinatura ativa por urgência.
 * Returns: 'expiring_today' | 'expiring_soon' | 'ok' | null
 */
const classifyUrgency = (sub, now = new Date()) => {
  if (sub.status !== 'active') return null;
  if (!sub.renewalDate) return null;
  const days = daysUntil(sub.renewalDate, now);
  if (days === 0) return 'expiring_today';
  if (days > 0 && days <= 7) return 'expiring_soon';
  return 'ok';
};

/**
 * Calcula receita mensal projetada.
 * Regra: soma dos amount de assinaturas com status === 'active' apenas.
 */
const calculateMonthlyRevenue = (subscriptions) => {
  return subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
};

/**
 * Calcula summary de assinaturas.
 */
const calculateSummary = (subscriptions, now = new Date()) => {
  const active = subscriptions.filter(s => s.status === 'active').length;
  const overdue = subscriptions.filter(s => s.status === 'overdue').length;
  const expiringSoon = subscriptions.filter(s => {
    if (s.status !== 'active') return false;
    const days = daysUntil(s.renewalDate, now);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const monthlyRevenue = calculateMonthlyRevenue(subscriptions);
  return { active, overdue, expiringSoon, monthlyRevenue, total: subscriptions.length };
};

// ── Fixtures ─────────────────────────────────────────────

const makeSubscription = (overrides = {}) => ({
  id: 'sub-001',
  studentId: 'uid-001',
  studentName: 'João Silva',
  studentEmail: 'joao@example.com',
  plan: 'alpha',
  status: 'active',
  startDate: '2026-01-15',
  endDate: '2026-04-15',
  renewalDate: '2026-04-15',
  lastPaymentDate: '2026-03-15',
  amount: 497,
  currency: 'BRL',
  gracePeriodDays: 5,
  notes: '',
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────

describe('Subscription Business Logic', () => {

  // =============================================
  // T1: daysUntil
  // =============================================
  describe('daysUntil', () => {
    it('retorna 0 para data igual a hoje', () => {
      const today = new Date('2026-04-04');
      expect(daysUntil('2026-04-04', today)).toBe(0);
    });

    it('retorna positivo para data futura', () => {
      const today = new Date('2026-04-04');
      expect(daysUntil('2026-04-11', today)).toBe(7);
    });

    it('retorna negativo para data passada', () => {
      const today = new Date('2026-04-04');
      expect(daysUntil('2026-03-28', today)).toBe(-7);
    });

    it('retorna null para data nula', () => {
      expect(daysUntil(null)).toBeNull();
      expect(daysUntil(undefined)).toBeNull();
    });
  });

  // =============================================
  // T2: shouldBeOverdue (grace period)
  // =============================================
  describe('shouldBeOverdue — grace period', () => {
    it('NÃO marca overdue se dentro do grace period', () => {
      const sub = makeSubscription({
        renewalDate: '2026-04-01',
        gracePeriodDays: 5,
      });
      const now = new Date('2026-04-04'); // 3 dias após vencimento, grace = 5
      expect(shouldBeOverdue(sub, now)).toBe(false);
    });

    it('NÃO marca overdue se exatamente no limite do grace period', () => {
      const sub = makeSubscription({
        renewalDate: '2026-04-01',
        gracePeriodDays: 5,
      });
      const now = new Date('2026-04-06'); // 5 dias após = limite
      expect(shouldBeOverdue(sub, now)).toBe(false);
    });

    it('MARCA overdue se ultrapassou grace period', () => {
      const sub = makeSubscription({
        renewalDate: '2026-04-01',
        gracePeriodDays: 5,
      });
      const now = new Date('2026-04-07'); // 6 dias após, grace = 5
      expect(shouldBeOverdue(sub, now)).toBe(true);
    });

    it('NÃO marca overdue se renewalDate é futuro', () => {
      const sub = makeSubscription({
        renewalDate: '2026-04-15',
        gracePeriodDays: 5,
      });
      const now = new Date('2026-04-04');
      expect(shouldBeOverdue(sub, now)).toBe(false);
    });

    it('NÃO marca overdue se status não é active', () => {
      const sub = makeSubscription({
        status: 'paused',
        renewalDate: '2026-03-01',
        gracePeriodDays: 5,
      });
      const now = new Date('2026-04-04');
      expect(shouldBeOverdue(sub, now)).toBe(false);
    });

    it('usa default de 5 dias se gracePeriodDays ausente', () => {
      const sub = makeSubscription({
        renewalDate: '2026-04-01',
        gracePeriodDays: undefined,
      });
      const now = new Date('2026-04-07'); // 6 dias, default grace = 5
      expect(shouldBeOverdue(sub, now)).toBe(true);
    });

    it('NÃO marca overdue se renewalDate é null', () => {
      const sub = makeSubscription({ renewalDate: null });
      expect(shouldBeOverdue(sub, new Date('2026-04-04'))).toBe(false);
    });
  });

  // =============================================
  // T3: classifyUrgency
  // =============================================
  describe('classifyUrgency', () => {
    it('retorna expiring_today se vence hoje', () => {
      const sub = makeSubscription({ renewalDate: '2026-04-04' });
      expect(classifyUrgency(sub, new Date('2026-04-04'))).toBe('expiring_today');
    });

    it('retorna expiring_soon se vence em 1-7 dias', () => {
      const sub = makeSubscription({ renewalDate: '2026-04-08' });
      expect(classifyUrgency(sub, new Date('2026-04-04'))).toBe('expiring_soon');
    });

    it('retorna ok se vence em mais de 7 dias', () => {
      const sub = makeSubscription({ renewalDate: '2026-04-15' });
      expect(classifyUrgency(sub, new Date('2026-04-04'))).toBe('ok');
    });

    it('retorna null se status não é active', () => {
      const sub = makeSubscription({ status: 'overdue', renewalDate: '2026-04-04' });
      expect(classifyUrgency(sub, new Date('2026-04-04'))).toBeNull();
    });

    it('retorna null se renewalDate é null', () => {
      const sub = makeSubscription({ renewalDate: null });
      expect(classifyUrgency(sub, new Date('2026-04-04'))).toBeNull();
    });
  });

  // =============================================
  // T4: calculateMonthlyRevenue
  // =============================================
  describe('calculateMonthlyRevenue', () => {
    it('soma apenas assinaturas com status active', () => {
      const subs = [
        makeSubscription({ id: '1', status: 'active', amount: 497 }),
        makeSubscription({ id: '2', status: 'active', amount: 197 }),
        makeSubscription({ id: '3', status: 'overdue', amount: 497 }),
        makeSubscription({ id: '4', status: 'pending', amount: 197 }),
        makeSubscription({ id: '5', status: 'cancelled', amount: 497 }),
      ];
      expect(calculateMonthlyRevenue(subs)).toBe(694); // 497 + 197
    });

    it('retorna 0 se nenhuma assinatura ativa', () => {
      const subs = [
        makeSubscription({ status: 'overdue', amount: 497 }),
        makeSubscription({ status: 'cancelled', amount: 197 }),
      ];
      expect(calculateMonthlyRevenue(subs)).toBe(0);
    });

    it('retorna 0 para lista vazia', () => {
      expect(calculateMonthlyRevenue([])).toBe(0);
    });

    it('trata amount undefined como 0', () => {
      const subs = [
        makeSubscription({ status: 'active', amount: undefined }),
      ];
      expect(calculateMonthlyRevenue(subs)).toBe(0);
    });
  });

  // =============================================
  // T5: calculateSummary
  // =============================================
  describe('calculateSummary', () => {
    it('calcula summary completo corretamente', () => {
      const now = new Date('2026-04-04');
      const subs = [
        makeSubscription({ id: '1', status: 'active', amount: 497, renewalDate: '2026-04-15' }),  // ok
        makeSubscription({ id: '2', status: 'active', amount: 197, renewalDate: '2026-04-08' }),  // expiring_soon
        makeSubscription({ id: '3', status: 'active', amount: 497, renewalDate: '2026-04-04' }),  // expiring_today
        makeSubscription({ id: '4', status: 'overdue', amount: 497, renewalDate: '2026-03-18' }), // overdue
        makeSubscription({ id: '5', status: 'pending', amount: 197, renewalDate: '2026-05-01' }), // pending
      ];

      const result = calculateSummary(subs, now);
      expect(result.active).toBe(3);
      expect(result.overdue).toBe(1);
      expect(result.expiringSoon).toBe(2); // inclui expiring_today (dias >= 0 && <= 7)
      expect(result.monthlyRevenue).toBe(1191); // 497 + 197 + 497 (apenas active)
      expect(result.total).toBe(5);
    });

    it('retorna zeros para lista vazia', () => {
      const result = calculateSummary([]);
      expect(result.active).toBe(0);
      expect(result.overdue).toBe(0);
      expect(result.expiringSoon).toBe(0);
      expect(result.monthlyRevenue).toBe(0);
      expect(result.total).toBe(0);
    });
  });
});
