/**
 * #416 C2 (D-11) — o gate `strategy-12-months` passa a medir o que o nome promete.
 *
 * SEMÂNTICA ANTIGA (reescrita, não apagada): run máximo de meses consecutivos em que um
 * único setup respondia por > 60% dos trades do mês, com `plans` descartado por `void`.
 * `setup` está preenchido em 98% dos trades — o `0` universal na base não era campo
 * vazio, era o critério punindo playbook multi-setup e sendo inatingível por construção.
 *
 * SEMÂNTICA NOVA: meses decorridos desde a última mudança nos parâmetros de risco do
 * plano (`RISK_FIELDS`). Trades não entram mais na conta.
 *
 * Cada cenário abaixo declara o que passou a significar em relação ao teste antigo.
 */
import { describe, it, expect } from 'vitest';
import { computeStrategyConsistencyMonths } from '../../../utils/maturityEngine/helpers';
import { RISK_FIELDS } from '../../../utils/planRiskFields';

// DEC-AUTO-416-20: `now` fixo em todo teste de tempo. Sem isso o teste passa hoje e
// quebra na virada do mês.
const NOW = new Date('2026-09-15T12:00:00Z');
const opts = { now: NOW };

/** Plano com uma entrada de editHistory por par [fields, timestamp]. */
const plano = (historico, extra = {}) => ({
  id: 'p1',
  active: true,
  createdAt: new Date('2025-01-15T00:00:00Z'),
  editHistory: historico.map(([fields, timestamp]) => ({
    by: 'student', email: 'a@b.com', fields, timestamp,
  })),
  ...extra,
});

describe('#416 C2 — meses sem mudança de parâmetro de risco', () => {
  it('edição de rrTarget há 3 meses → 3', () => {
    // ANTES: este cenário exigia 3 meses de trades com setup dominante. Agora o dado é
    // o plano, e trade nenhum participa.
    const p = plano([[['rrTarget'], '2026-06-15T10:00:00.000Z']]);
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(3);
  });

  it('edição de campo não-risco não zera a contagem', () => {
    // `notes` há 1 mês, `riskPerOperation` há 8 → vale a de risco.
    const p = plano([
      [['riskPerOperation'], '2026-01-15T10:00:00.000Z'],
      [['notes'], '2026-08-15T10:00:00.000Z'],
    ]);
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(8);
  });

  it('vale a entrada de risco MAIS RECENTE, não a primeira', () => {
    const p = plano([
      [['cycleStop'], '2025-03-15T10:00:00.000Z'],
      [['periodStop'], '2026-07-15T10:00:00.000Z'],
    ]);
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(2);
  });

  it('entrada mista (risco + não-risco no mesmo save) conta como mudança de risco', () => {
    const p = plano([[['notes', 'rrTarget'], '2026-06-15T10:00:00.000Z']]);
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(3);
  });

  it('todos os RISK_FIELDS qualificam', () => {
    for (const campo of RISK_FIELDS) {
      const p = plano([[[campo], '2026-03-15T10:00:00.000Z']]);
      expect(computeStrategyConsistencyMonths([p], opts)).toBe(6);
    }
  });

  it('plano sem editHistory conta desde createdAt — não 0', () => {
    // D-11: ausência de histórico é informação válida (nenhuma edição registrada),
    // não buraco. É o caso de 68% dos planos da base.
    const p = { id: 'p1', active: true, createdAt: new Date('2026-05-15T00:00:00Z') };
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(4);
  });

  it('editHistory só com campos não-risco cai no createdAt', () => {
    const p = plano([[['notes'], '2026-08-15T10:00:00.000Z']], {
      createdAt: new Date('2026-03-15T00:00:00Z'),
    });
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(6);
  });

  it('dois planos ativos (2 e 7 meses) → o menor', () => {
    const a = plano([[['rrTarget'], '2026-07-15T10:00:00.000Z']]);
    const b = { ...plano([[['cycleStop'], '2026-02-15T10:00:00.000Z']]), id: 'p2' };
    expect(computeStrategyConsistencyMonths([a, b], opts)).toBe(2);
    expect(computeStrategyConsistencyMonths([b, a], opts)).toBe(2);
  });

  it('plano inativo não entra na conta', () => {
    const ativo = plano([[['rrTarget'], '2026-03-15T10:00:00.000Z']]);
    const inativo = { ...plano([[['rrTarget'], '2026-09-01T10:00:00.000Z']]), id: 'p2', active: false };
    expect(computeStrategyConsistencyMonths([ativo, inativo], opts)).toBe(6);
  });

  it('sem plano nenhum → 0', () => {
    expect(computeStrategyConsistencyMonths([], opts)).toBe(0);
    expect(computeStrategyConsistencyMonths(null, opts)).toBe(0);
    expect(computeStrategyConsistencyMonths(undefined, opts)).toBe(0);
  });

  it('plano sem data utilizável → 0', () => {
    expect(computeStrategyConsistencyMonths([{ id: 'p1', active: true }], opts)).toBe(0);
  });

  it('trades não participam mais da conta', () => {
    // ANTES: a função recebia `(trades, plans)` e ignorava `plans`. Agora é o inverso
    // declarado na assinatura (DEC-AUTO-416-18) — não há `void` de parâmetro.
    const p = plano([[['rrTarget'], '2026-06-15T10:00:00.000Z']]);
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(3);
  });

  it('meses são decorridos (aniversário), não diferença de calendário', () => {
    // 30/06 → 15/09 são 2 meses e meio. Arredondar pra cima afrouxaria o gate.
    const p = plano([[['rrTarget'], '2026-06-30T10:00:00.000Z']]);
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(2);
    const q = plano([[['rrTarget'], '2026-06-15T10:00:00.000Z']]);
    expect(computeStrategyConsistencyMonths([q], opts)).toBe(3);
  });

  it('mudança no futuro ou hoje → 0, sem negativo', () => {
    const p = plano([[['rrTarget'], '2026-12-01T10:00:00.000Z']]);
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(0);
  });
});

describe('#416 C2 — coerção de data nos dois ambientes', () => {
  // A função roda no client (Timestamp do Firestore) e na CF (Timestamp do admin).
  // `editHistory[].timestamp` é string ISO; `plan.createdAt` é Timestamp.
  const seis = '2026-03-15T10:00:00.000Z';
  const esperado = 6;

  it('aceita Timestamp do Firestore (toDate)', () => {
    const ts = { toDate: () => new Date(seis) };
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: ts }], opts)).toBe(esperado);
  });

  it('aceita Timestamp do admin (toMillis)', () => {
    const ts = { toMillis: () => Date.parse(seis), toDate: () => new Date(seis) };
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: ts }], opts)).toBe(esperado);
  });

  it('aceita Date', () => {
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: new Date(seis) }], opts)).toBe(esperado);
  });

  it('aceita string ISO (com e sem hora) e data BR', () => {
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: seis }], opts)).toBe(esperado);
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: '2026-03-15' }], opts)).toBe(esperado);
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: '15/03/2026' }], opts)).toBe(esperado);
  });

  it('aceita número (epoch ms)', () => {
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: Date.parse(seis) }], opts)).toBe(esperado);
  });

  it('aceita Timestamp serializado ({seconds} / {_seconds})', () => {
    const secs = Date.parse(seis) / 1000;
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: { seconds: secs, nanoseconds: 0 } }], opts)).toBe(esperado);
    expect(computeStrategyConsistencyMonths([{ active: true, createdAt: { _seconds: secs } }], opts)).toBe(esperado);
  });

  it('timestamp inválido na entrada é ignorado sem quebrar — cai no createdAt', () => {
    const p = {
      active: true,
      createdAt: new Date(seis),
      editHistory: [
        { by: 'student', fields: ['rrTarget'], timestamp: 'não é data' },
        { by: 'student', fields: ['rrTarget'], timestamp: null },
        { by: 'student', fields: ['rrTarget'] },
        { by: 'student', fields: ['rrTarget'], timestamp: { lixo: true } },
        { by: 'student', fields: ['rrTarget'], timestamp: NaN },
      ],
    };
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(esperado);
  });

  it('editHistory malformado não quebra', () => {
    const p = {
      active: true,
      createdAt: new Date(seis),
      editHistory: [null, 'texto', 42, { fields: 'rrTarget' }, {}],
    };
    expect(computeStrategyConsistencyMonths([p], opts)).toBe(esperado);
  });

  it('`now` inválido cai no relógio do sistema sem quebrar', () => {
    const p = { active: true, createdAt: new Date('2020-01-15T00:00:00Z') };
    expect(computeStrategyConsistencyMonths([p], { now: 'lixo' })).toBeGreaterThan(0);
    expect(computeStrategyConsistencyMonths([p])).toBeGreaterThan(0);
  });

  it('entrada nula na lista de planos não quebra', () => {
    const p = plano([[['rrTarget'], '2026-06-15T10:00:00.000Z']]);
    expect(computeStrategyConsistencyMonths([null, p, undefined], opts)).toBe(3);
  });
});
