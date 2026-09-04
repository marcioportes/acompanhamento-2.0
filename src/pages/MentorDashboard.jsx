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
  DollarSign, Target, Activity, MessageSquare, ChevronRight, ChevronDown, TrendingUp, ChevronLeft, Clock, HelpCircle, Brain,
  CheckSquare, Square, Loader2, X
} from 'lucide-react';
import TradesList from '../components/TradesList';
import TradeDetailModal from '../components/TradeDetailModal';
import ExcursionDisplay from '../components/ExcursionDisplay';
import TradingCalendar from '../components/TradingCalendar';
import EquityCurve from '../components/EquityCurve';
import TorrePendencias from '../components/torre/TorrePendencias';
import PageHeader from '../components/PageHeader';
import MentorMaturityAlert from '../components/MentorMaturityAlert';
import MentorPromotionAlert from '../components/MentorPromotionAlert';
import Loading from '../components/Loading';
import DebugBadge from '../components/DebugBadge';
import TorreDeControle from '../components/torre/TorreDeControle';
import TorreVisaoRapida from '../components/torre/TorreVisaoRapida';
import usePendingReviewsCount from '../hooks/usePendingReviewsCount';
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
import { useTrades } from '../hooks/useTrades';
import { usePlans } from '../hooks/usePlans';
import { useMentorMaturityOverview } from '../hooks/useMentorMaturityOverview';
import useOrders from '../hooks/useOrders';
import { useSetups } from '../hooks/useSetups';
import {
  calculateStats,
  filterTradesByPeriod
} from '../utils/calculations';
import { aggregateTradesByCurrency, formatCurrencyDynamic } from '../utils/currency';
import MultiCurrencyAmount from '../components/MultiCurrencyAmount';
import { fmtTradeTime } from '../utils/tradeTimezone';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { buildCalendarDays, emailsDoRadar } from '../utils/mentorRiskRadar';

/**
 * #144 B3 — cada endereço do mentor tem nome próprio. Enquanto o dashboard for
 * container de várias telas, o título mora aqui; na Fase C1 sobe para o shell.
 */
const CABECALHO = {
  torre: { titulo: 'Torre de Controle', linha: 'O que precisa de você hoje' },
  overview: { titulo: 'Análises', linha: 'Calendário da turma e trades por dia' },
  pending: { titulo: 'Aguardando Feedback', linha: 'Trades que esperam sua resposta' },
  closures: { titulo: 'Fechamentos', linha: 'Ciclos fechados esperando sua leitura' },
};

const MentorDashboard = ({
  currentView = 'torre',
  onViewChange,
  onNavigateToFeedback,
  // #144 A1 — a ficha do aluno deixa de ser estado interno e passa a ser
  // endereço (`/alunos/:studentId`). O parâmetro pode ser o studentId ou o
  // email: vários pontos abrem o aluno tendo só o email em mãos.
  studentIdSelecionado = null,
  onAbrirAluno,
  onVoltarDaFicha,
}) => {
  const toast = useToast();
  const { 
    allTrades, loading, addFeedback, 
    getTradesByStudent, getUniqueStudents,
    getTradesAwaitingFeedback, getTradesByStudentAndStatus,
    addBulkFeedback
  } = useTrades();
  const { plans } = usePlans();
  const { orders } = useOrders();
  const { setups: allSetups } = useSetups();

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


  // Overview de maturidade de todos os alunos (semáforo na lista) — issue #119 task 17
  const { map: maturityByStudentId } = useMentorMaturityOverview(true);

  // #144 A1 — a view vem da ROTA. O dicionário que traduzia id-de-sidebar para
  // id-interno (e que era a cola entre os dois sistemas de navegação) morreu com ele.
  const activeView = currentView;

  const students = useMemo(() => getUniqueStudents(), [getUniqueStudents]);

  // #144 — a ficha do aluno é rota (`/alunos/:studentId`), e o parâmetro pode ser
  // o studentId OU o email: vários pontos abrem o aluno tendo só o email em mãos.
  //
  // Fica AQUI, logo depois de `students`, porque `selectedStudentTrades` (abaixo)
  // lê `selectedStudent` durante o render. Declarado mais para baixo, o `const`
  // estourava TDZ — `Cannot access before initialization` — e derrubava a tela do
  // mentor inteira. Era `useState` no topo antes do #144; ao virar derivado da
  // rota, foi parar depois do primeiro uso.
  const selectedStudent = useMemo(() => {
    if (!studentIdSelecionado) return null;
    const chave = String(studentIdSelecionado).toLowerCase();
    return students.find(
      (s) => String(s.studentId).toLowerCase() === chave || String(s.email).toLowerCase() === chave,
    ) ?? null;
  }, [students, studentIdSelecionado]);
  const todayTrades = useMemo(() => filterTradesByPeriod(allTrades, 'today'), [allTrades]);
  const pendingFeedback = useMemo(() => getTradesAwaitingFeedback(), [getTradesAwaitingFeedback]);
  const revisoesPendentes = usePendingReviewsCount(students);
  const { subscriptions: allSubscriptions, students: allStudents } = useSubscriptions();

  // #101 — o calendário e a lista do dia seguem o MESMO conjunto da Torre (track
  // Alpha). O recorte mais largo (`visibleStudentEmails`) vale para Acompanhamento
  // e Contas, que são outras superfícies.
  // #144 B2 — `emailsAtivos` saiu daqui junto com a tela "Precisam Atenção": era a
  // única consumidora neste arquivo.
  const emailsDaMentoria = useMemo(
    () => emailsDoRadar(allStudents, allSubscriptions),
    [allStudents, allSubscriptions],
  );

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

  const handleClickStudentAll = (student) => { abrirAluno(student); setSelectedTradeIds(new Set()); };

  // #101 — vários pontos abriam o aluno com `{email, name}` só. A tela de detalhe
  // usa `selectedStudent.studentId` para filtrar os PLANOS e para o fluxo de
  // fechamento de ciclo: sem ele, abrir o aluno pelo alerta, pelo card de promoção ou pelo
  // card de promoção entregava a tela sem plano nenhum, enquanto abrir pela lista
  // de Alunos entregava completa. O id vem do próprio trade (getUniqueStudents).
  const abrirAluno = useCallback((student) => {
    if (!student) return;
    if (student.studentId) return onAbrirAluno?.(student);
    const conhecido = students.find(
      (s) => String(s.email).toLowerCase() === String(student.email).toLowerCase(),
    );
    onAbrirAluno?.(conhecido ? { ...student, studentId: conhecido.studentId } : student);
  }, [students, onAbrirAluno]);

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

  // #144 A1 — a ficha é rota (`/alunos/:studentId`). O aluno vem da lista, que
  // deriva dos trades: com a lista ainda vazia o endereço é válido e o dado não
  // chegou; com a lista carregada e nada casando, o endereço é que está errado.
  if (activeView === 'ficha' && !selectedStudent) {
    if (students.length === 0) return <Loading fullScreen text="Carregando aluno..." />;
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <h1 className="text-xl font-display font-bold text-white">Aluno não encontrado</h1>
          <p className="text-sm text-slate-400 mt-2">Nenhum aluno com esse identificador aparece nos seus trades.</p>
          <button onClick={() => onVoltarDaFicha?.()} className="btn-primary mt-6">Voltar</button>
        </div>
      </div>
    );
  }

  // Vista de aluno específico
  if (selectedStudent) {
    return (
      <div>
        <PageHeader
          titulo={selectedStudent.name}
          linha={selectedStudent.email}
          voltar={(
            <button onClick={() => onVoltarDaFicha?.()} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
          )}
          acoes={(
            <div className="px-4 py-2 rounded-xl bg-slate-800/50">
              <MultiCurrencyAmount totalsByCurrency={selectedStudentTotals} layout="inline" showSign className="font-semibold" />
            </div>
          )}
        />
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
    <div>
      {/* #144 B3 — a barra de abas morreu. Ela era o SEGUNDO sistema de navegação:
          os mesmos destinos existiam como item de menu e como aba, colados por um
          dicionário de tradução. Agora cada endereço é uma tela, e o título diz
          qual é — em vez de "Dashboard do Mentor · Visão geral da turma" em todas. */}
      <PageHeader titulo={CABECALHO[activeView]?.titulo} linha={CABECALHO[activeView]?.linha} />

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
            <TorrePendencias
              revisoes={revisoesPendentes}
              feedbacksPendentes={pendingFeedback.length}
              fechamentosPendentes={closuresPendingCount}
              onAbrirRevisoes={() => onViewChange('reviews')}
              onAbrirFeedback={() => onViewChange('pending')}
              onAbrirFechamentos={() => onViewChange('closures')}
            />
          )}
          rodape={(
            /* #144 B3 — Análises sai do menu e vira saída de rodapé: é diagnóstico,
               serve DEPOIS de escolher a pessoa, e como item irmão competia com a
               triagem. */
            <button
              onClick={() => onViewChange('dashboard')}
              className="w-full text-left text-xs text-slate-500 hover:text-slate-300 transition-colors border-t border-slate-800/50 pt-4 flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Calendário da turma e trades por dia
              <span className="text-slate-600">— Análises</span>
            </button>
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

      {/* #144 A1 — o bloco `activeView === 'students'` ("Lista de Alunos") foi
          removido: era INALCANÇÁVEL. O App interceptava `currentView === 'students'`
          e renderizava StudentsManagement antes de o dashboard montar, desde que os
          dois sistemas de navegação passaram a coexistir. A lista de alunos vive em
          `/alunos` (StudentsManagement) e a triagem vive na Torre. */}

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

      {/* #144 B2/D1 — a tela "Precisam Atenção" saiu. Ela recortava a turma por
          PERFORMANCE acumulada (prejuízo, win rate < 40%, profit factor < 0,8),
          enquanto a faixa "A Turma" da Torre já ordena todo mundo por conduta e
          presença — que é o critério que o produto adotou em #376 ("mede conduta de
          risco, não performance"). O tile "atenção" do header da Torre é o recorte
          que sobrou, e ele filtra a lista no lugar. */}

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

/* #144 A1 — `StudentEmotionalCardWrapper` saiu junto com o bloco "Lista de Alunos":
   era o único consumidor dele, e o bloco era inalcançável. Com ele saem
   `useComplianceRules` e `useEmotionalProfile` deste arquivo — o painel emocional
   por aluno vive na ficha (`FichaDiagnostico`/`PlanoDeConversa`) desde o #101. */

export default MentorDashboard;
