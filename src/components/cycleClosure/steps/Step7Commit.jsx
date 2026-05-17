/**
 * Step7Commit.jsx — Etapa 7: Forward Action Plan
 *
 * 1-2 commitments comportamentais (regra retro) + nextReviewDate + notes livres.
 * Sugestões via suggestForwardCommitments. Aluno aceita / edita / escreve do zero.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Calendar, FileText, Sparkles } from 'lucide-react';
import { suggestForwardCommitments } from '../../../utils/cycleClosure/forwardActionsHeuristics';

const MAX_COMMITMENTS = 2;
const MAX_NOTES = 1000;

function defaultNextReview(cycleEnd) {
  if (!cycleEnd) return '';
  const d = new Date(cycleEnd);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function Step7Commit({ cycleEnd, metrics, patterns, snapshot, forward, notes, onChange, onChangeNotes, onVisited }) {
  const suggestions = useMemo(
    () => suggestForwardCommitments({
      topErrorsList: (metrics?.topErrors || []).map((t) => (typeof t === 'string' ? { type: t } : t)),
      emotional: patterns?.emotional || {},
      eventCounts: patterns?.eventCounts || {},
      stopBreach: snapshot?.stopBreach || null,
    }),
    [metrics, patterns, snapshot],
  );

  const [val, setVal] = useState('');

  // Default nextReviewDate
  useEffect(() => {
    if (!forward.nextReviewDate && cycleEnd) {
      onChange({ ...forward, nextReviewDate: defaultNextReview(cycleEnd) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleEnd]);

  useEffect(() => {
    onVisited?.();
  }, [onVisited]);

  const commitments = forward.behavioralCommitments || [];
  const remaining = MAX_COMMITMENTS - commitments.length;

  const addCommitment = (item) => {
    if (commitments.length >= MAX_COMMITMENTS) return;
    if (commitments.includes(item)) return;
    onChange({ ...forward, behavioralCommitments: [...commitments, item] });
  };
  const removeCommitment = (idx) => {
    onChange({ ...forward, behavioralCommitments: commitments.filter((_, i) => i !== idx) });
  };

  const setNextReview = (val) => onChange({ ...forward, nextReviewDate: val });

  const availableSuggestions = suggestions.filter((s) => !commitments.includes(s));

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 border border-slate-700/40 bg-slate-800/20">
        <div className="flex items-center gap-2 text-xs">
          <span className="badge bg-slate-700/40 text-slate-300 border border-slate-600/50 text-[10px] uppercase tracking-wider">opcional</span>
          <p className="text-slate-400">Compromisso forçado vira ritual vazio. Se não tiver clareza agora, pode selar sem comprometer-se.</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-blue-500/20 text-blue-400 rounded-xl p-2.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-100 mb-1">Compromissos para o próximo ciclo</h3>
            <p className="text-xs text-slate-500">
              Máximo {MAX_COMMITMENTS} — muitos compromissos diluem o foco. Sugestões abaixo derivam dos seus erros e momentos baixos do ciclo.
            </p>
          </div>
        </div>

        {/* Commitments selecionados */}
        {commitments.length > 0 && (
          <ul className="space-y-2 mb-4">
            {commitments.map((c, idx) => (
              <li key={`${c}-${idx}`} className="flex items-start gap-3 bg-slate-800/40 border border-emerald-500/30 rounded-lg p-3">
                <span className="text-emerald-400 font-bold mt-0.5">{idx + 1}.</span>
                <span className="flex-1 text-sm text-slate-200">{c}</span>
                <button
                  type="button"
                  onClick={() => removeCommitment(idx)}
                  className="text-slate-500 hover:text-red-300"
                  title="Remover"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Sugestões */}
        {remaining > 0 && availableSuggestions.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> sugestões automáticas (heurística)
            </p>
            <div className="space-y-1.5">
              {availableSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addCommitment(s)}
                  className="w-full text-left flex items-center gap-2 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-300 transition"
                >
                  <Plus className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Free input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && val.trim() && remaining > 0) {
                addCommitment(val.trim());
                setVal('');
              }
            }}
            disabled={remaining <= 0}
            placeholder={remaining > 0 ? 'Ou escreva o seu compromisso...' : `${MAX_COMMITMENTS}/${MAX_COMMITMENTS} — máximo atingido`}
            className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled={remaining <= 0 || !val.trim()}
            onClick={() => { addCommitment(val.trim()); setVal(''); }}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Compromisso de revisitar */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="bg-purple-500/20 text-purple-400 rounded-xl p-2.5">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-100 mb-1">Quando você vai revisitar este ciclo</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compromisso <span className="text-slate-200 font-medium">seu</span> de voltar a este capítulo arquivado e reler decisões, SWOT e compromissos —
              checar se honrou o que escreveu. Sem isso, fechamento vira ritual vazio.
              <br />
              <span className="text-slate-500">Default: 7 dias após o fim do ciclo. Ajuste se quiser.</span>
            </p>
          </div>
        </div>
        <input
          type="date"
          value={forward.nextReviewDate || ''}
          onChange={(e) => setNextReview(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white"
        />
      </div>

      {/* Notes livres */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="bg-slate-700/50 text-slate-300 rounded-xl p-2.5">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-100 mb-1">Notas livres</h4>
            <p className="text-xs text-slate-500">Espaço pra escrever o que não cabe nas outras seções. Opcional.</p>
          </div>
        </div>
        <textarea
          rows={4}
          value={notes || ''}
          onChange={(e) => onChangeNotes(e.target.value.slice(0, MAX_NOTES))}
          placeholder="Pensamentos livres..."
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-slate-600 mt-1 text-right">
          {(notes || '').length} / {MAX_NOTES}
        </p>
      </div>
    </div>
  );
}
