/**
 * ClosurePendingBadge.jsx — contador de closures pendentes pra mentor.
 *
 * Mostra-se como número discreto (intra-app only). Click leva à tab Closures
 * via callback. Esconde quando count=0.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React from 'react';
import useMentorClosureInbox from '../../hooks/useMentorClosureInbox';

export default function ClosurePendingBadge({ onClick, className = '' }) {
  const { pendingCount, loading } = useMentorClosureInbox();

  if (loading || pendingCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition ${className}`}
      title={`${pendingCount} closure(s) aguardando seu comentário`}
    >
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-xs font-bold">{pendingCount}</span>
    </button>
  );
}
