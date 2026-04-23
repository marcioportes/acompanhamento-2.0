/**
 * MaturityProgressionCard
 * @description Barra de progressão 5 stages × gates pendentes × regressão × narrativa IA.
 *              Puro/presentacional — recebe snapshot do motor de maturidade (§3.1 D10)
 *              e derivados de estado. Não consome hooks de dados. Componente reutilizável
 *              entre StudentDashboard (via `useMaturity`) e WeeklyReviewPage (via
 *              `useReviewMaturitySnapshot`).
 *
 * Layout literal: §3.1 D13. Cores: emerald (passado), amber (atual parcial),
 *                 gray (futuro), red (regressão), sky (amostra inicial).
 * INV-04: DebugBadge obrigatório quando !embedded.
 */

import React from 'react';
import DebugBadge from './DebugBadge';
import { STAGE_NAMES, STAGE_NAMES_SHORT } from '../utils/maturityEngine/constants';

const CONTAINER_CLS =
  'bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 relative';

const MAX_VISIBLE_GATES = 5;

function confidenceChipClass(c) {
  if (c === 'HIGH') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  if (c === 'MED') return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
}

function formatGateNumber(n) {
  if (n == null) return '—';
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(1)).toString();
}

// Normaliza valor/gap para exibição humana. Fractional (threshold 0..1) vira % e pp.
function formatGateValueGap(gate) {
  if (gate?.reason === 'METRIC_UNAVAILABLE') return null;
  const { threshold, value, gap } = gate ?? {};
  if (typeof threshold === 'boolean') return null;
  if (typeof threshold !== 'number') return null;
  if (value == null || gap == null) return null;

  if (threshold > 0 && threshold <= 1) {
    return {
      value: `${Math.round(value * 100)}%`,
      gap: `${Math.round(gap * 100)}pp`,
    };
  }
  return { value: formatGateNumber(value), gap: formatGateNumber(gap) };
}

function StageBar({ currentStage, gatesRatio, mastery }) {
  const segments = [1, 2, 3, 4, 5];
  const safeRatio = Math.max(0, Math.min(1, gatesRatio ?? 0));

  return (
    <div data-testid="stage-bar">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuenow={currentStage ?? 0}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-label="Progressão de maturidade"
      >
        {segments.map((s) => {
          let segmentCls = 'h-3 flex-1 rounded-sm overflow-hidden';
          let isCurrent = false;

          if (currentStage == null) {
            segmentCls += ' bg-gray-700';
          } else if (mastery || s < currentStage) {
            segmentCls += ' bg-emerald-500';
          } else if (s === currentStage) {
            segmentCls += ' bg-gray-700 relative';
            isCurrent = true;
          } else {
            segmentCls += ' bg-gray-700';
          }

          return (
            <div key={s} className={segmentCls} data-testid={`stage-seg-${s}`}>
              {isCurrent && (
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${safeRatio * 100}%` }}
                  data-testid={`stage-seg-${s}-fill`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {segments.map((s) => (
          <div
            key={s}
            className="flex-1 text-center text-[10px] sm:text-[11px] text-slate-400 font-mono uppercase truncate"
            data-testid={`stage-label-${s}`}
          >
            <span className="hidden sm:inline">{STAGE_NAMES[s]}</span>
            <span className="sm:hidden">{STAGE_NAMES_SHORT[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaturityProgressionCard({
  maturity = null,
  loading = false,
  error = null,
  embedded = false,
}) {
  const showDebug = !embedded;
  const debugBadge = showDebug ? <DebugBadge component="MaturityProgressionCard" /> : null;

  if (loading) {
    return (
      <div className={CONTAINER_CLS} data-testid="maturity-card">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-white text-sm">Progressão de Maturidade</h3>
        </div>
        <div className="flex gap-1" data-testid="maturity-skeleton">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-3 flex-1 rounded-sm bg-slate-800 animate-pulse" />
          ))}
        </div>
        {debugBadge}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-slate-900/50 backdrop-blur border border-red-500/50 rounded-xl p-4 relative"
        data-testid="maturity-card"
      >
        <h3 className="font-bold text-white text-sm mb-2">Progressão de Maturidade</h3>
        <p className="text-red-300 text-sm">Erro ao carregar maturidade</p>
        {debugBadge}
      </div>
    );
  }

  if (!maturity) {
    return (
      <div className={CONTAINER_CLS} data-testid="maturity-card">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-white text-sm">Progressão de Maturidade</h3>
        </div>
        <StageBar currentStage={null} gatesRatio={0} mastery={false} />
        <p className="text-slate-400 text-sm mt-3">
          Aguardando primeiro trade para calcular maturidade
        </p>
        {debugBadge}
      </div>
    );
  }

  const currentStage = maturity.currentStage ?? 1;
  const gatesRatio = maturity.gatesRatio ?? 0;
  const mastery = currentStage === 5;
  const currentStageName = STAGE_NAMES[currentStage] ?? '—';
  const nextStageName = STAGE_NAMES[currentStage + 1];
  const pendingGates = (maturity.gates ?? []).filter((g) => g?.met !== true);
  const visibleGates = pendingGates.slice(0, MAX_VISIBLE_GATES);
  const extraGates = pendingGates.length - visibleGates.length;
  const regression = maturity.signalRegression?.detected === true;
  const aiNarrative = maturity.aiNarrative;

  return (
    <div className={CONTAINER_CLS} data-testid="maturity-card">
      <div className="flex justify-between items-start mb-3 gap-2">
        <h3 className="font-bold text-white text-sm">Progressão de Maturidade</h3>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {maturity.sparseSample === true && (
            <span
              data-testid="sparse-sample-chip"
              className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono"
            >
              amostra inicial
            </span>
          )}
          <span
            data-testid="confidence-chip"
            className={`text-[10px] px-2 py-0.5 rounded font-mono ${confidenceChipClass(maturity.confidence)}`}
          >
            confidence: {maturity.confidence ?? 'LOW'}
          </span>
        </div>
      </div>

      <StageBar currentStage={currentStage} gatesRatio={gatesRatio} mastery={mastery} />

      <div className="mt-3 text-sm text-slate-300" data-testid="stage-summary">
        Stage atual: <span className="font-semibold text-white">{currentStageName}</span>
        {!mastery && nextStageName && (
          <>
            <span className="text-slate-500"> · </span>
            <span>
              {maturity.gatesMet ?? 0}/{maturity.gatesTotal ?? 0} gates para {nextStageName}
            </span>
          </>
        )}
      </div>

      {!mastery && visibleGates.length > 0 && (
        <div className="mt-3" data-testid="gates-pending">
          <p className="text-xs text-slate-400 font-semibold mb-1">Gates pendentes:</p>
          <ul className="text-xs text-slate-300 space-y-1">
            {visibleGates.map((g) => {
              const fmt = formatGateValueGap(g);
              const unavailable = g.reason === 'METRIC_UNAVAILABLE';
              return (
                <li
                  key={g.id}
                  className="flex gap-1.5"
                  data-testid={`gate-${g.id}`}
                >
                  <span className="text-slate-500">•</span>
                  <span>
                    {g.label}
                    {fmt && (
                      <span className="text-slate-400">
                        {' '}(você: {fmt.value}, faltam {fmt.gap})
                      </span>
                    )}
                    {unavailable && (
                      <span className="text-slate-500"> (aguardando dado)</span>
                    )}
                  </span>
                </li>
              );
            })}
            {extraGates > 0 && (
              <li className="text-slate-500 italic" data-testid="gates-overflow">
                ... e mais {extraGates} gates
              </li>
            )}
          </ul>
        </div>
      )}

      {mastery && (
        <div className="mt-3 text-xs text-slate-400" data-testid="mastery-note">
          Nenhum gate pendente — MASTERY alcançado.
        </div>
      )}

      {regression && (
        <div
          data-testid="regression-alert"
          className="mt-4 border border-red-500 rounded-lg p-3 bg-red-500/10"
        >
          <p className="text-red-300 font-semibold text-sm">
            ⚠ Seus números recentes sugerem revisão
          </p>
          <p className="text-red-300/90 text-xs mt-1">
            {maturity.signalRegression?.suggestedStage != null && (
              <>sinal recente: Stage {maturity.signalRegression.suggestedStage}</>
            )}
            {maturity.signalRegression?.reasons?.[0] && (
              <>
                {maturity.signalRegression?.suggestedStage != null ? ' · ' : ''}
                {maturity.signalRegression.reasons[0]}
              </>
            )}
          </p>
        </div>
      )}

      {aiNarrative && (
        <p
          data-testid="ai-narrative"
          className="whitespace-pre-wrap text-slate-300 text-sm mt-4"
        >
          {aiNarrative}
        </p>
      )}

      {debugBadge}
    </div>
  );
}

export default MaturityProgressionCard;
