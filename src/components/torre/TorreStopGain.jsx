/**
 * TorreStopGain — S5 da Torre (issue #101, Fase C · MC-8)
 *
 * A semana da turma: barras de CONTAGEM por dia útil (verde ganho, vermelho
 * perda) e o líquido em R.
 *
 * Contagem, não dinheiro, pelo mesmo motivo do calendário: a turma opera em duas
 * moedas. E o líquido em R porque R é adimensional — quantas vezes o próprio
 * risco autorizado do aluno o resultado representa. É a única unidade em que o
 * dia de quem opera 30 mil em real e o de quem opera 50 mil em dólar somam.
 *
 * SVG puro: a Torre não carrega biblioteca de gráfico para cinco barras.
 */
import { TrendingUp } from 'lucide-react';

/** Altura do gráfico em pixels — ver a nota na renderização das barras. */
const ALTURA = 150;
const altura = (valor, maximo) => (valor > 0 ? Math.max(3, Math.round((valor / maximo) * (ALTURA - 34))) : 0);

const TorreStopGain = ({ stopGain }) => {
  const dias = stopGain?.dias ?? [];
  const liquidoR = stopGain?.liquidoR ?? 0;
  const semR = stopGain?.semR ?? 0;
  const total = stopGain?.total ?? 0;

  const maximo = Math.max(1, ...dias.map((d) => Math.max(d.gains, d.losses)));

  return (
    <div className="glass-card h-full flex flex-col">
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white">Stop × Gain</h3>
        </div>
        {total > 0 && (
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              liquidoR >= 0
                ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                : 'text-red-300 border-red-500/30 bg-red-500/10'
            }`}
            title="Líquido da semana em múltiplos do risco autorizado de cada aluno"
          >
            Liq: {liquidoR >= 0 ? '+' : ''}{liquidoR.toFixed(1)}R
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="p-8 text-center flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500">Nenhum trade nesta semana.</p>
        </div>
      ) : (
        <div className="p-4 flex-1 flex flex-col justify-end">
          {/* Altura em PIXELS, não em porcentagem: percentual só resolve contra pai
              com altura definida, e aqui o pai é um item de flex esticado — no
              navegador as barras vinham com 0px e o gráfico aparecia vazio, embora
              o DOM estivesse correto. Piso de 3px para que 1 trade seja visível. */}
          <div className="flex items-end justify-between gap-3" style={{ height: `${ALTURA}px` }}>
            {dias.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div className="flex items-end justify-center gap-1" style={{ height: `${ALTURA - 18}px` }}>
                  <div className="w-[18px] bg-emerald-500/70 rounded-t flex items-start justify-center"
                       style={{ height: `${altura(d.gains, maximo)}px` }}
                       title={`${d.gains} ${d.gains === 1 ? 'ganho' : 'ganhos'}`}>
                    {d.gains > 0 && <span className="text-[9px] text-emerald-100 -mt-4">{d.gains}</span>}
                  </div>
                  <div className="w-[18px] bg-red-500/70 rounded-t flex items-start justify-center"
                       style={{ height: `${altura(d.losses, maximo)}px` }}
                       title={`${d.losses} ${d.losses === 1 ? 'perda' : 'perdas'}`}>
                    {d.losses > 0 && <span className="text-[9px] text-red-100 -mt-4">{d.losses}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>

          {/* Honestidade sobre o que não entrou no R: sem plano, sem unidade. */}
          {semR > 0 && (
            <p className="text-[10px] text-slate-600 mt-3 text-center">
              {semR} de {total} {semR === 1 ? 'trade fora do líquido' : 'trades fora do líquido'} — sem plano com risco declarado
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TorreStopGain;
