/**
 * maturitySemaphore.test.js
 * @description Testes da classificação do semáforo de maturidade
 *              (issue #119 task 17 — Fase F Mentor).
 * @see src/utils/maturitySemaphore.js
 */

import { describe, it, expect } from 'vitest';
import {
  getMaturitySemaphore,
  SEMAPHORE_LABELS,
  SEMAPHORE_COLORS,
} from '../../utils/maturitySemaphore';

describe('getMaturitySemaphore', () => {
  it('retorna UNKNOWN para maturity null', () => {
    expect(getMaturitySemaphore(null)).toBe('UNKNOWN');
  });

  it('retorna UNKNOWN para maturity undefined', () => {
    expect(getMaturitySemaphore(undefined)).toBe('UNKNOWN');
  });

  it('retorna RED quando signalRegression.detected === true (precedência sobre UP)', () => {
    const maturity = {
      signalRegression: { detected: true, reasons: ['Queda abrupta de winrate'] },
      proposedTransition: { proposed: 'UP', toStage: 'MASTERY' }, // UP deveria perder para regression
    };
    expect(getMaturitySemaphore(maturity)).toBe('RED');
  });

  it('retorna GREEN quando proposedTransition.proposed === UP e sem regression ativa', () => {
    const maturity = {
      signalRegression: { detected: false },
      proposedTransition: { proposed: 'UP', toStage: 'MASTERY' },
    };
    expect(getMaturitySemaphore(maturity)).toBe('GREEN');
  });

  it('retorna AMBER quando proposedTransition.proposed === STAY', () => {
    const maturity = {
      signalRegression: { detected: false },
      proposedTransition: { proposed: 'STAY' },
    };
    expect(getMaturitySemaphore(maturity)).toBe('AMBER');
  });

  it('retorna AMBER quando proposedTransition.proposed === DOWN_DETECTED sem regression ativa', () => {
    const maturity = {
      signalRegression: { detected: false },
      proposedTransition: { proposed: 'DOWN_DETECTED' },
    };
    expect(getMaturitySemaphore(maturity)).toBe('AMBER');
  });

  it('retorna AMBER quando não há proposedTransition nem regression', () => {
    const maturity = { currentStage: 'DISCIPLINED' };
    expect(getMaturitySemaphore(maturity)).toBe('AMBER');
  });

  it('retorna AMBER quando signalRegression existe mas detected !== true', () => {
    const maturity = {
      signalRegression: { detected: false },
    };
    expect(getMaturitySemaphore(maturity)).toBe('AMBER');
  });
});

describe('SEMAPHORE_LABELS', () => {
  it('tem label para cada state', () => {
    expect(SEMAPHORE_LABELS.GREEN).toBeTruthy();
    expect(SEMAPHORE_LABELS.AMBER).toBeTruthy();
    expect(SEMAPHORE_LABELS.RED).toBeTruthy();
    expect(SEMAPHORE_LABELS.UNKNOWN).toBeTruthy();
  });
});

describe('SEMAPHORE_COLORS', () => {
  it('tem classe Tailwind para cada state', () => {
    expect(SEMAPHORE_COLORS.GREEN).toMatch(/^bg-/);
    expect(SEMAPHORE_COLORS.AMBER).toMatch(/^bg-/);
    expect(SEMAPHORE_COLORS.RED).toMatch(/^bg-/);
    expect(SEMAPHORE_COLORS.UNKNOWN).toMatch(/^bg-/);
  });
});
