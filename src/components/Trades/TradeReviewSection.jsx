/**
 * TradeReviewSection — auto-revisão de trade pelo aluno (issue #308, CHUNK-04).
 *
 * Questionário processo × resultado: resultado automático por sign(trade.result);
 * o aluno declara wouldRepeat ("faria de novo sem saber o resultado?") e responde
 * as perguntas do quadrante derivado. NÃO mexe no score 4D.
 *
 * Espelho determinístico: confronto declarado × detectado (wouldRepeat × padrão
 * dominante de behaviorProfile.families) — base do futuro feedback IA.
 *
 * Estados: (A) nudge "Revisar agora/depois" → (B) escolher SIM/NÃO + perguntas →
 * (C) leitura + banner do confronto. Imutável após DISCUSSED (#269).
 */
import React, { useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { CONFRONT_TONE_STYLES } from './behaviorDisplay';
import { classifyTrade, reviewVerdict, REVIEW_VERDICT } from '../../utils/tradeReviewConfront';
import {
  WOULD_REPEAT_PROMPT, TRADE_REVIEW_QUESTIONS, questionsForQuadrant, REVIEW_DIMENSIONS,
} from '../../constants/tradeReviewFramework';

/** verdict + declaração → {tone, text} para o banner do espelho (ou null). */
const confrontDisplay = (vr) => {
  if (!vr) return null;
  const { verdict, declared } = vr;
  if (verdict === REVIEW_VERDICT.MISALIGNED) {
    return { tone: 'red', text: 'Você faria de novo, mas a execução sugere um furo grave. Vale revisitar: foi processo ou sorte?' };
  }
  if (verdict === REVIEW_VERDICT.ATTENTION) {
    return declared
      ? { tone: 'amber', text: 'Você faria de novo, mas houve um desvio na execução. Confirme se o processo se sustenta.' }
      : { tone: 'amber', text: 'Você não repetiria, mas a execução saiu limpa. Cuidado com o viés de resultado — talvez o processo tenha sido bom.' };
  }
  // ALIGNED
  return declared
    ? { tone: 'emerald', text: 'Processo aprovado e execução coerente.' }
    : { tone: 'emerald', text: 'Você reconheceu o que não repetiria — boa consciência de processo.' };
};

const DimBadge = ({ dimension }) => {
  const d = REVIEW_DIMENSIONS[dimension];
  if (!d) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-zinc-300 shrink-0" title={d.label}>
      {d.key}
    </span>
  );
};

const TradeReviewSection = ({ trade, canReview = false, onSubmit, startOpen = false }) => {
  const existing = trade?.selfReview || null;
  // #313 — no fluxo de registro o Espelho já abre nas perguntas (pula o nudge "Olhar no espelho").
  const [editing, setEditing] = useState(startOpen);
  const [wouldRepeat, setWouldRepeat] = useState(null);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);

  const families = trade?.behaviorProfile?.families;

  // ── Estado C: já revisado (leitura + espelho) ──
  if (existing) {
    const quadrant = classifyTrade(trade.result, existing.wouldRepeat);
    const meta = TRADE_REVIEW_QUESTIONS[quadrant];
    const vr = reviewVerdict(existing.wouldRepeat, families);
    const banner = confrontDisplay(vr);
    const answered = questionsForQuadrant(quadrant).filter((q) => existing.answers?.[q.id]);
    return (
      <div className="relative border border-white/10 rounded-xl p-4 bg-white/5 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCheck className="w-4 h-4 text-zinc-300" />
          <span className="text-sm font-medium text-zinc-200">Reflexão</span>
          {meta && <span className="text-xs text-zinc-400">· {meta.label}</span>}
          <span className={`text-xs px-1.5 py-0.5 rounded border ${existing.wouldRepeat ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-300'}`}>
            Faria de novo: {existing.wouldRepeat ? 'Sim' : 'Não'}
          </span>
        </div>
        {answered.length > 0 && (
          <div className="space-y-2 mb-3">
            {answered.map((q) => (
              <div key={q.id} className="text-sm">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-0.5">
                  <DimBadge dimension={q.dimension} /> {q.text}
                </div>
                <div className="text-zinc-200 whitespace-pre-wrap pl-1">{existing.answers[q.id]}</div>
              </div>
            ))}
          </div>
        )}
        {banner && (
          <div className={`text-xs rounded-lg border px-3 py-2 ${CONFRONT_TONE_STYLES[banner.tone]}`}>
            <span className="font-medium">Análise · </span>{banner.text}
          </div>
        )}
        <DebugBadge component="TradeReviewSection" />
      </div>
    );
  }

  // Mentor (ou quem não pode revisar) e sem auto-revisão: nada a mostrar.
  if (!canReview || typeof onSubmit !== 'function') return null;

  const quadrant = wouldRepeat === null ? null : classifyTrade(trade.result, wouldRepeat);
  const questions = quadrant ? questionsForQuadrant(quadrant) : [];

  const reset = () => { setEditing(false); setWouldRepeat(null); setAnswers({}); };

  const handleSave = async () => {
    if (wouldRepeat === null) return;
    setSaving(true);
    try {
      await onSubmit({ wouldRepeat, answers });
      reset();
    } catch (err) {
      console.error('[TradeReviewSection] erro ao salvar auto-revisão:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Estado A: nudge ──
  if (!editing) {
    return (
      <div className="relative border border-white/10 rounded-xl p-4 bg-white/5 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-zinc-300" />
            <span className="text-sm text-zinc-300">Este trade ainda não tem sua auto-análise.</span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
          >
            Analisar o trade
          </button>
        </div>
        <DebugBadge component="TradeReviewSection" />
      </div>
    );
  }

  // ── Estado B: fluxo ──
  const isWin = Number(trade.result) > 0;
  return (
    <div className="relative border border-white/10 rounded-xl p-4 bg-white/5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="w-4 h-4 text-zinc-300" />
        <span className="text-sm font-medium text-zinc-200">Reflexão</span>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${isWin ? 'border-emerald-500/30 text-emerald-300' : 'border-red-500/30 text-red-300'}`}>
          {isWin ? 'Ganho' : 'Perda'}
        </span>
      </div>

      <div className="mb-3">
        <div className="text-sm text-zinc-300 mb-2">{WOULD_REPEAT_PROMPT}</div>
        <div className="flex gap-2">
          {[['Sim', true], ['Não', false]].map(([label, val]) => (
            <button
              key={label}
              type="button"
              onClick={() => setWouldRepeat(val)}
              className={`text-sm px-4 py-1.5 rounded-lg border transition-colors ${
                wouldRepeat === val
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/20 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {wouldRepeat !== null && (
        <div className="space-y-3 mb-3">
          {questions.map((q) => (
            <div key={q.id}>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                <DimBadge dimension={q.dimension} /> {q.text}
              </label>
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={2}
                className="w-full text-sm bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40 resize-y"
                placeholder="Sua reflexão (opcional)…"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          className="text-sm px-3 py-1.5 rounded-lg border border-white/20 text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={wouldRepeat === null || saving}
          className="text-sm px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          Salvar revisão
        </button>
      </div>
      <DebugBadge component="TradeReviewSection" />
    </div>
  );
};

export default TradeReviewSection;
