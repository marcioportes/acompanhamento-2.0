/**
 * src/constants/tradeReviewFramework.js
 *
 * SSoT do catálogo de perguntas da Auto-revisão de trade (issue #308).
 * Ancorado em docs/dev/trader_evolution_framework.md. Cada pergunta carrega sua dimensão 4D
 * (E emocional · F financeiro · O operacional · M maturidade) para uso futuro pelo feedback IA.
 *
 * Quadrante = f(sign(result), wouldRepeat) — ver src/utils/tradeReviewConfront.js:classifyTrade.
 * `version` versiona o catálogo: trade.selfReview.version preserva qual conjunto respondeu.
 */

export const TRADE_REVIEW_VERSION = 1;

export const REVIEW_DIMENSIONS = Object.freeze({
  E: { key: 'E', label: 'Emocional' },
  F: { key: 'F', label: 'Financeiro' },
  O: { key: 'O', label: 'Operacional' },
  M: { key: 'M', label: 'Maturidade' },
});

export const WOULD_REPEAT_PROMPT = 'Faria de novo sem saber o resultado?';

/**
 * Perguntas por quadrante. id = chave estável em trade.selfReview.answers.
 * @type {Record<'good_win'|'bad_win'|'good_loss'|'bad_loss', {label:string, questions:Array<{id:string,dimension:string,text:string}>}>}
 */
export const TRADE_REVIEW_QUESTIONS = Object.freeze({
  good_win: {
    label: 'Ganho consistente',
    questions: [
      { id: 'gw_refine', dimension: 'O', text: 'O que refina ainda mais a execução deste setup?' },
      { id: 'gw_manage', dimension: 'F', text: 'Havia espaço para gerir melhor o ganho (sizing/saída)?' },
      { id: 'gw_repeat', dimension: 'M', text: 'O que torna este trade replicável?' },
    ],
  },
  bad_win: {
    label: 'Ganho por sorte',
    questions: [
      { id: 'bw_deviate', dimension: 'O', text: 'Onde você desviou do plano e por quê?' },
      { id: 'bw_mask', dimension: 'E', text: 'O resultado positivo mascarou qual risco?' },
      { id: 'bw_rule', dimension: 'F', text: 'Que regra teria evitado este acerto por sorte?' },
    ],
  },
  good_loss: {
    label: 'Perda de bom processo',
    questions: [
      { id: 'gl_avoid', dimension: 'O', text: 'Havia forma lógica de evitar a perda no momento?' },
      { id: 'gl_size', dimension: 'F', text: 'O risco foi dimensionado conforme o plano?' },
      { id: 'gl_control', dimension: 'E', text: 'Você manteve o controle emocional após o stop?' },
    ],
  },
  bad_loss: {
    label: 'Perda evitável',
    questions: [
      { id: 'bl_signals', dimension: 'O', text: 'Quais eram os sinais de alerta antes da entrada?' },
      { id: 'bl_deviate', dimension: 'O', text: 'Onde desviou do plano e por quê?' },
      { id: 'bl_contagion', dimension: 'E', text: 'A reação a esta perda contaminou os trades seguintes?' },
    ],
  },
});

/** Perguntas do quadrante (array vazio se quadrante desconhecido). */
export const questionsForQuadrant = (quadrant) =>
  TRADE_REVIEW_QUESTIONS[quadrant]?.questions ?? [];
