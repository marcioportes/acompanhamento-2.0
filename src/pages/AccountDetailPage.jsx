import { useState, useMemo } from 'react';
import {
  ArrowLeft, Plus, Minus, Calendar,
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Wallet, AlertCircle, Loader2, X, Check, RefreshCw
} from 'lucide-react';
import { useMovements } from '../hooks/useMovements';

// Formatadores
const formatCurrency = (value, currency = 'BRL') => {
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  const c = config[currency] || config.BRL;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

// Períodos de filtro
const PERIODS = [
  { id: 'all', label: 'Todo Período' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta Semana' },
  { id: 'month', label: 'Este Mês' },
  { id: 'quarter', label: 'Este Trimestre' },
  { id: 'year', label: 'Este Ano' },
];

const AccountDetailPage = ({ account, onBack }) => {
  const {
    movements,
    loading,
    addDeposit,
    addWithdrawal
  } = useMovements(account?.id);

  const [period, setPeriod] = useState('month');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('DEPOSIT');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDescription, setTransactionDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Filtrar movimentos por período
  const filteredMovements = useMemo(() => {
    if (!movements.length) return [];

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const getStartDate = () => {
      switch (period) {
        case 'today':
          return today;
        case 'week': {
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          return start.toISOString().split('T')[0];
        }
        case 'month':
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        case 'quarter': {
          const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
          return `${now.getFullYear()}-${String(quarterMonth + 1).padStart(2, '0')}-01`;
        }
        case 'year':
          return `${now.getFullYear()}-01-01`;
        default:
          return null;
      }
    };

    const startDate = getStartDate();
    if (!startDate) return movements;

    return movements.filter(m => (m?.date || '') >= startDate);
  }, [movements, period]);

  /**
   * Ordenar o extrato em ordem cronológica (antigo -> novo).
   * Motivo: Para o saldo fazer sentido linha a linha.
   */
  const sortedMovements = useMemo(() => {
    const data = [...filteredMovements];

    data.sort((a, b) => {
      const dtA = a?.dateTime || (a?.date ? `${a.date}T00:00:00.000Z` : '');
      const dtB = b?.dateTime || (b?.date ? `${b.date}T00:00:00.000Z` : '');

      // Ascendente: antigo -> novo
      return dtA.localeCompare(dtB);
    });

    return data;
  }, [filteredMovements]);

  // Calcular totais do período
  const periodTotals = useMemo(() => {
    const totals = {
      deposits: 0,
      withdrawals: 0,
      tradeResults: 0,
      net: 0
    };

    filteredMovements.forEach(m => {
      switch (m.type) {
        case 'DEPOSIT':
          totals.deposits += m.amount;
          break;
        case 'WITHDRAWAL':
          totals.withdrawals += Math.abs(m.amount);
          break;
        case 'TRADE_RESULT':
          totals.tradeResults += m.amount;
          break;
        case 'INITIAL_BALANCE':
        case 'ADJUSTMENT':
        default:
          break;
      }
      totals.net += (m.amount || 0);
    });

    return totals;
  }, [filteredMovements]);

  // Saldo atual: usa o movimento mais recente (agora é o último da lista ordenada)
  const currentBalance = useMemo(() => {
    if (sortedMovements.length > 0) {
      return sortedMovements[sortedMovements.length - 1].balanceAfter || 0;
    }
    return account?.currentBalance ?? account?.initialBalance ?? 0;
  }, [sortedMovements, account]);

  // Variação percentual
  const variation = useMemo(() => {
    const initial = account?.initialBalance || 0;
    if (initial === 0) return 0;
    return ((currentBalance - initial) / initial) * 100;
  }, [currentBalance, account]);

  const openTransactionModal = (type) => {
    setTransactionType(type);
    setTransactionAmount('');
    setTransactionDescription('');
    setError(null);
    setShowTransactionModal(true);
  };

  const handleSaveTransaction = async () => {
    const amount = parseFloat(transactionAmount);
    if (!amount || amount <= 0) {
      setError('Informe um valor válido');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (transactionType === 'DEPOSIT') {
        await addDeposit(account.id, amount, transactionDescription);
      } else {
        if (amount > currentBalance) {
          setError('Saldo insuficiente para este saque');
          setSaving(false);
          return;
        }
        await addWithdrawal(account.id, amount, transactionDescription);
      }
      setShowTransactionModal(false);
    } catch (err) {
      setError(err.message || 'Erro ao salvar movimentação');
    } finally {
      setSaving(false);
    }
  };

  const getMovementIcon = (type, amount) => {
    switch (type) {
      case 'INITIAL_BALANCE':
        return <Wallet className="w-4 h-4 text-blue-400" />;
      case 'DEPOSIT':
        return <ArrowDownCircle className="w-4 h-4 text-emerald-400" />;
      case 'WITHDRAWAL':
        return <ArrowUpCircle className="w-4 h-4 text-red-400" />;
      case 'TRADE_RESULT':
        return amount >= 0
          ? <TrendingUp className="w-4 h-4 text-emerald-400" />
          : <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <RefreshCw className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'INITIAL_BALANCE': return 'Saldo Inicial';
      case 'DEPOSIT': return 'Depósito';
      case 'WITHDRAWAL': return 'Saque';
      case 'TRADE_RESULT': return 'Resultado Trade';
      case 'ADJUSTMENT': return 'Ajuste';
      default: return type;
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Conta não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Contas
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Wallet className="w-7 h-7 text-blue-400" />
              {account.name}
            </h1>
            <p className="text-slate-400 mt-1">
              {account.broker || account.brokerName} • {account.currency || 'BRL'}
            </p>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={() => openTransactionModal('DEPOSIT')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Depósito
            </button>
            <button
              onClick={() => openTransactionModal('WITHDRAWAL')}
              className="btn-secondary flex items-center gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <Minus className="w-4 h-4" /> Saque
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo Atual</p>
          {/* CORREÇÃO: Saldo verde se >= 0 (solvência), independente se teve lucro ou prejuízo no total.
          */}
          <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(currentBalance, account.currency)}
          </p>
          <p className={`text-sm mt-1 ${variation >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {variation >= 0 ? '+' : ''}{variation.toFixed(2)}% desde o início
          </p>
        </div>

        <div className="glass-card p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo Inicial</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(account.initialBalance || 0, account.currency)}
          </p>
          <p className="text-sm text-slate-500 mt-1">Capital investido</p>
        </div>

        <div className="glass-card p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            P&L Trades ({PERIODS.find(p => p.id === period)?.label})
          </p>
          <p className={`text-2xl font-bold ${periodTotals.tradeResults >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {periodTotals.tradeResults >= 0 ? '+' : ''}{formatCurrency(periodTotals.tradeResults, account.currency)}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {filteredMovements.filter(m => m.type === 'TRADE_RESULT').length} operações
          </p>
        </div>
      </div>

      {/* Filtro + Resumo */}
      <div className="glass-card mb-6">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
            >
              {PERIODS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-slate-500">Depósitos: </span>
              <span className="text-emerald-400 font-medium">+{formatCurrency(periodTotals.deposits, account.currency)}</span>
            </div>
            <div>
              <span className="text-slate-500">Saques: </span>
              <span className="text-red-400 font-medium">-{formatCurrency(periodTotals.withdrawals, account.currency)}</span>
            </div>
            <div>
              <span className="text-slate-500">Trades: </span>
              <span className={`font-medium ${periodTotals.tradeResults >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {periodTotals.tradeResults >= 0 ? '+' : ''}{formatCurrency(periodTotals.tradeResults, account.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabela de Movimentos */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            </div>
          ) : sortedMovements.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Nenhum movimento no período selecionado.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr className="text-xs text-slate-500 uppercase">
                  <th className="text-left p-4 font-medium">Data</th>
                  <th className="text-left p-4 font-medium">Tipo</th>
                  <th className="text-left p-4 font-medium">Descrição</th>
                  <th className="text-right p-4 font-medium">Valor</th>
                  <th className="text-right p-4 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {sortedMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <span className="text-sm text-slate-300">{formatDate(mov.date)}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getMovementIcon(mov.type, mov.amount)}
                        <span className="text-sm text-slate-400">{getTypeLabel(mov.type)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-white">{mov.description}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-mono font-medium ${mov.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {mov.amount >= 0 ? '+' : ''}{formatCurrency(mov.amount, account.currency)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-sm text-slate-400">
                        {formatCurrency(mov.balanceAfter, account.currency)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {sortedMovements.length} movimento{sortedMovements.length !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-400">
            Saldo atual:{' '}
            {/* CORREÇÃO AQUI TAMBÉM */}
            <span className={`font-bold ${currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(currentBalance, account.currency)}
            </span>
          </span>
        </div>
      </div>

      {/* Modal de Transação */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {transactionType === 'DEPOSIT' ? (
                  <>
                    <ArrowDownCircle className="w-5 h-5 text-emerald-400" />
                    Novo Depósito
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-5 h-5 text-red-400" />
                    Novo Saque
                  </>
                )}
              </h3>
              <button onClick={() => setShowTransactionModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}

              {transactionType === 'WITHDRAWAL' && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase mb-1">Saldo Disponível</p>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(currentBalance, account.currency)}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Valor ({account.currency}) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    {account.currency === 'USD' ? '$' : account.currency === 'EUR' ? '€' : 'R$'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transactionAmount}
                    onChange={(e) => setTransactionAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white text-lg font-mono placeholder-slate-500 focus:border-blue-500 outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={transactionDescription}
                  onChange={(e) => setTransactionDescription(e.target.value)}
                  placeholder={transactionType === 'DEPOSIT' ? 'Ex: Aporte mensal' : 'Ex: Retirada de lucros'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-800">
              <button
                onClick={() => setShowTransactionModal(false)}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTransaction}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-medium transition-all ${
                  transactionType === 'DEPOSIT'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDetailPage;