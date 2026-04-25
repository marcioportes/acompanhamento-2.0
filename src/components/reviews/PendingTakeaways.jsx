/**
 * PendingTakeaways
 * @version 1.1.0 (issue #119 task 27)
 * @description Card no dashboard do aluno listando takeaways em aberto da
 *              ÚLTIMA revisão CLOSED. Revisões antigas ficam acessíveis pela
 *              rota Revisões (sidebar) — ver tasks 25/26 do issue #119.
 *
 * Regras de visibilidade:
 *   - Lê apenas a última revisão CLOSED via useLatestClosedReview(studentId).
 *   - Mostra item se item.done = false (mentor não encerrou) E
 *     item.id NÃO em review.alunoDoneIds (aluno não marcou executado).
 *   - Sem revisão CLOSED OU sem pendência → retorna null.
 */

import { useMemo } from 'react';
import { Square, ClipboardCheck, MessageSquare, Loader2 } from 'lucide-react';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';
import useLatestClosedReview from '../../hooks/useLatestClosedReview';

const PendingTakeaways = ({ studentId, planId = null, onNavigateToFeedback = null }) => {
  // ContextBar respect (#188 F4): filtrar por planId do contexto quando definido.
  // Sem planId (contexto "Todos os planos") → fallback broad (última review do aluno).
  const { review, loading } = useLatestClosedReview(studentId, planId);
  const { toggleAlunoDone, actionLoading } = useWeeklyReviews(studentId);

  const pending = useMemo(() => {
    if (!review) return [];
    const items = Array.isArray(review.takeawayItems) ? review.takeawayItems : [];
    const alunoDone = new Set(Array.isArray(review.alunoDoneIds) ? review.alunoDoneIds : []);
    return items.filter(it => !it.done && !alunoDone.has(it.id));
  }, [review]);

  if (loading) return null;
  if (!review || pending.length === 0) return null;

  const handleMarkDone = async (itemId) => {
    try {
      await toggleAlunoDone(review.id, itemId, true);
    } catch (err) {
      // Sem rule deployada, aluno recebe permission-denied aqui. Loga no console
      // para facilitar debug — sem rule, click aparece "inerte" para o usuário.
      console.error('[PendingTakeaways] falha ao marcar takeaway:', err);
    }
  };

  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-amber-500/10 rounded-lg">
          <ClipboardCheck className="w-4 h-4 text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Takeaways abertos da última revisão</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
          {pending.length} {pending.length === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <div className="border border-slate-800 rounded-lg bg-slate-900/40 p-2.5">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
          Revisão {review.periodKey} · {review.weekStart} → {review.weekEnd}
        </div>
        <div className="space-y-0.5">
          {pending.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-2 px-1 py-1 rounded hover:bg-slate-800/40 group"
            >
              <button
                onClick={() => handleMarkDone(item.id)}
                disabled={actionLoading}
                className="mt-0.5 shrink-0 text-slate-500 hover:text-emerald-400 disabled:opacity-40"
                title="Marcar como feito"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              </button>
              <span className="flex-1 text-[13px] text-slate-200 leading-relaxed">
                {item.text}
              </span>
              {item.sourceTradeId && onNavigateToFeedback && (
                <button
                  onClick={() => onNavigateToFeedback({ id: item.sourceTradeId })}
                  className="shrink-0 p-0.5 text-slate-500 hover:text-blue-400 opacity-60 group-hover:opacity-100 transition"
                  title="Abrir trade de origem"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PendingTakeaways;
