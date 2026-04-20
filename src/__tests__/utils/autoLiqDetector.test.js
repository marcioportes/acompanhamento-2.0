/**
 * autoLiqDetector.test.js
 * @description Testes do detector AutoLiq (issue #156 Fase B).
 *   Campo canônico: `order.origin` (parser Tradovate → normalizer).
 *   Fallback: `order.text` (para parsers futuros que usem o nome bruto).
 *   Comparação: case-insensitive, trim.
 */

import { describe, it, expect } from 'vitest';
import { detectAutoLiq, orderHasAutoLiq } from '../../utils/autoLiqDetector';

describe('detectAutoLiq', () => {
  it('operação sem ordens AutoLiq → false', () => {
    const op = {
      entryOrders: [{ origin: 'multibracket' }, { origin: null }],
      exitOrders: [{ origin: 'Limit' }],
    };
    expect(detectAutoLiq(op)).toBe(false);
  });

  it('operação com 1 ordem AutoLiq → true', () => {
    const op = {
      entryOrders: [{ origin: 'multibracket' }],
      exitOrders: [{ origin: 'AutoLiq' }],
    };
    expect(detectAutoLiq(op)).toBe(true);
  });

  it('operação com múltiplas ordens, 1 AutoLiq → true (prevalece)', () => {
    const op = {
      entryOrders: [
        { origin: 'multibracket' },
        { origin: 'Limit' },
      ],
      exitOrders: [
        { origin: 'Stop' },
        { origin: 'AutoLiq' },
        { origin: 'Exit' },
      ],
    };
    expect(detectAutoLiq(op)).toBe(true);
  });

  it('campo text vazio/null → false', () => {
    const op = {
      entryOrders: [{ origin: null, text: null }, { origin: '', text: '' }],
      exitOrders: [{ origin: undefined, text: undefined }],
    };
    expect(detectAutoLiq(op)).toBe(false);
  });

  it('case-insensitive: "autoliq" / "AUTOLIQ" / " AutoLiq " → true', () => {
    expect(detectAutoLiq({ entryOrders: [{ origin: 'autoliq' }], exitOrders: [] })).toBe(true);
    expect(detectAutoLiq({ entryOrders: [{ origin: 'AUTOLIQ' }], exitOrders: [] })).toBe(true);
    expect(detectAutoLiq({ entryOrders: [{ origin: ' AutoLiq ' }], exitOrders: [] })).toBe(true);
  });

  it('valor próximo mas não igual não dispara false-positive ("Auto Liquidation")', () => {
    const op = {
      entryOrders: [{ origin: 'Auto Liquidation' }],
      exitOrders: [{ origin: 'LiqAuto' }],
    };
    expect(detectAutoLiq(op)).toBe(false);
  });

  it('fallback: campo `text` em vez de `origin`', () => {
    const op = {
      entryOrders: [{ text: 'AutoLiq' }],
      exitOrders: [{ text: 'Exit' }],
    };
    expect(detectAutoLiq(op)).toBe(true);
  });

  it('inclui stopOrders e cancelledOrders na varredura', () => {
    const opStop = {
      entryOrders: [{ origin: 'Limit' }],
      exitOrders: [{ origin: 'Limit' }],
      stopOrders: [{ origin: 'AutoLiq' }],
    };
    expect(detectAutoLiq(opStop)).toBe(true);

    const opCancelled = {
      entryOrders: [{ origin: 'Limit' }],
      exitOrders: [{ origin: 'Limit' }],
      cancelledOrders: [{ origin: 'AutoLiq' }],
    };
    expect(detectAutoLiq(opCancelled)).toBe(true);
  });

  it('operação null/undefined → false (defensivo)', () => {
    expect(detectAutoLiq(null)).toBe(false);
    expect(detectAutoLiq(undefined)).toBe(false);
    expect(detectAutoLiq({})).toBe(false);
  });

  it('pools vazios ou ausentes → false', () => {
    expect(detectAutoLiq({ entryOrders: [], exitOrders: [] })).toBe(false);
    expect(detectAutoLiq({ entryOrders: null, exitOrders: undefined })).toBe(false);
  });
});

describe('orderHasAutoLiq', () => {
  it('ordem com origin AutoLiq → true', () => {
    expect(orderHasAutoLiq({ origin: 'AutoLiq' })).toBe(true);
  });

  it('ordem com text AutoLiq → true', () => {
    expect(orderHasAutoLiq({ text: 'AutoLiq' })).toBe(true);
  });

  it('ordem sem indicador → false', () => {
    expect(orderHasAutoLiq({ origin: 'Limit' })).toBe(false);
    expect(orderHasAutoLiq({})).toBe(false);
    expect(orderHasAutoLiq(null)).toBe(false);
  });
});
