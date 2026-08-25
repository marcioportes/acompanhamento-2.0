/**
 * dayStateMirror.test.js — paridade ESM↔CJS para issue #402.
 *
 * O espelho CJS reimplementa `getPeriodKey` (o original é ESM em
 * planStateMachine). Esta suíte é o que impede as duas bucketizações de
 * divergirem — em particular na semana ISO.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPeriodState as esmState,
  buildPeriodIndex as esmIndex,
  authorizationFor as esmAuth,
  AUTHORIZATION as ESM_AUTH,
} from '../../../utils/dayState';

const cjs = require('../../../../functions/shared/dayState');

const PLANO = {
  pl: 30000,
  riskPerOperation: 0.84,
  periodStop: 1.67,
  periodGoal: 3.35,
  operationPeriod: 'Diário',
};

const t = (id, date, hora, result, extra = {}) => ({
  id,
  date,
  entryTime: `${date}T${hora}-03:00`,
  exchange: 'B3',
  result,
  qty: 1,
  ...extra,
});

/** O par real do incidente 25/08, com createdAt invertido e offsets misturados. */
const A = { id: 'A', date: '2026-08-25', entryTime: '2026-08-25T10:51:01', exchange: 'B3', result: -250, qty: 5, createdAt: { seconds: 1787678452 } };
const B = { id: 'B', date: '2026-08-25', entryTime: '2026-08-25T11:34:02-03:00', exchange: 'B3', result: -265, qty: 5, createdAt: { seconds: 1787678449 } };

const CENARIOS = [
  { nome: 'incidente 25/08 fora de ordem', trades: [B, A], plan: PLANO },
  { nome: 'dia lucrativo com perdas grandes', trades: [t('a', '2026-08-25', '09:00:00', 1000), t('b', '2026-08-25', '10:00:00', -600), t('c', '2026-08-25', '11:00:00', -300)], plan: PLANO },
  { nome: 'apos stop', trades: [t('a', '2026-08-25', '09:00:00', -300), t('b', '2026-08-25', '10:00:00', -250), t('c', '2026-08-25', '11:00:00', -100)], plan: PLANO },
  { nome: 'meta atingida', trades: [t('a', '2026-08-25', '09:00:00', 600), t('b', '2026-08-25', '10:00:00', 500)], plan: PLANO },
  { nome: 'vazio', trades: [], plan: PLANO },
  { nome: 'sem plano', trades: [A, B], plan: null },
  { nome: 'pl zero', trades: [A], plan: { ...PLANO, pl: 0 } },
  { nome: 'periodStop zero', trades: [A], plan: { ...PLANO, periodStop: 0 } },
  { nome: 'riskPerOperation zero', trades: [t('a', '2026-08-25', '09:00:00', -600), t('b', '2026-08-25', '10:00:00', -10)], plan: { ...PLANO, riskPerOperation: 0 } },
  { nome: 'RO maior que o stop', trades: [t('a', '2026-08-25', '09:00:00', -50)], plan: { ...PLANO, riskPerOperation: 2.0 } },
  { nome: 'result ausente', trades: [{ id: 'x', date: '2026-08-25', entryTime: '2026-08-25T09:00:00-03:00' }], plan: PLANO },
  { nome: 'sem entryTime', trades: [t('a', '2026-08-25', '09:00:00', -10), { id: 'z', date: '2026-08-25', result: -10 }], plan: PLANO },
];

describe('dayState — paridade ESM↔CJS', () => {
  it('AUTHORIZATION tem os mesmos valores', () => {
    expect(cjs.AUTHORIZATION).toEqual(ESM_AUTH);
  });

  for (const { nome, trades, plan } of CENARIOS) {
    it(`buildPeriodState: ${nome}`, () => {
      expect(cjs.buildPeriodState(trades, plan)).toEqual(esmState(trades, plan));
    });
  }

  it('cushionPolicy floor bate nos dois lados', () => {
    const trades = [t('a', '2026-08-25', '09:00:00', 1000), t('b', '2026-08-25', '10:00:00', -100)];
    expect(cjs.buildPeriodState(trades, PLANO, { cushionPolicy: 'floor' }))
      .toEqual(esmState(trades, PLANO, { cushionPolicy: 'floor' }));
  });

  it('buildPeriodIndex diário: mesmas chaves e mesmos estados', () => {
    const trades = [A, B, t('d', '2026-08-26', '09:00:00', -100)];
    const cjsIdx = cjs.buildPeriodIndex(trades, PLANO);
    const esm = esmIndex(trades, PLANO);
    expect([...cjsIdx.keys()].sort()).toEqual([...esm.keys()].sort());
    for (const k of esm.keys()) expect(cjsIdx.get(k)).toEqual(esm.get(k));
  });

  it('buildPeriodIndex semanal: a semana ISO bate (segunda como âncora)', () => {
    // 24/08/2026 é segunda; 26/08 é quarta; 31/08 é a segunda seguinte.
    const trades = [
      t('seg', '2026-08-24', '09:00:00', -10),
      t('qua', '2026-08-26', '09:00:00', -20),
      t('dom', '2026-08-30', '09:00:00', -30),
      t('prox', '2026-08-31', '09:00:00', -40),
    ];
    const plano = { ...PLANO, operationPeriod: 'Semanal' };
    const cjsIdx = cjs.buildPeriodIndex(trades, plano);
    const esm = esmIndex(trades, plano);
    expect([...cjsIdx.keys()].sort()).toEqual([...esm.keys()].sort());
    expect(esm.size).toBe(2);
    for (const k of esm.keys()) expect(cjsIdx.get(k)).toEqual(esm.get(k));
  });

  it('authorizationFor bate', () => {
    const ps = esmState([B, A], PLANO);
    const psCjs = cjs.buildPeriodState([B, A], PLANO);
    expect(cjs.authorizationFor(A, psCjs)).toEqual(esmAuth(A, ps));
    expect(cjs.authorizationFor({ id: 'nao-existe' }, psCjs)).toEqual(esmAuth({ id: 'nao-existe' }, ps));
  });
});
