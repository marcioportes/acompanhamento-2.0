/**
 * TraderProfileCard.jsx
 * 
 * Card visual 4-quadrantes do perfil do trader.
 * Mostra scores + labels por dimensão com cores semânticas.
 * Centro: composite score + profile name.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import React from 'react';
import DebugBadge from '../DebugBadge.jsx';

function getScoreColor(score) {
  if (score == null) return 'text-gray-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBg(score) {
  if (score == null) return 'bg-gray-500/10 border-gray-500/20';
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

// Cor baseada no stage de Maturidade — não no score numérico
// Stage 1-2 é o estado inicial esperado, não um sinal de alarme
function getStageColor(stage) {
  if (stage == null) return 'text-gray-500';
  if (stage >= 4) return 'text-emerald-400';
  if (stage >= 3) return 'text-yellow-400';
  if (stage >= 2) return 'text-amber-400';
  return 'text-orange-400';
}

function getStageBg(stage) {
  if (stage == null) return 'bg-gray-500/10 border-gray-500/20';
  if (stage >= 4) return 'bg-emerald-500/10 border-emerald-500/20';
  if (stage >= 3) return 'bg-yellow-400/10 border-yellow-400/20';
  if (stage >= 2) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-orange-500/10 border-orange-500/20';
}

function QuadrantCard({ title, score, label, icon, subScores, stage }) {
  // Se stage fornecido (Maturidade), usa escala de stage; senão usa escala de score
  const color = stage != null ? getStageColor(stage) : getScoreColor(score);
  const bg = stage != null ? getStageBg(stage) : getScoreBg(score);

  return (
    <div className={`p-4 rounded-xl border ${bg} transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">
            {title}
          </span>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${color}`}>
          {score != null ? Math.round(score) : '—'}
        </span>
      </div>

      {label && (
        <div className={`text-xs font-medium mb-3 ${color}`}>
          {label}
        </div>
      )}

      {subScores && subScores.length > 0 && (
        <div className="space-y-1.5">
          {subScores.map((sub) => (
            <div key={sub.name} className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">{sub.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sub.value >= 80 ? 'bg-emerald-500'
                        : sub.value >= 50 ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(sub.value || 0, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-400 tabular-nums w-6 text-right">
                  {sub.value != null ? Math.round(sub.value) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TraderProfileCard({ scores, classifications, profileName, compositeScore }) {
  if (!scores) return null;

  return (
    <div className="space-y-4">
      {/* Composite center */}
      <div className={`text-center p-6 rounded-2xl border ${getScoreBg(compositeScore)}`}>
        <div className={`text-4xl font-bold tabular-nums mb-1 ${getScoreColor(compositeScore)}`}>
          {compositeScore != null ? Math.round(compositeScore * 10) / 10 : '—'}
        </div>
        <div className={`text-sm font-medium mb-1 ${getScoreColor(compositeScore)}`}>
          {classifications?.composite?.label || '—'}
        </div>
        {profileName && (
          <div className="text-xs text-gray-500 italic">
            {profileName}
          </div>
        )}
      </div>

      {/* 4 Quadrants */}
      <div className="grid grid-cols-2 gap-3">
        <QuadrantCard
          title="Emocional"
          icon="🧠"
          score={scores.emotional?.score}
          label={classifications?.emotional?.profile?.label}
          subScores={[
            { name: 'Reconhecimento', value: scores.emotional?.recognition },
            { name: 'Regulação', value: scores.emotional?.regulation },
            { name: 'Locus', value: scores.emotional?.locus },
          ]}
        />
        <QuadrantCard
          title="Financeiro"
          icon="💰"
          score={scores.financial?.score}
          label={classifications?.financial?.status?.label}
          subScores={[
            { name: 'Disciplina', value: scores.financial?.discipline },
            { name: 'Gestão Perdas', value: scores.financial?.loss_management },
            { name: 'Gestão Ganhos', value: scores.financial?.profit_taking },
          ]}
        />
        <QuadrantCard
          title="Operacional"
          icon="⚙️"
          score={scores.operational?.score}
          label={classifications?.operational?.fit?.label}
          subScores={[
            { name: 'Decisão', value: scores.operational?.decision_mode },
            { name: 'Timeframe', value: scores.operational?.timeframe },
            { name: 'Estratégia', value: scores.operational?.strategy_fit },
            { name: 'Tracking', value: scores.operational?.tracking },
            { name: 'Controle Emo.', value: scores.operational?.emotion_control },
          ]}
        />
        <QuadrantCard
          title="Maturidade"
          icon="📈"
          score={scores.experience?.score}
          stage={scores.experience?.stage}
          label={classifications?.experience?.stage?.label}
          subScores={[
            { name: `Stage ${scores.experience?.stage || '—'}`, value: scores.experience?.score },
            { name: 'Gates', value: scores.experience?.gates_total > 0 ? (scores.experience?.gates_met / scores.experience?.gates_total) * 100 : 0 },
          ]}
        />
      </div>

      <DebugBadge component="TraderProfileCard" />
    </div>
  );
}
