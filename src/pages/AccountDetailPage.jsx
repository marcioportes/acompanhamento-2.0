/**
 * AccountDetailPage
 * @version 6.1.1 (UI Tweaks)
 * @description Extrato com cálculo reverso (Reverse Ledger).
 * * CHANGE LOG 6.1.1:
 * - UI: Aumentado espaçamento da coluna 'Tipo' (w-32 -> w-40) para evitar quebra de linha em 'Resultado Trade'.
 * - MANUTENÇÃO: Mantida toda a lógica de cálculo reverso, tradução e formatação da v6.1.0.
 */

import { useState, useMemo } from 'react';
import {
  ArrowLeft, Plus, Minus, Calendar,
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Wallet, Loader2, X, History, Filter
} from 'lucide-react';
import { useMovements } from '../hooks/useMovements';

// --- Helpers de Formatação ---

const formatCurrency = (value, currency = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0);
};

// Força o formato DD/MM/AAAA independente do locale do browser
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

// Tradução dos tipos de movimento
const translateType = (type) => {
  const map = {
    'INITIAL_BALANCE': 'Saldo Inicial',
    'DEPOSIT': 'Aporte',
    'WITHDRAWAL': 'Retirada',
    'TRADE_RESULT': 'Resultado Trade'
  };
  return map[type] || type;
};

const AccountDetailPage = ({ account, onBack }) => {
  const { movements, loading, addDeposit, addWithdrawal } = useMovements(account?.id);
  
  // Filtros
  const [period, setPeriod] = useState('month');
  
  // Datas Personalizadas
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Modal Transação
  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /**
   * 1. ENGINE DE CÁLCULO REVERSO (Reverse Ledger)
   */
  const ledger = useMemo(() => {
    if (!account || movements.length === 0) return [];

    let currentRunner = account.currentBalance || account.initialBalance || 0;
    
    // movements vem do hook ordenado por data DESC (Hoje -> Ontem)
    return movements.map(mov => {
      let amount = Number(mov.amount);
      
      // Normalização de Sinais
      if (mov.type === 'WITHDRAWAL' && amount > 0) amount = -amount;
      if (mov.type === 'DEPOSIT' && amount < 0) amount = Math.abs(amount);
      if (mov.type === 'INITIAL_BALANCE') amount = Math.abs(amount);
      
      const balanceAfter = currentRunner;
      const balanceBefore = currentRunner - amount;

      currentRunner = balanceBefore;

      return {
        ...mov,
        normalizedAmount: amount,
        balanceAfter,
        balanceBefore
      };
    });
  }, [movements, account]);

  /**
   * 2. FILTRO & VISUALIZAÇÃO
   */
  const { visibleData, startBalance, hasFilter, endBalance } = useMemo(() => {
    if (period === 'all') {
      const data = [...ledger].reverse();
      return { 
        visibleData: data, 
        startBalance: 0, 
        hasFilter: false,
        endBalance: data.length > 0 ? data[data.length - 1].balanceAfter : 0
      };
    }

    const now = new Date();
    let minDate = '';
    let maxDate = '9999-12-31';

    switch (period) {
      case 'today': 
        minDate = now.toISOString().split('T')[0]; 
        maxDate = minDate;
        break;
      case 'week': {
        const d = new Date(); d.setDate(d.getDate() - 7);
        minDate = d.toISOString().split('T')[0]; 
        break;
      }
      case 'month': 
        minDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; 
        break;
      case 'year': 
        minDate = `${now.getFullYear()}-01-01`; 
        break;
      case 'custom':
        minDate = customStart || '1900-01-01';
        maxDate = customEnd || '9999-12-31';
        break;
      default: minDate = '1900-01-01';
    }

    const filteredDESC = ledger.filter(m => m.date >= minDate && m.date <= maxDate);

    let transportBalance = 0;
    if (filteredDESC.length > 0) {
      transportBalance = filteredDESC[filteredDESC.length - 1].balanceBefore;
    } else {
      const prevMove = ledger.find(m => m.date < minDate);
      transportBalance = prevMove ? prevMove.balanceAfter : (account?.initialBalance || 0);
    }

    const visibleASC = [...filteredDESC].reverse();
    
    const finalBal = visibleASC.length > 0 
      ? visibleASC[visibleASC.length - 1].balanceAfter 
      : transportBalance;

    return { 
      visibleData: visibleASC, 
      startBalance: transportBalance, 
      hasFilter: true,
      endBalance: finalBal
    };
  }, [ledger, period, customStart, customEnd, account]);

  // --- Actions ---
  const handleSaveTx = async () => {
    if (!txAmount) return;
    setIsSaving(true);
    try {
      if (txType === 'DEPOSIT') await addDeposit(account.id, txAmount, txDesc);
      else await addWithdrawal(account.id, txAmount, txDesc);
      setShowModal(false);
      setTxAmount(''); setTxDesc('');
    } finally { setIsSaving(false); }
  };

  const getIcon = (type, amount) => {
    if (type === 'INITIAL_BALANCE') return <Wallet className="w-4 h-4 text-blue-400" />;
    if (type === 'DEPOSIT') return <ArrowDownCircle className="w-4 h-4 text-emerald-400" />;
    if (type === 'WITHDRAWAL') return <ArrowUpCircle className="w-4 h-4 text-red-400" />;
    return amount >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  if (!account) return null;

  return (
    <div className="min-h-screen p-6 animate-in fade-in">
      {/* HEADER */}
      <div className="mb-8">
        <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-6 h-6 text-blue-500" /> {account.name}
            </h1>
            <p className="text-slate-500">{account.broker} • {account.currency}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setTxType('DEPOSIT'); setShowModal(true); }} className="btn-primary flex gap-2"><Plus className="w-4 h-4"/> Aporte</button>
            <button onClick={() => { setTxType('WITHDRAWAL'); setShowModal(true); }} className="btn-secondary flex gap-2 text-red-400 border-red-500/30"><Minus className="w-4 h-4"/> Saque</button>
          </div>
        </div>
      </div>

      {/* EXTRATO CARD */}
      <div className="glass-card">
        {/* BARRA DE FERRAMENTAS */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-start gap-4">
          <div className="flex items-center gap-2 text-white font-bold min-w-[100px]">
            <History className="w-4 h-4"/> Extrato
          </div>
          
          <div className="h-6 w-px bg-slate-700 hidden md:block mx-2"></div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <Filter className="w-3 h-3 text-slate-400 ml-2"/>
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)} 
                className="bg-slate-800 text-white text-sm p-1 outline-none border-none cursor-pointer rounded"
              >
                <option value="today">Hoje</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mês</option>
                <option value="year">Este Ano</option>
                <option value="custom">Personalizado</option>
                <option value="all">Todo o Período</option>
              </select>
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 flex-1 md:flex-none">
                <div className="relative group">
                  <input 
                    type="date" 
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-slate-800 text-white text-sm p-1.5 rounded border border-slate-700 outline-none focus:border-blue-500 w-[130px]"
                  />
                  {!customStart && (
                    <span className="absolute left-2 top-1.5 text-xs text-slate-500 pointer-events-none bg-slate-800 px-1">
                      De: Início
                    </span>
                  )}
                </div>
                
                <span className="text-slate-500 text-xs">até</span>
                
                <div className="relative group">
                  <input 
                    type="date" 
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-slate-800 text-white text-sm p-1.5 rounded border border-slate-700 outline-none focus:border-blue-500 w-[130px]"
                  />
                  {!customEnd && (
                    <span className="absolute left-2 top-1.5 text-xs text-slate-500 pointer-events-none bg-slate-800 px-1">
                      Até: Hoje
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TABELA */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto"/></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
                <tr>
                  <th className="p-4 w-32">Data</th>
                  {/* [AJUSTE UI]: w-32 -> w-40 para mais respiro no Tipo */}
                  <th className="p-4 w-40">Tipo</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4 text-right">Valor</th>
                  <th className="p-4 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                
                {/* LINHA DE SALDO ANTERIOR */}
                {hasFilter && (
                  <tr className="bg-slate-800/20 border-b border-slate-700/50">
                    <td className="p-4"></td> 
                    <td className="p-4"></td> 
                    <td className="p-4 text-slate-300 italic">
                      Saldo Anterior
                    </td>
                    <td className={`p-4 text-right font-mono italic font-bold ${startBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(startBalance, account.currency)}
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500 italic font-bold">
                      {formatCurrency(startBalance, account.currency)}
                    </td>
                  </tr>
                )}

                {/* MOVIMENTOS */}
                {visibleData.map(mov => (
                  <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-slate-300 whitespace-nowrap">{formatDate(mov.date)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getIcon(mov.type, mov.normalizedAmount)}
                        <span className="text-slate-400 text-xs">{translateType(mov.type)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-white">{mov.description}</td>
                    <td className={`p-4 text-right font-mono font-medium ${mov.normalizedAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {mov.normalizedAmount >= 0 ? '+' : ''}{formatCurrency(mov.normalizedAmount, account.currency)}
                    </td>
                    <td className="p-4 text-right font-mono text-slate-300 font-bold">
                      {formatCurrency(mov.balanceAfter, account.currency)}
                    </td>
                  </tr>
                ))}
                
                {visibleData.length === 0 && !hasFilter && (
                  <tr><td colSpan="5" className="p-8 text-center text-slate-500">Nenhum movimento registrado.</td></tr>
                )}
              </tbody>
              
              {/* RODAPÉ TOTALIZADOR */}
              <tfoot className="bg-slate-800/80 border-t-2 border-slate-700">
                <tr>
                  <td colSpan="3" className="p-4 text-right text-slate-400 font-medium uppercase text-xs tracking-wider">
                    Saldo Final do Período
                  </td>
                  <td className={`p-4 text-right font-mono font-bold ${visibleData.reduce((acc, m) => acc + m.normalizedAmount, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {visibleData.reduce((acc, m) => acc + m.normalizedAmount, 0) > 0 ? '+' : ''}
                    {formatCurrency(visibleData.reduce((acc, m) => acc + m.normalizedAmount, 0), account.currency)}
                  </td>
                  <td className="p-4 text-right font-mono text-white font-bold text-lg">
                    {formatCurrency(endBalance, account.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* MODAL TRANSAÇÃO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">{txType === 'DEPOSIT' ? 'Novo Aporte' : 'Nova Retirada'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Valor</label>
                <input type="number" autoFocus value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none text-lg"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Descrição</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Ex: Aporte Mensal" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"/>
              </div>
              <button onClick={handleSaveTx} disabled={isSaving || !txAmount} className={`w-full py-3 rounded-lg font-bold mt-2 ${txType === 'DEPOSIT' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} text-white transition-colors`}>
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDetailPage;