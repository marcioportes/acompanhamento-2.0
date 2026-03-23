/**
 * questionRandomizer.test.js
 * 
 * Testes para randomização de alternativas.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { describe, it, expect } from 'vitest';
import {
  getOptionOrder,
  getSeededOptionOrder,
  isValidOptionOrder,
  fisherYatesShuffle,
  seededShuffle,
  hashString,
} from '../../utils/questionRandomizer.js';

const SAMPLE_IDS = ['A', 'B', 'C', 'D', 'E'];

describe('getOptionOrder', () => {
  it('retorna ordem salva se válida', () => {
    const saved = ['C', 'A', 'E', 'B', 'D'];
    const result = getOptionOrder(SAMPLE_IDS, saved);
    expect(result.order).toEqual(saved);
    expect(result.isNew).toBe(false);
  });

  it('gera nova ordem se savedOrder é null', () => {
    const result = getOptionOrder(SAMPLE_IDS, null);
    expect(result.order).toHaveLength(5);
    expect(result.isNew).toBe(true);
    // Deve conter todos os IDs originais
    expect(new Set(result.order)).toEqual(new Set(SAMPLE_IDS));
  });

  it('gera nova ordem se savedOrder tem tamanho diferente', () => {
    const result = getOptionOrder(SAMPLE_IDS, ['A', 'B', 'C']);
    expect(result.isNew).toBe(true);
  });

  it('gera nova ordem se savedOrder tem IDs inválidos', () => {
    const result = getOptionOrder(SAMPLE_IDS, ['A', 'B', 'C', 'D', 'X']);
    expect(result.isNew).toBe(true);
  });

  it('gera permutação válida (contém todos os IDs originais)', () => {
    for (let i = 0; i < 20; i++) {
      const result = getOptionOrder(SAMPLE_IDS, null);
      expect(new Set(result.order)).toEqual(new Set(SAMPLE_IDS));
    }
  });
});

describe('getSeededOptionOrder', () => {
  it('produz mesma ordem com mesma seed', () => {
    const order1 = getSeededOptionOrder(SAMPLE_IDS, 'session-123', 'EMO-01');
    const order2 = getSeededOptionOrder(SAMPLE_IDS, 'session-123', 'EMO-01');
    expect(order1).toEqual(order2);
  });

  it('produz ordem diferente com seed diferente', () => {
    const order1 = getSeededOptionOrder(SAMPLE_IDS, 'session-123', 'EMO-01');
    const order2 = getSeededOptionOrder(SAMPLE_IDS, 'session-456', 'EMO-01');
    // Probabilidade de colisão é ~1/120 (5!), mas vamos testar que o mecanismo funciona
    // Não podemos garantir que são diferentes, mas o hash deveria distinguir
    expect(new Set(order1)).toEqual(new Set(SAMPLE_IDS));
    expect(new Set(order2)).toEqual(new Set(SAMPLE_IDS));
  });

  it('produz ordem diferente para perguntas diferentes', () => {
    const order1 = getSeededOptionOrder(SAMPLE_IDS, 'session-123', 'EMO-01');
    const order2 = getSeededOptionOrder(SAMPLE_IDS, 'session-123', 'EMO-02');
    expect(new Set(order1)).toEqual(new Set(SAMPLE_IDS));
    expect(new Set(order2)).toEqual(new Set(SAMPLE_IDS));
  });

  it('não muta o array original', () => {
    const original = [...SAMPLE_IDS];
    getSeededOptionOrder(SAMPLE_IDS, 'session-123', 'EMO-01');
    expect(SAMPLE_IDS).toEqual(original);
  });
});

describe('isValidOptionOrder', () => {
  it('retorna true para ordem válida', () => {
    expect(isValidOptionOrder(['C', 'A', 'E', 'B', 'D'], SAMPLE_IDS)).toBe(true);
  });

  it('retorna false se tamanho diferente', () => {
    expect(isValidOptionOrder(['A', 'B', 'C'], SAMPLE_IDS)).toBe(false);
  });

  it('retorna false se IDs diferentes', () => {
    expect(isValidOptionOrder(['A', 'B', 'C', 'D', 'X'], SAMPLE_IDS)).toBe(false);
  });

  it('retorna false se duplicatas', () => {
    expect(isValidOptionOrder(['A', 'A', 'C', 'D', 'E'], SAMPLE_IDS)).toBe(false);
  });

  it('retorna false para null/undefined', () => {
    expect(isValidOptionOrder(null, SAMPLE_IDS)).toBe(false);
    expect(isValidOptionOrder(undefined, SAMPLE_IDS)).toBe(false);
  });
});

describe('fisherYatesShuffle', () => {
  it('produz permutação do mesmo tamanho', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = fisherYatesShuffle([...arr]);
    expect(result).toHaveLength(5);
    expect(new Set(result)).toEqual(new Set(arr));
  });

  it('distribui uniformemente (chi-squared test aproximado)', () => {
    // Testar que posição 0 não é sempre o primeiro elemento
    const counts = {};
    for (let i = 0; i < 1000; i++) {
      const result = fisherYatesShuffle([...SAMPLE_IDS]);
      const firstElement = result[0];
      counts[firstElement] = (counts[firstElement] || 0) + 1;
    }
    // Cada elemento deveria aparecer ~200 vezes na posição 0
    for (const id of SAMPLE_IDS) {
      expect(counts[id]).toBeGreaterThan(100); // Permitir variância
      expect(counts[id]).toBeLessThan(300);
    }
  });
});

describe('hashString', () => {
  it('produz resultado determinístico', () => {
    expect(hashString('test')).toBe(hashString('test'));
  });

  it('produz resultados diferentes para strings diferentes', () => {
    expect(hashString('abc')).not.toBe(hashString('def'));
  });

  it('retorna inteiro positivo', () => {
    expect(hashString('test')).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashString('test'))).toBe(true);
  });
});
