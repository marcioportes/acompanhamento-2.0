/**
 * AIAssessmentReport.jsx
 *
 * Relatório pré-assessment para o mentor.
 * Mostra scores propostos pela IA, flags de incongruência,
 * resultados da sondagem adaptativa, e sugestões de investigação.
 *
 * v1.1.0: Passa questionnaireResponses para IncongruenceFlags — permite
 * exibir respostas reais do aluno e justificativas da IA em cada flag.
 *
 * @version 1.1.0 — rich incongruence detail (DEC-027)
 */

import React from 'react';
import TraderProfileCard from './TraderProfileCard.jsx';
import IncongruenceFlags from './IncongruenceFlags.jsx';
import DebugBadge from '../DebugBadge.jsx';

export default function AIAssessmentReport({
  scores,
  classifications,
  incongruenceData,
  probingData,
  reportData,
  stageDiagnosis,
  questionnaireResponses = [],
}) {
  if (!scores) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-medium text-white mb-1">
          Relatório Pré-Assessment
        </h2>
        <p className="text-sm text-gray-500">
          Scores calculados pela IA — revise e valide na aba de validação
        </p>
      </div>

      {/* Profile Card */}
      <TraderProfileCard
        scores={scores}
        classifications={classifications}
        profileName={reportData?.profileName}
        compositeScore={scores.composite}
      />

      {/* Stage Diagnosis */}
      {stageDiagnosis && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Diagnóstico de Maturidade (DEC-021)
          </h3>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold text-amber-400">
              Stage {stageDiagnosis.stage}
            </span>
            <span className="text-sm text-gray-400">
              {classifications?.experience?.stage?.label}
            </span>
            <span className="text-xs text-gray-600">
              (confiança: {Math.round((stageDiagnosis.confidence || 0) * 100)}%)
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-2">{stageDiagnosis.justification}</p>
          {stageDiagnosis.keySignals && stageDiagnosis.keySignals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {stageDiagnosis.keySignals.map((signal, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 rounded">
                  {signal}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Incongruence Flags */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
          Flags de Incongruência
        </h3>
        <IncongruenceFlags
          intraFlags={incongruenceData?.intraFlags}
          interFlags={incongruenceData?.interFlags}
          gamingSuspect={incongruenceData?.gamingSuspect}
          probingData={probingData}
          questionnaireResponses={questionnaireResponses}
        />
      </div>

      {/* Probing Summary */}
      {probingData && probingData.summary && (
        <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <h3 className="text-xs uppercase tracking-wider text-purple-400 font-medium mb-3">
            Resultado do Aprofundamento Adaptativo
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">{probingData.summary.flagsResolved}</div>
              <div className="text-[10px] text-gray-500 uppercase">Esclarecidos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">{probingData.summary.flagsReinforced}</div>
              <div className="text-[10px] text-gray-500 uppercase">Confirmados</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-400">{probingData.summary.flagsInconclusive}</div>
              <div className="text-[10px] text-gray-500 uppercase">Inconclusivos</div>
            </div>
          </div>
          {probingData.summary.mentorFocusAreas && probingData.summary.mentorFocusAreas.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Áreas de foco para entrevista:</p>
              <ul className="space-y-1">
                {probingData.summary.mentorFocusAreas.map((area, i) => (
                  <li key={i} className="text-xs text-purple-300 flex items-start gap-1.5">
                    <span className="text-purple-500 mt-0.5">›</span>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Development Priorities */}
      {reportData?.developmentPriorities && reportData.developmentPriorities.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Prioridades de Desenvolvimento (sugestão IA)
          </h3>
          <div className="space-y-2">
            {reportData.developmentPriorities.map((p) => (
              <div key={p.rank} className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                  {p.rank}
                </span>
                <div>
                  <p className="text-sm text-gray-300">{p.priority}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {p.dimension} · {p.months} {p.months === 1 ? 'mês' : 'meses'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Summary */}
      {reportData?.reportSummary && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Resumo do Perfil
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
            {reportData.reportSummary}
          </p>
        </div>
      )}

      <DebugBadge component="AIAssessmentReport" />
    </div>
  );
}
