/**
 * QuestionClosed.jsx
 * 
 * Renderiza uma pergunta fechada com 5 opções randomizadas.
 * Scores são ocultos — mapeamento acontece no backend.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React, { useState } from 'react';

export default function QuestionClosed({ question, orderedOptions, selectedOptionId, onSelect, disabled }) {
  const [hoveredId, setHoveredId] = useState(null);

  if (!question || !orderedOptions) return null;

  return (
    <div className="space-y-4">
      {/* Question text */}
      <h3 className="text-lg font-medium text-white leading-relaxed">
        {question.text}
      </h3>

      {/* Options */}
      <div className="space-y-3">
        {orderedOptions.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isHovered = hoveredId === option.id;

          return (
            <button
              key={option.id}
              onClick={() => !disabled && onSelect(option.id)}
              onMouseEnter={() => setHoveredId(option.id)}
              onMouseLeave={() => setHoveredId(null)}
              disabled={disabled}
              className={`
                w-full text-left p-4 rounded-xl border transition-all duration-200
                ${isSelected
                  ? 'border-blue-500 bg-blue-500/10 text-white shadow-lg shadow-blue-500/10'
                  : isHovered
                    ? 'border-white/30 bg-white/5 text-white'
                    : 'border-white/10 bg-white/[0.02] text-gray-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Radio indicator */}
                <div className={`
                  mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0
                  flex items-center justify-center transition-all
                  ${isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-white/30'
                  }
                `}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>

                {/* Option text */}
                <span className="text-sm leading-relaxed">
                  {option.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
