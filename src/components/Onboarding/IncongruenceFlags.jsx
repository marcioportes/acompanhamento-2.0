/**
 * IncongruenceFlags.jsx
 * 
 * Visualização de flags de incongruência para o relatório do mentor.
 * Mostra flags intra-dimensionais, inter-dimensionais e gaming suspect.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React from 'react';

const FLAG_ICONS = {
  STOP_CLAIM_VS_BEHAVIOR: '🛑',
  PROCESS_VS_IMPULSE: '⚡',
  SIZING_VS_REVENGE: '📊',
  DISCIPLINE_VS_LOCUS: '🎯',
  JOURNAL_VS_AWARENESS: '📓',
  CLOSED_VS_OPEN: '⚠️',
  GAMING_SUSPECT: '🎮',
};

const FLAG_SEVERITY = {
  STOP_CLAIM_VS_BEHAVIOR: 'high',
  PROCESS_VS_IMPULSE: 'high',
  SIZING_VS_REVENGE: 'high',
  DISCIPLINE_VS_LOCUS: 'medium',
  JOURNAL_VS_AWARENESS: 'medium',
  CLOSED_VS_OPEN: 'medium',
  GAMING_SUSPECT: 'high',
};

function getSeverityColor(severity) {
  switch (severity) {
    case 'high': return 'border-red-500/30 bg-red-500/5';
    case 'medium': return 'border-amber-500/30 bg-amber-500/5';
    default: return 'border-white/10 bg-white/[0.02]';
  }
}

function FlagCard({ flag, probingResolution }) {
  const icon = FLAG_ICONS[flag.type] || '⚠️';
  const severity = FLAG_SEVERITY[flag.type] || 'medium';
  const borderColor = getSeverityColor(severity);

  return (
    <div className={`p-4 rounded-xl border ${borderColor} space-y-2`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs font-mono text-gray-400 uppercase">
            {flag.type}
          </span>
        </div>
        {flag.delta != null && (
          <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
            Δ {flag.delta}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-300">{flag.description}</p>

      {/* Source → Target */}
      {flag.sourceQuestion && flag.targetQuestion && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-mono">{flag.sourceQuestion}</span>
          <span className="text-gray-600">({flag.sourceScore})</span>
          <span className="text-gray-600">→</span>
          <span className="font-mono">{flag.targetQuestion}</span>
          <span className="text-gray-600">({flag.targetScore})</span>
        </div>
      )}

      {/* Suggested investigation */}
      {flag.suggestedInvestigation && (
        <div className="mt-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">
            Sugestão para entrevista
          </p>
          <p className="text-xs text-gray-400 italic">
            {flag.suggestedInvestigation}
          </p>
        </div>
      )}

      {/* Probing resolution (if available) */}
      {probingResolution && (
        <div className={`mt-2 p-2 rounded-lg text-xs ${
          probingResolution === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' :
          probingResolution === 'reinforced' ? 'bg-red-500/10 text-red-400' :
          'bg-gray-500/10 text-gray-400'
        }`}>
          Aprofundamento: {
            probingResolution === 'resolved' ? 'Esclarecido ✓' :
            probingResolution === 'reinforced' ? 'Confirmado ✗' :
            'Inconclusivo ?'
          }
        </div>
      )}
    </div>
  );
}

export default function IncongruenceFlags({ intraFlags, interFlags, gamingSuspect, probingData }) {
  const hasFlags = (intraFlags?.length > 0) || (interFlags?.length > 0) || gamingSuspect;

  if (!hasFlags) {
    return (
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
        <p className="text-sm text-emerald-400">
          Nenhuma incongruência significativa detectada
        </p>
      </div>
    );
  }

  // Build probing resolution map
  const probingResolutions = {};
  if (probingData?.questions) {
    for (const q of probingData.questions) {
      if (q.triggeredByFlag && q.response?.aiAnalysis?.flagResolution) {
        probingResolutions[q.triggeredByFlag] = q.response.aiAnalysis.flagResolution;
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Section: Inter-dimensional */}
      {interFlags && interFlags.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Cross-checks inter-dimensionais ({interFlags.length})
          </h4>
          <div className="space-y-3">
            {interFlags.map((flag) => (
              <FlagCard
                key={flag.type}
                flag={flag}
                probingResolution={probingResolutions[flag.type]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section: Intra-dimensional */}
      {intraFlags && intraFlags.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Divergências intra-dimensionais ({intraFlags.length})
          </h4>
          <div className="space-y-3">
            {intraFlags.map((flag, i) => (
              <FlagCard key={`intra-${i}`} flag={flag} />
            ))}
          </div>
        </div>
      )}

      {/* Gaming suspect */}
      {gamingSuspect && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎮</span>
            <span className="text-xs font-mono text-red-400 uppercase">GAMING SUSPECT</span>
          </div>
          <p className="text-sm text-gray-300">
            O aluno selecionou consistentemente as melhores respostas nas perguntas fechadas 
            (≥80% das opções com score máximo). Possível inflação deliberada.
          </p>
        </div>
      )}
    </div>
  );
}
