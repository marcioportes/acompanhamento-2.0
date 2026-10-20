/**
 * propFirmDisplay.js — issue #490
 *
 * Conta de exibição do gauge "Drawdown utilizado". No trailing EOD o limite só sobe no
 * fechamento do dia: durante o dia o saldo pode passar do pico, a folga fica MAIOR que
 * o drawdown da mesa e a conta antiga mostrava "-5,4% utilizado" e "Margem US$ 1.053,50
 * de US$ 1.000,00". Uso nunca é negativo; a folga é o fato e fica como está.
 */

/**
 * @returns {{ usedPct: number, margin: number, aboveMax: boolean }}
 *   usedPct 0..100+ (passa de 100 só se o saldo cruzou o limite), margin = saldo − limite (≥ 0).
 */
export function drawdownUsage({ balance, threshold, drawdownMax }) {
  const margin = Math.max(0, (balance ?? 0) - (threshold ?? 0));
  if (!(drawdownMax > 0)) return { usedPct: 0, margin, aboveMax: false };
  const used = Math.max(0, drawdownMax - margin);
  return {
    usedPct: (used / drawdownMax) * 100,
    margin,
    aboveMax: margin > drawdownMax,
  };
}
