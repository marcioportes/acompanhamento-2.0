/**
 * studentsAttention — issue #430
 * @description Fonte única de "quem precisa de atenção".
 *
 *   Existia em dois lugares com regras diferentes: `App.jsx` reimplementava
 *   à mão (`trades >= 5 && winRate < 40`, sem filtro de assinatura) para o
 *   badge do menu, e o `MentorDashboard` usava `identifyStudentsNeedingAttention`
 *   filtrado por assinatura ativa (#402) para a aba. O menu dizia 2 e a aba
 *   dizia 6 — o mesmo rótulo, na mesma tela, com dois números.
 *
 *   O comentário em `MentorDashboard.jsx` já nomeava o defeito antes deste
 *   issue: reimplementar a regra é como o número e a lista passam a discordar.
 */

import { identifyStudentsNeedingAttention } from './calculations';

/**
 * @param {Object|Array} groupedTrades  trades agrupados por aluno
 * @param {Set<string>}  emailsAtivos   emails com assinatura ativa (minúsculas).
 *   Vazio ou ausente = não filtra: enquanto as assinaturas não carregaram,
 *   aparecer e sumir é melhor que sumir e nunca voltar.
 * @returns {Array} alunos com `reasons`
 */
export const studentsNeedingAttention = (groupedTrades, emailsAtivos) => {
  const todos = identifyStudentsNeedingAttention(groupedTrades);
  if (!emailsAtivos || emailsAtivos.size === 0) return todos;
  return todos.filter((s) => s?.email && emailsAtivos.has(String(s.email).toLowerCase()));
};

export default studentsNeedingAttention;
