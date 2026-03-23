/**
 * MentorValidation.jsx
 * 
 * Interface de validação do mentor. Recebe scores propostos pela IA,
 * permite confirmar com 1 clique ou ajustar com justificativa.
 * 
 * Guarda: score_ia, score_mentor, override_justification, mentor_notes
 * 
 * Nota: emotion_control no operacional NÃO tem override aqui —
 * é derivado automaticamente do emotionalScore já validado.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React, { useState, useCallback } from 'react';
import DebugBadge from '../DebugBadge.jsx';

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

export default function MentorValidation({ aiScores, aiClassifications, onSave, saving }) {
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

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({
        mentorData,
        interviewer: 'current_mentor', // Will be resolved from auth context
      });
    }
  }, [mentorData, onSave]);

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

      <DebugBadge />
    </div>
  );
}
