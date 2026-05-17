/**
 * ClosuresPage.jsx — página de Ciclos Fechados (timeline do aluno).
 *
 * Renderiza ClosureTimeline em tela cheia (extraído do StudentDashboard
 * porque não fazia sentido escondido lá no fundo).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo) — A12.
 */

import React from 'react';
import { History } from 'lucide-react';
import DebugBadge from '../components/DebugBadge';
import ClosureTimeline from '../components/cycleClosure/ClosureTimeline';
import { useAuth } from '../contexts/AuthContext';

export default function ClosuresPage({ viewAs = null }) {
  const { user } = useAuth();
  const studentId = viewAs?.uid || user?.uid;

  return (
    <div className="min-h-screen p-6 lg:p-8 pb-20">
      <DebugBadge component="ClosuresPage" />

      <div className="mb-6 flex items-center gap-3">
        <div className="bg-blue-500/20 text-blue-400 rounded-lg p-2">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Ciclos Fechados</h1>
          <p className="text-sm text-slate-400">Histórico de capítulos selados — clique pra ver detalhe</p>
        </div>
      </div>

      <ClosureTimeline
        studentId={studentId}
        studentName={viewAs?.name}
        role={viewAs ? 'mentor' : 'student'}
        collapsedDefault={false}
      />
    </div>
  );
}
