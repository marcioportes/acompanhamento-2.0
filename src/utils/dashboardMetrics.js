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
    if (!plan || !plan.pl || !plan.riskPerOperation) continue;
    if (trade.riskPercent == null) continue;

    const riskAmount = (trade.riskPercent / 100) * plan.pl;
    const roPlanned = (plan.riskPerOperation / 100) * plan.pl;

    if (roPlanned > 0) {
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

export default {
  calculateMaxDrawdown,
  calculatePlannedWinRate,
  calculateComplianceRate,
  calculateRiskAsymmetry
};
