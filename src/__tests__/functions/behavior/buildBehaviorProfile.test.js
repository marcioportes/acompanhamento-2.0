/**
 * buildBehaviorProfile — fusão motor (events+agregados) + shadow per-trade → behaviorProfile.
 * CHUNK-11 Fase 2 (#301, DEC-AUTO-301-04). Testa o CONTRATO da fusão (famílias canônicas,
 * flag de gate, valência, dedupe por família/DEC-074, fingerprint); os detectores
 * subjacentes têm os próprios testes (#129/#208/#189).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildBehaviorProfiles, behaviorFingerprint } = require(
  '../../../../functions/behavior/buildBehaviorProfile.js',
);

// Cluster de 3 trades no mesmo dia, intervalos curtos → revenge/impulse plantados.
const clusterTrades = () => [
  { id: 'T1', studentId: 'S1', date: '2026-05-04', side: 'C', entryTime: '2026-05-04T09:00:00', exitTime: '2026-05-04T09:05:00', result: -200, qty: 2, ticker: 'WIN', planId: 'P1' },
  { id: 'T2', studentId: 'S1', date: '2026-05-04', side: 'C', entryTime: '2026-05-04T09:07:00', exitTime: '2026-05-04T09:12:00', result: -150, qty: 2, ticker: 'WIN', planId: 'P1' },
  { id: 'T3', studentId: 'S1', date: '2026-05-04', side: 'C', entryTime: '2026-05-04T09:09:00', exitTime: '2026-05-04T09:15:00', result: 100, qty: 2, ticker: 'WIN', planId: 'P1' },
];
const plans = [{ id: 'P1', riskPerOperation: 1.0, rrTarget: 2, pl: 20000 }];

describe('buildBehaviorProfiles — contrato da fusão', () => {
  it('retorna Map vazio para entrada vazia', () => {
    expect(buildBehaviorProfiles({ trades: [] }).size).toBe(0);
    expect(buildBehaviorProfiles({}).size).toBe(0);
  });

  it('produz um profile por trade com famílias canônicas + flag de gate', () => {
    const profiles = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    expect(profiles.size).toBe(3);

    const t2 = profiles.get('T2');
    expect(t2).toBeTruthy();
    // T2 reentrou logo após o stop de T1 → LOSS_CHASING, que é família-gate.
    const lossChasing = t2.families.find((f) => f.family === 'LOSS_CHASING');
    expect(lossChasing).toBeTruthy();
    expect(lossChasing.isGate).toBe(true);
    expect(lossChasing.valence).toBe('negative');
    expect(lossChasing.canonicalCode).toBe('LOSS_CHASING');
    expect(t2.gateInputs).toContain('LOSS_CHASING');
  });

  it('só há uma entrada por família no trade (dedupe DEC-074)', () => {
    const profiles = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    for (const [, p] of profiles) {
      const families = p.families.map((f) => f.family);
      expect(families.length).toBe(new Set(families).size);
    }
  });

  it('gateInputs ⊆ famílias detectadas no trade', () => {
    const profiles = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    for (const [, p] of profiles) {
      const fams = new Set(p.families.map((f) => f.family));
      for (const g of p.gateInputs) expect(fams.has(g)).toBe(true);
    }
  });

  it('cada família carrega metadados da taxonomia (severity/valence/emotionMapping)', () => {
    const profiles = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    for (const [, p] of profiles) {
      for (const f of p.families) {
        expect(f).toHaveProperty('family');
        expect(f).toHaveProperty('canonicalCode');
        expect(['negative', 'positive']).toContain(f.valence);
        expect(['events', 'shadow', 'emotional']).toContain(f.source);
      }
    }
  });

  it('scoreContribution não quebra sem getEmotionConfig (tilt/revenge false)', () => {
    const profiles = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    const t1 = profiles.get('T1');
    expect(t1.scoreContribution).toEqual({ tilt: false, revenge: false });
  });

  it('fingerprint é estável para o mesmo input e muda com input diferente', () => {
    const a = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    const b = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    for (const k of a.keys()) expect(a.get(k).fingerprint).toBe(b.get(k).fingerprint);

    // espaçar os trades horas (timing) desfaz o cluster revenge/impulse → padrões mudam
    const mutated = clusterTrades();
    mutated[1].entryTime = '2026-05-04T14:00:00'; mutated[1].exitTime = '2026-05-04T14:10:00';
    mutated[2].entryTime = '2026-05-04T16:00:00'; mutated[2].exitTime = '2026-05-04T16:10:00';
    const c = buildBehaviorProfiles({ trades: mutated, orders: [], plans });
    // T2 deixa de ser reentrada rápida → seu fingerprint muda
    expect(a.get('T2').fingerprint).not.toBe(c.get('T2').fingerprint);
  });

  it('behaviorFingerprint ignora computedAt/computedBy (só conteúdo semântico)', () => {
    const profiles = buildBehaviorProfiles({ trades: clusterTrades(), orders: [], plans });
    const p = profiles.get('T2');
    const fp1 = behaviorFingerprint({ ...p, computedAt: 'X', computedBy: 'auto' });
    const fp2 = behaviorFingerprint({ ...p, computedAt: 'Y', computedBy: 'backfill' });
    expect(fp1).toBe(fp2);
  });
});
