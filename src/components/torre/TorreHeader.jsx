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
 *
 * VISUAL: o número manda, mas o rótulo precisa ser lido. Antes o valor tinha 30px
 * e o rótulo 9px em caixa alta espremida — salto de três vezes sem degrau no meio,
 * e a etiqueta virava textura. A escala agora é 28 / 13 / 11, e a cor entra só num
 * ponto de 5px: três tiles com fundo colorido competem entre si e nenhum vence.
 */
import { Users, AlertTriangle, Zap } from 'lucide-react';

const COR = {
  slate: 'var(--ink-3)',
  amber: 'var(--warn)',
  red: 'var(--neg)',
  emerald: 'var(--pos)',
  blue: 'var(--info)',
};

const Tile = ({ icon: Icon, valor, sufixo, label, detalhe, tone = 'slate', ativo, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title || undefined}
    className="group text-left px-4 py-3.5 transition-colors"
    style={{
      background: ativo ? 'var(--surface-2)' : 'var(--surface)',
      border: `1px solid ${ativo ? 'var(--accent-line)' : 'var(--line)'}`,
      borderRadius: 'var(--r)',
    }}
  >
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: 'var(--ink-4)' }} />
      <span className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{label}</span>
      {tone !== 'slate' && (
        <span className="w-[5px] h-[5px] rounded-full ml-auto" style={{ background: COR[tone] }} />
      )}
    </div>

    <div className="flex items-baseline gap-1.5 mt-2">
      <span
        className="text-[28px] font-semibold leading-none tabular"
        style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
      >
        {valor}
      </span>
      {sufixo && <span className="text-[13px]" style={{ color: 'var(--ink-4)' }}>{sufixo}</span>}
    </div>

    {detalhe && <div className="text-[11px] mt-1.5" style={{ color: 'var(--ink-4)' }}>{detalhe}</div>}
  </button>
);

const TorreHeader = ({ header, filtro, onFiltrar }) => {
  const {
    alunosAtivos = 0, operaramHoje = 0, tradesHoje = 0,
    foraDoPlano = null, tradesSemana = 0, precisamDeVoce = 0, pendencias = 0,
  } = header ?? {};

  const alterna = (nome) => () => onFiltrar?.(filtro === nome ? null : nome);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Tile
        icon={Users}
        valor={operaramHoje}
        sufixo={`de ${alunosAtivos}`}
        label="Operaram hoje"
        detalhe={tradesHoje ? `${tradesHoje} ${tradesHoje === 1 ? 'trade' : 'trades'}` : 'nenhum trade hoje'}
        tone="slate"
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
