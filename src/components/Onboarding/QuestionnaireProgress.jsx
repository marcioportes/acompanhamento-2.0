/**
 * QuestionnaireProgress.jsx
 * 
 * Barra de progresso por dimensão do questionário.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React from 'react';

const DIMENSION_CONFIG = {
  emotional: { label: 'Emocional', color: 'bg-purple-500', textColor: 'text-purple-400' },
  financial: { label: 'Financeiro', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
  operational: { label: 'Operacional', color: 'bg-blue-500', textColor: 'text-blue-400' },
  experience: { label: 'Maturidade', color: 'bg-amber-500', textColor: 'text-amber-400' },
};

export default function QuestionnaireProgress({ progressByDimension, currentQuestion, answeredCount, totalQuestions }) {
  if (!progressByDimension) return null;

  const overallProgress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {answeredCount} de {totalQuestions} perguntas
        </span>
        <span className="text-white font-medium">
          {Math.round(overallProgress)}%
        </span>
      </div>

      {/* Overall bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Per-dimension progress */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(DIMENSION_CONFIG).map(([dim, config]) => {
          const data = progressByDimension[dim] || { total: 0, answered: 0, progress: 0 };
          const isActive = currentQuestion?.dimension === dim;
          const pct = Math.round(data.progress * 100);

          return (
            <div
              key={dim}
              className={`
                p-2.5 rounded-lg border transition-all duration-200
                ${isActive
                  ? 'border-white/20 bg-white/5'
                  : 'border-white/5 bg-white/[0.02]'
                }
              `}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] uppercase tracking-wider font-medium ${config.textColor}`}>
                  {config.label}
                </span>
                <span className="text-[10px] text-gray-500">
                  {data.answered}/{data.total}
                </span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.color} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
