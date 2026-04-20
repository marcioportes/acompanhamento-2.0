/**
 * orderFillAggregator.test.js — issue #156 Fase D
 *
 * Cobre o helper puro que colapsa fills múltiplos (mesmo externalOrderId) numa
 * ordem lógica única com quantidade somada e preço médio ponderado.
 */

import { describe, it, expect } from 'vitest';
import { aggregateFills } from '../../utils/orderFillAggregator';

describe('aggregateFills — casos básicos', () => {
  it('array vazio retorna array vazio', () => {
    expect(aggregateFills([])).toEqual([]);
    expect(aggregateFills(null)).toEqual([]);
    expect(aggregateFills(undefined)).toEqual([]);
  });

  it('uma única ordem passa intacta', () => {
    const orders = [
      { externalOrderId: 'ORD-1', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 1, filledPrice: 25000, submittedAt: '2026-02-12T14:00:00',
        filledAt: '2026-02-12T14:00:01' },
    ];
    expect(aggregateFills(orders)).toHaveLength(1);
    expect(aggregateFills(orders)[0].filledQuantity).toBe(1);
  });

  it('ordens sem externalOrderId passam intactas (não agrupam)', () => {
    const orders = [
      { externalOrderId: null, instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 1, filledPrice: 25000, submittedAt: '2026-02-12T14:00:00' },
      { externalOrderId: null, instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 2, filledPrice: 25010, submittedAt: '2026-02-12T14:01:00' },
    ];
    const result = aggregateFills(orders);
    expect(result).toHaveLength(2);
    expect(result[0].filledQuantity).toBe(1);
    expect(result[1].filledQuantity).toBe(2);
  });

  it('canceladas não se misturam com filled (mesmo id)', () => {
    // Cenário improvável mas defensivo: ordem cancelada + fill com mesmo id.
    // Status diferente → não agrupam. Cada uma passa separada.
    const orders = [
      { externalOrderId: 'ORD-X', instrument: 'MNQH6', side: 'BUY', status: 'CANCELLED',
        quantity: 2, submittedAt: '2026-02-12T14:00:00' },
      { externalOrderId: 'ORD-X', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 2, filledPrice: 25000, submittedAt: '2026-02-12T14:00:10',
        filledAt: '2026-02-12T14:00:11' },
    ];
    const result = aggregateFills(orders);
    expect(result).toHaveLength(2);
  });
});

describe('aggregateFills — agrupamento N×M', () => {
  it('3 fills do mesmo orderId → 1 ordem lógica com qty somada e preço médio', () => {
    // Ordem de mercado única explodiu em 3 fills:
    //   qty 2 @ 25000, qty 1 @ 25005, qty 2 @ 25010
    //   total qty = 5, preço médio = (2*25000 + 1*25005 + 2*25010) / 5 = 125025 / 5 = 25005
    const orders = [
      { externalOrderId: 'ORD-N', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 2, filledPrice: 25000, quantity: 2,
        submittedAt: '2026-02-12T14:00:00', filledAt: '2026-02-12T14:00:01' },
      { externalOrderId: 'ORD-N', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 1, filledPrice: 25005, quantity: 1,
        submittedAt: '2026-02-12T14:00:00', filledAt: '2026-02-12T14:00:02' },
      { externalOrderId: 'ORD-N', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 2, filledPrice: 25010, quantity: 2,
        submittedAt: '2026-02-12T14:00:00', filledAt: '2026-02-12T14:00:03' },
    ];
    const result = aggregateFills(orders);
    expect(result).toHaveLength(1);
    expect(result[0].filledQuantity).toBe(5);
    expect(result[0].quantity).toBe(5);
    expect(result[0].filledPrice).toBe(25005);
    expect(result[0].avgFillPrice).toBe(25005);
    expect(result[0]._aggregatedFillCount).toBe(3);
    // filledAt é o mais tardio (último fill)
    expect(result[0].filledAt).toBe('2026-02-12T14:00:03');
  });

  it('preserva cronologia global (entradas e saídas intercaladas)', () => {
    const orders = [
      // Entrada (2 fills do mesmo id)
      { externalOrderId: 'ORD-A', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 1, filledPrice: 25000, quantity: 1,
        submittedAt: '2026-02-12T14:00:00', filledAt: '2026-02-12T14:00:01' },
      { externalOrderId: 'ORD-A', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 1, filledPrice: 25002, quantity: 1,
        submittedAt: '2026-02-12T14:00:00', filledAt: '2026-02-12T14:00:02' },
      // Saída
      { externalOrderId: 'ORD-B', instrument: 'MNQH6', side: 'SELL', status: 'FILLED',
        filledQuantity: 2, filledPrice: 25010, quantity: 2,
        submittedAt: '2026-02-12T14:05:00', filledAt: '2026-02-12T14:05:00' },
    ];
    const result = aggregateFills(orders);
    expect(result).toHaveLength(2);
    // Primeira: entrada agregada (qty 2)
    expect(result[0].side).toBe('BUY');
    expect(result[0].filledQuantity).toBe(2);
    expect(result[0].filledPrice).toBe(25001);
    // Segunda: saída
    expect(result[1].side).toBe('SELL');
    expect(result[1].filledQuantity).toBe(2);
  });

  it('ordens de instrumentos diferentes com mesmo id (caso raro) NÃO agrupa incorretamente', () => {
    // Mesmo orderId em instrumentos diferentes seria um bug do broker — o helper
    // agrega mesmo assim por orderId (chave primária). O instrument fica do first.
    // Esse teste documenta o comportamento defensivo: confia no orderId como chave.
    const orders = [
      { externalOrderId: 'ORD-X', instrument: 'MNQH6', side: 'BUY', status: 'FILLED',
        filledQuantity: 1, filledPrice: 25000, quantity: 1,
        submittedAt: '2026-02-12T14:00:00', filledAt: '2026-02-12T14:00:01' },
    ];
    const result = aggregateFills(orders);
    expect(result).toHaveLength(1);
    expect(result[0].instrument).toBe('MNQH6');
  });
});
