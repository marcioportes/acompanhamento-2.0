/**
 * ClosureTimeline.jsx — timeline horizontal/grid de capítulos do aluno.
 *
 * Lista cards de Capítulo N (mais recente primeiro). Click abre MentorClosureView
 * em modo read-only (mesma view que mentor usa, mas sem comment panel pra aluno).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo) — A9.
 */

import React, { useState } from 'react';
import { BookOpen, History } from 'lucide-react';
import useStudentClosures from '../../hooks/useStudentClosures';
import ClosureChapterCard from './ClosureChapterCard';
import MentorClosureView from './MentorClosureView';

export default function ClosureTimeline({ studentId, studentName, role = 'student', collapsedDefault = false }) {
  const { closures, loading } = useStudentClosures(studentId);
  const [collapsed, setCollapsed] = useState(collapsedDefault);
  const [viewing, setViewing] = useState(null);

  if (loading) return null;
  if (closures.length === 0) return null;

  const latest = closures[0];
  const stage = latest?.maturity?.currentStage;

  return (
    <div className="glass-card p-5">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between mb-4 group"
      >
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 text-blue-400 rounded-lg p-2">
            <History className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Currículo do trader
            </h3>
            <p className="text-[11px] text-slate-500">
              {closures.length} capítulo{closures.length === 1 ? '' : 's'} fechado{closures.length === 1 ? '' : 's'}
              {typeof stage === 'number' && ` · stage atual ${stage}`}
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-500 group-hover:text-slate-300">
          {collapsed ? '▼ expandir' : '▲ recolher'}
        </span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {closures.map((c) => (
            <ClosureChapterCard key={c.id} closure={c} onClick={(item) => setViewing(item)} />
          ))}
        </div>
      )}

      {viewing && (
        <MentorClosureView
          closure={viewing}
          studentName={studentName}
          onClose={() => setViewing(null)}
          onSaved={() => setViewing(null)}
        />
      )}
    </div>
  );
}
