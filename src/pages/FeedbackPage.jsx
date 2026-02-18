/**
 * FeedbackPage
 * @version 1.2.0
 * @description Página de feedback com filtros avançados
 * 
 * CHANGELOG:
 * - 1.2.0: Adicionados filtros por aluno, período e busca (para mentor)
 * - 1.1.0: Filtro de conta (para aluno)
 * - 1.0.0: Versão inicial
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  MessageSquare, CheckCircle, Clock, HelpCircle, Lock,
  ChevronRight, Search, User, Calendar, Filter, X
} from 'lucide-react';
import { useTrades } from '../hooks/useTrades';
import { useAccounts } from '../hooks/useAccounts';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../contexts/AuthContext';
import FeedbackThread from '../components/FeedbackThread';
import TradeStatusBadge from '../components/TradeStatusBadge';
import { formatCurrency, formatDate, filterTradesByPeriod } from '../utils/calculations';

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

const PERIOD_OPTIONS = [
  { id: 'all', label: 'Todo período' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Última semana' },
  { id: 'month', label: 'Último mês' },
  { id: 'quarter', label: 'Último trimestre' }
];

const FeedbackPage = ({ preSelectedTrade = null }) => {
  const { isMentor } = useAuth();
  const { trades, allTrades, loading: tradesLoading, getUniqueStudents } = useTrades();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { addComment, closeTrade, loading: feedbackLoading } = useFeedback();
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState(preSelectedTrade);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filtros avançados (mentor)
  const [studentFilter, setStudentFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  
  // Filtro de conta (aluno)
  const [accountFilter, setAccountFilter] = useState('all');

  // Lista de alunos (para mentor)
  const students = useMemo(() => {
    if (!isMentor()) return [];
    return getUniqueStudents();
  }, [isMentor, getUniqueStudents]);

  // Trades base (depende se é mentor ou aluno)
  const baseTrades = isMentor() ? allTrades : trades;

  // Inicializa filtro de conta para aluno
  useEffect(() => {
    if (!isMentor() && !accountsLoading && accounts.length > 0 && accountFilter === 'all') {
      // Não força nenhuma conta - mostra todos por padrão
    }
  }, [isMentor, accountsLoading, accounts, accountFilter]);

  // Atualiza trade selecionado se vier de props
  useEffect(() => {
    if (preSelectedTrade) {
      setSelectedTrade(preSelectedTrade);
    }
  }, [preSelectedTrade]);

  // Filtra trades
  const filteredTrades = useMemo(() => {
    let result = [...baseTrades];
    
    // Filtro de conta (apenas para aluno)
    if (!isMentor() && accountFilter !== 'all') {
      result = result.filter(t => t.accountId === accountFilter);
    }
    
    // Filtro por aluno (apenas para mentor)
    if (isMentor() && studentFilter !== 'all') {
      result = result.filter(t => t.studentEmail === studentFilter);
    }
    
    // Filtro por período
    if (periodFilter !== 'all') {
      result = filterTradesByPeriod(result, periodFilter);
    }
    
    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    
    // Filtro por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.ticker?.toLowerCase().includes(query) ||
        t.setup?.toLowerCase().includes(query) ||
        t.mentorFeedback?.toLowerCase().includes(query) ||
        t.studentName?.toLowerCase().includes(query)
      );
    }
    
    // Ordena: QUESTION primeiro (urgente), depois OPEN, REVIEWED, CLOSED
    const statusOrder = { QUESTION: 0, OPEN: 1, REVIEWED: 2, CLOSED: 3 };
    result.sort((a, b) => {
      const orderDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (orderDiff !== 0) return orderDiff;
      return (b.date || '').localeCompare(a.date || '');
    });
    
    return result;
  }, [baseTrades, isMentor, accountFilter, studentFilter, periodFilter, statusFilter, searchQuery]);

  // Contadores por status
  const statusCounts = useMemo(() => {
    const counts = { all: baseTrades.length, OPEN: 0, REVIEWED: 0, QUESTION: 0, CLOSED: 0 };
    baseTrades.forEach(t => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });
    return counts;
  }, [baseTrades]);

  // Handler para adicionar comentário/dúvida
  const handleAddComment = async (content, markAsQuestion = false) => {
    if (!selectedTrade) return;
    
    try {
      await addComment(selectedTrade.id, content, markAsQuestion ? TRADE_STATUS.QUESTION : null);
      // Atualiza trade selecionado
      setSelectedTrade(prev => ({ 
        ...prev, 
        status: markAsQuestion ? TRADE_STATUS.QUESTION : (isMentor() ? TRADE_STATUS.REVIEWED : prev.status)
      }));
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
      setSelectedTrade(prev => ({ ...prev, status: TRADE_STATUS.CLOSED }));
    } catch (error) {
      alert('Erro ao encerrar: ' + error.message);
    }
  };

  // Limpar filtros
  const clearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setStudentFilter('all');
    setPeriodFilter('all');
    setAccountFilter('all');
  };

  const hasActiveFilters = statusFilter !== 'all' || searchQuery || studentFilter !== 'all' || periodFilter !== 'all' || accountFilter !== 'all';

  if (tradesLoading || accountsLoading) {
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
          {isMentor() 
            ? 'Gerencie feedbacks e responda dúvidas dos alunos' 
            : 'Acompanhe os comentários do mentor e tire suas dúvidas'
          }
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Lista de Trades */}
        <div className="lg:w-1/2 xl:w-2/5">
          {/* Barra de busca + botão filtros */}
          <div className="glass-card p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={isMentor() ? "Buscar por ticker, aluno, setup..." : "Buscar por ticker, setup..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            {/* Filtros avançados (expandível) */}
            {showFilters && (
              <div className="border-t border-slate-700 pt-4 mb-4 space-y-3">
                {/* Filtro de aluno (mentor) */}
                {isMentor() && students.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Aluno</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <select
                        value={studentFilter}
                        onChange={(e) => setStudentFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm appearance-none cursor-pointer"
                      >
                        <option value="all">Todos os alunos</option>
                        {students.map(s => (
                          <option key={s.email} value={s.email}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Filtro de conta (aluno) */}
                {!isMentor() && accounts.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Conta</label>
                    <select
                      value={accountFilter}
                      onChange={(e) => setAccountFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm appearance-none cursor-pointer"
                    >
                      <option value="all">Todas as contas</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Filtro de período */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Período</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select
                      value={periodFilter}
                      onChange={(e) => setPeriodFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm appearance-none cursor-pointer"
                    >
                      {PERIOD_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Botão limpar filtros */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
            
            {/* Filtros de status */}
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
          <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
            {filteredTrades.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">
                  {hasActiveFilters 
                    ? 'Nenhum trade encontrado com os filtros selecionados'
                    : 'Nenhum trade encontrado'
                  }
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                  >
                    Limpar filtros
                  </button>
                )}
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
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{trade.ticker}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          trade.side === 'LONG' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </div>
                      {/* Nome do aluno (para mentor) */}
                      {isMentor() && (
                        <p className="text-xs text-slate-500 mt-1">
                          {trade.studentName || trade.studentEmail?.split('@')[0]}
                        </p>
                      )}
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
              isMentor={isMentor()}
            />
          ) : (
            <div className="glass-card p-12 text-center sticky top-6">
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
