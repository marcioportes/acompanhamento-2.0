/**
 * ReviewTradesSection
 * @description Tabela de trades de uma revisão semanal com day-grouping e link
 *              opcional para FeedbackPage por linha.
 *
 * Origem: extração de WeeklyReviewPage.jsx (issue #119 task 28) para reuso
 * read-only pelo aluno (`StudentReviewsPage`).
 *
 * Props:
 * - trades: array dos trades incluídos no review (já filtrados/hidratados pelo caller)
 * - currency: 'USD' | 'BRL' (default USD)
 * - weekStart / weekEnd: ISO YYYY-MM-DD; usados para marcar trades "fora do período" (apenas DRAFT)
 * - onNavigateToFeedback: ({ id, ticker, ...trade }) => void. Quando null ou omitido, coluna de ação não renderiza (aluno sem navegação contextual; embedded em modal; etc.).
 */

import { useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ExcursionDisplay from '../ExcursionDisplay';
import {
  buildVisibleRows,
  fmtMoney,
  fmtTime,
  tradeDate,
} from '../../utils/reviewFormatters';

const ReviewTradesSection = ({
  trades,
  currency = 'USD',
  weekStart = null,
  weekEnd = null,
  onNavigateToFeedback = null,
}) => {
  const [expandedDays, setExpandedDays] = useState(new Set());
  const rows = useMemo(() => buildVisibleRows(trades, expandedDays), [trades, expandedDays]);
  const toggleDay = (date) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-6 text-center text-[11px] text-slate-500 italic">
        Sem trades no período.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="bg-slate-800/40">
          <tr className="text-[10px] uppercase text-slate-500 tracking-wider">
            <th className="px-2 py-1.5 text-left font-medium w-[52px]">Data</th>
            <th className="px-2 py-1.5 text-left font-medium w-[44px]">Hora</th>
            <th className="px-2 py-1.5 text-left font-medium">Ativo</th>
            <th className="px-2 py-1.5 text-center font-medium w-[30px]">C/V</th>
            <th className="px-2 py-1.5 text-right font-medium w-[50px]">Qty</th>
            <th className="px-2 py-1.5 text-left font-medium">Emoção</th>
            <th className="px-2 py-1.5 text-right font-medium w-[96px]">Valor</th>
            <th className="px-1 py-1.5 w-[28px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rows.map((row, idx) => {
            if (row.type === 'daySummary') {
              const [, m, d] = row.date.split('-');
              const ddmm = `${d}/${m}`;
              const wrColor = row.wr >= 50 ? 'text-emerald-400' : row.wr >= 40 ? 'text-amber-400' : 'text-red-400';
              const plPositive = row.pl > 0;
              return (
                <tr
                  key={`day-${row.date}`}
                  onClick={() => toggleDay(row.date)}
                  className="bg-slate-800/30 hover:bg-slate-800/60 cursor-pointer"
                  title={`${row.expanded ? 'Recolher' : 'Expandir'} os ${row.count} trades`}
                >
                  <td className="px-2 py-1.5 font-mono text-slate-200">{ddmm}</td>
                  <td className="px-2 py-1.5 text-center font-mono text-emerald-400 font-semibold">{row.expanded ? '−' : '+'}</td>
                  <td colSpan={3} className="px-2 py-1.5 text-slate-300">{row.count} trades</td>
                  <td className="px-2 py-1.5 text-[11px]">
                    <span className={wrColor}>WR {row.wr}%</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right font-medium tabular-nums ${plPositive ? 'text-emerald-400' : row.pl < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {plPositive ? '+' : ''}{fmtMoney(row.pl, currency)}
                  </td>
                  <td />
                </tr>
              );
            }
            const t = row.data;
            const isBuy = t.side === 'LONG' || t.side === 'BUY' || t.side === 'C';
            const isWin = Number(t.pnl) > 0;
            const td = tradeDate(t);
            const outOfPeriod = weekStart && weekEnd && td && (td < weekStart || td > weekEnd);
            const handleOpenFeedback = () => {
              if (!onNavigateToFeedback || !t.tradeId) return;
              onNavigateToFeedback({ id: t.tradeId, ticker: t.symbol, ...t });
            };
            const dateShort = (() => {
              if (!td) return '??';
              const [, m, d] = td.split('-');
              return `${d}/${m}`;
            })();
            const dateFullBR = td ? (() => {
              const [y, m, d] = td.split('-');
              return `${d}/${m}/${y}`;
            })() : '';
            const rawEntry = t.emotionEntry || t.emotion;
            const rawExit = t.emotionExit;
            const emotionText = rawExit && rawExit !== rawEntry
              ? `${rawEntry || '—'} → ${rawExit}`
              : (rawEntry || '—');
            return (
              <tr key={t.tradeId || idx} className="hover:bg-slate-800/20">
                <td className="px-2 py-1 font-mono text-slate-400" title={dateFullBR}>{dateShort}</td>
                <td className="px-2 py-1 font-mono text-slate-500">{fmtTime(t.entryTime)}</td>
                <td className="px-2 py-1 text-white font-medium">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{t.symbol || '—'}</span>
                    {outOfPeriod && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30" title={`Trade de ${td} está fora do período do rascunho`}>
                        fora
                      </span>
                    )}
                  </div>
                  <ExcursionDisplay trade={{ ...t, ticker: t.symbol }} variant="compact" className="mt-0.5" />
                </td>
                <td className="px-2 py-1 text-center">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {isBuy ? 'C' : 'V'}
                  </span>
                </td>
                <td className="px-2 py-1 text-right text-slate-400 tabular-nums">{t.qty || 0}</td>
                <td className="px-2 py-1 text-slate-300 truncate max-w-[160px]" title={emotionText}>{emotionText}</td>
                <td className={`px-2 py-1 text-right font-medium tabular-nums ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isWin ? '+' : ''}{fmtMoney(t.pnl, currency)}
                </td>
                <td className="px-1 py-1 text-center">
                  {onNavigateToFeedback && t.tradeId ? (
                    <button
                      onClick={handleOpenFeedback}
                      className="p-0.5 text-slate-500 hover:text-blue-400 rounded transition-colors"
                      title="Abrir feedback do trade"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ReviewTradesSection;
