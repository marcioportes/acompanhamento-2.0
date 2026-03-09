/**
 * csvDirectionInference.test.js
 * @version 1.0.0 (v1.18.1)
 * @description Testes para inferência genérica de direção e parse de PnL.
 *
 * Cobre:
 * - inferDirection: heurística cronológica (LONG/SHORT/nulo)
 * - parseNumericValue: PnL com parênteses, $, formato BR/US
 * - buildTradeFromRow em modo inferência (sem side mapeado)
 * - Integração: dados reais do Performance.csv (Tradovate)
 */

import { describe, it, expect } from 'vitest';
import {
  inferDirection,
  parseNumericValue,
  buildTradeFromRow,
  applyMapping,
  REQUIRED_FIELDS_INFERRED,
} from '../../utils/csvMapper';

// ============================================
// inferDirection
// ============================================

describe('inferDirection', () => {
  it('buyTimestamp < sellTimestamp → LONG', () => {
    const r = inferDirection(24898.00, 24906.50, '2026-02-05T11:43:48', '2026-02-05T11:47:51');
    expect(r.side).toBe('LONG');
    expect(r.entry).toBe(24898.00);
    expect(r.exit).toBe(24906.50);
    expect(r.entryTime).toBe('2026-02-05T11:43:48');
    expect(r.exitTime).toBe('2026-02-05T11:47:51');
    expect(r.directionInferred).toBe(true);
  });

  it('sellTimestamp < buyTimestamp → SHORT', () => {
    const r = inferDirection(24850.25, 24803.75, '2026-02-04T14:54:40', '2026-02-04T14:49:05');
    expect(r.side).toBe('SHORT');
    expect(r.entry).toBe(24803.75); // sellPrice (vendeu primeiro)
    expect(r.exit).toBe(24850.25);  // buyPrice (comprou depois)
    expect(r.entryTime).toBe('2026-02-04T14:49:05'); // sellTimestamp
    expect(r.exitTime).toBe('2026-02-04T14:54:40');  // buyTimestamp
    expect(r.directionInferred).toBe(true);
  });

  it('timestamps iguais → side null', () => {
    const r = inferDirection(100, 105, '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    expect(r.side).toBeNull();
    expect(r.directionInferred).toBe(false);
  });

  it('buyPrice null → side null', () => {
    const r = inferDirection(null, 105, '2026-01-01T10:00:00', '2026-01-01T10:05:00');
    expect(r.side).toBeNull();
    expect(r.directionInferred).toBe(false);
  });

  it('timestamps inválidos → side null', () => {
    const r = inferDirection(100, 105, 'abc', '2026-01-01T10:05:00');
    expect(r.side).toBeNull();
    expect(r.directionInferred).toBe(false);
  });

  it('sem timestamps → side null', () => {
    const r = inferDirection(100, 105, null, null);
    expect(r.side).toBeNull();
    expect(r.directionInferred).toBe(false);
  });
});

// ============================================
// parseNumericValue
// ============================================

describe('parseNumericValue', () => {
  // Formato Tradovate PnL
  it('$(93.00) → -93.00 (negativo com parênteses e $)', () => {
    expect(parseNumericValue('$(93.00)')).toBe(-93.00);
  });

  it('$17.00 → 17.00 (positivo com $)', () => {
    expect(parseNumericValue('$17.00')).toBe(17.00);
  });

  it('$(122.00) → -122.00', () => {
    expect(parseNumericValue('$(122.00)')).toBe(-122.00);
  });

  it('$354.00 → 354.00', () => {
    expect(parseNumericValue('$354.00')).toBe(354.00);
  });

  it('$111.50 → 111.50', () => {
    expect(parseNumericValue('$111.50')).toBe(111.50);
  });

  // Formato BR
  it('1.234,56 → 1234.56 (BR)', () => {
    expect(parseNumericValue('1.234,56')).toBe(1234.56);
  });

  it('128.000,50 → 128000.50 (BR)', () => {
    expect(parseNumericValue('128.000,50')).toBe(128000.50);
  });

  it('200,00 → 200.00 (BR decimal)', () => {
    expect(parseNumericValue('200,00')).toBe(200.00);
  });

  // Formato US
  it('1,234.56 → 1234.56 (US)', () => {
    expect(parseNumericValue('1,234.56')).toBe(1234.56);
  });

  it('24850.25 → 24850.25 (simples)', () => {
    expect(parseNumericValue('24850.25')).toBe(24850.25);
  });

  // Parênteses sem $
  it('(93.00) → -93.00 (parênteses sem $)', () => {
    expect(parseNumericValue('(93.00)')).toBe(-93.00);
  });

  // Negativo com sinal
  it('-93.00 → -93.00', () => {
    expect(parseNumericValue('-93.00')).toBe(-93.00);
  });

  // R$
  it('R$ 1.234,56 → 1234.56', () => {
    expect(parseNumericValue('R$ 1.234,56')).toBe(1234.56);
  });

  // Edge cases
  it('null → null', () => {
    expect(parseNumericValue(null)).toBeNull();
  });

  it('string vazia → null', () => {
    expect(parseNumericValue('')).toBeNull();
  });

  it('texto inválido → null', () => {
    expect(parseNumericValue('abc')).toBeNull();
  });

  it('0 → 0', () => {
    expect(parseNumericValue('0')).toBe(0);
  });

  it('inteiro sem decimal → inteiro', () => {
    expect(parseNumericValue('128000')).toBe(128000);
  });
});

// ============================================
// buildTradeFromRow — modo inferência
// ============================================

describe('buildTradeFromRow (modo inferência)', () => {
  // Mapeamento estilo Tradovate Performance.csv — SEM side
  const inferenceMapping = {
    ticker: 'symbol',
    buyPrice: 'buyPrice',
    sellPrice: 'sellPrice',
    buyTimestamp: 'boughtTimestamp',
    sellTimestamp: 'soldTimestamp',
    qty: 'qty',
    result: 'pnl',
  };

  const tradovateRowLong = {
    'symbol': 'MNQH6',
    'buyPrice': '24898.00',
    'sellPrice': '24906.50',
    'boughtTimestamp': '02/05/2026 11:43:48',
    'soldTimestamp': '02/05/2026 11:47:51',
    'qty': '1',
    'pnl': '$17.00',
  };

  const tradovateRowShort = {
    'symbol': 'MNQH6',
    'buyPrice': '24850.25',
    'sellPrice': '24803.75',
    'boughtTimestamp': '02/04/2026 14:54:40',
    'soldTimestamp': '02/04/2026 14:49:05',
    'qty': '1',
    'pnl': '$(93.00)',
  };

  it('infere LONG quando buyTimestamp < sellTimestamp', () => {
    const { trade, errors } = buildTradeFromRow(tradovateRowLong, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(errors).toHaveLength(0);
    expect(trade.side).toBe('LONG');
    expect(trade.entry).toBe(24898.00);
    expect(trade.exit).toBe(24906.50);
    expect(trade.directionInferred).toBe(true);
    expect(trade.ticker).toBe('MNQH6');
    expect(trade.qty).toBe(1);
    expect(trade.result).toBe(17.00);
  });

  it('infere SHORT quando sellTimestamp < buyTimestamp', () => {
    const { trade, errors } = buildTradeFromRow(tradovateRowShort, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(errors).toHaveLength(0);
    expect(trade.side).toBe('SHORT');
    expect(trade.entry).toBe(24803.75); // sellPrice (vendeu primeiro)
    expect(trade.exit).toBe(24850.25);  // buyPrice (comprou depois)
    expect(trade.directionInferred).toBe(true);
    expect(trade.result).toBe(-93.00);
  });

  it('calcula entryTime e exitTime corretamente para LONG', () => {
    const { trade } = buildTradeFromRow(tradovateRowLong, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(trade.entryTime).toBe('2026-02-05T11:43:48'); // buyTimestamp (primeiro)
    expect(trade.exitTime).toBe('2026-02-05T11:47:51');  // sellTimestamp (segundo)
  });

  it('calcula entryTime e exitTime corretamente para SHORT', () => {
    const { trade } = buildTradeFromRow(tradovateRowShort, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(trade.entryTime).toBe('2026-02-04T14:49:05'); // sellTimestamp (primeiro)
    expect(trade.exitTime).toBe('2026-02-04T14:54:40');  // buyTimestamp (segundo)
  });

  it('remove buyPrice/sellPrice/buyTimestamp/sellTimestamp do trade final', () => {
    const { trade } = buildTradeFromRow(tradovateRowLong, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(trade.buyPrice).toBeUndefined();
    expect(trade.sellPrice).toBeUndefined();
    expect(trade.buyTimestamp).toBeUndefined();
    expect(trade.sellTimestamp).toBeUndefined();
  });

  it('aplica defaults (exchange) normalmente', () => {
    const { trade } = buildTradeFromRow(tradovateRowLong, inferenceMapping, {}, { exchange: 'CME' }, 'MM/DD/YYYY');
    expect(trade.exchange).toBe('CME');
  });

  it('com qty > 1 funciona', () => {
    const row = { ...tradovateRowLong, 'qty': '2' };
    const { trade, errors } = buildTradeFromRow(row, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(errors).toHaveLength(0);
    expect(trade.qty).toBe(2);
  });

  it('sem ticker dá erro', () => {
    const row = { ...tradovateRowLong, 'symbol': '' };
    const { errors } = buildTradeFromRow(row, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(errors.some(e => e.includes('obrigatório'))).toBe(true);
  });

  it('sem qty dá erro', () => {
    const row = { ...tradovateRowLong, 'qty': '' };
    const { errors } = buildTradeFromRow(row, inferenceMapping, {}, {}, 'MM/DD/YYYY');
    expect(errors.some(e => e.includes('obrigatório') || e.includes('Quantidade'))).toBe(true);
  });
});

// ============================================
// REQUIRED_FIELDS_INFERRED
// ============================================

describe('REQUIRED_FIELDS_INFERRED', () => {
  it('contém apenas ticker e qty', () => {
    expect(REQUIRED_FIELDS_INFERRED).toContain('ticker');
    expect(REQUIRED_FIELDS_INFERRED).toContain('qty');
    expect(REQUIRED_FIELDS_INFERRED).toHaveLength(2);
  });

  it('NÃO contém side (será inferido)', () => {
    expect(REQUIRED_FIELDS_INFERRED).not.toContain('side');
  });

  it('NÃO contém entryTime (será inferido)', () => {
    expect(REQUIRED_FIELDS_INFERRED).not.toContain('entryTime');
  });
});

// ============================================
// applyMapping — batch com inferência
// ============================================

describe('applyMapping (batch inferência)', () => {
  const template = {
    mapping: {
      ticker: 'symbol',
      buyPrice: 'buyPrice',
      sellPrice: 'sellPrice',
      buyTimestamp: 'boughtTimestamp',
      sellTimestamp: 'soldTimestamp',
      qty: 'qty',
      result: 'pnl',
    },
    valueMap: {},
    defaults: { exchange: 'CME' },
    dateFormat: 'MM/DD/YYYY',
  };

  it('processa batch misto LONG/SHORT corretamente', () => {
    const rows = [
      // LONG: buy primeiro
      { symbol: 'MNQH6', buyPrice: '24898.00', sellPrice: '24906.50', boughtTimestamp: '02/05/2026 11:43:48', soldTimestamp: '02/05/2026 11:47:51', qty: '1', pnl: '$17.00' },
      // SHORT: sell primeiro
      { symbol: 'MNQH6', buyPrice: '24850.25', sellPrice: '24803.75', boughtTimestamp: '02/04/2026 14:54:40', soldTimestamp: '02/04/2026 14:49:05', qty: '1', pnl: '$(93.00)' },
    ];

    const result = applyMapping(rows, template);
    expect(result.valid).toBe(2);
    expect(result.invalid).toBe(0);
    expect(result.trades[0].side).toBe('LONG');
    expect(result.trades[0].directionInferred).toBe(true);
    expect(result.trades[1].side).toBe('SHORT');
    expect(result.trades[1].directionInferred).toBe(true);
  });

  it('todas as 14 linhas do Performance.csv processam sem erro', () => {
    const rows = [
      { symbol: 'MNQH6', buyPrice: '24850.25', sellPrice: '24803.75', boughtTimestamp: '02/04/2026 14:54:40', soldTimestamp: '02/04/2026 14:49:05', qty: '1', pnl: '$(93.00)' },
      { symbol: 'MNQH6', buyPrice: '24898.00', sellPrice: '24906.50', boughtTimestamp: '02/05/2026 11:43:48', soldTimestamp: '02/05/2026 11:47:51', qty: '1', pnl: '$17.00' },
      { symbol: 'MNQH6', buyPrice: '24635.50', sellPrice: '24691.25', boughtTimestamp: '02/05/2026 12:11:39', soldTimestamp: '02/05/2026 12:02:11', qty: '1', pnl: '$111.50' },
      { symbol: 'MNQH6', buyPrice: '24558.25', sellPrice: '24712.50', boughtTimestamp: '02/05/2026 12:15:21', soldTimestamp: '02/05/2026 12:02:59', qty: '1', pnl: '$308.50' },
      { symbol: 'MNQH6', buyPrice: '25243.50', sellPrice: '25224.50', boughtTimestamp: '02/09/2026 12:21:46', soldTimestamp: '02/09/2026 12:22:15', qty: '1', pnl: '$(38.00)' },
      { symbol: 'MNQH6', buyPrice: '25218.75', sellPrice: '25248.25', boughtTimestamp: '02/09/2026 12:30:49', soldTimestamp: '02/09/2026 12:39:25', qty: '1', pnl: '$59.00' },
      { symbol: 'MNQH6', buyPrice: '25277.00', sellPrice: '25261.50', boughtTimestamp: '02/09/2026 12:45:48', soldTimestamp: '02/09/2026 12:47:23', qty: '1', pnl: '$(31.00)' },
      { symbol: 'MNQH6', buyPrice: '25291.50', sellPrice: '25316.00', boughtTimestamp: '02/09/2026 12:51:13', soldTimestamp: '02/09/2026 12:57:12', qty: '1', pnl: '$49.00' },
      { symbol: 'MNQH6', buyPrice: '25215.75', sellPrice: '25204.75', boughtTimestamp: '02/12/2026 12:18:39', soldTimestamp: '02/12/2026 12:19:56', qty: '1', pnl: '$(22.00)' },
      { symbol: 'MNQH6', buyPrice: '25233.50', sellPrice: '25204.75', boughtTimestamp: '02/12/2026 12:15:07', soldTimestamp: '02/12/2026 12:19:56', qty: '1', pnl: '$(57.50)' },
      { symbol: 'MNQH6', buyPrice: '25223.25', sellPrice: '25199.00', boughtTimestamp: '02/12/2026 12:21:01', soldTimestamp: '02/12/2026 12:21:56', qty: '1', pnl: '$(48.50)' },
      { symbol: 'MNQH6', buyPrice: '25231.75', sellPrice: '25199.00', boughtTimestamp: '02/12/2026 12:20:45', soldTimestamp: '02/12/2026 12:21:56', qty: '1', pnl: '$(65.50)' },
      { symbol: 'MNQH6', buyPrice: '25228.25', sellPrice: '25197.75', boughtTimestamp: '02/12/2026 12:25:58', soldTimestamp: '02/12/2026 12:22:01', qty: '2', pnl: '$(122.00)' },
      { symbol: 'MNQH6', buyPrice: '25095.00', sellPrice: '25183.50', boughtTimestamp: '02/12/2026 12:43:42', soldTimestamp: '02/12/2026 12:33:42', qty: '2', pnl: '$354.00' },
    ];

    const result = applyMapping(rows, template);
    expect(result.valid).toBe(14);
    expect(result.invalid).toBe(0);

    // Verificar direções específicas
    expect(result.trades[0].side).toBe('SHORT'); // linha 1: sell primeiro
    expect(result.trades[1].side).toBe('LONG');  // linha 2: buy primeiro
    expect(result.trades[2].side).toBe('SHORT'); // linha 3: sell primeiro
    expect(result.trades[3].side).toBe('SHORT'); // linha 4: sell primeiro

    // Todas têm flag de inferência
    result.trades.forEach(t => {
      expect(t.directionInferred).toBe(true);
    });
  });
});

// ============================================
// Retrocompatibilidade: modo padrão (com side) segue funcionando
// ============================================

describe('retrocompatibilidade — modo padrão com side mapeado', () => {
  const standardMapping = {
    ticker: 'Ativo',
    side: 'C/V',
    buyPrice: 'Preço Compra',
    sellPrice: 'Preço Venda',
    qty: 'Quantidade',
    entryTime: 'Data Entrada',
  };

  const standardValueMap = { side: { 'C': 'LONG', 'V': 'SHORT' } };

  it('LONG padrão continua funcionando', () => {
    const row = {
      'Ativo': 'WINFUT',
      'C/V': 'C',
      'Preço Compra': '128000',
      'Preço Venda': '128100',
      'Quantidade': '1',
      'Data Entrada': '03/03/2026 10:30:00',
    };
    const { trade, errors } = buildTradeFromRow(row, standardMapping, standardValueMap);
    expect(errors).toHaveLength(0);
    expect(trade.side).toBe('LONG');
    expect(trade.entry).toBe(128000);
    expect(trade.exit).toBe(128100);
    expect(trade.directionInferred).toBeUndefined();
  });

  it('SHORT padrão continua funcionando', () => {
    const row = {
      'Ativo': 'WINFUT',
      'C/V': 'V',
      'Preço Compra': '128000',
      'Preço Venda': '128100',
      'Quantidade': '1',
      'Data Entrada': '03/03/2026 10:30:00',
    };
    const { trade, errors } = buildTradeFromRow(row, standardMapping, standardValueMap);
    expect(errors).toHaveLength(0);
    expect(trade.side).toBe('SHORT');
    expect(trade.entry).toBe(128100);
    expect(trade.exit).toBe(128000);
  });
});
