import { describe, it, expect } from 'vitest';
import { proposeStageTransition } from '../../../utils/maturityEngine/proposeStageTransition';

function gateRes(gates) {
  const gatesMet = gates.filter((g) => g.met === true).length;
  return { gates, gatesMet, gatesTotal: gates.length };
}

const NO_REG = { detected: false };
const REG = { detected: true };

describe('proposeStageTransition', () => {
  it('stage 5 normal (sem regressão) → STAY, nextStage 5, blockers vazio', () => {
    const out = proposeStageTransition({
      stageCurrent: 5,
      gatesResult: gateRes([]),
      signalRegression: NO_REG,
      confidence: 'HIGH',
    });
    expect(out.proposed).toBe('STAY');
    expect(out.nextStage).toBe(5);
    expect(out.blockers).toEqual([]);
    expect(out.confidence).toBe('HIGH');
  });

  it('stage 5 com regressão → DOWN_DETECTED (regressão vence mastery)', () => {
    const out = proposeStageTransition({
      stageCurrent: 5,
      gatesResult: gateRes([]),
      signalRegression: REG,
      confidence: 'MED',
    });
    expect(out.proposed).toBe('DOWN_DETECTED');
    expect(out.nextStage).toBe(5);
    expect(out.blockers).toEqual([]);
  });

  it('stage 3 com todos 8 gates met → UP, nextStage 4', () => {
    const gates = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, met: true }));
    const out = proposeStageTransition({
      stageCurrent: 3,
      gatesResult: gateRes(gates),
      signalRegression: NO_REG,
      confidence: 'HIGH',
    });
    expect(out.proposed).toBe('UP');
    expect(out.nextStage).toBe(4);
    expect(out.blockers).toEqual([]);
  });

  it('stage 3 com 5/8 gates met → STAY, 3 ids em blockers', () => {
    const gates = [
      { id: 'a', met: true }, { id: 'b', met: true }, { id: 'c', met: true },
      { id: 'd', met: true }, { id: 'e', met: true },
      { id: 'f', met: false }, { id: 'g', met: false }, { id: 'h', met: false },
    ];
    const out = proposeStageTransition({
      stageCurrent: 3,
      gatesResult: gateRes(gates),
      signalRegression: NO_REG,
      confidence: 'MED',
    });
    expect(out.proposed).toBe('STAY');
    expect(out.nextStage).toBe(4);
    expect(out.blockers).toEqual(['f', 'g', 'h']);
  });

  it('stage 3 com 7 met + 1 null → STAY, blockers contém o null', () => {
    const gates = [
      ...Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, met: true })),
      { id: 'gnull', met: null },
    ];
    const out = proposeStageTransition({
      stageCurrent: 3,
      gatesResult: gateRes(gates),
      signalRegression: NO_REG,
      confidence: 'MED',
    });
    expect(out.proposed).toBe('STAY');
    expect(out.blockers).toEqual(['gnull']);
  });

  it('stage 3 com regressão + 8/8 → DOWN_DETECTED (precedência)', () => {
    const gates = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, met: true }));
    const out = proposeStageTransition({
      stageCurrent: 3,
      gatesResult: gateRes(gates),
      signalRegression: REG,
      confidence: 'LOW',
    });
    expect(out.proposed).toBe('DOWN_DETECTED');
    expect(out.nextStage).toBe(3);
    expect(out.blockers).toEqual([]);
    expect(out.confidence).toBe('LOW');
  });

  it('stage 1 com 6/6 → UP, nextStage 2', () => {
    const gates = Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, met: true }));
    const out = proposeStageTransition({
      stageCurrent: 1,
      gatesResult: gateRes(gates),
      signalRegression: NO_REG,
      confidence: 'MED',
    });
    expect(out.proposed).toBe('UP');
    expect(out.nextStage).toBe(2);
  });

  it('stage 2 com 0/8 → STAY, blockers com todos os 8 ids', () => {
    const gates = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, met: false }));
    const out = proposeStageTransition({
      stageCurrent: 2,
      gatesResult: gateRes(gates),
      signalRegression: NO_REG,
      confidence: 'LOW',
    });
    expect(out.proposed).toBe('STAY');
    expect(out.nextStage).toBe(3);
    expect(out.blockers).toHaveLength(8);
  });
});
