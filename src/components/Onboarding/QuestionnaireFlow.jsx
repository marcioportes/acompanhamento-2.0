/**
 * QuestionnaireFlow.jsx
 * 
 * Orquestra o fluxo completo do questionário (34 perguntas).
 * Gerencia navegação, progresso, dimensão atual, e delegação para
 * QuestionClosed/QuestionOpen conforme tipo.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React, { useEffect } from 'react';
import QuestionClosed from './QuestionClosed.jsx';
import QuestionOpen from './QuestionOpen.jsx';
import QuestionnaireProgress from './QuestionnaireProgress.jsx';
import DebugBadge from '../DebugBadge.jsx';

const DIMENSION_LABELS = {
  emotional: 'Dimensão Emocional',
  financial: 'Dimensão Financeira',
  operational: 'Dimensão Operacional',
  experience: 'Dimensão Maturidade',
};

const SUB_DIMENSION_LABELS = {
  recognition: 'Reconhecimento Emocional',
  regulation: 'Regulação Emocional',
  locus: 'Locus de Controle',
  discipline: 'Disciplina Financeira',
  loss_management: 'Gestão de Perdas',
  profit_taking: 'Gestão de Ganhos',
  decision_mode: 'Modo de Decisão',
  timeframe: 'Timeframe',
  strategy_fit: 'Consistência de Estratégia',
  tracking: 'Journal/Tracking',
  timeline: 'Tempo de Mercado',
  strategy_stability: 'Estabilidade de Estratégia',
  metacognition: 'Metacognição',
  analytical_sophistication: 'Sofisticação Analítica',
  evolution_awareness: 'Consciência de Evolução',
  edge_articulation: 'Articulação de Edge',
};

export default function QuestionnaireFlow({
  questionnaire,
  onComplete,
}) {
  const {
    currentQuestion,
    currentIndex,
    totalQuestions,
    isFirstQuestion,
    isLastQuestion,
    answeredCount,
    progress,
    progressByDimension,
    responses,
    getOrderedOptions,
    answerClosed,
    answerOpen,
    goNext,
    goPrev,
    startTimer,
    isComplete,
    getMissingQuestions,
  } = questionnaire;

  // Start timer when component mounts or question changes
  useEffect(() => {
    startTimer();
  }, [currentIndex, startTimer]);

  if (!currentQuestion) return null;

  const isAnswered = !!responses[currentQuestion.id];
  const currentResponse = responses[currentQuestion.id];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header: dimension + sub-dimension */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
            {DIMENSION_LABELS[currentQuestion.dimension] || currentQuestion.dimension}
          </span>
          <span className="text-gray-700">›</span>
          <span className="text-xs uppercase tracking-wider text-gray-500">
            {SUB_DIMENSION_LABELS[currentQuestion.subDimension] || currentQuestion.subDimension}
          </span>
        </div>
        <div className="text-xs text-gray-600">
          Pergunta {currentIndex + 1} de {totalQuestions}
          <span className="mx-2">·</span>
          <span className="uppercase text-[10px]">
            {currentQuestion.type === 'closed' ? 'Múltipla escolha' : 'Resposta aberta'}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <QuestionnaireProgress
          progressByDimension={progressByDimension}
          currentQuestion={currentQuestion}
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
        />
      </div>

      {/* Question */}
      <div className="mb-8">
        {currentQuestion.type === 'closed' ? (
          <QuestionClosed
            key={currentQuestion.id}
            question={currentQuestion}
            orderedOptions={getOrderedOptions(currentQuestion.id)}
            selectedOptionId={currentResponse?.selectedOption || null}
            onSelect={(optionId) => answerClosed(currentQuestion.id, optionId)}
          />
        ) : (
          <QuestionOpen
            key={currentQuestion.id}
            question={currentQuestion}
            savedText={currentResponse?.text || ''}
            onSubmit={(text) => answerOpen(currentQuestion.id, text)}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <button
          onClick={goPrev}
          disabled={isFirstQuestion}
          className={`
            px-4 py-2 rounded-lg text-sm transition-all
            ${isFirstQuestion
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          ← Anterior
        </button>

        <div className="flex items-center gap-3">
          {/* Completion button (only when all answered) */}
          {isComplete && (
            <button
              onClick={() => onComplete && onComplete()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all"
            >
              Finalizar questionário
            </button>
          )}

          {/* Next button */}
          {!isLastQuestion && (
            <button
              onClick={goNext}
              disabled={!isAnswered}
              className={`
                px-4 py-2 rounded-lg text-sm transition-all
                ${isAnswered
                  ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                  : 'text-gray-600 cursor-not-allowed'
                }
              `}
            >
              Próxima →
            </button>
          )}
        </div>
      </div>

      {/* Missing questions indicator */}
      {isLastQuestion && !isComplete && (
        <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-400">
            {getMissingQuestions().length} pergunta(s) sem resposta: {getMissingQuestions().join(', ')}
          </p>
        </div>
      )}

      <DebugBadge component="QuestionnaireFlow" />
    </div>
  );
}
