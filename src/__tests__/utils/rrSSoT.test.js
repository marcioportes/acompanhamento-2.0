/**
 * #383 — invariante: o R:R gravado nunca diverge do derivado.
 *
 * Três implementações da mesma conta produziram, em produção, 9 de 161 trades com o
 * escalar `rrRatio` divergindo do R:R real — incluindo losses que bateram o stop (−1R)
 * gravados como −0,2 e marcados CONFORME. A origem do `0.42` do trade de 21/08 foi
 * `useTrades` dividindo por `tickerRule.pointValue`, campo NULL no WIN, com fallback 1.
 *
 * Este teste é o que impede a quarta implementação.
 */
import { describe, it, expect } from 'vitest';
import { realizedRR, calculateTradeCompliance } from '../../utils/compliance';
import { realizedRR as realizedRRShadow } from '../../utils/shadowBehaviorAnalysis';

const plano = { pl: 30000, riskPerOperation: 0.84, rrTarget: 2 };

const tradeReal = (over = {}) => ({
  ticker: 'WINV26', side: 'LONG', qty: 10,
  entry: 174030, exit: 174290, stopLoss: 173905, result: 520,
  tickerRule: { tickSize: 5, tickValue: 1, pointValue: null },
  ...over,
});

describe('#383 — SSoT do R:R', () => {
  it('o trade de 21/08 vale 2,08, não 0,42', () => {
    expect(realizedRR(tradeReal())).toBe(2.08);
    expect(calculateTradeCompliance(tradeReal(), plano).rrRatio).toBe(2.08);
  });

  it('não depende de tickerRule — era daí que vinha o 0,42', () => {
    for (const tr of [null, undefined, {}, { pointValue: null }, { tickSize: 1, tickValue: 1 }]) {
      expect(realizedRR(tradeReal({ tickerRule: tr }))).toBe(2.08);
      expect(calculateTradeCompliance(tradeReal({ tickerRule: tr }), plano).rrRatio).toBe(2.08);
    }
  });

  it('compliance e detector comportamental leem a MESMA função', () => {
    expect(realizedRRShadow).toBe(realizedRR);
  });

  it('invariante: rrRatio do compliance == realizedRR, em qualquer trade com stop e ganho', () => {
    const cenarios = [
      tradeReal(),
      tradeReal({ exit: 174080, result: 100 }),
      tradeReal({ exit: 174500, result: 940 }),
      tradeReal({ side: 'SHORT', entry: 174030, exit: 173780, stopLoss: 174155, result: 500 }),
      tradeReal({ tickerRule: null, exit: 174155, result: 250 }),
      tradeReal({ qty: 1, result: 52 }),
    ];
    for (const t of cenarios) {
      const c = calculateTradeCompliance(t, plano);
      expect(c.rrRatio).toBe(realizedRR(t));
    }
  });

  it('ausência não é zero: sem stop não inventa R:R por geometria', () => {
    expect(realizedRR(tradeReal({ stopLoss: null }))).toBeNull();
    expect(realizedRR(tradeReal({ stopLoss: undefined }))).toBeNull();
    expect(realizedRR(tradeReal({ stopLoss: '' }))).toBeNull();
    // stop na entrada: risco zero não é R:R infinito
    expect(realizedRR(tradeReal({ stopLoss: 174030 }))).toBeNull();
  });

  it('sem preço de saída, só converte por tick com a especificação COMPLETA', () => {
    // Não ocorre em produção (todo trade com stop tem `exit`), mas é onde nascia o
    // número fabricado: sem `tickerRule` o código antigo assumia 1 e seguia em frente.
    const semExit = tradeReal({ exit: null });
    expect(calculateTradeCompliance(semExit, plano).rrRatio).toBe(2.08); // (520/10)*5/125
    const semTick = tradeReal({ exit: null, tickerRule: null });
    expect(calculateTradeCompliance(semTick, plano).rrRatio).toBeNull();
    const tickIncompleto = tradeReal({ exit: null, tickerRule: { pointValue: null } });
    expect(calculateTradeCompliance(tickIncompleto, plano).rrRatio).toBeNull();
  });

  it('sem stop continua usando o RR assumido do plano (DEC-007), não a geometria', () => {
    const semStop = tradeReal({ stopLoss: null });
    const c = calculateTradeCompliance(semStop, plano);
    expect(c.rrAssumed).toBe(true);
    expect(c.rrRatio).toBe(2.06); // 520 / (30.000 × 0,84%) = 520/252
  });
});
