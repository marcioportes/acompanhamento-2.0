/**
 * swotHeuristics.js — IA stub heurístico (SWOT auto-fill)
 *
 * Pure function consumida pela etapa 4 (Map) do wizard. Gera sugestões para
 * cada um dos 4 quadrantes (S/W/O/T) a partir de números + padrões comportamentais.
 *
 * Issue #259 R2: as heurísticas passaram a consultar `patterns.eventCounts`
 * e `snapshot.stopBreach`. Sem isso, ciclos com violação de stop e tilt sistêmico
 * caíam como "limpos" porque buildOpportunities/Threats só olhavam métricas
 * quantitativas (MEP gap, loss streak, DD%).
 *
 * Regras:
 *
 * STRENGTHS (sustain — só com sinal positivo MEDIDO):
 *   - bestTradeR ≥ 1.5R
 *   - profitFactor ≥ 2
 *   - ruleAdherenceRate ≥ 0.95
 *   - winRate ≥ 0.5 E expectancy_R > 0 E zero violações graves
 *   - sequência de N≥3 trades limpos com pnl ≥ 0
 *   - melhor dia limpo com pnl significativo
 *
 * WEAKNESSES:
 *   - worstTradeR ≤ -1.5R
 *   - topErrors (compliance violations)
 *   - avgWinR < 1
 *   - cada count > 0 do pattern.eventCounts vira weakness com texto sintomático
 *
 * OPPORTUNITIES:
 *   - dias limpos com saldo positivo (disciplina pré-trade existe)
 *   - setup com WR ≥ 70% (sistematizar)
 *   - melhor trade com MEP gap (saiu cedo)
 *
 * THREATS:
 *   - violação de stop com trades pós-breach (autodestrutivo)
 *   - tilt sistêmico (≥3 dias)
 *   - revenge trading (≥2 instâncias)
 *   - stop tampering (≥1 instância)
 *   - perda final > 1.5× stop planejado
 *   - loss streak ≥ 4
 *   - DD ≥ 70% do stop
 *
 * Output: { strengths, weaknesses, opportunities, threats }: string[]
 */

const MEP_GAP_THRESHOLD_R = 1.5;
const SETUP_WR_THRESHOLD = 0.70;
const SETUP_COUNT_MIN = 2;
const LOSS_STREAK_DANGER = 4;
const DD_RATIO_DANGER = 0.70;
const CLEAN_PNL_OPPORTUNITY_MIN = 1; // R$ — qualquer positivo já vale como oportunidade

export function computeTradeMEP_R(trade, R) {
  if (!trade || typeof R !== 'number' || R <= 0) return null;
  const { side, entry, mepPrice, menPrice, qty } = trade;
  if (typeof entry !== 'number' || typeof qty !== 'number') return null;

  if (side === 'LONG') {
    if (typeof mepPrice !== 'number') return null;
    return ((mepPrice - entry) * qty) / R;
  }
  if (side === 'SHORT') {
    if (typeof menPrice !== 'number') return null;
    return ((entry - menPrice) * qty) / R;
  }
  return null;
}

export function maxLossStreak(trades) {
  const list = Array.isArray(trades) ? trades : [];
  let max = 0;
  let cur = 0;
  for (const t of list) {
    if (typeof t?.result !== 'number') continue;
    if (t.result < 0) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

export function aggregateBySetup(trades) {
  const list = Array.isArray(trades) ? trades : [];
  const map = new Map();
  for (const t of list) {
    const setup = t?.setup;
    if (typeof setup !== 'string' || setup.length === 0) continue;
    if (!map.has(setup)) map.set(setup, { setup, count: 0, wins: 0 });
    const entry = map.get(setup);
    entry.count++;
    if (typeof t.result === 'number' && t.result > 0) entry.wins++;
  }
  return [...map.values()].map((e) => ({ ...e, winRate: e.wins / e.count }));
}

/**
 * STRENGTHS — sustain só com sinal positivo medido.
 *
 * @param {Object} input
 * @param {Object} input.metrics
 * @param {Object} input.patterns   — { eventCounts, dayBreakdown, topErrors }
 * @param {Object} input.snapshot   — { stopBreach }
 */
export function buildStrengths({ metrics, patterns, snapshot }) {
  const out = [];
  const counts = patterns?.eventCounts || {};
  const breach = snapshot?.stopBreach;

  // Aderência alta SÓ vira sustain se também não houver sinal comportamental ruim:
  // stop tampering / revenge / tilt durante trade significam que a "regra escrita" foi
  // respeitada mas a execução não foi disciplinada — não dá pra sustentar.
  const hasBehavioralRedFlag =
    (counts.stopTampering || 0) > 0 ||
    (counts.revenge || 0) > 0 ||
    (counts.tilt || 0) > 0;
  if (
    typeof metrics?.ruleAdherenceRate === 'number' && metrics.ruleAdherenceRate >= 0.95 &&
    (!breach || breach.stopBreachIndex === -1 || breach.tradesAfterStop === 0) &&
    !hasBehavioralRedFlag
  ) {
    out.push(
      `Aderência ${(metrics.ruleAdherenceRate * 100).toFixed(0)}% — disciplina pré-trade firme`,
    );
  }

  // Profit factor sólido
  if (typeof metrics?.profitFactor === 'number' && metrics.profitFactor >= 2) {
    out.push(
      `Cada R$1 perdido foi compensado por R$${metrics.profitFactor.toFixed(2)} ganho — vantagem sustentada`,
    );
  }

  // Best trade R alto (saída boa)
  if (typeof metrics?.bestTradeR === 'number' && metrics.bestTradeR >= 1.5) {
    out.push(
      `Melhor trade rendeu ${metrics.bestTradeR.toFixed(1)}R — entender a configuração e replicar`,
    );
  }

  // Expectancy + winRate medidos (não inferidos)
  if (
    typeof metrics?.winRate === 'number' && metrics.winRate >= 0.5 &&
    typeof metrics?.expectancy_R === 'number' && metrics.expectancy_R > 0 &&
    (counts.tilt || 0) === 0 && (counts.revenge || 0) === 0 && (counts.stopTampering || 0) === 0
  ) {
    out.push(
      `Win rate ${(metrics.winRate * 100).toFixed(0)}% com expectancy +${metrics.expectancy_R.toFixed(2)}R — edge real no ciclo`,
    );
  }

  // Melhor dia limpo com pnl positivo significativo (sinal de capacidade quando calmo)
  const bestClean = patterns?.dayBreakdown?.bestCleanDay;
  if (bestClean && typeof bestClean.pnl === 'number' && bestClean.pnl >= CLEAN_PNL_OPPORTUNITY_MIN) {
    out.push(
      `Em ${bestClean.date}, sem tilt/vingança: +R$${bestClean.pnl.toFixed(0)} em ${bestClean.trades} trade(s). A versão sob controle existe.`,
    );
  }

  return out;
}

/**
 * WEAKNESSES — cada padrão detectado vira weakness sintomática.
 */
export function buildWeaknesses({ metrics, patterns, snapshot }) {
  const out = [];
  const counts = patterns?.eventCounts || {};
  const breach = snapshot?.stopBreach;

  if (typeof metrics?.worstTradeR === 'number' && metrics.worstTradeR <= -1.5) {
    out.push(
      `Pior trade perdeu ${Math.abs(metrics.worstTradeR).toFixed(1)}R — extrapolou o limite de risco`,
    );
  }
  if (Array.isArray(patterns?.topErrors) && patterns.topErrors.length > 0) {
    out.push(`Quebras de regra recorrentes: ${patterns.topErrors.join(', ')}`);
  }
  if (typeof metrics?.avgWinR === 'number' && metrics.avgWinR > 0 && metrics.avgWinR < 1) {
    out.push(
      `Ganho médio nas vitórias (${metrics.avgWinR.toFixed(2)}R) abaixo de 1R — saindo cedo dos vencedores`,
    );
  }
  if (typeof metrics?.profitFactor === 'number' && metrics.profitFactor < 1) {
    out.push(
      `Profit factor ${metrics.profitFactor.toFixed(2)} (< 1) — soma das perdas maior que dos ganhos no ciclo`,
    );
  }
  if (typeof metrics?.ruleAdherenceRate === 'number' && metrics.ruleAdherenceRate < 0.9) {
    out.push(
      `Aderência ${(metrics.ruleAdherenceRate * 100).toFixed(0)}% — abaixo da banda saudável (≥ 90%)`,
    );
  }

  // Sintomas comportamentais (espelham B2 mas em primeira pessoa)
  if (breach && breach.stopBreachIndex !== -1 && breach.tradesAfterStop > 0) {
    out.push(
      `Continuou operando +${breach.tradesAfterStop} trade(s) depois do stop do ciclo — protocolo de cap violado`,
    );
  }
  if ((counts.tilt || 0) > 0) {
    out.push(
      `${counts.tilt} evento(s) de tilt em ${counts.tiltDaysCount || 0} dia(s) — emoção dominou execução`,
    );
  }
  if ((counts.revenge || 0) > 0) {
    out.push(
      `${counts.revenge} instância(s) de vingança detectada(s) — loss-chasing virou padrão`,
    );
  }
  if ((counts.overtrading || 0) > 0) {
    out.push(
      `${counts.overtrading} dia(s) com excesso de trades — sobre-exposição operacional`,
    );
  }
  if ((counts.stopTampering || 0) > 0) {
    out.push(
      `Stop deslocado durante trade ${counts.stopTampering}× — compromisso pré-trade quebrado na execução`,
    );
  }

  return out;
}

/**
 * OPPORTUNITIES — onde o trader pode crescer.
 */
export function buildOpportunities({ trades, R, patterns }) {
  const out = [];
  const list = Array.isArray(trades) ? trades : [];

  // Dias limpos com saldo positivo (capacidade já existe, falta consistência)
  const cleanDays = patterns?.dayBreakdown?.cleanDays || [];
  const cleanPositive = cleanDays.filter((d) => d.pnl > 0);
  if (cleanPositive.length >= 2) {
    const totalPnl = cleanPositive.reduce((s, d) => s + d.pnl, 0);
    out.push(
      `Em ${cleanPositive.length} dia(s) sem tilt/vingança o saldo foi +R$${totalPnl.toFixed(0)}. ` +
      `A disciplina pré-trade existe nesses dias — a oportunidade é manter o mesmo estado nos demais.`,
    );
  }

  // Sequência limpa antes do colapso (se houver breach)
  const breach = patterns?.stopBreach;
  if (breach && breach.stopBreachIndex > 2) {
    out.push(
      `Antes do colapso, ${breach.stopBreachIndex} trade(s) operados dentro do plano. ` +
      `Ali estava a melhor versão sua — a oportunidade é parar nesse ponto, não passar dele.`,
    );
  }

  // Best trade saiu cedo (MEP gap)
  if (typeof R === 'number' && R > 0) {
    let bestExitR = -Infinity;
    let bestTrade = null;
    for (const t of list) {
      if (typeof t?.result !== 'number') continue;
      const exitR = t.result / R;
      if (exitR > bestExitR) {
        bestExitR = exitR;
        bestTrade = t;
      }
    }
    if (bestTrade) {
      const mepR = computeTradeMEP_R(bestTrade, R);
      if (typeof mepR === 'number' && mepR - bestExitR > MEP_GAP_THRESHOLD_R) {
        out.push(
          `Trade ${bestTrade.id || 'top'} tinha MEP de ${mepR.toFixed(1)}R mas saiu em ` +
          `${bestExitR.toFixed(1)}R. Padrão: saiu cedo de vencedor — considere alvo escalonado.`,
        );
      }
    }
  }

  // Setup recurrent com WR alto
  const setupAgg = aggregateBySetup(list);
  for (const s of setupAgg) {
    if (s.count >= SETUP_COUNT_MIN && s.winRate >= SETUP_WR_THRESHOLD) {
      out.push(
        `Setup ${s.setup} teve WR ${(s.winRate * 100).toFixed(0)}% ` +
        `(n=${s.count}). Pode sistematizar como entrada principal.`,
      );
    }
  }

  return out;
}

/**
 * THREATS — riscos que merecem auto-defesa no próximo ciclo.
 */
export function buildThreats({ trades, maxDDPercent, cycleStopPercent, patterns, snapshot }) {
  const out = [];
  const list = Array.isArray(trades) ? trades : [];
  const counts = patterns?.eventCounts || {};
  const breach = snapshot?.stopBreach || patterns?.stopBreach;

  // 1. Violação de stop com trades pós-breach — sinal autodestrutivo prioritário
  if (breach && breach.stopBreachIndex !== -1 && breach.tradesAfterStop > 0) {
    const sev = breach.severity;
    out.push(
      `Violação de stop do ciclo: continuou operando +${breach.tradesAfterStop} trade(s) após o cap. ` +
      (sev === 'critical'
        ? `Perda final ${breach.pnlPctOfStop?.toFixed(1)}× o stop planejado — padrão de blow-up.`
        : sev === 'major'
          ? `Padrão autodestrutivo confirmado — risco de blow-up no próximo ciclo se repetir.`
          : `Disciplina de cap quebrada — gate de auto-bloqueio reduziria reincidência.`),
    );
  }

  // 2. Tilt sistêmico
  if ((counts.tiltDaysCount || 0) >= 3) {
    const dirtyPnl = patterns?.correlation?.performanceOnTiltDays;
    const cleanPnl = patterns?.correlation?.performanceOnCleanDays;
    const dirtyStr = typeof dirtyPnl === 'number' ? `R$${dirtyPnl.toFixed(0)}` : '—';
    const cleanStr = typeof cleanPnl === 'number' ? `R$${cleanPnl.toFixed(0)}` : '—';
    out.push(
      `Tilt sistêmico em ${counts.tiltDaysCount} dia(s). Performance em dias-tilt: ${dirtyStr} vs limpos ${cleanStr}.`,
    );
  }

  // 3. Revenge / loss-chasing
  if ((counts.revenge || 0) >= 2) {
    out.push(
      `Loss-chasing detectado em ${counts.revenge} instância(s). ` +
      `Vingança vs mercado é o padrão clássico de blow-up — hard stop após 3 losses corta o ciclo.`,
    );
  }

  // 4. Stop tampering
  if ((counts.stopTampering || 0) >= 1) {
    out.push(
      `Stop deslocado durante trade ${counts.stopTampering}× — quando o limite muda no calor, o plano deixa de existir.`,
    );
  }

  // 5. Reentrada pós-stop / chase
  if ((counts.rapidReentry || 0) >= 1) {
    out.push(
      `${counts.rapidReentry} reentrada(s) rápida(s) pós-stop — entrada não nasceu de setup, nasceu de necessidade emocional.`,
    );
  }

  // 6. Perda final muito além do cap
  const resultPct = snapshot?.resultPercent;
  if (
    typeof resultPct === 'number' && resultPct < 0 &&
    typeof cycleStopPercent === 'number' && cycleStopPercent > 0 &&
    Math.abs(resultPct) >= 1.5 * cycleStopPercent
  ) {
    out.push(
      `Perda final ${Math.abs(resultPct).toFixed(1)}% = ${(Math.abs(resultPct) / cycleStopPercent).toFixed(1)}× o stop planejado (${cycleStopPercent}%). ` +
      `Sistema de gestão de risco falhou — reestruturação é mandatória antes de continuar.`,
    );
  }

  // 7. Loss streak
  const streak = maxLossStreak(list);
  if (streak >= LOSS_STREAK_DANGER) {
    out.push(
      `Sequência de ${streak} losses consecutivos. Pausa após 3 losses (gate disciplinar) cortaria isso pela metade.`,
    );
  }

  // 8. DD próximo do stop (margem fina) — só renderiza se NÃO houve breach (senão é redundância)
  if (
    (!breach || breach.stopBreachIndex === -1) &&
    typeof maxDDPercent === 'number' && typeof cycleStopPercent === 'number' && cycleStopPercent > 0
  ) {
    const ddAbs = Math.abs(maxDDPercent);
    const stopDec = cycleStopPercent / 100;
    if (ddAbs > DD_RATIO_DANGER * stopDec) {
      out.push(
        `Drawdown chegou a ${(ddAbs * 100).toFixed(1)}% (próximo do stop ${cycleStopPercent}%). ` +
        `Margem fina — single trade ruim consome o ciclo.`,
      );
    }
  }

  return out;
}

/**
 * Conveniência: gera todos os quadrantes.
 */
export function buildSWOT({ trades, R, maxDDPercent, cycleStopPercent, metrics, patterns, snapshot }) {
  return {
    strengths: buildStrengths({ metrics, patterns, snapshot }),
    weaknesses: buildWeaknesses({ metrics, patterns, snapshot }),
    opportunities: buildOpportunities({ trades, R, patterns }),
    threats: buildThreats({ trades, maxDDPercent, cycleStopPercent, patterns, snapshot }),
  };
}

export const SWOT_THRESHOLDS = Object.freeze({
  MEP_GAP_THRESHOLD_R,
  SETUP_WR_THRESHOLD,
  SETUP_COUNT_MIN,
  LOSS_STREAK_DANGER,
  DD_RATIO_DANGER,
  CLEAN_PNL_OPPORTUNITY_MIN,
});
