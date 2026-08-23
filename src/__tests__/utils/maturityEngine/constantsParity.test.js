/**
 * #376 — paridade da régua entre front (ESM) e functions (CJS).
 *
 * A recalibração de 23/08 atualizou os thresholds nos DOIS arquivos, mas os `label`
 * só no front. O rótulo que o aluno lê vem do BACKEND — `evaluateGates` grava
 * `gates[].label` em `students/{uid}/maturity/current`, e as telas renderizam o valor
 * gravado. Resultado: 40 gates exibindo o número velho enquanto o motor cobrava o novo
 * ("Compliance ≥ 95%" na tela, 70 na conta). Ninguém quebrou — não havia teste.
 *
 * Este teste falha na próxima vez.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { GATES_BY_TRANSITION as FRONT } from '../../../utils/maturityEngine/constants';
import { REVOKED_RED_FLAG_TYPES as REVOGADAS_FRONT } from '../../../utils/violationFilter';

const require = createRequire(import.meta.url);
const { GATES_BY_TRANSITION: BACK } = require('../../../../functions/maturity/constants.js');
const { REVOKED_RED_FLAG_TYPES: REVOGADAS_BACK } = require('../../../../functions/maturity/violationFilter.js');

describe('#376 — régua front ↔ functions', () => {
  it('as duas tabelas cobrem exatamente as mesmas transições', () => {
    expect(Object.keys(BACK).sort()).toEqual(Object.keys(FRONT).sort());
  });

  for (const transicao of Object.keys(FRONT)) {
    it(`transição ${transicao}: mesmos gates, mesmo criterio, mesmo rotulo`, () => {
      const front = FRONT[transicao];
      const back = BACK[transicao];
      expect(back.map((g) => g.id)).toEqual(front.map((g) => g.id));

      for (const g of front) {
        const b = back.find((x) => x.id === g.id);
        // o que o motor cobra
        expect({ id: g.id, metric: b.metric, op: b.op, threshold: b.threshold })
          .toEqual({ id: g.id, metric: g.metric, op: g.op, threshold: g.threshold });
        // o que o aluno lê — o campo que divergiu silenciosamente
        expect(`${g.id}: ${b.label}`).toBe(`${g.id}: ${g.label}`);
      }
    });
  }
});

describe('#376 — lista de violações revogadas em paridade', () => {
  it('front e functions revogam exatamente as mesmas', () => {
    // Se divergir, o aluno e o motor de maturidade discordam sobre o que é violação.
    expect([...REVOGADAS_BACK].sort()).toEqual([...REVOGADAS_FRONT].sort());
  });
});
