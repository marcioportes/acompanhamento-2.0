/**
 * #408 — a fila de feedback em árvore: aluno → dia → plano → trade.
 *
 * Casos reais medidos na base em 27/08:
 *   Wilson 25/08 — dois planos, duas moedas, um deles ultrapassou o stop.
 *   Sandra 26/08 — plano autoriza 1 operação/dia, stop na primeira, mais três depois.
 */
import { describe, it, expect } from 'vitest';
import { buildFilaDeFeedback } from '../../utils/filaDeFeedback';

// Wilson: plano "1" (mesa, USD, RO=stop=US$375) e "WINFUT" (B3, BRL, stop R$1.032).
const planos = [
  { id: 'mesa', name: '1', pl: 50000, periodStop: 0.75, riskPerOperation: 0.75, operationPeriod: 'Diário' },
  { id: 'win', name: 'WINFUT', pl: 103210, periodStop: 1, riskPerOperation: 0.5, operationPeriod: 'Diário' },
  { id: 'ago', name: 'Ago', pl: 4000, periodStop: 1, riskPerOperation: 1, operationPeriod: 'Diário' },
];

const t = (id, extra) => ({
  id, studentId: 'w1', studentEmail: 'wilson@x.com', studentName: 'Wilson Fu',
  date: '2026-08-25', status: 'OPEN', ticker: 'MES', side: 'LONG', currency: 'USD',
  ...extra,
});

const wilson = [
  t('m1', { planId: 'mesa', result: -350, entryTime: '2026-08-25T08:05:00-03:00' }),
  t('m2', { planId: 'mesa', result: -350, entryTime: '2026-08-25T09:31:00-03:00' }),
  t('w1', { planId: 'win', result: -520, currency: 'BRL', ticker: 'WINFUT', entryTime: '2026-08-25T10:44:00-03:00' }),
];

describe('a árvore', () => {
  it('agrupa aluno → dia → plano, sem misturar os planos do mesmo dia', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: wilson, plans: planos });
    expect(aluno.name).toBe('Wilson Fu');
    expect(aluno.dias).toHaveLength(1);
    expect(aluno.dias[0].planos).toHaveLength(2);
    expect(aluno.dias[0].planos.map((p) => p.planName).sort()).toEqual(['1', 'WINFUT']);
  });

  it('cada plano mede o PRÓPRIO stop — a mesa estourou, o WIN não', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: wilson, plans: planos });
    const mesa = aluno.dias[0].planos.find((p) => p.planName === '1');
    const win = aluno.dias[0].planos.find((p) => p.planName === 'WINFUT');
    expect(mesa.periodState.net).toBe(-700);
    expect(mesa.periodState.closedBeyondStop).toBe(true);
    expect(win.periodState.net).toBe(-520);
    expect(win.periodState.closedBeyondStop).toBe(false);
  });

  it('com duas moedas NÃO existe líquido agregado — some do cabeçalho', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: wilson, plans: planos });
    expect(aluno.moedaUnica).toBeNull();
    expect(aluno.liquidoAgregado).toBeNull();
    expect(aluno.planosDistintos).toBe(2);
  });

  it('com uma moeda só, o líquido aparece', () => {
    const soWin = wilson.filter((x) => x.planId === 'win');
    const [aluno] = buildFilaDeFeedback({ pendentes: soWin, plans: planos });
    expect(aluno.moedaUnica).toBe('BRL');
    expect(aluno.liquidoAgregado).toBe(-520);
  });

  it('o plano de pior resultado vem primeiro — é onde a conversa começa', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: wilson, plans: planos });
    expect(aluno.dias[0].planos[0].planName).toBe('1'); // −700 antes de −520
  });
});

describe('o caso da Sandra — cinco linhas soltas viram um dia', () => {
  const sandra = [
    ['s1', '09:07', -40], ['s2', '09:13', -40], ['s3', '09:33', -10],
    ['s4', '10:52', -41], ['s5', '15:22', -40],
  ].map(([id, hora, result]) => ({
    id, studentId: 's1', studentEmail: 'sandra@x.com', studentName: 'Sandra Maria',
    date: '2026-08-26', status: 'OPEN', ticker: 'WINV26', side: 'SHORT', currency: 'BRL',
    planId: 'ago', result, entryTime: `2026-08-26T${hora}:00-03:00`,
  }));

  it('o plano autoriza UMA operação por dia', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: sandra, plans: planos });
    expect(aluno.dias[0].planos[0].periodState.maxAuthorizedTrades).toBe(1);
  });

  it('conta as operações abertas depois do stop', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: sandra, plans: planos });
    expect(aluno.opsAposStop).toBe(3);
    expect(aluno.diasAlemDoStop).toBe(1);
  });

  it('as linhas mantêm a ordem do dia e carregam o trade', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: sandra, plans: planos });
    const linhas = aluno.dias[0].planos[0].linhas;
    expect(linhas.map((l) => l.trade.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(linhas[0].trade.ticker).toBe('WINV26');
  });
});

describe('ordem de triagem e casos limites', () => {
  const semStop = { id: 'x', studentId: 'z', studentName: 'Zé', date: '2026-08-20', status: 'OPEN', result: -100, currency: 'BRL' };

  it('quem estourou o stop vem antes de quem tem mais pendentes', () => {
    const fila = buildFilaDeFeedback({ pendentes: [...wilson, ...[1, 2, 3, 4, 5].map((n) => ({
      ...semStop, id: `z${n}`, result: -10,
    }))], plans: planos });
    expect(fila[0].name).toBe('Wilson Fu');
    expect(fila[1].totalPendentes).toBe(5);
  });

  it('trade sem plano não some — agrupa num balde próprio, sem limiar', () => {
    const [aluno] = buildFilaDeFeedback({ pendentes: [semStop], plans: planos });
    const p = aluno.dias[0].planos[0];
    expect(p.planId).toBeNull();
    expect(p.periodState.stopValue).toBeNull();
    expect(p.periodState.net).toBe(-100);
  });

  it('dias vêm do mais recente para o mais antigo', () => {
    const doisDias = [
      { ...semStop, id: 'a', date: '2026-08-20' },
      { ...semStop, id: 'b', date: '2026-08-24' },
    ];
    const [aluno] = buildFilaDeFeedback({ pendentes: doisDias, plans: planos });
    expect(aluno.dias.map((d) => d.data)).toEqual(['2026-08-24', '2026-08-20']);
  });

  it('trade sem data não entra na fila', () => {
    expect(buildFilaDeFeedback({ pendentes: [{ ...semStop, date: null }], plans: planos })).toEqual([]);
  });

  it('fila vazia não explode', () => {
    expect(buildFilaDeFeedback({ pendentes: [], plans: [] })).toEqual([]);
    expect(buildFilaDeFeedback()).toEqual([]);
  });
});
