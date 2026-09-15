/**
 * studentsAttention — issues #430 e #444
 * @description Fonte única de "Precisam Atenção": o badge do menu e a aba leem daqui.
 *
 *   #430: a regra existia em dois lugares (App.jsx para o badge, MentorDashboard
 *   para a aba) e o menu dizia 2 enquanto a aba dizia 6. O arquivo nasceu para
 *   que houvesse um número só.
 *
 *   #444 — A UNIDADE MUDOU DE ALUNO PARA TRADE. Antes a lista marcava alunos por
 *   prejuízo, win rate e profit factor da vida inteira: uma situação, não um fato.
 *   O aluno entrava e nenhum ato do mentor o tirava de lá. Agora cada item é um
 *   trade aguardando feedback com um motivo pesado (`tradesPrecisamAtencao`, em
 *   `mentorRiskRadar.js`), só de aluno Alpha, e ele sai quando o feedback é dado.
 *
 *   O inverso do #430 no carregamento: sem assinaturas, a lista sai VAZIA.
 *   Mostrar trade de aluno Espelho como prioridade seria alarme falso.
 */

import { tradesPrecisamAtencao } from './mentorRiskRadar';

/**
 * @param {{trades: Array, students: Array, subscriptions: Array}} input
 * @returns {Array<{trade, motivos, studentId, planId}>} mais recente primeiro
 */
export const tradesNeedingAttention = ({ trades, students, subscriptions } = {}) =>
  tradesPrecisamAtencao({ trades, students, subscriptions });

const nomeDoAluno = (student, trade) =>
  student?.name
  || student?.displayName
  || trade?.studentName
  || (student?.email ? String(student.email).split('@')[0] : null)
  || (trade?.studentEmail ? String(trade.studentEmail).split('@')[0] : 'Aluno');

/** Moeda única do conjunto; com duas, `null` — não existe total honesto. */
const moedaDosItens = (itens) => {
  const moedas = new Set(itens.map((i) => i.trade?.currency ?? 'BRL'));
  return moedas.size === 1 ? [...moedas][0] : null;
};

/**
 * Agrupa a fila por aluno e, dentro do aluno, por plano quando ele tem mais de
 * um plano entre os trades da fila (#442). Plano é chave, não atributo: cada
 * plano leva sua moeda e nada é somado entre planos.
 *
 * A ordem de entrada (mais recente primeiro) é preservada: o aluno com o trade
 * pesado mais recente vem primeiro, e o mesmo vale para plano e trade.
 *
 * @param {Array} itens — saída de `tradesNeedingAttention`
 * @param {{students?: Array, plans?: Array}} ctx
 * @returns {Array<{studentId, studentName, total, grupos: Array<{planId, planName, moeda, itens}>}>}
 */
export const agruparPorAlunoEPlano = (itens, { students, plans } = {}) => {
  if (!Array.isArray(itens) || itens.length === 0) return [];
  const alunoPorId = new Map((students ?? []).filter((s) => s?.id).map((s) => [s.id, s]));
  const planoPorId = new Map((plans ?? []).filter((p) => p?.id).map((p) => [p.id, p]));

  const porAluno = new Map();
  for (const item of itens) {
    const lista = porAluno.get(item.studentId) ?? [];
    lista.push(item);
    porAluno.set(item.studentId, lista);
  }

  return [...porAluno.entries()].map(([studentId, doAluno]) => {
    const porPlano = new Map();
    for (const item of doAluno) {
      const lista = porPlano.get(item.planId) ?? [];
      lista.push(item);
      porPlano.set(item.planId, lista);
    }
    const variosPlanos = porPlano.size > 1;
    return {
      studentId,
      studentName: nomeDoAluno(alunoPorId.get(studentId), doAluno[0].trade),
      total: doAluno.length,
      grupos: [...porPlano.entries()].map(([planId, doPlano]) => ({
        planId,
        planName: variosPlanos ? (planoPorId.get(planId)?.name ?? 'Sem plano') : null,
        moeda: moedaDosItens(doPlano),
        itens: doPlano,
      })),
    };
  });
};

export default tradesNeedingAttention;
