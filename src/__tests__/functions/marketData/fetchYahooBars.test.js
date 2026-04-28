/**
 * fetchYahooBars.test.js — issue #187 Fase 4
 * Mocka fetch para validar pipeline sem rede.
 */

import { describe, it, expect, vi } from 'vitest';
import { fetchYahooBars, parseYahooResponse, toUnixSeconds, SEVEN_DAYS_MS }
  from '../../../../functions/marketData/fetchYahooBars';

const mockYahooPayload = (highs, lows, timestamps) => ({
  chart: {
    result: [{
      meta: {},
      timestamp: timestamps,
      indicators: { quote: [{ high: highs, low: lows }] },
    }],
  },
});

const mockResponse = (json, ok = true, status = 200) => ({
  ok, status, json: async () => json,
});

describe('fetchYahooBars — happy path', () => {
  it('busca bars válidas dentro do range', async () => {
    const now = new Date('2026-04-27T15:00:00Z');
    const from = new Date('2026-04-27T14:00:00Z');
    const to = new Date('2026-04-27T14:30:00Z');
    const ts = [
      Math.floor(from.getTime() / 1000),
      Math.floor((from.getTime() + 60_000) / 1000),
      Math.floor((from.getTime() + 120_000) / 1000),
    ];
    const payload = mockYahooPayload([100, 102, 101], [99, 100, 98], ts);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(payload));

    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from, to },
      { fetchFn, now: () => now }
    );

    expect(result.ok).toBe(true);
    expect(result.bars).toHaveLength(3);
    expect(result.bars[0]).toEqual({ t: ts[0], h: 100, l: 99 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toContain('MNQ=F');
    expect(fetchFn.mock.calls[0][0]).toContain('interval=1m');
  });

  it('filtra bars fora do range exato', async () => {
    const now = new Date('2026-04-27T15:00:00Z');
    const from = new Date('2026-04-27T14:00:00Z');
    const to = new Date('2026-04-27T14:30:00Z');
    const t1 = Math.floor(from.getTime() / 1000);
    const t2 = Math.floor(to.getTime() / 1000);
    const ts = [t1 - 60, t1, t1 + 60, t2, t2 + 60];
    const payload = mockYahooPayload([100, 101, 102, 103, 104], [99, 100, 101, 102, 103], ts);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(payload));

    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from, to },
      { fetchFn, now: () => now }
    );

    expect(result.ok).toBe(true);
    // só os 3 dentro do range [t1, t2]
    expect(result.bars.map((b) => b.t)).toEqual([t1, t1 + 60, t2]);
  });
});

describe('fetchYahooBars — falhas e limites', () => {
  it('janela 7d: trade antigo retorna unavailable sem fetch', async () => {
    const now = new Date('2026-04-27T15:00:00Z');
    const from = new Date('2026-04-15T14:00:00Z'); // 12 dias atrás
    const to = new Date('2026-04-15T14:30:00Z');
    const fetchFn = vi.fn();

    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from, to },
      { fetchFn, now: () => now }
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/janela 7d/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('janela vazia (to <= from)', async () => {
    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from: new Date('2026-04-27T14:00Z'), to: new Date('2026-04-27T13:00Z') },
      { fetchFn: vi.fn(), now: () => new Date('2026-04-27T15:00Z') }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/janela vazia/);
  });

  it('symbol ausente', async () => {
    const result = await fetchYahooBars(
      { yahooSymbol: null, from: new Date(), to: new Date() },
      { fetchFn: vi.fn(), now: () => new Date() }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/yahooSymbol/);
  });

  it('HTTP 4xx: aborta sem retry', async () => {
    const now = new Date('2026-04-27T15:00:00Z');
    const from = new Date('2026-04-27T14:00:00Z');
    const to = new Date('2026-04-27T14:30:00Z');
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from, to },
      { fetchFn, now: () => now, retries: 3 }
    );
    expect(result.ok).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1); // não fez retries pra 404
  });

  it('HTTP 5xx: retenta', async () => {
    const now = new Date('2026-04-27T15:00:00Z');
    const from = new Date('2026-04-27T14:00:00Z');
    const to = new Date('2026-04-27T14:30:00Z');
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from, to },
      { fetchFn, now: () => now, retries: 2 }
    );
    expect(result.ok).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(3); // 1 + 2 retries
    expect(result.reason).toMatch(/HTTP 503/);
  });

  it('shape inesperado retorna falha', async () => {
    const now = new Date('2026-04-27T15:00:00Z');
    const from = new Date('2026-04-27T14:00:00Z');
    const to = new Date('2026-04-27T14:30:00Z');
    const fetchFn = vi.fn().mockResolvedValue(mockResponse({ chart: { result: [] } }));

    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from, to },
      { fetchFn, now: () => now }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/shape/);
  });

  it('exception durante fetch retorna falha', async () => {
    const now = new Date('2026-04-27T15:00:00Z');
    const from = new Date('2026-04-27T14:00:00Z');
    const to = new Date('2026-04-27T14:30:00Z');
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));

    const result = await fetchYahooBars(
      { yahooSymbol: 'MNQ=F', from, to },
      { fetchFn, now: () => now, retries: 1 }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/network down/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('parseYahooResponse + toUnixSeconds (helpers)', () => {
  it('parseYahooResponse pula bars com null', () => {
    const result = parseYahooResponse({
      chart: { result: [{
        timestamp: [1, 2, 3],
        indicators: { quote: [{ high: [10, null, 12], low: [9, null, 11] }] },
      }] },
    });
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.t)).toEqual([1, 3]);
  });

  it('toUnixSeconds aceita Date, number, string', () => {
    expect(toUnixSeconds(new Date('2026-01-01T00:00:00Z'))).toBe(1767225600);
    expect(toUnixSeconds(1767225600000)).toBe(1767225600);
    expect(toUnixSeconds('2026-01-01T00:00:00Z')).toBe(1767225600);
  });

  it('toUnixSeconds retorna null para input inválido', () => {
    expect(toUnixSeconds(null)).toBe(null);
    expect(toUnixSeconds('foo')).toBe(null);
    expect(toUnixSeconds({})).toBe(null);
  });

  it('SEVEN_DAYS_MS exposto', () => {
    expect(SEVEN_DAYS_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
