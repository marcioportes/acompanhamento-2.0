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
  /* Antes o painel inteiro vinha com borda vermelha e um selo "AÇÃO IMEDIATA":
     quando a moldura grita, o conteúdo dela para de ser lido. Agora o alarme é
     uma barra de 2px na lateral de cada linha — presente sem ser estridente. */
  <div className="glass-card overflow-hidden">
    <div className="panel-head">
      <div className="flex items-center gap-2">
        <Flame className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: 'var(--neg)' }} />
        <h3 className="panel-title">Prioridade do Dia</h3>
      </div>
      {priority.length > 0 && (
        <span className="meta tabular">{priority.length} {priority.length === 1 ? 'pessoa' : 'pessoas'}</span>
      )}
    </div>

    {priority.length === 0 ? (
      <div className="px-4 py-7 text-center">
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>Ninguém exige ação imediata hoje.</p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>
          Fúria, estouro de stop e risco acima do autorizado — nenhum deles apareceu.
        </p>
      </div>
    ) : (
      <div>
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
              data-prioridade={aluno.studentId}
              onClick={() => onAbrirAluno?.({ email: aluno.email, name: aluno.name, studentId: aluno.studentId })}
              className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderTop: '1px solid var(--line)', boxShadow: 'inset 2px 0 0 var(--neg)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} style={{ color: 'var(--neg)' }} />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{aluno.name}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--neg)' }}>{cfg.titulo}</span>
                    {' · '}{aluno.prioridade.motivo}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] hidden sm:inline" style={{ color: 'var(--ink-4)' }}>
                  {cfg.acao}
                </span>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[12px] px-2.5 h-7 transition-colors"
                    style={{
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--line-strong)',
                      color: 'var(--ink-2)',
                    }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> WhatsApp
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onAbrirAluno?.({ email: aluno.email, name: aluno.name, studentId: aluno.studentId }); }}
                  className="flex items-center gap-1.5 text-[12px] px-2.5 h-7 transition-colors"
                  style={{
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--accent-line)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  Abrir ficha <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
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
