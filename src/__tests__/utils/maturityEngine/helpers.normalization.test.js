import { describe, it, expect } from 'vitest';
import { clip01, norm, normInverted } from '../../../utils/maturityEngine/helpers';

describe('clip01', () => {
  it('clipa [0, 1]', () => {
    expect(clip01(0)).toBe(0);
    expect(clip01(1)).toBe(1);
    expect(clip01(0.42)).toBe(0.42);
    expect(clip01(-0.5)).toBe(0);
    expect(clip01(1.5)).toBe(1);
  });

  it('trata NaN/Infinity/não-número como 0 (conservador)', () => {
    expect(clip01(NaN)).toBe(0);
    expect(clip01(Infinity)).toBe(0);
    expect(clip01(-Infinity)).toBe(0);
    expect(clip01(undefined)).toBe(0);
    expect(clip01('42')).toBe(0);
  });
});

describe('norm', () => {
  it('mapeia [min,max] linearmente para [0,100]', () => {
    expect(norm(0, 0, 1)).toBe(0);
    expect(norm(1, 0, 1)).toBe(100);
    expect(norm(0.5, 0, 1)).toBe(50);
    expect(norm(1.5, 0, 3)).toBe(50);
  });

  it('clipa abaixo de min e acima de max', () => {
    expect(norm(-1, 0, 10)).toBe(0);
    expect(norm(15, 0, 10)).toBe(100);
  });

  it('retorna 0 quando min === max (intervalo degenerado)', () => {
    expect(norm(5, 5, 5)).toBe(0);
    expect(norm(0, 1, 1)).toBe(0);
  });

  it('retorna 0 para inputs inválidos (NaN/Infinity/non-number)', () => {
    expect(norm(NaN, 0, 1)).toBe(0);
    expect(norm(Infinity, 0, 1)).toBe(0);
    expect(norm(undefined, 0, 1)).toBe(0);
  });
});

describe('normInverted', () => {
  it('mapeia [min,max] invertidamente para [100,0]', () => {
    expect(normInverted(0, 0, 1)).toBe(100);
    expect(normInverted(1, 0, 1)).toBe(0);
    expect(normInverted(0.5, 0, 1)).toBe(50);
    expect(normInverted(0, 0, 25)).toBe(100);
    expect(normInverted(25, 0, 25)).toBe(0);
    expect(normInverted(5, 0, 25)).toBe(80);
  });

  it('clipa abaixo de min e acima de max', () => {
    expect(normInverted(-1, 0, 10)).toBe(100);
    expect(normInverted(15, 0, 10)).toBe(0);
    expect(normInverted(50, 0, 25)).toBe(0);
  });

  it('retorna 0 quando min === max', () => {
    expect(normInverted(5, 5, 5)).toBe(0);
  });

  it('retorna 0 para inputs inválidos', () => {
    expect(normInverted(NaN, 0, 1)).toBe(0);
    expect(normInverted(Infinity, 0, 1)).toBe(0);
    expect(normInverted(null, 0, 1)).toBe(0);
  });
});
