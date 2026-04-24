import { describe, it, expect } from 'vitest';
import { evaluateGates } from '../../../utils/maturityEngine/evaluateGates';
import { GATES_BY_TRANSITION } from '../../../utils/maturityEngine/constants';

// Shape completo de métricas usado por 1→2, todos no limiar do passa/não-passa.
const metrics12AllMet = {
  maxDDPercent: 20,        // <= 20 → met
  complianceRate: 80,      // >= 80 → met
  E: 30,                   // >= 30 → met
  journalRate: 0.50,       // >= 0.50 → met
  stopUsageRate: 0.80,     // >= 0.80 → met
  planAdherence: 70,       // >= 70 → met
};

const metrics12AllMissed = {
  maxDDPercent: 25,
  complianceRate: 50,
  E: 20,
  journalRate: 0.30,
  stopUsageRate: 0.60,
  planAdherence: 50,
};

const metrics23AllMet = {
  E: 55,
  F: 70,
  O: 65,
  strategyConsWks: 8,
  journalRate: 0.90,
  complianceRate: 95,
  winRate: 45,
  payoff: 1.2,
};

const metrics23AllMissed = {
  E: 40,
  F: 50,
  O: 40,
  strategyConsWks: 4,
  journalRate: 0.50,
  complianceRate: 80,
  winRate: 30,
  payoff: 0.8,
};

const metrics34AllMet = {
  E: 75,
  F: 85,
  O: 80,
  strategyConsMonths: 12,
  advancedMetricsPresent: true,
  complianceRate100: 100,
  winRate: 55,
  payoff: 2.0,
  maxDDPercent: 5,
  monthlySharpe: 1.2,
};

const metrics34AllMissed = {
  E: 60,
  F: 70,
  O: 65,
  strategyConsMonths: 6,
  advancedMetricsPresent: false,
  complianceRate100: 90,
  winRate: 45,
  payoff: 1.5,
  maxDDPercent: 10,
  monthlySharpe: 0.8,
};

const metrics45AllMet = {
  E: 85,
  F: 90,
  payoff: 2.5,
  winRate: 55,
  maxDDPercent: 3,
  cv: 0.4,                  // < 0.5 → met
  tiltRevengeCount: 0,      // == 0 → met
  annualizedReturn: 15,
  annualSharpe: 1.5,
};

const metrics45AllMissed = {
  E: 70,
  F: 80,
  payoff: 2.0,
  winRate: 50,
  maxDDPercent: 5,
  cv: 0.8,
  tiltRevengeCount: 3,
  annualizedReturn: 10,
  annualSharpe: 1.0,
};

describe('evaluateGates — transições', () => {
  it('stage 1 com todas métricas no limiar → todos os 6 gates met', () => {
    const out = evaluateGates(1, metrics12AllMet);
    expect(out.transition).toBe('1-2');
    expect(out.gatesTotal).toBe(6);
    expect(out.gatesMet).toBe(6);
    expect(out.gatesRatio).toBe(1);
    expect(out.mastery).toBe(false);
    expect(out.gates.every((g) => g.met === true)).toBe(true);
    expect(out.gates.every((g) => g.gap === 0)).toBe(true);
  });

  it('stage 1 com métricas abaixo → todos os 6 gates falham com gap positivo', () => {
    const out = evaluateGates(1, metrics12AllMissed);
    expect(out.transition).toBe('1-2');
    expect(out.gatesMet).toBe(0);
    expect(out.gatesTotal).toBe(6);
    expect(out.gatesRatio).toBe(0);
    expect(out.gates.every((g) => g.met === false)).toBe(true);
    expect(out.gates.every((g) => typeof g.gap === 'number' && g.gap > 0)).toBe(true);
  });

  it('stage 2 com todas métricas no limiar → todos os 8 gates met', () => {
    const out = evaluateGates(2, metrics23AllMet);
    expect(out.transition).toBe('2-3');
    expect(out.gatesTotal).toBe(8);
    expect(out.gatesMet).toBe(8);
    expect(out.gatesRatio).toBe(1);
  });

  it('stage 2 com métricas abaixo → nenhum gate met', () => {
    const out = evaluateGates(2, metrics23AllMissed);
    expect(out.transition).toBe('2-3');
    expect(out.gatesTotal).toBe(8);
    expect(out.gatesMet).toBe(0);
    expect(out.gates.every((g) => g.met === false)).toBe(true);
  });

  it('stage 3 com todas métricas no limiar → todos os 10 gates met', () => {
    const out = evaluateGates(3, metrics34AllMet);
    expect(out.transition).toBe('3-4');
    expect(out.gatesTotal).toBe(10);
    expect(out.gatesMet).toBe(10);
    expect(out.gatesRatio).toBe(1);
  });

  it('stage 3 com métricas abaixo → nenhum gate met', () => {
    const out = evaluateGates(3, metrics34AllMissed);
    expect(out.transition).toBe('3-4');
    expect(out.gatesTotal).toBe(10);
    expect(out.gatesMet).toBe(0);
  });

  it('stage 4 com todas métricas no limiar → todos os 9 gates met', () => {
    const out = evaluateGates(4, metrics45AllMet);
    expect(out.transition).toBe('4-5');
    expect(out.gatesTotal).toBe(9);
    expect(out.gatesMet).toBe(9);
    expect(out.gatesRatio).toBe(1);
  });

  it('stage 4 com métricas abaixo → nenhum gate met', () => {
    const out = evaluateGates(4, metrics45AllMissed);
    expect(out.transition).toBe('4-5');
    expect(out.gatesTotal).toBe(9);
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
    expect(out.gatesTotal).toBe(6);
    expect(out.gatesMet).toBe(4);
    expect(out.gatesRatio).toBeCloseTo(4 / 6, 6);

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
    expect(out.gatesTotal).toBe(8);
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

  it('operador < com value igual ao threshold → met=false (cv=0.5 falha <0.5)', () => {
    const out = evaluateGates(4, { ...metrics45AllMet, cv: 0.5 });
    const gate = out.gates.find((g) => g.id === 'cv-low');
    expect(gate.met).toBe(false);
    expect(gate.gap).toBe(0); // value - threshold = 0.5 - 0.5 = 0 (ε=0)
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

  it('operador >= com value abaixo → gap = threshold - value (E=40 vs >=55 → gap=15)', () => {
    const out = evaluateGates(2, { ...metrics23AllMet, E: 40 });
    const gate = out.gates.find((g) => g.id === 'emotional-55');
    expect(gate.met).toBe(false);
    expect(gate.gap).toBe(15);
  });

  it('operador == numérico: tiltRevengeCount=0 → met=true; =3 → met=false gap=1', () => {
    const outZero = evaluateGates(4, { ...metrics45AllMet, tiltRevengeCount: 0 });
    const gZero = outZero.gates.find((g) => g.id === 'zero-tilt-revenge');
    expect(gZero.met).toBe(true);
    expect(gZero.gap).toBe(0);

    const outThree = evaluateGates(4, { ...metrics45AllMet, tiltRevengeCount: 3 });
    const gThree = outThree.gates.find((g) => g.id === 'zero-tilt-revenge');
    expect(gThree.met).toBe(false);
    expect(gThree.gap).toBe(1);
  });

  it('operador <= com value acima → gap = value - threshold (maxDDPercent=30 vs <=20 → gap=10)', () => {
    const out = evaluateGates(1, { ...metrics12AllMet, maxDDPercent: 30 });
    const gate = out.gates.find((g) => g.id === 'maxdd-under-20');
    expect(gate.met).toBe(false);
    expect(gate.gap).toBe(10);
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
  it('3/6 gates met → ratio = 0.5', () => {
    const partial = {
      maxDDPercent: 20,      // met
      complianceRate: 80,    // met
      E: 30,                 // met
      journalRate: 0.30,     // miss
      stopUsageRate: 0.60,   // miss
      planAdherence: 50,     // miss
    };
    const out = evaluateGates(1, partial);
    expect(out.gatesMet).toBe(3);
    expect(out.gatesTotal).toBe(6);
    expect(out.gatesRatio).toBeCloseTo(0.5, 6);
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
    expect(out.gatesTotal).toBe(6);
    expect(out.gatesMet).toBe(4);
    expect(out.gatesRatio).toBeCloseTo(4 / 6, 6);
    const nullGate = out.gates.find((g) => g.metric === 'complianceRate');
    expect(nullGate.met).toBeNull();
  });
});
