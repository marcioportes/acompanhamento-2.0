/**
 * PlanExtractModal
 * @version 3.0.0 (Filter Fix)
 * @description Extrato com correção de filtros temporais (Mapeamento PT-BR -> Chaves Técnicas).
 * * CHANGE LOG 3.0.0:
 * - FIX: Implementado SCOPE_MAP para traduzir 'Diário' -> 'today', 'Semanal' -> 'week', etc.
 * - FIX: Botão 'Ciclo' agora filtra corretamente usando a configuração de Ajuste do Plano.
 */

import { useState, useMemo } from 'react';
import { 
  X, FileText, AlertTriangle, Skull, Trophy,
  Calendar, RefreshCw, TrendingUp, TrendingDown, Check
} from 'lucide-react';
import { formatCurrency, formatDate, filterTradesByPeriod, analyzePlanCompliance } from '../utils/calculations';

// Dicionário de Tradução (Visual -> Técnico)
const SCOPE_MAP = {
  // Períodos
  'Diário': 'today',
  'Semanal': 'week',
  'Mensal': 'month',
  'Trimestral': 'quarter',
  'Anual': 'year',
  // Fallbacks
  'Day Trade': 'today',
  'Swing Trade': 'week'
};

const PlanExtractModal = ({ isOpen, onClose, plan, trades }) => {
  // Estado do Escopo: 'period' (Micro) ou 'cycle' (Macro)
  const [viewScope, setViewScope] = useState('period');

  const audit = useMemo(() => {
    if (!plan || !trades) return null;

    // 1. Definição da Chave de Filtro (Correção do Bug)
    // Se estiver vendo Período, usa plan.operationPeriod (ex: 'Diário')
    // Se estiver vendo Ciclo, usa plan.adjustmentCycle (ex: 'Mensal')
    const rawScope = viewScope === 'period' ? plan.operationPeriod : plan.adjustmentCycle;
    
    // Traduz para a chave que o calculations.js entende ('today', 'week', etc)
    const filterKey = SCOPE_MAP[rawScope] || 'all';

    // 2. Aplica o Filtro
    const scopeTrades = filterTradesByPeriod(trades, filterKey);

    // 3. Define valores financeiros dos limites
    const stopPercent = viewScope === 'period' ? plan.periodStop : plan.cycleStop;
    const goalPercent = viewScope === 'period' ? plan.periodGoal : plan.cycleGoal;
    
    const stopValue = (plan.pl * (stopPercent / 100));
    const goalValue = (plan.pl * (goalPercent / 100));

    // 4. Roda a Engine de Compliance
    const result = analyzePlanCompliance(scopeTrades, stopValue, goalValue);
    
    return { 
      ...result, 
      stopValue, 
      goalValue,
      scopeLabel: rawScope // Para exibir na UI qual filtro está ativo
    };
  }, [plan, trades, viewScope]);

  if (!isOpen || !plan || !audit) return null;

  // Helpers de UI para o Status (Badges)
  const getStatusBadge = (status) => {
    switch(status) {
      case 'GOAL_DISCIPLINED': return <span className="badge-success flex gap-1 items-center"><Trophy className="w-3 h-3"/> Meta Batida (Disciplinado)</span>;
      case 'GOAL_GAVE_BACK': return <span className="badge-warning flex gap-1 items-center"><TrendingDown className="w-3 h-3"/> Meta Devolvida (Ganância)</span>;
      case 'GOAL_TO_STOP': return <span className="badge-critical flex gap-1 items-center"><Skull className="w-3 h-3"/> Catástrofe (Meta p/ Stop)</span>;
      case 'STOP_DISCIPLINED': return <span className="badge-neutral flex gap-1 items-center"><Check className="w-3 h-3"/> Stop Respeitado</span>;
      case 'STOP_WORSENED': return <span className="badge-critical flex gap-1 items-center"><Skull className="w-3 h-3"/> Dia de Fúria (Stop Violado)</span>;
      case 'LOSS_TO_GOAL': return <span className="badge-warning flex gap-1 items-center"><AlertTriangle className="w-3 h-3"/> Recuperação Arriscada (Sorte)</span>;
      default: return <span className="text-slate-500 font-medium text-xs border border-slate-700 px-2 py-1 rounded">Em andamento / Neutro</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
        
        {/* HEADER */}
        <div className="flex-none p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20"><FileText className="w-5 h-5 text-blue-400" /></div>
            <div><h2 className="text-lg font-bold text-white">Extrato: {plan.name}</h2><p className="text-xs text-slate-400">Auditoria de Risco & Compliance</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* CONTROLES E LEGENDA */}
        <div className="flex-none p-4 bg-slate-800/30 border-b border-slate-800 flex flex-wrap gap-4 justify-between items-center">
          
          {/* Toggle de Escopo */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
            <button 
              onClick={() => setViewScope('period')} 
              className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewScope === 'period' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar className="w-3 h-3" /> Período ({plan.operationPeriod})
            </button>
            <button 
              onClick={() => setViewScope('cycle')} 
              className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewScope === 'cycle' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <RefreshCw className="w-3 h-3" /> Ciclo ({plan.adjustmentCycle})
            </button>
          </div>
          
          {/* Resumo de Limites */}
          <div className="flex items-center gap-4 text-xs bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> 
              <span className="text-slate-400">Meta:</span>
              <span className="text-emerald-400 font-mono font-bold">{formatCurrency(audit.goalValue)}</span>
            </div>
            <div className="w-px h-3 bg-slate-700"></div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span> 
              <span className="text-slate-400">Stop:</span>
              <span className="text-red-400 font-mono font-bold">-{formatCurrency(audit.stopValue)}</span>
            </div>
          </div>

          <div>{getStatusBadge(audit.status)}</div>
        </div>

        {/* TABELA */}
        <div className="flex-1 overflow-y-auto p-0">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm border-b border-slate-800">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">Data</th>
                <th className="p-4">Ativo</th>
                <th className="p-4 text-right">Resultado</th>
                <th className="p-4 text-right bg-slate-800/50 border-l border-slate-800">Acumulado</th>
                <th className="p-4 text-center">Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {audit.history.length > 0 ? audit.history.map((row, i) => {
                // Lógica de Cores da Linha
                let rowClass = "hover:bg-slate-800/30 transition-colors border-l-4 border-l-transparent";
                
                if (row.rowEvent === 'GOAL_HIT') rowClass = "bg-emerald-500/10 border-l-emerald-500";
                else if (row.rowEvent === 'STOP_HIT') rowClass = "bg-red-500/10 border-l-red-500";
                else if (row.isAfterStop) rowClass = "bg-red-900/10 opacity-70 border-l-red-900/50"; // Zombie Zone
                else if (row.isAfterGoal) rowClass = "bg-yellow-500/5 opacity-80 border-l-yellow-500/30"; // Greed Zone

                return (
                  <tr key={row.id} className={rowClass}>
                    <td className="p-4 text-slate-500 font-mono text-xs text-center">{i+1}</td>
                    <td className="p-4 text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-medium">{formatDate(row.date)}</span>
                        <span className="text-[10px] text-slate-500">{row.time || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-white">{row.ticker}</td>
                    <td className={`p-4 text-right font-medium ${row.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(row.result)}
                    </td>
                    <td className={`p-4 text-right font-mono font-bold border-l border-slate-800/50 bg-slate-800/20 ${row.runningBalance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {formatCurrency(row.runningBalance)}
                    </td>
                    <td className="p-4 text-center">
                      {row.rowEvent === 'GOAL_HIT' && <span className="text-emerald-400 font-bold text-xs flex justify-center items-center gap-1 animate-pulse"><Trophy className="w-3 h-3"/> META!</span>}
                      {row.rowEvent === 'STOP_HIT' && <span className="text-red-500 font-bold text-xs flex justify-center items-center gap-1 animate-pulse"><Skull className="w-3 h-3"/> STOP!</span>}
                      
                      {row.isAfterGoal && !row.rowEvent && (
                        <span className="text-yellow-500/70 text-[10px] uppercase font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">Pós-Meta</span>
                      )}
                      {row.isAfterStop && !row.rowEvent && (
                        <span className="text-red-500/70 text-[10px] uppercase font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">Violação</span>
                      )}
                      
                      {!row.rowEvent && !row.isAfterGoal && !row.isAfterStop && <span className="text-slate-600">-</span>}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                    <Calendar className="w-8 h-8 opacity-20" />
                    <p>Nenhum trade registrado neste {viewScope === 'period' ? 'Período' : 'Ciclo'}.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <style>{`
        .badge-success { background: rgba(16, 185, 129, 0.1); color: #34d399; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2); font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .badge-warning { background: rgba(245, 158, 11, 0.1); color: #fbbf24; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.2); font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .badge-critical { background: rgba(239, 68, 68, 0.1); color: #f87171; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2); font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .badge-neutral { background: rgba(71, 85, 105, 0.3); color: #94a3b8; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(71, 85, 105, 0.5); font-size: 11px; font-weight: bold; text-transform: uppercase; }
      `}</style>
    </div>
  );
};

export default PlanExtractModal;