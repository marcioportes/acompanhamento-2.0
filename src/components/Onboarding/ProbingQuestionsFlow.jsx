/**
 * ProbingQuestionsFlow.jsx
 * 
 * Fluxo de sondagem adaptativa (3-5 perguntas geradas pela IA).
 * Todas as perguntas são abertas com mínimo de 80 caracteres.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React, { useState } from 'react';
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

  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

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
          Aprofundamento concluído
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          Suas respostas serão analisadas e apresentadas ao seu mentor 
          para a entrevista de validação.
        </p>

        <button
          onClick={async () => {
            setCompleting(true);
            setCompleteError(null);
            try {
              await completeAllProbing();
              if (onComplete) onComplete();
            } catch (err) {
              setCompleteError('Erro ao finalizar. Tente novamente.');
            } finally {
              setCompleting(false);
            }
          }}
          disabled={completing}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2 mx-auto"
        >
          {completing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {completing ? 'Finalizando...' : 'Finalizar'}
        </button>

        {completeError && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {completeError}
          </div>
        )}

        <DebugBadge component="ProbingQuestionsFlow" />
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
            Aprofundamento adaptativo
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
          key={currentProbingQuestion.probingId || currentProbingIndex}
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
