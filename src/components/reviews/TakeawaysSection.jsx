/**
 * TakeawaysSection — checklist canônico de takeaways de uma revisão.
 *
 * Fonte única: `review.takeawayItems[]` (array `[{id,text,done,sourceTradeId,...}]`).
 * Estados duais por item: `item.done` (mentor encerra) vs `alunoDoneIds.includes(item.id)`
 * (aluno marca como executado pelo dashboard, não fecha oficialmente).
 *
 * Reusado em WeeklyReviewPage, ReviewToolsPanel (Extrato) e WeeklyReviewModal (Fila).
 */

import { useState, useMemo } from 'react';
import { CheckSquare, Square, Trash2, MessageSquare, Plus, Loader2 } from 'lucide-react';

const TakeawayItem = ({ item, canEdit, alunoDone, onToggle, onRemove, onNavigateToFeedback }) => {
  const handleOpenTrade = () => {
    if (!onNavigateToFeedback || !item.sourceTradeId) return;
    onNavigateToFeedback({ id: item.sourceTradeId });
  };
  const checkboxColor = item.done
    ? 'text-emerald-400'
    : alunoDone
      ? 'text-amber-400'
      : 'text-slate-500 hover:text-slate-300';
  const checkboxTitle = item.done
    ? 'Mentor encerrou — clique para reabrir'
    : alunoDone
      ? 'Aluno marcou como feito — encerre para fechar oficialmente'
      : 'Encerrar takeaway (mentor)';
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-slate-800/40 group">
      <button
        onClick={() => canEdit && onToggle(item.id)}
        disabled={!canEdit}
        className={`mt-0.5 shrink-0 ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${checkboxColor}`}
        title={checkboxTitle}
      >
        {(item.done || alunoDone) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
      </button>
      <span className={`flex-1 text-[13px] leading-relaxed ${item.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
        {item.text}
        {item.carriedOverFromReviewId && (
          <span
            className="ml-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 align-middle"
            title="Item herdado da revisão anterior — aluno não fechou, mentor renovou"
          >
            ↻ anterior
          </span>
        )}
        {alunoDone && !item.done && (
          <span
            className="ml-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 align-middle"
            title="O aluno marcou este takeaway como executado pelo dashboard"
          >
            aluno ✓
          </span>
        )}
      </span>
      {item.sourceTradeId && onNavigateToFeedback && (
        <button
          onClick={handleOpenTrade}
          className="shrink-0 p-0.5 text-slate-500 hover:text-blue-400 opacity-60 group-hover:opacity-100 transition"
          title="Abrir trade de origem"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      )}
      {canEdit && (
        <button
          onClick={() => onRemove(item.id)}
          className="shrink-0 p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
          title="Remover takeaway"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const TakeawaysSection = ({
  items,
  alunoDoneIds,
  canEdit,
  onAdd,
  onToggle,
  onRemove,
  onNavigateToFeedback,
  actionLoading,
}) => {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const handleAdd = async () => {
    const clean = newText.trim();
    if (!clean) return;
    try {
      await onAdd(clean);
      setNewText('');
      setAdding(false);
    } catch { /* */ }
  };
  const safeItems = Array.isArray(items) ? items : [];
  const alunoDoneSet = useMemo(
    () => new Set(Array.isArray(alunoDoneIds) ? alunoDoneIds : []),
    [alunoDoneIds]
  );
  const pendingCount = safeItems.filter(it => !it.done).length;
  const doneCount = safeItems.length - pendingCount;
  const alunoDoneCount = safeItems.filter(it => !it.done && alunoDoneSet.has(it.id)).length;
  return (
    <div>
      {safeItems.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/20 px-3 py-4 text-center text-[11px] text-slate-500 italic mb-2">
          Nenhum takeaway ainda. Adicione manualmente ou via Pin de trade no feedback.
        </div>
      )}
      {safeItems.length > 0 && (
        <>
          <div className="text-[10px] text-slate-500 mb-1">
            {pendingCount} pendente{pendingCount === 1 ? '' : 's'} · {doneCount} encerrado{doneCount === 1 ? '' : 's'} pelo mentor
            {alunoDoneCount > 0 && <> · <span className="text-amber-400">{alunoDoneCount} marcado{alunoDoneCount === 1 ? '' : 's'} pelo aluno</span></>}
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/60 mb-2">
            {safeItems.map(it => (
              <TakeawayItem
                key={it.id}
                item={it}
                canEdit={canEdit}
                alunoDone={alunoDoneSet.has(it.id)}
                onToggle={onToggle}
                onRemove={onRemove}
                onNavigateToFeedback={onNavigateToFeedback}
              />
            ))}
          </div>
        </>
      )}
      {canEdit && (
        adding ? (
          <div className="flex items-start gap-2">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              disabled={actionLoading}
              rows={2}
              className="flex-1 input-dark text-[12px]"
              placeholder="Ex: Estudar aula 21 · Reforçar leitura de estrutura · Parar após 2 losses"
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleAdd}
                disabled={!newText.trim() || actionLoading}
                className="px-2 py-1 text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded hover:bg-emerald-500/30 disabled:opacity-40"
              >
                {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Adicionar'}
              </button>
              <button
                onClick={() => { setAdding(false); setNewText(''); }}
                disabled={actionLoading}
                className="px-2 py-1 text-[11px] text-slate-400 hover:text-white disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full px-3 py-1.5 text-[12px] text-slate-400 hover:text-emerald-300 border border-dashed border-slate-700 hover:border-emerald-500/40 rounded-lg flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3 h-3" /> Adicionar takeaway
          </button>
        )
      )}
    </div>
  );
};

export default TakeawaysSection;
