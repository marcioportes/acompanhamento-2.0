/**
 * orderKey.test.js
 * @description Testes do gerador de chave canônica de ordens (issue #93).
 *   Garante consistência entre OrderStagingReview, useOrderStaging e
 *   OrderImportPage no critério de filtragem.
 */

import { describe, it, expect } from 'vitest';
import { makeOrderKey } from '../../utils/orderKey';

describe('makeOrderKey', () => {
  describe('externalOrderId presente', () => {
    it('gera chave eid: quando externalOrderId está presente', () => {
      const order = { externalOrderId: 'ABC123' };
      expect(makeOrderKey(order)).toBe('eid:ABC123');
    });

    it('prioriza externalOrderId sobre fallback composto', () => {
      const order = {
        externalOrderId: 'ABC123',
        instrument: 'WDOQ26',
        side: 'BUY',
        submittedAt: '2026-04-08T10:00:00Z',
        quantity: 5,
        filledAt: '2026-04-08T10:00:01Z',
      };
      expect(makeOrderKey(order)).toBe('eid:ABC123');
    });

    it('aceita externalOrderId numérico', () => {
      const order = { externalOrderId: 12345 };
      expect(makeOrderKey(order)).toBe('eid:12345');
    });
  });

  describe('fallback composto', () => {
    it('gera chave comp: quando externalOrderId ausente', () => {
      const order = {
        instrument: 'WDOQ26',
        side: 'BUY',
        submittedAt: '2026-04-08T10:00:00Z',
        quantity: 5,
        filledAt: '2026-04-08T10:00:01Z',
      };
      expect(makeOrderKey(order)).toBe(
        'comp:WDOQ26|BUY|2026-04-08T10:00:00Z|5|2026-04-08T10:00:01Z'
      );
    });

    it('trata submittedAt ausente como string vazia', () => {
      const order = {
        instrument: 'WINQ26',
        side: 'SELL',
        quantity: 2,
        filledAt: '2026-04-08T10:00:01Z',
      };
      expect(makeOrderKey(order)).toBe('comp:WINQ26|SELL||2|2026-04-08T10:00:01Z');
    });

    it('trata filledAt ausente como string vazia', () => {
      const order = {
        instrument: 'WINQ26',
        side: 'SELL',
        submittedAt: '2026-04-08T10:00:00Z',
        quantity: 2,
      };
      expect(makeOrderKey(order)).toBe('comp:WINQ26|SELL|2026-04-08T10:00:00Z|2|');
    });

    it('trata quantity null como string vazia', () => {
      const order = {
        instrument: 'WDOQ26',
        side: 'BUY',
        submittedAt: '2026-04-08T10:00:00Z',
        quantity: null,
        filledAt: '2026-04-08T10:00:01Z',
      };
      expect(makeOrderKey(order)).toBe('comp:WDOQ26|BUY|2026-04-08T10:00:00Z||2026-04-08T10:00:01Z');
    });

    it('trata quantity undefined como string vazia', () => {
      const order = {
        instrument: 'WDOQ26',
        side: 'BUY',
        submittedAt: '2026-04-08T10:00:00Z',
        filledAt: '2026-04-08T10:00:01Z',
      };
      expect(makeOrderKey(order)).toBe('comp:WDOQ26|BUY|2026-04-08T10:00:00Z||2026-04-08T10:00:01Z');
    });

    it('preserva quantity zero (não confunde com ausente)', () => {
      const order = {
        instrument: 'WDOQ26',
        side: 'BUY',
        submittedAt: '2026-04-08T10:00:00Z',
        quantity: 0,
        filledAt: '2026-04-08T10:00:01Z',
      };
      expect(makeOrderKey(order)).toBe('comp:WDOQ26|BUY|2026-04-08T10:00:00Z|0|2026-04-08T10:00:01Z');
    });
  });

  describe('idempotência e unicidade', () => {
    it('mesma ordem sempre produz a mesma chave', () => {
      const order = {
        instrument: 'WDOQ26',
        side: 'BUY',
        submittedAt: '2026-04-08T10:00:00Z',
        quantity: 5,
        filledAt: '2026-04-08T10:00:01Z',
      };
      expect(makeOrderKey(order)).toBe(makeOrderKey(order));
    });

    it('ordens com instrument diferente produzem chaves diferentes', () => {
      const a = { instrument: 'WDOQ26', side: 'BUY', submittedAt: 't', quantity: 1, filledAt: 'f' };
      const b = { instrument: 'WINQ26', side: 'BUY', submittedAt: 't', quantity: 1, filledAt: 'f' };
      expect(makeOrderKey(a)).not.toBe(makeOrderKey(b));
    });

    it('ordens com side diferente produzem chaves diferentes', () => {
      const a = { instrument: 'WDOQ26', side: 'BUY', submittedAt: 't', quantity: 1, filledAt: 'f' };
      const b = { instrument: 'WDOQ26', side: 'SELL', submittedAt: 't', quantity: 1, filledAt: 'f' };
      expect(makeOrderKey(a)).not.toBe(makeOrderKey(b));
    });

    it('ordens com filledAt diferente produzem chaves diferentes', () => {
      const a = { instrument: 'WDOQ26', side: 'BUY', submittedAt: 't', quantity: 1, filledAt: 'f1' };
      const b = { instrument: 'WDOQ26', side: 'BUY', submittedAt: 't', quantity: 1, filledAt: 'f2' };
      expect(makeOrderKey(a)).not.toBe(makeOrderKey(b));
    });
  });

  describe('contrato de filtragem (regressão pipeline)', () => {
    it('Set de chaves filtra subset esperado de ordens cruas', () => {
      const allOrders = [
        { externalOrderId: 'A1', instrument: 'WDO', side: 'BUY' },
        { externalOrderId: 'A2', instrument: 'WDO', side: 'SELL' },
        { externalOrderId: 'A3', instrument: 'WIN', side: 'BUY' },
        { instrument: 'WIN', side: 'SELL', submittedAt: 't1', quantity: 2, filledAt: 'f1' },
      ];
      const confirmedKeys = new Set([
        'eid:A1',
        'eid:A3',
        'comp:WIN|SELL|t1|2|f1',
      ]);
      const filtered = allOrders.filter(o => confirmedKeys.has(makeOrderKey(o)));
      expect(filtered).toHaveLength(3);
      expect(filtered[0].externalOrderId).toBe('A1');
      expect(filtered[1].externalOrderId).toBe('A3');
      expect(filtered[2].instrument).toBe('WIN');
    });

    it('ordens fora do Set de confirmadas são excluídas', () => {
      const allOrders = [
        { externalOrderId: 'A1' },
        { externalOrderId: 'A2' },
        { externalOrderId: 'A3' },
      ];
      const confirmedKeys = new Set(['eid:A1', 'eid:A3']);
      const filtered = allOrders.filter(o => confirmedKeys.has(makeOrderKey(o)));
      expect(filtered).toHaveLength(2);
      expect(filtered.map(o => o.externalOrderId)).toEqual(['A1', 'A3']);
    });

    it('Set vazio produz subset vazio', () => {
      const allOrders = [{ externalOrderId: 'A1' }, { externalOrderId: 'A2' }];
      const filtered = allOrders.filter(o => new Set().has(makeOrderKey(o)));
      expect(filtered).toHaveLength(0);
    });
  });
});
