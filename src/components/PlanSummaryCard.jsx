import { useMemo, useState } from 'react';
import { Target, Ban, Calendar, ChevronDown, ChevronUp, Archive, AlertCircle } from 'lucide-react';
import { formatCurrencyDynamic, getPlanCurrency } from '../utils/currency';
import { getCycleStartDate, getCycleEndDate } from '../utils/planStateMachine';

const ONE_DAY_MS = 86400000;

const formatBR = (date) => {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const PlanSummaryCard = ({ plan, accounts = [], defaultExpanded = false, className = '' }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const currency = useMemo(() => getPlanCurrency(plan, accounts), [plan, accounts]);

  const cycle = useMemo(() => {
    if (!plan) return null;
    const adjustmentCycle = plan.adjustmentCycle || 'Mensal';
    const refDate = new Date();
    try {
      const start = getCycleStartDate(adjustmentCycle, refDate);
      const end = getCycleEndDate(adjustmentCycle, refDate);
      const dayN = Math.max(1, Math.floor((end - start) / ONE_DAY_MS) + 1);
      const dayX = Math.min(dayN, Math.max(1, Math.floor((refDate - start) / ONE_DAY_MS) + 1));
      return { start, end, dayX, dayN, adjustmentCycle };
    } catch {
      return null;
    }
  }, [plan]);

  const pctOfPL = useMemo(() => {
    if (!plan) return null;
    const pl = Number(plan.pl) || 0;
    const currentPl = Number(plan.currentPl);
    if (!pl || Number.isNaN(currentPl)) return null;
    return ((currentPl - pl) / pl) * 100;
  }, [plan]);

  if (!plan) {
    return (
      <div className={`glass-card p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Plano deletado ou não encontrado</span>
        </div>
      </div>
    );
  }

  const blockedEmotions = Array.isArray(plan.blockedEmotions) ? plan.blockedEmotions.filter(Boolean) : [];
  const isInactive = plan.active === false;

  const ro = plan.riskPerOperation;
  const rr = plan.rrTarget;
  const periodGoal = plan.periodGoal;
  const periodStop = plan.periodStop;
  const cycleGoal = plan.cycleGoal;
  const cycleStop = plan.cycleStop;
  const operationPeriod = plan.operationPeriod || 'Diário';

  const cap = Number(plan.pl) || 0;
  const pctToValue = (pct) => (cap && pct != null ? formatCurrencyDynamic((cap * Number(pct)) / 100, currency) : null);
  const roValue = pctToValue(ro);
  const periodGoalValue = pctToValue(periodGoal);
  const periodStopValue = pctToValue(periodStop != null ? Math.abs(periodStop) : null);
  const cycleGoalValue = pctToValue(cycleGoal);
  const cycleStopValue = pctToValue(cycleStop != null ? Math.abs(cycleStop) : null);

  return (
    <div className={`glass-card p-4 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Plano</span>
          <span className="font-semibold text-white text-[13px]">{plan.name || `#${plan.id?.slice(0, 6) || '—'}`}</span>
          <span className="text-[11px] text-slate-500">·</span>
          <span className="text-[11px] font-medium text-slate-400">{currency}</span>
          {isInactive && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Archive className="w-3 h-3" />arquivado
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      <div className="mt-3 space-y-1.5 text-[13px]">
        <div className="flex items-center gap-2 text-slate-300">
          <Target className="w-4 h-4 text-blue-400" />
          <span>
            RO {ro != null ? `${ro}%` : '—'}
            {roValue && <span className="text-slate-500"> ({roValue})</span>}
            <span className="text-slate-500 mx-1">·</span>
            RR {rr != null ? rr : '—'}
            <span className="text-slate-500 mx-1">·</span>
            Cap {formatCurrencyDynamic(plan.pl, currency)}
          </span>
        </div>

        {blockedEmotions.length > 0 && (
          <div className="flex items-start gap-2 text-slate-300">
            <Ban className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <span>Bloqueadas: <span className="text-slate-400">{blockedEmotions.join(', ')}</span></span>
          </div>
        )}

        {cycle && (
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>
              Ciclo {String(cycle.adjustmentCycle).toLowerCase()}: dia {cycle.dayX} de {cycle.dayN}
              <span className="text-slate-500 ml-1">({formatBR(new Date())})</span>
            </span>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-[13px]">
          {(periodGoal != null || periodStop != null) && (
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Período ({operationPeriod})</span>
              <span>
                {periodGoal != null
                  ? <>Meta +{periodGoal}%{periodGoalValue && <span className="text-slate-500"> ({periodGoalValue})</span>}</>
                  : 'Meta —'}
                <span className="text-slate-500 mx-1">·</span>
                {periodStop != null
                  ? <>Stop -{Math.abs(periodStop)}%{periodStopValue && <span className="text-slate-500"> ({periodStopValue})</span>}</>
                  : 'Stop —'}
              </span>
            </div>
          )}
          {(cycleGoal != null || cycleStop != null) && (
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Ciclo ({String(plan.adjustmentCycle || 'Mensal').toLowerCase()})</span>
              <span>
                {cycleGoal != null
                  ? <>Meta +{cycleGoal}%{cycleGoalValue && <span className="text-slate-500"> ({cycleGoalValue})</span>}</>
                  : 'Meta —'}
                <span className="text-slate-500 mx-1">·</span>
                {cycleStop != null
                  ? <>Stop -{Math.abs(cycleStop)}%{cycleStopValue && <span className="text-slate-500"> ({cycleStopValue})</span>}</>
                  : 'Stop —'}
              </span>
            </div>
          )}
          {plan.currentPl != null && (
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">PL atual</span>
              <span className={pctOfPL != null && pctOfPL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {formatCurrencyDynamic(plan.currentPl, currency)}
                {pctOfPL != null && (
                  <span className="text-slate-500 ml-1">
                    ({pctOfPL >= 0 ? '+' : ''}{pctOfPL.toFixed(1)}% no ciclo)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlanSummaryCard;
