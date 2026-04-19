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
  doc, onSnapshot, collection, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Loader2, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import DebugBadge from '../components/DebugBadge';

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

// ===== Subitem 1: Trades do período =====
const TradesSection = ({ trades, currency = 'USD' }) => {
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
        return (
          <div key={t.tradeId || i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/30 border border-slate-700/60 rounded-lg text-[13px]">
            <span className="font-medium text-white min-w-[56px]">{t.symbol || '—'}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {isBuy ? 'C' : 'V'}
            </span>
            <span className="text-slate-400 text-[12px]">
              {t.qty || 0} {(t.qty || 0) === 1 ? 'ctr' : 'ctrs'} · {fmtTime(t.entryTime)}
            </span>
            <span className={`ml-auto font-medium ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
              {isWin ? '+' : ''}{fmtMoney(t.pnl, currency)}
            </span>
            <span className="text-[12px] text-slate-500 min-w-[60px] text-right truncate" title={t.emotionEntry || ''}>
              {t.emotionEntry || '—'}
            </span>
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

const WeeklyReviewPage = ({ studentId, reviewId, onBack }) => {
  const [review, setReview] = useState(null);
  const [student, setStudent] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
                  <FileText className="w-4 h-4 text-slate-400" />
                  Revisão semanal — {student?.name || student?.email || 'Aluno'}
                </div>
                <div className="text-xs text-slate-500 mt-1">{headerMeta}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">Fundação: PlanLedgerExtract (modo revisão)</div>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            </div>

            {/* Subitem 1: Trades do período */}
            <Section num="1" title="Trades do período">
              <TradesSection
                trades={review.frozenSnapshot?.periodTrades}
                currency={currency}
              />
            </Section>

            {/* Subitem 2: Snapshot KPIs */}
            <Section num="2" title="Snapshot de indicadores (congelado)">
              <SnapshotKpisSection
                kpis={review.frozenSnapshot?.kpis}
                prevKpis={previousReview?.frozenSnapshot?.kpis}
                currency={currency}
              />
            </Section>

            {/* Subitem 3: SWOT */}
            <Section num="3" title="SWOT do aluno (gerado pela CF no ato da criação)" stage="3">
              <Placeholder label="Grid 2×2: Forças · Fraquezas · Oportunidades · Ameaças — Stage 3" />
            </Section>

            {/* Subitem 4: Notas da sessão */}
            <Section num="4" title="Notas da sessão" stage="3">
              <Placeholder label="Textarea livre — o que aconteceu na reunião, link Zoom inline — Stage 3" />
            </Section>

            {/* Subitem 5: Takeaways */}
            <Section num="5" title="Takeaways" stage="4">
              <Placeholder label="Checklist de itens acionáveis (pin do feedback + manuais) — Stage 4" />
            </Section>

            {/* Subitem 6: Ranking */}
            <Section num="6" title="Ranking de trades" stage="5">
              <Placeholder label="Top 3 melhores · Top 3 piores (lado a lado) — Stage 5" />
            </Section>

            {/* Subitem 7: Evolução maturidade */}
            <Section num="7" title="Evolução de maturidade (4D vs marco zero)" stage="6">
              <Placeholder label="4 barras (Técnica · Emocional · Disciplina · Gestão risco) + marcador do assessment inicial — Stage 6" />
            </Section>

            {/* Subitem 8: Navegação contextual */}
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
