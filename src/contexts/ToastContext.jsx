/**
 * ToastContext.jsx — sistema leve de toast inline (substitui window.alert).
 *
 * Uso:
 *   const { toast } = useToast();
 *   toast({ type: 'error', message: 'Falha ao salvar' });
 *   toast({ type: 'success', message: 'Plano atualizado' });
 *   toast({ type: 'info', message: 'Processando...', duration: 0 });  // sticky
 *
 * Renderização: stack no canto superior direito, glass-card no padrão do app.
 * Sem libs externas. Auto-dismiss em 5s (override via `duration` em ms; 0 = sticky).
 *
 * Issue #259 (1A) — eliminação dos alerts nativos do browser.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TYPE_STYLE = {
  success: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
  },
  error: {
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    icon: AlertCircle,
    iconColor: 'text-red-400',
  },
  info: {
    border: 'border-slate-500/40',
    bg: 'bg-slate-500/10',
    icon: Info,
    iconColor: 'text-slate-300',
  },
};

function ToastItem({ toast, onDismiss }) {
  const style = TYPE_STYLE[toast.type] || TYPE_STYLE.info;
  const Icon = style.icon;
  return (
    <div className={`glass-card max-w-md p-4 border ${style.border} ${style.bg} shadow-2xl pointer-events-auto`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
        <div className="flex-1 min-w-0">
          {toast.title && <p className="text-sm font-semibold text-slate-100 mb-0.5">{toast.title}</p>}
          <p className="text-sm text-slate-200 whitespace-pre-line break-words">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-slate-400 hover:text-white p-0.5 -m-0.5 rounded transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Toaster({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ type = 'info', message, title = null, duration = 5000 }) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message, title }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  // Atalhos comuns
  const ctx = {
    toast,
    dismiss,
    success: useCallback((message, opts = {}) => toast({ type: 'success', message, ...opts }), [toast]),
    error: useCallback((message, opts = {}) => toast({ type: 'error', message, ...opts }), [toast]),
    info: useCallback((message, opts = {}) => toast({ type: 'info', message, ...opts }), [toast]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback gracioso — não quebra caso ToastProvider falte; cai pro console.
    return {
      toast: ({ message }) => console.warn('[Toast (no provider)]:', message),
      dismiss: () => {},
      success: (m) => console.log('[Toast.success (no provider)]:', m),
      error: (m) => console.error('[Toast.error (no provider)]:', m),
      info: (m) => console.log('[Toast.info (no provider)]:', m),
    };
  }
  return ctx;
}
