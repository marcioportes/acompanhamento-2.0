/**
 * #101 — o autobloqueio virou invariante, não evento.
 *
 * Antes, bloquear só acontecia no dia da transição active→overdue. Desbloquear
 * uma vez dava acesso permanente a quem seguia devendo. Marcio: "quando eu
 * desbloquear um login, que continuar pendente, o sistema precisa voltar a
 * bloquear".
 */
import { describe, it, expect } from 'vitest';
import { deveBloquear, deveDesbloquear } from '../../../../functions/shared/loginBlockPolicy';

describe('deveBloquear', () => {
  it('rebloqueia quem foi desbloqueado e continua devendo — o pedido', () => {
    expect(deveBloquear({ temVencida: true, temViva: false, bloqueado: false })).toBe(true);
  });

  it('não mexe em quem já está bloqueado', () => {
    expect(deveBloquear({ temVencida: true, temViva: false, bloqueado: true })).toBe(false);
  });

  it('não bloqueia quem não deve nada', () => {
    expect(deveBloquear({ temVencida: false, temViva: true, bloqueado: false })).toBe(false);
    expect(deveBloquear({ temVencida: false, temViva: false, bloqueado: false })).toBe(false);
  });

  it('uma conta viva sustenta o acesso mesmo com outra vencida', () => {
    // Aluno com duas assinaturas: uma vencida, uma paga em dia. Não é inadimplente.
    expect(deveBloquear({ temVencida: true, temViva: true, bloqueado: false })).toBe(false);
  });

  it('entrada vazia não bloqueia ninguém por acidente', () => {
    expect(deveBloquear()).toBe(false);
    expect(deveBloquear({})).toBe(false);
  });
});

describe('deveDesbloquear', () => {
  it('libera quem a própria rotina bloqueou', () => {
    expect(deveDesbloquear({ bloqueado: true, motivo: 'auto' })).toBe(true);
  });

  it('NÃO desfaz bloqueio manual do mentor — pagamento não vence decisão dele', () => {
    expect(deveDesbloquear({ bloqueado: true, motivo: 'manual' })).toBe(false);
  });

  it('quem não está bloqueado não precisa de desbloqueio', () => {
    expect(deveDesbloquear({ bloqueado: false, motivo: 'auto' })).toBe(false);
    expect(deveDesbloquear()).toBe(false);
  });
});
