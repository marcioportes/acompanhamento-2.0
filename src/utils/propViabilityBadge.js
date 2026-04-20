/**
 * propViabilityBadge — lógica pura de classificação de viabilidade do plano mecânico
 * @description Recebe output do `calculateAttackPlan()` + fase e retorna estado do badge.
 *   6 estados: VIÁVEL_CONFORTÁVEL, VIÁVEL_APERTADO, VIÁVEL_RESTRITO,
 *   INVIÁVEL_STOP_RUÍDO, INVIÁVEL_RESTRIÇÃO_HARD, INVIÁVEL_ERRO.
 *   Texto phase-aware: EVALUATION enfatiza deadline; SIM_FUNDED/LIVE preservação.
 *
 * Ref: issue #145 Fase F, spec v2 §4.3 (6 estados mapeados contra attackPlanCalculator.js:200-425)
 */

export const VIABILITY_STATES = {
  CONFORTAVEL: 'CONFORTAVEL',
  APERTADO: 'APERTADO',
  RESTRITO: 'RESTRITO',
  STOP_RUIDO: 'STOP_RUIDO',
  RESTRICAO_HARD: 'RESTRICAO_HARD',
  ERRO: 'ERRO',
};

const PHASE_SUFFIX = {
  EVALUATION: (days) => (days ? `, com ${days} dias úteis para bater target` : ''),
  PA: () => ', sem deadline',
  SIM_FUNDED: () => ', foco em preservar capital fundado',
  LIVE: () => ', foco em preservar capital fundado',
};

function phaseSuffix(phase, plan) {
  const fn = PHASE_SUFFIX[phase];
  if (!fn) return '';
  return fn(plan?.evalBusinessDays);
}

/**
 * Classifica viabilidade do plano.
 * @param {object|null} plan - output do calculateAttackPlan (pode ser null)
 * @param {string} phase - EVALUATION | PA | SIM_FUNDED | LIVE
 * @returns {{state, color, text, recommendation}}
 */
export function classifyViability(plan, phase = 'EVALUATION') {
  if (!plan) {
    return {
      state: VIABILITY_STATES.ERRO,
      color: 'gray',
      text: 'Plano mecânico não calculado',
      recommendation: 'Selecione instrumento e perfil de risco',
    };
  }

  if (plan.mode === 'error' || (plan.constraintsViolated ?? []).includes('instrument_not_found')) {
    return {
      state: VIABILITY_STATES.ERRO,
      color: 'gray',
      text: 'Instrumento não encontrado na tabela',
      recommendation: 'Selecione instrumento válido',
    };
  }

  const violated = plan.constraintsViolated ?? [];

  if (plan.incompatible && violated.includes('stop_below_min_viable')) {
    const stop = plan.stopPoints ?? 0;
    const minStop = plan.instrument?.minViableStop ?? 0;
    const micro = plan.microSuggestion;
    const microHint = micro ? ` Sugerido: ${micro}.` : '';
    return {
      state: VIABILITY_STATES.STOP_RUIDO,
      color: 'red',
      text: `Stop ${stop}pts < mínimo ${minStop}pts → ruído no instrumento.${microHint}`,
      recommendation: micro ? `Trocar para ${micro}` : 'Mudar perfil para RO maior',
    };
  }

  if (plan.incompatible && (violated.includes('stop_exceeds_ny_range') || violated.includes('ro_exceeds_daily_loss'))) {
    return {
      state: VIABILITY_STATES.RESTRICAO_HARD,
      color: 'red',
      text: `${plan.inviabilityReason ?? 'Plano não-operável'}`,
      recommendation: 'Mudar instrumento ou reduzir perfil de risco',
    };
  }

  // Não-inviável — classifica conforto
  const dailyStop = (plan.roPerTrade ?? 0) * (plan.maxTradesPerDay ?? 0);
  const lossesToBust = plan.lossesToBust ?? 0;
  const ev = plan.evPerTrade ?? 0;

  if (plan.sessionRestricted && plan.recommendedSessions?.length > 0) {
    const sessions = plan.recommendedSessions.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('/');
    return {
      state: VIABILITY_STATES.RESTRITO,
      color: 'orange',
      text: `Stop pequeno para sessão NY → operar em ${sessions}${phaseSuffix(phase, plan)}`,
      recommendation: `Priorizar sessões: ${sessions}`,
    };
  }

  // Mesa sem daily loss (ex: Apex PA, Ylos Funded) → métrica alternativa
  // Usa dailyStop / (drawdownMax × 0.30) — "fração da reserva saudável"
  const hasDailyLoss = typeof plan.dailyLossLimit === 'number' && plan.dailyLossLimit > 0;

  if (!hasDailyLoss) {
    const dd = plan.drawdownMax ?? 0;
    const roPerTrade = plan.roPerTrade ?? 0;
    const stopTxt = roPerTrade > 0 && dd > 0
      ? `Stop de ${plan.instrument?.symbol ? '' : ''}${formatUsd(roPerTrade)} em DD de ${formatUsd(dd)} · margem ${lossesToBust} perdas${phaseSuffix(phase, plan)}`
      : `Sem daily loss limit — plano depende só do drawdown total${phaseSuffix(phase, plan)}`;

    // Reserva saudável = 30% do drawdown total; se dailyStop consome >30% disso, alerta
    const reserve = dd * 0.30;
    const reservePct = reserve > 0 ? (dailyStop / reserve) : 0;

    if (lossesToBust >= 5 && ev > 0 && reservePct < 1) {
      return {
        state: VIABILITY_STATES.CONFORTAVEL,
        color: 'green',
        text: stopTxt,
        recommendation: null,
      };
    }
    if (lossesToBust >= 3 && ev >= 0) {
      return {
        state: VIABILITY_STATES.APERTADO,
        color: 'amber',
        text: stopTxt,
        recommendation: 'Revisar perfil — mesa sem daily loss exige preservação mais rígida',
      };
    }
    return {
      state: VIABILITY_STATES.APERTADO,
      color: 'amber',
      text: stopTxt,
      recommendation: 'Revisar perfil de risco',
    };
  }

  const stopPct = dailyStop / plan.dailyLossLimit;
  const stopPctRounded = Math.round(stopPct * 100);

  if (stopPct < 0.60 && lossesToBust >= 5 && ev > 0) {
    return {
      state: VIABILITY_STATES.CONFORTAVEL,
      color: 'green',
      text: `Plano consome ${stopPctRounded}% do daily loss → confortável${phaseSuffix(phase, plan)}`,
      recommendation: null,
    };
  }

  if (stopPct < 0.90 && lossesToBust >= 3 && ev >= 0) {
    return {
      state: VIABILITY_STATES.APERTADO,
      color: 'amber',
      text: `Plano consome ${stopPctRounded}% do daily loss → viável mas apertado, sem margem para erro${phaseSuffix(phase, plan)}`,
      recommendation: 'Revisar perfil ou aumentar consistency',
    };
  }

  // Default: entre 90%+ stopPct, OU lossesToBust <= 2, OU EV negativo
  return {
    state: VIABILITY_STATES.APERTADO,
    color: 'amber',
    text: `Plano consome ${stopPctRounded}% do daily loss → limite apertado, exposição alta${phaseSuffix(phase, plan)}`,
    recommendation: 'Revisar perfil de risco',
  };
}

function formatUsd(v) {
  if (typeof v !== 'number') return '—';
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
