/**
 * orderTemporalResolution.test.js
 * @description Testes da detecção de baixa resolução temporal em ordens
 *   parseadas (issue #93 redesign V1.1a).
 */

import { describe, it, expect } from 'vitest';
import { detectLowResolution } from '../../utils/orderTemporalResolution';

describe('detectLowResolution', () => {
  describe('casos vazios / no data', () => {
    it('retorna false para array vazio', () => {
      expect(detectLowResolution([])).toBe(false);
    });

    it('retorna false para null/undefined', () => {
      expect(detectLowResolution(null)).toBe(false);
      expect(detectLowResolution(undefined)).toBe(false);
    });

    it('retorna false quando todas as ordens têm timestamps null', () => {
      const orders = [
        { filledAt: null, submittedAt: null, lastUpdatedAt: null, cancelledAt: null },
        { filledAt: null, submittedAt: null, lastUpdatedAt: null, cancelledAt: null },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('retorna false quando todos os timestamps são inválidos (Date.isNaN)', () => {
      const orders = [
        { filledAt: 'lixo', submittedAt: 'data inválida' },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });
  });

  describe('detecta resolução normal (com segundos)', () => {
    it('retorna false quando filledAt tem segundos', () => {
      const orders = [
        { filledAt: '2026-04-08T10:30:45.000Z' },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('retorna false quando submittedAt tem segundos', () => {
      const orders = [
        { submittedAt: '2026-04-08T10:30:42.000Z' },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('retorna false quando lastUpdatedAt tem segundos', () => {
      const orders = [
        { lastUpdatedAt: '2026-04-08T10:30:17.000Z' },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('retorna false quando cancelledAt tem segundos', () => {
      const orders = [
        { cancelledAt: '2026-04-08T10:30:09.000Z' },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('retorna false quando timestamp tem milliseconds', () => {
      const orders = [
        { filledAt: '2026-04-08T10:30:00.500Z' },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('retorna false em mix — algumas ordens com segundos zero, outras com segundos', () => {
      const orders = [
        { filledAt: '2026-04-08T10:30:00.000Z' },
        { filledAt: '2026-04-08T10:31:00.000Z' },
        { filledAt: '2026-04-08T10:32:17.000Z' }, // este tem segundos
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('retorna false em mix de campos — filledAt zero, submittedAt com segundos', () => {
      const orders = [
        {
          filledAt: '2026-04-08T10:30:00.000Z',
          submittedAt: '2026-04-08T10:29:32.000Z',
        },
      ];
      expect(detectLowResolution(orders)).toBe(false);
    });
  });

  describe('detecta baixa resolução (todos os timestamps :00)', () => {
    it('retorna true quando todas as ordens têm filledAt em :00', () => {
      const orders = [
        { filledAt: '2026-04-08T10:30:00.000Z' },
        { filledAt: '2026-04-08T10:31:00.000Z' },
        { filledAt: '2026-04-08T10:32:00.000Z' },
      ];
      expect(detectLowResolution(orders)).toBe(true);
    });

    it('retorna true quando ordens têm múltiplos campos todos em :00', () => {
      const orders = [
        {
          submittedAt: '2026-04-08T10:29:00.000Z',
          filledAt: '2026-04-08T10:30:00.000Z',
          lastUpdatedAt: '2026-04-08T10:30:00.000Z',
        },
        {
          submittedAt: '2026-04-08T10:31:00.000Z',
          filledAt: '2026-04-08T10:32:00.000Z',
          cancelledAt: '2026-04-08T10:33:00.000Z',
        },
      ];
      expect(detectLowResolution(orders)).toBe(true);
    });

    it('ignora timestamps null/inválidos quando há outros válidos em :00', () => {
      const orders = [
        {
          filledAt: '2026-04-08T10:30:00.000Z',
          submittedAt: null,
          lastUpdatedAt: 'lixo',
        },
        {
          filledAt: null,
          submittedAt: '2026-04-08T10:31:00.000Z',
        },
      ];
      expect(detectLowResolution(orders)).toBe(true);
    });
  });

  describe('uma ordem só (caso degenerado)', () => {
    it('uma ordem com segundos → false', () => {
      const orders = [{ filledAt: '2026-04-08T10:30:42.000Z' }];
      expect(detectLowResolution(orders)).toBe(false);
    });

    it('uma ordem em :00 → true (limitação documentada)', () => {
      // Falso positivo possível: 1 ordem coincidentemente em :00 segundos.
      // Comportamento esperado conforme limitação documentada no util.
      const orders = [{ filledAt: '2026-04-08T10:30:00.000Z' }];
      expect(detectLowResolution(orders)).toBe(true);
    });
  });
});
