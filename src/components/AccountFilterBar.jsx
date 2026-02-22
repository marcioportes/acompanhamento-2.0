/**
 * AccountFilterBar
 * @version 1.0.0
 * @description Filtro master de contas: Todas, Todas Reais, Todas Demo, ou conta individual.
 *              Componente reutilizável para StudentDashboard e StudentFeedbackPage.
 * 
 * PROPS:
 * @param {Array} accounts - Lista completa de contas do aluno
 * @param {string} accountTypeFilter - 'all' | 'real' | 'demo'
 * @param {Function} onAccountTypeChange - Setter para tipo (all/real/demo)
 * @param {string} selectedAccountId - 'all' ou ID de conta específica
 * @param {Function} onAccountSelect - Setter para conta individual
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Wallet, ChevronDown, CheckCircle, ShieldCheck, FlaskConical } from 'lucide-react';

const isRealAccount = (acc) => acc.type === 'REAL' || acc.type === 'PROP' || acc.isReal === true;
const isDemoAccount = (acc) => acc.type === 'DEMO' || acc.isReal === false || acc.isReal === undefined;

const AccountFilterBar = ({
  accounts = [],
  accountTypeFilter = 'all',
  onAccountTypeChange,
  selectedAccountId = 'all',
  onAccountSelect
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const realAccounts = useMemo(() => accounts.filter(isRealAccount), [accounts]);
  const demoAccounts = useMemo(() => accounts.filter(isDemoAccount), [accounts]);

  // Conta selecionada (se individual)
  const selectedAccount = selectedAccountId !== 'all'
    ? accounts.find(a => a.id === selectedAccountId)
    : null;

  // Label do botão dropdown
  const dropdownLabel = useMemo(() => {
    if (selectedAccount) return selectedAccount.name;
    if (accountTypeFilter === 'real') return `Reais (${realAccounts.length})`;
    if (accountTypeFilter === 'demo') return `Demo (${demoAccounts.length})`;
    return `Todas (${accounts.length})`;
  }, [selectedAccount, accountTypeFilter, accounts.length, realAccounts.length, demoAccounts.length]);

  const handleTypeChange = (type) => {
    // Toggle: clicar no mesmo tipo volta para 'all'
    const newType = (accountTypeFilter === type) ? 'all' : type;
    onAccountTypeChange(newType);
    onAccountSelect('all');
  };

  const handleSelectAccount = (accountId) => {
    // Detectar tipo da conta e ajustar o filtro de tipo
    const acc = accounts.find(a => a.id === accountId);
    if (acc) {
      if (isRealAccount(acc)) onAccountTypeChange('real');
      else onAccountTypeChange('demo');
    }
    onAccountSelect(accountId);
    setShowDropdown(false);
  };

  const handleSelectAll = () => {
    onAccountSelect('all');
    setShowDropdown(false);
  };

  // Contas visíveis no dropdown baseadas no tipo selecionado
  const visibleAccounts = useMemo(() => {
    if (accountTypeFilter === 'real') return realAccounts;
    if (accountTypeFilter === 'demo') return demoAccounts;
    return accounts;
  }, [accounts, realAccounts, demoAccounts, accountTypeFilter]);

  const getTypeColor = (type) => {
    if (type === 'REAL' || type === 'PROP') return 'emerald';
    return 'blue';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Tipo buttons: Todas | Reais | Demo */}
      <div className="flex bg-slate-800/60 rounded-xl p-0.5 border border-slate-700/40">
        {[
          { id: 'all', label: 'Todas', icon: Wallet },
          { id: 'real', label: 'Reais', icon: ShieldCheck },
          { id: 'demo', label: 'Demo', icon: FlaskConical },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => handleTypeChange(opt.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              accountTypeFilter === opt.id
                ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <opt.icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Dropdown: conta individual */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
            selectedAccount
              ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
              : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span className="max-w-[160px] truncate">{dropdownLabel}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute top-full right-0 mt-1 w-72 bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl z-50 py-1 max-h-64 overflow-y-auto">
            {/* Opção "Todas do tipo" */}
            <button
              onClick={handleSelectAll}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                selectedAccountId === 'all'
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'hover:bg-slate-700/50 text-slate-300'
              }`}
            >
              <Wallet className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">
                {accountTypeFilter === 'real' ? 'Todas Reais' : accountTypeFilter === 'demo' ? 'Todas Demo' : 'Todas as Contas'}
              </span>
              {selectedAccountId === 'all' && <CheckCircle className="w-4 h-4 text-blue-400 ml-auto" />}
            </button>

            <div className="border-t border-slate-700/40 my-1" />

            {/* Contas individuais */}
            {visibleAccounts.map(acc => {
              const color = getTypeColor(acc.type);
              const isSelected = selectedAccountId === acc.id;
              const currSymbol = acc.currency === 'USD' ? '$' : acc.currency === 'EUR' ? '€' : 'R$';
              const balance = acc.currentBalance ?? acc.initialBalance ?? 0;

              return (
                <button
                  key={acc.id}
                  onClick={() => handleSelectAccount(acc.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-blue-500/15' : 'hover:bg-slate-700/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    color === 'emerald' ? 'bg-emerald-500/20' : 'bg-blue-500/20'
                  }`}>
                    <Wallet className={`w-4 h-4 ${color === 'emerald' ? 'text-emerald-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{acc.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {acc.type === 'REAL' ? 'Real' : acc.type === 'PROP' ? 'Prop' : 'Demo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500">{acc.broker}</span>
                      <span className="text-[11px] text-slate-600">·</span>
                      <span className="text-[11px] text-slate-500">{acc.currency || 'BRL'}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-mono text-slate-300 block">
                      {currSymbol} {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {isSelected && <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                </button>
              );
            })}

            {visibleAccounts.length === 0 && (
              <div className="px-4 py-3 text-center text-slate-500 text-sm">
                Nenhuma conta {accountTypeFilter === 'real' ? 'real' : accountTypeFilter === 'demo' ? 'demo' : ''} encontrada
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountFilterBar;
