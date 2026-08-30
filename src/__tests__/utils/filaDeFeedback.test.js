/**
 * #408 — a fila de feedback em árvore: aluno → dia → plano → trade.
 *
 * Casos reais medidos na base em 27/08:
 *   Wilson 25/08 — dois planos, duas moedas, um deles ultrapassou o stop.
 *   Sandra 26/08 — plano autoriza 1 operação/dia, stop na primeira, mais três depois.
 */
import { describe, it, expect } from 'vitest';
import { buildFilaDeFeedback, lembretesDoPeriodo, avisosPorOperacao, tradesDoSnapshotDaRevisao } from '../../utils/filaDeFeedback';
import { authorizationNotice } from '../../components/metrics/dayMetricTiles';

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

describe('lembretesDoPeriodo — o que levar para a revisão', () => {
  const plano4k = { id: 'ago', name: 'Ago', pl: 4000, periodStop: 1, periodGoal: 2, riskPerOperation: 1, operationPeriod: 'Diário' };
  const op = (id, hora, result, extra = {}) => ({
    id, studentId: 'sa', studentName: 'Sandra', date: '2026-08-26', status: 'REVIEWED',
    ticker: 'WINV26', currency: 'BRL', planId: 'ago', result,
    entryTime: `2026-08-26T${hora}:00-03:00`, ...extra,
  });

  it('continuar operando depois do stop é o fato mais forte e cala os outros', () => {
    const dia = [op('a', '09:07', -40), op('b', '09:13', -40), op('c', '09:33', -10)];
    const [l] = lembretesDoPeriodo(dia, [plano4k]);
    expect(l.titulo).toBe('Continuou operando depois do stop');
    // A 2ª, não a 1ª: com a margem de manejo de 2% (#402), perder exatamente
    // R$ 40 contra um stop de R$ 40 ainda não o atinge. O mockup do issue dizia
    // "atingido na 1ª" — foi escrito antes de a margem existir.
    expect(l.detalhe).toContain('2ª das 3 operações');
    expect(l.tom).toBe('alerta');
  });

  it('fechar além do stop SEM abrir irregular tem texto próprio', () => {
    // Duas operações autorizadas que, somadas, passam o limite.
    const dia = [op('a', '10:00', -25), op('b', '11:00', -25)];
    const [l] = lembretesDoPeriodo(dia, [plano4k]);
    expect(l.titulo).toBe('O dia fechou além do stop');
    expect(l.detalhe).toContain('nenhuma operação foi aberta fora das regras');
  });

  it('bater a meta e PARAR entra como lembrete bom — é o que ninguém diz', () => {
    const dia = [op('a', '10:00', 90)]; // meta = 2% de 4.000 = 80
    const [l] = lembretesDoPeriodo(dia, [plano4k]);
    expect(l.titulo).toBe('Bateu a meta e parou');
    expect(l.tom).toBe('bom');
  });

  it('bater a meta e continuar vira atenção, não elogio', () => {
    const dia = [op('a', '10:00', 90), op('b', '11:00', -10)];
    const [l] = lembretesDoPeriodo(dia, [plano4k]);
    expect(l.titulo).toBe('Bateu a meta e continuou');
    expect(l.tom).toBe('atencao');
  });

  it('dia dentro do plano não gera lembrete — silêncio é resultado', () => {
    const dia = [op('a', '10:00', 10)];
    expect(lembretesDoPeriodo(dia, [plano4k])).toEqual([]);
  });

  it('cada dia de cada plano rende o seu próprio lembrete', () => {
    const outroPlano = { ...plano4k, id: 'p2', name: 'Mesa' };
    const trades = [
      op('a', '09:07', -40), op('b', '09:13', -40), op('c', '09:33', -10),
      { ...op('d', '10:00', -80), planId: 'p2' },
    ];
    const ls = lembretesDoPeriodo(trades, [plano4k, outroPlano]);
    expect(ls).toHaveLength(2);
    expect(new Set(ls.map((l) => l.planName))).toEqual(new Set(['Ago', 'Mesa']));
  });

  it('sem trade não há lembrete', () => {
    expect(lembretesDoPeriodo([], [plano4k])).toEqual([]);
    expect(lembretesDoPeriodo()).toEqual([]);
  });

  // Marcio, 30/08: *"como é atômica, precisa estar na operação, não na seção do dia"*.
  it('abrir sem previsão de stop NÃO vira lembrete do dia', () => {
    // −25 deixa R$ 15 até o stop de R$ 40; a 2ª abre sem caber o próprio stop.
    // O dia fecha em −20, dentro do limite: não há nada a dizer sobre o DIA.
    const dia = [op('a', '10:00', -25), op('b', '11:00', 5)];
    expect(avisosPorOperacao(dia, [plano4k]).has('b')).toBe(true);
    expect(lembretesDoPeriodo(dia, [plano4k])).toEqual([]);
  });
});

describe('avisosPorOperacao — o fato atômico mora na operação', () => {
  const plano4k = { id: 'ago', name: 'Ago', pl: 4000, periodStop: 1, periodGoal: 2, riskPerOperation: 1, operationPeriod: 'Diário' };
  const op = (id, hora, result) => ({
    id, studentId: 'sa', studentName: 'Sandra', date: '2026-08-26', status: 'REVIEWED',
    ticker: 'WINV26', currency: 'BRL', planId: 'ago', result,
    entryTime: `2026-08-26T${hora}:00-03:00`,
  });

  it('marca a operação sem previsão de stop e deixa a autorizada em paz', () => {
    const avisos = avisosPorOperacao([op('a', '10:00', -25), op('b', '11:00', 5)], [plano4k]);
    expect([...avisos.keys()]).toEqual(['b']);
    expect(avisos.get('b').row.authorization).toBe('SEM_FOLGA');
  });

  it('a linha devolvida alimenta authorizationNotice com o texto novo', () => {
    const { row, periodState, moeda } = avisosPorOperacao(
      [op('a', '10:00', -25), op('b', '11:00', 5)], [plano4k],
    ).get('b');
    const aviso = authorizationNotice(row, periodState, moeda);
    expect(aviso.title).toBe('Aberta sem previsão de stop');
    expect(aviso.tone).toBe('warn');
    // O número que sustenta o fato: o que restava quando ELA abriu.
    expect(aviso.detail).toContain('até o stop do período');
  });

  it('operação aberta depois do stop também é atômica e entra no mapa', () => {
    const avisos = avisosPorOperacao([op('a', '09:07', -40), op('b', '09:13', -40), op('c', '09:33', -10)], [plano4k]);
    expect(avisos.get('c')?.row.authorization).toBe('APOS_STOP');
    expect(authorizationNotice(avisos.get('c').row, avisos.get('c').periodState, 'BRL').title)
      .toBe('Aberta depois do stop do período');
  });

  it('dia inteiro dentro do plano não marca operação nenhuma', () => {
    expect(avisosPorOperacao([op('a', '10:00', 10)], [plano4k]).size).toBe(0);
    expect(avisosPorOperacao([], [plano4k]).size).toBe(0);
    expect(avisosPorOperacao().size).toBe(0);
  });
});

describe('tradesDoSnapshotDaRevisao — a projeção do snapshot não é o trade', () => {
  // Shape real de `frozenSnapshot.periodTrades` (weeklyReviewSnapshot.projectTrade):
  // `tradeId`, `pnl`, `symbol`, `closeTime`, e SEM `date` nem `planId`.
  const projetado = {
    tradeId: 'abc', pnl: -265, symbol: 'WINV26', side: 'LONG', qty: 1,
    entryTime: '2026-08-25T11:34:00-03:00', closeTime: '2026-08-25T11:41:00-03:00',
    stopLoss: 177690, entry: 178190, setup: '4-Barras', emotionEntry: 'Ansioso',
  };

  it('devolve a data a partir do entryTime — sem ela o motor descarta tudo', () => {
    const [t] = tradesDoSnapshotDaRevisao([projetado], 'p1');
    expect(t.date).toBe('2026-08-25');
  });

  it('a data é a LOCAL do aluno, não a UTC', () => {
    // 23:30 em Brasília é 02:30 UTC do dia seguinte; a data do trade é a de hoje.
    const [t] = tradesDoSnapshotDaRevisao([{ ...projetado, entryTime: '2026-08-25T23:30:00-03:00' }], 'p1');
    expect(t.date).toBe('2026-08-25');
  });

  it('traduz pnl → result, symbol → ticker, tradeId → id', () => {
    const [t] = tradesDoSnapshotDaRevisao([projetado], 'p1');
    expect(t.result).toBe(-265);
    expect(t.ticker).toBe('WINV26');
    expect(t.id).toBe('abc');
  });

  it('herda o plano e o aluno da revisão — a projeção não traz nenhum dos dois', () => {
    const [t] = tradesDoSnapshotDaRevisao([projetado], 'plano-da-revisao', 'aluno-1');
    expect(t.planId).toBe('plano-da-revisao');
    expect(t.studentId).toBe('aluno-1');
  });

  it('sem aluno informado ainda entra na árvore — trade sem dono é descartado', () => {
    const [t] = tradesDoSnapshotDaRevisao([projetado], 'p1');
    expect(t.studentId).toBeTruthy();
  });

  it('não sobrescreve campo que já veio no trade', () => {
    const [t] = tradesDoSnapshotDaRevisao([{ ...projetado, date: '2026-01-01', planId: 'proprio' }], 'p1');
    expect(t.date).toBe('2026-01-01');
    expect(t.planId).toBe('proprio');
  });

  it('a revisão inteira volta a produzir lembretes depois da adaptação', () => {
    const plano = { id: 'p1', name: 'Ago-Plano', pl: 30000, periodStop: 1.67, riskPerOperation: 0.84, operationPeriod: 'Diário' };
    const doisDoDia = [
      { ...projetado, tradeId: 'a', pnl: -250, entryTime: '2026-08-25T10:51:00-03:00' },
      { ...projetado, tradeId: 'b', pnl: -265, entryTime: '2026-08-25T11:34:00-03:00' },
    ];
    // Caso real do Marcio: −515 contra um stop de 501.
    const semAdaptar = lembretesDoPeriodo(doisDoDia, [plano]);
    const adaptado = lembretesDoPeriodo(tradesDoSnapshotDaRevisao(doisDoDia, 'p1', 'aluno-1'), [plano]);
    expect(semAdaptar).toHaveLength(0);           // era isto que a tela mostrava
    expect(adaptado).toHaveLength(1);
    expect(adaptado[0].titulo).toBe('O dia fechou além do stop');
  });

  it('entrada vazia não explode', () => {
    expect(tradesDoSnapshotDaRevisao(null, 'p1')).toEqual([]);
  });
});
