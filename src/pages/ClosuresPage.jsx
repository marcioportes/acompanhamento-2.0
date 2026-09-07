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
import PageHeader from '../components/ui/PageHeader';
import PageBody from '../components/ui/PageBody';
import DebugBadge from '../components/DebugBadge';
import ClosureTimeline from '../components/cycleClosure/ClosureTimeline';
import { useAuth } from '../contexts/AuthContext';

export default function ClosuresPage({ viewAs = null }) {
  const { user } = useAuth();
  const studentId = viewAs?.uid || user?.uid;

  return (
    <div className="min-h-screen">
      <DebugBadge component="ClosuresPage" />

      <PageHeader
        titulo="Ciclos Fechados"
        icone={History}
        contexto="Histórico de capítulos selados — clique pra ver detalhe"
      />

    <PageBody>
      <ClosureTimeline
        studentId={studentId}
        studentName={viewAs?.name}
        role={viewAs ? 'mentor' : 'student'}
        collapsedDefault={false}
      />
    </PageBody>
    </div>
  );
}
