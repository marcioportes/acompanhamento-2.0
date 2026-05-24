/**
 * ClosureTimeline.jsx — grid de ciclos fechados do aluno.
 *
 * Lista cards (mais recente primeiro). Click abre o detalhe inline.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo) — A9.
 */

import React, { useState } from 'react';
import useStudentClosures from '../../hooks/useStudentClosures';
import ClosureChapterCard from './ClosureChapterCard';
import MentorClosureView from './MentorClosureView';

export default function ClosureTimeline({ studentId, studentName, role = 'student' }) {
  const { closures, loading } = useStudentClosures(studentId);
  const [viewing, setViewing] = useState(null);

  if (loading) return null;
  if (closures.length === 0) return null;

  const latest = closures[0];
  const stage = latest?.maturity?.currentStage;

  // Quando um capítulo está sendo visualizado, mostra o detalhe inline
  // (substitui a grid de cards). Mantém sidebar e header da página intactos.
  if (viewing) {
    return (
      <MentorClosureView
        closure={viewing.closure}
        previousClosure={viewing.previousClosure}
        studentName={studentName}
        viewerRole={role}
        onClose={() => setViewing(null)}
        onSaved={() => setViewing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        {closures.length} ciclo{closures.length === 1 ? '' : 's'} fechado{closures.length === 1 ? '' : 's'}
        {typeof stage === 'number' && ` · estágio atual ${stage}`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {closures.map((c, idx) => (
          <ClosureChapterCard
            key={c.id}
            closure={c}
            onClick={(item) => setViewing({ closure: item, previousClosure: closures[idx + 1] || null })}
          />
        ))}
      </div>
    </div>
  );
}
