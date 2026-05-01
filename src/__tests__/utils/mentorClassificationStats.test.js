/**
 * mentorClassificationStats.test.js — issue #219.
 */

import { describe, it, expect } from 'vitest';
import {
  computeMentorClassificationStats,
  computeLuckRateForSetup,
} from '../../utils/mentorClassificationStats';

const t = (classification, flags = [], extra = {}) => ({
  mentorClassification: classification,
  mentorClassificationFlags: flags,
  ...extra,
});

describe('computeMentorClassificationStats', () => {
  it('retorna nulls e flagsRanking zero para lista vazia', () => {
    const r = computeMentorClassificationStats([]);
    expect(r).toEqual({
      total: 0,
      classifiedExplicit: 0,
      tecnico: 0,
      sorte: 0,
      pctTecnico: null,
      pctSorte: null,
      flagsRanking: [
        { flag: 'narrativa', count: 0 },
        { flag: 'sizing', count: 0 },
        { flag: 'desvio_modelo', count: 0 },
        { flag: 'outro', count: 0 },
      ],
    });
  });

  it('null conta como técnico (default exception-based)', () => {
    const r = computeMentorClassificationStats([t(null), t(null), t(null)]);
    expect(r.total).toBe(3);
    expect(r.tecnico).toBe(3);
    expect(r.sorte).toBe(0);
    expect(r.classifiedExplicit).toBe(0);
    expect(r.pctTecnico).toBeCloseTo(100, 5);
    expect(r.pctSorte).toBeCloseTo(0, 5);
  });

  it('exemplo canônico 41/59 — mentor flagou só sorte', () => {
    // 100 trades total: 30 narrativa + 18 sizing + 8 desvio + 3 outro = 59 sorte
    // Os outros 41 são default técnico (null) — mentor não precisou marcar.
    const trades = [
      ...Array.from({ length: 41 }, () => t(null)),
      ...Array.from({ length: 30 }, () => t('sorte', ['narrativa'])),
      ...Array.from({ length: 18 }, () => t('sorte', ['sizing'])),
      ...Array.from({ length: 8 }, () => t('sorte', ['desvio_modelo'])),
      ...Array.from({ length: 3 }, () => t('sorte', ['outro'])),
    ];
    const r = computeMentorClassificationStats(trades);
    expect(r.total).toBe(100);
    expect(r.classifiedExplicit).toBe(59); // só os sorte são explícitos
    expect(r.tecnico).toBe(41); // os null contam como técnico
    expect(r.sorte).toBe(59);
    expect(r.pctTecnico).toBeCloseTo(41, 5);
    expect(r.pctSorte).toBeCloseTo(59, 5);
    expect(r.flagsRanking).toEqual([
      { flag: 'narrativa', count: 30 },
      { flag: 'sizing', count: 18 },
      { flag: 'desvio_modelo', count: 8 },
      { flag: 'outro', count: 3 },
    ]);
  });

  it('explícito tecnico e null são equivalentes para stats', () => {
    const r = computeMentorClassificationStats([
      t('tecnico'),
      t(null),
      t('sorte', ['narrativa']),
    ]);
    expect(r.tecnico).toBe(2);
    expect(r.sorte).toBe(1);
    expect(r.classifiedExplicit).toBe(2); // só tecnico+sorte explícitos
  });

  it('classificação inválida cai como técnico (default)', () => {
    const r = computeMentorClassificationStats([t('mecanico'), t('tecnico'), t('sorte')]);
    expect(r.tecnico).toBe(2); // mecanico (inválida) + tecnico
    expect(r.sorte).toBe(1);
  });

  it('flags só contam quando classification === sorte', () => {
    const r = computeMentorClassificationStats([
      t('tecnico', ['narrativa']),
      t('sorte', ['narrativa', 'sizing']),
    ]);
    const narrativa = r.flagsRanking.find((x) => x.flag === 'narrativa');
    const sizing = r.flagsRanking.find((x) => x.flag === 'sizing');
    expect(narrativa.count).toBe(1);
    expect(sizing.count).toBe(1);
  });

  it('input não-array retorna estrutura zerada', () => {
    const r = computeMentorClassificationStats(null);
    expect(r.total).toBe(0);
    expect(r.tecnico).toBe(0);
    expect(r.sorte).toBe(0);
  });
});

describe('computeLuckRateForSetup', () => {
  it('vazio retorna luckRate null', () => {
    const r = computeLuckRateForSetup([]);
    expect(r).toEqual({ total: 0, sorte: 0, luckRate: null });
  });

  it('zero sorte → luckRate 0', () => {
    const r = computeLuckRateForSetup([t(null), t(null)]);
    expect(r.total).toBe(2);
    expect(r.sorte).toBe(0);
    expect(r.luckRate).toBeCloseTo(0, 5);
  });

  it('8 sorte / 4 default técnico → luckRate 8/12', () => {
    const trades = [
      ...Array.from({ length: 8 }, () => t('sorte')),
      ...Array.from({ length: 4 }, () => t(null)),
    ];
    const r = computeLuckRateForSetup(trades);
    expect(r.total).toBe(12);
    expect(r.sorte).toBe(8);
    expect(r.luckRate).toBeCloseTo(8 / 12, 5);
  });
});
