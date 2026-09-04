/**
 * TorrePendencias — S3 da Torre: o que EU devo (issue #144, Fase B2)
 *
 * A faixa existia com duas caixas (revisões e feedback) desenhadas de formas
 * diferentes — uma era um card que sumia sozinho, a outra um botão feito à mão.
 * A terceira, Fechamentos, só existia como item de menu e sumiu junto com ele.
 *
 * Agora são três linhas iguais, e nenhuma some: contador zerado fica cinza e sem
 * link, porque a caixa vazia é informação — "não tem nada esperando por mim" é
 * diferente de "essa caixa não existe".
 */
import { ChevronRight, FileText, Inbox, MessageSquare } from 'lucide-react';

const Linha = ({ icon: Icon, titulo, detalhe, contador, onAbrir }) => {
  const vazia = !contador;
  const conteudo = (
    <>
      <div className={`p-2 rounded-lg shrink-0 ${vazia ? 'bg-slate-800/60' : 'bg-amber-500/10'}`}>
        <Icon className={`w-5 h-5 ${vazia ? 'text-slate-600' : 'text-amber-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{titulo}</div>
        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{detalhe}</div>
      </div>
      {vazia ? (
        <span className="text-[11px] text-slate-600 shrink-0">nada aqui</span>
      ) : (
        <>
          <span className="text-lg font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full shrink-0">
            {contador}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        </>
      )}
    </>
  );

  if (vazia) {
    return <div className="glass-card w-full p-4 flex items-center gap-3 opacity-60">{conteudo}</div>;
  }
  return (
    <button
      onClick={onAbrir}
      className="glass-card w-full p-4 flex items-center gap-3 hover:bg-slate-800/40 transition-colors text-left"
    >
      {conteudo}
    </button>
  );
};

const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

const TorrePendencias = ({
  revisoes = { total: 0, alunosComRascunho: [] },
  feedbacksPendentes = 0,
  fechamentosPendentes = 0,
  onAbrirRevisoes,
  onAbrirFeedback,
  onAbrirFechamentos,
}) => {
  const { total: totalRevisoes, alunosComRascunho } = revisoes;

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
        Minhas pendências
      </h3>

      <Linha
        icon={FileText}
        titulo="Revisões a fazer"
        detalhe={
          totalRevisoes === 0
            ? 'nenhum rascunho aberto'
            : alunosComRascunho.length === 1
              ? `${alunosComRascunho[0].name || alunosComRascunho[0].email} — ${plural(totalRevisoes, 'rascunho', 'rascunhos')} para publicar`
              : `${plural(alunosComRascunho.length, 'aluno', 'alunos')} com rascunho aberto`
        }
        contador={totalRevisoes}
        onAbrir={onAbrirRevisoes}
      />

      <Linha
        icon={MessageSquare}
        titulo="Aguardando feedback"
        detalhe={
          feedbacksPendentes === 0
            ? 'nenhum trade esperando por você'
            : `${plural(feedbacksPendentes, 'trade espera', 'trades esperam')} por você`
        }
        contador={feedbacksPendentes}
        onAbrir={onAbrirFeedback}
      />

      <Linha
        icon={Inbox}
        titulo="Fechamentos a aprovar"
        detalhe={
          fechamentosPendentes === 0
            ? 'nenhum ciclo esperando sua leitura'
            : `${plural(fechamentosPendentes, 'ciclo fechado', 'ciclos fechados')} sem comentário seu`
        }
        contador={fechamentosPendentes}
        onAbrir={onAbrirFechamentos}
      />
    </div>
  );
};

export default TorrePendencias;
