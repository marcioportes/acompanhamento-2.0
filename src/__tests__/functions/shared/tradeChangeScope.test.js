/**
 * #389 — "mesma origem, mesmo resultado" e "feedback não recalcula comportamento".
 *
 * Regra de Marcio (22/08/2026). O caso que a originou: trade WINV26 de 21/08, +R$ 520,
 * revisado limpo pelo mentor às 14:11:11 e regravado COM Hesitação às 14:11:21 — pelo
 * próprio ato de enviar o feedback. O aluno abriu já na versão nova.
 *
 * Este teste é o que impede a regra de voltar a se perder dentro de `onTradeUpdated`,
 * onde ela vivia solta e onde o #383 a quebrou.
 */
import { describe, it, expect } from 'vitest';
import { tradeChangeScope } from '../../../../functions/shared/tradeChangeScope';

const trade = (over = {}) => ({
  result: 520, planId: 'p1', stopLoss: 173905, entry: 174030, exit: 174290,
  qty: 10, side: 'LONG', emotionEntry: 'Calmo',
  tickerRule: { tickSize: 5, tickValue: 1, pointValue: null },
  entryTime: '2026-08-21T11:25:15-03:00', exitTime: '2026-08-21T11:27:51-03:00',
  mentorClearedViolations: [],
  ...over,
});

describe('#389 — o que dispara recálculo', () => {
  it('documento idêntico não recalcula (era a origem do loop do #383)', () => {
    // `tickerRule` é um mapa: duas leituras são referências distintas. Comparado por
    // identidade, isso dizia "mudou" sempre e a CF entrava em recursão.
    expect(tradeChangeScope(trade(), trade()).shouldRecompute).toBe(false);
  });

  it('ENVIAR FEEDBACK não recalcula comportamento', () => {
    const antes = trade();
    const depois = trade({
      feedbackHistory: [{ author: 'mentor', message: 'bom trade' }],
      feedbackStatus: 'REVIEWED',
      reviewId: 'rev-1',
      updatedAt: 'agora',
    });
    expect(tradeChangeScope(antes, depois).shouldRecompute).toBe(false);
  });

  it('comentar, anexar reflexão e marcar como discutido também não', () => {
    const antes = trade();
    for (const conversa of [
      { feedbackHistory: [{ message: 'a' }, { message: 'b' }] },
      { selfReview: { texto: 'refleti' } },
      { feedbackStatus: 'DISCUSSED' },
      { _pendingReviewNote: 'nota de sessão' },
    ]) {
      expect(tradeChangeScope(antes, trade(conversa)).shouldRecompute).toBe(false);
    }
  });

  it.each([
    ['stop', { stopLoss: 173000 }],
    ['entrada', { entry: 174100 }],
    ['saída', { exit: 174400 }],
    ['quantidade', { qty: 5 }],
    ['lado', { side: 'SHORT' }],
    ['emoção declarada', { emotionEntry: 'Ansioso' }],
    ['resultado', { result: 300 }],
    ['plano', { planId: 'p2' }],
    ['horário', { entryTime: '2026-08-21T10:00:00-03:00' }],
  ])('mudar %s recalcula', (_nome, delta) => {
    expect(tradeChangeScope(trade(), trade(delta)).shouldRecompute).toBe(true);
  });

  it('especificação do contrato só conta quando muda DE VERDADE', () => {
    // O motivo do #383 era legítimo: o import carimba `tickerRule` depois da criação.
    expect(tradeChangeScope(trade({ tickerRule: null }), trade()).shouldRecompute).toBe(true);
    // Mas mapa igual, com outra referência, não é mudança.
    expect(tradeChangeScope(trade(), trade()).complianceChanged).toBe(false);
  });

  it('dispensa de violação pelo mentor recalcula (é decisão dele sobre o dado)', () => {
    const depois = trade({ mentorClearedViolations: ['UNPROTECTED_SIZE:t1'] });
    expect(tradeChangeScope(trade(), depois).shouldRecompute).toBe(true);
  });

  it('campos de saída da própria CF nunca recalculam', () => {
    const depois = trade({
      riskPercent: 0.83, rrRatio: 2.08, rrAssumed: false,
      compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
      redFlags: [], hasRedFlags: false,
      behaviorProfile: { fingerprint: 'x' },
    });
    expect(tradeChangeScope(trade(), depois).shouldRecompute).toBe(false);
  });
});
