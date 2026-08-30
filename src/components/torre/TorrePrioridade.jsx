/**
 * TorrePrioridade — S2 da Torre (issue #101, Fase B · MC-5)
 *
 * Quem exige ação HOJE. Três gatilhos (D4): dia de fúria, além do stop, risco na
 * operação — nessa ordem de gravidade, que é a ordem em que a lista sai.
 *
 * AÇÃO (D9, resolvida 28/08): a Torre não age nem persiste. A recomendação é
 * texto; ao lado dela vão LINKS para onde a ação já mora — a ficha do aluno, onde
 * o bloqueio de login já existe com confirmação, e o WhatsApp do aluno. "Call
 * urgente" não vira botão: o telefone é o do WhatsApp, e ligar é offline.
 */
import { Flame, ShieldAlert, TrendingDown, MessageCircle, ArrowRight } from 'lucide-react';
import { TRIGGER } from '../../utils/mentorRiskRadar';

const GATILHO = {
  [TRIGGER.FURIA]: { icon: Flame, titulo: 'Dia de fúria', acao: 'Call urgente — considerar bloqueio' },
  [TRIGGER.ALEM_DO_STOP]: { icon: TrendingDown, titulo: 'Além do stop', acao: 'Call urgente — considerar bloqueio' },
  [TRIGGER.RISCO]: { icon: ShieldAlert, titulo: 'Risco na operação', acao: 'Alertar no WhatsApp' },
};

/** Só dígitos: o wa.me não aceita '+' nem separadores. */
const linkWhatsapp = (numero, texto) => {
  const limpo = String(numero ?? '').replace(/\D/g, '');
  if (!limpo) return null;
  return `https://wa.me/${limpo}?text=${encodeURIComponent(texto)}`;
};

const TorrePrioridade = ({ priority = [], onAbrirAluno }) => (
  <div className="glass-card border border-red-500/20">
    <div className="p-4 border-b border-slate-800/50 flex items-center gap-2">
      <Flame className="w-5 h-5 text-red-400" />
      <h3 className="font-semibold text-white">Prioridade do Dia</h3>
      {priority.length > 0 && (
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
          Ação imediata
        </span>
      )}
    </div>

    {priority.length === 0 ? (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500">Ninguém exige ação imediata hoje.</p>
        <p className="text-xs text-slate-600 mt-1">Fúria, estouro de stop e risco acima do autorizado — nenhum deles apareceu.</p>
      </div>
    ) : (
      <div className="divide-y divide-slate-800/50">
        {priority.map((aluno) => {
          const cfg = GATILHO[aluno.prioridade.trigger] ?? GATILHO[TRIGGER.RISCO];
          const Icon = cfg.icon;
          const wa = linkWhatsapp(
            aluno.whatsappNumber,
            `${aluno.name?.split(' ')[0] ?? ''}, vi seu dia de hoje — ${aluno.prioridade.motivo}. Podemos falar?`,
          );

          return (
            <div
              key={aluno.studentId}
              onClick={() => onAbrirAluno?.({ email: aluno.email, name: aluno.name, studentId: aluno.studentId })}
              className="p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-slate-800/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{aluno.name}</div>
                  <div className="text-xs text-slate-400">
                    <span className="text-red-400 font-medium">{cfg.titulo}</span>
                    {' · '}{aluno.prioridade.motivo}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide hidden sm:inline">
                  {cfg.acao}
                </span>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onAbrirAluno?.({ email: aluno.email, name: aluno.name, studentId: aluno.studentId }); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/50 transition-colors"
                >
                  Abrir ficha <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export default TorrePrioridade;
