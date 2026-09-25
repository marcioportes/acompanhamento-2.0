/**
 * orderInstantMirror.test.js — paridade ESM↔CJS do instante de ordem (#464, épico #462 F1).
 *
 * `functions/shared/orderInstant.js` é o SSoT do servidor desde o #388; o #464 criou o
 * espelho ESM `src/utils/orderInstant.js` e tirou as cópias do cliente. Os dois arquivos
 * têm o CORPO idêntico — só o cabeçalho e o export mudam. Esta suíte trava as duas coisas:
 * o texto das funções e o resultado de cada uma sobre a mesma tabela de casos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as esm from '../../../utils/orderInstant';

const cjs = require('../../../../functions/shared/orderInstant');

const RAIZ = resolve(__dirname, '../../../..');
const corpo = (arquivo, fim) => {
  const s = readFileSync(resolve(RAIZ, arquivo), 'utf-8');
  return s.slice(s.indexOf('/** Sufixo de fuso num ISO'), s.indexOf(fim)).trim();
};

const TRADES = [
  { entryTime: '2026-08-21T11:25:15-03:00', exitTime: '2026-08-21T11:27:51-03:00' },
  { entryTime: '2026-07-15T09:30:00-0400' },
  { entryTime: '2026-08-21T14:25:15Z' },
  { entryTime: '2026-08-21T11:25:15', exitTime: '2026-08-21T11:30:00-05:00' },
  { entryTime: '2026-08-21T11:25:15' },
  {},
  null,
];

const VALORES = [
  '2026-08-21T11:27:51',
  '2026-08-21T11:27:51.975',
  '2026-08-21T11:27:51-03:00',
  '2026-08-21T14:27:51Z',
  '2026-08-21T11:27',
  '2026-08-21',
  'nao-e-data',
  '',
  null,
  undefined,
  { seconds: 1787322471 },
  { toMillis: () => 1787322471000 },
  new Date('2026-08-21T14:27:51Z'),
];

describe('#464 · orderInstant — paridade ESM↔CJS', () => {
  it('o corpo dos dois arquivos é o mesmo texto', () => {
    expect(corpo('src/utils/orderInstant.js', '\nexport {'))
      .toBe(corpo('functions/shared/orderInstant.js', '\nmodule.exports = {'));
  });

  it('exportam as mesmas funções', () => {
    expect(Object.keys(esm).sort()).toEqual(Object.keys(cjs).sort());
  });

  it('orderInstantMs e tradeOffsetOf batem em toda a tabela', () => {
    for (const trade of TRADES) {
      expect(cjs.tradeOffsetOf(trade)).toBe(esm.tradeOffsetOf(trade));
      for (const v of VALORES) {
        expect(cjs.orderInstantMs(trade, v)).toBe(esm.orderInstantMs(trade, v));
      }
    }
  });

  it('instantAtOffsetMs, wallClockMs, offsetOf e stripBatchOffset batem', () => {
    for (const off of ['-03:00', '-0400', '+00:00', null]) {
      for (const v of VALORES) {
        expect(cjs.instantAtOffsetMs(v, off)).toBe(esm.instantAtOffsetMs(v, off));
      }
    }
    for (const v of VALORES) {
      expect(cjs.wallClockMs(v)).toBe(esm.wallClockMs(v));
      expect(cjs.offsetOf(v)).toBe(esm.offsetOf(v));
      expect(cjs.stripBatchOffset(v)).toBe(esm.stripBatchOffset(v));
    }
  });
});
