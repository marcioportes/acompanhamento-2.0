/**
 * TorreForaDoPlano — S4 da Torre (issue #101, Fase C · MC-7)
 *
 * Ranking de adesão ao plano na SEMANA CORRENTE (D5). A fonte aqui é a red flag,
 * não o motor comportamental do Radar: são perguntas diferentes. "Saiu do plano"
 * é conformidade; "está em risco" é comportamento.
 *
 * A regra ao lado do nome é a violação mais REPETIDA da semana — a que o aluno
 * está repetindo, não a mais grave que cometeu uma vez.
 *
 * A seta compara com a semana anterior. Sem semana anterior, não há seta: seta
 * inventada é pior que seta ausente.
 */
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SETA = {
  up: { Icon: TrendingUp, cor: 'text-red-400', titulo: 'piorou em relação à semana passada' },
  down: { Icon: TrendingDown, cor: 'text-emerald-400', titulo: 'melhorou em relação à semana passada' },
  flat: { Icon: Minus, cor: 'text-slate-500', titulo: 'estável em relação à semana passada' },
};

const corDoPct = (pct) => (pct >= 30 ? 'text-red-400' : pct >= 15 ? 'text-amber-400' : 'text-slate-300');

const TorreForaDoPlano = ({ foraPlano = [], onAbrirAluno, maxVisible = 5 }) => (
  <div className="glass-card h-full">
    <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-400" />
        <h3 className="font-semibold text-white">Fora do Plano</h3>
      </div>
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">semana corrente</span>
    </div>

    {foraPlano.length === 0 ? (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500">Ninguém saiu do plano nesta semana.</p>
      </div>
    ) : (
      <div className="divide-y divide-slate-800/50">
        {foraPlano.slice(0, maxVisible).map((aluno) => {
          const f = aluno.foraDoPlanoSemana;
          const seta = f.direcao ? SETA[f.direcao] : null;
          return (
            <button
              key={aluno.studentId}
              onClick={() => onAbrirAluno?.({ email: aluno.email, name: aluno.name, studentId: aluno.studentId })}
              className="w-full p-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[11px] text-white font-bold flex-shrink-0">
                  {(aluno.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{aluno.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {f.regraPior ?? '—'} · {f.trades} {f.trades === 1 ? 'trade' : 'trades'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-sm font-bold tabular-nums ${corDoPct(f.pct)}`}>
                  {Math.round(f.pct)}%
                </span>
                {seta && <seta.Icon className={`w-3.5 h-3.5 ${seta.cor}`} title={seta.titulo} />}
              </div>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

export default TorreForaDoPlano;
