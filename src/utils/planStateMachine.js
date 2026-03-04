/**
 * planStateMachine.js
 * @version 1.0.0 (v1.16.0)
 * @description Máquina de estados do plano operacional — função pura.
 *   Recebe trades + config → retorna estado completo de períodos e ciclo.
 *   Shape do retorno é compatível com futuro doc `cycleClosures` no Firestore.
 *
 * HIERARQUIA:
 *   Ciclo (Mensal/Trimestral)
 *     └─ Período 1 (Diário/Semanal)
 *     │    └─ Trade A → IN_PROGRESS
 *     │    └─ Trade B → GOAL_HIT (acum >= meta)
 *     │    └─ Trade C → POST_GOAL (violação pós-meta)
 *     └─ Período 2
 *          └─ Trade D → STOP_HIT
 *          └─ Trade E → POST_STOP
 *
 * REGRAS DE NEGÓCIO:
 *   - Períodos só existem quando há trades (sem geração de dias/semanas vazios)
 *   - Semana se divide no boundary do ciclo (mês/trimestre)
 *   - trade.date é source of truth para agrupamento
 *   - O sistema não bloqueia — apenas classifica (POST_GOAL/POST_STOP)
 *   - goalVal/stopVal = 0 → nunca atinge (desabilitado)
 */

// ============================================
// CONSTANTS
// ============================================

export const PERIOD_STATES = {
  IN_PROGRESS: 'IN_PROGRESS',
  GOAL_HIT: 'GOAL_HIT',
  STOP_HIT: 'STOP_HIT',
  POST_GOAL: 'POST_GOAL',
  POST_STOP: 'POST_STOP',
};

// ============================================
// HELPERS — Date / Period Grouping
// ============================================

/**
 * Retorna o último dia do mês (Date object, 23:59:59.999)
 */
const getMonthEnd = (year, month) => new Date(year, month + 1, 0, 23, 59, 59, 999);

/**
 * Retorna o último dia do trimestre
 */
const getQuarterEnd = (year, month) => {
  const quarterEndMonth = Math.floor(month / 3) * 3 + 2;
  return getMonthEnd(year, quarterEndMonth);
};

/**
 * Retorna o último dia do ciclo que contém a data fornecida.
 * @param {string} adjustmentCycle - 'Mensal' | 'Trimestral'
 * @param {Date} date
 * @returns {Date}
 */
export const getCycleEndDate = (adjustmentCycle, date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (adjustmentCycle) {
    case 'Trimestral':
      return getQuarterEnd(y, m);
    case 'Mensal':
    default:
      return getMonthEnd(y, m);
  }
};

/**
 * Retorna o primeiro dia do ciclo que contém a data fornecida.
 * @param {string} adjustmentCycle - 'Mensal' | 'Trimestral'
 * @param {Date} date
 * @returns {Date}
 */
export const getCycleStartDate = (adjustmentCycle, date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (adjustmentCycle) {
    case 'Trimestral':
      return new Date(y, Math.floor(m / 3) * 3, 1);
    case 'Mensal':
    default:
      return new Date(y, m, 1);
  }
};

/**
 * Retorna a segunda-feira da semana ISO de uma data.
 */
const getISOWeekMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Gera a chave de período para um trade.
 * - Diário: 'YYYY-MM-DD'
 * - Semanal: 'YYYY-MM-DD' (segunda-feira da semana, truncada no boundary do ciclo)
 *
 * @param {string} tradeDate - 'YYYY-MM-DD'
 * @param {string} operationPeriod - 'Diário' | 'Semanal'
 * @param {Date} cycleStart - Início do ciclo (para truncar semanas no boundary)
 * @param {Date} cycleEnd - Fim do ciclo (para truncar semanas no boundary)
 * @returns {string} periodKey
 */
export const getPeriodKey = (tradeDate, operationPeriod, cycleStart, cycleEnd) => {
  if (operationPeriod === 'Diário') {
    return tradeDate; // 'YYYY-MM-DD'
  }

  // Semanal: agrupar por segunda-feira, mas truncar no boundary do ciclo
  const tradeDateObj = new Date(tradeDate + 'T12:00:00'); // noon to avoid TZ issues
  const monday = getISOWeekMonday(tradeDateObj);

  // Se a segunda-feira é anterior ao início do ciclo, usar o início do ciclo como chave
  if (monday < cycleStart) {
    return formatDateKey(cycleStart);
  }

  return formatDateKey(monday);
};

/**
 * Formata Date como 'YYYY-MM-DD'
 */
const formatDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Verifica se um trade pertence a um ciclo específico.
 */
const isTradeInCycle = (tradeDate, cycleStart, cycleEnd) => {
  const d = new Date(tradeDate + 'T12:00:00');
  return d >= cycleStart && d <= cycleEnd;
};

// ============================================
// CORE — Period State Machine
// ============================================

/**
 * Processa trades de um período e retorna estado + classificação por trade.
 *
 * @param {Array} trades - Trades do período, já ordenados ASC (date → entryTime)
 * @param {number} goalVal - Valor absoluto da meta do período (R$)
 * @param {number} stopVal - Valor absoluto do stop do período (R$)
 * @returns {Object} { status, rows[], events[], summary }
 */
export const computePeriodState = (trades, goalVal, stopVal) => {
  const rows = [];
  const events = [];
  let cumPnL = 0;
  let currentStatus = PERIOD_STATES.IN_PROGRESS;

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const result = Number(trade.result) || 0;
    const prevCumPnL = cumPnL;
    cumPnL += result;

    let tradeEvent = null;

    // Classificação do trade
    if (currentStatus === PERIOD_STATES.GOAL_HIT || currentStatus === PERIOD_STATES.POST_GOAL) {
      // Qualquer trade após GOAL_HIT é POST_GOAL
      tradeEvent = PERIOD_STATES.POST_GOAL;
      currentStatus = PERIOD_STATES.POST_GOAL;
    } else if (currentStatus === PERIOD_STATES.STOP_HIT || currentStatus === PERIOD_STATES.POST_STOP) {
      // Qualquer trade após STOP_HIT é POST_STOP
      tradeEvent = PERIOD_STATES.POST_STOP;
      currentStatus = PERIOD_STATES.POST_STOP;
    } else {
      // IN_PROGRESS — checar transições
      if (goalVal > 0 && cumPnL >= goalVal) {
        tradeEvent = PERIOD_STATES.GOAL_HIT;
        currentStatus = PERIOD_STATES.GOAL_HIT;
        events.push({
          type: 'GOAL_HIT',
          tradeIndex: i,
          tradeId: trade.id,
          cumPnL,
          timestamp: trade.entryTime || trade.date,
        });
      } else if (stopVal > 0 && cumPnL <= -stopVal) {
        tradeEvent = PERIOD_STATES.STOP_HIT;
        currentStatus = PERIOD_STATES.STOP_HIT;
        events.push({
          type: 'STOP_HIT',
          tradeIndex: i,
          tradeId: trade.id,
          cumPnL,
          timestamp: trade.entryTime || trade.date,
        });
      } else {
        tradeEvent = PERIOD_STATES.IN_PROGRESS;
      }
    }

    rows.push({
      tradeId: trade.id,
      tradeIndex: i,
      result,
      cumPnL,
      prevCumPnL,
      periodEvent: tradeEvent,
      trade, // referência completa para UI
    });
  }

  // Resultado pré-evento e pós-evento
  const eventIndex = events.length > 0 ? events[0].tradeIndex : -1;
  const preEventPnL = eventIndex >= 0
    ? rows.slice(0, eventIndex + 1).reduce((s, r) => s + r.result, 0)
    : cumPnL;
  const postEventPnL = eventIndex >= 0
    ? rows.slice(eventIndex + 1).reduce((s, r) => s + r.result, 0)
    : 0;
  const postEventCount = eventIndex >= 0
    ? rows.length - (eventIndex + 1)
    : 0;

  return {
    status: currentStatus,
    rows,
    events,
    summary: {
      tradesCount: trades.length,
      totalPnL: cumPnL,
      preEventPnL,
      postEventPnL,
      postEventCount,
      goalVal,
      stopVal,
      goalPercent: goalVal > 0 ? (cumPnL / goalVal) * 100 : 0,
      stopPercent: stopVal > 0 && cumPnL < 0 ? (Math.abs(cumPnL) / stopVal) * 100 : 0,
    },
  };
};

// ============================================
// CORE — Cycle Aggregator
// ============================================

/**
 * Função principal: computa estado completo do plano.
 *
 * @param {Array} trades - Todos os trades do plano (qualquer ordem)
 * @param {Object} planConfig - {
 *   pl, periodGoal, periodStop, cycleGoal, cycleStop,
 *   operationPeriod ('Diário'|'Semanal'),
 *   adjustmentCycle ('Mensal'|'Trimestral')
 * }
 * @param {Object} [options] - {
 *   targetDate?: Date - data de referência (default: now),
 *   targetCycle?: { start: Date, end: Date } - ciclo específico
 * }
 *
 * @returns {Object} Estado completo (shape compatível com futuro cycleClosures doc)
 * {
 *   cycleKey: string,
 *   cycleStart: string (ISO),
 *   cycleEnd: string (ISO),
 *   cycleState: { status, periods: Map<periodKey, periodState>, summary },
 *   currentPeriodKey: string | null,
 *   availablePeriods: string[],
 *   planConfig: { ...snapshot },
 *   computedAt: string (ISO),
 *   // Futuro (Épico Kelly/Monte Carlo): kelly, monteCarlo, reallocation
 * }
 */
export const computePlanState = (trades, planConfig, options = {}) => {
  const {
    pl = 0,
    periodGoal = 0,
    periodStop = 0,
    cycleGoal = 0,
    cycleStop = 0,
    operationPeriod = 'Diário',
    adjustmentCycle = 'Mensal',
  } = planConfig;

  // Valores absolutos (R$) das metas/stops
  const periodGoalVal = pl * (periodGoal / 100);
  const periodStopVal = pl * (periodStop / 100);
  const cycleGoalVal = pl * (cycleGoal / 100);
  const cycleStopVal = pl * (cycleStop / 100);

  // Determinar ciclo alvo
  const refDate = options.targetDate || new Date();
  const cycleStart = options.targetCycle?.start || getCycleStartDate(adjustmentCycle, refDate);
  const cycleEnd = options.targetCycle?.end || getCycleEndDate(adjustmentCycle, refDate);

  // Filtrar trades do ciclo
  const cycleTrades = trades
    .filter(t => t.date && isTradeInCycle(t.date, cycleStart, cycleEnd))
    .sort((a, b) => {
      // Sort ASC: date → entryTime → createdAt
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.entryTime || '';
      const timeB = b.entryTime || '';
      if (timeA && timeB) return timeA.localeCompare(timeB);
      const caA = a.createdAt?.toDate?.()?.toISOString?.() || a.createdAt || '';
      const caB = b.createdAt?.toDate?.()?.toISOString?.() || b.createdAt || '';
      return caA.toString().localeCompare(caB.toString());
    });

  // Agrupar trades por período
  const periodMap = new Map(); // periodKey → trades[]

  for (const trade of cycleTrades) {
    const key = getPeriodKey(trade.date, operationPeriod, cycleStart, cycleEnd);
    if (!periodMap.has(key)) {
      periodMap.set(key, []);
    }
    periodMap.get(key).push(trade);
  }

  // Computar estado de cada período
  const periods = new Map(); // periodKey → periodState
  let cycleCumPnL = 0;
  let cycleStatus = PERIOD_STATES.IN_PROGRESS;
  const cycleEvents = [];

  // Iterar períodos em ordem cronológica
  const sortedPeriodKeys = [...periodMap.keys()].sort();

  for (const periodKey of sortedPeriodKeys) {
    const periodTrades = periodMap.get(periodKey);
    const periodState = computePeriodState(periodTrades, periodGoalVal, periodStopVal);
    periods.set(periodKey, periodState);

    // Acumular para o ciclo
    const periodPnL = periodState.summary.totalPnL;
    const prevCycleCumPnL = cycleCumPnL;
    cycleCumPnL += periodPnL;

    // Checar transições do ciclo
    if (cycleStatus === PERIOD_STATES.IN_PROGRESS) {
      if (cycleGoalVal > 0 && cycleCumPnL >= cycleGoalVal) {
        cycleStatus = PERIOD_STATES.GOAL_HIT;
        cycleEvents.push({
          type: 'CYCLE_GOAL_HIT',
          periodKey,
          cycleCumPnL,
        });
      } else if (cycleStopVal > 0 && cycleCumPnL <= -cycleStopVal) {
        cycleStatus = PERIOD_STATES.STOP_HIT;
        cycleEvents.push({
          type: 'CYCLE_STOP_HIT',
          periodKey,
          cycleCumPnL,
        });
      }
    }
    // Nota: ciclo não tem POST_GOAL/POST_STOP por período — isso é granularidade do período
  }

  // Determinar período atual
  const today = formatDateKey(refDate);
  const currentPeriodKey = sortedPeriodKeys.includes(today)
    ? today
    : operationPeriod === 'Semanal'
      ? sortedPeriodKeys.find(k => {
          // Para semanal, verificar se hoje está dentro da semana do período
          const periodStart = new Date(k + 'T00:00:00');
          const periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 6);
          return refDate >= periodStart && refDate <= periodEnd;
        }) || sortedPeriodKeys[sortedPeriodKeys.length - 1] || null
      : sortedPeriodKeys[sortedPeriodKeys.length - 1] || null;

  // Cycle summary
  const cycleSummary = {
    tradesCount: cycleTrades.length,
    periodsCount: sortedPeriodKeys.length,
    totalPnL: cycleCumPnL,
    goalVal: cycleGoalVal,
    stopVal: cycleStopVal,
    goalPercent: cycleGoalVal > 0 ? (cycleCumPnL / cycleGoalVal) * 100 : 0,
    stopPercent: cycleStopVal > 0 && cycleCumPnL < 0 ? (Math.abs(cycleCumPnL) / cycleStopVal) * 100 : 0,
    pl,
  };

  return {
    cycleKey: formatDateKey(cycleStart),
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
    cycleState: {
      status: cycleStatus,
      periods,
      events: cycleEvents,
      summary: cycleSummary,
    },
    currentPeriodKey,
    availablePeriods: sortedPeriodKeys,
    planConfig: {
      pl,
      periodGoal,
      periodStop,
      cycleGoal,
      cycleStop,
      operationPeriod,
      adjustmentCycle,
    },
    computedAt: new Date().toISOString(),
    // Reservado para Épico Kelly/Monte Carlo:
    // kelly: null,
    // monteCarlo: null,
    // reallocation: null,
  };
};

// ============================================
// HELPERS — Badge Classification
// ============================================

/**
 * Classifica o estado final de um período para badge visual.
 * Lógica extraída do PlanCardGrid para reuso e testabilidade.
 *
 * @param {Object} periodState - Retorno de computePeriodState
 * @returns {Object} { badge, label, icon, colorClass, animate }
 */
export const classifyPeriodBadge = (periodState) => {
  const { status, summary } = periodState;
  const { totalPnL, postEventPnL, postEventCount } = summary;

  switch (status) {
    case PERIOD_STATES.IN_PROGRESS:
      return { badge: 'IN_PROGRESS', label: 'Em Andamento', icon: 'Activity', colorClass: 'slate', animate: false };

    case PERIOD_STATES.GOAL_HIT:
      // Meta batida, sem trades pós-meta
      return { badge: 'GOAL_DISCIPLINED', label: 'Meta Batida', icon: 'Check', colorClass: 'emerald', animate: false };

    case PERIOD_STATES.POST_GOAL:
      if (totalPnL >= summary.goalVal) {
        // Pós-meta mas ainda em gain
        return { badge: 'POST_GOAL_GAIN', label: 'Pós-Meta (Gain)', icon: 'TrendingUp', colorClass: 'amber', animate: false };
      }
      if (totalPnL <= 0 && summary.stopVal > 0 && Math.abs(totalPnL) >= summary.stopVal) {
        // Devolveu tudo e atingiu stop — catástrofe
        return { badge: 'GOAL_TO_STOP', label: 'Catástrofe', icon: 'Skull', colorClass: 'red', animate: true };
      }
      // Devolveu parcial ou total da meta
      return { badge: 'POST_GOAL_LOSS', label: 'Devolveu Meta', icon: 'TrendingDown', colorClass: 'amber', animate: false };

    case PERIOD_STATES.STOP_HIT:
      // Stop atingido, sem trades pós-stop
      return { badge: 'STOP_HIT', label: 'Stop Atingido', icon: 'AlertTriangle', colorClass: 'red', animate: true };

    case PERIOD_STATES.POST_STOP:
      if (totalPnL >= 0) {
        // Recuperou do stop — sorte/habilidade
        return { badge: 'LOSS_TO_GOAL', label: 'Recuperação', icon: 'Trophy', colorClass: 'amber', animate: false };
      }
      // Piorou após stop
      return { badge: 'STOP_WORSENED', label: 'Stop Violado', icon: 'Skull', colorClass: 'red', animate: true };

    default:
      return { badge: 'UNKNOWN', label: '-', icon: 'Meh', colorClass: 'slate', animate: false };
  }
};

/**
 * Retorna o ícone de sentimento baseado no estado da máquina + P&L.
 * Evolui a caretinha simples (Smile/Frown/Meh) para usar estados.
 *
 * @param {string|null} periodStatus - Estado do período (da state machine), ou null se não calculado
 * @param {number} pnl - P&L do período
 * @returns {Object} { icon: string, colorClass: string }
 */
export const getSentimentFromState = (periodStatus, pnl) => {
  if (!periodStatus) {
    // Fallback: comportamento legacy
    if (pnl > 0) return { icon: 'Smile', colorClass: 'text-emerald-400' };
    if (pnl < 0) return { icon: 'Frown', colorClass: 'text-red-400' };
    return { icon: 'Meh', colorClass: 'text-slate-400' };
  }

  switch (periodStatus) {
    case PERIOD_STATES.GOAL_HIT:
      return { icon: 'Trophy', colorClass: 'text-yellow-400' };
    case PERIOD_STATES.POST_GOAL:
      return { icon: 'TrendingUp', colorClass: 'text-amber-400' };
    case PERIOD_STATES.STOP_HIT:
    case PERIOD_STATES.POST_STOP:
      return { icon: 'Skull', colorClass: 'text-red-400' };
    case PERIOD_STATES.IN_PROGRESS:
    default:
      if (pnl > 0) return { icon: 'Smile', colorClass: 'text-emerald-400' };
      if (pnl < 0) return { icon: 'Frown', colorClass: 'text-red-400' };
      return { icon: 'Meh', colorClass: 'text-slate-400' };
  }
};
