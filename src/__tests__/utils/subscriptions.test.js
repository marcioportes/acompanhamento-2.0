/**
 * Tests: Subscription logic — issue #094
 * @description Testa lógica de negócio de assinaturas:
 *   - Transição de status (active → overdue via grace period)
 *   - Cálculo de dias restantes / em atraso
 *   - Regra de receita (apenas ativos paid)
 *   - Trial expiration
 *   - accessTier resolution
 *   - Classificação de urgência
 *
 * DEC-055: subcollection students/{id}/subscriptions
 * DEC-056: type trial/paid + trialEndsAt + accessTier
 */

import { describe, it, expect } from 'vitest';

// ── Helpers ──────────────────────────────────────────────

const daysUntil = (date, now = new Date()) => {
  if (!date) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const shouldBeOverdue = (sub, now = new Date()) => {
  if (sub.status !== 'active' || sub.type === 'trial') return false;
  if (!sub.renewalDate) return false;
  const days = daysUntil(sub.renewalDate, now);
  const grace = sub.gracePeriodDays ?? 5;
  return days < -grace;
};

const shouldTrialExpire = (sub, now = new Date()) => {
  if (sub.type !== 'trial' || sub.status !== 'active') return false;
  if (!sub.trialEndsAt) return false;
  const days = daysUntil(sub.trialEndsAt, now);
  return days < 0;
};

const resolveAccessTier = (sub) => {
  if (!sub || sub.status === 'cancelled' || sub.status === 'expired') return 'none';
  if (sub.status === 'active' || sub.status === 'pending' || sub.status === 'paused') return sub.plan ?? 'none';
  if (sub.status === 'overdue') return sub.plan ?? 'none';
  return 'none';
};

const classifyUrgency = (sub, now = new Date()) => {
  if (sub.status !== 'active') return null;
  const targetDate = sub.type === 'trial' ? sub.trialEndsAt : sub.renewalDate;
  if (!targetDate) return null;
  const days = daysUntil(targetDate, now);
  if (days === 0) return 'expiring_today';
  if (days > 0 && days <= 7) return 'expiring_soon';
  return 'ok';
};

const calculateMonthlyRevenue = (subscriptions) => {
  return subscriptions
    .filter(s => s.status === 'active' && s.type === 'paid')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
};

const calculateSummary = (subscriptions, now = new Date()) => {
  const active = subscriptions.filter(s => s.status === 'active').length;
  const overdue = subscriptions.filter(s => s.status === 'overdue').length;
  const expiringSoon = subscriptions.filter(s => {
    if (s.status !== 'active') return false;
    const targetDate = s.type === 'trial' ? s.trialEndsAt : s.renewalDate;
    const days = daysUntil(targetDate, now);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const monthlyRevenue = calculateMonthlyRevenue(subscriptions);
  return { active, overdue, expiringSoon, monthlyRevenue, total: subscriptions.length };
};

// ── Fixtures ─────────────────────────────────────────────

const makePaidSub = (overrides = {}) => ({
  id: 'sub-001', type: 'paid', plan: 'alpha', status: 'active',
  startDate: '2026-01-15', endDate: '2026-04-15', renewalDate: '2026-04-15',
  lastPaymentDate: '2026-03-15', amount: 497, currency: 'BRL', gracePeriodDays: 5,
  ...overrides,
});

const makeTrialSub = (overrides = {}) => ({
  id: 'trial-001', type: 'trial', plan: 'alpha', status: 'active',
  startDate: '2026-03-01', trialEndsAt: '2026-03-31',
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────

describe('Subscription Business Logic (DEC-055/DEC-056)', () => {

  describe('daysUntil', () => {
    it('retorna 0 para data igual a hoje', () => {
      expect(daysUntil('2026-04-04', new Date('2026-04-04'))).toBe(0);
    });
    it('retorna positivo para data futura', () => {
      expect(daysUntil('2026-04-11', new Date('2026-04-04'))).toBe(7);
    });
    it('retorna negativo para data passada', () => {
      expect(daysUntil('2026-03-28', new Date('2026-04-04'))).toBe(-7);
    });
    it('retorna null para data nula', () => {
      expect(daysUntil(null)).toBeNull();
    });
  });

  describe('shouldBeOverdue — grace period (paid only)', () => {
    it('NÃO marca overdue se dentro do grace period', () => {
      const sub = makePaidSub({ renewalDate: '2026-04-01', gracePeriodDays: 5 });
      expect(shouldBeOverdue(sub, new Date('2026-04-04'))).toBe(false);
    });
    it('NÃO marca overdue no limite do grace period', () => {
      const sub = makePaidSub({ renewalDate: '2026-04-01', gracePeriodDays: 5 });
      expect(shouldBeOverdue(sub, new Date('2026-04-06'))).toBe(false);
    });
    it('MARCA overdue se ultrapassou grace period', () => {
      const sub = makePaidSub({ renewalDate: '2026-04-01', gracePeriodDays: 5 });
      expect(shouldBeOverdue(sub, new Date('2026-04-07'))).toBe(true);
    });
    it('NÃO marca overdue para trials (ignorar grace)', () => {
      const sub = makeTrialSub({ trialEndsAt: '2026-03-01' });
      expect(shouldBeOverdue(sub, new Date('2026-04-04'))).toBe(false);
    });
    it('NÃO marca overdue se status não é active', () => {
      const sub = makePaidSub({ status: 'paused', renewalDate: '2026-03-01' });
      expect(shouldBeOverdue(sub, new Date('2026-04-04'))).toBe(false);
    });
    it('usa default de 5 dias se gracePeriodDays ausente', () => {
      const sub = makePaidSub({ renewalDate: '2026-04-01', gracePeriodDays: undefined });
      expect(shouldBeOverdue(sub, new Date('2026-04-07'))).toBe(true);
    });
  });

  describe('shouldTrialExpire', () => {
    it('expira trial quando trialEndsAt é passado', () => {
      const sub = makeTrialSub({ trialEndsAt: '2026-03-31' });
      expect(shouldTrialExpire(sub, new Date('2026-04-01'))).toBe(true);
    });
    it('NÃO expira trial quando trialEndsAt é futuro', () => {
      const sub = makeTrialSub({ trialEndsAt: '2026-04-15' });
      expect(shouldTrialExpire(sub, new Date('2026-04-04'))).toBe(false);
    });
    it('NÃO expira trial no dia exato (expira no dia seguinte)', () => {
      const sub = makeTrialSub({ trialEndsAt: '2026-04-04' });
      expect(shouldTrialExpire(sub, new Date('2026-04-04'))).toBe(false);
    });
    it('NÃO expira se tipo não é trial', () => {
      const sub = makePaidSub({ trialEndsAt: '2026-03-01' });
      expect(shouldTrialExpire(sub, new Date('2026-04-04'))).toBe(false);
    });
    it('NÃO expira se status não é active', () => {
      const sub = makeTrialSub({ status: 'expired', trialEndsAt: '2026-03-01' });
      expect(shouldTrialExpire(sub, new Date('2026-04-04'))).toBe(false);
    });
  });

  describe('resolveAccessTier', () => {
    it('active paid alpha → alpha', () => {
      expect(resolveAccessTier(makePaidSub({ plan: 'alpha', status: 'active' }))).toBe('alpha');
    });
    it('active trial self_service → self_service', () => {
      expect(resolveAccessTier(makeTrialSub({ plan: 'self_service', status: 'active' }))).toBe('self_service');
    });
    it('overdue mantém tier (grace period)', () => {
      expect(resolveAccessTier(makePaidSub({ plan: 'alpha', status: 'overdue' }))).toBe('alpha');
    });
    it('expired → none', () => {
      expect(resolveAccessTier(makeTrialSub({ status: 'expired' }))).toBe('none');
    });
    it('cancelled → none', () => {
      expect(resolveAccessTier(makePaidSub({ status: 'cancelled' }))).toBe('none');
    });
    it('null/undefined → none', () => {
      expect(resolveAccessTier(null)).toBe('none');
      expect(resolveAccessTier(undefined)).toBe('none');
    });
    it('paused mantém tier', () => {
      expect(resolveAccessTier(makePaidSub({ plan: 'alpha', status: 'paused' }))).toBe('alpha');
    });
  });

  describe('classifyUrgency', () => {
    it('paid expiring_today', () => {
      expect(classifyUrgency(makePaidSub({ renewalDate: '2026-04-04' }), new Date('2026-04-04'))).toBe('expiring_today');
    });
    it('paid expiring_soon (7 dias)', () => {
      expect(classifyUrgency(makePaidSub({ renewalDate: '2026-04-08' }), new Date('2026-04-04'))).toBe('expiring_soon');
    });
    it('trial expiring_today', () => {
      expect(classifyUrgency(makeTrialSub({ trialEndsAt: '2026-04-04' }), new Date('2026-04-04'))).toBe('expiring_today');
    });
    it('trial expiring_soon', () => {
      expect(classifyUrgency(makeTrialSub({ trialEndsAt: '2026-04-08' }), new Date('2026-04-04'))).toBe('expiring_soon');
    });
    it('ok se > 7 dias', () => {
      expect(classifyUrgency(makePaidSub({ renewalDate: '2026-04-15' }), new Date('2026-04-04'))).toBe('ok');
    });
    it('null se status não é active', () => {
      expect(classifyUrgency(makePaidSub({ status: 'overdue' }), new Date('2026-04-04'))).toBeNull();
    });
  });

  describe('calculateMonthlyRevenue', () => {
    it('soma apenas active paid', () => {
      const subs = [
        makePaidSub({ id: '1', amount: 497 }),
        makePaidSub({ id: '2', amount: 197 }),
        makePaidSub({ id: '3', status: 'overdue', amount: 497 }),
        makeTrialSub({ id: '4' }), // trial active — não conta
        makePaidSub({ id: '5', status: 'cancelled', amount: 497 }),
      ];
      expect(calculateMonthlyRevenue(subs)).toBe(694);
    });
    it('retorna 0 se nenhum active paid', () => {
      expect(calculateMonthlyRevenue([makeTrialSub(), makePaidSub({ status: 'overdue' })])).toBe(0);
    });
    it('retorna 0 para lista vazia', () => {
      expect(calculateMonthlyRevenue([])).toBe(0);
    });
  });

  describe('calculateSummary', () => {
    it('calcula summary com mix trial/paid', () => {
      const now = new Date('2026-04-04');
      const subs = [
        makePaidSub({ id: '1', amount: 497, renewalDate: '2026-04-15' }),         // active ok
        makePaidSub({ id: '2', amount: 197, renewalDate: '2026-04-08' }),         // active expiring_soon
        makeTrialSub({ id: '3', trialEndsAt: '2026-04-04' }),                     // active expiring_today (trial)
        makePaidSub({ id: '4', status: 'overdue', renewalDate: '2026-03-18' }),   // overdue
        makeTrialSub({ id: '5', status: 'expired', trialEndsAt: '2026-03-01' }), // expired
      ];
      const result = calculateSummary(subs, now);
      expect(result.active).toBe(3);
      expect(result.overdue).toBe(1);
      expect(result.expiringSoon).toBe(2); // paid em 4 dias + trial hoje
      expect(result.monthlyRevenue).toBe(694); // 497 + 197 (apenas active paid)
      expect(result.total).toBe(5);
    });
  });

  // =============================================
  // T7: formatBrDate — INV-06
  // =============================================
  describe('formatBrDate — INV-06', () => {
    const formatBrDate = (date) => {
      if (!date) return '—';
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR');
    };

    it('Date object → DD/MM/YYYY', () => {
      expect(formatBrDate(new Date(2026, 3, 4))).toBe('04/04/2026'); // mês 3 = abril
    });
    it('ISO string → DD/MM/YYYY', () => {
      expect(formatBrDate('2026-04-04T12:00:00Z')).toBe('04/04/2026');
    });
    it('Firestore-like date → DD/MM/YYYY', () => {
      // Simula Timestamp.toDate() que retorna Date object
      const firestoreDate = new Date(2026, 0, 15); // 15 jan 2026
      expect(formatBrDate(firestoreDate)).toBe('15/01/2026');
    });
    it('null → traço', () => {
      expect(formatBrDate(null)).toBe('—');
    });
    it('undefined → traço', () => {
      expect(formatBrDate(undefined)).toBe('—');
    });
    it('string inválida → traço', () => {
      expect(formatBrDate('not-a-date')).toBe('—');
    });
    it('nunca retorna formato americano MM/DD/YYYY', () => {
      const result = formatBrDate(new Date(2026, 11, 25)); // 25 dez 2026
      expect(result).toBe('25/12/2026');
      expect(result).not.toMatch(/^12\/25/); // não pode começar com 12/25
    });
    it('dia 1 → com zero à esquerda', () => {
      expect(formatBrDate(new Date(2026, 0, 1))).toBe('01/01/2026');
    });
    it('fuso BR não altera o dia para datas com hora', () => {
      // Meia-noite UTC = 21h dia anterior em BR. toLocaleDateString usa local.
      const d = new Date(2026, 3, 15, 0, 0, 0); // local midnight
      expect(formatBrDate(d)).toBe('15/04/2026');
    });
  });

  // =============================================
  // T8: isoToBr / brToIso
  // =============================================
  describe('isoToBr / brToIso', () => {
    const isoToBr = (iso) => {
      if (!iso) return '';
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };
    const brToIso = (br) => {
      if (!br || br.length !== 10) return '';
      const [d, m, y] = br.split('/');
      if (!d || !m || !y) return '';
      return `${y}-${m}-${d}`;
    };

    it('ISO → BR', () => {
      expect(isoToBr('2026-04-04')).toBe('04/04/2026');
    });
    it('BR → ISO', () => {
      expect(brToIso('04/04/2026')).toBe('2026-04-04');
    });
    it('roundtrip ISO → BR → ISO', () => {
      expect(brToIso(isoToBr('2026-12-25'))).toBe('2026-12-25');
    });
    it('roundtrip BR → ISO → BR', () => {
      expect(isoToBr(brToIso('25/12/2026'))).toBe('25/12/2026');
    });
    it('null/empty → string vazia', () => {
      expect(isoToBr(null)).toBe('');
      expect(isoToBr('')).toBe('');
      expect(brToIso(null)).toBe('');
      expect(brToIso('')).toBe('');
    });
    it('BR incompleto → string vazia', () => {
      expect(brToIso('04/04')).toBe('');
      expect(brToIso('04')).toBe('');
    });
  });

  // =============================================
  // T9: billingPeriodMonths — cálculo de vencimento
  // =============================================
  describe('billingPeriodMonths — cálculo de vencimento', () => {
    const calcEndDate = (startDate, billingMonths) => {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + billingMonths);
      return d;
    };

    it('mensal: +1 mês', () => {
      const end = calcEndDate('2026-04-04T12:00:00Z', 1);
      expect(end.getMonth()).toBe(4); // maio (0-indexed)
      expect(end.getDate()).toBe(4);
    });
    it('trimestral: +3 meses', () => {
      const end = calcEndDate('2026-01-15T12:00:00Z', 3);
      expect(end.getMonth()).toBe(3); // abril
      expect(end.getDate()).toBe(15);
    });
    it('semestral: +6 meses', () => {
      const end = calcEndDate('2026-01-01T12:00:00Z', 6);
      expect(end.getMonth()).toBe(6); // julho
    });
    it('anual: +12 meses', () => {
      const end = calcEndDate('2026-04-04T12:00:00Z', 12);
      expect(end.getFullYear()).toBe(2027);
      expect(end.getMonth()).toBe(3); // abril
    });
    it('fim de mês: jan 31 + 1 mês = fev 28/mar', () => {
      const end = calcEndDate('2026-01-31T12:00:00Z', 1);
      // JS setMonth com dia 31 em fevereiro rola para março
      expect(end.getMonth()).toBe(2); // março (overflow de fev)
    });
  });
});
