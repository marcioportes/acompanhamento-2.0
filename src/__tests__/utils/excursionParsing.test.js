/**
 * excursionParsing.test.js — issue #187 Fase 3
 * @description Conversão MEP/MEN brutos (pontos/% — ProfitPro) → preço.
 * Cobre amostra real do CSV WINM26 fornecida pelo Marcio + casos de equity + SHORT.
 */

import { describe, it, expect } from 'vitest';
import {
  detectInstrumentType,
  convertExcursionRawToPrice,
  FUTURES_PREFIXES,
} from '../../utils/excursionParsing';

describe('detectInstrumentType', () => {
  it('classifica futures B3', () => {
    expect(detectInstrumentType('WINM26')).toBe('futures');
    expect(detectInstrumentType('WDOK26')).toBe('futures');
    expect(detectInstrumentType('INDV26')).toBe('futures');
    expect(detectInstrumentType('DOLN26')).toBe('futures');
    expect(detectInstrumentType('BITM26')).toBe('futures');
  });

  it('classifica futures CME', () => {
    expect(detectInstrumentType('MNQH6')).toBe('futures');
    expect(detectInstrumentType('NQH6')).toBe('futures');
    expect(detectInstrumentType('ESH6')).toBe('futures');
    expect(detectInstrumentType('MES')).toBe('futures');
    expect(detectInstrumentType('MGCH6')).toBe('futures');
  });

  it('classifica equity (default)', () => {
    expect(detectInstrumentType('PETR4')).toBe('equity');
    expect(detectInstrumentType('VALE3')).toBe('equity');
    expect(detectInstrumentType('BBAS3')).toBe('equity');
    expect(detectInstrumentType('AAPL')).toBe('equity');
    expect(detectInstrumentType('TSLA')).toBe('equity');
  });

  it('aceita lowercase', () => {
    expect(detectInstrumentType('winm26')).toBe('futures');
    expect(detectInstrumentType('petr4')).toBe('equity');
  });

  it('lida com input vazio/inválido', () => {
    expect(detectInstrumentType('')).toBe('equity');
    expect(detectInstrumentType(null)).toBe('equity');
    expect(detectInstrumentType(undefined)).toBe('equity');
  });

  it('FUTURES_PREFIXES tem prefixos micro antes dos cheios (ordem importa)', () => {
    const idxMNQ = FUTURES_PREFIXES.indexOf('MNQ');
    const idxNQ = FUTURES_PREFIXES.indexOf('NQ');
    expect(idxMNQ).toBeLessThan(idxNQ);
    const idxMES = FUTURES_PREFIXES.indexOf('MES');
    const idxES = FUTURES_PREFIXES.indexOf('ES');
    expect(idxMES).toBeLessThan(idxES);
  });
});

describe('convertExcursionRawToPrice — futures (pontos)', () => {
  it('amostra real WINM26 trade 1 (ProfitPro CSV): LONG, entry 194235, MEP 10, MEN -180', () => {
    const result = convertExcursionRawToPrice({
      entry: 194235, side: 'LONG', mepRaw: 10, menRaw: -180, instrumentType: 'futures',
    });
    expect(result.mepPrice).toBe(194245);
    expect(result.menPrice).toBe(194055);
  });

  it('amostra real WINM26 trade 2: LONG, entry 194125, MEP 445, MEN -50', () => {
    const result = convertExcursionRawToPrice({
      entry: 194125, side: 'LONG', mepRaw: 445, menRaw: -50, instrumentType: 'futures',
    });
    expect(result.mepPrice).toBe(194570);
    expect(result.menPrice).toBe(194075);
  });

  it('LONG com sinais já corretos (MEP+/MEN-)', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: 5, menRaw: -3, instrumentType: 'futures',
    });
    expect(result.mepPrice).toBe(105);
    expect(result.menPrice).toBe(97);
  });

  it('SHORT inverte direção: MEP é favorável (preço caiu) → abaixo do entry', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'SHORT', mepRaw: 5, menRaw: 3, instrumentType: 'futures',
    });
    expect(result.mepPrice).toBe(95);  // entry - 5
    expect(result.menPrice).toBe(103); // entry + 3
  });

  it('robusto a sinais arbitrários no input (usa Math.abs)', () => {
    // ProfitPro às vezes envia MEP positivo, MEN negativo; mas se vier diferente, ainda funciona.
    const result1 = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: -5, menRaw: 3, instrumentType: 'futures',
    });
    const result2 = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: 5, menRaw: -3, instrumentType: 'futures',
    });
    expect(result1).toEqual(result2);
  });

  it('retorna null para campos ausentes', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: null, menRaw: null, instrumentType: 'futures',
    });
    expect(result).toEqual({ mepPrice: null, menPrice: null });
  });

  it('processa só MEP quando MEN ausente', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: 5, menRaw: null, instrumentType: 'futures',
    });
    expect(result.mepPrice).toBe(105);
    expect(result.menPrice).toBe(null);
  });
});

describe('convertExcursionRawToPrice — equity (%)', () => {
  it('LONG ação com MEP 5%, MEN -2%', () => {
    // entry 100, MEP 5% → 105; MEN 2% → 98
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: 5, menRaw: -2, instrumentType: 'equity',
    });
    expect(result.mepPrice).toBe(105);
    expect(result.menPrice).toBe(98);
  });

  it('SHORT ação inverte: MEP 3% favorável (caiu 3%)', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'SHORT', mepRaw: 3, menRaw: 2, instrumentType: 'equity',
    });
    expect(result.mepPrice).toBe(97);  // 100 × (1 - 0.03)
    expect(result.menPrice).toBe(102); // 100 × (1 + 0.02)
  });
});

describe('convertExcursionRawToPrice — guards', () => {
  it('side inválido retorna null', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'BOTH', mepRaw: 5, menRaw: 3, instrumentType: 'futures',
    });
    expect(result).toEqual({ mepPrice: null, menPrice: null });
  });

  it('entry inválido retorna null', () => {
    const result = convertExcursionRawToPrice({
      entry: 'foo', side: 'LONG', mepRaw: 5, menRaw: 3, instrumentType: 'futures',
    });
    expect(result).toEqual({ mepPrice: null, menPrice: null });
  });

  it('MEP/MEN string numérica é aceita', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: '5', menRaw: '-3', instrumentType: 'futures',
    });
    expect(result.mepPrice).toBe(105);
    expect(result.menPrice).toBe(97);
  });

  it('MEP/MEN não-numéricos viram null', () => {
    const result = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: 'abc', menRaw: 'xyz', instrumentType: 'futures',
    });
    expect(result).toEqual({ mepPrice: null, menPrice: null });
  });
});

describe('Integração: validação cruzada com regras LONG/SHORT', () => {
  // Garante que o output dessa conversão é COMPATÍVEL com validateExcursionPrices
  // (LONG: mep >= max(entry,exit), men <= min(entry,exit); SHORT: invertido).
  it('LONG winning: mepPrice acima do exit, menPrice abaixo do entry', () => {
    // entry 100, exit 110 (winning LONG), MEP 15 (peak 115), MEN -3 (trough 97)
    const { mepPrice, menPrice } = convertExcursionRawToPrice({
      entry: 100, side: 'LONG', mepRaw: 15, menRaw: -3, instrumentType: 'futures',
    });
    const exit = 110;
    const max = Math.max(100, exit);
    const min = Math.min(100, exit);
    expect(mepPrice).toBeGreaterThanOrEqual(max);
    expect(menPrice).toBeLessThanOrEqual(min);
  });

  it('SHORT winning: mepPrice abaixo do exit, menPrice acima do entry', () => {
    // entry 100, exit 90 (winning SHORT), MEP 12 (trough 88), MEN 3 (peak 103)
    const { mepPrice, menPrice } = convertExcursionRawToPrice({
      entry: 100, side: 'SHORT', mepRaw: 12, menRaw: 3, instrumentType: 'futures',
    });
    const exit = 90;
    const max = Math.max(100, exit);
    const min = Math.min(100, exit);
    expect(mepPrice).toBeLessThanOrEqual(min);
    expect(menPrice).toBeGreaterThanOrEqual(max);
  });
});
