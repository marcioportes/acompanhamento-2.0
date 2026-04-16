/**
 * PropAccountCard
 * @version 2.0.0 (v1.27.0)
 * @description Card dedicado para conta PROP no StudentDashboard.
 *   Exibe estado runtime da conta: drawdown gauge, profit vs target,
 *   eval countdown, daily P&L vs daily loss limit, consistency check,
 *   phase badge, alertas visuais 3 níveis, sparkline drawdown.
 *
 * v2.0.0: Alertas via derivePropAlerts (Fase B), sparkline drawdownHistory (Fase C).
 * v1.0.0: Card core com gauges e alertas inline (Fase A).
 *
 * Ref: issue #134, epic #52 Fases 3/4
 */

import { Shield, Clock, AlertTriangle, Target, Zap, Pause, Lock, Snowflake, ChevronDown } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { formatCurrencyDynamic } from '../../utils/currency';
import { calculateEvalDaysRemaining, isEvalDeadlineNear, DD_NEAR_THRESHOLD } from '../../utils/propFirmDrawdownEngine';
import { derivePropAlerts } from '../../utils/propFirmAlerts';
import { PROP_FIRM_PHASE_LABELS, DRAWDOWN_TYPE_LABELS } from '../../constants/propFirmDefaults';
import DebugBadge from '../DebugBadge';
import PropAiApproachPlanSection from './PropAiApproachPlanSection';

// ============================================
// Helpers visuais
// ============================================

const PHASE_COLORS = {
  EVALUATION: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  SIM_FUNDED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  LIVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  EXPIRED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function getDistanceDDColor(distanceToDD) {
  if (distanceToDD == null || isNaN(distanceToDD)) return 'text-slate-400';
  if (distanceToDD <= 0) return 'text-red-500';
  if (distanceToDD < DD_NEAR_THRESHOLD) return 'text-red-400';
  if (distanceToDD < 0.40) return 'text-amber-400';
  return 'text-emerald-400';
}

function getDistanceDDBgColor(distanceToDD) {
  if (distanceToDD == null || isNaN(distanceToDD)) return 'bg-slate-600';
  if (distanceToDD <= 0) return 'bg-red-500';
  if (distanceToDD < DD_NEAR_THRESHOLD) return 'bg-red-400';
  if (distanceToDD < 0.40) return 'bg-amber-400';
  return 'bg-emerald-400';
}

function getProfitColor(ratio) {
  if (ratio >= 0.80) return 'bg-emerald-400';
  if (ratio >= 0.50) return 'bg-blue-400';
  if (ratio >= 0.25) return 'bg-amber-400';
  return 'bg-slate-500';
}

function getEvalCountdownColor(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return 'text-slate-400';
  if (daysRemaining <= 0) return 'text-red-500';
  if (daysRemaining <= 7) return 'text-red-400';
  if (daysRemaining <= 14) return 'text-amber-400';
  return 'text-emerald-400';
}

// ============================================
// GaugeBar — barra de progresso reutilizável
// ============================================

const GaugeBar = ({ value, max, colorClass, label, sublabel, rightLabel }) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500">{label}</span>
        {rightLabel && <span className="text-[11px] text-slate-500">{rightLabel}</span>}
      </div>
      <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      {sublabel && <p className="text-[10px] text-slate-600 mt-0.5">{sublabel}</p>}
    </div>
  );
};

// ============================================
// AlertBadge — alerta visual compacto
// ============================================

const ALERT_LEVEL_STYLES = {
  danger: 'bg-red-500/10 border-red-500/30 text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

const ALERT_LEVEL_ICONS = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Zap,
};

const AlertBadge = ({ level, text }) => {
  const Icon = ALERT_LEVEL_ICONS[level] ?? Zap;
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] ${ALERT_LEVEL_STYLES[level] ?? ALERT_LEVEL_STYLES.info}`}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
};

// ============================================
// PropAccountCard — componente principal
// ============================================

// ============================================
// DrawdownSparkline — mini gráfico da evolução do threshold
// ============================================

const DrawdownSparkline = ({ history, drawdownMax, accountSize, currency }) => {
  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 text-[10px] text-slate-600">
        Sem histórico de drawdown
      </div>
    );
  }

  // Normalizar para 0..1 (0 = threshold no mínimo possível, 1 = threshold no máximo)
  const minThreshold = accountSize - drawdownMax;
  const points = history.map(h => {
    const threshold = h.drawdownThreshold ?? h.currentDrawdownThreshold ?? minThreshold;
    const normalized = drawdownMax > 0 ? (threshold - minThreshold) / drawdownMax : 0;
    return Math.max(0, Math.min(1, normalized));
  });

  // SVG sparkline — height increased from 32 to 56 for legibility (issue #145 Fase C)
  const width = 200;
  const height = 56;
  const padding = 4;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  const pathPoints = points.map((p, i) => {
    const x = padding + (i / Math.max(1, points.length - 1)) * usableW;
    const y = padding + (1 - p) * usableH; // inverted: high threshold = top
    return `${x},${y}`;
  });

  const lastPoint = points[points.length - 1];
  const lastBalance = history[history.length - 1]?.balance;
  const lastThreshold = history[history.length - 1]?.drawdownThreshold
    ?? history[history.length - 1]?.currentDrawdownThreshold ?? minThreshold;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500">Evolução DD threshold</span>
        <span className="text-[10px] text-slate-600">
          {history.length} trades · último: {formatCurrencyDynamic(lastThreshold, currency)}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-14" preserveAspectRatio="none">
        {/* Danger zone: bottom 30% of range */}
        <rect
          x={padding} y={padding + usableH * 0.7}
          width={usableW} height={usableH * 0.3}
          fill="rgba(239,68,68,0.06)"
        />
        <line
          x1={padding} y1={padding + usableH * 0.7}
          x2={padding + usableW} y2={padding + usableH * 0.7}
          stroke="rgba(239,68,68,0.25)" strokeWidth="0.5" strokeDasharray="3,3"
        />
        {/* Area fill */}
        <path
          d={`M${pathPoints[0]} ${pathPoints.join(' L')} L${padding + usableW},${height} L${padding},${height} Z`}
          fill={lastPoint < 0.3 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.1)'}
        />
        {/* Line */}
        <polyline
          points={pathPoints.join(' ')}
          fill="none"
          stroke={lastPoint < 0.3 ? '#ef4444' : '#3b82f6'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Last point dot */}
        {pathPoints.length > 0 && (() => {
          const [lx, ly] = pathPoints[pathPoints.length - 1].split(',');
          return <circle cx={lx} cy={ly} r="3" fill={lastPoint < 0.3 ? '#ef4444' : '#3b82f6'} />;
        })()}
      </svg>
    </div>
  );
};

// ============================================
// PhaseSelector — transição de fase com ações semânticas
// ============================================

const PHASE_TRANSITIONS = {
  EVALUATION: [
    {
      target: 'SIM_FUNDED',
      label: 'Aprovado na Avaliação',
      icon: '✓',
      color: 'text-emerald-400 hover:bg-emerald-500/10',
      confirm: 'Parabéns! Você foi aprovado na avaliação.\n\nSua conta será promovida para Simulado Funded. As regras de drawdown podem mudar conforme a mesa.\n\nConfirma a transição?',
    },
    {
      target: 'EXPIRED',
      label: 'Reprovado / Expirado',
      icon: '✕',
      color: 'text-red-400 hover:bg-red-500/10',
      confirm: 'Conta reprovada ou expirada na avaliação.\n\nEsta ação marca a conta como encerrada.\n\nConfirma?',
    },
  ],
  SIM_FUNDED: [
    {
      target: 'LIVE',
      label: 'Promovido para Live',
      icon: '↑',
      color: 'text-emerald-400 hover:bg-emerald-500/10',
      confirm: 'Conta promovida para Live!\n\nA partir de agora os resultados são com capital real da mesa.\n\nConfirma a transição?',
    },
    {
      target: 'EXPIRED',
      label: 'Conta Encerrada',
      icon: '✕',
      color: 'text-red-400 hover:bg-red-500/10',
      confirm: 'Encerrar conta Simulado Funded?\n\nEsta ação marca a conta como encerrada.\n\nConfirma?',
    },
  ],
  LIVE: [
    {
      target: 'EXPIRED',
      label: 'Conta Encerrada',
      icon: '✕',
      color: 'text-red-400 hover:bg-red-500/10',
      confirm: 'Encerrar conta Live?\n\nEsta ação marca a conta como encerrada.\n\nConfirma?',
    },
  ],
  EXPIRED: [],
};

const PhaseSelector = ({ currentPhase, onChangePhase }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const transitions = PHASE_TRANSITIONS[currentPhase] ?? [];
  const canTransition = onChangePhase && transitions.length > 0;

  const handleSelect = (transition) => {
    setOpen(false);
    if (confirm(transition.confirm)) {
      onChangePhase(transition.target);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={canTransition ? () => setOpen(!open) : undefined}
        className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 transition-all ${PHASE_COLORS[currentPhase] ?? PHASE_COLORS.EVALUATION} ${canTransition ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
      >
        {PROP_FIRM_PHASE_LABELS[currentPhase] ?? currentPhase}
        {canTransition && <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-[200px] py-1">
          <p className="px-3 py-1.5 text-[10px] text-slate-600 uppercase tracking-wider">Alterar fase</p>
          {transitions.map((t) => (
            <button
              key={t.target}
              onClick={() => handleSelect(t)}
              className={`w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 transition-colors ${t.color}`}
            >
              <span className="w-4 text-center">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PropAccountCard = ({ account, template, drawdownHistory, onUpdatePhase, trader4DProfile, traderIndicators }) => {
  const propFirm = account?.propFirm;

  if (!propFirm || account?.type !== 'PROP') return null;

  const accountSize = template?.accountSize ?? account.initialBalance ?? 0;
  const drawdownMax = template?.drawdown?.maxAmount ?? 0;
  const profitTarget = template?.profitTarget ?? 0;
  const dailyLossLimit = template?.dailyLossLimit ?? 0;
  const evalTimeLimit = template?.evalTimeLimit ?? null;
  const consistencyRule = template?.consistency?.evalRule ?? null;
  const phase = propFirm.phase ?? 'EVALUATION';
  const currency = account.currency ?? 'USD';

  // Estado runtime (populado pelas CFs)
  const currentBalance = account.currentBalance ?? accountSize;
  const peakBalance = propFirm.peakBalance ?? accountSize;
  const currentDrawdownThreshold = propFirm.currentDrawdownThreshold ?? (accountSize - drawdownMax);
  const distanceToDD = propFirm.distanceToDD ?? (drawdownMax > 0 ? (currentBalance - currentDrawdownThreshold) / drawdownMax : 1);
  const isDayPaused = propFirm.isDayPaused ?? false;
  const dailyPnL = propFirm.dailyPnL ?? 0;
  const tradingDays = propFirm.tradingDays ?? 0;
  const lockLevel = propFirm.lockLevel ?? null;
  const trailFrozen = propFirm.trailFrozen ?? false;
  const flags = propFirm.flags ?? [];

  // Profit acumulado = balance atual - tamanho inicial da conta
  const currentProfit = currentBalance - accountSize;
  const profitRatio = profitTarget > 0 ? Math.max(0, currentProfit / profitTarget) : 0;

  // Eval countdown
  const evalDaysRemaining = useMemo(() => {
    if (phase !== 'EVALUATION' || !evalTimeLimit) return null;
    const startDate = propFirm.phaseStartDate?.toDate?.()
      ?? (propFirm.phaseStartDate ? new Date(propFirm.phaseStartDate) : null);
    return calculateEvalDaysRemaining(startDate, evalTimeLimit);
  }, [phase, evalTimeLimit, propFirm.phaseStartDate]);

  const evalDeadlineNear = isEvalDeadlineNear(evalDaysRemaining);

  // Consistency: melhor dia vs threshold
  const bestDayProfit = propFirm.bestDayProfit ?? 0;
  const consistencyThreshold = consistencyRule && profitTarget > 0 ? profitTarget * consistencyRule : null;
  const consistencyOk = consistencyThreshold ? bestDayProfit <= consistencyThreshold : true;

  // Drawdown type label
  const drawdownTypeLabel = template?.drawdown?.type ? (DRAWDOWN_TYPE_LABELS[template.drawdown.type] ?? template.drawdown.type) : '';

  // ============================================
  // Alertas (3 níveis) — via derivePropAlerts (Fase B)
  // ============================================
  const alerts = useMemo(() => derivePropAlerts({
    flags,
    distanceToDD,
    isDayPaused,
    dailyPnL,
    currentBalance,
    currentDrawdownThreshold,
    currentProfit,
    profitTarget,
    profitRatio,
    evalDaysRemaining,
    bestDayProfit,
    consistencyRule,
    consistencyThreshold,
    lockLevel,
    trailFrozen,
    currency,
    fmt: formatCurrencyDynamic,
  }), [flags, distanceToDD, isDayPaused, dailyPnL, currentBalance,
      currentDrawdownThreshold, currentProfit, profitTarget, profitRatio,
      evalDaysRemaining, bestDayProfit, consistencyRule, consistencyThreshold,
      lockLevel, trailFrozen, currency]);

  // ============================================
  // Render
  // ============================================
  return (
    <div className="glass-card border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {propFirm.firmName ?? 'Prop Firm'} — {propFirm.productName ?? account.name}
              </h3>
              <p className="text-[11px] text-slate-500">
                {drawdownTypeLabel}
                {account.name && propFirm.productName && account.name !== propFirm.productName
                  ? ` · ${account.name}`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status flags */}
            {isDayPaused && (
              <span className="flex items-center gap-1 text-[10px] text-red-400" title="Dia pausado — daily loss limit atingido">
                <Pause className="w-3 h-3" />
              </span>
            )}
            {lockLevel !== null && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400" title="Safety net ativado — drawdown estático">
                <Lock className="w-3 h-3" />
              </span>
            )}
            {trailFrozen && (
              <span className="flex items-center gap-1 text-[10px] text-cyan-400" title="Trail congelado">
                <Snowflake className="w-3 h-3" />
              </span>
            )}
            {/* Phase badge / selector */}
            <PhaseSelector currentPhase={phase} onChangePhase={onUpdatePhase} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">

        {/* Row 1: Balance + Profit + DD Threshold */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[11px] text-slate-600 mb-1">Saldo</p>
            <p className="text-lg font-bold text-white font-mono">{formatCurrencyDynamic(currentBalance, currency)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-600 mb-1">Profit</p>
            <p className={`text-lg font-bold font-mono ${currentProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentProfit >= 0 ? '+' : ''}{formatCurrencyDynamic(currentProfit, currency)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-600 mb-1">Limite DD</p>
            <p className={`text-lg font-bold font-mono ${getDistanceDDColor(distanceToDD)}`}>
              {formatCurrencyDynamic(currentDrawdownThreshold, currency)}
            </p>
          </div>
        </div>

        {/* Gauge 1: Drawdown utilizado */}
        <GaugeBar
          value={drawdownMax > 0 ? drawdownMax - (currentBalance - currentDrawdownThreshold) : 0}
          max={drawdownMax}
          colorClass={getDistanceDDBgColor(distanceToDD)}
          label="Drawdown utilizado"
          rightLabel={`${((1 - distanceToDD) * 100).toFixed(1)}%`}
          sublabel={`Margem: ${formatCurrencyDynamic(Math.max(0, currentBalance - currentDrawdownThreshold), currency)} de ${formatCurrencyDynamic(drawdownMax, currency)}`}
        />

        {/* Gauge 2: Profit vs Target */}
        {profitTarget > 0 && (
          <GaugeBar
            value={Math.max(0, currentProfit)}
            max={profitTarget}
            colorClass={getProfitColor(profitRatio)}
            label="Profit vs Target"
            rightLabel={`${(profitRatio * 100).toFixed(1)}%`}
            sublabel={`${formatCurrencyDynamic(Math.max(0, currentProfit), currency)} de ${formatCurrencyDynamic(profitTarget, currency)}`}
          />
        )}

        {/* Row 2: Daily P&L + Eval Countdown + Trading Days */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-700/50">
          {/* Daily P&L */}
          <div>
            <p className="text-[11px] text-slate-600 mb-1">
              P&L dia
              {dailyLossLimit > 0 && <span className="text-slate-700"> / -{formatCurrencyDynamic(dailyLossLimit, currency)}</span>}
            </p>
            <p className={`text-base font-bold font-mono ${dailyPnL >= 0 ? 'text-emerald-400' : isDayPaused ? 'text-red-500' : 'text-red-400'}`}>
              {dailyPnL >= 0 ? '+' : ''}{formatCurrencyDynamic(dailyPnL, currency)}
            </p>
            {dailyLossLimit > 0 && (
              <div className="mt-1 h-1 rounded-full bg-slate-700/50 overflow-hidden">
                <div
                  className={`h-full rounded-full ${isDayPaused ? 'bg-red-500' : dailyPnL < 0 ? 'bg-amber-400' : 'bg-slate-600'}`}
                  style={{ width: `${Math.min(100, Math.abs(dailyPnL) / dailyLossLimit * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Eval countdown */}
          <div>
            <p className="text-[11px] text-slate-600 mb-1">
              {phase === 'EVALUATION' ? 'Eval deadline' : 'Fase'}
            </p>
            {evalDaysRemaining !== null ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Clock className={`w-4 h-4 ${getEvalCountdownColor(evalDaysRemaining)}`} />
                  <p className={`text-base font-bold ${getEvalCountdownColor(evalDaysRemaining)}`}>
                    {evalDaysRemaining === 0 ? 'Expirado' : `${evalDaysRemaining}d`}
                  </p>
                </div>
                {evalTimeLimit && (
                  <p className="text-[10px] text-slate-600 mt-0.5">de {evalTimeLimit} dias</p>
                )}
              </>
            ) : (
              <p className="text-base font-bold text-slate-400">
                {PROP_FIRM_PHASE_LABELS[phase] ?? phase}
              </p>
            )}
          </div>

          {/* Trading days */}
          <div>
            <p className="text-[11px] text-slate-600 mb-1">Dias operados</p>
            <p className="text-base font-bold text-white">{tradingDays}</p>
          </div>
        </div>

        {/* Consistency check */}
        {consistencyThreshold && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
            <Target className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-500">Consistency:</span>
            <span className={`text-[11px] font-medium ${consistencyOk ? 'text-emerald-400' : 'text-amber-400'}`}>
              {consistencyOk ? 'OK' : 'Atenção'}
            </span>
            <span className="text-[10px] text-slate-600">
              — melhor dia {formatCurrencyDynamic(bestDayProfit, currency)} / limite {formatCurrencyDynamic(consistencyThreshold, currency)} ({(consistencyRule * 100).toFixed(0)}%)
            </span>
          </div>
        )}

        {/* Sparkline drawdown (Fase C) */}
        {drawdownHistory && (
          <div className="pt-2 border-t border-slate-700/50">
            <DrawdownSparkline
              history={drawdownHistory}
              drawdownMax={drawdownMax}
              accountSize={accountSize}
              currency={currency}
            />
          </div>
        )}

        {/* Alertas */}
        {alerts.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-700/50">
            {alerts.map((alert, i) => (
              <AlertBadge key={i} level={alert.level} text={alert.text} />
            ))}
          </div>
        )}

        {/* AI Approach Plan (issue #133) */}
        <PropAiApproachPlanSection
          account={account}
          template={template}
          trader4DProfile={trader4DProfile}
          traderIndicators={traderIndicators}
          phase={phase}
        />
      </div>

      <DebugBadge component="PropAccountCard" embedded />
    </div>
  );
};

export default PropAccountCard;
