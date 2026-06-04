/**
 * behavioralDetection — A1 caminho `events` (CHUNK-11 Fase 1, issue #301).
 *
 * Garante o dual-emit (preserva `type`, adiciona legacyCode + canonicalCode) e,
 * crucialmente, que filtrar os 2 campos extras devolve EXATAMENTE o array de
 * `detectExecutionEvents` de hoje → baseline #299 intacto (critério A4).
 *
 * Reusa as fixtures determinísticas do baseline (Fase 0) para amarrar os dois.
 */
import { describe, it, expect } from 'vitest';
import { detectBehavior, BEHAVIORAL_DETECTION_VERSION } from '../../utils/behavioralDetection';
import { detectExecutionEvents } from '../../utils/executionBehaviorEngine';
import { resolveCanonical } from '../../constants/behavioralTaxonomy';

// Mesmas fixtures do baseline.snapshot (stop tampering em T1 + reentrada rápida).
const TRADES = [
  { id: 'T1', side: 'LONG', qty: 1, entry: 5100, result: -50, emotionEntry: 'Ansioso',
    entryTime: '2026-04-22T10:00:00', exitTime: '2026-04-22T10:05:00' },
  { id: 'T2', side: 'LONG', qty: 2, entry: 5095, result: -40, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:08:00', exitTime: '2026-04-22T10:12:00' },
  { id: 'T3', side: 'LONG', qty: 4, entry: 5090, result: -30, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:14:00', exitTime: '2026-04-22T10:18:00' },
  { id: 'T4', side: 'SHORT', qty: 1, entry: 5080, result: 60, emotionEntry: 'Calmo',
    entryTime: '2026-04-22T11:30:00', exitTime: '2026-04-22T11:45:00' },
];
const ORDERS = [
  { externalOrderId: 'O1', instrument: 'ESH6', side: 'BUY', quantity: 1, status: 'FILLED',
    correlatedTradeId: 'T1', isStopOrder: false, filledAt: '2026-04-22T10:00:00',
    _ts: Date.parse('2026-04-22T10:00:00Z'), _price: 5100 },
  { externalOrderId: 'O2', instrument: 'ESH6', side: 'SELL', quantity: 1, status: 'FILLED',
    correlatedTradeId: 'T1', isStopOrder: true, stopPrice: 5090, filledAt: '2026-04-22T10:01:00',
    _ts: Date.parse('2026-04-22T10:01:00Z'), _price: 5090 },
  { externalOrderId: 'O3', instrument: 'ESH6', side: 'SELL', quantity: 1, status: 'FILLED',
    correlatedTradeId: 'T1', isStopOrder: true, stopPrice: 5080, filledAt: '2026-04-22T10:03:00',
    _ts: Date.parse('2026-04-22T10:03:00Z'), _price: 5080 },
];

const stripDualEmit = ({ legacyCode, canonicalCode, ...rest }) => rest;

describe('detectBehavior — A1 caminho events (dual-emit + baseline intacto)', () => {
  it('produz eventos para as fixtures (sanidade: não está vazio)', () => {
    const { events } = detectBehavior({ trades: TRADES, orders: ORDERS });
    expect(events.length).toBeGreaterThan(0);
  });

  it('filtrar legacyCode/canonicalCode devolve o array de detectExecutionEvents idêntico', () => {
    const { events } = detectBehavior({ trades: TRADES, orders: ORDERS });
    const baseline = detectExecutionEvents({ trades: TRADES, orders: ORDERS });
    expect(events.map(stripDualEmit)).toEqual(baseline);
  });

  it('cada evento tem legacyCode === type e canonicalCode === resolveCanonical(type)', () => {
    const { events } = detectBehavior({ trades: TRADES, orders: ORDERS });
    for (const e of events) {
      expect(e.legacyCode).toBe(e.type);
      expect(e.canonicalCode).toBe(resolveCanonical(e.type));
    }
  });

  it('entradas vazias → events vazio (sem crash)', () => {
    expect(detectBehavior({}).events).toEqual([]);
    expect(detectBehavior({ trades: [], orders: [] }).events).toEqual([]);
    expect(detectBehavior({ trades: TRADES, orders: [] }).events).toEqual([]);
  });

  it('meta declara versão e compatibilidade de baseline', () => {
    const { meta } = detectBehavior({ trades: TRADES, orders: ORDERS });
    expect(meta.version).toBe(BEHAVIORAL_DETECTION_VERSION);
    expect(meta.baselineCompatible).toBe(true);
  });
});
