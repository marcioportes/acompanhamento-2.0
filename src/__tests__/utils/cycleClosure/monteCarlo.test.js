/**
 * monteCarlo.test.js — issue #259 (1A)
 */

import { describe, it, expect } from 'vitest';
import {
  selectSamplePool,
  runMonteCarloBootstrap,
  projectNextCycle,
} from '../../../utils/cycleClosure/monteCarlo';

// RNG determinístico (mulberry32) pra testes reprodutíveis
function seedRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('selectSamplePool — regra Q8', () => {
  it('ciclo anterior com ≥30 trades → priorCycle', () => {
    const prior = Array.from({ length: 30 }, (_, i) => ({ result: i }));
    const all = Array.from({ length: 200 }, (_, i) => ({ result: i }));
    const r = selectSamplePool(prior, all);
    expect(r.source).toBe('priorCycle');
    expect(r.pool).toHaveLength(30);
  });

  it('ciclo anterior com <30 → fallback last100', () => {
    const prior = Array.from({ length: 18 }, (_, i) => ({ result: i }));
    const all = Array.from({ length: 200 }, (_, i) => ({ result: i }));
    const r = selectSamplePool(prior, all);
    expect(r.source).toBe('last100');
    expect(r.pool).toHaveLength(100);
  });

  it('all <100 → usa todos os disponíveis', () => {
    const prior = Array.from({ length: 5 }, () => ({ result: 1 }));
    const all = Array.from({ length: 40 }, () => ({ result: 1 }));
    const r = selectSamplePool(prior, all);
    expect(r.source).toBe('last100');
    expect(r.pool).toHaveLength(40);
  });

  it('vazio em ambos → empty', () => {
    expect(selectSamplePool([], []).source).toBe('empty');
  });
});

describe('runMonteCarloBootstrap', () => {
  it('pool vazio → reason=empty_pool', () => {
    const r = runMonteCarloBootstrap([], 18);
    expect(r.reason).toBe('empty_pool');
    expect(r.p50).toBeNull();
  });

  it('nPerSim inválido → reason=invalid_n_per_sim', () => {
    expect(runMonteCarloBootstrap([{ result: 1 }], 0).reason).toBe('invalid_n_per_sim');
    expect(runMonteCarloBootstrap([{ result: 1 }], -1).reason).toBe('invalid_n_per_sim');
    expect(runMonteCarloBootstrap([{ result: 1 }], 1.5).reason).toBe('invalid_n_per_sim');
  });

  it('pool homogêneo (todos +500): cada sim soma exatamente N×500', () => {
    const pool = Array.from({ length: 50 }, () => ({ result: 500 }));
    const r = runMonteCarloBootstrap(pool, 18, { nSims: 100 });
    expect(r.p10).toBe(9000);
    expect(r.p50).toBe(9000);
    expect(r.p90).toBe(9000);
    expect(r.mean).toBe(9000);
  });

  it('p10 ≤ p50 ≤ p90 e min ≤ p10, max ≥ p90', () => {
    const pool = Array.from({ length: 50 }, (_, i) => ({ result: i - 25 }));
    const r = runMonteCarloBootstrap(pool, 10, { nSims: 200, rng: seedRng(42) });
    expect(r.p10).toBeLessThanOrEqual(r.p50);
    expect(r.p50).toBeLessThanOrEqual(r.p90);
    expect(r.min).toBeLessThanOrEqual(r.p10);
    expect(r.max).toBeGreaterThanOrEqual(r.p90);
  });

  it('determinístico com RNG seedado', () => {
    const pool = Array.from({ length: 30 }, (_, i) => ({ result: (i % 5) - 2 }));
    const a = runMonteCarloBootstrap(pool, 10, { nSims: 50, rng: seedRng(12345) });
    const b = runMonteCarloBootstrap(pool, 10, { nSims: 50, rng: seedRng(12345) });
    expect(a.p50).toBe(b.p50);
    expect(a.p10).toBe(b.p10);
    expect(a.p90).toBe(b.p90);
  });

  it('nSims customizado é respeitado', () => {
    const pool = [{ result: 100 }];
    const r = runMonteCarloBootstrap(pool, 5, { nSims: 7 });
    expect(r.nSims).toBe(7);
  });
});

describe('projectNextCycle — convenience wrapper', () => {
  it('combina selectSamplePool + runMonteCarloBootstrap', () => {
    const prior = Array.from({ length: 30 }, () => ({ result: 100 }));
    const all = [];
    const r = projectNextCycle({
      priorCycleTrades: prior,
      allTrades: all,
      nPerSim: 5,
      options: { nSims: 50 },
    });
    expect(r.samplePool).toBe('priorCycle');
    expect(r.samplePoolSize).toBe(30);
    expect(r.p50).toBe(500);   // 5 × 100, todos iguais
  });
});
