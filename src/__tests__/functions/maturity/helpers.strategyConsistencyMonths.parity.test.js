/**
 * #416 C2 — paridade ESM ↔ CJS de `computeStrategyConsistencyMonths`.
 *
 * A métrica alimenta o gate `strategy-12-months`, e quem GRAVA o resultado em
 * `students/{uid}/maturity/current` é a Cloud Function (CJS). O front recalcula o mesmo
 * número em tela. Divergir aqui é o defeito do #376 outra vez: o motor cobrando um
 * número e a tela mostrando outro. Mesmo fixture, mesmo `now`, mesmo valor.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { computeStrategyConsistencyMonths as FRONT } from '../../../utils/maturityEngine/helpers';
import { RISK_FIELDS as RISK_FRONT } from '../../../utils/planRiskFields';

const require = createRequire(import.meta.url);
const {
  computeStrategyConsistencyMonths: BACK,
  RISK_FIELDS: RISK_BACK,
} = require('../../../../functions/maturity/helpers.js');

const NOW = new Date('2026-09-15T12:00:00Z');
const opts = { now: NOW };

const ts = (iso) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) });

const FIXTURES = [
  ['sem plano', []],
  ['plano nulo na lista', [null]],
  ['sem editHistory, createdAt Timestamp', [
    { id: 'p1', active: true, createdAt: ts('2026-03-15T00:00:00Z') },
  ]],
  ['mudança de rrTarget há 3 meses', [
    { id: 'p1', active: true, createdAt: ts('2025-01-01T00:00:00Z'),
      editHistory: [{ by: 'student', fields: ['rrTarget'], timestamp: '2026-06-15T10:00:00.000Z' }] },
  ]],
  ['campo não-risco recente + risco antigo', [
    { id: 'p1', active: true, createdAt: ts('2025-01-01T00:00:00Z'),
      editHistory: [
        { by: 'mentor', fields: ['riskPerOperation'], timestamp: '2026-01-15T10:00:00.000Z' },
        { by: 'student', fields: ['notes'], timestamp: '2026-08-15T10:00:00.000Z' },
      ] },
  ]],
  ['dois planos ativos → o menor', [
    { id: 'p1', active: true, createdAt: ts('2025-01-01T00:00:00Z'),
      editHistory: [{ by: 'student', fields: ['cycleStop'], timestamp: '2026-02-15T10:00:00.000Z' }] },
    { id: 'p2', active: true, createdAt: ts('2025-01-01T00:00:00Z'),
      editHistory: [{ by: 'student', fields: ['periodStop'], timestamp: '2026-07-15T10:00:00.000Z' }] },
  ]],
  ['plano inativo fora da conta', [
    { id: 'p1', active: true, createdAt: ts('2026-03-15T00:00:00Z') },
    { id: 'p2', active: false, createdAt: ts('2026-09-10T00:00:00Z') },
  ]],
  ['datas em todas as formas', [
    { id: 'p1', active: true, createdAt: Date.parse('2026-03-15T00:00:00Z') },
    { id: 'p2', active: true, createdAt: new Date('2026-02-15T00:00:00Z') },
    { id: 'p3', active: true, createdAt: '15/01/2026' },
    { id: 'p4', active: true, createdAt: { seconds: Date.parse('2026-04-15T00:00:00Z') / 1000 } },
  ]],
  ['lixo em timestamp e editHistory', [
    { id: 'p1', active: true, createdAt: ts('2026-03-15T00:00:00Z'),
      editHistory: [null, 42, { fields: 'rrTarget' }, { fields: ['rrTarget'], timestamp: 'não é data' }] },
  ]],
  ['sem data utilizável', [{ id: 'p1', active: true }]],
];

describe('#416 C2 — front ↔ functions produzem o mesmo número', () => {
  it('RISK_FIELDS em paridade', () => {
    // A lista mora em src/utils/planRiskFields.js; functions/ espelha porque é deployado
    // sozinho. Se divergir, o gate e o recálculo de compliance discordam do que é risco.
    expect([...RISK_BACK]).toEqual([...RISK_FRONT]);
  });

  for (const [nome, plans] of FIXTURES) {
    it(`mesmo valor: ${nome}`, () => {
      const front = FRONT(plans, opts);
      const back = BACK(plans, opts);
      expect(typeof front).toBe('number');
      expect(back).toBe(front);
    });
  }

  it('sem `now` injetado, os dois usam o relógio e continuam iguais', () => {
    const plans = [{ id: 'p1', active: true, createdAt: ts('2025-03-15T00:00:00Z') }];
    expect(BACK(plans)).toBe(FRONT(plans));
  });
});
