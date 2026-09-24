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

/** Vazio (null/undefined/'') é um valor só; objeto compara por conteúdo. */
const normalizeForCompare = (v) => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * #458 — campos do payload cujo VALOR difere do plano gravado.
 *
 * O modal de plano sempre manda o formulário inteiro. Tratar toda chave do payload
 * como alterada fazia cada "Salvar" registrar mudança de risco: o gate de constância
 * zerava e o compliance era recalculado sem nada ter mudado.
 *
 * @param {object} originalPlan - plano como está no Firestore
 * @param {object} newPlanData - payload a gravar
 * @returns {string[]} chaves do payload com valor diferente
 */
export const listChangedPlanFields = (originalPlan, newPlanData) => {
  const original = originalPlan || {};
  return Object.keys(newPlanData || {}).filter(
    (f) => normalizeForCompare(original[f]) !== normalizeForCompare(newPlanData[f]),
  );
};

export default { detectChangedFields, buildAuditInfo, listChangedPlanFields };
