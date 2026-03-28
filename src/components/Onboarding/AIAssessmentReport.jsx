/**
 * AIAssessmentReport.jsx
 *
 * Relatório pré-assessment para o mentor.
 * Mostra scores propostos pela IA, flags de incongruência,
 * resultados da sondagem adaptativa, e sugestões de investigação.
 *
 * v1.2.0 (issue #097): Seção "Respostas Abertas — Análise IA" adicionada.
 * Todas as respostas abertas do questionário (type==='open') agrupadas por
 * dimensão, com texto do aluno + score IA + classificação + aiJustification
 * + aiFinding. Posicionada entre IncongruenceFlags e ProbingData.
 *
 * v1.1.0: Passa questionnaireResponses para IncongruenceFlags — permite
 * exibir respostas reais do aluno e justificativas da IA em cada flag.
 *
 * @version 1.2.0 — open responses panel (issue #097)
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TraderProfileCard from './TraderProfileCard.jsx';
import IncongruenceFlags from './IncongruenceFlags.jsx';
import DebugBadge from '../DebugBadge.jsx';
import { QUESTION_MAP } from '../../utils/assessmentQuestions.js';

// ── Constantes ────────────────────────────────────────────────

const DIMENSION_ORDER = ['emotional', 'financial', 'operational', 'experience'];

const DIMENSION_LABELS = {
  emotional:   'Emocional',
  financial:   'Financeiro',
  operational: 'Operacional',
  experience:  'Maturidade',
};

const DIMENSION_COLORS = {
  emotional:   { border: 'border-rose-500/20',   bg: 'bg-rose-500/5',   text: 'text-rose-400',   badge: 'bg-rose-500/10' },
  financial:   { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/10' },
  operational: { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',   text: 'text-blue-400',   badge: 'bg-blue-500/10' },
  experience:  { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',  text: 'text-amber-400',  badge: 'bg-amber-500/10' },
};

const CLASSIFICATION_LABELS = {
  A: { label: 'Excelente', color: 'text-emerald-400 bg-emerald-500/10' },
  B: { label: 'Bom',       color: 'text-blue-400    bg-blue-500/10'    },
  X: { label: 'Neutro',    color: 'text-gray-400    bg-white/5'        },
  Y: { label: 'Atenção',   color: 'text-amber-400   bg-amber-500/10'   },
  Z: { label: 'Crítico',   color: 'text-red-400     bg-red-500/10'     },
};

// ── Helpers ───────────────────────────────────────────────────

/**
 * Agrupa respostas abertas por dimensão, seguindo DIMENSION_ORDER.
 * Exportado para uso nos testes unitários.
 */
export function groupOpenResponsesByDimension(responses) {
  const open = responses.filter((r) => r.type === 'open');
  const grouped = {};
  for (const dim of DIMENSION_ORDER) {
    grouped[dim] = open.filter((r) => r.dimension === dim);
  }
  return grouped;
}

function scoreColor(score) {
  if (score == null) return 'text-gray-500';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 55) return 'text-amber-400';
  return 'text-red-400';
}

function confidenceBar(confidence) {
  const pct = Math.round((confidence || 0) * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return { pct, color };
}

// ── OpenResponseCard ──────────────────────────────────────────

function OpenResponseCard({ response }) {
  const question = QUESTION_MAP[response.questionId];
  const hasAI = response.aiScore != null;
  const classConfig = CLASSIFICATION_LABELS[response.aiClassification] || CLASSIFICATION_LABELS['X'];
  const { pct: confPct, color: confColor } = confidenceBar(response.aiConfidence);

  return (
    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-2">

      {/* Enunciado */}
      {question?.text && (
        <p className="text-[11px] text-gray-500 italic leading-relaxed">
          "{question.text}"
        </p>
      )}

      {/* Resposta do aluno */}
      <div className="p-2.5 rounded-md bg-white/[0.03] border border-white/5">
        <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">
          Resposta do aluno
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">
          {response.text || <span className="text-gray-600 italic">sem resposta registrada</span>}
        </p>
      </div>

      {/* Métricas IA */}
      {hasAI ? (
        <div className="space-y-2">

          {/* Score + Classificação + Confiança */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-600">Score IA</span>
              <span className={`text-sm font-bold font-mono ${scoreColor(response.aiScore)}`}>
                {response.aiScore}
              </span>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${classConfig.color}`}>
              {classConfig.label}
            </span>

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-gray-600">Confiança</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${confColor}`}
                    style={{ width: `${confPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 font-mono">{confPct}%</span>
              </div>
            </div>
          </div>

          {/* aiFinding — observação clínica */}
          {response.aiFinding && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-[10px] uppercase tracking-wider text-amber-500/70 mb-1">
                Observação clínica
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">{response.aiFinding}</p>
            </div>
          )}

          {/* aiJustification */}
          {response.aiJustification && (
            <div className={response.aiFinding ? 'pt-2 border-t border-white/5' : 'pt-2 border-t border-white/5'}>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">
                Justificativa IA
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">{response.aiJustification}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <div className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-gray-600 italic">Aguardando processamento IA</span>
        </div>
      )}
    </div>
  );
}

// ── DimensionGroup ────────────────────────────────────────────

function DimensionGroup({ dimension, responses }) {
  const [open, setOpen] = useState(false);
  const colors = DIMENSION_COLORS[dimension] || DIMENSION_COLORS.emotional;
  const label = DIMENSION_LABELS[dimension] || dimension;
  const processedCount = responses.filter((r) => r.aiScore != null).length;

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left group"
      >
        <div className="flex items-center gap-2.5">
          <span className={`text-sm font-medium ${colors.text}`}>{label}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors.badge} ${colors.text}`}>
            {responses.length} {responses.length === 1 ? 'resposta' : 'respostas'}
          </span>
          {processedCount < responses.length && (
            <span className="text-[10px] text-gray-600 italic">
              ({responses.length - processedCount} aguardando IA)
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {responses.map((resp) => (
            <OpenResponseCard key={resp.questionId} response={resp} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── OpenResponsesPanel ────────────────────────────────────────

function OpenResponsesPanel({ questionnaireResponses }) {
  const grouped = groupOpenResponsesByDimension(questionnaireResponses);
  const totalOpen = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0);

  if (totalOpen === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium">
          Respostas Abertas — Análise IA
        </h3>
        <span className="text-[10px] text-gray-600">
          {totalOpen} respostas · clique na dimensão para expandir
        </span>
      </div>
      <div className="space-y-2">
        {DIMENSION_ORDER.map((dim) =>
          grouped[dim].length > 0 ? (
            <DimensionGroup
              key={dim}
              dimension={dim}
              responses={grouped[dim]}
            />
          ) : null
        )}
      </div>
    </div>
  );
}

// ── AIAssessmentReport ────────────────────────────────────────

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

      {/* ── NOVA SEÇÃO: Respostas Abertas — Análise IA (issue #097) ── */}
      <OpenResponsesPanel questionnaireResponses={questionnaireResponses} />

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
