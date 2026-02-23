/**
 * StudentEmotionalCard
 * @version 1.0.0 (Fase 1.4.0)
 * @description Card compacto do perfil emocional do aluno para MentorDashboard.
 *   Mostra: score gauge, status badge, top emoção, trend, contadores de eventos.
 *   Clicável para abrir EmotionalProfileDetail.
 * 
 * PROPS:
 * @param {Object} metrics - Métricas do useEmotionalProfile().metrics
 * @param {Object} status - Status do useEmotionalProfile().status
 * @param {Array} alerts - Alertas do useEmotionalProfile().alerts
 * @param {string} studentName - Nome do aluno
 * @param {Function} onClick - Callback ao clicar no card
 */

import { useMemo } from 'react';
import { 
  Activity, AlertTriangle, TrendingUp, TrendingDown, 
  Minus, Brain, Flame, Zap 
} from 'lucide-react';

// ============================================
// SCORE GAUGE (SVG circular)
// ============================================

const ScoreGauge = ({ score, size = 56, strokeWidth = 5 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference - (progress / 100) * circumference;
  
  const getColor = (s) => {
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#eab308';
    if (s >= 30) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={getColor(score)}
          strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">{Math.round(score)}</span>
      </div>
    </div>
  );
};

// ============================================
// STATUS BADGE
// ============================================

const StatusBadge = ({ status }) => {
  const config = {
    HEALTHY:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Saudável' },
    ATTENTION: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Atenção' },
    WARNING:   { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Alerta' },
    CRITICAL:  { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: 'Crítico' }
  };
  const c = config[status?.status] || config.HEALTHY;

  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
};

// ============================================
// TREND INDICATOR
// ============================================

const TrendIndicator = ({ trend }) => {
  if (trend === 'IMPROVING') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (trend === 'WORSENING') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500" />;
};

// ============================================
// MAIN COMPONENT
// ============================================

const StudentEmotionalCard = ({ metrics, status, alerts = [], studentName, onClick }) => {
  if (!metrics) return null;

  const criticalAlerts = useMemo(() => alerts.filter(a => a.severity === 'CRITICAL').length, [alerts]);
  const hasTilt = metrics.tiltCount > 0;
  const hasRevenge = metrics.revengeCount > 0;

  return (
    <div 
      onClick={onClick}
      className={`rounded-xl border p-3 cursor-pointer transition-all hover:bg-slate-800/40 ${
        status?.status === 'CRITICAL' 
          ? 'border-red-500/40 bg-red-500/5' 
          : status?.status === 'WARNING'
            ? 'border-orange-500/30 bg-orange-500/5'
            : 'border-slate-700/30 bg-slate-800/20'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Score Gauge */}
        <ScoreGauge score={metrics.score} size={48} strokeWidth={4} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={status} />
            <TrendIndicator trend={metrics.trend} />
          </div>

          {/* Top emoção */}
          {metrics.topEmotion && (
            <p className="text-[11px] text-slate-400 truncate">
              {metrics.topEmotion.config?.emoji} {metrics.topEmotion.name} ({metrics.topEmotion.percentage}%)
            </p>
          )}
        </div>

        {/* Event badges */}
        <div className="flex flex-col items-end gap-1">
          {hasTilt && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              <Flame className="w-3 h-3" /> TILT {metrics.tiltCount > 1 ? `×${metrics.tiltCount}` : ''}
            </span>
          )}
          {hasRevenge && (
            <span className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
              <Zap className="w-3 h-3" /> REVENGE
            </span>
          )}
          {criticalAlerts > 0 && !hasTilt && !hasRevenge && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" /> {criticalAlerts}
            </span>
          )}
        </div>
      </div>

      {/* Distribution bar */}
      {metrics.tradesCount > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden mt-2.5 bg-slate-700/30">
          {metrics.positivePercent > 0 && (
            <div className="bg-emerald-500/70 transition-all" style={{ width: `${metrics.positivePercent}%` }} />
          )}
          {(100 - metrics.positivePercent - metrics.negativePercent) > 0 && (
            <div className="bg-slate-500/50 transition-all" style={{ width: `${100 - metrics.positivePercent - metrics.negativePercent}%` }} />
          )}
          {metrics.negativePercent > 0 && (
            <div className="bg-red-500/70 transition-all" style={{ width: `${metrics.negativePercent}%` }} />
          )}
        </div>
      )}
    </div>
  );
};

export default StudentEmotionalCard;
