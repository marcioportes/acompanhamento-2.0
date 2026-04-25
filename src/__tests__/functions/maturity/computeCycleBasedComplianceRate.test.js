/**
 * Issue #191 — paridade do mirror CommonJS (functions/) com o ESM (src/).
 *
 * Não duplica todos os cenários — só smoke A/B/C para confirmar que a cópia
 * espelhada se comporta igual.
 */

import { describe, it, expect } from 'vitest';
import { computeCycleBasedComplianceRate as commonjsImpl } from '../../../../functions/maturity/computeCycleBasedComplianceRate';
import { computeCycleBasedComplianceRate as esmImpl } from '../../../utils/maturityEngine/computeCycleBasedComplianceRate.js';

const NOW = new Date(2026, 3, 24, 15, 0, 0);
const PLAN = { id: 'p1', adjustmentCycle: 'Mensal' };

function trades(count, prefix, date, flagsForFirstN = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    date,
    hasRedFlags: i < flagsForFirstN,
  }));
}

describe('computeCycleBasedComplianceRate — paridade ESM ↔ CommonJS', () => {
  it('A — ambos retornam 100 com 25 trades 0 flags', () => {
    const input = { trades: trades(25, 'a', '2026-04-15', 0), plans: [PLAN], now: NOW };
    expect(commonjsImpl(input)).toBe(esmImpl(input));
  });

  it('B — ambos retornam 86.67 com fallback de ciclo', () => {
    const input = {
      trades: [...trades(12, 'apr', '2026-04-10', 3), ...trades(18, 'mar', '2026-03-15', 1)],
      plans: [PLAN],
      now: NOW,
    };
    expect(commonjsImpl(input)).toBeCloseTo(esmImpl(input), 10);
  });

  it('C — ambos retornam null com histórico esgotado < 20', () => {
    const input = {
      trades: trades(8, 'few', '2026-04-15', 0),
      plans: [PLAN],
      now: NOW,
    };
    expect(commonjsImpl(input)).toBeNull();
    expect(esmImpl(input)).toBeNull();
  });
});
