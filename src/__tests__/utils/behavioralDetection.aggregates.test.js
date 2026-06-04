/**
 * behavioralDetection — A2 byTrade + aggregates (CHUNK-11 Fase 1, issue #301).
 *
 * Valida: enriquecimento dos patterns shadow (canonicalCode + family), dedupe por
 * (tradeId, family) com colapso (no máx. 1 entrada por par), scoreInputs guardado
 * por getEmotionConfig, e gateInputs ⊆ GATE_CODES detectados.
 */
import { describe, it, expect } from 'vitest';
import { detectBehavior, dedupeByFamily } from '../../utils/behavioralDetection';
import { getPattern, GATE_CODES } from '../../constants/behavioralTaxonomy';

const EMOTIONS = [
  { name: 'Calmo', score: 2, analysisCategory: 'POSITIVE', behavioralPattern: 'OTHER' },
  { name: 'Ansioso', score: -2, analysisCategory: 'NEGATIVE', behavioralPattern: 'ANXIETY' },
  { name: 'Revanche', score: -3, analysisCategory: 'CRITICAL', behavioralPattern: 'REVENGE' },
];
const getEmotionConfig = (name) =>
  EMOTIONS.find((e) => e.name === name) ||
  { name: name || 'Desconhecida', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER' };

// Fixtures do baseline + studentId/date para o shadow montar adjacência.
const TRADES = [
  { id: 'T1', studentId: 'S1', date: '2026-04-22', side: 'LONG', qty: 1, entry: 5100, result: -50, emotionEntry: 'Ansioso',
    entryTime: '2026-04-22T10:00:00', exitTime: '2026-04-22T10:05:00' },
  { id: 'T2', studentId: 'S1', date: '2026-04-22', side: 'LONG', qty: 2, entry: 5095, result: -40, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:08:00', exitTime: '2026-04-22T10:12:00' },
  { id: 'T3', studentId: 'S1', date: '2026-04-22', side: 'LONG', qty: 4, entry: 5090, result: -30, emotionEntry: 'Revanche',
    entryTime: '2026-04-22T10:14:00', exitTime: '2026-04-22T10:18:00' },
  { id: 'T4', studentId: 'S1', date: '2026-04-22', side: 'SHORT', qty: 1, entry: 5080, result: 60, emotionEntry: 'Calmo',
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

describe('detectBehavior — A2 byTrade', () => {
  it('byTrade é Map e cada pattern é enriquecido com canonicalCode + family', () => {
    const { byTrade } = detectBehavior({ trades: TRADES, orders: ORDERS });
    expect(byTrade).toBeInstanceOf(Map);
    let inspected = 0;
    for (const [, shadow] of byTrade) {
      for (const p of shadow.patterns) {
        expect(p).toHaveProperty('canonicalCode');
        expect(p).toHaveProperty('family');
        if (p.canonicalCode) {
          // family registrada bate com a taxonomia do código canônico.
          expect(p.family).toBe(getPattern(p.canonicalCode).family);
          inspected += 1;
        }
      }
    }
    expect(inspected).toBeGreaterThan(0); // fixtures disparam ao menos 1 pattern
  });

  it('shadow original preservado (resolution/version) além dos campos extras', () => {
    const { byTrade } = detectBehavior({ trades: TRADES, orders: ORDERS });
    for (const [, shadow] of byTrade) {
      expect(shadow).toHaveProperty('resolution');
      expect(shadow).toHaveProperty('version');
    }
  });
});

describe('detectBehavior — A2 aggregates.byFamily (dedupe / colapso)', () => {
  it('no máximo 1 entrada por (tradeId, family) — famílias não contam 2x', () => {
    const { aggregates } = detectBehavior({ trades: TRADES, orders: ORDERS });
    for (const [family, entries] of aggregates.byFamily) {
      const seen = new Set();
      for (const e of entries) {
        const key = `${e.tradeId}|${family}`;
        expect(seen.has(key)).toBe(false); // colapso garantido
        seen.add(key);
        expect(e.family ?? family).toBe(family);
        expect(['events', 'shadow']).toContain(e.source);
      }
    }
  });

  it('toda família detectada existe na taxonomia', () => {
    const { aggregates } = detectBehavior({ trades: TRADES, orders: ORDERS });
    for (const [, entries] of aggregates.byFamily) {
      for (const e of entries) {
        expect(getPattern(e.canonicalCode)).toBeTruthy();
      }
    }
  });
});

describe('detectBehavior — A2 aggregates.gateInputs', () => {
  it('gateInputs ⊆ GATE_CODES e cada um é uma família detectada', () => {
    const { aggregates } = detectBehavior({ trades: TRADES, orders: ORDERS });
    const families = new Set(aggregates.byFamily.keys());
    for (const code of aggregates.gateInputs) {
      expect(GATE_CODES).toContain(code);
      expect(families.has(code)).toBe(true); // gate cruza por família, não por código
    }
  });

  it('fold emocional: tilt/revenge detectados entram em gateInputs (sinal unificado)', () => {
    // Fixtures disparam tilt+revenge via execução; com getEmotionConfig viram gate.
    const { aggregates } = detectBehavior({ trades: TRADES, orders: ORDERS, getEmotionConfig });
    expect(aggregates.scoreInputs.tilt.detected).toBe(true);
    expect(aggregates.gateInputs).toContain('TILT');
    expect(aggregates.gateInputs).toContain('LOSS_CHASING');
  });

  it('sem getEmotionConfig: TILT não pode entrar (sem motor emocional)', () => {
    const { aggregates } = detectBehavior({ trades: TRADES, orders: ORDERS });
    expect(aggregates.gateInputs).not.toContain('TILT');
  });
});

describe('detectBehavior — A2 aggregates.scoreInputs', () => {
  it('null sem getEmotionConfig (não inventa config emocional)', () => {
    const { aggregates } = detectBehavior({ trades: TRADES, orders: ORDERS });
    expect(aggregates.scoreInputs).toBeNull();
  });

  it('populado com getEmotionConfig: periodScore + tilt + revenge', () => {
    const { aggregates } = detectBehavior({ trades: TRADES, orders: ORDERS, getEmotionConfig });
    expect(aggregates.scoreInputs).not.toBeNull();
    expect(typeof aggregates.scoreInputs.periodScore.score).toBe('number');
    expect(typeof aggregates.scoreInputs.tilt.detected).toBe('boolean');
    expect(typeof aggregates.scoreInputs.revenge.detected).toBe('boolean');
  });
});

describe('dedupeByFamily — colapso + precedência DEC-074 (determinístico)', () => {
  const det = (tradeId, family, source, resolutionLayer, canonicalCode = family) =>
    ({ tradeId, family, source, resolutionLayer, canonicalCode });

  it('mesma (tradeId, family) por events+shadow colapsa em 1 entrada', () => {
    const { byFamily } = dedupeByFamily([
      det('T1', 'STOP_PANIC', 'events', 'HIGH'),
      det('T1', 'STOP_PANIC', 'shadow', 'HIGH'),
    ]);
    expect(byFamily.get('STOP_PANIC')).toHaveLength(1);
  });

  it('empate de resolução → vence fonte events', () => {
    const { byFamily } = dedupeByFamily([
      det('T1', 'STOP_PANIC', 'shadow', 'HIGH'),
      det('T1', 'STOP_PANIC', 'events', 'HIGH'),
    ]);
    expect(byFamily.get('STOP_PANIC')[0].source).toBe('events');
  });

  it('maior resolução vence mesmo contra fonte events (ordens>parciais>sequência)', () => {
    const { byFamily } = dedupeByFamily([
      det('T1', 'LOSS_CHASING', 'events', 'LOW'),
      det('T1', 'LOSS_CHASING', 'shadow', 'HIGH'),
    ]);
    const winner = byFamily.get('LOSS_CHASING')[0];
    expect(winner.source).toBe('shadow');
    expect(winner.resolutionLayer).toBe('HIGH');
  });

  it('mesma família em trades diferentes NÃO colapsa', () => {
    const { byFamily } = dedupeByFamily([
      det('T1', 'OVERTRADING', 'shadow', 'LOW'),
      det('T2', 'OVERTRADING', 'shadow', 'LOW'),
    ]);
    expect(byFamily.get('OVERTRADING')).toHaveLength(2);
  });

  it('gateInputs inclui só GATE_CODES detectados (filtra não-gate)', () => {
    // STOP_PANIC feedsGates=true; GREED_CLUSTER feedsGates=false.
    expect(getPattern('STOP_PANIC').feedsGates).toBe(true);
    expect(getPattern('GREED_CLUSTER').feedsGates).toBe(false);
    const { gateInputs } = dedupeByFamily([
      det('T1', 'STOP_PANIC', 'events', 'HIGH'),
      det('T1', 'GREED_CLUSTER', 'shadow', 'LOW'),
    ]);
    expect(gateInputs).toContain('STOP_PANIC');
    expect(gateInputs).not.toContain('GREED_CLUSTER');
  });

  it('gate cruza por FAMÍLIA: membro não-gate (IMPULSE_CLUSTER) aciona família gate (OVERTRADING)', () => {
    // IMPULSE_CLUSTER.feedsGates=false, mas sua família OVERTRADING é gate.
    expect(getPattern('IMPULSE_CLUSTER').feedsGates).toBe(false);
    expect(getPattern('IMPULSE_CLUSTER').family).toBe('OVERTRADING');
    expect(getPattern('OVERTRADING').feedsGates).toBe(true);
    // detecção carrega canonicalCode do membro, family da cabeça.
    const { gateInputs } = dedupeByFamily([
      { tradeId: 'T2', family: 'OVERTRADING', canonicalCode: 'IMPULSE_CLUSTER', source: 'shadow', resolutionLayer: 'LOW' },
    ]);
    expect(gateInputs).toContain('OVERTRADING');
  });
});

describe('detectBehavior — A2 casos limites', () => {
  it('sem trades → byTrade/byFamily/gateInputs vazios, scoreInputs null', () => {
    const r = detectBehavior({});
    expect(r.byTrade.size).toBe(0);
    expect(r.aggregates.byFamily.size).toBe(0);
    expect(r.aggregates.gateInputs).toEqual([]);
    expect(r.aggregates.scoreInputs).toBeNull();
  });
});
