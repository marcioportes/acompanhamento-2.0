/**
 * promotionReadiness — quando um aluno está pronto para subir de estágio.
 *
 * #376 (23/08/2026). Antes desta issue nada no sistema promovia ninguém: o motor
 * calculava os gates, gravava `proposedTransition: { proposed: 'UP', blockers: [] }`
 * e parava aí. O estágio gravado só mudava se o ASSESSMENT do aluno mudasse — nunca
 * por cumprir os gates. O "9/9" era relatório, não evento.
 *
 * Pior: a tela do fechamento de ciclo comparava `maturity.proposedTransition` (objeto)
 * com a string `'PROMOTE'` (`Step5Check.jsx:312`), valor que o motor nunca produziu.
 * `promotionEligible` era `false` por construção — a promoção não aparecia nem no
 * ritual onde a conversa aconteceria.
 *
 * Regra de Marcio (23/08): *"avisa da promoção tanto para o aluno quanto para mim, e
 * eu faço a promoção avisando o aluno."* Subir de estágio é conversa de mentoria, não
 * efeito colateral de um recompute — o sistema sinaliza para os dois lados e a decisão
 * é ato do mentor.
 *
 * ⚠️ ESPELHO CJS de src/utils/maturityEngine/promotionReadiness.js — MANTER SINCRONIZADO ⚠️
 * O servidor revalida com a MESMA regra antes de gravar: cliente não é autoridade.
 */

/** Aluno cumpriu tudo que o estágio seguinte exige e nada o bloqueia. */
function isReadyForPromotion(maturity) {
  if (!maturity) return false;
  const p = maturity.proposedTransition;
  if (p?.proposed !== 'UP') return false;
  if (Array.isArray(p.blockers) && p.blockers.length > 0) return false;
  // #101 — a proposta já foi consumida? Depois de promover, o estágio sobe mas
  // `proposedTransition`/gates só se atualizam no próximo recompute. Sem esta
  // guarda o card "pronto para promoção" continua na tela depois da promoção
  // feita — foi o que Marcio viu em 28/08. O servidor limpa a proposta ao
  // promover; isto defende a leitura de qualquer doc que tenha ficado para trás.
  const destino = p.nextStage;
  const atual = maturity.currentStage;
  if (Number.isFinite(destino) && Number.isFinite(atual) && destino <= atual) return false;

  const total = maturity.gatesTotal ?? 0;
  const met = maturity.gatesMet ?? 0;
  return total > 0 && met === total;
}

/** Estágio para o qual o aluno subiria. `null` quando não há promoção proposta. */
function nextStageOf(maturity) {
  if (!isReadyForPromotion(maturity)) return null;
  const proposto = maturity.proposedTransition?.nextStage;
  if (Number.isFinite(proposto)) return proposto;
  const atual = maturity.currentStage;
  return Number.isFinite(atual) ? atual + 1 : null;
}

module.exports = { isReadyForPromotion, nextStageOf };
