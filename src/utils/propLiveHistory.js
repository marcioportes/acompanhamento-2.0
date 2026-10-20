/**
 * propLiveHistory.js — issue #490
 *
 * O `drawdownHistory` da conta é append-only (decisão do #52): trade apagado deixa o
 * snapshot para trás, e o `balance`/`dailyPnL` gravados em cada snapshot carregam o
 * efeito de trades que já não existem. A aba Mesa Prop lia esse histórico cru — na
 * Lucid Flex 25K, dois trades de teste apagados (+US$ 1.000 cada) continuavam subindo
 * a curva a US$ 27 mil, viravam "melhor dia US$ 2.000" e "consistency 320% do teto".
 *
 * Aqui o histórico é FILTRADO NA LEITURA (Marcio, 20/10/2026) e refeito a partir dos
 * trades vivos: um ponto por trade, saldo = tamanho da conta + soma acumulada do
 * resultado ATUAL de cada trade. É a única fonte para curva, KPIs, dias operados,
 * melhor dia e dias qualificáveis do payout.
 *
 * Trade vivo sem snapshot fica de fora: o motor da conta não o processou, e incluí-lo
 * descolaria a curva do saldo da conta.
 */

/**
 * @param {Array} history - docs de `drawdownHistory` em ordem cronológica de escrita
 * @param {Array} trades - trades vivos da conta ({ id, date, entryTime?, result })
 * @param {number} accountSize - tamanho inicial da conta
 * @returns {{ snapshots: Array<{tradeId, date, balance, dailyPnL}>, days: Array<{date, pnl}>,
 *             bestDay: {date, pnl}|null, worstDay: {date, pnl}|null, tradingDays: number }}
 */
export function liveDrawdownHistory(history, trades, accountSize = 0) {
  const live = new Map();
  for (const t of trades ?? []) {
    if (t?.id) live.set(t.id, t);
  }

  // Um ponto por trade: edições gravam `{tradeId}-edit-{ts}` com o mesmo `tradeId`.
  const order = [];
  const seen = new Set();
  for (const snap of history ?? []) {
    const id = snap?.tradeId;
    if (!id || seen.has(id) || !live.has(id)) continue;
    seen.add(id);
    order.push({ trade: live.get(id), seq: order.length });
  }

  const instantOf = (t) => t.entryTime ?? t.date ?? '';
  order.sort((a, b) => {
    const ia = instantOf(a.trade);
    const ib = instantOf(b.trade);
    if (ia !== ib) return ia < ib ? -1 : 1;
    return a.seq - b.seq;
  });

  const snapshots = [];
  const days = [];
  let balance = accountSize;
  for (const { trade } of order) {
    const result = Number(trade.result) || 0;
    const date = trade.date ?? null;
    balance = round2(balance + result);
    const last = days[days.length - 1];
    if (last && last.date === date) {
      last.pnl = round2(last.pnl + result);
    } else {
      days.push({ date, pnl: round2(result) });
    }
    snapshots.push({ tradeId: trade.id, date, balance, dailyPnL: days[days.length - 1].pnl });
  }

  let bestDay = null;
  let worstDay = null;
  for (const d of days) {
    if (!bestDay || d.pnl > bestDay.pnl) bestDay = d;
    if (!worstDay || d.pnl < worstDay.pnl) worstDay = d;
  }

  return { snapshots, days, bestDay, worstDay, tradingDays: days.length };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
