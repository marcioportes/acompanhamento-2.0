/**
 * WizardFooter.jsx — back/next + status na base do wizard
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Lock, Loader2, LogOut } from 'lucide-react';

const STEP_LABELS = ['Ler', 'Observar', 'Refletir', 'Mapear', 'Avaliar', 'Ajustar', 'Comprometer', 'Selar'];

export default function WizardFooter({
  currentStep,
  totalSteps = 8,
  onBack,
  onNext,
  onCancel,
  onSeal,
  canSeal,
  submitting,
}) {
  const isLast = currentStep >= totalSteps;
  const prevLabel = currentStep > 1 ? STEP_LABELS[currentStep - 2] : null;
  const nextLabel = currentStep < totalSteps ? STEP_LABELS[currentStep] : null;

  return (
    <div className="flex items-center justify-between mt-4 gap-3">
      <div className="flex items-center gap-2">
        {currentStep > 1 && (
          <button type="button" className="btn-secondary text-sm flex items-center gap-1" onClick={onBack}>
            <ChevronLeft className="w-4 h-4" />
            {prevLabel}
          </button>
        )}
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-200 flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-800/40 transition"
          onClick={onCancel}
          title="Sair do fechamento"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>

      <div>
        {isLast ? (
          <button
            type="button"
            disabled={!canSeal || submitting}
            onClick={onSeal}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Selando...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Selar e Fechar Ciclo
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="btn-primary text-sm flex items-center gap-2"
          >
            Próximo: {nextLabel}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
