/**
 * PendingTakeaways
 * @version 1.0.0 (v1.33.0) — Stage 4.5
 * @description Card no dashboard do aluno listando takeaways em aberto
 *              criados pelo mentor em revisões publicadas (CLOSED).
 *
 * Regras de visibilidade:
 *   - Só mostra takeaways com item.done = false (mentor não encerrou) E
 *     item.id NÃO em review.alunoDoneIds (aluno não marcou executado).
 *   - Só de revisões com status=CLOSED (rascunhos e arquivadas ignorados).
 *   - Agrupado por revisão para preservar contexto (qual semana / plano).
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { CheckSquare, Square, ClipboardCheck, MessageSquare, Loader2 } from 'lucide-react';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';

const PendingTakeaways = ({ studentId, onNavigateToFeedback = null }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toggleAlunoDone, actionLoading } = useWeeklyReviews(studentId);

  useEffect(() => {
    if (!studentId) { setLoading(false); return undefined; }
    const q = query(
      collection(db, 'students', studentId, 'reviews'),
      where('status', '==', 'CLOSED'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [studentId]);

  // Agrupa: cada revisão com seus takeaways pendentes (!done && !alunoDoneIds.includes).
  const groups = useMemo(() => {
    return reviews
      .map(r => {
        const items = Array.isArray(r.takeawayItems) ? r.takeawayItems : [];
        const alunoDone = new Set(Array.isArray(r.alunoDoneIds) ? r.alunoDoneIds : []);
        const pending = items.filter(it => !it.done && !alunoDone.has(it.id));
        return {
          reviewId: r.id,
          periodKey: r.periodKey,
          weekStart: r.weekStart,
          weekEnd: r.weekEnd,
          planId: r.planId || r.frozenSnapshot?.planContext?.planId,
          pending,
          totalItems: items.length,
        };
      })
      .filter(g => g.pending.length > 0)
      .sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || ''));
  }, [reviews]);

  const totalPending = groups.reduce((s, g) => s + g.pending.length, 0);

  if (loading) return null; // não ocupa espaço enquanto carrega
  if (groups.length === 0) return null; // nada pendente → não renderiza o card

  const handleMarkDone = async (reviewId, itemId) => {
    try {
      await toggleAlunoDone(reviewId, itemId, true);
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
        <h3 className="text-sm font-semibold text-white">Pendências da mentoria</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
          {totalPending} {totalPending === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <div className="space-y-3">
        {groups.map(g => (
          <div key={g.reviewId} className="border border-slate-800 rounded-lg bg-slate-900/40 p-2.5">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
              Revisão {g.periodKey} · {g.weekStart} → {g.weekEnd}
            </div>
            <div className="space-y-0.5">
              {g.pending.map(item => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 px-1 py-1 rounded hover:bg-slate-800/40 group"
                >
                  <button
                    onClick={() => handleMarkDone(g.reviewId, item.id)}
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
        ))}
      </div>
    </div>
  );
};

export default PendingTakeaways;
