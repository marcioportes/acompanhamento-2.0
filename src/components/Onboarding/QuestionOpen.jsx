/**
 * QuestionOpen.jsx
 * 
 * Renderiza uma pergunta aberta com textarea, contador de caracteres,
 * e validação de mínimo (50 chars para base, 80 para sondagem).
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React, { useState, useCallback } from 'react';

export default function QuestionOpen({ question, savedText, onSubmit, disabled, minChars }) {
  const [text, setText] = useState(savedText || '');
  const effectiveMinChars = minChars || question?.minChars || 50;
  const charCount = text.length;
  const isValid = charCount >= effectiveMinChars;

  const handleSubmit = useCallback(() => {
    if (isValid && onSubmit) {
      onSubmit(text);
    }
  }, [text, isValid, onSubmit]);

  if (!question) return null;

  return (
    <div className="space-y-4">
      {/* Question text */}
      <h3 className="text-lg font-medium text-white leading-relaxed">
        {question.text}
      </h3>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          rows={6}
          placeholder="Escreva sua resposta aqui..."
          className={`
            w-full p-4 rounded-xl border bg-white/[0.02] text-white
            placeholder-gray-500 resize-none transition-all duration-200
            focus:outline-none focus:ring-2
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${isValid
              ? 'border-white/20 focus:border-blue-500 focus:ring-blue-500/20'
              : 'border-white/10 focus:border-amber-500 focus:ring-amber-500/20'
            }
          `}
        />

        {/* Char counter */}
        <div className={`
          absolute bottom-3 right-3 text-xs transition-colors
          ${charCount === 0
            ? 'text-gray-600'
            : isValid
              ? 'text-green-500/70'
              : charCount >= effectiveMinChars * 0.7
                ? 'text-amber-500/70'
                : 'text-gray-500'
          }
        `}>
          {charCount} / {effectiveMinChars} min
        </div>
      </div>

      {/* Validation message */}
      {charCount > 0 && !isValid && (
        <p className="text-xs text-amber-500/80">
          Mínimo de {effectiveMinChars} caracteres para prosseguir ({effectiveMinChars - charCount} restantes)
        </p>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || disabled}
        className={`
          px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
          ${isValid && !disabled
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
            : 'bg-white/5 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        Confirmar resposta
      </button>
    </div>
  );
}
