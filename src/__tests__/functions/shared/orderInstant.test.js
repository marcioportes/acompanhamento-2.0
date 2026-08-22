/**
 * #388 — instante de ordem no fuso do trade, no lado servidor.
 *
 * Terceira cópia da comparação que o #375 corrigiu: `shadowDetectors.detectHesitation`
 * comparava `cancelledAt` (ingênuo) com `trade.entryTime` (com offset). Na Cloud Function,
 * que roda em UTC, as pernas de proteção canceladas NO ALVO viravam "canceladas antes de
 * entrar" e o trade ganhava HESITATION — apareceu no WINV26 de 21/08 depois de o feedback
 * já ter sido enviado ao aluno.
 */
import { describe, it, expect } from 'vitest';
import { orderInstantMs, tradeOffsetOf } from '../../../../functions/shared/orderInstant';

const trade = { entryTime: '2026-08-21T11:25:15-03:00', exitTime: '2026-08-21T11:27:51-03:00' };

describe('#388 — orderInstant', () => {
  it('aplica o offset do trade a instante ingênuo', () => {
    expect(new Date(orderInstantMs(trade, '2026-08-21T11:27:51')).toISOString())
      .toBe('2026-08-21T14:27:51.000Z');
  });

  it('bracket cancelado na saída NÃO é anterior à entrada', () => {
    expect(orderInstantMs(trade, '2026-08-21T11:27:51') < new Date(trade.entryTime).getTime()).toBe(false);
  });

  it('cancelamento realmente anterior continua sendo anterior', () => {
    expect(orderInstantMs(trade, '2026-08-21T11:20:00') < new Date(trade.entryTime).getTime()).toBe(true);
  });

  it('respeita instante que já traz offset', () => {
    expect(new Date(orderInstantMs(trade, '2026-08-21T14:27:51Z')).toISOString())
      .toBe('2026-08-21T14:27:51.000Z');
  });

  it('sem offset no trade, não inventa', () => {
    expect(tradeOffsetOf({})).toBeNull();
    expect(orderInstantMs({}, null)).toBeNull();
  });
});
