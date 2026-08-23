/**
 * #376 — denominador do drawdown.
 *
 * `plans[0].initialBalance` não existe em NENHUM dos 27 planos de produção (medido em
 * 23/08): o campo de capital do produto é `pl`. Sem fallback, `maxDDPercent` fica null
 * para todos, e os gates de drawdown — incluindo `maxdd-under-20`, da transição 1→2,
 * onde estão os alunos novos — ficam impossíveis por construção. Mesma classe do
 * `strategy-8-weeks` que motivou esta issue.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { preComputeShapes } = require('../../../../functions/maturity/preComputeShapes.js');

const trades = [
  { id: 't1', date: '2026-08-03', result: -500, studentId: 's1' },
  { id: 't2', date: '2026-08-04', result: -500, studentId: 's1' },
  { id: 't3', date: '2026-08-05', result: 300, studentId: 's1' },
];

describe('#376 — capital do plano como denominador', () => {
  it('plano só com `pl` produz maxDD% (antes: null)', () => {
    const out = preComputeShapes({ trades, plans: [{ pl: 100000 }], now: new Date('2026-08-23') });
    expect(out.maxDrawdown.maxDDPercent).not.toBeNull();
    expect(out.maxDrawdown.maxDDPercent).toBeCloseTo(1, 5); // 1000 de 100000
  });

  it('`initialBalance` continua tendo precedência quando existe', () => {
    const out = preComputeShapes({
      trades, plans: [{ pl: 100000, initialBalance: 50000 }], now: new Date('2026-08-23'),
    });
    expect(out.maxDrawdown.maxDDPercent).toBeCloseTo(2, 5); // 1000 de 50000
  });

  it('sem nenhum dos dois, segue null — não inventa denominador', () => {
    const out = preComputeShapes({ trades, plans: [{}], now: new Date('2026-08-23') });
    expect(out.maxDrawdown.maxDDPercent).toBeNull();
  });
});
