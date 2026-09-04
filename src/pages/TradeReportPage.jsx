/**
 * TradeReportPage
 * @see version.js para versão do produto
 * @description Relatório do mês na área do aluno (#414) — substitui o Diário.
 *   Uma linha por trade COM feedback do mentor: o trade, o que o aluno escreveu
 *   na entrada (observação + refs HTF/LTF) e o que o mentor respondeu.
 *
 *   Leitura pura. Registro, edição e import de trade continuam no Dashboard —
 *   o Diário era segunda via daquilo e não respondia a pergunta de fim de mês.
 *
 * CHANGELOG (produto):
 * - 1.86.0: criação — no lugar do Diário de Trades
 */

import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, MessageSquare,
  Maximize2, X, ArrowRight, ImageOff,
} from 'lucide-react';
import { useTrades } from '../hooks/useTrades';
import Loading from '../components/Loading';
import DebugBadge from '../components/DebugBadge';
import { formatCurrencyDynamic } from '../utils/currency';
import { fmtTradeTime } from '../utils/tradeTimezone';
import {
  buildMonthReport, mentorMessages, currentMonthKey,
  shiftMonth, monthLabel, monthsWithFeedback,
} from '../utils/tradeReport';

// ============================================
// HELPERS
// ============================================

const STATUS_LABEL = {
  REVIEWED: { label: 'Revisado', cls: 'bg-emerald-500/15 text-emerald-400' },
  DISCUSSED: { label: 'Discutido', cls: 'bg-indigo-500/15 text-indigo-300' },
  QUESTION: { label: 'Dúvida', cls: 'bg-amber-500/15 text-amber-400' },
  CLOSED: { label: 'Encerrado', cls: 'bg-slate-500/15 text-slate-400' },
  OPEN: { label: 'Pendente', cls: 'bg-blue-500/15 text-blue-400' },
};

const brDate = (isoDate) => {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : '—';
};

// ============================================
// SUBCOMPONENTES
// ============================================

const ChartRef = ({ url, label, onOpen }) => {
  if (!url) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(url); }}
      className="relative w-20 h-14 rounded-lg overflow-hidden border border-slate-700/50 group flex-shrink-0"
      title={`Ver ${label} em tamanho cheio`}
    >
      <img src={url} alt={label} className="w-full h-full object-cover" />
      <span className="absolute bottom-0 left-0 right-0 bg-slate-950/80 text-[9px] font-bold text-slate-300 text-center leading-tight py-0.5">
        {label}
      </span>
      <span className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Maximize2 className="w-4 h-4 text-white" />
      </span>
    </button>
  );
};

const TradeCell = ({ trade }) => {
  const status = STATUS_LABEL[trade.status] || STATUS_LABEL.OPEN;
  const isWin = Number(trade.result) >= 0;
  return (
    <div className="flex items-start gap-3">
      <div className={`w-1 self-stretch min-h-[3rem] rounded-full flex-shrink-0 ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <div className="min-w-0">
        <div className="text-xs text-slate-500">
          {brDate(trade.date)} {fmtTradeTime(trade.entryTime)}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-bold text-white text-sm">{trade.ticker}</span>
          <span className={`text-[10px] px-1 py-0.5 rounded ${trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {trade.side}
          </span>
          <span className="text-[11px] text-slate-500">{trade.qty}</span>
        </div>
        <div className={`text-sm font-bold mt-0.5 ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatCurrencyDynamic(trade.result, trade.currency)}
        </div>
        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${status.cls}`}>
          {status.label}
        </span>
      </div>
    </div>
  );
};

const EntryCell = ({ trade, onOpenImage }) => (
  <div className="min-w-0">
    {trade.notes?.trim() ? (
      <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{trade.notes}</p>
    ) : (
      <p className="text-sm text-slate-600 italic flex items-center gap-1.5">
        <ImageOff className="w-3.5 h-3.5" /> Sem observação registrada
      </p>
    )}
    {(trade.htfUrl || trade.ltfUrl) && (
      <div className="flex gap-2 mt-3">
        <ChartRef url={trade.htfUrl} label="HTF" onOpen={onOpenImage} />
        <ChartRef url={trade.ltfUrl} label="LTF" onOpen={onOpenImage} />
      </div>
    )}
  </div>
);

/** Até 2 mensagens do mentor; o resto fica na conversa (o clique na linha leva lá). */
const FeedbackCell = ({ trade }) => {
  const msgs = mentorMessages(trade);
  const shown = msgs.slice(0, 2);
  const rest = msgs.length - shown.length;
  return (
    <div className="min-w-0">
      {shown.map((m, i) => (
        <p key={m.id || i} className={`text-sm text-slate-300 whitespace-pre-wrap break-words ${i > 0 ? 'mt-2 pt-2 border-t border-slate-800/60' : ''}`}>
          {m.content}
        </p>
      ))}
      {rest > 0 && (
        <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> +{rest} {rest === 1 ? 'mensagem' : 'mensagens'} na conversa
        </p>
      )}
    </div>
  );
};

// ============================================
// PÁGINA
// ============================================

const TradeReportPage = ({ onNavigateToFeedback }) => {
  const { trades, loading } = useTrades();
  const [month, setMonth] = useState(() => currentMonthKey());
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const report = useMemo(() => buildMonthReport(trades, month), [trades, month]);
  const availableMonths = useMemo(() => monthsWithFeedback(trades), [trades]);
  // Atalho do estado vazio: o mês mais recente que tem o que mostrar.
  const suggestion = useMemo(
    () => availableMonths.find((m) => m !== month) || null,
    [availableMonths, month]
  );

  if (loading) return <Loading fullScreen text="Carregando relatório..." />;

  const openTrade = (trade) => onNavigateToFeedback?.(trade);

  return (
    <div className="min-h-screen p-6 lg:p-8 pb-20 animate-in fade-in">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatório do Mês</h1>
          <p className="text-sm text-slate-500 mt-1">
            Os trades que o mentor comentou — o que você escreveu na entrada e o que ele respondeu.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="p-2 rounded-lg border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50 text-slate-400 hover:text-white transition-all"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-[10rem] justify-center">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-white capitalize">{monthLabel(month)}</span>
          </div>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="p-2 rounded-lg border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50 text-slate-400 hover:text-white transition-all"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RESUMO — total por moeda, nunca um número só (#289/#408) */}
      {report.count > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5 text-sm">
          <span className="text-slate-400">
            <strong className="text-white">{report.count}</strong>{' '}
            {report.count === 1 ? 'trade com feedback' : 'trades com feedback'}
          </span>
          {report.totals.map((t) => (
            <span key={t.currency} className="text-slate-400">
              <span className="text-[11px] uppercase tracking-wider text-slate-600 mr-1.5">{t.currency}</span>
              <strong className={t.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {formatCurrencyDynamic(t.totalPL, t.currency)}
              </strong>
            </span>
          ))}
        </div>
      )}

      {/* TABELA */}
      <div className="glass-card overflow-hidden">
        {report.count === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500">Nenhum trade com feedback em {monthLabel(month)}.</p>
            {suggestion && (
              <button
                onClick={() => setMonth(suggestion)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Ver {monthLabel(suggestion)} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] gap-6 px-5 py-3 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span>Trade</span>
              <span>Observação de entrada</span>
              <span>Feedback do mentor</span>
            </div>

            {report.trades.map((trade) => (
              <div
                key={trade.id}
                onClick={() => openTrade(trade)}
                className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] gap-4 lg:gap-6 px-5 py-4 border-b border-slate-800/60 last:border-b-0 cursor-pointer hover:bg-slate-800/40 transition-colors"
              >
                <TradeCell trade={trade} />
                <div className="lg:hidden text-[10px] font-bold uppercase tracking-wider text-slate-600">Observação de entrada</div>
                <EntryCell trade={trade} onOpenImage={setFullscreenImage} />
                <div className="lg:hidden text-[10px] font-bold uppercase tracking-wider text-slate-600">Feedback do mentor</div>
                <FeedbackCell trade={trade} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Imagem em tamanho cheio — mesmo padrão do TradeDetailModal */}
      {fullscreenImage && (
        <>
          <div className="fixed inset-0 bg-slate-950/95 z-[60] cursor-pointer" onClick={() => setFullscreenImage(null)} />
          <div className="fixed inset-4 z-[61] flex items-center justify-center pointer-events-none">
            <img src={fullscreenImage} alt="Gráfico" className="max-w-full max-h-full object-contain rounded-xl pointer-events-auto" />
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors pointer-events-auto"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </>
      )}

      <DebugBadge component="TradeReportPage" />
    </div>
  );
};

export default TradeReportPage;
