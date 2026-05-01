/**
 * MentorClassificationPanel — issue #219 (Phase A do épico #218).
 *
 * Mentor classifica trade como 'tecnico' ou 'sorte'. Quando 'sorte', flags
 * estruturadas qualificam (narrativa solta, sizing fora do plano, desvio do
 * modelo, outro). Motivo livre opcional. Aluno read-only (sem callbacks).
 *
 * Discricionário — sistema NÃO infere. Maturity v1 NÃO consome.
 */

import { useState, useEffect } from 'react';
import { Target, ChevronDown, ChevronUp, Loader2, X, CheckCircle2 } from 'lucide-react';
import { MENTOR_CLASSIFICATION_FLAGS } from '../../utils/tradeGateway';
import { DEFAULT_TECNICO_REASON } from '../../utils/mentorClassificationStats';

const FLAG_LABELS = {
  narrativa: 'Narrativa solta',
  sizing: 'Sizing fora do plano',
  desvio_modelo: 'Desvio do modelo',
  outro: 'Outro',
};

const CLASSIFICATION_LABELS = {
  tecnico: 'Técnico',
  sorte: 'Sorte',
};

const CLASSIFICATION_BADGE = {
  tecnico: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: 'Técnico' },
  sorte: { color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', label: 'Sorte' },
};

// Default exception-based: trades sem flag explícita contam/exibem como técnico.
// Quando trade.mentorClassification === null:
//  - Badge collapsed mostra "Técnico" (presumido)
//  - Panel expanded inicia com Técnico selecionado + reason padrão
//  - Salvar mover null → 'tecnico' explícito (audit trail). Mentor SÓ precisa
//    interagir quando quer marcar Sorte.
const buildDraftFromTrade = (trade) => {
  const cls = trade?.mentorClassification ?? null;
  if (cls === null) {
    // Default técnico exibido com justificativa padrão.
    return { classification: 'tecnico', flags: [], reason: DEFAULT_TECNICO_REASON, isImplicit: true };
  }
  return {
    classification: cls,
    flags: Array.isArray(trade?.mentorClassificationFlags) ? trade.mentorClassificationFlags : [],
    reason: trade?.mentorClassificationReason ?? '',
    isImplicit: false,
  };
};

const MentorClassificationPanel = ({ trade, onSave, readOnly = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [draft, setDraft] = useState(() => buildDraftFromTrade(trade));

  // Re-hydrata quando o trade muda (caller pode passar trade novo).
  useEffect(() => {
    setDraft(buildDraftFromTrade(trade));
  }, [trade?.id, trade?.mentorClassification, trade?.mentorClassificationFlags, trade?.mentorClassificationReason]);

  if (!trade) return null;

  const persistedCls = trade?.mentorClassification ?? null;
  const persistedFlags = Array.isArray(trade?.mentorClassificationFlags) ? trade.mentorClassificationFlags : [];
  const persistedReason = trade?.mentorClassificationReason ?? '';

  // isDirty: difere quando draft tem mudança real frente ao persistido.
  // Caso default implícito (null persistido + draft = tecnico padrão) NÃO é dirty.
  const isImplicitDefault =
    persistedCls === null &&
    draft.classification === 'tecnico' &&
    draft.flags.length === 0 &&
    draft.reason === DEFAULT_TECNICO_REASON;

  const isDirty = !isImplicitDefault && (
    draft.classification !== persistedCls ||
    draft.flags.length !== persistedFlags.length ||
    draft.flags.some((f) => !persistedFlags.includes(f)) ||
    (draft.reason || '') !== (persistedReason || '')
  );

  const handleSelect = (value) => {
    if (readOnly) return;
    if (draft.classification === value && value === 'sorte') {
      // Click novamente em Sorte = volta para Técnico default
      setDraft({ classification: 'tecnico', flags: [], reason: DEFAULT_TECNICO_REASON, isImplicit: true });
      return;
    }
    setDraft({
      classification: value,
      flags: value === 'tecnico' ? [] : draft.flags,
      // ao trocar para sorte limpa reason padrão (mentor digita o porquê);
      // ao voltar para tecnico restaura padrão.
      reason: value === 'tecnico' ? DEFAULT_TECNICO_REASON : '',
      isImplicit: false,
    });
  };

  const toggleFlag = (flag) => {
    if (readOnly) return;
    setDraft((prev) => ({
      ...prev,
      flags: prev.flags.includes(flag)
        ? prev.flags.filter((f) => f !== flag)
        : [...prev.flags, flag],
    }));
  };

  const handleSave = async () => {
    if (!onSave || !isDirty) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        classification: draft.classification,
        flags: draft.classification === 'sorte' ? draft.flags : [],
        reason: draft.classification === null ? null : (draft.reason?.trim() || null),
      });
    } catch (err) {
      setError(err?.message || 'Falha ao salvar classificação');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(buildDraftFromTrade(trade));
    setError(null);
  };

  // Badge sempre exibe — null persistido aparece como "Técnico" (presumido).
  const displayCls = persistedCls ?? 'tecnico';
  const badge = CLASSIFICATION_BADGE[displayCls];
  const isPresumed = persistedCls === null;

  return (
    <div className="glass-card border border-sky-500/30 p-4 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-medium text-sky-300">
            Classificação do trade {readOnly ? '(mentor)' : '(você é mentor)'}
          </span>
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.color} ${isPresumed ? 'opacity-70' : ''}`}>
            {badge.label}
            {isPresumed && <span className="ml-1 normal-case font-normal">(presumido)</span>}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          {/* Radios técnico/sorte */}
          <div className="flex items-center gap-2">
            {Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => {
              const isSelected = draft.classification === value;
              const colors = value === 'tecnico'
                ? 'border-emerald-500/40 text-emerald-300'
                : 'border-rose-500/40 text-rose-300';
              const colorsActive = value === 'tecnico'
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                : 'bg-rose-500/20 border-rose-500/60 text-rose-200';
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect(value)}
                  disabled={readOnly}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition ${
                    isSelected ? colorsActive : `${colors} hover:bg-slate-800/40`
                  } ${readOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                >
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}
                  {label}
                </button>
              );
            })}
          </div>
          {!readOnly && draft.classification === 'sorte' && (
            <p className="text-[10px] text-slate-500 -mt-1">
              Click novamente em "Sorte" para voltar ao Técnico default.
            </p>
          )}
          {!readOnly && isPresumed && (
            <p className="text-[10px] text-slate-500 -mt-1">
              Default: trade não classificado é exibido como Técnico com justificativa padrão.
              Salve para registrar Técnico explicitamente, ou flague Sorte como exceção.
            </p>
          )}

          {/* Flags estruturadas — só quando 'sorte' */}
          {draft.classification === 'sorte' && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">
                Por quê foi sorte? (opcional, multi-select)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MENTOR_CLASSIFICATION_FLAGS.map((flag) => {
                  const isSelected = draft.flags.includes(flag);
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => toggleFlag(flag)}
                      disabled={readOnly}
                      className={`text-[11px] px-2 py-1 rounded border transition ${
                        isSelected
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                          : 'border-slate-700 text-slate-400 hover:border-rose-500/30 hover:text-rose-300'
                      } ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {FLAG_LABELS[flag]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reason livre */}
          {draft.classification && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Motivo (opcional)</label>
              <textarea
                value={draft.reason}
                onChange={(e) => !readOnly && setDraft((prev) => ({ ...prev, reason: e.target.value }))}
                disabled={readOnly}
                rows={2}
                placeholder="Contexto adicional sob ótica do mentor..."
                className="w-full input-dark text-[12px]"
              />
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>
          )}

          {!readOnly && isDirty && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-40"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white rounded-lg font-medium"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Salvar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MentorClassificationPanel;
