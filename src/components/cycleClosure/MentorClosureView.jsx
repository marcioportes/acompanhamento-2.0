/**
 * MentorClosureView.jsx — view read-only do closure + sticky comment panel.
 *
 * Mentor abre via inbox. Vê resumo das 8 etapas em accordion + painel lateral
 * com textarea pra adicionar/atualizar mentor.closingComment.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Props:
 *   - closure: doc completo de cycleClosures
 *   - onClose: callback fechar
 *   - onSaved: callback após salvar comment
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, Save, Lock, Loader2, ShieldAlert, X } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const STAGE_LABEL_MAP = ['Caos', 'Reativo', 'Metódico', 'Profissional', 'Maestria'];
const MAX_COMMENT_CHARS = 2000;

function fmtPct(v, digits = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

function Section({ title, children, badge }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="glass-card p-4"
    >
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="font-semibold text-slate-200">{title}</span>
        {badge && <span className="text-xs text-slate-400">{badge}</span>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export default function MentorClosureView({ closure, onClose, onSaved, studentName }) {
  const [comment, setComment] = useState(closure?.mentor?.closingComment || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(closure?.mentor?.closingCommentAt || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setComment(closure?.mentor?.closingComment || '');
    setSavedAt(closure?.mentor?.closingCommentAt || null);
  }, [closure?.id]);

  const saveComment = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const functions = getFunctions();
      const cf = httpsCallable(functions, 'setMentorClosureComment');
      await cf({ closureId: closure.id, comment });
      setSavedAt(new Date());
      onSaved?.(closure.id);
    } catch (e) {
      setError(e?.message || 'Erro ao salvar comentário');
    } finally {
      setSaving(false);
    }
  };

  const markNoComment = async () => {
    if (saving) return;
    if (!window.confirm('Marcar este closure como "no comment"? O item sai do inbox imediatamente.')) return;
    setError(null);
    setSaving(true);
    try {
      const functions = getFunctions();
      const cf = httpsCallable(functions, 'setMentorClosureComment');
      // Comment vazio sinaliza "no comment" na CF
      await cf({ closureId: closure.id, comment: '' });
      setSavedAt(new Date());
      onSaved?.(closure.id);
      onClose?.();
    } catch (e) {
      setError(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!closure) return null;

  const snap = closure.snapshot || {};
  const metrics = closure.metrics || {};
  const aar = closure.aar || {};
  const swot = closure.swot || {};
  const maturity = closure.maturity || {};
  const forward = closure.forward || {};
  const stage = maturity.currentStage;
  const stageLabel = stage ? `Stage ${stage} — ${STAGE_LABEL_MAP[stage - 1] || '?'}` : '—';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 pb-20">
        <button
          type="button"
          onClick={onClose}
          className="fixed top-4 right-4 z-[60] w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={onClose} className="btn-secondary text-xs flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h2 className="text-2xl font-bold text-slate-100">
            🔍 {studentName || closure.studentId.slice(0, 8)} · {closure.cycleKey}
          </h2>
          {closure.closeMode !== 'self' && (
            <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
              closeMode: {closure.closeMode}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Coluna principal — closure read-only */}
          <div className="col-span-2 space-y-4">
            {/* Resumo */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-100">Resumo do ciclo</h4>
                <span className="text-xs text-slate-400">selado {closure.closedBy?.role || 'student'} {closure.closedBy?.email}</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-800/30 rounded p-2.5">
                  <p className="text-[10px] text-slate-500">Resultado</p>
                  <p className={`font-bold mono ${snap.resultPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(snap.resultPercent)}</p>
                </div>
                <div className="bg-slate-800/30 rounded p-2.5">
                  <p className="text-[10px] text-slate-500">Status</p>
                  <p className="font-bold text-amber-400">{snap.cycleStatus || '—'}</p>
                </div>
                <div className="bg-slate-800/30 rounded p-2.5">
                  <p className="text-[10px] text-slate-500">TPS</p>
                  <p className="font-bold text-slate-100 mono">{metrics.tradingPerformanceScore != null ? `${Math.round(metrics.tradingPerformanceScore)}/100` : '—'}</p>
                </div>
                <div className="bg-slate-800/30 rounded p-2.5">
                  <p className="text-[10px] text-slate-500">Stage</p>
                  <p className="font-bold text-slate-100 mono text-xs">{stageLabel}</p>
                </div>
              </div>
            </div>

            <Section title="① Read · Snapshot" badge={`${snap.tradesCount ?? '—'} trades`}>
              <p className="text-sm text-slate-400">
                Resultado {fmtPct(snap.resultPercent)} ({snap.cycleStatus}) — capital R$ {snap.plStart?.toLocaleString('pt-BR')} → R$ {snap.plEnd?.toLocaleString('pt-BR')}.
                Sharpe {metrics.sharpe?.value?.toFixed(2) ?? '—'} · DD {fmtPct((metrics.maxDrawdown?.percent ?? 0) * 100)} ·
                Edge {metrics.expectancy_R != null ? `${metrics.expectancy_R >= 0 ? '+' : ''}${metrics.expectancy_R.toFixed(2)}R` : '—'} ·
                Rule {metrics.ruleAdherenceRate != null ? `${(metrics.ruleAdherenceRate * 100).toFixed(1)}%` : '—'}.
              </p>
            </Section>

            <Section title="② Notice · Patterns" badge={
              ((closure.patterns?.eventCounts?.tilt ?? 0) + (closure.patterns?.eventCounts?.revenge ?? 0) > 0)
                ? `⚠ ${closure.patterns.eventCounts.tilt}T / ${closure.patterns.eventCounts.revenge}R`
                : 'limpo'
            }>
              <p className="text-sm text-slate-400">
                Top errors: {(closure.patterns?.topErrors || []).join(', ') || 'nenhum'}.
                Eventos: {Object.entries(closure.patterns?.eventCounts || {}).map(([k, v]) => `${k}=${v}`).join(' · ') || '—'}.
              </p>
            </Section>

            <Section title="③ Reflect · AAR" badge={`Q3: ${(aar.whyDifference?.attributions || []).join(' + ') || '—'}`}>
              <div className="text-sm text-slate-300 space-y-2">
                <p><span className="text-slate-500">Q3 texto:</span> {aar.whyDifference?.text || '—'}</p>
                <p><span className="text-slate-500">Q4 sustain:</span> {(aar.sustain || []).join(' · ') || '—'}</p>
                <p><span className="text-slate-500">Q4 improve:</span> {(aar.improve || []).join(' · ') || '—'}</p>
              </div>
            </Section>

            <Section title="④ Map · SWOT" badge={`${(swot.strengths || []).length + (swot.weaknesses || []).length + (swot.opportunities || []).length + (swot.threats || []).length} itens`}>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div><strong className="text-emerald-300">S:</strong> {(swot.strengths || []).join(' · ') || '—'}</div>
                <div><strong className="text-red-300">W:</strong> {(swot.weaknesses || []).join(' · ') || '—'}</div>
                <div><strong className="text-sky-300">O:</strong> {(swot.opportunities || []).join(' · ') || '—'}</div>
                <div><strong className="text-amber-300">T:</strong> {(swot.threats || []).join(' · ') || '—'}</div>
              </div>
            </Section>

            <Section title="⑤ Check · Maturity" badge={
              maturity.promotionEligible ? '✨ promotion eligible' :
              (maturity.regression && maturity.regression.length > 0)
                ? <><ShieldAlert className="w-3 h-3 inline" /> regression em {maturity.regression.join(', ')}</>
                : `${stageLabel}`
            }>
              <p className="text-sm text-slate-400">
                Composite {maturity?.scores?.composite?.toFixed(1) ?? '—'} ·
                Emocional {maturity?.scores?.emotional ?? '—'} ·
                Financial {maturity?.scores?.financial ?? '—'} ·
                Operational {maturity?.scores?.operational ?? '—'} ·
                Experience {maturity?.scores?.experience ?? '—'}.
              </p>
              {maturity.mentorOverride && (
                <p className="text-[11px] text-amber-300 mt-2">
                  Override aplicado: {maturity.mentorOverride.fromStage} → {maturity.mentorOverride.toStage} — {maturity.mentorOverride.rationale}
                </p>
              )}
            </Section>

            <Section title="⑥ Adjust · Plano" badge={
              forward.planAdjustment?.changed ? `↺ ajustado (${forward.planAdjustment.decisionSource})` : 'mantido'
            }>
              <p className="text-sm text-slate-400">
                Kelly safe {forward.kellyRecommendation?.kellySafe != null ? `${(forward.kellyRecommendation.kellySafe * 100).toFixed(1)}%` : '—'} ·
                MC p10/p50/p90: {forward.mcSimulation ? `${forward.mcSimulation.p10?.toFixed(0) ?? '—'} / ${forward.mcSimulation.p50?.toFixed(0) ?? '—'} / ${forward.mcSimulation.p90?.toFixed(0) ?? '—'}` : '—'}.
                Decisão: <code className="bg-slate-800 px-1 rounded">{forward.planAdjustment?.decisionSource || '—'}</code>.
              </p>
              {forward.aiSuggestion?.rationale && (
                <p className="text-[11px] text-slate-500 mt-2 italic">
                  IA stub disse: "{forward.aiSuggestion.rationale}"
                </p>
              )}
            </Section>

            <Section title="⑦ Commit · Forward" badge={`${(forward.behavioralCommitments || []).length}/2`}>
              <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
                {(forward.behavioralCommitments || []).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              {closure.notes && <p className="text-[11px] text-slate-500 mt-3 italic">Notas: {closure.notes}</p>}
            </Section>
          </div>

          {/* Coluna lateral — comment panel */}
          <div className="col-span-1">
            <div className="glass-card p-5 sticky top-4 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <h4 className="font-semibold text-slate-100">Comentário de fechamento</h4>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Janela de 7 dias após o aluno selar. Após isso o sistema marca <em>"no comment"</em> automaticamente.
              </p>

              <textarea
                rows={8}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_CHARS))}
                placeholder="Comentário consolidado pro aluno ler na próxima sessão. Mantenha curto e construtivo (Steenbarger)."
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />

              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-slate-600">{comment.length} / {MAX_COMMENT_CHARS}</span>
                {savedAt && <span className="text-emerald-400">✓ salvo</span>}
              </div>

              {error && (
                <p className="text-xs text-red-400 mt-2">⚠ {error}</p>
              )}

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={saveComment}
                  disabled={saving}
                  className="btn-primary text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar comentário
                </button>
                <button
                  type="button"
                  onClick={markNoComment}
                  disabled={saving || comment.trim().length > 0}
                  className="btn-secondary text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={comment.trim().length > 0 ? 'Apague o texto pra marcar no comment' : ''}
                >
                  <Lock className="w-3 h-3" /> Marcar "no comment" agora
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
