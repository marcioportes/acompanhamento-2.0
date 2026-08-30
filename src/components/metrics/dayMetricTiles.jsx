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

/**
 * Render DENSO do período.
 *
 * O `MetricTile` de `cycleMetricTiles` usa `text-2xl` porque lá ele É o conteúdo
 * principal da tela (card de Consistência do ciclo). O período aparece como
 * CONTEXTO — acima do painel de um trade, ou no topo da lista do dia — e com
 * aquele peso dominava o layout. A SSoT preservada é a das funções de conteúdo
 * (valor, banda, legenda, tooltip); o que muda aqui é só a tipografia.
 */
export function DayTile({ label, value, theme, bandLabel, caption, tooltip, isInsufficient }) {
  return (
    <div className="min-w-0" title={tooltip}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium truncate">{label}</p>
      {isInsufficient ? (
        <p className="text-[11px] text-slate-500 leading-snug">{value}</p>
      ) : (
        <p className={`text-sm font-semibold font-mono leading-tight ${theme.text}`}>
          {value}
          {bandLabel && <span className="ml-1.5 text-[10px] font-sans font-normal opacity-70">{bandLabel}</span>}
        </p>
      )}
      {!isInsufficient && caption && (
        <p className="text-[10px] text-slate-600 leading-snug">{caption}</p>
      )}
    </div>
  );
}

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
  // Sem ordem confiável não há "na 2ª" nem "duas vieram depois": as duas frases
  // são predicados de SEQUÊNCIA. O fato do conjunto — ultrapassou, e por quanto —
  // não depende da ordem e continua dito.
  if (ps.ordering?.reliable === false) {
    return {
      value: ps.closedBeyondStop
        ? `Ultrapassado por ${money(ps.beyondStopBy, currency)}`
        : 'Atingido',
      theme: ps.closedBeyondStop ? RED : AMBER,
      caption: 'sequência não determinada',
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
  if (ps.ordering.reason === 'tied_instants') {
    return {
      text: 'operações no mesmo instante',
      tooltip: 'Duas ou mais operações deste período têm o mesmo horário de entrada, ao segundo. Os totais estão corretos, mas qual veio antes não se sabe — por isso a sequência não é afirmada.',
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
  // O que restava quando ESTA operação abriu depende de quais vieram antes. Com a
  // ordem em dúvida, apontar uma operação específica é sorteio — e sorteio que
  // acusa. O aviso da ordem (`dayOrderingNotice`) explica o silêncio.
  if (ps.ordering?.reliable === false) return null;

  if (row.authorization === 'APOS_STOP') {
    return {
      tone: 'alert',
      title: 'Aberta depois do stop do período',
      detail: `quando esta operação abriu, o período já acumulava ${money(row.cumBefore, currency)} contra um stop de ${money(ps.stopValue, currency)}.`,
    };
  }

  if (row.authorization === 'SEM_FOLGA') {
    // Marcio, 30/08: *"'orçamento' tá ruim — operação aberta sem previsão de stop"*.
    // É o nome certo do fato: o que restava até o stop do período não comportava o
    // stop desta operação. Se ela fosse até o stop, o período estourava.
    return {
      tone: 'warn',
      title: 'Aberta sem previsão de stop',
      detail: `quando esta operação abriu, restavam ${money(row.budgetBefore, currency)} até o stop do período, e o plano prevê ${money(ps.roValue, currency)} de risco por operação — o stop dela não cabia no que restava.`,
    };
  }

  return null; // AUTORIZADA não gera aviso — ausência de acusação é o normal
}

// ============================================================
// A posição DESTA operação dentro do período
// ============================================================

const ORDINAIS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
const ordinal = (i) => ORDINAIS[i] || `${i + 1}ª`;

/**
 * Onde esta operação cai no período, e em que estado o período estava quando ela
 * abriu.
 *
 * POR QUE ISTO E NÃO UM CARD DO DIA (#402):
 *   A tela de feedback é sobre UMA operação. Empilhar um painel do período acima
 *   dela dava os dois números sem ligar um ao outro: o dado do dia não ajudava a
 *   julgar o trade, só ocupava espaço e quebrava a atomicidade da tela. Em 71%
 *   dos dias da base há uma operação só, então o painel ainda repetia o mesmo
 *   resultado duas vezes.
 *
 *   Isto aqui é predicado sobre a OPERAÇÃO — posição na sequência e orçamento no
 *   instante da abertura. É o que torna o dado do período utilizável: dá para
 *   julgar a segunda entrada sabendo com quanta folga ela nasceu.
 *
 * HONESTIDADE SOBRE A SEQUÊNCIA:
 *   A ordinal só é afirmada quando `ordering.reliable`. Metade da base tem
 *   `entryTime` sem fuso, e a importação de ordens sem linha de evento cai no
 *   horário de CRIAÇÃO da ordem, não no fill. Onde a ordem foi inferida, dizer
 *   "2ª operação" seria afirmar o que não se pode provar — o mesmo defeito que
 *   este issue removeu.
 *
 * DISPLAY TRANSITÓRIO, POR CONTRATO: se o aluno lançar um trade retroativo do
 * mesmo dia, a posição muda. É correto que mude. O congelamento do que foi
 * conversado é papel da Revisão, não desta linha.
 *
 * @param {Object|null} row — linha de `periodState.rows` desta operação
 * @param {Object|null} ps  — PeriodState
 * @returns {{ text: string, tooltip: string }|null}
 */
export function tradePositionInPeriod(row, ps, currency = 'BRL') {
  if (!ps || !ps.count) return null;

  const periodo = ps.operationPeriod === 'Semanal' ? 'da semana' : 'do dia';
  const fechou = `O ${ps.operationPeriod === 'Semanal' ? 'período' : 'dia'} fechou em ${money(ps.net, currency)}`;
  const alem = ps.closedBeyondStop && ps.beyondStopBy != null
    ? ` — ${money(ps.beyondStopBy, currency)} além do stop`
    : '';
  const tooltip = 'Posição desta operação na sequência do período. Muda se um trade anterior for lançado depois — o registro definitivo do que foi conversado é a Revisão.';

  // Operação única: não repete o resultado, que é o do próprio trade.
  if (ps.count === 1) {
    const folga = row?.budgetBefore != null ? ` Abriu com ${money(row.budgetBefore, currency)} de folga.` : '';
    return { text: `Única operação ${periodo}.${folga}`, tooltip };
  }

  // Ordem inferida: não afirma posição.
  if (ps.ordering?.reliable === false) {
    const motivo = ps.ordering.reason === 'missing_entry_time'
      ? 'alguma operação deste dia não tem horário de entrada'
      : 'os horários deste dia estão em fusos diferentes';
    return {
      text: `Uma das ${ps.count} operações ${periodo} — ${motivo}, então a sequência foi inferida. ${fechou}${alem}.`,
      tooltip,
    };
  }

  if (!row || row.index == null) return null;

  const ultima = row.index === ps.count - 1;
  const posicao = ultima
    ? `${ordinal(row.index)} e última das ${ps.count} operações ${periodo}.`
    : `${ordinal(row.index)} das ${ps.count} operações ${periodo}.`;

  let abertura = '';
  if (row.index === 0 && row.budgetBefore != null) {
    abertura = ` Abriu com o limite ${periodo} inteiro disponível — ${money(row.budgetBefore, currency)} de folga.`;
  } else if (row.budgetBefore != null) {
    abertura = ` Quando abriu, o ${ps.operationPeriod === 'Semanal' ? 'período' : 'dia'} estava em ${money(row.cumBefore, currency)} e restavam ${money(row.budgetBefore, currency)} de folga.`;
  }

  return { text: `${posicao}${abertura} ${fechou}${alem}.`, tooltip };
}
