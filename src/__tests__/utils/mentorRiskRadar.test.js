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
    expect(dias['2026-08-27']).toEqual({ trades: 3, alunos: 2, flags: 1 });
    expect(dias['2026-08-26']).toEqual({ trades: 1, alunos: 1, flags: 0 });
  });

  it('não devolve nenhum campo de dinheiro — BRL e USD convivem na turma', () => {
    const dias = buildCalendarDays([
      t('a', 'ana@x.com', '2026-08-27', { result: 500, currency: 'BRL' }),
      t('b', 'bruno@x.com', '2026-08-27', { result: 500, currency: 'USD' }),
    ]);
    expect(Object.keys(dias['2026-08-27'])).toEqual(['trades', 'alunos', 'flags']);
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
    expect(dias['2026-08-27']).toEqual({ trades: 1, alunos: 1, flags: 0 });
  });

  it('não depende de caixa do email pra contar aluno distinto', () => {
    const dias = buildCalendarDays([
      t('a', 'Ana@x.com', '2026-08-27'), t('b', 'ana@X.com', '2026-08-27'),
    ]);
    expect(dias['2026-08-27'].alunos).toBe(1);
  });

  it('trade sem data não cria dia fantasma', () => {
    expect(buildCalendarDays([t('a', 'ana@x.com', null)])).toEqual({});
  });
});
