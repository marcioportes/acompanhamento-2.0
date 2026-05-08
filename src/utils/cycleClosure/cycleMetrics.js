/**
 * cycleMetrics.js — Métricas quantitativas do ciclo (Van Tharp + Mark Douglas)
 *
 * Pure functions consumidas pelo wizard de fechamento (etapa "Read"/"Quantitative")
 * e persistidas em `cycleClosures.metrics` pela CF closeCycle.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Convenção de inputs:
 *   - trade.result   (R$, número, sign-aware)
 *   - trade.date     ('YYYY-MM-DD')
 *   - plan.pl        (capital base, número)
 *   - plan.riskPerOperation (% do pl)
 *   - trade.compliance.{roStatus, rrStatus} ('OK' | outros) — vide compliance.js
 *
 * Convenção de outputs:
 *   - Métricas em R-multiple usam o capital R derivado do plano (R = pl × risk%).
 *   - Funções retornam null quando sample insuficiente, NUNCA NaN/Infinity.
 */

/**
 * R = capital arriscado por trade conforme plano.
 * R = plan.pl × plan.riskPerOperation / 100
 */
export function computeR(plan) {
  if (!plan || typeof plan.pl !== 'number' || typeof plan.riskPerOperation !== 'number') {
    return null;
  }
  if (plan.pl <= 0 || plan.riskPerOperation <= 0) return null;
  return plan.pl * (plan.riskPerOperation / 100);
}

/**
 * trade_R = trade.result / R
 */
export function computeTradeRMultiple(trade, R) {
  if (!trade || typeof trade.result !== 'number') return null;
  if (typeof R !== 'number' || R <= 0) return null;
  return trade.result / R;
}

/**
 * Sumarizações sobre array de trades (com R já calculado).
 *
 * Retorno:
 *   {
 *     count, winners, losers, neutrals,
 *     winRate, lossRate,
 *     avgWinR, avgLossR,
 *     bestTradeR, worstTradeR,
 *     expectancy_R,
 *     profitFactor,            // Σwins / |Σlosses|
 *     R,
 *   }
 *
 * Casos:
 *   - count === 0 → todas as métricas null
 *   - winners === 0 → avgWinR = 0
 *   - losers === 0 → avgLossR = 0; profitFactor = Infinity → retornamos null (n/a)
 */
export function computeCycleMetrics(trades, plan) {
  const R = computeR(plan);
  const list = Array.isArray(trades) ? trades : [];

  if (list.length === 0 || R === null) {
    return {
      R,
      count: list.length,
      winners: 0, losers: 0, neutrals: 0,
      winRate: null, lossRate: null,
      avgWinR: null, avgLossR: null,
      bestTradeR: null, worstTradeR: null,
      expectancy_R: null,
      profitFactor: null,
    };
  }

  let winners = 0, losers = 0, neutrals = 0;
  let sumWinR = 0, sumLossR = 0;     // sumLossR é negativo
  let sumWins = 0, sumLosses = 0;     // em R$ (não R-multiple)
  let bestR = -Infinity, worstR = Infinity;

  for (const t of list) {
    const rMul = computeTradeRMultiple(t, R);
    if (rMul === null) continue;
    if (rMul > bestR) bestR = rMul;
    if (rMul < worstR) worstR = rMul;
    if (rMul > 0) {
      winners++;
      sumWinR += rMul;
      sumWins += t.result;
    } else if (rMul < 0) {
      losers++;
      sumLossR += rMul;
      sumLosses += -t.result;          // valor absoluto da perda
    } else {
      neutrals++;
    }
  }

  const decided = winners + losers;
  const winRate = decided > 0 ? winners / decided : null;
  const lossRate = decided > 0 ? losers / decided : null;
  const avgWinR = winners > 0 ? sumWinR / winners : 0;
  const avgLossR = losers > 0 ? sumLossR / losers : 0;
  const expectancy_R =
    winRate !== null && lossRate !== null
      ? winRate * avgWinR + lossRate * avgLossR
      : null;
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : null;

  return {
    R,
    count: list.length,
    winners, losers, neutrals,
    winRate, lossRate,
    avgWinR, avgLossR,
    bestTradeR: bestR === -Infinity ? null : bestR,
    worstTradeR: worstR === Infinity ? null : worstR,
    expectancy_R,
    profitFactor,
  };
}

/**
 * ruleAdherenceRate = trades com (compliance.roStatus='OK' E compliance.rrStatus='OK') / total
 *
 * Mark Douglas: "the only KPI that matters". Trades sem objeto compliance são
 * considerados não conformes (defensivo — força preenchimento upstream).
 */
export function computeRuleAdherenceRate(trades) {
  const list = Array.isArray(trades) ? trades : [];
  if (list.length === 0) return null;

  let conform = 0;
  for (const t of list) {
    const c = t?.compliance;
    if (c && c.roStatus === 'OK' && c.rrStatus === 'OK') conform++;
  }
  return conform / list.length;
}

/**
 * Top N erros por contagem em compliance.violations[].type (string)
 * + emocional events em emotionalAnalysisV2 (TILT/REVENGE/etc).
 *
 * Retorno: array sorted desc por count, max length=N (default 3).
 *   [{ type: 'NO_STOP', count: 1 }, ...]
 */
export function topErrors(trades, n = 3) {
  const list = Array.isArray(trades) ? trades : [];
  const counts = new Map();
  for (const t of list) {
    const violations = Array.isArray(t?.compliance?.violations) ? t.compliance.violations : [];
    for (const v of violations) {
      const type = typeof v === 'string' ? v : v?.type;
      if (typeof type !== 'string') continue;
      counts.set(type, (counts.get(type) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
    .slice(0, n);
}
