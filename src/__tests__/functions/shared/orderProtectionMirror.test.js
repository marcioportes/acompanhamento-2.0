/**
 * orderProtectionMirror.test.js — paridade ESM↔CJS da definição de proteção (#466, épico #462 F3).
 *
 * `src/utils/orderProtection.js` (import, reconstrução, motor do cliente) e
 * `functions/shared/orderProtection.js` (espelho da CF) têm o CORPO idêntico — só o
 * cabeçalho, o import e o export mudam. Esta suíte trava o texto e o resultado.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as esm from '../../../utils/orderProtection';

const cjs = require('../../../../functions/shared/orderProtection');

const RAIZ = resolve(__dirname, '../../../..');
const corpo = (arquivo, fim) => {
  const s = readFileSync(resolve(RAIZ, arquivo), 'utf-8');
  return s.slice(s.indexOf('/** Janela do bracket'), s.indexOf(fim)).trim();
};

const ordem = (id, side, hora, extra = {}) => ({
  externalOrderId: id,
  instrument: 'WINV26',
  side,
  quantity: 5,
  status: 'CANCELLED',
  submittedAt: `2026-09-24T${hora}`,
  origin: 'Estratégia',
  ...extra,
});

// O 24/09/2026 (épico #462): venda de 10 em duas pernas.
const OPERACAO = {
  instrument: 'WINV26',
  side: 'SHORT',
  avgEntryPrice: 185185,
  entryTime: '2026-09-24T15:52:21-03:00',
  exitTime: '2026-09-24T17:40:14-03:00',
  entryOrders: [
    ordem('E1', 'SELL', '15:52:19', { status: 'FILLED', filledAt: '2026-09-24T15:52:21', filledPrice: 185070, filledQuantity: 5, origin: 'Gráfico' }),
    ordem('E2', 'SELL', '15:49:44', { status: 'FILLED', filledAt: '2026-09-24T16:24:31', filledPrice: 185300, filledQuantity: 5, origin: 'Gráfico' }),
  ],
  exitOrders: [
    ordem('X1', 'BUY', '15:52:21', { status: 'FILLED', limitPrice: 185135, filledPrice: 184985, filledAt: '2026-09-24T17:40:14' }),
    ordem('X2', 'BUY', '16:24:31', { status: 'FILLED', limitPrice: 184800, filledPrice: 184800, filledAt: '2026-09-24T17:21:04' }),
  ],
  stopOrders: [
    ordem('S2', 'BUY', '16:24:31', { stopPrice: 185280, limitPrice: 185430, isStopOrder: true, cancelledAt: '2026-09-24T17:21:04' }),
  ],
  cancelledOrders: [
    ordem('T1', 'BUY', '15:52:21', { limitPrice: 184570, cancelledAt: '2026-09-24T17:40:14' }),
    ordem('V1', 'BUY', '14:39:47', { stopPrice: 188720, isStopOrder: true, cancelledAt: '2026-09-24T15:08:14', origin: 'Gráfico' }),
  ],
};

const TODAS = [
  ...OPERACAO.exitOrders, ...OPERACAO.stopOrders, ...OPERACAO.cancelledOrders,
  ordem('Z', 'BUY', '17:00:00', { origin: 'Zeragem', limitPrice: 185900 }),
  ordem('M', 'BUY', '15:52:30', { origin: 'SuperDOM', limitPrice: 185500 }),
  ordem('O', 'BUY', '15:52:30', { instrument: 'WINV26C190000', stopPrice: 190000, isStopOrder: true }),
];

describe('#466 · orderProtection — paridade ESM↔CJS', () => {
  it('o corpo dos dois arquivos é o mesmo texto', () => {
    expect(corpo('src/utils/orderProtection.js', '\nexport {'))
      .toBe(corpo('functions/shared/orderProtection.js', '\nmodule.exports = {'));
  });

  it('exportam as mesmas funções', () => {
    expect(Object.keys(esm).sort()).toEqual(Object.keys(cjs).sort());
  });

  it('pernas, proteção por perna e stop do trade batem', () => {
    for (const ctx of [undefined, { offset: '-03:00' }, { offset: '-03:00', pointValue: 0.2 }]) {
      expect(cjs.legsOf(OPERACAO, ctx)).toEqual(esm.legsOf(OPERACAO, ctx));
      expect(cjs.tradeStopFromLegs(OPERACAO, undefined, ctx)).toEqual(esm.tradeStopFromLegs(OPERACAO, undefined, ctx));
      const legs = esm.legsOf(OPERACAO, ctx);
      for (const o of TODAS) {
        expect(cjs.sentPriceOf(o)).toBe(esm.sentPriceOf(o));
        expect(cjs.baseRejectionOf(o, OPERACAO)).toBe(esm.baseRejectionOf(o, OPERACAO));
        expect(cjs.isPositionProtection(o, OPERACAO, ctx)).toBe(esm.isPositionProtection(o, OPERACAO, ctx));
        for (const leg of legs) {
          expect(cjs.legRejectionOf(o, leg, OPERACAO, ctx)).toBe(esm.legRejectionOf(o, leg, OPERACAO, ctx));
          expect(cjs.isProtectionOfLeg(o, leg, OPERACAO, ctx)).toBe(esm.isProtectionOfLeg(o, leg, OPERACAO, ctx));
        }
      }
    }
  });
});
