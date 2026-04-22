/**
 * SwotAnalysis
 * @version 2.0.0
 * @description Renderiza o SWOT da última revisão semanal CLOSED do aluno.
 *              Consumido pelo StudentDashboard (issue #164 — E1).
 *
 *              O SWOT é gerado e persistido pelo mentor via Cloud Function
 *              `generateWeeklySwot` em `students/{uid}/reviews/{id}.swot`.
 *              Este componente é apenas leitura — não calcula nada no cliente.
 */

import {
  TrendingUp, TrendingDown, Sparkles, AlertTriangle, LayoutGrid,
  CheckCircle2, Loader2,
} from 'lucide-react';
import DebugBadge from './DebugBadge';
import useLatestClosedReview from '../hooks/useLatestClosedReview';
import { formatDate } from '../utils/calculations';

const QUADRANTS = [
  { key: 'strengths', title: 'Forças', icon: TrendingUp, border: 'border-emerald-500/30', text: 'text-emerald-400' },
  { key: 'weaknesses', title: 'Fraquezas', icon: TrendingDown, border: 'border-red-500/30', text: 'text-red-400' },
  { key: 'opportunities', title: 'Oportunidades', icon: Sparkles, border: 'border-sky-500/30', text: 'text-sky-400' },
  { key: 'threats', title: 'Ameaças', icon: AlertTriangle, border: 'border-amber-500/30', text: 'text-amber-400' },
];

const Quadrant = ({ title, items, Icon, border, text }) => (
  <div className={`rounded-lg border p-3 bg-slate-900/40 ${border}`}>
    <div className={`flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide ${text}`}>
      <Icon className="w-3.5 h-3.5" />
      {title}
    </div>
    {Array.isArray(items) && items.length > 0 ? (
      <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-300">
        {items.map((it, i) => (<li key={i}>{it}</li>))}
      </ul>
    ) : (
      <div className="text-[11px] text-slate-500 italic">Sem itens</div>
    )}
  </div>
);

const Header = () => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
      <LayoutGrid className="w-5 h-5 text-purple-400" />
    </div>
    <div>
      <h3 className="text-lg font-bold text-white">Análise Estratégica (SWOT)</h3>
      <p className="text-xs text-slate-500">Última revisão semanal fechada pelo mentor</p>
    </div>
  </div>
);

const SourceBadge = ({ swot }) => {
  if (!swot) return null;
  if (swot.aiUnavailable) {
    return (
      <div
        data-testid="swot-source-badge"
        className="bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 text-[10px] text-amber-300 flex items-center gap-1.5"
      >
        <AlertTriangle className="w-3 h-3" />
        Fallback determinístico
      </div>
    );
  }
  return (
    <div
      data-testid="swot-source-badge"
      className="bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5 text-[10px] text-emerald-300 flex items-center gap-1.5"
      title={swot.generatedAt ? `Gerado em ${formatDate(swot.generatedAt, "dd/MM/yyyy 'às' HH:mm")}` : undefined}
    >
      <CheckCircle2 className="w-3 h-3" />
      IA · {swot.modelVersion || 'IA'}
    </div>
  );
};

const SwotAnalysis = ({ studentId, planId = null, onNavigateToReview }) => {
  const { review, loading } = useLatestClosedReview(studentId || null, planId || null);

  if (loading) {
    return (
      <div className="glass-card p-6" data-testid="swot-loading">
        <div className="flex items-center justify-between mb-6">
          <Header />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {QUADRANTS.map(q => (
            <div key={q.key} className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 h-24 animate-pulse">
              <div className="w-24 h-3 bg-slate-700/60 rounded mb-2" />
              <div className="w-full h-2 bg-slate-800/80 rounded" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando…
        </div>
        <DebugBadge component="SwotAnalysis" />
      </div>
    );
  }

  if (!review || !review.swot) {
    return (
      <div className="glass-card p-6">
        <Header />
        <div className="mt-6 text-center py-6 rounded-lg border border-dashed border-slate-700 bg-slate-800/20">
          <Sparkles className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-3">
            Aguardando primeira Revisão Semanal fechada pelo mentor.
          </p>
          <p className="text-xs text-slate-600 mb-4 max-w-md mx-auto">
            O SWOT aparece aqui automaticamente quando o mentor fechar uma revisão com análise gerada.
          </p>
          {onNavigateToReview && (
            <button
              onClick={onNavigateToReview}
              className="px-4 py-1.5 text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 inline-flex items-center gap-1.5"
            >
              <LayoutGrid className="w-3 h-3" />
              Ver Revisão Semanal
            </button>
          )}
        </div>
        <DebugBadge component="SwotAnalysis" />
      </div>
    );
  }

  const { swot } = review;

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <Header />
        <SourceBadge swot={swot} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {QUADRANTS.map(q => (
          <Quadrant
            key={q.key}
            title={q.title}
            items={swot[q.key]}
            Icon={q.icon}
            border={q.border}
            text={q.text}
          />
        ))}
      </div>
      <DebugBadge component="SwotAnalysis" />
    </div>
  );
};

export default SwotAnalysis;
