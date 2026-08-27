/**
 * TorreHeader — S1 da Torre de Controle (issue #101, Fase A)
 *
 * Quatro números que respondem "o que exige minha atenção agora?": quem está no
 * radar, quem disparou alerta hoje, quanto do dia saiu do plano e como os
 * períodos fecharam.
 *
 * VOCABULÁRIO: segue o extrato do plano (`ExtractSummary`) — a superfície onde a
 * plataforma já fala de meta e stop. Lá não existe "percentual de progresso":
 * existe Meta/Stop em dinheiro e um campo Estado com o veredicto. Por isso o
 * quarto tile conta ESTADO, não média de progresso.
 *
 * Todos os números vêm de `useMentorRiskRadar`; este componente não calcula nada.
 */
import { Users, AlertTriangle, Zap, Target } from 'lucide-react';

const Tile = ({ icon: Icon, valor, label, detalhe, tone = 'slate', title }) => {
  const cor = {
    slate: 'text-slate-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
  }[tone];

  return (
    <div
      className="bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4"
      title={title || undefined}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${cor}`} />
        <span className="text-3xl font-bold text-white leading-none tabular-nums">{valor}</span>
      </div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-2">{label}</div>
      {detalhe && <div className="text-[11px] text-slate-400 mt-1">{detalhe}</div>}
    </div>
  );
};

const TorreHeader = ({ header }) => {
  const {
    alunosAtivos = 0,
    operaramHoje = 0,
    comAlerta = 0,
    flagsTotal = 0,
    foraDoPlano = null,
    tradesHoje = 0,
    estados = {},
  } = header ?? {};

  const { meta = 0, stop = 0, seguiuDepois = 0, emAndamento = 0 } = estados;

  // Não medir não é estar limpo: sem trade no dia o tile não afirma 0%.
  const foraLabel = foraDoPlano == null ? '—' : `${Math.round(foraDoPlano)}%`;

  // O quarto tile lidera pelo desfecho do dia; o que exige conversa —
  // ter continuado operando depois da meta ou do stop — vem na segunda linha.
  const desfecho = [
    meta ? `${meta} meta` : null,
    stop ? `${stop} stop` : null,
    emAndamento ? `${emAndamento} em andamento` : null,
  ].filter(Boolean).join(' · ') || 'ninguém operou hoje';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Tile
        icon={Users}
        valor={alunosAtivos}
        label="Alunos Ativos"
        detalhe={`${operaramHoje} operaram hoje`}
        tone="blue"
        title="Acesso à plataforma + assinatura viva. Quem entra em bloqueio sai do radar."
      />
      <Tile
        icon={AlertTriangle}
        valor={comAlerta}
        label="Alertas"
        detalhe={flagsTotal ? `${flagsTotal} ${flagsTotal === 1 ? 'violação' : 'violações'} hoje` : 'nenhuma violação hoje'}
        tone={comAlerta > 0 ? 'amber' : 'slate'}
        title="Alunos com ao menos uma violação efetiva hoje — já descontadas as liberadas pelo mentor."
      />
      <Tile
        icon={Zap}
        valor={foraLabel}
        label="Fora do Plano"
        detalhe={tradesHoje ? `de ${tradesHoje} ${tradesHoje === 1 ? 'trade' : 'trades'} hoje` : 'sem trades hoje'}
        tone={foraDoPlano > 0 ? 'red' : 'slate'}
        title="Percentual dos trades de hoje com violação, medido trade a trade."
      />
      <Tile
        icon={Target}
        valor={seguiuDepois}
        label="Seguiram após meta/stop"
        detalhe={desfecho}
        tone={seguiuDepois > 0 ? 'red' : 'emerald'}
        title="Alunos que continuaram operando depois de bater a meta ou o stop do período."
      />
    </div>
  );
};

export default TorreHeader;
