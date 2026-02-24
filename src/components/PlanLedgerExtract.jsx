/**
 * PlanLedgerExtract
 * @version 1.0.0 (Fase 1.5.0)
 * @description Extrato Ledger emocional — combina auditoria financeira + perfil emocional.
 *   Adiciona coluna Emoção ao extrato, markers de TILT/REVENGE, score do ciclo.
 * 
 * DIFERENÇA DO PlanExtractModal:
 * - PlanExtractModal: compliance financeiro puro (META/STOP)
 * - PlanLedgerExtract: compliance + camada emocional (emoção por trade, eventos, score)
 * 
 * USAGE:
 * <PlanLedgerExtract plan={plan} trades={planTrades} onClose={fn} />
 */

import { useMemo } from 'react';
import { 
  X, ScrollText, Trophy, Skull, AlertTriangle, Flame, Zap, 
  TrendingUp, TrendingDown, Brain, Shield
} from 'lucide-react';
import { useMasterData } from '../hooks/useMasterData';
import { useEmotionalProfile } from '../hooks/useEmotionalProfile';
import { useComplianceRules } from '../hooks/useComplianceRules';
import DebugBadge from '../components/DebugBadge';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) => { if (!d) return '-'; const [y, m, dd] = d.split('-'); return `${dd}/${m}`; };
const fmtTime = (iso) => { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

const PlanLedgerExtract = ({ plan, trades, onClose }) => {
  const { getEmotionConfig } = useMasterData();
  const { detectionConfig, statusThresholds } = useComplianceRules();
  const emotional = useEmotionalProfile({ trades, detectionConfig, statusThresholds });

  const { ledger, events, summary } = useMemo(() => {
    if (!plan || !trades) return { ledger: [], events: [], summary: null };

    const sorted = [...trades].sort((a, b) => {
      const da = a.entryTime || a.date;
      const db = b.entryTime || b.date;
      return new Date(da) - new Date(db);
    });

    const startPL = Number(plan.pl) || 0;
    const goalVal = startPL * ((plan.periodGoal || plan.goalPercent || 5) / 100);
    const stopVal = startPL * ((plan.periodStop || plan.stopPercent || 3) / 100);

    let balance = 0;
    let goalHit = false;
    let stopHit = false;
    const evts = [];

    const rows = sorted.map((t, i) => {
      const result = Number(t.result) || 0;
      balance += result;
      
      const emotionCfg = getEmotionConfig ? getEmotionConfig(t.emotionEntry) : null;
      const emoji = emotionCfg?.emoji || '❓';
      const emotionName = emotionCfg?.name || t.emotionEntry || '-';
      const category = emotionCfg?.analysisCategory || 'NEUTRAL';

      let event = null;
      if (!goalHit && !stopHit && balance >= goalVal && goalVal > 0) {
        goalHit = true;
        event = 'GOAL_HIT';
        evts.push({ type: 'GOAL_HIT', date: t.date, time: fmtTime(t.entryTime), message: `META atingida: ${fmt(balance)}` });
      } else if (!goalHit && !stopHit && balance <= -stopVal) {
        stopHit = true;
        event = 'STOP_HIT';
        evts.push({ type: 'STOP_HIT', date: t.date, time: fmtTime(t.entryTime), message: `STOP atingido: ${fmt(balance)}` });
      } else if (goalHit) {
        event = 'POST_GOAL';
      } else if (stopHit) {
        event = 'POST_STOP';
      }

      return {
        ...t,
        idx: i + 1,
        result,
        runningBalance: balance,
        emoji,
        emotionName,
        emotionCategory: category,
        event
      };
    });

    // Adicionar eventos TILT/REVENGE dos alertas
    if (emotional.isReady && emotional.alerts) {
      emotional.alerts.forEach(a => {
        if (a.type === 'TILT' || a.type === 'REVENGE' || a.type === 'STATUS_CRITICAL') {
          evts.push({
            type: a.type,
            date: a.date || '-',
            time: a.time || '',
            message: a.message
          });
        }
      });
    }

    // Sort events por data
    evts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return {
      ledger: rows,
      events: evts,
      summary: {
        startPL,
        totalResult: balance,
        currentPL: startPL + balance,
        goalVal,
        stopVal,
        goalHit,
        stopHit,
        tradesCount: rows.length,
        score: emotional.isReady ? emotional.metrics?.emotionalScore : null,
        statusLabel: emotional.isReady ? emotional.status?.label : null
      }
    };
  }, [plan, trades, getEmotionConfig, emotional]);

  if (!plan) return null;

  const getEventIcon = (type) => {
    switch (type) {
      case 'GOAL_HIT': return <Trophy className="w-3.5 h-3.5 text-emerald-400" />;
      case 'STOP_HIT': return <Skull className="w-3.5 h-3.5 text-red-400" />;
      case 'TILT': return <Flame className="w-3.5 h-3.5 text-orange-400" />;
      case 'REVENGE': return <Zap className="w-3.5 h-3.5 text-red-400" />;
      case 'STATUS_CRITICAL': return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
      default: return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
    }
  };

  const getEventStyle = (type) => {
    switch (type) {
      case 'GOAL_HIT': return 'border-emerald-500/30 bg-emerald-500/5';
      case 'STOP_HIT': case 'STATUS_CRITICAL': return 'border-red-500/30 bg-red-500/5';
      case 'TILT': return 'border-orange-500/30 bg-orange-500/5';
      case 'REVENGE': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-yellow-500/30 bg-yellow-500/5';
    }
  };

  const getEmotionColor = (cat) => {
    switch (cat) {
      case 'POSITIVE': return 'text-emerald-400';
      case 'NEGATIVE': return 'text-red-400';
      case 'CRITICAL': return 'text-red-500 font-bold';
      default: return 'text-slate-400';
    }
  };

  const scoreColor = (s) => s >= 70 ? 'text-emerald-400' : s >= 50 ? 'text-yellow-400' : s >= 30 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[90vh] rounded-xl flex flex-col shadow-2xl ring-1 ring-white/10">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <ScrollText className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Extrato Emocional: {plan.name}</h2>
              <p className="text-xs text-slate-400">Auditoria Financeira + Perfil Emocional</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo */}
        {summary && (
          <div className="px-5 py-4 bg-slate-800/30 border-b border-slate-800">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">PL Inicial</span>
                <span className="text-sm font-mono font-bold text-white">{fmt(summary.startPL)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Resultado</span>
                <span className={`text-sm font-mono font-bold ${summary.totalResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {summary.totalResult >= 0 ? '+' : ''}{fmt(summary.totalResult)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">PL Atual</span>
                <span className={`text-sm font-mono font-bold ${summary.currentPL >= summary.startPL ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(summary.currentPL)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span className={`text-sm font-bold ${summary.goalHit ? 'text-emerald-400' : summary.stopHit ? 'text-red-400' : 'text-blue-400'}`}>
                  {summary.goalHit ? '🏆 Meta Batida' : summary.stopHit ? '🔴 Stop Atingido' : '📊 Em Andamento'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Score Emocional
                </span>
                {summary.score !== null ? (
                  <span className={`text-sm font-bold ${scoreColor(summary.score)}`}>
                    {Math.round(summary.score)}/100 · {summary.statusLabel}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">-</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-800/80 text-[10px] uppercase text-slate-500 sticky top-0 z-10 font-bold tracking-wider">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Data</th>
                <th className="p-3">Ativo</th>
                <th className="p-3">Emoção</th>
                <th className="p-3 text-right">Resultado</th>
                <th className="p-3 text-right bg-slate-800/50">Acumulado</th>
                <th className="p-3 text-center w-28">Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {ledger.map((row) => {
                const isGhost = row.event === 'POST_GOAL' || row.event === 'POST_STOP';
                const isEvent = row.event === 'GOAL_HIT' || row.event === 'STOP_HIT';

                return (
                  <tr key={row.id} className={`transition-all hover:bg-slate-800/40 ${
                    isGhost ? 'opacity-40 hover:opacity-100' : ''
                  } ${isEvent ? 'bg-slate-800/60' : ''}`}>
                    <td className="p-3 text-center text-slate-600 font-mono text-xs">{row.idx}</td>
                    <td className="p-3 text-slate-300">
                      <span className="font-medium">{fmtDate(row.date)}</span>
                      <span className="text-[10px] text-slate-500 ml-1">{fmtTime(row.entryTime)}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-white font-bold">{row.ticker}</span>
                      <span className={`text-[10px] ml-1.5 px-1 py-0.5 rounded border ${
                        row.side === 'LONG' ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'
                      }`}>{row.side}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs ${getEmotionColor(row.emotionCategory)}`}>
                        {row.emoji} {row.emotionName}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${row.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.result > 0 ? '+' : ''}{fmt(row.result)}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold bg-slate-800/30 border-l border-slate-800 ${
                      row.runningBalance >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}>{fmt(row.runningBalance)}</td>
                    <td className="p-3 text-center">
                      {row.event === 'GOAL_HIT' && <span className="text-emerald-400 font-bold text-xs flex justify-center items-center gap-1"><Trophy className="w-3 h-3" /> META!</span>}
                      {row.event === 'STOP_HIT' && <span className="text-red-400 font-bold text-xs flex justify-center items-center gap-1"><Skull className="w-3 h-3" /> STOP!</span>}
                      {row.event === 'POST_GOAL' && <span className="text-yellow-500/70 text-[10px] uppercase font-bold">Pós-Meta</span>}
                      {row.event === 'POST_STOP' && <span className="text-red-500/70 text-[10px] uppercase font-bold">Violação</span>}
                      {!row.event && <span className="text-slate-600 text-xs">-</span>}
                    </td>
                  </tr>
                );
              })}
              {ledger.length === 0 && (
                <tr><td colSpan="7" className="p-12 text-center text-slate-500">Nenhum trade neste plano.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Eventos */}
        {events.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-800/20 max-h-36 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Eventos ({events.length})
            </h4>
            <div className="space-y-1.5">
              {events.map((evt, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${getEventStyle(evt.type)}`}>
                  {getEventIcon(evt.type)}
                  <span className="text-slate-500 font-mono">{fmtDate(evt.date)} {evt.time}</span>
                  <span className="text-slate-300">{evt.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <DebugBadge component="PlanLedgerExtract" />
    </div>
  );
};

export default PlanLedgerExtract;
