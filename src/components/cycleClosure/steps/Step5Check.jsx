/**
 * Step5Check.jsx — Etapa 5: Maturity Gates Check
 *
 * Read-only display dos scores 4D + gates do estágio atual + promotionEligible.
 * Aluno só promove se eligible. Mentor vê atalho pra override discricionário (com rationale).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo } from 'react';
import { Award, ShieldAlert, Check, X } from 'lucide-react';
import useMaturity from '../../../hooks/useMaturity';

const STAGE_NAMES_PT = ['Caos', 'Reativo', 'Metódico', 'Profissional', 'Maestria'];

function GateRow({ label, value, threshold, met, unit = '' }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2">
        {met ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
        <span className={met ? 'text-slate-300' : 'text-red-200 font-medium'}>{label}</span>
      </div>
      <span className={`mono text-xs ${met ? 'text-slate-400' : 'text-red-400'}`}>
        {value}{unit} {met ? '≥' : '<'} {threshold}{unit}
      </span>
    </div>
  );
}

function ScoreBar({ label, value, deltaFromPrior }) {
  if (typeof value !== 'number') {
    return (
      <div className="bg-slate-800/30 rounded-lg p-3">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-slate-500 italic text-xs mt-1">aguarda dados</p>
      </div>
    );
  }
  const delta = typeof deltaFromPrior === 'number' ? deltaFromPrior : null;
  const arrow = delta == null ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
  const arrowCls = delta == null ? 'text-slate-500' : delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500';
  return (
    <div className="bg-slate-800/30 rounded-lg p-3">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline justify-between">
        <p className="text-xl font-bold text-slate-100 mono">{Math.round(value)}</p>
        {delta != null && (
          <span className={`text-xs ${arrowCls}`}>
            {arrow} {Math.abs(delta).toFixed(1)} pts
          </span>
        )}
      </div>
      <div className="gauge-bar mt-2">
        <div className="gauge-fill bg-gradient-to-r from-amber-500 to-emerald-500" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

export default function Step5Check({ studentId, role = 'student', onMaturity }) {
  const { maturity, loading } = useMaturity(studentId);

  const gateRows = useMemo(() => {
    if (!maturity?.gates || typeof maturity.gates !== 'object') return [];
    return Object.entries(maturity.gates).map(([key, gate]) => ({
      key,
      label: gate?.label || key,
      value: gate?.value ?? '?',
      threshold: gate?.threshold ?? '?',
      met: gate?.met === true,
    }));
  }, [maturity]);

  const promotionEligible = maturity?.proposedTransition === 'PROMOTE';
  const regression = Array.isArray(maturity?.regression) ? maturity.regression : [];

  useEffect(() => {
    if (maturity) {
      onMaturity?.({
        scores: maturity.scores || null,
        deltaFromPrior: maturity.deltaFromPrior || null,
        currentStage: maturity.currentStage,
        stageGates: maturity.gates || {},
        promotionEligible,
        regression,
        mentorOverride: null,    // só populado se mentor abrir o modal de override (A7)
      });
    }
  }, [maturity, promotionEligible, regression, onMaturity]);

  if (loading) {
    return <div className="glass-card p-8 text-center text-slate-400">Carregando snapshot de maturidade...</div>;
  }

  if (!maturity) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-slate-300 font-semibold mb-2">Snapshot de maturidade indisponível</p>
        <p className="text-sm text-slate-500">
          O motor de maturidade ainda não rodou pra este aluno. O ritual continua, mas a etapa de gates fica vazia.
        </p>
      </div>
    );
  }

  const stage = maturity.currentStage;
  const stageLabel = stage ? `Stage ${stage} — ${STAGE_NAMES_PT[stage - 1] || '?'}` : 'Stage indefinido';
  const composite = maturity?.scores?.composite;

  return (
    <div className="glass-card p-8 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          Onde você está na evolução
        </h3>
        <p className="text-sm text-slate-400">
          Snapshot 4D do framework. Auto-deriva dos dados do ciclo + assessments registrados.
        </p>
      </div>

      <div className="bg-gradient-to-r from-amber-500/5 to-purple-500/5 border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-baseline justify-between mb-1">
          <p className="font-semibold text-slate-100">{stageLabel}</p>
          {typeof composite === 'number' && (
            <p className="text-sm text-slate-400 mono">{composite.toFixed(1)} / 100</p>
          )}
        </div>
        {regression.length > 0 && (
          <p className="text-xs text-red-300 mt-1 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Regressão detectada: {regression.join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <ScoreBar label="Emocional" value={maturity?.scores?.emotional} deltaFromPrior={maturity?.deltaFromPrior?.emotional} />
        <ScoreBar label="Financeiro" value={maturity?.scores?.financial} deltaFromPrior={maturity?.deltaFromPrior?.financial} />
        <ScoreBar label="Operacional" value={maturity?.scores?.operational} deltaFromPrior={maturity?.deltaFromPrior?.operational} />
        <ScoreBar label="Experiência" value={maturity?.scores?.experience} deltaFromPrior={maturity?.deltaFromPrior?.experience} />
      </div>

      {gateRows.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Gates do próximo estágio</h4>
          <div className="bg-slate-800/30 rounded-xl p-4 space-y-1">
            {gateRows.map((g) => (
              <GateRow key={g.key} label={g.label} value={g.value} threshold={g.threshold} met={g.met} />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {gateRows.filter((g) => g.met).length} / {gateRows.length} gates atendidos
          </p>
        </section>
      )}

      {promotionEligible ? (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4">
          <p className="text-sm font-semibold text-emerald-300 mb-1">✨ Pronto para promoção</p>
          <p className="text-xs text-slate-300">
            Todos os gates atendidos. Promoção registrada no fechamento.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-300 mb-1">
            Aguardando estabilizar gates
          </p>
          <p className="text-xs text-slate-500">
            Continue respeitando regra e disciplina — promoção será sinalizada automaticamente quando elegível.
          </p>
          {role === 'mentor' && (
            <button
              type="button"
              className="btn-secondary text-xs mt-3"
              onClick={() => alert('A7 — fluxo de override de stage virá em fase posterior.')}
            >
              🛡 Override discricionário (mentor)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
