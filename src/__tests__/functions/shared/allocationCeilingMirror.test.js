/**
 * allocationCeilingMirror.test.js — paridade ESM↔CJS do teto de capital (#480).
 *
 * `src/utils/cycleClosure/allocationCeiling.js` e `functions/shared/allocationCeiling.js`
 * têm o CORPO idêntico — só cabeçalho e export mudam. O Passo 6 e o `closeCycle` não
 * podem discordar sobre o máximo alocável: o aluno passaria na tela e levaria erro no selo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as esm from '../../../utils/cycleClosure/allocationCeiling';

const cjs = require('../../../../functions/shared/allocationCeiling');

const RAIZ = resolve(__dirname, '../../../..');
const corpo = (arquivo, fim) => {
  const s = readFileSync(resolve(RAIZ, arquivo), 'utf-8');
  return s.slice(s.indexOf('/** Folga do gate'), s.indexOf(fim)).trim();
};

describe('#480 · allocationCeiling — paridade ESM↔CJS', () => {
  it('corpo idêntico', () => {
    expect(corpo('functions/shared/allocationCeiling.js', 'module.exports'))
      .toBe(corpo('src/utils/cycleClosure/allocationCeiling.js', 'export {'));
  });

  it('mesmas saídas', () => {
    const casos = [
      { cycleEquity: 25357.8, accountBalance: 25357.8 },
      { cycleEquity: 25357.8, accountBalance: 60000 },
      { cycleEquity: 25357.8, accountBalance: 60000, otherPlansPl: 20000, postCycleResult: 1500 },
      { cycleEquity: 25357.8, accountBalance: null },
      { cycleEquity: 0, accountBalance: 60000 },
    ];
    for (const c of casos) {
      expect(cjs.computeAllocationCeiling(c)).toEqual(esm.computeAllocationCeiling(c));
    }
    expect(cjs.ALLOCATION_TOLERANCE).toBe(esm.ALLOCATION_TOLERANCE);
    expect(cjs.exceedsAllocationCeiling(60000.11, 60000)).toBe(esm.exceedsAllocationCeiling(60000.11, 60000));
    const roll = { adjustment: { changed: false, newPl: 25645.6 }, cycleEquity: 25357.8, currentPl: 25645.6 };
    expect(cjs.resolveNextCyclePl(roll)).toBe(esm.resolveNextCyclePl(roll));
  });
});
