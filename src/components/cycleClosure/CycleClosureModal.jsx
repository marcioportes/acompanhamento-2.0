/**
 * CycleClosureModal.jsx — wrapper full-screen pro CycleClosureWizard.
 *
 * Modal sem framework (overlay próprio + scrolling). ESC NÃO fecha (autosave protege,
 * mas evita reset acidental durante 25min de ritual). Botão X faz confirmação.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import CycleClosureWizard from './CycleClosureWizard';

export default function CycleClosureModal({ open, onClose, onSealed, ...wizardProps }) {
  // Lock scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return undefined;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (window.confirm('Sair do ritual? Seu progresso ficou salvo (autosave) e você pode retomar depois.')) {
      onClose();
    }
  };

  const handleSealed = (closureId) => {
    onSealed?.(closureId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm overflow-y-auto">
      {/* Botão X discreto no canto */}
      <button
        type="button"
        onClick={handleClose}
        className="fixed top-4 right-4 z-[60] w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition"
        title="Sair (progresso salvo)"
      >
        <X className="w-5 h-5" />
      </button>

      <CycleClosureWizard
        {...wizardProps}
        onSealed={handleSealed}
        onCancel={handleClose}
      />
    </div>
  );
}
