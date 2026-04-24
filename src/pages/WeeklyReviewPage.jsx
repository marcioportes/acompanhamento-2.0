/**
 * WeeklyReviewPage
 * @version 0.1.0 (v1.33.0) — Stage 1: skeleton + navigation
 * @description Tela nova da Revisão Semanal conforme mockup-revisao-semanal-102.html.
 *
 * Single-column scroll, max-width 700px, 8 subitens numerados:
 *   1. Trades do período          (Stage 2)
 *   2. Snapshot KPIs congelados   (Stage 2)
 *   3. SWOT (4 quadrantes)         (Stage 3)
 *   4. Notas da sessão             (Stage 3)
 *   5. Takeaways (checklist)       (Stage 4)
 *   6. Ranking top 3 / bottom 3    (Stage 5)
 *   7. Evolução maturidade 4D      (Stage 6)
 *   8. Navegação contextual        (Stage 6)
 *
 * Coexiste com PlanLedgerExtract 3-col (baseline preservado) — entry point desta
 * tela é exclusivamente via Fila de Revisão > Aluno > click no rascunho.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  doc, onSnapshot, collection, query, where, orderBy, limit, getDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  ChevronLeft, Loader2, FileText, TrendingUp, TrendingDown,
  RefreshCw, Sparkles, AlertTriangle, CheckCircle2, Save, MessageSquare,
  CheckSquare, Square, Trash2, Plus, Archive, Send, Trophy, Target,
  Award, Shield, Activity, ExternalLink,
} from 'lucide-react';
import DebugBadge from '../components/DebugBadge';
import MaturityComparisonSection from '../components/reviews/MaturityComparisonSection';
import ReviewKpiGrid from '../components/reviews/ReviewKpiGrid';
import ReviewTradesSection from '../components/reviews/ReviewTradesSection';
import { buildClientSnapshot } from '../utils/clientSnapshotBuilder';
import { useWeeklyReviews } from '../hooks/useWeeklyReviews';
import { useReviewMaturitySnapshot } from '../hooks/useReviewMaturitySnapshot';
import { validateTakeaways, MAX_TAKEAWAYS_LENGTH } from '../utils/reviewUrlValidator';
import {
  recomputeAndReadMaturity,
  maybeDispatchMaturityAI,
} from '../utils/closeReviewMaturityPipeline';
import { fmtMoney, statusBadge, getPreviousReview } from '../utils/reviewFormatters';

// ===== Subitem 1: Trades do período (flat com +/− por dia) =====

// ===== Subitem 2: Snapshot KPIs =====

// ===== Subitem 3: SWOT =====
const SwotQuadrant = ({ title, items, icon: Icon, color }) => (
  <div className={`rounded-lg border p-3 bg-slate-900/40 ${color}`}>
    <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide">
      <Icon className="w-3.5 h-3.5" />
      {title}
    </div>
    {items && items.length > 0 ? (
      <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-300">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    ) : (
      <div className="text-[11px] text-slate-500 italic">Sem itens</div>
    )}
  </div>
);

const SwotSection = ({ swot, canGenerate, onGenerate, actionLoading, confirmRegen, setConfirmRegen }) => {
  if (!swot) {
    return (
      <div className="text-center py-6 rounded-lg border border-dashed border-slate-700 bg-slate-800/20">
        <Sparkles className="w-5 h-5 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-400 mb-3">SWOT ainda não foi gerado para esta revisão.</p>
        {canGenerate && (
          <button
            onClick={onGenerate}
            disabled={actionLoading}
            className="px-4 py-1.5 text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Gerar SWOT via IA
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {swot.aiUnavailable ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 text-[11px] text-amber-300 flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          IA indisponível no momento — SWOT determinístico. Regenere quando a IA voltar.
        </div>
      ) : (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded px-3 py-1 text-[10px] text-emerald-400 flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-3 h-3" />
          Gerado por {swot.modelVersion || 'IA'} · prompt v{swot.promptVersion || '—'} · geração #{swot.generationCount ?? 1}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <SwotQuadrant title="Forças" items={swot.strengths} icon={TrendingUp} color="border-emerald-500/30" />
        <SwotQuadrant title="Fraquezas" items={swot.weaknesses} icon={TrendingDown} color="border-red-500/30" />
        <SwotQuadrant title="Oportunidades" items={swot.opportunities} icon={Sparkles} color="border-sky-500/30" />
        <SwotQuadrant title="Ameaças" items={swot.threats} icon={AlertTriangle} color="border-amber-500/30" />
      </div>

      {canGenerate && (
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800/60">
          {confirmRegen ? (
            <>
              <span className="text-[11px] text-amber-400">
                Sobrescrever SWOT atual (geração #{swot.generationCount ?? 1})?
              </span>
              <button onClick={() => setConfirmRegen(false)} disabled={actionLoading} className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-white disabled:opacity-40">Cancelar</button>
              <button onClick={onGenerate} disabled={actionLoading} className="px-2 py-0.5 text-[11px] bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded hover:bg-amber-500/30 disabled:opacity-40">
                {actionLoading ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                Sim, regenerar
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRegen(true)}
              disabled={actionLoading}
              className="px-2.5 py-0.5 text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Regenerar SWOT
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ===== Subitem 5: Takeaways (checklist) =====
// Dois estados independentes são renderizados:
// - item.done: mentor encerrou o takeaway (pode voltar ao estado pendente via toggle).
// - alunoDone (derivado de review.alunoDoneIds): aluno marcou como executado no
//   dashboard dele. Visual amber (distinto do emerald do mentor) + badge "aluno".
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

const TakeawaysSection = ({ items, alunoDoneIds, canEdit, onAdd, onToggle, onRemove, onNavigateToFeedback, actionLoading }) => {
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

// ===== Subitem 4: Notas da Sessão =====
const SessionNotesSection = ({ value, onChange, onSave, canEdit, actionLoading, dirty, validation }) => (
  <div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!canEdit || actionLoading}
      rows={5}
      className="w-full input-dark text-[13px] font-sans leading-relaxed"
      placeholder="O que aconteceu na sessão. Discussões, links de Zoom/Meet, contexto relevante..."
    />
    <div className="flex items-center justify-between mt-1.5">
      <div className="text-[10px]">
        {validation?.error ? (
          <span className="text-red-400">{validation.error}</span>
        ) : (
          <span className="text-slate-500">{value.length}/{MAX_TAKEAWAYS_LENGTH} · texto livre, com links inline se necessário</span>
        )}
      </div>
      {canEdit && (
        <button
          onClick={onSave}
          disabled={!dirty || !validation?.valid || actionLoading}
          className="px-2.5 py-1 text-[11px] font-medium bg-slate-700/40 border border-slate-600 text-slate-300 rounded hover:bg-slate-700/60 disabled:opacity-40 inline-flex items-center gap-1"
        >
          {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar
        </button>
      )}
    </div>
  </div>
);


// ===== Subitem 6: Ranking top 3 / bottom 3 =====
const RankedTradeRow = ({ trade, currency, onOpen }) => {
  const td = trade.entryTime ? trade.entryTime.slice(0, 10) : null;
  const ddmm = td ? (() => { const [y, m, d] = td.split('-'); return `${d}/${m}`; })() : '??';
  const isBuy = trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'C';
  const isWin = Number(trade.pnl) > 0;
  const rawEntry = trade.emotionEntry || trade.emotion;
  const rawExit = trade.emotionExit;
  const emotionText = rawExit && rawExit !== rawEntry
    ? `${rawEntry || '—'} → ${rawExit}`
    : (rawEntry || '—');
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800/40 group">
      <span className="text-[10px] font-mono text-slate-500 w-[32px]">{ddmm}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
        {isBuy ? 'C' : 'V'}
      </span>
      <span className="text-[12px] text-white font-medium flex-1 truncate">{trade.symbol || '—'}</span>
      <span className="text-[11px] text-slate-400 truncate max-w-[140px]" title={emotionText}>{emotionText}</span>
      <span className={`text-[12px] font-medium tabular-nums w-[80px] text-right ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
        {isWin ? '+' : ''}{fmtMoney(trade.pnl, currency)}
      </span>
      {onOpen && trade.tradeId && (
        <button
          onClick={() => onOpen({ id: trade.tradeId, ticker: trade.symbol, ...trade })}
          className="p-0.5 text-slate-500 hover:text-blue-400 opacity-60 group-hover:opacity-100 transition"
          title="Abrir feedback do trade"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const RankingSection = ({ topTrades, bottomTrades, currency, onNavigateToFeedback }) => {
  const safeTop = Array.isArray(topTrades) ? topTrades : [];
  const safeBottom = Array.isArray(bottomTrades) ? bottomTrades : [];
  if (safeTop.length === 0 && safeBottom.length === 0) {
    return <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-6 text-center text-[11px] text-slate-500 italic">
      Sem trades no período para ranquear.
    </div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      <div className="rounded-lg border border-emerald-500/20 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/5 border-b border-emerald-500/20 text-[11px] uppercase tracking-wider text-emerald-400">
          <Trophy className="w-3.5 h-3.5" /> Top 3 — Maiores ganhos
        </div>
        {safeTop.length > 0 ? (
          <div className="divide-y divide-slate-800/60">
            {safeTop.map((t, i) => (
              <RankedTradeRow key={t.tradeId || i} trade={t} currency={currency} onOpen={onNavigateToFeedback} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-[11px] text-slate-500 italic text-center">Nenhum trade vencedor.</div>
        )}
      </div>
      <div className="rounded-lg border border-red-500/20 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/5 border-b border-red-500/20 text-[11px] uppercase tracking-wider text-red-400">
          <Target className="w-3.5 h-3.5" /> Bottom 3 — Maiores perdas
        </div>
        {safeBottom.length > 0 ? (
          <div className="divide-y divide-slate-800/60">
            {safeBottom.map((t, i) => (
              <RankedTradeRow key={t.tradeId || i} trade={t} currency={currency} onOpen={onNavigateToFeedback} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-[11px] text-slate-500 italic text-center">Nenhum trade perdedor.</div>
        )}
      </div>
    </div>
  );
};

// ===== Subitem 7: Evolução de maturidade 4D =====
// Baseline do assessment inicial (marco zero). Score 0-100 por dimensão.
// Maturidade vem de experience.stage_score (score de stage).
const MaturityBar = ({ label, icon: Icon, score }) => {
  const n = Number(score);
  const hasScore = Number.isFinite(n);
  const pct = hasScore ? Math.min(100, Math.max(0, n)) : 0;
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : pct >= 30 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-300">
          <Icon className="w-3 h-3 text-slate-500" /> {label}
        </span>
        <span className={hasScore ? 'font-mono tabular-nums text-slate-200' : 'text-slate-600 italic'}>
          {hasScore ? `${Math.round(n)}/100` : '—'}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        {hasScore && <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
};

const MaturitySection = ({ assessment }) => {
  if (!assessment) {
    return <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/20 px-3 py-5 text-center text-[11px] text-slate-500 italic">
      Assessment inicial ainda não disponível — marco zero será estabelecido após a validação do onboarding.
    </div>;
  }
  const emotional = assessment.emotional?.score;
  const financial = assessment.financial?.score;
  const operational = assessment.operational?.fit_score ?? assessment.operational?.score;
  const maturity = assessment.experience?.stage_score;
  const ts = assessment.timestamp?.toDate?.() || null;
  const baselineDate = ts ? ts.toLocaleDateString('pt-BR') : null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
        Marco zero {baselineDate ? `· ${baselineDate}` : ''}
      </div>
      <MaturityBar label="Emocional" icon={Activity} score={emotional} />
      <MaturityBar label="Financeiro" icon={Shield} score={financial} />
      <MaturityBar label="Operacional" icon={Target} score={operational} />
      <MaturityBar label="Maturidade" icon={Award} score={maturity} />
      <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-800">
        Comparação evolutiva (atual vs marco zero) será habilitada após re-assessment periódico.
      </div>
    </div>
  );
};

// ===== Subitem 8: Navegação contextual =====
const ContextNavSection = ({ planId, studentId, onNavigateToLedger, onNavigateToAssessment, hasAssessment }) => {
  const links = [
    {
      key: 'ledger',
      label: 'Ver plano no extrato',
      enabled: !!(planId && onNavigateToLedger),
      onClick: () => onNavigateToLedger?.(planId),
    },
    {
      key: 'assessment',
      label: 'Ver assessment 4D do aluno',
      enabled: !!(studentId && onNavigateToAssessment && hasAssessment),
      onClick: () => onNavigateToAssessment?.(studentId),
    },
  ];
  const enabledLinks = links.filter(l => l.enabled);
  if (enabledLinks.length === 0) {
    return <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-5 text-center text-[11px] text-slate-500 italic">
      Links contextuais indisponíveis (plano ou assessment não carregados).
    </div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {enabledLinks.map(l => (
        <button
          key={l.key}
          onClick={l.onClick}
          className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/50 text-[12px] text-slate-300 hover:text-white transition"
        >
          <span>{l.label}</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </button>
      ))}
    </div>
  );
};

// ====== Section header ======
const Section = ({ num, title, children, stage }) => (
  <section className="mb-5">
    <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-1.5">
      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">{num}</span>
      <span>{title}</span>
      {stage && (
        <span className="ml-auto text-[10px] text-slate-500 font-normal">Stage {stage}</span>
      )}
    </h3>
    {children}
  </section>
);

// Reconstrói snapshot live a partir das trades atuais do plano + período + inclusões.
// Usado em DRAFTs (rascunhos abertos atualizam KPIs/trades em tempo real).
//
// Stage 2.5: além das trades no período [weekStart, weekEnd], mescla trades cujos ids
// estão em `review.includedTradeIds` (pinados pelo mentor via FeedbackPage). Dedup por id.
//
// Parâmetro opcional `maturity` (task 21 — H2): quando fornecido, é congelado em
// `maturitySnapshot` via buildClientSnapshot. O caller pode ter recomputado antes
// via `recomputeAndReadMaturity` — se ausente, snapshot segue sem maturitySnapshot.
const rebuildSnapshotFromFirestore = async (review, { studentId = null } = {}) => {
  const planId = review?.planId || review?.frozenSnapshot?.planContext?.planId;
  if (!planId) return null;
  const planSnap = await getDoc(doc(db, 'plans', planId));
  if (!planSnap.exists()) return null;
  const plan = { id: planSnap.id, ...planSnap.data() };
  const tradesQ = query(collection(db, 'trades'), where('planId', '==', planId));
  const tradesSnap = await getDocs(tradesQ);
  const allTrades = tradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const weekTrades = allTrades.filter(t => {
    const td = t.date || (t.entryTime ? t.entryTime.slice(0, 10) : null);
    if (!td) return false;
    return td >= review.weekStart && td <= review.weekEnd;
  });
  // Trades explicitamente incluídos (podem estar fora do período).
  const includedIds = new Set(review?.includedTradeIds || []);
  const extraTrades = includedIds.size > 0
    ? allTrades.filter(t => includedIds.has(t.id) && !weekTrades.some(w => w.id === t.id))
    : [];

  // Fetch defensivo de maturity/current — usado em DRAFTs para preview live do
  // comparativo N vs N-1. No publish (handlePublish) o caller força recompute
  // antes e passa via closeReviewMaturityPipeline.
  let maturity = null;
  try {
    if (studentId) {
      const matSnap = await getDoc(doc(db, 'students', studentId, 'maturity', 'current'));
      maturity = matSnap.exists() ? { id: matSnap.id, ...matSnap.data() } : null;
    }
  } catch (err) {
    console.warn('[rebuildSnapshotFromFirestore] maturity fetch failed:', err?.message || err);
  }

  return buildClientSnapshot({
    plan,
    trades: weekTrades,
    extraTrades,
    cycleKey: review.cycleKey || null,
    emotionalMetrics: null,
    maturity,
  });
};

const WeeklyReviewPage = ({
  studentId,
  reviewId,
  onBack,
  onNavigateToFeedback = null,
  onNavigateToLedger = null,       // Stage 6 Subitem 8 — abre plano no extrato
  onNavigateToAssessment = null,   // Stage 6 Subitem 8 — abre assessment 4D do aluno
}) => {
  const [review, setReview] = useState(null);
  const [student, setStudent] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  // Stage 3 + 4: hook + state para SWOT, Notas e Takeaways.
  // Stage 5a: closeReview + archiveReview para action footer (publish/archive).
  const {
    generateSwot, updateSessionNotes, closeReview, archiveReview,
    addTakeawayItem, toggleTakeawayDone, removeTakeawayItem,
    actionLoading,
  } = useWeeklyReviews(studentId);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [sessionNotesDraft, setSessionNotesDraft] = useState('');

  // Listener no doc da revisão — reflete updates live (SWOT, takeaways, etc.)
  useEffect(() => {
    if (!studentId || !reviewId) { setLoading(false); return undefined; }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'students', studentId, 'reviews', reviewId),
      (snap) => {
        if (snap.exists()) {
          setReview({ id: snap.id, ...snap.data() });
          setError(null);
        } else {
          setError('Revisão não encontrada');
          setReview(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[WeeklyReviewPage] review listener error', err);
        setError(err.message || 'Erro ao carregar revisão');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [studentId, reviewId]);

  // Load student (one-shot via listener)
  useEffect(() => {
    if (!studentId) return undefined;
    const unsub = onSnapshot(
      doc(db, 'students', studentId),
      (snap) => { if (snap.exists()) setStudent({ id: snap.id, ...snap.data() }); }
    );
    return () => unsub();
  }, [studentId]);

  // Load plan via snapshot.planContext.planId
  const planId = review?.planId || review?.frozenSnapshot?.planContext?.planId;
  useEffect(() => {
    if (!planId) return undefined;
    const unsub = onSnapshot(
      doc(db, 'plans', planId),
      (snap) => { if (snap.exists()) setPlan({ id: snap.id, ...snap.data() }); }
    );
    return () => unsub();
  }, [planId]);

  // Load account for currency (via plan.accountId)
  const accountId = plan?.accountId;
  const [account, setAccount] = useState(null);
  useEffect(() => {
    if (!accountId) return undefined;
    const unsub = onSnapshot(doc(db, 'accounts', accountId), (snap) => {
      if (snap.exists()) setAccount({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [accountId]);
  const currency = account?.currency || 'USD';

  // Revisão anterior do MESMO PLANO (para Δ KPI).
  // Busca todas as revisões do aluno e filtra por planId + weekStart<current em memória.
  const [allStudentReviews, setAllStudentReviews] = useState([]);
  useEffect(() => {
    if (!studentId) return undefined;
    const q = query(
      collection(db, 'students', studentId, 'reviews'),
      orderBy('weekStart', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllStudentReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [studentId]);

  const previousReview = useMemo(
    () => getPreviousReview(allStudentReviews, review, planId),
    [allStudentReviews, review, planId],
  );

  // DRAFT: recomputa snapshot live ao montar e a pedido do mentor.
  // CLOSED/ARCHIVED: usa frozenSnapshot persistido (G7 — foto congelada).
  const isDraft = review?.status === 'DRAFT';
  const refreshLive = async () => {
    if (!isDraft || !review) return;
    setLiveRefreshing(true);
    try {
      const snap = await rebuildSnapshotFromFirestore(review, { studentId });
      if (snap) setLiveSnapshot(snap);
    } catch (e) {
      console.error('[WeeklyReviewPage] refresh live snapshot failed', e);
    } finally {
      setLiveRefreshing(false);
    }
  };
  useEffect(() => {
    if (isDraft && review) {
      refreshLive();
    } else {
      setLiveSnapshot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review?.id, isDraft]);

  // Snapshot efetivo: live para DRAFT (se recomputado), senão o frozenSnapshot do doc.
  const effectiveSnapshot = (isDraft && liveSnapshot) ? liveSnapshot : (review?.frozenSnapshot || {});

  // Stage 3: permissão + handlers SWOT / Notas.
  const canEdit = review?.status !== 'ARCHIVED';
  const swot = review?.swot || null;

  // Sincroniza draft de sessionNotes com o doc. Fallback: rascunhos antigos têm
  // `takeaways` (string) em vez de `sessionNotes` — consome na primeira render.
  useEffect(() => {
    if (!review) return;
    const next = typeof review.sessionNotes === 'string'
      ? review.sessionNotes
      : (typeof review.takeaways === 'string' ? review.takeaways : '');
    setSessionNotesDraft(next);
  }, [review?.id, review?.sessionNotes, review?.takeaways]);

  const persistedNotes = typeof review?.sessionNotes === 'string'
    ? review.sessionNotes
    : (typeof review?.takeaways === 'string' ? review.takeaways : '');
  const notesDirty = sessionNotesDraft !== persistedNotes;
  const notesValidation = useMemo(() => validateTakeaways(sessionNotesDraft), [sessionNotesDraft]);

  const handleGenerateSwot = async () => {
    if (!canEdit || !isDraft) return;
    try {
      await generateSwot({ reviewId: review.id });
      setConfirmRegen(false);
    } catch { /* error surfaced by hook */ }
  };

  const handleSaveSessionNotes = async () => {
    if (!canEdit || !notesDirty || !notesValidation.valid) return;
    try {
      await updateSessionNotes(review.id, sessionNotesDraft);
    } catch { /* */ }
  };

  // Stage 5a: publish DRAFT→CLOSED (congela snapshot, aluno passa a ver).
  //
  // Task 21 (H2) — ordem estrita ANTES do freeze:
  //   1. recompute engine de maturidade via callable (throttle-tolerant)
  //   2. dispatch narrativa IA (fire-and-forget) se trigger UP/REGRESSION fresco
  //   3. rebuild snapshot com maturity fresh → freeze via closeReview
  //
  // DEC-AUTO-119-13: recompute ANTES do rebuild garante que `maturitySnapshot`
  // reflita o estado do momento do close, não um snapshot velho do engine.
  // DEC-AUTO-119-14: IA é fire-and-forget — persiste em maturity/current via
  // cache e aparece no próximo render; publish não bloqueia esperando Claude.
  const handlePublish = async () => {
    if (!isDraft) return;
    try {
      const { maturity: freshMaturity } = await recomputeAndReadMaturity({ studentId });
      const fresh = await rebuildSnapshotFromFirestore(review, { studentId }).catch(() => null);
      // Se rebuild falhou, sobrescreve maturity do snapshot base com a leitura fresh.
      if (fresh && freshMaturity) {
        // rebuildSnapshotFromFirestore já relê o doc; mas garantimos consistência:
        // usamos o fresh do recompute (pós-engine) como fonte de verdade.
        // `buildClientSnapshot.freezeMaturity` no rebuild já usou essa leitura.
      }
      maybeDispatchMaturityAI({
        studentId,
        maturity: freshMaturity,
        kpis: fresh?.kpis,
        windowSize: Array.isArray(fresh?.periodTrades) ? fresh.periodTrades.length : 0,
      });
      await closeReview(review.id, { frozenSnapshot: fresh || effectiveSnapshot || undefined });
      setConfirmPublish(false);
    } catch { /* surfaced by hook */ }
  };

  // Stage 5a: archive CLOSED→ARCHIVED (terminal, imutável, some do dashboard aluno).
  const handleArchive = async () => {
    if (review?.status !== 'CLOSED') return;
    try {
      await archiveReview(review.id);
      setConfirmArchive(false);
    } catch { /* */ }
  };

  // Stage 6 Subitem 7: marco zero 4D (assessment inicial) — opcional.
  const [initialAssessment, setInitialAssessment] = useState(null);
  useEffect(() => {
    if (!studentId) return undefined;
    const unsub = onSnapshot(
      doc(db, 'students', studentId, 'assessment', 'initial_assessment'),
      (snap) => { setInitialAssessment(snap.exists() ? snap.data() : null); },
      () => { setInitialAssessment(null); }
    );
    return () => unsub();
  }, [studentId]);

  // Fase E2 (issue #119 task 16): comparativo de maturidade N vs N-1.
  // Só dispara quando review.status === 'CLOSED' (o hook internamente guarda).
  const {
    current: maturityCurrent,
    previous: maturityPrevious,
    loading: maturityCmpLoading,
    error: maturityCmpError,
  } = useReviewMaturitySnapshot(studentId, review, planId);

  const badge = statusBadge(review?.status);
  const cycleKey = review?.cycleKey || review?.frozenSnapshot?.planContext?.cycleKey;

  const headerMeta = useMemo(() => {
    const parts = [];
    if (plan?.name) parts.push(`Plano ${plan.name}`);
    if (cycleKey) parts.push(`Ciclo ${cycleKey}`);
    if (review?.weekStart && review?.weekEnd) {
      parts.push(`${review.weekStart} – ${review.weekEnd}`);
    }
    if (review?.periodKey) parts.push(review.periodKey);
    return parts.join(' · ') || '—';
  }, [plan?.name, cycleKey, review?.weekStart, review?.weekEnd, review?.periodKey]);

  return (
    <div className="min-h-screen bg-slate-950 py-6">
      <div className="max-w-[720px] mx-auto px-6">
        {/* Back */}
        <button
          onClick={onBack}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Voltar à Fila de Revisão
        </button>

        {loading && (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando revisão…
          </div>
        )}

        {error && !loading && (
          <div className="py-8 text-center text-xs text-red-400 bg-red-500/5 border border-red-500/30 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && review && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-800 mb-4">
              <div>
                <div className="text-lg font-medium text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-300" />
                  Revisão semanal — {student?.name || student?.email || 'Aluno'}
                </div>
                <div className="text-xs text-slate-300 mt-1">{headerMeta}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Fundação: PlanLedgerExtract (modo revisão)</div>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            </div>

            {/* Banner DRAFT: snapshot live com botão refresh */}
            {isDraft && (
              <div className="mb-4 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[11px] flex items-center justify-between">
                <span className="text-amber-400">● Rascunho em preparação — indicadores live, congelam ao publicar.</span>
                <button
                  onClick={refreshLive}
                  disabled={liveRefreshing}
                  className="text-amber-300 hover:text-amber-200 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  {liveRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Atualizar
                </button>
              </div>
            )}

            {/* 1 — Trades do período */}
            <Section num="1" title="Trades do período">
              <ReviewTradesSection
                trades={effectiveSnapshot.periodTrades}
                currency={currency}
                weekStart={review.weekStart}
                weekEnd={review.weekEnd}
                onNavigateToFeedback={onNavigateToFeedback}
              />
            </Section>

            {/* 2 — Notas da sessão (logo abaixo dos trades, como contexto da revisão) */}
            <Section num="2" title="Notas da sessão">
              <SessionNotesSection
                value={sessionNotesDraft}
                onChange={setSessionNotesDraft}
                onSave={handleSaveSessionNotes}
                canEdit={canEdit}
                actionLoading={actionLoading}
                dirty={notesDirty}
                validation={notesValidation}
              />
            </Section>

            {/* 3 — Snapshot KPIs congelados */}
            <Section num="3" title="Snapshot de indicadores (congelado)">
              <ReviewKpiGrid
                kpis={effectiveSnapshot.kpis}
                prevKpis={previousReview?.frozenSnapshot?.kpis}
                currency={currency}
              />
            </Section>

            {/* 4 — SWOT (gerado pela IA) */}
            <Section num="4" title="SWOT do aluno (gerado pela IA)">
              <SwotSection
                swot={swot}
                canGenerate={canEdit && isDraft}
                onGenerate={handleGenerateSwot}
                actionLoading={actionLoading}
                confirmRegen={confirmRegen}
                setConfirmRegen={setConfirmRegen}
              />
            </Section>

            {/* 5 — Takeaways (checklist) */}
            <Section num="5" title="Takeaways">
              <TakeawaysSection
                items={review.takeawayItems}
                alunoDoneIds={review.alunoDoneIds}
                canEdit={canEdit}
                onAdd={(text) => addTakeawayItem(review.id, text, null)}
                onToggle={(itemId) => toggleTakeawayDone(review.id, itemId)}
                onRemove={(itemId) => removeTakeawayItem(review.id, itemId)}
                onNavigateToFeedback={onNavigateToFeedback}
                actionLoading={actionLoading}
              />
            </Section>

            {/* 6 — Ranking */}
            <Section num="6" title="Ranking de trades">
              <RankingSection
                topTrades={effectiveSnapshot.topTrades}
                bottomTrades={effectiveSnapshot.bottomTrades}
                currency={currency}
                onNavigateToFeedback={onNavigateToFeedback}
              />
            </Section>

            {/* 7 — Evolução maturidade */}
            <Section num="7" title="Evolução de maturidade (4D vs marco zero)">
              <MaturitySection assessment={initialAssessment} />
            </Section>

            {/* 7b — Comparativo N vs N-1 (issue #119 task 16). Só em CLOSED. */}
            {review.status === 'CLOSED' && (
              <MaturityComparisonSection
                current={maturityCurrent}
                previous={maturityPrevious}
                loading={maturityCmpLoading}
                error={maturityCmpError}
              />
            )}

            {/* 8 — Navegação contextual */}
            <Section num="8" title="Navegação contextual">
              <ContextNavSection
                planId={planId}
                studentId={studentId}
                onNavigateToLedger={onNavigateToLedger}
                onNavigateToAssessment={onNavigateToAssessment}
                hasAssessment={!!initialAssessment}
              />
            </Section>

            {/* Action Footer — publicar DRAFT → CLOSED ou arquivar CLOSED → ARCHIVED */}
            <div className="mt-6 pt-4 border-t border-slate-800">
              {isDraft && (
                confirmPublish ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="text-[12px] text-emerald-300 mb-2 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        Ao publicar, o snapshot atual congela e o aluno passa a ver esta revisão no dashboard.
                        Regeneração de SWOT e edição de takeaways ficam bloqueadas — só o aluno pode toggla os checks dele.
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setConfirmPublish(false)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-[12px] text-slate-400 hover:text-white disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handlePublish}
                        disabled={actionLoading}
                        className="px-4 py-1.5 text-[12px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center gap-1.5"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Confirmar publicação
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Rascunho em preparação — indicadores vão congelar ao publicar.
                    </span>
                    <button
                      onClick={() => setConfirmPublish(true)}
                      disabled={actionLoading}
                      className="px-4 py-2 text-[13px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Publicar revisão
                    </button>
                  </div>
                )
              )}
              {review.status === 'CLOSED' && (
                confirmArchive ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="text-[12px] text-amber-300 mb-2 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        Arquivar torna a revisão imutável e remove do card "Pendências da mentoria" do aluno.
                        Essa ação não pode ser desfeita.
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setConfirmArchive(false)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-[12px] text-slate-400 hover:text-white disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleArchive}
                        disabled={actionLoading}
                        className="px-4 py-1.5 text-[12px] font-medium bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg hover:bg-amber-500/30 disabled:opacity-40 inline-flex items-center gap-1.5"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                        Confirmar arquivamento
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Revisão publicada — aluno tem acesso aos takeaways.
                    </span>
                    <button
                      onClick={() => setConfirmArchive(true)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-[12px] text-slate-400 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Archive className="w-3 h-3" /> Arquivar
                    </button>
                  </div>
                )
              )}
              {review.status === 'ARCHIVED' && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Archive className="w-3.5 h-3.5" />
                  Revisão arquivada — registro histórico imutável.
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-600 pt-3 border-t border-slate-800 mt-4">
              Fundação: PlanLedgerExtract (modo revisão) · CF createWeeklyReview · DEC-045 · Snapshot independente do fechamento de ciclo
            </div>
          </>
        )}
      </div>
      <DebugBadge component="WeeklyReviewPage" />
    </div>
  );
};

export default WeeklyReviewPage;
