import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Wallet, Edit2, Trash2, ShieldCheck, FlaskConical, Trophy, X, Search, Building2, ChevronRight,
  TrendingUp, TrendingDown
} from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useMasterData } from '../hooks/useMasterData';
import { useAuth } from '../contexts/AuthContext';
import AccountDetailPage from './AccountDetailPage';
import StudentAccountGroup from '../components/StudentAccountGroup';
// Firebase (para ler o ledger e calcular saldo real por conta)
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const formatCurrency = (value, currency = 'BRL') => {
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  const c = config[currency] || config.BRL;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value);
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

  /**
   * Map de saldos reais calculados pelo ledger:
   * balancesByAccountId[accountId] = number
   * Motivo: Fonte de verdade é a coleção 'movements'
   */
  const [balancesByAccountId, setBalancesByAccountId] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    broker: '',
    currency: 'BRL',
    initialBalance: '',
    type: 'DEMO',
  });

  // Filtro de sugestões de corretora
  const brokerNames = useMemo(() => brokers.map(b => b.name).sort(), [brokers]);
  const filteredBrokers = useMemo(() => {
    if (!formData.broker) return brokerNames.slice(0, 5);
    return brokerNames
      .filter(b => b.toLowerCase().includes(formData.broker.toLowerCase()))
      .slice(0, 8);
  }, [formData.broker, brokerNames]);

  /**
   * Listener de saldo por conta (via movements)
   */
  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      setBalancesByAccountId({});
      return;
    }

    const unsubs = [];

    accounts.forEach((acc) => {
      if (!acc?.id) return;

      const q = query(
        collection(db, 'movements'),
        where('accountId', '==', acc.id)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

          // Ordenação ascendente (mais antigo -> mais novo)
          data.sort((a, b) => {
            const dtA = a.dateTime || a.date || '';
            const dtB = b.dateTime || b.date || '';
            return dtA.localeCompare(dtB);
          });

          // Saldo real = último balanceAfter
          const realBalance =
            data.length > 0
              ? (data[data.length - 1].balanceAfter || 0)
              : (acc.currentBalance ?? acc.initialBalance ?? 0);

          setBalancesByAccountId(prev => ({
            ...prev,
            [acc.id]: realBalance
          }));
        },
        (err) => {
          console.error('[AccountsPage] Erro ao ouvir movements da conta:', acc.id, err);
          setBalancesByAccountId(prev => ({
            ...prev,
            [acc.id]: acc.currentBalance ?? acc.initialBalance ?? 0
          }));
        }
      );

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(fn => {
        try { fn(); } catch (_) {}
      });
    };
  }, [accounts]);

  /**
   * Agrupar contas por aluno (apenas para mentor)
   */
  const groupedAccounts = useMemo(() => {
    if (!isMentor()) return {};

    const groups = {};
    
    accounts.forEach(acc => {
      const studentId = acc.studentId || 'unknown';
      const studentName = acc.studentName || 'Aluno Sem Nome';
      const studentEmail = acc.studentEmail || '';

      if (!groups[studentId]) {
        groups[studentId] = {
          studentName,
          studentEmail,
          accounts: []
        };
      }

      groups[studentId].accounts.push(acc);
    });

    // Ordenar contas dentro de cada grupo por ativa/data
    Object.values(groups).forEach(group => {
      group.accounts.sort((a, b) => {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
        return dateB - dateA;
      });
    });

    return groups;
  }, [accounts, isMentor]);

  /**
   * Filtrar grupos por busca (mentor)
   */
  const filteredGroups = useMemo(() => {
    if (!isMentor()) return {};
    
    if (!searchTerm.trim()) return groupedAccounts;

    const search = searchTerm.toLowerCase();
    const filtered = {};

    Object.entries(groupedAccounts).forEach(([studentId, data]) => {
      const matchesName = data.studentName.toLowerCase().includes(search);
      const matchesEmail = data.studentEmail.toLowerCase().includes(search);
      const matchesAccount = data.accounts.some(acc => 
        acc.name.toLowerCase().includes(search) ||
        (acc.broker || '').toLowerCase().includes(search)
      );

      if (matchesName || matchesEmail || matchesAccount) {
        filtered[studentId] = data;
      }
    });

    return filtered;
  }, [groupedAccounts, searchTerm, isMentor]);

  const openModal = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name || '',
        broker: account.broker || account.brokerName || '',
        currency: account.currency || 'BRL',
        initialBalance: account.initialBalance || '',
        type: account.type || (account.isReal ? 'REAL' : 'DEMO')
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        broker: '',
        currency: 'BRL',
        initialBalance: '',
        type: 'DEMO'
      });
    }
    setIsModalOpen(true);
    setShowBrokerSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Informe o nome da conta');
      return;
    }
    if (!formData.broker.trim()) {
      alert('Informe a corretora');
      return;
    }
    if (!formData.initialBalance || parseFloat(formData.initialBalance) <= 0) {
      alert('Informe o saldo inicial');
      return;
    }

    const isRealDerived = formData.type === 'REAL' || formData.type === 'PROP';
    const payload = {
      name: formData.name.trim(),
      broker: formData.broker.trim(),
      brokerName: formData.broker.trim(),
      currency: formData.currency,
      initialBalance: Number(formData.initialBalance),
      type: formData.type,
      isReal: isRealDerived,
    };

    if (!editingAccount) {
      payload.currentBalance = Number(formData.initialBalance);
    }

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, payload);
      } else {
        await addAccount(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar conta: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Deseja excluir esta conta? O histórico de trades será afetado.")) {
      await deleteAccount(id);
    }
  };

  const getAccountBadge = (acc) => {
    const type = acc.type || (acc.isReal ? 'REAL' : 'DEMO');
    switch (type) {
      case 'REAL':
        return (
          <div className="badge-account bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" /> Conta Real
          </div>
        );
      case 'PROP':
        return (
          <div className="badge-account bg-purple-500/10 text-purple-400 border-purple-500/20">
            <Trophy className="w-3 h-3" /> Mesa Proprietária
          </div>
        );
      default:
        return (
          <div className="badge-account bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
            <FlaskConical className="w-3 h-3" /> Simulado
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Carregando contas...
      </div>
    );
  }

  // Se tem conta selecionada, mostrar detalhes (passa o saldo real também)
  if (selectedAccount) {
    const mergedAccount = {
      ...selectedAccount,
      currentBalance:
        balancesByAccountId[selectedAccount.id] ??
        selectedAccount.currentBalance ??
        selectedAccount.initialBalance ??
        0
    };

    return (
      <AccountDetailPage
        account={mergedAccount}
        onBack={() => setSelectedAccount(null)}
      />
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
              {isMentor() ? 'Contas dos Alunos' : 'Minhas Contas'}
            </h1>
            <p className="text-slate-400 mt-1">
              {isMentor() 
                ? 'Visualize as contas de trading de seus alunos' 
                : 'Gerencie suas contas de trading'
              }
            </p>
          </div>

          {/* Botão Adicionar (apenas para alunos) */}
          {!isMentor() && (
            <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nova Conta
            </button>
          )}
        </div>

        {/* Barra de Busca (apenas para mentor) */}
        {isMentor() && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por aluno, conta ou corretora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg 
                       pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm
                       focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        )}
      </div>

      {/* VISUALIZAÇÃO POR ROLE */}
      
      {/* MENTOR: Contas Agrupadas por Aluno */}
      {isMentor() ? (
        <div className="space-y-4">
          {Object.keys(filteredGroups).length === 0 ? (
            <div className="text-center py-16">
              <Wallet className="mx-auto mb-4 text-slate-600" size={64} />
              <p className="text-xl text-slate-500">
                {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum aluno com contas cadastradas'}
              </p>
            </div>
          ) : (
            Object.entries(filteredGroups).map(([studentId, data]) => (
              <StudentAccountGroup
                key={studentId}
                studentName={data.studentName}
                studentEmail={data.studentEmail}
                accounts={data.accounts}
                balancesByAccountId={balancesByAccountId}
                onAccountClick={setSelectedAccount}
                getAccountBadge={getAccountBadge}
                formatCurrency={formatCurrency}
              />
            ))
          )}
        </div>
      ) : (
        /* ALUNO: Grid Normal de Contas */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => {
            const saldoInicial = acc.initialBalance || 0;
            const saldoAtual = balancesByAccountId[acc.id] ?? acc.currentBalance ?? saldoInicial;
            const profit = saldoAtual - saldoInicial;
            const isProfitable = profit >= 0;
            const isSolvent = saldoAtual >= 0;
            const profitColor = isProfitable ? 'text-emerald-400' : 'text-red-400';
            const ProfitIcon = isProfitable ? TrendingUp : TrendingDown;

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className="relative glass-card p-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl group"
              >
                {getAccountBadge(acc)}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-5 h-5 text-blue-400" />
                    <h3 className="text-xl font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {acc.name}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    {acc.broker || acc.brokerName || 'Broker não informado'}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Saldo Inicial</span>
                    <span className="text-white font-mono">
                      {formatCurrency(saldoInicial, acc.currency)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Saldo Atual</span>
                    <div className="flex items-center gap-2">
                      <ProfitIcon className={`w-4 h-4 ${profitColor}`} />
                      <span className={`font-bold font-mono ${isSolvent ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(saldoAtual, acc.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                </div>

                <div
                  className="mt-6 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); openModal(acc); }}
                    className="p-2 hover:bg-blue-500/20 rounded text-blue-400"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }}
                    className="p-2 hover:bg-red-500/20 rounded text-red-400"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {accounts.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
              Nenhuma conta cadastrada.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Tipo de Conta */}
              <div>
                <label className="input-label mb-3">Tipo de Conta</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'REAL', icon: ShieldCheck, label: 'Real', color: 'emerald' },
                    { id: 'DEMO', icon: FlaskConical, label: 'Demo', color: 'yellow' },
                    { id: 'PROP', icon: Trophy, label: 'Mesa', color: 'purple' }
                  ].map(type => (
                    <div
                      key={type.id}
                      onClick={() => setFormData({ ...formData, type: type.id })}
                      className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${
                        formData.type === type.id
                          ? `bg-${type.color}-500/10 border-${type.color}-500/50 text-white`
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <type.icon className={`w-6 h-6 ${
                        formData.type === type.id ? `text-${type.color}-400` : 'text-slate-500'
                      }`} />
                      <span className="text-xs font-bold uppercase">{type.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="input-label">Nome da Conta *</label>
                <input
                  required
                  className="input-dark w-full"
                  placeholder="Ex: Principal, Teste FTMO"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Corretora com Autocomplete */}
              <div className="relative">
                <label className="input-label">Corretora / Mesa *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    required
                    className="input-dark w-full pl-10"
                    placeholder="Digite para buscar..."
                    value={formData.broker}
                    onChange={e => {
                      setFormData({ ...formData, broker: e.target.value });
                      setShowBrokerSuggestions(true);
                    }}
                    onFocus={() => setShowBrokerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowBrokerSuggestions(false), 200)}
                  />
                </div>

                {showBrokerSuggestions && filteredBrokers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                    {filteredBrokers.map(broker => (
                      <button
                        key={broker}
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                        onClick={() => {
                          setFormData({ ...formData, broker: broker });
                          setShowBrokerSuggestions(false);
                        }}
                      >
                        <Search className="w-3 h-3 opacity-50" /> {broker}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Moeda e Saldo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Moeda</label>
                  <select
                    className="input-dark w-full"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="BRL">BRL (R$)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Saldo Inicial *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-dark w-full"
                    placeholder="10000"
                    value={formData.initialBalance}
                    onChange={e => setFormData({ ...formData, initialBalance: e.target.value })}
                  />
                </div>
              </div>
            </form>

            {/* Footer Sticky */}
            <div className="p-6 border-t border-slate-800 bg-slate-900">
              <button type="submit" onClick={handleSubmit} className="btn-primary w-full py-3">
                {editingAccount ? 'Salvar Alterações' : 'Criar Conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .badge-account {
          position: absolute;
          top: 1rem; right: 1rem;
          padding: 0.25rem 0.5rem; border-radius: 0.25rem;
          font-size: 0.625rem; text-transform: uppercase; font-weight: 700;
          display: flex; align-items: center;
          gap: 0.25rem; border-width: 1px;
        }
        .input-label {
          display: block;
          font-size: 0.75rem; color: rgb(148 163 184);
          margin-bottom: 0.5rem; font-weight: 500;
        }
        .input-dark {
          background: rgb(15 23 42);
          border: 1px solid rgb(51 65 85);
          padding: 0.625rem 0.75rem; border-radius: 0.5rem; color: white;
          outline: none; transition: border-color 0.2s;
        }
        .input-dark:focus { border-color: rgb(59 130 246); }
      `}</style>
    </div>
  );
};

export default AccountsPage;
