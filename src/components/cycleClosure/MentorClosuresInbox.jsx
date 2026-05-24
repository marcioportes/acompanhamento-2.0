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

import React, { useMemo, useState } from 'react';
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
  const [mode, setMode] = useState('pending');
  const [filterStudentId, setFilterStudentId] = useState('all');
  const { inbox, pendingCount, loading } = useMentorClosureInbox({ mode });

  const filteredInbox = useMemo(
    () => filterStudentId === 'all' ? inbox : inbox.filter((c) => c.studentId === filterStudentId),
    [inbox, filterStudentId],
  );

  const counts = useMemo(() => {
    const out = { red: 0, amber: 0, emerald: 0, slate: 0 };
    for (const c of filteredInbox) out[c.tone] = (out[c.tone] || 0) + 1;
    return out;
  }, [filteredInbox]);

  // Alunos com closures (do conjunto bruto, antes do filtro de aluno)
  const studentsWithClosures = useMemo(() => {
    const ids = [...new Set(inbox.map((c) => c.studentId))];
    return ids
      .map((id) => ({ id, name: students.find((s) => s.studentId === id)?.name || id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inbox, students]);

  if (loading) {
    return <div className="glass-card p-6 text-center text-slate-400">Carregando inbox...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Inbox className="w-5 h-5" /> {mode === 'pending' ? 'Ciclos aguardando comentário' : 'Todos os ciclos fechados'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'pending'
              ? 'Janela: 7 dias após o aluno selar. Depois disso, marca "sem comentário" automaticamente.'
              : 'Histórico completo — todos os ciclos selados, sem filtro de janela.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {mode === 'pending' && counts.red > 0 && <span className="badge bg-red-500/20 text-red-300 border border-red-500/30 text-[10px]">{counts.red} crítico</span>}
          {mode === 'pending' && counts.amber > 0 && <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">{counts.amber} atenção</span>}
          {mode === 'pending' && counts.emerald > 0 && <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">{counts.emerald} folga</span>}
        </div>
      </div>

      {/* Toggle modo + filtro por aluno */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-slate-800/40 rounded-lg p-1 border border-slate-700/40">
          <button
            type="button"
            onClick={() => setMode('pending')}
            className={`px-3 py-1.5 text-xs rounded-md transition ${mode === 'pending' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Pendentes{pendingCount > 0 && ` (${pendingCount})`}
          </button>
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`px-3 py-1.5 text-xs rounded-md transition ${mode === 'all' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Todos
          </button>
        </div>

        {studentsWithClosures.length > 1 && (
          <select
            value={filterStudentId}
            onChange={(e) => setFilterStudentId(e.target.value)}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 cursor-pointer"
            aria-label="Filtrar por aluno"
          >
            <option value="all">Todos os alunos ({studentsWithClosures.length})</option>
            {studentsWithClosures.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        <span className="text-xs text-slate-500 ml-auto">{filteredInbox.length} ciclo{filteredInbox.length === 1 ? '' : 's'}</span>
      </div>

      {filteredInbox.length === 0 && (
        <div className="glass-card p-8 text-center">
          <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold">
            {mode === 'pending' ? 'Nenhum ciclo pendente' : 'Nenhum ciclo encontrado'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'pending'
              ? 'Todos os ciclos recentes já foram comentados (ou estão fora da janela de 7 dias).'
              : 'Ainda não há ciclos selados para os filtros selecionados.'}
          </p>
        </div>
      )}

      {filteredInbox.length > 0 && (
      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          <div className="col-span-1">{mode === 'pending' ? 'Urgência' : 'Status'}</div>
          <div className="col-span-3">Aluno · Plano</div>
          <div className="col-span-2">Ciclo</div>
          <div className="col-span-3">Resultado · Sinais</div>
          <div className="col-span-2">{mode === 'pending' ? 'Vence em' : 'Fechado em'}</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>

        {filteredInbox.map((item) => {
          const plan = plansById[item.planId];
          const planName = plan?.name || item.planId.slice(0, 8);
          const tps = item.summary.tps;
          const result = item.summary.resultPercent;
          const trades = item.summary.tradesCount;

          const behavioral = item.summary.behavioral;
          let signal = null;
          if (item.isCritical) {
            const triggers = [];
            if (behavioral?.tradesAfterStop > 0) triggers.push(`+${behavioral.tradesAfterStop} trade(s) após stop`);
            if ((behavioral?.tiltDaysCount || 0) >= 3) triggers.push(`${behavioral.tiltDaysCount}d tilt`);
            if ((behavioral?.revenge || 0) >= 2) triggers.push(`${behavioral.revenge}× vingança`);
            if ((behavioral?.stopTampering || 0) >= 1) triggers.push(`stop deslocado ${behavioral.stopTampering}×`);
            signal = `🚨 CRÍTICO — pausa sugerida${triggers.length ? `: ${triggers.slice(0, 2).join(', ')}` : ''}`;
            if (behavioral?.denialFlag) {
              signal += ' · ⚠ atribuição externa apesar de erros detectados';
            }
          } else if (item.summary.regression?.length > 0) {
            signal = `⚠ regressão em ${item.summary.regression.join(', ')}`;
          } else if (item.summary.promotionEligible) {
            signal = '✨ pronto para promoção — confirmar';
          } else if (typeof tps === 'number' && tps < 40) {
            signal = '⚠ nota baixa — atenção comportamental';
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
              className={`w-full grid grid-cols-12 gap-4 px-5 py-4 border-b border-slate-800/30 hover:bg-slate-800/30 transition items-center group text-left ${
                item.isCritical ? 'bg-red-500/5 border-l-2 border-l-red-500/60' : ''
              }`}
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
                {mode === 'pending' ? (
                  <>
                    <DaysBadge days={item.daysRemaining} tone={item.tone} />
                    <p className="text-[11px] text-slate-500">
                      fechado {item.closedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {item.closedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-300">
                    {item.closedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    {' '}
                    {item.closedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
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
      )}
    </div>
  );
}
