/**
 * functions/shared/gateEligibility.js
 * @version 1.0.0 (v1.83.27 — issue #394)
 * @description Decide se uma detecção comportamental pode TRAVAR progressão de estágio.
 *
 * POR QUE ISTO EXISTE
 *
 * O #375 alargou o significado de `UNPROTECTED_SIZE`. Antes ele só disparava quando havia
 * falta de cobertura em quantidade — situação sempre grave. Depois passou a disparar em
 * qualquer intervalo nu acima de 20s, com duas leituras muito diferentes:
 *
 *   HIGH   → nunca protegeu, ficou nu até a saída, ou nu na maior parte da posição
 *   MEDIUM → houve uma janela e o aluno FECHOU, recolocando proteção
 *
 * Quem consome o sinal não olhava severidade: `gateInputs` sai da família detectada e o
 * peso de maturidade conta o trade como violação se houver QUALQUER família negativa.
 * Com isso, um stop colocado 30 segundos depois da entrada — comportamento rotineiro de
 * quem monta bracket na mão — travava a progressão exatamente como nunca ter colocado
 * stop. Medido: 5 trades em produção.
 *
 * REGRA: exposição que o aluno FECHOU aparece no card (o fato é verdadeiro e o mentor
 * precisa ver), mas não trava estágio. O que trava é não ter protegido, ou ter ficado
 * descoberto até o fim.
 *
 * Escopo deliberadamente estreito: só `UNPROTECTED_SIZE`, que é onde a semântica mudou.
 * A política geral de "severidade abaixo da natural não conta" foi medida (24 trades
 * ficariam limpos) e fica para decidir junto com a recalibração da régua no #376.
 */

/** Padrões cuja severidade MEDIUM descreve caso já resolvido pelo próprio aluno. */
const SEVERIDADE_DECIDE = Object.freeze({
  UNPROTECTED_SIZE: 'HIGH',
});

/**
 * @param {string} canonicalCode — código canônico do padrão
 * @param {string|null} severity — severidade DESTA detecção
 * @returns {boolean} true quando a detecção pode travar gate / contar como violação
 */
function travaProgressao(canonicalCode, severity) {
  const exigida = SEVERIDADE_DECIDE[canonicalCode];
  if (!exigida) return true;          // padrão sem regra especial: comportamento de sempre
  return severity === exigida;
}

module.exports = { travaProgressao, SEVERIDADE_DECIDE };
