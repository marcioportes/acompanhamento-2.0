/**
 * swotHeuristics.js — IA stub heurístico (SWOT auto-fill)
 *
 * Pure function consumida pela etapa 4 (Map) do wizard. Pré-popula Opportunities
 * e Threats com regras determinísticas. Strengths e Weaknesses ficam baseadas em
 * dados puros (best/worst trade, top errors) — emergem direto de cycleMetrics + topErrors.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Regras (fechadas no draft §4.F):
 *
 * Opportunities:
 *   - Best trade saiu cedo: bestTrade.MFE_R - bestTrade.exitR > 1.5R
 *     → "Trade X tinha MFE de NR mas saiu em MR. Padrão: saiu cedo de vencedor."
 *   - Setup recurrent com WR alto: setup com count ≥ 2 AND winRate > 70%
 *     → "Setup Y teve WR 80% (n=2). Pode sistematizar?"
 *
 * Threats:
 *   - Loss streak ≥ 4: maxLossStreak ≥ 4
 *     → "Sequência de N losses. Considere pausa após 3 losses consecutivos."
 *   - DD próximo do stop: maxDrawdownPercent > 0.70 × stopPercent
 *     → "Drawdown chegou a X% (próximo do stop Y%). Margem fina."
 *
 * Output: { opportunities: string[], threats: string[] }
 */

const MFE_GAP_THRESHOLD_R = 1.5;
const SETUP_WR_THRESHOLD = 0.70;
const SETUP_COUNT_MIN = 2;
const LOSS_STREAK_DANGER = 4;
const DD_RATIO_DANGER = 0.70;

/**
 * Calcula MFE em R para LONG/SHORT a partir de mepPrice/menPrice (issue #187).
 * MEP = Maximum Excursion Positive (preço mais favorável atingido durante o trade).
 * Para LONG: MFE = (mepPrice - entry) × qty / R
 * Para SHORT: MFE = (entry - menPrice) × qty / R    (mais favorável = preço caindo)
 *
 * @returns {number|null} MFE em R-multiples, null se inputs faltam
 */
export function computeTradeMFE_R(trade, R) {
  if (!trade || typeof R !== 'number' || R <= 0) return null;
  const { side, entry, mepPrice, menPrice, qty } = trade;
  if (typeof entry !== 'number' || typeof qty !== 'number') return null;

  if (side === 'LONG') {
    if (typeof mepPrice !== 'number') return null;
    return ((mepPrice - entry) * qty) / R;
  }
  if (side === 'SHORT') {
    if (typeof menPrice !== 'number') return null;
    return ((entry - menPrice) * qty) / R;
  }
  return null;
}

/**
 * Comprimento da maior sequência consecutiva de losses no array.
 * Trades neutrals (result === 0) quebram a sequência (defensivo).
 */
export function maxLossStreak(trades) {
  const list = Array.isArray(trades) ? trades : [];
  let max = 0;
  let cur = 0;
  for (const t of list) {
    if (typeof t?.result !== 'number') continue;
    if (t.result < 0) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

/**
 * Agrega trades por setup, computando count + winRate por setup.
 * Trade.setup pode ser string (id/nome) — group by valor exato.
 */
export function aggregateBySetup(trades) {
  const list = Array.isArray(trades) ? trades : [];
  const map = new Map();
  for (const t of list) {
    const setup = t?.setup;
    if (typeof setup !== 'string' || setup.length === 0) continue;
    if (!map.has(setup)) map.set(setup, { setup, count: 0, wins: 0 });
    const entry = map.get(setup);
    entry.count++;
    if (typeof t.result === 'number' && t.result > 0) entry.wins++;
  }
  return [...map.values()].map((e) => ({ ...e, winRate: e.wins / e.count }));
}

/**
 * Gera array de Opportunities heurísticas. Cada item é uma string user-facing.
 *
 * @param {Object} input
 * @param {Array} input.trades — trades do ciclo
 * @param {number} input.R     — capital arriscado por trade
 */
export function buildOpportunities({ trades, R }) {
  const out = [];
  const list = Array.isArray(trades) ? trades : [];

  // Best trade saiu cedo
  if (typeof R === 'number' && R > 0) {
    let bestExitR = -Infinity;
    let bestTrade = null;
    for (const t of list) {
      if (typeof t?.result !== 'number') continue;
      const exitR = t.result / R;
      if (exitR > bestExitR) {
        bestExitR = exitR;
        bestTrade = t;
      }
    }
    if (bestTrade) {
      const mfeR = computeTradeMFE_R(bestTrade, R);
      if (typeof mfeR === 'number' && mfeR - bestExitR > MFE_GAP_THRESHOLD_R) {
        out.push(
          `Trade ${bestTrade.id || 'top'} tinha MFE de ${mfeR.toFixed(1)}R mas saiu em ` +
          `${bestExitR.toFixed(1)}R. Padrão: saiu cedo de vencedor — considere alvo escalonado.`
        );
      }
    }
  }

  // Setup recurrent com WR alto
  const setupAgg = aggregateBySetup(list);
  for (const s of setupAgg) {
    if (s.count >= SETUP_COUNT_MIN && s.winRate >= SETUP_WR_THRESHOLD) {
      out.push(
        `Setup ${s.setup} teve WR ${(s.winRate * 100).toFixed(0)}% ` +
        `(n=${s.count}). Pode sistematizar?`
      );
    }
  }

  return out;
}

/**
 * Gera array de Threats heurísticas.
 *
 * @param {Object} input
 * @param {Array} input.trades
 * @param {number} input.maxDDPercent       — drawdown decimal (0.028 = 2.8%)
 * @param {number} input.cycleStopPercent   — stop do plano em %, vira decimal aqui (5 = 5%)
 */
export function buildThreats({ trades, maxDDPercent, cycleStopPercent }) {
  const out = [];
  const list = Array.isArray(trades) ? trades : [];

  const streak = maxLossStreak(list);
  if (streak >= LOSS_STREAK_DANGER) {
    out.push(
      `Sequência de ${streak} losses consecutivos detectada. ` +
      `Considere pausa após 3 losses (gate disciplinar).`
    );
  }

  if (typeof maxDDPercent === 'number' && typeof cycleStopPercent === 'number' && cycleStopPercent > 0) {
    const ddAbs = Math.abs(maxDDPercent);
    const stopDec = cycleStopPercent / 100;
    if (ddAbs > DD_RATIO_DANGER * stopDec) {
      out.push(
        `Drawdown chegou a ${(ddAbs * 100).toFixed(1)}% ` +
        `(próximo do stop ${cycleStopPercent}%). Margem fina — single trade ruim consome o ciclo.`
      );
    }
  }

  return out;
}

/**
 * Conveniência: gera Opportunities + Threats em uma chamada.
 */
export function buildSWOT({ trades, R, maxDDPercent, cycleStopPercent }) {
  return {
    opportunities: buildOpportunities({ trades, R }),
    threats: buildThreats({ trades, maxDDPercent, cycleStopPercent }),
  };
}

export const SWOT_THRESHOLDS = Object.freeze({
  MFE_GAP_THRESHOLD_R,
  SETUP_WR_THRESHOLD,
  SETUP_COUNT_MIN,
  LOSS_STREAK_DANGER,
  DD_RATIO_DANGER,
});
