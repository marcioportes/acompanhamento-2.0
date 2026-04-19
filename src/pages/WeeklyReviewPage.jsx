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
  doc, onSnapshot, collection, query, where, onSnapshot as listen,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Loader2, FileText } from 'lucide-react';
import DebugBadge from '../components/DebugBadge';

const statusBadge = (status) => {
  switch (status) {
    case 'DRAFT': return { label: 'aberta', cls: 'bg-amber-500/15 text-amber-400' };
    case 'CLOSED': return { label: 'publicada', cls: 'bg-emerald-500/15 text-emerald-400' };
    case 'ARCHIVED': return { label: 'arquivada', cls: 'bg-slate-500/15 text-slate-400' };
    default: return { label: status || '—', cls: 'bg-slate-500/15 text-slate-400' };
  }
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
            <Section num="1" title="Trades do período" stage="2">
              <Placeholder label="Lista vertical de trades (ticker · side · qty · time · resultado · emoção) — Stage 2" />
            </Section>

            {/* Subitem 2: Snapshot KPIs */}
            <Section num="2" title="Snapshot de indicadores (congelado)" stage="2">
              <Placeholder label="Grid 4×2: WR · Payoff · Profit Factor · EV/trade · RR médio · Compliance · Coef. variação · Tempo médio — Stage 2" />
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
