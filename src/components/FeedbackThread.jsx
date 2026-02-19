/**
 * FeedbackThread
 * @version 1.2.1
 * @description Thread de comentários de feedback entre aluno e mentor
 * 
 * CHANGELOG:
 * - 1.2.1: Fix exibição de mentorFeedback legado quando há feedbackHistory
 * - 1.2.0: Versão inicial
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Send, HelpCircle, Lock, User, GraduationCap,
  Calendar, Clock, AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import TradeStatusBadge from './TradeStatusBadge';
import { formatCurrency, formatDate } from '../utils/calculations';

const TRADE_STATUS = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  QUESTION: 'QUESTION',
  CLOSED: 'CLOSED'
};

const FeedbackThread = ({ trade, onAddComment, onCloseTrade, loading, isMentor = false }) => {
  const [comment, setComment] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll para o final quando há novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trade?.feedbackHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    
    await onAddComment(comment, isQuestion);
    setComment('');
    setIsQuestion(false);
  };

  const canComment = trade.status !== TRADE_STATUS.CLOSED;
  const canClose = trade.status === TRADE_STATUS.REVIEWED && !isMentor;
  const canQuestion = trade.status === TRADE_STATUS.REVIEWED && !isMentor;
  const canReply = isMentor && (trade.status === TRADE_STATUS.OPEN || trade.status === TRADE_STATUS.QUESTION);

  // Combina feedbackHistory com mentorFeedback legado
  const messages = [];
  
  // SEMPRE verifica se mentorFeedback existe e não está duplicado no histórico
  if (trade.mentorFeedback) {
    const feedbackHistory = trade.feedbackHistory || [];
    
    // Verifica se já existe no histórico (evita duplicação)
    const legacyExists = feedbackHistory.some(msg => 
      msg.authorRole === 'mentor' && 
      msg.content === trade.mentorFeedback
    );
    
    if (!legacyExists) {
      messages.push({
        id: 'legacy',
        author: 'Mentor',
        authorRole: 'mentor',
        content: trade.mentorFeedback,
        createdAt: trade.feedbackDate || trade.updatedAt,
        status: TRADE_STATUS.REVIEWED
      });
    }
  }
  
  // Adiciona histórico ordenado por data
  if (trade.feedbackHistory && trade.feedbackHistory.length > 0) {
    const sortedHistory = [...trade.feedbackHistory].sort((a, b) => {
      const timeA = a.createdAt?.seconds || new Date(a.createdAt).getTime() / 1000;
      const timeB = b.createdAt?.seconds || new Date(b.createdAt).getTime() / 1000;
      return timeA - timeB;
    });
    messages.push(...sortedHistory);
  }

  return (
    <div className="glass-card flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {/* Header do Trade */}
      <div className="flex-none p-4 border-b border-slate-800">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{trade.ticker}</h2>
              <span className={`text-sm px-2 py-0.5 rounded ${
                trade.side === 'LONG' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {trade.side}
              </span>
              <TradeStatusBadge status={trade.status} />
            </div>
            <p className="text-slate-400 text-sm mt-1">{trade.setup || 'Sem setup'}</p>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold ${
              trade.result >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {formatCurrency(trade.result)}
            </p>
            <p className="text-slate-500 text-sm flex items-center justify-end gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(trade.date)}
            </p>
          </div>
        </div>

        {/* Detalhes do trade */}
        <div className="grid grid-cols-4 gap-4 p-3 bg-slate-800/50 rounded-lg">
          <div>
            <span className="text-xs text-slate-500 block">Entrada</span>
            <span className="text-white font-mono">{trade.entry}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Saída</span>
            <span className="text-white font-mono">{trade.exit}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Quantidade</span>
            <span className="text-white font-mono">{trade.qty}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Emoção</span>
            <span className="text-white">
              {trade.emotionEntry || trade.emotion || '-'}
            </span>
          </div>
        </div>

        {/* Screenshots */}
        {(trade.htfUrl || trade.ltfUrl) && (
          <div className="flex gap-2 mt-3">
            {trade.htfUrl && (
              <a 
                href={trade.htfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 rounded-lg text-sm text-blue-400 hover:bg-slate-700"
              >
                <ImageIcon className="w-4 h-4" />
                HTF
              </a>
            )}
            {trade.ltfUrl && (
              <a 
                href={trade.ltfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 rounded-lg text-sm text-blue-400 hover:bg-slate-700"
              >
                <ImageIcon className="w-4 h-4" />
                LTF
              </a>
            )}
          </div>
        )}

        {/* Notas do trade */}
        {trade.notes && (
          <div className="mt-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <span className="text-xs text-slate-500 block mb-1">Notas do trade:</span>
            <p className="text-slate-300 text-sm">{trade.notes}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Clock className="w-12 h-12 text-slate-700 mb-3" />
            <h3 className="text-slate-400 font-medium">Aguardando feedback</h3>
            <p className="text-slate-500 text-sm">
              {isMentor 
                ? 'Adicione seu feedback para este trade'
                : 'O mentor ainda não comentou este trade'
              }
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMentorMsg = msg.authorRole === 'mentor';
            const time = formatDate(msg.createdAt, "dd/MM/yyyy 'às' HH:mm");
            
            return (
              <div 
                key={msg.id || index}
                className={`flex ${isMentorMsg ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[80%] ${
                  isMentorMsg 
                    ? 'bg-slate-800 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' 
                    : 'bg-blue-600/20 border border-blue-500/30 rounded-tl-2xl rounded-bl-2xl rounded-br-2xl'
                } p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    {isMentorMsg ? (
                      <GraduationCap className="w-4 h-4 text-purple-400" />
                    ) : (
                      <User className="w-4 h-4 text-blue-400" />
                    )}
                    <span className={`text-sm font-medium ${
                      isMentorMsg ? 'text-purple-400' : 'text-blue-400'
                    }`}>
                      {msg.authorName || msg.author?.split('@')[0] || (isMentorMsg ? 'Mentor' : 'Você')}
                    </span>
                    {msg.status === TRADE_STATUS.QUESTION && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                        Dúvida
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-xs text-slate-500 mt-2 block">{time}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {trade.status === TRADE_STATUS.CLOSED ? (
        <div className="flex-none p-4 border-t border-slate-800 bg-slate-800/30">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Lock className="w-5 h-5" />
            <span>Este trade foi encerrado e não aceita mais comentários</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-none p-4 border-t border-slate-800">
          {/* Botões de ação */}
          <div className="flex gap-2 mb-3">
            {canQuestion && (
              <button
                type="button"
                onClick={() => setIsQuestion(!isQuestion)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isQuestion 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                {isQuestion ? 'Marcado como dúvida' : 'Tenho uma dúvida'}
              </button>
            )}
            {canClose && (
              <button
                type="button"
                onClick={onCloseTrade}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ml-auto"
              >
                <Lock className="w-4 h-4" />
                Encerrar Trade
              </button>
            )}
          </div>
          
          {/* Input + Botão Enviar */}
          <div className="flex gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isMentor
                  ? "Escreva seu feedback..."
                  : trade.status === TRADE_STATUS.OPEN 
                    ? "Aguardando feedback do mentor..."
                    : isQuestion 
                      ? "Descreva sua dúvida..." 
                      : "Escreva um comentário..."
              }
              disabled={(!isMentor && trade.status === TRADE_STATUS.OPEN) || loading}
              rows={2}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!comment.trim() || (!isMentor && trade.status === TRADE_STATUS.OPEN) || loading}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[52px]"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          {!isMentor && trade.status === TRADE_STATUS.OPEN && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Você poderá comentar após o mentor revisar o trade
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export default FeedbackThread;
