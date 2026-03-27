/**
 * ProbingIntro.jsx
 * 
 * Tela de transição entre questionário base e sondagem adaptativa.
 * Mensagem transparente: "Baseado nas suas respostas, gostaríamos de aprofundar..." (DEC-016)
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React from 'react';
import DebugBadge from '../DebugBadge.jsx';

export default function ProbingIntro({ totalProbingQuestions, onStart, loading }) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Message */}
      <h2 className="text-xl font-medium text-white mb-3">
        Vamos aprofundar alguns pontos
      </h2>
      <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
        Baseado nas suas respostas, gostaríamos de entender melhor alguns aspectos 
        do seu perfil de trading. São {totalProbingQuestions || '3-5'} perguntas adicionais 
        que nos ajudarão a construir uma visão mais completa.
      </p>

      {/* Guidelines */}
      <div className="text-left bg-white/[0.02] border border-white/5 rounded-xl p-5 mb-8">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
          Para aproveitar ao máximo
        </p>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">›</span>
            Responda com honestidade — não existe resposta certa
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">›</span>
            Dê exemplos concretos quando possível
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">›</span>
            Leve o tempo que precisar para refletir
          </li>
        </ul>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        disabled={loading}
        className={`
          px-8 py-3 rounded-xl text-sm font-medium transition-all duration-200
          ${loading
            ? 'bg-white/5 text-gray-500 cursor-wait'
            : 'bg-purple-600 hover:bg-purple-500 text-white'
          }
        `}
      >
        {loading ? 'Preparando perguntas...' : 'Começar'}
      </button>

      <DebugBadge />
    </div>
  );
}
