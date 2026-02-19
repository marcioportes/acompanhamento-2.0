/**
 * StudentFeedbackPage
 * @version 1.1.0
 * @description Página de listagem de trades com feedback para o aluno
 * 
 * CHANGELOG:
 * - 1.1.0: UX melhorada - filtros simplificados, layout mais limpo
 * - 1.0.0: Versão inicial
 * 
 * Status de Feedback:
 * - REVIEWED: Trades revisados pelo mentor (pode fazer perguntas)
 * - QUESTION: Dúvidas pendentes (aguardando mentor)
 * - CLOSED: Trades encerrados
 * - OPEN: Aguardando revisão do mentor
 */

import { useState, useMemo } from 'react';
import { 
  MessageSquare, Clock, CheckCircle, HelpCircle, Lock, 
  TrendingUp, TrendingDown, ChevronRight, Search, Filter
} from 'lucide-react';
import { useTrades } from '../hooks/useTrades';
import Loading from '../components/Loading';

// Helpers locais
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const STATUS_CONFIG = {
  QUESTION: { label: 'Dúvida Pendente', icon: HelpCircle, bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', priority: 1 },
  REVIEWED: { label: 'Revisado', icon: CheckCircle, bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', priority: 2 },
  OPEN: { label: 'Aguardando', icon: Clock, bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', priority: 3 },
  CLOSED: { label: 'Encerrado', icon: Lock, bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', priority: 4 }
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const TradeRow = ({ trade, onClick }) => {
  const isWin = trade.result >= 0;
  const hasMessages = (trade.feedbackHistory?.length > 0) || trade.mentorFeedback;
  const messageCount = trade.feedbackHistory?.length || (trade.mentorFeedback ? 1 : 0);
  
  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-4 p-4 hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-800/50 last:border-b-0"
    >
      {/* Indicador de resultado */}
      <div className={`w-1 h-12 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
      
      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{trade.ticker}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {trade.side}
          </span>
          <StatusBadge status={trade.status || 'OPEN'} />
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
          <span>{formatDate(trade.date)}</span>
          <span>•</span>
          <span>{trade.setup || 'Sem setup'}</span>
          {hasMessages && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {messageCount}
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Resultado */}
      <div className="text-right">
        <p className={`font-semibold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
          {isWin ? '+' : ''}{formatCurrency(trade.result)}
        </p>
      </div>
      
      <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
    </div>
  );
};

const StudentFeedbackPage = ({ onNavigateToFeedback }) => {
  const { trades, loading } = useTrades();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Contadores por status
  const counts = useMemo(() => {
    const c = { all: 0, QUESTION: 0, REVIEWED: 0, OPEN: 0, CLOSED: 0 };
    trades.forEach(t => {
      c.all++;
      const status = t.status || 'OPEN';
      if (c[status] !== undefined) c[status]++;
    });
    return c;
  }, [trades]);

  // Filtra e ordena trades
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(t => (t.status || 'OPEN') === statusFilter);
    }
    
    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.ticker?.toLowerCase().includes(term) ||
        t.setup?.toLowerCase().includes(term) ||
        t.mentorFeedback?.toLowerCase().includes(term)
      );
    }
    
    // Ordena: QUESTION primeiro, depois por data
    result.sort((a, b) => {
      const statusA = a.status || 'OPEN';
      const statusB = b.status || 'OPEN';
      const priorityA = STATUS_CONFIG[statusA]?.priority || 99;
      const priorityB = STATUS_CONFIG[statusB]?.priority || 99;
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (b.date || '').localeCompare(a.date || '');
    });
    
    return result;
  }, [trades, statusFilter, searchTerm]);

  const handleTradeClick = (trade) => {
    if (onNavigateToFeedback) {
      onNavigateToFeedback(trade);
    }
  };

  if (loading) return <Loading fullScreen text="Carregando trades..." />;

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-blue-400" />
          Meus Feedbacks
        </h1>
        <p className="text-slate-400 mt-1">
          Acompanhe os feedbacks do seu mentor
        </p>
      </div>

      {/* Resumo compacto */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{counts.QUESTION}</p>
          <p className="text-xs text-slate-500">Dúvidas</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{counts.REVIEWED}</p>
          <p className="text-xs text-slate-500">Revisados</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{counts.OPEN}</p>
          <p className="text-xs text-slate-500">Pendentes</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-2xl font-bold text-slate-400">{counts.CLOSED}</p>
          <p className="text-xs text-slate-500">Encerrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
          />
        </div>
        
        {/* Filtro de status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Todos ({counts.all})</option>
          <option value="QUESTION">Dúvidas ({counts.QUESTION})</option>
          <option value="REVIEWED">Revisados ({counts.REVIEWED})</option>
          <option value="OPEN">Pendentes ({counts.OPEN})</option>
          <option value="CLOSED">Encerrados ({counts.CLOSED})</option>
        </select>
      </div>

      {/* Lista de Trades */}
      <div className="glass-card overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {trades.length === 0 ? 'Nenhum trade encontrado' : 'Nenhum resultado para o filtro'}
            </h3>
            <p className="text-slate-500">
              {trades.length === 0 
                ? 'Registre seus trades para receber feedback do mentor'
                : 'Tente ajustar os filtros'
              }
            </p>
          </div>
        ) : (
          <div>
            {filteredTrades.map(trade => (
              <TradeRow 
                key={trade.id} 
                trade={trade} 
                onClick={() => handleTradeClick(trade)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentFeedbackPage;
