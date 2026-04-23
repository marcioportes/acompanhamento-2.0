import { describe, it, expect } from 'vitest';
import { computeConfidence } from '../../../utils/maturityEngine/helpers';

describe('computeConfidence', () => {
  it('todos HIGH → HIGH', () => {
    expect(computeConfidence({ E: 'HIGH', F: 'HIGH', O: 'HIGH', M: 'HIGH' })).toBe('HIGH');
  });

  it('mix → mínimo (um LOW baixa todos)', () => {
    expect(computeConfidence({ E: 'HIGH', F: 'MED', O: 'LOW', M: 'HIGH' })).toBe('LOW');
    expect(computeConfidence({ E: 'HIGH', F: 'MED', O: 'HIGH', M: 'HIGH' })).toBe('MED');
  });

  it('entrada ausente (null/undefined) → MED', () => {
    expect(computeConfidence(null)).toBe('MED');
    expect(computeConfidence(undefined)).toBe('MED');
  });

  it('objeto vazio → MED', () => {
    expect(computeConfidence({})).toBe('MED');
  });

  it('valores inválidos são ignorados; resto decide', () => {
    expect(computeConfidence({ E: 'HIGH', F: 'QUALQUER', O: 'HIGH' })).toBe('HIGH');
    // Todos inválidos → MED
    expect(computeConfidence({ E: 'X', F: 'Y' })).toBe('MED');
  });

  it('aceita subset das dimensões (apenas E e F)', () => {
    expect(computeConfidence({ E: 'MED', F: 'HIGH' })).toBe('MED');
  });
});
