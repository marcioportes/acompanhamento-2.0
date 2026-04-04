/**
 * SubscriptionsPage
 * @description Gestão de assinaturas da mentoria — tabela, filtros, modais
 * @see version.js para versão do produto
 *
 * CHANGELOG:
 * - 1.1.0: Integração com useSubscriptions — dados reais do Firestore (issue #094)
 * - 1.0.0: Página inicial com mock data (issue #094)
 */

import { useState, useMemo, useCallback } from 'react';
import {
  CreditCard, Search, Filter, Plus, Eye, RefreshCw, Receipt,
  CheckCircle, AlertTriangle, Clock, XCircle, Pause, X,
  ChevronDown, Calendar, DollarSign, Users, Loader2
} from 'lucide-react';
import { useSubscriptions } from '../hooks/useSubscriptions';
import DebugBadge from '../components/DebugBadge';

// ── Helpers ──────────────────────────────────────────────

const formatCurrency = (value, currency = 'BRL') => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'pt-BR', currency: 'USD' },
  };
  const c = config[currency] || config.BRL;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value);
};

const formatBrDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const daysUntil = (date) => {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

// ── Status config ────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Ativo',      color: 'emerald', icon: CheckCircle },
  pending:   { label: 'Pendente',   color: 'amber',   icon: Clock },
  overdue:   { label: 'Inadimplente', color: 'red',   icon: AlertTriangle },
  paused:    { label: 'Pausado',    color: 'slate',   icon: Pause },
  cancelled: { label: 'Cancelado',  color: 'red',     icon: XCircle },
  expired:   { label: 'Expirado',   color: 'slate',   icon: XCircle },
};

const PLAN_LABELS = {
  alpha: 'Mentoria Alpha',
  self_service: 'Espelho',
};

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'card', label: 'Cartão' },
  { value: 'other', label: 'Outro' },
];

// ── Component ────────────────────────────────────────────

const SubscriptionsPage = () => {
  const {
    subscriptions, loading, error, summary,
    registerPayment, renewSubscription, getPayments,
  } = useSubscriptions();

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'pix',
    reference: '',
  });

  // ── Filtered data ──

  const filtered = useMemo(() => {
    let result = [...subscriptions];

    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.studentName?.toLowerCase().includes(term) ||
        s.studentEmail?.toLowerCase().includes(term)
      );
    }

    // Sort: overdue first, then by renewalDate ascending
    result.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      const dateA = a.renewalDate ?? new Date('9999-12-31');
      const dateB = b.renewalDate ?? new Date('9999-12-31');
      return new Date(dateA) - new Date(dateB);
    });

    return result;
  }, [subscriptions, statusFilter, searchTerm]);

  // ── Handlers ──

  const handleRegisterPayment = (sub) => {
    setSelectedSubscription(sub);
    setPaymentForm({
      amount: String(sub.amount),
      date: new Date().toISOString().split('T')[0],
      method: 'pix',
      reference: '',
    });
    setShowPaymentModal(true);
  };

  const handleRenew = (sub) => {
    setSelectedSubscription(sub);
    setShowRenewModal(true);
  };

  const handleViewPayments = useCallback(async (sub) => {
    setSelectedSubscription(sub);
    setShowPaymentHistory(true);
    setLoadingPayments(true);
    try {
      const payments = await getPayments(sub.id);
      setPaymentHistory(payments);
    } catch (err) {
      console.error('[SubscriptionsPage] Erro ao buscar pagamentos:', err);
      setPaymentHistory([]);
    } finally {
      setLoadingPayments(false);
    }
  }, [getPayments]);

  const handleSubmitPayment = useCallback(async () => {
    if (!selectedSubscription || actionLoading) return;
    setActionLoading(true);
    try {
      await registerPayment(selectedSubscription.id, paymentForm);
      setShowPaymentModal(false);
      setSelectedSubscription(null);
    } catch (err) {
      console.error('[SubscriptionsPage] Erro ao registrar pagamento:', err);
    } finally {
      setActionLoading(false);
    }
  }, [selectedSubscription, paymentForm, registerPayment, actionLoading]);

  const handleConfirmRenew = useCallback(async () => {
    if (!selectedSubscription || actionLoading) return;
    setActionLoading(true);
    try {
      await renewSubscription(selectedSubscription.id);
      setShowRenewModal(false);
      setSelectedSubscription(null);
    } catch (err) {
      console.error('[SubscriptionsPage] Erro ao renovar:', err);
    } finally {
      setActionLoading(false);
    }
  }, [selectedSubscription, renewSubscription, actionLoading]);

  // ── Status badge ──

  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.expired;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-${config.color}-500/15 text-${config.color}-400 border border-${config.color}-500/20`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // ── Days remaining badge ──

  const DaysBadge = ({ renewalDate, status }) => {
    // Status inativos: sem prazo relevante
    if (status === 'cancelled' || status === 'expired') {
      return <span className="text-xs text-slate-600">—</span>;
    }
    if (status === 'paused') {
      return <span className="text-xs text-slate-500">Pausado</span>;
    }
    if (!renewalDate) return <span className="text-xs text-slate-600">—</span>;

    const days = daysUntil(renewalDate);
    if (days === null) return <span className="text-xs text-slate-600">—</span>;

    if (status === 'overdue') {
      return <span className="text-xs text-red-400 font-medium">{Math.abs(days)} dias em atraso</span>;
    }
    if (days <= 0) {
      return <span className="text-xs text-red-400 font-medium">Vence hoje</span>;
    }
    if (days <= 7) {
      return <span className="text-xs text-amber-400 font-medium">{days} dias restantes</span>;
    }
    return <span className="text-xs text-emerald-500">{days} dias restantes</span>;
  };

  // ── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-white flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-blue-400" />
              Assinaturas
            </h1>
            <p className="text-slate-400 mt-1">Gestao de assinaturas da mentoria</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Assinatura
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary.active}</p>
              <p className="text-xs text-slate-400">Ativas</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary.expiringSoon}</p>
              <p className="text-xs text-slate-400">Vencendo em 7 dias</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary.overdue}</p>
              <p className="text-xs text-slate-400">Inadimplentes</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatCurrency(summary.monthlyRevenue)}</p>
              <p className="text-xs text-slate-400">Receita/mes (ativos)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { value: 'all', label: 'Todos', count: summary.total },
            { value: 'active', label: 'Ativos', count: summary.active },
            { value: 'overdue', label: 'Inadimplentes', count: summary.overdue },
            { value: 'pending', label: 'Pendentes' },
            { value: 'paused', label: 'Pausados' },
            { value: 'cancelled', label: 'Cancelados' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              {f.label}
              {f.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  statusFilter === f.value ? 'bg-blue-500/30' : 'bg-slate-700/50'
                }`}>{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-800/30 flex items-center justify-between">
          <p className="text-xs text-slate-500">Ordenado por urgencia (inadimplentes primeiro, depois por vencimento)</p>
          <p className="text-xs text-slate-600">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Aluno</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Vencimento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Situacao</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Valor</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{sub.studentName}</p>
                      <p className="text-xs text-slate-500">{sub.studentEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                      sub.plan === 'alpha'
                        ? 'bg-purple-500/15 text-purple-400'
                        : 'bg-cyan-500/15 text-cyan-400'
                    }`}>
                      {PLAN_LABELS[sub.plan] ?? sub.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-300">{formatBrDate(sub.renewalDate)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <DaysBadge renewalDate={sub.renewalDate} status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{formatCurrency(sub.amount, sub.currency)}</span>
                    <p className="text-xs text-slate-500">/mes</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleViewPayments(sub)}
                        className="group/btn relative p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                      >
                        <Receipt className="w-4 h-4" />
                        <span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Historico</span>
                      </button>
                      {(sub.status === 'active' || sub.status === 'overdue' || sub.status === 'pending') && (
                        <button
                          onClick={() => handleRegisterPayment(sub)}
                          className="group/btn relative p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Pagamento</span>
                        </button>
                      )}
                      {(sub.status === 'active' || sub.status === 'overdue' || sub.status === 'paused') && (
                        <button
                          onClick={() => handleRenew(sub)}
                          className="group/btn relative p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Renovar</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Nenhuma assinatura encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Registrar Pagamento ── */}
      {showPaymentModal && selectedSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Registrar Pagamento</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-800/50 rounded-xl">
              <p className="text-sm font-medium text-white">{selectedSubscription.studentName}</p>
              <p className="text-xs text-slate-400">{PLAN_LABELS[selectedSubscription.plan]} — {formatCurrency(selectedSubscription.amount, selectedSubscription.currency)}/mes</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Valor</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Data do pagamento</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Metodo</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Referencia / Comprovante</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  placeholder="PIX-20260404-001"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Renovar ── */}
      {showRenewModal && selectedSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Renovar Assinatura</h3>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-800/50 rounded-xl">
              <p className="text-sm font-medium text-white">{selectedSubscription.studentName}</p>
              <p className="text-xs text-slate-400">{PLAN_LABELS[selectedSubscription.plan]}</p>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-6">
              <p className="text-sm text-blue-300">
                A data de renovacao sera avancada em <strong>+30 dias</strong> a partir do vencimento atual ({formatBrDate(selectedSubscription.renewalDate)}).
              </p>
              <p className="text-xs text-blue-400/60 mt-2">
                Novo vencimento: {(() => {
                  const d = new Date(selectedSubscription.renewalDate);
                  d.setDate(d.getDate() + 30);
                  return formatBrDate(d.toISOString().split('T')[0]);
                })()}
              </p>
            </div>

            <p className="text-xs text-slate-500 mb-6">
              Use esta opcao para cortesias, ajustes ou pausas. Para pagamentos, use "Registrar Pagamento".
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRenewModal(false)}
                className="flex-1 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRenew}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Renovar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Historico de Pagamentos ── */}
      {showPaymentHistory && selectedSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Historico de Pagamentos</h3>
              <button onClick={() => setShowPaymentHistory(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-800/50 rounded-xl">
              <p className="text-sm font-medium text-white">{selectedSubscription.studentName}</p>
              <p className="text-xs text-slate-400">{PLAN_LABELS[selectedSubscription.plan]} — Desde {formatBrDate(selectedSubscription.startDate)}</p>
            </div>

            {loadingPayments ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                Nenhum pagamento registrado
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {paymentHistory.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl">
                    <div>
                      <p className="text-sm text-white">{formatBrDate(p.date)}</p>
                      <p className="text-xs text-slate-500">
                        {PAYMENT_METHODS.find(m => m.value === p.method)?.label ?? p.method}
                        {p.reference && ` — ${p.reference}`}
                      </p>
                      <p className="text-xs text-slate-600">
                        Periodo: {formatBrDate(p.periodStart)} a {formatBrDate(p.periodEnd)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-emerald-400">
                      {formatCurrency(p.amount, p.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setShowPaymentHistory(false)}
                className="w-full px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nova Assinatura (placeholder) ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Nova Assinatura</h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-8 text-center text-slate-500 text-sm">
              Formulario completo sera implementado com o hook useSubscriptions.
            </div>

            <button
              onClick={() => setShowNewModal(false)}
              className="w-full px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <DebugBadge component="SubscriptionsPage" />
    </div>
  );
};

export default SubscriptionsPage;
