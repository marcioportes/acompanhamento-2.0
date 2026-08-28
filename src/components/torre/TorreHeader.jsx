/**
 * TorreHeader — S1 da Torre (issue #101)
 *
 * Três números, e só os que geram decisão. Saíram: "P&L Total Turma" e "Win Rate
 * Médio" (média de turma não decide nada), "Alertas" (virou coluna da turma) e
 * "Seguiram após meta/stop" (idem). O tile "Fora do Plano" media HOJE enquanto a
 * seção media a SEMANA — dois números, um nome, na mesma tela. Agora é semana nos
 * dois lugares.
 *
 * Cada tile é um filtro da lista da turma: contador que não clica é decoração.
 */
import { Users, AlertTriangle, Zap } from 'lucide-react';

const Tile = ({ icon: Icon, valor, sufixo, label, detalhe, tone = 'slate', ativo, onClick, title }) => {
  const cor = { slate: 'text-slate-400', amber: 'text-amber-400', red: 'text-red-400', emerald: 'text-emerald-400', blue: 'text-blue-400' }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || undefined}
      className={`text-left bg-slate-900/60 border rounded-xl px-5 py-4 transition-colors ${
        ativo ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <Icon className={`w-4 h-4 ${cor} self-center`} />
        <span className="text-3xl font-bold text-white leading-none tabular-nums">{valor}</span>
        {sufixo && <span className="text-sm text-slate-500">{sufixo}</span>}
      </div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-2">{label}</div>
      {detalhe && <div className="text-[11px] text-slate-400 mt-1">{detalhe}</div>}
    </button>
  );
};

const TorreHeader = ({ header, filtro, onFiltrar }) => {
  const {
    alunosAtivos = 0, operaramHoje = 0, tradesHoje = 0,
    foraDoPlano = null, tradesSemana = 0, precisamDeVoce = 0, pendencias = 0,
  } = header ?? {};

  const alterna = (nome) => () => onFiltrar?.(filtro === nome ? null : nome);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Tile
        icon={Users}
        valor={operaramHoje}
        sufixo={`de ${alunosAtivos}`}
        label="Operaram hoje"
        detalhe={tradesHoje ? `${tradesHoje} ${tradesHoje === 1 ? 'trade' : 'trades'}` : 'nenhum trade hoje'}
        tone="blue"
        ativo={filtro === 'hoje'}
        onClick={alterna('hoje')}
        title="Alunos com acesso e assinatura viva que registraram operação hoje"
      />
      <Tile
        icon={AlertTriangle}
        valor={precisamDeVoce}
        sufixo={`de ${alunosAtivos}`}
        label="Precisam de você"
        detalhe={pendencias > 0 ? `${pendencias} ${pendencias === 1 ? 'feedback pendente' : 'feedbacks pendentes'}` : 'nenhum feedback pendente'}
        tone={precisamDeVoce > 0 ? 'amber' : 'emerald'}
        ativo={filtro === 'atencao'}
        onClick={alterna('atencao')}
        title="Ação hoje, sumidos, risco alto e fora do plano — as quatro primeiras faixas da lista"
      />
      <Tile
        icon={Zap}
        valor={foraDoPlano == null ? '—' : `${Math.round(foraDoPlano)}%`}
        label="Fora do plano · semana"
        detalhe={tradesSemana ? `de ${tradesSemana} ${tradesSemana === 1 ? 'trade' : 'trades'} na semana` : 'sem trades na semana'}
        tone={foraDoPlano > 0 ? 'red' : 'slate'}
        ativo={filtro === 'fora'}
        onClick={alterna('fora')}
        title="Percentual dos trades da semana com violação de plano, medido trade a trade"
      />
    </div>
  );
};

export default TorreHeader;
