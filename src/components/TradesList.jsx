/**
 * TradesList
 * @version 1.2.1
 * @description Componente de apresentação (Dumb Component) responsável por listar os trades.
 * * CHANGELOG:
 * - 1.2.1: Default de showStatus alterado para true (Status visível por padrão para todos)
 * - 1.2.0: Adicionado prop showStatus para exibir coluna de status do feedback
 * - 1.1.0: Risk Guardian (Alertas visuais de violação de regras)
 * - 1.0.0: Versão inicial
 * * ARQUITETURA:
 * Este componente NÃO realiza cálculos matemáticos.
 * Ele segue o padrão "Single Source of Truth", exibindo o que está gravado no Firestore.
 */

import React from 'react';
import { 
  Eye, 
  Edit2, 
  Trash2, 
  Image as ImageIcon,
  AlertTriangle,
  Clock,
  CheckCircle,
  HelpCircle,
  Lock
} from 'lucide-react';

/**
 * Formatadores Visuais (Helpers)
 */
const formatCurrency = (value) => {
  const safeValue = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeValue);
};

const formatPercent = (value) => {
  const safeValue = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(safeValue / 100);
};

/**
 * Badge de Status inline
 */
const StatusBadge = ({ status }) => {
  const config = {
    OPEN: { label: 'Aguardando', icon: Clock, bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
    REVIEWED: { label: 'Revisado', icon: CheckCircle, bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    QUESTION: { label: 'Dúvida', icon: HelpCircle, bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', animate: true },
    CLOSED: { label: 'Encerrado', icon: Lock, bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' }
  };

  const normalizedStatus = status || 'OPEN';
  const cfg = config[normalizedStatus] || config.OPEN;
  const Icon = cfg.icon;

  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border
      ${cfg.bg} ${cfg.text} ${cfg.border}
      ${cfg.animate ? 'animate-pulse' : ''}
    `}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const TradesList = ({ 
  trades = [], 
  onViewTrade, 
  onEditTrade, 
  onDeleteTrade,
  showStatus = true, // AGORA É TRUE POR PADRÃO
  showStudent = false
}) => {

  // Helper de Estilo: Cores para LONG/SHORT
  const getSideColor = (side) => {
    return side === 'LONG' 
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
      : 'bg-red-500/20 text-red-400 border border-red-500/30';
  };

  // Helper de Estilo: Cores para GAIN/LOSS
  const getResultColor = (result) => {
    if (result > 0) return 'text-emerald-400';
    if (result < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  // Calcula número de colunas dinâmicas
  const baseColumns = 6; // Data, Ticker, Setup, Lado, Imagens, Resultado, Ações
  const extraColumns = (showStatus ? 1 : 0) + (showStudent ? 1 : 0);

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        {/* CABEÇALHO */}
        <thead>
          <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
            <th className="p-4 font-bold">Data</th>
            {showStudent && <th className="p-4 font-bold">Aluno</th>}
            <th className="p-4 font-bold">Ticker</th>
            <th className="p-4 font-bold hidden md:table-cell">Setup</th>
            <th className="p-4 font-bold text-center">Lado</th>
            {showStatus && <th className="p-4 font-bold text-center">Status</th>}
            <th className="p-4 font-bold text-center hidden sm:table-cell">Imagens</th>
            <th className="p-4 font-bold text-right">Resultado</th>
            <th className="p-4 font-bold text-right">Ações</th>
          </tr>
        </thead>

        {/* CORPO DA TABELA */}
        <tbody className="divide-y divide-slate-800/50 text-sm">
          {trades.map((trade) => {
            const result = Number(trade.result) || 0;
            const percent = Number(trade.resultPercent) || 0;
            
            // Lógica do Risk Guardian
            const hasViolations = trade.hasRedFlags || (Array.isArray(trade.redFlags) && trade.redFlags.length > 0);
            const violationTooltip = hasViolations && Array.isArray(trade.redFlags) 
              ? trade.redFlags.map(flag => typeof flag === 'string' ? flag : flag.message).join('\n')
              : 'Violação de regras do plano';

            return (
              <tr key={trade.id} className="group hover:bg-slate-800/30 transition-colors">
                {/* DATA */}
                <td className="p-4 font-medium text-slate-300 whitespace-nowrap">
                  {trade.date ? trade.date.split('-').reverse().join('/') : '-'}
                </td>

                {/* ALUNO (opcional) */}
                {showStudent && (
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
                        {trade.studentName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="text-slate-400 text-xs truncate max-w-[100px]">
                        {trade.studentName || trade.studentEmail?.split('@')[0] || '-'}
                      </span>
                    </div>
                  </td>
                )}

                {/* TICKER + EXCHANGE */}
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{trade.ticker}</span>
                    {trade.exchange && (
                      <span className="text-[10px] text-slate-500 border border-slate-700 px-1 rounded">
                        {trade.exchange}
                      </span>
                    )}
                  </div>
                </td>

                {/* SETUP (Escondido em Mobile) */}
                <td className="p-4 text-slate-400 hidden md:table-cell">
                  {trade.setup || '-'}
                </td>

                {/* LADO (LONG/SHORT) */}
                <td className="p-4 text-center">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${getSideColor(trade.side)}`}>
                    {trade.side}
                  </span>
                </td>

                {/* STATUS (opcional) */}
                {showStatus && (
                  <td className="p-4 text-center">
                    <StatusBadge status={trade.status} />
                  </td>
                )}

                {/* INDICADOR DE IMAGENS */}
                <td className="p-4 text-center hidden sm:table-cell">
                  <div className="flex justify-center gap-1">
                    {(trade.htfUrl || trade.ltfUrl) ? (
                      <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center" title="Trade possui capturas de tela">
                        <ImageIcon className="w-3 h-3 text-slate-500" />
                      </div>
                    ) : <span className="text-slate-600">-</span>}
                  </div>
                </td>
                
                {/* RESULTADO FINANCEIRO */}
                <td className="p-4 text-right">
                  <div className="flex flex-col items-end">
                    <div className={`font-bold flex items-center gap-1.5 ${getResultColor(result)}`}>
                      {hasViolations && (
                        <AlertTriangle 
                          className="w-4 h-4 text-amber-500 cursor-help animate-pulse" 
                          title={violationTooltip} 
                        />
                      )}
                      <span>
                        {result > 0 ? '+' : ''}{formatCurrency(result)}
                      </span>
                    </div>
                    <div className={`text-xs ${getResultColor(result)} opacity-80`}>
                      {result > 0 ? '+' : ''}{formatPercent(percent)}
                    </div>
                  </div>
                </td>
                
                {/* BOTÕES DE AÇÃO */}
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => onViewTrade && onViewTrade(trade)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                      title="Ver Detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {onEditTrade && (
                      <button 
                        onClick={() => onEditTrade(trade)}
                        className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {onDeleteTrade && (
                      <button 
                        onClick={() => {
                          if(window.confirm('Tem certeza que deseja excluir este trade? A ação não pode ser desfeita.')) {
                            onDeleteTrade(trade);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          
          {/* ESTADO VAZIO */}
          {trades.length === 0 && (
            <tr>
              <td colSpan={baseColumns + extraColumns + 1} className="p-12 text-center text-slate-500">
                Nenhum registro encontrado para os filtros selecionados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TradesList;