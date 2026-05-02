/**
 * computeAvgExcursion.test.js — issue #235 F1.3 (ESM)
 *
 * Cobre 9 cenários (C1..C9) conforme critérios de aceitação no body do issue:
 *   C1 — janela vazia → insufficientReason 'no_trades'
 *   C2 — todos sem mepPrice/menPrice → insufficientReason 'no_excursion_data'
 *   C3 — LONG happy path: avgMEP=+2.0, avgMEN=-1.0, coverage=1.0
 *   C4 — SHORT happy path: sinais invertidos pela fórmula
 *   C5 — coverage abaixo do threshold (4/10 < 0.7) → label avisando
 *   C6 — mix LONG+SHORT no ciclo, médias agregadas corretamente
 *   C7 — side inválido ('BUY') pulado, não conta em tradesWithData
 *   C8 — entry=0 pulado (evita divisão por zero)
 *   C9 — excursionPctForTrade puro: LONG/SHORT/inválido/sem dado
 */

import { describe, it, expect } from 'vitest';
import {
  computeAvgExcursion,
  excursionPctForTrade,
} from '../../../utils/cycleConsistency/computeAvgExcursion.js';

describe('computeAvgExcursion (ESM)', () => {
  it('C1 — janela vazia retorna null com insufficientReason no_trades', () => {
    const result = computeAvgExcursion([], '2026-02-01', '2026-02-28');
    expect(result.avgMEP).toBeNull();
    expect(result.avgMEN).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.coverageBelowThreshold).toBe(false);
    expect(result.totalTrades).toBe(0);
    expect(result.tradesWithData).toBe(0);
    expect(result.insufficientReason).toBe('no_trades');
    expect(result.coverageLabel).toBeUndefined();
  });

  it('C2 — trades só com mepPrice/menPrice null retorna no_excursion_data', () => {
    const trades = [
      { date: '02/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: null, menPrice: null },
      { date: '03/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: null, menPrice: null },
      { date: '04/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: null, menPrice: null },
    ];
    const result = computeAvgExcursion(trades, '2026-02-01', '2026-02-28');
    expect(result.avgMEP).toBeNull();
    expect(result.avgMEN).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.totalTrades).toBe(3);
    expect(result.tradesWithData).toBe(0);
    expect(result.insufficientReason).toBe('no_excursion_data');
  });

  it('C3 — LONG happy path: 5 trades entry=100 mep=102 men=99 → +2.0% / -1.0% coverage 1.0', () => {
    const trades = Array.from({ length: 5 }, (_, i) => ({
      date: `0${i + 2}/02/2026`,
      status: 'CLOSED',
      side: 'LONG',
      entry: 100,
      mepPrice: 102,
      menPrice: 99,
    }));
    const result = computeAvgExcursion(trades, '2026-02-01', '2026-02-28');
    expect(result.avgMEP).toBeCloseTo(2.0, 10);
    expect(result.avgMEN).toBeCloseTo(-1.0, 10);
    expect(result.coverage).toBe(1.0);
    expect(result.coverageBelowThreshold).toBe(false);
    expect(result.coverageLabel).toBeUndefined();
    expect(result.totalTrades).toBe(5);
    expect(result.tradesWithData).toBe(5);
    expect(result.insufficientReason).toBeUndefined();
  });

  it('C4 — SHORT happy path: entry=100 mep=98 men=101 → +2.0% / -1.0% (sinais invertidos)', () => {
    const trades = Array.from({ length: 4 }, (_, i) => ({
      date: `0${i + 2}/02/2026`,
      status: 'CLOSED',
      side: 'SHORT',
      entry: 100,
      mepPrice: 98,
      menPrice: 101,
    }));
    const result = computeAvgExcursion(trades, '2026-02-01', '2026-02-28');
    expect(result.avgMEP).toBeCloseTo(2.0, 10);
    expect(result.avgMEN).toBeCloseTo(-1.0, 10);
    expect(result.coverage).toBe(1.0);
    expect(result.coverageBelowThreshold).toBe(false);
    expect(result.tradesWithData).toBe(4);
  });

  it('C5 — coverage 4/10 < 0.7 → coverageBelowThreshold true + label apropriado', () => {
    const withData = Array.from({ length: 4 }, (_, i) => ({
      date: `0${i + 2}/02/2026`,
      status: 'CLOSED',
      side: 'LONG',
      entry: 100,
      mepPrice: 102,
      menPrice: 99,
    }));
    const withoutData = Array.from({ length: 6 }, (_, i) => ({
      date: `${(i + 6).toString().padStart(2, '0')}/02/2026`,
      status: 'CLOSED',
      side: 'LONG',
      entry: 100,
      mepPrice: null,
      menPrice: null,
    }));
    const result = computeAvgExcursion([...withData, ...withoutData], '2026-02-01', '2026-02-28');
    expect(result.totalTrades).toBe(10);
    expect(result.tradesWithData).toBe(4);
    expect(result.coverage).toBeCloseTo(0.4, 10);
    expect(result.coverageBelowThreshold).toBe(true);
    expect(result.coverageLabel).toBe('⚠ MEP/MEN em 4 de 10 trades');
    expect(result.avgMEP).toBeCloseTo(2.0, 10);
    expect(result.avgMEN).toBeCloseTo(-1.0, 10);
  });

  it('C6 — mix LONG+SHORT no ciclo, médias agregadas corretamente', () => {
    // 2 LONG (entry=100, mep=104, men=98) → mepPct=+4, menPct=-2
    // 2 SHORT (entry=200, mep=196, men=202) → mepPct=+2, menPct=-1
    // avgMEP = mean([+4,+4,+2,+2]) = +3.0
    // avgMEN = mean([-2,-2,-1,-1]) = -1.5
    const trades = [
      { date: '02/02/2026', status: 'CLOSED', side: 'LONG',  entry: 100, mepPrice: 104, menPrice: 98 },
      { date: '03/02/2026', status: 'CLOSED', side: 'LONG',  entry: 100, mepPrice: 104, menPrice: 98 },
      { date: '04/02/2026', status: 'CLOSED', side: 'SHORT', entry: 200, mepPrice: 196, menPrice: 202 },
      { date: '05/02/2026', status: 'CLOSED', side: 'SHORT', entry: 200, mepPrice: 196, menPrice: 202 },
    ];
    const result = computeAvgExcursion(trades, '2026-02-01', '2026-02-28');
    expect(result.tradesWithData).toBe(4);
    expect(result.avgMEP).toBeCloseTo(3.0, 10);
    expect(result.avgMEN).toBeCloseTo(-1.5, 10);
    expect(result.coverage).toBe(1.0);
  });

  it('C7 — side inválido (BUY) é pulado, não conta em tradesWithData', () => {
    // 3 LONG válidos + 2 com side='BUY' (inválido).
    // totalTrades=5, tradesWithData=3, coverage=3/5=0.6 (< 0.7 → label).
    const trades = [
      { date: '02/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
      { date: '03/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
      { date: '04/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
      { date: '05/02/2026', status: 'CLOSED', side: 'BUY',  entry: 100, mepPrice: 102, menPrice: 99 },
      { date: '06/02/2026', status: 'CLOSED', side: 'BUY',  entry: 100, mepPrice: 102, menPrice: 99 },
    ];
    const result = computeAvgExcursion(trades, '2026-02-01', '2026-02-28');
    expect(result.totalTrades).toBe(5);
    expect(result.tradesWithData).toBe(3);
    expect(result.coverage).toBeCloseTo(0.6, 10);
    expect(result.coverageBelowThreshold).toBe(true);
    expect(result.coverageLabel).toBe('⚠ MEP/MEN em 3 de 5 trades');
    expect(result.avgMEP).toBeCloseTo(2.0, 10);
    expect(result.avgMEN).toBeCloseTo(-1.0, 10);
  });

  it('C8 — entry=0 (e entry inválido) é pulado para evitar divisão por zero', () => {
    const trades = [
      { date: '02/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
      { date: '03/02/2026', status: 'CLOSED', side: 'LONG', entry: 0,   mepPrice: 102, menPrice: 99 },
      { date: '04/02/2026', status: 'CLOSED', side: 'LONG', entry: -10, mepPrice: 102, menPrice: 99 },
      { date: '05/02/2026', status: 'CLOSED', side: 'LONG', entry: NaN, mepPrice: 102, menPrice: 99 },
    ];
    const result = computeAvgExcursion(trades, '2026-02-01', '2026-02-28');
    expect(result.totalTrades).toBe(4);
    expect(result.tradesWithData).toBe(1);
    expect(result.coverage).toBeCloseTo(0.25, 10);
    expect(result.avgMEP).toBeCloseTo(2.0, 10);
    expect(result.avgMEN).toBeCloseTo(-1.0, 10);
  });

  it('C9 — excursionPctForTrade puro: LONG, SHORT, inválido, sem dado', () => {
    // LONG válido
    expect(excursionPctForTrade({ side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 }))
      .toEqual({ mepPct: 2.0, menPct: -1.0 });
    // SHORT válido
    expect(excursionPctForTrade({ side: 'SHORT', entry: 100, mepPrice: 98, menPrice: 101 }))
      .toEqual({ mepPct: 2.0, menPct: -1.0 });
    // side inválido
    expect(excursionPctForTrade({ side: 'BUY', entry: 100, mepPrice: 102, menPrice: 99 })).toBeNull();
    expect(excursionPctForTrade({ side: undefined, entry: 100, mepPrice: 102, menPrice: 99 })).toBeNull();
    // mepPrice/menPrice ausentes
    expect(excursionPctForTrade({ side: 'LONG', entry: 100, mepPrice: null, menPrice: 99 })).toBeNull();
    expect(excursionPctForTrade({ side: 'LONG', entry: 100, mepPrice: 102, menPrice: undefined })).toBeNull();
    // entry inválido
    expect(excursionPctForTrade({ side: 'LONG', entry: 0, mepPrice: 102, menPrice: 99 })).toBeNull();
    expect(excursionPctForTrade({ side: 'LONG', entry: NaN, mepPrice: 102, menPrice: 99 })).toBeNull();
    // trade null
    expect(excursionPctForTrade(null)).toBeNull();
  });

  it('helper — filtra fora-janela e status != CLOSED', () => {
    const trades = [
      // dentro janela, CLOSED, com dado
      { date: '02/02/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
      // dentro janela, mas OPEN → ignorado
      { date: '03/02/2026', status: 'OPEN',   side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
      // fora janela (antes), CLOSED → ignorado
      { date: '01/01/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
      // fora janela (depois), CLOSED → ignorado
      { date: '01/03/2026', status: 'CLOSED', side: 'LONG', entry: 100, mepPrice: 102, menPrice: 99 },
    ];
    const result = computeAvgExcursion(trades, '2026-02-01', '2026-02-28');
    expect(result.totalTrades).toBe(1);
    expect(result.tradesWithData).toBe(1);
  });
});
