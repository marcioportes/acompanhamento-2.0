/**
 * TradeDetailModal
 * @version 1.2.0
 * @description Modal de detalhes do trade com link para histórico de feedback
 * 
 * CHANGELOG:
 * - 1.2.0: Adicionado botão "Ver histórico" e callback onViewFeedbackHistory
 * - 1.1.0: Versão anterior
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
  FileText,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  Lock
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '../utils/calculations';

// Badge de status inline
const StatusBadge = ({ status }) => {
  const config = {
    OPEN: { label: 'Aguardando', icon: Clock, bg: 'bg-slate-500/20', text: 'text-slate-400' },
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
  const feedbackCount = (trade.feedbackHistory || []).length;

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

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="modal-content w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="glass-card">
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${
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
                  <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-lg">
                    {trade.exchange}
                  </span>
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
                  {trade.resultPercent >= 0 ? '+' : ''}{formatPercent(trade.resultPercent)}
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

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
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
                <p className="text-white font-medium">{trade.setup}</p>
              </div>
              
              <div className="bg-slate-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Brain className="w-4 h-4" />
                  <span className="text-xs">Emoção</span>
                </div>
                <p className={`font-medium ${
                  trade.emotion === 'Disciplinado' ? 'text-emerald-400' :
                  trade.emotion === 'FOMO' || trade.emotion === 'Ansioso' ? 'text-yellow-400' :
                  'text-white'
                }`}>
                  {trade.emotion}
                </p>
              </div>
              
              <div className="bg-slate-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Registrado</span>
                </div>
                <p className="text-white font-medium text-sm">
                  {trade.createdAt?.toDate 
                    ? formatDate(trade.createdAt.toDate(), "dd/MM HH:mm")
                    : formatDate(trade.createdAt)
                  }
                </p>
              </div>
            </div>

            {/* Preços */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Entrada</p>
                <p className="text-lg font-mono font-semibold text-white">
                  R$ {parseFloat(trade.entry).toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Saída</p>
                <p className="text-lg font-mono font-semibold text-white">
                  R$ {parseFloat(trade.exit).toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Quantidade</p>
                <p className="text-lg font-mono font-semibold text-white">
                  {parseFloat(trade.qty).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Observações */}
            {trade.notes && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Observações do Aluno</span>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4">
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {trade.notes}
                  </p>
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
                  {feedbackCount > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                      {feedbackCount} {feedbackCount === 1 ? 'mensagem' : 'mensagens'}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Botão Ver Histórico */}
                  {feedbackCount > 0 && onViewFeedbackHistory && (
                    <button
                      onClick={handleViewHistory}
                      className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver histórico
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
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {trade.mentorFeedback}
                  </p>
                  {trade.feedbackDate && (
                    <p className="text-xs text-slate-500 mt-3">
                      Enviado em {formatDate(trade.feedbackDate, "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  )}
                  
                  {/* Link para ver histórico completo se houver mais mensagens */}
                  {feedbackCount > 1 && onViewFeedbackHistory && (
                    <button
                      onClick={handleViewHistory}
                      className="mt-3 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver todas as {feedbackCount} mensagens
                    </button>
                  )}
                </div>
              ) : showFeedbackInput && isMentor ? (
                <div className="space-y-3">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Escreva seu feedback para este trade..."
                    rows={4}
                    className="w-full resize-none"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowFeedbackInput(false);
                        setFeedback('');
                      }}
                      className="btn-secondary py-2 px-4"
                      disabled={feedbackLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      className="btn-primary py-2 px-4"
                      disabled={!feedback.trim() || feedbackLoading}
                    >
                      {feedbackLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
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
