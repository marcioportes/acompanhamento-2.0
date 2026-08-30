/**
 * TorreTurma — a espinha dorsal da Torre (issue #101, Fase E)
 *
 * UMA LINHA POR ALUNO, TODOS, SEMPRE. Ordenada por quem precisa de atenção,
 * nunca filtrada a ponto de esconder alguém.
 *
 * POR QUE ISTO SUBSTITUI TRÊS SEÇÕES (Radar de Risco, Fora do Plano e o painel
 * de Alertas Emocionais): as três listavam a mesma população recortada de formas
 * diferentes, e nenhuma respondia a pergunta que mais importa numa turma de doze
 * pessoas — quem sumiu. Medido em 28/08: cinco alunos com assinatura viva sem
 * operar há 15, 78, 92, 127 e 176 dias. Nenhuma das telas anteriores os mostrava,
 * porque tela feita de alarme só enxerga quem age.
 *
 * O padrão é o de painel de elenco (Khan/TrainingPeaks/painel de pacientes), não
 * o de console de incidentes (PagerDuty/Zendesk): com poucas pessoas e
 * acompanhamento contínuo, o alarme é uma COLUNA e um critério de ordenação — não
 * a lista inteira.
 */
import { MessageCircle, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { FAIXA, FAIXA_LABEL } from '../../utils/mentorRiskRadar';
import { BEHAVIOR_LABELS, SEVERITY_LABELS } from '../Trades/behaviorDisplay';

const ESTILO_FAIXA = {
  [FAIXA.ACAO_HOJE]: 'bg-red-500/20 text-red-300 border-red-500/40',
  [FAIXA.SUMIU]: 'bg-red-500/10 text-red-300 border-red-500/30',
  [FAIXA.RISCO_ALTO]: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  [FAIXA.FORA_DO_PLANO]: 'bg-amber-500/10 text-amber-200 border-amber-500/20',
  [FAIXA.ESFRIANDO]: 'bg-slate-700/50 text-slate-300 border-slate-600',
  [FAIXA.EM_DIA]: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  [FAIXA.NUNCA_OPEROU]: 'bg-slate-800 text-slate-500 border-slate-700',
};

const SETA = { up: TrendingUp, down: TrendingDown, flat: Minus };
const COR_SETA = { up: 'text-red-400', down: 'text-emerald-400', flat: 'text-slate-600' };

/** "hoje", "há 3 dias", "176 dias", "nunca". */
const desdeQuandoOperou = (dias) => {
  if (dias == null) return 'nunca';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `${dias} dias`;
};

const linkWhatsapp = (numero, texto) => {
  const limpo = String(numero ?? '').replace(/\D/g, '');
  return limpo ? `https://wa.me/${limpo}?text=${encodeURIComponent(texto)}` : null;
};

const TorreTurma = ({ turma = [], total = null, filtro = null, onLimparFiltro, onAbrirAluno }) => (
  <div className="glass-card">
    <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
      <h3 className="font-semibold text-white">A turma</h3>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">
          {filtro ? `${turma.length} de ${total}` : `${turma.length} ${turma.length === 1 ? 'aluno' : 'alunos'}`} · ordem de atenção
        </span>
        {filtro && (
          <button onClick={onLimparFiltro} className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-700">
            ver todos
          </button>
        )}
      </div>
    </div>

    {turma.length === 0 ? (
      <div className="p-8 text-center text-sm text-slate-500">Nenhum aluno neste recorte.</div>
    ) : (
    <>
    {/* Celular: cartão por aluno. Tabela de sete colunas rolando lateralmente é
        ilegível no telefone, e esta é a tela onde o mentor bate o olho. */}
    <div className="sm:hidden divide-y divide-slate-800/50">
      {turma.map((a) => {
        const semana = a.resultadoSemanaR;
        const fora = a.foraDoPlanoSemana;
        const sumido = a.atencao.faixa === FAIXA.SUMIU;
        const wa = linkWhatsapp(
          a.whatsappNumber,
          `${a.name?.split(' ')[0] ?? ''}, tudo bem? ${sumido ? 'Faz um tempo que não vejo operação sua.' : 'Podemos falar sobre seu dia?'}`,
        );
        return (
          <div
            key={a.studentId}
            onClick={() => onAbrirAluno?.({ email: a.email, name: a.name, studentId: a.studentId })}
            className="p-3 active:bg-slate-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{a.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {a.atencao.faixa === FAIXA.RISCO_ALTO && a.radar
                    ? `${BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family} · ${a.atencao.motivo}`
                    : a.atencao.motivo}
                </div>
              </div>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ${ESTILO_FAIXA[a.atencao.faixa]}`}>
                {FAIXA_LABEL[a.atencao.faixa]}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {semana?.comR ? (
                <span className={`text-xs font-mono font-bold ${semana.valor >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {semana.valor >= 0 ? '+' : ''}{semana.valor.toFixed(1)}R
                  <span className="text-slate-600 font-normal"> · {a.tradesSemana.length}t</span>
                </span>
              ) : null}
              {fora?.pct > 0 && (
                <span className="text-xs text-amber-400">{Math.round(fora.pct)}% fora</span>
              )}
              {a.radar && (
                <span className="text-[11px] text-slate-400 truncate">
                  {BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family}
                </span>
              )}
              {a.pendencias?.feedback > 0 && (
                <span className="text-[11px] text-blue-300">{a.pendencias.feedback} feedback</span>
              )}

              <span className="ml-auto flex items-center gap-1.5">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onAbrirAluno?.({ email: a.email, name: a.name, studentId: a.studentId }); }}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-300"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          </div>
        );
      })}
    </div>

    <div className="hidden sm:block w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
            <th className="p-3 font-bold">Aluno</th>
            <th className="p-3 font-bold">Última operação</th>
            <th className="p-3 font-bold text-right">Semana</th>
            <th className="p-3 font-bold text-right">Fora do plano</th>
            <th className="p-3 font-bold">Comportamento</th>
            <th className="p-3 font-bold text-center">Devo</th>
            <th className="p-3 font-bold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50 text-sm">
          {turma.map((a) => {
            const semana = a.resultadoSemanaR;
            const fora = a.foraDoPlanoSemana;
            const Seta = fora?.direcao ? SETA[fora.direcao] : null;
            const sumido = a.atencao.faixa === FAIXA.SUMIU;
            const wa = linkWhatsapp(
              a.whatsappNumber,
              `${a.name?.split(' ')[0] ?? ''}, tudo bem? ${sumido ? 'Faz um tempo que não vejo operação sua.' : 'Podemos falar sobre seu dia?'}`,
            );

            return (
              <tr
                key={a.studentId}
                onClick={() => onAbrirAluno?.({ email: a.email, name: a.name, studentId: a.studentId })}
                className="hover:bg-slate-800/30 transition-colors cursor-pointer"
              >
                <td className="p-3">
                  <div className="font-medium text-white whitespace-nowrap">{a.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${ESTILO_FAIXA[a.atencao.faixa]}`}>
                      {FAIXA_LABEL[a.atencao.faixa]}
                    </span>
                    {a.visaoRapida?.planName && (
                      <span className="text-[10px] text-slate-600">{a.visaoRapida.planName}</span>
                    )}
                  </div>
                </td>

                <td className="p-3 whitespace-nowrap">
                  <span className={sumido ? 'text-red-400 font-bold' : a.diasSemOperar == null ? 'text-slate-600' : 'text-slate-300'}>
                    {desdeQuandoOperou(a.diasSemOperar)}
                  </span>
                  <div className="text-[10px] text-slate-600">
                    {a.atencao.faixa === FAIXA.RISCO_ALTO && a.radar
                      ? `${BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family} · ${a.atencao.motivo}`
                      : a.atencao.motivo}
                  </div>
                </td>

                <td className="p-3 text-right whitespace-nowrap font-mono">
                  {semana?.comR ? (
                    <>
                      <span className={semana.valor >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {semana.valor >= 0 ? '+' : ''}{semana.valor.toFixed(1)}R
                      </span>
                      <div className="text-[10px] text-slate-600">
                        {a.tradesSemana.length} {a.tradesSemana.length === 1 ? 'trade' : 'trades'}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-700">—</span>
                  )}
                </td>

                <td className="p-3 text-right whitespace-nowrap">
                  {fora ? (
                    <span className="inline-flex items-center gap-1">
                      <span className={fora.pct >= 30 ? 'text-red-400 font-bold' : fora.pct > 0 ? 'text-amber-400' : 'text-slate-400'}>
                        {Math.round(fora.pct)}%
                      </span>
                      {Seta && <Seta className={`w-3 h-3 ${COR_SETA[fora.direcao]}`} />}
                    </span>
                  ) : (
                    <span className="text-slate-700">—</span>
                  )}
                  {fora?.regraPior && <div className="text-[10px] text-slate-600 truncate max-w-[140px]">{fora.regraPior}</div>}
                </td>

                <td className="p-3">
                  {a.radar ? (
                    <>
                      <span className="text-slate-300 text-xs">{BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family}</span>
                      <div className="text-[10px] text-slate-600">
                        severidade {String(SEVERITY_LABELS[a.radar.severity] ?? a.radar.severity).toLowerCase()}
                        {a.radar.graves > 1 && ` · ${a.radar.graves} graves`}
                        {a.radar.ocorrencias > a.radar.graves && ` · ${a.radar.ocorrencias} achados`}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-700">—</span>
                  )}
                </td>

                <td className="p-3 text-center">
                  {a.pendencias?.feedback > 0 ? (
                    <span className="text-[11px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      {a.pendencias.feedback}
                    </span>
                  ) : (
                    <span className="text-slate-700">—</span>
                  )}
                </td>

                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                        title="Falar no WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onAbrirAluno?.({ email: a.email, name: a.name, studentId: a.studentId }); }}
                      className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/50 transition-colors"
                      title="Abrir ficha"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
    )}
  </div>
);

export default TorreTurma;
