/**
 * stopFlagMirror.test.js — paridade ESM↔CJS do aviso de stop (#475).
 *
 * `src/utils/stopFlag.js` e `functions/shared/stopFlag.js` têm o CORPO idêntico — só o
 * cabeçalho, o import e o export mudam. Idem para `positionWasProtected` (motor × espelho):
 * a decisão violação × pendência não pode divergir entre tela e CF.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as esm from '../../../utils/stopFlag';
import { positionWasProtected } from '../../../utils/executionBehaviorEngine';
import { montarDia } from '../../helpers/gravadoDoImport';

const cjs = require('../../../../functions/shared/stopFlag');
const mirror = require('../../../../functions/maturity/executionBehaviorMirror');

const RAIZ = resolve(__dirname, '../../../..');
const corpo = (arquivo, fim) => {
  const s = readFileSync(resolve(RAIZ, arquivo), 'utf-8');
  return s.slice(s.indexOf('/** Tipos de aviso de stop'), s.indexOf(fim)).trim();
};

describe('#475 · stopFlag — paridade ESM↔CJS', () => {
  it('corpo idêntico', () => {
    expect(corpo('functions/shared/stopFlag.js', 'module.exports')).toBe(corpo('src/utils/stopFlag.js', 'export {'));
  });

  it('mesmas saídas', () => {
    const ts = '2026-09-26T12:00:00.000Z';
    const casos = [
      [{ side: 'SHORT', entry: 185185, stopLoss: null, result: 585 }, true],
      [{ side: 'SHORT', entry: 185185, stopLoss: null, result: 585 }, false],
      [{ side: 'LONG', entry: 100, stopLoss: 90, result: 5 }, true],
      [{ side: 'LONG', entry: 100, stopLoss: null, result: -5 }, false],
      [{ side: 'LONG', entry: 100, stopLoss: 110, result: 0 }, false],
    ];
    for (const [t, p] of casos) expect(cjs.stopFlagOf(t, p, ts)).toEqual(esm.stopFlagOf(t, p, ts));
    expect(cjs.STOP_FLAG_TYPES).toEqual(esm.STOP_FLAG_TYPES);
  });

  it('positionWasProtected: motor e espelho concordam sobre o dia 24/09 inteiro', () => {
    const dia = montarDia('2026-09-24-ordens.csv', 'b');
    const todas = Object.values(dia.orders);
    for (const [id, t] of Object.entries(dia.trades)) {
      const trade = { ...t, id };
      expect(mirror.positionWasProtected(trade, todas)).toBe(positionWasProtected(trade, todas));
    }
  });
});
