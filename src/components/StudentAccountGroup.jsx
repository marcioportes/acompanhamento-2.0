import { useState } from 'react';
import { ChevronDown, ChevronRight, User, Mail, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

/**
 * Componente para agrupar contas de um aluno específico
 * Usado na visualização do mentor em AccountsPage
 */
const StudentAccountGroup = ({ 
  studentName, 
  studentEmail, 
  accounts = [],
  balancesByAccountId = {},
  onAccountClick,
  getAccountBadge,
  formatCurrency
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calcular totais do aluno
  const totalBalance = accounts.reduce((sum, acc) => {
    const saldoAtual = balancesByAccountId[acc.id] ?? acc.currentBalance ?? acc.initialBalance ?? 0;
    return sum + saldoAtual;
  }, 0);

  const totalInitial = accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
  const totalPL = totalBalance - totalInitial;
  const accountCount = accounts.length;

  // Determinar cor do P&L
  const plColor = totalPL >= 0 ? 'text-emerald-400' : 'text-red-400';
  const PlIcon = totalPL >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="mb-6">
      {/* Header do Grupo */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 
                   rounded-xl p-4 hover:bg-slate-800/70 transition-all duration-200
                   flex items-center justify-between group"
      >
        <div className="flex items-center gap-4 flex-1">
          {/* Ícone Expand/Collapse */}
          <div className="text-slate-400 group-hover:text-emerald-400 transition-colors">
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>

          {/* Info do Aluno */}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2 mb-1">
              <User size={18} className="text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">{studentName}</h3>
            </div>
            {studentEmail && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Mail size={14} />
                <span>{studentEmail}</span>
              </div>
            )}
          </div>

          {/* Métricas Resumidas */}
          <div className="flex gap-6 items-center">
            {/* Total de Contas */}
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Contas</p>
              <p className="text-lg font-bold text-white">{accountCount}</p>
            </div>

            {/* Saldo Total */}
            <div className="text-center min-w-[130px]">
              <p className="text-xs text-slate-400 mb-1">Saldo Total</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(totalBalance, accounts[0]?.currency || 'BRL')}
              </p>
            </div>

            {/* P&L Total */}
            <div className="text-center min-w-[150px]">
              <p className="text-xs text-slate-400 mb-1">P&L Total</p>
              <div className={`flex items-center justify-center gap-1 text-lg font-bold ${plColor}`}>
                <PlIcon size={18} />
                <span>
                  {formatCurrency(Math.abs(totalPL), accounts[0]?.currency || 'BRL')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Lista de Contas (Expandida) */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic bg-slate-800/20 rounded-lg">
              Nenhuma conta cadastrada para este aluno
            </div>
          ) : (
            accounts.map((acc) => {
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
                  onClick={() => onAccountClick?.(acc)}
                  className="relative bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 
                           rounded-lg p-4 hover:bg-slate-800/50 hover:border-emerald-500/30
                           transition-all duration-200 cursor-pointer group/card"
                >
                  {/* Badge de Tipo */}
                  {getAccountBadge(acc)}

                  {/* Nome e Broker */}
                  <div className="mb-3 pr-32">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-blue-400" />
                      <h4 className="text-white font-semibold group-hover/card:text-emerald-400 transition-colors">
                        {acc.name}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      {acc.broker || acc.brokerName || 'Broker não informado'}
                    </p>
                  </div>

                  {/* Saldos */}
                  <div className="space-y-2">
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

                  {/* Indicador de clique */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAccountGroup;
