import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MessageSquare, 
  MoreVertical,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Image
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '../utils/calculations';

const TradesList = ({ 
  trades, 
  onViewTrade, 
  onEditTrade, 
  onDeleteTrade,
  showStudent = false,
  itemsPerPage = 10,
  compact = false
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(null);

  const totalPages = Math.ceil(trades.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedTrades = trades.slice(startIndex, startIndex + itemsPerPage);

  const handleDelete = (trade) => {
    if (window.confirm('Tem certeza que deseja excluir este trade?')) {
      onDeleteTrade?.(trade);
    }
    setMenuOpen(null);
  };

  if (trades.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Nenhum trade encontrado</h3>
        <p className="text-slate-500">
          {showStudent 
            ? 'Este aluno ainda não registrou trades' 
            : 'Comece registrando seu primeiro trade!'}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Trades Recentes
          </h3>
          <span className="text-sm text-slate-500">
            {trades.length} trade{trades.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50">
              <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Data
              </th>
              {showStudent && (
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Aluno
                </th>
              )}
              <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ticker
              </th>
              <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Setup
              </th>
              {!compact && (
                <>
                  <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Lado
                  </th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Imagens
                  </th>
                </>
              )}
              <th className="text-right p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Resultado
              </th>
              <th className="text-right p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedTrades.map((trade, index) => (
              <tr 
                key={trade.id} 
                className="table-row"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="p-4">
                  <span className="text-sm text-white">
                    {formatDate(trade.date)}
                  </span>
                </td>
                
                {showStudent && (
                  <td className="p-4">
                    <span className="text-sm text-slate-400">
                      {trade.studentName || trade.studentEmail?.split('@')[0]}
                    </span>
                  </td>
                )}
                
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-white">
                      {trade.ticker}
                    </span>
                    <span className="text-xs text-slate-500">
                      {trade.exchange}
                    </span>
                  </div>
                </td>
                
                <td className="p-4">
                  <span className="text-sm text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg">
                    {trade.setup}
                  </span>
                </td>
                
                {!compact && (
                  <>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        trade.side === 'LONG' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {trade.htfUrl && (
                          <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden">
                            <img 
                              src={trade.htfUrl} 
                              alt="HTF" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {trade.ltfUrl && (
                          <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden">
                            <img 
                              src={trade.ltfUrl} 
                              alt="LTF" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {!trade.htfUrl && !trade.ltfUrl && (
                          <Image className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                    </td>
                  </>
                )}
                
                <td className="p-4 text-right">
                  <div className="flex flex-col items-end">
                    <span className={`font-semibold ${
                      trade.result >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {trade.result >= 0 ? '+' : ''}{formatCurrency(trade.result)}
                    </span>
                    <span className={`text-xs ${
                      trade.resultPercent >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                    }`}>
                      {trade.resultPercent >= 0 ? '+' : ''}{formatPercent(trade.resultPercent)}
                    </span>
                  </div>
                </td>
                
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {trade.mentorFeedback && (
                      <span className="w-2 h-2 rounded-full bg-blue-500" title="Tem feedback" />
                    )}
                    
                    <button
                      onClick={() => onViewTrade?.(trade)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Menu de ações */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === trade.id ? null : trade.id)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {menuOpen === trade.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpen(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl z-20 py-1 min-w-[140px]">
                            {onEditTrade && (
                              <button
                                onClick={() => {
                                  onEditTrade(trade);
                                  setMenuOpen(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </button>
                            )}
                            {onDeleteTrade && (
                              <button
                                onClick={() => handleDelete(trade)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Excluir
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-800/50 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, trades.length)} de {trades.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradesList;
