/**
 * TradeDetailModal
 * @see version.js para versão do produto
 * @description Modal de detalhes do trade com navegação para histórico de feedback e exibição de parciais
 * 
 * CHANGELOG (produto):
 * - 1.10.0: resultPercent exibe % sobre PL do plano (nova prop plans[]). Sem plano → não exibe %
 * - 1.6.0: Exibição de parciais (Compra/Venda), médias ponderadas, resultInPoints, formatação moeda
 * - 1.5.0: Botão "Ver conversa completa" sempre visível para permitir início de interação
 * - 1.4.0: Fix erro "Objects are not valid as React child" - formatDate trata Timestamp Firebase
 */

import { useState, useEffect } from 'react';
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
  Lock,
  Layers,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';

// Helpers locais para evitar dependências quebradas

/**
 * Formata valor como moeda, respeitando a moeda da conta
 * @param {number} value 
 * @param {string} currency - 'BRL', 'USD', 'EUR'
 */
const formatCurrency = (value, currency = 'USD') => {
  if (value === null || value === undefined) return '-';
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  const cfg = config[currency] || config.USD;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatDate = (dateInput) => {
  if (!dateInput) return '-';
  try {
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      const date = new Date(dateInput.seconds * 1000);
      return date.toLocaleDateString('pt-BR');
    }
    if (dateInput instanceof Date) {
      return dateInput.toLocaleDateString('pt-BR');
    }
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

/** Formata ISO datetime para DD/MM/AAAA HH:MM */
const formatDateTime = (dateInput) => {
  if (!dateInput) return '-';
  try {
    if (typeof dateInput === 'string' && dateInput.includes('T')) {
      const [datePart, timePart] = dateInput.split('T');
      const [year, month, day] = datePart.split('-');
      const time = timePart?.substring(0, 5) || '';
      return `${day}/${month}/${year} ${time}`;
    }
    return formatDate(dateInput);
  } catch {
    return '-';
  }
};

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
  plans = [],
  isMentor = false,
  onAddFeedback,
  feedbackLoading = false,
  onViewFeedbackHistory,
  getPartials  // função do useTrades para buscar parciais da subcollection
}) => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [loadedPartials, setLoadedPartials] = useState([]);
  const [partialsLoading, setPartialsLoading] = useState(false);

  // Buscar parciais quando o modal abre com um trade que tem parciais
  useEffect(() => {
    if (!isOpen || !trade) {
      setLoadedPartials([]);
      return;
    }

    const fetchPartials = async () => {
      // Se o trade tem hasPartials e temos a função getPartials, buscar subcollection
      if (trade.hasPartials && getPartials) {
        setPartialsLoading(true);
        try {
          const parts = await getPartials(trade.id);
          setLoadedPartials(parts);
        } catch (err) {
          console.error('[TradeDetailModal] Erro ao buscar parciais:', err);
          setLoadedPartials([]);
        } finally {
          setPartialsLoading(false);
        }
      } else if (trade._partials?.length > 0) {
        // Fallback: usar parciais inline (se vieram do modal de edição)
        setLoadedPartials(trade._partials);
      } else {
        setLoadedPartials([]);
      }
    };

    fetchPartials();
  }, [isOpen, trade, getPartials]);

  if (!isOpen || !trade) return null;

  const isWin = trade.result >= 0;
  
  // Moeda da conta (via trade ou fallback)
  const tradeCurrency = trade.currency || 'USD';

  const feedbackHistoryCount = (trade.feedbackHistory || []).length;
  const hasLegacyFeedback = !!trade.mentorFeedback;
  const totalMessageCount = feedbackHistoryCount || (hasLegacyFeedback ? 1 : 0);

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

  const notes = trade.notes || trade.observation || trade.comment || trade.observacao || '';

  /** Label Compra/Venda conforme side + type */
  const getPartialLabel = (type) => {
    if (trade.side === 'LONG') {
      return type === 'ENTRY' ? 'Compra' : 'Venda';
    }
    return type === 'ENTRY' ? 'Venda' : 'Compra';
  };

  // Separar parciais por tipo para exibição
  const entryPartials = loadedPartials.filter(p => p.type === 'ENTRY').sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const exitPartials = loadedPartials.filter(p => p.type === 'EXIT').sort((a, b) => (a.seq || 0) - (b.seq || 0));

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
                  {isWin ? '+' : ''}{formatCurrency(trade.result, tradeCurrency)}
                </p>
                {trade.resultInPoints != null && (
                  <p className={`text-sm font-mono ${
                    isWin ? 'text-emerald-400/70' : 'text-red-400/70'
                  }`}>
                    {trade.resultInPoints >= 0 ? '+' : ''}{trade.resultInPoints} pts
                  </p>
                )}
                <p className={`text-xs ${
                  isWin ? 'text-emerald-400/50' : 'text-red-400/50'
                }`}>
                  {(() => {
                    const plan = trade.planId && plans.length > 0 ? plans.find(p => p.id === trade.planId) : null;
                    const planPl = plan?.pl;
                    if (planPl && planPl > 0) {
                      return formatPercent((trade.result / planPl) * 100);
                    }
                    return '';
                  })()}
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

            {/* Preços — agora mostra médias quando há parciais */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-500 block mb-1">
                  {trade.hasPartials ? 'Preço Médio Entrada' : 'Entrada'}
                </span>
                <span className="text-white font-mono text-lg">{trade.avgEntry || trade.entry}</span>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-500 block mb-1">
                  {trade.hasPartials ? 'Preço Médio Saída' : 'Saída'}
                </span>
                <span className="text-white font-mono text-lg">{trade.avgExit || trade.exit}</span>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-500 block mb-1">Quantidade</span>
                <span className="text-white font-mono text-lg">{trade.qty}</span>
              </div>
            </div>

            {/* Resultado editado vs calculado */}
            {trade.resultEdited && trade.resultCalculated != null && (
              <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">EDITADO</span>
                <span className="text-xs text-slate-400">
                  Resultado informado: <strong className="text-white">{formatCurrency(trade.result, tradeCurrency)}</strong>
                  {' · '}Calculado: <span className="text-slate-500">{formatCurrency(trade.resultCalculated, tradeCurrency)}</span>
                </span>
              </div>
            )}

            {/* PARCIAIS — Item 6: Exibir detalhes quando existem */}
            {(loadedPartials.length > 0 || trade.hasPartials) && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm font-medium">Parciais</span>
                  {loadedPartials.length > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                      {loadedPartials.length}
                    </span>
                  )}
                </div>

                {partialsLoading ? (
                  <div className="bg-slate-800/30 rounded-xl p-4 flex items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Carregando parciais...</span>
                  </div>
                ) : loadedPartials.length > 0 ? (
                  <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[80px_1fr_80px_140px] gap-3 px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
                      <span>Tipo</span>
                      <span>Preço</span>
                      <span>Qtd</span>
                      <span>Data/Hora</span>
                    </div>
                    {/* Rows */}
                    {loadedPartials.sort((a, b) => (a.seq || 0) - (b.seq || 0)).map((p, i) => (
                      <div key={p.id || i} className="grid grid-cols-[80px_1fr_80px_140px] gap-3 px-4 py-2.5 items-center border-b border-slate-700/30 last:border-0">
                        <span className={`text-xs font-medium flex items-center gap-1 ${p.type === 'ENTRY' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {p.type === 'ENTRY' 
                            ? <ArrowDownRight className="w-3 h-3" /> 
                            : <ArrowUpRight className="w-3 h-3" />
                          }
                          {getPartialLabel(p.type)}
                        </span>
                        <span className="text-white font-mono text-sm">{p.price}</span>
                        <span className="text-white font-mono text-sm">{p.qty}</span>
                        <span className="text-slate-400 text-xs font-mono">{formatDateTime(p.dateTime)}</span>
                      </div>
                    ))}
                    {/* Summary row */}
                    <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700/50">
                      <div className="flex flex-wrap gap-4 text-xs">
                        {trade.avgEntry != null && (
                          <span className="text-slate-400">Média Entrada: <strong className="text-white font-mono">{trade.avgEntry}</strong></span>
                        )}
                        {trade.avgExit != null && (
                          <span className="text-slate-400">Média Saída: <strong className="text-white font-mono">{trade.avgExit}</strong></span>
                        )}
                        {trade.resultInPoints != null && (
                          <span className="text-slate-400">Pontos: <strong className={`font-mono ${trade.resultInPoints >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.resultInPoints >= 0 ? '+' : ''}{trade.resultInPoints}</strong></span>
                        )}
                        <span className="text-slate-400">Resultado: <strong className={`font-mono ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(trade.result, tradeCurrency)}</strong></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/30 rounded-xl p-4 text-center text-sm text-slate-600">
                    Trade marcado com parciais, mas dados não disponíveis.
                  </div>
                )}
              </div>
            )}

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
