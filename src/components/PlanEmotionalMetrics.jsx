/**
 * PlanEmotionalMetrics
 * @version 1.0.0
 * @description Métricas emocionais específicas por plano (período e ciclo)
 */

import { useMemo, useState } from 'react';
import { 
  Brain, Calendar, RefreshCw, AlertTriangle, 
  TrendingUp, TrendingDown, Minus, Shield, Flame
} from 'lucide-react';
import { analyzePlanEmotions, EMOTION_COLORS } from '../utils/emotionalAnalysis';
import { filterTradesByPeriod, formatPercent } from '../utils/calculations';

const SCOPE_MAP = {
  'Diário': 'today',
  'Semanal': 'week',
  'Mensal': 'month',
  'Trimestral': 'quarter',
  'Anual': 'year',
  'Day Trade': 'today',
  'Swing Trade': 'week'
};

const PlanEmotionalMetrics = ({ plan, trades }) => {
  const [viewScope, setViewScope] = useState('period');

  const analysis = useMemo(() => {
    if (!plan || !trades) return null;

    const rawScope = viewScope === 'period' ? plan.operationPeriod : plan.adjustmentCycle;
    const filterKey = SCOPE_MAP[rawScope] || 'all';
    const scopeTrades = filterTradesByPeriod(trades, filterKey);

    return analyzePlanEmotions(scopeTrades, plan, viewScope);
  }, [plan, trades, viewScope]);

  if (!analysis) {
    return (
      <div className="glass-card p-6 text-center">
        <Brain className="w-12 h-12 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500">Selecione um plano para ver métricas emocionais</p>
      </div>
    );
  }

  const getTrendIcon = () => {
    switch (analysis.emotionalTrend) {
      case 'IMPROVING': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'WORSENING': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTrendLabel = () => {
    switch (analysis.emotionalTrend) {
      case 'IMPROVING': return 'Melhorando';
      case 'WORSENING': return 'Piorando';
      default: return 'Estável';
    }
  };

  const getRiskColor = (score) => {
    if (score <= 25) return 'text-emerald-400';
    if (score <= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getComplianceColor = (rate) => {
    if (rate >= 70) return 'text-emerald-400';
    if (rate >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Métricas Emocionais</h3>
            <p className="text-xs text-slate-500">{plan.name}</p>
          </div>
        </div>

        {/* Toggle Período/Ciclo */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setViewScope('period')}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 ${
              viewScope === 'period' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {plan.operationPeriod}
          </button>
          <button
            onClick={() => setViewScope('cycle')}
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 ${
              viewScope === 'cycle' 
                ? 'bg-purple-600 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3 h-3" />
            {plan.adjustmentCycle}
          </button>
        </div>
      </div>

      {/* Alertas */}
      {analysis.alerts.length > 0 && (
        <div className="p-3 bg-slate-800/50 border-b border-slate-800">
          {analysis.alerts.map((alert, i) => (
            <div 
              key={i} 
              className={`flex items-center gap-2 text-sm ${
                alert.severity === 'critical' ? 'text-red-400' :
                alert.severity === 'high' ? 'text-amber-400' :
                alert.severity === 'medium' ? 'text-yellow-400' :
                'text-slate-400'
              }`}
            >
              {alert.severity === 'critical' ? (
                <Flame className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Métricas */}
      <div className="p-4">
        {analysis.totalTrades === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-500">Nenhum trade neste {viewScope === 'period' ? 'período' : 'ciclo'}</p>
          </div>
        ) : (
          <>
            {/* Score e Tendência */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-800/50 p-3 rounded-xl text-center">
                <p className="text-xs text-slate-500 mb-1">Score</p>
                <p className="text-2xl font-bold text-white">
                  {analysis.avgEmotionalScore.toFixed(0)}
                </p>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-xl text-center">
                <p className="text-xs text-slate-500 mb-1">Tendência</p>
                <div className="flex items-center justify-center gap-1">
                  {getTrendIcon()}
                  <span className="text-sm font-medium text-white">{getTrendLabel()}</span>
                </div>
              </div>
              
              <div className="bg-slate-800/50 p-3 rounded-xl text-center">
                <p className="text-xs text-slate-500 mb-1">Trades</p>
                <p className="text-2xl font-bold text-white">{analysis.totalTrades}</p>
              </div>
            </div>

            {/* Compliance e Risco */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-800/50 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Compliance Emocional
                  </span>
                  <span className={`text-sm font-bold ${getComplianceColor(analysis.emotionalComplianceRate)}`}>
                    {analysis.emotionalComplianceRate.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      analysis.emotionalComplianceRate >= 70 ? 'bg-emerald-500' :
                      analysis.emotionalComplianceRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analysis.emotionalComplianceRate}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  % de trades em estados positivos/neutros
                </p>
              </div>

              <div className="bg-slate-800/50 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Risco Emocional
                  </span>
                  <span className={`text-sm font-bold ${getRiskColor(analysis.periodRiskScore)}`}>
                    {analysis.periodRiskScore.toFixed(0)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      analysis.periodRiskScore <= 25 ? 'bg-emerald-500' :
                      analysis.periodRiskScore <= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analysis.periodRiskScore}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  0 = baixo risco, 100 = alto risco
                </p>
              </div>
            </div>

            {/* Top 3 Emoções */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Top Emoções do Período</p>
              <div className="space-y-2">
                {analysis.byEmotion.slice(0, 3).map((emotion, i) => (
                  <div 
                    key={emotion.emotion}
                    className="flex items-center justify-between bg-slate-800/30 px-3 py-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: EMOTION_COLORS[emotion.emotion] || '#64748b' }}
                      />
                      <span className="text-sm text-white">{emotion.emotion}</span>
                      <span className="text-xs text-slate-500">({emotion.count})</span>
                    </div>
                    <span className={`text-sm font-mono ${
                      emotion.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {emotion.winRate.toFixed(0)}% WR
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consistência */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Consistência Entrada/Saída</span>
                <span className="text-sm font-bold text-white">
                  {analysis.consistencyRate.toFixed(0)}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlanEmotionalMetrics;
