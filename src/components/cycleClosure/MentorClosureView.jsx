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
import { ArrowLeft, MessageSquare, Save, Lock, Loader2, ShieldAlert, Unlock } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { KpiCard } from '../reviews/ReviewKpiGrid';
import { deltaText } from '../../utils/reviewFormatters';
import { ERROR_LABELS_PT } from '../../utils/cycleClosure/cycleMetrics';

const STAGE_LABEL_MAP = ['Caos', 'Reativo', 'Metódico', 'Profissional', 'Maestria'];
const MAX_COMMENT_CHARS = 2000;

const MONTH_LABELS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Converte cycleKey em label humano:
//   '2026-04' → 'Abril 2026' (Mensal)
//   '2026-Q2' → '2º trimestre 2026'
//   '2026-S1' → '1º semestre 2026'
//   '2026'    → 'Ano 2026'
function cycleKeyToLabel(cycleKey) {
  if (!cycleKey) return '—';
  const monthly = cycleKey.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (monthly) return `${MONTH_LABELS_PT[parseInt(monthly[2], 10) - 1]} ${monthly[1]}`;
  const quarter = cycleKey.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return `${quarter[2]}º trimestre ${quarter[1]}`;
  const semester = cycleKey.match(/^(\d{4})-S([12])$/);
  if (semester) return `${semester[2]}º semestre ${semester[1]}`;
  if (/^\d{4}$/.test(cycleKey)) return `Ano ${cycleKey}`;
  return cycleKey;
}

function fmtPct(v, digits = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

function fmtNum(v, digits = 2) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
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

export default function MentorClosureView({
  closure,
  previousClosure = null,
  onClose,
  onSaved,
  studentName,
  viewerRole = 'mentor',
}) {
  const isMentorView = viewerRole === 'mentor';
  const [comment, setComment] = useState(closure?.mentor?.closingComment || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(closure?.mentor?.closingCommentAt || null);
  const [error, setError] = useState(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenConfirmText, setReopenConfirmText] = useState('');

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

  const handleReopen = async () => {
    if (reopening) return;
    setError(null);
    setReopening(true);
    try {
      const functions = getFunctions();
      const cf = httpsCallable(functions, 'reopenCycle');
      await cf({ closureId: closure.id });
      setReopenOpen(false);
      setReopenConfirmText('');
      // Doc apagado, hard seal saiu, trades editáveis. Volta pra lista.
      onClose?.();
    } catch (e) {
      setError(e?.message || 'Erro ao reabrir ciclo');
    } finally {
      setReopening(false);
    }
  };

  const expectedConfirmLabel = cycleKeyToLabel(closure?.cycleKey);
  const confirmMatches = reopenConfirmText.trim() === expectedConfirmLabel;

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
  const stageLabel = stage ? `Estágio ${stage} — ${STAGE_LABEL_MAP[stage - 1] || '—'}` : '—';

  const prevSnap = previousClosure?.snapshot || {};
  const prevMetrics = previousClosure?.metrics || {};

  return (
    <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button type="button" onClick={onClose} className="btn-secondary text-xs flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h2 className="text-2xl font-bold text-slate-100">
            {cycleKeyToLabel(closure.cycleKey)}
            {studentName && <span className="text-slate-400 font-normal"> · {studentName}</span>}
          </h2>
          {previousClosure && (
            <span className="text-xs text-slate-500">
              comparado com {cycleKeyToLabel(previousClosure.cycleKey)}
            </span>
          )}
          {closure.closeMode === 'demonstrated' && (
            <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
              demonstrado pelo mentor
            </span>
          )}
          {closure.closeMode === 'co_edited' && (
            <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
              co-fechado com mentor
            </span>
          )}
          <button
            type="button"
            onClick={() => setReopenOpen((v) => !v)}
            className="ml-auto btn-secondary text-xs flex items-center gap-1"
            title="Reabrir apaga este fechamento e libera as datas pra edição"
          >
            <Unlock className="w-3.5 h-3.5" /> Reabrir ciclo
          </button>
        </div>

        {reopenOpen && (
          <div className="glass-card p-3 border border-amber-500/40 bg-amber-500/5 max-w-2xl space-y-2">
            <p className="text-xs text-slate-400 flex items-start gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Apaga este fechamento e libera trades de {closure.cycleStart} → {closure.cycleEnd}.
                Pra confirmar, digite <strong className="text-amber-300">{expectedConfirmLabel}</strong>:
              </span>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={reopenConfirmText}
                onChange={(e) => setReopenConfirmText(e.target.value)}
                placeholder={expectedConfirmLabel}
                disabled={reopening}
                autoComplete="off"
                className="flex-1 max-w-[220px] bg-slate-800/50 border border-slate-700/50 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleReopen}
                disabled={reopening || !confirmMatches}
                className="btn-primary text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                title={confirmMatches ? '' : `Digite "${expectedConfirmLabel}" pra liberar`}
              >
                {reopening ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => { setReopenOpen(false); setReopenConfirmText(''); setError(null); }}
                disabled={reopening}
                className="text-xs text-slate-500 hover:text-slate-300 px-2 disabled:opacity-50"
              >
                cancelar
              </button>
            </div>
            {error && <p className="text-xs text-red-400">⚠ {error}</p>}
          </div>
        )}

        <div className={isMentorView ? 'grid grid-cols-3 gap-4' : ''}>
          {/* Coluna principal — closure read-only */}
          <div className={isMentorView ? 'col-span-2 space-y-4' : 'space-y-4'}>
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
                  <p className="text-[10px] text-slate-500">Como terminou</p>
                  <p className="font-bold text-amber-400 text-xs">{
                    snap.cycleStatus === 'GOAL_HIT' ? 'Meta batida' :
                    snap.cycleStatus === 'STOP_HIT' ? 'Stop atingido' :
                    snap.cycleStatus === 'NEUTRAL' ? 'No meio' :
                    '—'
                  }</p>
                </div>
                <div className="bg-slate-800/30 rounded p-2.5">
                  <p className="text-[10px] text-slate-500">Nota geral</p>
                  <p className="font-bold text-slate-100 mono">{metrics.tradingPerformanceScore != null ? `${Math.round(metrics.tradingPerformanceScore)}/100` : '—'}</p>
                </div>
                <div className="bg-slate-800/30 rounded p-2.5">
                  <p className="text-[10px] text-slate-500">Estágio</p>
                  <p className="font-bold text-slate-100 mono text-xs">{stageLabel}</p>
                </div>
              </div>
            </div>

            {/* KPIs com comparação vs ciclo anterior */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-100">Indicadores do ciclo</h4>
                {previousClosure && (
                  <span className="text-[11px] text-slate-500">
                    delta vs {cycleKeyToLabel(previousClosure.cycleKey)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <KpiCard
                  label="Resultado"
                  value={fmtPct(snap.resultPercent)}
                  delta={deltaText(snap.resultPercent, prevSnap.resultPercent, (d) => `${d.toFixed(1)}%`)}
                  prev={Number.isFinite(Number(prevSnap.resultPercent)) ? `anterior: ${fmtPct(prevSnap.resultPercent)}` : null}
                  tooltip="Variação percentual do capital no ciclo. Compara com o ciclo anterior pra ver se está acelerando ou desacelerando."
                />
                <KpiCard
                  label="Nota geral (TPS)"
                  value={Number.isFinite(metrics.tradingPerformanceScore) ? `${Math.round(metrics.tradingPerformanceScore)}/100` : '—'}
                  delta={deltaText(metrics.tradingPerformanceScore, prevMetrics.tradingPerformanceScore, (d) => d.toFixed(0))}
                  prev={Number.isFinite(Number(prevMetrics.tradingPerformanceScore)) ? `anterior: ${Math.round(prevMetrics.tradingPerformanceScore)}/100` : null}
                  tooltip="Trading Performance Score: composto 0-100 que pesa profit factor, drawdown, expectativa, consistência semanal e disciplina. Medida única de qualidade do ciclo."
                />
                <KpiCard
                  label="Profit factor"
                  value={fmtNum(metrics.profitFactor, 2)}
                  delta={deltaText(metrics.profitFactor, prevMetrics.profitFactor, (d) => d.toFixed(2))}
                  prev={Number.isFinite(Number(prevMetrics.profitFactor)) ? `anterior: ${fmtNum(prevMetrics.profitFactor, 2)}` : null}
                  tooltip="Σwins ÷ |Σlosses|. >1 rentável, >2 robusto, >3 excepcional."
                />
                <KpiCard
                  label="Expectativa"
                  value={Number.isFinite(metrics.expectancy_R) ? `${metrics.expectancy_R >= 0 ? '+' : ''}${metrics.expectancy_R.toFixed(2)}R` : '—'}
                  delta={deltaText(metrics.expectancy_R, prevMetrics.expectancy_R, (d) => `${d.toFixed(2)}R`)}
                  prev={Number.isFinite(Number(prevMetrics.expectancy_R)) ? `anterior: ${prevMetrics.expectancy_R >= 0 ? '+' : ''}${prevMetrics.expectancy_R.toFixed(2)}R` : null}
                  tooltip="Van Tharp expectancy em R-multiples. Quanto você ganha em média por trade, expresso em unidades de risco. >0.3R bom, >0.5R excelente."
                />
                <KpiCard
                  label="Maior queda"
                  value={Number.isFinite(metrics.maxDrawdown?.percent) ? fmtPct(metrics.maxDrawdown.percent * 100) : '—'}
                  delta={deltaText(metrics.maxDrawdown?.percent, prevMetrics.maxDrawdown?.percent, (d) => `${(d * 100).toFixed(1)}%`, true)}
                  prev={Number.isFinite(Number(prevMetrics.maxDrawdown?.percent)) ? `anterior: ${fmtPct(prevMetrics.maxDrawdown.percent * 100)}` : null}
                  tooltip="Maior drawdown intra-ciclo (pico→vale). Menor é melhor — cores invertidas (verde quando cai, vermelho quando sobe)."
                />
                <KpiCard
                  label="Disciplina"
                  value={Number.isFinite(metrics.ruleAdherenceRate) ? `${(metrics.ruleAdherenceRate * 100).toFixed(1)}%` : '—'}
                  delta={deltaText(metrics.ruleAdherenceRate, prevMetrics.ruleAdherenceRate, (d) => `${(d * 100).toFixed(1)}%`)}
                  prev={Number.isFinite(Number(prevMetrics.ruleAdherenceRate)) ? `anterior: ${(prevMetrics.ruleAdherenceRate * 100).toFixed(1)}%` : null}
                  tooltip="% de trades que respeitaram stop e RR-alvo. Queda indica flexibilização de regras — sinal de alerta."
                />
                <KpiCard
                  label="Consistência (Sharpe)"
                  value={fmtNum(metrics.sharpe?.value, 2)}
                  delta={deltaText(metrics.sharpe?.value, prevMetrics.sharpe?.value, (d) => d.toFixed(2))}
                  prev={Number.isFinite(Number(prevMetrics.sharpe?.value)) ? `anterior: ${fmtNum(prevMetrics.sharpe.value, 2)}` : null}
                  tooltip="Retorno médio dividido pelo desvio-padrão dos retornos. Maior = mais consistente."
                />
                <KpiCard
                  label="Coef. variação"
                  value={fmtNum(metrics.cvNormalized?.value, 2)}
                  delta={deltaText(metrics.cvNormalized?.value, prevMetrics.cvNormalized?.value, (d) => d.toFixed(2), true)}
                  prev={Number.isFinite(Number(prevMetrics.cvNormalized?.value)) ? `anterior: ${fmtNum(prevMetrics.cvNormalized.value, 2)}` : null}
                  tooltip="Desvio-padrão ÷ |média| dos resultados por trade. Menor = melhor (cores invertidas). >2.0 indica que P&L é dominado por 1-2 trades."
                />
              </div>
            </div>

            <Section title="① Os números do ciclo" badge={`${snap.tradesCount ?? '—'} trades`}>
              <p className="text-sm text-slate-400">
                Resultado {fmtPct(snap.resultPercent)} ({
                  snap.cycleStatus === 'GOAL_HIT' ? 'meta batida' :
                  snap.cycleStatus === 'STOP_HIT' ? 'stop atingido' :
                  'no meio do caminho'
                }) — capital R$ {snap.plStart?.toLocaleString('pt-BR')} → R$ {snap.plEnd?.toLocaleString('pt-BR')}.
                Consistência {metrics.sharpe?.value?.toFixed(2) ?? '—'} · Maior queda {fmtPct((metrics.maxDrawdown?.percent ?? 0) * 100)} ·
                Ganho médio {metrics.expectancy_R != null ? `${metrics.expectancy_R >= 0 ? '+' : ''}${metrics.expectancy_R.toFixed(2)}R` : '—'} por trade ·
                Disciplina {metrics.ruleAdherenceRate != null ? `${(metrics.ruleAdherenceRate * 100).toFixed(1)}%` : '—'}.
              </p>
            </Section>

            <Section title="② Padrões observados" badge={
              ((closure.patterns?.eventCounts?.tilt ?? 0) + (closure.patterns?.eventCounts?.revenge ?? 0) > 0)
                ? `⚠ ${closure.patterns.eventCounts.tilt} tilt / ${closure.patterns.eventCounts.revenge} revenge`
                : 'sem padrões'
            }>
              {(() => {
                // Fallback pra closures antigas (sem unifiedErrors): deriva no fly
                // mesclando patterns.topErrors (raw string array) + eventCounts.
                const eventCounts = closure.patterns?.eventCounts || {};
                let unified = Array.isArray(closure.patterns?.unifiedErrors) ? closure.patterns.unifiedErrors : null;
                if (!unified) {
                  const fromCompliance = (closure.patterns?.topErrors || []).map((t) => ({
                    type: t, count: 1, source: 'compliance', label: ERROR_LABELS_PT[t] || t,
                  }));
                  const behavioralKeys = ['tilt','revenge','overtrading','stopTampering','rapidReentry','chaseReentry','hesitation','breakevenTooEarly','partialSizing'];
                  const fromBehavioral = behavioralKeys
                    .map((k) => ({ type: k, count: Number(eventCounts[k]) || 0, source: 'behavioral', label: ERROR_LABELS_PT[k] || k }))
                    .filter((e) => e.count > 0);
                  unified = [...fromCompliance, ...fromBehavioral]
                    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
                    .slice(0, 5);
                }
                const nonZero = Object.entries(eventCounts)
                  .filter(([, v]) => Number(v) > 0)
                  .map(([k, v]) => `${ERROR_LABELS_PT[k] || k} ${v}`)
                  .join(' · ');
                return (
                  <p className="text-sm text-slate-400">
                    Erros do ciclo: {unified.length === 0
                      ? 'nenhum'
                      : unified.map((e) => `${e.label}×${e.count}`).join(', ')}.
                    {nonZero && (
                      <>
                        <br />
                        <span className="text-[11px] text-slate-500">Granularidade: {nonZero}.</span>
                      </>
                    )}
                  </p>
                );
              })()}
            </Section>

            <Section title="③ Refletir" badge={`Por quê: ${(aar.whyDifference?.attributions || []).join(' + ') || '—'}`}>
              <div className="text-sm text-slate-300 space-y-2">
                <p><span className="text-slate-500">Explicação:</span> {aar.whyDifference?.text || '—'}</p>
                <p><span className="text-slate-500">A manter:</span> {(aar.sustain || []).join(' · ') || '—'}</p>
                <p><span className="text-slate-500">A ajustar:</span> {(aar.improve || []).join(' · ') || '—'}</p>
              </div>
            </Section>

            <Section title="④ Pontos fortes, fracos, oportunidades e ameaças" badge={`${(swot.strengths || []).length + (swot.weaknesses || []).length + (swot.opportunities || []).length + (swot.threats || []).length} itens`}>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div><strong className="text-emerald-300">Fortes:</strong> {(swot.strengths || []).join(' · ') || '—'}</div>
                <div><strong className="text-red-300">Fracos:</strong> {(swot.weaknesses || []).join(' · ') || '—'}</div>
                <div><strong className="text-sky-300">Oportunidades:</strong> {(swot.opportunities || []).join(' · ') || '—'}</div>
                <div><strong className="text-amber-300">Ameaças:</strong> {(swot.threats || []).join(' · ') || '—'}</div>
              </div>
            </Section>

            <Section title="⑤ Maturidade do trader" badge={
              maturity.promotionEligible ? '✨ pronto pra promoção' :
              (maturity.regression && maturity.regression.length > 0)
                ? <><ShieldAlert className="w-3 h-3 inline" /> regressão em {maturity.regression.join(', ')}</>
                : `${stageLabel}`
            }>
              <p className="text-sm text-slate-400">
                Nota geral {maturity?.scores?.composite?.toFixed(1) ?? '—'} ·
                Emocional {maturity?.scores?.emotional ?? '—'} ·
                Financeira {maturity?.scores?.financial ?? '—'} ·
                Operacional {maturity?.scores?.operational ?? '—'} ·
                Experiência {maturity?.scores?.experience ?? '—'}.
              </p>
              {maturity.mentorOverride && (
                <p className="text-[11px] text-amber-300 mt-2">
                  Mentor aplicou ajuste: {maturity.mentorOverride.fromStage} → {maturity.mentorOverride.toStage} — {maturity.mentorOverride.rationale}
                </p>
              )}
            </Section>

            <Section title="⑥ Ajuste do plano" badge={
              forward.planAdjustment?.changed
                ? `↺ ajustado (${forward.planAdjustment.decisionSource === 'ai_suggested' ? 'recomendação aceita' : forward.planAdjustment.decisionSource === 'manual_edit' ? 'editado pelo trader' : forward.planAdjustment.decisionSource})`
                : 'mantido'
            }>
              <p className="text-sm text-slate-400">
                Risco ótimo (Kelly ¼) {forward.kellyRecommendation?.kellySafe != null ? `${(forward.kellyRecommendation.kellySafe * 100).toFixed(1)}%` : '—'} ·
                Simulação do próximo ciclo (pior/típico/melhor): {forward.mcSimulation ? `${forward.mcSimulation.p10?.toFixed(0) ?? '—'} / ${forward.mcSimulation.p50?.toFixed(0) ?? '—'} / ${forward.mcSimulation.p90?.toFixed(0) ?? '—'}` : '—'}.
              </p>
              {forward.aiSuggestion?.rationale && (
                <p className="text-[11px] text-slate-500 mt-2 italic">
                  Recomendação: "{forward.aiSuggestion.rationale}"
                </p>
              )}
            </Section>

            <Section title="⑦ Compromissos para o próximo ciclo" badge={`${(forward.behavioralCommitments || []).length}/2`}>
              <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
                {(forward.behavioralCommitments || []).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              {closure.notes && <p className="text-[11px] text-slate-500 mt-3 italic">Notas: {closure.notes}</p>}
            </Section>
          </div>

          {/* Coluna lateral — comment panel (mentor-only) */}
          {isMentorView && (
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
          )}
        </div>
    </div>
  );
}
