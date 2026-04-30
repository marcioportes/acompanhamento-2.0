/**
 * tradeGatewayExcursion.test.js — issue #187 Fase 1
 * @description validateExcursionPrices + normalização MEP/MEN no gateway.
 *
 * Cobre DEC-AUTO-187-01 (storage como preço) e validação por lado.
 * Testes do createTrade/enrichTrade com excursion vivem nos testes existentes
 * tradeGateway.test.js / tradeGatewayEnrich.test.js (não duplicar mocks pesados).
 */

import { describe, it, expect } from 'vitest';
import { validateExcursionPrices, EXCURSION_SOURCES } from '../../utils/tradeGateway';

describe('validateExcursionPrices — issue #187 DEC-AUTO-187-01', () => {
  describe('aceita ausência de dados', () => {
    it('aceita ambos null', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 110, mepPrice: null, menPrice: null,
      })).not.toThrow();
    });

    it('aceita ambos undefined', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 110,
      })).not.toThrow();
    });
  });

  describe('LONG — regra mepPrice >= max(entry,exit), menPrice <= min(entry,exit)', () => {
    it('valida winning LONG com MEP acima do exit', () => {
      // entry 100, exit 110, MEP 115 (pico acima de 110), MEN 95 (fundo abaixo de 100)
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 110, mepPrice: 115, menPrice: 95,
      })).not.toThrow();
    });

    it('valida losing LONG com MEP igual ao entry', () => {
      // entry 100, exit 95, MEP 100 (=max), MEN 90 (<min)
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 95, mepPrice: 100, menPrice: 90,
      })).not.toThrow();
    });

    it('rejeita MEP de LONG abaixo do max(entry,exit)', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 110, mepPrice: 105, menPrice: null,
      })).toThrow(/MEP de LONG \(105\).*>= max.*\(110\)/);
    });

    it('rejeita MEN de LONG acima do min(entry,exit)', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 110, mepPrice: null, menPrice: 102,
      })).toThrow(/MEN de LONG \(102\).*<= min.*\(100\)/);
    });

    it('valida só MEP quando MEN ausente', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 110, mepPrice: 115, menPrice: null,
      })).not.toThrow();
    });

    it('valida só MEN quando MEP ausente', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: 110, mepPrice: null, menPrice: 95,
      })).not.toThrow();
    });

    it('amostra real WINM26 trade 1 (CSV ProfitPro): entry 194235, exit 194105, MEP 194245, MEN 194055', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 194235, exit: 194105, mepPrice: 194245, menPrice: 194055,
      })).not.toThrow();
    });
  });

  describe('SHORT — regra mepPrice <= min(entry,exit), menPrice >= max(entry,exit)', () => {
    it('valida winning SHORT com MEP abaixo do exit', () => {
      // entry 100, exit 90 (lucro SHORT), MEP 85 (mínimo), MEN 105 (pior tick)
      expect(() => validateExcursionPrices({
        side: 'SHORT', entry: 100, exit: 90, mepPrice: 85, menPrice: 105,
      })).not.toThrow();
    });

    it('rejeita MEP de SHORT acima do min(entry,exit)', () => {
      expect(() => validateExcursionPrices({
        side: 'SHORT', entry: 100, exit: 90, mepPrice: 95, menPrice: null,
      })).toThrow(/MEP de SHORT \(95\).*<= min.*\(90\)/);
    });

    it('rejeita MEN de SHORT abaixo do max(entry,exit)', () => {
      expect(() => validateExcursionPrices({
        side: 'SHORT', entry: 100, exit: 90, mepPrice: null, menPrice: 98,
      })).toThrow(/MEN de SHORT \(98\).*>= max.*\(100\)/);
    });

    it('valida losing SHORT com MEN igual ao max', () => {
      // entry 100, exit 110 (perda SHORT), MEP 95 (foi favorável brevemente), MEN 110 (=max)
      expect(() => validateExcursionPrices({
        side: 'SHORT', entry: 100, exit: 110, mepPrice: 95, menPrice: 110,
      })).not.toThrow();
    });
  });

  describe('erros de input', () => {
    it('rejeita entry inválido', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 'foo', exit: 100, mepPrice: 105, menPrice: 95,
      })).toThrow(/entry e exit numéricos/);
    });

    it('rejeita exit inválido', () => {
      expect(() => validateExcursionPrices({
        side: 'LONG', entry: 100, exit: NaN, mepPrice: 105, menPrice: 95,
      })).toThrow(/entry e exit numéricos/);
    });

    it('rejeita side desconhecido', () => {
      expect(() => validateExcursionPrices({
        side: 'BOTH', entry: 100, exit: 110, mepPrice: 115, menPrice: 95,
      })).toThrow(/side desconhecido/);
    });

    it('NÃO valida side se mep/men forem ambos null mesmo com side inválido', () => {
      // Curto-circuito antes da validação de side — sem dado, sem necessidade.
      expect(() => validateExcursionPrices({
        side: 'BOGUS', entry: 100, exit: 110, mepPrice: null, menPrice: null,
      })).not.toThrow();
    });
  });

  describe('EXCURSION_SOURCES', () => {
    it('contém todas as 4 fontes válidas', () => {
      expect(EXCURSION_SOURCES).toEqual(['manual', 'profitpro', 'yahoo', 'unavailable']);
    });
  });
});
