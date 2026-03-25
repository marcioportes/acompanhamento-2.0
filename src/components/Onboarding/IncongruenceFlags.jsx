/**
 * IncongruenceFlags.jsx
 *
 * Visualização de flags de incongruência para o relatório do mentor.
 * Design master/detail — header sempre visível, detalhes colapsáveis.
 *
 * v2.0.0 (DEC-027): Labels semânticos em vez de códigos. Respostas reais
 * do aluno e justificativas da IA visíveis no detail. Probing integrado
 * por flag. Sem códigos de questão expostos no header.
 *
 * @version 2.0.0 — rich detail com respostas reais (DEC-027)
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { QUESTION_MAP } from '../../utils/assessmentQuestions.js';

// ── Semântica das flags inter-dimensionais ────────────────────

const FLAG_LABELS = {
  STOP_CLAIM_VS_BEHAVIOR: 'Contradição: stop loss declarado vs. comportamento real',
  PROCESS_VS_IMPULSE:     'Contradição: processo sistemático vs. impulsividade pós-loss',
  SIZING_VS_REVENGE:      'Contradição: sizing disciplinado vs. escalada após perdas',
  DISCIPLINE_VS_LOCUS:    'Contradição: disciplina declarada vs. externalização de culpa',
  JOURNAL_VS_AWARENESS:   'Contradição: journal completo vs. baixo reconhecimento de padrões',
};

const FLAG_ICONS = {
  STOP_CLAIM_VS_BEHAVIOR: '🛑',
  PROCESS_VS_IMPULSE:     '⚡',
  SIZING_VS_REVENGE:      '📊',
  DISCIPLINE_VS_LOCUS:    '🎯',
  JOURNAL_VS_AWARENESS:   '📓',
};

const RESOLUTION_CONFIG = {
  resolved:    { label: 'Esclarecido ✓',    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  reinforced:  { label: 'Confirmado ✗',     className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  inconclusive:{ label: 'Inconclusivo ?',   className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

// ── Helpers ──────────────────────────────────────────────────

function buildResponseMap(responses) {
  const map = {};
  for (const r of (responses || [])) {
    map[r.questionId] = r;
  }
  return map;
}

function getSelectedOptionText(questionId, selectedOption) {
  const q = QUESTION_MAP[questionId];
  if (!q || q.type !== 'closed') return null;
  return q.options?.find((o) => o.id === selectedOption)?.text || null;
}

function getQuestionShortLabel(questionId) {
  const q = QUESTION_MAP[questionId];
  if (!q) return questionId;
  // Return first 60 chars of question text as label
  return q.text?.substring(0, 60) + (q.text?.length > 60 ? '…' : '');
}

// ── Collapsible Section ───────────────────────────────────────

function CollapsibleSection({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 border-t border-white/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-2 text-left group"
      >
        <span className="text-[11px] uppercase tracking-wider text-gray-500 group-hover:text-gray-400 transition-colors font-medium">
          {label}
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
        }
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

// ── Inter-dimensional Flag Card ───────────────────────────────

function InterFlagCard({ flag, rMap, probingQuestion }) {
  const label = FLAG_LABELS[flag.type] || flag.type;
  const icon = FLAG_ICONS[flag.type] || '⚠️';
  const resolution = probingQuestion?.response?.aiAnalysis?.flagResolution;
  const resConfig = resolution ? RESOLUTION_CONFIG[resolution] : null;

  const sourceResponse = rMap[flag.sourceQuestion];
  const targetResponse = rMap[flag.targetQuestion];
  const sourceSelectedText = sourceResponse?.type === 'closed'
    ? getSelectedOptionText(flag.sourceQuestion, sourceResponse.selectedOption)
    : sourceResponse?.text;
  const targetJustification = targetResponse?.aiJustification;
  const targetText = targetResponse?.text;

  const sourceQLabel = getQuestionShortLabel(flag.sourceQuestion);
  const targetQLabel = getQuestionShortLabel(flag.targetQuestion);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
      {/* Header — sempre visível */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
          <p className="text-sm text-gray-200 font-medium leading-snug">{label}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {flag.delta != null && (
            <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
              Δ {flag.delta}
            </span>
          )}
          {resConfig && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${resConfig.className}`}>
              {resConfig.label}
            </span>
          )}
        </div>
      </div>

      {/* Sugestão para entrevista — sempre visível */}
      {flag.suggestedInvestigation && (
        <div className="ml-6 mt-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">
            Sugestão para entrevista
          </p>
          <p className="text-xs text-gray-300 italic">{flag.suggestedInvestigation}</p>
        </div>
      )}

      {/* Detail — colapsável */}
      <CollapsibleSection label="Ver o que gerou este alerta">
        <div className="space-y-3 ml-1">
          {/* Pergunta fonte (fechada) */}
          {sourceResponse && (
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">
                {flag.sourceQuestion} — {sourceQLabel}
              </p>
              <p className="text-xs text-gray-400 font-medium">
                Score: <span className="text-amber-400">{flag.sourceScore}</span>
              </p>
              {sourceSelectedText && (
                <p className="text-xs text-gray-300 mt-1 italic">
                  "{sourceSelectedText}"
                </p>
              )}
            </div>
          )}

          {/* Pergunta alvo (emocional — pode ser aberta) */}
          {targetResponse && (
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">
                {flag.targetQuestion} — {targetQLabel}
              </p>
              <p className="text-xs text-gray-400 font-medium">
                Score IA: <span className="text-red-400">{flag.targetScore}</span>
              </p>
              {targetText && (
                <p className="text-xs text-gray-400 mt-1 italic line-clamp-3">
                  "{targetText}"
                </p>
              )}
              {(targetJustification || targetResponse?.aiFinding) && (
                <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
                  {targetResponse?.aiFinding && (
                    <div>
                      <p className="text-[10px] text-amber-500/70 uppercase tracking-wider mb-0.5">Observação clínica</p>
                      <p className="text-xs text-gray-300">{targetResponse.aiFinding}</p>
                    </div>
                  )}
                  {targetJustification && (
                    <div className={targetResponse?.aiFinding ? 'pt-1 border-t border-white/5' : ''}>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Justificativa IA</p>
                      <p className="text-xs text-gray-300">{targetJustification}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Probing detail — colapsável se existir */}
      {probingQuestion && (
        <CollapsibleSection label={`Aprofundamento: ${probingQuestion.probingId}`}>
          <div className="space-y-2 ml-1">
            {/* Pergunta gerada */}
            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
              <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">Pergunta da IA</p>
              <p className="text-xs text-gray-300">{probingQuestion.text}</p>
            </div>

            {/* Resposta do aluno */}
            {probingQuestion.response?.text && (
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">
                  Resposta do aluno
                  {probingQuestion.response.responseTime && (
                    <span className="ml-2 text-gray-700">({probingQuestion.response.responseTime}s)</span>
                  )}
                </p>
                <p className="text-xs text-gray-300 italic">"{probingQuestion.response.text}"</p>
              </div>
            )}

            {/* Análise da IA */}
            {probingQuestion.response?.aiAnalysis && (
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                {probingQuestion.response.aiAnalysis.finding && (
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Finding</p>
                    <p className="text-xs text-gray-300">{probingQuestion.response.aiAnalysis.finding}</p>
                  </div>
                )}
                {probingQuestion.response.aiAnalysis.emotionalInsight && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Insight emocional</p>
                    <p className="text-xs text-gray-300">{probingQuestion.response.aiAnalysis.emotionalInsight}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ── Intra-dimensional Flag Card ───────────────────────────────

const DIMENSION_LABELS = {
  emotional:   'Emocional',
  financial:   'Financeiro',
  operational: 'Operacional',
  experience:  'Maturidade',
};

function IntraFlagCard({ flag, rMap }) {
  const dimLabel = DIMENSION_LABELS[flag.dimension] || flag.dimension;

  // Find open responses from this dimension with low scores
  const openResponses = Object.values(rMap).filter(
    (r) => r.type === 'open' && r.dimension === flag.dimension && r.aiScore != null
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-base mt-0.5 flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm text-gray-200 font-medium leading-snug">
              {dimLabel} — respostas fechadas inflam o score
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Fechadas: <span className="text-amber-400 font-mono">{flag.closedScore}</span>
              {' '}·{' '}
              Abertas: <span className="text-red-400 font-mono">{flag.openScore}</span>
              {' '}·{' '}
              Delta: <span className="text-red-400 font-mono">Δ {flag.delta}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Detail — respostas abertas com score baixo */}
      {openResponses.length > 0 && (
        <CollapsibleSection label={`Ver respostas abertas da dimensão (${openResponses.length})`}>
          <div className="space-y-3 ml-1">
            {openResponses.map((resp) => {
              const q = QUESTION_MAP[resp.questionId];
              return (
                <div key={resp.questionId} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider">
                      {resp.questionId}
                    </p>
                    <span className={`text-xs font-mono font-bold ${
                      resp.aiScore >= 65 ? 'text-yellow-400'
                        : resp.aiScore >= 50 ? 'text-amber-400'
                        : 'text-red-400'
                    }`}>
                      Score IA: {resp.aiScore}
                    </span>
                  </div>
                  {q?.text && (
                    <p className="text-[11px] text-gray-500 mb-1 italic">"{q.text.substring(0, 80)}…"</p>
                  )}
                  {resp.text && (
                    <p className="text-xs text-gray-400 line-clamp-3 italic mt-1">
                      Aluno: "{resp.text}"
                    </p>
                  )}
                  {(resp.aiJustification || resp.aiFinding) && (
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
                      {resp.aiFinding && (
                        <div>
                          <p className="text-[10px] text-amber-500/70 uppercase tracking-wider mb-0.5">Observação clínica</p>
                          <p className="text-xs text-gray-300">{resp.aiFinding}</p>
                        </div>
                      )}
                      {resp.aiJustification && (
                        <div className={resp.aiFinding ? 'pt-1 border-t border-white/5' : ''}>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Justificativa IA</p>
                          <p className="text-xs text-gray-400">{resp.aiJustification}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function IncongruenceFlags({
  intraFlags,
  interFlags,
  gamingSuspect,
  probingData,
  questionnaireResponses = [],
}) {
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

  const rMap = buildResponseMap(questionnaireResponses);

  // Build probing map by triggeredByFlag
  const probingByFlag = {};
  if (probingData?.questions) {
    for (const q of probingData.questions) {
      if (q.triggeredByFlag) {
        probingByFlag[q.triggeredByFlag] = q;
      }
    }
  }

  return (
    <div className="space-y-6">

      {/* Inter-dimensional */}
      {interFlags && interFlags.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Cross-checks inter-dimensionais ({interFlags.length})
          </h4>
          <div className="space-y-3">
            {interFlags.map((flag) => (
              <InterFlagCard
                key={flag.type}
                flag={flag}
                rMap={rMap}
                probingQuestion={probingByFlag[flag.type] || null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Intra-dimensional */}
      {intraFlags && intraFlags.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Divergências intra-dimensionais ({intraFlags.length})
          </h4>
          <div className="space-y-3">
            {intraFlags.map((flag, i) => (
              <IntraFlagCard
                key={`intra-${i}`}
                flag={flag}
                rMap={rMap}
              />
            ))}
          </div>
        </div>
      )}

      {/* Gaming suspect */}
      {gamingSuspect && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎮</span>
            <span className="text-sm font-medium text-red-400">
              Possível inflação deliberada nas respostas fechadas
            </span>
          </div>
          <p className="text-xs text-gray-400">
            O aluno selecionou consistentemente as melhores respostas em ≥80% das perguntas fechadas.
            Cruze com as respostas abertas — se houver discrepância, é sinal de gaming.
          </p>
        </div>
      )}
    </div>
  );
}
