/**
 * cycleMetricTiles.jsx — SSoT de apresentação de métricas de ciclo (issue #282)
 * @description Fonte única de tiles/bandas/tooltips de métricas de ciclo, consumida
 *   pelo card "Consistência Operacional" (dashboard, #235) E pelo wizard de
 *   Fechamento de Ciclo (#259). Elimina divergência de nomenclatura e cálculo:
 *   label TÉCNICO canônico + tooltip didático (DEC-AUTO-282-01).
 *
 *   Dois grupos:
 *   - CONSISTÊNCIA: Sharpe, CV norm., MEP médio, MEN médio (extraídos de #235).
 *   - PERFORMANCE: Expectancy (R), Win Rate, Payoff, Profit Factor, Max Drawdown,
 *     Aderência (content fns novas; cálculo vem de cycleMetrics/dashboardMetrics).
 *
 *   Funções de content são PURAS (entrada → { value, theme, bandLabel, caption,
 *   tooltip, badge, valueClassName }); MetricTile é o componente de render único.
 */
/* eslint-disable react/prop-types */

// ============================================================
// MetricTile — render único (label técnico + tooltip didático)
// ============================================================

export function MetricTile({ label, value, theme, bandLabel, badge, caption, tooltip, isInsufficient }) {
  return (
    <div className="flex flex-col gap-1.5" title={tooltip}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      {isInsufficient ? (
        <p className="text-xs text-slate-500 leading-snug min-h-[2.5rem]">{value}</p>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold font-mono leading-none ${theme.text}`}>{value}</span>
          <span className={`w-2 h-2 rounded-full ${theme.dot} self-center`} aria-hidden="true" />
        </div>
      )}
      {!isInsufficient && bandLabel && (
        <p className={`text-[10px] font-bold ${theme.text}`}>{bandLabel}</p>
      )}
      {!isInsufficient && caption && (
        <p className="text-[10px] text-slate-600">{caption}</p>
      )}
      {badge && <div className="flex">{badge}</div>}
    </div>
  );
}

// ============================================================
// Selic badge (Sharpe) — proveniência da taxa livre de risco
// ============================================================

const SELIC_BADGE_TOOLTIP_BCB =
  'Estamos descontando do seu retorno a Selic real de cada dia operado, conforme publicada pelo Banco Central. ' +
  'Isso responde: "o ganho que tive valeu a pena vs deixar parado rendendo Selic?".';
const SELIC_BADGE_TOOLTIP_FALLBACK =
  'A integração com a Selic histórica do Banco Central ainda está sendo configurada. ' +
  'Por enquanto estamos usando a estimativa atual (~14,75% ao ano) como referência de "deixar parado". ' +
  'Quando o histórico estiver pronto, o número usa a Selic real do dia — pode mudar levemente.';
const SELIC_BADGE_TOOLTIP_MIXED =
  'Parte do período usou Selic real do Banco Central e parte usou estimativa atual (gap em dias específicos). ' +
  'O cálculo continua válido — esse aviso só te informa da mistura.';

export function selicBadge(source) {
  if (source === 'BCB') {
    return (
      <span
        title={SELIC_BADGE_TOOLTIP_BCB}
        className="text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5"
      >
        Selic atual
      </span>
    );
  }
  if (source === 'FALLBACK') {
    return (
      <span
        title={SELIC_BADGE_TOOLTIP_FALLBACK}
        className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5"
      >
        Selic estimada
      </span>
    );
  }
  if (source === 'MIXED') {
    return (
      <span
        title={SELIC_BADGE_TOOLTIP_MIXED}
        className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5"
      >
        Selic mista
      </span>
    );
  }
  return null;
}

// ============================================================
// CONSISTÊNCIA — themes (faixas boa→ruim, #235)
// ============================================================

export function sharpeTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500', bandLabel: '' };
  if (value >= 2.0) return { text: 'text-emerald-400', dot: 'bg-emerald-400', bandLabel: 'Excepcional' };
  if (value >= 1.5) return { text: 'text-emerald-400', dot: 'bg-emerald-400', bandLabel: 'Bom' };
  if (value >= 1.0) return { text: 'text-amber-400', dot: 'bg-amber-400', bandLabel: 'OK' };
  if (value >= 0) return { text: 'text-orange-400', dot: 'bg-orange-400', bandLabel: 'Fraco' };
  return { text: 'text-red-400', dot: 'bg-red-400', bandLabel: 'Negativo' };
}

export function cvTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500', bandLabel: '' };
  if (value < 0.5) return { text: 'text-amber-400', dot: 'bg-amber-400', bandLabel: 'Suspeito' };
  if (value <= 1.2) return { text: 'text-emerald-400', dot: 'bg-emerald-400', bandLabel: 'No plano' };
  if (value <= 1.5) return { text: 'text-amber-400', dot: 'bg-amber-400', bandLabel: 'Levemente errático' };
  if (value <= 2.0) return { text: 'text-orange-400', dot: 'bg-orange-400', bandLabel: 'Errático' };
  return { text: 'text-red-400', dot: 'bg-red-400', bandLabel: 'Muito errático' };
}

export function mepTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value < 0) return { text: 'text-red-400', dot: 'bg-red-400' };
  if (value >= 1.0) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value >= 0.5) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  return { text: 'text-orange-400', dot: 'bg-orange-400' };
}

export function menTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value >= -0.5) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value >= -1.0) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value >= -2.0) return { text: 'text-orange-400', dot: 'bg-orange-400' };
  return { text: 'text-red-400', dot: 'bg-red-400' };
}

// ============================================================
// CONSISTÊNCIA — content (insufficientReason → mensagem)
// ============================================================

export function sharpeContent(sharpe, opts = {}) {
  if (!sharpe) return { value: '-', theme: sharpeTheme(null), badge: null };
  if (sharpe.value == null) {
    if (sharpe.insufficientReason === 'min_days') {
      const min = opts.minDays ?? 5;
      return { value: `Insuficiente · ≥${min} dias`, theme: sharpeTheme(null), badge: null, valueClassName: 'text-xs font-medium text-slate-500' };
    }
    if (sharpe.insufficientReason === 'no_pl_start') {
      return { value: 'Plano sem saldo inicial registrado', theme: sharpeTheme(null), badge: null, valueClassName: 'text-xs font-medium text-slate-500' };
    }
    if (sharpe.insufficientReason === 'zero_variance') {
      return { value: 'Variância zero — operações idênticas', theme: sharpeTheme(null), badge: null, valueClassName: 'text-xs font-medium text-slate-500' };
    }
    return { value: '-', theme: sharpeTheme(null), badge: null };
  }
  const theme = sharpeTheme(sharpe.value);
  return { value: sharpe.value.toFixed(2), theme, bandLabel: theme.bandLabel, badge: selicBadge(sharpe.source) };
}

export function cvContent(cv) {
  if (!cv) return { value: '-', theme: cvTheme(null), bandLabel: '' };
  if (cv.value == null) {
    const label = cv.label ?? '-';
    return { value: label, theme: cvTheme(null), bandLabel: '', valueClassName: 'text-xs font-medium text-slate-500' };
  }
  const theme = cvTheme(cv.value);
  return { value: cv.value.toFixed(2), theme, bandLabel: theme.bandLabel };
}

function excursionInsufficientLabel(avg) {
  if (avg?.insufficientReason === 'no_excursion_data') return 'Sem dado MEP/MEN nos trades do ciclo';
  if (avg?.insufficientReason === 'no_trades') return 'Sem trades no ciclo';
  return '-';
}

export function mepContent(avg) {
  if (!avg || avg.avgMEP == null) {
    return { value: excursionInsufficientLabel(avg), theme: mepTheme(null), valueClassName: 'text-xs font-medium text-slate-500' };
  }
  const v = avg.avgMEP;
  return { value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, theme: mepTheme(v) };
}

export function menContent(avg) {
  if (!avg || avg.avgMEN == null) {
    return { value: excursionInsufficientLabel(avg), theme: menTheme(null), valueClassName: 'text-xs font-medium text-slate-500' };
  }
  const v = avg.avgMEN;
  return { value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, theme: menTheme(v) };
}

// ============================================================
// CONSISTÊNCIA — tooltips didáticos
// ============================================================

export function buildSharpeTooltip(sharpe, cycleLabel) {
  const days = sharpe?.daysWithTrade ?? 0;
  const v = sharpe?.value;
  const periodo = cycleLabel ? `${cycleLabel} (${days} ${days === 1 ? 'dia operado' : 'dias operados'})` : `${days} ${days === 1 ? 'dia operado' : 'dias operados'}`;
  let banda;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    banda = '';
  } else if (v >= 2.0) {
    banda = 'Acima de 2 é excepcional — verifica se a amostra é grande o suficiente pra confiar.';
  } else if (v >= 1.5) {
    banda = 'Entre 1,5 e 2 é bom: o risco que você correu foi bem recompensado.';
  } else if (v >= 1.0) {
    banda = 'Entre 1 e 1,5 é razoável: você ganhou, mas o ganho não foi muito acima do que renderia parado na Selic.';
  } else if (v >= 0) {
    banda = 'Entre 0 e 1 é fraco: você ganhou alguma coisa, mas o risco que tomou rendeu menos do que ficar parado na Selic.';
  } else {
    banda = 'Negativo significa que você perdeu — pior do que se tivesse deixado o dinheiro parado.';
  }
  return (
    'Resposta a uma pergunta simples: "operar valeu mais a pena do que deixar o dinheiro parado rendendo Selic?". ' +
    'Quanto maior, melhor. ' +
    (banda ? `${banda} ` : '') +
    `Janela: ${periodo}.`
  );
}

export function buildCvTooltip(cv, plan) {
  const rrText = plan && typeof plan.rrTarget === 'number' ? plan.rrTarget.toFixed(1) : '?';
  return (
    `CV normalizado compara a variabilidade do seu P&L com a esperada pelo seu plano (RR ${rrText}). ` +
    'Se a WR efetiva do ciclo não for calculável, é usada a WR de breakeven 1/(1+RR) como referência. ' +
    '1.0 = executando exatamente o plano · >1.5 = mais errático · <0.8 = mais estável ' +
    '(verificar amostra ou overfitting).'
  );
}

export const MEP_TOOLTIP =
  'MEP médio (Máxima Excursão Positiva): em média seus trades chegaram a +X% durante a vida do ' +
  'trade. Comparado com o resultado final, mostra quanto você deixou na mesa.';

export const MEN_TOOLTIP =
  'MEN médio (Máxima Excursão Negativa): em média seus trades chegaram a −X% antes de fechar. ' +
  'Mostra quanto risco você aceitou correr antes do desfecho.';

// ============================================================
// PERFORMANCE — content + tooltips (NOVO #282; técnico + didático)
// cálculo vem de cycleMetrics.computeCycleMetrics / drawdown
// ============================================================

const NEUTRAL = { text: 'text-slate-500', dot: 'bg-slate-500' };
const EMERALD = { text: 'text-emerald-400', dot: 'bg-emerald-400' };
const AMBER = { text: 'text-amber-400', dot: 'bg-amber-400' };
const ORANGE = { text: 'text-orange-400', dot: 'bg-orange-400' };
const RED = { text: 'text-red-400', dot: 'bg-red-400' };

export const EXPECTANCY_TOOLTIP =
  'Expectancy: ganho médio esperado por trade, em múltiplos de risco (R). Acima de +0,5R é excelente; ' +
  'entre 0 e +0,2R é frágil; abaixo de 0 o ciclo perde valor a cada trade.';
export const WIN_RATE_TOOLTIP =
  'Win Rate (taxa de acerto): percentual de trades vencedores. Sozinho não diz se você ganha — ' +
  'precisa ser lido junto com o Payoff (acerto baixo + payoff alto ainda é lucrativo).';
export const PAYOFF_TOOLTIP =
  'Payoff: quanto sua vitória média vale comparada à sua perda média, em múltiplos de risco (R). ' +
  'Acima de 1,5 é robusto; abaixo de 1 cada perda apaga mais de uma vitória.';
export const PROFIT_FACTOR_TOOLTIP =
  'Profit Factor: soma de todos os lucros dividida pela soma de todas as perdas. ' +
  'Acima de 1,5 é sólido; abaixo de 1 o ciclo é perdedor.';
export const DRAWDOWN_TOOLTIP =
  'Max Drawdown: maior queda do capital de um pico até o fundo dentro do ciclo. ' +
  'Quanto menor, mais suave foi a curva de capital.';
export const ADHERENCE_TOOLTIP =
  'Aderência: percentual de trades que respeitaram as regras do plano (risco por operação e RR). ' +
  'Abaixo de 80% indica indisciplina na execução.';

export function expectancyContent(expectancyR) {
  if (expectancyR == null || !Number.isFinite(expectancyR)) return { value: '—', theme: NEUTRAL };
  let theme, bandLabel;
  if (expectancyR >= 0.5) { theme = EMERALD; bandLabel = 'Excelente'; }
  else if (expectancyR >= 0.2) { theme = EMERALD; bandLabel = 'Bom'; }
  else if (expectancyR >= 0) { theme = AMBER; bandLabel = 'Frágil'; }
  else { theme = RED; bandLabel = 'Negativo'; }
  return { value: `${expectancyR >= 0 ? '+' : ''}${expectancyR.toFixed(2)}R`, theme, bandLabel };
}

export function winRateContent(winRate, winners, count) {
  if (winRate == null || !Number.isFinite(winRate)) return { value: '—', theme: NEUTRAL };
  const theme = winRate >= 0.5 ? EMERALD : winRate >= 0.4 ? AMBER : ORANGE;
  const caption = (winners != null && count != null) ? `${winners} de ${count} trades` : undefined;
  return { value: `${(winRate * 100).toFixed(1)}%`, theme, caption };
}

export function payoffContent(avgWinR, avgLossR) {
  if (avgWinR == null || avgLossR == null || !Number.isFinite(avgWinR) || !Number.isFinite(avgLossR) || avgLossR === 0) {
    return { value: '—', theme: NEUTRAL };
  }
  const ratio = avgWinR / Math.abs(avgLossR);
  const theme = ratio >= 1.5 ? EMERALD : ratio >= 1 ? AMBER : ORANGE;
  const bandLabel = ratio >= 1.5 ? 'Robusto' : ratio >= 1 ? 'Aceitável' : 'Fraco';
  return { value: `${ratio.toFixed(2)}`, theme, bandLabel, caption: `${avgWinR.toFixed(2)}R / ${avgLossR.toFixed(2)}R` };
}

export function profitFactorContent(pf) {
  if (pf == null || !Number.isFinite(pf)) return { value: '—', theme: NEUTRAL };
  const theme = pf >= 1.5 ? EMERALD : pf >= 1 ? AMBER : RED;
  const bandLabel = pf >= 1.5 ? 'Sólido' : pf >= 1 ? 'No positivo' : 'No negativo';
  return { value: pf.toFixed(2), theme, bandLabel };
}

export function drawdownContent(percentFraction, valueBRL) {
  if (percentFraction == null || !Number.isFinite(percentFraction)) return { value: '—', theme: NEUTRAL };
  const abs = Math.abs(percentFraction);
  const theme = abs < 0.05 ? EMERALD : abs < 0.10 ? AMBER : abs < 0.20 ? ORANGE : RED;
  const caption = (valueBRL != null && Number.isFinite(valueBRL))
    ? valueBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : undefined;
  return { value: `${(abs * 100).toFixed(1)}%`, theme, caption };
}

export function adherenceContent(rate, violationTypes) {
  if (rate == null || !Number.isFinite(rate)) return { value: '—', theme: NEUTRAL };
  const theme = rate >= 0.9 ? EMERALD : rate >= 0.8 ? AMBER : RED;
  const caption = (violationTypes != null && violationTypes > 0)
    ? `${violationTypes} ${violationTypes === 1 ? 'tipo' : 'tipos'} de violação`
    : 'sem violações';
  return { value: `${(rate * 100).toFixed(1)}%`, theme, caption };
}
