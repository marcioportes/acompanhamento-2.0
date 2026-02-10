/**
 * TradesList
 * @version 3.0.0 (Risk Feedback)
 * @description Lista de trades com indicadores visuais de violação de regras (Risk Guardian).
 * * CHANGE LOG 3.0.0:
 * - FEAT: Adicionado ícone de Alerta (AlertTriangle) para trades com flag 'hasRedFlags'.
 * - UI: Tooltip nativo no ícone mostrando os motivos da violação (array redFlags).
 * - UI: Ajuste de flexbox na célula de resultado para acomodar o ícone sem quebrar layout.
 */

import React from 'react';
import { 
  Eye, 
  Edit2, 
  Trash2, 
  Image as ImageIcon,
  AlertTriangle // [NOVO] Ícone para violações
} from 'lucide-react';

/**
 * Utilitários de formatação inline para evitar erros de importação
 */
const formatCurrency = (value) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatPercent = (value) => 
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(value / 100);

const TradesList = ({ 
  trades = [], 
  onViewTrade, 
  onEditTrade, 
  onDeleteTrade 
}) => {

  const getSideColor = (side) => {
    return side === 'LONG' 
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
      : 'bg-red-500/20 text-red-400 border border-red-500/30';
  };

  const getResultColor = (result) => {
    if (result > 0) return 'text-emerald-400';
    if (result < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
            <th className="p-4 font-bold">Data</th>
            <th className="p-4 font-bold">Ticker</th>
            <th className="p-4 font-bold hidden md:table-cell">Setup</th>
            <th className="p-4 font-bold text-center">Lado</th>
            <th className="p-4 font-bold text-center hidden sm:table-cell">Imagens</th>
            <th className="p-4 font-bold text-right">Resultado</th>
            <th className="p-4 font-bold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50 text-sm">
          {trades.map((trade) => {
            const result = Number(trade.result) || 0;
            const percent = trade.resultPercent || 0;
            
            // Verificação de Violações (Risk Guardian)
            const hasViolations = trade.hasRedFlags || (Array.isArray(trade.redFlags) && trade.redFlags.length > 0);
            
            // Monta texto do tooltip (Lista de erros)
            const violationTooltip = hasViolations && Array.isArray(trade.redFlags) 
              ? trade.redFlags.map(flag => typeof flag === 'string' ? flag : flag.message).join('\n')
              : 'Violação de regras do plano';

            return (
              <tr key={trade.id} className="group hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-medium text-slate-300 whitespace-nowrap">
                  {trade.date ? trade.date.split('-').reverse().join('/') : '-'}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{trade.ticker}</span>
                    <span className="text-[10px] text-slate-500 border border-slate-700 px-1 rounded">
                      {trade.exchange}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-slate-400 hidden md:table-cell">
                  {trade.setup}
                </td>
                <td className="p-4 text-center">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${getSideColor(trade.side)}`}>
                    {trade.side}
                  </span>
                </td>
                <td className="p-4 text-center hidden sm:table-cell">
                  <div className="flex justify-center gap-1">
                    {(trade.htfUrl || trade.ltfUrl) ? (
                      <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center" title="Tem imagem">
                        <ImageIcon className="w-3 h-3 text-slate-500" />
                      </div>
                    ) : <span className="text-slate-600">-</span>}
                  </div>
                </td>
                
                {/* COLUNA DE RESULTADO COM ALERTAS */}
                <td className="p-4 text-right">
                  <div className="flex flex-col items-end">
                    <div className={`font-bold flex items-center gap-1.5 ${getResultColor(result)}`}>
                      {/* Ícone de Alerta Condicional */}
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
                
                {/* AÇÕES COM ÍCONES */}
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => onViewTrade && onViewTrade(trade)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                      title="Ver Detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEditTrade && onEditTrade(trade)}
                      className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if(window.confirm('Excluir este trade?')) onDeleteTrade && onDeleteTrade(trade);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {trades.length === 0 && (
            <tr><td colSpan="7" className="p-8 text-center text-slate-500">Sem registros.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TradesList;