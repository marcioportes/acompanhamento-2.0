/**
 * ClosureChapterCard.jsx — card de "Capítulo N" no perfil do aluno.
 *
 * Card compacto: cycleNumber, cycleKey, resultado, TPS, badges de status/mode.
 * Click abre o MentorClosureView em modo read-only.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo) — A9.
 */

import React from 'react';
import { BookOpen, Award, RotateCcw, GraduationCap, Users } from 'lucide-react';

function fmtPct(v, digits = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

function StatusBadge({ status }) {
  if (status === 'CLOSED') {
    return <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">selado</span>;
  }
  return <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] flex items-center gap-1">
    <RotateCcw className="w-3 h-3" /> reaberto
  </span>;
}

function ModeBadge({ closeMode }) {
  if (closeMode === 'demonstrated') {
    return (
      <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] flex items-center gap-1">
        <GraduationCap className="w-3 h-3" /> demo mentor
      </span>
    );
  }
  if (closeMode === 'co_edited') {
    return (
      <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] flex items-center gap-1">
        <Users className="w-3 h-3" /> co-fechado
      </span>
    );
  }
  return null;
}

export default function ClosureChapterCard({ closure, onClick }) {
  const snap = closure.snapshot || {};
  const tps = closure.metrics?.tradingPerformanceScore;
  const promotionEligible = closure.maturity?.promotionEligible;
  const overrideApplied = !!closure.maturity?.mentorOverride;
  const tone = snap.cycleStatus === 'GOAL_HIT' ? 'emerald'
    : snap.cycleStatus === 'STOP_HIT' ? 'red' : 'amber';
  const accentCls =
    tone === 'emerald' ? 'border-emerald-500/30' :
    tone === 'red'     ? 'border-red-500/30' :
    'border-amber-500/30';
  const resultCls =
    snap.resultPercent >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <button
      type="button"
      onClick={() => onClick?.(closure)}
      className={`text-left glass-card p-4 border ${accentCls} hover:bg-slate-800/50 transition group w-full`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-500" />
          <p className="text-xs uppercase tracking-wider text-slate-500">Capítulo {closure.cycleNumber ?? '?'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <ModeBadge closeMode={closure.closeMode} />
          <StatusBadge status={closure.status} />
        </div>
      </div>

      <p className="text-lg font-bold text-slate-100">{closure.cycleKey}</p>
      <p className="text-[11px] text-slate-500 mb-3">{closure.cycleStart} → {closure.cycleEnd}</p>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div>
          <p className="text-slate-500 text-[10px]">Resultado</p>
          <p className={`font-semibold mono ${resultCls}`}>{fmtPct(snap.resultPercent)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px]">TPS</p>
          <p className="font-semibold mono text-slate-200">
            {typeof tps === 'number' ? Math.round(tps) : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px]">Trades</p>
          <p className="font-semibold mono text-slate-200">{snap.tradesCount ?? '—'}</p>
        </div>
      </div>

      {(promotionEligible || overrideApplied) && (
        <div className="flex items-center gap-2 text-[11px] text-amber-300 border-t border-slate-700/50 pt-2 mt-2">
          <Award className="w-3.5 h-3.5" />
          {overrideApplied
            ? `Promoção aplicada (override de mentor)`
            : `Stage promotion eligível neste ciclo`}
        </div>
      )}
    </button>
  );
}
