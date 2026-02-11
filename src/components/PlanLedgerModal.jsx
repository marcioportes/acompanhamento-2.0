/**
 * PlanLedgerModal
 * @version 1.0.0 (Strict Audit)
 * @description Extrato de auditoria do plano com detecção de eventos de Meta e Stop.
 * * FEATURES:
 * - Auditoria Cronológica: Recalcula o histórico trade a trade.
 * - Detecção de Eventos: Identifica o trade exato da "META!" ou "STOP!".
 * - Trades Zumbis: Marca visualmente trades "PÓS-META" ou "PÓS-STOP" (Ghosting).
 * - UI Parity: Segue o design visual da imagem de referência (image_49b0dd.png).
 */

import React, { useMemo, useState } from 'react';
import { Target, X, Trophy, AlertOctagon, ArrowRight } from 'lucide-react';

// --- HELPERS VISUAIS ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const PlanLedgerModal = ({ plan, trades, onClose }) => {
  if (!plan) return null;

  // Filtros de UI (Preparado para expansão futura, por enquanto fixo em Ciclo Único)
  const [viewMode, setViewMode] = useState('cycle'); // 'cycle' | 'weekly'

  // --- ENGINE DE AUDITORIA (CORE) ---
  const { ledger, auditStatus, metrics } = useMemo(() => {
    // 1. Ordenação Cronológica Obrigatória (Antigo -> Novo)
    const chronoTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

    // 2. Definição de Parâmetros do Plano
    const startBalance = Number(plan.allocatedCapital) || 0;
    const goalTarget = Number(plan.goal) || 0;
    const maxLoss = Number(plan.maxLoss) || (startBalance * 0.10); // Default 10% se não definido
    const stopLine = startBalance - maxLoss;
    const goalLine = startBalance + goalTarget;

    let currentBalance = startBalance;
    let status = 'IN_PROGRESS'; // IN_PROGRESS | PASSED | FAILED
    let eventRowIndex = -1;

    const history = [];

    // 3. Processamento Linha a Linha
    chronoTrades.forEach((trade, index) => {
      const result = Number(trade.result) || 0;
      currentBalance += result;

      let rowEvent = null; // null | 'META_HIT' | 'STOP_HIT' | 'POST_META' | 'POST_STOP'

      // Máquina de Estados
      if (status === 'IN_PROGRESS') {
        if (currentBalance >= goalLine && goalTarget > 0) {
          status = 'PASSED';
          rowEvent = 'META_HIT';
          eventRowIndex = index;
        } else if (currentBalance <= stopLine) {
          status = 'FAILED';
          rowEvent = 'STOP_HIT';
          eventRowIndex = index;
        }
      } else {
        // Se já saiu do estado 'IN_PROGRESS', tudo é "Pós-Evento" (Zumbi)
        rowEvent = status === 'PASSED' ? 'POST_META' : 'POST_STOP';
      }

      history.push({
        ...trade,
        index: index + 1, // # Sequencial
        balanceAfter: currentBalance,
        event: rowEvent
      });
    });

    // 4. Inversão para Exibição (Mais recente no topo)
    // Mantemos a lógica integra, mas o usuário vê o último trade primeiro
    return {
      ledger: history.reverse(),
      auditStatus: status,
      metrics: {
        current: currentBalance,
        goal: goalLine,
        remaining: Math.max(0, goalLine - currentBalance),
        progress: Math.min(100, Math.max(0, ((currentBalance - startBalance) / goalTarget) * 100))
      }
    };
  }, [plan, trades]);

  // --- RENDERIZADORES DE COMPONENTES ---

  const getEventBadge = (evt) => {
    if (evt === 'META_HIT') return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-xs font-bold uppercase tracking-wide">
        <Trophy className="w-3 h-3" /> META!
      </span>
    );
    if (evt === 'STOP_HIT') return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/50 text-xs font-bold uppercase tracking-wide">
        <AlertOctagon className="w-3 h-3" /> STOP!
      </span>
    );
    if (evt === 'POST_META') return (
      <span className="inline-block px-2 py-0.5 rounded border border-amber-500/30 text-amber-500/70 text-[10px] uppercase font-bold">
        Pós-Meta
      </span>
    );
    if (evt === 'POST_STOP') return (
      <span className="inline-block px-2 py-0.5 rounded border border-slate-600 text-slate-500 text-[10px] uppercase font-bold">
        Bloqueado
      </span>
    );
    return <span className="text-slate-600 text-xs">-</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[85vh] rounded-xl flex flex-col shadow-2xl ring-1 ring-white/10">
        
        {/* HEADER: Identidade do Plano */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-none">Extrato: {plan.name}</h2>
                <p className="text-slate-400 text-sm mt-1">Auditoria de Risco & Compliance</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* DASHBOARD DE PROGRESSO (Barra Rica) */}
        <div className="px-8 py-6 bg-slate-800/30 border-b border-slate-800">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-slate-400">Progresso do Alvo</span>
            <span className={`text-sm font-bold uppercase tracking-wider ${
              auditStatus === 'PASSED' ? 'text-emerald-400' : 
              auditStatus === 'FAILED' ? 'text-red-400' : 'text-blue-400'
            }`}>
              {auditStatus === 'PASSED' ? 'Meta Batida' : 
               auditStatus === 'FAILED' ? 'Stop Atingido' : 'Rumo à Meta'}
            </span>
          </div>

          {/* Barra de Progresso */}
          <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700 relative">
            <div 
              className={`h-full transition-all duration-1000 ease-out ${
                auditStatus === 'PASSED' ? 'bg-emerald-500' : 
                auditStatus === 'FAILED' ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${metrics.progress}%` }}
            />
          </div>

          {/* Metricas da Barra */}
          <div className="flex justify-between mt-3 text-sm font-mono">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 uppercase">Atual</span>
              <span className={`font-bold ${metrics.current >= metrics.goal ? 'text-emerald-400' : 'text-white'}`}>
                {formatCurrency(metrics.current)}
              </span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-500 uppercase">Alvo (Meta)</span>
              <span className="text-blue-400 font-bold">{formatCurrency(metrics.goal)}</span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-500 uppercase">Restante</span>
              <span className="text-slate-300 font-bold">{formatCurrency(metrics.remaining)}</span>
            </div>
          </div>
        </div>

        {/* TABELA DE AUDITORIA */}
        <div className="flex-1 overflow-auto bg-slate-900">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-800/80 text-xs uppercase text-slate-500 sticky top-0 backdrop-blur-md z-10 font-bold tracking-wider">
              <tr>
                <th className="p-4 w-16 text-center">#</th>
                <th className="p-4">Data</th>
                <th className="p-4">Ativo</th>
                <th className="p-4 text-right">Resultado</th>
                <th className="p-4 text-right bg-slate-800/50">Acumulado</th>
                <th className="p-4 text-center w-32">Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {ledger.map((row) => {
                // Estilo "Ghost" para trades zumbis
                const isGhost = row.event === 'POST_META' || row.event === 'POST_STOP';
                const isEvent = row.event === 'META_HIT' || row.event === 'STOP_HIT';
                
                return (
                  <tr 
                    key={row.id} 
                    className={`transition-all hover:bg-slate-800/40 ${
                      isGhost ? 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100' : ''
                    } ${
                      isEvent ? 'bg-slate-800/60' : ''
                    }`}
                  >
                    <td className="p-4 text-center text-slate-600 font-mono text-xs">
                      {row.index}
                    </td>
                    <td className="p-4 text-slate-300 font-medium">
                      {formatDate(row.date)}
                      {/* Sublinha setup/hora se quiser detalhar */}
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">{row.setup || '-'}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-white font-bold">{row.ticker}</span>
                      <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded border ${
                        row.side === 'LONG' ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'
                      }`}>
                        {row.side}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-mono font-bold ${
                      (Number(row.result)||0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {(Number(row.result)||0) > 0 ? '+' : ''}{formatCurrency(row.result)}
                    </td>
                    <td className="p-4 text-right font-mono text-white font-bold bg-slate-800/30 border-l border-slate-800">
                      {formatCurrency(row.balanceAfter)}
                    </td>
                    <td className="p-4 text-center align-middle">
                      {getEventBadge(row.event)}
                    </td>
                  </tr>
                );
              })}
              
              {/* Linha Inicial (Fundo da Tabela) */}
              <tr className="bg-slate-800/20 border-t-2 border-slate-800 border-dashed opacity-70">
                <td className="p-4 text-center text-slate-600 font-mono text-xs">0</td>
                <td className="p-4 text-slate-500 italic">Início</td>
                <td className="p-4 text-slate-500 italic">Alocação Inicial</td>
                <td className="p-4 text-right text-slate-600">-</td>
                <td className="p-4 text-right font-mono text-slate-500 italic">
                  {formatCurrency(plan.allocatedCapital)}
                </td>
                <td className="p-4 text-center">
                  <span className="text-[10px] text-slate-600 uppercase font-bold">Start</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlanLedgerModal;