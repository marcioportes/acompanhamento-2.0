/**
 * symbolMapper.test.js — issue #187 Fase 4
 */

import { describe, it, expect } from 'vitest';
import { mapToYahoo, MAPPINGS } from '../../../../functions/marketData/symbolMapper';

describe('mapToYahoo', () => {
  it('mapeia micros CME', () => {
    expect(mapToYahoo('MNQH6')).toBe('MNQ=F');
    expect(mapToYahoo('MES')).toBe('MES=F');
    expect(mapToYahoo('MGCH6')).toBe('MGC=F');
    expect(mapToYahoo('MCLM6')).toBe('MCL=F');
    expect(mapToYahoo('MYM')).toBe('MYM=F');
    expect(mapToYahoo('M2K')).toBe('M2K=F');
  });

  it('mapeia cheios CME', () => {
    expect(mapToYahoo('NQH6')).toBe('NQ=F');
    expect(mapToYahoo('ESM6')).toBe('ES=F');
    expect(mapToYahoo('GCH6')).toBe('GC=F');
    expect(mapToYahoo('CL')).toBe('CL=F');
    expect(mapToYahoo('YM')).toBe('YM=F');
    expect(mapToYahoo('RTY')).toBe('RTY=F');
  });

  it('NÃO confunde MNQ com NQ (ordem importa)', () => {
    expect(mapToYahoo('MNQH6')).toBe('MNQ=F');
    expect(mapToYahoo('MNQ')).toBe('MNQ=F');
  });

  it('NÃO confunde MES com ES', () => {
    expect(mapToYahoo('MESM6')).toBe('MES=F');
    expect(mapToYahoo('ESM6')).toBe('ES=F');
  });

  it('case-insensitive', () => {
    expect(mapToYahoo('mnqh6')).toBe('MNQ=F');
    expect(mapToYahoo('  Es  ')).toBe('ES=F');
  });

  it('retorna null para BR futures (sem cobertura)', () => {
    expect(mapToYahoo('WINM26')).toBe(null);
    expect(mapToYahoo('WDOK26')).toBe(null);
    expect(mapToYahoo('INDV26')).toBe(null);
  });

  it('retorna null para equity', () => {
    expect(mapToYahoo('PETR4')).toBe(null);
    expect(mapToYahoo('AAPL')).toBe(null);
  });

  it('retorna null para input inválido', () => {
    expect(mapToYahoo(null)).toBe(null);
    expect(mapToYahoo('')).toBe(null);
    expect(mapToYahoo(undefined)).toBe(null);
    expect(mapToYahoo(42)).toBe(null);
  });

  it('MAPPINGS expõe lista completa', () => {
    expect(MAPPINGS.length).toBeGreaterThanOrEqual(12);
    expect(MAPPINGS.every((m) => m.prefix && m.yahoo.endsWith('=F'))).toBe(true);
  });
});
