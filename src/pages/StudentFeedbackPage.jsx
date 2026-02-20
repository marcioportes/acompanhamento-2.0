/**
 * StudentFeedbackPage
 * @description Página master-detail de feedbacks do aluno
 *   Cards de status + filtros por ticker/período + lista + FeedbackPage embedded
 * @see version.js para versão do produto
 * 
 * CHANGELOG:
 * - 1.4.0: Layout master-detail com FeedbackPage embedded
 *   - Status pills ao lado do título (canto superior esquerdo)
 *   - Proporção 1/3 lista + 2/3 FeedbackPage (2 colunas: info + chat)
 *   - FeedbackPage embedded (reutiliza lógica completa sem duplicação)
 *   - Responsive: mobile alterna entre lista e feedback
 *   - DebugBadge expandível para identificação em produção
 * - 1.3.0: Lista com navegação externa para FeedbackPage
 * 
 * MÁQUINA DE ESTADOS (gerenciada pelo FeedbackPage):
 * OPEN → Mentor dá feedback → REVIEWED
 * REVIEWED → Aluno encerra → CLOSED
 * REVIEWED → Aluno pergunta → QUESTION
 * QUESTION → Mentor responde → REVIEWED
 */

import { useState, useMemo } from 'react';
import { 
  MessageSquare, Clock, CheckCircle, HelpCircle, Lock, 
  ChevronLeft, Search, X
} from 'lucide-react';
import { useTrades } from '../hooks/useTrades';
import { useAuth } from '../contexts/AuthContext';
import FeedbackPage from './FeedbackPage';
import Loading from '../components/Loading';
import DebugBadge from '../components/DebugBadge';

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG = {
  QUESTION: { label: 'Dúvida', shortLabel: 'Dúvidas', icon: HelpCircle, bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/50', priority: 1 },
  REVIEWED: { label: 'Revisado', shortLabel: 'Revisados', icon: CheckCircle, bg: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500/50', priority: 2 },
  OPEN: { label: 'Pendente', shortLabel: 'Pendentes', icon: Clock, bg: 'bg-blue-500/20', text: 'text-blue-400', ring: 'ring-blue-500/50', priority: 3 },
  CLOSED: { label: 'Encerrado', shortLabel: 'Encerrados', icon: Lock, bg: 'bg-slate-500/20', text: 'text-slate-400', ring: 'ring-slate-500/50', priority: 4 }
};

const PERIOD_OPTIONS = [
  { id: 'all', label: 'Todo período' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Última semana' },
  { id: 'month', label: 'Último mês' },
  { id: 'quarter', label: 'Último trimestre' }
];

// ============================================
// HELPERS
// ============================================

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch { return dateStr; }
};

const filterByPeriod = (trades, period) => {
  if (period === 'all') return trades;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let cutoff;
  switch (period) {
    case 'today': cutoff = startOfDay; break;
    case 'week': cutoff = new Date(startOfDay); cutoff.setDate(cutoff.getDate() - 7); break;
    case 'month': cutoff = new Date(startOfDay); cutoff.setMonth(cutoff.getMonth() - 1); break;
    case 'quarter': cutoff = new Date(startOfDay); cutoff.setMonth(cutoff.getMonth() - 3); break;
    default: return trades;
  }
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return trades.filter(t => (t.date || '') >= cutoffStr);
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center rounded-full font-medium px-2 py-0.5 text-xs gap-1 ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

/** Pill de status — ao lado do título, visível e clicável */
const StatusPill = ({ statusKey, count, isActive, onClick }) => {
  const cfg = STATUS_CONFIG[statusKey];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
        isActive 
          ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}` 
          : count > 0
            ? `bg-slate-800/60 ${cfg.text} hover:${cfg.bg}`
            : 'bg-slate-800/40 text-slate-600'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{count}</span>
      <span className="text-xs hidden sm:inline opacity-80">{cfg.shortLabel}</span>
    </button>
  );
};

const TradeListItem = ({ trade, isSelected, onClick }) => {
  const isWin = trade.result >= 0;
  const messageCount = trade.feedbackHistory?.length || (trade.mentorFeedback ? 1 : 0);
  
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 p-3 cursor-pointer transition-all border-l-2 ${
        isSelected 
          ? 'bg-blue-500/10 border-l-blue-500' 
          : 'hover:bg-slate-800/50 border-l-transparent'
      }`}
    >
      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm">{trade.ticker}</span>
          <span className={`text-[10px] px-1 py-0.5 rounded ${
            trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>{trade.side}</span>
          <StatusBadge status={trade.status || 'OPEN'} />
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
          <span>{formatDateShort(trade.date)}</span>
          <span>•</span>
          <span className="truncate">{trade.setup || 'Sem setup'}</span>
          {messageCount > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-0.5">
                <MessageSquare className="w-3 h-3" />
                {messageCount}
              </span>
            </>
          )}
        </div>
      </div>
      <span className={`text-sm font-semibold flex-shrink-0 ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
        {isWin ? '+' : ''}{formatCurrency(trade.result)}
      </span>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const StudentFeedbackPage = () => {
  const { user } = useAuth();
  const { trades, allTrades, addFeedbackComment, updateTradeStatus, loading } = useTrades();
  
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Sincroniza trade selecionado com Firestore listener
  const currentTrade = useMemo(() => {
    if (!selectedTrade) return null;
    return trades.find(t => t.id === selectedTrade.id) || selectedTrade;
  }, [selectedTrade, trades]);

  // Tickers únicos
  const availableTickers = useMemo(() => {
    const tickers = new Set(trades.map(t => t.ticker).filter(Boolean));
    return Array.from(tickers).sort();
  }, [trades]);

  // Contadores (aplicam ticker e período, NÃO status)
  const counts = useMemo(() => {
    let base = [...trades];
    if (tickerFilter !== 'all') base = base.filter(t => t.ticker === tickerFilter);
    base = filterByPeriod(base, periodFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      base = base.filter(t => 
        t.ticker?.toLowerCase().includes(term) ||
        t.setup?.toLowerCase().includes(term) ||
        t.mentorFeedback?.toLowerCase().includes(term)
      );
    }
    const c = { all: base.length, QUESTION: 0, REVIEWED: 0, OPEN: 0, CLOSED: 0 };
    base.forEach(t => {
      const s = t.status || 'OPEN';
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [trades, tickerFilter, periodFilter, searchTerm]);

  // Filtra e ordena
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    if (tickerFilter !== 'all') result = result.filter(t => t.ticker === tickerFilter);
    result = filterByPeriod(result, periodFilter);
    if (statusFilter !== 'all') result = result.filter(t => (t.status || 'OPEN') === statusFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.ticker?.toLowerCase().includes(term) ||
        t.setup?.toLowerCase().includes(term) ||
        t.mentorFeedback?.toLowerCase().includes(term)
      );
    }
    result.sort((a, b) => {
      const pA = STATUS_CONFIG[a.status || 'OPEN']?.priority || 99;
      const pB = STATUS_CONFIG[b.status || 'OPEN']?.priority || 99;
      if (pA !== pB) return pA - pB;
      return (b.date || '').localeCompare(a.date || '');
    });
    return result;
  }, [trades, statusFilter, tickerFilter, periodFilter, searchTerm]);

  // Handlers
  const handleSelectTrade = (trade) => {
    setSelectedTrade(trade);
    setMobileShowChat(true);
  };

  const handleBackToList = () => {
    setMobileShowChat(false);
  };

  const handleStatusCardClick = (statusKey) => {
    setStatusFilter(prev => prev === statusKey ? 'all' : statusKey);
  };

  const handleAddComment = async (tradeId, content, isQuestion) => {
    const updated = await addFeedbackComment(tradeId, content, isQuestion);
    setSelectedTrade(prev => prev ? { ...prev, ...updated, feedbackHistory: updated.feedbackHistory, status: updated.status } : prev);
  };

  const handleUpdateStatus = async (tradeId, newStatus) => {
    await updateTradeStatus(tradeId, newStatus);
    setSelectedTrade(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  if (loading) return <Loading fullScreen text="Carregando trades..." />;

  const hasActiveFilters = tickerFilter !== 'all' || periodFilter !== 'all' || statusFilter !== 'all' || searchTerm;

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col">
      {/* ===== HEADER: Título + Pills à esquerda, Filtros abaixo ===== */}
      <div className="flex-none p-4 lg:p-5 border-b border-slate-800/50">
        {/* Linha 1: Título grande + Status pills */}
        <div className="flex items-center gap-4 mb-3">
          <MessageSquare className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <h1 className="text-lg lg:text-xl font-display font-bold text-white">
            Meus Feedbacks
          </h1>
          <div className="flex items-center gap-1.5 ml-2">
            {(['QUESTION', 'REVIEWED', 'OPEN', 'CLOSED']).map(key => (
              <StatusPill
                key={key}
                statusKey={key}
                count={counts[key]}
                isActive={statusFilter === key}
                onClick={() => handleStatusCardClick(key)}
              />
            ))}
          </div>
        </div>

        {/* Linha 2: Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos os ativos</option>
            {availableTickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
          >
            {PERIOD_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>

          <div className="relative flex-1 min-w-[140px] max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => { setStatusFilter('all'); setTickerFilter('all'); setPeriodFilter('all'); setSearchTerm(''); }}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ===== MASTER-DETAIL: 1/3 lista + 2/3 FeedbackPage (trade info + chat) ===== */}
      <div className="flex-1 flex min-h-0 p-4 lg:p-5 gap-4">
        
        {/* PAINEL ESQUERDO - Lista (1/3) */}
        <div className={`w-full lg:w-1/3 lg:min-w-[280px] lg:max-w-[380px] flex-shrink-0 flex flex-col glass-card overflow-hidden ${
          mobileShowChat ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="flex-none px-3 py-2 border-b border-slate-800 text-xs text-slate-500">
            {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' && ` • ${STATUS_CONFIG[statusFilter]?.shortLabel}`}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredTrades.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">
                  {trades.length === 0 ? 'Nenhum trade encontrado' : 'Nenhum resultado'}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  {trades.length === 0 ? 'Registre trades para receber feedback' : 'Ajuste os filtros'}
                </p>
              </div>
            ) : (
              filteredTrades.map(trade => (
                <TradeListItem
                  key={trade.id}
                  trade={trade}
                  isSelected={currentTrade?.id === trade.id}
                  onClick={() => handleSelectTrade(trade)}
                />
              ))
            )}
          </div>
        </div>

        {/* PAINEL DIREITO - FeedbackPage embedded 2 colunas (2/3) */}
        <div className={`flex-1 flex flex-col glass-card overflow-hidden min-w-0 ${
          !mobileShowChat ? 'hidden lg:flex' : 'flex'
        }`}>
          {!currentTrade ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="w-16 h-16 text-slate-700 mb-4" />
              <h3 className="text-lg font-semibold text-slate-400 mb-2">Selecione um trade</h3>
              <p className="text-slate-600 text-sm max-w-xs">
                Escolha um trade na lista ao lado para ver o feedback e conversar com seu mentor
              </p>
            </div>
          ) : (
            <>
              {/* Botão voltar (mobile) */}
              <div className="flex-none lg:hidden p-3 border-b border-slate-800">
                <button 
                  onClick={handleBackToList}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Voltar para lista
                </button>
              </div>

              {/* FeedbackPage em modo embedded (2 colunas: trade info + chat) */}
              <FeedbackPage
                trade={currentTrade}
                onBack={handleBackToList}
                onAddComment={handleAddComment}
                onUpdateStatus={handleUpdateStatus}
                embedded={true}
              />
            </>
          )}
        </div>
      </div>

      {/* Debug Badge */}
      <DebugBadge component="StudentFeedbackPage" />
    </div>
  );
};

export default StudentFeedbackPage;
