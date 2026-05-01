/**
 * PendencyGuard
 * @description Modal bloqueante de pendências do aluno (issue #220, parte 2/3 de #218).
 * Renderiza ao abrir StudentDashboard quando há trades REVIEWED ou takeaways abertos.
 * "OK, entendi" e Escape dispensam por sessão (sessionStorage).
 *
 * Uso (App.jsx default StudentDashboard branch):
 *   <PendencyGuard
 *     studentId={user.uid}
 *     onNavigateToFeedback={handleNavigateToFeedback}
 *     onNavigateToReviews={() => setCurrentView('student-reviews')}
 *   />
 *
 * Skip ocorre por composição: o componente só é montado no branch do aluno (não em
 * `viewingAsStudent`), e o `AssessmentGuard` no App já redireciona para onboarding antes
 * deste componente atingir render.
 */

import { useEffect, useMemo } from 'react';
import { AlertTriangle, ClipboardCheck, X } from 'lucide-react';
import { usePendencyGuard } from '../hooks/usePendencyGuard';
import { formatDate } from '../utils/calculations';
import DebugBadge from './DebugBadge';

const TOP_N = 5;

const PendencyGuard = ({ studentId, onNavigateToFeedback = null, onNavigateToReviews = null }) => {
  const {
    shouldShow,
    pendingTrades,
    pendingTakeaways,
    dismiss,
    closeForNow,
  } = usePendencyGuard(studentId);

  useEffect(() => {
    if (!shouldShow) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [shouldShow, dismiss]);

  const topTrades = useMemo(() => pendingTrades.slice(0, TOP_N), [pendingTrades]);
  const topTakeaways = useMemo(() => pendingTakeaways.slice(0, TOP_N), [pendingTakeaways]);

  if (!shouldShow) return null;

  const handleClickTrade = (trade) => {
    if (onNavigateToFeedback) {
      // closeForNow: fecha pra navegar e resolver, não persiste dismiss.
      // Se mais pendência surgir depois (ex.: novo trade REVIEWED), modal volta.
      closeForNow();
      onNavigateToFeedback(trade);
    }
  };

  const handleClickTakeaway = () => {
    if (onNavigateToReviews) {
      closeForNow();
      onNavigateToReviews();
    }
  };

  const totalPendencies = pendingTrades.length + pendingTakeaways.length;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pendency-guard-title"
    >
      <div className="glass-card max-w-2xl w-full max-h-[85vh] flex flex-col rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex-none p-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 id="pendency-guard-title" className="text-lg font-bold text-white">
              Você tem pendências
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalPendencies} {totalPendencies === 1 ? 'item esperando sua atenção' : 'itens esperando sua atenção'}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full"
            aria-label="Dispensar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {pendingTrades.length > 0 && (
            <section className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-500/15 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Trades com feedback do mentor
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                  {pendingTrades.length}
                </span>
              </div>
              <p className="text-[12px] text-slate-400 mb-2">
                Mentor já revisou — falta você ler e fechar.
              </p>
              <ul className="space-y-1">
                {topTrades.map(trade => (
                  <li key={trade.id}>
                    <button
                      onClick={() => handleClickTrade(trade)}
                      disabled={!onNavigateToFeedback}
                      className="w-full text-left flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 disabled:hover:bg-transparent disabled:cursor-default transition-colors group"
                    >
                      <span className="text-[11px] text-slate-500 font-mono w-20 shrink-0">
                        {trade.date ? formatDate(trade.date) : '—'}
                      </span>
                      <span className="text-[13px] text-slate-200 font-medium flex-1 truncate">
                        {trade.ticker || '—'}
                      </span>
                      <span className={`text-[12px] font-mono shrink-0 ${
                        Number(trade.result) > 0 ? 'text-emerald-400' :
                        Number(trade.result) < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {trade.side || ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {pendingTrades.length > TOP_N && (
                <p className="text-[11px] text-slate-500 mt-2 text-center">
                  +{pendingTrades.length - TOP_N} no extrato
                </p>
              )}
            </section>
          )}

          {pendingTakeaways.length > 0 && (
            <section className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-500/15 rounded-lg">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Takeaways abertos
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  {pendingTakeaways.length}
                </span>
              </div>
              <p className="text-[12px] text-slate-400 mb-2">
                Itens das suas revisões semanais aguardando execução.
              </p>
              <ul className="space-y-1">
                {topTakeaways.map(item => (
                  <li key={`${item.reviewId}-${item.id}`}>
                    <button
                      onClick={handleClickTakeaway}
                      disabled={!onNavigateToReviews}
                      className="w-full text-left flex items-start gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
                    >
                      <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                      <span className="text-[13px] text-slate-200 flex-1 line-clamp-2">
                        {item.text || '(sem texto)'}
                      </span>
                      {item.reviewWeekStart && (
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {item.reviewWeekStart}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {pendingTakeaways.length > TOP_N && (
                <p className="text-[11px] text-slate-500 mt-2 text-center">
                  +{pendingTakeaways.length - TOP_N} em Revisões
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex-none p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end items-center rounded-b-2xl">
          <button
            onClick={dismiss}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg text-sm font-bold transition-all"
          >
            OK, entendi
          </button>
        </div>
      </div>
      <DebugBadge component="PendencyGuard" />
    </div>
  );
};

export default PendencyGuard;
