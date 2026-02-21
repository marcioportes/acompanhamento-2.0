/**
 * AccountsPage
 * @see version.js para versão do produto
 * @description Gestão de contas com auditoria de saldo e cronologia.
 * 
 * CHANGELOG (produto):
 * - 1.6.0: Fix auditoria — comparação de datas por string YYYY-MM-DD (sem fuso),
 *          dateTime do INITIAL_BALANCE corrigido com formato ISO completo
 * - 1.0.6: Fix data Brasil (toISOString UTC → local)
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Wallet, Edit2, Trash2, ShieldCheck, FlaskConical, Trophy, X, Search, Building2, ChevronRight,
  TrendingUp, TrendingDown, RefreshCw, AlertTriangle, CheckCircle, ArrowRight, Calendar
} from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useMasterData } from '../hooks/useMasterData';
import { useAuth } from '../contexts/AuthContext';
import AccountDetailPage from './AccountDetailPage';
import StudentAccountGroup from '../components/StudentAccountGroup';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

// Helper de Moeda Blindado
const formatCurrency = (value, currency = 'BRL') => {
  if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  const c = config[currency] || config.BRL;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value);
};

// Helper de Data para "dd/mm/aaaa" (Display visual)
const formatBrDate = (dateObj) => {
  if (!dateObj) return '-';
  // Usa UTC para garantir que a data seja exatamente a gravada, sem fuso do navegador
  return dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

// Helper Seguro para Objeto de Data (Lógica de Fuso Horário)
const getDateObject = (val) => {
  if (!val) return new Date();
  
  // Se for Timestamp do Firestore
  if (typeof val.toDate === 'function') return val.toDate(); 
  
  // Se for string YYYY-MM-DD
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    // [FIX DATA BRASIL]: Forçamos T12:00:00Z (meio dia UTC) para evitar que
    // o fuso horário local (ex: GMT-3) faça a data voltar para o dia anterior.
    return new Date(`${val}T12:00:00Z`);
  }
  
  return new Date(val);
};

// [FIX v1.0.6] Helper para converter Data para YYYY-MM-DD (Input value)
// Usa métodos LOCAIS (getFullYear, getMonth) em vez de UTC (toISOString)
const dateToInputString = (dateObj) => {
  if (!dateObj) return '';
  
  const year = dateObj.getFullYear();
  // getMonth começa em 0, por isso +1
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const AccountsPage = () => {
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useAccounts();
  const { brokers } = useMasterData();
  const { isMentor } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [auditState, setAuditState] = useState({ status: 'idle', message: '', issueType: null, ledgerBalance: 0, suggestion: null });
  const [isFixing, setIsFixing] = useState(false);

  const [balancesByAccountId, setBalancesByAccountId] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    broker: '',
    currency: 'BRL',
    initialBalance: '',
    currentBalance: '',
    createdAt: '',
    type: 'DEMO',
  });

  const brokerNames = useMemo(() => brokers.map(b => b.name).sort(), [brokers]);
  const filteredBrokers = useMemo(() => {
    if (!formData.broker) return brokerNames.slice(0, 5);
    return brokerNames.filter(b => b.toLowerCase().includes(formData.broker.toLowerCase())).slice(0, 8);
  }, [formData.broker, brokerNames]);

  // Listener para cards
  useEffect(() => {
    if (!accounts || accounts.length === 0) { setBalancesByAccountId({}); return; }
    const unsubs = [];
    accounts.forEach((acc) => {
      if (!acc?.id) return;
      const q = query(collection(db, 'movements'), where('accountId', '==', acc.id));
      const unsub = onSnapshot(q, (snapshot) => {
          const totalBalance = snapshot.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
          setBalancesByAccountId(prev => ({ ...prev, [acc.id]: totalBalance }));
        },
        (err) => console.error('[AccountsPage] Erro listener:', err)
      );
      unsubs.push(unsub);
    });
    return () => { unsubs.forEach(fn => { try { fn(); } catch (_) {} }); };
  }, [accounts]);

  const groupedAccounts = useMemo(() => {
    if (!isMentor()) return {};
    const groups = {};
    accounts.forEach(acc => {
      const studentId = acc.studentId || 'unknown';
      if (!groups[studentId]) groups[studentId] = { studentName: acc.studentName || 'Aluno Sem Nome', studentEmail: acc.studentEmail || '', accounts: [] };
      groups[studentId].accounts.push(acc);
    });
    Object.values(groups).forEach(group => { group.accounts.sort((a, b) => getDateObject(b.createdAt) - getDateObject(a.createdAt)); });
    return groups;
  }, [accounts, isMentor]);

  const filteredGroups = useMemo(() => {
    if (!isMentor()) return {};
    if (!searchTerm.trim()) return groupedAccounts;
    const search = searchTerm.toLowerCase();
    const filtered = {};
    Object.entries(groupedAccounts).forEach(([studentId, data]) => {
      if (data.studentName.toLowerCase().includes(search) || data.studentEmail.toLowerCase().includes(search) || data.accounts.some(acc => acc.name.toLowerCase().includes(search))) {
        filtered[studentId] = data;
      }
    });
    return filtered;
  }, [groupedAccounts, searchTerm, isMentor]);

  const openModal = (account = null) => {
    setAuditState({ status: 'idle', message: '', issueType: null, ledgerBalance: 0, suggestion: null }); 
    if (account) {
      setEditingAccount(account);
      const dateObj = account.createdAt ? getDateObject(account.createdAt) : new Date();
      
      setFormData({
        name: account.name || '',
        broker: account.broker || account.brokerName || '',
        currency: account.currency || 'BRL',
        initialBalance: account.initialBalance || '',
        currentBalance: '', // SSOT: Não usamos currentBalance na edição
        createdAt: dateToInputString(dateObj), // [FIX] Usa helper corrigido
        type: account.type || (account.isReal ? 'REAL' : 'DEMO')
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        broker: '',
        currency: 'BRL',
        initialBalance: '',
        currentBalance: '',
        createdAt: dateToInputString(new Date()),
        type: 'DEMO'
      });
    }
    setIsModalOpen(true);
    setShowBrokerSuggestions(false);
  };

  // --- ENGINE DE AUDITORIA ---
  const handleRunAudit = async () => {
    if (!editingAccount) return;
    setAuditState({ status: 'loading', message: 'Analisando histórico...' });

    try {
      const q = query(collection(db, 'movements'), where('accountId', '==', editingAccount.id));
      const snapshot = await getDocs(q);
      
      let ledgerTotal = 0;
      let earliestDateStr = null;  // YYYY-MM-DD string
      let initialBalanceMovId = null;
      let initialBalanceDateStr = null;

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        ledgerTotal += (Number(data.amount) || 0);

        // Extrair data como string YYYY-MM-DD pura (sem converter para Date, sem fuso)
        const movDateStr = data.date || (data.dateTime ? data.dateTime.split('T')[0] : null);
        if (movDateStr && (!earliestDateStr || movDateStr < earliestDateStr)) {
          earliestDateStr = movDateStr;
        }

        if (data.type === 'INITIAL_BALANCE') {
          initialBalanceMovId = docSnap.id;
          initialBalanceDateStr = movDateStr;
        }
      });

      // Data de abertura da conta como string YYYY-MM-DD
      const accountDateStr = formData.createdAt || (editingAccount.createdAt 
        ? (typeof editingAccount.createdAt === 'string' 
            ? editingAccount.createdAt.split('T')[0]
            : dateToInputString(getDateObject(editingAccount.createdAt)))
        : null);
      
      let issue = 'OK';
      let msg = 'Conta saudável. Cronologia e saldos conferem.';

      // Comparação 1: Data da conta posterior ao primeiro lançamento (strings, sem fuso)
      if (accountDateStr && earliestDateStr && accountDateStr > earliestDateStr) {
        issue = 'CHRONOLOGY_ERROR';
        msg = `Cronologia Inválida! Existem lançamentos em ${formatBrDate(getDateObject(earliestDateStr))}, antes da abertura da conta (${formatBrDate(getDateObject(accountDateStr))}).`;
      }
      // Comparação 2: INITIAL_BALANCE com data posterior a outros movimentos
      else if (initialBalanceDateStr && earliestDateStr && initialBalanceDateStr > earliestDateStr) {
        issue = 'CHRONOLOGY_ERROR';
        msg = `Cronologia Inválida! O saldo inicial está em ${formatBrDate(getDateObject(initialBalanceDateStr))}, mas existem lançamentos a partir de ${formatBrDate(getDateObject(earliestDateStr))}.`;
      }
      // Comparação 3: Divergência de saldo
      else if (editingAccount.currentBalance !== undefined && Math.abs(ledgerTotal - (Number(editingAccount.currentBalance) || 0)) > 0.05) {
        issue = 'BALANCE_MISMATCH';
        msg = `Divergência de Saldo! O valor gravado (${formatCurrency(editingAccount.currentBalance, formData.currency)}) difere da soma dos movimentos (${formatCurrency(ledgerTotal, formData.currency)}).`;
      }

      setAuditState({
        status: issue === 'OK' ? 'ok' : 'issue',
        issueType: issue,
        message: msg,
        ledgerBalance: ledgerTotal,
        suggestion: {
          newStartDate: earliestDateStr || accountDateStr,
          initialMovId: initialBalanceMovId
        }
      });

    } catch (error) {
      console.error(error);
      setAuditState({ status: 'error', message: 'Erro na auditoria: ' + error.message });
    }
  };

  // --- CORREÇÃO AUTOMÁTICA ---
  const handleFixIssues = async () => {
    if (!auditState.suggestion || !editingAccount) return;
    setIsFixing(true);

    try {
      const batch = writeBatch(db);
      
      const accountRef = doc(db, 'accounts', editingAccount.id);
      const updates = {
        currentBalance: auditState.ledgerBalance
      };

      if (auditState.issueType === 'CHRONOLOGY_ERROR') {
        const newDate = auditState.suggestion.newStartDate;
        updates.createdAt = newDate;

        if (auditState.suggestion.initialMovId) {
          const movRef = doc(db, 'movements', auditState.suggestion.initialMovId);
          // Fix: dateTime com formato ISO completo (antes era string sem T)
          batch.update(movRef, { 
            date: newDate, 
            dateTime: `${newDate}T00:00:00.000Z` 
          });
        }
      }

      batch.update(accountRef, updates);
      await batch.commit();

      setFormData(prev => ({
        ...prev,
        currentBalance: auditState.ledgerBalance,
        createdAt: updates.createdAt || prev.createdAt
      }));

      setAuditState(prev => ({
        ...prev,
        status: 'ok',
        message: 'Correções aplicadas com sucesso!',
        issueType: 'OK',
      }));

    } catch (error) {
      alert('Erro ao corrigir: ' + error.message);
    } finally {
      setIsFixing(false);
    }
  };

  // --- HANDLE SUBMIT (v1.0.6) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.broker.trim()) return alert('Preencha os campos obrigatórios');
    
    // Payload Base
    const basePayload = {
      name: formData.name.trim(),
      broker: formData.broker.trim(),
      brokerName: formData.broker.trim(),
      currency: formData.currency,
      type: formData.type,
      isReal: (formData.type === 'REAL' || formData.type === 'PROP'),
      createdAt: formData.createdAt // String YYYY-MM-DD local
    };

    try {
      if (editingAccount) {
        const updatePayload = {
          ...basePayload,
          initialBalance: Number(formData.initialBalance),
        };
        // SSOT: Remove explicitamente currentBalance
        delete updatePayload.currentBalance;

        await updateAccount(editingAccount.id, updatePayload);
      } else {
        const createPayload = {
          ...basePayload,
          initialBalance: Number(formData.initialBalance),
          currentBalance: Number(formData.initialBalance)
        };
        await addAccount(createPayload);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Deseja excluir esta conta? O histórico será perdido.")) await deleteAccount(id);
  };

  const getAccountBadge = (acc) => {
    const type = acc.type || (acc.isReal ? 'REAL' : 'DEMO');
    switch (type) {
      case 'REAL': return <div className="badge-account bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><ShieldCheck className="w-3 h-3" /> Conta Real</div>;
      case 'PROP': return <div className="badge-account bg-purple-500/10 text-purple-400 border-purple-500/20"><Trophy className="w-3 h-3" /> Mesa Proprietária</div>;
      default: return <div className="badge-account bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><FlaskConical className="w-3 h-3" /> Simulado</div>;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando contas...</div>;

  if (selectedAccount) {
    const mergedAccount = { ...selectedAccount, currentBalance: balancesByAccountId[selectedAccount.id] ?? selectedAccount.currentBalance ?? 0 };
    return <AccountDetailPage account={mergedAccount} onBack={() => setSelectedAccount(null)} />;
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div><h1 className="text-2xl lg:text-3xl font-display font-bold text-white">{isMentor() ? 'Contas dos Alunos' : 'Minhas Contas'}</h1><p className="text-slate-400 mt-1">{isMentor() ? 'Visualize as contas de trading de seus alunos' : 'Gerencie suas contas de trading'}</p></div>
          {!isMentor() && (<button onClick={() => openModal()} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Conta</button>)}
        </div>
        {isMentor() && (<div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors" /></div>)}
      </div>

      {isMentor() ? (
        <div className="space-y-4">{Object.entries(filteredGroups).map(([studentId, data]) => (<StudentAccountGroup key={studentId} studentName={data.studentName} studentEmail={data.studentEmail} accounts={data.accounts} balancesByAccountId={balancesByAccountId} onAccountClick={setSelectedAccount} getAccountBadge={getAccountBadge} formatCurrency={formatCurrency} />))}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => {
            const saldoInicial = acc.initialBalance || 0;
            const saldoAtual = balancesByAccountId[acc.id] ?? acc.currentBalance ?? saldoInicial;
            const profit = saldoAtual - saldoInicial;
            const isProfitable = profit >= 0;
            const isSolvent = saldoAtual >= 0;
            const ProfitIcon = isProfitable ? TrendingUp : TrendingDown;
            return (
              <div key={acc.id} onClick={() => setSelectedAccount(acc)} className="relative glass-card p-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl group">
                {getAccountBadge(acc)}
                <div className="mb-4"><div className="flex items-center gap-2 mb-1"><Wallet className="w-5 h-5 text-blue-400" /><h3 className="text-xl font-semibold text-white group-hover:text-emerald-400 transition-colors">{acc.name}</h3></div><p className="text-sm text-slate-400 flex items-center gap-2">{acc.broker || acc.brokerName || 'Broker não informado'}</p></div>
                <div className="space-y-3"><div className="flex justify-between items-center"><span className="text-sm text-slate-400">Saldo Inicial</span><span className="text-white font-mono">{formatCurrency(saldoInicial, acc.currency)}</span></div><div className="flex justify-between items-center"><span className="text-sm text-slate-400">Saldo Atual</span><div className="flex items-center gap-2"><ProfitIcon className={`w-4 h-4 ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`} /><span className={`font-bold font-mono ${isSolvent ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(saldoAtual, acc.currency)}</span></div></div></div>
                <div className="mt-6 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}><button onClick={(e) => { e.stopPropagation(); openModal(acc); }} className="p-2 hover:bg-blue-500/20 rounded text-blue-400"><Edit2 className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }} className="p-2 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">{editingAccount ? 'Editar Conta' : 'Nova Conta'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div><label className="input-label mb-3">Tipo de Conta</label><div className="grid grid-cols-3 gap-3">{[{ id: 'REAL', icon: ShieldCheck, label: 'Real', color: 'emerald' }, { id: 'DEMO', icon: FlaskConical, label: 'Demo', color: 'yellow' }, { id: 'PROP', icon: Trophy, label: 'Mesa', color: 'purple' }].map(type => (<div key={type.id} onClick={() => setFormData({ ...formData, type: type.id })} className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${formData.type === type.id ? `bg-${type.color}-500/10 border-${type.color}-500/50 text-white` : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}><type.icon className={`w-6 h-6 ${formData.type === type.id ? `text-${type.color}-400` : 'text-slate-500'}`} /><span className="text-xs font-bold uppercase">{type.label}</span></div>))}</div></div>
              <div><label className="input-label">Nome da Conta *</label><input required className="input-dark w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
              <div className="relative"><label className="input-label">Corretora / Mesa *</label><div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input required className="input-dark w-full pl-10" value={formData.broker} onChange={e => { setFormData({ ...formData, broker: e.target.value }); setShowBrokerSuggestions(true); }} /></div>{showBrokerSuggestions && filteredBrokers.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">{filteredBrokers.map(broker => (<button key={broker} type="button" className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2" onClick={() => { setFormData({ ...formData, broker: broker }); setShowBrokerSuggestions(false); }}><Search className="w-3 h-3 opacity-50" /> {broker}</button>))}</div>)}</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className="input-label">Moeda</label><select className="input-dark w-full" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}><option value="BRL">BRL (R$)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option></select></div>
                <div><label className="input-label">Saldo Inicial *</label><input required type="number" step="0.01" min="0" className="input-dark w-full" value={formData.initialBalance} onChange={e => setFormData({ ...formData, initialBalance: e.target.value })} /></div>
              </div>

              <div><label className="input-label flex items-center gap-2"><Calendar className="w-3 h-3" /> Data de Abertura / Início</label><input type="date" className="input-dark w-full" value={formData.createdAt} onChange={e => setFormData({ ...formData, createdAt: e.target.value })} /></div>

              {editingAccount && (
                <div className={`mt-4 border rounded-xl p-4 transition-all ${auditState.status === 'issue' ? 'bg-amber-500/10 border-amber-500/30' : auditState.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {auditState.status === 'issue' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : auditState.status === 'ok' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <ShieldCheck className="w-4 h-4 text-blue-400" />}
                        Auditoria & Saúde
                      </h4>
                      {auditState.message && <p className={`text-xs mt-1 ${auditState.status === 'issue' ? 'text-amber-300' : auditState.status === 'ok' ? 'text-emerald-300' : 'text-slate-400'}`}>{auditState.message}</p>}
                    </div>
                    {auditState.status === 'idle' && <button type="button" onClick={handleRunAudit} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><RefreshCw className="w-3 h-3" /> Verificar</button>}
                  </div>

                  {(auditState.status === 'issue' || auditState.status === 'ok') && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between text-xs bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                        <div><span className="block text-slate-500">Saldo Atual (Banco)</span><span className="font-mono font-bold text-white">{formatCurrency(formData.currentBalance, formData.currency)}</span></div>
                        <ArrowRight className="w-4 h-4 text-slate-600" />
                        <div className="text-right"><span className="block text-slate-500">Saldo Calculado (Ledger)</span><span className={`font-mono font-bold ${Math.abs(auditState.ledgerBalance - (Number(formData.currentBalance) || 0)) > 0.05 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatCurrency(auditState.ledgerBalance, formData.currency)}</span></div>
                      </div>
                      {auditState.status === 'issue' && (
                        <button type="button" onClick={handleFixIssues} disabled={isFixing} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                          {isFixing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {auditState.issueType === 'CHRONOLOGY_ERROR' ? 'Corrigir Datas & Atualizar Saldo' : 'Atualizar Saldo Agora'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </form>
            <div className="p-6 border-t border-slate-800 bg-slate-900 flex gap-3"><button onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button><button type="submit" onClick={handleSubmit} className="btn-primary flex-1">Salvar</button></div>
          </div>
        </div>
      )}
      <style>{`.badge-account { position: absolute; top: 1rem; right: 1rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.625rem; text-transform: uppercase; font-weight: 700; display: flex; align-items: center; gap: 0.25rem; border-width: 1px; } .input-label { display: block; font-size: 0.75rem; color: rgb(148 163 184); margin-bottom: 0.5rem; font-weight: 500; } .input-dark { background: rgb(15 23 42); border: 1px solid rgb(51 65 85); padding: 0.625rem 0.75rem; border-radius: 0.5rem; color: white; outline: none; transition: border-color 0.2s; } .input-dark:focus { border-color: rgb(59 130 246); }`}</style>
    </div>
  );
};

export default AccountsPage;