/**
 * EmotionalProfileDetail
 * @version 1.0.0 (Fase 1.4.0)
 * @description Painel detalhado do perfil emocional. Mostra:
 *   - Score gauge grande + status + trend
 *   - Distribuição emocional (barras)
 *   - Top 5 emoções
 *   - Timeline de alertas (TILT, REVENGE, compliance)
 *   - Evolução diária (mini chart)
 * 
 * PROPS:
 * @param {Object} analysis - useEmotionalProfile().analysis
 * @param {Object} status - useEmotionalProfile().status
 * @param {Object} metrics - useEmotionalProfile().metrics
 * @param {Array} alerts - useEmotionalProfile().alerts
 * @param {Array} dailyScores - useEmotionalProfile().dailyScores
 * @param {Function} onClose - Callback para fechar
 */

import { X, AlertTriangle, TrendingUp, TrendingDown, Minus, Flame, Zap, Brain, Shield, Activity } from 'lucide-react';

// ============================================
// LARGE SCORE GAUGE
// ============================================

const LargeScoreGauge = ({ score }) => {
  const size = 120;
  const strokeWidth = 10;
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
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{Math.round(score)}</span>
        <span className="text-[10px] text-slate-500 uppercase">Score</span>
      </div>
    </div>
  );
};

// ============================================
// DISTRIBUTION BARS
// ============================================

const DistributionBars = ({ distribution, total }) => {
  if (!distribution || total === 0) return null;
  
  const cats = [
    { key: 'POSITIVE', label: 'Positivas', color: 'bg-emerald-500', text: 'text-emerald-400' },
    { key: 'NEUTRAL', label: 'Neutras', color: 'bg-slate-500', text: 'text-slate-400' },
    { key: 'NEGATIVE', label: 'Negativas', color: 'bg-orange-500', text: 'text-orange-400' },
    { key: 'CRITICAL', label: 'Críticas', color: 'bg-red-500', text: 'text-red-400' },
  ];

  return (
    <div className="space-y-2">
      {cats.map(cat => {
        const count = distribution[cat.key] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={cat.key}>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className={cat.text}>{cat.label}</span>
              <span className="text-slate-500">{count} ({pct}%)</span>
            </div>
            <div className="h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
              <div className={`h-full ${cat.color}/60 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// ALERTS TIMELINE
// ============================================

const AlertTimeline = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-sm">
        <Shield className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />
        Nenhum alerta no período
      </div>
    );
  }

  const getIcon = (type) => {
    if (type.includes('TILT')) return Flame;
    if (type.includes('REVENGE')) return Zap;
    return AlertTriangle;
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'border-red-500/50 bg-red-500/5';
      case 'HIGH': return 'border-orange-500/40 bg-orange-500/5';
      default: return 'border-yellow-500/30 bg-yellow-500/5';
    }
  };

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {alerts.map(alert => {
        const Icon = getIcon(alert.type);
        return (
          <div key={alert.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${getSeverityStyle(alert.severity)}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
              alert.severity === 'CRITICAL' ? 'text-red-400' : 
              alert.severity === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300">{alert.message}</p>
              {alert.timestamp && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {new Date(alert.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
              alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
              alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>{alert.severity}</span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// DAILY EVOLUTION MINI CHART
// ============================================

const DailyEvolution = ({ dailyScores }) => {
  if (!dailyScores || dailyScores.length === 0) return null;

  const maxScore = 100;
  const height = 60;
  const width = Math.max(dailyScores.length * 24, 200);

  const points = dailyScores.map((d, i) => {
    const x = (i / Math.max(dailyScores.length - 1, 1)) * (width - 20) + 10;
    const y = height - (d.score / maxScore) * (height - 10) - 5;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const getColor = (s) => {
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#eab308';
    if (s >= 30) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 20} className="min-w-full">
        {/* Grid lines */}
        {[30, 50, 70].map(threshold => {
          const y = height - (threshold / maxScore) * (height - 10) - 5;
          return <line key={threshold} x1="0" y1={y} x2={width} y2={y} stroke="#1e293b" strokeDasharray="4 4" />;
        })}
        
        {/* Line */}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={getColor(p.score)} />
            <text x={p.x} y={height + 14} textAnchor="middle" className="text-[9px] fill-slate-500">
              {p.date?.slice(8, 10)}/{p.date?.slice(5, 7)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ============================================
// TOP EMOTIONS
// ============================================

const TopEmotions = ({ topEmotions }) => {
  if (!topEmotions || topEmotions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {topEmotions.map((emo, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-sm">{emo.config?.emoji || '❓'}</span>
          <span className="text-xs text-slate-300 flex-1">{emo.name}</span>
          <span className="text-[11px] text-slate-500">{emo.count}×</span>
          <span className="text-[10px] text-slate-400 font-mono w-8 text-right">{emo.percentage}%</span>
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const EmotionalProfileDetail = ({ analysis, status, metrics, alerts, dailyScores, onClose }) => {
  if (!analysis || !metrics) return null;

  const trendInfo = {
    IMPROVING: { label: 'Melhorando', color: 'text-emerald-400', Icon: TrendingUp },
    WORSENING: { label: 'Piorando', color: 'text-red-400', Icon: TrendingDown },
    STABLE: { label: 'Estável', color: 'text-slate-400', Icon: Minus }
  };
  const trend = trendInfo[metrics.trend] || trendInfo.STABLE;

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-semibold text-white">Perfil Emocional</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Score + Status row */}
      <div className="flex items-center gap-6">
        <LargeScoreGauge score={metrics.score} />
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg border ${
              status?.status === 'HEALTHY' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
              status?.status === 'ATTENTION' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
              status?.status === 'WARNING' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
              'bg-red-500/15 text-red-400 border-red-500/30'
            }`}>{status?.label || 'Saudável'}</span>
            <div className={`flex items-center gap-1 ${trend.color}`}>
              <trend.Icon className="w-3.5 h-3.5" />
              <span className="text-[11px]">{trend.label}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800/40 rounded-lg p-2">
              <p className="text-lg font-bold text-white">{metrics.tradesCount}</p>
              <p className="text-[10px] text-slate-500">Trades</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-2">
              <p className="text-lg font-bold text-red-400">{metrics.tiltCount}</p>
              <p className="text-[10px] text-slate-500">TILT</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-2">
              <p className="text-lg font-bold text-orange-400">{metrics.revengeCount}</p>
              <p className="text-[10px] text-slate-500">REVENGE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two columns: Distribution + Top Emotions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Distribuição</h4>
          <DistributionBars distribution={analysis.distribution} total={metrics.tradesCount} />
        </div>
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Top Emoções</h4>
          <TopEmotions topEmotions={analysis.topEmotions} />
        </div>
      </div>

      {/* Daily Evolution */}
      {dailyScores && dailyScores.length > 1 && (
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Evolução Diária</h4>
          <div className="bg-slate-800/30 rounded-lg p-3">
            <DailyEvolution dailyScores={dailyScores} />
          </div>
        </div>
      )}

      {/* Alerts */}
      <div>
        <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">
          Alertas {alerts.length > 0 && <span className="text-red-400">({alerts.length})</span>}
        </h4>
        <AlertTimeline alerts={alerts} />
      </div>
    </div>
  );
};

export default EmotionalProfileDetail;
