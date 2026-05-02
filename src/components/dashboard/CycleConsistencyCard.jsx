/**
 * CycleConsistencyCard
 * @version 1.0.0 (v1.54.0 — issue #235 F2.2)
 * @description Card "Consistência Operacional" do StudentDashboard. Substitui
 *   CV puro + ΔT W/L (que confundiam concentração/estabilidade/aderência) por
 *   4 métricas científicas: Sharpe per-ciclo (Selic descontada), CV normalizado
 *   (cv_obs / cv_exp(plan.rrTarget, WR)), MEP médio e MEN médio em % por entry.
 *
 *   Spec / mockup: docs/dev/issues/issue-235-cycle-consistency-redesign.md
 *   Hook orquestrador: src/hooks/useCycleConsistency.js (commit 10b941ec)
 *
 *   ΔT W/L removido (sem substituto direto no novo modelo). Tempo medio geral
 *   preservado como sub-linha (info universal, sem indicadores de tempo
 *   ainda assertivos pro aluno — DEC-AUTO-235-T09-B revisada em review).
 */
/* eslint-disable react/prop-types */

import { Activity, Clock } from 'lucide-react';
import { useCycleConsistency } from '../../hooks/useCycleConsistency';
import DebugBadge from '../DebugBadge';

const MONTH_PT_BR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function deriveCycleLabel(cycleStart) {
  if (typeof cycleStart !== 'string' || cycleStart.length < 7) return null;
  const m = /^(\d{4})-(\d{2})/.exec(cycleStart);
  if (!m) return null;
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  return `${MONTH_PT_BR[monthIdx]}/${m[1]}`;
}

function sharpeTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500', bandLabel: '' };
  if (value >= 2.0) return { text: 'text-emerald-400', dot: 'bg-emerald-400', bandLabel: 'Excepcional' };
  if (value >= 1.5) return { text: 'text-emerald-400', dot: 'bg-emerald-400', bandLabel: 'Bom' };
  if (value >= 1.0) return { text: 'text-amber-400', dot: 'bg-amber-400', bandLabel: 'OK' };
  if (value >= 0) return { text: 'text-orange-400', dot: 'bg-orange-400', bandLabel: 'Fraco' };
  return { text: 'text-red-400', dot: 'bg-red-400', bandLabel: 'Negativo' };
}

function cvTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value < 0.5) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value <= 1.2) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value <= 1.5) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value <= 2.0) return { text: 'text-orange-400', dot: 'bg-orange-400' };
  return { text: 'text-red-400', dot: 'bg-red-400' };
}

function mepTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value < 0) return { text: 'text-red-400', dot: 'bg-red-400' };
  if (value >= 1.0) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value >= 0.5) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  return { text: 'text-orange-400', dot: 'bg-orange-400' };
}

function menTheme(value) {
  if (value == null || !Number.isFinite(value)) return { text: 'text-slate-500', dot: 'bg-slate-500' };
  if (value >= -0.5) return { text: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (value >= -1.0) return { text: 'text-amber-400', dot: 'bg-amber-400' };
  if (value >= -2.0) return { text: 'text-orange-400', dot: 'bg-orange-400' };
  return { text: 'text-red-400', dot: 'bg-red-400' };
}

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

function selicBadge(source) {
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

function MetricRow({ label, value, extra, theme, badge, tooltip, valueClassName }) {
  return (
    <div className="flex items-center justify-between py-2.5" title={tooltip}>
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold font-mono ${valueClassName ?? theme.text}`}>{value}</span>
        {extra && <span className={`text-[10px] font-bold ${theme.text}`}>{extra}</span>}
        {badge}
        <span className={`w-2 h-2 rounded-full ${theme.dot}`} aria-hidden="true" />
      </div>
    </div>
  );
}

function DualMetricRow({ label, left, right }) {
  // Quando ambos lados estão em estado "insuficiente" (mesma mensagem), colapsa
  // para uma linha só com a mensagem — evita duplicação visual.
  const sameInsufficient =
    left.view.valueClassName && right.view.valueClassName && left.view.value === right.view.value;
  if (sameInsufficient) {
    return (
      <div className="flex items-center justify-between py-2.5">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-xs font-medium ${left.view.valueClassName}`}>{left.view.value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5" title={left.tooltip}>
          <span className="text-[10px] text-slate-600 font-mono">{left.caption}</span>
          <span
            className={`text-sm font-bold font-mono ${left.view.valueClassName ?? left.view.theme.text}`}
          >
            {left.view.value}
          </span>
          <span className={`w-2 h-2 rounded-full ${left.view.theme.dot}`} aria-hidden="true" />
        </span>
        <span className="text-slate-700">·</span>
        <span className="flex items-center gap-1.5" title={right.tooltip}>
          <span className="text-[10px] text-slate-600 font-mono">{right.caption}</span>
          <span
            className={`text-sm font-bold font-mono ${right.view.valueClassName ?? right.view.theme.text}`}
          >
            {right.view.value}
          </span>
          <span className={`w-2 h-2 rounded-full ${right.view.theme.dot}`} aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function sharpeContent(sharpe, opts) {
  if (!sharpe) return { value: '-', theme: sharpeTheme(null), badge: null };
  if (sharpe.value == null) {
    if (sharpe.insufficientReason === 'min_days') {
      const min = opts.minDays ?? 5;
      return {
        value: `Insuficiente · ≥${min} dias`,
        theme: sharpeTheme(null),
        badge: null,
        valueClassName: 'text-xs font-medium text-slate-500',
      };
    }
    if (sharpe.insufficientReason === 'no_pl_start') {
      return {
        value: 'Plano sem saldo inicial registrado',
        theme: sharpeTheme(null),
        badge: null,
        valueClassName: 'text-xs font-medium text-slate-500',
      };
    }
    if (sharpe.insufficientReason === 'zero_variance') {
      return {
        value: 'Variância zero — operações idênticas',
        theme: sharpeTheme(null),
        badge: null,
        valueClassName: 'text-xs font-medium text-slate-500',
      };
    }
    return { value: '-', theme: sharpeTheme(null), badge: null };
  }
  const theme = sharpeTheme(sharpe.value);
  return {
    value: sharpe.value.toFixed(2),
    theme,
    bandLabel: theme.bandLabel,
    badge: selicBadge(sharpe.source),
  };
}

function cvContent(cv) {
  if (!cv) return { value: '-', theme: cvTheme(null) };
  if (cv.value == null) {
    const label = cv.label ?? '-';
    return {
      value: label,
      theme: cvTheme(null),
      valueClassName: 'text-xs font-medium text-slate-500',
    };
  }
  return {
    value: cv.value.toFixed(2),
    theme: cvTheme(cv.value),
  };
}

function excursionInsufficientLabel(avg) {
  if (avg?.insufficientReason === 'no_excursion_data') return 'Sem dado MEP/MEN nos trades do ciclo';
  if (avg?.insufficientReason === 'no_trades') return 'Sem trades no ciclo';
  return '-';
}

function mepContent(avg) {
  if (!avg || avg.avgMEP == null) {
    return {
      value: excursionInsufficientLabel(avg),
      theme: mepTheme(null),
      valueClassName: 'text-xs font-medium text-slate-500',
    };
  }
  const v = avg.avgMEP;
  return {
    value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    theme: mepTheme(v),
  };
}

function menContent(avg) {
  if (!avg || avg.avgMEN == null) {
    return {
      value: excursionInsufficientLabel(avg),
      theme: menTheme(null),
      valueClassName: 'text-xs font-medium text-slate-500',
    };
  }
  const v = avg.avgMEN;
  return {
    value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    theme: menTheme(v),
  };
}

function buildSharpeTooltip(sharpe, cycleLabel) {
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

function buildCvTooltip(cv, plan) {
  const rrText = plan && typeof plan.rrTarget === 'number' ? plan.rrTarget.toFixed(1) : '?';
  return (
    `CV normalizado compara a variabilidade do seu P&L com a esperada pelo seu plano (RR ${rrText}). ` +
    'Se a WR efetiva do ciclo não for calculável, é usada a WR de breakeven 1/(1+RR) como referência. ' +
    '1.0 = executando exatamente o plano · >1.5 = mais errático · <0.8 = mais estável ' +
    '(verificar amostra ou overfitting).'
  );
}

const MEP_TOOLTIP =
  'MEP médio (Máxima Excursão Positiva): em média seus trades chegaram a +X% durante a vida do ' +
  'trade. Comparado com o resultado final, mostra quanto você deixou na mesa.';

const MEN_TOOLTIP =
  'MEN médio (Máxima Excursão Negativa): em média seus trades chegaram a −X% antes de fechar. ' +
  'Mostra quanto risco você aceitou correr antes do desfecho.';

function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '-';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function classifyDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  if (minutes < 5) return { label: 'Scalping', color: 'text-purple-400' };
  if (minutes <= 60) return { label: 'Day Trade', color: 'text-blue-400' };
  return { label: 'Swing', color: 'text-emerald-400' };
}

function deltaTTheme(level) {
  if (level === 'winners-run') return { text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Winners run' };
  if (level === 'neutral') return { text: 'text-amber-400', dot: 'bg-amber-400', label: 'Equilibrado' };
  if (level === 'holding-losses') return { text: 'text-red-400', dot: 'bg-red-400', label: 'Segura loss' };
  return { text: 'text-slate-500', dot: 'bg-slate-500', label: '-' };
}

function deltaTTooltip(level, deltaPercent) {
  if (level === 'winners-run') {
    return `Você segura ganhos e corta perdas (W ${Math.abs(deltaPercent).toFixed(0)}% mais longos que L) — comportamento saudável.`;
  }
  if (level === 'neutral') {
    return `Tempos de W e L similares (delta ${deltaPercent.toFixed(0)}%). Sem padrão claro de gestão em posição.`;
  }
  if (level === 'holding-losses') {
    return `Você segura losses (W ${Math.abs(deltaPercent).toFixed(0)}% mais curtos que L) — corta ganho cedo, espera loss virar. Padrão clássico de aversão à perda.`;
  }
  return 'Precisa de wins e losses com duração registrada.';
}

const CycleConsistencyCard = ({ trades, plan, cycleStart, cycleEnd, cycleLabel, opts, avgTradeDuration, durationDelta }) => {
  const state = useCycleConsistency({ trades, plan, cycleStart, cycleEnd, opts });
  const { sharpe, cvNormalized, avgExcursion, loading, error } = state;

  const label = cycleLabel ?? deriveCycleLabel(cycleStart);

  const sharpeView = sharpeContent(sharpe, opts ?? {});
  const cvView = cvContent(cvNormalized);
  const mepView = mepContent(avgExcursion);
  const menView = menContent(avgExcursion);

  return (
    <div className="glass-card p-5 relative h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Consistencia Operacional
          </span>
          {label && (
            <span className="text-[11px] text-slate-500 normal-case">({label})</span>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-400/80">Não foi possível carregar métricas do ciclo</p>
      ) : loading ? (
        <div className="flex-1 space-y-3" data-testid="cycle-consistency-skeleton">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-slate-700/30 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col divide-y divide-slate-700/30">
          <MetricRow
            label={`Sharpe${label ? ` (${label})` : ''}`}
            value={sharpeView.value}
            extra={sharpeView.bandLabel}
            theme={sharpeView.theme}
            badge={sharpeView.badge}
            tooltip={buildSharpeTooltip(sharpe, label)}
            valueClassName={sharpeView.valueClassName}
          />
          <MetricRow
            label="CV normalizado"
            value={cvView.value}
            theme={cvView.theme}
            tooltip={buildCvTooltip(cvNormalized, plan)}
            valueClassName={cvView.valueClassName}
          />
          <DualMetricRow
            label="MEP / MEN médio (% / entry)"
            left={{ caption: 'MEP', view: mepView, tooltip: MEP_TOOLTIP }}
            right={{ caption: 'MEN', view: menView, tooltip: MEN_TOOLTIP }}
          />
          {(() => {
            if (!durationDelta) return null;
            const t = deltaTTheme(durationDelta.level);
            const dPct = durationDelta.deltaPercent;
            const sign = dPct >= 0 ? '+' : '';
            return (
              <div className="py-2.5" title={deltaTTooltip(durationDelta.level, dPct)}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Tempo W vs L</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold font-mono ${t.text}`}>{sign}{dPct.toFixed(0)}%</span>
                    <span className={`text-[10px] font-bold ${t.text}`}>{t.label}</span>
                    <span className={`w-2 h-2 rounded-full ${t.dot}`} aria-hidden="true" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                  <span>W: <span className="font-mono text-emerald-400/80">{formatDuration(durationDelta.durationWin)}</span></span>
                  <span>L: <span className="font-mono text-red-400/80">{formatDuration(durationDelta.durationLoss)}</span></span>
                </div>
              </div>
            );
          })()}

          {avgExcursion?.coverageBelowThreshold && avgExcursion.coverageLabel && (
            <p className="text-[10px] text-amber-400/80 mt-2 pt-2 border-0">
              {avgExcursion.coverageLabel}
            </p>
          )}
        </div>
      )}

      {(() => {
        const allMin = avgTradeDuration?.all;
        const klass = classifyDuration(allMin);
        if (!klass) return null;
        return (
          <div className="border-t border-slate-700/50 mt-4 pt-3">
            <div className="flex items-center gap-3 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500">Tempo medio geral:</span>
              <span className={`font-bold ${klass.color}`}>{formatDuration(allMin)}</span>
              <span className={`px-1.5 py-0.5 rounded ${klass.color} bg-slate-800/50`}>
                {klass.label}
              </span>
            </div>
          </div>
        );
      })()}

      <DebugBadge component="CycleConsistencyCard" embedded />
    </div>
  );
};

export default CycleConsistencyCard;
