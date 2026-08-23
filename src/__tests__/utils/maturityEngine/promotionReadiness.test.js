/**
 * #376 — prontidão para promoção.
 *
 * Antes desta issue NADA promovia ninguém: o motor gravava `proposedTransition: UP`
 * e o estágio só mudava se o assessment mudasse. E o fechamento de ciclo comparava o
 * objeto `proposedTransition` com a string `'PROMOTE'` — `false` por construção.
 * Estes testes fixam a regra que os dois lados (front e servidor) usam.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { isReadyForPromotion, nextStageOf } from '../../../utils/maturityEngine/promotionReadiness';

const require = createRequire(import.meta.url);
const espelho = require('../../../../functions/maturity/promotionReadiness.js');

const pronto = {
  currentStage: 2,
  gatesMet: 9,
  gatesTotal: 9,
  proposedTransition: { proposed: 'UP', nextStage: 3, blockers: [] },
};

describe('isReadyForPromotion', () => {
  it('todos os gates + proposta UP + sem bloqueio → pronto', () => {
    expect(isReadyForPromotion(pronto)).toBe(true);
    expect(nextStageOf(pronto)).toBe(3);
  });

  it('um gate faltando → não pronto', () => {
    expect(isReadyForPromotion({ ...pronto, gatesMet: 8 })).toBe(false);
    expect(nextStageOf({ ...pronto, gatesMet: 8 })).toBeNull();
  });

  it('bloqueio presente → não pronto, mesmo com todos os gates', () => {
    const comBloqueio = { ...pronto, proposedTransition: { ...pronto.proposedTransition, blockers: ['regressão'] } };
    expect(isReadyForPromotion(comBloqueio)).toBe(false);
  });

  it('proposta que não é UP → não pronto', () => {
    for (const proposed of ['STAY', 'DOWN_DETECTED']) {
      expect(isReadyForPromotion({ ...pronto, proposedTransition: { ...pronto.proposedTransition, proposed } })).toBe(false);
    }
  });

  it('sem gates definidos → não pronto (0 de 0 não é mérito)', () => {
    expect(isReadyForPromotion({ ...pronto, gatesMet: 0, gatesTotal: 0 })).toBe(false);
  });

  it('maturidade ausente → não pronto, sem lançar', () => {
    expect(isReadyForPromotion(null)).toBe(false);
    expect(isReadyForPromotion(undefined)).toBe(false);
    expect(nextStageOf(null)).toBeNull();
  });

  it('a string PROMOTE nunca foi produzida pelo motor — o bug do Step5Check', () => {
    // Documenta a comparação que era feita: objeto === 'PROMOTE' jamais é verdadeiro.
    expect(pronto.proposedTransition === 'PROMOTE').toBe(false);
    expect(isReadyForPromotion(pronto)).toBe(true);
  });

  it('front e servidor concordam em todos os cenários', () => {
    const casos = [
      pronto,
      { ...pronto, gatesMet: 8 },
      { ...pronto, proposedTransition: { ...pronto.proposedTransition, blockers: ['x'] } },
      { ...pronto, proposedTransition: { ...pronto.proposedTransition, proposed: 'STAY' } },
      null,
    ];
    for (const c of casos) {
      expect(espelho.isReadyForPromotion(c)).toBe(isReadyForPromotion(c));
      expect(espelho.nextStageOf(c)).toBe(nextStageOf(c));
    }
  });
});
