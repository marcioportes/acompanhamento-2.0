/**
 * FeedbackPage
 * @description Página de feedback entre mentor e aluno
 *   Suporta modo standalone (tela cheia) e embedded (dentro de master-detail)
 * @see version.js para versão do produto
 * 
 * CHANGELOG:
 * - 1.13.0: Issue #60 — Imagem no feedback via copy/paste (mentor only)
 *   - Paste handler no textarea intercepta imagem do clipboard
 *   - Preview inline com botão remover
 *   - Upload para Firebase Storage (feedback/{tradeId}/)
 *   - imageUrl salvo no comment do feedbackHistory
 *   - ChatMessage renderiza imagem inline com fullscreen
 * - 1.10.2: TradeInfoCard exibe Stop Loss, RR, Resultado % sobre PL, Red Flags (RO% removido — redundante com RR)
 * - 1.4.0: Prop embedded para uso dentro de StudentFeedbackPage master-detail
 *   - embedded=true: sem padding, sem header, sem botão voltar, grid 2 colunas (info + chat)
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
  Calendar, TrendingUp, TrendingDown, Clock, AlertCircle, AlertTriangle,
  BarChart3, Brain, Maximize2, X, CheckCircle, MessageSquare, Loader2,
  Layers, ArrowDownRight, ArrowUpRight, ImageIcon, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DebugBadge from '../components/DebugBadge';
import TradeStatusBadges from '../components/TradeStatusBadges';
import ShadowBehaviorPanel from '../components/Trades/ShadowBehaviorPanel';
import { useShadowAnalysis } from '../hooks/useShadowAnalysis';

// Helpers locais
const formatCurrency = (value, currency = 'BRL') => {
  if (value === null || value === undefined) return '-';
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'pt-BR', currency: 'USD' },
    EUR: { locale: 'pt-BR', currency: 'EUR' },
    GBP: { locale: 'pt-BR', currency: 'GBP' },
    ARS: { locale: 'pt-BR', currency: 'ARS' }
  };
  const cfg = config[currency] || config.BRL;
  return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-white">{trade.ticker}</h2>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{trade.side}</span>
              {trade.exchange && <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">{trade.exchange}</span>}
              <TradeStatusBadges trade={trade} />
            </div>
            <p className="text-slate-400 mt-1">{trade.studentName || trade.studentEmail?.split('@')[0]}</p>
          </div>
        </div>
        <p className={`text-2xl font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>{isWin ? '+' : ''}{formatCurrency(trade.result, trade.currency)}</p>
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

      {/* Métricas de Risco — Stop, RR, Resultado % PL */}
      {(() => {
        const entry = Number(trade.entry) || 0;
        const exit = Number(trade.exit) || 0;
        const stopLoss = trade.stopLoss != null ? Number(trade.stopLoss) : null;
        const result = Number(trade.result) || 0;
        const tickerRule = trade.tickerRule;
        
        // Calcula risco em pontos/preço
        const riskPts = stopLoss != null && entry ? Math.abs(entry - stopLoss) : null;
        
        // RR Ratio — usa rrRatio salvo, ou calcula via movement/risk
        let rrCalc = null;
        if (stopLoss != null && riskPts > 0) {
          const movePts = trade.side === 'LONG' ? exit - entry : entry - exit;
          rrCalc = movePts / riskPts;
        }
        const rrRatio = trade.rrRatio || trade.rr || rrCalc;
        const isRrAssumed = trade.rrAssumed === true;
        
        // Resultado % sobre PL (usa planPl se disponível via _planPl prop)
        const planPl = Number(trade._planPl) || 0;
        const resultPercentPl = planPl > 0 ? (result / planPl) * 100 : null;
        
        // Verifica se há dados para exibir
        const hasData = stopLoss != null || rrRatio != null || resultPercentPl != null;
        if (!hasData) return null;
        
        return (
          <div className="grid grid-cols-3 gap-3">
            {stopLoss != null && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center">
                <span className="text-[10px] text-red-400/70 uppercase tracking-wider block mb-1">Stop Loss</span>
                <span className="text-red-400 font-mono font-bold">{stopLoss}</span>
                {riskPts != null && (
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {tickerRule ? `${riskPts.toFixed(tickerRule.tickSize < 1 ? 2 : 0)} pts` : `${riskPts.toFixed(2)}`}
                  </span>
                )}
              </div>
            )}
            {rrRatio != null && (
              <div className={`${rrRatio >= 1 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/20'} border rounded-xl p-3 text-center`}>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">RR</span>
                <span className={`font-mono font-bold ${rrRatio >= 1 ? 'text-blue-400' : 'text-amber-400'}`}>{Number(rrRatio).toFixed(2)}:1</span>
                {isRrAssumed && (
                  <span className="text-[9px] text-purple-400/70 block mt-0.5" title="RR calculado sem stop loss, baseado no RO% do plano">(est.)</span>
                )}
              </div>
            )}
            {resultPercentPl != null && (
              <div className={`${resultPercentPl >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'} border rounded-xl p-3 text-center`}>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">% s/ PL</span>
                <span className={`font-mono font-bold ${resultPercentPl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{resultPercentPl >= 0 ? '+' : ''}{resultPercentPl.toFixed(2)}%</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Red Flags — ou indicador de processamento se CF ainda não respondeu */}
      {trade.compliance === undefined && trade.riskPercent === undefined ? (
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-xs text-slate-400">Processando compliance...</span>
        </div>
      ) : trade.redFlags && Array.isArray(trade.redFlags) && trade.redFlags.length > 0 ? (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Violações ({trade.redFlags.length})</span>
          </div>
          <div className="space-y-1">
            {trade.redFlags.map((flag, i) => (
              <p key={i} className="text-xs text-amber-300/80">• {typeof flag === 'string' ? flag : flag.message || flag.rule || 'Violação'}</p>
            ))}
          </div>
        </div>
      ) : null}

      {/* Parciais — exibe quando trade tem dados carregados */}
      {trade._loadedPartials?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Layers className="w-4 h-4" />
            <span className="text-xs font-medium">Parciais</span>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{trade._loadedPartials.length}</span>
          </div>
          <div className="bg-slate-800/30 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[70px_1fr_60px_120px] gap-2 px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
              <span>Tipo</span><span>Preço</span><span>Qtd</span><span>Data/Hora</span>
            </div>
            {[...trade._loadedPartials].sort((a, b) => (a.seq || 0) - (b.seq || 0)).map((p, i) => {
              const label = trade.side === 'LONG'
                ? (p.type === 'ENTRY' ? 'Compra' : 'Venda')
                : (p.type === 'ENTRY' ? 'Venda' : 'Compra');
              return (
                <div key={p.id || i} className="grid grid-cols-[70px_1fr_60px_120px] gap-2 px-3 py-2 items-center border-b border-slate-700/30 last:border-0">
                  <span className={`text-xs font-medium flex items-center gap-1 ${p.type === 'ENTRY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {p.type === 'ENTRY' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                    {label}
                  </span>
                  <span className="text-white font-mono text-xs">{p.price}</span>
                  <span className="text-white font-mono text-xs">{p.qty}</span>
                  <span className="text-slate-400 text-[10px] font-mono">
                    {p.dateTime ? (() => { try { const [d, t] = p.dateTime.split('T'); const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y} ${(t||'').substring(0,5)}`; } catch { return '-'; } })() : '-'}
                  </span>
                </div>
              );
            })}
            {(trade.avgEntry != null || trade.avgExit != null) && (
              <div className="px-3 py-2 bg-slate-800/50 border-t border-slate-700/50 flex flex-wrap gap-3 text-xs">
                {trade.avgEntry != null && <span className="text-slate-400">Média Entrada: <strong className="text-white font-mono">{trade.avgEntry}</strong></span>}
                {trade.avgExit != null && <span className="text-slate-400">Média Saída: <strong className="text-white font-mono">{trade.avgExit}</strong></span>}
                {trade.resultInPoints != null ? <span className="text-slate-400">Pontos: <strong className={`font-mono ${trade.resultInPoints >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.resultInPoints >= 0 ? '+' : ''}{trade.resultInPoints}</strong></span> : trade.resultEdited && <span className="text-slate-500 italic">Pontos: editado</span>}
              </div>
            )}
          </div>
        </div>
      )}

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

const ChatMessage = ({ message, onImageClick }) => {
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
          {message.isBulk && <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded-full">Em massa</span>}
        </div>
        {message.content && <p className="text-slate-200 whitespace-pre-wrap">{message.content}</p>}
        {message.imageUrl && (
          <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-700/50 cursor-pointer group" onClick={() => onImageClick?.(message.imageUrl)}>
            <img src={message.imageUrl} alt="Feedback" className="max-w-full max-h-64 object-contain rounded-xl" />
            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="w-6 h-6 text-white" />
            </div>
          </div>
        )}
        <span className="text-xs text-slate-500 mt-2 block">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const FeedbackPage = ({ trade, onBack, onAddComment, onUpdateStatus, loading = false, embedded = false, getPartials, uploadFeedbackImage }) => {
  const { user, isMentor } = useAuth();
  const [comment, setComment] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // === Image Paste State (mentor only) ===
  const [pastedImage, setPastedImage] = useState(null); // { file: File, preview: string }
  const textareaRef = useRef(null);

  // Parciais são campo _partials no documento do trade — leitura direta
  // Trades legados sem _partials: construir a partir de entry/exit
  const tradeWithPartials = useMemo(() => {
    if (!trade) return null;
    let partials;
    if (trade._partials?.length > 0) {
      partials = [...trade._partials].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    } else if (trade.entry && trade.exit) {
      partials = [
        { type: 'ENTRY', price: trade.entry, qty: trade.qty, dateTime: trade.entryTime, seq: 1 },
        { type: 'EXIT', price: trade.exit, qty: trade.qty, dateTime: trade.exitTime, seq: 2 }
      ];
    } else {
      partials = [];
    }
    return { ...trade, _loadedPartials: partials };
  }, [trade]);

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

  // Shadow analysis — mentor dispara analise do dia do trade (#129)
  const { analyze: analyzeShadow, loading: shadowLoading, error: shadowError } = useShadowAnalysis();
  const [shadowMessage, setShadowMessage] = useState(null);

  const handleAnalyzeShadow = async () => {
    if (!trade?.studentId || !trade?.date) return;
    setShadowMessage(null);
    try {
      const result = await analyzeShadow({
        studentId: trade.studentId,
        dateFrom: trade.date,
        dateTo: trade.date,
      });
      setShadowMessage({ type: 'success', text: `${result.analyzed}/${result.total} trades analisados.` });
      setTimeout(() => setShadowMessage(null), 5000);
    } catch (err) {
      setShadowMessage({ type: 'error', text: err.message || 'Erro ao analisar comportamento.' });
    }
  };

  // ========== HANDLERS ==========

  // Paste handler — intercepta imagem colada no textarea (mentor only)
  const handlePaste = (e) => {
    if (!isMentor()) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        
        // Limite 5MB
        if (file.size > 5 * 1024 * 1024) {
          alert('Imagem muito grande. Máximo 5MB.');
          return;
        }

        const preview = URL.createObjectURL(file);
        setPastedImage({ file, preview });
        return;
      }
    }
  };

  // Limpa preview ao descartar
  const handleRemoveImage = () => {
    if (pastedImage?.preview) URL.revokeObjectURL(pastedImage.preview);
    setPastedImage(null);
  };

  // Mentor envia feedback/resposta (com imagem opcional)
  const handleMentorSend = async () => {
    const hasText = comment.trim().length > 0;
    const hasImage = !!pastedImage?.file;
    if ((!hasText && !hasImage) || sending) return;
    
    setSending(true);
    try {
      let imageUrl = null;
      if (hasImage && uploadFeedbackImage) {
        try {
          imageUrl = await uploadFeedbackImage(pastedImage.file, trade.id);
        } catch (uploadErr) {
          console.error('[FeedbackPage] Upload error:', uploadErr);
          alert('Erro ao enviar imagem. Tente novamente.');
          setSending(false);
          return;
        }
      }
      await onAddComment(trade.id, comment || '', false, imageUrl);
      setComment('');
      handleRemoveImage();
    } catch (err) {
      console.error('[FeedbackPage] Send error:', err);
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
  // Mesmo layout 2 colunas do standalone, sem padding externo, header e botão voltar
  if (embedded) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* Coluna Esquerda - Info do Trade */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <TradeInfoCard trade={tradeWithPartials || trade} onImageClick={setFullscreenImage} />
            {userIsMentor && (
              <div className="mt-3">
                <button
                  onClick={handleAnalyzeShadow}
                  disabled={shadowLoading}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-purple-300 border border-purple-500/30 rounded-lg transition-colors"
                  title="Analisa shadow behavior de todos os trades do aluno no dia deste trade"
                >
                  {shadowLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                  {shadowLoading ? 'Analisando...' : 'Analisar comportamento'}
                </button>
                {shadowMessage && (
                  <div className={`mt-2 text-xs px-2 py-1 rounded ${shadowMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                    {shadowMessage.text}
                  </div>
                )}
              </div>
            )}
            {userIsMentor && trade.shadowBehavior && (
              <ShadowBehaviorPanel trade={trade} isMentor={userIsMentor} embedded />
            )}
          </div>

          {/* Coluna Direita - Chat */}
          <div className="glass-card flex flex-col h-[calc(100vh-260px)] min-h-[400px]">
            {/* Header do Chat */}
            <div className="flex-none p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-white text-sm">Conversa</span>
                {messages.length > 0 && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{messages.length}</span>}
              </div>
              <StatusBadge status={status} />
            </div>

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
                messages.map((msg, idx) => <ChatMessage key={msg.id || idx} message={msg} onImageClick={setFullscreenImage} />)
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
                {/* Image Preview (mentor only, embedded) */}
                {pastedImage && canMentorComment && (
                  <div className="mb-2 relative inline-block">
                    <img src={pastedImage.preview} alt="Preview" className="max-h-24 rounded-lg border border-slate-700" />
                    <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <textarea 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  onPaste={handlePaste}
                  placeholder={canMentorComment ? `${getPlaceholder()} (Ctrl+V para colar imagem)` : getPlaceholder()} 
                  disabled={(!canMentorComment && !canStudentAct) || sending} 
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none disabled:opacity-50 text-sm mb-2"
                />
                
                {canMentorComment && (
                  <div className="flex justify-end">
                    <button 
                      onClick={handleMentorSend}
                      disabled={(!comment.trim() && !pastedImage?.file) || sending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : pastedImage ? <ImageIcon className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      {status === STATUS.OPEN ? 'Enviar Feedback' : 'Responder'}
                      {pastedImage && ' + Img'}
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
          <div className="flex items-center gap-3">
            {userIsMentor && (
              <button
                onClick={handleAnalyzeShadow}
                disabled={shadowLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-purple-300 border border-purple-500/30 rounded-lg transition-colors"
                title="Analisa shadow behavior de todos os trades do aluno no dia deste trade"
              >
                {shadowLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                {shadowLoading ? 'Analisando...' : 'Analisar comportamento'}
              </button>
            )}
            <StatusBadge status={status} />
          </div>
        </div>
        {shadowMessage && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${shadowMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
            {shadowMessage.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Esquerda - Info do Trade */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <TradeInfoCard trade={tradeWithPartials || trade} onImageClick={setFullscreenImage} />
          {userIsMentor && trade.shadowBehavior && (
            <ShadowBehaviorPanel trade={trade} isMentor={userIsMentor} />
          )}
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
              messages.map((msg, idx) => <ChatMessage key={msg.id || idx} message={msg} onImageClick={setFullscreenImage} />)
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
              {/* Image Preview (mentor only) */}
              {pastedImage && canMentorComment && (
                <div className="mb-3 relative inline-block">
                  <img src={pastedImage.preview} alt="Preview" className="max-h-32 rounded-lg border border-slate-700" />
                  <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Textarea */}
              <textarea 
                ref={textareaRef}
                value={comment} 
                onChange={(e) => setComment(e.target.value)} 
                onPaste={handlePaste}
                placeholder={canMentorComment ? `${getPlaceholder()} (Ctrl+V para colar imagem)` : getPlaceholder()} 
                disabled={(!canMentorComment && !canStudentAct) || sending} 
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none disabled:opacity-50 mb-3"
              />
              
              {/* MENTOR: botão de enviar */}
              {canMentorComment && (
                <div className="flex justify-end">
                  <button 
                    onClick={handleMentorSend}
                    disabled={(!comment.trim() && !pastedImage?.file) || sending}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : pastedImage ? <ImageIcon className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {status === STATUS.OPEN ? 'Enviar Feedback' : 'Responder Dúvida'}
                    {pastedImage && ' + Imagem'}
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
