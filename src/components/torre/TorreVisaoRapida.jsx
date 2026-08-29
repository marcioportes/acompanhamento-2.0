/**
 * TorreVisaoRapida — S6 da Torre (issue #101, Fase D · MC-9)
 *
 * O retrato de um aluno no trilho direito: saldo, líquido em R, meta do período,
 * drawdown e winrate. Todos vindos das SSoT que já existem — planBalance,
 * planLedger e o motor do dia do #402 — sem fórmula nova.
 *
 * Sempre de UM plano. Aluno com duas contas tem dois retratos, e a conta em foco
 * é a do dia (ou a mais recente): misturar as duas repetiria o erro que a D12
 * corrigiu no estado do dia.
 */
import { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';

const Linha = ({ rotulo, valor, cor = 'text-white', titulo }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0" title={titulo}>
    <span className="text-xs text-slate-500">{rotulo}</span>
    <span className={`text-sm font-mono font-bold ${cor}`}>{valor}</span>
  </div>
);

const TorreVisaoRapida = ({ byStudent = [], currency = 'BRL', onAbrirAluno }) => {
  const comRetrato = byStudent.filter((a) => a.visaoRapida);
  const [selecionado, setSelecionado] = useState(null);

  // #101 — começa SEM aluno. Escolher o primeiro da lista por conta própria dá ao
  // mentor um retrato que ele não pediu, sobre alguém que ele não escolheu — e o
  // número fica lá parecendo o da turma. Quem escolhe é ele.
  const emFoco = comRetrato.find((a) => a.studentId === selecionado) ?? null;

  useEffect(() => {
    if (selecionado && !comRetrato.some((a) => a.studentId === selecionado)) setSelecionado(null);
  }, [comRetrato, selecionado]);

  const seletor = (
    <div className="relative">
      <select
        value={emFoco?.studentId ?? ''}
        onChange={(e) => setSelecionado(e.target.value || null)}
        className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-blue-500/50"
      >
        <option value="">Escolha um aluno…</option>
        {comRetrato.map((a) => (
          <option key={a.studentId} value={a.studentId}>
            {a.name}{a.visaoRapida.planName ? ` · ${a.visaoRapida.planName}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );

  if (!emFoco) {
    return (
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800/50">
          <h3 className="font-semibold text-white text-sm mb-3">Visão Rápida por Aluno</h3>
          {seletor}
        </div>
        <div className="p-8 text-center">
          <User className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {comRetrato.length ? 'Escolha um aluno para ver o retrato.' : 'Nenhum aluno com plano ativo.'}
          </p>
        </div>
      </div>
    );
  }

  const v = emFoco.visaoRapida;
  const fmt = (n) => formatCurrencyDynamic(n, currency);

  return (
    <div className="glass-card">
      <div className="p-4 border-b border-slate-800/50">
        <h3 className="font-semibold text-white text-sm mb-3">Visão Rápida por Aluno</h3>
        {seletor}
      </div>

      <div className="p-4">
        <div className="mb-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Saldo atual</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-white">{fmt(v.saldoAtual)}</span>
            {v.liquidoR != null && (
              <span className={`text-sm font-mono font-bold ${v.saldoCiclo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {v.liquidoR >= 0 ? '+' : ''}{v.liquidoR.toFixed(1)}R
              </span>
            )}
          </div>
        </div>

        {v.metaPercent != null && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500">Meta {v.periodo === 'Semanal' ? 'semanal' : 'do dia'}</span>
              <span className={v.metaPercent >= 100 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {v.metaPercent}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${v.metaPercent >= 100 ? 'bg-emerald-500' : v.metaPercent < 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, Math.abs(v.metaPercent))}%` }}
              />
            </div>
          </div>
        )}

        <Linha
          rotulo="Drawdown máx."
          valor={v.drawdown > 0 ? `${fmt(v.drawdown)}${v.drawdownPercent != null ? ` (${v.drawdownPercent}%)` : ''}` : '—'}
          cor={v.drawdownPercent >= 10 ? 'text-red-400' : 'text-amber-400'}
          titulo="Maior queda do pico ao vale no ciclo, em ordem cronológica"
        />
        <Linha
          rotulo="Winrate"
          valor={`${v.winRate}%`}
          cor={v.winRate >= 50 ? 'text-emerald-400' : 'text-slate-300'}
        />
        <Linha rotulo="Trades no ciclo" valor={v.trades} cor="text-slate-300" />

        <button
          onClick={() => onAbrirAluno?.({ email: emFoco.email, name: emFoco.name, studentId: emFoco.studentId })}
          className="w-full mt-4 text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/50 transition-colors"
        >
          Abrir ficha de {emFoco.name?.split(' ')[0]}
        </button>
      </div>
    </div>
  );
};

export default TorreVisaoRapida;
