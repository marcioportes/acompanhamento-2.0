/**
 * mentorAccountsVisibility — issue #341
 * @description Set de studentIds visíveis na seção Contas do mentor.
 *
 *   Paridade com Acompanhamento (StudentsManagement): um aluno aparece ⇔
 *   `classifyStudent(student, subs) !== null` — VIP ativo, sem-sub e
 *   expired/cancelled ficam fora; `overdue` (grace) permanece (não é ENDED).
 *
 *   A montagem de `subsByStudent` replica exatamente a de StudentsManagement
 *   para garantir mesma shape de `subs` ao helper — ref. negativa #316
 *   (assinaturas divergentes de classifyStudent front/back).
 */

import { classifyStudent } from './studentClassify';

/**
 * @param {Array} students       docs de /students ({ id, ... })
 * @param {Array} subscriptions  subs enriquecidas (useSubscriptions): { studentId, status, type, plan, ... }
 * @returns {Set<string>} studentIds com assinatura ativa Alpha/Espelho/Trial
 */
export const visibleStudentIds = (students, subscriptions) => {
  const subsByStudent = new Map();
  for (const sub of subscriptions ?? []) {
    if (!sub?.studentId) continue;
    const arr = subsByStudent.get(sub.studentId) ?? [];
    arr.push(sub);
    subsByStudent.set(sub.studentId, arr);
  }

  const visible = new Set();
  for (const s of students ?? []) {
    if (!s?.id) continue;
    if (classifyStudent(s, subsByStudent.get(s.id) ?? []) !== null) visible.add(s.id);
  }
  return visible;
};

/**
 * Mesma regra, chaveada por EMAIL — superfícies derivadas de trades (alertas do
 * cockpit, "precisam de atenção") agrupam por email, não por studentId.
 *
 * #402 — o mentor via alunos pedindo atenção que já tinham saído: 203 dos 588
 * alarmes eram de seis pessoas sem assinatura ativa. O predicado é o mesmo da
 * visibilidade em Contas/Acompanhamento; só muda a chave.
 *
 * @param {Array} students       docs de /students ({ id, email, ... })
 * @param {Array} subscriptions  subs enriquecidas ({ studentId, status, type, plan })
 * @returns {Set<string>} emails em minúsculas
 */
export const visibleStudentEmails = (students, subscriptions) => {
  const ids = visibleStudentIds(students, subscriptions);
  const emails = new Set();
  for (const s of students ?? []) {
    if (s?.id && s?.email && ids.has(s.id)) emails.add(String(s.email).toLowerCase());
  }
  return emails;
};

export default visibleStudentIds;
