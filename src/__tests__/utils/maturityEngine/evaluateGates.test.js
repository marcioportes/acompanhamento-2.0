import { describe, it, expect } from 'vitest';
import { evaluateGates } from '../../../utils/maturityEngine/evaluateGates';
import { GATES_BY_TRANSITION } from '../../../utils/maturityEngine/constants';

// Shape completo de métricas usado por 1→2, todos no limiar do passa/não-passa.
// #376 — as fixtures DERIVAM da tabela de gates, não repetem os números.
//
// Antes elas eram literais copiados da régua ("E: 55, F: 70, complianceRate: 95..."),
// então toda recalibração quebrava este arquivo — que testa o AVALIADOR, não a régua.
// Na relaxada de 23/08 sete testes caíram sem que o avaliador tivesse mudado nada.
// Agora o valor que passa e o que falha saem do próprio `GATES_BY_TRANSITION`.
const metricasQue = (transicao, passa) => {
  const out = {};
  for (const g of GATES_BY_TRANSITION[transicao] || []) {
    const t = g.threshold;
    if (typeof t === 'boolean') { out[g.metric] = passa ? t : !t; continue; }
    const folga = Math.max(Math.abs(t) * 0.2, 1);
    if (g.op === '>=' || g.op === '>') out[g.metric] = passa ? t + folga : t - folga;
    else if (g.op === '<=' || g.op === '<') out[g.metric] = passa ? Math.max(0, t - folga) : t + folga;
    else out[g.metric] = passa ? t : t + folga;
  }
  return out;
};

const metrics12AllMet = metricasQue('1-2', true);
const metrics12AllMissed = metricasQue('1-2', false);
const metrics23AllMet = metricasQue('2-3', true);
const metrics23AllMissed = metricasQue('2-3', false);
const metrics34AllMet = metricasQue('3-4', true);
const metrics34AllMissed = metricasQue('3-4', false);
const metrics45AllMet = metricasQue('4-5', true);
const metrics45AllMissed = metricasQue('4-5', false);

describe('evaluateGates — transições', () => {
  it('stage 1 com todas métricas no limiar → todos os 6 gates met', () => {
    const out = evaluateGates(1, metrics12AllMet);
    expect(out.transition).toBe('1-2');
    expect(out.gatesTotal).toBe(7);
    expect(out.gatesMet).toBe(7);
    expect(out.gatesRatio).toBe(1);
    expect(out.mastery).toBe(false);
    expect(out.gates.every((g) => g.met === true)).toBe(true);
    expect(out.gates.every((g) => g.gap === 0)).toBe(true);
  });

  it('stage 1 com métricas abaixo → todos os 6 gates falham com gap positivo', () => {
    const out = evaluateGates(1, metrics12AllMissed);
    expect(out.transition).toBe('1-2');
    expect(out.gatesMet).toBe(0);
    expect(out.gatesTotal).toBe(7);
    expect(out.gatesRatio).toBe(0);
    expect(out.gates.every((g) => g.met === false)).toBe(true);
    expect(out.gates.every((g) => typeof g.gap === 'number' && g.gap > 0)).toBe(true);
  });

  it('stage 2 com todas métricas no limiar → todos os 8 gates met', () => {
    const out = evaluateGates(2, metrics23AllMet);
    expect(out.transition).toBe('2-3');
    expect(out.gatesTotal).toBe(9);
    expect(out.gatesMet).toBe(9);
    expect(out.gatesRatio).toBe(1);
  });

  it('stage 2 com métricas abaixo → nenhum gate met', () => {
    const out = evaluateGates(2, metrics23AllMissed);
    expect(out.transition).toBe('2-3');
    expect(out.gatesTotal).toBe(9);
    expect(out.gatesMet).toBe(0);
    expect(out.gates.every((g) => g.met === false)).toBe(true);
  });

  it('stage 3 com todas métricas no limiar → todos os 13 gates met', () => {
    const out = evaluateGates(3, metrics34AllMet);
    expect(out.transition).toBe('3-4');
    expect(out.gatesTotal).toBe(14);
    expect(out.gatesMet).toBe(14);
    expect(out.gatesRatio).toBe(1);
  });

  it('stage 3 com métricas abaixo → nenhum gate met', () => {
    const out = evaluateGates(3, metrics34AllMissed);
    expect(out.transition).toBe('3-4');
    expect(out.gatesTotal).toBe(14);
    expect(out.gatesMet).toBe(0);
  });

  it('stage 4 com todas métricas no limiar → todos os 9 gates met', () => {
    const out = evaluateGates(4, metrics45AllMet);
    expect(out.transition).toBe('4-5');
    expect(out.gatesTotal).toBe(10);
    expect(out.gatesMet).toBe(10);
    expect(out.gatesRatio).toBe(1);
  });

  it('stage 4 com métricas abaixo → nenhum gate met', () => {
    const out = evaluateGates(4, metrics45AllMissed);
    expect(out.transition).toBe('4-5');
    expect(out.gatesTotal).toBe(10);
    expect(out.gatesMet).toBe(0);
  });
});

describe('evaluateGates — métricas ausentes (METRIC_UNAVAILABLE)', () => {
  it('gate com value undefined/null → met=null, reason, gap=null; não conta em gatesMet', () => {
    const metrics = {
      // faltam maxDDPercent (undefined) e E (null); demais presentes e met
      complianceRate: 80,
      E: null,
      journalRate: 0.50,
      stopUsageRate: 0.80,
      planAdherence: 70,
    };
    const out = evaluateGates(1, metrics);
    expect(out.gatesTotal).toBe(7);
    expect(out.gatesMet).toBe(4);
    expect(out.gatesRatio).toBeCloseTo(4 / 7, 6);

    const maxdd = out.gates.find((g) => g.id === 'maxdd-under-20');
    expect(maxdd.met).toBeNull();
    expect(maxdd.reason).toBe('METRIC_UNAVAILABLE');
    expect(maxdd.gap).toBeNull();
    expect(maxdd.value).toBeNull();

    const emo = out.gates.find((g) => g.id === 'emotional-out-of-fragile');
    expect(emo.met).toBeNull();
    expect(emo.reason).toBe('METRIC_UNAVAILABLE');
  });

  it('metrics undefined inteiro → todos os gates retornam met=null', () => {
    const out = evaluateGates(2, undefined);
    expect(out.transition).toBe('2-3');
    expect(out.gatesTotal).toBe(9);
    expect(out.gatesMet).toBe(0);
    expect(out.gates.every((g) => g.met === null)).toBe(true);
    expect(out.gates.every((g) => g.reason === 'METRIC_UNAVAILABLE')).toBe(true);
    expect(out.gatesRatio).toBe(0);
  });
});

describe('evaluateGates — operadores específicos', () => {
  it('operador <= com value igual ao threshold → met=true, gap=0 (maxDDPercent=20)', () => {
    const out = evaluateGates(1, { ...metrics12AllMet, maxDDPercent: 20 });
    const gate = out.gates.find((g) => g.id === 'maxdd-under-20');
    expect(gate.met).toBe(true);
    expect(gate.gap).toBe(0);
  });

  it('operador < com value igual ao threshold → met=false (valor == teto falha em <)', () => {
    const teto = GATES_BY_TRANSITION['4-5'].find((g) => g.id === 'cv-low').threshold;
    const out = evaluateGates(4, { ...metrics45AllMet, cv: teto });
    const gate = out.gates.find((g) => g.id === 'cv-low');
    expect(gate.met).toBe(false);
    expect(gate.gap).toBe(0); // value - threshold = 0 (ε=0)
  });

  it('operador == booleano: true/false/undefined em advancedMetricsPresent', () => {
    const outTrue = evaluateGates(3, { ...metrics34AllMet, advancedMetricsPresent: true });
    expect(outTrue.gates.find((g) => g.id === 'advanced-metrics').met).toBe(true);

    const outFalse = evaluateGates(3, { ...metrics34AllMet, advancedMetricsPresent: false });
    const gateFalse = outFalse.gates.find((g) => g.id === 'advanced-metrics');
    expect(gateFalse.met).toBe(false);
    expect(gateFalse.gap).toBe(1); // sentinel

    const outUnd = evaluateGates(3, { ...metrics34AllMet, advancedMetricsPresent: undefined });
    const gateUnd = outUnd.gates.find((g) => g.id === 'advanced-metrics');
    expect(gateUnd.met).toBeNull();
    expect(gateUnd.reason).toBe('METRIC_UNAVAILABLE');
  });

  it('operador >= com value exatamente igual ao threshold → met=true, gap=0 (E=55 em 2→3)', () => {
    const out = evaluateGates(2, { ...metrics23AllMet, E: 55 });
    const gate = out.gates.find((g) => g.id === 'emotional-55');
    expect(gate.met).toBe(true);
    expect(gate.gap).toBe(0);
  });

  it('operador >= com value abaixo → gap = threshold - value', () => {
    const teto = GATES_BY_TRANSITION['2-3'].find((g) => g.id === 'emotional-55').threshold;
    const out = evaluateGates(2, { ...metrics23AllMet, E: teto - 15 });
    const gate = out.gates.find((g) => g.id === 'emotional-55');
    expect(gate.met).toBe(false);
    expect(gate.gap).toBe(15);
  });

  it('operador == numérico: tiltRevengeCount=0 → met=true; =3 → met=false gap=1', () => {
    const outZero = evaluateGates(4, { ...metrics45AllMet, tiltRevengeCount: 0 });
    const gZero = outZero.gates.find((g) => g.id === 'zero-tilt-revenge');
    expect(gZero.met).toBe(true);
    expect(gZero.gap).toBe(0);

    // #376 — o gate deixou de exigir ZERO e passou a tolerar 1 episódio.
    const outThree = evaluateGates(4, { ...metrics45AllMet, tiltRevengeCount: 3 });
    const gThree = outThree.gates.find((g) => g.id === 'zero-tilt-revenge');
    expect(gThree.met).toBe(false);
    expect(gThree.gap).toBe(2);
  });

  // #376 — teto relaxado de 20% para 25% na régua de 23/08.
  it('operador <= com value acima → gap = value - threshold (maxDDPercent=30 vs <=25 → gap=5)', () => {
    const out = evaluateGates(1, { ...metrics12AllMet, maxDDPercent: 30 });
    const gate = out.gates.find((g) => g.id === 'maxdd-under-20');
    expect(gate.met).toBe(false);
    expect(gate.gap).toBe(5);
  });
});

describe('evaluateGates — stages inválidos / mastery', () => {
  it('stageCurrent=5 → mastery=true, gates vazio, transition=null', () => {
    const out = evaluateGates(5, metrics45AllMet);
    expect(out.mastery).toBe(true);
    expect(out.transition).toBeNull();
    expect(out.gates).toEqual([]);
    expect(out.gatesTotal).toBe(0);
    expect(out.gatesMet).toBe(0);
    expect(out.gatesRatio).toBeNull();
  });

  it('stageCurrent=6 (fora da faixa) → estrutura vazia, mastery=false', () => {
    const out = evaluateGates(6, metrics12AllMet);
    expect(out.mastery).toBe(false);
    expect(out.transition).toBeNull();
    expect(out.gates).toEqual([]);
    expect(out.gatesTotal).toBe(0);
    expect(out.gatesRatio).toBeNull();
  });

  it('stageCurrent=0 (fora da faixa) → estrutura vazia, mastery=false', () => {
    const out = evaluateGates(0, metrics12AllMet);
    expect(out.mastery).toBe(false);
    expect(out.transition).toBeNull();
    expect(out.gates).toEqual([]);
  });

  it('stageCurrent não-inteiro (1.5, NaN, string) → estrutura vazia, mastery=false', () => {
    expect(evaluateGates(1.5, metrics12AllMet).transition).toBeNull();
    expect(evaluateGates(NaN, metrics12AllMet).transition).toBeNull();
    expect(evaluateGates('2', metrics23AllMet).transition).toBeNull();
  });
});

describe('evaluateGates — ordem determinística preservada', () => {
  it('primeira entrada de cada transição segue §3.1 D9', () => {
    const out12 = evaluateGates(1, metrics12AllMet);
    expect(out12.gates[0].id).toBe('maxdd-under-20');

    const out23 = evaluateGates(2, metrics23AllMet);
    expect(out23.gates[0].id).toBe('emotional-55');

    const out34 = evaluateGates(3, metrics34AllMet);
    expect(out34.gates[0].id).toBe('emotional-75');

    const out45 = evaluateGates(4, metrics45AllMet);
    expect(out45.gates[0].id).toBe('emotional-85');
  });

  it('ordem dos gates retornada equivale à ordem em GATES_BY_TRANSITION', () => {
    const out = evaluateGates(3, metrics34AllMet);
    const expectedIds = GATES_BY_TRANSITION['3-4'].map((g) => g.id);
    const actualIds = out.gates.map((g) => g.id);
    expect(actualIds).toEqual(expectedIds);
  });
});

describe('evaluateGates — agregação gatesRatio', () => {
  it('gatesRatio reflete a fração cumprida — metade dos gates', () => {
    // #376 — derivado da tabela: metade dos gates com valor que passa, metade com valor
    // que falha. Antes eram seis literais da régua de 1-2, que a recalibração invalidou.
    const gates = GATES_BY_TRANSITION['1-2'];
    const metade = Math.floor(gates.length / 2);
    const passa = metricasQue('1-2', true);
    const falha = metricasQue('1-2', false);
    const partial = {};
    gates.forEach((g, i) => { partial[g.metric] = i < metade ? passa[g.metric] : falha[g.metric]; });
    const out = evaluateGates(1, partial);
    expect(out.gatesMet).toBe(metade);
    expect(out.gatesRatio).toBeCloseTo(metade / gates.length, 5);
  });

  it('mix met/missed/null: gatesMet conta só true, gatesTotal inclui null (visibilidade)', () => {
    const partial = {
      maxDDPercent: 20,      // met
      complianceRate: null,  // null
      E: 20,                 // miss
      journalRate: 0.50,     // met
      stopUsageRate: 0.80,   // met
      planAdherence: 70,     // met
    };
    const out = evaluateGates(1, partial);
    expect(out.gatesTotal).toBe(7);
    expect(out.gatesMet).toBe(4);
    expect(out.gatesRatio).toBeCloseTo(4 / 7, 6);
    const nullGate = out.gates.find((g) => g.metric === 'complianceRate');
    expect(nullGate.met).toBeNull();
  });
});

/**
 * #376 — cobertura de fronteira.
 *
 * As fixtures derivadas usam folga dos dois lados, então nenhum caso cai EXATAMENTE
 * em cima do threshold — e é esse caso que distingue `>=` de `>` e `<=` de `<`. Sem
 * ele, inverter um operador passaria verde. Aqui o valor testado é o próprio limite,
 * lido da tabela, um gate de cada operador.
 */
describe('#376 — valor exatamente no limite', () => {
  const gateDe = (transicao, id) => GATES_BY_TRANSITION[transicao].find((g) => g.id === id);

  it('>= no limite → met (o gate aceita o valor exato)', () => {
    const g = gateDe('2-3', 'emotional-55');
    const out = evaluateGates(2, { ...metrics23AllMet, [g.metric]: g.threshold });
    expect(g.op).toBe('>=');
    expect(out.gates.find((x) => x.id === g.id).met).toBe(true);
  });

  it('<= no limite → met', () => {
    const g = gateDe('2-3', 'rule-violation-rate-15');
    const out = evaluateGates(2, { ...metrics23AllMet, [g.metric]: g.threshold });
    expect(g.op).toBe('<=');
    expect(out.gates.find((x) => x.id === g.id).met).toBe(true);
  });

  it('< no limite → NÃO met (fronteira exclusiva)', () => {
    const g = gateDe('4-5', 'cv-low');
    const out = evaluateGates(4, { ...metrics45AllMet, [g.metric]: g.threshold });
    expect(g.op).toBe('<');
    expect(out.gates.find((x) => x.id === g.id).met).toBe(false);
  });

  it('um passo abaixo do limite em >= → NÃO met', () => {
    const g = gateDe('2-3', 'emotional-55');
    const out = evaluateGates(2, { ...metrics23AllMet, [g.metric]: g.threshold - 0.01 });
    expect(out.gates.find((x) => x.id === g.id).met).toBe(false);
  });
});
