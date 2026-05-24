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

const MONTH_LABELS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function cycleKeyToLabel(cycleKey) {
  if (!cycleKey) return '—';
  const monthly = cycleKey.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (monthly) return `${MONTH_LABELS_PT[parseInt(monthly[2], 10) - 1]} ${monthly[1]}`;
  const quarter = cycleKey.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return `${quarter[2]}º trimestre ${quarter[1]}`;
  const semester = cycleKey.match(/^(\d{4})-S([12])$/);
  if (semester) return `${semester[2]}º semestre ${semester[1]}`;
  if (/^\d{4}$/.test(cycleKey)) return `Ano ${cycleKey}`;
  return cycleKey;
}

// Mapas estáticos — Tailwind precisa das classes literais pra não purgar no build
const URGENCY = {
  recente: { dot: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  atencao: { dot: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  critico: { dot: 'bg-red-500 animate-pulse', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function urgencyKey(daysOverdue) {
  if (daysOverdue <= 7) return 'recente';
  if (daysOverdue <= 30) return 'atencao';
  return 'critico';
}

function fmtPct(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function QueueCard({ item, isMentor, onStart }) {
  const tone = URGENCY[urgencyKey(item.daysOverdue)];
  const resultColor =
    typeof item.resultPercent === 'number'
      ? item.resultPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
      : 'text-slate-400';

  const containerCls = item.actionable
    ? 'bg-slate-800/40 border-blue-500/40 hover:bg-slate-800/60'
    : 'bg-slate-800/20 border-slate-700/40 opacity-60';

  return (
    <div className={`rounded-lg p-3 border transition ${containerCls}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-base font-bold text-slate-100 truncate">{cycleKeyToLabel(item.cycleKey)}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${item.actionable ? tone.badge : 'bg-slate-500/20 text-slate-400 border-slate-500/30'} flex items-center gap-1 flex-shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
          {item.daysOverdue}d
        </span>
      </div>

      <p className="text-[11px] text-slate-500 truncate mb-3">{item.planName}</p>

      <div className="flex items-baseline justify-between text-xs mb-3">
        <span className={`font-semibold mono ${resultColor}`}>{fmtPct(item.resultPercent)}</span>
        <span className="text-slate-500">{item.tradesCount} {item.tradesCount === 1 ? 'trade' : 'trades'}</span>
      </div>

      {item.actionable ? (
        <button
          type="button"
          onClick={() => onStart(item)}
          className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 py-1.5"
        >
          {isMentor ? <GraduationCap className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {isMentor ? 'Fechar pelo aluno' : 'Fechar ciclo'}
        </button>
      ) : (
        <div className="w-full text-[11px] py-1.5 text-slate-600 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" />
          aguardando o anterior
        </div>
      )}
    </div>
  );
}

// Variante compacta quando há só 1 ciclo na fila — vira uma row inline em vez
// de card vazio stretchado.
function QueueRow({ item, isMentor, onStart }) {
  const tone = URGENCY[urgencyKey(item.daysOverdue)];
  const resultColor =
    typeof item.resultPercent === 'number'
      ? item.resultPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
      : 'text-slate-400';

  return (
    <div className="rounded-lg p-3 border border-blue-500/40 bg-slate-800/40 flex items-center gap-3 flex-wrap">
      <div className="flex items-baseline gap-2 min-w-0">
        <p className="text-base font-bold text-slate-100 truncate">{cycleKeyToLabel(item.cycleKey)}</p>
        <span className="text-[11px] text-slate-500 truncate">· {item.planName}</span>
      </div>

      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tone.badge} flex items-center gap-1 flex-shrink-0`}>
        <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
        {item.daysOverdue}d
      </span>

      <span className={`text-xs font-semibold mono ${resultColor}`}>{fmtPct(item.resultPercent)}</span>
      <span className="text-xs text-slate-500">{item.tradesCount} {item.tradesCount === 1 ? 'trade' : 'trades'}</span>

      <button
        type="button"
        onClick={() => onStart(item)}
        className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 ml-auto"
      >
        {isMentor ? <GraduationCap className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {isMentor ? 'Fechar pelo aluno' : 'Fechar ciclo'}
      </button>
    </div>
  );
}

export default function CycleExpiredGuard({ studentId, role = 'student', studentName = null, onStartClosure, plans, trades }) {
  const { queue, loading } = useCycleExpiredQueue(studentId, { plans, trades });

  if (loading) return null;
  if (!queue || queue.length === 0) return null;

  const isMentor = role === 'mentor';
  const total = queue.length;

  const accentBorder = isMentor ? 'border-purple-500/40' : 'border-amber-500/40';
  const accentText = isMentor ? 'text-purple-300' : 'text-amber-300';
  const accentBg = isMentor ? 'bg-purple-500/10' : 'bg-amber-500/10';

  return (
    <div className={`glass-card p-4 mb-6 border ${accentBorder}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`${accentBg} ${accentText} rounded-lg p-1.5`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${accentText}`}>
            {total} {total === 1 ? 'ciclo vencido' : 'ciclos vencidos'}
            {isMentor && studentName && <span className="text-slate-400 font-normal"> · {studentName}</span>}
          </h3>
          <p className="text-[11px] text-slate-500">
            {isMentor
              ? 'Sessão 1:1 — feche pelo aluno demonstrando na prática. Comece pelo mais antigo.'
              : 'Feche em ordem cronológica pra preservar a integridade do histórico.'}
          </p>
        </div>
      </div>

      {total === 1 ? (
        <QueueRow
          item={queue[0]}
          isMentor={isMentor}
          onStart={onStartClosure}
        />
      ) : (
        <div className={`grid gap-2.5 ${total >= 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {queue.slice(0, 6).map((item) => (
            <QueueCard
              key={`${item.planId}_${item.cycleKey}`}
              item={item}
              isMentor={isMentor}
              onStart={onStartClosure}
            />
          ))}
        </div>
      )}

      {queue.length > 6 && (
        <p className="text-[11px] text-slate-500 mt-3 text-center">
          + {queue.length - 6} ciclo{queue.length - 6 === 1 ? '' : 's'} na fila — feche os primeiros pra desbloquear
        </p>
      )}
    </div>
  );
}
