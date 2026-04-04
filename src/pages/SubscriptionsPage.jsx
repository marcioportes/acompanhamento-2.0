/**
 * SubscriptionsPage
 * @description Gestão de assinaturas da mentoria — tabela, filtros, modais
 * @see version.js para versão do produto
 *
 * CHANGELOG:
 * - 3.0.0: Fix UX crítico — datas BR (INV-06), modal editar, periodicidade na tabela,
 *          recibo na criação, sem defaults hardcoded, vencimento por periodicidade
 * - 2.0.0: Refactor DEC-055/DEC-056
 * - 1.0.0: Versão inicial
 */

import { useState, useMemo, useCallback } from 'react';
import {
  CreditCard, Search, Plus, RefreshCw, Receipt,
  CheckCircle, AlertTriangle, Clock, XCircle, Pause, X,
  DollarSign, Loader2, UserPlus, FlaskConical, Trash2, Edit2
} from 'lucide-react';
import { useSubscriptions } from '../hooks/useSubscriptions';
import DebugBadge from '../components/DebugBadge';

// ── Helpers ──────────────────────────────────────────────

const formatCurrency = (value, currency = 'BRL') => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency ?? 'BRL' }).format(value);
};

// INV-06: Formato brasileiro DD/MM/YYYY
const formatBrDate = (date) => {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const daysUntil = (date) => {
  if (!date) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const todayStr = () => new Date().toISOString().split('T')[0];

// ── Config ───────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Ativo',        color: 'emerald', icon: CheckCircle },
  pending:   { label: 'Pendente',     color: 'amber',   icon: Clock },
  overdue:   { label: 'Inadimplente', color: 'red',     icon: AlertTriangle },
  paused:    { label: 'Pausado',      color: 'slate',   icon: Pause },
  cancelled: { label: 'Cancelado',    color: 'red',     icon: XCircle },
  expired:   { label: 'Expirado',     color: 'slate',   icon: XCircle },
};

const PLAN_LABELS = { alpha: 'Mentoria Alpha', self_service: 'Espelho' };

const BILLING_LABELS = { 1: 'Mensal', 2: 'Bimestral', 3: 'Trimestral', 6: 'Semestral', 12: 'Anual' };
const BILLING_SHORT = { 1: '/mês', 2: '/bim', 3: '/tri', 6: '/sem', 12: '/ano' };

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'card', label: 'Cartão' },
  { value: 'other', label: 'Outro' },
];

// ── Receipt upload zone (reutilizado nos modais) ─────────

const ReceiptUpload = ({ receiptFile, setReceiptFile }) => (
  <div>
    <label className="block text-sm text-slate-400 mb-1">Comprovante (imagem ou PDF)</label>
    <div
      className="w-full px-3 py-3 bg-slate-800/50 border border-slate-700/50 border-dashed rounded-xl text-sm transition-colors focus-within:border-blue-500/50 cursor-pointer"
      onPaste={(e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/') || item.type === 'application/pdf') {
            e.preventDefault();
            const file = item.getAsFile();
            if (!file || file.size > 5 * 1024 * 1024) { alert('Maximo 5MB.'); return; }
            setReceiptFile({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
            return;
          }
        }
      }}
      onClick={() => document.getElementById('receipt-file-input')?.click()}
      tabIndex={0}
    >
      <input id="receipt-file-input" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0]; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Maximo 5MB.'); return; }
        setReceiptFile({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
      }} />
      {receiptFile ? (
        <div className="flex items-center gap-3">
          {receiptFile.preview && <img src={receiptFile.preview} alt="Preview" className="max-h-16 rounded-lg border border-slate-700" />}
          <div className="flex-1"><p className="text-white text-sm">{receiptFile.file.name}</p><p className="text-slate-500 text-xs">{(receiptFile.file.size / 1024).toFixed(0)} KB</p></div>
          <button onClick={(e) => { e.stopPropagation(); setReceiptFile(null); }} className="text-slate-400 hover:text-red-400"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <p className="text-slate-500 text-center">Clique para selecionar ou cole (Ctrl+V)</p>
      )}
    </div>
  </div>
);

// ── Component ────────────────────────────────────────────

const SubscriptionsPage = () => {
  const {
    subscriptions, studentsWithoutSubscription, loading, summary,
    addSubscription, updateSubscription, deleteSubscription, registerPayment, renewSubscription, getPayments,
  } = useSubscriptions();

  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);
  const [modal, setModal] = useState(null); // 'payment' | 'renew' | 'history' | 'new' | 'edit'
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);

  const [paymentForm, setPaymentForm] = useState({});
  const [newForm, setNewForm] = useState({});
  const [editForm, setEditForm] = useState({});

  const closeModal = () => { setModal(null); setSelectedSub(null); setReceiptFile(null); };

  // ── Filtered data ──

  const filtered = useMemo(() => {
    let result = [...subscriptions];
    if (statusFilter !== 'all') result = result.filter(s => s.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter(s => s.type === typeFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => s.studentName?.toLowerCase().includes(term) || s.studentEmail?.toLowerCase().includes(term));
    }
    // Sort: overdue first, then alphabetical
    result.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return (a.studentName ?? '').localeCompare(b.studentName ?? '');
    });
    return result;
  }, [subscriptions, statusFilter, typeFilter, searchTerm]);

  // ── Handlers ──

  const openPayment = (sub) => { setSelectedSub(sub); setPaymentForm({ amount: String(sub.amount ?? ''), date: todayStr(), method: 'pix', reference: '', plan: sub.plan ?? 'alpha', billingPeriodMonths: String(sub.billingPeriodMonths ?? 1) }); setReceiptFile(null); setModal('payment'); };
  const openRenew = (sub) => { setSelectedSub(sub); setModal('renew'); };
  const openEdit = (sub) => { setSelectedSub(sub); setEditForm({ plan: sub.plan ?? 'alpha', amount: String(sub.amount ?? ''), currency: sub.currency ?? 'BRL', billingPeriodMonths: String(sub.billingPeriodMonths ?? 1), gracePeriodDays: String(sub.gracePeriodDays ?? 5), notes: sub.notes ?? '' }); setModal('edit'); };
  const openNew = () => { setNewForm({ studentId: '', type: 'paid', plan: '', amount: '', currency: 'BRL', startDate: todayStr(), gracePeriodDays: '5', billingPeriodMonths: '1', trialDays: '30', notes: '' }); setReceiptFile(null); setModal('new'); };

  const openHistory = useCallback(async (sub) => {
    setSelectedSub(sub); setModal('history'); setLoadingPayments(true);
    try { setPaymentHistory(await getPayments(sub)); } catch { setPaymentHistory([]); } finally { setLoadingPayments(false); }
  }, [getPayments]);

  const handleDelete = useCallback(async (sub) => {
    if (actionLoading) return;
    if (!confirm(`Excluir assinatura de ${sub.studentName}?`)) return;
    setActionLoading(true);
    try { await deleteSubscription(sub); } catch (err) { console.error(err); } finally { setActionLoading(false); }
  }, [deleteSubscription, actionLoading]);

  const handleSubmitPayment = useCallback(async () => {
    if (!selectedSub || actionLoading) return;
    setActionLoading(true);
    try {
      const subToUse = { ...selectedSub };
      if (paymentForm.plan !== selectedSub.plan || parseInt(paymentForm.billingPeriodMonths) !== (selectedSub.billingPeriodMonths ?? 1)) {
        await updateSubscription(selectedSub, { plan: paymentForm.plan, billingPeriodMonths: parseInt(paymentForm.billingPeriodMonths) || 1 });
        subToUse.plan = paymentForm.plan;
        subToUse.billingPeriodMonths = parseInt(paymentForm.billingPeriodMonths) || 1;
      }
      await registerPayment(subToUse, paymentForm, receiptFile?.file ?? null);
      closeModal();
    } catch (err) { console.error(err); } finally { setActionLoading(false); }
  }, [selectedSub, paymentForm, registerPayment, updateSubscription, receiptFile, actionLoading]);

  const handleConfirmRenew = useCallback(async () => {
    if (!selectedSub || actionLoading) return;
    setActionLoading(true);
    try { await renewSubscription(selectedSub); closeModal(); } catch (err) { console.error(err); } finally { setActionLoading(false); }
  }, [selectedSub, renewSubscription, actionLoading]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedSub || actionLoading) return;
    setActionLoading(true);
    try {
      await updateSubscription(selectedSub, {
        plan: editForm.plan, amount: parseFloat(editForm.amount) || 0, currency: editForm.currency,
        billingPeriodMonths: parseInt(editForm.billingPeriodMonths) || 1, gracePeriodDays: parseInt(editForm.gracePeriodDays) || 5, notes: editForm.notes,
      });
      closeModal();
    } catch (err) { console.error(err); } finally { setActionLoading(false); }
  }, [selectedSub, editForm, updateSubscription, actionLoading]);

  const handleCreateSubscription = useCallback(async () => {
    if (!newForm.studentId || actionLoading) return;
    setActionLoading(true);
    try {
      const data = { studentId: newForm.studentId, type: newForm.type, plan: newForm.plan, startDate: newForm.startDate, notes: newForm.notes, receiptFile: receiptFile?.file ?? null };
      if (newForm.type === 'trial') {
        data.trialDays = newForm.trialDays;
      } else {
        data.amount = newForm.amount; data.currency = newForm.currency;
        data.gracePeriodDays = newForm.gracePeriodDays; data.billingPeriodMonths = newForm.billingPeriodMonths;
      }
      await addSubscription(data); closeModal();
    } catch (err) { console.error(err); } finally { setActionLoading(false); }
  }, [newForm, addSubscription, receiptFile, actionLoading]);

  // ── Sub-components ──

  const StatusBadge = ({ status }) => { const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.expired; const I = c.icon; return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-${c.color}-500/15 text-${c.color}-400 border border-${c.color}-500/20`}><I className="w-3 h-3" />{c.label}</span>; };

  const DaysBadge = ({ sub }) => {
    const { status, type, renewalDate, trialEndsAt } = sub;
    if (status === 'cancelled' || status === 'expired') return <span className="text-xs text-slate-600">—</span>;
    if (status === 'paused') return <span className="text-xs text-slate-500">Pausado</span>;
    const target = type === 'trial' ? trialEndsAt : renewalDate;
    if (!target) return <span className="text-xs text-slate-600">—</span>;
    const days = daysUntil(target);
    if (days === null) return <span className="text-xs text-slate-600">—</span>;
    if (status === 'overdue') return <span className="text-xs text-red-400 font-medium">{Math.abs(days)} dias em atraso</span>;
    if (days <= 0) return <span className="text-xs text-red-400 font-medium">{type === 'trial' ? 'Trial expira hoje' : 'Vence hoje'}</span>;
    if (days <= 7) return <span className="text-xs text-amber-400 font-medium">{days} dias restantes</span>;
    return <span className="text-xs text-emerald-500">{days} dias restantes</span>;
  };

  // ── Render ──

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>;

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-white flex items-center gap-3"><CreditCard className="w-8 h-8 text-blue-400" />Assinaturas</h1>
            <p className="text-slate-400 mt-1">Gestao de assinaturas da mentoria</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"><Plus className="w-4 h-4" />Nova Assinatura</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { value: summary.active, label: 'Ativas', icon: CheckCircle, color: 'emerald' },
          { value: summary.expiringSoon, label: 'Vencendo em 7 dias', icon: Clock, color: 'amber' },
          { value: summary.overdue, label: 'Inadimplentes', icon: AlertTriangle, color: 'red' },
          { value: formatCurrency(summary.monthlyRevenue), label: 'Receita/periodo (ativos)', icon: DollarSign, color: 'blue', isText: true },
        ].map((card, i) => (
          <div key={i} className="glass-card p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl bg-${card.color}-500/15 flex items-center justify-center`}><card.icon className={`w-5 h-5 text-${card.color}-400`} /></div><div><p className="text-2xl font-bold text-white">{card.isText ? card.value : card.value}</p><p className="text-xs text-slate-400">{card.label}</p></div></div></div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Buscar por nome ou email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ value: 'all', label: 'Todos', count: summary.total }, { value: 'active', label: 'Ativos', count: summary.active }, { value: 'overdue', label: 'Inadimplentes', count: summary.overdue }, { value: 'pending', label: 'Pendentes' }, { value: 'paused', label: 'Pausados' }].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${statusFilter === f.value ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}>
              {f.label}{f.count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === f.value ? 'bg-blue-500/30' : 'bg-slate-700/50'}`}>{f.count}</span>}
            </button>
          ))}
          <span className="border-l border-slate-700 mx-1" />
          {[{ value: 'all', label: 'Todos tipos' }, { value: 'paid', label: 'Pagos' }, { value: 'trial', label: 'Trial' }].map(f => (
            <button key={`t-${f.value}`} onClick={() => setTypeFilter(f.value)} className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${typeFilter === f.value ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-800/30 flex items-center justify-between">
          <p className="text-xs text-slate-500">Inadimplentes primeiro, depois alfabetico</p>
          <p className="text-xs text-slate-600">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-800/50">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Aluno</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Plano / Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Inicio</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Situacao</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Valor</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Acoes</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800/30">
              {filtered.map(sub => {
                const billing = sub.billingPeriodMonths ?? 1;
                return (
                  <tr key={sub.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-white">{sub.studentName}</p><p className="text-xs text-slate-500">{sub.studentEmail}</p></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded-lg w-fit ${sub.plan === 'alpha' ? 'bg-purple-500/15 text-purple-400' : 'bg-cyan-500/15 text-cyan-400'}`}>{PLAN_LABELS[sub.plan] ?? sub.plan}</span>
                        <span className="text-[10px] text-slate-500">{sub.type === 'trial' ? 'Trial' : BILLING_LABELS[billing] ?? `${billing}m`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={sub.status} /></td>
                    <td className="px-4 py-3"><span className="text-sm text-slate-400">{formatBrDate(sub.startDate)}</span></td>
                    <td className="px-4 py-3"><span className="text-sm text-slate-300">{sub.type === 'trial' ? formatBrDate(sub.trialEndsAt) : formatBrDate(sub.renewalDate)}</span></td>
                    <td className="px-4 py-3"><DaysBadge sub={sub} /></td>
                    <td className="px-4 py-3 text-right">
                      {sub.type === 'paid' ? (
                        <><span className="text-sm font-medium text-white">{formatCurrency(sub.amount, sub.currency)}</span><p className="text-xs text-slate-500">{BILLING_SHORT[billing] ?? `/${billing}m`}</p></>
                      ) : <span className="text-xs text-violet-400">Trial</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {sub.type === 'paid' && <button onClick={() => openHistory(sub)} className="group/btn relative p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"><Receipt className="w-4 h-4" /><span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Historico</span></button>}
                        {sub.type === 'paid' && ['active','overdue','pending'].includes(sub.status) && <button onClick={() => openPayment(sub)} className="group/btn relative p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"><DollarSign className="w-4 h-4" /><span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Pagamento</span></button>}
                        {sub.type === 'paid' && ['active','overdue','paused'].includes(sub.status) && <button onClick={() => openRenew(sub)} className="group/btn relative p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /><span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Renovar</span></button>}
                        <button onClick={() => openEdit(sub)} className="group/btn relative p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /><span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Editar</span></button>
                        <button onClick={() => handleDelete(sub)} className="group/btn relative p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /><span className="absolute bottom-full right-0 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Excluir</span></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Nenhuma assinatura encontrada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Registrar Pagamento ── */}
      {modal === 'payment' && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-white">Registrar Pagamento</h3><button onClick={closeModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="mb-4 p-3 bg-slate-800/50 rounded-xl"><p className="text-sm font-medium text-white">{selectedSub.studentName}</p></div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm text-slate-400 mb-1">Plano vigente</label><select value={paymentForm.plan} onChange={(e) => setPaymentForm(f => ({ ...f, plan: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="alpha">Mentoria Alpha</option><option value="self_service">Espelho</option></select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Periodicidade</label><select value={paymentForm.billingPeriodMonths} onChange={(e) => setPaymentForm(f => ({ ...f, billingPeriodMonths: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="1">Mensal</option><option value="2">Bimestral</option><option value="3">Trimestral</option><option value="6">Semestral</option><option value="12">Anual</option></select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm text-slate-400 mb-1">Valor</label><input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Data</label><input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm text-slate-400 mb-1">Metodo</label><select value={paymentForm.method} onChange={(e) => setPaymentForm(f => ({ ...f, method: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50">{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Referencia</label><input type="text" value={paymentForm.reference} onChange={(e) => setPaymentForm(f => ({ ...f, reference: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" /></div>
            </div>
            <ReceiptUpload receiptFile={receiptFile} setReceiptFile={setReceiptFile} />
          </div>
          <div className="flex gap-3 mt-6"><button onClick={closeModal} className="flex-1 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors">Cancelar</button><button onClick={handleSubmitPayment} disabled={actionLoading} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Confirmar</button></div>
        </div></div>
      )}

      {/* ── Modal: Renovar ── */}
      {modal === 'renew' && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-white">Renovar Assinatura</h3><button onClick={closeModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="mb-4 p-3 bg-slate-800/50 rounded-xl"><p className="text-sm font-medium text-white">{selectedSub.studentName}</p><p className="text-xs text-slate-400">{PLAN_LABELS[selectedSub.plan]} — {BILLING_LABELS[selectedSub.billingPeriodMonths ?? 1]}</p></div>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-6">
            <p className="text-sm text-blue-300">Vencimento atual: <strong>{formatBrDate(selectedSub.renewalDate)}</strong></p>
            <p className="text-xs text-blue-400/60 mt-2">Novo vencimento: {(() => { const d = new Date(selectedSub.renewalDate); d.setDate(d.getDate() + 30); return formatBrDate(d); })()}</p>
          </div>
          <div className="flex gap-3"><button onClick={closeModal} className="flex-1 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors">Cancelar</button><button onClick={handleConfirmRenew} disabled={actionLoading} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Renovar</button></div>
        </div></div>
      )}

      {/* ── Modal: Historico de Pagamentos ── */}
      {modal === 'history' && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-white">Historico de Pagamentos</h3><button onClick={closeModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="mb-4 p-3 bg-slate-800/50 rounded-xl"><p className="text-sm font-medium text-white">{selectedSub.studentName}</p><p className="text-xs text-slate-400">{PLAN_LABELS[selectedSub.plan]} — Desde {formatBrDate(selectedSub.startDate)}</p></div>
          {loadingPayments ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div> : paymentHistory.length === 0 ? <div className="py-8 text-center text-slate-500 text-sm">Nenhum pagamento registrado</div> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">{paymentHistory.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl">
                <div>
                  <div className="flex items-center gap-2"><p className="text-sm text-white">{formatBrDate(p.date)}</p>{p.plan && <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.plan === 'alpha' ? 'bg-purple-500/15 text-purple-400' : 'bg-cyan-500/15 text-cyan-400'}`}>{PLAN_LABELS[p.plan] ?? p.plan}</span>}</div>
                  <p className="text-xs text-slate-500">{PAYMENT_METHODS.find(m => m.value === p.method)?.label ?? p.method}{p.reference && ` — ${p.reference}`}</p>
                  <p className="text-xs text-slate-600">Periodo: {formatBrDate(p.periodStart)} a {formatBrDate(p.periodEnd)}</p>
                  {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Ver comprovante</a>}
                </div>
                <span className="text-sm font-medium text-emerald-400">{formatCurrency(p.amount, p.currency)}</span>
              </div>
            ))}</div>
          )}
          <div className="mt-6"><button onClick={closeModal} className="w-full px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors">Fechar</button></div>
        </div></div>
      )}

      {/* ── Modal: Nova Assinatura ── */}
      {modal === 'new' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-white flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400" />Nova Assinatura</h3><button onClick={closeModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Aluno</label>
              {studentsWithoutSubscription.length === 0 ? <div className="px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-500 text-sm">Todos os alunos ja possuem assinatura</div> : (
                <select value={newForm.studentId} onChange={(e) => setNewForm(f => ({ ...f, studentId: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50">
                  <option value="">Selecione um aluno...</option>
                  {studentsWithoutSubscription.map(s => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Tipo</label>
              <div className="flex gap-2">
                {[{ value: 'paid', label: 'Pago', icon: DollarSign, activeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }, { value: 'trial', label: 'Trial', icon: FlaskConical, activeClass: 'bg-violet-500/20 text-violet-400 border-violet-500/30' }].map(t => (
                  <button key={t.value} onClick={() => setNewForm(f => ({ ...f, type: t.value }))} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ${newForm.type === t.value ? t.activeClass : 'text-slate-400 border-slate-700/50 hover:text-white hover:bg-slate-800/50'}`}><t.icon className="w-4 h-4" />{t.label}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-sm text-slate-400 mb-1">Plano</label><select value={newForm.plan} onChange={(e) => setNewForm(f => ({ ...f, plan: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="">Selecione...</option><option value="alpha">Mentoria Alpha</option><option value="self_service">Espelho</option></select></div>
            <div><label className="block text-sm text-slate-400 mb-1">Data de inicio</label><input type="date" value={newForm.startDate} onChange={(e) => setNewForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" /></div>
            {newForm.type === 'paid' && <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-1">Valor</label><input type="number" value={newForm.amount} onChange={(e) => setNewForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" placeholder="0,00" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Moeda</label><select value={newForm.currency} onChange={(e) => setNewForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="BRL">BRL</option><option value="USD">USD</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-1">Periodicidade</label><select value={newForm.billingPeriodMonths} onChange={(e) => setNewForm(f => ({ ...f, billingPeriodMonths: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="1">Mensal</option><option value="2">Bimestral</option><option value="3">Trimestral</option><option value="6">Semestral</option><option value="12">Anual</option></select></div>
                <div><label className="block text-sm text-slate-400 mb-1">Grace period (dias)</label><input type="number" value={newForm.gracePeriodDays} onChange={(e) => setNewForm(f => ({ ...f, gracePeriodDays: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" /></div>
              </div>
              <ReceiptUpload receiptFile={receiptFile} setReceiptFile={setReceiptFile} />
            </>}
            {newForm.type === 'trial' && <div><label className="block text-sm text-slate-400 mb-1">Duracao do trial (dias)</label><input type="number" value={newForm.trialDays} onChange={(e) => setNewForm(f => ({ ...f, trialDays: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" /><p className="text-xs text-slate-600 mt-1">Expira em {(() => { const d = new Date(newForm.startDate); d.setDate(d.getDate() + (parseInt(newForm.trialDays) || 30)); return formatBrDate(d); })()}</p></div>}
            <div><label className="block text-sm text-slate-400 mb-1">Observacoes</label><input type="text" value={newForm.notes} onChange={(e) => setNewForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" placeholder="Opcional" /></div>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={closeModal} className="flex-1 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors">Cancelar</button><button onClick={handleCreateSubscription} disabled={actionLoading || !newForm.studentId || !newForm.plan} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Criar Assinatura</button></div>
        </div></div>
      )}

      {/* ── Modal: Editar Assinatura ── */}
      {modal === 'edit' && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-white flex items-center gap-2"><Edit2 className="w-5 h-5 text-amber-400" />Editar Assinatura</h3><button onClick={closeModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="mb-4 p-3 bg-slate-800/50 rounded-xl"><p className="text-sm font-medium text-white">{selectedSub.studentName}</p><p className="text-xs text-slate-400">{selectedSub.studentEmail}</p></div>
          <div className="space-y-4">
            <div><label className="block text-sm text-slate-400 mb-1">Plano</label><select value={editForm.plan} onChange={(e) => setEditForm(f => ({ ...f, plan: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="alpha">Mentoria Alpha</option><option value="self_service">Espelho</option></select></div>
            {selectedSub.type === 'paid' && <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-1">Valor</label><input type="number" value={editForm.amount} onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" /></div>
                <div><label className="block text-sm text-slate-400 mb-1">Moeda</label><select value={editForm.currency} onChange={(e) => setEditForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="BRL">BRL</option><option value="USD">USD</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-1">Periodicidade</label><select value={editForm.billingPeriodMonths} onChange={(e) => setEditForm(f => ({ ...f, billingPeriodMonths: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50"><option value="1">Mensal</option><option value="2">Bimestral</option><option value="3">Trimestral</option><option value="6">Semestral</option><option value="12">Anual</option></select></div>
                <div><label className="block text-sm text-slate-400 mb-1">Grace (dias)</label><input type="number" value={editForm.gracePeriodDays} onChange={(e) => setEditForm(f => ({ ...f, gracePeriodDays: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50" /></div>
              </div>
            </>}
            <div><label className="block text-sm text-slate-400 mb-1">Observacoes</label><input type="text" value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" /></div>
          </div>
          <div className="flex gap-3 mt-6"><button onClick={closeModal} className="flex-1 px-4 py-2.5 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors">Cancelar</button><button onClick={handleSaveEdit} disabled={actionLoading} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Salvar</button></div>
        </div></div>
      )}

      <DebugBadge component="SubscriptionsPage" />
    </div>
  );
};

export default SubscriptionsPage;
