/**
 * csvMapper.test.js
 * @version 1.1.0 (v1.18.0)
 * 
 * CHANGELOG:
 * - 1.1.0: getMissingFields — ajustado critério: emotionEntry+emotionExit+setup (stopLoss opcional)
 */

import { describe, it, expect } from 'vitest';
import {
  parseDateTime,
  applyValueMap,
  buildTradeFromRow,
  applyMapping,
  getMissingFields,
  REQUIRED_FIELDS,
} from '../../utils/csvMapper';

// ============================================
// parseDateTime
// ============================================

describe('parseDateTime', () => {
  it('parse formato BR: DD/MM/YYYY HH:mm:ss', () => {
    expect(parseDateTime('03/03/2026 10:30:00')).toBe('2026-03-03T10:30:00');
  });

  it('parse formato BR: DD/MM/YYYY HH:mm (sem segundos)', () => {
    expect(parseDateTime('03/03/2026 10:30')).toBe('2026-03-03T10:30:00');
  });

  it('parse formato BR: DD/MM/YYYY (sem hora)', () => {
    expect(parseDateTime('03/03/2026')).toBe('2026-03-03T12:00:00');
  });

  it('parse formato ISO já pronto', () => {
    expect(parseDateTime('2026-03-03T10:30:00')).toBe('2026-03-03T10:30:00');
  });

  it('parse formato ISO com espaço', () => {
    expect(parseDateTime('2026-03-03 10:30:00')).toBe('2026-03-03T10:30:00');
  });

  it('parse formato ISO date só', () => {
    expect(parseDateTime('2026-03-03')).toBe('2026-03-03T12:00:00');
  });

  it('parse com separador ponto', () => {
    expect(parseDateTime('03.03.2026 10:30')).toBe('2026-03-03T10:30:00');
  });

  it('parse com separador hífen', () => {
    expect(parseDateTime('03-03-2026 10:30')).toBe('2026-03-03T10:30:00');
  });

  it('retorna null para vazio', () => {
    expect(parseDateTime('')).toBeNull();
    expect(parseDateTime(null)).toBeNull();
    expect(parseDateTime(undefined)).toBeNull();
  });

  it('retorna null para formato não reconhecido', () => {
    expect(parseDateTime('abc')).toBeNull();
    expect(parseDateTime('13-2026-03')).toBeNull();
  });

  it('parse US format quando hint é MM/DD', () => {
    expect(parseDateTime('03/15/2026 10:30', 'MM/DD/YYYY')).toBe('2026-03-15T10:30:00');
  });

  it('lida com dia/mês single digit', () => {
    expect(parseDateTime('3/3/2026 9:05')).toBe('2026-03-03T09:05:00');
  });
});

// ============================================
// applyValueMap
// ============================================

describe('applyValueMap', () => {
  const sideMap = { 'C': 'LONG', 'V': 'SHORT', 'Compra': 'LONG', 'Venda': 'SHORT' };

  it('mapeia C → LONG', () => {
    expect(applyValueMap('C', sideMap)).toBe('LONG');
  });

  it('mapeia V → SHORT', () => {
    expect(applyValueMap('V', sideMap)).toBe('SHORT');
  });

  it('case insensitive', () => {
    expect(applyValueMap('c', sideMap)).toBe('LONG');
    expect(applyValueMap('compra', sideMap)).toBe('LONG');
  });

  it('retorna valor original se não tem map', () => {
    expect(applyValueMap('LONG', sideMap)).toBe('LONG');
  });

  it('retorna valor se map é null', () => {
    expect(applyValueMap('C', null)).toBe('C');
  });
});

// ============================================
// buildTradeFromRow
// ============================================

describe('buildTradeFromRow', () => {
  const mapping = {
    ticker: 'Ativo',
    side: 'C/V',
    buyPrice: 'Preço Compra',
    sellPrice: 'Preço Venda',
    qty: 'Quantidade',
    entryTime: 'Data Entrada',
    exitTime: 'Data Saída',
    result: 'Resultado',
    stopLoss: 'Stop',
  };

  const valueMap = { side: { 'C': 'LONG', 'V': 'SHORT' } };

  const validRow = {
    'Ativo': 'WINFUT',
    'C/V': 'C',
    'Preço Compra': '128000',
    'Preço Venda': '128100',
    'Quantidade': '1',
    'Data Entrada': '03/03/2026 10:30:00',
    'Data Saída': '03/03/2026 10:45:00',
    'Resultado': '200',
    'Stop': '127900',
  };

  it('LONG: entry=buyPrice, exit=sellPrice', () => {
    const { trade, errors } = buildTradeFromRow(validRow, mapping, valueMap);
    expect(errors).toHaveLength(0);
    expect(trade.ticker).toBe('WINFUT');
    expect(trade.side).toBe('LONG');
    expect(trade.entry).toBe(128000);
    expect(trade.exit).toBe(128100);
    expect(trade.qty).toBe(1);
    expect(trade.buyPrice).toBeUndefined(); // cleaned up
    expect(trade.sellPrice).toBeUndefined();
  });

  it('SHORT: entry=sellPrice, exit=buyPrice', () => {
    const row = { ...validRow, 'C/V': 'V' };
    const { trade, errors } = buildTradeFromRow(row, mapping, valueMap);
    expect(errors).toHaveLength(0);
    expect(trade.side).toBe('SHORT');
    expect(trade.entry).toBe(128100); // sellPrice
    expect(trade.exit).toBe(128000);  // buyPrice
  });

  it('entry/exit direto também funciona (retrocompatibilidade)', () => {
    const directMapping = {
      ticker: 'Ativo',
      side: 'C/V',
      entry: 'Preço Compra',
      exit: 'Preço Venda',
      qty: 'Quantidade',
      entryTime: 'Data Entrada',
    };
    const { trade, errors } = buildTradeFromRow(validRow, directMapping, valueMap);
    expect(errors).toHaveLength(0);
    expect(trade.entry).toBe(128000);
    expect(trade.exit).toBe(128100);
  });

  it('aplica valueMap no side', () => {
    const { trade } = buildTradeFromRow(validRow, mapping, valueMap);
    expect(trade.side).toBe('LONG');
  });

  it('normaliza ticker para uppercase', () => {
    const row = { ...validRow, 'Ativo': 'winfut' };
    const { trade } = buildTradeFromRow(row, mapping, valueMap);
    expect(trade.ticker).toBe('WINFUT');
  });

  it('parse número com formatação BR', () => {
    const row = { ...validRow, 'Preço Compra': '128.000,50' };
    const { trade } = buildTradeFromRow(row, mapping, valueMap);
    expect(trade.entry).toBe(128000.50);
  });

  it('reporta erro para campo obrigatório faltante', () => {
    const row = { ...validRow, 'Ativo': '' };
    const { errors } = buildTradeFromRow(row, mapping, valueMap);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('obrigatório');
  });

  it('reporta erro sem preço nenhum mapeado', () => {
    const noPrice = { ticker: 'Ativo', side: 'C/V', qty: 'Quantidade', entryTime: 'Data Entrada' };
    const row = { 'Ativo': 'WINFUT', 'C/V': 'C', 'Quantidade': '1', 'Data Entrada': '03/03/2026 10:30' };
    const { errors } = buildTradeFromRow(row, noPrice, valueMap);
    expect(errors.some(e => e.includes('Preço de entrada'))).toBe(true);
  });

  it('usa defaults quando coluna não mapeada', () => {
    const { trade } = buildTradeFromRow(validRow, mapping, valueMap, { exchange: 'B3' });
    expect(trade.exchange).toBe('B3');
  });

  it('campo opcional vazio não gera erro', () => {
    const row = { ...validRow, 'Stop': '', 'Data Saída': '' };
    const { trade, errors } = buildTradeFromRow(row, mapping, valueMap);
    expect(errors).toHaveLength(0);
    expect(trade.stopLoss).toBeUndefined();
  });
});

// ============================================
// applyMapping (batch)
// ============================================

describe('applyMapping', () => {
  const template = {
    mapping: {
      ticker: 'Ativo',
      side: 'C/V',
      buyPrice: 'Preço Compra',
      sellPrice: 'Preço Venda',
      qty: 'Quantidade',
      entryTime: 'Data',
    },
    valueMap: { side: { 'C': 'LONG', 'V': 'SHORT' } },
    defaults: { exchange: 'B3' },
    dateFormat: '',
  };

  it('mapeia batch com linhas válidas e inválidas', () => {
    const rows = [
      { 'Ativo': 'WINFUT', 'C/V': 'C', 'Preço Compra': '128000', 'Preço Venda': '128100', 'Quantidade': '1', 'Data': '03/03/2026 10:30' },
      { 'Ativo': '', 'C/V': 'V', 'Preço Compra': '128200', 'Preço Venda': '128100', 'Quantidade': '2', 'Data': '03/03/2026 11:00' },
      { 'Ativo': 'WINFUT', 'C/V': 'V', 'Preço Compra': '128200', 'Preço Venda': '128100', 'Quantidade': '2', 'Data': '03/03/2026 11:00' },
    ];
    const result = applyMapping(rows, template);
    expect(result.valid).toBe(2);
    expect(result.invalid).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
  });

  it('marca _rowIndex em cada trade', () => {
    const rows = [
      { 'Ativo': 'WINFUT', 'C/V': 'C', 'Preço Compra': '128000', 'Preço Venda': '128100', 'Quantidade': '1', 'Data': '03/03/2026 10:30' },
    ];
    const result = applyMapping(rows, template);
    expect(result.trades[0]._rowIndex).toBe(1);
    expect(result.trades[0]._hasErrors).toBe(false);
  });

  it('resolve entry/exit baseado no side LONG', () => {
    const rows = [
      { 'Ativo': 'WINFUT', 'C/V': 'C', 'Preço Compra': '128000', 'Preço Venda': '128100', 'Quantidade': '1', 'Data': '03/03/2026 10:30' },
    ];
    const result = applyMapping(rows, template);
    expect(result.trades[0].entry).toBe(128000);
    expect(result.trades[0].exit).toBe(128100);
  });

  it('resolve entry/exit baseado no side SHORT', () => {
    const rows = [
      { 'Ativo': 'WINFUT', 'C/V': 'V', 'Preço Compra': '128000', 'Preço Venda': '128100', 'Quantidade': '1', 'Data': '03/03/2026 10:30' },
    ];
    const result = applyMapping(rows, template);
    expect(result.trades[0].entry).toBe(128100); // sellPrice
    expect(result.trades[0].exit).toBe(128000);  // buyPrice
  });
});

// ============================================
// getMissingFields — ATUALIZADO v1.1.0
// Critério: emotionEntry + emotionExit + setup (stopLoss opcional)
// ============================================

describe('getMissingFields', () => {
  it('trade do CSV sem emoções e setup retorna os 3 campos', () => {
    const trade = { ticker: 'WINFUT', side: 'LONG', entry: 128000, exit: 128100, qty: 1, entryTime: '2026-03-03T10:30:00' };
    const missing = getMissingFields(trade);
    expect(missing).toContain('emotionEntry');
    expect(missing).toContain('emotionExit');
    expect(missing).toContain('setup');
    expect(missing).toHaveLength(3);
  });

  it('stopLoss NÃO é obrigatório — não aparece na lista', () => {
    const trade = { ticker: 'WINFUT', side: 'LONG', entry: 128000, exit: 128100, qty: 1, entryTime: '2026-03-03T10:30:00' };
    const missing = getMissingFields(trade);
    expect(missing).not.toContain('stopLoss');
  });

  it('htfUrl/ltfUrl NÃO são obrigatórios — não aparecem na lista', () => {
    const trade = { ticker: 'WINFUT', side: 'LONG', entry: 128000, exit: 128100, qty: 1, entryTime: '2026-03-03T10:30:00' };
    const missing = getMissingFields(trade);
    expect(missing).not.toContain('htfUrl');
    expect(missing).not.toContain('ltfUrl');
  });

  it('trade completo retorna lista vazia', () => {
    const trade = {
      ticker: 'WINFUT', side: 'LONG', entry: 128000, exit: 128100, qty: 1,
      entryTime: '2026-03-03T10:30:00',
      emotionEntry: 'Focado', emotionExit: 'Calmo', setup: 'Rompimento',
    };
    const missing = getMissingFields(trade);
    expect(missing).toHaveLength(0);
  });

  it('com apenas emotionEntry preenchido, falta emotionExit e setup', () => {
    const trade = {
      ticker: 'WINFUT', side: 'LONG', entry: 128000, exit: 128100, qty: 1,
      entryTime: '2026-03-03T10:30:00',
      emotionEntry: 'Focado',
    };
    const missing = getMissingFields(trade);
    expect(missing).toContain('emotionExit');
    expect(missing).toContain('setup');
    expect(missing).not.toContain('emotionEntry');
    expect(missing).toHaveLength(2);
  });
});

// ============================================
// REQUIRED_FIELDS
// ============================================

describe('REQUIRED_FIELDS', () => {
  it('contém os 4 campos obrigatórios core', () => {
    expect(REQUIRED_FIELDS).toContain('ticker');
    expect(REQUIRED_FIELDS).toContain('side');
    expect(REQUIRED_FIELDS).toContain('qty');
    expect(REQUIRED_FIELDS).toContain('entryTime');
    expect(REQUIRED_FIELDS).toHaveLength(4);
  });
});
