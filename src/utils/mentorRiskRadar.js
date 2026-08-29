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
import { classifyStudent, getAccessStatus, inReviewScope } from './studentClassify';
import { calculateComplianceRate } from './dashboardMetrics';
import { redFlagLabel } from './compliance';
import { effectiveRedFlags, flagType } from './violationFilter';
import { buildPeriodState } from './dayState';
import { getPattern } from '../constants/behavioralTaxonomy';
import { SEVERITY_WEIGHT } from './maturityEngine/behaviorWeights';
import { tradeInstantMs, sortTradesChrono } from './tradeInstant';
import { computeCurrentPl, computeCycleBalance } from './planBalance';
import { buildPlanLedger, summarizeLedger } from './planLedger';


/** Número finito ou null — entrada de Firestore chega como string com frequência. */
const num = (v) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
};

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
 * ESCOPO DE MENTORIA (28/08, Marcio: "Antonio não é alpha"): a Torre é a tela de
 * ACOMPANHAMENTO individual, e acompanhamento individual só existe no track Alpha
 * — é a mesma regra que o #269 fixou para Revisão e feedback (`inReviewScope`:
 * alpha + trial-alpha). Espelho é self-service: o aluno tem a plataforma, não tem
 * mentor. Na base, Antonio Pina e Thiago Lau são espelho e apareciam como
 * "sumidos há 176 e 92 dias" — cobrança de uma relação que não existe.
 *
 * @param {Object} student — doc de `students`
 * @param {Array} subs — subscriptions do aluno
 * @returns {boolean}
 */
export const isOnRadar = (student, subs) => {
  if (!student) return false;
  if (student.loginBlocked) return false;
  if (getAccessStatus(student) !== 'active') return false;
  return inReviewScope(classifyStudent(student, subs));
};

/**
 * Emails (minúsculos) de quem está no radar. O calendário e as listas da aba
 * Análises usam o MESMO conjunto da Torre — duas populações com o mesmo nome na
 * mesma plataforma foi o que gerou "17 alunos ativos aqui, 12 ali".
 */
export const emailsDoRadar = (students, subscriptions) => {
  const idx = indexSubsByStudent(subscriptions);
  const emails = new Set();
  for (const s of students ?? []) {
    if (s?.email && isOnRadar(s, idx.get(s.id) ?? [])) emails.add(String(s.email).toLowerCase());
  }
  return emails;
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
export function buildMentorRadar({ allTrades, plans, students, subscriptions, now, janelaDias = 7 } = {}) {
  const agora = now ?? new Date();
  const dia = todayKey(agora);
  // Janela do Radar: a turma tem 12 alunos e 2 a 4 operam por dia. Um radar de
  // HOJE ficaria vazio quase sempre e o mentor perderia o padrão da semana. A
  // Prioridade continua sendo só de hoje — ela é sobre agir agora.
  const inicioRadar = todayKey(new Date(agora.getTime() - (janelaDias - 1) * 86400000));
  // A Fase C compara a semana corrente com a anterior, então a varredura vai até a
  // segunda-feira retrasada — o que for mais antigo entre isso e a janela do Radar.
  const segundaAtual = segundaDa(dia);
  const segundaAnterior = diasAntes(segundaAtual, 7);
  const inicioJanela = [inicioRadar, segundaAnterior].filter(Boolean).sort()[0];
  const subsIdx = indexSubsByStudent(subscriptions);
  const planoPorId = new Map((plans ?? []).filter((p) => p?.id).map((p) => [p.id, p]));

  const ativos = (students ?? []).filter((s) => isOnRadar(s, subsIdx.get(s?.id) ?? []));
  const porId = new Map(ativos.filter((s) => s?.id).map((s) => [s.id, s]));
  const porEmail = new Map(
    ativos.filter((s) => s?.email).map((s) => [String(s.email).toLowerCase(), s]),
  );

  // Um passe sobre a janela; quem não é aluno do radar não entra.
  const tradesPorAluno = new Map();
  const janelaPorAluno = new Map();
  const radarPorAluno = new Map();
  // Saldo, winrate e drawdown são do CICLO, não da janela: precisam do histórico.
  const todosDoAluno = new Map();
  for (const t of allTrades ?? []) {
    if (!t?.date) continue;
    const dono =
      (t.studentId && porId.get(t.studentId)) ||
      (t.studentEmail && porEmail.get(String(t.studentEmail).toLowerCase())) ||
      null;
    if (!dono) continue;

    const todos = todosDoAluno.get(dono.id) ?? [];
    todos.push(t);
    todosDoAluno.set(dono.id, todos);

    if (t.date < inicioJanela || t.date > dia) continue;
    const naJanela = janelaPorAluno.get(dono.id) ?? [];
    naJanela.push(t);
    janelaPorAluno.set(dono.id, naJanela);
    if (t.date >= inicioRadar) {
      const noRadar = radarPorAluno.get(dono.id) ?? [];
      noRadar.push(t);
      radarPorAluno.set(dono.id, noRadar);
    }
    if (t.date === dia) {
      const hoje = tradesPorAluno.get(dono.id) ?? [];
      hoje.push(t);
      tradesPorAluno.set(dono.id, hoje);
    }
  }

  const byStudent = ativos.map((s) => {
    const tradesHoje = tradesPorAluno.get(s.id) ?? [];
    const tradesJanela = janelaPorAluno.get(s.id) ?? [];
    const tradesRadar = radarPorAluno.get(s.id) ?? [];
    const tradesSemana = tradesJanela.filter((t) => t.date >= segundaAtual);
    const tradesSemanaAnterior = tradesJanela.filter(
      (t) => t.date >= segundaAnterior && t.date < segundaAtual,
    );
    // Um estado de período POR PLANO: contas diferentes não se somam, nem os stops
    // nem as moedas. `periodState` (singular) segue existindo para o header e é o do
    // plano com o pior resultado do dia — o que exige conversa.
    const porPlano = new Map();
    for (const t of tradesHoje) {
      const chave = t.planId ?? '(sem plano)';
      const arr = porPlano.get(chave) ?? [];
      arr.push(t);
      porPlano.set(chave, arr);
    }
    const periodStates = [...porPlano.entries()].map(([planId, ts]) => {
      const p = planoPorId.get(planId) ?? null;
      return { ...buildPeriodState(ts, p, { periodKey: dia }), planId, planName: p?.name ?? null };
    });
    const periodState = periodStates.length
      ? [...periodStates].sort((a, b) => a.net - b.net)[0]
      : null;
    const plano = planoPorId.get(tradesHoje[0]?.planId) ?? null;
    const flags = flagsHoje(tradesHoje);

    // Faixa 2 — a espinha dorsal: quando operou pela última vez e o que devo a ele.
    const todos = todosDoAluno.get(s.id) ?? [];
    const ultimaData = todos.reduce(
      (maisNova, t) => (t?.date && (!maisNova || t.date > maisNova) ? t.date : maisNova),
      null,
    );
    const feedbackPendente = todos.filter(
      (t) => t?.status === 'OPEN' || t?.status === 'QUESTION',
    ).length;

    const familiasHoje = tradesHoje.flatMap(familiasDeRisco);
    const familiasJanela = tradesRadar.flatMap(familiasDeRisco);

    return {
      tradesJanela,
      familiasHoje,
      familiasJanela,
      prioridade: gatilhoDePrioridade(familiasHoje, periodStates),
      radar: linhaDeRadar(familiasJanela),
      tradesSemana,
      ultimaOperacao: ultimaData,
      diasSemOperar: ultimaData ? diasEntre(ultimaData, dia) : null,
      resultadoSemanaR: semanaEmR(tradesSemana, planoPorId),
      pendencias: { feedback: feedbackPendente },
      foraDoPlanoSemana: foraDoPlanoDoAluno(tradesSemana, tradesSemanaAnterior),
      // S6 — o retrato do aluno é sempre de UM plano. Com duas contas, a do dia;
      // sem trade hoje, a mais recente da janela. Misturar as duas seria repetir
      // o erro que a D12 corrigiu.
      visaoRapida: visaoRapidaDoAluno({
        plano: planoPorId.get(planoEmFoco(tradesHoje, todosDoAluno.get(s.id))) ?? null,
        tradesDoPlano: todosDoAluno.get(s.id) ?? [],
        periodState,
      }),
      studentId: s.id,
      email: s.email ?? null,
      // D9: a ação da Torre é LINK pro que já existe. O número já está cadastrado
      // e validado em E.164 — 66 dos 68 alunos têm.
      whatsappNumber: s.whatsappNumber ?? null,
      name: s.name || s.displayName || (s.email ? String(s.email).split('@')[0] : s.id),
      tradesHoje,
      operouHoje: tradesHoje.length > 0,
      flags,
      temAlerta: flags > 0,
      foraDoPlano: foraDoPlanoPct(tradesHoje),
      plano,
      periodState,
      periodStates,
      estado: estadoDoPeriodo(periodState),
    };
  });

  // MC-3 no nível do TRADE, não média de médias: 1 violação em 10 trades de um
  // aluno e 1 em 1 de outro não são "55% fora do plano".
  const tradesDoDia = byStudent.flatMap((a) => a.tradesHoje);

  const header = {
    alunosAtivos: byStudent.length,
    operaramHoje: byStudent.filter((a) => a.operouHoje).length,
    tradesHoje: tradesDoDia.length,
    // Fora do plano do header mede a SEMANA, igual à coluna da turma. Antes havia
    // dois "Fora do Plano" na mesma tela com janelas diferentes — o tile media hoje
    // e a seção media a semana. Um nome, um número.
    foraDoPlano: foraDoPlanoPct(byStudent.flatMap((a) => a.tradesSemana)),
    tradesSemana: byStudent.reduce((acc, a) => acc + a.tradesSemana.length, 0),
    // Quantos exigem alguma atitude sua — as quatro primeiras faixas da turma.
    precisamDeVoce: 0, // preenchido abaixo, depois que `turma` existe
    pendencias: byStudent.reduce((acc, a) => acc + (a.pendencias?.feedback ?? 0), 0),
  };

  // S2 — quem exige ação hoje, do mais grave para o menos. A gravidade é a do
  // GATILHO (o estado da pessoa vem antes do estouro, que vem antes do risco de
  // uma operação); o score do comportamento só desempata.
  const ORDEM_GATILHO = { [TRIGGER.FURIA]: 0, [TRIGGER.ALEM_DO_STOP]: 1, [TRIGGER.RISCO]: 2 };
  const priority = byStudent
    .filter((a) => a.prioridade)
    .sort((a, b) =>
      (ORDEM_GATILHO[a.prioridade.trigger] ?? 9) - (ORDEM_GATILHO[b.prioridade.trigger] ?? 9)
      || (b.radar?.score ?? 0) - (a.radar?.score ?? 0));

  // S3 — o resto de quem tem risco na janela. Quem já está na Prioridade não se
  // repete embaixo: seria a mesma pessoa cobrada duas vezes na mesma tela.
  const naPrioridade = new Set(priority.map((a) => a.studentId));
  const radar = byStudent
    .filter((a) => a.radar && !naPrioridade.has(a.studentId))
    .sort((a, b) => b.radar.score - a.radar.score || (b.radar.quandoMs ?? 0) - (a.radar.quandoMs ?? 0));

  // Faixa 2 — a turma inteira, ordenada por quem precisa de atenção. NUNCA
  // filtrada: uma lista que esconde quem está quieto não é a lista da turma.
  const turma = byStudent
    .map((a) => ({ ...a, atencao: faixaDeAtencao(a) }))
    .sort((a, b) =>
      a.atencao.faixa - b.atencao.faixa
      // Dentro da faixa: quem está calado há mais tempo primeiro; empate, por nome.
      || (b.diasSemOperar ?? -1) - (a.diasSemOperar ?? -1)
      || String(a.name).localeCompare(String(b.name), 'pt-BR'));

  header.precisamDeVoce = turma.filter((a) => a.atencao.faixa <= FAIXA.FORA_DO_PLANO).length;

  // S4 — ranking de quem mais saiu do plano na semana. Quem não violou nada não
  // entra: uma lista de zeros não é ranking.
  const foraPlano = byStudent
    .filter((a) => a.foraDoPlanoSemana && a.foraDoPlanoSemana.pct > 0)
    .sort((a, b) => b.foraDoPlanoSemana.pct - a.foraDoPlanoSemana.pct);

  return {
    dia, janelaDias, semanaComecaEm: segundaAtual,
    header, byStudent, turma, priority, radar, foraPlano,
  };
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
export function buildCalendarDays(trades, emailsNoRadar = null, planoPorId = null) {
  const dias = {};
  for (const t of trades ?? []) {
    if (!t?.date) continue;
    const email = String(t.studentEmail ?? '').toLowerCase();
    if (emailsNoRadar && emailsNoRadar.size > 0 && !emailsNoRadar.has(email)) continue;
    const d = (dias[t.date] ??= { trades: 0, flags: 0, gains: 0, losses: 0, r: 0, comR: 0, porAluno: new Map() });
    const flags = effectiveRedFlags(t).length;
    d.trades += 1;
    d.flags += flags;

    // Ganho/perda por dia — a marcação que vivia num gráfico de barras separado.
    // Barra por dia da semana é um calendário com menos informação: o dia já existe
    // aqui, com data real, em vez de "Seg..Sex" agregando semanas diferentes.
    const res = num(t.result);
    if (res > 0) d.gains += 1;
    else if (res < 0) d.losses += 1; // breakeven não é ganho nem perda

    // Líquido do dia em R — única unidade que soma alunos de moedas diferentes (D14).
    const plano = planoPorId?.get?.(t.planId) ?? null;
    const ro = plano?.pl > 0 && plano?.riskPerOperation > 0
      ? plano.pl * (plano.riskPerOperation / 100)
      : null;
    if (res != null && ro) {
      d.r += res / ro;
      d.comR += 1;
    }

    const chave = email || t.studentName || '(sem dono)';
    const aluno = d.porAluno.get(chave) ?? {
      nome: t.studentName || (email ? email.split('@')[0] : 'sem dono'),
      email: t.studentEmail ?? null,
      trades: 0,
      flags: 0,
    };
    aluno.trades += 1;
    aluno.flags += flags;
    if (t.studentName) aluno.nome = t.studentName;
    d.porAluno.set(chave, aluno);
  }

  const saida = {};
  for (const [data, d] of Object.entries(dias)) {
    // Quem mais operou primeiro: é a ordem em que o mentor quer ler o dia.
    const alunos = [...d.porAluno.values()].sort(
      (a, b) => b.trades - a.trades || a.nome.localeCompare(b.nome),
    );
    saida[data] = {
      trades: d.trades,
      alunos: alunos.length,
      flags: d.flags,
      gains: d.gains,
      losses: d.losses,
      r: Math.round(d.r * 100) / 100,
      comR: d.comR,
      nomes: alunos,
    };
  }
  return saida;
}

// ============================================================================
// Fase B — Prioridade do Dia (S2) e Radar de Risco (S3)
// ============================================================================

/**
 * FONTE DO COMPORTAMENTO: `trade.behaviorProfile.families`, o motor unificado do
 * CHUNK-11 (#301/#305) — não as red flags que a spec de 27/07 assumia.
 *
 * Por quê: a spec é anterior ao motor. Hoje **100% dos 379 trades da base têm
 * `behaviorProfile`**, com severidade já normalizada (HIGH/MEDIUM/LOW) e código
 * canônico com rótulo em português (`BEHAVIOR_LABELS`). As red flags cobrem só
 * conformidade com o plano; o motor cobre o comportamento inteiro, que é o
 * assunto da Torre.
 */

/** Gatilhos críticos da Prioridade do Dia (D4). */
export const TRIGGER = {
  FURIA: 'DIA_DE_FURIA',
  RISCO: 'RISCO_NA_OPERACAO',
  ALEM_DO_STOP: 'ALEM_DO_STOP',
};

/** Famílias que caracterizam "dia de fúria" — reatividade e revanche. */
const FAMILIAS_FURIA = new Set(['TILT', 'LOSS_CHASING', 'IMPULSE_CLUSTER', 'CHASE_REENTRY']);
/** Famílias que caracterizam risco na própria operação. */
const FAMILIAS_RISCO = new Set(['RISK_OVER_RO', 'UNPROTECTED_SIZE', 'AVERAGING_DOWN']);

const clearedKey = (code, tradeId) => `${code}:${tradeId}`;

/**
 * Famílias NEGATIVAS e vigentes de um trade.
 *
 * Aplica o mesmo clearing estendido do motor de maturidade (`canonicalCode:tradeId`
 * em `mentorClearedViolations`) — o que o mentor liberou não volta como alarme.
 * Padrões positivos (TARGET_HIT, CLEAN_EXECUTION, RECONSIDERATION) ficam de fora:
 * são o oposto de risco.
 */
export function familiasDeRisco(trade) {
  const fams = trade?.behaviorProfile?.families;
  if (!Array.isArray(fams)) return [];
  const cleared = Array.isArray(trade.mentorClearedViolations) ? trade.mentorClearedViolations : [];
  const saida = [];
  for (const f of fams) {
    const code = f?.canonicalCode;
    if (!code) continue;
    if (cleared.includes(clearedKey(code, trade.id))) continue;
    const p = getPattern(code);
    if (!p || p.valence !== 'negative') continue;
    const severity = f.severity ?? p.severityDefault ?? null;
    if (!SEVERITY_WEIGHT[severity]) continue; // NONE/null não é risco
    saida.push({
      code,
      family: p.family,
      severity,
      peso: SEVERITY_WEIGHT[severity],
      tradeId: trade.id ?? null,
      quandoMs: tradeInstantMs(trade),
      ticker: trade.ticker ?? null,
    });
  }
  return saida;
}

/** Ordena por gravidade e, empatado, pelo mais recente. */
const maisGrave = (a, b) => b.peso - a.peso || (b.quandoMs ?? 0) - (a.quandoMs ?? 0);

/**
 * MC-6 · Uma linha de Radar por aluno.
 *
 * IMPACTO vem da severidade já normalizada pelo motor (HIGH→ALTO, MEDIUM→MÉDIO,
 * LOW→BAIXO) em vez de um limiar novo sobre soma de penalidades: a escala
 * unificada existe justamente para não haver duas réguas na plataforma.
 *
 * GATILHO é a família dominante — a mais grave, e entre iguais a mais recente.
 */
export function linhaDeRadar(familias) {
  if (!familias?.length) return null;
  const ordenadas = [...familias].sort(maisGrave);
  const dominante = ordenadas[0];
  return {
    code: dominante.code,
    family: dominante.family,
    severity: dominante.severity,
    quandoMs: dominante.quandoMs,
    tradeId: dominante.tradeId,
    ocorrencias: familias.length,
    score: familias.reduce((acc, f) => acc + f.peso, 0),
  };
}

/**
 * MC-5 · O aluno entra na Prioridade do Dia?
 *
 * Três gatilhos (D4), todos sobre HOJE:
 *   a) dia de fúria — reatividade/revanche (TILT, LOSS_CHASING, IMPULSE_CLUSTER, CHASE_REENTRY);
 *   b) risco na operação — risco acima do RO, posição descoberta, preço médio;
 *   c) além do stop — o fato do DIA, não do trade.
 *
 * (c) merece nota: a spec pedia a red flag `LOSS_DIARIO_EXCEDIDO`, que o #402
 * revogou por acusar o trade errado — o estouro é do dia, e um trade não pode
 * carregá-lo. O fato continua existindo e vive em `buildPeriodState`: fechar além
 * do stop, ou continuar operando depois de batê-lo. É de lá que ele vem agora.
 *
 * @returns {{trigger: string, motivo: string}|null}
 */
export function gatilhoDePrioridade(familias, periodStates) {
  const negativas = familias ?? [];
  // Um aluno com duas contas tem DOIS dias em paralelo, cada um com seu stop e sua
  // moeda. Somar os dois num número só foi o que quase me fez acusar o Wilson de
  // estourar o stop: −350 USD numa conta e −350/−520 BRL na outra, medidos contra
  // o stop de uma delas. Cada conta responde pelo seu próprio dia.
  const estados = (Array.isArray(periodStates) ? periodStates : [periodStates]).filter(Boolean);

  const furia = negativas.filter((f) => FAMILIAS_FURIA.has(f.family)).sort(maisGrave);
  if (furia.length) {
    return {
      trigger: TRIGGER.FURIA,
      motivo: furia.length > 1
        ? `${furia.length} episódios de reatividade hoje`
        : 'reatividade após perda',
      familia: furia[0].family,
    };
  }

  // O fato do dia vem antes do risco de uma operação: perder o dia inteiro é maior.
  // Com mais de uma conta, dizer QUAL: sem isso o mentor abre o dia e não sabe
  // onde olhar.
  const ondeFoi = (e) => (estados.length > 1 && e.planName ? ` na conta ${e.planName}` : '');

  const seguiu = estados.filter((e) => e.tradesAfterStop > 0);
  if (seguiu.length) {
    const n = seguiu.reduce((acc, e) => acc + e.tradesAfterStop, 0);
    return {
      trigger: TRIGGER.ALEM_DO_STOP,
      motivo: `continuou operando depois do stop (${n} ${n === 1 ? 'operação' : 'operações'})${ondeFoi(seguiu[0])}`,
      familia: null,
    };
  }
  const estourada = estados.find((e) => e.closedBeyondStop);
  if (estourada) {
    return {
      trigger: TRIGGER.ALEM_DO_STOP,
      motivo: `fechou o dia além do stop${ondeFoi(estourada)}`,
      familia: null,
    };
  }

  const risco = negativas.filter((f) => FAMILIAS_RISCO.has(f.family)).sort(maisGrave);
  if (risco.length && risco[0].severity === 'HIGH') {
    return { trigger: TRIGGER.RISCO, motivo: 'risco acima do autorizado', familia: risco[0].family };
  }

  return null;
}

// ============================================================================
// Fase C — Fora do Plano (S4) e Stop × Gain (S5)
// ============================================================================

/** Segunda-feira da semana de uma data 'YYYY-MM-DD' (INV-06: semana começa segunda). */
export const segundaDa = (dataKey) => {
  const [y, m, d] = String(dataKey).split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 12); // meio-dia: imune a horário de verão
  const dow = dt.getDay();
  dt.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1));
  return todayKey(dt);
};

/** Mesma data, N dias antes, em 'YYYY-MM-DD'. */
export const diasAntes = (dataKey, n) => {
  const [y, m, d] = String(dataKey).split('-').map(Number);
  if (!y || !m || !d) return null;
  return todayKey(new Date(y, m - 1, d - n, 12));
};

/**
 * MC-7 · Fora do Plano por aluno — ranking da SEMANA CORRENTE (D5).
 *
 * Aqui a fonte é a red flag, não o motor comportamental: a seção é sobre
 * ADESÃO AO PLANO, e é isso que a red flag mede. O motor (D10) mede comportamento,
 * que é o assunto do Radar. Duas perguntas diferentes, duas fontes.
 *
 * A "regra pior" é a violação mais frequente da semana — a que o aluno repete,
 * não a mais grave que ele cometeu uma vez.
 *
 * @returns {{pct:number, regraPior:string|null, tipoPior:string|null, direcao:'up'|'down'|'flat'|null, trades:number}|null}
 */
export function foraDoPlanoDoAluno(tradesSemana, tradesSemanaAnterior) {
  const pct = foraDoPlanoPct(tradesSemana);
  if (pct == null) return null;

  const contagem = new Map();
  for (const t of tradesSemana ?? []) {
    for (const f of effectiveRedFlags(t)) {
      const tipo = flagType(f);
      if (!tipo) continue;
      contagem.set(tipo, (contagem.get(tipo) ?? 0) + 1);
    }
  }
  const [tipoPior] = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];

  const anterior = foraDoPlanoPct(tradesSemanaAnterior);
  // Sem semana anterior não há direção — seta inventada é pior que seta ausente.
  let direcao = null;
  if (anterior != null) {
    if (pct > anterior + 1) direcao = 'up';
    else if (pct < anterior - 1) direcao = 'down';
    else direcao = 'flat';
  }

  return {
    pct,
    tipoPior: tipoPior ?? null,
    regraPior: tipoPior ? redFlagLabel(tipoPior) : null,
    direcao,
    trades: tradesSemana?.length ?? 0,
    pctAnterior: anterior,
  };
}

// ============================================================================
// Fase D — Visão Rápida por Aluno (S6)
// ============================================================================

/**
 * MC-9 · O retrato de um aluno no trilho direito.
 *
 * REUSA A SSoT, não recomputa fórmula: `computeCurrentPl`/`computeCycleBalance`
 * (planBalance) para o saldo, `buildPlanLedger`/`summarizeLedger` (planLedger)
 * para o winrate, `buildPeriodState` (#402) para a meta do período.
 *
 * DUAS CORREÇÕES sobre a spec de 27/07:
 *
 * 1. "Meta semanal" NÃO usa `summarizeLedger().progressPercent`: aquele campo
 *    divide pela meta do CICLO (`planLedger.js:176`), não do período — subestima
 *    entre 2x e 20x, com fator diferente por aluno. Aqui a meta é a do PERÍODO
 *    que o plano declara (`operationPeriod`), medida pelo mesmo motor que desenha
 *    o card do dia do aluno. Mesma correção da D3.
 *
 * 2. O drawdown é pico-a-vale sobre a ordem CRONOLÓGICA (`sortTradesChrono`, a
 *    SSoT do #402). O cálculo que existe no dashboard ordena só por `date`, então
 *    trades do mesmo dia entram na ordem que o Firestore devolver — e o valor
 *    muda a cada leitura. Aqui a ordem é total e determinística.
 *
 * @returns {Object|null}
 */
/**
 * Qual conta está em foco no retrato: a do dia; sem trade hoje, a do último trade
 * que o aluno registrou — não a da janela, que deixava quem passou a semana sem
 * operar aparecendo como "sem plano".
 */
export function planoEmFoco(tradesHoje, todosOsTrades) {
  if (tradesHoje?.[0]?.planId) return tradesHoje[0].planId;
  const comData = (todosOsTrades ?? []).filter((t) => t?.date && t.planId);
  if (!comData.length) return null;
  return comData.reduce((maisNovo, t) => (t.date > maisNovo.date ? t : maisNovo)).planId;
}

export function visaoRapidaDoAluno({ plano, tradesDoPlano, periodState }) {
  if (!plano) return null;

  const doPlano = (tradesDoPlano ?? []).filter((t) => t.planId === plano.id);
  const saldoCiclo = computeCycleBalance(plano, doPlano);
  const saldoAtual = computeCurrentPl(plano, doPlano);

  const roValor = plano.pl > 0 && plano.riskPerOperation > 0
    ? plano.pl * (plano.riskPerOperation / 100)
    : null;

  const ledger = buildPlanLedger(doPlano, plano);
  const resumo = summarizeLedger(ledger, plano);

  // Meta DO PERÍODO — não a do ciclo. Ver nota 1 acima.
  // Sem período aberto (ninguém operou hoje) a meta não some: o progresso do dia é
  // zero, e zero é uma informação — "não começou" é diferente de "não sei".
  const metaValor = periodState?.goalValue
    ?? (plano.pl > 0 && plano.periodGoal > 0 ? plano.pl * (plano.periodGoal / 100) : null);
  const metaPercent = metaValor > 0
    ? Math.round(((periodState?.net ?? 0) / metaValor) * 100)
    : null;

  // Drawdown pico-a-vale, em ordem cronológica total. Ver nota 2 acima.
  const emOrdem = sortTradesChrono(doPlano);
  let cum = 0;
  let pico = 0;
  let maiorQueda = 0;
  for (const t of emOrdem) {
    cum += num(t.result) ?? 0;
    if (cum > pico) pico = cum;
    const queda = pico - cum;
    if (queda > maiorQueda) maiorQueda = queda;
  }

  return {
    planId: plano.id,
    planName: plano.name ?? null,
    saldoAtual,
    saldoCiclo,
    liquidoR: roValor ? Math.round((saldoCiclo / roValor) * 100) / 100 : null,
    metaValor,
    metaPercent,
    periodo: plano.operationPeriod ?? 'Diário',
    drawdown: Math.round(maiorQueda * 100) / 100,
    drawdownPercent: plano.pl > 0 ? Math.round((maiorQueda / plano.pl) * 1000) / 10 : null,
    winRate: Math.round((resumo.winRate ?? 0) * 10) / 10,
    trades: doPlano.length,
  };
}

// ============================================================================
// Fase E — A turma (faixa 2): uma linha por aluno, todos, sempre
// ============================================================================

/**
 * Distância em dias entre duas datas 'YYYY-MM-DD'.
 */
export const diasEntre = (de, ate) => {
  if (!de || !ate) return null;
  const [y1, m1, d1] = String(de).split('-').map(Number);
  const [y2, m2, d2] = String(ate).split('-').map(Number);
  if (!y1 || !y2) return null;
  return Math.round((new Date(y2, m2 - 1, d2, 12) - new Date(y1, m1 - 1, d1, 12)) / 86400000);
};

/**
 * Faixas de atenção — a ordem da lista da turma.
 *
 * POR QUE FAIXA E NÃO SCORE: um score único exigiria pesos inventados ("silêncio
 * vale 30, severidade alta vale 40") que ninguém consegue defender nem depurar.
 * A faixa é uma frase: primeiro quem exige ação hoje, depois quem sumiu, depois
 * quem está em risco, depois quem saiu do plano, depois quem está sumindo, e por
 * fim quem está em dia. O mentor consegue prever a ordem antes de olhar a tela.
 *
 * SUMIU vem em segundo, à frente do risco comportamental, porque é o problema
 * real desta turma: na semana de 24-28/08, 8 dos 12 alunos não operaram nenhuma
 * vez. Alarme a tela já mostrava; ausência, nenhuma das duas mostrava.
 */
export const FAIXA = {
  ACAO_HOJE: 0,
  SUMIU: 1,
  RISCO_ALTO: 2,
  FORA_DO_PLANO: 3,
  ESFRIANDO: 4,
  EM_DIA: 5,
  NUNCA_OPEROU: 6,
};

export const FAIXA_LABEL = {
  [FAIXA.ACAO_HOJE]: 'Ação hoje',
  [FAIXA.SUMIU]: 'Sumiu',
  [FAIXA.RISCO_ALTO]: 'Risco alto',
  [FAIXA.FORA_DO_PLANO]: 'Fora do plano',
  [FAIXA.ESFRIANDO]: 'Esfriando',
  [FAIXA.EM_DIA]: 'Em dia',
  [FAIXA.NUNCA_OPEROU]: 'Nunca operou',
};

/** Dias sem operar a partir dos quais o silêncio vira assunto. */
export const DIAS_ESFRIANDO = 7;
export const DIAS_SUMIU = 14;

/**
 * @param {Object} a — linha de `byStudent`
 * @returns {{faixa:number, motivo:string}}
 */
export function faixaDeAtencao(a) {
  if (a?.prioridade) return { faixa: FAIXA.ACAO_HOJE, motivo: a.prioridade.motivo };

  const dias = a?.diasSemOperar;
  if (dias == null) {
    // Nunca operou é outro problema — é onboarding, não acompanhamento. Fica por
    // último para não empurrar quem opera pra baixo, mas NÃO some da lista.
    return { faixa: FAIXA.NUNCA_OPEROU, motivo: 'nunca registrou uma operação' };
  }
  if (dias >= DIAS_SUMIU) return { faixa: FAIXA.SUMIU, motivo: `${dias} dias sem operar` };

  if (a?.radar?.severity === 'HIGH') {
    return { faixa: FAIXA.RISCO_ALTO, motivo: 'padrão de risco grave na semana' };
  }
  if (a?.foraDoPlanoSemana?.pct > 0) {
    return { faixa: FAIXA.FORA_DO_PLANO, motivo: `${Math.round(a.foraDoPlanoSemana.pct)}% dos trades fora do plano` };
  }
  if (dias >= DIAS_ESFRIANDO) return { faixa: FAIXA.ESFRIANDO, motivo: `${dias} dias sem operar` };

  return { faixa: FAIXA.EM_DIA, motivo: dias === 0 ? 'operou hoje' : `operou há ${dias} ${dias === 1 ? 'dia' : 'dias'}` };
}

/**
 * Resultado da semana em R — a única unidade que soma alunos de moedas diferentes.
 * Trade sem plano com RO declarado fica fora, como no Stop × Gain (D14).
 */
export function semanaEmR(tradesSemana, planoPorId) {
  let total = 0;
  let comR = 0;
  for (const t of tradesSemana ?? []) {
    const r = num(t?.result);
    const plano = planoPorId?.get?.(t?.planId) ?? null;
    const ro = plano?.pl > 0 && plano?.riskPerOperation > 0
      ? plano.pl * (plano.riskPerOperation / 100)
      : null;
    if (r == null || !ro) continue;
    total += r / ro;
    comR += 1;
  }
  return { valor: Math.round(total * 100) / 100, comR };
}
