/**
 * DetalheDoAluno — o material bruto, agora legível (issue #101).
 *
 * Marcio, 29/08: *"Análise por setup e emocional ainda trazendo tudo emaranhado,
 * não gosto"*. Dobrar não bastou: os dois componentes antigos eram grades de
 * cards densos, com cinco a sete métricas cada, sem hierarquia entre elas.
 *
 * Aqui cada dimensão é UMA TABELA, ordenada por impacto, com quatro colunas: o
 * quê, quantos trades, quanto acerta, quanto custa ou entrega em R. É a mesma
 * agregação que alimenta o Plano de Conversa — nada é recalculado por outro
 * caminho, então a tela não pode discordar de si mesma.
 *
 * O QUE SAIU DO PERFIL EMOCIONAL, e por quê:
 *   - score 68/100 → nota de prova. Para o aluno gera defesa, não mudança; para o
 *     mentor não tem alavanca acoplada. Só teria uso comparado entre ciclos.
 *   - distribuição positivas/neutras/negativas → descreve sem cruzar com
 *     resultado. "40% das entradas foram negativas" não diz se elas custaram.
 *   - evolução diária do score → gráfico de um número que não gera ação.
 *   - top emoções por frequência → ranking sem resultado cruzado.
 *   - linha do tempo de alertas → SOBREVIVE: evento com data vira conversa e
 *     vira regra. É a base da coluna "Episódios".
 */
import { formatCurrencyDynamic } from '../../utils/currency';

const Valor = ({ g }) => {
  const cor = (g.comR ? g.r : g.pl) >= 0 ? 'text-emerald-400' : 'text-red-400';
  const texto = g.comR > 0
    ? `${g.r >= 0 ? '+' : ''}${g.r.toFixed(1)}R`
    : g.moedaUnica
      ? formatCurrencyDynamic(g.pl, g.moedaUnica)
      : '—';
  return <span className={`font-mono font-bold ${cor}`}>{texto}</span>;
};

const Tabela = ({ titulo, rotuloChave, grupos = [] }) => (
  <div className="glass-card overflow-hidden">
    <div className="p-3 border-b border-slate-800/50 flex items-baseline justify-between">
      <h4 className="font-semibold text-white text-sm">{titulo}</h4>
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">por impacto</span>
    </div>
    {grupos.length === 0 ? (
      <p className="p-6 text-center text-xs text-slate-600">sem dados no período</p>
    ) : (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
            <th className="px-3 py-2 font-bold">{rotuloChave}</th>
            <th className="px-3 py-2 font-bold text-right">Trades</th>
            <th className="px-3 py-2 font-bold text-right">Acerto</th>
            <th className="px-3 py-2 font-bold text-right">Impacto</th>
          </tr>
        </thead>
        {/* Sem hover nas linhas: elas não levam a lugar nenhum, e afordância que não
            cumpre é o que faz a tela parecer quebrada. */}
        <tbody className="divide-y divide-slate-800/50 text-sm">
          {grupos.map((g) => (
            <tr key={g.chave}>
              <td className="px-3 py-2 text-slate-200">
                {g.chave}
                {g.n < 3 && <span className="text-[10px] text-slate-600 ml-1.5">amostra {g.n}</span>}
              </td>
              <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{g.n}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={g.wr >= 50 ? 'text-slate-300' : 'text-slate-500'}>{g.wr}%</span>
              </td>
              <td className="px-3 py-2 text-right"><Valor g={g} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const Episodios = ({ lista = [], onEscolherDia }) => (
  <div className="glass-card overflow-hidden">
    <div className="p-3 border-b border-slate-800/50 flex items-baseline justify-between">
      <h4 className="font-semibold text-white text-sm">Episódios</h4>
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">clique para abrir o dia</span>
    </div>
    {lista.length === 0 ? (
      <p className="p-6 text-center text-xs text-slate-600">nenhum episódio registrado</p>
    ) : (
      <div className="divide-y divide-slate-800/50 max-h-[280px] overflow-y-auto">
        {lista.map((e) => (
          <button
            key={e.data}
            onClick={() => onEscolherDia?.(e.data)}
            className="w-full text-left px-3 py-2 flex items-start justify-between gap-3 hover:bg-slate-800/30 transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-sm text-slate-200 font-mono">
                {e.data.split('-').reverse().join('/')}
              </div>
              <div className="text-[11px] text-slate-500">{e.marcas.join(' · ')}</div>
            </div>
            <div className="text-right flex-shrink-0">
              {e.r != null && (
                <div className={`font-mono text-sm font-bold ${e.r >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {e.r >= 0 ? '+' : ''}{e.r.toFixed(1)}R
                </div>
              )}
              <div className="text-[10px] text-slate-600">{e.trades} {e.trades === 1 ? 'trade' : 'trades'}</div>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const DetalheDoAluno = ({ diagnostico, episodios: listaEpisodios = [], onEscolherDia }) => {
  if (!diagnostico) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
      <Tabela titulo="Por setup" rotuloChave="Setup" grupos={diagnostico.setups.todos} />
      <Tabela titulo="Por estado emocional" rotuloChave="Estado na entrada" grupos={diagnostico.emocoes.todos} />
      <Episodios lista={listaEpisodios} onEscolherDia={onEscolherDia} />
    </div>
  );
};

export default DetalheDoAluno;
