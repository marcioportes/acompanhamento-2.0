/**
 * #385 — falha ao carregar o chunk do Selic degrada para o fallback, não derruba o Sharpe.
 *
 * `getSelicForDate` já tinha fallback interno para erro de rede/permissão, mas ele vive
 * DENTRO do módulo: quando o próprio módulo não carrega (chunk antigo após deploy), o
 * fallback nunca era alcançado e o `import()` rejeitava.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeCycleSharpe } from '../../utils/cycleConsistency/computeCycleSharpe';

const trades = [
  { date: '2026-08-04', result: 120, status: 'CLOSED' },
  { date: '2026-08-05', result: -60, status: 'CLOSED' },
  { date: '2026-08-06', result: 200, status: 'CLOSED' },
  { date: '2026-08-07', result: 90, status: 'CLOSED' },
  { date: '2026-08-10', result: -40, status: 'CLOSED' },
  { date: '2026-08-11', result: 150, status: 'CLOSED' },
];

afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

describe('#385 — chunk do Selic indisponível', () => {
  it('não rejeita: devolve Sharpe com a taxa de fallback', async () => {
    vi.doMock('../../utils/marketData/getSelicForDate.js', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    vi.resetModules();
    const { computeCycleSharpe: fn } = await import('../../utils/cycleConsistency/computeCycleSharpe');
    const out = await fn(trades, '2026-08-01', '2026-08-31', 30000, {});
    expect(out).toBeTruthy();
    expect(out.value).not.toBeNull();
    expect(Number.isFinite(out.value)).toBe(true);
  });

  it('caminho normal segue usando a Selic real (override de teste)', async () => {
    const out = await computeCycleSharpe(trades, '2026-08-01', '2026-08-31', 30000, {
      getSelicForDateFn: async () => ({ rateDaily: 0.0005166, source: 'BCB', isFallback: false }),
    });
    expect(out.source).toBe('BCB');
    expect(out.fallbackUsed).toBe(false);
  });
});
