/**
 * BaselineReport.jsx
 *
 * Relatório Marco Zero — apresentado ao aluno após validação do mentor.
 *
 * Design: o aluno precisa entender (1) onde está em cada dimensão,
 * (2) onde fica isso na escala de referência, (3) o que precisa atacar.
 *
 * Não exibe calibração IA×Mentor — é dado interno do processo.
 * As prioridades exibidas são as confirmadas/editadas pelo mentor, não sugestões brutas da IA.
 *
 * DEC-027 (24/03/2026): régua de escala com 4 faixas por dimensão + plano do mentor.
 *
 * @version 2.0.1 — rename "Perfil de Maturidade", stageDiagnosis card full-width
 */

import React from 'react';
import DebugBadge from '../DebugBadge.jsx';

// ── Escalas por dimensão ────────────────────────────────────
const SCALES = {
  emotional: {
    label: 'Emocional',
    icon: '🧠',
    tiers: [
      { min: 0,  max: 50, label: 'FRAGILE',    color: 'bg-red-500',    textColor: 'text-red-400' },
      { min: 50, max: 65, label: 'DEVELOPING', color: 'bg-amber-500',  textColor: 'text-amber-400' },
      { min: 65, max: 85, label: 'LEARNER',    color: 'bg-yellow-400', textColor: 'text-yellow-400' },
      { min: 85, max: 100, label: 'SAGE',      color: 'bg-emerald-500',textColor: 'text-emerald-400' },
    ],
  },
  financial: {
    label: 'Financeiro',
    icon: '💰',
    tiers: [
      { min: 0,  max: 50, label: 'CRITICAL',    color: 'bg-red-500',    textColor: 'text-red-400' },
      { min: 50, max: 70, label: 'VULNERABLE',  color: 'bg-amber-500',  textColor: 'text-amber-400' },
      { min: 70, max: 85, label: 'SOLID',       color: 'bg-yellow-400', textColor: 'text-yellow-400' },
      { min: 85, max: 100, label: 'FORTIFIED',  color: 'bg-emerald-500',textColor: 'text-emerald-400' },
    ],
  },
  operational: {
    label: 'Operacional',
    icon: '⚙️',
    tiers: [
      { min: 0,  max: 50, label: 'MISMATCH',     color: 'bg-red-500',    textColor: 'text-red-400' },
      { min: 50, max: 70, label: 'PARTIAL FIT',  color: 'bg-amber-500',  textColor: 'text-amber-400' },
      { min: 70, max: 85, label: 'GOOD FIT',     color: 'bg-yellow-400', textColor: 'text-yellow-400' },
      { min: 85, max: 100, label: 'MASTERY FIT', color: 'bg-emerald-500',textColor: 'text-emerald-400' },
    ],
  },
  experience: {
    label: 'Maturidade',
    icon: '📈',
    tiers: [
      { min: 0,  max: 20, label: 'STAGE 1',  color: 'bg-red-500',    textColor: 'text-red-400',    sublabel: 'Caos' },
      { min: 20, max: 40, label: 'STAGE 2',  color: 'bg-amber-500',  textColor: 'text-amber-400',  sublabel: 'Reativo' },
      { min: 40, max: 60, label: 'STAGE 3',  color: 'bg-yellow-400', textColor: 'text-yellow-400', sublabel: 'Metódico' },
      { min: 60, max: 80, label: 'STAGE 4',  color: 'bg-blue-400',   textColor: 'text-blue-400',   sublabel: 'Profissional' },
      { min: 80, max: 100, label: 'STAGE 5', color: 'bg-emerald-500',textColor: 'text-emerald-400',sublabel: 'Mastery' },
    ],
  },
};

const COMPOSITE_TIERS = [
  { min: 0,  max: 40, label: 'AT RISK',           color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  { min: 40, max: 65, label: 'DEVELOPING TRADER', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  { min: 65, max: 80, label: 'COMMITTED LEARNER', color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { min: 80, max: 100, label: 'PROFESSIONAL TRADER', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
];

const DIMENSION_LABELS = {
  emotional: 'Emocional',
  financial: 'Financeiro',
  operational: 'Operacional',
  experience: 'Maturidade',
};

// ── Helpers ─────────────────────────────────────────────────

function getTierForScore(tiers, score) {
  if (score == null) return null;
  return tiers.find((t) => score >= t.min && score < t.max) || tiers[tiers.length - 1];
}

function getNextTier(tiers, score) {
  const currentIdx = tiers.findIndex((t) => score >= t.min && score < t.max);
  if (currentIdx === -1 || currentIdx === tiers.length - 1) return null;
  return tiers[currentIdx + 1];
}

// ── ScaleBar ─────────────────────────────────────────────────

function ScaleBar({ tiers, score }) {
  if (score == null) return null;
  const currentTier = getTierForScore(tiers, score);
  const nextTier = getNextTier(tiers, score);
  const ptsToNext = nextTier ? Math.ceil(nextTier.min - score) : 0;

  return (
    <div className="space-y-2">
      {/* Régua */}
      <div className="relative h-3 rounded-full overflow-hidden flex">
        {tiers.map((tier) => (
          <div
            key={tier.label}
            className={`${tier.color} opacity-30`}
            style={{ width: `${tier.max - tier.min}%` }}
          />
        ))}
        {/* Marcador do score */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${Math.min(score, 99)}%` }}
        />
      </div>

      {/* Labels das faixas */}
      <div className="flex" style={{ position: 'relative' }}>
        {tiers.map((tier) => (
          <div
            key={tier.label}
            className="text-center"
            style={{ width: `${tier.max - tier.min}%` }}
          >
            <span className={`text-[9px] font-medium uppercase tracking-wide ${
              currentTier?.label === tier.label ? tier.textColor : 'text-gray-600'
            }`}>
              {tier.sublabel || tier.label}
            </span>
            <div className="text-[8px] text-gray-700">{tier.min}</div>
          </div>
        ))}
      </div>

      {/* Posição atual + distância para próxima faixa */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${currentTier?.textColor || 'text-gray-400'}`}>
            {Math.round(score)}
          </span>
          <span className={`text-xs font-medium ${currentTier?.textColor || 'text-gray-400'}`}>
            {currentTier?.label}
          </span>
        </div>
        {nextTier && (
          <span className="text-[10px] text-gray-500">
            +{ptsToNext} pt{ptsToNext !== 1 ? 's' : ''} para{' '}
            <span className={nextTier.textColor}>{nextTier.sublabel || nextTier.label}</span>
          </span>
        )}
        {!nextTier && (
          <span className="text-[10px] text-emerald-500">Nível máximo</span>
        )}
      </div>
    </div>
  );
}

// ── DimensionCard ────────────────────────────────────────────

function DimensionCard({ dimensionKey, score, subScores }) {
  const scale = SCALES[dimensionKey];
  if (!scale) return null;

  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{scale.icon}</span>
        <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">
          {scale.label}
        </span>
      </div>

      <ScaleBar tiers={scale.tiers} score={score} />

      {/* Sub-scores */}
      {subScores && subScores.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          {subScores.map((sub) => sub.value != null && (
            <div key={sub.name} className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">{sub.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sub.value >= 80 ? 'bg-emerald-500'
                        : sub.value >= 65 ? 'bg-yellow-400'
                        : sub.value >= 50 ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(sub.value, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-400 tabular-nums w-6 text-right">
                  {Math.round(sub.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function BaselineReport({ assessment, stageDiagnosis: stageDiagnosisProp }) {
  if (!assessment) return null;

  // stageDiagnosis: prop em tempo real (mentor) ou campo do Firestore (aluno/acesso posterior)
  const stageDiagnosis = stageDiagnosisProp || assessment?.stage_diagnosis || null;

  const {
    emotional,
    financial,
    operational,
    experience,
    composite_score,
    composite_label,
    profile_name,
    development_priorities,
    next_review_date,
  } = assessment;

  const compositeTier = getTierForScore(COMPOSITE_TIERS, composite_score);

  return (
    <div className="space-y-8">

      {/* Header — Perfil composto */}
      <div className={`text-center p-6 rounded-2xl border ${compositeTier?.bg || 'border-white/10 bg-white/[0.02]'}`}>
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Perfil de Maturidade</p>
        <div className={`text-3xl font-bold tabular-nums mb-1 ${compositeTier?.color || 'text-gray-400'}`}>
          {composite_score != null ? Math.round(composite_score * 10) / 10 : '—'}
        </div>
        <div className={`text-sm font-semibold mb-1 ${compositeTier?.color || 'text-gray-400'}`}>
          {composite_label || compositeTier?.label || '—'}
        </div>
        {profile_name && (
          <div className="text-xs text-gray-500 italic mt-1">{profile_name}</div>
        )}
        <p className="text-[10px] text-gray-600 mt-3">
          Score composto: Emocional 25% · Financeiro 25% · Operacional 20% · Maturidade 30%
        </p>
      </div>

      {/* 4 Dimensões com régua — grid 2x2 */}
      <div className="grid grid-cols-2 gap-4">
        <DimensionCard
          dimensionKey="emotional"
          score={emotional?.score}
          subScores={[
            { name: 'Reconhecimento', value: emotional?.recognition?.mentorScore ?? emotional?.recognition },
            { name: 'Regulação', value: emotional?.regulation?.mentorScore ?? emotional?.regulation },
            { name: 'Locus de Controle', value: emotional?.locus?.mentorScore ?? emotional?.locus },
          ]}
        />
        <DimensionCard
          dimensionKey="financial"
          score={financial?.score}
          subScores={[
            { name: 'Disciplina', value: financial?.discipline?.mentorScore ?? financial?.discipline },
            { name: 'Gestão de Perdas', value: financial?.loss_management?.mentorScore ?? financial?.loss_management },
            { name: 'Gestão de Ganhos', value: financial?.profit_taking?.mentorScore ?? financial?.profit_taking },
          ]}
        />
        <DimensionCard
          dimensionKey="operational"
          score={operational?.fit_score ?? operational?.score}
          subScores={[
            { name: 'Modo de Decisão', value: operational?.decision_mode?.mentorScore ?? operational?.decision_mode },
            { name: 'Timeframe', value: operational?.timeframe?.mentorScore ?? operational?.timeframe },
            { name: 'Estratégia', value: operational?.strategy_fit?.mentorScore ?? operational?.strategy_fit },
            { name: 'Tracking', value: operational?.tracking?.mentorScore ?? operational?.tracking },
          ]}
        />
        <DimensionCard
          dimensionKey="experience"
          score={experience?.stage_score}
          subScores={experience?.gates_total > 0 ? [
            {
              name: `Gates Stage ${(experience.stage || 1) + 1} (${experience.gates_met || 0}/${experience.gates_total})`,
              value: (experience.gates_met / experience.gates_total) * 100,
            },
          ] : []}
        />

      </div>

      {/* Justificativa da IA para o diagnóstico de Maturidade — full width */}
      {stageDiagnosis?.justification && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium mb-2">
            Por que Stage {experience?.stage} — {['', 'Caos', 'Reativo', 'Metódico', 'Profissional', 'Mastery'][experience?.stage] || ''}
          </p>
          <p className="text-xs text-gray-300 leading-relaxed">
            {stageDiagnosis.justification}
          </p>
          {stageDiagnosis.keySignals?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-500/10 flex flex-wrap gap-1.5">
              {stageDiagnosis.keySignals.map((signal, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400/80 rounded">
                  {signal}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plano de Desenvolvimento */}
      {development_priorities && development_priorities.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Plano de Desenvolvimento — definido pelo seu mentor
          </h3>
          <div className="space-y-2">
            {development_priorities.map((p) => (
              <div
                key={p.rank}
                className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                  {p.rank}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{p.priority}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {DIMENSION_LABELS[p.dimension] || p.dimension} · Foco:{' '}
                    {p.months} {p.months === 1 ? 'mês' : 'meses'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próxima revisão */}
      {next_review_date && (
        <div className="text-center p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <p className="text-xs text-gray-500 mb-1">Próxima revisão com seu mentor</p>
          <p className="text-sm text-blue-400 font-medium">
            {new Date(
              next_review_date.seconds
                ? next_review_date.seconds * 1000
                : next_review_date
            ).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}

      <DebugBadge component="BaselineReport" />
    </div>
  );
}
