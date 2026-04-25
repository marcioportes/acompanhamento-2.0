/**
 * Issue #189 — paridade do mirror CommonJS (functions/maturity/emotionalAnalysisMirror)
 * com o source ESM (src/utils/emotionalAnalysisV2).
 *
 * Cobre os 3 entry points consumidos pela engine de maturidade
 * (calculatePeriodScore, detectTiltV2, detectRevengeV2) em fixtures determinísticas
 * + cobertura local de buildGetEmotionConfig e computeEmotionalAnalysisShape.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePeriodScore as esmPeriodScore,
  detectTiltV2 as esmTilt,
  detectRevengeV2 as esmRevenge,
} from '../../../utils/emotionalAnalysisV2.js';
import {
  calculatePeriodScore as cjsPeriodScore,
  detectTiltV2 as cjsTilt,
  detectRevengeV2 as cjsRevenge,
  buildGetEmotionConfig,
  computeEmotionalAnalysisShape,
} from '../../../../functions/maturity/emotionalAnalysisMirror.js';

const EMOTIONS = [
  { id: 'e_calm',     name: 'Calmo',      score: 2,  analysisCategory: 'POSITIVE', behavioralPattern: 'OTHER' },
  { id: 'e_focus',    name: 'Focado',     score: 3,  analysisCategory: 'POSITIVE', behavioralPattern: 'OTHER' },
  { id: 'e_anxious',  name: 'Ansioso',    score: -2, analysisCategory: 'NEGATIVE', behavioralPattern: 'OTHER' },
  { id: 'e_fear',     name: 'Medo',       score: -3, analysisCategory: 'CRITICAL', behavioralPattern: 'OTHER' },
  { id: 'e_revenge',  name: 'Vingança',   score: -4, analysisCategory: 'CRITICAL', behavioralPattern: 'REVENGE' },
];

function makeGetEmotionConfig(emotions) {
  return (nameOrId) => {
    if (!nameOrId) {
      return { id: 'UNKNOWN', name: 'Não Informado', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER' };
    }
    const found = emotions.find((e) => e.name === nameOrId || e.id === nameOrId);
    if (found) {
      return {
        ...found,
        score: found.score ?? 0,
        analysisCategory: found.analysisCategory ?? 'NEUTRAL',
        behavioralPattern: found.behavioralPattern ?? 'OTHER',
      };
    }
    return { id: 'UNKNOWN', name: nameOrId, score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER' };
  };
}

const getCfg = makeGetEmotionConfig(EMOTIONS);

function trade({ id, emotionEntry, emotionExit, result, qty, date, entryTime, exitTime }) {
  return { id, emotionEntry, emotionExit, result, qty, date, entryTime, exitTime };
}

describe('emotionalAnalysisMirror — paridade ESM ↔ CommonJS', () => {
  it('calculatePeriodScore — trades positivos consistentes', () => {
    const trades = [
      trade({ id: 't1', emotionEntry: 'Calmo', emotionExit: 'Focado', result: 100, date: '2026-04-10' }),
      trade({ id: 't2', emotionEntry: 'Focado', emotionExit: 'Focado', result: 80,  date: '2026-04-11' }),
      trade({ id: 't3', emotionEntry: 'Calmo', emotionExit: 'Calmo',  result: 120, date: '2026-04-12' }),
    ];
    const a = esmPeriodScore(trades, getCfg);
    const b = cjsPeriodScore(trades, getCfg);
    expect(b.score).toBe(a.score);
    expect(b.normalized).toBe(a.normalized);
  });

  it('calculatePeriodScore — trades mistos com penalty TILT_DETECTED', () => {
    const trades = [
      trade({ id: 't1', emotionEntry: 'Ansioso', emotionExit: 'Medo',    result: -50, date: '2026-04-10' }),
      trade({ id: 't2', emotionEntry: 'Medo',    emotionExit: 'Ansioso', result: -30, date: '2026-04-11' }),
      trade({ id: 't3', emotionEntry: 'Calmo',   emotionExit: 'Focado',  result: 90,  date: '2026-04-12' }),
    ];
    const events = [{ type: 'TILT_DETECTED' }];
    const a = esmPeriodScore(trades, getCfg, events);
    const b = cjsPeriodScore(trades, getCfg, events);
    expect(b.score).toBe(a.score);
    expect(b.penalties).toBe(a.penalties);
  });

  it('calculatePeriodScore — array vazio retorna neutro 100', () => {
    expect(cjsPeriodScore([], getCfg)).toEqual(esmPeriodScore([], getCfg));
  });

  it('detectTiltV2 — sequência consecutiva NEGATIVE com loss em janela < 60min', () => {
    const trades = [
      trade({ id: 't1', emotionEntry: 'Ansioso', result: -50, date: '2026-04-10', exitTime: '2026-04-10T10:00:00Z', entryTime: '2026-04-10T10:00:00Z' }),
      trade({ id: 't2', emotionEntry: 'Medo',    result: -30, date: '2026-04-10', exitTime: '2026-04-10T10:30:00Z', entryTime: '2026-04-10T10:30:00Z' }),
      trade({ id: 't3', emotionEntry: 'Ansioso', result: -20, date: '2026-04-10', exitTime: '2026-04-10T11:00:00Z', entryTime: '2026-04-10T11:00:00Z' }),
    ];
    const a = esmTilt(trades, getCfg);
    const b = cjsTilt(trades, getCfg);
    expect(b.totalTiltTrades).toBe(a.totalTiltTrades);
    expect(b.detected).toBe(a.detected);
  });

  it('detectTiltV2 — não detecta quando emoção é POSITIVE', () => {
    const trades = [
      trade({ id: 't1', emotionEntry: 'Calmo', result: -50, date: '2026-04-10', exitTime: '2026-04-10T10:00:00Z' }),
      trade({ id: 't2', emotionEntry: 'Focado', result: -30, date: '2026-04-10', exitTime: '2026-04-10T10:30:00Z' }),
      trade({ id: 't3', emotionEntry: 'Calmo', result: -20, date: '2026-04-10', exitTime: '2026-04-10T11:00:00Z' }),
    ];
    expect(cjsTilt(trades, getCfg).totalTiltTrades).toBe(esmTilt(trades, getCfg).totalTiltTrades);
  });

  it('detectRevengeV2 — sequência rápida >= 3 trades em 15min após loss', () => {
    const trades = [
      trade({ id: 't0', emotionEntry: 'Calmo', result: -100, qty: 1, date: '2026-04-10', entryTime: '2026-04-10T10:00:00Z', exitTime: '2026-04-10T10:05:00Z' }),
      trade({ id: 't1', emotionEntry: 'Ansioso', result: 20, qty: 1, date: '2026-04-10', entryTime: '2026-04-10T10:08:00Z', exitTime: '2026-04-10T10:09:00Z' }),
      trade({ id: 't2', emotionEntry: 'Ansioso', result: 30, qty: 1, date: '2026-04-10', entryTime: '2026-04-10T10:12:00Z', exitTime: '2026-04-10T10:13:00Z' }),
      trade({ id: 't3', emotionEntry: 'Ansioso', result: 10, qty: 1, date: '2026-04-10', entryTime: '2026-04-10T10:15:00Z', exitTime: '2026-04-10T10:16:00Z' }),
    ];
    const a = esmRevenge(trades, getCfg);
    const b = cjsRevenge(trades, getCfg);
    expect(b.count).toBe(a.count);
    expect(b.detected).toBe(a.detected);
  });

  it('detectRevengeV2 — emoção REVENGE explícita', () => {
    const trades = [
      trade({ id: 't1', emotionEntry: 'Calmo', result: 50, qty: 1, date: '2026-04-10', entryTime: '2026-04-10T10:00:00Z' }),
      trade({ id: 't2', emotionEntry: 'Vingança', result: -20, qty: 1, date: '2026-04-10', entryTime: '2026-04-10T11:00:00Z' }),
    ];
    expect(cjsRevenge(trades, getCfg).count).toBe(esmRevenge(trades, getCfg).count);
  });

  it('detectRevengeV2 — sem trades suficientes não detecta', () => {
    expect(cjsRevenge([trade({ id: 't1', emotionEntry: 'Calmo', result: 0, qty: 1, date: '2026-04-10' })], getCfg).count)
      .toBe(esmRevenge([trade({ id: 't1', emotionEntry: 'Calmo', result: 0, qty: 1, date: '2026-04-10' })], getCfg).count);
  });
});

describe('emotionalAnalysisMirror — buildGetEmotionConfig', () => {
  it('retorna UNKNOWN para input null/undefined', () => {
    const fn = buildGetEmotionConfig(EMOTIONS);
    expect(fn(null).id).toBe('UNKNOWN');
    expect(fn(undefined).id).toBe('UNKNOWN');
  });

  it('encontra por name', () => {
    const fn = buildGetEmotionConfig(EMOTIONS);
    expect(fn('Calmo').id).toBe('e_calm');
    expect(fn('Calmo').score).toBe(2);
  });

  it('encontra por id', () => {
    const fn = buildGetEmotionConfig(EMOTIONS);
    expect(fn('e_focus').name).toBe('Focado');
  });

  it('retorna UNKNOWN com nameOrId quando não encontra', () => {
    const fn = buildGetEmotionConfig(EMOTIONS);
    const result = fn('Inexistente');
    expect(result.id).toBe('UNKNOWN');
    expect(result.name).toBe('Inexistente');
  });

  it('preenche defaults quando emotion vem incompleta do Firestore', () => {
    const fn = buildGetEmotionConfig([{ id: 'partial', name: 'Parcial' }]);
    const result = fn('Parcial');
    expect(result.score).toBe(0);
    expect(result.analysisCategory).toBe('NEUTRAL');
    expect(result.behavioralPattern).toBe('OTHER');
  });
});

describe('emotionalAnalysisMirror — computeEmotionalAnalysisShape', () => {
  it('trades vazios → fallback neutro { 50, 0, 0 } (D6)', () => {
    expect(computeEmotionalAnalysisShape({ trades: [], emotions: EMOTIONS }))
      .toEqual({ periodScore: 50, tiltCount: 0, revengeCount: 0 });
  });

  it('trades positivos → periodScore alto, sem tilt/revenge', () => {
    const trades = [
      trade({ id: 't1', emotionEntry: 'Calmo', emotionExit: 'Focado', result: 100, qty: 1, date: '2026-04-10', entryTime: '2026-04-10T10:00:00Z', exitTime: '2026-04-10T11:00:00Z' }),
      trade({ id: 't2', emotionEntry: 'Focado', emotionExit: 'Focado', result: 80,  qty: 1, date: '2026-04-11', entryTime: '2026-04-11T10:00:00Z', exitTime: '2026-04-11T11:00:00Z' }),
    ];
    const r = computeEmotionalAnalysisShape({ trades, emotions: EMOTIONS });
    expect(r.periodScore).toBeGreaterThan(60);
    expect(r.tiltCount).toBe(0);
    expect(r.revengeCount).toBe(0);
  });

  it('trades em tilt → tiltCount > 0, periodScore mais baixo', () => {
    const base = '2026-04-10';
    const trades = [
      trade({ id: 't1', emotionEntry: 'Ansioso', emotionExit: 'Medo', result: -50, qty: 1, date: base, entryTime: `${base}T10:00:00Z`, exitTime: `${base}T10:05:00Z` }),
      trade({ id: 't2', emotionEntry: 'Medo',    emotionExit: 'Medo', result: -30, qty: 1, date: base, entryTime: `${base}T10:10:00Z`, exitTime: `${base}T10:15:00Z` }),
      trade({ id: 't3', emotionEntry: 'Ansioso', emotionExit: 'Medo', result: -20, qty: 1, date: base, entryTime: `${base}T10:20:00Z`, exitTime: `${base}T10:25:00Z` }),
    ];
    const r = computeEmotionalAnalysisShape({ trades, emotions: EMOTIONS });
    expect(r.tiltCount).toBeGreaterThanOrEqual(3);
    expect(r.periodScore).toBeLessThan(50);
  });

  it('aceita getEmotionConfig pré-construído (testes/CF)', () => {
    const trades = [trade({ id: 't1', emotionEntry: 'Calmo', emotionExit: 'Calmo', result: 50, qty: 1, date: '2026-04-10' })];
    const r = computeEmotionalAnalysisShape({ trades, getEmotionConfig: getCfg });
    expect(r.periodScore).toBeGreaterThan(50);
    expect(r.tiltCount).toBe(0);
    expect(r.revengeCount).toBe(0);
  });
});
