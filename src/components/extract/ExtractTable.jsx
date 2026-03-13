/**
 * ExtractTable
 * @version 4.1.0 (v1.19.3)
 * @description Tabela compacta do extrato — redesenhada para caber em telas de mentoria.
 *   v4.1.0: Grid compactado — emoção só emoji (tooltip nome), status+feedback fundidos,
 *           padding reduzido, side como superscript, RO sem texto "S/Stop" (só ícone).
 *   v4.0.0: Coluna Status Feedback (OPEN/REVIEWED/QUESTION/CLOSED), RR com 2 casas decimais (C3).
 *   v3.0.0: RR assumido com badge "(assumido)", botão feedback por trade (B4 — Issue #71/#73).
 *   Ordem: cronológica (mais antigo no topo).
 */

import {
  Trophy, Skull, ShieldAlert, ShieldOff, Scale,
  Flame, Zap, AlertTriangle,
  CircleDot, CheckCircle2, HelpCircle, CheckCheck
} from 'lucide-react';
import { PERIOD_STATES } from '../../utils/planStateMachine';
import { calculateAssumedRR } from '../../utils/tradeCalculations';

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

/** Faixa de fundo para trades pós-evento. */
const getRowBg = (periodEvent, isEventTrade) => {
  if (isEventTrade) return 'bg-slate-800/60';
  if (periodEvent === PERIOD_STATES.POST_GOAL) return 'bg-amber-500/5 border-l-2 border-l-amber-500/40';
  if (periodEvent === PERIOD_STATES.POST_STOP) return 'bg-red-500/5 border-l-2 border-l-red-500/40';
  return '';
};

/**
 * Coleta eventos inline para um trade específico.
 * Combina: state machine + compliance + flags emocionais passados via emotionalEvents.
 */
const getTradeInlineEvents = (row, emotionalEvents) => {
  const events = [];
  const trade = row.trade;

  // 1. State machine events (período)
  if (row.periodEvent === PERIOD_STATES.GOAL_HIT) {
    events.push({ icon: Trophy, color: 'text-emerald-400', label: 'META!', sublabel: 'Período' });
  } else if (row.periodEvent === PERIOD_STATES.STOP_HIT) {
    events.push({ icon: Skull, color: 'text-red-400', label: 'STOP!', sublabel: 'Período' });
  } else if (row.periodEvent === PERIOD_STATES.POST_GOAL) {
    events.push({ icon: null, color: 'text-amber-500/70', label: 'Pós-Meta', small: true });
  } else if (row.periodEvent === PERIOD_STATES.POST_STOP) {
    events.push({ icon: null, color: 'text-red-500/70', label: 'Violação', small: true });
  }

  // 1b. Cycle events
  if (row.cycleEvent === 'CYCLE_GOAL_HIT') {
    events.push({ icon: Trophy, color: 'text-yellow-400', label: 'META!', sublabel: 'Ciclo' });
  } else if (row.cycleEvent === 'CYCLE_STOP_HIT') {
    events.push({ icon: Skull, color: 'text-orange-400', label: 'STOP!', sublabel: 'Ciclo' });
  }

  // 2. Emotional events (TILT, REVENGE matched by tradeId or proximity)
  if (emotionalEvents) {
    const tradeEmotionalEvents = emotionalEvents.filter(e => {
      if (e.tradeId && e.tradeId === trade.id) return true;
      if (e.date === trade.date) return true;
      return false;
    });
    for (const ee of tradeEmotionalEvents) {
      if (ee.type === 'TILT_DETECTED' || ee.type === 'TILT') {
        if (!events.some(ev => ev.label === 'TILT')) {
          events.push({ icon: Flame, color: 'text-orange-400', label: 'TILT', small: true });
        }
      }
      if (ee.type === 'REVENGE_DETECTED' || ee.type === 'REVENGE') {
        if (!events.some(ev => ev.label === 'REVENGE')) {
          events.push({ icon: Zap, color: 'text-red-400', label: 'REVENGE', small: true });
        }
      }
      if (ee.type === 'STATUS_CRITICAL') {
        if (!events.some(ev => ev.label === 'CRÍTICO')) {
          events.push({ icon: AlertTriangle, color: 'text-red-500', label: 'CRÍTICO', small: true });
        }
      }
    }
  }

  return events;
};

/** Badge de status do feedback do trade. */
const getFeedbackStatusConfig = (status) => {
  switch (status) {
    case 'REVIEWED':
      return { icon: CheckCircle2, color: 'text-emerald-400', label: 'Revisado', bg: 'bg-emerald-500/10' };
    case 'QUESTION':
      return { icon: HelpCircle, color: 'text-amber-400', label: 'Dúvida', bg: 'bg-amber-500/10' };
    case 'CLOSED':
      return { icon: CheckCheck, color: 'text-slate-500', label: 'Fechado', bg: 'bg-slate-500/10' };
    case 'OPEN':
    default:
      return { icon: CircleDot, color: 'text-slate-500', label: 'Pendente', bg: 'bg-slate-500/5' };
  }
};

/**
 * @param {Array} rows - Rows da state machine (cada row tem .trade, .periodEvent, .cumPnL, .result)
 * @param {Function} fmt - formatCurrencyDynamic parcial
 * @param {Function} getEmotionConfig - De useMasterData
 * @param {number} carryOver - Saldo transportado de períodos anteriores (0 na visão ciclo)
 * @param {Array} [emotionalEvents] - Eventos emocionais (TILT, REVENGE) para matching inline
 * @param {Object|null} [planRiskInfo] - { pl, riskPerOperation, rrTarget } do plano (B4)
 * @param {Function|null} [onNavigateToFeedback] - Callback para navegar ao feedback do trade (B4)
 */
const ExtractTable = ({ rows, fmt, getEmotionConfig, carryOver = 0, emotionalEvents = [], planRiskInfo = null, onNavigateToFeedback = null }) => {
  const displayRows = rows;
  // Colunas fixas: #, Data, Ativo, Emo, RO, RR, Resultado, Acumulado, Evento, Status = 10
  const totalCols = 10;

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-800/80 text-[10px] uppercase text-slate-500 sticky top-0 z-10 font-bold tracking-wider">
          <tr>
            <th className="px-2 py-2 w-8 text-center">#</th>
            <th className="px-2 py-2">Data</th>
            <th className="px-2 py-2">Ativo</th>
            <th className="px-2 py-2 text-center w-14">Emo</th>
            <th className="px-2 py-2 text-right">RO</th>
            <th className="px-2 py-2 text-right">RR</th>
            <th className="px-2 py-2 text-right">Resultado</th>
            <th className="px-2 py-2 text-right bg-slate-800/50">Acum.</th>
            <th className="px-2 py-2 text-center">Evento</th>
            <th className="px-2 py-2 text-center w-20">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {/* Saldo anterior — primeira linha quando há carry-over */}
          {carryOver !== 0 && displayRows.length > 0 && (
            <tr className="bg-slate-800/20 border-b-2 border-slate-700 border-dashed">
              <td className="px-2 py-2 text-center text-slate-600 font-mono text-xs">—</td>
              <td colSpan={totalCols - 2} className="px-2 py-2 text-slate-500 italic text-xs">Saldo anterior (períodos anteriores)</td>
              <td className={`px-2 py-2 text-right font-mono font-bold text-xs bg-slate-800/30 border-l border-slate-800 ${carryOver >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                {fmt(carryOver)}
              </td>
            </tr>
          )}
          {displayRows.map((row) => {
            const trade = row.trade;
            const isGhost = row.periodEvent === PERIOD_STATES.POST_GOAL || row.periodEvent === PERIOD_STATES.POST_STOP;
            const isEventTrade = row.periodEvent === PERIOD_STATES.GOAL_HIT || row.periodEvent === PERIOD_STATES.STOP_HIT;

            // Emoção
            const emotionCfg = getEmotionConfig ? getEmotionConfig(trade.emotionEntry) : null;
            const emoji = emotionCfg?.emoji || '❓';
            const emotionName = emotionCfg?.name || emotionCfg?.label || trade.emotionEntry || '-';
            const emotionCategory = emotionCfg?.analysisCategory || 'NEUTRAL';

            // Emoção de saída
            const exitCfg = getEmotionConfig ? getEmotionConfig(trade.emotionExit) : null;
            const exitEmoji = exitCfg?.emoji || '';
            const exitName = exitCfg?.name || exitCfg?.label || trade.emotionExit || '';

            // Compliance
            const riskPercent = trade.riskPercent != null ? `${Number(trade.riskPercent).toFixed(1)}%` : '-';
            const hasNoStop = Array.isArray(trade.redFlags) && trade.redFlags.some(f =>
              (typeof f === 'string' ? f : f.type) === 'TRADE_SEM_STOP'
            );
            const roFora = trade.compliance?.roStatus === 'FORA_DO_PLANO';
            const rrFora = trade.compliance?.rrStatus === 'NAO_CONFORME';

            // RR: real (do trade) ou assumido (DEC-007: gravado no trade pela CF)
            let rrDisplay = '-';
            let rrIsAssumed = trade.rrAssumed === true;
            if (trade.rrRatio != null) {
              rrDisplay = `${Number(trade.rrRatio).toFixed(2)}:1`;
            } else if (planRiskInfo && !trade.stopLoss) {
              const assumed = calculateAssumedRR({
                result: trade.result ?? 0,
                planPl: planRiskInfo.pl,
                planRiskPerOperation: planRiskInfo.riskPerOperation,
                planRrTarget: planRiskInfo.rrTarget,
              });
              if (assumed) {
                rrIsAssumed = true;
                rrDisplay = `${assumed.rrRatio.toFixed(2)}:1`;
              }
            }
            const rrNonCompliant = trade.compliance?.rrStatus === 'NAO_CONFORME';

            // Inline events
            const inlineEvents = getTradeInlineEvents(row, emotionalEvents);

            // Feedback status
            const fbCfg = getFeedbackStatusConfig(trade.status);
            const FbIcon = fbCfg.icon;

            return (
              <tr
                key={trade.id}
                className={`transition-all hover:bg-slate-800/40 ${getRowBg(row.periodEvent, isEventTrade)} ${
                  isGhost ? 'opacity-50 hover:opacity-100' : ''
                }`}
              >
                {/* # */}
                <td className="px-2 py-1.5 text-center text-slate-600 font-mono text-xs">{row.tradeIndex + 1}</td>

                {/* Data + Hora */}
                <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
                  <span className="font-medium text-xs">{fmtDate(trade.date)}</span>
                  <span className="text-[9px] text-slate-500 ml-1">{fmtTime(trade.entryTime)}</span>
                </td>

                {/* Ativo + Side (superscript compacto) */}
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span className="text-white font-bold text-xs">{trade.ticker}</span>
                  <sup className={`text-[8px] ml-0.5 font-bold ${
                    trade.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'
                  }`}>{trade.side === 'LONG' ? 'L' : 'S'}</sup>
                </td>

                {/* Emoção — só emojis, tooltip com nomes completos */}
                <td className="px-2 py-1.5 text-center whitespace-nowrap">
                  <span
                    className={`cursor-default ${getEmotionColor(emotionCategory)}`}
                    title={`Entrada: ${emotionName}${exitName ? ` → Saída: ${exitName}` : ''}`}
                  >
                    {emoji}{exitEmoji && <span className="text-[10px] text-slate-500">→{exitEmoji}</span>}
                  </span>
                </td>

                {/* RO % — compacto, sem stop = só ícone (tooltip) */}
                <td className={`px-2 py-1.5 text-right font-mono text-xs ${roFora ? 'text-amber-400' : 'text-slate-400'}`}>
                  <div className="flex items-center justify-end gap-0.5">
                    {roFora && <ShieldOff className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    {hasNoStop ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0" title="Trade sem stop loss" />
                    ) : riskPercent}
                  </div>
                </td>

                {/* RR — real ou assumido */}
                <td className={`px-2 py-1.5 text-right font-mono text-xs ${rrFora || rrNonCompliant ? 'text-amber-400' : 'text-slate-400'}`}>
                  <div className="flex items-center justify-end gap-0.5">
                    {(rrFora || rrNonCompliant) && <Scale className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    <span>{rrDisplay}</span>
                    {rrIsAssumed && (
                      <span className="text-[7px] text-purple-400/70" title="RR estimado sem stop loss (baseado no RO% do plano)">*</span>
                    )}
                  </div>
                </td>

                {/* Resultado */}
                <td className={`px-2 py-1.5 text-right font-mono font-bold text-xs ${row.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.result > 0 ? '+' : ''}{fmt(row.result)}
                </td>

                {/* Acumulado */}
                <td className={`px-2 py-1.5 text-right font-mono font-bold text-xs bg-slate-800/30 border-l border-slate-800 ${
                  row.cumPnL >= 0 ? 'text-emerald-300' : 'text-red-300'
                }`}>
                  {fmt(row.cumPnL)}
                </td>

                {/* Evento — inline events */}
                <td className="px-2 py-1.5 text-center">
                  {inlineEvents.length === 0 && (
                    <span className="text-slate-600 text-[10px]">-</span>
                  )}
                  {inlineEvents.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5">
                      {inlineEvents.map((evt, idx) => {
                        const Icon = evt.icon;
                        return (
                          <span
                            key={idx}
                            className={`${evt.color} ${evt.small ? 'text-[8px]' : 'text-[10px]'} font-bold flex items-center gap-0.5 ${evt.small ? 'uppercase' : ''}`}
                            title={evt.sublabel ? `${evt.label} (${evt.sublabel})` : evt.label}
                          >
                            {Icon && <Icon className="w-3 h-3" />}
                            {evt.sublabel ? (
                              <span className="flex flex-col items-center leading-none">
                                <span>{evt.label}</span>
                                <span className="text-[6px] opacity-60">{evt.sublabel}</span>
                              </span>
                            ) : evt.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>

                {/* Status Feedback — badge clicável se onNavigateToFeedback */}
                <td className="px-2 py-1.5 text-center">
                  {onNavigateToFeedback ? (
                    <button
                      onClick={() => onNavigateToFeedback(trade)}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${fbCfg.color} ${fbCfg.bg} hover:brightness-125 transition-all cursor-pointer`}
                      title={`${fbCfg.label} — clique para feedback`}
                    >
                      <FbIcon className="w-3 h-3" />
                      {fbCfg.label}
                    </button>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${fbCfg.color} ${fbCfg.bg}`}
                      title={fbCfg.label}
                    >
                      <FbIcon className="w-3 h-3" />
                      {fbCfg.label}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {displayRows.length === 0 && (
            <tr><td colSpan={totalCols} className="p-12 text-center text-slate-500">Nenhum trade neste período.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ExtractTable;
