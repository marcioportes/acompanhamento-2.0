/**
 * setupsFilter.js — issue #174
 *
 * Filtra uma lista de setups (vinda de `useSetups` no contexto do mentor, que
 * retorna todos os setups do banco) para isolar os que pertencem a um aluno
 * específico. Mantém setups globais (`isGlobal: true`).
 *
 * Uso canônico no MentorDashboard:
 *   const studentSetups = useMemo(
 *     () => filterSetupsForStudent(setups, selectedStudent?.studentId),
 *     [setups, selectedStudent?.studentId],
 *   );
 *   <SetupAnalysis trades={...} setupsMeta={studentSetups} />
 *
 * Isolamento estrito: setup de aluno X NUNCA aparece quando filtra para aluno Y.
 */

/**
 * @param {Array} setups — lista bruta vinda de `useSetups()`
 * @param {string|null|undefined} studentId — uid do aluno (campo `studentId` do
 *   objeto retornado por `getUniqueStudents`). Quando ausente, retorna apenas
 *   globais (posição neutra — mentor ainda não selecionou aluno).
 * @returns {Array} setups visíveis para o aluno indicado
 */
export const filterSetupsForStudent = (setups, studentId) => {
  if (!setups || !Array.isArray(setups)) return [];
  return setups.filter((s) => {
    if (s?.isGlobal) return true;
    if (!studentId) return false;
    return s?.studentId === studentId;
  });
};

export default filterSetupsForStudent;
