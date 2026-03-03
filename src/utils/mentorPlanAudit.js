/**
 * Mentor Plan Audit — Utilitários
 * @version 1.0.0
 * 
 * Lógica de detecção de campos alterados e geração de audit info
 * para quando mentor edita plano do aluno.
 */

const PLAN_COMPARE_FIELDS = [
  'pl', 'riskPerOperation', 'rrTarget',
  'periodGoal', 'periodStop', 'cycleGoal', 'cycleStop',
  'adjustmentCycle', 'operationPeriod', 'name'
];

/**
 * Detecta quais campos mudaram entre o plano original e os novos dados
 * @param {object} originalPlan - Plano antes da edição
 * @param {object} newPlanData - Dados do formulário
 * @returns {string[]} Lista de nomes dos campos alterados
 */
export const detectChangedFields = (originalPlan, newPlanData) => {
  return PLAN_COMPARE_FIELDS.filter(f => String(originalPlan[f]) !== String(newPlanData[f]));
};

/**
 * Gera objeto de auditoria para edição do mentor
 * @param {string} mentorEmail
 * @param {object} originalPlan
 * @param {object} newPlanData
 * @returns {{ editedBy: 'mentor', email: string, changedFields: string[] }}
 */
export const buildAuditInfo = (mentorEmail, originalPlan, newPlanData) => {
  return {
    editedBy: 'mentor',
    email: mentorEmail,
    changedFields: detectChangedFields(originalPlan, newPlanData)
  };
};

export default { detectChangedFields, buildAuditInfo };
