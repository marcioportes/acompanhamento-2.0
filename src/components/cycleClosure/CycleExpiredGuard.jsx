/**
 * CycleExpiredGuard.jsx — banner com fila sequencial de ciclos vencidos
 *
 * Renderizado no StudentDashboard quando há ciclos vencidos pendentes de fechamento.
 * Lista cards (vermelho/amarelo/verde por urgência), só o primeiro é actionable
 * (próximo a ser fechado). Após selar, próximo desbloqueia automaticamente.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Props:
 *   - studentId: aluno cujos ciclos serão listados
 *   - role: 'student' | 'mentor' (mentor vê hint extra "fechar pelo aluno")
 *   - studentName?: string (mostrado quando role=mentor)
 *   - onStartClosure({planId, cycleKey, ...}): callback ao clicar Iniciar
 */

import React from 'react';
import { AlertTriangle, ChevronRight, Lock, GraduationCap } from 'lucide-react';
import useCycleExpiredQueue from '../../hooks/useCycleExpiredQueue';

function urgencyTone(daysOverdue) {
  if (daysOverdue <= 7) return { dot: 'bg-emerald-500', label: 'recente' };
  if (daysOverdue <= 30) return { dot: 'bg-amber-500', label: 'atenção' };
  return { dot: 'bg-red-500 animate-pulse', label: 'crítico' };
}

function fmtPct(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function QueueCard({ item, isMentor, onStart }) {
  const tone = urgencyTone(item.daysOverdue);
  const resultColor =
    typeof item.resultPercent === 'number'
      ? item.resultPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
      : 'text-slate-400';

  return (
    <div
      className={`bg-slate-800/40 rounded-xl p-4 border-2 transition ${
        item.actionable ? 'border-blue-500/40 ring-1 ring-blue-500/30' : 'border-slate-700/40 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Plano</p>
          <p className="text-sm font-semibold text-slate-100">{item.planName}</p>
        </div>
        <span className={`badge text-[10px] flex items-center gap-1 ${
          item.actionable
            ? `bg-${tone.label === 'crítico' ? 'red' : tone.label === 'atenção' ? 'amber' : 'emerald'}-500/20 text-${tone.label === 'crítico' ? 'red' : tone.label === 'atenção' ? 'amber' : 'emerald'}-300 border border-${tone.label === 'crítico' ? 'red' : tone.label === 'atenção' ? 'amber' : 'emerald'}-500/30`
            : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
          vencido {item.daysOverdue}d
        </span>
      </div>

      <p className="text-lg font-bold text-slate-100">{item.cycleKey}</p>
      <p className="text-[11px] text-slate-500 mb-3">
        {item.cycleStart} → {item.cycleEnd}
      </p>

      <div className="grid grid-cols-2 gap-2 text-[11px] mb-4">
        <div>
          <p className="text-slate-500">Resultado</p>
          <p className={`font-semibold mono ${resultColor}`}>{fmtPct(item.resultPercent)}</p>
        </div>
        <div>
          <p className="text-slate-500">Trades</p>
          <p className="font-semibold text-slate-200 mono">{item.tradesCount}</p>
        </div>
      </div>

      {item.actionable ? (
        <button
          type="button"
          onClick={() => onStart(item)}
          className="btn-primary w-full text-center text-xs flex items-center justify-center gap-1.5"
        >
          {isMentor ? <GraduationCap className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {isMentor ? 'Fechar pelo aluno (1:1)' : 'Iniciar fechamento'}
        </button>
      ) : (
        <button
          disabled
          className="w-full text-center text-xs py-2 px-3 rounded-lg bg-slate-800/40 text-slate-600 cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Lock className="w-3 h-3" />
          Bloqueado (sequencial)
        </button>
      )}
    </div>
  );
}

export default function CycleExpiredGuard({ studentId, role = 'student', studentName = null, onStartClosure, plans, trades }) {
  const { queue, loading } = useCycleExpiredQueue(studentId, { plans, trades });

  if (loading) return null;
  if (!queue || queue.length === 0) return null;

  const isMentor = role === 'mentor';
  const total = queue.length;

  return (
    <div className={`glass-card p-5 mb-6 border-l-4 ${isMentor ? 'border-purple-500' : 'border-amber-500'}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`${isMentor ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'} rounded-xl p-2.5`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold ${isMentor ? 'text-purple-100' : 'text-amber-100'} mb-1`}>
            {total} {total === 1 ? 'ciclo vencido' : 'ciclos vencidos'} pendente{total === 1 ? '' : 's'} de fechamento
            {isMentor && studentName && ` — ${studentName}`}
          </h3>
          <p className="text-sm text-slate-400">
            {isMentor
              ? 'Em sessão 1:1 você pode iniciar o fechamento e demonstrar Kelly+MC+SWOT na prática. Sequencial — comece pelo mais antigo.'
              : 'Ciclos precisam ser fechados em ordem cronológica para preservar integridade do histórico. Comece pelo mais antigo.'}
          </p>
        </div>
      </div>

      <div className={`grid gap-3 ${total >= 3 ? 'grid-cols-3' : total === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {queue.slice(0, 6).map((item) => (
          <QueueCard
            key={`${item.planId}_${item.cycleKey}`}
            item={item}
            isMentor={isMentor}
            onStart={onStartClosure}
          />
        ))}
      </div>

      {queue.length > 6 && (
        <p className="text-[11px] text-slate-500 mt-3 text-center">
          + {queue.length - 6} ciclos adicionais na fila — feche os primeiros para desbloquear
        </p>
      )}
    </div>
  );
}
