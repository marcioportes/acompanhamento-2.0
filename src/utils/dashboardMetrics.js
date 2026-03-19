/**
 * Dashboard Metrics — Cálculos puros
 * @version 1.0.0
 * 
 * Lógica extraída de StudentDashboard.jsx para permitir testes unitários.
 * Funções que estavam inline em useMemo agora são importáveis e testáveis.
 */

/**
 * Calcula Max Drawdown peak-to-trough na série histórica de PL acumulado.
 * Algoritmo O(n): percorre série uma vez, rastreando peak e worst drawdown.
 * 
 * @param {Array<{result: number, date: string}>} trades - Trades ordenados por data ASC ou não (será ordenado internamente)
 * @param {number} [initialBalance=0] - Saldo inicial para cálculo de % (se 0, maxDDPercent = 0)
 * @returns {{ maxDD: number, maxDDPercent: number, maxDDDate: string|null }}
 */
export const calculateMaxDrawdown = (trades, initialBalance = 0) => {
  if (!trades || trades.length === 0) {
    return { maxDD: 0, maxDDPercent: 0, maxDDDate: null };
  }
  
  // Ordenar por data ASC
  const sorted = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  
  let cumPnL = 0;
  let peak = 0;
  let maxDD = 0;
  let maxDDDate = null;
  
  for (const trade of sorted) {
    cumPnL += Number(trade.result) || 0;
    if (cumPnL > peak) peak = cumPnL;
    const dd = peak - cumPnL;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDDate = trade.date;
    }
  }
  
  const maxDDPercent = initialBalance > 0 ? (maxDD / initialBalance) * 100 : 0;
  return { maxDD, maxDDPercent, maxDDDate };
};

/**
 * Calcula Win Rate Planejado vs Clássico.
 * Win disciplinado = result > 0 AND rrRatio >= plan.rrTarget
 * Mede "mão de alface": trades que ganharam mas saíram antes do target.
 * 
 * @param {Array<{result: number, planId: string, rrRatio?: number, rr?: number}>} trades 
 * @param {Array<{id: string, rrTarget: number}>} plans 
 * @returns {{ rate: number, eligible: number, disciplinedWins: number, classicWR: number, gap: number }|null}
 */
export const calculatePlannedWinRate = (trades, plans) => {
  if (!trades || trades.length === 0 || !plans || plans.length === 0) return null;
  
  const plansMap = {};
  plans.forEach(p => { plansMap[p.id] = p; });
  
  let eligible = 0;
  let disciplinedWins = 0;
  
  for (const trade of trades) {
    const plan = plansMap[trade.planId];
    if (!plan || !plan.rrTarget) continue;
    eligible++;
    
    const rrAchieved = Number(trade.rrRatio || trade.rr || 0);
    if (trade.result > 0 && rrAchieved >= Number(plan.rrTarget)) {
      disciplinedWins++;
    }
  }
  
  if (eligible === 0) return null;
  
  // Classic WR baseado em todos os trades (não só elegíveis)
  const totalWins = trades.filter(t => t.result > 0).length;
  const classicWR = trades.length > 0 ? (totalWins / trades.length) * 100 : 0;
  const plannedRate = (disciplinedWins / eligible) * 100;
  
  return {
    rate: plannedRate,
    eligible,
    disciplinedWins,
    classicWR,
    gap: classicWR - plannedRate
  };
};

/**
 * Calcula taxa de conformidade: % de trades sem red flags.
 * Semáforo: ≥80% verde, 60-80% amarelo, <60% vermelho.
 * 
 * @param {Array<{hasRedFlags?: boolean, redFlags?: Array}>} trades 
 * @returns {{ rate: number, compliant: number, total: number, violations: number }|null}
 */
export const calculateComplianceRate = (trades) => {
  if (!trades || trades.length === 0) return null;
  
  const withFlags = trades.filter(t => 
    t.hasRedFlags || (Array.isArray(t.redFlags) && t.redFlags.length > 0)
  ).length;
  
  const compliant = trades.length - withFlags;
  return {
    rate: (compliant / trades.length) * 100,
    compliant,
    total: trades.length,
    violations: withFlags
  };
};

/**
 * Calcula assimetria de risco entre wins e losses.
 * Detecta o padrão comportamental onde o aluno arrisca menos nos wins
 * e mais nos losses — corroendo o edge mesmo com WR e RR conformes.
 * 
 * Risk Asymmetry = avgRiskWins / avgRiskLosses
 *   > 1.0 = arrisca mais nos wins (raro, agressivo)
 *   ≈ 1.0 = sizing consistente (ideal)
 *   < 1.0 = arrisca menos nos wins (problema clássico — Kahneman/Tversky)
 * 
 * RO Efficiency = riskAmount / roPlanned (0 a 1+)
 *   1.0 = usa 100% do RO permitido
 *   0.1 = usa 10% do RO (subotimiza o plano)
 * 
 * @param {Array<{result: number, riskPercent?: number, planId: string}>} trades
 * @param {Array<{id: string, pl: number, riskPerOperation: number}>} plans
 * @returns {{ asymmetryRatio: number|null, avgRiskWins: number, avgRiskLosses: number, avgRoEfficiency: number, roEfficiencyStdDev: number, winsCount: number, lossesCount: number }|null}
 */
export const calculateRiskAsymmetry = (trades, plans) => {
  if (!trades || trades.length === 0 || !plans || plans.length === 0) return null;

  const plansMap = {};
  plans.forEach(p => { plansMap[p.id] = p; });

  const winRisks = [];
  const lossRisks = [];
  const roEfficiencies = [];

  for (const trade of trades) {
    const plan = plansMap[trade.planId];
    if (!plan) continue;

    const planPl = Number(plan.pl) || 0;
    const planRo = Number(plan.riskPerOperation) || 0;
    if (planPl <= 0 || planRo <= 0) continue;

    // Se trade sem riskPercent (sem stop), assume RO$ do plano como risco
    let rp;
    if (trade.riskPercent == null) {
      rp = planRo; // assume risco maximo do plano
    } else {
      rp = Number(trade.riskPercent);
      if (isNaN(rp)) continue;
    }

    const riskAmount = (rp / 100) * planPl;
    const roPlanned = (planRo / 100) * planPl;

    if (roPlanned > 0 && isFinite(riskAmount / roPlanned)) {
      roEfficiencies.push(riskAmount / roPlanned);
    }

    if (trade.result > 0) {
      winRisks.push(riskAmount);
    } else if (trade.result < 0) {
      lossRisks.push(riskAmount);
    }
  }

  if (winRisks.length === 0 && lossRisks.length === 0) return null;

  const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const stddev = (arr) => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  };

  const avgRiskWins = avg(winRisks);
  const avgRiskLosses = avg(lossRisks);
  const avgRoEff = avg(roEfficiencies);
  const roEffStdDev = stddev(roEfficiencies);

  const asymmetryRatio = avgRiskLosses > 0 ? avgRiskWins / avgRiskLosses : null;

  return {
    asymmetryRatio: asymmetryRatio != null ? Math.round(asymmetryRatio * 100) / 100 : null,
    avgRiskWins: Math.round(avgRiskWins * 100) / 100,
    avgRiskLosses: Math.round(avgRiskLosses * 100) / 100,
    avgRoEfficiency: Math.round(avgRoEff * 10000) / 100,
    roEfficiencyStdDev: Math.round(roEffStdDev * 10000) / 100,
    winsCount: winRisks.length,
    lossesCount: lossRisks.length,
  };
};

/**
 * Calcula EV Leakage — quanto do edge teorico o aluno perde por comportamento.
 * 
 * EV teorico = WR * (rrTarget * roAmount) - LossRate * roAmount
 *   = roAmount * (WR * rrTarget - LossRate)
 * EV real = media(results)
 * Leakage = 1 - (EV_real / EV_teorico)
 *   0% = execucao perfeita do plano
 *   100% = edge completamente perdido
 *   >100% = aluno perde mais do que deveria (sizing inverso)
 *   negativo = aluno supera o edge teorico
 * 
 * @param {Array<{result: number, planId: string}>} trades
 * @param {Array<{id: string, pl: number, riskPerOperation: number, rrTarget: number}>} plans
 * @returns {{ evTheoretical: number, evReal: number, leakage: number, leakageAmount: number, totalLeakage: number, tradeCount: number }|null}
 */
export const calculateEVLeakage = (trades, plans) => {
  if (!trades || trades.length === 0 || !plans || plans.length === 0) return null;

  const plansMap = {};
  plans.forEach(p => { plansMap[p.id] = p; });

  // Filtrar trades com plano valido que tenha pl, riskPerOperation e rrTarget
  const eligible = trades.filter(t => {
    const p = plansMap[t.planId];
    return p && p.pl > 0 && p.riskPerOperation > 0 && p.rrTarget > 0;
  });

  if (eligible.length === 0) return null;

  // WR real
  const wins = eligible.filter(t => t.result > 0).length;
  const wr = wins / eligible.length;
  const lossRate = 1 - wr;

  // EV teorico medio ponderado por plano
  // Para cada trade, o EV teorico eh baseado no plano daquele trade
  let sumEvTheoretical = 0;
  let sumResults = 0;

  for (const trade of eligible) {
    const plan = plansMap[trade.planId];
    const roAmount = (plan.riskPerOperation / 100) * plan.pl;
    const evTheo = roAmount * (wr * plan.rrTarget - lossRate);
    sumEvTheoretical += evTheo;
    sumResults += (trade.result ?? 0);
  }

  const evTheoretical = sumEvTheoretical / eligible.length;
  const evReal = sumResults / eligible.length;

  // Leakage: so faz sentido quando EV teorico > 0 (plano tem edge)
  let leakage = null;
  if (evTheoretical > 0) {
    leakage = Math.round((1 - (evReal / evTheoretical)) * 10000) / 100;
  } else if (evTheoretical <= 0 && evReal <= 0) {
    // Plano sem edge e resultado negativo — sem leakage mensuravel
    leakage = null;
  } else if (evTheoretical <= 0 && evReal > 0) {
    // Plano sem edge mas aluno lucrou — outperformance
    leakage = null;
  }

  const leakageAmount = Math.round((evTheoretical - evReal) * 100) / 100;
  const totalLeakage = Math.round(leakageAmount * eligible.length * 100) / 100;

  return {
    evTheoretical: Math.round(evTheoretical * 100) / 100,
    evReal: Math.round(evReal * 100) / 100,
    leakage,
    leakageAmount,
    totalLeakage,
    tradeCount: eligible.length,
  };
};

/**
 * Calcula Payoff (avgWin / avgLoss).
 * Mede o tamanho medio de um win vs o tamanho medio de um loss.
 * Diferente do Profit Factor (somaWins / somaLosses) que embute WR.
 * 
 * Payoff > 1.5 = edge sustentavel (sobrevive a queda de WR)
 * Payoff 1.0–1.5 = edge fragil (depende do WR)
 * Payoff < 1.0 = sem edge estrutural (perde mais por trade do que ganha)
 * 
 * WR minimo para breakeven = 1 / (1 + Payoff)
 * 
 * @param {Object} stats - Retorno de calculateStats() com avgWin, avgLoss, winRate
 * @returns {{ ratio: number, avgWin: number, avgLoss: number, minWRForBreakeven: number }|null}
 */
export const calculatePayoff = (stats) => {
  if (!stats || stats.avgWin == null || stats.avgLoss == null) return null;
  if (stats.avgWin === 0 && stats.avgLoss === 0) return null;

  const avgWin = Math.abs(stats.avgWin);
  const avgLoss = Math.abs(stats.avgLoss);

  const ratio = avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : null;
  const minWRForBreakeven = ratio != null ? Math.round((1 / (1 + ratio)) * 10000) / 100 : null;

  return {
    ratio,
    avgWin,
    avgLoss,
    minWRForBreakeven,
  };
};

export default {
  calculateMaxDrawdown,
  calculatePlannedWinRate,
  calculateComplianceRate,
  calculateRiskAsymmetry,
  calculateEVLeakage,
  calculatePayoff
};
