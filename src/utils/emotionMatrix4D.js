/**
 * emotionMatrix4D — issue #164 E3
 *
 * Agrega trades por emoção de entrada e devolve array de cards com 4 micro-KPIs
 * por dimensão do framework 4D (Financial / Operational / Emotional / Maturity).
 *
 * - Financial   → expectancy (avg PL) + payoff (|avgWin|/|avgLoss|)
 * - Operational → shiftRate (% trades onde emotionExit difere de emotionEntry)
 * - Emotional   → wrEmotion (%) + wrDelta (wrEmotion - globalWR)
 * - Maturity    → sparklineSeries (janela de últimos N trades, PL acumulado)
 *
 * Decisão shiftRate: todos os trades com emotionEntry entram no denominador.
 * Quando emotionExit é vazio/undefined, contamos como shift=false — "sem
 * registro de saída" indica que o aluno não reportou mudança, não mudança
 * zero. Alternativa (excluir do denominador) puniria amostra pequena.
 */

const normalizeEmotion = (raw) => {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const pickEmotionKey = (trade) => {
  const entry = normalizeEmotion(trade.emotionEntry);
  if (entry) return entry;
  const legacy = normalizeEmotion(trade.emotion);
  if (legacy) return legacy;
  return 'Não Informado';
};

const isShift = (trade) => {
  const entry = normalizeEmotion(trade.emotionEntry) || normalizeEmotion(trade.emotion);
  const exit = normalizeEmotion(trade.emotionExit);
  if (!entry || !exit) return false;
  return entry !== exit;
};

export const buildEmotionMatrix4D = (trades, opts = {}) => {
  if (!Array.isArray(trades) || trades.length === 0) return [];

  const { globalWR, sparklineWindow = 10 } = opts;
  const hasGlobalWR = typeof globalWR === 'number' && Number.isFinite(globalWR);

  const groups = new Map();

  for (const trade of trades) {
    const key = pickEmotionKey(trade);
    const result = Number(trade.result || 0);

    if (!groups.has(key)) {
      groups.set(key, {
        name: key,
        count: 0,
        wins: 0,
        losses: 0,
        totalPL: 0,
        sumWins: 0,
        sumLosses: 0,
        shiftCount: 0,
        trades: [],
      });
    }

    const g = groups.get(key);
    g.count += 1;
    g.totalPL += result;
    if (result > 0) {
      g.wins += 1;
      g.sumWins += result;
    } else if (result < 0) {
      g.losses += 1;
      g.sumLosses += result;
    }
    if (isShift(trade)) g.shiftCount += 1;
    g.trades.push({ date: trade.date, result });
  }

  const cards = Array.from(groups.values()).map((g) => {
    const expectancy = g.count > 0 ? g.totalPL / g.count : 0;
    const avgWin = g.wins > 0 ? g.sumWins / g.wins : 0;
    const avgLoss = g.losses > 0 ? g.sumLosses / g.losses : 0;
    const payoff =
      g.wins === 0 || g.losses === 0 || avgLoss === 0
        ? null
        : Math.abs(avgWin) / Math.abs(avgLoss);

    const wrEmotion = g.count > 0 ? (g.wins / g.count) * 100 : 0;
    const wrDelta = hasGlobalWR ? wrEmotion - globalWR : null;

    const shiftRate = g.count > 0 ? (g.shiftCount / g.count) * 100 : 0;

    const sorted = [...g.trades].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const windowTrades = sorted.slice(-sparklineWindow);
    let running = 0;
    const sparklineSeries = windowTrades.map((t) => {
      running += t.result;
      return { date: t.date, cumPL: running };
    });

    return {
      name: g.name,
      count: g.count,
      wins: g.wins,
      totalPL: g.totalPL,
      expectancy,
      payoff,
      shiftRate,
      wrEmotion,
      wrDelta,
      sparklineSeries,
    };
  });

  return cards.sort((a, b) => b.totalPL - a.totalPL);
};
