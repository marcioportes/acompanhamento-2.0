/**
 * StudentFeedbackPage
 * @version 2.0.0
 * @description Página master-detail de feedbacks do aluno
 *   Cards de status + filtros por ticker/período + lista/chat inline
 * 
 * CHANGELOG:
 * - 2.0.0: MAJOR - Layout master-detail em tela única
 *   - Cards clicáveis: Dúvidas, Revisados, Pendentes, Encerrados
 *   - Filtros: ticker (dropdown) + período (seletor) + busca
 *   - Painel esquerdo: lista de trades com highlight no selecionado
 *   - Painel direito: chat de feedback inline (sem navegação externa)
 *   - Self-contained: usa addFeedbackComment/updateTradeStatus diretamente
 *   - Responsive: mobile alterna entre lista e chat
 *   - data-component e data-version para debug
 * - 1.1.0: UX melhorada - filtros simplificados, layout mais limpo
 * - 1.0.0: Versão inicial (lista com navegação)
 * 
 * MÁQUINA DE ESTADOS:
 * OPEN → Mentor dá feedback → REVIEWED
 * REVIEWED → Aluno encerra → CLOSED
 * REVIEWED → Aluno pergunta → QUESTION
 * QUESTION → Mentor responde → REVIEWED
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  MessageSquare, Clock, CheckCircle, HelpCircle, Lock, 
  TrendingUp, TrendingDown, ChevronLeft, Search,
  Send, User, GraduationCap, Calendar, BarChart3, Brain,
  Maximize2, X, Loader2, AlertCircle
} from 'lucide-react';
import { useTrades } from '../hooks/useTrades';
import { useAuth } from '../contexts/AuthContext';
import Loading from '../components/Loading';

// ============================================
// METADATA
// ============================================
const COMPONENT_NAME = 'StudentFeedbackPage';
const COMPONENT_VERSION = '2.0.0';

// ============================================
// CONSTANTS
// ============================================

const STATUS = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  QUESTION: 'QUESTION',
  CLOSED: 'CLOSED'
};

const STATUS_CONFIG = {
  QUESTION: { label: 'Dúvida Pendente', shortLabel: 'Dúvidas', icon: HelpCircle, bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', ring: 'ring-amber-500/50', priority: 1 },
  REVIEWED: { label: 'Revisado', shortLabel: 'Revisados', icon: CheckCircle, bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', ring: 'ring-emerald-500/50', priority: 2 },
  OPEN: { label: 'Aguardando', shortLabel: 'Pendentes', icon: Clock, bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', ring: 'ring-blue-500/50', priority: 3 },
  CLOSED: { label: 'Encerrado', shortLabel: 'Encerrados', icon: Lock, bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', ring: 'ring-slate-500/50', priority: 4 }
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

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() 
      : timestamp.seconds ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/** Filtra trades por período relativo à data atual */
const filterByPeriod = (trades, period) => {
  if (period === 'all') return trades;
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let cutoff;
  switch (period) {
    case 'today':
      cutoff = startOfDay;
      break;
    case 'week':
      cutoff = new Date(startOfDay);
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case 'month':
      cutoff = new Date(startOfDay);
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case 'quarter':
      cutoff = new Date(startOfDay);
      cutoff.setMonth(cutoff.getMonth() - 3);
      break;
    default:
      return trades;
  }
  
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return trades.filter(t => (t.date || '') >= cutoffStr);
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge = ({ status, size = 'sm' }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;
  const Icon = cfg.icon;
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs gap-1' 
    : 'px-3 py-1.5 text-sm gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${cfg.bg} ${cfg.text} ${sizeClasses}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {cfg.label}
    </span>
  );
};

/** Card de status clicável no topo */
const StatusCard = ({ statusKey, count, isActive, onClick }) => {
  const cfg = STATUS_CONFIG[statusKey];
  const Icon = cfg.icon;
  
  return (
    <button
      onClick={onClick}
      className={`glass-card p-3 text-center transition-all hover:scale-[1.02] ${
        isActive ? `ring-1 ${cfg.ring}` : ''
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <Icon className={`w-4 h-4 ${cfg.text}`} />
      </div>
      <p className={`text-2xl font-bold ${cfg.text}`}>{count}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{cfg.shortLabel}</p>
    </button>
  );
};

/** Item da lista de trades no painel esquerdo */
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
          }`}>
            {trade.side}
          </span>
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

/** Mensagem individual no chat */
const ChatMessage = ({ message }) => {
  const isFromMentor = message.authorRole === 'mentor';
  
  return (
    <div className={`flex ${isFromMentor ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] ${
        isFromMentor 
          ? 'bg-slate-800 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' 
          : 'bg-blue-600/20 border border-blue-500/30 rounded-tl-2xl rounded-bl-2xl rounded-br-2xl'
      } p-3`}>
        <div className="flex items-center gap-2 mb-1">
          {isFromMentor 
            ? <GraduationCap className="w-3.5 h-3.5 text-purple-400" /> 
            : <User className="w-3.5 h-3.5 text-blue-400" />
          }
          <span className={`text-xs font-medium ${isFromMentor ? 'text-purple-400' : 'text-blue-400'}`}>
            {message.authorName || (isFromMentor ? 'Mentor' : 'Você')}
          </span>
          {message.isQuestion && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full">Dúvida</span>
          )}
        </div>
        <p className="text-slate-200 whitespace-pre-wrap text-sm">{message.content}</p>
        <span className="text-[10px] text-slate-500 mt-1.5 block">{formatTimestamp(message.createdAt)}</span>
      </div>
    </div>
  );
};

/** Header de informações do trade no painel direito */
const TradeInfoHeader = ({ trade, onImageClick }) => {
  const isWin = trade.result >= 0;
  const notes = trade.notes || trade.observation || trade.comment || trade.observacao || '';
  
  return (
    <div className="p-4 border-b border-slate-800 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isWin ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            {isWin ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{trade.ticker}</h3>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>{trade.side}</span>
              <StatusBadge status={trade.status || 'OPEN'} size="md" />
            </div>
            <p className="text-slate-500 text-xs mt-0.5">{formatDateShort(trade.date)} • {trade.setup || 'Sem setup'}</p>
          </div>
        </div>
        <p className={`text-lg font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
          {isWin ? '+' : ''}{formatCurrency(trade.result)}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Entrada', value: trade.entry, mono: true },
          { label: 'Saída', value: trade.exit, mono: true },
          { label: 'Qtd', value: trade.qty, mono: true },
          { label: 'Emoção', value: trade.emotionEntry || trade.emotion || '-' },
        ].map(({ label, value, mono }) => (
          <div key={label} className="bg-slate-800/40 rounded-lg p-2 text-center">
            <span className="text-[10px] text-slate-500 block">{label}</span>
            <span className={`text-white text-sm ${mono ? 'font-mono' : ''}`}>{value}</span>
          </div>
        ))}
      </div>

      {(trade.htfUrl || trade.ltfUrl) && (
        <div className="flex gap-2">
          {trade.htfUrl && (
            <div 
              className="relative flex-1 rounded-lg overflow-hidden border border-slate-700/50 cursor-pointer group h-20" 
              onClick={() => onImageClick(trade.htfUrl)}
            >
              <img src={trade.htfUrl} alt="HTF" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white">HTF</span>
            </div>
          )}
          {trade.ltfUrl && (
            <div 
              className="relative flex-1 rounded-lg overflow-hidden border border-slate-700/50 cursor-pointer group h-20" 
              onClick={() => onImageClick(trade.ltfUrl)}
            >
              <img src={trade.ltfUrl} alt="LTF" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white">LTF</span>
            </div>
          )}
        </div>
      )}

      {notes && (
        <div className="bg-slate-800/30 rounded-lg p-2 border border-slate-700/30">
          <span className="text-[10px] text-slate-500 block mb-1">Observações</span>
          <p className="text-slate-300 text-xs whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const StudentFeedbackPage = () => {
  const { user } = useAuth();
  const { trades, addFeedbackComment, updateTradeStatus, loading } = useTrades();
  
  // Estado
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Scroll ao mudar mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTrade?.feedbackHistory]);

  // Sincroniza trade selecionado com dados atualizados do listener
  const currentTrade = useMemo(() => {
    if (!selectedTrade) return null;
    return trades.find(t => t.id === selectedTrade.id) || selectedTrade;
  }, [selectedTrade, trades]);

  // Lista de tickers únicos para o dropdown
  const availableTickers = useMemo(() => {
    const tickers = new Set(trades.map(t => t.ticker).filter(Boolean));
    return Array.from(tickers).sort();
  }, [trades]);

  // Contadores por status (aplicam filtro de ticker e período, mas NÃO de status)
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
      const status = t.status || 'OPEN';
      if (c[status] !== undefined) c[status]++;
    });
    return c;
  }, [trades, tickerFilter, periodFilter, searchTerm]);

  // Filtra e ordena trades
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    if (tickerFilter !== 'all') {
      result = result.filter(t => t.ticker === tickerFilter);
    }
    
    result = filterByPeriod(result, periodFilter);
    
    if (statusFilter !== 'all') {
      result = result.filter(t => (t.status || 'OPEN') === statusFilter);
    }
    
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

  // Monta mensagens do chat (legado + history)
  const messages = useMemo(() => {
    if (!currentTrade) return [];
    const msgs = [];
    const history = currentTrade.feedbackHistory || [];
    
    if (currentTrade.mentorFeedback) {
      const legacyExists = history.some(msg => 
        msg.authorRole === 'mentor' && msg.content === currentTrade.mentorFeedback
      );
      if (!legacyExists) {
        msgs.push({
          id: 'legacy_mentor_feedback',
          authorName: 'Mentor',
          authorRole: 'mentor',
          content: currentTrade.mentorFeedback,
          createdAt: currentTrade.feedbackDate || currentTrade.updatedAt,
          isQuestion: false
        });
      }
    }
    
    msgs.push(...history);
    msgs.sort((a, b) => {
      const tA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt || 0).getTime() / 1000;
      const tB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt || 0).getTime() / 1000;
      return tA - tB;
    });
    
    return msgs;
  }, [currentTrade]);

  // Permissões
  const tradeStatus = currentTrade?.status || STATUS.OPEN;
  const canStudentAct = tradeStatus === STATUS.REVIEWED;

  // Handlers
  const handleSelectTrade = (trade) => {
    setSelectedTrade(trade);
    setComment('');
    setMobileShowChat(true);
  };

  const handleBackToList = () => {
    setMobileShowChat(false);
  };

  const handleStatusCardClick = (statusKey) => {
    setStatusFilter(prev => prev === statusKey ? 'all' : statusKey);
  };

  const handleStudentClose = async () => {
    if (!currentTrade || sending) return;
    setSending(true);
    try {
      if (comment.trim()) {
        await addFeedbackComment(currentTrade.id, comment, false);
      }
      await updateTradeStatus(currentTrade.id, STATUS.CLOSED);
      setComment('');
    } catch (err) {
      console.error('Erro ao encerrar:', err);
    } finally {
      setSending(false);
    }
  };

  const handleStudentQuestion = async () => {
    if (!currentTrade || !comment.trim() || sending) return;
    setSending(true);
    try {
      await addFeedbackComment(currentTrade.id, comment, true);
      setComment('');
    } catch (err) {
      console.error('Erro ao enviar dúvida:', err);
    } finally {
      setSending(false);
    }
  };

  const getPlaceholder = () => {
    if (tradeStatus === STATUS.CLOSED) return 'Trade encerrado';
    if (tradeStatus === STATUS.REVIEWED) return 'Escreva lições aprendidas ou sua dúvida...';
    if (tradeStatus === STATUS.OPEN) return 'Aguardando revisão do mentor...';
    if (tradeStatus === STATUS.QUESTION) return 'Aguardando resposta do mentor...';
    return '';
  };

  const getStatusMessage = () => {
    if (tradeStatus === STATUS.OPEN) return { icon: Clock, text: 'Aguardando o mentor revisar este trade', color: 'text-blue-400' };
    if (tradeStatus === STATUS.QUESTION) return { icon: HelpCircle, text: 'Sua dúvida foi enviada. Aguardando resposta', color: 'text-amber-400' };
    return null;
  };

  if (loading) return <Loading fullScreen text="Carregando trades..." />;

  const statusMessage = currentTrade ? getStatusMessage() : null;
  const hasActiveFilters = tickerFilter !== 'all' || periodFilter !== 'all' || statusFilter !== 'all' || searchTerm;

  return (
    <div 
      data-component={COMPONENT_NAME} 
      data-version={COMPONENT_VERSION} 
      className="h-[calc(100vh-0px)] flex flex-col"
    >
      {/* Header fixo */}
      <div className="flex-none p-4 pb-0 lg:p-6 lg:pb-0">
        <div className="mb-4">
          <h1 className="text-xl lg:text-2xl font-display font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-400" />
            Meus Feedbacks
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Acompanhe os feedbacks do seu mentor</p>
        </div>

        {/* Cards de status */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(['QUESTION', 'REVIEWED', 'OPEN', 'CLOSED']).map(key => (
            <StatusCard
              key={key}
              statusKey={key}
              count={counts[key]}
              isActive={statusFilter === key}
              onClick={() => handleStatusCardClick(key)}
            />
          ))}
        </div>

        {/* Filtros: ticker + período + busca */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <select
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos os ativos</option>
            {availableTickers.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
          >
            {PERIOD_OPTIONS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[150px] max-w-[250px]">
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
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Master-Detail */}
      <div className="flex-1 flex min-h-0 px-4 pb-4 lg:px-6 lg:pb-6 gap-4">
        
        {/* ========== PAINEL ESQUERDO - Lista ========== */}
        <div className={`w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col glass-card overflow-hidden ${
          mobileShowChat ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="flex-none px-3 py-2 border-b border-slate-800 text-xs text-slate-500">
            {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' && ` • ${STATUS_CONFIG[statusFilter]?.shortLabel}`}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredTrades.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">
                  {trades.length === 0 ? 'Nenhum trade encontrado' : 'Nenhum resultado para o filtro'}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  {trades.length === 0 ? 'Registre seus trades para receber feedback' : 'Ajuste os filtros'}
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

        {/* ========== PAINEL DIREITO - Chat ========== */}
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
              <div className="flex-none lg:hidden p-3 border-b border-slate-800">
                <button 
                  onClick={handleBackToList}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Voltar para lista
                </button>
              </div>

              <TradeInfoHeader trade={currentTrade} onImageClick={setFullscreenImage} />

              {statusMessage && (
                <div className={`flex-none px-4 py-2 bg-slate-800/50 border-b border-slate-800 flex items-center gap-2 ${statusMessage.color}`}>
                  <statusMessage.icon className="w-4 h-4" />
                  <span className="text-xs">{statusMessage.text}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Clock className="w-10 h-10 text-slate-700 mb-2" />
                    <p className="text-slate-500 text-sm">Aguardando primeiro feedback do mentor</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => <ChatMessage key={msg.id || idx} message={msg} />)
                )}
                <div ref={messagesEndRef} />
              </div>

              {tradeStatus === STATUS.CLOSED ? (
                <div className="flex-none p-3 border-t border-slate-800 bg-slate-800/30">
                  <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                    <Lock className="w-4 h-4" />
                    <span>Trade encerrado</span>
                  </div>
                </div>
              ) : (
                <div className="flex-none p-3 border-t border-slate-800">
                  <textarea 
                    value={comment} 
                    onChange={(e) => setComment(e.target.value)} 
                    placeholder={getPlaceholder()} 
                    disabled={!canStudentAct || sending} 
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none disabled:opacity-50 text-sm mb-2"
                  />
                  
                  {canStudentAct && (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleStudentClose}
                        disabled={sending}
                        className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Encerrar Trade
                      </button>
                      <button 
                        onClick={handleStudentQuestion}
                        disabled={!comment.trim() || sending}
                        className="flex-1 px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4" />}
                        Enviar Dúvida
                      </button>
                    </div>
                  )}
                  
                  {!canStudentAct && tradeStatus !== STATUS.CLOSED && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {tradeStatus === STATUS.OPEN && 'Aguarde o mentor revisar'}
                      {tradeStatus === STATUS.QUESTION && 'Aguarde o mentor responder sua dúvida'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <>
          <div className="fixed inset-0 bg-slate-950/95 z-[60] cursor-pointer" onClick={() => setFullscreenImage(null)} />
          <div className="fixed inset-4 z-[61] flex items-center justify-center pointer-events-none">
            <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-xl pointer-events-auto" />
            <button 
              onClick={() => setFullscreenImage(null)} 
              className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors pointer-events-auto"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentFeedbackPage;
