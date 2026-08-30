/**
 * tradeInstantMirror.test.js — paridade ESM↔CJS para issue #402.
 *
 * O espelho CJS carrega a própria tabela de fusos (functions/ não tem módulo de
 * fuso). Esta suíte é o que impede a tabela de sair de sincronia com o
 * contrato do #292 em `src/utils/tradeTimezone.js`.
 */
import { describe, it, expect } from 'vitest';
import {
  tradeInstantInfo as esmInfo,
  tradeInstantMs as esmMs,
  compareTradesChrono as esmCompare,
  sortTradesChrono as esmSort,
  orderingConfidence as esmConfidence,
} from '../../../utils/tradeInstant';

const cjs = require('../../../../functions/shared/tradeInstant');

/** Tabela de casos exercitada pelos dois lados. */
const CASOS = [
  { nome: 'offset explícito BRT', trade: { entryTime: '2026-08-25T11:34:02-03:00', date: '2026-08-25' } },
  { nome: 'Z', trade: { entryTime: '2026-08-25T14:34:02Z', date: '2026-08-25' } },
  { nome: 'naive + B3', trade: { entryTime: '2026-08-25T10:51:01', date: '2026-08-25', exchange: 'B3' } },
  { nome: 'naive + NYSE verão (DST)', trade: { entryTime: '2026-07-15T09:30:00', date: '2026-07-15', exchange: 'NYSE' } },
  { nome: 'naive + NYSE inverno', trade: { entryTime: '2026-01-15T09:30:00', date: '2026-01-15', exchange: 'NYSE' } },
  { nome: 'naive + CME na virada do DST (março)', trade: { entryTime: '2026-03-08T09:30:00', date: '2026-03-08', exchange: 'CME' } },
  { nome: 'naive + CME um dia depois da virada', trade: { entryTime: '2026-03-09T09:30:00', date: '2026-03-09', exchange: 'CME' } },
  { nome: 'naive + virada de novembro', trade: { entryTime: '2026-11-01T09:30:00', date: '2026-11-01', exchange: 'CME' } },
  { nome: 'naive + ticker CME sem exchange', trade: { entryTime: '2026-07-15T09:30:00', date: '2026-07-15', ticker: 'MNQU26' } },
  { nome: 'naive herda fuso do exitTime', trade: { entryTime: '2026-07-15T09:30:00', exitTime: '2026-07-15T10:00:00-05:00', date: '2026-07-15', exchange: 'B3' } },
  { nome: 'sem entryTime — só data', trade: { date: '2026-08-25', exchange: 'B3' } },
  { nome: 'sem nada', trade: {} },
  { nome: 'entryTime malformado', trade: { entryTime: 'nao-e-data', date: '2026-08-25', exchange: 'B3' } },
  { nome: 'entryTime sem segundos', trade: { entryTime: '2026-08-25T10:51', date: '2026-08-25', exchange: 'B3' } },
];

describe('tradeInstant — paridade ESM↔CJS', () => {
  for (const { nome, trade } of CASOS) {
    it(`tradeInstantInfo: ${nome}`, () => {
      expect(cjs.tradeInstantInfo(trade)).toEqual(esmInfo(trade));
    });
  }

  it('tradeInstantMs bate em todos os casos', () => {
    for (const { trade } of CASOS) {
      expect(cjs.tradeInstantMs(trade)).toBe(esmMs(trade));
    }
  });

  it('tradeInstantMs aceita o campo exitTime nos dois lados', () => {
    const t = { entryTime: '2026-08-25T10:51:01-03:00', exitTime: '2026-08-25T11:01:20-03:00' };
    expect(cjs.tradeInstantMs(t, 'exitTime')).toBe(esmMs(t, 'exitTime'));
  });

  it('compareTradesChrono: mesmo sinal em todos os pares da tabela', () => {
    for (const a of CASOS) {
      for (const b of CASOS) {
        expect(Math.sign(cjs.compareTradesChrono(a.trade, b.trade)))
          .toBe(Math.sign(esmCompare(a.trade, b.trade)));
      }
    }
  });

  it('sortTradesChrono: mesma ordem no par real do incidente 25/08', () => {
    const A = { id: 'A', date: '2026-08-25', entryTime: '2026-08-25T10:51:01', exchange: 'B3', createdAt: { seconds: 1787678452 } };
    const B = { id: 'B', date: '2026-08-25', entryTime: '2026-08-25T11:34:02-03:00', exchange: 'B3', createdAt: { seconds: 1787678449 } };
    for (const entrada of [[A, B], [B, A]]) {
      expect(cjs.sortTradesChrono(entrada).map((t) => t.id))
        .toEqual(esmSort(entrada).map((t) => t.id));
      expect(cjs.sortTradesChrono(entrada).map((t) => t.id)).toEqual(['A', 'B']);
    }
  });

  it('createdAt em formatos diferentes resolve igual dos dois lados', () => {
    const base = { id: 'x', date: '2026-08-25' };
    const formatos = [
      { ...base, createdAt: { seconds: 100, nanoseconds: 500000000 } },
      { ...base, createdAt: new Date('2026-08-25T10:00:00Z') },
      { ...base, createdAt: 1787678452000 },
      { ...base, createdAt: '2026-08-25T10:00:00Z' },
      { ...base, createdAt: null },
    ];
    for (const a of formatos) {
      for (const b of formatos) {
        expect(Math.sign(cjs.compareTradesChrono(a, b))).toBe(Math.sign(esmCompare(a, b)));
      }
    }
  });

  it('orderingConfidence: mesmos veredictos', () => {
    const cenarios = [
      [],
      [CASOS[0].trade],
      [CASOS[2].trade, { entryTime: '2026-08-25T11:00:00', date: '2026-08-25', exchange: 'B3' }], // todos naive
      [CASOS[0].trade, CASOS[2].trade], // misturado
      [CASOS[0].trade, CASOS[10].trade], // um sem hora
      // #408 — empate ao segundo (caso Elza 22/05: duas entradas em MNQM6 às 11:37:15)
      [
        { entryTime: '2026-05-22T11:37:15-04:00', date: '2026-05-22' },
        { entryTime: '2026-05-22T11:37:15-04:00', date: '2026-05-22' },
      ],
    ];
    for (const c of cenarios) {
      expect(cjs.orderingConfidence(c)).toEqual(esmConfidence(c));
    }
  });
});
