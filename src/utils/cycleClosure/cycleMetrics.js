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
 * computeStopBreach — envelopa analyzePlanCompliance pra wizard do fechamento.
 *
 * Detecta se o stop do ciclo foi violado e quantos trades ocorreram DEPOIS
 * (sinal mais grave que P&L final, porque revela o padrão autodestrutivo
 * de continuar operando após o cap planejado).
 *
 * @param {Array} cycleTrades   trades do ciclo (com .result, .date, .createdAt)
 * @param {Object} plan          plano com pl, cycleStop (%), cycleGoal (%)
 *
 * @returns {Object}
 *   {
 *     status: 'NO_TRADES'|'NORMAL'|'STOP_DISCIPLINED'|'STOP_WORSENED'|'STOP_RECOVERED'|...
 *     stopBreachIndex: -1 | n,    // 1-based no UI seria n+1
 *     tradesAfterStop: number,
 *     pnlAfterStop: number,        // R$ acumulados após o breach
 *     stopValue: number,           // R$ do stop planejado (negativo)
 *     pnlPctOfStop: number|null,   // |result| / |stopValue| — quão fundo foi
 *     severity: 'clean' | 'minor' | 'major' | 'critical'
 *   }
 */
export function computeStopBreach(cycleTrades, plan) {
  const list = Array.isArray(cycleTrades) ? cycleTrades : [];
  if (list.length === 0 || !plan || typeof plan.pl !== 'number' || plan.pl <= 0) {
    return {
      status: 'NO_TRADES', stopBreachIndex: -1, tradesAfterStop: 0, pnlAfterStop: 0,
      stopValue: 0, pnlPctOfStop: null, severity: 'clean',
    };
  }
  const cycleStopPct = typeof plan.cycleStop === 'number' ? plan.cycleStop : null;
  const cycleGoalPct = typeof plan.cycleGoal === 'number' ? plan.cycleGoal : null;
  const stopValue = cycleStopPct != null ? plan.pl * (cycleStopPct / 100) : 0;
  const goalValue = cycleGoalPct != null ? plan.pl * (cycleGoalPct / 100) : 0;

  // Ordenação cronológica replica analyzePlanCompliance
  const sorted = [...list].sort((a, b) => {
    const tA = a.createdAt?.seconds || new Date(a.date).getTime();
    const tB = b.createdAt?.seconds || new Date(b.date).getTime();
    return tA - tB;
  });

  const stopLimit = -Math.abs(stopValue);
  const goalLimit = Math.abs(goalValue);

  let running = 0;
  let stopBreachIndex = -1;
  let goalReachIndex = -1;
  let pnlAtBreach = 0;

  for (let i = 0; i < sorted.length; i++) {
    const r = Number(sorted[i].result || 0);
    running += r;
    if (stopLimit !== 0 && running <= stopLimit && stopBreachIndex === -1) {
      stopBreachIndex = i;
      pnlAtBreach = running;
    }
    if (goalLimit !== 0 && running >= goalLimit && goalReachIndex === -1) {
      goalReachIndex = i;
    }
  }

  const totalPnl = running;
  const tradesAfterStop = stopBreachIndex !== -1 ? (sorted.length - 1 - stopBreachIndex) : 0;
  const pnlAfterStop = stopBreachIndex !== -1 ? totalPnl - pnlAtBreach : 0;

  let status = 'NORMAL';
  if (stopBreachIndex !== -1) {
    if (goalReachIndex !== -1 && goalReachIndex > stopBreachIndex) status = 'LOSS_TO_GOAL';
    else if (tradesAfterStop > 0) status = (totalPnl <= pnlAtBreach) ? 'STOP_WORSENED' : 'STOP_RECOVERED';
    else status = 'STOP_DISCIPLINED';
  } else if (goalReachIndex !== -1) {
    status = 'GOAL_HIT';
  }

  const pnlPctOfStop = stopValue !== 0 && totalPnl < 0
    ? Math.abs(totalPnl) / Math.abs(stopValue)
    : null;

  // severity:
  //  clean    — sem breach
  //  minor    — breach mas parou (STOP_DISCIPLINED) ou recuperou (STOP_RECOVERED com <=2 trades post)
  //  major    — STOP_WORSENED ou >=3 trades pós-breach
  //  critical — perda final > 1.5x stop (queimou capital muito além do cap planejado)
  let severity = 'clean';
  if (stopBreachIndex !== -1) {
    if (pnlPctOfStop != null && pnlPctOfStop >= 1.5) severity = 'critical';
    else if (status === 'STOP_WORSENED' || tradesAfterStop >= 3) severity = 'major';
    else severity = 'minor';
  }

  return {
    status, stopBreachIndex, tradesAfterStop, pnlAfterStop,
    stopValue, pnlPctOfStop, severity,
  };
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

// Catálogo único de labels PT-BR cobrindo as duas famílias de erro:
// (a) compliance violations declaradas (motor Compliance V2)
// (b) behavioral events (Emotional V2 + Execution Behavior)
// Mark Douglas: comportamento repetido sob pressão é regra interna violada,
// não "outra natureza" de erro — UI trata as duas famílias com o mesmo peso.
export const ERROR_LABELS_PT = {
  // Compliance V2
  NO_STOP:            'Sem stop declarado',
  STOP_VIOLATION:     'Violou stop declarado',
  STOP_TAMPERING:     'Stop deslocado',
  OVERSIZED:          'Tamanho excessivo',
  OUTSIDE_HOURS:      'Fora do horário',
  ASSET_NOT_ALLOWED:  'Ativo não permitido',
  NO_TARGET:          'Sem alvo declarado',
  // Behavioral (Emotional V2 + Execution)
  tilt:              'Tilt',
  revenge:           'Vingança',
  overtrading:       'Excesso de trades',
  stopTampering:     'Stop deslocado em ordem',
  rapidReentry:      'Reentrada pós-stop',
  chaseReentry:      'Perseguição de preço',
  hesitation:        'Hesitação',
  breakevenTooEarly: 'Breakeven cedo',
  partialSizing:     'Sizing parcial',
};

/**
 * Catálogo de chaves de eventCounts tratadas como erros comportamentais.
 * Exclui flags meta (tiltDaysCount, revengeDaysCount, overtradingWarnings)
 * que são derivações de contagem por dia, não eventos isolados.
 */
const BEHAVIORAL_ERROR_KEYS = [
  'tilt', 'revenge', 'overtrading', 'stopTampering',
  'rapidReentry', 'chaseReentry', 'hesitation',
  'breakevenTooEarly', 'partialSizing',
];

/**
 * Mescla compliance.violations[] + behavioral eventCounts numa lista única
 * de "erros do ciclo" ranqueada por count. Cada item carrega `source` pra
 * UI distinguir tipograficamente quando precisar.
 *
 * Retorno:
 *   [{ type, count, source: 'compliance' | 'behavioral', label }]
 */
export function topUnifiedErrors(trades, eventCounts, n = 5) {
  const out = [];
  // Compliance: agrupa violations por type
  const list = Array.isArray(trades) ? trades : [];
  const complianceCounts = new Map();
  for (const t of list) {
    const violations = Array.isArray(t?.compliance?.violations) ? t.compliance.violations : [];
    for (const v of violations) {
      const type = typeof v === 'string' ? v : v?.type;
      if (typeof type !== 'string') continue;
      complianceCounts.set(type, (complianceCounts.get(type) || 0) + 1);
    }
  }
  for (const [type, count] of complianceCounts.entries()) {
    out.push({ type, count, source: 'compliance', label: ERROR_LABELS_PT[type] || type });
  }
  // Behavioral: pega só chaves do catálogo, descartando zeros
  const counts = eventCounts && typeof eventCounts === 'object' ? eventCounts : {};
  for (const key of BEHAVIORAL_ERROR_KEYS) {
    const count = Number(counts[key]) || 0;
    if (count > 0) {
      out.push({ type: key, count, source: 'behavioral', label: ERROR_LABELS_PT[key] || key });
    }
  }
  return out
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, n);
}
