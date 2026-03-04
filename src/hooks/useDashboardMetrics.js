/**
 * useDashboardMetrics
 * @version 1.0.0 (v1.15.0)
 * @description Hook customizado que encapsula TODA a lógica de cálculo de métricas do Dashboard.
 *   Extraído do StudentDashboard para reduzir o arquivo principal e facilitar testes.
 * 
 * Retorna:
 *   - filteredAccountsByType, selectedAccountIds, allAccountTrades, plansToShow, availablePlans
 *   - filteredTrades, stats
 *   - aggregatedInitialBalance, aggregatedCurrentBalance, balancesByCurrency, dominantCurrency
 *   - drawdown, maxDrawdownData, winRatePlanned, complianceRate
 */

import { useMemo } from 'react';
import { calculateStats, filterTradesByPeriod, searchTrades } from '../utils/calculations';
import { isSameCurrency, aggregateBalancesByCurrency } from '../utils/currency';
import { isRealAccount, isDemoAccount } from '../utils/planCalculations';

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
  };
};

export default useDashboardMetrics;
