/**
 * FeedbackPage
 * @description Página de feedback entre mentor e aluno
 *   Suporta modo standalone (tela cheia) e embedded (dentro de master-detail)
 * @see version.js para versão do produto
 * 
 * CHANGELOG:
 * - 1.4.0: Prop embedded para uso dentro de StudentFeedbackPage master-detail
 *   - embedded=true: sem padding, sem header, sem botão voltar, layout vertical
 *   - embedded=false (default): comportamento original (tela cheia, 2 colunas)
 *   - DebugBadge apenas no modo standalone
 * - 1.3.0: UX do aluno com 2 botões de ação separados
 * 
 * MÁQUINA DE ESTADOS:
 * OPEN → Mentor dá feedback → REVIEWED
 * REVIEWED → Aluno encerra → CLOSED
 * REVIEWED → Aluno pergunta → QUESTION  
 * QUESTION → Mentor responde → REVIEWED
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, Send, HelpCircle, Lock, User, GraduationCap,
  Calendar, TrendingUp, TrendingDown, Clock, AlertCircle,
  BarChart3, Brain, Maximize2, X, CheckCircle, MessageSquare, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DebugBadge from '../components/DebugBadge';

// Helpers locais
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const STATUS = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED', 
  QUESTION: 'QUESTION',
  CLOSED: 'CLOSED'
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge = ({ status }) => {
  const config = {
    OPEN: { label: 'Aguardando Revisão', icon: Clock, bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    REVIEWED: { label: 'Revisado', icon: CheckCircle, bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    QUESTION: { label: 'Dúvida Pendente', icon: HelpCircle, bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    CLOSED: { label: 'Encerrado', icon: Lock, bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' }
  };
  const cfg = config[status] || config.OPEN;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      <Icon className="w-4 h-4" />{cfg.label}
    </span>
  );
};

const TradeInfoCard = ({ trade, onImageClick }) => {
  const isWin = trade.result >= 0;
  const notes = trade.notes || trade.observation || trade.comment || trade.observacao || '';
  
  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${isWin ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            {isWin ? <TrendingUp className="w-6 h-6 text-emerald-400" /> : <TrendingDown className="w-6 h-6 text-red-400" />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{trade.ticker}</h2>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{trade.side}</span>
              {trade.exchange && <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">{trade.exchange}</span>}
            </div>
            <p className="text-slate-400 mt-1">{trade.studentName || trade.studentEmail?.split('@')[0]}</p>
          </div>
        </div>
        <p className={`text-2xl font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>{isWin ? '+' : ''}{formatCurrency(trade.result)}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1"><Calendar className="w-4 h-4" /><span className="text-xs">Data</span></div>
          <p className="text-white font-medium">{formatDate(trade.date)}</p>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1"><BarChart3 className="w-4 h-4" /><span className="text-xs">Setup</span></div>
          <p className="text-white font-medium">{trade.setup || '-'}</p>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1"><Brain className="w-4 h-4" /><span className="text-xs">Emoção Entrada</span></div>
          <p className="text-white font-medium">{trade.emotionEntry || trade.emotion || '-'}</p>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1"><Brain className="w-4 h-4" /><span className="text-xs">Emoção Saída</span></div>
          <p className="text-white font-medium">{trade.emotionExit || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
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

      {notes && (
        <div className="bg-slate-800/30 rounded-xl p-4">
          <span className="text-xs text-slate-500 block mb-2">Observações do Aluno</span>
          <p className="text-slate-300 whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      {(trade.htfUrl || trade.ltfUrl) && (
        <div>
          <span className="text-xs text-slate-500 block mb-3">Gráficos</span>
          <div className="grid grid-cols-2 gap-4">
            {trade.htfUrl && (
              <div className="relative rounded-xl overflow-hidden border border-slate-700/50 cursor-pointer group" onClick={() => onImageClick(trade.htfUrl)}>
                <img src={trade.htfUrl} alt="HTF" className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Maximize2 className="w-6 h-6 text-white" /></div>
                <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded text-white">HTF</span>
              </div>
            )}
            {trade.ltfUrl && (
              <div className="relative rounded-xl overflow-hidden border border-slate-700/50 cursor-pointer group" onClick={() => onImageClick(trade.ltfUrl)}>
                <img src={trade.ltfUrl} alt="LTF" className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Maximize2 className="w-6 h-6 text-white" /></div>
                <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded text-white">LTF</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ChatMessage = ({ message }) => {
  const isFromMentor = message.authorRole === 'mentor';
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className={`flex ${isFromMentor ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] ${isFromMentor ? 'bg-slate-800 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' : 'bg-blue-600/20 border border-blue-500/30 rounded-tl-2xl rounded-bl-2xl rounded-br-2xl'} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          {isFromMentor ? <GraduationCap className="w-4 h-4 text-purple-400" /> : <User className="w-4 h-4 text-blue-400" />}
          <span className={`text-sm font-medium ${isFromMentor ? 'text-purple-400' : 'text-blue-400'}`}>{message.authorName || (isFromMentor ? 'Mentor' : 'Aluno')}</span>
          {message.isQuestion && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Dúvida</span>}
        </div>
        <p className="text-slate-200 whitespace-pre-wrap">{message.content}</p>
        <span className="text-xs text-slate-500 mt-2 block">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const FeedbackPage = ({ trade, onBack, onAddComment, onUpdateStatus, loading = false, embedded = false }) => {
  const { user, isMentor } = useAuth();
  const [comment, setComment] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trade?.feedbackHistory]);

  // Combina mentorFeedback legado com feedbackHistory
  const messages = useMemo(() => {
    const msgs = [];
    const history = trade?.feedbackHistory || [];
    const legacyFeedback = trade?.mentorFeedback;
    
    // Se existe mentorFeedback legado e o history está vazio, adiciona como primeira mensagem
    if (legacyFeedback && history.length === 0) {
      msgs.push({ 
        id: 'legacy_mentor_feedback', 
        authorName: 'Mentor', 
        authorRole: 'mentor', 
        content: legacyFeedback, 
        createdAt: trade.feedbackDate || trade.updatedAt, 
        isQuestion: false 
      });
    }
    
    // Adiciona histórico
    msgs.push(...history);
    
    // Ordena por data
    msgs.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateA - dateB;
    });
    
    return msgs;
  }, [trade?.feedbackHistory, trade?.mentorFeedback, trade?.feedbackDate, trade?.updatedAt]);

  const userIsMentor = isMentor();
  const status = trade?.status || STATUS.OPEN;

  // ========== HANDLERS ==========

  // Mentor envia feedback/resposta
  const handleMentorSend = async () => {
    if (!comment.trim() || sending) return;
    setSending(true);
    try {
      await onAddComment(trade.id, comment, false);
      setComment('');
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setSending(false);
    }
  };

  // Aluno envia DÚVIDA → QUESTION
  const handleStudentQuestion = async () => {
    if (!comment.trim() || sending) return;
    setSending(true);
    try {
      await onAddComment(trade.id, comment, true);
      setComment('');
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setSending(false);
    }
  };

  // Aluno ENCERRA trade (com ou sem comentário)
  const handleStudentClose = async () => {
    if (sending) return;
    setSending(true);
    try {
      // Se tem comentário, adiciona antes de fechar
      if (comment.trim()) {
        await onAddComment(trade.id, comment, false);
      }
      await onUpdateStatus(trade.id, STATUS.CLOSED);
      setComment('');
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setSending(false);
    }
  };

  // Permissões
  const canMentorComment = userIsMentor && (status === STATUS.OPEN || status === STATUS.QUESTION);
  const canStudentAct = !userIsMentor && status === STATUS.REVIEWED;

  const getPlaceholder = () => {
    if (status === STATUS.CLOSED) return 'Trade encerrado';
    if (userIsMentor && status === STATUS.OPEN) return 'Escreva seu feedback...';
    if (userIsMentor && status === STATUS.QUESTION) return 'Responda a dúvida do aluno...';
    if (!userIsMentor && status === STATUS.REVIEWED) return 'Escreva lições aprendidas ou sua dúvida...';
    if (!userIsMentor && status === STATUS.OPEN) return 'Aguardando revisão do mentor...';
    if (!userIsMentor && status === STATUS.QUESTION) return 'Aguardando resposta do mentor...';
    return '';
  };

  const getStatusMessage = () => {
    if (status === STATUS.OPEN && !userIsMentor) return { icon: Clock, text: 'Aguardando o mentor revisar este trade', color: 'text-blue-400' };
    if (status === STATUS.QUESTION && !userIsMentor) return { icon: HelpCircle, text: 'Sua dúvida foi enviada. Aguardando resposta', color: 'text-amber-400' };
    if (status === STATUS.QUESTION && userIsMentor) return { icon: HelpCircle, text: 'O aluno tem uma dúvida', color: 'text-amber-400' };
    return null;
  };
  const statusMessage = getStatusMessage();

  if (!trade) {
    if (embedded) return null;
    return (
      <div className="min-h-screen p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">Trade não encontrado</p>
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Voltar</button>
        </div>
      </div>
    );
  }

  // ========== MODO EMBEDDED (dentro de StudentFeedbackPage master-detail) ==========
  if (embedded) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Info do Trade - compacta */}
        <div className="flex-none overflow-y-auto max-h-[40%] border-b border-slate-800">
          <TradeInfoCard trade={trade} onImageClick={setFullscreenImage} />
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Status Message */}
          {statusMessage && (
            <div className={`flex-none px-4 py-2 bg-slate-800/50 border-b border-slate-800 flex items-center gap-2 ${statusMessage.color}`}>
              <statusMessage.icon className="w-4 h-4" />
              <span className="text-xs">{statusMessage.text}</span>
            </div>
          )}

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Clock className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-slate-400 font-medium">Aguardando primeiro feedback</h3>
              </div>
            ) : (
              messages.map((msg, idx) => <ChatMessage key={msg.id || idx} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {status === STATUS.CLOSED ? (
            <div className="flex-none p-3 border-t border-slate-800 bg-slate-800/30">
              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                <Lock className="w-4 h-4" /><span>Trade encerrado</span>
              </div>
            </div>
          ) : (
            <div className="flex-none p-3 border-t border-slate-800">
              <textarea 
                value={comment} 
                onChange={(e) => setComment(e.target.value)} 
                placeholder={getPlaceholder()} 
                disabled={(!canMentorComment && !canStudentAct) || sending} 
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none disabled:opacity-50 text-sm mb-2"
              />
              
              {canMentorComment && (
                <div className="flex justify-end">
                  <button 
                    onClick={handleMentorSend}
                    disabled={!comment.trim() || sending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {status === STATUS.OPEN ? 'Enviar Feedback' : 'Responder'}
                  </button>
                </div>
              )}
              
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
              
              {!canMentorComment && !canStudentAct && status !== STATUS.CLOSED && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {status === STATUS.OPEN && !userIsMentor && 'Aguarde o mentor revisar'}
                  {status === STATUS.QUESTION && !userIsMentor && 'Aguarde o mentor responder'}
                  {status === STATUS.REVIEWED && userIsMentor && 'Aguardando ação do aluno'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Fullscreen Image (embedded) */}
        {fullscreenImage && (
          <>
            <div className="fixed inset-0 bg-slate-950/95 z-[60] cursor-pointer" onClick={() => setFullscreenImage(null)} />
            <div className="fixed inset-4 z-[61] flex items-center justify-center pointer-events-none">
              <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-xl pointer-events-auto" />
              <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors pointer-events-auto">
                <X className="w-6 h-6" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ========== MODO STANDALONE (tela cheia, original) ==========
  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-blue-400" /> Feedback do Trade
            </h1>
            <p className="text-slate-400 mt-1">{trade.ticker} • {formatDate(trade.date)} • {trade.studentName || trade.studentEmail?.split('@')[0]}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Esquerda - Info do Trade */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <TradeInfoCard trade={trade} onImageClick={setFullscreenImage} />
        </div>

        {/* Coluna Direita - Chat */}
        <div className="glass-card flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
          {/* Header do Chat */}
          <div className="flex-none p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-white">Conversa</span>
              {messages.length > 0 && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{messages.length}</span>}
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className={`flex-none px-4 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center gap-2 ${statusMessage.color}`}>
              <statusMessage.icon className="w-4 h-4" />
              <span className="text-sm">{statusMessage.text}</span>
            </div>
          )}

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Clock className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-slate-400 font-medium">Aguardando primeiro feedback</h3>
              </div>
            ) : (
              messages.map((msg, idx) => <ChatMessage key={msg.id || idx} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Área de Input */}
          {status === STATUS.CLOSED ? (
            <div className="flex-none p-4 border-t border-slate-800 bg-slate-800/30">
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Lock className="w-5 h-5" /><span>Este trade foi encerrado</span>
              </div>
            </div>
          ) : (
            <div className="flex-none p-4 border-t border-slate-800">
              {/* Textarea */}
              <textarea 
                value={comment} 
                onChange={(e) => setComment(e.target.value)} 
                placeholder={getPlaceholder()} 
                disabled={(!canMentorComment && !canStudentAct) || sending} 
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none disabled:opacity-50 mb-3"
              />
              
              {/* MENTOR: botão de enviar */}
              {canMentorComment && (
                <div className="flex justify-end">
                  <button 
                    onClick={handleMentorSend}
                    disabled={!comment.trim() || sending}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {status === STATUS.OPEN ? 'Enviar Feedback' : 'Responder Dúvida'}
                  </button>
                </div>
              )}
              
              {/* ALUNO em REVIEWED: 2 botões lado a lado */}
              {canStudentAct && (
                <div className="flex gap-3">
                  <button 
                    onClick={handleStudentClose}
                    disabled={sending}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Encerrar Trade
                  </button>
                  
                  <button 
                    onClick={handleStudentQuestion}
                    disabled={!comment.trim() || sending}
                    className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4" />}
                    Enviar Dúvida
                  </button>
                </div>
              )}
              
              {/* Mensagem quando não pode agir */}
              {!canMentorComment && !canStudentAct && status !== STATUS.CLOSED && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {status === STATUS.OPEN && !userIsMentor && 'Aguarde o mentor revisar'}
                  {status === STATUS.QUESTION && !userIsMentor && 'Aguarde o mentor responder'}
                  {status === STATUS.REVIEWED && userIsMentor && 'Aguardando ação do aluno'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image */}
      {fullscreenImage && (
        <>
          <div className="fixed inset-0 bg-slate-950/95 z-[60] cursor-pointer" onClick={() => setFullscreenImage(null)} />
          <div className="fixed inset-4 z-[61] flex items-center justify-center pointer-events-none">
            <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-xl pointer-events-auto" />
            <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors pointer-events-auto">
              <X className="w-6 h-6" />
            </button>
          </div>
        </>
      )}

      {/* Debug Badge (apenas standalone) */}
      <DebugBadge component="FeedbackPage" />
    </div>
  );
};

export default FeedbackPage;
