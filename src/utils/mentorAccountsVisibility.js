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

export default visibleStudentIds;
