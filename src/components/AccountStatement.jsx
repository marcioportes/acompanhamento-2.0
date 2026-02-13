/**
 * AccountStatement - Extrato de movimentações da conta
 * @version 5.6.0 (Smart Balance Fix)
 * - FIX: Cálculo de saldo acumulado considera todo o histórico, não apenas o período visível.
 * - FEAT: Linha "Saldo Anterior" aparece apenas quando necessário (filtro de período).
 * - UI: Ordenação Cronológica Decrescente (Mais recente no topo).
 */

import { useState, useMemo } from 'react';
import { 
  X, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, 
  Calendar, Filter, RefreshCw
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

const AccountStatement = ({ account, movements = [], onClose }) => {
  const { trades } = useTrades();
  const [period, setPeriod] = useState('month');
  const [filterType, setFilterType] = useState('all'); // all, deposits, withdrawals, trades

  // 1. Unificar Trades e Movimentos em uma lista cronológica única
  const fullHistory = useMemo(() => {
    const items = [];

    // Adicionar movimentos (Ledger)
    movements.forEach(m => {
      items.push({
        id: m.id,
        type: m.type, // INITIAL_BALANCE, DEPOSIT, WITHDRAWAL, ADJUSTMENT
        dateObj: m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.date || m.createdAt),
        description: m.description || (m.type === 'DEPOSIT' ? 'Depósito' : 'Saque'),
        amount: m.type === 'WITHDRAWAL' ? -Math.abs(m.amount) : m.amount, // Garante sinal
        category: m.type === 'INITIAL_BALANCE' ? 'initial' : (m.type === 'DEPOSIT' ? 'deposit' : (m.type === 'WITHDRAWAL' ? 'withdrawal' : 'adjustment'))
      });
    });

    // Adicionar trades (apenas se não houver movimento duplicado no ledger - check simples)
    // Nota: O useTrades v5.2+ já cria movimentos para trades, então evitamos duplicidade
    // filtrando apenas trades que NÃO têm ID de movimento vinculado, ou confiamos apenas nos movimentos.
    // *Para este extrato, vamos confiar na lista de 'movements' que é a fonte da verdade financeira.*
    // *Se movements estiver vazio (conta antiga), fazemos fallback para trades.*
    
    if (movements.length === 0) {
      const accountTrades = trades.filter(t => t.accountId === account.id);
      accountTrades.forEach(t => {
        items.push({
          id: t.id,
          type: 'TRADE',
          dateObj: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.date),
          description: `${t.side} ${t.ticker} (${t.qty}x)`,
          amount: t.result || 0,
          category: 'trade',
          setup: t.setup
        });
      });
    }

    // Ordenar Antigo -> Novo (Para calcular saldo progressivo corretamente)
    return items.sort((a, b) => a.dateObj - b.dateObj);
  }, [movements, trades, account.id]);

  // 2. Calcular Datas de Filtro
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    // Ajusta para fim do dia
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    let start = new Date(0); // Default: Início dos tempos

    if (period !== 'all') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
      if (period === 'week') start.setDate(now.getDate() - now.getDay());
      if (period === 'month') start.setDate(1);
      if (period === 'quarter') start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
      if (period === 'year') start.setMonth(0, 1);
    }
    
    return { startDate: start, endDate: end };
  }, [period]);

  // 3. Processar Saldo Anterior e Filtragem
  const { visibleTransactions, previousBalance, hasInitialInPeriod } = useMemo(() => {
    let runningBalance = 0;
    let prevBal = 0;
    const visible = [];
    let initialFound = false;

    // Percorre histórico completo cronologicamente
    fullHistory.forEach(item => {
      // Atualiza saldo acumulado global
      runningBalance += item.amount;

      // Verifica se está dentro do período
      const isAfterStart = item.dateObj >= startDate;
      const isBeforeEnd = item.dateObj <= endDate;

      // Filtro de Categoria
      const matchesType = filterType === 'all' || 
        (filterType === 'deposits' && item.category === 'deposit') ||
        (filterType === 'withdrawals' && item.category === 'withdrawal') ||
        (filterType === 'trades' && (item.category === 'trade' || item.type === 'TRADE_RESULT'));

      if (isAfterStart && isBeforeEnd) {
        if (matchesType) {
          visible.push({ ...item, runningBalance }); // Saldo neste ponto
          if (item.category === 'initial') initialFound = true;
        }
      } else if (item.dateObj < startDate) {
        // Se for antes do período, contribui para o Saldo Anterior
        prevBal = runningBalance;
      }
    });

    // Inverte para exibir Mais Recente primeiro (padrão de extrato bancário moderno)
    return { 
      visibleTransactions: visible.reverse(), 
      previousBalance: prevBal,
      hasInitialInPeriod: initialFound
    };
  }, [fullHistory, startDate, endDate, filterType]);

  // Totais do período visível
  const periodTotals = useMemo(() => {
    return visibleTransactions.reduce((acc, t) => {
      if (t.amount > 0) acc.in += t.amount;
      if (t.amount < 0) acc.out += Math.abs(t.amount);
      return acc;
    }, { in: 0, out: 0 });
  }, [visibleTransactions]);

  // Helper de Ícones
  const getTransactionIcon = (item) => {
    switch (item.category) {
      case 'initial': return <ArrowDownCircle className="w-5 h-5 text-blue-400" />;
      case 'deposit': return <ArrowDownCircle className="w-5 h-5 text-emerald-400" />;
      case 'withdrawal': return <ArrowUpCircle className="w-5 h-5 text-red-400" />;
      default: // Trade
        return item.amount >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white">Extrato da Conta</h3>
            <p className="text-sm text-slate-400">{account.name} • {account.broker || 'Corretora'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Filtros e Resumo */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/30 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <Calendar className="w-4 h-4 text-slate-500 ml-2" />
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none p-1.5 cursor-pointer">
                {PERIODS.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <Filter className="w-4 h-4 text-slate-500 ml-2" />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none p-1.5 cursor-pointer">
                <option value="all" className="bg-slate-900">Todas Transações</option>
                <option value="trades" className="bg-slate-900">Apenas Trades</option>
                <option value="deposits" className="bg-slate-900">Entradas</option>
                <option value="withdrawals" className="bg-slate-900">Saídas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Entradas (Período)</p>
              <p className="text-lg font-mono font-bold text-emerald-400">+{formatCurrency(periodTotals.in, account.currency)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Saídas (Período)</p>
              <p className="text-lg font-mono font-bold text-red-400">-{formatCurrency(periodTotals.out, account.currency)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Resultado Líquido</p>
              <p className={`text-lg font-mono font-bold ${periodTotals.in - periodTotals.out >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                {formatCurrency(periodTotals.in - periodTotals.out, account.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-y-auto">
          {visibleTransactions.length === 0 && !(!hasInitialInPeriod && period !== 'all') ? (
            <div className="p-12 text-center text-slate-500">Nenhuma movimentação neste período.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-xs text-slate-500 uppercase font-semibold z-10">
                <tr>
                  <th className="text-left p-4">Data</th>
                  <th className="text-left p-4">Descrição</th>
                  <th className="text-right p-4">Valor</th>
                  <th className="text-right p-4">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {visibleTransactions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="p-4 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {formatDate(item.dateObj)}
                      <span className="block text-[10px] opacity-50">{item.dateObj.toLocaleTimeString().slice(0,5)}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                          {getTransactionIcon(item)}
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.description}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{item.category === 'initial' ? 'Abertura' : item.type.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono font-medium">
                      <span className={item.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount, account.currency)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-slate-400">
                      {formatCurrency(item.runningBalance, account.currency)}
                    </td>
                  </tr>
                ))}

                {/* LINHA DE SALDO ANTERIOR (Condicional) */}
                {/* Lógica: Mostra se NÃO tiver Saldo Inicial no período E se o filtro não for 'Todo Período' */}
                {!hasInitialInPeriod && period !== 'all' && (
                  <tr className="bg-slate-800/20 border-t-2 border-slate-800 border-dashed">
                    <td className="p-4 text-slate-500 font-mono text-xs italic">-</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3 opacity-60">
                        <div className="p-2 rounded-lg border border-dashed border-slate-600">
                          <RefreshCw className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-slate-300 font-bold italic">Saldo Anterior</p>
                          <p className="text-[10px] text-slate-500">Transporte de período</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right text-slate-500 italic">-</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-300">
                      {formatCurrency(previousBalance, account.currency)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 z-20 flex justify-between items-center text-sm">
          <span className="text-slate-500">{visibleTransactions.length} lançamentos</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Saldo Atual:</span>
            <span className={`font-mono font-bold text-lg ${
              (visibleTransactions[0]?.runningBalance || previousBalance) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {formatCurrency(visibleTransactions[0]?.runningBalance || previousBalance, account.currency)}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AccountStatement;