/**
 * ExtractTable
 * @version 1.0.0 (v1.16.0)
 * @description Tabela do extrato com colunas de sanity check (RO, RR, Emoção)
 *   e marcação visual para POST_GOAL/POST_STOP.
 *   Ordem: mais recentes no topo (invertida).
 */

import {
  Trophy, Skull, ShieldAlert, ShieldOff, Scale
} from 'lucide-react';
import { PERIOD_STATES } from '../../utils/planStateMachine';

const fmtDate = (d) => { if (!d) return '-'; const [y, m, dd] = d.split('-'); return `${dd}/${m}`; };
const fmtTime = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const getEmotionColor = (category) => {
  switch (category) {
    case 'POSITIVE': return 'text-emerald-400';
    case 'NEGATIVE': return 'text-red-400';
    case 'CRITICAL': return 'text-red-500';
    default: return 'text-slate-400';
  }
};

/**
 * Faixa de fundo para trades pós-evento.
 */
const getRowBg = (periodEvent, isEventTrade) => {
  if (isEventTrade) return 'bg-slate-800/60';
  if (periodEvent === PERIOD_STATES.POST_GOAL) return 'bg-amber-500/5 border-l-2 border-l-amber-500/40';
  if (periodEvent === PERIOD_STATES.POST_STOP) return 'bg-red-500/5 border-l-2 border-l-red-500/40';
  return '';
};

/**
 * @param {Array} rows - Rows da state machine (cada row tem .trade, .periodEvent, .cumPnL, .result)
 * @param {Function} fmt - formatCurrencyDynamic parcial
 * @param {Function} getEmotionConfig - De useMasterData
 * @param {number} carryOver - Saldo transportado de períodos anteriores (0 na visão ciclo)
 */
const ExtractTable = ({ rows, fmt, getEmotionConfig, carryOver = 0 }) => {
  // Ordem cronológica (mais antigo no topo) — acumulado funciona como saldo
  const displayRows = rows;

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-800/80 text-[10px] uppercase text-slate-500 sticky top-0 z-10 font-bold tracking-wider">
          <tr>
            <th className="p-3 w-10 text-center">#</th>
            <th className="p-3">Data</th>
            <th className="p-3">Ativo</th>
            <th className="p-3">Emoção</th>
            <th className="p-3 text-right">RO %</th>
            <th className="p-3 text-right">RR</th>
            <th className="p-3 text-right">Resultado</th>
            <th className="p-3 text-right bg-slate-800/50">Acumulado</th>
            <th className="p-3 text-center w-28">Evento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {/* Saldo anterior — primeira linha quando há carry-over */}
          {carryOver !== 0 && displayRows.length > 0 && (
            <tr className="bg-slate-800/20 border-b-2 border-slate-700 border-dashed">
              <td className="p-3 text-center text-slate-600 font-mono text-xs">—</td>
              <td colSpan="6" className="p-3 text-slate-500 italic text-xs">Saldo anterior (períodos anteriores)</td>
              <td className={`p-3 text-right font-mono font-bold text-xs bg-slate-800/30 border-l border-slate-800 ${carryOver >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                {fmt(carryOver)}
              </td>
              <td className="p-3"></td>
            </tr>
          )}
          {displayRows.map((row) => {
            const trade = row.trade;
            const isGhost = row.periodEvent === PERIOD_STATES.POST_GOAL || row.periodEvent === PERIOD_STATES.POST_STOP;
            const isEventTrade = row.periodEvent === PERIOD_STATES.GOAL_HIT || row.periodEvent === PERIOD_STATES.STOP_HIT;

            // Emoção
            const emotionCfg = getEmotionConfig ? getEmotionConfig(trade.emotionEntry) : null;
            const emoji = emotionCfg?.emoji || '❓';
            const emotionName = emotionCfg?.name || trade.emotionEntry || '-';
            const emotionCategory = emotionCfg?.analysisCategory || 'NEUTRAL';

            // Emoção de saída
            const exitCfg = getEmotionConfig ? getEmotionConfig(trade.emotionExit) : null;
            const exitEmoji = exitCfg?.emoji || '';

            // Compliance
            const riskPercent = trade.riskPercent != null ? `${Number(trade.riskPercent).toFixed(1)}%` : '-';
            const rrRatio = trade.rrRatio != null ? `${Number(trade.rrRatio).toFixed(1)}:1` : '-';
            const hasNoStop = Array.isArray(trade.redFlags) && trade.redFlags.some(f =>
              (typeof f === 'string' ? f : f.type) === 'TRADE_SEM_STOP'
            );
            const roFora = trade.compliance?.roStatus === 'FORA_DO_PLANO';
            const rrFora = trade.compliance?.rrStatus === 'NAO_CONFORME';

            return (
              <tr
                key={trade.id}
                className={`transition-all hover:bg-slate-800/40 ${getRowBg(row.periodEvent, isEventTrade)} ${
                  isGhost ? 'opacity-50 hover:opacity-100' : ''
                }`}
              >
                {/* # */}
                <td className="p-3 text-center text-slate-600 font-mono text-xs">{row.tradeIndex + 1}</td>

                {/* Data + Hora */}
                <td className="p-3 text-slate-300">
                  <span className="font-medium">{fmtDate(trade.date)}</span>
                  <span className="text-[10px] text-slate-500 ml-1">{fmtTime(trade.entryTime)}</span>
                </td>

                {/* Ativo + Side */}
                <td className="p-3">
                  <span className="text-white font-bold">{trade.ticker}</span>
                  <span className={`text-[10px] ml-1.5 px-1 py-0.5 rounded border ${
                    trade.side === 'LONG' ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'
                  }`}>{trade.side}</span>
                </td>

                {/* Emoção In → Out */}
                <td className="p-3">
                  <span className={`text-xs ${getEmotionColor(emotionCategory)}`}>
                    {emoji} {emotionName}
                  </span>
                  {exitEmoji && (
                    <span className="text-slate-500 text-[10px] ml-1">→ {exitEmoji}</span>
                  )}
                </td>

                {/* RO % */}
                <td className={`p-3 text-right font-mono text-xs ${roFora ? 'text-amber-400' : 'text-slate-400'}`}>
                  <div className="flex items-center justify-end gap-1">
                    {roFora && <ShieldOff className="w-3 h-3 text-amber-400" />}
                    {hasNoStop ? (
                      <span className="text-red-400 flex items-center gap-0.5"><ShieldAlert className="w-3 h-3" /> S/Stop</span>
                    ) : riskPercent}
                  </div>
                </td>

                {/* RR */}
                <td className={`p-3 text-right font-mono text-xs ${rrFora ? 'text-amber-400' : 'text-slate-400'}`}>
                  <div className="flex items-center justify-end gap-1">
                    {rrFora && <Scale className="w-3 h-3 text-amber-400" />}
                    {rrRatio}
                  </div>
                </td>

                {/* Resultado */}
                <td className={`p-3 text-right font-mono font-bold ${row.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.result > 0 ? '+' : ''}{fmt(row.result)}
                </td>

                {/* Acumulado */}
                <td className={`p-3 text-right font-mono font-bold bg-slate-800/30 border-l border-slate-800 ${
                  row.cumPnL >= 0 ? 'text-emerald-300' : 'text-red-300'
                }`}>
                  {fmt(row.cumPnL)}
                </td>

                {/* Evento */}
                <td className="p-3 text-center">
                  {row.periodEvent === PERIOD_STATES.GOAL_HIT && (
                    <span className="text-emerald-400 font-bold text-xs flex justify-center items-center gap-1">
                      <Trophy className="w-3 h-3" /> META!
                    </span>
                  )}
                  {row.periodEvent === PERIOD_STATES.STOP_HIT && (
                    <span className="text-red-400 font-bold text-xs flex justify-center items-center gap-1">
                      <Skull className="w-3 h-3" /> STOP!
                    </span>
                  )}
                  {row.periodEvent === PERIOD_STATES.POST_GOAL && (
                    <span className="text-amber-500/70 text-[10px] uppercase font-bold">Pós-Meta</span>
                  )}
                  {row.periodEvent === PERIOD_STATES.POST_STOP && (
                    <span className="text-red-500/70 text-[10px] uppercase font-bold">Violação</span>
                  )}
                  {row.periodEvent === PERIOD_STATES.IN_PROGRESS && (
                    <span className="text-slate-600 text-xs">-</span>
                  )}
                </td>
              </tr>
            );
          })}
          {displayRows.length === 0 && (
            <tr><td colSpan="9" className="p-12 text-center text-slate-500">Nenhum trade neste período.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ExtractTable;
