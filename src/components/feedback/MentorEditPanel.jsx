import { useMemo, useState } from 'react';
import { Pencil, ChevronDown, ChevronUp, Loader2, RotateCcw, Lock, AlertTriangle } from 'lucide-react';
import { useMasterData } from '../../hooks/useMasterData';
import { useSetups } from '../../hooks/useSetups';
import { filterSetupsForStudent } from '../../utils/setupsFilter';

const MENTOR_FIELDS = [
  { key: 'emotionEntry', label: 'Emoção entrada', kind: 'emotion' },
  { key: 'emotionExit', label: 'Emoção saída', kind: 'emotion' },
  { key: 'setup', label: 'Setup', kind: 'setup' },
];

const MentorEditPanel = ({ trade, onSaveAndLock, onRevertToOriginal }) => {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { emotions } = useMasterData();
  const { setups: allSetups } = useSetups();

  const availableSetups = useMemo(
    () => filterSetupsForStudent(allSetups, trade?.studentId),
    [allSetups, trade?.studentId],
  );

  const [draft, setDraft] = useState({
    emotionEntry: trade?.emotionEntry ?? '',
    emotionExit: trade?.emotionExit ?? '',
    setup: trade?.setup ?? '',
  });

  if (!trade || trade._lockedByMentor) return null;

  const original = trade._studentOriginal || null;
  const changes = MENTOR_FIELDS.filter((f) => {
    const draftVal = draft[f.key] || null;
    const current = trade[f.key] || null;
    return draftVal !== current;
  });

  const handleChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleRevert = async () => {
    if (!original || !onRevertToOriginal) return;
    setSaving(true);
    setError(null);
    try {
      await onRevertToOriginal({
        emotionEntry: original.emotionEntry ?? null,
        emotionExit: original.emotionExit ?? null,
        setup: original.setup ?? null,
      });
      setDraft({
        emotionEntry: original.emotionEntry ?? '',
        emotionExit: original.emotionExit ?? '',
        setup: original.setup ?? '',
      });
    } catch (err) {
      setError(err?.message || 'Falha ao reverter');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (changes.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveAndLock({
        emotionEntry: draft.emotionEntry || null,
        emotionExit: draft.emotionExit || null,
        setup: draft.setup || null,
      });
      setShowConfirm(false);
    } catch (err) {
      setError(err?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card border border-amber-500/30 p-4 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-300">Editar campos do aluno (mentor)</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          {MENTOR_FIELDS.map((f) => {
            const current = trade[f.key] || '';
            const options = f.kind === 'emotion' ? emotions : availableSetups;
            return (
              <div key={f.key} className="flex items-center gap-3">
                <label className="text-xs text-slate-400 w-32 flex-shrink-0">{f.label}</label>
                <select
                  value={draft[f.key] || ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="input-filter flex-1"
                >
                  <option value="">—</option>
                  {options.map((opt) => (
                    <option key={opt.id || opt.name} value={opt.name}>{opt.name}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 w-32 truncate" title={`Original: ${current || '—'}`}>
                  era: {current || '—'}
                </span>
              </div>
            );
          })}

          <div className="flex items-start gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Travar = registro fica imutável nos 3 campos. Nem você nem o aluno editam depois.
              Import (CSV/broker) pode destravar.
            </span>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            {original && (
              <button
                type="button"
                onClick={handleRevert}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg"
                title="Reverte emoção/setup para o valor originalmente declarado pelo aluno"
              >
                <RotateCcw className="w-3 h-3" />Reverter ao original
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={saving || changes.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                Confirmar e travar{changes.length > 0 ? ` (${changes.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50" onClick={() => !saving && setShowConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
            <div className="glass-card border border-amber-500/30 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Confirmar correção</h3>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-slate-400 mb-2">Você vai alterar:</p>
                {changes.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 pl-2">
                    <span className="text-slate-500 w-32">{f.label}:</span>
                    <span className="text-slate-400">{trade[f.key] || '—'}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-amber-300 font-medium">{draft[f.key] || '—'}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                Após confirmar, ninguém edita estes 3 campos.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !saving && setShowConfirm(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-40"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Confirmar e travar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MentorEditPanel;
