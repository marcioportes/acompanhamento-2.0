/**
 * LembretesDaConversa — o que trazer para a revisão semanal (issue #408).
 *
 * Marcio, 30/08: *"na revisão semanal seria interessante ter algo para lembrar o
 * aluno na conversa"*.
 *
 * A revisão já lista os trades agrupados por dia, mas sem os FATOS do período:
 * qual era o stop, o que o plano autorizava, e o que o aluno fez depois de bater o
 * limite. Sem isso a conversa volta a ser trade a trade — o mesmo problema que a
 * fila de feedback resolveu do outro lado da tela.
 *
 * Os lembretes BONS aparecem junto com os ruins. "Bateu a meta e parou" é o que se
 * quer reforçar e nunca é dito, porque não gera alarme.
 *
 * Nada persiste: é derivado dos trades do período com o motor do #402.
 */
import { AlertTriangle, Ban, CheckCircle2, CalendarDays } from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';

const TOM = {
  alerta: { Icon: Ban, cor: 'text-red-400', borda: 'border-red-500/25 bg-red-500/[0.04]' },
  atencao: { Icon: AlertTriangle, cor: 'text-amber-400', borda: 'border-amber-500/25 bg-amber-500/[0.04]' },
  bom: { Icon: CheckCircle2, cor: 'text-emerald-400', borda: 'border-emerald-500/25 bg-emerald-500/[0.04]' },
};

const dataBR = (iso) => String(iso).split('-').reverse().join('/');

const LembretesDaConversa = ({ lembretes = [], multiplosPlanos = false }) => {
  if (lembretes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-center">
        <CheckCircle2 className="w-5 h-5 text-emerald-400/60 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Nenhum dia saiu do trilho neste período.</p>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Isso também é assunto de conversa — e costuma passar em branco.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lembretes.map((l) => {
        const tom = TOM[l.tom] ?? TOM.atencao;
        return (
          <div key={`${l.data}-${l.planId ?? 'sp'}-${l.titulo}`} className={`rounded-xl border p-3 ${tom.borda}`}>
            <div className="flex items-start gap-2.5">
              <tom.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tom.cor}`} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{l.titulo}</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {dataBR(l.data)}
                    {multiplosPlanos && l.planName && ` · ${l.planName}`}
                  </span>
                </div>
                <p className="text-[12px] text-slate-300 mt-1 leading-relaxed">{l.detalhe}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {l.trades} {l.trades === 1 ? 'operação' : 'operações'} ·{' '}
                  <span className={l.net >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {l.net >= 0 ? '+' : ''}{formatCurrencyDynamic(l.net, l.moeda ?? 'BRL')}
                  </span>
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LembretesDaConversa;
