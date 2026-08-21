/**
 * rrBreakdown.js
 * @version 1.0.0 (v1.83.19 — issue #373)
 * @description Traduz o R:R de múltiplo abstrato para dinheiro, nos dois denominadores
 *   que importam: o risco que o aluno TOMOU e o risco que o plano AUTORIZA.
 *
 * POR QUE DOIS NÚMEROS:
 *   O mesmo trade responde a duas perguntas diferentes, e as duas são legítimas.
 *   Caso real (WINV26 LONG 10, 20/08/2026, +R$ 610):
 *
 *     arriscou R$ 495 para ganhar R$ 610   → 1,23x   "o ganho valeu o que arrisquei?"
 *     RO do plano é R$ 252                 → 2,42x   "o ganho valeu o risco permitido?"
 *
 *   O painel mostrava só "RR 1.2x abaixo do mínimo (2x)" — sem dizer de quanto dinheiro
 *   se tratava. Com os valores, fica visível que as duas violações da tela (risco acima
 *   do RO e RR abaixo do mínimo) são a MESMA causa: posição dobrada sem encurtar o stop
 *   na proporção. O risco subiu e, como ele é o denominador do R:R, o R:R desabou.
 *
 * CONFORMIDADE continua no risco TOMADO (decisão de Marcio, 21/08/2026): é o que
 * aconteceu com o dinheiro. O RR contra o plano é referência — mostra o que o trade
 * teria sido dentro do sizing correto.
 *
 * DISPLAY-TIME: derivado na hora a partir do trade e do plano vigente, nunca congelado
 * em snapshot — mesmo princípio da SSoT de tiles do #282. As mensagens já gravadas em
 * `redFlags` continuam válidas; isto só as detalha.
 *
 * @see src/utils/compliance.js — cálculo canônico de conformidade (DEC-006/007/009)
 */

// Ausência não é zero: `Number(null)` é 0 e passaria por finito, fazendo um trade sem
// stop informado virar "risco de 343.685" (a entrada inteira como distância).
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {Object} trade — { entry, stopLoss, qty, result, currency, tickerRule }
 * @param {Object|null} plan — { pl, currentPl, riskPerOperation, rrTarget }
 * @returns {{
 *   riskAmount: number|null, riskPercent: number|null, resultAmount: number|null,
 *   rrTaken: number|null, meetsTarget: boolean|null,
 *   roAmount: number|null, rrVsPlan: number|null, meetsTargetVsPlan: boolean|null,
 *   rrTarget: number|null, currency: string,
 * }}
 */
export function rrBreakdown(trade, plan) {
  const out = {
    riskAmount: null, riskPercent: null, resultAmount: null,
    rrTaken: null, meetsTarget: null,
    roAmount: null, rrVsPlan: null, meetsTargetVsPlan: null,
    rrTarget: null, currency: trade?.currency || 'BRL',
  };
  if (!trade) return out;

  const entry = num(trade.entry);
  const stop = num(trade.stopLoss);
  const qty = num(trade.qty) ?? 1;
  const result = num(trade.result);
  out.resultAmount = result;

  // Valor do ponto: mesma conversão de compliance.js — (distância / tickSize) × tickValue.
  const tickSize = num(trade.tickerRule?.tickSize) || 1;
  const tickValue = num(trade.tickerRule?.tickValue) || 1;

  // === Lado do trade: o risco que foi realmente assumido ===
  if (entry != null && stop != null) {
    const distancia = Math.abs(entry - stop);
    out.riskAmount = Math.round(((distancia / tickSize) * tickValue * qty) * 100) / 100;
  }

  // === Lado do plano: o risco autorizado ===
  const planPl = num(plan?.pl) ?? num(plan?.currentPl);
  const roPct = num(plan?.riskPerOperation);
  out.rrTarget = num(plan?.rrTarget);
  if (planPl != null && planPl > 0 && roPct != null && roPct > 0) {
    out.roAmount = Math.round(planPl * (roPct / 100) * 100) / 100;
    if (out.riskAmount != null) {
      out.riskPercent = Math.round(((out.riskAmount / planPl) * 100) * 100) / 100;
    }
  }

  // === Os dois R:R ===
  // Risco zero (stop na entrada) não é R:R infinito: é ausência de razão.
  if (result != null && out.riskAmount != null && out.riskAmount > 0) {
    out.rrTaken = Math.round((result / out.riskAmount) * 100) / 100;
  }
  if (result != null && out.roAmount != null && out.roAmount > 0) {
    out.rrVsPlan = Math.round((result / out.roAmount) * 100) / 100;
  }

  if (out.rrTarget != null && out.rrTarget > 0) {
    if (out.rrTaken != null) out.meetsTarget = out.rrTaken >= out.rrTarget;
    if (out.rrVsPlan != null) out.meetsTargetVsPlan = out.rrVsPlan >= out.rrTarget;
  }

  return out;
}
