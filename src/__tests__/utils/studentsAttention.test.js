/**
 * studentsAttention.test.js — issues #430 e #444
 * @description O badge do menu e a aba "Precisam Atenção" leem daqui (#430). Desde o
 *              #444 a unidade é o TRADE aguardando feedback com motivo pesado, só de
 *              aluno Alpha. O teste fixa a fonte única e o agrupamento por aluno e
 *              plano, que nunca soma entre planos (#442).
 */

import { describe, it, expect } from 'vitest';
import { tradesNeedingAttention, agruparPorAlunoEPlano } from '../../utils/studentsAttention';

const students = [
  { id: 'sandra', email: 'sandra@x.com', name: 'Sandra Maria', firstLoginAt: '2026-01-10' },
  { id: 'joe', email: 'joe@x.com', name: 'Joe Hott', firstLoginAt: '2026-01-10' },
  { id: 'ana', email: 'ana@x.com', name: 'Ana Espelho', firstLoginAt: '2026-01-10' },
];
const subscriptions = [
  { studentId: 'sandra', status: 'active', type: 'paid', plan: 'alpha' },
  { studentId: 'joe', status: 'active', type: 'paid', plan: 'alpha' },
  { studentId: 'ana', status: 'active', type: 'paid', plan: 'self_service' }, // Espelho
];
const plans = [
  { id: 'winfut', name: 'WINFUT' },
  { id: 'apex', name: 'Apex EOD 50K' },
];

const tr = (id, studentId, hora, extra = {}) => ({
  id, studentId, status: 'OPEN', date: '2026-08-26', entryTime: `2026-08-26T${hora}:00-03:00`,
  ticker: 'WINV26', result: -100, currency: 'BRL', planId: 'winfut',
  behaviorProfile: { families: [{ canonicalCode: 'LOSS_CHASING', severity: 'HIGH' }] },
  ...extra,
});

describe('tradesNeedingAttention', () => {
  it('conta trades pesados aguardando feedback, não alunos', () => {
    const trades = [
      tr('t1', 'sandra', '10:00'),
      tr('t2', 'sandra', '11:00'),
      tr('t3', 'sandra', '12:00', { behaviorProfile: { families: [{ canonicalCode: 'CLEAN_EXECUTION' }] } }),
      tr('t4', 'sandra', '13:00', { status: 'REVIEWED' }),
    ];
    const r = tradesNeedingAttention({ trades, students, subscriptions });
    expect(r.map((i) => i.trade.id)).toEqual(['t2', 't1']);
  });

  it('aluno fora do Alpha fica fora', () => {
    const r = tradesNeedingAttention({ trades: [tr('t1', 'ana', '10:00')], students, subscriptions });
    expect(r).toEqual([]);
  });

  it('subs vazias dão lista vazia — trade de aluno não-Alpha não vira alarme', () => {
    expect(tradesNeedingAttention({ trades: [tr('t1', 'sandra', '10:00')], students, subscriptions: [] })).toEqual([]);
  });

  it('entrada vazia devolve lista vazia', () => {
    expect(tradesNeedingAttention({})).toEqual([]);
    expect(tradesNeedingAttention()).toEqual([]);
  });
});

describe('agruparPorAlunoEPlano', () => {
  const itens = (trades) => tradesNeedingAttention({ trades, students, subscriptions });

  it('agrupa por aluno, o de trade mais recente primeiro, sem nome de plano com plano único', () => {
    const r = agruparPorAlunoEPlano(
      itens([tr('s1', 'sandra', '10:00'), tr('j1', 'joe', '11:00'), tr('s2', 'sandra', '09:00')]),
      { students, plans },
    );
    expect(r.map((a) => a.studentName)).toEqual(['Joe Hott', 'Sandra Maria']);
    expect(r[1].total).toBe(2);
    expect(r[1].grupos).toHaveLength(1);
    expect(r[1].grupos[0]).toMatchObject({ planId: 'winfut', planName: null, moeda: 'BRL' });
    expect(r[1].grupos[0].itens.map((i) => i.trade.id)).toEqual(['s1', 's2']);
  });

  it('dois planos não somam: um grupo por plano, cada um com nome e moeda', () => {
    const r = agruparPorAlunoEPlano(
      itens([
        tr('j1', 'joe', '10:00'),
        tr('j2', 'joe', '11:00', { planId: 'apex', currency: 'USD', result: -314 }),
        tr('j3', 'joe', '12:00', { planId: 'apex', currency: 'USD', result: -50 }),
      ]),
      { students, plans },
    );
    expect(r).toHaveLength(1);
    expect(r[0].total).toBe(3);
    expect(r[0].grupos.map((g) => [g.planName, g.moeda, g.itens.length])).toEqual([
      ['Apex EOD 50K', 'USD', 2],
      ['WINFUT', 'BRL', 1],
    ]);
    // Nenhum campo de soma de resultado existe no grupo.
    expect(Object.keys(r[0].grupos[0]).sort()).toEqual(['itens', 'moeda', 'planId', 'planName']);
  });

  it('entrada vazia devolve lista vazia', () => {
    expect(agruparPorAlunoEPlano([], { students, plans })).toEqual([]);
    expect(agruparPorAlunoEPlano(null)).toEqual([]);
  });
});
