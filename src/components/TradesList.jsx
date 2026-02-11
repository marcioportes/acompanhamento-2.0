/**
 * TradesList
 * @version 3.1.0 (Strict View Mode)
 * @description Componente de apresentação (Dumb Component) responsável por listar os trades.
 * * ARQUITETURA:
 * Este componente NÃO realiza cálculos matemáticos (ex: (saída - entrada) * qtd).
 * Ele segue o padrão "Single Source of Truth", exibindo estritamente o que está gravado
 * no campo 'result' do banco de dados (Firestore).
 * * * CHANGE LOG 3.1.0:
 * - DOCS: Adicionados comentários explicativos sobre a origem dos dados financeiro.
 * - FIX: Tratamento defensivo para valores nulos/undefined em result e percent.
 * - UI: Mantida a lógica do Risk Guardian (Alertas visuais de violação de regras).
 */

import React from 'react';
import { 
  Eye, 
  Edit2, 
  Trash2, 
  Image as ImageIcon,
  AlertTriangle 
} from 'lucide-react';

/**
 * Formatadores Visuais (Helpers)
 * Isolados para garantir consistência em toda a lista.
 */
const formatCurrency = (value) => {
  // Garante que value seja um número, fallback para 0
  const safeValue = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeValue);
};

const formatPercent = (value) => {
  const safeValue = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(safeValue / 100);
};

const TradesList = ({ 
  trades = [], 
  onViewTrade, 
  onEditTrade, 
  onDeleteTrade 
}) => {

  // Helper de Estilo: Cores para LONG/SHORT
  const getSideColor = (side) => {
    return side === 'LONG' 
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
      : 'bg-red-500/20 text-red-400 border border-red-500/30';
  };

  // Helper de Estilo: Cores para GAIN/LOSS
  const getResultColor = (result) => {
    if (result > 0) return 'text-emerald-400'; // Gain
    if (result < 0) return 'text-red-400';     // Loss
    return 'text-slate-400';                   // Breakeven / Zero
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        {/* CABEÇALHO */}
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

        {/* CORPO DA TABELA */}
        <tbody className="divide-y divide-slate-800/50 text-sm">
          {trades.map((trade) => {
            // [CRÍTICO] Leitura direta do Banco de Dados. Sem recálculos.
            const result = Number(trade.result) || 0;
            const percent = Number(trade.resultPercent) || 0;
            
            // Lógica do Risk Guardian: Verifica se o trade violou regras do plano
            const hasViolations = trade.hasRedFlags || (Array.isArray(trade.redFlags) && trade.redFlags.length > 0);
            
            // Tooltip com motivos da violação
            const violationTooltip = hasViolations && Array.isArray(trade.redFlags) 
              ? trade.redFlags.map(flag => typeof flag === 'string' ? flag : flag.message).join('\n')
              : 'Violação de regras do plano';

            return (
              <tr key={trade.id} className="group hover:bg-slate-800/30 transition-colors">
                {/* DATA */}
                <td className="p-4 font-medium text-slate-300 whitespace-nowrap">
                  {trade.date ? trade.date.split('-').reverse().join('/') : '-'}
                </td>

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
                      {/* Ícone de Alerta (Se houver violação) */}
                      {hasViolations && (
                        <AlertTriangle 
                          className="w-4 h-4 text-amber-500 cursor-help animate-pulse" 
                          title={violationTooltip} 
                        />
                      )}
                      {/* Valor Monetário */}
                      <span>
                        {result > 0 ? '+' : ''}{formatCurrency(result)}
                      </span>
                    </div>
                    {/* Valor Percentual */}
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
                    <button 
                      onClick={() => onEditTrade && onEditTrade(trade)}
                      className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if(window.confirm('Tem certeza que deseja excluir este trade? A ação não pode ser desfeita.')) {
                          onDeleteTrade && onDeleteTrade(trade);
                        }
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
          
          {/* ESTADO VAZIO */}
          {trades.length === 0 && (
            <tr>
              <td colSpan="7" className="p-12 text-center text-slate-500">
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