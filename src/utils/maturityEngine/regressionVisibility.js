/**
 * regressionVisibility — quando um sinal de regressão gravado ainda vale.
 *
 * FILTRO DE LEITURA, no mesmo espírito de `REVOKED_RED_FLAG_TYPES` (#402): o
 * documento no Firestore fica como está; o que muda é o que a tela aceita como
 * acusação. Backfill de snapshot é o que #402 proibiu.
 *
 * Medido em 29/08/2026, com o motor antigo ainda em produção: OITO alunos com
 * `signalRegression.detected`, todos pelo mesmo gatilho ("métricas mapeiam para
 * stage N-1"). Dois padrões, os dois inválidos:
 *
 *  1. SETE sugerem estágio ABAIXO do baseline do assessment. Contradiz a DEC-020,
 *     que o próprio recompute cita: "engine jamais coloca o aluno abaixo do stage
 *     diagnosticado no assessment". João Victor, com ZERO trades e gates 0/9,
 *     estava sendo acusado de regredir.
 *  2. Wilson foi PROMOVIDO (current 3 > baseline 2) e o motor comparou as métricas
 *     do estágio anterior com a régua do novo. A regra de Marcio é que promoção
 *     zera tudo; enquanto o servidor não recalcular com a janela nova — o que se
 *     reconhece pela ausência de `stageSince` —, a leitura antiga não vale.
 */

/**
 * @param {Object|null} maturity — doc `students/{id}/maturity/current`
 * @returns {{visivel: boolean, motivo: string|null}}
 */
export function regressaoVigente(maturity) {
  const sinal = maturity?.signalRegression;
  if (!sinal?.detected) return { visivel: false, motivo: null };

  const atual = Number(maturity.currentStage);
  const baseline = Number(maturity.baselineStage);
  const sugerido = Number(sinal.suggestedStage);

  // (1) DEC-020 — nunca abaixo do assessment.
  if (Number.isFinite(sugerido) && Number.isFinite(baseline) && sugerido < baseline) {
    return { visivel: false, motivo: 'sugere estágio abaixo do baseline do assessment (DEC-020)' };
  }

  // (2) Promovido e ainda não remedido com a régua nova.
  if (Number.isFinite(atual) && Number.isFinite(baseline) && atual > baseline && !maturity.stageSince) {
    return { visivel: false, motivo: 'aluno promovido; a régua do estágio novo ainda não foi calculada' };
  }

  return { visivel: true, motivo: null };
}

export default regressaoVigente;
