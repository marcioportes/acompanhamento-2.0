/**
 * studentClassify.test.js
 * @description 3 buckets visíveis (alpha/espelho/trial); 4 internos
 *              (alpha/espelho/trial-alpha/trial-espelho); null filtra fora.
 * @see src/utils/studentClassify.js
 */

import { describe, it, expect } from 'vitest';
import {
  classifyStudent, isExpiringSoon, tierGroup, findActiveSub,
} from '../../utils/studentClassify';

const sub = (over = {}) => ({
  id: 'su1', plan: 'alpha', type: 'paid', status: 'active', renewalDate: new Date('2026-12-01'), ...over,
});

describe('classifyStudent', () => {
  it('alpha — paid + plan=alpha', () => {
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ plan: 'alpha', type: 'paid' })])).toBe('alpha');
  });

  it('espelho — paid + plan=self_service', () => {
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ plan: 'self_service', type: 'paid' })])).toBe('espelho');
  });

  it('trial-alpha — type=trial + plan=alpha', () => {
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ plan: 'alpha', type: 'trial', trialEndsAt: new Date('2026-06-01') })])).toBe('trial-alpha');
  });

  it('trial-espelho — type=trial + plan=self_service', () => {
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ plan: 'self_service', type: 'trial', trialEndsAt: new Date('2026-06-01') })])).toBe('trial-espelho');
  });

  it('null — sub única cancelled E aluno NÃO passou pelo ritual', () => {
    // DEC-AUTO-263-10: aluno sem sub só aparece se accessStatus pending/active.
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ status: 'cancelled' })])).toBe(null);
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ status: 'expired' })])).toBe(null);
  });

  it('null — student criado sem sub e sem ritual', () => {
    expect(classifyStudent({ email: 'a@b.com' }, [])).toBe(null);
    expect(classifyStudent({ email: 'a@b.com' }, null)).toBe(null);
  });

  it('aguardando-plano — passou pelo ritual mas ainda sem sub (DEC-AUTO-263-10)', () => {
    // accessStatus explícito
    expect(classifyStudent({ email: 'a@b.com', accessStatus: 'pending' }, [])).toBe('aguardando-plano');
    expect(classifyStudent({ email: 'a@b.com', accessStatus: 'active' }, [])).toBe('aguardando-plano');
    // Sub cancelada mas aluno já no ritual: continua visível.
    expect(classifyStudent(
      { email: 'a@b.com', accessStatus: 'pending' },
      [sub({ status: 'cancelled' })]
    )).toBe('aguardando-plano');
    // Fallback derivado dos campos legados (antes do backfill).
    expect(classifyStudent({ email: 'a@b.com', status: 'pending' }, [])).toBe('aguardando-plano');
    expect(classifyStudent({ email: 'a@b.com', firstLoginAt: new Date() }, [])).toBe('aguardando-plano');
    // accessStatus='none' não tira da invisibilidade.
    expect(classifyStudent({ email: 'a@b.com', accessStatus: 'none' }, [])).toBe(null);
  });

  it('aluno sem email com sub Alpha/Espelho aparece como Candidato (DEC-AUTO-263-06 revogada)', () => {
    // Acompanhamento é o lugar do registro. Aluno sem email + sub
    // Alpha/Espelho ativa/trial é Candidato — mentor cadastra email no
    // ritual via drawer. Antes (DEC-AUTO-263-06) retornava null; revogado
    // após domínio fechar "WhatsApp-only não existe" (2026-05-09).
    expect(classifyStudent({}, [sub({ plan: 'alpha', type: 'paid' })])).toBe('alpha');
    expect(classifyStudent({ email: null }, [sub({ plan: 'alpha' })])).toBe('alpha');
    expect(classifyStudent({ email: '' }, [sub({ plan: 'self_service' })])).toBe('espelho');
    expect(classifyStudent({ email: '   ' }, [sub({ plan: 'alpha', type: 'trial', trialEndsAt: new Date('2026-06-01') })])).toBe('trial-alpha');
    // student null ainda retorna null (defesa contra input inválido)
    expect(classifyStudent(null, null)).toBe(null);
  });

  it('null — VIP ativo fica fora da gestão (mesmo se também tiver outra sub)', () => {
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ type: 'vip', status: 'active' })])).toBe(null);
    // VIP ativo + Alpha ativo: VIP precede (especial), some.
    expect(classifyStudent({ email: 'a@b.com' }, [
      sub({ type: 'vip',  status: 'active' }),
      sub({ type: 'paid', status: 'active', plan: 'alpha' }),
    ])).toBe(null);
  });

  it('VIP cancelado vira null (perdeu a vitaliciedade, sem outras subs)', () => {
    // DEC-AUTO-263-09: sem sub ativa = fora da tela.
    expect(classifyStudent({ email: 'a@b.com' }, [sub({ type: 'vip', status: 'cancelled' })])).toBe(null);
  });

  it('múltiplas subs ativas: pega a de renewalDate mais futura', () => {
    const subs = [
      sub({ id: 'old', plan: 'self_service', type: 'paid', renewalDate: new Date('2026-01-01') }),
      sub({ id: 'new', plan: 'alpha',        type: 'paid', renewalDate: new Date('2026-09-01') }),
    ];
    expect(classifyStudent({ email: 'a@b.com' }, subs)).toBe('alpha');
  });

  it('cancelada + ativa: ignora a cancelada', () => {
    const subs = [
      sub({ id: 'old', plan: 'self_service', type: 'paid', status: 'cancelled' }),
      sub({ id: 'new', plan: 'alpha',        type: 'paid', status: 'active' }),
    ];
    expect(classifyStudent({ email: 'a@b.com' }, subs)).toBe('alpha');
  });
});

describe('tierGroup', () => {
  it('agrega trial-* em "trial"', () => {
    expect(tierGroup('trial-alpha')).toBe('trial');
    expect(tierGroup('trial-espelho')).toBe('trial');
    expect(tierGroup('alpha')).toBe('alpha');
    expect(tierGroup('espelho')).toBe('espelho');
    expect(tierGroup(null)).toBe(null);
  });
});

describe('findActiveSub', () => {
  it('retorna null se vazio ou todas encerradas', () => {
    expect(findActiveSub([])).toBe(null);
    expect(findActiveSub(null)).toBe(null);
    expect(findActiveSub([sub({ status: 'cancelled' })])).toBe(null);
  });

  it('retorna sub mais recente entre as ativas', () => {
    const subs = [
      sub({ id: 'a', renewalDate: new Date('2026-01-01') }),
      sub({ id: 'b', renewalDate: new Date('2026-12-01') }),
    ];
    expect(findActiveSub(subs).id).toBe('b');
  });
});

describe('isExpiringSoon', () => {
  const now = new Date('2026-05-07T12:00:00Z');
  const at = (offsetDays) => new Date(now.getTime() + offsetDays * 86_400_000);

  it('paid em 3 dias → true; em 8 → false; já vencida → false', () => {
    expect(isExpiringSoon(sub({ renewalDate: at(3) }), now)).toBe(true);
    expect(isExpiringSoon(sub({ renewalDate: at(7) }), now)).toBe(true);
    expect(isExpiringSoon(sub({ renewalDate: at(8) }), now)).toBe(false);
    expect(isExpiringSoon(sub({ renewalDate: at(-1), status: 'overdue' }), now)).toBe(false);
  });

  it('trial usa trialEndsAt', () => {
    expect(isExpiringSoon({ type: 'trial', status: 'active', trialEndsAt: at(2) }, now)).toBe(true);
    expect(isExpiringSoon({ type: 'trial', status: 'active', trialEndsAt: at(10) }, now)).toBe(false);
  });

  it('VIP/cancelled/sem data → false', () => {
    expect(isExpiringSoon({ type: 'vip', status: 'active', renewalDate: at(3) }, now)).toBe(false);
    expect(isExpiringSoon(sub({ status: 'cancelled', renewalDate: at(3) }), now)).toBe(false);
    expect(isExpiringSoon({ type: 'paid', status: 'active' }, now)).toBe(false);
  });
});
