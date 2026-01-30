import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Brain, TrendingUp, AlertTriangle } from 'lucide-react';
import { analyzeByEmotion, formatCurrency, formatPercent } from '../utils/calculations';

const EmotionAnalysis = ({ trades }) => {
  const emotionData = useMemo(() => {
    return analyzeByEmotion(trades);
  }, [trades]);

  const disciplineStats = useMemo(() => {
    const disciplined = emotionData.find(e => e.emotion === 'Disciplinado') || { total: 0, wins: 0, totalPL: 0, winRate: 0 };
    const impulsive = emotionData.filter(e => ['FOMO', 'Ansioso', 'Eufórico'].includes(e.emotion));
    
    const impulsiveTotal = impulsive.reduce((acc, e) => acc + e.total, 0);
    const impulsiveWins = impulsive.reduce((acc, e) => acc + e.wins, 0);
    const impulsivePL = impulsive.reduce((acc, e) => acc + e.totalPL, 0);
    
    return {
      disciplined: {
        count: disciplined.total,
        winRate: disciplined.winRate,
        pl: disciplined.totalPL,
      },
      impulsive: {
        count: impulsiveTotal,
        winRate: impulsiveTotal > 0 ? (impulsiveWins / impulsiveTotal) * 100 : 0,
        pl: impulsivePL,
      },
      disciplineScore: trades.length > 0 
        ? (disciplined.total / trades.length) * 100 
        : 0,
    };
  }, [emotionData, trades.length]);

  if (trades.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Análise Emocional</h3>
        </div>
        <p className="text-slate-500 text-center py-8">
          Nenhum trade registrado ainda
        </p>
      </div>
    );
  }

  const COLORS = {
    'Disciplinado': '#10b981',
    'Confiante': '#06b6d4',
    'Hesitante': '#f59e0b',
    'Ansioso': '#f97316',
    'FOMO': '#ef4444',
    'Eufórico': '#ec4899',
    'Frustrado': '#8b5cf6',
    'Não informado': '#64748b',
  };

  const chartData = emotionData.map(e => ({
    name: e.emotion,
    value: e.total,
    color: COLORS[e.emotion] || '#64748b',
    winRate: e.winRate,
    pl: e.totalPL,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700/50 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-medium text-white mb-1">{data.name}</p>
          <p className="text-xs text-slate-400">{data.value} trades</p>
          <p className={`text-xs ${data.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
            Win Rate: {formatPercent(data.winRate)}
          </p>
          <p className={`text-xs ${data.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            P&L: {formatCurrency(data.pl)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Análise Emocional</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de pizza */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Score de disciplina */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Score de Disciplina</span>
              <span className={`text-lg font-bold ${
                disciplineStats.disciplineScore >= 70 ? 'text-emerald-400' :
                disciplineStats.disciplineScore >= 50 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {formatPercent(disciplineStats.disciplineScore)}
              </span>
            </div>
            <div className="h-3 bg-slate-800/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  disciplineStats.disciplineScore >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                  disciplineStats.disciplineScore >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                  'bg-gradient-to-r from-red-500 to-orange-500'
                }`}
                style={{ width: `${disciplineStats.disciplineScore}%` }}
              />
            </div>
          </div>

          {/* Comparação */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-400">Disciplinado</span>
              </div>
              <p className="text-white font-semibold">{disciplineStats.disciplined.count} trades</p>
              <p className="text-xs text-emerald-400/70">
                WR: {formatPercent(disciplineStats.disciplined.winRate)}
              </p>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400">Impulsivo</span>
              </div>
              <p className="text-white font-semibold">{disciplineStats.impulsive.count} trades</p>
              <p className="text-xs text-red-400/70">
                WR: {formatPercent(disciplineStats.impulsive.winRate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de emoções */}
      <div className="mt-6 pt-4 border-t border-slate-800/50">
        <div className="flex flex-wrap gap-2">
          {chartData.map((emotion, i) => (
            <div 
              key={i}
              className="flex items-center gap-2 bg-slate-800/30 rounded-lg px-3 py-1.5"
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: emotion.color }}
              />
              <span className="text-xs text-slate-400">{emotion.name}</span>
              <span className="text-xs font-medium text-white">{emotion.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insight */}
      {disciplineStats.disciplined.winRate > disciplineStats.impulsive.winRate && disciplineStats.impulsive.count > 0 && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-sm text-blue-300">
            💡 Seus trades disciplinados têm{' '}
            <span className="font-semibold">
              {formatPercent(disciplineStats.disciplined.winRate - disciplineStats.impulsive.winRate)}
            </span>
            {' '}mais win rate que os impulsivos.
          </p>
        </div>
      )}
    </div>
  );
};

export default EmotionAnalysis;
