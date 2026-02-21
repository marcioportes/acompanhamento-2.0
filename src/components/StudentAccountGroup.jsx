/**
 * StudentAccountGroup
 * @description Card individual por aluno — grid 3 colunas, estilo Dashboard do Mentor.
 *   Header com avatar gradiente + nome/email.
 *   Contas como rows compactos com ações Edit/Eye sempre visíveis.
 * @see version.js para versão do produto
 * 
 * CHANGELOG:
 * - 1.6.0: Redesign — card individual, avatar iniciais, expand com contas,
 *          botões Edit2 + Eye sempre visíveis, DebugBadge guideline
 */

import { useState } from 'react';
import { 
  ChevronDown, ChevronUp, User,
  TrendingUp, TrendingDown, Edit2, Eye, Wallet,
  CheckCircle
} from 'lucide-react';

const StudentAccountGroup = ({ 
  studentName, 
  studentEmail, 
  accounts = [],
  balancesByAccountId = {},
  onAccountClick,
  onEditAccount,
  getAccountBadge,
  formatCurrency
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Totais
  const totalBalance = accounts.reduce((sum, acc) => {
    return sum + (balancesByAccountId[acc.id] ?? acc.currentBalance ?? acc.initialBalance ?? 0);
  }, 0);
  const totalInitial = accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
  const totalPL = totalBalance - totalInitial;
  const isPositive = totalPL >= 0;
  const plPercent = totalInitial > 0 ? ((totalPL / totalInitial) * 100) : 0;

  // Iniciais do nome para avatar
  const initials = (studentName || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

  const getTypeConfig = (type) => {
    switch (type) {
      case 'REAL': return { label: 'Real', text: 'text-emerald-400', dot: 'bg-emerald-400' };
      case 'PROP': return { label: 'Prop', text: 'text-purple-400', dot: 'bg-purple-400' };
      default:     return { label: 'Demo', text: 'text-amber-400', dot: 'bg-amber-400' };
    }
  };

  return (
    <div className="glass-card p-4 transition-all hover:border-slate-600">
      {/* Header: Avatar + Nome + Métricas resumidas */}
      <div className="flex items-center gap-3 mb-4">
        {/* Avatar gradiente com iniciais */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {initials || <User className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{studentName}</p>
          <p className="text-xs text-slate-500 truncate">{studentEmail}</p>
        </div>
      </div>

      {/* Métricas em grid 2 colunas — estilo dos counters de Feedback */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Saldo Total */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-700/50">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-base font-bold text-white font-mono truncate">
              {formatCurrency(totalBalance, accounts[0]?.currency || 'BRL')}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">SALDO</p>
          </div>
        </div>

        {/* P&L */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-700/50">
          <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            {isPositive 
              ? <TrendingUp className="w-4 h-4 text-emerald-400" /> 
              : <TrendingDown className="w-4 h-4 text-red-400" />
            }
          </div>
          <div className="text-left">
            <p className={`text-base font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{plPercent.toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">P&L</p>
          </div>
        </div>
      </div>

      {/* Resumo: Contas + botão expandir */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Wallet className="w-3 h-3 text-blue-400" />
            {accounts.length} conta{accounts.length !== 1 ? 's' : ''}
          </span>
          {accounts.filter(a => a.active).length > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              {accounts.find(a => a.active)?.name}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-slate-800/50"
        >
          {isExpanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Fechar</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Detalhes</>
          )}
        </button>
      </div>

      {/* Contas expandidas */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/50 space-y-1.5">
          {accounts.map((acc) => {
            const saldoInicial = acc.initialBalance || 0;
            const saldoAtual = balancesByAccountId[acc.id] ?? acc.currentBalance ?? saldoInicial;
            const profit = saldoAtual - saldoInicial;
            const isProfitable = profit >= 0;
            const isSolvent = saldoAtual >= 0;
            const typeConfig = getTypeConfig(acc.type || (acc.isReal ? 'REAL' : 'DEMO'));

            return (
              <div
                key={acc.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group/row"
              >
                {/* Tipo */}
                <div className="flex items-center gap-1.5 flex-shrink-0 w-[48px]">
                  <div className={`w-1.5 h-1.5 rounded-full ${typeConfig.dot}`} />
                  <span className={`text-[10px] font-bold uppercase ${typeConfig.text}`}>
                    {typeConfig.label}
                  </span>
                </div>

                {/* Nome + Broker */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white truncate">{acc.name}</span>
                    {acc.active && <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    {acc.broker || acc.brokerName || 'Sem corretora'}
                  </p>
                </div>

                {/* Saldo */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-bold font-mono ${isSolvent ? 'text-white' : 'text-red-400'}`}>
                    {formatCurrency(saldoAtual, acc.currency)}
                  </p>
                  <p className={`text-[10px] font-mono ${isProfitable ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                    {isProfitable ? '+' : ''}{formatCurrency(profit, acc.currency)}
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {onEditAccount && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditAccount(acc); }}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 group-hover/row:text-slate-400 transition-colors"
                      title="Editar / Auditoria"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onAccountClick && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAccountClick(acc); }}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 group-hover/row:text-slate-400 transition-colors"
                      title="Ver extrato"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentAccountGroup;
