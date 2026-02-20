/**
 * planLedger
 * @see version.js para versão do produto
 * @description Utility pura para construir extrato do plano com eventos derivados
 *   Recebe trades + plan, retorna array enriquecido com acumulado e eventos
 *   Sem side effects, sem dependências de hooks ou Firebase
 * 
 * CHANGELOG:
 * - 1.4.0: Implementação inicial (plan-centric ledger sprint)
 * 
 * EVENTOS DERIVADOS (não persistidos):
 * - META        → resultado acumulado >= alvo do ciclo
 * - STOP        → resultado acumulado <= -stop do ciclo (em R$)
 * - PÓS-META    → trade realizado após META atingida
 * - PÓS-STOP    → trade realizado após STOP atingido
 * - VIOLAÇÃO    → trade após STOP (equivale a PÓS-STOP, flag de disciplina)
 * - RO_FORA     → risco operacional acima do permitido pelo plano
 * - RR_FORA     → razão risco-retorno abaixo do mínimo do plano
 * 
 * USO:
 *   import { buildPlanLedger, summarizeLedger } from '../utils/planLedger';
 *   const ledger = buildPlanLedger(trades, plan);
 *   const summary = summarizeLedger(ledger, plan);
 */

/**
 * Constrói o extrato do plano com eventos derivados
 * @param {Array} trades - Trades do plano (crus do Firestore)
 * @param {Object} plan - Plano com campos: pl, currentPl, cycleGoal, cycleStop, periodGoal, periodStop, riskPerOperation, rrTarget
 * @param {Object} [options] - Opções
 * @param {string} [options.period] - Filtro: 'cycle' (mensal/ciclo) ou 'period' (semanal/período)
 * @param {string} [options.dateFrom] - Data início (ISO: YYYY-MM-DD)
 * @param {string} [options.dateTo] - Data fim (ISO: YYYY-MM-DD)
 * @returns {Array} Ledger entries enriquecidas
 */
export const buildPlanLedger = (trades = [], plan = {}, options = {}) => {
  if (!trades.length || !plan) return [];

  // Filtrar por período se solicitado
  let filtered = [...trades];
  if (options.dateFrom) {
    filtered = filtered.filter(t => (t.date || '') >= options.dateFrom);
  }
  if (options.dateTo) {
    filtered = filtered.filter(t => (t.date || '') <= options.dateTo);
  }

  // Ordenar cronologicamente (mais antigo primeiro)
  filtered.sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    // Desempate por horário de entrada
    return (a.entryTime || '').localeCompare(b.entryTime || '');
  });

  // Calcular alvos em R$ a partir dos percentuais do plano
  const basePl = plan.pl || 0;
  const cycleGoalR$ = basePl > 0 && plan.cycleGoal ? (basePl * plan.cycleGoal / 100) : null;
  const cycleStopR$ = basePl > 0 && plan.cycleStop ? (basePl * plan.cycleStop / 100) : null;
  const periodGoalR$ = basePl > 0 && plan.periodGoal ? (basePl * plan.periodGoal / 100) : null;
  const periodStopR$ = basePl > 0 && plan.periodStop ? (basePl * plan.periodStop / 100) : null;

  let runningResult = 0;
  let metaReached = false;
  let stopReached = false;

  const ledger = filtered.map((trade, index) => {
    const result = trade.result || 0;
    runningResult += result;
    const runningPl = basePl + runningResult;
    
    const events = [];

    // Compliance (do trade, se já calculado pela Cloud Function)
    if (trade.compliance?.roStatus === 'FORA_DO_PLANO') {
      events.push('RO_FORA');
    }
    if (trade.compliance?.rrStatus === 'NAO_CONFORME') {
      events.push('RR_FORA');
    }

    // Fallback: calcular compliance localmente se não veio da CF
    if (!trade.compliance && plan.riskPerOperation && basePl > 0) {
      const riskPct = (Math.abs(result < 0 ? result : 0) / basePl) * 100;
      if (riskPct > plan.riskPerOperation) {
        events.push('RO_FORA');
      }
    }

    // Eventos de meta/stop (baseado no cycleGoal/cycleStop)
    const goalRef = cycleGoalR$;
    const stopRef = cycleStopR$;

    // Detectar META (primeiro trade que atinge)
    if (goalRef !== null && !metaReached && runningResult >= goalRef) {
      metaReached = true;
      events.push('META');
    } else if (metaReached && !stopReached) {
      events.push('PÓS-META');
    }

    // Detectar STOP (primeiro trade que atinge)
    if (stopRef !== null && !stopReached && runningResult <= -stopRef) {
      stopReached = true;
      events.push('STOP');
    } else if (stopReached) {
      // Trade após STOP = violação de disciplina
      if (!events.includes('STOP')) {
        events.push('PÓS-STOP');
        events.push('VIOLAÇÃO');
      }
    }

    return {
      seq: index + 1,
      tradeId: trade.id,
      date: trade.date,
      entryTime: trade.entryTime,
      ticker: trade.ticker,
      side: trade.side,
      qty: trade.qty,
      result,
      runningResult,
      runningPl,
      events,
      riskPercent: trade.riskPercent || null,
      rrRatio: trade.rrRatio || null,
      compliance: trade.compliance || null,
    };
  });

  return ledger;
};

/**
 * Resumo do ledger para exibição no header do extrato
 * @param {Array} ledger - Resultado de buildPlanLedger
 * @param {Object} plan - Plano
 * @returns {Object} Resumo com totais e status
 */
export const summarizeLedger = (ledger = [], plan = {}) => {
  if (!ledger.length) {
    return {
      totalTrades: 0,
      totalResult: 0,
      currentPl: plan.pl || 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      metaReached: false,
      stopReached: false,
      violations: 0,
      cycleGoalR$: null,
      cycleStopR$: null,
      progressPercent: 0,
      consumedStopPercent: 0,
    };
  }

  const basePl = plan.pl || 0;
  const lastEntry = ledger[ledger.length - 1];
  const totalResult = lastEntry.runningResult;
  const currentPl = lastEntry.runningPl;

  const wins = ledger.filter(e => e.result > 0).length;
  const losses = ledger.filter(e => e.result < 0).length;
  const winRate = ledger.length > 0 ? (wins / ledger.length) * 100 : 0;

  const metaReached = ledger.some(e => e.events.includes('META'));
  const stopReached = ledger.some(e => e.events.includes('STOP'));
  const violations = ledger.filter(e => e.events.includes('VIOLAÇÃO')).length;

  const cycleGoalR$ = basePl > 0 && plan.cycleGoal ? (basePl * plan.cycleGoal / 100) : null;
  const cycleStopR$ = basePl > 0 && plan.cycleStop ? (basePl * plan.cycleStop / 100) : null;

  // Progresso: % do caminho para a meta (pode ser negativo)
  const progressPercent = cycleGoalR$ ? (totalResult / cycleGoalR$) * 100 : 0;
  // Consumo do stop: % do stop já consumido
  const consumedStopPercent = cycleStopR$ && totalResult < 0 ? (Math.abs(totalResult) / cycleStopR$) * 100 : 0;

  return {
    totalTrades: ledger.length,
    totalResult,
    currentPl,
    wins,
    losses,
    winRate,
    metaReached,
    stopReached,
    violations,
    cycleGoalR$,
    cycleStopR$,
    progressPercent: Math.min(progressPercent, 100),
    consumedStopPercent: Math.min(consumedStopPercent, 100),
  };
};

/**
 * Agrupa ledger por data para exibição diária
 * @param {Array} ledger - Resultado de buildPlanLedger
 * @returns {Object} { 'YYYY-MM-DD': [...entries] }
 */
export const groupLedgerByDate = (ledger = []) => {
  const grouped = {};
  ledger.forEach(entry => {
    const date = entry.date || 'sem-data';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(entry);
  });
  return grouped;
};

export default buildPlanLedger;
