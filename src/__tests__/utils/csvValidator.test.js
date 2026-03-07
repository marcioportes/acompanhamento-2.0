/**
 * csvValidator.test.js
 * @version 1.0.0 (v1.18.0)
 */

import { describe, it, expect } from 'vitest';
import { validateTrade, validateBatch, getIncompleteSummary } from '../../utils/csvValidator';

const validTrade = {
  ticker: 'WINFUT',
  side: 'LONG',
  entry: 128000,
  exit: 128100,
  qty: 1,
  entryTime: '2026-03-03T10:30:00',
};

describe('validateTrade', () => {
  it('trade válido passa', () => {
    const { valid, errors } = validateTrade(validTrade);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('trade null é inválido', () => {
    const { valid } = validateTrade(null);
    expect(valid).toBe(false);
  });

  it('sem ticker é inválido', () => {
    const { valid, errors } = validateTrade({ ...validTrade, ticker: '' });
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('Ticker'))).toBe(true);
  });

  it('side inválido é erro', () => {
    const { valid } = validateTrade({ ...validTrade, side: 'XYZ' });
    expect(valid).toBe(false);
  });

  it('entry negativo é erro', () => {
    const { valid } = validateTrade({ ...validTrade, entry: -100 });
    expect(valid).toBe(false);
  });

  it('qty zero é erro', () => {
    const { valid } = validateTrade({ ...validTrade, qty: 0 });
    expect(valid).toBe(false);
  });

  it('data futura gera warning (não erro)', () => {
    const future = { ...validTrade, entryTime: '2030-12-31T10:00:00' };
    const { valid, warnings } = validateTrade(future);
    expect(valid).toBe(true);
    expect(warnings.some(w => w.includes('futuro'))).toBe(true);
  });

  it('qty muito alta gera warning', () => {
    const { valid, warnings } = validateTrade({ ...validTrade, qty: 50000 });
    expect(valid).toBe(true);
    expect(warnings.some(w => w.includes('muito alta'))).toBe(true);
  });

  it('stop loss LONG acima do entry gera warning', () => {
    const { warnings } = validateTrade({ ...validTrade, stopLoss: 129000 });
    expect(warnings.some(w => w.includes('Stop loss acima'))).toBe(true);
  });

  it('stop loss SHORT abaixo do entry gera warning', () => {
    const { warnings } = validateTrade({ ...validTrade, side: 'SHORT', stopLoss: 127000 });
    expect(warnings.some(w => w.includes('Stop loss abaixo'))).toBe(true);
  });

  it('movimento extremo (>20%) gera warning', () => {
    const { warnings } = validateTrade({ ...validTrade, exit: 200000 });
    expect(warnings.some(w => w.includes('Movimento de'))).toBe(true);
  });
});

describe('validateBatch', () => {
  it('batch vazio retorna stats zerados', () => {
    const result = validateBatch([]);
    expect(result.stats.total).toBe(0);
  });

  it('separa válidos de inválidos', () => {
    const trades = [
      { ...validTrade, _rowIndex: 1 },
      { ticker: '', side: 'LONG', entry: 128000, exit: 128100, qty: 1, entryTime: '2026-03-03T10:30:00', _rowIndex: 2 },
      { ...validTrade, ticker: 'NQ', _rowIndex: 3 },
    ];
    const result = validateBatch(trades);
    expect(result.stats.valid).toBe(2);
    expect(result.stats.invalid).toBe(1);
    expect(result.invalidTrades[0]._rowIndex).toBe(2);
  });

  it('detecta duplicatas', () => {
    const trades = [
      { ...validTrade, _rowIndex: 1 },
      { ...validTrade, _rowIndex: 2 }, // mesma entryTime, ticker, side
    ];
    const result = validateBatch(trades);
    expect(result.validTrades[1]._warnings.some(w => w.includes('duplicata'))).toBe(true);
  });
});

describe('getIncompleteSummary', () => {
  it('conta campos faltantes', () => {
    const trades = [
      { ticker: 'WINFUT', stopLoss: 127900 },
      { ticker: 'WINFUT', emotionEntry: 'Focado' },
      { ticker: 'WINFUT' },
    ];
    const summary = getIncompleteSummary(trades);
    const emotionEntry = summary.find(s => s.field === 'emotionEntry');
    expect(emotionEntry.count).toBe(2);
    expect(emotionEntry.percent).toBe(67);
  });

  it('retorna vazio para array vazio', () => {
    expect(getIncompleteSummary([])).toEqual([]);
  });
});
