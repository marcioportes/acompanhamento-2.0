/**
 * useDashboardMetrics
 * @version 2.1.0 (v1.45.0 — issue #188 F4)
 * @description Hook customizado que encapsula TODA a lógica de cálculo de métricas do Dashboard.
 *   v2.1.0: Aceita param `context` com `periodRange`+`cycleKey` da ContextBar — TODOS os cards
 *   consumidores filtram por essa janela temporal sem exceção. `filters.period` legado foi
 *   removido (SoT única).
 *
 * Retorna:
 *   - filteredAccountsByType, selectedAccountIds, allAccountTrades, plansToShow, availablePlans
 *   - filteredTrades, stats
 *   - aggregatedInitialBalance, aggregatedCurrentBalance, balancesByCurrency, dominantCurrency
 *   - drawdown, maxDrawdownData, winRatePlanned, complianceRate
 *   - plContext { label, type }
 */

import { useMemo } from 'react';
import { calculateStats, searchTrades } from '../utils/calculations';
import { isSameCurrency, aggregateBalancesByCurrency } from '../utils/currency';
import { isRealAccount, isDemoAccount } from '../utils/planCalculations';
import {
  calculateRiskAsymmetry,
  calculateEVLeakage,
  calculatePayoff,
  calculateConsistencyCV,
  calculateDurationDelta,
} from '../utils/dashboardMetrics';
import { hasEffectiveRedFlags } from '../utils/violationFilter';

/** Labels de período por `periodRange.kind` (ContextBar — issue #118/#188). */
const PERIOD_KIND_LABELS = {
  CYCLE: 'Ciclo',
  MONTH: 'Este Mês',
  WEEK: 'Esta Semana',
};

/** Converte trade.date ('YYYY-MM-DD') em Date local à meia-noite. */
const parseTradeDate = (isoLike) => {
  if (!isoLike) return null;
  const raw = String(isoLike).split('T')[0];
  const [y, m, d] = raw.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const useDashboardMetrics = ({
  accounts,
  trades,
  plans,
  filters,
  selectedPlanId,
  accountTypeFilter,
  context = null,
}) => {
  // === Filtros de conta ===
  const filteredAccountsByType = useMemo(() => {
    if (accountTypeFilter === 'real') return accounts.filter(isRealAccount);
    if (accountTypeFilter === 'demo') return accounts.filter(isDemoAccount);
    return accounts;
  }, [accounts, accountTypeFilter]);

  // selectedPlanId tem precedência sobre filters.accountId — plano pertence a uma
  // conta, então seleção de plano deve restringir o escopo a essa conta.
  const selectedAccountIds = useMemo(() => {
    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan?.accountId) return [plan.accountId];
    }
    if (filters.accountId === 'all') return filteredAccountsByType.map(a => a.id);
    return [filters.accountId];
  }, [filteredAccountsByType, filters.accountId, selectedPlanId, plans]);

  // Contas dentro do escopo ativo — fonte única para saldos, moeda, agregações
  const accountsInScope = useMemo(() => {
    const idSet = new Set(selectedAccountIds);
    return accounts.filter(a => idSet.has(a.id));
  }, [accounts, selectedAccountIds]);

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

  // Janela temporal vem da ContextBar (issue #188 F4): quando `context.periodRange`
  // está definido com start+end, TODOS os cards consumidores obedecem SEM exceção.
  // `filters.period` legado foi removido. Granulares (ticker/setup/emotion/search) seguem.
  const filteredTrades = useMemo(() => {
    let result = allAccountTrades;
    if (selectedPlanId) result = result.filter(t => t.planId === selectedPlanId);
    const range = context?.periodRange;
    if (range?.start && range?.end) {
      const start = range.start instanceof Date ? range.start : new Date(range.start);
      const end = range.end instanceof Date ? range.end : new Date(range.end);
      // end inclusivo até fim do dia
      const endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
      result = result.filter((t) => {
        const d = parseTradeDate(t.date);
        if (!d) return false;
        return d >= start && d <= endInclusive;
      });
    }
    if (filters.ticker !== 'all') result = result.filter(t => t.ticker === filters.ticker);
    if (filters.setup !== 'all') result = result.filter(t => t.setup === filters.setup);
    if (filters.emotion !== 'all') result = result.filter(t => t.emotion === filters.emotion);
    if (filters.result !== 'all') result = result.filter(t => filters.result === 'win' ? t.result > 0 : t.result < 0);
    if (filters.search) result = searchTrades(result, filters.search);
    return result;
  }, [allAccountTrades, selectedPlanId, filters, context?.periodRange]);

  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

  // === Saldos agregados ===
  // Todos derivam de accountsInScope (reflete selectedPlanId > filters.accountId > todas)
  const aggregatedInitialBalance = useMemo(() =>
    accountsInScope.reduce((sum, acc) => sum + (acc.initialBalance ?? 0), 0),
  [accountsInScope]);

  const aggregatedCurrentBalance = useMemo(() =>
    accountsInScope.reduce((sum, acc) => sum + (acc.currentBalance ?? acc.initialBalance ?? 0), 0),
  [accountsInScope]);

  // v1.15.0: Multi-moeda
  const balancesByCurrency = useMemo(() =>
    aggregateBalancesByCurrency(accountsInScope),
  [accountsInScope]);

  const dominantCurrency = useMemo(() => {
    if (accountsInScope.length === 0) return 'BRL';
    if (isSameCurrency(accountsInScope)) return accountsInScope[0]?.currency || 'BRL';
    return null;
  }, [accountsInScope]);

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
    // Issue #221 — respeita mentorClearedViolations via hasEffectiveRedFlags.
    const withFlags = filteredTrades.filter(t => hasEffectiveRedFlags(t)).length;
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

  // === Tempo Médio de Trades (Fase C — #134) ===
  const avgTradeDuration = useMemo(() => {
    const withDuration = filteredTrades.filter(t => typeof t.duration === 'number' && t.duration > 0);
    if (withDuration.length === 0) return null;

    const wins = withDuration.filter(t => (t.result ?? 0) > 0);
    const losses = withDuration.filter(t => (t.result ?? 0) < 0);

    const avg = (arr) => arr.length > 0 ? arr.reduce((s, t) => s + t.duration, 0) / arr.length : null;

    return {
      all: avg(withDuration),
      win: avg(wins),
      loss: avg(losses),
      count: withDuration.length,
    };
  }, [filteredTrades]);

  // === Consistência Operacional (E2 — Issue #164) ===
  // CV de P&L por trade — substitui semanticamente o "Consistência" RR Asymmetry (errado)
  const consistencyCV = useMemo(() => calculateConsistencyCV(filteredTrades), [filteredTrades]);

  // ΔT W vs L — derivado de avgTradeDuration; semáforo de comportamento em posição
  const durationDelta = useMemo(() => calculateDurationDelta(avgTradeDuration), [avgTradeDuration]);

  // === P&L Contextual (issue #71/#188 F4) ===
  // Janela da ContextBar determina o label: ciclo/mês/semana → contextualizado;
  // plano sem janela → plano; nenhum dos dois → total.
  const plContext = useMemo(() => {
    const kind = context?.periodRange?.kind;
    if (kind && PERIOD_KIND_LABELS[kind]) {
      return { label: `P&L ${PERIOD_KIND_LABELS[kind]}`, type: 'filtered' };
    }

    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan) {
        return { label: `P&L Plano: ${plan.name}`, type: 'plan' };
      }
    }

    return { label: 'P&L Total', type: 'total' };
  }, [context?.periodRange?.kind, selectedPlanId, plans]);

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
    // Tempo médio (Fase C — #134)
    avgTradeDuration,
    // Consistência Operacional (E2 — #164)
    consistencyCV,
    durationDelta,
  };
};

export default useDashboardMetrics;
