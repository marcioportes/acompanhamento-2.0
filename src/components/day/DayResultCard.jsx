/**
 * DayResultCard.jsx — issue #402
 *
 * O período (dia ou semana) como coisa de primeira classe na tela.
 *
 * POR QUE EXISTE:
 *   O resultado do dia vivia num bloco inline no StudentDashboard — sem risco,
 *   sem stop, sem RO, sem teste — enquanto o stop do período aparecia como
 *   ACUSAÇÃO dentro de um trade individual. Aluno e mentor liam dois números
 *   diferentes para a mesma coisa.
 *
 * REGRA DE LEITURA — este card DECLARA, não ACUSA:
 *   Nenhum chip de violação é renderizado aqui, por construção. "O dia fechou
 *   além do stop" é um fato do dia; ele não é culpa de operação nenhuma. O que
 *   uma operação pode ter feito de errado (abrir sem orçamento, abrir depois do
 *   stop) é fato ATÔMICO e mora no painel daquele trade.
 *
 * MESMO COMPONENTE PARA OS DOIS PAPÉIS: montado no dashboard do aluno e na
 * página de feedback do mentor, alimentado pelo mesmo `buildPeriodState`. Uma
 * computação, uma renderização, dois leitores — que é o pedido literal de
 * "não confundir aluno e mentor".
 *
 * @see src/utils/dayState.js
 * @see src/components/metrics/dayMetricTiles.jsx
 */
import { AlertTriangle } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import {
  MetricTile,
  dayResultContent,
  dayBudgetContent,
  dayStopContent,
  dayGoalContent,
  dayOrderingNotice,
  DAY_RESULT_TOOLTIP,
  DAY_BUDGET_TOOLTIP,
  DAY_STOP_TOOLTIP,
  DAY_GOAL_TOOLTIP,
} from '../metrics/dayMetricTiles';

const rotuloPeriodo = (ps) => (ps?.operationPeriod === 'Semanal' ? 'A semana' : 'O dia');

const dataBR = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

/**
 * @param {Object} props
 * @param {Object} props.periodState — saída de `buildPeriodState`
 * @param {string} [props.dateLabel] — 'YYYY-MM-DD' do período (título)
 * @param {string} [props.currency]
 * @param {boolean} [props.compact] — sem título e sem DebugBadge (uso embutido)
 * @param {React.ReactNode} [props.headerSlot] — ex.: botão de fechar
 */
export default function DayResultCard({
  periodState,
  dateLabel = null,
  currency = 'BRL',
  compact = false,
  headerSlot = null,
}) {
  if (!periodState) return null;

  const aviso = dayOrderingNotice(periodState);
  const temMeta = periodState.goalValue != null;

  const tiles = [
    { label: 'Resultado do período', tooltip: DAY_RESULT_TOOLTIP, ...dayResultContent(periodState, currency) },
    { label: 'Folga do stop', tooltip: DAY_BUDGET_TOOLTIP, ...dayBudgetContent(periodState, currency) },
    { label: 'Stop do período', tooltip: DAY_STOP_TOOLTIP, ...dayStopContent(periodState, currency) },
    ...(temMeta ? [{ label: 'Meta do período', tooltip: DAY_GOAL_TOOLTIP, ...dayGoalContent(periodState, currency) }] : []),
  ];

  return (
    <div className={compact ? '' : 'glass-card border-l-4 border-blue-500 overflow-hidden'}>
      {!compact && (
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex justify-between items-center">
          <h3 className="font-bold text-white">
            {rotuloPeriodo(periodState)}
            {dateLabel ? ` — ${dataBR(dateLabel)}` : ''}
          </h3>
          {headerSlot}
        </div>
      )}

      <div className={compact ? 'py-2' : 'p-4'}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {tiles.map((t) => (
            <MetricTile
              key={t.label}
              label={t.label}
              value={t.value}
              theme={t.theme}
              bandLabel={t.bandLabel}
              caption={t.caption}
              tooltip={t.tooltip}
              isInsufficient={!!t.isInsufficient}
            />
          ))}
        </div>

        {aviso && (
          <p
            className="mt-3 text-[10px] text-amber-400/80 flex items-center gap-1.5"
            title={aviso.tooltip}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
            {aviso.text}
          </p>
        )}

        {periodState.maxAuthorizedTrades === 0 && periodState.roValue != null && (
          <p className="mt-2 text-[10px] text-orange-400/80">
            O plano para o período antes de autorizar uma operação inteira — reveja o risco por
            operação e o stop do período.
          </p>
        )}
      </div>

      {!compact && <DebugBadge component="DayResultCard" />}
    </div>
  );
}
