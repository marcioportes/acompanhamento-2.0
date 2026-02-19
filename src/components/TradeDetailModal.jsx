/**
 * TradeDetailModal
 * @version 1.3.2
 * @description Modal de detalhes do trade com navegação para histórico de feedback
 * * CHANGELOG:
 * - 1.3.2: Botão "Ver conversa completa" sempre visível para permitir início de interação
 * - 1.3.1: Fix erro "Objects are not valid as React child" - formatDate trata Timestamp Firebase
 * - 1.3.0: Fix visualização de mensagens, botão "Ver conversa" sempre visível quando há feedback
 * - 1.2.1: Fix Timestamp display, modal size aumentado
 * - 1.2.0: Adicionado botão "Ver histórico" e callback onViewFeedbackHistory
 */

import { useState } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  BarChart3,
  Brain,
  MessageSquare,
  Maximize2,
  Send,
  Loader2,
  Clock,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  Lock
} from 'lucide-react';

// Helpers locais para evitar dependências quebradas
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Fix: Trata strings, objetos Timestamp do Firebase, e Date
const formatDate = (dateInput) => {
  if (!dateInput) return '-';
  try {
    // Se é objeto Timestamp do Firebase (tem seconds e nanoseconds)
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      const date = new Date(dateInput.seconds * 1000);
      return date.toLocaleDateString('pt-BR');
    }
    // Se é objeto Date
    if (dateInput instanceof Date) {
      return dateInput.toLocaleDateString('pt-BR');
    }
    // Se é string no formato ISO ou YYYY-MM-DD
    if (typeof dateInput === 'string') {
      if (dateInput.includes('-')) {
        const [year, month, day] = dateInput.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
      }
      return dateInput;
    }
    return String(dateInput);
  } catch {
    return '-';
  }
};

// Badge de status inline
const StatusBadge = ({ status }) => {
  const config = {
    OPEN: { label: 'Aguardando', icon: Clock, bg: 'bg-blue-500/20', text: 'text-blue-400' },
    REVIEWED: { label: 'Revisado', icon: CheckCircle, bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    QUESTION: { label: 'Dúvida', icon: HelpCircle, bg: 'bg-amber-500/20', text: 'text-amber-400' },
    CLOSED: { label: 'Encerrado', icon: Lock, bg: 'bg-purple-500/20', text: 'text-purple-400' }
  };

  const cfg = config[status] || config.OPEN;
  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const TradeDetailModal = ({ 
  isOpen, 
  onClose, 
  trade, 
  isMentor = false,
  onAddFeedback,
  feedbackLoading = false,
  onViewFeedbackHistory
}) => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  if (!isOpen || !trade) return null;

  const isWin = trade.result >= 0;
  
  // Calcula quantidade de mensagens
  const feedbackHistoryCount = (trade.feedbackHistory || []).length;
  const hasLegacyFeedback = !!trade.mentorFeedback;
  const totalMessageCount = feedbackHistoryCount || (hasLegacyFeedback ? 1 : 0);
  
  // AVISO: hasFeedback removido da condição de exibição do botão para permitir interação inicial
  // const hasFeedback = totalMessageCount > 0;

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;
    
    try {
      await onAddFeedback(trade.id, feedback);
      setFeedback('');
      setShowFeedbackInput(false);
    } catch (err) {
      console.error('Error adding feedback:', err);
    }
  };

  const handleViewHistory = () => {
    if (onViewFeedbackHistory) {
      onViewFeedbackHistory(trade);
      onClose();
    }
  };

  // Campo de notas/observações
  const notes = trade.notes || trade.observation || trade.comment || trade.observacao || '';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex items-center justify-center pointer-events-none">
        <div className="glass-card w-full max-w-5xl max-h-full overflow-hidden pointer-events-auto flex flex-col">
          {/* Header */}
          <div className={`flex-none flex items-center justify-between p-6 border-b ${
            isWin ? 'border-emerald-500/20' : 'border-red-500/20'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                isWin ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}>
                {isWin ? (
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-display font-bold text-white">
                    {trade.ticker}
                  </h2>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    trade.side === 'LONG' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {trade.side}
                  </span>
                  {trade.exchange && (
                    <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-lg">
                      {trade.exchange}
                    </span>
                  )}
                  <StatusBadge status={trade.status} />
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {trade.studentName || trade.studentEmail?.split('@')[0]}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`text-2xl font-display font-bold ${
                  isWin ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {isWin ? '+' : ''}{formatCurrency(trade.result)}
                </p>
                <p className={`text-sm ${
                  isWin ? 'text-emerald-400/70' : 'text-red-400/70'
                }`}>
                  {formatPercent(trade.resultPercent)}
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content - Scroll */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Detalhes Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Data</span>
                </div>
                <p className="text-white font-medium">{formatDate(trade.date)}</p>
              </div>
              
              <div className="bg-slate-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-xs">Setup</span>
                </div>
                <p className="text-white font-medium">{trade.setup || '-'}</p>
              </div>
              
              <div className="bg-slate-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Brain className="w-4 h-4" />
                  <span className="text-xs">Emoção Entrada</span>
                </div>
                <p className="text-white font-medium">
                  {trade.emotionEntry || trade.emotion || '-'}
                </p>
              </div>
              
              <div className="bg-slate-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Brain className="w-4 h-4" />
                  <span className="text-xs">Emoção Saída</span>
                </div>
                <p className="text-white font-medium">
                  {trade.emotionExit || '-'}
                </p>
              </div>
            </div>

            {/* Preços */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-500 block mb-1">Entrada</span>
                <span className="text-white font-mono text-lg">{trade.entry}</span>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-500 block mb-1">Saída</span>
                <span className="text-white font-mono text-lg">{trade.exit}</span>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-500 block mb-1">Quantidade</span>
                <span className="text-white font-mono text-lg">{trade.qty}</span>
              </div>
            </div>

            {/* Observações do Aluno */}
            {notes && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-slate-400 mb-3">
                  Observações do Aluno
                </h4>
                <div className="bg-slate-800/30 rounded-xl p-4">
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{notes}</p>
                </div>
              </div>
            )}

            {/* Imagens HTF e LTF */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-slate-400 mb-3">
                Gráficos
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {/* HTF */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">
                    HTF (Higher Time Frame)
                  </p>
                  {trade.htfUrl ? (
                    <div 
                      className="relative rounded-xl overflow-hidden border border-slate-700/50 cursor-pointer group"
                      onClick={() => setFullscreenImage(trade.htfUrl)}
                    >
                      <img 
                        src={trade.htfUrl} 
                        alt="HTF" 
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 rounded-xl border border-slate-700/50 bg-slate-800/30 flex items-center justify-center">
                      <p className="text-sm text-slate-600">Sem imagem</p>
                    </div>
                  )}
                </div>

                {/* LTF */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">
                    LTF (Lower Time Frame)
                  </p>
                  {trade.ltfUrl ? (
                    <div 
                      className="relative rounded-xl overflow-hidden border border-slate-700/50 cursor-pointer group"
                      onClick={() => setFullscreenImage(trade.ltfUrl)}
                    >
                      <img 
                        src={trade.ltfUrl} 
                        alt="LTF" 
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 rounded-xl border border-slate-700/50 bg-slate-800/30 flex items-center justify-center">
                      <p className="text-sm text-slate-600">Sem imagem</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Feedback do Mentor */}
            <div className="border-t border-slate-800/50 pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm font-medium">Feedback do Mentor</span>
                  {totalMessageCount > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                      {totalMessageCount} {totalMessageCount === 1 ? 'mensagem' : 'mensagens'}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Botão Ver Conversa - AGORA SEMPRE VISÍVEL se onViewFeedbackHistory existir */}
                  {onViewFeedbackHistory && (
                    <button
                      onClick={handleViewHistory}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver conversa completa
                    </button>
                  )}
                  
                  {isMentor && !trade.mentorFeedback && !showFeedbackInput && (
                    <button
                      onClick={() => setShowFeedbackInput(true)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      + Adicionar Feedback
                    </button>
                  )}
                </div>
              </div>

              {trade.mentorFeedback ? (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-slate-300 text-sm whitespace-pre-wrap line-clamp-3">
                    {trade.mentorFeedback}
                  </p>
                  {trade.feedbackDate && (
                    <p className="text-xs text-slate-500 mt-3">
                      Enviado em {formatDate(trade.feedbackDate)}
                    </p>
                  )}
                  
                  {/* Aviso se há mais mensagens */}
                  {totalMessageCount > 1 && (
                    <p className="text-xs text-blue-400 mt-2">
                      + {totalMessageCount - 1} mensagem(s) adicional(is) na conversa
                    </p>
                  )}
                </div>
              ) : showFeedbackInput && isMentor ? (
                <div className="space-y-3">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Escreva seu feedback para este trade..."
                    rows={4}
                    className="w-full resize-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowFeedbackInput(false);
                        setFeedback('');
                      }}
                      className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                      disabled={feedbackLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                      disabled={!feedback.trim() || feedbackLoading}
                    >
                      {feedbackLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-600">
                    {isMentor 
                      ? 'Nenhum feedback adicionado ainda'
                      : 'O mentor ainda não adicionou feedback para este trade'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <>
          <div 
            className="fixed inset-0 bg-slate-950/95 z-[60] cursor-pointer"
            onClick={() => setFullscreenImage(null)}
          />
          <div className="fixed inset-4 z-[61] flex items-center justify-center pointer-events-none">
            <img 
              src={fullscreenImage} 
              alt="Fullscreen" 
              className="max-w-full max-h-full object-contain rounded-xl pointer-events-auto"
            />
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors pointer-events-auto"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default TradeDetailModal;