/**
 * sealCheckMirror.test.js — issue #259 (1A) CJS mirror
 *
 * Cobre os mesmos cenários do espelho ESM (`src/__tests__/utils/cycleClosure/sealCheck.test.js`).
 * Asserções idênticas — divergência indica drift entre os dois lados.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  findSealingRange,
  isTradeInSealedRange,
  buildSealedError,
} = require('../../cycleClosure/sealCheckMirror');

const range = (closureId, cycleStart, cycleEnd) => ({ closureId, cycleStart, cycleEnd });

describe('findSealingRange (CJS mirror)', () => {
  it('retorna null em plan sem sealedCycleRanges', () => {
    expect(findSealingRange({}, '2026-04-15')).toBeNull();
    expect(findSealingRange({ sealedCycleRanges: [] }, '2026-04-15')).toBeNull();
  });

  it('retorna null em plan ou tradeDate inválidos', () => {
    expect(findSealingRange(null, '2026-04-15')).toBeNull();
    expect(findSealingRange({ sealedCycleRanges: [range('c1', '2026-04-01', '2026-04-30')] }, '')).toBeNull();
    expect(findSealingRange({ sealedCycleRanges: [range('c1', '2026-04-01', '2026-04-30')] }, null)).toBeNull();
  });

  it('detecta date dentro de range único', () => {
    const plan = { sealedCycleRanges: [range('c1', '2026-04-01', '2026-04-30')] };
    expect(findSealingRange(plan, '2026-04-15')).toEqual(range('c1', '2026-04-01', '2026-04-30'));
  });

  it('inclui borda inicial (cycleStart) e final (cycleEnd) — inclusivo', () => {
    const plan = { sealedCycleRanges: [range('c1', '2026-04-01', '2026-04-30')] };
    expect(findSealingRange(plan, '2026-04-01')).not.toBeNull();
    expect(findSealingRange(plan, '2026-04-30')).not.toBeNull();
  });

  it('rejeita date fora de range (antes/depois)', () => {
    const plan = { sealedCycleRanges: [range('c1', '2026-04-01', '2026-04-30')] };
    expect(findSealingRange(plan, '2026-03-31')).toBeNull();
    expect(findSealingRange(plan, '2026-05-01')).toBeNull();
  });

  it('detecta em múltiplos ranges não-contíguos', () => {
    const plan = {
      sealedCycleRanges: [
        range('c-fev', '2026-02-01', '2026-02-28'),
        range('c-abr', '2026-04-01', '2026-04-30'),
      ],
    };
    expect(findSealingRange(plan, '2026-02-15')?.closureId).toBe('c-fev');
    expect(findSealingRange(plan, '2026-04-15')?.closureId).toBe('c-abr');
    expect(findSealingRange(plan, '2026-03-15')).toBeNull();
  });

  it('cenário reopen: range removido libera writes', () => {
    const planAfterReopen = {
      sealedCycleRanges: [range('c-fev', '2026-02-01', '2026-02-28')],
    };
    expect(findSealingRange(planAfterReopen, '2026-02-15')).not.toBeNull();
    expect(findSealingRange(planAfterReopen, '2026-03-15')).toBeNull();
  });

  it('ignora entries malformadas no array', () => {
    const plan = {
      sealedCycleRanges: [
        null,
        { closureId: 'incomplete' },
        range('c1', '2026-04-01', '2026-04-30'),
      ],
    };
    expect(findSealingRange(plan, '2026-04-15')?.closureId).toBe('c1');
  });
});

describe('isTradeInSealedRange (CJS mirror)', () => {
  it('bool wrapper sobre findSealingRange', () => {
    const plan = { sealedCycleRanges: [range('c1', '2026-04-01', '2026-04-30')] };
    expect(isTradeInSealedRange(plan, '2026-04-15')).toBe(true);
    expect(isTradeInSealedRange(plan, '2026-05-15')).toBe(false);
    expect(isTradeInSealedRange({}, '2026-04-15')).toBe(false);
  });
});

describe('buildSealedError (CJS mirror)', () => {
  it('produz mensagem com data + range + closureId + sugestão de reopen', () => {
    const r = range('c-fev', '2026-02-01', '2026-02-28');
    const msg = buildSealedError(r, '2026-02-15');
    expect(msg).toContain('2026-02-15');
    expect(msg).toContain('2026-02-01');
    expect(msg).toContain('2026-02-28');
    expect(msg).toContain('c-fev');
    expect(msg).toMatch(/reabra|reopen|originalSnapshot/i);
  });
});
