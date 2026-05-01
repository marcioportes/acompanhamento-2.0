/**
 * MentorClassificationCard — issue #219 (Phase A do épico #218).
 *
 * Card no StudentDashboard mostrando % técnico vs % sorte do período (filtrado
 * pelo ContextBar — caller passa `trades` já filtrados). Lista flags mais
 * frequentes em sorte como sinal qualitativo.
 *
 * Casos:
 *  - 0 trades classificados → "Aguardando classificação do mentor".
 *  - >0 classificados → mostra percentuais + ranking de flags se houver sorte.
 */

import { useMemo } from 'react';
import { Target, ChevronRight } from 'lucide-react';
import { computeMentorClassificationStats } from '../../utils/mentorClassificationStats';

const FLAG_LABELS = {
  narrativa: 'narrativa solta',
  sizing: 'sizing fora',
  desvio_modelo: 'desvio modelo',
  outro: 'outro',
};

const MentorClassificationCard = ({ trades }) => {
  const stats = useMemo(() => computeMentorClassificationStats(trades), [trades]);

  // Skip render quando aluno está sem trades no contexto
  const safeTrades = Array.isArray(trades) ? trades : [];
  if (safeTrades.length === 0) return null;

  const { tecnico, sorte, pctTecnico, pctSorte, flagsRanking } = stats;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-white">Qualidade técnica do período</h3>
      </div>

      {/* Barra técnico vs sorte */}
      <div className="flex items-baseline gap-3 mb-2">
        <div className="text-2xl font-bold text-rose-300">{pctSorte.toFixed(0)}%</div>
        <div className="text-xs text-slate-400">sorte</div>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <div className="text-2xl font-bold text-emerald-300">{pctTecnico.toFixed(0)}%</div>
        <div className="text-xs text-slate-400">técnico</div>
      </div>

      {/* Stacked bar visual */}
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex mb-2">
        {pctSorte > 0 && (
          <div
            className="bg-rose-500/80 h-full"
            style={{ width: `${pctSorte}%` }}
            title={`Sorte: ${sorte} trade${sorte === 1 ? '' : 's'} flagados pelo mentor`}
          />
        )}
        {pctTecnico > 0 && (
          <div
            className="bg-emerald-500/80 h-full"
            style={{ width: `${pctTecnico}%` }}
            title={`Técnico: ${tecnico} trade${tecnico === 1 ? '' : 's'} (inclui presumidos por default)`}
          />
        )}
      </div>

      <div className="text-[10px] text-slate-500 mb-3">
        {sorte === 0
          ? `${safeTrades.length} trade${safeTrades.length === 1 ? '' : 's'} no período — nenhum flagado pelo mentor.`
          : `${sorte} flagado${sorte === 1 ? '' : 's'} 'sorte' pelo mentor sobre ${safeTrades.length} trade${safeTrades.length === 1 ? '' : 's'} no período.`}
      </div>

      {/* Flags ranking — só se houver sorte */}
      {sorte > 0 && flagsRanking[0]?.count > 0 && (
        <div className="border-t border-slate-800 pt-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Fatores em sorte</div>
          <div className="space-y-1">
            {flagsRanking
              .filter((f) => f.count > 0)
              .map(({ flag, count }) => (
                <div key={flag} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{FLAG_LABELS[flag] || flag}</span>
                  <span className="text-rose-300 font-medium">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorClassificationCard;
