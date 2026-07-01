/**
 * AddReviewNoteButton — anotar um ponto pra conversar na Revisão Semanal, a partir
 * do trade que o mentor está revisando (#318).
 *
 * Restore enxuto do PinToReviewButton (removido no #269 v2). Diferença: NÃO recria
 * pin/picker/inclusão de trade (isso o #269 automatizou — dar feedback ancora o
 * trade na revisão via getOrCreateOpenReview). Aqui só ACRESCENTA (append) o texto
 * nas Notas da Sessão (sessionNotes) da revisão DRAFT aberta daquele plano.
 *
 * Gate: mentor-only. Se ainda não existe DRAFT aberto (nenhum feedback dado ainda),
 * fica desabilitado — a revisão nasce no 1º feedback. Não cria revisão pelo cliente
 * (evita rascunho duplicado, bug do hotfix 14cca576).
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { PinIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';
import { fmtTradePrefix } from '../../utils/reviewNotePrefix';
import DebugBadge from '../DebugBadge';

const AddReviewNoteButton = ({ trade }) => {
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);

  const studentId = trade?.studentId || null;
  const planId = trade?.planId || null;
  const { reviews, appendSessionNote } = useWeeklyReviews(studentId);

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);

  const prefix = useMemo(() => fmtTradePrefix(trade), [trade]);

  // Revisão DRAFT aberta deste plano (nasce automática no 1º feedback — #269).
  // planId direto no doc (backlog) ou via frozenSnapshot em reviews legadas.
  const openDraft = useMemo(() => {
    if (!planId) return null;
    return (reviews || []).find((r) =>
      r.status === 'DRAFT' &&
      (r.planId === planId || r.frozenSnapshot?.planContext?.planId === planId)
    ) || null;
  }, [reviews, planId]);

  useEffect(() => {
    if (open && !note) setNote(prefix);
  }, [open, note, prefix]);

  const handleSave = useCallback(async () => {
    if (!openDraft) return;
    const trimmed = note.trim();
    if (!trimmed || trimmed === prefix.trim()) {
      setError('Escreva o ponto a conversar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await appendSessionNote(openDraft.id, note);
      setFlash('Adicionado às Notas da Sessão');
      setNote('');
      setOpen(false);
      setTimeout(() => setFlash(null), 2500);
    } catch {
      setError('Não foi possível anexar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [openDraft, note, prefix, appendSessionNote]);

  if (!mentor) return null;

  // Sem DRAFT aberto → desabilitado (a revisão nasce no 1º feedback).
  if (!openDraft) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          disabled
          title="Disponível após o primeiro feedback — a revisão da semana nasce aí."
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-500 cursor-not-allowed"
        >
          <PinIcon className="w-3.5 h-3.5" />
          Anotar ponto pra revisão
        </button>
        <DebugBadge component="AddReviewNoteButton" />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Anotar um ponto para conversar na Revisão Semanal"
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
      >
        <PinIcon className="w-3.5 h-3.5" />
        Anotar ponto pra revisão
      </button>

      {flash && (
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> {flash}
        </span>
      )}

      {open && (
        <div className="absolute z-50 mt-2 w-80 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
              <PinIcon className="w-3 h-3" /> Ponto pra revisão
            </span>
            <button
              type="button"
              onClick={() => { setOpen(false); setNote(''); setError(null); }}
              disabled={busy}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="text-[10px] text-slate-500 block mb-1">
            Acrescentado nas Notas da Sessão da revisão aberta:
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder={`${prefix}O que precisa conversar...`}
            className="w-full text-sm rounded-lg bg-slate-800/60 border border-white/10 px-2.5 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 resize-none"
          />

          {error && <div className="text-[11px] text-red-400 mt-1">{error}</div>}

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setNote(''); setError(null); }}
              disabled={busy}
              className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              Anotar
            </button>
          </div>
        </div>
      )}

      <DebugBadge component="AddReviewNoteButton" />
    </div>
  );
};

export default AddReviewNoteButton;
