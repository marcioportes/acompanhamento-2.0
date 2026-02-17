/**
 * EmotionalAnalysisDashboard
 * @version 1.0.0
 * @description Dashboard de análise emocional completo
 */

import { useMemo } from 'react';
import { 
  Brain, AlertTriangle, TrendingUp, TrendingDown, 
  Activity, Target, Zap, Shield, Flame, Sparkles
} from 'lucide-react';
import { 
  analyzeEmotions, 
  EMOTION_COLORS, 
  EMOTION_CATEGORIES 
} from '../utils/emotionalAnalysis';
import { formatCurrency, formatPercent } from '../utils/calculations';

const EmotionalAnalysisDashboard = ({ trades }) => {
  const analysis = useMemo(() => analyzeEmotions(trades), [trades]);

  if (!trades || trades.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Brain className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-400">Análise Emocional</h3>
        <p className="text-slate-500 text-sm mt-2">
          Registre trades com emoções para ver a análise
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Score */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Análise Emocional</h2>
              <p className="text-slate-400 text-sm">{trades.length} trades analisados</p>
            </div>
          </div>
          
          {/* Score Emocional */}
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {analysis.avgEmotionalScore.toFixed(0)}
              <span className="text-lg text-slate-500">/100</span>
            </div>
            <p className="text-sm text-slate-400">Score Emocional</p>
          </div>
        </div>

        {/* Alerta de Tilt */}
        {analysis.isCurrentlyInTilt && (
          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl mb-4 flex items-center gap-3 animate-pulse">
            <Flame className="w-6 h-6 text-red-400" />
            <div>
              <p className="font-bold text-red-400">⚠️ Possível Tilt Detectado</p>
              <p className="text-sm text-red-300">
                Seus últimos trades indicam estados emocionais negativos. Considere pausar.
              </p>
            </div>
          </div>
        )}

        {/* Métricas Principais */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Activity className="w-4 h-4" />
              Consistência
            </div>
            <p className="text-2xl font-bold text-white">
              {analysis.consistencyRate.toFixed(0)}%
            </p>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
              <Shield className="w-4 h-4" />
              Estados Positivos
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {analysis.byCategory.POSITIVE?.reduce((sum, e) => sum + e.count, 0) || 0}
            </p>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              Estados Negativos
            </div>
            <p className="text-2xl font-bold text-amber-400">
              {analysis.byCategory.NEGATIVE?.reduce((sum, e) => sum + e.count, 0) || 0}
            </p>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
              <Zap className="w-4 h-4" />
              Estados Críticos
            </div>
            <p className="text-2xl font-bold text-red-400">
              {analysis.byCategory.CRITICAL?.reduce((sum, e) => sum + e.count, 0) || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Performance por Emoção */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" />
          Performance por Emoção
        </h3>
        
        <div className="space-y-3">
          {analysis.byEmotion.slice(0, 8).map(emotion => {
            const color = EMOTION_COLORS[emotion.emotion] || '#64748b';
            const isPositive = emotion.totalPL >= 0;
            
            return (
              <div key={emotion.emotion} className="bg-slate-800/50 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-white">{emotion.emotion}</span>
                    <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                      {emotion.count} trades
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(emotion.totalPL)}
                    </span>
                    <span className="text-slate-400 text-sm">
                      {emotion.winRate.toFixed(0)}% WR
                    </span>
                  </div>
                </div>
                
                {/* Barra de progresso */}
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${emotion.winRate}%`,
                      backgroundColor: color
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recomendações */}
      {analysis.recommendations.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Insights & Recomendações
          </h3>
          
          <div className="space-y-3">
            {analysis.recommendations.map((rec, index) => {
              const bgColors = {
                CRITICAL: 'bg-red-500/10 border-red-500/30',
                WARNING: 'bg-amber-500/10 border-amber-500/30',
                INFO: 'bg-blue-500/10 border-blue-500/30',
                SUCCESS: 'bg-emerald-500/10 border-emerald-500/30'
              };
              
              return (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border ${bgColors[rec.type]}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{rec.icon}</span>
                    <div>
                      <p className="font-bold text-white">{rec.title}</p>
                      <p className="text-sm text-slate-300 mt-1">{rec.message}</p>
                      <p className="text-xs text-slate-400 mt-2 italic">
                        💡 {rec.action}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Melhor vs Pior Estado */}
      {(analysis.bestEmotion || analysis.worstEmotion) && (
        <div className="grid grid-cols-2 gap-4">
          {analysis.bestEmotion && (
            <div className="glass-card p-4 border-l-4 border-emerald-500">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-slate-400">Melhor Estado</span>
              </div>
              <p className="text-xl font-bold text-white">{analysis.bestEmotion.emotion}</p>
              <p className="text-sm text-emerald-400">
                {analysis.bestEmotion.winRate.toFixed(0)}% WR • {formatCurrency(analysis.bestEmotion.totalPL)}
              </p>
            </div>
          )}
          
          {analysis.worstEmotion && (
            <div className="glass-card p-4 border-l-4 border-red-500">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <span className="text-sm text-slate-400">Pior Estado</span>
              </div>
              <p className="text-xl font-bold text-white">{analysis.worstEmotion.emotion}</p>
              <p className="text-sm text-red-400">
                {analysis.worstEmotion.winRate.toFixed(0)}% WR • {formatCurrency(analysis.worstEmotion.totalPL)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmotionalAnalysisDashboard;
