/**
 * mentorRiskRadar.js — issue #101 (Torre de Controle, Fase A)
 *
 * Núcleo de agregação da Torre: dado o universo de alunos, trades, planos e
 * assinaturas, produz **num passo só** tudo que S1..S6 consomem.
 *
 * POR QUE FUNÇÃO PURA, E NÃO SÓ HOOK:
 *   O hook (`useMentorRiskRadar`) é a casca de memoização. A agregação vive aqui
 *   para poder ser testada sem React — testes de agregação ANTES da UI (INV-05).
 *
 * POR QUE UMA PASSADA SÓ:
 *   `header`, `priority`, `radar`, `foraPlano` e `byStudent` saem do mesmo
 *   agrupamento. Calcular por seção significaria varrer os mesmos trades quatro
 *   vezes ou refatorar o memo a cada fase da issue.
 *
 * ZERO PERSISTÊNCIA (INV-15): tudo é derivado do que o mentor já tem em memória.
 *
 * @see docs/dev/issues/issue-101-torre-controle.md — MC-1..9
 */
import { classifyStudent, getAccessStatus } from './studentClassify';
import { calculateComplianceRate } from './dashboardMetrics';
import { effectiveRedFlags } from './violationFilter';
import { buildPeriodState } from './dayState';


/** 'YYYY-MM-DD' de hoje, no fuso local do mentor. */
export const todayKey = (now = new Date()) => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * MC-1 · O aluno está no radar da Torre?
 *
 * Regra de domínio (Marcio, 27/08/2026): **acesso à plataforma + assinatura viva.**
 *
 * As duas metades são necessárias e nenhuma basta sozinha. Na base de 27/08:
 * 19 alunos têm acesso e 39 têm assinatura viva, mas só 13 têm as duas coisas —
 * 26 pagam e nunca entraram (não produzem trade, não há o que acompanhar) e 6
 * já foram cancelados mas ainda conseguem entrar.
 *
 * `loginBlocked` entra explicitamente porque o bloqueio por inadimplência grava
 * `student.loginBlocked` (`functions/index.js:767`) e **não** mexe em
 * `accessStatus` — sem esta checagem, o aluno bloqueado continuaria no radar,
 * que é o oposto da regra ("uma vez que o atrasado entra em bloqueio, ele sai do
 * radar da torre").
 *
 * `overdue` NÃO é excluído aqui de propósito: quem está em atraso mas ainda não
 * foi bloqueado segue operando e segue precisando de acompanhamento. Quem decide
 * o corte é o bloqueio, não a Torre.
 *
 * @param {Object} student — doc de `students`
 * @param {Array} subs — subscriptions do aluno
 * @returns {boolean}
 */
export const isOnRadar = (student, subs) => {
  if (!student) return false;
  if (student.loginBlocked) return false;
  if (getAccessStatus(student) !== 'active') return false;
  return classifyStudent(student, subs) !== null;
};

/** Índice `studentId → subscriptions[]` a partir da lista achatada do hook. */
export const indexSubsByStudent = (subscriptions) => {
  const map = new Map();
  for (const sub of subscriptions ?? []) {
    if (!sub?.studentId) continue;
    const arr = map.get(sub.studentId) ?? [];
    arr.push(sub);
    map.set(sub.studentId, arr);
  }
  return map;
};

/**
 * MC-2 · O aluno tem alerta HOJE?
 *
 * Alerta = ≥1 red flag **efetiva** (aplica `mentorClearedViolations` e as
 * revogadas — o #402 tirou `LOSS_DIARIO_EXCEDIDO` de circulação) em qualquer
 * trade de hoje. Dedup por aluno: 3 flags no mesmo aluno = 1 alerta.
 *
 * Eventos emocionais (TILT/REVENGE) entram na Fase B junto com o Radar, quando
 * `analyzeEmotionsV2` for cabeado — ele exige `getEmotionConfig`, que não é
 * dependência do header.
 *
 * @returns {number} quantidade de flags efetivas hoje
 */
export const flagsHoje = (tradesHoje) =>
  (tradesHoje ?? []).reduce((acc, t) => acc + effectiveRedFlags(t).length, 0);

/**
 * MC-3 · Percentual fora do plano HOJE, por aluno.
 *
 * `calculateComplianceRate` devolve `{rate, compliant, total, violations}` sobre
 * flags efetivas. Sem trade hoje, não há o que medir — devolve `null`, e o aluno
 * não conta como fora do plano (diferente de contar 0%).
 *
 * @returns {number|null} 0..100
 */
export const foraDoPlanoPct = (tradesHoje) => {
  if (!tradesHoje?.length) return null;
  const { rate } = calculateComplianceRate(tradesHoje);
  if (rate == null || Number.isNaN(rate)) return null;
  return Math.round((100 - rate) * 100) / 100;
};

/**
 * MC-4 · Estado do período por aluno — no vocabulário que a plataforma já usa.
 *
 * A spec pedia média de `summarizeLedger().progressPercent`. Duas razões para
 * não seguir:
 *
 *   1. `progressPercent` divide pela meta do CICLO (`planLedger.js:176`), não do
 *      período. Nos planos ativos isso subestima entre 2x e 20x (mediana 4x), e o
 *      fator varia por aluno — uma média entre eles não significaria nada.
 *   2. O extrato, que é como a plataforma fala hoje, **não exibe percentual de
 *      progresso**. Mostra "Meta / Stop" em dinheiro e um campo "Estado" com o
 *      veredicto (Meta do Ciclo · Stop do Ciclo · Em Andamento).
 *
 * Então o tile conta ESTADO, não média de percentual. A fonte é o
 * `buildPeriodState` do #402 — o mesmo motor que desenha o card do dia na tela do
 * aluno, já com a margem de manejo aplicada. Mentor e aluno passam a ler o
 * mesmo veredicto sobre o mesmo dia.
 *
 * `seguiuDepois` é o sinal operacional: não é quem bateu a meta ou o stop, é quem
 * **continuou operando depois** — o que exige conversa hoje.
 *
 * @param {Object|null} periodState — saída de `buildPeriodState`
 * @returns {{ atingiuMeta: boolean, atingiuStop: boolean, seguiuDepois: boolean, emAndamento: boolean }}
 */
export const estadoDoPeriodo = (periodState) => {
  if (!periodState || !periodState.count) {
    return { atingiuMeta: false, atingiuStop: false, seguiuDepois: false, emAndamento: false };
  }
  const { reachedGoal, goalHitIndex, stopHitIndex, tradesAfterStop, count } = periodState;
  const atingiuMeta = Boolean(reachedGoal);
  const atingiuStop = stopHitIndex !== null && stopHitIndex !== undefined;
  const aposMeta = goalHitIndex !== null && goalHitIndex !== undefined ? count - goalHitIndex - 1 : 0;
  return {
    atingiuMeta,
    atingiuStop,
    seguiuDepois: (tradesAfterStop ?? 0) > 0 || aposMeta > 0,
    emAndamento: !atingiuMeta && !atingiuStop,
  };
};

/**
 * Passada única sobre a base do mentor.
 *
 * Recebe os dados que o `MentorDashboard` já escuta — não abre listener novo.
 * Duplicar `useTrades`/`usePlans`/`useSubscriptions` dentro do hook criaria um
 * segundo `onSnapshot` de cada collection para desenhar a mesma tela.
 *
 * O trade traz `planId`: o plano de um dia é o plano ao qual aquele trade
 * pertence, não "o plano ativo do aluno". Aluno com duas contas tem dois planos
 * vivos ao mesmo tempo, e o stop de um não mede o dia do outro.
 *
 * @param {Object} p
 * @param {Array}  p.allTrades
 * @param {Array}  p.plans
 * @param {Array}  p.students       docs de `/students`
 * @param {Array}  p.subscriptions  subs enriquecidas (useSubscriptions)
 * @param {Date}   [p.now]
 * @returns {{ dia: string, header: Object, byStudent: Array }}
 */
export function buildMentorRadar({ allTrades, plans, students, subscriptions, now } = {}) {
  const dia = todayKey(now ?? new Date());
  const subsIdx = indexSubsByStudent(subscriptions);
  const planoPorId = new Map((plans ?? []).filter((p) => p?.id).map((p) => [p.id, p]));

  const ativos = (students ?? []).filter((s) => isOnRadar(s, subsIdx.get(s?.id) ?? []));
  const porId = new Map(ativos.filter((s) => s?.id).map((s) => [s.id, s]));
  const porEmail = new Map(
    ativos.filter((s) => s?.email).map((s) => [String(s.email).toLowerCase(), s]),
  );

  // Um passe sobre os trades do dia; quem não é aluno do radar não entra.
  const tradesPorAluno = new Map();
  for (const t of allTrades ?? []) {
    if (t?.date !== dia) continue;
    const dono =
      (t.studentId && porId.get(t.studentId)) ||
      (t.studentEmail && porEmail.get(String(t.studentEmail).toLowerCase())) ||
      null;
    if (!dono) continue;
    const arr = tradesPorAluno.get(dono.id) ?? [];
    arr.push(t);
    tradesPorAluno.set(dono.id, arr);
  }

  const byStudent = ativos.map((s) => {
    const tradesHoje = tradesPorAluno.get(s.id) ?? [];
    const plano = planoPorId.get(tradesHoje[0]?.planId) ?? null;
    const periodState = tradesHoje.length ? buildPeriodState(tradesHoje, plano) : null;
    const flags = flagsHoje(tradesHoje);
    return {
      studentId: s.id,
      email: s.email ?? null,
      name: s.name || s.displayName || (s.email ? String(s.email).split('@')[0] : s.id),
      tradesHoje,
      operouHoje: tradesHoje.length > 0,
      flags,
      temAlerta: flags > 0,
      foraDoPlano: foraDoPlanoPct(tradesHoje),
      plano,
      periodState,
      estado: estadoDoPeriodo(periodState),
    };
  });

  // MC-3 no nível do TRADE, não média de médias: 1 violação em 10 trades de um
  // aluno e 1 em 1 de outro não são "55% fora do plano".
  const tradesDoDia = byStudent.flatMap((a) => a.tradesHoje);

  const header = {
    // MC-1
    alunosAtivos: byStudent.length,
    operaramHoje: byStudent.filter((a) => a.operouHoje).length,
    // MC-2 — dedup por aluno: três flags no mesmo aluno é um aluno em alerta.
    comAlerta: byStudent.filter((a) => a.temAlerta).length,
    flagsTotal: byStudent.reduce((acc, a) => acc + a.flags, 0),
    // MC-3
    foraDoPlano: foraDoPlanoPct(tradesDoDia),
    tradesHoje: tradesDoDia.length,
    // MC-4
    estados: {
      meta: byStudent.filter((a) => a.estado.atingiuMeta).length,
      stop: byStudent.filter((a) => a.estado.atingiuStop).length,
      seguiuDepois: byStudent.filter((a) => a.estado.seguiuDepois).length,
      emAndamento: byStudent.filter((a) => a.estado.emAndamento).length,
    },
  };

  return { dia, header, byStudent };
}

/**
 * Índice de dias para o calendário do mentor.
 *
 * POR QUE NÃO SOMA DINHEIRO: a turma opera em duas moedas (base 27/08: 274
 * trades em BRL, 58 em USD, 47 sem moeda declarada). Somar o P&L da turma num
 * dia entrega um número que não existe — a mesma armadilha do #267/#289. E
 * ainda que fosse moeda única, somar o dinheiro de doze pessoas diferentes não
 * responde nada que o mentor precise saber.
 *
 * O que o dia diz aqui é ATIVIDADE E RISCO: quantos operaram, quantos trades,
 * quantas violações efetivas. Dinheiro do dia é assunto do aluno, na tela dele.
 *
 * @param {Array} trades
 * @param {Set<string>} [emailsNoRadar] — quando presente, ignora quem saiu do radar
 * @returns {Object} { 'YYYY-MM-DD': { trades, alunos, flags } }
 */
export function buildCalendarDays(trades, emailsNoRadar = null) {
  const dias = {};
  for (const t of trades ?? []) {
    if (!t?.date) continue;
    const email = String(t.studentEmail ?? '').toLowerCase();
    if (emailsNoRadar && emailsNoRadar.size > 0 && !emailsNoRadar.has(email)) continue;
    const d = (dias[t.date] ??= { trades: 0, alunos: new Set(), flags: 0 });
    d.trades += 1;
    if (email) d.alunos.add(email);
    d.flags += effectiveRedFlags(t).length;
  }
  const saida = {};
  for (const [data, d] of Object.entries(dias)) {
    saida[data] = { trades: d.trades, alunos: d.alunos.size, flags: d.flags };
  }
  return saida;
}
