/**
 * Reconciliação pós-fusão do CLEAN_EXECUTION — issue #357.
 *
 * `detectCleanExecution` (shadowDetectors.js:170) decide "execução limpa" olhando só
 * os padrões do PRÓPRIO shadow — não enxerga as detecções de `events`, que entram no
 * perfil por outro caminho. Em produção o painel exibiu, no mesmo trade:
 *
 *   ✦ Execução limpa · Disciplina · 90%
 *   ⚠ Pânico no stop · Alta · gate
 *
 * O dedup por família não resolve: são famílias distintas e ambas sobrevivem por
 * desenho. A premissa do detector ("eu vejo tudo") só é verificável DEPOIS do merge.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildBehaviorProfiles } = require('../../behavior/buildBehaviorProfile');

const plan = { id: 'P1', riskPerOperation: 0.84, pl: 30000, rrTarget: 2 };

const baseTrade = (o = {}) => ({
  id: 'T1', planId: 'P1', studentId: 'S1', ticker: 'WINV26', side: 'LONG',
  qty: 8, entry: '169829.38', exit: '170155', result: 521, rrRatio: 2.5,
  stopLoss: 169700,
  entryTime: '2026-08-18T13:58:31-03:00', exitTime: '2026-08-18T15:14:48-03:00',
  tickerRule: { tickSize: 5, tickValue: 1, pointValue: null },
  _partials: [
    { type: 'ENTRY', qty: 5, price: 169760, dateTime: '2026-08-18T13:58:31' },
    { type: 'ENTRY', qty: 3, price: 169945, dateTime: '2026-08-18T14:46:17' },
    { type: 'EXIT', qty: 8, price: 170155, dateTime: '2026-08-18T15:14:48' },
  ],
  ...o,
});

const stop = (id, price, qty) => ({
  externalOrderId: id, instrument: 'WINV26', side: 'SELL', isStopOrder: true,
  status: 'CANCELLED', quantity: qty, stopPrice: price,
  submittedAt: '2026-08-18T13:58:31', cancelledAt: '2026-08-18T15:14:48',
  correlatedTradeId: 'T1',
});

const emotionConfig = (name) => ({
  name: name || 'Desconhecida', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER',
});

const run = (trade, orders) => buildBehaviorProfiles({
  trades: [trade], orders, plans: [plan], getEmotionConfig: emotionConfig,
});

describe('buildBehaviorProfile — reconciliação do CLEAN_EXECUTION (#357)', () => {
  it('não acusa risco no trade real de 18/08 e reconhece a condução de sizing', () => {
    const profiles = run(baseTrade(), [stop('S1', 169780, 5), stop('S2', 169700, 3)]);
    const fam = profiles.get('T1').families.map(f => f.canonicalCode);

    expect(fam).not.toContain('RISK_OVER_RO');
    expect(fam).not.toContain('UNPROTECTED_SIZE');
    expect(fam).toContain('SIZING_DISCIPLINE');
  });

  it('derruba CLEAN_EXECUTION quando uma família negativa sobrevive', () => {
    const profiles = run(baseTrade(), [stop('S1', 169700, 5)]);   // 3 de 8 descobertos
    const p = profiles.get('T1');
    const fam = p.families.map(f => f.canonicalCode);

    expect(fam).toContain('UNPROTECTED_SIZE');
    expect(fam).not.toContain('CLEAN_EXECUTION');
    expect(p.families.some(f => f.valence === 'negative')).toBe(true);
  });

  it('o fingerprint muda quando a reconciliação altera as famílias', () => {
    const a = run(baseTrade(), [stop('S1', 169780, 5), stop('S2', 169700, 3)]);
    const b = run(baseTrade(), [stop('S1', 169700, 5)]);
    expect(a.get('T1').fingerprint).not.toBe(b.get('T1').fingerprint);
  });
});

describe('buildBehaviorProfile — fingerprint cobre a evidência', () => {
  it('mudança só na evidência altera o fingerprint', () => {
    // Regressão 19/08/2026: o hash levava família/severidade/fonte, mas não a evidência.
    // Depois do fix de duplicatas um trade manteve a mesma família com risco corrigido de
    // R$ 1.359 para R$ 453, e o recompute pulou o write — o número errado ficou no doc.
    // Cobertura completa nos dois, risco diferente: mesmas famílias, evidência distinta.
    const a = run(baseTrade(), [stop('S1', 169780, 5), stop('S2', 169700, 3)]).get('T1');
    const b = run(baseTrade(), [stop('S1', 169790, 5), stop('S2', 169710, 3)]).get('T1');

    const famA = a.families.map(f => f.canonicalCode).sort();
    const famB = b.families.map(f => f.canonicalCode).sort();
    expect(famA).toEqual(famB);                 // mesmas famílias
    expect(a.fingerprint).not.toBe(b.fingerprint); // evidência diferente → hash diferente
  });
});
