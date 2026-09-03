/**
 * ExplainerCard.jsx — casca expansível dos modelos da etapa Ajustar.
 *
 * Issue #418. Generalização visual do `GateCard` (Step5Check.jsx), sem
 * refatorá-lo: o `GateCard` carrega semântica de gate (met/gap/threshold/dim)
 * que não existe aqui, e unificar os dois agora seria AP-03 (Optimistic Reuse).
 * A duplicação é deliberada e está registrada.
 *
 * Expansível e não tooltip: `title=` não existe em touch.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const TONE = {
  positive: 'text-emerald-300',
  caution: 'text-amber-300',
  neutral: 'text-slate-200',
  unavailable: 'text-slate-400',
};

export default function ExplainerCard({
  explainer, reading, keyValue, preview, expanded, onToggle, children,
}) {
  const tone = TONE[reading?.tone] || TONE.neutral;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 transition">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!!expanded}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-800/40 transition rounded-lg"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-100 leading-snug">{explainer.friendlyLabel}</p>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{explainer.technicalLabel}</span>
          </div>
          {keyValue && <p className={`text-lg font-bold mono mt-0.5 ${tone}`}>{keyValue}</p>}
          {reading?.headline && (
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{reading.headline}</p>
          )}
          {/* `preview` fica visível com o card FECHADO: é o número que o aluno
              precisa ver sem ter de abrir nada. Só texto — conteúdo interativo
              aqui dentro seria botão dentro de botão. */}
          {preview && <div className="mt-1.5">{preview}</div>}
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
          : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/30 space-y-3">
          {children}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">O que é</p>
            <p className="text-xs text-slate-300 leading-relaxed">{explainer.whatIs}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Por que existe</p>
            <p className="text-xs text-slate-300 leading-relaxed">{explainer.whyExists}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-400 mb-0.5">O que muda na sua decisão</p>
            <p className="text-xs text-slate-300 leading-relaxed">{explainer.soWhat}</p>
          </div>
          {reading?.note && (
            <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-700/30 pt-2">
              {reading.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
