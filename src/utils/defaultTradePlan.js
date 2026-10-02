/**
 * defaultTradePlan.js — plano inicial do formulário de NOVO trade (issue #484).
 *
 * O formulário pré-selecionava `plans[0]` (o plano mais recente do aluno), ignorando a barra
 * de contexto — e o dashboard filtra pelo que está na barra. O trade era gravado num plano
 * que o aluno não estava olhando: sumia da tela e contaminava PL/saldo/compliance do outro.
 *
 * Regra: o default vem do que está na tela. Sem como saber, não chuta — devolve '' e o
 * formulário obriga a escolha.
 */

import { getDefaultPlanForAccount } from './cycleResolver.js';

/**
 * @param {Object} params
 * @param {Array}  params.plans - planos do aluno
 * @param {string|null} [params.contextPlanId] - plano selecionado na barra de contexto
 * @param {string|null} [params.contextAccountId] - conta selecionada na barra (null = todas)
 * @returns {string} id do plano inicial, ou '' quando o aluno precisa escolher
 */
export const resolveDefaultTradePlanId = ({ plans = [], contextPlanId = null, contextAccountId = null } = {}) => {
  const activePlans = (plans || []).filter(p => p && p.active !== false);

  // 1. Plano da barra de contexto.
  if (contextPlanId && activePlans.some(p => p.id === contextPlanId)) return contextPlanId;

  // 2. Só a conta na barra → plano ativo mais recente dela.
  if (contextAccountId) {
    const accountPlan = getDefaultPlanForAccount(activePlans, contextAccountId);
    if (accountPlan) return accountPlan.id;
  }

  // 3. "Todas as contas": só não é ambíguo quando existe um único plano.
  if (activePlans.length === 1) return activePlans[0].id;

  return '';
};

export default resolveDefaultTradePlanId;
