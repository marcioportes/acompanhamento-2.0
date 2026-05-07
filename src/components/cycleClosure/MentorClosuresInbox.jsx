/**
 * MentorClosuresInbox.jsx — tab "Closures" no Mentor Cockpit (CHUNK-16).
 *
 * Lista compacta de closures fechados pelos alunos nos últimos 7 dias sem
 * mentor.closingComment. Após 7d sai do inbox automaticamente.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Props:
 *   - onOpen(closure): callback ao clicar item — abre MentorClosureView
 */

import React, { useMemo } from 'react';
import { Inbox, ChevronRight } from 'lucide-react';
import useMentorClosureInbox from '../../hooks/useMentorClosureInbox';

function fmtPct(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function ToneDot({ tone }) {
  const cls =
    tone === 'red' ? 'bg-red-500 animate-pulse' :
    tone === 'amber' ? 'bg-amber-500' :
    'bg-emerald-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function DaysBadge({ days, tone }) {
  const cls =
    tone === 'red' ? 'text-red-400' :
    tone === 'amber' ? 'text-amber-400' :
    'text-emerald-400';
  return <span className={`text-xs font-semibold ${cls}`}>{days} dia{days === 1 ? '' : 's'}</span>;
}

function StudentName({ studentId, students }) {
  const name = students?.find?.((s) => s.studentId === studentId)?.name || studentId.slice(0, 6) + '…';
  return <span className="font-semibold text-slate-100">{name}</span>;
}

export default function MentorClosuresInbox({ students = [], plansById = {}, onOpen }) {
  const { inbox, pendingCount, loading } = useMentorClosureInbox();

  const counts = useMemo(() => {
    const out = { red: 0, amber: 0, emerald: 0 };
    for (const c of inbox) out[c.tone]++;
    return out;
  }, [inbox]);

  if (loading) {
    return <div className="glass-card p-6 text-center text-slate-400">Carregando inbox...</div>;
  }

  if (pendingCount === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-300 font-semibold">Inbox vazio</p>
        <p className="text-sm text-slate-500 mt-1">
          Todos os closures recentes já foram comentados (ou estão fora da janela de 7 dias).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Inbox className="w-5 h-5" /> Closures aguardando comentário
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Janela: 7 dias após o aluno selar. Depois disso, marca "no comment" automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {counts.red > 0 && <span className="badge bg-red-500/20 text-red-300 border border-red-500/30 text-[10px]">{counts.red} crítico</span>}
          {counts.amber > 0 && <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">{counts.amber} atenção</span>}
          {counts.emerald > 0 && <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">{counts.emerald} folga</span>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          <div className="col-span-1">Urgência</div>
          <div className="col-span-3">Aluno · Plano</div>
          <div className="col-span-2">Ciclo</div>
          <div className="col-span-3">Resultado · Sinais</div>
          <div className="col-span-2">Vence em</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>

        {inbox.map((item) => {
          const plan = plansById[item.planId];
          const planName = plan?.name || item.planId.slice(0, 8);
          const tps = item.summary.tps;
          const result = item.summary.resultPercent;
          const trades = item.summary.tradesCount;

          let signal = null;
          if (item.summary.regression?.length > 0) {
            signal = `⚠ regressão em ${item.summary.regression.join(', ')}`;
          } else if (item.summary.promotionEligible) {
            signal = '✨ stage eligible — confirmar promoção';
          } else if (typeof tps === 'number' && tps < 40) {
            signal = '⚠ TPS baixo — atenção comportamental';
          } else if (item.closeMode !== 'self') {
            signal = `🎓 fechado em ${item.closeMode === 'demonstrated' ? 'demonstração' : 'co-edição'}`;
          } else {
            signal = 'sem sinais críticos';
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen?.(item)}
              className="w-full grid grid-cols-12 gap-4 px-5 py-4 border-b border-slate-800/30 hover:bg-slate-800/30 transition items-center group text-left"
            >
              <div className="col-span-1">
                <ToneDot tone={item.tone} />
              </div>
              <div className="col-span-3">
                <StudentName studentId={item.studentId} students={students} />
                <p className="text-xs text-slate-500">{planName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-slate-300 mono">{item.cycleKey}</p>
                <p className="text-[11px] text-slate-500">{item.cycleStart} → {item.cycleEnd}</p>
              </div>
              <div className="col-span-3">
                <p className="text-sm">
                  <span className={typeof result === 'number' && result >= 0 ? 'text-emerald-400 mono' : 'text-red-400 mono'}>{fmtPct(result)}</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-300 mono">{trades ?? '—'}t</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-300">TPS {typeof tps === 'number' ? Math.round(tps) : '—'}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{signal}</p>
              </div>
              <div className="col-span-2">
                <DaysBadge days={item.daysRemaining} tone={item.tone} />
                <p className="text-[11px] text-slate-500">
                  fechado {item.closedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {item.closedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="col-span-1 text-right">
                <span className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition">
                  Ver <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-600 italic">
        Cálculo de "vence em": <code className="bg-slate-800 px-1 rounded text-[10px]">closedAt + 7d − now</code> on-the-fly. Sem job/trigger.
      </p>
    </div>
  );
}
