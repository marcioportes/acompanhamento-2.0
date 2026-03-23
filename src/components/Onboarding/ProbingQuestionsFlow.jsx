/**
 * ProbingQuestionsFlow.jsx
 * 
 * Fluxo de sondagem adaptativa (3-5 perguntas geradas pela IA).
 * Todas as perguntas são abertas com mínimo de 80 caracteres.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React from 'react';
import QuestionOpen from './QuestionOpen.jsx';
import DebugBadge from '../DebugBadge.jsx';

export default function ProbingQuestionsFlow({
  probing,
  onComplete,
}) {
  const {
    currentProbingQuestion,
    currentProbingIndex,
    totalProbingQuestions,
    isProbingComplete,
    analyzing,
    error,
    answerProbingQuestion,
    completeAllProbing,
  } = probing;

  // All probing done
  if (isProbingComplete) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-xl font-medium text-white mb-3">
          Sondagem concluída
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          Suas respostas serão analisadas e apresentadas ao seu mentor 
          para a entrevista de validação.
        </p>

        <button
          onClick={async () => {
            await completeAllProbing();
            if (onComplete) onComplete();
          }}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
        >
          Finalizar
        </button>

        <DebugBadge />
      </div>
    );
  }

  if (!currentProbingQuestion) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs uppercase tracking-wider text-purple-400 font-medium">
            Sondagem adaptativa
          </span>
        </div>
        <div className="text-xs text-gray-600">
          Pergunta {currentProbingIndex + 1} de {totalProbingQuestions}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: totalProbingQuestions }).map((_, i) => (
          <div
            key={i}
            className={`
              h-1 flex-1 rounded-full transition-all duration-300
              ${i < currentProbingIndex
                ? 'bg-purple-500'
                : i === currentProbingIndex
                  ? 'bg-purple-400/50'
                  : 'bg-white/5'
              }
            `}
          />
        ))}
      </div>

      {/* Question */}
      <div className="mb-8">
        <QuestionOpen
          question={{
            text: currentProbingQuestion.text,
            minChars: 80,
          }}
          savedText=""
          onSubmit={answerProbingQuestion}
          disabled={analyzing}
          minChars={80}
        />
      </div>

      {/* Analyzing indicator */}
      {analyzing && (
        <div className="flex items-center gap-2 text-sm text-purple-400">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          Analisando sua resposta...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <DebugBadge />
    </div>
  );
}
