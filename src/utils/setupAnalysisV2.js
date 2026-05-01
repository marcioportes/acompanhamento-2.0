/**
 * setupAnalysisV2.js — issue #170 (issue #219 estendeu com luckRate).
 *
 * Util puro que agrupa trades por `setup` e calcula KPIs operacionais para o
 * componente `SetupAnalysis` V2 (Dashboard do Aluno + Mentor Dashboard).
 *
 * Por setup retorna:
 *   { setup, n, totalPL, wr, ev, payoff, durationWin, durationLoss, deltaT,
 *     contribEV, adherenceRR, sparkline6m, isSporadic, trades,
 *     classifiedCount, luckCount, luckRate }
 *
 * Regras:
 * - Multi-moeda é ignorada por setup (soma crua, sem conversão — spec issue #170).
 * - ΔT e Payoff retornam `null` quando faltam wins OU losses.
 * - Aderência RR é condicional: só calcula quando `setupsMeta[x].targetRR` existe.
 * - Sparkline 6m: 6 buckets mensais (mais antigo → mais recente), PL acumulado.
 * - Ordenação final: |contribEV| desc.
 * - luckRate (issue #219): % de trades classificados como 'sorte' pelo mentor
 *   sobre os classificados (não sobre n total). null se zero classificados.
 */

import { computeLuckRateForSetup } from './mentorClassificationStats';

/**
 * Calcula duração em minutos entre dois ISO timestamps.
 * @param {string} entryISO
 * @param {string} exitISO
 * @returns {number} minutos ou 0
 */
const durationFromTimes = (entryISO, exitISO) => {
  if (!entryISO || !exitISO) return 0;
  try {
    const start = new Date(entryISO);
    const end = new Date(exitISO);
    const ms = end - start;
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.floor(ms / 60000);
  } catch {
    return 0;
  }
};

/**
 * Retorna a duração de um trade em minutos, priorizando o campo `duration`
 * (persistido) e caindo para entryTime/exitTime quando ausente.
 */
const tradeDuration = (trade) => {
  if (typeof trade.duration === 'number' && Number.isFinite(trade.duration)) {
    return trade.duration;
  }
  return durationFromTimes(trade.entryTime, trade.exitTime);
};

/**
 * Chave `YYYY-MM` do mês do trade. Prefere `date` (campo canônico, sem fuso),
 * cai para `entryTime`, depois `exitTime`.
 */
const monthKey = (trade) => {
  const raw = trade.date || trade.entryTime || trade.exitTime;
  if (!raw) return null;
  try {
    const s = String(raw);
    if (s.length >= 7) return s.slice(0, 7); // 'YYYY-MM'
    return null;
  } catch {
    return null;
  }
};

/**
 * Gera os 6 buckets mensais terminando no mês de `today` (incluso), do mais
 * antigo ao mais recente.
 * @param {Date} today
 * @returns {string[]} ['YYYY-MM', ...]
 */
const buildMonthBuckets = (today) => {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  const out = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(year, month - i, 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${yy}-${mm}`);
  }
  return out;
};

/**
 * Constrói sparkline 6m para um grupo de trades: PL acumulado ao final de cada
 * um dos 6 meses (do mais antigo ao mais recente).
 */
const buildSparkline6m = (trades, today) => {
  const buckets = buildMonthBuckets(today);
  const byMonth = new Map(buckets.map((k) => [k, 0]));
  trades.forEach((t) => {
    const mk = monthKey(t);
    if (mk && byMonth.has(mk)) {
      byMonth.set(mk, byMonth.get(mk) + (Number(t.result) || 0));
    }
  });
  let acc = 0;
  return buckets.map((k) => {
    acc += byMonth.get(k);
    return acc;
  });
};

/**
 * Calcula aderência RR: trades com `rr` dentro da banda [target*0.8, target*1.2].
 * Retorna null quando `targetRR` não existe.
 */
const calcAdherenceRR = (trades, targetRR) => {
  if (!Number.isFinite(targetRR) || targetRR <= 0) return null;
  const lo = targetRR * 0.8;
  const hi = targetRR * 1.2;
  let inBand = 0;
  trades.forEach((t) => {
    const rr = Number(t.rr);
    if (Number.isFinite(rr) && rr >= lo && rr <= hi) inBand += 1;
  });
  return {
    inBand,
    total: trades.length,
    pct: trades.length > 0 ? (inBand / trades.length) * 100 : 0,
    targetRR,
  };
};

/**
 * Normaliza `setupsMeta` em um Map por nome (case-insensitive + trim).
 */
const buildSetupsMetaIndex = (setupsMeta) => {
  const idx = new Map();
  if (!Array.isArray(setupsMeta)) return idx;
  setupsMeta.forEach((s) => {
    if (!s) return;
    const name = (s.name || '').trim();
    if (!name) return;
    idx.set(name.toLowerCase(), s);
  });
  return idx;
};

/**
 * @param {Array} trades
 * @param {Object} options
 * @param {Array} [options.setupsMeta] docs de `setups` com `{ name, targetRR? }`
 * @param {Date} [options.today] referência para janela 6m (default: new Date())
 * @returns {Array}
 */
export const analyzeBySetupV2 = (trades, options = {}) => {
  if (!trades || !Array.isArray(trades) || trades.length === 0) return [];

  const { setupsMeta, today = new Date() } = options;
  const metaIdx = buildSetupsMetaIndex(setupsMeta);

  // 1. Agrupamento por setup (trim, vazio → "Sem Setup")
  const groups = new Map();
  trades.forEach((trade) => {
    const rawKey = typeof trade.setup === 'string' ? trade.setup.trim() : '';
    const key = rawKey || 'Sem Setup';
    if (!groups.has(key)) {
      groups.set(key, { setup: key, trades: [] });
    }
    groups.get(key).trades.push(trade);
  });

  // 2. Cálculos por setup
  const rows = [];
  for (const [, group] of groups) {
    const gTrades = group.trades;
    const n = gTrades.length;
    const totalPL = gTrades.reduce((acc, t) => acc + (Number(t.result) || 0), 0);

    const wins = gTrades.filter((t) => (Number(t.result) || 0) > 0);
    const losses = gTrades.filter((t) => (Number(t.result) || 0) < 0);

    const wr = n > 0 ? (wins.length / n) * 100 : 0;
    const ev = n > 0 ? totalPL / n : 0;

    // Payoff: null se não há wins OU não há losses
    let payoff = null;
    if (wins.length > 0 && losses.length > 0) {
      const avgWin = wins.reduce((a, t) => a + Number(t.result), 0) / wins.length;
      const avgLoss = losses.reduce((a, t) => a + Number(t.result), 0) / losses.length;
      payoff = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : null;
    }

    // Durations
    const winDurations = wins.map(tradeDuration).filter((d) => d > 0);
    const lossDurations = losses.map(tradeDuration).filter((d) => d > 0);
    const durationWin = winDurations.length > 0
      ? winDurations.reduce((a, d) => a + d, 0) / winDurations.length
      : null;
    const durationLoss = lossDurations.length > 0
      ? lossDurations.reduce((a, d) => a + d, 0) / lossDurations.length
      : null;

    // ΔT = (durationWin - durationLoss) / durationLoss × 100 — null se falta algum
    let deltaT = null;
    if (
      durationWin !== null &&
      durationLoss !== null &&
      durationLoss > 0
    ) {
      deltaT = ((durationWin - durationLoss) / durationLoss) * 100;
    }

    // Aderência RR (condicional)
    const meta = metaIdx.get(group.setup.toLowerCase());
    const adherenceRR = meta
      ? calcAdherenceRR(gTrades, Number(meta.targetRR))
      : null;

    // Sparkline 6m
    const sparkline6m = buildSparkline6m(gTrades, today);

    // Issue #219 — luckRate por setup (% sorte sobre TOTAL do setup;
    // null/tecnico contam como técnico — exception-based workflow).
    const { sorte: luckCount, luckRate } = computeLuckRateForSetup(gTrades);

    rows.push({
      setup: group.setup,
      n,
      totalPL,
      wr,
      ev,
      payoff,
      durationWin,
      durationLoss,
      deltaT,
      contribEV: 0, // preenchido após total
      adherenceRR,
      sparkline6m,
      isSporadic: n < 3,
      trades: gTrades,
      luckCount,
      luckRate,
    });
  }

  // 3. Contribuição ao EV total (% com sinal)
  // Denominador: Σ |n × EV| = Σ |totalPL|. Mantém sinal do setup no numerador.
  const totalAbs = rows.reduce((a, r) => a + Math.abs(r.totalPL), 0);
  rows.forEach((r) => {
    r.contribEV = totalAbs > 0 ? (r.totalPL / totalAbs) * 100 : 0;
  });

  // 4. Ordenação por |contribEV| desc
  rows.sort((a, b) => Math.abs(b.contribEV) - Math.abs(a.contribEV));

  return rows;
};

export default analyzeBySetupV2;
