/**
 * computePostExitOutcome — a saída antecipada protegeu ou cortou resultado?
 *
 * Regra de domínio (Marcio, 29/08/2026): *"o sistema só assume que quando o aluno
 * sai antecipado ele está perdendo o alvo, mas ele também pode estar protegendo o
 * loss. Tenho experiência bastante para entender quando um trade virá contra."*
 *
 * O detector `EARLY_EXIT` dispara em trade VENCEDOR que fechou abaixo do alvo do
 * plano — e as duas leituras produzem o MESMO dado com significados opostos:
 *
 *   preço foi ao alvo depois  → cortou lucro
 *   preço voltou e bateu stop → PROTEGEU
 *
 * Sem saber o que aconteceu depois da saída, o sistema acusava gestão correta de
 * medo. Esta função responde a pergunta com a mesma matéria-prima do MEP/MEN:
 * barras de 1 minuto, percorridas em ordem, até o fim do pregão.
 *
 * PURA: sem I/O. Recebe as barras já filtradas para o período pós-saída.
 */

/**
 * @param {Object} p
 * @param {Array<{t:number,h:number,l:number}>} p.bars — barras APÓS a saída, em ordem
 * @param {'LONG'|'SHORT'} p.side
 * @param {number} p.stopPrice — o stop declarado no trade
 * @param {number} p.targetPrice — o alvo derivado do plano (entrada ± risco × rrTarget)
 * @returns {{outcome:'ALVO'|'STOP'|'AMBOS'|'NENHUM', touchedAtMs:number|null, bars:number}}
 */
function computePostExitOutcome({ bars, side, stopPrice, targetPrice }) {
  const lista = Array.isArray(bars) ? bars : [];
  const vazio = { outcome: 'NENHUM', touchedAtMs: null, bars: lista.length };

  const stop = Number(stopPrice);
  const alvo = Number(targetPrice);
  if (!Number.isFinite(stop) || !Number.isFinite(alvo) || lista.length === 0) return vazio;

  const comprado = side !== 'SHORT';

  for (const b of lista) {
    // `Number(null)` é 0, e zero passa em `isFinite` — sem a checagem explícita, a
    // barra sem negócio virava preço zero e disparava stop em todo trade comprado.
    if (b?.h == null || b?.l == null) continue;
    const h = Number(b.h);
    const l = Number(b.l);
    if (!Number.isFinite(h) || !Number.isFinite(l)) continue;

    const bateuAlvo = comprado ? h >= alvo : l <= alvo;
    const bateuStop = comprado ? l <= stop : h >= stop;

    // Barra de 1 minuto que tocou os dois: a ordem dentro dela é desconhecida.
    // Declarar 'AMBOS' é a única leitura honesta — escolher um seria inventar
    // sequência, que é exatamente o que o #402 tirou desta plataforma.
    if (bateuAlvo && bateuStop) {
      return { outcome: 'AMBOS', touchedAtMs: (Number(b.t) || 0) * 1000, bars: lista.length };
    }
    if (bateuAlvo) return { outcome: 'ALVO', touchedAtMs: (Number(b.t) || 0) * 1000, bars: lista.length };
    if (bateuStop) return { outcome: 'STOP', touchedAtMs: (Number(b.t) || 0) * 1000, bars: lista.length };
  }

  return vazio;
}

/**
 * O alvo em preço, a partir do risco declarado no trade e do alvo do plano.
 * `trade.takeProfit` não serve: está vazio nos 381 trades da base, e o alvo
 * sempre morou no plano (`plan.rrTarget`).
 *
 * @returns {number|null}
 */
function precoAlvoDoPlano(trade, plan) {
  const entrada = Number(trade?.entry);
  const stop = Number(trade?.stopLoss);
  const rr = Number(plan?.rrTarget);
  if (!Number.isFinite(entrada) || !Number.isFinite(stop) || !Number.isFinite(rr) || rr <= 0) return null;
  const risco = Math.abs(entrada - stop);
  if (!(risco > 0)) return null;
  return trade?.side === 'SHORT' ? entrada - risco * rr : entrada + risco * rr;
}

module.exports = { computePostExitOutcome, precoAlvoDoPlano };
