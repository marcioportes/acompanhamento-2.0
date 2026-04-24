import { describe, it, expect, beforeEach } from 'vitest';
import { computeOperational } from '../../../utils/maturityEngine/computeOperational';
import { makeTrade, makeTradeSeries, resetFixtureCounter } from '../../../utils/maturityEngine/fixtures';

describe('computeOperational', () => {
  beforeEach(() => {
    resetFixtureCounter();
  });

  it('janela vazia → score neutro 50, LOW, neutralFallback empty-window', () => {
    const out = computeOperational({ trades: [], plans: [], complianceRate: 95 });
    expect(out.score).toBe(50);
    expect(out.confidence).toBe('LOW');
    expect(out.neutralFallback).toBe('operational:empty-window');
    expect(out.breakdown).toEqual({
      complianceRate: 50,
      stratScore: 50,
      jScore: 50,
      planAdherence: 50,
    });
  });

  it('60 trades + tudo ótimo (compliance=95, emotionEntry todos, planId todos, 12 semanas mesmo setup) → score ≈ 98', () => {
    // startDate '2026-01-05' (Monday) → 60 weekdays = 12 semanas com 5 trades/semana,
    // todos com setup='rompimento' → cada semana 5/5=100% rompimento (>60%) → run=12 → stratScore=100
    // jScore=100 (default emotionEntry='neutro' → truthy)
    // planAdherence=100 (default planId='plan-default')
    // complianceRate=95
    // O = 0.40·95 + 0.20·100 + 0.20·100 + 0.20·100 = 38 + 60 = 98
    const trades = makeTradeSeries({ count: 60, startDate: '2026-01-05' });
    const out = computeOperational({ trades, plans: [], complianceRate: 95 });
    expect(out.breakdown.complianceRate).toBe(95);
    expect(out.breakdown.stratScore).toBe(100);
    expect(out.breakdown.jScore).toBe(100);
    expect(out.breakdown.planAdherence).toBe(100);
    expect(out.score).toBeCloseTo(98, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBeNull();
  });

  it('40 trades, compliance=50, zero journal, zero planId, sem run de setup → score baixo', () => {
    // setup único por trade → nenhuma semana tem dominante > 60% → strategyConsWks=0
    // notes='' + emotionEntry=null/'' → hasJournal=false → jScore=0
    // planId=null → planAdherence=0
    // complianceRate=50, stratScore = norm(0, 0, 12) = 0
    // O = 0.40·50 + 0 + 0 + 0 = 20
    const trades = makeTradeSeries({
      count: 40,
      startDate: '2026-01-05',
      setup: (i) => `setup-${i}`,
      notes: '',
      emotionEntry: '',
      planId: null,
    });
    const out = computeOperational({ trades, plans: [], complianceRate: 50 });
    expect(out.breakdown.complianceRate).toBe(50);
    expect(out.breakdown.stratScore).toBe(0);
    expect(out.breakdown.jScore).toBe(0);
    expect(out.breakdown.planAdherence).toBe(0);
    expect(out.score).toBeCloseTo(20, 6);
    expect(out.confidence).toBe('HIGH');
    expect(out.neutralFallback).toBeNull();
  });

  it('complianceRate undefined → neutralFallback flag + componente neutro 50', () => {
    // 40 trades from Mon 2026-01-05 → 8 full weeks de 'rompimento' (default) → run=8
    // stratScore = norm(8,0,12)*100 = 66.666... → componente 0.20·66.67 ≈ 13.33
    // jScore=100, planAdherence=100, complianceRate componente=50
    // O = 0.40·50 + 13.33 + 0.20·100 + 0.20·100 = 20 + 13.33 + 40 = 73.33
    const trades = makeTradeSeries({ count: 40, startDate: '2026-01-05' });
    const out = computeOperational({ trades, plans: [] });
    expect(out.breakdown.complianceRate).toBe(50);
    expect(out.neutralFallback).toBe('operational:compliance');
    expect(out.breakdown.stratScore).toBeCloseTo((8 / 12) * 100, 6);
    expect(out.score).toBeCloseTo(20 + (8 / 12) * 100 * 0.20 + 20 + 20, 4);
  });

  it('plans=[] não gera neutralFallback (strategyConsistency depende só de trades)', () => {
    const trades = makeTradeSeries({ count: 10, setup: (i) => `unique-${i}` });
    const out = computeOperational({ trades, plans: [], complianceRate: 70 });
    expect(out.neutralFallback).toBeNull();
    expect(out.breakdown.stratScore).toBe(0);
  });

  it('hasJournal: ramo notes ≥10 chars (sem emotionEntry) e ramo emotionEntry (sem notes)', () => {
    // Mix de 10 trades: 4 com notes≥10 sem emotionEntry, 6 com emotionEntry sem notes.
    // Todos têm jornalização → jScore=100.
    const tradesNotes = Array.from({ length: 4 }, (_, i) =>
      makeTrade({
        date: `2026-01-${String(5 + i).padStart(2, '0')}`,
        notes: 'reflexao detalhada do trade',
        emotionEntry: '',
      })
    );
    const tradesEmotion = Array.from({ length: 6 }, (_, i) =>
      makeTrade({
        date: `2026-01-${String(12 + i).padStart(2, '0')}`,
        notes: '',
        emotionEntry: 'ansioso',
      })
    );
    const trades = [...tradesNotes, ...tradesEmotion];
    const out = computeOperational({ trades, plans: [], complianceRate: 80 });
    expect(out.breakdown.jScore).toBe(100);

    // Variante negativa: notes <10 chars e emotionEntry vazio → hasJournal=false
    const noJournalTrades = Array.from({ length: 5 }, (_, i) =>
      makeTrade({
        date: `2026-02-${String(2 + i).padStart(2, '0')}`,
        notes: 'curto',
        emotionEntry: '',
      })
    );
    const out2 = computeOperational({ trades: noJournalTrades, plans: [], complianceRate: 80 });
    expect(out2.breakdown.jScore).toBe(0);
  });

  it('N = 10 trades → confidence MED', () => {
    const trades = makeTradeSeries({ count: 10 });
    const out = computeOperational({ trades, plans: [], complianceRate: 80 });
    expect(out.confidence).toBe('MED');
  });

  it('N = 3 trades → confidence LOW (entre empty-window e MED)', () => {
    const trades = makeTradeSeries({ count: 3 });
    const out = computeOperational({ trades, plans: [], complianceRate: 80 });
    expect(out.confidence).toBe('LOW');
    expect(out.neutralFallback).toBeNull();
  });
});
