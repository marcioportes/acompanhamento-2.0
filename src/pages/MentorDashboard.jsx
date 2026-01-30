import { useState, useMemo } from 'react';
import { Users, DollarSign, Target, Activity, MessageSquare, AlertTriangle, Trophy, Eye, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import StatCard from '../components/StatCard';
import TradesList from '../components/TradesList';
import TradeDetailModal from '../components/TradeDetailModal';
import CalendarHeatmap from '../components/CalendarHeatmap';
import EquityCurve from '../components/EquityCurve';
import SetupAnalysis from '../components/SetupAnalysis';
import EmotionAnalysis from '../components/EmotionAnalysis';
import Filters from '../components/Filters';
import Loading from '../components/Loading';
import { useTrades } from '../hooks/useTrades';
import { calculateStats, calculateStudentRanking, identifyStudentsNeedingAttention, formatCurrency, formatPercent, filterTradesByPeriod } from '../utils/calculations';

const MentorDashboard = ({ currentView = 'dashboard', onViewChange }) => {
  const { allTrades, loading, addFeedback, getTradesByStudent, getTradesGroupedByStudent, getUniqueStudents, getTradesAwaitingFeedback } = useTrades();
  
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [rankingSort, setRankingSort] = useState('totalPL');
  const [filters, setFilters] = useState({ period: 'all', search: '' });

  // Mapear views da sidebar para views internas
  const viewMapping = {
    'dashboard': 'overview',
    'students': 'students',
    'pending': 'pending',
    'attention': 'attention',
    'ranking': 'ranking',
  };
  
  const activeView = viewMapping[currentView] || 'overview';

  const students = getUniqueStudents();
  const groupedTrades = getTradesGroupedByStudent();
  const todayTrades = filterTradesByPeriod(allTrades, 'today');
  const pendingFeedback = getTradesAwaitingFeedback();
  const studentsNeedingAttention = identifyStudentsNeedingAttention(groupedTrades);
  const ranking = useMemo(() => calculateStudentRanking(groupedTrades, rankingSort), [groupedTrades, rankingSort]);

  const overallStats = useMemo(() => {
    const allStats = calculateStats(allTrades);
    return {
      ...allStats,
      studentsCount: students.length,
      todayTrades: todayTrades.length,
      avgWinRate: ranking.length > 0 ? ranking.reduce((acc, s) => acc + s.winRate, 0) / ranking.length : 0,
    };
  }, [allTrades, students, todayTrades, ranking]);

  const selectedStudentTrades = selectedStudent ? getTradesByStudent(selectedStudent.email) : [];
  const selectedStudentStats = useMemo(() => calculateStats(selectedStudentTrades), [selectedStudentTrades]);

  const handleAddFeedback = async (tradeId, feedback) => {
    setFeedbackLoading(true);
    try {
      await addFeedback(tradeId, feedback);
      if (viewingTrade) {
        setViewingTrade({ ...viewingTrade, mentorFeedback: feedback, feedbackDate: new Date().toISOString() });
      }
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (loading) return <Loading fullScreen text="Carregando dados..." />;

  // Vista de aluno específico
  if (selectedStudent) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" /> Voltar para lista
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">{selectedStudent.name}</h1>
            <p className="text-slate-400">{selectedStudent.email}</p>
          </div>
          <div className={`px-4 py-2 rounded-xl ${selectedStudentStats.totalPL >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            <span className="font-semibold">{formatCurrency(selectedStudentStats.totalPL)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="P&L Total" value={formatCurrency(selectedStudentStats.totalPL)} icon={DollarSign} color={selectedStudentStats.totalPL >= 0 ? 'green' : 'red'} />
          <StatCard title="Win Rate" value={formatPercent(selectedStudentStats.winRate)} icon={Target} color={selectedStudentStats.winRate >= 50 ? 'green' : 'red'} />
          <StatCard title="Total Trades" value={selectedStudentStats.totalTrades} icon={Activity} color="blue" />
          <StatCard title="Profit Factor" value={selectedStudentStats.profitFactor === Infinity ? '∞' : selectedStudentStats.profitFactor.toFixed(2)} icon={TrendingUp} color={selectedStudentStats.profitFactor >= 1 ? 'green' : 'red'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <EquityCurve trades={selectedStudentTrades} />
          <CalendarHeatmap trades={selectedStudentTrades} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SetupAnalysis trades={selectedStudentTrades} />
          <EmotionAnalysis trades={selectedStudentTrades} />
        </div>

        <TradesList trades={selectedStudentTrades} onViewTrade={setViewingTrade} showStudent={false} />

        <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} isMentor onAddFeedback={handleAddFeedback} feedbackLoading={feedbackLoading} />
      </div>
    );
  }

  // Vista principal
  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Dashboard do Mentor</h1>
        <p className="text-slate-400 mt-1">Visão geral da turma</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {[
          { id: 'overview', sidebarId: 'dashboard', label: 'Visão Geral', icon: Activity },
          { id: 'students', sidebarId: 'students', label: 'Alunos', icon: Users },
          { id: 'pending', sidebarId: 'pending', label: `Aguardando Feedback (${pendingFeedback.length})`, icon: MessageSquare },
          { id: 'attention', sidebarId: 'attention', label: `Precisam Atenção (${studentsNeedingAttention.length})`, icon: AlertTriangle },
          { id: 'ranking', sidebarId: 'ranking', label: 'Ranking', icon: Trophy },
        ].map(tab => (
          <button key={tab.id} onClick={() => onViewChange(tab.sidebarId)} className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeView === tab.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeView === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="P&L Total Turma" value={formatCurrency(overallStats.totalPL)} icon={DollarSign} color={overallStats.totalPL >= 0 ? 'green' : 'red'} />
            <StatCard title="Win Rate Médio" value={formatPercent(overallStats.avgWinRate)} icon={Target} color={overallStats.avgWinRate >= 50 ? 'green' : 'yellow'} />
            <StatCard title="Alunos Ativos" value={students.length} icon={Users} color="blue" />
            <StatCard title="Trades Hoje" value={todayTrades.length} icon={Activity} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <EquityCurve trades={allTrades} />
            <CalendarHeatmap trades={allTrades} />
          </div>

          <TradesList trades={allTrades.slice(0, 20)} onViewTrade={setViewingTrade} showStudent itemsPerPage={10} />
        </>
      )}

      {/* Students List */}
      {activeView === 'students' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800/50">
            <h3 className="font-semibold text-white">Lista de Alunos</h3>
          </div>
          <div className="divide-y divide-slate-800/50">
            {students.map(student => {
              const studentTrades = getTradesByStudent(student.email);
              const stats = calculateStats(studentTrades);
              return (
                <div key={student.email} onClick={() => setSelectedStudent(student)} className="p-4 flex items-center justify-between hover:bg-slate-800/30 cursor-pointer transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{student.name}</p>
                      <p className="text-sm text-slate-500">{student.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`font-semibold ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(stats.totalPL)}</p>
                      <p className="text-xs text-slate-500">{stats.totalTrades} trades</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPercent(stats.winRate)}</p>
                      <p className="text-xs text-slate-500">Win Rate</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Feedback */}
      {activeView === 'pending' && (
        <TradesList trades={pendingFeedback} onViewTrade={setViewingTrade} showStudent />
      )}

      {/* Students Needing Attention */}
      {activeView === 'attention' && (
        <div className="space-y-4">
          {studentsNeedingAttention.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Tudo sob controle!</h3>
              <p className="text-slate-500">Nenhum aluno precisa de atenção especial no momento.</p>
            </div>
          ) : (
            studentsNeedingAttention.map(student => (
              <div key={student.email} className="glass-card p-4 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{student.name}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {student.reasons.map((reason, i) => (
                        <span key={i} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">{reason}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setSelectedStudent({ email: student.email, name: student.name })} className="btn-secondary py-2 px-4">
                    <Eye className="w-4 h-4 mr-2" />Ver
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Ranking */}
      {activeView === 'ranking' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
            <h3 className="font-semibold text-white">Ranking da Turma</h3>
            <select value={rankingSort} onChange={(e) => setRankingSort(e.target.value)} className="text-sm py-2">
              <option value="totalPL">Por P&L</option>
              <option value="winRate">Por Win Rate</option>
              <option value="profitFactor">Por Profit Factor</option>
              <option value="totalTrades">Por Total de Trades</option>
            </select>
          </div>
          <div className="divide-y divide-slate-800/50">
            {ranking.map((student, index) => (
              <div key={student.email} onClick={() => setSelectedStudent({ email: student.email, name: student.name })} className="p-4 flex items-center gap-4 hover:bg-slate-800/30 cursor-pointer transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' : index === 1 ? 'bg-slate-400/20 text-slate-400' : index === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{student.name}</p>
                  <p className="text-xs text-slate-500">{student.totalTrades} trades</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${student.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(student.totalPL)}</p>
                  <p className="text-xs text-slate-500">WR: {formatPercent(student.winRate)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TradeDetailModal isOpen={!!viewingTrade} onClose={() => setViewingTrade(null)} trade={viewingTrade} isMentor onAddFeedback={handleAddFeedback} feedbackLoading={feedbackLoading} />
    </div>
  );
};

export default MentorDashboard;
