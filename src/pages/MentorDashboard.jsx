/**
 * MentorDashboard
 * @version 1.6.0
 * @description Dashboard do mentor com alertas emocionais, perfil por aluno, feedback em massa
 * 
 * CHANGELOG:
 * - 1.6.0: Issue #9 — Feedback em massa (seleção múltipla, batch write, modal confirmação)
 * - 1.5.0: MentorAlerts na overview — Fase 1.5.0
 * - 1.4.0: Integração Sistema Emocional v2 — StudentEmotionalCard + EmotionalProfileDetail
 * - 1.3.0: Integração com FeedbackPage, botões funcionais para feedback
 * - 1.2.0: Cards por aluno com contadores clicáveis (OPEN/QUESTION)
 */

import { useState, useMemo, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { 
  Users, DollarSign, Target, Activity, MessageSquare, AlertTriangle, 
  Eye, ChevronRight, ChevronDown, TrendingUp, ChevronLeft, Clock, HelpCircle, Brain,
  CheckSquare, Square, Loader2, X, Radar
} from 'lucide-react';
import TradesList from '../components/TradesList';
import TradeDetailModal from '../components/TradeDetailModal';
import ExcursionDisplay from '../components/ExcursionDisplay';
import TradingCalendar from '../components/TradingCalendar';
import EquityCurve from '../components/EquityCurve';
import StudentEmotionalCard from '../components/StudentEmotionalCard';
import PendingReviewsCard from '../components/reviews/PendingReviewsCard';
import MaturitySemaphoreBadge from '../components/MaturitySemaphoreBadge';
import MentorMaturityAlert from '../components/MentorMaturityAlert';
import MentorPromotionAlert from '../components/MentorPromotionAlert';
import Loading from '../components/Loading';
import DebugBadge from '../components/DebugBadge';
import TorreDeControle from '../components/torre/TorreDeControle';
import TorreVisaoRapida from '../components/torre/TorreVisaoRapida';
import FichaDiagnostico from '../components/Students/FichaDiagnostico';
import PlanoDeConversa from '../components/Students/PlanoDeConversa';
import DetalheDoAluno from '../components/Students/DetalheDoAluno';
import FilaDeFeedback from '../components/feedback/FilaDeFeedback';
import { buildFilaDeFeedback } from '../utils/filaDeFeedback';
import ResultadoDoAluno from '../components/Students/ResultadoDoAluno';
import { diagnosticoDoAluno, prescricoes, episodios, contaPrincipal } from '../utils/studentDiagnosis';
import useMentorRiskRadar from '../hooks/useMentorRiskRadar';
import MentorClosuresInbox from '../components/cycleClosure/MentorClosuresInbox';
import MentorClosureView from '../components/cycleClosure/MentorClosureView';
import CycleExpiredGuard from '../components/cycleClosure/CycleExpiredGuard';
import CycleClosureModal from '../components/cycleClosure/CycleClosureModal';
import useMentorClosureInbox from '../hooks/useMentorClosureInbox';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Inbox } from 'lucide-react';
import { useTrades } from '../hooks/useTrades';
import { usePlans } from '../hooks/usePlans';
import { useEmotionalProfile } from '../hooks/useEmotionalProfile';
import { useComplianceRules } from '../hooks/useComplianceRules';
import { useMentorMaturityOverview } from '../hooks/useMentorMaturityOverview';
import useOrders from '../hooks/useOrders';
import { useSetups } from '../hooks/useSetups';
import {
  calculateStats, identifyStudentsNeedingAttention,
  formatPercent, filterTradesByPeriod
} from '../utils/calculations';
import { aggregateTradesByCurrency, formatCurrencyDynamic } from '../utils/currency';
import MultiCurrencyAmount from '../components/MultiCurrencyAmount';
import { fmtTradeTime } from '../utils/tradeTimezone';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { visibleStudentEmails } from '../utils/mentorAccountsVisibility';
import { buildCalendarDays, emailsDoRadar } from '../utils/mentorRiskRadar';

const MentorDashboard = ({ currentView = 'dashboard', onViewChange, onNavigateToFeedback }) => {
  const toast = useToast();
  const { 
    allTrades, loading, addFeedback, 
    getTradesByStudent, getTradesGroupedByStudent, getUniqueStudents, 
    getTradesAwaitingFeedback, getTradesByStudentAndStatus,
    addBulkFeedback
  } = useTrades();
  const { plans } = usePlans();
  const { orders } = useOrders();
  const { setups: allSetups } = useSetups();

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  // Issue #259 — view do closure (lateral panel + comment)
  const [viewingClosure, setViewingClosure] = useState(null);
  // Flow C — mentor inicia closure pelo aluno em sessão 1:1 (issue #259 A8)
  const [mentorClosureContext, setMentorClosureContext] = useState(null);
  const { pendingCount: closuresPendingCount } = useMentorClosureInbox();
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  // #101 — os memos de setups e de perfil emocional do aluno selecionado saíram
  // junto com os componentes que os consumiam. O detalhamento agora vem de
  // `diagnosticoDoAluno`/`episodios`, que já rodam para o Plano de Conversa.
  const [showEmotionalDetail, setShowEmotionalDetail] = useState(null); // studentEmail or null
  // #101 — o calendário da turma é o seletor do dia; sem dia escolhido não há lista.
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [diaAluno, setDiaAluno] = useState(null);
  const [detalheAberto, setDetalheAberto] = useState(false);

  // === Bulk Feedback State ===
  const [selectedTradeIds, setSelectedTradeIds] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirmed, setBulkConfirmed] = useState(false);

  // Compliance rules do mentor (para detecção configurável)
  const { detectionConfig, statusThresholds } = useComplianceRules();

  // Overview de maturidade de todos os alunos (semáforo na lista) — issue #119 task 17
  const { map: maturityByStudentId } = useMentorMaturityOverview(true);

  const viewMapping = { 'dashboard': 'overview', 'torre': 'torre', 'students': 'students', 'pending': 'pending', 'attention': 'attention', 'closures': 'closures' };
  const activeView = viewMapping[currentView] || 'overview';

  const students = useMemo(() => getUniqueStudents(), [getUniqueStudents]);
  const groupedTrades = useMemo(() => getTradesGroupedByStudent(), [getTradesGroupedByStudent]);
  const todayTrades = useMemo(() => filterTradesByPeriod(allTrades, 'today'), [allTrades]);
  const pendingFeedback = useMemo(() => getTradesAwaitingFeedback(), [getTradesAwaitingFeedback]);
  // #402 — alarme só para aluno que o mentor ainda acompanha. Mesmo predicado da
  // visibilidade em Contas/Acompanhamento (`classifyStudent !== null`). Antes disso,
  // "Precisam Atenção" e os alertas do cockpit listavam gente que já tinha saído:
  // 203 dos 588 alarmes da base eram de seis alunos sem assinatura ativa.
  const { subscriptions: allSubscriptions, students: allStudents } = useSubscriptions();
  const emailsAtivos = useMemo(
    () => visibleStudentEmails(allStudents, allSubscriptions),
    [allStudents, allSubscriptions],
  );

  // #101 — o calendário e a lista do dia seguem o MESMO conjunto da Torre (track
  // Alpha). `emailsAtivos` continua sendo o escopo de Acompanhamento/Contas, que é
  // mais largo e vale para as outras superfícies.
  const emailsDaMentoria = useMemo(
    () => emailsDoRadar(allStudents, allSubscriptions),
    [allStudents, allSubscriptions],
  );

  const studentsNeedingAttention = useMemo(() => {
    const todos = identifyStudentsNeedingAttention(groupedTrades);
    // Enquanto as assinaturas não carregaram, não esconde nada — some depois é pior
    // que aparecer e sumir.
    if (emailsAtivos.size === 0) return todos;
    return todos.filter((s) => s?.email && emailsAtivos.has(String(s.email).toLowerCase()));
  }, [groupedTrades, emailsAtivos]);

  // #101 — dias da turma: atividade e risco, nunca soma de dinheiro (BRL + USD na base).
  // #101 Fase E — uma passada só, consumida pelas duas abas. A Torre é a home
  // (triagem); Análises recebe o que é diagnóstico.
  const radar = useMentorRiskRadar({
    allTrades,
    plans,
    students: allStudents,
    subscriptions: allSubscriptions,
  });

  const planosPorId = useMemo(
    () => new Map((plans ?? []).filter((p) => p?.id).map((p) => [p.id, p])),
    [plans],
  );
  const diasDaTurma = useMemo(
    () => buildCalendarDays(allTrades, emailsDaMentoria, planosPorId),
    [allTrades, emailsDaMentoria, planosPorId],
  );
  const tradesDoDia = useMemo(
    () => (diaSelecionado ? allTrades.filter((t) => t.date === diaSelecionado) : []),
    [allTrades, diaSelecionado],
  );

  // #408 — a fila em árvore. `buildFilaDeFeedback` monta aluno → dia → plano sobre
  // o `buildPeriodState` do #402; nada é recalculado aqui.
  const filaDeFeedback = useMemo(
    () => buildFilaDeFeedback({ pendentes: pendingFeedback, plans }),
    [pendingFeedback, plans],
  );

  // #408 — `studentsWithPending` e `filteredPendingTrades` morreram com a lista
  // plana: a fila agora é a árvore de `buildFilaDeFeedback`, que já carrega dia,
  // plano, período e contagens.


  const overallStats = useMemo(() => {
    const allStats = calculateStats(allTrades);
    return { ...allStats, studentsCount: students.length, todayTrades: todayTrades.length };
  }, [allTrades, students, todayTrades]);

  // Agregados multi-moeda (F2 issue #188): P&L nunca soma cross-currency.
  const overallTotalsByCurrency = useMemo(() => aggregateTradesByCurrency(allTrades), [allTrades]);

  const selectedStudentTrades = selectedStudent ? getTradesByStudent(selectedStudent.email) : [];
  const selectedStudentStats = useMemo(() => calculateStats(selectedStudentTrades), [selectedStudentTrades]);
  const selectedStudentTotals = useMemo(() => aggregateTradesByCurrency(selectedStudentTrades), [selectedStudentTrades]);
  // #101 — o veredicto da ficha: o que dói e o que funciona, setup e emoção.
  const diagnosticoAluno = useMemo(
    () => diagnosticoDoAluno(selectedStudentTrades, planosPorId),
    [selectedStudentTrades, planosPorId],
  );
  const planoDeConversa = useMemo(
    () => prescricoes(selectedStudentTrades, planosPorId),
    [selectedStudentTrades, planosPorId],
  );
  const episodiosAluno = useMemo(
    () => episodios(selectedStudentTrades, planosPorId),
    [selectedStudentTrades, planosPorId],
  );
  // O R depende do plano; aluno com duas contas tem dois R. A ficha mede a conta
  // PRINCIPAL — a de maior volume —, não a do último trade: pelo último, o Daniel
  // apareceria com 1 de 7 trades porque o último dele foi numa conta quase vazia.
  const contaDaFicha = useMemo(() => contaPrincipal(selectedStudentTrades), [selectedStudentTrades]);
  const planoDaFicha = useMemo(
    () => (contaDaFicha ? planosPorId.get(contaDaFicha.planId) ?? null : null),
    [planosPorId, contaDaFicha],
  );

  const handleAddFeedback = async (tradeId, feedback) => {
    setFeedbackLoading(true);
    try {
      await addFeedback(tradeId, feedback);
      if (viewingTrade) setViewingTrade({ ...viewingTrade, mentorFeedback: feedback, feedbackDate: new Date().toISOString(), status: 'REVIEWED' });
    } finally { setFeedbackLoading(false); }
  };

  const handleClickStudentAll = (student) => { setSelectedStudent(student); setSelectedTradeIds(new Set()); };

  // #101 — vários pontos abriam o aluno com `{email, name}` só. A tela de detalhe
  // usa `selectedStudent.studentId` para filtrar os PLANOS e para o fluxo de
  // fechamento de ciclo: sem ele, abrir o aluno pelo alerta, pelo card de promoção ou pelo
  // card de promoção entregava a tela sem plano nenhum, enquanto abrir pela lista
  // de Alunos entregava completa. O id vem do próprio trade (getUniqueStudents).
  const abrirAluno = useCallback((student) => {
    if (!student?.email) return setSelectedStudent(student);
    if (student.studentId) return setSelectedStudent(student);
    const conhecido = students.find(
      (s) => String(s.email).toLowerCase() === String(student.email).toLowerCase(),
    );
    setSelectedStudent(conhecido ? { ...student, studentId: conhecido.studentId } : student);
  }, [students]);

  // === Bulk Feedback Handlers ===
  // #408 — selecionar o dia inteiro: o recorte que gera um feedback só.
  const handleSelectDay = (tradeIds) => {
    setSelectedTradeIds((prev) => {
      const novo = new Set(prev);
      const todosJaSelecionados = tradeIds.every((id) => novo.has(id));
      for (const id of tradeIds) {
        if (todosJaSelecionados) novo.delete(id); else novo.add(id);
      }
      return novo;
    });
  };

  const handleToggleTradeSelection = (tradeId) => {
    setSelectedTradeIds(prev => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId);
      else next.add(tradeId);
      return next;
    });
  };


  const handleOpenBulkModal = () => {
    setBulkComment('');
    setBulkConfirmed(false);
    setShowBulkModal(true);
  };

  const handleCloseBulkModal = () => {
    setShowBulkModal(false);
    setBulkComment('');
    setBulkConfirmed(false);
  };

  const handleApplyBulkFeedback = async () => {
    if (!bulkComment.trim() || !bulkConfirmed || bulkLoading) return;
    setBulkLoading(true);
    try {
      await addBulkFeedback(Array.from(selectedTradeIds), bulkComment);
      setSelectedTradeIds(new Set());
      handleCloseBulkModal();
    } catch (err) {
      console.error('[MentorDashboard] Bulk feedback error:', err);
      toast.error(err.message, { title: 'Erro ao aplicar feedback' });
    } finally {
      setBulkLoading(false);
    }
  };

  // Handler para navegar para FeedbackPage
  const handleViewFeedbackHistory = (trade) => {
    if (onNavigateToFeedback) {
      onNavigateToFeedback(trade);
    } else {
      console.warn('[MentorDashboard] onNavigateToFeedback não definido');
    }
  };

  const handleGoToFeedback = (trade) => {
    if (onNavigateToFeedback) onNavigateToFeedback(trade);
  };

  if (loading) return <Loading fullScreen text="Carregando dados..." />;

  // Vista de aluno específico
  if (selectedStudent) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar para lista
        </button>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">{selectedStudent.name}</h1>
            <p className="text-slate-400">{selectedStudent.email}</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-800/50">
            <MultiCurrencyAmount totalsByCurrency={selectedStudentTotals} layout="inline" showSign className="font-semibold" />
          </div>
        </div>
        {/* Issue #259 A8 — Flow C: mentor inicia closure pelo aluno (sessão 1:1) */}
        <CycleExpiredGuard
          studentId={selectedStudent.studentId}
          role="mentor"
          studentName={selectedStudent.name}
          onStartClosure={(item) => setMentorClosureContext(item)}
          plans={plans.filter((p) => p.studentId === selectedStudent.studentId)}
          trades={selectedStudentTrades}
        />

        {/* #101 — diagnóstico e plano lado a lado a partir de xl (1280px): abaixo
            disso cada coluna ficaria estreita demais para as frases do plano, e os
            dois empilham como antes. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8 items-start">
          <FichaDiagnostico diagnostico={diagnosticoAluno} nome={selectedStudent.name} compacto />
          <PlanoDeConversa prescricoes={planoDeConversa} nome={selectedStudent.name} compacto />
        </div>

        {/* #101 — a ficha ganhou espinha: veredicto, resultado, detalhamento. Antes
            era uma pilha de cards de mesmo peso visual, e o mentor tinha que
            garimpar a informação relevante em cada um. */}
        <ResultadoDoAluno trades={selectedStudentTrades} plano={planoDaFicha} foraDaConta={contaDaFicha?.fora ?? 0} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <EquityCurve trades={selectedStudentTrades} />
          {/* #101 — mesmo defeito do calendário da turma: o CalendarHeatmap lia
              `dayOfWeek`/`pl`, campos que `generateCalendarData` não devolve, e
              pintava uma grade vazia. Aqui é um aluno só, então o dia mostra
              dinheiro, na moeda dominante dele. */}
          <TradingCalendar
            trades={selectedStudentTrades}
            currency={[...selectedStudentTotals.keys()][0] || 'BRL'}
            selectedDate={diaAluno}
            onSelectDate={(date) => setDiaAluno(date === diaAluno ? null : date)}
          />
        </div>
        {/* #101 — o detalhamento vira fole. Marcio: "deixa embaixo todo o emaranhado
            de resultados soltos, eu não preciso disso". O dado não sumiu: saiu do
            caminho de quem abre a ficha para preparar uma revisão em cinco minutos. */}
        <button
          onClick={() => setDetalheAberto(!detalheAberto)}
          className="w-full flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-500 hover:text-slate-300 mb-3 transition-colors"
        >
          {detalheAberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Detalhamento
          <span className="normal-case tracking-normal text-slate-600">
            setup, emocional e perfil — o material bruto por trás do plano
          </span>
        </button>

        {detalheAberto && (
          <DetalheDoAluno
            diagnostico={diagnosticoAluno}
            episodios={episodiosAluno}
            onEscolherDia={(data) => {
              setDiaAluno(data);
              setTimeout(() => document.getElementById('trades-do-dia')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          />
        )}
        {/* #101 — o Perfil Emocional saiu da ficha do mentor. Submetido ao teste da
            conversa, sobrou um item de seis: score 68/100 é nota de prova (gera
            defesa no aluno, não muda comportamento), a distribuição descreve sem
            cruzar com resultado, a evolução diária é gráfico de um número sem
            alavanca e o top de emoções é frequência sem consequência. O que
            sobreviveu — evento com data — virou a coluna "Episódios", e o cruzamento
            estado × resultado virou a tabela ao lado. A seção continua inteira na
            tela do ALUNO, onde o autoconhecimento é o produto. */}
        {/* #101 — a lista de trades só existe com um dia escolhido no calendário.
            Marcio: "não quero todos os trades". O histórico inteiro numa página que
            serve para preparar revisão é ruído — o que se discute é um dia. */}
        {diaAluno ? (
          <div className="glass-card" id="trades-do-dia">
            <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">
                Trades de {diaAluno.split('-').reverse().join('/')}
              </h3>
              <button
                onClick={() => setDiaAluno(null)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors"
              >
                Limpar dia
              </button>
            </div>
            <TradesList
              trades={selectedStudentTrades.filter((t) => t.date === diaAluno)}
              plans={plans}
              onViewTrade={setViewingTrade}
              showStudent={false}
              showStatus={true}
            />
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-slate-500">Escolha um dia no calendário para ver os trades.</p>
          </div>
        )}
        <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} plans={plans} orders={orders} allTrades={selectedStudentTrades} isMentor onAddFeedback={handleAddFeedback} feedbackLoading={feedbackLoading} onViewFeedbackHistory={handleViewFeedbackHistory} />

        {/* Flow C — modal do wizard em modo mentor */}
        <CycleClosureModal
          open={mentorClosureContext !== null}
          onClose={() => setMentorClosureContext(null)}
          onSealed={() => setMentorClosureContext(null)}
          studentId={selectedStudent.studentId}
          studentName={selectedStudent.name}
          planId={mentorClosureContext?.planId}
          cycleKey={mentorClosureContext?.cycleKey}
          cycleNumber={mentorClosureContext?.cycleNumber}
          cycleStart={mentorClosureContext?.cycleStart}
          cycleEnd={mentorClosureContext?.cycleEnd}
          accountId={mentorClosureContext?.accountId}
          role="mentor"
          planName={mentorClosureContext?.planName}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Dashboard do Mentor</h1>
        <p className="text-slate-400 mt-1">Visão geral da turma</p>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {[
          // #101 Fase E — a Torre é a home: é ela que diz o que fazer. Análises (ex-Visão
          // Geral) é o nível de baixo, para investigar depois de escolher a pessoa.
          { id: 'torre', sidebarId: 'torre', label: 'Torre de Controle', icon: Radar },
          { id: 'overview', sidebarId: 'dashboard', label: 'Análises', icon: Activity },
          { id: 'students', sidebarId: 'students', label: 'Alunos', icon: Users },
          { id: 'pending', sidebarId: 'pending', label: `Aguardando Feedback (${pendingFeedback.length})`, icon: MessageSquare },
          { id: 'attention', sidebarId: 'attention', label: `Precisam Atenção (${studentsNeedingAttention.length})`, icon: AlertTriangle },
          { id: 'closures', sidebarId: 'closures', label: `Closures${closuresPendingCount > 0 ? ` (${closuresPendingCount})` : ''}`, icon: Inbox },
        ].map(tab => (
          <button key={tab.id} onClick={() => { onViewChange(tab.sidebarId); setSelectedTradeIds(new Set()); }} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeView === tab.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {activeView === 'torre' && (
        <TorreDeControle
          radar={radar}
          onAbrirAluno={abrirAluno}
          extrasAcao={(
            <>
              {/* #376 — promoção vem antes da regressão: é a notícia boa, e era a
                  que não existia em lugar nenhum. Ambas somem quando vazias. */}
              <MentorPromotionAlert
                students={students.map((s) => ({ id: s.studentId, name: s.name, email: s.email }))}
                maturityMap={maturityByStudentId}
                onSelectStudent={(student) => abrirAluno({ email: student.email, name: student.name })}
              />
              <MentorMaturityAlert
                students={students.map((s) => ({ id: s.studentId, name: s.name, email: s.email }))}
                maturityMap={maturityByStudentId}
                onSelectStudent={(student) => abrirAluno({ email: student.email, name: student.name })}
              />
            </>
          )}
          pendencias={(
            <div className="space-y-4">
              <PendingReviewsCard
                students={students}
                onOpenReviewQueue={() => onViewChange('reviews')}
              />
              {/* #101 faixa 3 — o que EU devo. Contador que leva à tela onde o
                  trabalho acontece; a lista não se repete aqui. */}
              <button
                onClick={() => onViewChange('pending')}
                className="w-full glass-card p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className={`w-5 h-5 ${pendingFeedback.length > 0 ? 'text-blue-400' : 'text-slate-600'}`} />
                  <div>
                    <div className="font-semibold text-white text-sm">Aguardando feedback</div>
                    <div className="text-[11px] text-slate-500">
                      {pendingFeedback.length === 0
                        ? 'nenhum trade esperando por você'
                        : `${pendingFeedback.length} ${pendingFeedback.length === 1 ? 'trade espera' : 'trades esperam'} por você`}
                    </div>
                  </div>
                </div>
                {pendingFeedback.length > 0 && (
                  <span className="text-lg font-bold text-blue-300 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-full">
                    {pendingFeedback.length}
                  </span>
                )}
              </button>
            </div>
          )}
        />
      )}

      {activeView === 'overview' && (
        <>
          {/* #101 Fase E — os quatro StatCards de média de turma (P&L Total · Win Rate
              Médio · Alunos Ativos · Trades Hoje) saíram: média de turma não gera
              decisão, e "Alunos Ativos" valia 17 aqui e 12 na Torre. Esta aba passa a
              ser DIAGNÓSTICO — o lugar de investigar depois de escolher a pessoa. */}
          {/* #101 — a curva de patrimônio saiu: somava o dinheiro de doze pessoas em
              duas moedas numa linha só. O calendário passou a ser o do aluno
              (TradingCalendar) em modo turma — o CalendarHeatmap lia campos que
              `generateCalendarData` não devolve mais (dayOfWeek, pl) e renderizava
              uma grade de quadrados vazios. */}
          {/* #101 — o calendário ocupa a linha inteira: é a peça de diagnóstico
              desta aba, e espremido em meia tela a célula do dia virava planilha. */}
          <div className="mb-6">
            <TradingCalendar
              trades={allTrades}
              daysMeta={diasDaTurma}
              selectedDate={diaSelecionado}
              onSelectDate={(date) => setDiaSelecionado(date === diaSelecionado ? null : date)}
            />
          </div>

          {/* #101 — a lista era os 20 trades mais recentes da turma, sem recorte
              nenhum. Agora só existe com um dia escolhido no calendário. */}
          {diaSelecionado ? (
            <div className="glass-card">
              <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">
                    Trades de {diaSelecionado.split('-').reverse().join('/')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tradesDoDia.length} {tradesDoDia.length === 1 ? 'trade' : 'trades'}
                    {diasDaTurma[diaSelecionado] && ` · ${diasDaTurma[diaSelecionado].alunos} ${diasDaTurma[diaSelecionado].alunos === 1 ? 'aluno' : 'alunos'}`}
                    {diasDaTurma[diaSelecionado]?.flags > 0 && (
                      <span className="text-amber-400"> · {diasDaTurma[diaSelecionado].flags} fora do plano</span>
                    )}
                  </p>
                  {/* Quem operou no dia, do que mais operou pro que menos. */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(diasDaTurma[diaSelecionado]?.nomes ?? []).map((a) => (
                      <span
                        key={a.email || a.nome}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          a.flags > 0
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            : 'border-slate-700 bg-slate-800/50 text-slate-300'
                        }`}
                        title={a.flags > 0 ? `${a.flags} fora do plano` : 'dentro do plano'}
                      >
                        {a.nome} <span className="text-slate-500">{a.trades}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setDiaSelecionado(null)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors"
                >
                  Limpar dia
                </button>
              </div>
              <TradesList trades={tradesDoDia} plans={plans} onViewTrade={setViewingTrade} showStudent={true} showStatus={true} />
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-slate-500">Escolha um dia no calendário para ver os trades.</p>
            </div>
          )}
        </>
      )}

      {activeView === 'overview' && (
        <div className="max-w-sm mb-8">
          <TorreVisaoRapida byStudent={radar.byStudent} onAbrirAluno={abrirAluno} />
        </div>
      )}

      {activeView === 'students' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800/50"><h3 className="font-semibold text-white">Lista de Alunos</h3></div>
          <div className="divide-y divide-slate-800/50">
            {students.map(student => {
              const studentTrades = getTradesByStudent(student.email);
              const stats = calculateStats(studentTrades);
              const studentTotalsByCurrency = aggregateTradesByCurrency(studentTrades);
              // Map keyed by uid (parent.parent.id de students/{uid}/maturity/current).
              // Fallback a undefined → semáforo UNKNOWN quando aluno sem studentId ou sem doc.
              const studentMaturity = student.studentId ? maturityByStudentId.get(student.studentId) : undefined;
              return (
                <div key={student.email} className="p-4 hover:bg-slate-800/30 cursor-pointer transition-colors">
                  <div onClick={() => setSelectedStudent(student)} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">{student.name?.charAt(0)?.toUpperCase() || '?'}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{student.name}</p>
                          <MaturitySemaphoreBadge maturity={studentMaturity} />
                        </div>
                        <p className="text-sm text-slate-500">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right min-w-[8rem]">
                        <MultiCurrencyAmount totalsByCurrency={studentTotalsByCurrency} layout="stack" showSign className="font-semibold text-sm items-end" />
                        <p className="text-xs text-slate-500">{stats.totalTrades} trades</p>
                      </div>
                      <div className="text-right"><p className={`font-semibold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPercent(stats.winRate)}</p><p className="text-xs text-slate-500">Win Rate</p></div>
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </div>
                  </div>
                  {/* Emotional mini-card (só mostra se tem trades) */}
                  {studentTrades.length > 0 && (
                    <StudentEmotionalCardWrapper 
                      trades={studentTrades} 
                      studentName={student.name}
                      detectionConfig={detectionConfig}
                      statusThresholds={statusThresholds}
                      onClick={() => setSelectedStudent(student)} 
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* #408 — a fila deixou de ser lista plana por aluno e virou árvore
          aluno → dia → plano → trade. O contexto que só existe no conjunto estava
          invisível: a Sandra em 26/08 aparecia como cinco linhas soltas quando é UM
          dia em que o plano autoriza uma operação, o stop foi atingido na primeira e
          ela abriu mais três. O nível de PLANO é chave, não atributo — dois planos
          no mesmo dia são dois períodos, com limiares e moeda próprios. */}
      {activeView === 'pending' && (
        <FilaDeFeedback
          fila={filaDeFeedback}
          onAbrirTrade={handleGoToFeedback}
          selecionados={selectedTradeIds}
          onAlternarSelecao={handleToggleTradeSelection}
          onSelecionarDia={handleSelectDay}
          onAplicarEmMassa={() => setShowBulkModal(true)}
        />
      )}

      {/* #9 — feedback em massa. A seleção mudou de lugar (era a lista plana, agora
          é a árvore), mas a capacidade continua: no novo desenho ela casa melhor,
          porque o recorte natural é o DIA, e é o dia que gera um feedback só. */}
{showBulkModal && (
  <>
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50" onClick={handleCloseBulkModal} />
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
      <div className="glass-card border border-slate-700/50 p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Feedback em Massa
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Aplicar para {selectedTradeIds.size} {selectedTradeIds.size > 1 ? 'operações' : 'operação'}
          </p>
        </div>

        {/* Resumo dos trades */}
        <div className="max-h-32 overflow-y-auto space-y-1 bg-slate-800/30 rounded-xl p-3">
          {pendingFeedback.filter(t => selectedTradeIds.has(t.id)).map(t => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {t.ticker}
                {' '}<span className="text-slate-500">{t.date?.split('-').reverse().join('/')}</span>
                {t.entryTime && <span className="text-slate-600 font-mono ml-1">{fmtTradeTime(t.entryTime)}</span>}
              </span>
              <span className={t.result >= 0 ? 'text-emerald-400' : 'text-red-400'}>{t.result >= 0 ? '+' : ''}{formatCurrencyDynamic(t.result, t.currency)}</span>
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={bulkComment}
          onChange={(e) => setBulkComment(e.target.value)}
          placeholder="Escreva o feedback que será aplicado a todos os trades selecionados..."
          rows={4}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none"
          autoFocus
        />

        {/* Confirmação */}
        <div className="flex items-start gap-3 cursor-pointer group" onClick={() => setBulkConfirmed(!bulkConfirmed)}>
          <div className="flex-shrink-0 mt-0.5">
            {bulkConfirmed
              ? <CheckSquare className="w-5 h-5 text-blue-400" />
              : <Square className="w-5 h-5 text-slate-500 group-hover:text-slate-300" />
            }
          </div>
          <span className="text-sm text-slate-400">
            Confirmo aplicar este feedback para <strong className="text-white">{selectedTradeIds.size} trade{selectedTradeIds.size > 1 ? 's' : ''}</strong>. O texto será adicionado ao histórico de cada trade.
          </span>
        </div>

        {/* Botões */}
        <div className="flex gap-3 justify-end">
          <button onClick={handleCloseBulkModal} className="px-4 py-2.5 text-slate-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleApplyBulkFeedback}
            disabled={!bulkComment.trim() || !bulkConfirmed || bulkLoading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            {bulkLoading ? 'Aplicando...' : `Aplicar para ${selectedTradeIds.size} trade${selectedTradeIds.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  </>
)}

      {activeView === 'attention' && (
        <div className="space-y-4">
          {studentsNeedingAttention.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Tudo sob controle!</h3>
              <p className="text-slate-500">Nenhum aluno precisa de atenção especial.</p>
            </div>
          ) : (
            studentsNeedingAttention.map(student => (
              <div key={student.email} className="glass-card p-4 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{student.name}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {student.reasons.map((reason, i) => <span key={i} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">{reason}</span>)}
                    </div>
                  </div>
                  <button onClick={() => abrirAluno({ email: student.email, name: student.name })} className="btn-secondary py-2 px-4"><Eye className="w-4 h-4 mr-2" />Ver</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeView === 'closures' && !viewingClosure && (
        <MentorClosuresInbox
          students={students}
          plansById={plans.reduce((acc, p) => { acc[p.id] = p; return acc; }, {})}
          onOpen={(item) => setViewingClosure(item)}
        />
      )}

      {activeView === 'closures' && viewingClosure && (
        <MentorClosureView
          closure={viewingClosure._raw || viewingClosure}
          studentName={students.find((s) => s.studentId === viewingClosure.studentId)?.name}
          viewerRole="mentor"
          onClose={() => setViewingClosure(null)}
          onSaved={() => setViewingClosure(null)}
        />
      )}

      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} plans={plans} orders={orders} allTrades={allTrades} isMentor onAddFeedback={handleAddFeedback} feedbackLoading={feedbackLoading} onViewFeedbackHistory={handleViewFeedbackHistory} />
      <DebugBadge component="MentorDashboard" />
    </div>
  );
};

/**
 * Wrapper que usa useEmotionalProfile para cada aluno na lista
 * Isolado para que cada instância tenha seu próprio hook
 */
const StudentEmotionalCardWrapper = ({ trades, studentName, detectionConfig, statusThresholds, onClick }) => {
  const { metrics, status, alerts, isReady } = useEmotionalProfile({
    trades,
    detectionConfig,
    statusThresholds
  });

  if (!isReady) return null;

  return (
    <div className="mt-2 ml-14">
      <StudentEmotionalCard
        metrics={metrics}
        status={status}
        alerts={alerts}
        studentName={studentName}
        onClick={onClick}
      />
    </div>
  );
};

export default MentorDashboard;
