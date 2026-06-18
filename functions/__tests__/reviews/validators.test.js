/**
 * validators.test.js — Issue #269 (Fase B)
 *
 * Cobre os helpers puros novos de reviews/validators.js usados pelas callables
 * createReviewDraft / publishReview (nextSequenceNumber, computePeriodBounds).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { nextSequenceNumber, computePeriodBounds } = require('../../reviews/validators');

describe('nextSequenceNumber', () => {
  it('retorna 1 quando não há reviews fechadas', () => {
    expect(nextSequenceNumber([])).toBe(1);
    expect(nextSequenceNumber(undefined)).toBe(1);
  });

  it('retorna max + 1 entre sequenceNumbers numéricos', () => {
    expect(nextSequenceNumber([1, 2])).toBe(3);
    expect(nextSequenceNumber([3, 1, 2])).toBe(4);
  });

  it('ignora null/undefined/não-numéricos (docs legados sem o campo)', () => {
    expect(nextSequenceNumber([null, 2, undefined])).toBe(3);
    expect(nextSequenceNumber([null, null])).toBe(1);
    expect(nextSequenceNumber(['x', 2, NaN])).toBe(3);
  });
});

describe('computePeriodBounds', () => {
  const today = '2026-06-18';

  it('rascunho vazio → { null, null }', () => {
    expect(computePeriodBounds([], today)).toEqual({ periodStart: null, periodEnd: null });
    expect(computePeriodBounds(undefined, today)).toEqual({ periodStart: null, periodEnd: null });
  });

  it('start = menor data, end = maior data quando o último trade é hoje/futuro', () => {
    const r = computePeriodBounds(
      ['2026-06-18T09:00:00-03:00', '2026-06-16T10:00:00-03:00'],
      today,
    );
    expect(r).toEqual({ periodStart: '2026-06-16', periodEnd: '2026-06-18' });
  });

  it('estende periodEnd para hoje quando o último trade é anterior a hoje', () => {
    const r = computePeriodBounds(
      ['2026-06-10T09:00:00-03:00', '2026-06-12T10:00:00-03:00'],
      today,
    );
    expect(r).toEqual({ periodStart: '2026-06-10', periodEnd: '2026-06-18' });
  });

  it('descarta entryTimes nulos/malformados', () => {
    const r = computePeriodBounds(
      [null, '2026-06-15T08:00:00-03:00', '', 'lixo'],
      today,
    );
    expect(r).toEqual({ periodStart: '2026-06-15', periodEnd: '2026-06-18' });
  });
});
