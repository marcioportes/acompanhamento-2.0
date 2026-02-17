/**
 * FeedbackPage
 * @version 1.0.0
 * @description Página de feedback do aluno - ver trades revisados e interagir
 */

import { useState, useMemo } from 'react';
import { 
  MessageSquare, CheckCircle, Clock, HelpCircle, Lock,
  ChevronRight, Filter, Search, AlertCircle
} from 'lucide-react';
import { useTrades } from '../hooks/useTrades';
import { useFeedback } from '../hooks/useFeedback';
import FeedbackThread from '../components/FeedbackThread';
import TradeStatusBadge from '../components/TradeStatusBadge';
import { formatCurrency, formatDate } from '../utils/calculations';

const TRADE_STATUS = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  QUESTION: 'QUESTION',
  CLOSED: 'CLOSED'
};

const STATUS_FILTERS = [
  { id: 'all', label: 'Todos', icon: MessageSquare },
  { id: 'OPEN', label: 'Aguardando', icon: Clock },
  { id: 'REVIEWED', label: 'Revisados', icon: CheckCircle },
  { id: 'QUESTION', label: 'Dúvidas', icon: HelpCircle },
  { id: 'CLOSED', label: 'Encerrados', icon: Lock }
];

const FeedbackPage = () => {
  const { trades, loading: tradesLoading } = useTrades();
  const { addComment, closeTrade, loading: feedbackLoading } = useFeedback();
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState(null);

  // Filtra trades por status e busca
  const filteredTrades = useMemo(() => {
    let result = trades;
    
    // Filtra por status
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    
    // Filtra por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.ticker?.toLowerCase().includes(query) ||
        t.setup?.toLowerCase().includes(query) ||
        t.mentorFeedback?.toLowerCase().includes(query)
      );
    }
    
    // Ordena: OPEN primeiro, depois QUESTION, REVIEWED, CLOSED
    const statusOrder = { OPEN: 0, QUESTION: 1, REVIEWED: 2, CLOSED: 3 };
    result.sort((a, b) => {
      const orderDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
      if (orderDiff !== 0) return orderDiff;
      return (b.date || '').localeCompare(a.date || '');
    });
    
    return result;
  }, [trades, statusFilter, searchQuery]);

  // Contadores por status
  const statusCounts = useMemo(() => {
    const counts = { all: trades.length, OPEN: 0, REVIEWED: 0, QUESTION: 0, CLOSED: 0 };
    trades.forEach(t => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });
    return counts;
  }, [trades]);

  // Handler para adicionar comentário/dúvida
  const handleAddComment = async (content, markAsQuestion = false) => {
    if (!selectedTrade) return;
    
    try {
      await addComment(selectedTrade.id, content, markAsQuestion ? TRADE_STATUS.QUESTION : null);
      // Atualiza trade selecionado
      const updatedTrade = { 
        ...selectedTrade, 
        status: markAsQuestion ? TRADE_STATUS.QUESTION : selectedTrade.status 
      };
      setSelectedTrade(updatedTrade);
    } catch (error) {
      alert('Erro ao enviar: ' + error.message);
    }
  };

  // Handler para encerrar trade
  const handleCloseTrade = async () => {
    if (!selectedTrade) return;
    if (!confirm('Encerrar este trade? Esta ação não pode ser desfeita.')) return;
    
    try {
      await closeTrade(selectedTrade.id);
      setSelectedTrade({ ...selectedTrade, status: TRADE_STATUS.CLOSED });
    } catch (error) {
      alert('Erro ao encerrar: ' + error.message);
    }
  };

  if (tradesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-blue-400" />
          Feedback dos Trades
        </h1>
        <p className="text-slate-400 mt-1">
          Acompanhe os comentários do mentor e tire suas dúvidas
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Lista de Trades */}
        <div className="lg:w-1/2 xl:w-2/5">
          {/* Filtros */}
          <div className="glass-card p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por ticker, setup..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(filter => {
                const Icon = filter.icon;
                const count = statusCounts[filter.id];
                const isActive = statusFilter === filter.id;
                
                return (
                  <button
                    key={filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {filter.label}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      isActive ? 'bg-blue-500' : 'bg-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filteredTrades.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">
                  {statusFilter === 'all' 
                    ? 'Nenhum trade encontrado'
                    : `Nenhum trade com status "${STATUS_FILTERS.find(f => f.id === statusFilter)?.label}"`
                  }
                </p>
              </div>
            ) : (
              filteredTrades.map(trade => (
                <button
                  key={trade.id}
                  onClick={() => setSelectedTrade(trade)}
                  className={`w-full glass-card p-4 text-left transition-all hover:border-blue-500/50 ${
                    selectedTrade?.id === trade.id 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-white">{trade.ticker}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        trade.side === 'LONG' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.side}
                      </span>
                    </div>
                    <TradeStatusBadge status={trade.status} />
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{formatDate(trade.date)}</span>
                    <span className={trade.result >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatCurrency(trade.result)}
                    </span>
                  </div>
                  
                  {trade.mentorFeedback && (
                    <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                      💬 {trade.mentorFeedback}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-end mt-2 text-blue-400">
                    <span className="text-xs">Ver detalhes</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread de Feedback */}
        <div className="lg:w-1/2 xl:w-3/5">
          {selectedTrade ? (
            <FeedbackThread
              trade={selectedTrade}
              onAddComment={handleAddComment}
              onCloseTrade={handleCloseTrade}
              loading={feedbackLoading}
            />
          ) : (
            <div className="glass-card p-12 text-center">
              <MessageSquare className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-400 mb-2">
                Selecione um trade
              </h3>
              <p className="text-slate-500 text-sm">
                Clique em um trade na lista para ver os feedbacks e interagir
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
