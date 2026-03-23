/**
 * BaselineReport.jsx
 * 
 * Relatório final pós-validação do mentor (marco zero completo).
 * Mostra scores finais (mentor), calibração IA vs mentor, flags resolvidos,
 * prioridades de desenvolvimento e próxima revisão.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React from 'react';
import TraderProfileCard from './TraderProfileCard.jsx';
import DebugBadge from '../DebugBadge.jsx';

function CalibrationRow({ dimension, iaScore, mentorScore }) {
  const delta = mentorScore != null && iaScore != null ? mentorScore - iaScore : null;
  const deltaColor = delta == null ? 'text-gray-500'
    : delta > 0 ? 'text-emerald-400'
    : delta < 0 ? 'text-red-400'
    : 'text-gray-400';

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-400 capitalize">{dimension}</span>
      <div className="flex items-center gap-4 text-xs font-mono">
        <span className="text-gray-500 w-8 text-right">{iaScore != null ? Math.round(iaScore) : '—'}</span>
        <span className="text-gray-600">→</span>
        <span className="text-white w-8 text-right">{mentorScore != null ? Math.round(mentorScore) : '—'}</span>
        <span className={`w-10 text-right ${deltaColor}`}>
          {delta != null ? `${delta >= 0 ? '+' : ''}${Math.round(delta)}` : '—'}
        </span>
      </div>
    </div>
  );
}

export default function BaselineReport({ assessment }) {
  if (!assessment) return null;

  const { emotional, financial, operational, experience, composite_score, composite_label, profile_name, calibration, development_priorities, next_review_date, inter_dimensional_flags } = assessment;

  // Build scores object for TraderProfileCard
  const scores = {
    emotional: { score: emotional?.score, recognition: emotional?.recognition?.mentorScore, regulation: emotional?.regulation?.mentorScore, locus: emotional?.locus?.mentorScore },
    financial: { score: financial?.score, discipline: financial?.discipline?.mentorScore, loss_management: financial?.loss_management?.mentorScore, profit_taking: financial?.profit_taking?.mentorScore },
    operational: { score: operational?.fit_score, decision_mode: operational?.decision_mode?.mentorScore, timeframe: operational?.timeframe?.mentorScore, strategy_fit: operational?.strategy_fit?.mentorScore, tracking: operational?.tracking?.mentorScore, emotion_control: operational?.emotion_control },
    experience: { score: experience?.stage_score, stage: experience?.stage, gates_met: experience?.gates_met || 0, gates_total: experience?.gates_total || 0 },
    composite: composite_score,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-medium text-white mb-1">Marco Zero</h2>
        <p className="text-sm text-gray-500">
          Assessment validado pelo mentor — baseline para acompanhamento evolutivo
        </p>
      </div>

      {/* Profile Card */}
      <TraderProfileCard
        scores={scores}
        classifications={null} // Will derive from scores
        profileName={profile_name}
        compositeScore={composite_score}
      />

      {/* Calibration: AI vs Mentor */}
      {calibration && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Calibração IA × Mentor
          </h3>
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
            <span className="text-[10px] text-gray-600 uppercase">Dimensão</span>
            <div className="flex items-center gap-4 text-[10px] text-gray-600 uppercase font-mono">
              <span className="w-8 text-right">IA</span>
              <span className="w-3"></span>
              <span className="w-8 text-right">Mentor</span>
              <span className="w-10 text-right">Delta</span>
            </div>
          </div>
          <CalibrationRow dimension="emocional" iaScore={emotional?.recognition?.aiScore != null ? emotional.score : null} mentorScore={emotional?.score} />
          <CalibrationRow dimension="financeiro" iaScore={financial?.score} mentorScore={financial?.score} />
          <CalibrationRow dimension="operacional" iaScore={operational?.fit_score} mentorScore={operational?.fit_score} />
          <CalibrationRow dimension="experiência" iaScore={experience?.stage_score} mentorScore={experience?.stage_score} />
          {calibration.average_delta != null && (
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase">Delta médio</span>
              <span className={`text-xs font-mono ${
                calibration.average_delta > 0 ? 'text-emerald-400' :
                calibration.average_delta < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {calibration.average_delta >= 0 ? '+' : ''}{calibration.average_delta.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Development Priorities */}
      {development_priorities && development_priorities.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Plano de Desenvolvimento
          </h3>
          <div className="space-y-2">
            {development_priorities.map((p) => (
              <div key={p.rank} className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                  {p.rank}
                </span>
                <div>
                  <p className="text-sm text-gray-300">{p.priority}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {p.dimension} · Foco: {p.months} {p.months === 1 ? 'mês' : 'meses'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next review */}
      {next_review_date && (
        <div className="text-center p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <p className="text-xs text-gray-500 mb-1">Próxima revisão</p>
          <p className="text-sm text-blue-400 font-medium">
            {new Date(next_review_date.seconds ? next_review_date.seconds * 1000 : next_review_date).toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}

      <DebugBadge />
    </div>
  );
}
