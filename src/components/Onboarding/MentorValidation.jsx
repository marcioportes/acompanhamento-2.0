/**
 * MentorValidation.jsx
 *
 * Interface de validação do mentor. Recebe scores propostos pela IA,
 * permite confirmar com 1 clique ou ajustar com justificativa.
 *
 * v1.1.0: Seção "Plano de Desenvolvimento" — sugestões da IA pré-carregadas,
 * mentor confirma/edita/adiciona antes de validar. As prioridades confirmadas
 * são salvas no initial_assessment e apresentadas ao aluno no BaselineReport.
 *
 * Guarda: score_ia, score_mentor, override_justification, mentor_notes,
 *         developmentPriorities (confirmadas/editadas pelo mentor)
 *
 * Nota: emotion_control no operacional NÃO tem override aqui —
 * é derivado automaticamente do emotionalScore já validado.
 *
 * @version 1.1.0 — seção de desenvolvimento com sugestões IA (DEC-027)
 */

import React, { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DebugBadge from '../DebugBadge.jsx';

const DIMENSIONS = [
  { value: 'emotional', label: 'Emocional' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'operational', label: 'Operacional' },
  { value: 'experience', label: 'Maturidade' },
];

const MONTHS_OPTIONS = [1, 2, 3, 6, 12];

function SubDimensionRow({ name, aiScore, mentorScore, onScoreChange, notes, onNotesChange, readOnly }) {
  const hasOverride = mentorScore !== aiScore;

  return (
    <div className={`p-3 rounded-lg border ${hasOverride ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-300">{name}</span>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            IA: <span className="text-gray-400 font-mono">{aiScore != null ? Math.round(aiScore) : '—'}</span>
          </div>
          {readOnly ? (
            <div className="text-xs text-blue-400 font-mono font-medium">
              {mentorScore != null ? Math.round(mentorScore) : '—'}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              max="100"
              value={mentorScore ?? ''}
              onChange={(e) => onScoreChange(e.target.value === '' ? null : Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs text-center bg-white/5 border border-white/10 rounded text-white font-mono focus:outline-none focus:border-blue-500"
            />
          )}
        </div>
      </div>
      {!readOnly && (
        <input
          type="text"
          placeholder="Notas do mentor (opcional)"
          value={notes || ''}
          onChange={(e) => onNotesChange(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-white/[0.02] border border-white/5 rounded text-gray-400 placeholder-gray-600 focus:outline-none focus:border-white/20"
        />
      )}
    </div>
  );
}

function DimensionBlock({ title, icon, aiScore, subDimensions, onChange, readOnly }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">{title}</span>
        {aiScore != null && (
          <span className="ml-auto text-xs text-gray-500">
            Score IA: <span className="font-mono text-gray-400">{Math.round(aiScore)}</span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        {subDimensions.map((sub) => (
          <SubDimensionRow
            key={sub.key}
            name={sub.name}
            aiScore={sub.aiScore}
            mentorScore={sub.mentorScore}
            onScoreChange={(val) => onChange(sub.key, 'score', val)}
            notes={sub.notes}
            onNotesChange={(val) => onChange(sub.key, 'notes', val)}
            readOnly={readOnly || sub.readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function PriorityRow({ priority, index, onChange, onRemove, isAiSuggestion }) {
  return (
    <div className={`p-3 rounded-lg border ${isAiSuggestion ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={priority.priority}
            onChange={(e) => onChange(index, 'priority', e.target.value)}
            placeholder="Descreva a prioridade de desenvolvimento..."
            className="w-full px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2">
            <select
              value={priority.dimension}
              onChange={(e) => onChange(index, 'dimension', e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {DIMENSIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <select
              value={priority.months}
              onChange={(e) => onChange(index, 'months', Number(e.target.value))}
              className="w-28 px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {MONTHS_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} {m === 1 ? 'mês' : 'meses'}</option>
              ))}
            </select>
            <button
              onClick={() => onRemove(index)}
              className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="Remover prioridade"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {isAiSuggestion && (
        <p className="text-[10px] text-blue-400/60 ml-8">Sugestão da IA — edite conforme necessário</p>
      )}
    </div>
  );
}

export default function MentorValidation({ aiScores, aiClassifications, aiDevelopmentPriorities = [], onSave, saving }) {
  const [mentorData, setMentorData] = useState(() => {
    // Initialize mentor scores = AI scores (1-click confirm)
    return {
      emotional: {
        recognition: { score: aiScores?.emotional?.recognition, notes: '' },
        regulation: { score: aiScores?.emotional?.regulation, notes: '' },
        locus: { score: aiScores?.emotional?.locus, notes: '' },
      },
      financial: {
        discipline: { score: aiScores?.financial?.discipline, notes: '' },
        loss_management: { score: aiScores?.financial?.loss_management, notes: '' },
        profit_taking: { score: aiScores?.financial?.profit_taking, notes: '' },
      },
      operational: {
        decision_mode: { score: aiScores?.operational?.decision_mode, notes: '' },
        timeframe: { score: aiScores?.operational?.timeframe, notes: '' },
        strategy_fit: { score: aiScores?.operational?.strategy_fit, notes: '' },
        tracking: { score: aiScores?.operational?.tracking, notes: '' },
        // emotion_control: read-only, derived from emotional.score
      },
      overallNotes: '',
    };
  });

  // Prioridades: inicializadas com sugestões da IA, editáveis pelo mentor
  const [priorities, setPriorities] = useState(() =>
    (aiDevelopmentPriorities || []).map((p) => ({
      rank: p.rank,
      priority: p.priority || '',
      dimension: p.dimension || 'emotional',
      months: p.months || 1,
      _aiSuggestion: true, // marca origem para UI
    }))
  );

  const handleChange = useCallback((dimension, key, field, value) => {
    setMentorData((prev) => ({
      ...prev,
      [dimension]: {
        ...prev[dimension],
        [key]: {
          ...prev[dimension][key],
          [field]: value,
        },
      },
    }));
  }, []);

  const handlePriorityChange = useCallback((index, field, value) => {
    setPriorities((prev) => prev.map((p, i) =>
      i === index ? { ...p, [field]: value, _aiSuggestion: field === 'priority' ? false : p._aiSuggestion } : p
    ));
  }, []);

  const handlePriorityRemove = useCallback((index) => {
    setPriorities((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePriorityAdd = useCallback(() => {
    if (priorities.length >= 5) return;
    setPriorities((prev) => [...prev, {
      rank: prev.length + 1,
      priority: '',
      dimension: 'emotional',
      months: 1,
      _aiSuggestion: false,
    }]);
  }, [priorities.length]);

  const handleSave = useCallback(() => {
    if (onSave) {
      // Renumber ranks, strip internal _aiSuggestion flag
      const finalPriorities = priorities
        .filter((p) => p.priority.trim().length > 0)
        .map((p, i) => ({
          rank: i + 1,
          priority: p.priority.trim(),
          dimension: p.dimension,
          months: p.months,
        }));

      onSave({
        mentorData: {
          ...mentorData,
          developmentPriorities: finalPriorities,
        },
        interviewer: 'current_mentor',
      });
    }
  }, [mentorData, priorities, onSave]);

  if (!aiScores) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Validação do Mentor</h3>
        <p className="text-xs text-gray-500">
          Scores inicializados com valores da IA — confirme ou ajuste
        </p>
      </div>

      {/* Emotional */}
      <DimensionBlock
        title="Emocional"
        icon="🧠"
        aiScore={aiScores.emotional?.score}
        subDimensions={[
          { key: 'recognition', name: 'Reconhecimento', aiScore: aiScores.emotional?.recognition, mentorScore: mentorData.emotional.recognition.score, notes: mentorData.emotional.recognition.notes },
          { key: 'regulation', name: 'Regulação', aiScore: aiScores.emotional?.regulation, mentorScore: mentorData.emotional.regulation.score, notes: mentorData.emotional.regulation.notes },
          { key: 'locus', name: 'Locus de Controle', aiScore: aiScores.emotional?.locus, mentorScore: mentorData.emotional.locus.score, notes: mentorData.emotional.locus.notes },
        ]}
        onChange={(key, field, val) => handleChange('emotional', key, field, val)}
      />

      {/* Financial */}
      <DimensionBlock
        title="Financeiro"
        icon="💰"
        aiScore={aiScores.financial?.score}
        subDimensions={[
          { key: 'discipline', name: 'Disciplina', aiScore: aiScores.financial?.discipline, mentorScore: mentorData.financial.discipline.score, notes: mentorData.financial.discipline.notes },
          { key: 'loss_management', name: 'Gestão de Perdas', aiScore: aiScores.financial?.loss_management, mentorScore: mentorData.financial.loss_management.score, notes: mentorData.financial.loss_management.notes },
          { key: 'profit_taking', name: 'Gestão de Ganhos', aiScore: aiScores.financial?.profit_taking, mentorScore: mentorData.financial.profit_taking.score, notes: mentorData.financial.profit_taking.notes },
        ]}
        onChange={(key, field, val) => handleChange('financial', key, field, val)}
      />

      {/* Operational */}
      <DimensionBlock
        title="Operacional"
        icon="⚙️"
        aiScore={aiScores.operational?.score}
        subDimensions={[
          { key: 'decision_mode', name: 'Modo de Decisão', aiScore: aiScores.operational?.decision_mode, mentorScore: mentorData.operational.decision_mode.score, notes: mentorData.operational.decision_mode.notes },
          { key: 'timeframe', name: 'Timeframe', aiScore: aiScores.operational?.timeframe, mentorScore: mentorData.operational.timeframe.score, notes: mentorData.operational.timeframe.notes },
          { key: 'strategy_fit', name: 'Estratégia', aiScore: aiScores.operational?.strategy_fit, mentorScore: mentorData.operational.strategy_fit.score, notes: mentorData.operational.strategy_fit.notes },
          { key: 'tracking', name: 'Tracking', aiScore: aiScores.operational?.tracking, mentorScore: mentorData.operational.tracking.score, notes: mentorData.operational.tracking.notes },
          { key: 'emotion_control', name: 'Controle Emocional (herdado)', aiScore: aiScores.operational?.emotion_control, mentorScore: aiScores.operational?.emotion_control, readOnly: true },
        ]}
        onChange={(key, field, val) => handleChange('operational', key, field, val)}
      />

      {/* Development Priorities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-400 font-medium">
              Plano de Desenvolvimento
            </h4>
            <p className="text-[10px] text-gray-600 mt-0.5">
              Sugestões da IA pré-carregadas — edite, reordene ou adicione conforme a entrevista
            </p>
          </div>
          {priorities.length < 5 && (
            <button
              onClick={handlePriorityAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          )}
        </div>

        {priorities.length === 0 ? (
          <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02] text-center">
            <p className="text-xs text-gray-600">
              Nenhuma prioridade definida. Adicione até 5 prioridades de desenvolvimento.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <PriorityRow
                key={i}
                priority={p}
                index={i}
                onChange={handlePriorityChange}
                onRemove={handlePriorityRemove}
                isAiSuggestion={p._aiSuggestion}
              />
            ))}
          </div>
        )}
      </div>

      {/* Overall notes */}
      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2 block">
          Notas gerais da entrevista
        </label>
        <textarea
          value={mentorData.overallNotes}
          onChange={(e) => setMentorData((prev) => ({ ...prev, overallNotes: e.target.value }))}
          rows={4}
          placeholder="Observações da entrevista de validação..."
          className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`
            px-6 py-2.5 rounded-lg text-sm font-medium transition-all
            ${saving
              ? 'bg-white/5 text-gray-500 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
            }
          `}
        >
          {saving ? 'Salvando...' : 'Validar Assessment'}
        </button>
      </div>

      <DebugBadge component="MentorValidation" />
    </div>
  );
}
