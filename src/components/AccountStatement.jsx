/**
 * AccountStatement - Extrato de movimentações da conta
 * 
 * Mostra:
 * - Depósitos e Saques (movements)
 * - Resultados de trades
 * - Filtro por período
 * - Saldo acumulado
 */

import { useState, useMemo } from 'react';
import { 
  X, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, 
  Calendar, Filter, Download, ChevronDown, RefreshCw
} from 'lucide-react';
import { useTrades } from '../hooks/useTrades';

// Períodos de filtro
const PERIODS = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta Semana' },
  { id: 'month', label: 'Este Mês' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Este Ano' },
  { id: 'all', label: 'Todo Período' },
];

const formatCurrency = (value, currency = 'BRL') => {
  const config = {
    BRL: { locale: 'pt-BR', currency: 'BRL' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
  };
  const c = config[currency] || config.BRL;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency }).format(value);
};

const formatDate = (date) => {
  if (!date) return '-';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (date) => {
  if (!date) return '-';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleString('pt-BR', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const AccountStatement = ({ account, movements = [], onClose }) => {
  const { trades } = useTrades();
  const [period, setPeriod] = useState('month');
  const [filterType, setFilterType] = useState('all'); // all, deposits, withdrawals, trades

  // Filtrar trades da conta
  const accountTrades = useMemo(() => {
    return trades.filter(t => t.accountId === account.id);
  }, [trades, account.id]);

  // Combinar movimentos e trades em uma lista unificada
  const allTransactions = useMemo(() => {
    const items = [];

    // Adicionar movimentos (depósitos/saques)
    movements.forEach(m => {
      items.push({
        id: m.id,
        type: m.type, // DEPOSIT, WITHDRAWAL
        date: m.createdAt || m.date,
        description: m.description || (m.type === 'DEPOSIT' ? 'Depósito' : 'Saque'),
        amount: m.type === 'DEPOSIT' ? Math.abs(m.amount) : -Math.abs(m.amount),
        category: m.type === 'DEPOSIT' ? 'deposit' : 'withdrawal'
      });
    });

    // Adicionar trades
    accountTrades.forEach(t => {
      items.push({
        id: t.id,
        type: 'TRADE',
        date: t.createdAt || t.date,
        description: `${t.side} ${t.ticker} (${t.qty}x)`,
        amount: t.result || 0,
        category: 'trade',
        setup: t.setup,
        ticker: t.ticker
      });
    });

    // Ordenar por data (mais recente primeiro)
    items.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateB - dateA;
    });

    return items;
  }, [movements, accountTrades]);

  // Aplicar filtros
  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];

    // Filtro de período
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let startDate = null;
    switch (period) {
      case 'today': startDate = startOfDay; break;
      case 'week': startDate = startOfWeek; break;
      case 'month': startDate = startOfMonth; break;
      case 'quarter': startDate = startOfQuarter; break;
      case 'year': startDate = startOfYear; break;
      default: startDate = null;
    }

    if (startDate) {
      result = result.filter(t => {
        const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return date >= startDate;
      });
    }

    // Filtro de tipo
    if (filterType !== 'all') {
      result = result.filter(t => {
        switch (filterType) {
          case 'deposits': return t.category === 'deposit';
          case 'withdrawals': return t.category === 'withdrawal';
          case 'trades': return t.category === 'trade';
          default: return true;
        }
      });
    }

    return result;
  }, [allTransactions, period, filterType]);

  // Calcular totais
  const totals = useMemo(() => {
    const deposits = filteredTransactions.filter(t => t.category === 'deposit').reduce((sum, t) => sum + t.amount, 0);
    const withdrawals = filteredTransactions.filter(t => t.category === 'withdrawal').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const tradesPnL = filteredTransactions.filter(t => t.category === 'trade').reduce((sum, t) => sum + t.amount, 0);
    const net = deposits - withdrawals + tradesPnL;

    return { deposits, withdrawals, tradesPnL, net };
  }, [filteredTransactions]);

  // Calcular saldo acumulado para cada transação
  const transactionsWithBalance = useMemo(() => {
    // Ordenar cronologicamente (mais antigo primeiro) para calcular saldo
    const sorted = [...filteredTransactions].reverse();
    let balance = account.initialBalance || 0;
    
    const withBalance = sorted.map(t => {
      balance += t.amount;
      return { ...t, runningBalance: balance };
    });

    // Voltar para ordem mais recente primeiro
    return withBalance.reverse();
  }, [filteredTransactions, account.initialBalance]);

  const getTransactionIcon = (item) => {
    switch (item.category) {
      case 'deposit':
        return <ArrowDownCircle className="w-5 h-5 text-emerald-400" />;
      case 'withdrawal':
        return <ArrowUpCircle className="w-5 h-5 text-red-400" />;
      case 'trade':
        return item.amount >= 0 
          ? <TrendingUp className="w-5 h-5 text-emerald-400" />
          : <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <RefreshCw className="w-5 h-5 text-slate-400" />;
    }
  };

  const getTransactionColor = (item) => {
    if (item.category === 'deposit') return 'text-emerald-400';
    if (item.category === 'withdrawal') return 'text-red-400';
    return item.amount >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white">Extrato da Conta</h3>
            <p className="text-sm text-slate-400">{account.name} • {account.broker || account.brokerName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/30">
          <div className="flex flex-wrap gap-3">
            {/* Período */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              >
                {PERIODS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Tipo */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
              >
                <option value="all">Todos</option>
                <option value="deposits">Depósitos</option>
                <option value="withdrawals">Saques</option>
                <option value="trades">Trades</option>
              </select>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase">Depósitos</p>
              <p className="text-lg font-bold text-emerald-400">
                +{formatCurrency(totals.deposits, account.currency)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase">Saques</p>
              <p className="text-lg font-bold text-red-400">
                -{formatCurrency(totals.withdrawals, account.currency)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase">P&L Trades</p>
              <p className={`text-lg font-bold ${totals.tradesPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totals.tradesPnL >= 0 ? '+' : ''}{formatCurrency(totals.tradesPnL, account.currency)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase">Líquido</p>
              <p className={`text-lg font-bold ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totals.net >= 0 ? '+' : ''}{formatCurrency(totals.net, account.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Transações */}
        <div className="flex-1 overflow-y-auto">
          {transactionsWithBalance.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Nenhuma movimentação no período selecionado.
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                <tr className="text-xs text-slate-500 uppercase">
                  <th className="text-left p-4 font-medium">Data</th>
                  <th className="text-left p-4 font-medium">Descrição</th>
                  <th className="text-right p-4 font-medium">Valor</th>
                  <th className="text-right p-4 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {transactionsWithBalance.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <span className="text-sm text-slate-400">
                        {formatDate(item.date)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(item)}
                        <div>
                          <p className="text-sm text-white">{item.description}</p>
                          {item.setup && (
                            <p className="text-xs text-slate-500">{item.setup}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-mono font-medium ${getTransactionColor(item)}`}>
                        {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount, account.currency)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-sm text-slate-400">
                        {formatCurrency(item.runningBalance, account.currency)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {transactionsWithBalance.length} movimentações
          </div>
          <div className="text-sm">
            <span className="text-slate-500">Saldo atual: </span>
            <span className={`font-bold ${(account.currentBalance || 0) >= (account.initialBalance || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(account.currentBalance || account.initialBalance || 0, account.currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountStatement;
