import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { analyzeBySetup, formatCurrency, formatPercent } from '../utils/calculations';

const SetupAnalysis = ({ trades }) => {
  const setupData = useMemo(() => {
    return analyzeBySetup(trades);
  }, [trades]);

  if (setupData.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Análise por Setup</h3>
        </div>
        <p className="text-slate-500 text-center py-8">
          Nenhum trade registrado ainda
        </p>
      </div>
    );
  }

  const maxTrades = Math.max(...setupData.map(s => s.total));

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Análise por Setup</h3>
      </div>

      <div className="space-y-4">
        {setupData.map((setup, index) => (
          <div 
            key={setup.setup} 
            className="group"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">{setup.setup}</span>
                <span className="text-xs text-slate-500">
                  {setup.total} trade{setup.total > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-semibold ${setup.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(setup.totalPL)}
                </span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  setup.winRate >= 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {formatPercent(setup.winRate)}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-slate-800/50 rounded-full overflow-hidden">
              {/* Total bar (width baseado na quantidade de trades) */}
              <div 
                className="absolute top-0 left-0 h-full bg-slate-700/50 rounded-full transition-all duration-500"
                style={{ width: `${(setup.total / maxTrades) * 100}%` }}
              />
              {/* Win rate bar */}
              <div 
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${
                  setup.winRate >= 50 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                    : 'bg-gradient-to-r from-red-500 to-orange-500'
                }`}
                style={{ width: `${(setup.total / maxTrades) * (setup.winRate / 100) * 100}%` }}
              />
            </div>

            {/* Stats breakdown */}
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-emerald-400/70">
                {setup.wins}W
              </span>
              <span className="text-xs text-red-400/70">
                {setup.losses}L
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-slate-800/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Melhor Setup:</span>
          <span className="font-semibold text-emerald-400">
            {setupData[0]?.setup} ({formatCurrency(setupData[0]?.totalPL)})
          </span>
        </div>
        {setupData.length > 1 && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Setup a Melhorar:</span>
            <span className="font-semibold text-red-400">
              {setupData.filter(s => s.totalPL < 0)[0]?.setup || 'Nenhum'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupAnalysis;
