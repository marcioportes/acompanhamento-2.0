/**
 * dayMetricTiles.jsx — issue #402
 *
 * SSoT de tiles do PERÍODO (dia ou semana), no mesmo contrato de
 * `cycleMetricTiles.jsx`: funções de conteúdo PURAS
 * `(periodState, ...) → { value, theme, bandLabel, caption, tooltip }`,
 * renderizadas pelo `MetricTile` já existente — que é importado daqui, não
 * recriado.
 *
 * POR QUE EXISTE:
 *   O produto não tinha lugar para o fato do DIA. O único "resultado do dia" era
 *   um bloco inline no StudentDashboard, sem risco, sem stop, sem teste — e o
 *   stop do período aparecia como acusação dentro de um TRADE. O dia agora tem
 *   superfície própria: ele DECLARA o que aconteceu, e não acusa ninguém.
 *
 * REGRA DE PRECISÃO (a que originou o "1.7% excede 1.67%"):
 *   Casas decimais do display = casas do limiar, mínimo 2. E dinheiro antes de
 *   percentual em toda linha primária — `R$ 515 de R$ 501` não tem artefato de
 *   arredondamento, `1,7%` contra `1,67%` tem.
 *
 * @see src/utils/dayState.js — de onde vem o PeriodState
 * @see src/components/metrics/cycleMetricTiles.jsx — o contrato que este arquivo segue
 */
import { formatCurrencyDynamic } from '../../utils/currency';
import { MetricTile } from './cycleMetricTiles';

export { MetricTile };

const NEUTRAL = { text: 'text-slate-300', dot: 'bg-slate-500' };
const EMERALD = { text: 'text-emerald-400', dot: 'bg-emerald-400' };
const AMBER = { text: 'text-amber-400', dot: 'bg-amber-400' };
const ORANGE = { text: 'text-orange-400', dot: 'bg-orange-400' };
const RED = { text: 'text-red-400', dot: 'bg-red-400' };

const dec = (v, casas = 2) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Casas decimais que um limiar carrega — `1.67` → 2, `2` → 0. */
const casasDe = (limiar) => {
  if (limiar == null || !Number.isFinite(Number(limiar))) return 2;
  const s = String(limiar);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
};

/**
 * Percentual formatado na precisão do limiar contra o qual será lido.
 *
 * `pctVsPlan(1.7183, 1.67)` → `'1,72%'`. Com uma casa sairia `'1,7%'`, que ao
 * lado de `1,67%` lê como ruído de arredondamento em vez de uma diferença real.
 */
export function pctVsPlan(value, threshold) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${dec(value, Math.max(2, casasDe(threshold)))}%`;
}

const money = (v, currency) => (v == null ? '—' : formatCurrencyDynamic(v, currency));

// ============================================================
// Resultado do período — a manchete, e é LÍQUIDA
// ============================================================

export const DAY_RESULT_TOOLTIP =
  'Resultado líquido do período: ganhos e perdas somados. É este número que o stop do ' +
  'período governa — um dia que ganhou R$ 1.000 e perdeu R$ 600 fechou em +R$ 400, não ' +
  'em "R$ 600 de perda".';

export function dayResultContent(ps, currency = 'BRL') {
  if (!ps || ps.count === 0) {
    return {
      value: 'Sem operações',
      theme: NEUTRAL,
      caption: null,
      tooltip: DAY_RESULT_TOOLTIP,
      isInsufficient: true,
    };
  }
  const theme = ps.net > 0 ? EMERALD : ps.net < 0 ? RED : NEUTRAL;
  const partes = [`${ps.count} ${ps.count === 1 ? 'trade' : 'trades'}`];
  if (ps.qty > 0) partes.push(`${dec(ps.qty, 0)} contratos`);
  // O bruto continua legível, subordinado ao líquido.
  if (ps.gains > 0 && ps.losses > 0) {
    partes.push(`+${money(ps.gains, currency)} · −${money(ps.losses, currency)}`);
  }
  return {
    value: money(ps.net, currency),
    theme,
    caption: partes.join(' · '),
    tooltip: DAY_RESULT_TOOLTIP,
  };
}

// ============================================================
// Folga do stop — quanto de orçamento o período ainda tinha
// ============================================================

export const DAY_BUDGET_TOOLTIP =
  'Quanto do orçamento de risco do período ainda restava ao final. O plano para o período ' +
  'num valor (stop) e autoriza um valor por operação (RO) — a divisão dos dois é quantas ' +
  'operações o plano comporta por período.';

export function dayBudgetContent(ps, currency = 'BRL') {
  if (!ps || ps.stopValue == null) {
    return {
      value: 'Plano sem stop de período',
      theme: NEUTRAL,
      caption: null,
      tooltip: DAY_BUDGET_TOOLTIP,
      isInsufficient: true,
    };
  }
  const restante = Math.max(0, ps.stopValue + Math.min(ps.net, 0));
  const fracao = restante / ps.stopValue;
  const theme = ps.closedBeyondStop ? RED : fracao <= 0.2 ? ORANGE : fracao <= 0.5 ? AMBER : EMERALD;

  const caption = ps.maxAuthorizedTrades != null
    ? (ps.maxAuthorizedTrades === 0
      ? 'o plano não autoriza nenhuma operação neste período'
      : `autoriza ${ps.maxAuthorizedTrades} ${ps.maxAuthorizedTrades === 1 ? 'operação' : 'operações'} por período`)
    : null;

  return {
    value: `${money(restante, currency)} de ${money(ps.stopValue, currency)}`,
    theme,
    bandLabel: ps.closedBeyondStop ? 'Ultrapassado' : restante === 0 ? 'Esgotado' : 'No plano',
    caption,
    tooltip: DAY_BUDGET_TOOLTIP,
  };
}

// ============================================================
// Stop do período — atingido? ultrapassado? por quanto?
// ============================================================

export const DAY_STOP_TOOLTIP =
  'O stop do período é um limite de quanto o período pode perder no líquido. Ele é um fato ' +
  'DO PERÍODO: nenhuma operação isolada "viola" o stop do dia. O que uma operação pode ter ' +
  'feito de errado é ABRIR depois que o orçamento já tinha fechado.';

export function dayStopContent(ps, currency = 'BRL') {
  if (!ps || ps.stopValue == null) {
    return { value: '—', theme: NEUTRAL, caption: null, tooltip: DAY_STOP_TOOLTIP, isInsufficient: true };
  }
  if (!ps.closedBeyondStop && ps.stopHitIndex === null) {
    return {
      value: 'Não atingido',
      theme: EMERALD,
      caption: `limite de ${money(ps.stopValue, currency)}`,
      tooltip: DAY_STOP_TOOLTIP,
    };
  }
  const ordinal = ps.stopHitIndex != null ? `${ps.stopHitIndex + 1}ª` : null;
  const partes = [];
  if (ordinal) partes.push(`atingido na ${ordinal} operação`);
  if (ps.tradesAfterStop > 0) {
    partes.push(`${ps.tradesAfterStop} ${ps.tradesAfterStop === 1 ? 'operação aberta' : 'operações abertas'} depois`);
  } else {
    partes.push('nenhuma operação aberta depois');
  }

  return {
    value: ps.closedBeyondStop
      ? `Ultrapassado por ${money(ps.beyondStopBy, currency)}`
      : 'Atingido',
    theme: ps.tradesAfterStop > 0 ? RED : AMBER,
    bandLabel: ps.closedBeyondStop ? `de ${money(ps.stopValue, currency)}` : null,
    caption: partes.join(' · '),
    tooltip: DAY_STOP_TOOLTIP,
  };
}

// ============================================================
// Meta do período
// ============================================================

export const DAY_GOAL_TOOLTIP =
  'Meta do período, no líquido. Atingir a meta não obriga a parar — o registro existe para ' +
  'você ver depois quanto do resultado veio antes e quanto veio depois dela.';

export function dayGoalContent(ps, currency = 'BRL') {
  if (!ps || ps.goalValue == null) {
    return { value: '—', theme: NEUTRAL, caption: null, tooltip: DAY_GOAL_TOOLTIP, isInsufficient: true };
  }
  if (!ps.reachedGoal) {
    const falta = ps.goalValue - ps.net;
    return {
      value: 'Não atingida',
      theme: NEUTRAL,
      caption: `faltavam ${money(falta, currency)} para ${money(ps.goalValue, currency)}`,
      tooltip: DAY_GOAL_TOOLTIP,
    };
  }
  return {
    value: 'Atingida',
    theme: EMERALD,
    caption: `na ${ps.goalHitIndex + 1}ª operação · meta de ${money(ps.goalValue, currency)}`,
    tooltip: DAY_GOAL_TOOLTIP,
  };
}

// ============================================================
// Honestidade sobre a ordem
// ============================================================

/**
 * Aviso quando a ordem intradiária foi inferida. Declarar "2ª operação" sem
 * poder prová-lo é o mesmo tipo de afirmação sem lastro que o #402 elimina.
 *
 * @returns {{ text: string, tooltip: string }|null}
 */
export function dayOrderingNotice(ps) {
  if (!ps || ps.ordering?.reliable !== false) return null;
  if (ps.ordering.reason === 'missing_entry_time') {
    return {
      text: 'ordem do período inferida',
      tooltip: 'Alguma operação deste período não tem horário de entrada registrado, então a ordem entre elas foi inferida pela data. Os totais estão corretos; a sequência pode não estar.',
    };
  }
  return {
    text: 'horários com fusos diferentes',
    tooltip: 'Este período mistura operações com fuso registrado e sem fuso registrado. A ordem foi resolvida pelo instante absoluto, assumindo o fuso da bolsa para as que não o têm.',
  };
}

// ============================================================
// A linha da operação dentro do período — o que ELA decidiu
// ============================================================

/**
 * Texto factual sobre a autorização de uma operação. Fato atômico, mora no
 * painel do trade — nunca no card do período.
 *
 * @param {Object} row — linha de `periodState.rows`
 * @returns {{ tone: 'neutral'|'warn'|'alert', title: string, detail: string }|null}
 */
export function authorizationNotice(row, ps, currency = 'BRL') {
  if (!row?.authorization || !ps) return null;

  if (row.authorization === 'APOS_STOP') {
    return {
      tone: 'alert',
      title: 'Aberta depois do stop do período',
      detail: `quando esta operação abriu, o período já acumulava ${money(row.cumBefore, currency)} contra um stop de ${money(ps.stopValue, currency)}.`,
    };
  }

  if (row.authorization === 'SEM_FOLGA') {
    return {
      tone: 'warn',
      title: 'Aberta sem orçamento',
      detail: `quando esta operação abriu, restavam ${money(row.budgetBefore, currency)} de folga e o plano autoriza ${money(ps.roValue, currency)} por operação.`,
    };
  }

  return null; // AUTORIZADA não gera aviso — ausência de acusação é o normal
}
