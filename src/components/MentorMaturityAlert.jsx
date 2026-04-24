/**
 * MentorMaturityAlert
 * @description Card agregador na MentorDashboard listando apenas alunos com
 *              regressão detectada (`signalRegression.detected === true`).
 *              Cada linha é clicável para expandir detalhes (razões, gates
 *              pendentes, severity) e expõe callback opcional para navegação
 *              ao aluno. Reuso do hook `useMentorMaturityOverview` — sem
 *              listener novo. Retorna null quando não há regressão para não
 *              ocupar espaço no dashboard.
 *
 * Ref: issue #119 task 18 — Fase F (Mentor) fechamento.
 *      D15 §3.1 (card expandível) + INV-04 DebugBadge.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { STAGE_NAMES } from '../utils/maturityEngine/constants';
import { useRecomputeStudentMaturity } from '../hooks/useRecomputeStudentMaturity';
import DebugBadge from './DebugBadge';

const SEVERITY_CLASSES = {
  LOW: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  MED: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  HIGH: 'bg-red-500/10 text-red-300 border-red-500/30',
};

const SEVERITY_RANK = { HIGH: 3, MED: 2, LOW: 1 };

// Converte nextAllowedAt em epoch ms, aceitando número, Date ou Firestore Timestamp
function toEpochMs(nextAllowedAt) {
  if (nextAllowedAt == null) return null;
  if (typeof nextAllowedAt === 'number') return nextAllowedAt;
  if (nextAllowedAt instanceof Date) return nextAllowedAt.getTime();
  if (typeof nextAllowedAt === 'object' && typeof nextAllowedAt._seconds === 'number') {
    return nextAllowedAt._seconds * 1000;
  }
  const parsed = new Date(nextAllowedAt).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// Hook countdown que atualiza a cada segundo enquanto ativo; retorna segundos restantes
function useRemainingSeconds(nextAllowedAt, enabled) {
  const [remaining, setRemaining] = useState(() => {
    const ms = toEpochMs(nextAllowedAt);
    return ms == null ? 0 : Math.max(0, Math.ceil((ms - Date.now()) / 1000));
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const ms = toEpochMs(nextAllowedAt);
    if (ms == null) {
      setRemaining(0);
      return undefined;
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil((ms - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextAllowedAt, enabled]);
  return remaining;
}

// Sub-componente do botão refresh por linha (um hook por linha ativa).
// Extraído porque hooks não podem ser chamados dentro de .map() inline.
function MentorRefreshButton({
  studentId,
  isLoading,
  isThrottled,
  isError,
  refreshError,
  refreshNextAllowedAt,
  onRefresh,
}) {
  const remainingSec = useRemainingSeconds(refreshNextAllowedAt, isThrottled);
  const countdown = formatMMSS(remainingSec);
  const disabled = isLoading || (isThrottled && remainingSec > 0);
  const label = isLoading
    ? 'Atualizando...'
    : (isThrottled && remainingSec > 0 ? `Aguarde ${countdown}` : 'Atualizar maturidade');
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => onRefresh(studentId)}
        disabled={disabled}
        data-testid={`alert-refresh-${studentId}`}
        aria-label="Atualizar maturidade agora"
        className="text-xs text-slate-300 hover:text-white underline underline-offset-2 inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
      >
        <span
          aria-hidden="true"
          className={isLoading ? 'inline-block animate-spin' : 'inline-block'}
        >
          ↻
        </span>
        {label}
      </button>
      {isThrottled && remainingSec > 0 && (
        <span
          data-testid={`alert-refresh-throttled-${studentId}`}
          className="text-xs text-slate-400 font-mono"
        >
          Próxima em {countdown}
        </span>
      )}
      {isError && (
        <span
          data-testid={`alert-refresh-error-${studentId}`}
          className="text-xs text-red-300"
          title={refreshError?.message ?? 'Falha ao atualizar'}
        >
          Falha ao atualizar
        </span>
      )}
    </span>
  );
}

const MentorMaturityAlert = ({
  students = [],
  maturityMap = new Map(),
  onSelectStudent,
  embedded = false,
}) => {
  const alerts = useMemo(() => {
    const out = [];
    for (const s of students) {
      const m = maturityMap.get(s.id);
      if (!m?.signalRegression?.detected) continue;
      out.push({ student: s, maturity: m });
    }
    out.sort(
      (a, b) =>
        (SEVERITY_RANK[b.maturity.signalRegression?.severity] ?? 0) -
        (SEVERITY_RANK[a.maturity.signalRegression?.severity] ?? 0)
    );
    return out;
  }, [students, maturityMap]);

  const [expanded, setExpanded] = useState(() => new Set());
  const [activeRefreshId, setActiveRefreshId] = useState(null);
  const {
    recompute,
    loading: refreshLoading,
    error: refreshError,
    throttled: refreshThrottled,
    nextAllowedAt: refreshNextAllowedAt,
  } = useRecomputeStudentMaturity();

  if (alerts.length === 0) return null;

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = (studentId) => {
    setActiveRefreshId(studentId);
    recompute(studentId).catch(() => {});
  };

  return (
    <section
      className="bg-red-950/20 backdrop-blur border border-red-500/30 rounded-xl p-4 mb-4"
      data-testid="mentor-maturity-alert"
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-red-200 flex items-center gap-2">
          <span aria-hidden="true">⚠</span> Alertas de regressão
        </h3>
        <span
          className="text-xs text-red-400/80 bg-red-900/40 px-2 py-0.5 rounded"
          data-testid="mentor-alert-count"
        >
          {alerts.length}
        </span>
      </header>

      <ul className="space-y-2">
        {alerts.map(({ student, maturity }) => {
          const isOpen = expanded.has(student.id);
          const severity = maturity.signalRegression?.severity ?? 'LOW';
          const severityClass = SEVERITY_CLASSES[severity] ?? SEVERITY_CLASSES.LOW;
          const suggested = maturity.signalRegression?.suggestedStage;
          const current = maturity.currentStage;
          const reasons = Array.isArray(maturity.signalRegression?.reasons)
            ? maturity.signalRegression.reasons
            : [];
          const blockers = Array.isArray(maturity.proposedTransition?.blockers)
            ? maturity.proposedTransition.blockers
            : [];
          const gates = Array.isArray(maturity.gates) ? maturity.gates : [];
          const blockerGates = gates.filter((g) => blockers.includes(g.id));

          const displayName = student.name ?? student.email ?? 'Aluno';

          return (
            <li
              key={student.id}
              data-testid={`alert-row-${student.id}`}
              className="rounded bg-red-950/30 border border-red-500/20 p-2"
            >
              <button
                type="button"
                className="w-full flex items-center justify-between text-left gap-2"
                onClick={() => toggle(student.id)}
                aria-expanded={isOpen}
                aria-controls={`alert-detail-${student.id}`}
                data-testid={`alert-toggle-${student.id}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-red-300 flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
                  <span className="text-white font-medium truncate">{displayName}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border ${severityClass}`}
                    data-testid={`alert-severity-${student.id}`}
                  >
                    {severity}
                  </span>
                </span>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {current != null && suggested != null
                    ? `${STAGE_NAMES[current] ?? current} → sinal ${STAGE_NAMES[suggested] ?? suggested}`
                    : 'sinal detectado'}
                </span>
              </button>

              {isOpen && (
                <div
                  id={`alert-detail-${student.id}`}
                  data-testid={`alert-detail-${student.id}`}
                  className="mt-2 pl-5 space-y-2"
                >
                  {reasons.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Razões
                      </div>
                      <ul className="text-sm text-red-300 space-y-0.5">
                        {reasons.map((r, i) => (
                          <li key={i}>· {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {blockerGates.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Gates pendentes ({blockerGates.length})
                      </div>
                      <ul className="text-sm text-slate-300 space-y-0.5">
                        {blockerGates.map((g) => (
                          <li key={g.id}>
                            · {g.label}
                            {typeof g.value === 'number'
                              ? ` — ${g.value.toFixed(2)} vs ${g.threshold}`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-1 flex items-center gap-3 flex-wrap">
                    {onSelectStudent && (
                      <button
                        type="button"
                        className="text-xs text-slate-300 hover:text-white underline underline-offset-2"
                        onClick={() => onSelectStudent(student)}
                        data-testid={`alert-select-${student.id}`}
                      >
                        ver aluno
                      </button>
                    )}
                    {(() => {
                      const isActive = activeRefreshId === student.id;
                      const isLoading = isActive && refreshLoading;
                      const isThrottled = Boolean(isActive && refreshThrottled && !refreshLoading);
                      const isError = Boolean(isActive && refreshError && !refreshLoading);
                      return (
                        <MentorRefreshButton
                          studentId={student.id}
                          isLoading={isLoading}
                          isThrottled={isThrottled}
                          isError={isError}
                          refreshError={refreshError}
                          refreshNextAllowedAt={refreshNextAllowedAt}
                          onRefresh={handleRefresh}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!embedded && <DebugBadge component="MentorMaturityAlert" />}
    </section>
  );
};

export default MentorMaturityAlert;
