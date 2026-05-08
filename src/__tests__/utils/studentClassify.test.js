/**
 * studentClassify.test.js
 * @description Cobre os 5 buckets visuais derivados de student.accessTier + subs.
 * @see src/utils/studentClassify.js
 */

import { describe, it, expect } from 'vitest';
import { classifyStudent, isExpiringSoon } from '../../utils/studentClassify';

describe('classifyStudent', () => {
  it('alpha — accessTier === "alpha" vence sobre qualquer histórico', () => {
    expect(classifyStudent({ accessTier: 'alpha' }, [])).toBe('alpha');
    // Mesmo com sub VIP, tier ganha (raro mas possível).
    expect(classifyStudent({ accessTier: 'alpha' }, [{ type: 'vip', status: 'active' }])).toBe('alpha');
  });

  it('espelho — accessTier === "self_service"', () => {
    expect(classifyStudent({ accessTier: 'self_service' }, [])).toBe('espelho');
  });

  it('vip — accessTier vazio + sub type=vip não-encerrada', () => {
    expect(classifyStudent({ accessTier: 'none' }, [{ type: 'vip', status: 'active' }])).toBe('vip');
    expect(classifyStudent({}, [{ type: 'vip', status: 'pending' }])).toBe('vip');
    // VIP cancelado não conta.
    expect(classifyStudent({ accessTier: 'none' }, [{ type: 'vip', status: 'cancelled' }])).toBe('ex');
  });

  it('lead — sem accessTier e sem nenhuma sub', () => {
    expect(classifyStudent({ accessTier: 'none' }, [])).toBe('lead');
    expect(classifyStudent({}, [])).toBe('lead');
    expect(classifyStudent({ accessTier: undefined }, [])).toBe('lead');
  });

  it('ex — teve sub mas todas encerradas (sem accessTier ativo)', () => {
    // Renato: accessTier='none', sub Espelho cancelled.
    expect(classifyStudent({ accessTier: 'none' }, [{ type: 'paid', status: 'cancelled' }])).toBe('ex');
    expect(classifyStudent({ accessTier: 'none' }, [
      { type: 'paid', status: 'cancelled' },
      { type: 'trial', status: 'expired' },
    ])).toBe('ex');
  });

  it('precedência: tier explícito > VIP ativo > histórico', () => {
    // Hipotético: aluno tinha VIP mas migrou para Alpha.
    expect(classifyStudent(
      { accessTier: 'alpha' },
      [{ type: 'vip', status: 'active' }, { type: 'paid', status: 'active', plan: 'alpha' }],
    )).toBe('alpha');
  });

  it('input degradado não quebra', () => {
    expect(classifyStudent(null, null)).toBe('lead');
    expect(classifyStudent(undefined, undefined)).toBe('lead');
    expect(classifyStudent({}, [null, undefined])).toBe('ex'); // tem subs (degradadas) → não é lead
  });
});

describe('isExpiringSoon', () => {
  const now = new Date('2026-05-07T12:00:00Z');

  const at = (offsetDays) => new Date(now.getTime() + offsetDays * 86_400_000);

  it('paid vencendo em 3 dias → true', () => {
    expect(isExpiringSoon({ type: 'paid', status: 'active', renewalDate: at(3) }, now)).toBe(true);
  });

  it('paid vencendo em exatamente 7 dias → true', () => {
    expect(isExpiringSoon({ type: 'paid', status: 'active', renewalDate: at(7) }, now)).toBe(true);
  });

  it('paid vencendo em 8 dias → false', () => {
    expect(isExpiringSoon({ type: 'paid', status: 'active', renewalDate: at(8) }, now)).toBe(false);
  });

  it('paid já vencida (negative) → false', () => {
    expect(isExpiringSoon({ type: 'paid', status: 'overdue', renewalDate: at(-2) }, now)).toBe(false);
  });

  it('VIP nunca vence em ≤7d', () => {
    expect(isExpiringSoon({ type: 'vip', status: 'active', renewalDate: at(3) }, now)).toBe(false);
  });

  it('cancelled/expired não conta', () => {
    expect(isExpiringSoon({ type: 'paid', status: 'cancelled', renewalDate: at(3) }, now)).toBe(false);
    expect(isExpiringSoon({ type: 'paid', status: 'expired',   renewalDate: at(3) }, now)).toBe(false);
  });

  it('trial usa trialEndsAt em vez de renewalDate', () => {
    expect(isExpiringSoon({ type: 'trial', status: 'active', trialEndsAt: at(2) }, now)).toBe(true);
    expect(isExpiringSoon({ type: 'trial', status: 'active', trialEndsAt: at(10) }, now)).toBe(false);
  });

  it('sem data → false', () => {
    expect(isExpiringSoon({ type: 'paid', status: 'active' }, now)).toBe(false);
    expect(isExpiringSoon(null, now)).toBe(false);
  });
});
