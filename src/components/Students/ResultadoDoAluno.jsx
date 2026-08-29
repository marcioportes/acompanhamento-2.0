/**
 * ResultadoDoAluno — o bloco "Resultado" da ficha do mentor (issue #101).
 *
 * Marcio, 29/08: *"o resultado precisa melhorar, pode trazer mais informação como
 * o dashboard do aluno nos campos de Resultado"*.
 *
 * Antes eram quatro `StatCard` genéricos (P&L, Win Rate, Total Trades, Profit
 * Factor). Agora é a MESMA bateria que o aluno vê no fechamento de ciclo, pela
 * MESMA SSoT — `cycleMetricTiles` (#282) sobre `computeCycleMetrics`. Nenhum
 * número recalculado por outro caminho: mentor e aluno leem a mesma régua, com o
 * mesmo vocabulário técnico e o mesmo tooltip didático.
 *
 * UMA CONTA POR VEZ: o R depende do plano (`computeR`), e aluno com duas contas
 * tem dois R diferentes. Os tiles são do plano em foco — o do último trade
 * registrado —, nomeado no cabeçalho. Misturar contas produziria um R que não
 * existe, que é o erro que a D12 corrigiu no estado do dia.
 */
import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import {
  MetricTile,
  expectancyContent, winRateContent, payoffContent, profitFactorContent,
  drawdownContent, adherenceContent,
  EXPECTANCY_TOOLTIP, WIN_RATE_TOOLTIP, PAYOFF_TOOLTIP, PROFIT_FACTOR_TOOLTIP,
  DRAWDOWN_TOOLTIP, ADHERENCE_TOOLTIP,
} from '../metrics/cycleMetricTiles';
import { computeCycleMetrics, computeRuleAdherenceRate } from '../../utils/cycleClosure/cycleMetrics';
import { sortTradesChrono } from '../../utils/tradeInstant';

/**
 * Drawdown pico-a-vale em ordem CRONOLÓGICA (`sortTradesChrono`, SSoT do #402).
 * O cálculo equivalente no fechamento ordena só por `date`, então trades do mesmo
 * dia entram na ordem que o Firestore devolver e o número muda a cada leitura.
 */
const maxDrawdown = (trades, plan) => {
  if (!trades?.length || !(plan?.pl > 0)) return { value: 0, percent: 0 };
  let pico = plan.pl;
  let corrente = plan.pl;
  let pior = 0;
  let piorPct = 0;
  for (const t of sortTradesChrono(trades)) {
    corrente += typeof t.result === 'number' ? t.result : 0;
    if (corrente > pico) pico = corrente;
    const dd = corrente - pico;
    const pct = pico > 0 ? dd / pico : 0;
    if (dd < pior) { pior = dd; piorPct = pct; }
  }
  return { value: pior, percent: piorPct };
};

const ResultadoDoAluno = ({ trades = [], plano }) => {
  const doPlano = useMemo(
    () => (plano ? trades.filter((t) => t.planId === plano.id) : []),
    [trades, plano],
  );
  const metrics = useMemo(() => computeCycleMetrics(doPlano, plano), [doPlano, plano]);
  const aderencia = useMemo(() => computeRuleAdherenceRate(doPlano), [doPlano]);
  const dd = useMemo(() => maxDrawdown(doPlano, plano), [doPlano, plano]);

  if (!plano || doPlano.length === 0) {
    return (
      <div className="glass-card p-6 mb-8 text-center">
        <p className="text-sm text-slate-500">Sem plano com trades para medir.</p>
      </div>
    );
  }

  const tiles = [
    { label: 'Expectancy (R)', tooltip: EXPECTANCY_TOOLTIP, ...expectancyContent(metrics.expectancy_R) },
    { label: 'Win Rate', tooltip: WIN_RATE_TOOLTIP, ...winRateContent(metrics.winRate, metrics.winners, metrics.count) },
    { label: 'Payoff', tooltip: PAYOFF_TOOLTIP, ...payoffContent(metrics.avgWinR, metrics.avgLossR) },
    { label: 'Profit Factor', tooltip: PROFIT_FACTOR_TOOLTIP, ...profitFactorContent(metrics.profitFactor) },
    { label: 'Max Drawdown', tooltip: DRAWDOWN_TOOLTIP, ...drawdownContent(dd.percent, dd.value) },
    { label: 'Aderência', tooltip: ADHERENCE_TOOLTIP, ...adherenceContent(aderencia, 0) },
  ];

  return (
    <div className="glass-card p-4 sm:p-5 mb-8">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" /> Resultado
        </h3>
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">
          {plano.name ? `${plano.name} · ` : ''}{doPlano.length} trades · mesma régua do aluno
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <MetricTile
            key={t.label}
            label={t.label}
            value={t.value}
            theme={t.theme}
            bandLabel={t.bandLabel}
            caption={t.caption}
            tooltip={t.tooltip}
            isInsufficient={!!t.valueClassName}
          />
        ))}
      </div>
    </div>
  );
};

export default ResultadoDoAluno;
