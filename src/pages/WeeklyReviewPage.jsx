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
} from 'lucide-react';
import DebugBadge from '../components/DebugBadge';
import { buildClientSnapshot } from '../utils/clientSnapshotBuilder';
import { useWeeklyReviews } from '../hooks/useWeeklyReviews';
import { validateTakeaways, MAX_TAKEAWAYS_LENGTH } from '../utils/reviewUrlValidator';

const statusBadge = (status) => {
  switch (status) {
    case 'DRAFT': return { label: 'aberta', cls: 'bg-amber-500/15 text-amber-400' };
    case 'CLOSED': return { label: 'publicada', cls: 'bg-emerald-500/15 text-emerald-400' };
    case 'ARCHIVED': return { label: 'arquivada', cls: 'bg-slate-500/15 text-slate-400' };
    default: return { label: status || '—', cls: 'bg-slate-500/15 text-slate-400' };
  }
};

// ===== Formatadores =====
const fmtMoney = (v, currency = 'USD') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
};
const fmtPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
};
const fmtNum = (v, digits = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
};
const fmtTime = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

// ===== Delta KPI (current vs previous) =====
const deltaText = (curr, prev, fmt = (v) => String(v), invertColors = false) => {
  const c = Number(curr), p = Number(prev);
  if (!Number.isFinite(p)) return null;
  const d = c - p;
  if (d === 0) return { text: '=', cls: 'text-slate-500' };
  const up = d > 0;
  const good = invertColors ? !up : up;
  const sign = up ? '+' : '';
  return {
    text: `${sign}${fmt(d)}`,
    cls: good ? 'text-emerald-400' : 'text-red-400',
  };
};

// Extrai data ISO (YYYY-MM-DD) de um trade inline (tem entryTime ISO).
const tradeDate = (t) => {
  if (!t) return null;
  if (t.entryTime && typeof t.entryTime === 'string') return t.entryTime.slice(0, 10);
  if (t.date) return t.date;
  return null;
};

// ===== Subitem 1: Trades do período =====
const TradesSection = ({ trades, currency = 'USD', weekStart = null, weekEnd = null, onNavigateToFeedback = null }) => {
  if (!trades || trades.length === 0) {
    return <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-6 text-center text-[11px] text-slate-500 italic">
      Sem trades no período.
    </div>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {trades.map((t, i) => {
        const isBuy = t.side === 'LONG' || t.side === 'BUY' || t.side === 'C';
        const isWin = Number(t.pnl) > 0;
        const td = tradeDate(t);
        const outOfPeriod = weekStart && weekEnd && td && (td < weekStart || td > weekEnd);
        const handleOpenFeedback = () => {
          if (!onNavigateToFeedback || !t.tradeId) return;
          // Repassa o shape inline como trade (tem id + ticker/symbol + emoções).
          // FeedbackPage resolve o resto via re-lookup por trade.id.
          onNavigateToFeedback({ id: t.tradeId, ticker: t.symbol, ...t });
        };
        // INV-06: formato BR (DD/MM). td é 'YYYY-MM-DD' — slice invertia.
        const dateShort = (() => {
          if (!td) return '??';
          const [y, m, d] = td.split('-');
          return `${d}/${m}`;
        })();
        const dateFullBR = td ? (() => {
          const [y, m, d] = td.split('-');
          return `${d}/${m}/${y}`;
        })() : '';
        const emotionText = t.emotionExit && t.emotionExit !== t.emotionEntry
          ? `${t.emotionEntry || '—'} → ${t.emotionExit}`
          : (t.emotionEntry || '—');
        return (
          <div key={t.tradeId || i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/30 border border-slate-700/60 rounded-lg text-[13px]">
            {/* Data primeiro — facilita associar trade com nota da sessão */}
            <span className="font-mono text-slate-300 min-w-[40px] text-[12px]" title={dateFullBR}>{dateShort}</span>
            <span className="text-slate-500 text-[11px] min-w-[36px]">{fmtTime(t.entryTime)}</span>
            <span className="font-medium text-white min-w-[56px]">{t.symbol || '—'}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {isBuy ? 'C' : 'V'}
            </span>
            <span className="text-slate-400 text-[12px]">
              {t.qty || 0} {(t.qty || 0) === 1 ? 'ctr' : 'ctrs'}
            </span>
            {outOfPeriod && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30" title={`Trade de ${td} está fora do período do rascunho`}>
                fora do período
              </span>
            )}
            <span className={`ml-auto font-medium ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
              {isWin ? '+' : ''}{fmtMoney(t.pnl, currency)}
            </span>
            <span className="text-[11px] text-slate-400 max-w-[130px] truncate" title={emotionText}>
              {emotionText}
            </span>
            {onNavigateToFeedback && t.tradeId && (
              <button
                onClick={handleOpenFeedback}
                className="p-1 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                title="Abrir feedback do trade"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ===== Subitem 2: Snapshot KPIs =====
const KpiCard = ({ label, value, delta, prev }) => (
  <div className="bg-white/5 rounded-lg px-3 py-2.5">
    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-medium text-white">{value}</span>
      {delta && <span className={`text-[11px] font-medium ${delta.cls}`}>{delta.text}</span>}
    </div>
    {prev && <div className="text-[11px] text-slate-500 mt-0.5">{prev}</div>}
  </div>
);

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

const SnapshotKpisSection = ({ kpis, prevKpis, currency = 'USD' }) => {
  if (!kpis) return <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-6 text-center text-[11px] text-slate-500 italic">Snapshot indisponível.</div>;
  const prev = prevKpis || {};
  const c = kpis;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <KpiCard
        label="Win rate"
        value={fmtPct(c.wr)}
        delta={deltaText(c.wr, prev.wr, (d) => `${d.toFixed(1)}%`)}
        prev={Number.isFinite(Number(prev.wr)) ? `anterior: ${fmtPct(prev.wr)}` : null}
      />
      <KpiCard
        label="Payoff"
        value={fmtNum(c.payoff, 2)}
        delta={deltaText(c.payoff, prev.payoff, (d) => d.toFixed(2))}
        prev={Number.isFinite(Number(prev.payoff)) ? `anterior: ${fmtNum(prev.payoff, 2)}` : null}
      />
      <KpiCard
        label="Profit factor"
        value={fmtNum(c.profitFactor, 2)}
        delta={deltaText(c.profitFactor, prev.profitFactor, (d) => d.toFixed(2))}
        prev={Number.isFinite(Number(prev.profitFactor)) ? `anterior: ${fmtNum(prev.profitFactor, 2)}` : null}
      />
      <KpiCard
        label="EV / trade"
        value={fmtMoney(c.evPerTrade, currency)}
        delta={deltaText(c.evPerTrade, prev.evPerTrade, (d) => fmtMoney(d, currency))}
        prev={Number.isFinite(Number(prev.evPerTrade)) ? `anterior: ${fmtMoney(prev.evPerTrade, currency)}` : null}
      />
      <KpiCard
        label="RR médio"
        value={c.avgRR ? `1:${fmtNum(c.avgRR, 2)}` : '—'}
        prev="target: 1:2.0"
      />
      <KpiCard
        label="Compliance"
        value={fmtPct(c.compliance?.overall)}
        delta={deltaText(c.compliance?.overall, prev.compliance?.overall, (d) => `${d.toFixed(1)}%`)}
        prev={Number.isFinite(Number(prev.compliance?.overall)) ? `anterior: ${fmtPct(prev.compliance.overall)}` : null}
      />
      <KpiCard
        label="Coef. variação"
        value={fmtNum(c.coefVariation, 2)}
        delta={deltaText(c.coefVariation, prev.coefVariation, (d) => d.toFixed(2), true)}
        prev={Number.isFinite(Number(prev.coefVariation)) ? `anterior: ${fmtNum(prev.coefVariation, 2)}` : null}
      />
      <KpiCard
        label="Tempo médio"
        value={c.avgHoldTimeMin ? `${c.avgHoldTimeMin} min` : '—'}
        prev={c.avgHoldTimeWinMin || c.avgHoldTimeLossMin ? `win: ${c.avgHoldTimeWinMin || 0}m · loss: ${c.avgHoldTimeLossMin || 0}m` : null}
      />
    </div>
  );
};

// ====== Placeholder Section (Stage 1 apenas) ======
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

const Placeholder = ({ label }) => (
  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/20 px-3 py-6 text-center text-[11px] text-slate-500 italic">
    {label}
  </div>
);

// Reconstrói snapshot live a partir das trades atuais do plano + período + inclusões.
// Usado em DRAFTs (rascunhos abertos atualizam KPIs/trades em tempo real).
//
// Stage 2.5: além das trades no período [weekStart, weekEnd], mescla trades cujos ids
// estão em `review.includedTradeIds` (pinados pelo mentor via FeedbackPage). Dedup por id.
const rebuildSnapshotFromFirestore = async (review) => {
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
  return buildClientSnapshot({
    plan,
    trades: weekTrades,
    extraTrades,
    cycleKey: review.cycleKey || null,
    emotionalMetrics: null,
  });
};

const WeeklyReviewPage = ({ studentId, reviewId, onBack, onNavigateToFeedback = null }) => {
  const [review, setReview] = useState(null);
  const [student, setStudent] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  // Stage 3: hook + state para SWOT e Notas da Sessão.
  const { generateSwot, updateSessionNotes, actionLoading } = useWeeklyReviews(studentId);
  const [confirmRegen, setConfirmRegen] = useState(false);
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

  const previousReview = useMemo(() => {
    if (!review || !planId) return null;
    return allStudentReviews.find(r =>
      r.id !== review.id &&
      (r.planId === planId || r.frozenSnapshot?.planContext?.planId === planId) &&
      r.weekStart < review.weekStart
    ) || null;
  }, [allStudentReviews, review, planId]);

  // DRAFT: recomputa snapshot live ao montar e a pedido do mentor.
  // CLOSED/ARCHIVED: usa frozenSnapshot persistido (G7 — foto congelada).
  const isDraft = review?.status === 'DRAFT';
  const refreshLive = async () => {
    if (!isDraft || !review) return;
    setLiveRefreshing(true);
    try {
      const snap = await rebuildSnapshotFromFirestore(review);
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
              <TradesSection
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
              <SnapshotKpisSection
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

            {/* 5 — Takeaways */}
            <Section num="5" title="Takeaways" stage="4">
              <Placeholder label="Checklist de itens acionáveis (pin do feedback + manuais) — Stage 4" />
            </Section>

            {/* 6 — Ranking */}
            <Section num="6" title="Ranking de trades" stage="5">
              <Placeholder label="Top 3 melhores · Top 3 piores (lado a lado) — Stage 5" />
            </Section>

            {/* 7 — Evolução maturidade */}
            <Section num="7" title="Evolução de maturidade (4D vs marco zero)" stage="6">
              <Placeholder label="4 barras (Técnica · Emocional · Disciplina · Gestão risco) + marcador do assessment inicial — Stage 6" />
            </Section>

            {/* 8 — Navegação contextual */}
            <Section num="8" title="Navegação contextual" stage="6">
              <Placeholder label="Links: Ver conta · Ver plano · Ver extrato emocional · Ver assessment 4D — Stage 6" />
            </Section>

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
