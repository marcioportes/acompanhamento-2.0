/**
 * resultInPointsOverride.test.js
 * @description Testes para C5 (Issue #78): resultInPoints deve ser null quando há resultOverride.
 * 
 * Como useTrades é um hook com dependência do Firestore, testamos a LÓGICA pura:
 * dado resultOverride e resultInPoints calculados, qual é o valor gravado?
 * 
 * A regra é: se resultOverride != null → resultInPoints = null (pontos não representam o override).
 */
import { describe, it, expect } from 'vitest';

/**
 * Extrai a lógica de decisão de resultInPoints do addTrade/updateTrade.
 * Replica o padrão usado em useTrades.js para ser testável isoladamente.
 */
const deriveResultInPoints = ({ resultOverride, calculatedResultInPoints }) => {
  if (resultOverride != null && !isNaN(parseFloat(resultOverride))) {
    return null; // C5: pontos não representam o override
  }
  return calculatedResultInPoints;
};

/**
 * Extrai a lógica de decisão de resultEdited.
 */
const deriveResultEdited = ({ resultOverride }) => {
  return resultOverride != null;
};

describe('C5 — resultInPoints com resultOverride', () => {
  it('sem override → resultInPoints mantém valor calculado', () => {
    const result = deriveResultInPoints({
      resultOverride: undefined,
      calculatedResultInPoints: 199,
    });
    expect(result).toBe(199);
  });

  it('sem override (null) → resultInPoints mantém valor calculado', () => {
    const result = deriveResultInPoints({
      resultOverride: null,
      calculatedResultInPoints: -50.5,
    });
    expect(result).toBe(-50.5);
  });

  it('com override numérico → resultInPoints = null', () => {
    const result = deriveResultInPoints({
      resultOverride: 200,
      calculatedResultInPoints: 199,
    });
    expect(result).toBeNull();
  });

  it('com override string numérica → resultInPoints = null', () => {
    const result = deriveResultInPoints({
      resultOverride: '200.50',
      calculatedResultInPoints: 199,
    });
    expect(result).toBeNull();
  });

  it('com override = 0 → resultInPoints = null (zero é override válido)', () => {
    const result = deriveResultInPoints({
      resultOverride: 0,
      calculatedResultInPoints: 199,
    });
    expect(result).toBeNull();
  });

  it('com override negativo → resultInPoints = null', () => {
    const result = deriveResultInPoints({
      resultOverride: -150,
      calculatedResultInPoints: 199,
    });
    expect(result).toBeNull();
  });

  it('sem override → resultEdited = false', () => {
    expect(deriveResultEdited({ resultOverride: undefined })).toBe(false);
    expect(deriveResultEdited({ resultOverride: null })).toBe(false);
  });

  it('com override → resultEdited = true', () => {
    expect(deriveResultEdited({ resultOverride: 200 })).toBe(true);
    expect(deriveResultEdited({ resultOverride: 0 })).toBe(true);
    expect(deriveResultEdited({ resultOverride: '100' })).toBe(true);
  });
});
