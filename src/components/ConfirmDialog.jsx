/**
 * ConfirmDialog.jsx — modal de confirmação inline (substitui window.confirm).
 *
 * Padrão glassmorphism, sem libs externas. Estilo varia por `tone`:
 *   - 'danger' (default pra delete): borda vermelha, botão vermelho
 *   - 'warning': borda âmbar
 *   - 'neutral': borda slate
 *
 * Uso típico via hook `useConfirmDialog`:
 *
 *   const { confirm, dialog } = useConfirmDialog();
 *   ...
 *   onClick={async () => {
 *     const ok = await confirm({
 *       title: 'Excluir conta?',
 *       body: 'Vai apagar todos os trades e planos vinculados.',
 *       confirmLabel: 'Excluir',
 *       tone: 'danger',
 *     });
 *     if (ok) await handleDelete();
 *   }}
 *   ...
 *   return <>{children}{dialog}</>;   // dialog rendered no JSX
 *
 * Issue #259 (1A) — eliminação dos window.confirm nativos.
 */

import React, { useCallback, useState } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const TONE_STYLE = {
  danger: {
    border: 'border-red-500/60',
    bg: 'from-red-500/15 to-red-500/5',
    iconBg: 'bg-red-500/30 text-red-300',
    icon: AlertCircle,
    confirmBtn: 'bg-red-600 hover:bg-red-500 text-white',
  },
  warning: {
    border: 'border-amber-500/60',
    bg: 'from-amber-500/15 to-amber-500/5',
    iconBg: 'bg-amber-500/30 text-amber-200',
    icon: AlertTriangle,
    confirmBtn: 'bg-amber-600 hover:bg-amber-500 text-white',
  },
  neutral: {
    border: 'border-slate-500/40',
    bg: 'from-slate-700/40 to-slate-700/20',
    iconBg: 'bg-slate-600/40 text-slate-200',
    icon: Info,
    confirmBtn: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
};

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  const style = TONE_STYLE[tone] || TONE_STYLE.neutral;
  const Icon = style.icon;
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`glass-card max-w-md w-full p-6 border-2 ${style.border} bg-gradient-to-br ${style.bg} shadow-2xl`}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`${style.iconBg} rounded-xl p-2.5 flex-shrink-0`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-100 mb-1">{title}</h3>
            {body && (
              <div className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{body}</div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors ${style.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook conveniente — retorna `confirm()` que abre o dialog e resolve com bool,
 * e `dialog` (JSX) pra renderizar no componente que chama.
 */
export function useConfirmDialog() {
  const [state, setState] = useState({ open: false });
  const [resolver, setResolver] = useState(null);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setResolver(() => resolve);
      setState({ open: true, ...opts });
    });
  }, []);

  const close = useCallback((result) => {
    if (resolver) resolver(result);
    setResolver(null);
    setState({ open: false });
  }, [resolver]);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      body={state.body}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
