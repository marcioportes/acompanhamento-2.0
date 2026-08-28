/**
 * #101 Fase A — agregação da Torre. Testes ANTES da UI (INV-05).
 *
 * Fixtures espelham a base real de 27/08/2026, medida durante a abertura:
 * 68 alunos cadastrados · 19 com acesso à plataforma · 39 com assinatura viva ·
 * 13 com as duas coisas. Dos 19 com acesso: 11 `active`, 2 `overdue`
 * (Elza com 46 trades e André com 18 — os dois operam), 5 `cancelled` e 1 `expired`.
 */
import { describe, it, expect } from 'vitest';
import {
  todayKey,
  isOnRadar,
  indexSubsByStudent,
  flagsHoje,
  foraDoPlanoPct,
  estadoDoPeriodo,
  buildMentorRadar,
  buildCalendarDays,
  familiasDeRisco,
  linhaDeRadar,
  gatilhoDePrioridade,
  TRIGGER,
  segundaDa,
  diasAntes,
  foraDoPlanoDoAluno,
  stopVsGain,
} from '../../utils/mentorRiskRadar';
import { buildPeriodState } from '../../utils/dayState';

const aluno = (extra = {}) => ({ id: 's1', name: 'Aluno', firstLoginAt: '2026-01-10T10:00:00Z', ...extra });
const sub = (status, extra = {}) => ({ studentId: 's1', status, type: 'paid', plan: 'alpha', ...extra });

describe('todayKey', () => {
  it('devolve YYYY-MM-DD no fuso local', () => {
    expect(todayKey(new Date(2026, 7, 27, 15, 30))).toBe('2026-08-27');
  });

  it('não cruza fronteira de dia por causa de UTC', () => {
    // 27/08 22:00 local não pode virar 28/08
    expect(todayKey(new Date(2026, 7, 27, 22, 0))).toBe('2026-08-27');
  });
});

describe('isOnRadar — MC-1: acesso + assinatura viva', () => {
  it('entra: tem acesso e assinatura ativa', () => {
    expect(isOnRadar(aluno(), [sub('active')])).toBe(true);
  });

  it('ENTRA em atraso — quem decide o corte é o bloqueio, não a Torre', () => {
    // Elza tem 46 trades e está overdue. Tirá-la faria o mentor perder de vista
    // justamente quem mais aparece nas análises comportamentais.
    expect(isOnRadar(aluno({ name: 'Elza' }), [sub('overdue')])).toBe(true);
  });

  it('SAI quando o bloqueio entra — mesmo com acesso e assinatura', () => {
    // O bloqueio grava `loginBlocked` e NÃO mexe em accessStatus: sem esta
    // checagem o bloqueado continuaria no radar.
    expect(isOnRadar(aluno({ loginBlocked: true }), [sub('overdue')])).toBe(false);
    expect(isOnRadar(aluno({ loginBlocked: true }), [sub('active')])).toBe(false);
  });

  it('sai quando a assinatura foi cancelada ou expirou', () => {
    // Os 5 cancelados que ainda têm acesso (Sael, Joe Hott, Franklin, Henrique, Igor)
    expect(isOnRadar(aluno(), [sub('cancelled')])).toBe(false);
    expect(isOnRadar(aluno(), [sub('expired', { type: 'trial' })])).toBe(false);
  });

  it('sai quem paga mas nunca entrou — 26 alunos na base', () => {
    const nuncaEntrou = { id: 's2', name: 'Pagante ausente' }; // sem firstLoginAt
    expect(isOnRadar(nuncaEntrou, [sub('active', { studentId: 's2' })])).toBe(false);
  });

  it('sai quem tem acesso e nenhuma assinatura', () => {
    expect(isOnRadar(aluno(), [])).toBe(false);
  });

  it('VIP ativo fica fora — classifyStudent devolve null', () => {
    expect(isOnRadar(aluno(), [sub('active', { type: 'vip' })])).toBe(false);
  });

  it('accessStatus declarativo vale quando não há firstLoginAt', () => {
    const declarado = { id: 's3', accessStatus: 'active' };
    expect(isOnRadar(declarado, [sub('active', { studentId: 's3' })])).toBe(true);
  });

  it('entrada vazia não explode', () => {
    expect(isOnRadar(null, [])).toBe(false);
    expect(isOnRadar(aluno(), null)).toBe(false);
  });
});

describe('indexSubsByStudent', () => {
  it('agrupa por studentId e ignora sub sem dono', () => {
    const idx = indexSubsByStudent([
      { studentId: 'a', status: 'active' },
      { studentId: 'a', status: 'cancelled' },
      { studentId: 'b', status: 'active' },
      { status: 'active' },
      null,
    ]);
    expect(idx.get('a')).toHaveLength(2);
    expect(idx.get('b')).toHaveLength(1);
    expect(idx.size).toBe(2);
  });

  it('lista vazia devolve mapa vazio', () => {
    expect(indexSubsByStudent(null).size).toBe(0);
  });
});

describe('flagsHoje — MC-2', () => {
  const comFlag = (tipos) => ({ id: 't', redFlags: tipos.map((type) => ({ type })) });

  it('conta flags efetivas', () => {
    expect(flagsHoje([comFlag(['TRADE_SEM_STOP', 'RISCO_ACIMA_PERMITIDO'])])).toBe(2);
  });

  it('ignora flag revogada — LOSS_DIARIO_EXCEDIDO saiu no #402', () => {
    expect(flagsHoje([comFlag(['LOSS_DIARIO_EXCEDIDO'])])).toBe(0);
  });

  it('ignora flag limpa pelo mentor', () => {
    const t = { id: 't', redFlags: [{ type: 'TRADE_SEM_STOP' }], mentorClearedViolations: ['TRADE_SEM_STOP'] };
    expect(flagsHoje([t])).toBe(0);
  });

  it('dia sem trade não tem flag', () => {
    expect(flagsHoje([])).toBe(0);
    expect(flagsHoje(null)).toBe(0);
  });
});

describe('foraDoPlanoPct — MC-3', () => {
  const limpo = { id: 'a', redFlags: [] };
  const sujo = { id: 'b', redFlags: [{ type: 'RISCO_ACIMA_PERMITIDO' }] };

  it('metade dos trades com violação → 50%', () => {
    expect(foraDoPlanoPct([limpo, sujo])).toBe(50);
  });

  it('todos limpos → 0%', () => {
    expect(foraDoPlanoPct([limpo, limpo])).toBe(0);
  });

  it('todos sujos → 100%', () => {
    expect(foraDoPlanoPct([sujo])).toBe(100);
  });

  it('sem trade hoje devolve null, não 0 — não medir ≠ estar limpo', () => {
    expect(foraDoPlanoPct([])).toBeNull();
    expect(foraDoPlanoPct(null)).toBeNull();
  });
});

describe('estadoDoPeriodo — MC-4, sobre o motor do dia (#402)', () => {
  // Plano do Marcio: PL 30.000 · stop 1,67%/período (~R$ 501) · meta 3,35% (~R$ 1.005) · RO 0,84%
  const plano = { pl: 30000, periodStop: 1.67, periodGoal: 3.35, riskPerOperation: 0.84, operationPeriod: 'Diário' };
  const trade = (id, result, hora) => ({ id, date: '2026-08-27', entryTime: `2026-08-27T${hora}:00-03:00`, result });

  const estado = (trades) => estadoDoPeriodo(buildPeriodState(trades, plano));

  it('dia em andamento não é nem meta nem stop', () => {
    expect(estado([trade('a', -120, '10:00')])).toEqual({
      atingiuMeta: false, atingiuStop: false, seguiuDepois: false, emAndamento: true,
    });
  });

  it('bateu a meta e parou', () => {
    const r = estado([trade('a', 600, '10:00'), trade('b', 500, '11:00')]);
    expect(r.atingiuMeta).toBe(true);
    expect(r.seguiuDepois).toBe(false);
    expect(r.emAndamento).toBe(false);
  });

  it('bateu a meta e CONTINUOU — é isso que o mentor precisa ver', () => {
    const r = estado([trade('a', 600, '10:00'), trade('b', 500, '11:00'), trade('c', -300, '14:00')]);
    expect(r.atingiuMeta).toBe(true);
    expect(r.seguiuDepois).toBe(true);
  });

  it('bateu o stop e parou', () => {
    const r = estado([trade('a', -260, '10:00'), trade('b', -260, '11:00')]);
    expect(r.atingiuStop).toBe(true);
    expect(r.seguiuDepois).toBe(false);
  });

  it('bateu o stop e CONTINUOU operando', () => {
    const r = estado([trade('a', -260, '10:00'), trade('b', -260, '11:00'), trade('c', -200, '15:00')]);
    expect(r.atingiuStop).toBe(true);
    expect(r.seguiuDepois).toBe(true);
  });

  it('a margem de manejo do #402 vale aqui — 2% abaixo do stop não é stop batido', () => {
    // stop = R$ 501; perder R$ 495 fica dentro da margem de 2%
    const r = estado([trade('a', -495, '10:00')]);
    expect(r.atingiuStop).toBe(false);
    expect(r.emAndamento).toBe(true);
  });

  it('dia sem trade não afirma estado nenhum', () => {
    expect(estado([])).toEqual({
      atingiuMeta: false, atingiuStop: false, seguiuDepois: false, emAndamento: false,
    });
    expect(estadoDoPeriodo(null).emAndamento).toBe(false);
  });

  it('aluno sem plano não vira "em andamento" indevidamente — sem stop não há veredicto', () => {
    const semPlano = buildPeriodState([trade('a', -800, '10:00')], null);
    const r = estadoDoPeriodo(semPlano);
    expect(r.atingiuStop).toBe(false);
    expect(r.atingiuMeta).toBe(false);
  });
});

describe('buildMentorRadar — a passada única', () => {
  const HOJE = new Date(2026, 7, 27, 14, 0);
  const dia = '2026-08-27';
  const ontem = '2026-08-26';

  const plano = {
    id: 'p1', studentId: 'a1', pl: 30000,
    periodStop: 1.67, periodGoal: 3.35, riskPerOperation: 0.84, operationPeriod: 'Diário',
  };
  const planoB = { ...plano, id: 'p2', studentId: 'a2', pl: 10000 };

  const students = [
    { id: 'a1', email: 'Ana@x.com', name: 'Ana', firstLoginAt: '2026-01-01' },
    { id: 'a2', email: 'bruno@x.com', name: 'Bruno', firstLoginAt: '2026-01-01' },
    { id: 'a3', email: 'carla@x.com', name: 'Carla', firstLoginAt: '2026-01-01' }, // bloqueada
    { id: 'a4', email: 'davi@x.com', name: 'Davi' },                                // nunca entrou
  ];
  students[2].loginBlocked = true;

  const subscriptions = [
    { studentId: 'a1', status: 'active', type: 'paid', plan: 'alpha' },
    { studentId: 'a2', status: 'overdue', type: 'paid', plan: 'alpha' },
    { studentId: 'a3', status: 'active', type: 'paid', plan: 'alpha' },
    { studentId: 'a4', status: 'active', type: 'paid', plan: 'alpha' },
  ];

  const t = (id, studentId, result, extra = {}) => ({
    id, studentId, date: dia, entryTime: `${dia}T10:00:00-03:00`,
    result, planId: 'p1', redFlags: [], ...extra,
  });

  const run = (trades, opts = {}) =>
    buildMentorRadar({
      allTrades: trades, plans: [plano, planoB], students, subscriptions, now: HOJE, ...opts,
    });

  it('MC-1 conta só quem está no radar — bloqueado e nunca-logado ficam fora', () => {
    const r = run([]);
    expect(r.header.alunosAtivos).toBe(2);
    expect(r.byStudent.map((a) => a.studentId).sort()).toEqual(['a1', 'a2']);
  });

  it('ignora trade de ontem', () => {
    const r = run([t('x', 'a1', -100, { date: ontem })]);
    expect(r.header.tradesHoje).toBe(0);
    expect(r.header.operaramHoje).toBe(0);
  });

  it('ignora trade de aluno fora do radar — não infla nenhum tile', () => {
    const r = run([t('x', 'a3', -100, { redFlags: [{ type: 'TRADE_SEM_STOP' }] })]);
    expect(r.header.tradesHoje).toBe(0);
    expect(r.header.comAlerta).toBe(0);
    expect(r.header.foraDoPlano).toBeNull();
  });

  it('casa o trade pelo email quando não há studentId, sem depender de caixa', () => {
    const r = run([{ id: 'x', studentEmail: 'ANA@x.com', date: dia, result: -50, planId: 'p1', redFlags: [] }]);
    expect(r.header.operaramHoje).toBe(1);
    expect(r.byStudent.find((a) => a.studentId === 'a1').tradesHoje).toHaveLength(1);
  });

  it('MC-2 dedupa por aluno: 3 flags num aluno é 1 aluno em alerta', () => {
    const r = run([
      t('x', 'a1', -100, { redFlags: [{ type: 'TRADE_SEM_STOP' }, { type: 'RISCO_ACIMA_PERMITIDO' }] }),
      t('y', 'a1', -100, { redFlags: [{ type: 'TRADE_SEM_STOP' }] }),
    ]);
    expect(r.header.comAlerta).toBe(1);
    expect(r.header.flagsTotal).toBe(3);
  });

  it('MC-2 não conta flag revogada pelo #402', () => {
    const r = run([t('x', 'a1', -100, { redFlags: [{ type: 'LOSS_DIARIO_EXCEDIDO' }] })]);
    expect(r.header.comAlerta).toBe(0);
  });

  it('MC-3 mede no nível do trade, não média de médias', () => {
    // Ana: 1 violação em 3 trades. Bruno: 1 em 1.
    // Média de médias daria 66,7%; o correto sobre 4 trades é 50%.
    const r = run([
      t('x1', 'a1', -100, { redFlags: [{ type: 'TRADE_SEM_STOP' }] }),
      t('x2', 'a1', -100), t('x3', 'a1', -100),
      t('y1', 'a2', -100, { planId: 'p2', redFlags: [{ type: 'TRADE_SEM_STOP' }] }),
    ]);
    expect(r.header.foraDoPlano).toBe(50);
  });

  it('MC-3 sem trade no dia devolve null — não medir não é estar limpo', () => {
    expect(run([]).header.foraDoPlano).toBeNull();
  });

  it('MC-4 usa o plano DO TRADE, não o primeiro plano da lista', () => {
    // Bruno opera no p2 (PL 10.000 → stop ~R$ 167). Perder R$ 300 estoura o dele
    // e ficaria dentro do stop do p1 (~R$ 501) se o plano fosse resolvido errado.
    const r = run([t('y', 'a2', -300, { planId: 'p2' })]);
    const bruno = r.byStudent.find((a) => a.studentId === 'a2');
    expect(bruno.plano.id).toBe('p2');
    expect(bruno.estado.atingiuStop).toBe(true);
    expect(r.header.estados.stop).toBe(1);
  });

  it('MC-4 conta quem continuou operando depois do stop', () => {
    const r = run([
      t('y1', 'a2', -300, { planId: 'p2' }),
      t('y2', 'a2', -80, { planId: 'p2', entryTime: `${dia}T15:00:00-03:00` }),
    ]);
    expect(r.header.estados.seguiuDepois).toBe(1);
  });

  it('quem não operou hoje não entra em nenhum estado', () => {
    const r = run([t('x', 'a1', 1200)]); // Ana bate a meta; Bruno não operou
    expect(r.header.estados.meta).toBe(1);
    expect(r.header.estados.emAndamento).toBe(0);
    expect(r.byStudent.find((a) => a.studentId === 'a2').periodState).toBeNull();
  });

  it('base vazia não explode', () => {
    const r = buildMentorRadar();
    expect(r.header.alunosAtivos).toBe(0);
    expect(r.header.foraDoPlano).toBeNull();
    expect(r.byStudent).toEqual([]);
  });
});

describe('buildCalendarDays — o calendário do mentor não soma dinheiro', () => {
  const t = (id, email, date, extra = {}) => ({
    id, studentEmail: email, date, result: -100, redFlags: [], ...extra,
  });

  it('conta trades, alunos distintos e violações efetivas por dia', () => {
    const dias = buildCalendarDays([
      t('a', 'ana@x.com', '2026-08-27', { redFlags: [{ type: 'TRADE_SEM_STOP' }] }),
      t('b', 'ana@x.com', '2026-08-27'),
      t('c', 'bruno@x.com', '2026-08-27'),
      t('d', 'ana@x.com', '2026-08-26'),
    ]);
    expect(dias['2026-08-27']).toMatchObject({ trades: 3, alunos: 2, flags: 1 });
    expect(dias['2026-08-26']).toMatchObject({ trades: 1, alunos: 1, flags: 0 });
  });

  it('não devolve nenhum campo de dinheiro — BRL e USD convivem na turma', () => {
    const dias = buildCalendarDays([
      t('a', 'ana@x.com', '2026-08-27', { result: 500, currency: 'BRL' }),
      t('b', 'bruno@x.com', '2026-08-27', { result: 500, currency: 'USD' }),
    ]);
    const chaves = Object.keys(dias['2026-08-27']);
    expect(chaves).not.toContain('pnl');
    expect(chaves).not.toContain('totalPL');
    expect(chaves).not.toContain('result');
  });

  it('flag revogada pelo #402 não pinta o dia', () => {
    const dias = buildCalendarDays([
      t('a', 'ana@x.com', '2026-08-27', { redFlags: [{ type: 'LOSS_DIARIO_EXCEDIDO' }] }),
    ]);
    expect(dias['2026-08-27'].flags).toBe(0);
  });

  it('ignora quem saiu do radar', () => {
    const dias = buildCalendarDays(
      [t('a', 'ana@x.com', '2026-08-27'), t('b', 'saiu@x.com', '2026-08-27')],
      new Set(['ana@x.com']),
    );
    expect(dias['2026-08-27']).toMatchObject({ trades: 1, alunos: 1, flags: 0 });
  });

  it('não depende de caixa do email pra contar aluno distinto', () => {
    const dias = buildCalendarDays([
      t('a', 'Ana@x.com', '2026-08-27'), t('b', 'ana@X.com', '2026-08-27'),
    ]);
    expect(dias['2026-08-27'].alunos).toBe(1);
  });

  it('diz QUEM operou no dia, do que mais operou pro que menos', () => {
    const dias = buildCalendarDays([
      t('a', 'bruno@x.com', '2026-08-27', { studentName: 'Bruno' }),
      t('b', 'ana@x.com', '2026-08-27', { studentName: 'Ana', redFlags: [{ type: 'TRADE_SEM_STOP' }] }),
      t('c', 'ana@x.com', '2026-08-27', { studentName: 'Ana' }),
    ]);
    expect(dias['2026-08-27'].nomes).toEqual([
      { nome: 'Ana', email: 'ana@x.com', trades: 2, flags: 1 },
      { nome: 'Bruno', email: 'bruno@x.com', trades: 1, flags: 0 },
    ]);
  });

  it('sem studentName cai no prefixo do email — nunca linha anônima', () => {
    const dias = buildCalendarDays([t('a', 'joao.victor@x.com', '2026-08-27')]);
    expect(dias['2026-08-27'].nomes[0].nome).toBe('joao.victor');
  });

  it('trade sem data não cria dia fantasma', () => {
    expect(buildCalendarDays([t('a', 'ana@x.com', null)])).toEqual({});
  });
});

describe('familiasDeRisco — a fonte é o motor unificado (CHUNK-11)', () => {
  const comFamilias = (familias, extra = {}) => ({
    id: 't1', date: '2026-08-27', entryTime: '2026-08-27T10:00:00-03:00',
    behaviorProfile: { families: familias }, ...extra,
  });

  it('lê família negativa com a severidade do motor', () => {
    const r = familiasDeRisco(comFamilias([{ canonicalCode: 'TILT', severity: 'HIGH' }]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ code: 'TILT', family: 'TILT', severity: 'HIGH', peso: 3 });
  });

  it('padrão POSITIVO não é risco — TARGET_HIT e CLEAN_EXECUTION ficam fora', () => {
    const r = familiasDeRisco(comFamilias([
      { canonicalCode: 'TARGET_HIT', severity: 'NONE' },
      { canonicalCode: 'CLEAN_EXECUTION', severity: 'NONE' },
    ]));
    expect(r).toEqual([]);
  });

  it('severidade NONE ou nula não vira risco', () => {
    expect(familiasDeRisco(comFamilias([{ canonicalCode: 'TILT', severity: 'NONE' }]))).toEqual([]);
    expect(familiasDeRisco(comFamilias([{ canonicalCode: 'SIZING_DISCIPLINE', severity: null }]))).toEqual([]);
  });

  it('cai na severidade padrão da taxonomia quando o trade não traz uma', () => {
    const r = familiasDeRisco(comFamilias([{ canonicalCode: 'TILT' }]));
    expect(r[0].severity).toBe('HIGH');
  });

  it('respeita o clearing do mentor por código:trade', () => {
    const t = comFamilias([{ canonicalCode: 'TILT', severity: 'HIGH' }], {
      mentorClearedViolations: ['TILT:t1'],
    });
    expect(familiasDeRisco(t)).toEqual([]);
  });

  it('clearing de OUTRO trade não libera este', () => {
    const t = comFamilias([{ canonicalCode: 'TILT', severity: 'HIGH' }], {
      mentorClearedViolations: ['TILT:outro'],
    });
    expect(familiasDeRisco(t)).toHaveLength(1);
  });

  it('trade legado sem behaviorProfile não explode', () => {
    expect(familiasDeRisco({ id: 'x', date: '2026-08-27' })).toEqual([]);
  });

  it('código desconhecido é ignorado', () => {
    expect(familiasDeRisco(comFamilias([{ canonicalCode: 'NAO_EXISTE', severity: 'HIGH' }]))).toEqual([]);
  });
});

describe('linhaDeRadar — MC-6', () => {
  const f = (family, severity, quandoMs) => ({
    code: family, family, severity, peso: { HIGH: 3, MEDIUM: 2, LOW: 1 }[severity], quandoMs, tradeId: 't',
  });

  it('o gatilho é a família mais grave', () => {
    const r = linhaDeRadar([f('EARLY_EXIT', 'LOW', 100), f('TILT', 'HIGH', 50)]);
    expect(r.family).toBe('TILT');
    expect(r.severity).toBe('HIGH');
  });

  it('empatada a gravidade, vence a mais recente', () => {
    const r = linhaDeRadar([f('TILT', 'HIGH', 100), f('UNPROTECTED_SIZE', 'HIGH', 900)]);
    expect(r.family).toBe('UNPROTECTED_SIZE');
  });

  it('o score soma todas as ocorrências, não só a dominante', () => {
    const r = linhaDeRadar([f('TILT', 'HIGH', 1), f('EARLY_EXIT', 'LOW', 2), f('OVERTRADING', 'MEDIUM', 3)]);
    expect(r.score).toBe(6);
    expect(r.ocorrencias).toBe(3);
  });

  it('sem família não há linha', () => {
    expect(linhaDeRadar([])).toBeNull();
    expect(linhaDeRadar(null)).toBeNull();
  });
});

describe('gatilhoDePrioridade — MC-5, os três gatilhos', () => {
  const f = (family, severity = 'HIGH', quandoMs = 1) => ({
    code: family, family, severity, peso: { HIGH: 3, MEDIUM: 2, LOW: 1 }[severity], quandoMs, tradeId: 't',
  });

  it('dia de fúria: reatividade e revanche entram', () => {
    expect(gatilhoDePrioridade([f('TILT')], null).trigger).toBe(TRIGGER.FURIA);
    expect(gatilhoDePrioridade([f('LOSS_CHASING')], null).trigger).toBe(TRIGGER.FURIA);
    expect(gatilhoDePrioridade([f('IMPULSE_CLUSTER', 'LOW')], null).trigger).toBe(TRIGGER.FURIA);
  });

  it('vários episódios de fúria viram um motivo que conta quantos', () => {
    const g = gatilhoDePrioridade([f('TILT'), f('LOSS_CHASING')], null);
    expect(g.motivo).toContain('2 episódios');
  });

  it('além do stop: o fato é do DIA, não do trade (#402)', () => {
    // A spec pedia a red flag LOSS_DIARIO_EXCEDIDO, revogada por acusar o trade
    // errado. O fato vive no estado do período.
    const g = gatilhoDePrioridade([], { tradesAfterStop: 2, closedBeyondStop: true });
    expect(g.trigger).toBe(TRIGGER.ALEM_DO_STOP);
    expect(g.motivo).toContain('2 operações');
  });

  it('fechar além do stop sem seguir operando também entra', () => {
    const g = gatilhoDePrioridade([], { tradesAfterStop: 0, closedBeyondStop: true });
    expect(g.trigger).toBe(TRIGGER.ALEM_DO_STOP);
    expect(g.motivo).toBe('fechou o dia além do stop');
  });

  it('perder o dia inteiro vem antes do risco de uma operação', () => {
    const g = gatilhoDePrioridade([f('RISK_OVER_RO')], { tradesAfterStop: 1 });
    expect(g.trigger).toBe(TRIGGER.ALEM_DO_STOP);
  });

  it('mas fúria vem antes de tudo — é o estado da pessoa', () => {
    const g = gatilhoDePrioridade([f('TILT')], { tradesAfterStop: 3, closedBeyondStop: true });
    expect(g.trigger).toBe(TRIGGER.FURIA);
  });

  it('risco na operação só entra em severidade alta', () => {
    expect(gatilhoDePrioridade([f('RISK_OVER_RO', 'HIGH')], null).trigger).toBe(TRIGGER.RISCO);
    expect(gatilhoDePrioridade([f('RISK_OVER_RO', 'MEDIUM')], null)).toBeNull();
  });

  it('dia dentro do plano não gera prioridade', () => {
    expect(gatilhoDePrioridade([f('EARLY_EXIT', 'LOW')], { tradesAfterStop: 0, closedBeyondStop: false })).toBeNull();
    expect(gatilhoDePrioridade([], null)).toBeNull();
  });
});

describe('gatilhoDePrioridade — o dia é por CONTA, não por aluno', () => {
  // Wilson opera duas contas. Em 25/08 fez −350 numa (USD) e −350/−520 na outra
  // (BRL). Medir os três contra o stop de uma conta só é somar moedas e contas
  // diferentes — o pecado do #267/#289.
  const conta = (net, extra = {}) => ({ net, closedBeyondStop: false, tradesAfterStop: 0, ...extra });

  it('estoura se QUALQUER conta estourou', () => {
    const g = gatilhoDePrioridade([], [conta(-100), conta(-870, { closedBeyondStop: true })]);
    expect(g.trigger).toBe(TRIGGER.ALEM_DO_STOP);
  });

  it('nenhuma conta estourada, nenhuma prioridade — mesmo que a soma estourasse', () => {
    // Duas contas dentro do próprio stop: a soma não é um número que exista.
    expect(gatilhoDePrioridade([], [conta(-350), conta(-870)])).toBeNull();
  });

  it('soma as operações pós-stop de todas as contas', () => {
    const g = gatilhoDePrioridade([], [
      conta(-500, { tradesAfterStop: 1 }),
      conta(-300, { tradesAfterStop: 2 }),
    ]);
    expect(g.motivo).toContain('3 operações');
  });

  it('aceita um estado só, como antes', () => {
    expect(gatilhoDePrioridade([], conta(-500, { closedBeyondStop: true })).trigger)
      .toBe(TRIGGER.ALEM_DO_STOP);
  });

  it('dia sem plano não gera estouro — sem stop declarado não há barreira', () => {
    expect(gatilhoDePrioridade([], [conta(-9999, { closedBeyondStop: null })])).toBeNull();
  });
});

describe('gatilhoDePrioridade — com duas contas, diz qual', () => {
  it('nomeia a conta quando o aluno tem mais de uma', () => {
    const g = gatilhoDePrioridade([], [
      { net: -100, closedBeyondStop: false, tradesAfterStop: 0, planName: 'WINFUT' },
      { net: -700, closedBeyondStop: true, tradesAfterStop: 0, planName: 'Conta 1' },
    ]);
    expect(g.motivo).toBe('fechou o dia além do stop na conta Conta 1');
  });

  it('com uma conta só, não polui a frase', () => {
    const g = gatilhoDePrioridade([], [
      { net: -700, closedBeyondStop: true, tradesAfterStop: 0, planName: 'WINFUT' },
    ]);
    expect(g.motivo).toBe('fechou o dia além do stop');
  });
});

describe('buildMentorRadar — Prioridade e Radar (Fase B)', () => {
  const HOJE = new Date(2026, 7, 28, 18, 0);
  const dia = '2026-08-28';
  const ontem = '2026-08-27';
  const plano = { id: 'p1', pl: 30000, periodStop: 1.67, periodGoal: 3.35, riskPerOperation: 0.84, operationPeriod: 'Diário', name: 'WINFUT' };

  const students = [
    { id: 'a1', email: 'ana@x.com', name: 'Ana', firstLoginAt: '2026-01-01', whatsappNumber: '+5521999999999' },
    { id: 'a2', email: 'bruno@x.com', name: 'Bruno', firstLoginAt: '2026-01-01' },
  ];
  const subscriptions = [
    { studentId: 'a1', status: 'active', type: 'paid', plan: 'alpha' },
    { studentId: 'a2', status: 'active', type: 'paid', plan: 'alpha' },
  ];
  const t = (id, studentId, data, familias, extra = {}) => ({
    id, studentId, date: data, entryTime: `${data}T10:00:00-03:00`, result: -100, planId: 'p1',
    redFlags: [], behaviorProfile: { families: familias }, ...extra,
  });

  const run = (trades) => buildMentorRadar({ allTrades: trades, plans: [plano], students, subscriptions, now: HOJE });

  it('fúria hoje entra na Prioridade', () => {
    const r = run([t('x', 'a1', dia, [{ canonicalCode: 'TILT', severity: 'HIGH' }])]);
    expect(r.priority).toHaveLength(1);
    expect(r.priority[0].prioridade.trigger).toBe(TRIGGER.FURIA);
    expect(r.radar).toHaveLength(0); // não se repete embaixo
  });

  it('quem está na Prioridade não aparece no Radar', () => {
    const r = run([
      t('x', 'a1', ontem, [{ canonicalCode: 'DIRECTION_FLIP', severity: 'HIGH' }]),
      t('y', 'a1', dia, [{ canonicalCode: 'TILT', severity: 'HIGH' }]),
    ]);
    expect(r.priority.map((a) => a.studentId)).toEqual(['a1']);
    expect(r.radar).toEqual([]);
  });

  it('risco de ONTEM fica no Radar, não na Prioridade — ela é sobre hoje', () => {
    const r = run([t('x', 'a1', ontem, [{ canonicalCode: 'TILT', severity: 'HIGH' }])]);
    expect(r.priority).toEqual([]);
    expect(r.radar).toHaveLength(1);
    expect(r.radar[0].radar.family).toBe('TILT');
  });

  it('fora da janela de 7 dias, some do Radar', () => {
    const r = run([t('x', 'a1', '2026-08-10', [{ canonicalCode: 'TILT', severity: 'HIGH' }])]);
    expect(r.radar).toEqual([]);
  });

  it('a Prioridade sai por gravidade de gatilho: fúria antes de estouro', () => {
    const r = run([
      // Bruno estoura o stop (−600 contra 501)
      t('b1', 'a2', dia, [], { result: -600 }),
      // Ana em fúria
      t('a1t', 'a1', dia, [{ canonicalCode: 'LOSS_CHASING', severity: 'HIGH' }]),
    ]);
    expect(r.priority.map((a) => a.name)).toEqual(['Ana', 'Bruno']);
    expect(r.priority[1].prioridade.trigger).toBe(TRIGGER.ALEM_DO_STOP);
  });

  it('o Radar ordena pelo score, não pela severidade da dominante', () => {
    const r = run([
      t('x1', 'a1', ontem, [{ canonicalCode: 'EARLY_EXIT', severity: 'HIGH' }, { canonicalCode: 'OVERTRADING', severity: 'MEDIUM' }, { canonicalCode: 'DIRECTION_FLIP', severity: 'MEDIUM' }]),
      t('y1', 'a2', ontem, [{ canonicalCode: 'TILT', severity: 'HIGH' }]),
    ]);
    expect(r.radar.map((a) => a.name)).toEqual(['Ana', 'Bruno']); // 3+2+2=7 vs 3
  });

  it('carrega o whatsapp de quem tem — a ação da Torre é link', () => {
    const r = run([t('x', 'a1', dia, [{ canonicalCode: 'TILT', severity: 'HIGH' }])]);
    expect(r.priority[0].whatsappNumber).toBe('+5521999999999');
  });

  it('dia limpo: nem prioridade nem radar', () => {
    const r = run([t('x', 'a1', dia, [{ canonicalCode: 'TARGET_HIT', severity: 'NONE' }], { result: 200 })]);
    expect(r.priority).toEqual([]);
    expect(r.radar).toEqual([]);
  });
});

describe('segundaDa / diasAntes — a semana começa na segunda (INV-06)', () => {
  it('sexta, sábado e domingo pertencem à mesma semana', () => {
    expect(segundaDa('2026-08-28')).toBe('2026-08-24'); // sexta
    expect(segundaDa('2026-08-29')).toBe('2026-08-24'); // sábado
    expect(segundaDa('2026-08-30')).toBe('2026-08-24'); // domingo
  });

  it('segunda é a própria segunda; terça volta um dia', () => {
    expect(segundaDa('2026-08-24')).toBe('2026-08-24');
    expect(segundaDa('2026-08-25')).toBe('2026-08-24');
  });

  it('atravessa a virada de mês', () => {
    expect(segundaDa('2026-09-02')).toBe('2026-08-31');
    expect(diasAntes('2026-09-02', 7)).toBe('2026-08-26');
  });

  it('data inválida devolve null em vez de data errada', () => {
    expect(segundaDa('')).toBeNull();
    expect(diasAntes(null, 7)).toBeNull();
  });
});

describe('foraDoPlanoDoAluno — MC-7', () => {
  const t = (id, flags = []) => ({ id, date: '2026-08-25', redFlags: flags.map((type) => ({ type })) });

  it('a regra pior é a mais REPETIDA, não a mais grave', () => {
    const r = foraDoPlanoDoAluno([
      t('a', ['TRADE_SEM_STOP']), t('b', ['TRADE_SEM_STOP']), t('c', ['RISCO_ACIMA_PERMITIDO']),
    ], null);
    expect(r.tipoPior).toBe('TRADE_SEM_STOP');
    expect(r.regraPior).toBe('Sem stop declarado');
  });

  it('percentual é dos trades violados, não das violações', () => {
    const r = foraDoPlanoDoAluno([t('a', ['TRADE_SEM_STOP', 'RISCO_ACIMA_PERMITIDO']), t('b'), t('c'), t('d')], null);
    expect(r.pct).toBe(25); // 1 trade de 4, ainda que com 2 violações
  });

  it('sobe, desce e estabiliza contra a semana anterior', () => {
    const semana = [t('a', ['TRADE_SEM_STOP']), t('b')]; // 50%
    expect(foraDoPlanoDoAluno(semana, [t('x'), t('y'), t('z'), t('w')]).direcao).toBe('up');
    expect(foraDoPlanoDoAluno(semana, [t('x', ['TRADE_SEM_STOP']), t('y', ['TRADE_SEM_STOP'])]).direcao).toBe('down');
    expect(foraDoPlanoDoAluno(semana, [t('x', ['TRADE_SEM_STOP']), t('y')]).direcao).toBe('flat');
  });

  it('sem semana anterior não inventa seta', () => {
    expect(foraDoPlanoDoAluno([t('a', ['TRADE_SEM_STOP'])], []).direcao).toBeNull();
    expect(foraDoPlanoDoAluno([t('a', ['TRADE_SEM_STOP'])], null).direcao).toBeNull();
  });

  it('flag revogada não conta — semana limpa é 0%, não null', () => {
    const r = foraDoPlanoDoAluno([t('a', ['LOSS_DIARIO_EXCEDIDO'])], null);
    expect(r.pct).toBe(0);
    expect(r.tipoPior).toBeNull();
  });

  it('semana sem trade não vira linha', () => {
    expect(foraDoPlanoDoAluno([], null)).toBeNull();
  });
});

describe('stopVsGain — MC-8', () => {
  const plano = new Map([
    ['p1', { id: 'p1', pl: 30000, riskPerOperation: 1 }],   // RO = R$300
    ['p2', { id: 'p2', pl: 50000, riskPerOperation: 0.75 }], // RO = US$375
  ]);
  const t = (date, result, planId = 'p1') => ({ id: `${date}-${result}`, date, result, planId });

  it('conta ganhos e perdas por dia útil', () => {
    const r = stopVsGain([
      t('2026-08-24', 100), t('2026-08-24', -50), t('2026-08-26', -50),
    ], plano);
    expect(r.dias[0]).toEqual({ label: 'Seg', gains: 1, losses: 1 });
    expect(r.dias[2]).toEqual({ label: 'Qua', gains: 0, losses: 1 });
  });

  it('breakeven não entra em barra nenhuma', () => {
    const r = stopVsGain([t('2026-08-24', 0)], plano);
    expect(r.dias[0]).toEqual({ label: 'Seg', gains: 0, losses: 0 });
  });

  it('sábado e domingo não têm barra', () => {
    const r = stopVsGain([t('2026-08-29', -100), t('2026-08-30', 100)], plano);
    expect(r.dias.every((d) => d.gains === 0 && d.losses === 0)).toBe(true);
  });

  it('o líquido em R soma moedas diferentes sem mentir', () => {
    // +300 BRL num RO de 300 = +1R; −375 USD num RO de 375 = −1R. Líquido 0R.
    const r = stopVsGain([t('2026-08-24', 300, 'p1'), t('2026-08-25', -375, 'p2')], plano);
    expect(r.liquidoR).toBe(0);
    expect(r.comR).toBe(2);
  });

  it('trade sem plano fica FORA do líquido e é reportado', () => {
    const r = stopVsGain([t('2026-08-24', 300, 'p1'), t('2026-08-25', -9999, 'inexistente')], plano);
    expect(r.liquidoR).toBe(1);
    expect(r.semR).toBe(1);
    expect(r.total).toBe(2);
  });

  it('plano sem RO não produz R', () => {
    const semRo = new Map([['p3', { id: 'p3', pl: 30000, riskPerOperation: 0 }]]);
    const r = stopVsGain([t('2026-08-24', 300, 'p3')], semRo);
    expect(r.liquidoR).toBe(0);
    expect(r.semR).toBe(1);
  });

  it('semana vazia não explode', () => {
    const r = stopVsGain([], plano);
    expect(r.total).toBe(0);
    expect(r.dias).toHaveLength(5);
  });
});
