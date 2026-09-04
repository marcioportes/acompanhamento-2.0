/**
 * ClosuresPage.jsx — página de Ciclos Fechados (timeline do aluno).
 *
 * Renderiza ClosureTimeline em tela cheia (extraído do StudentDashboard
 * porque não fazia sentido escondido lá no fundo).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo) — A12.
 */

import React from 'react';
import DebugBadge from '../components/DebugBadge';
import ClosureTimeline from '../components/cycleClosure/ClosureTimeline';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';

export default function ClosuresPage({ viewAs = null }) {
  const { user } = useAuth();
  const studentId = viewAs?.uid || user?.uid;

  return (
    <div>
      <DebugBadge component="ClosuresPage" />

      <PageHeader
        titulo="Ciclos Fechados"
        linha="Histórico de capítulos selados — clique pra ver detalhe"
      />

      <ClosureTimeline
        studentId={studentId}
        studentName={viewAs?.name}
        role={viewAs ? 'mentor' : 'student'}
        collapsedDefault={false}
      />
    </div>
  );
}
