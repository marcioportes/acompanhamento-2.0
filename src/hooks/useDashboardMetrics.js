/**
 * useDashboardMetrics
 * @version 2.0.0 (v1.19.0)
 * @description Hook customizado que encapsula TODA a lógica de cálculo de métricas do Dashboard.
 *   Extraído do StudentDashboard para reduzir o arquivo principal e facilitar testes.
 *   v2.0.0: P&L contextual — label dinâmico indicando contexto do P&L exibido (B5 — Issue #71).
 * 
 * Retorna:
 *   - filteredAccountsByType, selectedAccountIds, allAccountTrades, plansToShow, availablePlans
 *   - filteredTrades, stats
 *   - aggregatedInitialBalance, aggregatedCurrentBalance, balancesByCurrency, dominantCurrency
 *   - drawdown, maxDrawdownData, winRatePlanned, complianceRate
 *   - plContext { label, type }
 */

import { useMemo } from 'react';
import { calculateStats, filterTradesByPeriod, searchTrades } from '../utils/calculations';
import { isSameCurrency, aggregateBalancesByCurrency } from '../utils/currency';
import { isRealAccount, isDemoAccount } from '../utils/planCalculations';
import { calculateRiskAsymmetry, calculateEVLeakage, calculatePayoff } from '../utils/dashboardMetrics';

/** Labels de período para display */
const PERIOD_LABELS = {
  today: 'Hoje',
  week: 'Esta Semana',
  month: 'Este Mês',
  quarter: 'Este Trimestre',
  year: 'Este Ano',
};

const useDashboardMetrics = ({
  accounts,
  trades,
  plans,
  filters,
  selectedPlanId,
  accountTypeFilter,
}) => {
  // === Filtros de conta ===
  const filteredAccountsByType = useMemo(() => {
    if (accountTypeFilter === 'real') return accounts.filter(isRealAccount);
    if (accountTypeFilter === 'demo') return accounts.filter(isDemoAccount);
    return accounts;
  }, [accounts, accountTypeFilter]);

  const selectedAccountIds = useMemo(() => {
    if (filters.accountId === 'all') return filteredAccountsByType.map(a => a.id);
    return [filters.accountId];
  }, [filteredAccountsByType, filters.accountId]);

  // === Trades e Planos filtrados ===
  const allAccountTrades = useMemo(() => {
    return trades.filter(t => selectedAccountIds.includes(t.accountId));
  }, [trades, selectedAccountIds]);

  const plansToShow = useMemo(() => {
    return plans.filter(p => selectedAccountIds.includes(p.accountId));
  }, [plans, selectedAccountIds]);

  const availablePlans = useMemo(() => {
    return plansToShow.filter(p => p.active !== false);
  }, [plansToShow]);

  const filteredTrades = useMemo(() => {
    let result = allAccountTrades;
    if (selectedPlanId) result = result.filter(t => t.planId === selectedPlanId);
    if (filters.period !== 'all') result = filterTradesByPeriod(result, filters.period);
    if (filters.ticker !== 'all') result = result.filter(t => t.ticker === filters.ticker);
    if (filters.setup !== 'all') result = result.filter(t => t.setup === filters.setup);
    if (filters.emotion !== 'all') result = result.filter(t => t.emotion === filters.emotion);
    if (filters.result !== 'all') result = result.filter(t => filters.result === 'win' ? t.result > 0 : t.result < 0);
    if (filters.search) result = searchTrades(result, filters.search);
    return result;
  }, [allAccountTrades, selectedPlanId, filters]);

  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

  // === Saldos agregados ===
  const aggregatedInitialBalance = useMemo(() => {
    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan) {
        const acc = accounts.find(a => a.id === plan.accountId);
        return acc ? (acc.initialBalance ?? 0) : 0;
      }
    }
    if (filters.accountId !== 'all') {
      const acc = accounts.find(a => a.id === filters.accountId);
      return acc ? (acc.initialBalance ?? 0) : 0;
    }
    return filteredAccountsByType.reduce((sum, acc) => sum + (acc.initialBalance ?? 0), 0);
  }, [filteredAccountsByType, filters.accountId, accounts, selectedPlanId, plans]);

  const aggregatedCurrentBalance = useMemo(() => {
    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan) {
        const acc = accounts.find(a => a.id === plan.accountId);
        return acc ? (acc.currentBalance ?? acc.initialBalance ?? 0) : 0;
      }
    }
    if (filters.accountId !== 'all') {
      const acc = accounts.find(a => a.id === filters.accountId);
      return acc ? (acc.currentBalance ?? acc.initialBalance ?? 0) : 0;
    }
    return filteredAccountsByType.reduce((sum, acc) => sum + (acc.currentBalance ?? acc.initialBalance ?? 0), 0);
  }, [filteredAccountsByType, filters.accountId, accounts, selectedPlanId, plans]);

  // v1.15.0: Multi-moeda
  const balancesByCurrency = useMemo(() => {
    if (filters.accountId !== 'all') {
      const acc = accounts.find(a => a.id === filters.accountId);
      return aggregateBalancesByCurrency(acc ? [acc] : []);
    }
    return aggregateBalancesByCurrency(filteredAccountsByType);
  }, [filteredAccountsByType, filters.accountId, accounts]);

  const dominantCurrency = useMemo(() => {
    if (filters.accountId !== 'all') {
      const acc = accounts.find(a => a.id === filters.accountId);
      return acc?.currency || 'BRL';
    }
    if (isSameCurrency(filteredAccountsByType)) {
      return filteredAccountsByType[0]?.currency || 'BRL';
    }
    return null;
  }, [filteredAccountsByType, filters.accountId, accounts]);

  // === Métricas avançadas ===
  const drawdown = useMemo(() => {
    if (aggregatedInitialBalance <= 0) return 0;
    const loss = Math.min(0, aggregatedCurrentBalance - aggregatedInitialBalance);
    return Math.abs(loss / aggregatedInitialBalance) * 100;
  }, [aggregatedInitialBalance, aggregatedCurrentBalance]);

  const maxDrawdownData = useMemo(() => {
    if (filteredTrades.length === 0) return { maxDD: 0, maxDDPercent: 0, maxDDDate: null };
    const sorted = [...filteredTrades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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
    const maxDDPercent = aggregatedInitialBalance > 0 ? (maxDD / aggregatedInitialBalance) * 100 : 0;
    return { maxDD, maxDDPercent, maxDDDate };
  }, [filteredTrades, aggregatedInitialBalance]);

  const winRatePlanned = useMemo(() => {
    if (filteredTrades.length === 0 || plansToShow.length === 0) return null;
    const plansMap = {};
    plansToShow.forEach(p => { plansMap[p.id] = p; });
    let eligible = 0;
    let disciplinedWins = 0;
    for (const trade of filteredTrades) {
      const plan = plansMap[trade.planId];
      if (!plan || !plan.rrTarget) continue;
      eligible++;
      const rrAchieved = Number(trade.rrRatio || trade.rr || 0);
      if (trade.result > 0 && rrAchieved >= Number(plan.rrTarget)) {
        disciplinedWins++;
      }
    }
    if (eligible === 0) return null;
    return {
      rate: (disciplinedWins / eligible) * 100,
      eligible,
      disciplinedWins,
      gap: stats.winRate - ((disciplinedWins / eligible) * 100)
    };
  }, [filteredTrades, plansToShow, stats.winRate]);

  const complianceRate = useMemo(() => {
    if (filteredTrades.length === 0) return null;
    const withFlags = filteredTrades.filter(t => 
      t.hasRedFlags || (Array.isArray(t.redFlags) && t.redFlags.length > 0)
    ).length;
    const compliant = filteredTrades.length - withFlags;
    return {
      rate: (compliant / filteredTrades.length) * 100,
      compliant,
      total: filteredTrades.length,
      violations: withFlags
    };
  }, [filteredTrades]);

  // === Risk Asymmetry (v1.19.4) ===
  const riskAsymmetry = useMemo(() => {
    if (filteredTrades.length === 0 || plansToShow.length === 0) return null;
    return calculateRiskAsymmetry(filteredTrades, plansToShow);
  }, [filteredTrades, plansToShow]);

  // === EV Leakage (v1.19.4) ===
  const evLeakage = useMemo(() => {
    if (filteredTrades.length === 0 || plansToShow.length === 0) return null;
    return calculateEVLeakage(filteredTrades, plansToShow);
  }, [filteredTrades, plansToShow]);

  // === Payoff (v1.19.6) ===
  const payoff = useMemo(() => {
    return calculatePayoff(stats);
  }, [stats]);

  // === Asymmetry Diagnostic (v1.19.6) ===
  const asymmetryDiagnostic = useMemo(() => {
    if (!riskAsymmetry || !filteredTrades.length) return null;

    const wins = filteredTrades.filter(t => t.result > 0);
    const losses = filteredTrades.filter(t => t.result < 0);
    const winsNoStop = wins.filter(t => t.riskPercent == null).length;
    const lossesOverRisk = losses.filter(t =>
      t.compliance?.roStatus === 'FORA_DO_PLANO'
    ).length;

    return { winsNoStop, winsTotal: wins.length, lossesOverRisk, lossesTotal: losses.length };
  }, [riskAsymmetry, filteredTrades]);

  // === P&L Contextual (B5 — Issue #71) ===
  const plContext = useMemo(() => {
    // Prioridade 1: filtro de período ativo
    if (filters.period !== 'all') {
      return {
        label: `P&L ${PERIOD_LABELS[filters.period] || filters.period}`,
        type: 'filtered',
      };
    }

    // Prioridade 2: plano selecionado → P&L do plano
    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan) {
        return {
          label: `P&L Plano: ${plan.name}`,
          type: 'plan',
        };
      }
    }

    // Prioridade 3: sem filtro, sem plano → total
    return {
      label: 'P&L Total',
      type: 'total',
    };
  }, [filters.period, selectedPlanId, plans]);

  return {
    // Filtros
    filteredAccountsByType,
    selectedAccountIds,
    // Dados
    allAccountTrades,
    plansToShow,
    availablePlans,
    filteredTrades,
    stats,
    // Saldos
    aggregatedInitialBalance,
    aggregatedCurrentBalance,
    balancesByCurrency,
    dominantCurrency,
    // Métricas
    drawdown,
    maxDrawdownData,
    winRatePlanned,
    complianceRate,
    riskAsymmetry,
    evLeakage,
    payoff,
    asymmetryDiagnostic,
    // Contexto P&L (B5)
    plContext,
  };
};

export default useDashboardMetrics;
