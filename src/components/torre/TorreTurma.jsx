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

/**
 * Cor da faixa. Ela vive num ponto de 5px, não num fundo: numa turma de doze
 * onde nove estão fora do "em dia", nove etiquetas coloridas empatam e a tela
 * volta a não ter foco. O ponto ordena sem gritar.
 */
const COR_FAIXA = {
  [FAIXA.ACAO_HOJE]: 'var(--neg)',
  [FAIXA.SUMIU]: 'var(--neg)',
  [FAIXA.RISCO_ALTO]: 'var(--warn)',
  [FAIXA.FORA_DO_PLANO]: 'var(--warn)',
  [FAIXA.ESFRIANDO]: 'var(--ink-3)',
  [FAIXA.EM_DIA]: 'var(--pos)',
  [FAIXA.NUNCA_OPEROU]: 'var(--ink-4)',
};

/** Só as duas faixas que exigem ato ganham tinta no texto. */
const TEXTO_FAIXA = {
  [FAIXA.ACAO_HOJE]: 'var(--neg)',
  [FAIXA.SUMIU]: 'var(--neg)',
};

const Faixa = ({ faixa }) => (
  <span className="chip" style={{ color: TEXTO_FAIXA[faixa] ?? 'var(--ink-2)' }}>
    <span className="chip-dot" style={{ background: COR_FAIXA[faixa] }} />
    {FAIXA_LABEL[faixa]}
  </span>
);

const SETA = { up: TrendingUp, down: TrendingDown, flat: Minus };
const COR_SETA = { up: 'var(--neg)', down: 'var(--pos)', flat: 'var(--ink-4)' };

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
  <div className="glass-card overflow-hidden">
    <div className="panel-head">
      <h3 className="panel-title">A turma</h3>
      <div className="flex items-center gap-2.5">
        <span className="meta tabular">
          {filtro ? `${turma.length} de ${total}` : `${turma.length} ${turma.length === 1 ? 'aluno' : 'alunos'}`} · ordem de atenção
        </span>
        {filtro && (
          <button
            onClick={onLimparFiltro}
            className="text-[11px] px-2 h-6 transition-colors"
            style={{ borderRadius: 'var(--r-sm)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)' }}
          >
            ver todos
          </button>
        )}
      </div>
    </div>

    {turma.length === 0 ? (
      <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>Nenhum aluno neste recorte.</div>
    ) : (
    <>
    {/* Celular: cartão por aluno. Tabela de sete colunas rolando lateralmente é
        ilegível no telefone, e esta é a tela onde o mentor bate o olho. */}
    <div className="sm:hidden divide-y" style={{ borderColor: 'var(--line)' }}>
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
            className="px-3 py-2.5 transition-colors cursor-pointer active:bg-[var(--surface-2)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{a.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-4)' }}>
                  {a.atencao.faixa === FAIXA.RISCO_ALTO && a.radar
                    ? `${BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family} · ${a.atencao.motivo}`
                    : a.atencao.motivo}
                </div>
              </div>
              <span className="flex-shrink-0"><Faixa faixa={a.atencao.faixa} /></span>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {semana?.comR ? (
                <span className="text-[12px] font-semibold tabular" style={{ color: semana.valor >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {semana.valor >= 0 ? '+' : ''}{semana.valor.toFixed(1)}R
                  <span className="font-normal" style={{ color: 'var(--ink-4)' }}> · {a.tradesSemana.length}t</span>
                </span>
              ) : null}
              {fora?.pct > 0 && (
                <span className="text-[12px] tabular" style={{ color: 'var(--warn)' }}>{Math.round(fora.pct)}% fora</span>
              )}
              {a.radar && (
                <span className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                  {BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family}
                </span>
              )}
              {a.pendencias?.feedback > 0 && (
                <span className="text-[11px] tabular" style={{ color: 'var(--info)' }}>{a.pendencias.feedback} feedback</span>
              )}

              <span className="ml-auto flex items-center gap-1.5">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     className="icon-btn">
                    <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onAbrirAluno?.({ email: a.email, name: a.name, studentId: a.studentId }); }}
                  className="icon-btn"
                >
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
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
          <tr>
            {['Aluno', 'Última operação', 'Semana', 'Fora do plano', 'Comportamento', 'Devo', ''].map((h, i) => (
              <th
                key={h || i}
                className={`px-3 py-2 text-[10px] font-semibold uppercase ${i >= 2 && i <= 3 ? 'text-right' : ''} ${i === 5 ? 'text-center' : ''}`}
                style={{ letterSpacing: '0.06em', color: 'var(--ink-4)', borderBottom: '1px solid var(--line)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[13px]">
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
                className="group cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderTop: '1px solid var(--line)' }}
              >
                {/* Nome e estado na mesma linha: empilhados, cada aluno ocupava
                    56px e a turma de doze não cabia na tela. */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium whitespace-nowrap" style={{ color: 'var(--ink)' }}>{a.name}</span>
                    <Faixa faixa={a.atencao.faixa} />
                  </div>
                  {a.visaoRapida?.planName && (
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-4)' }}>{a.visaoRapida.planName}</div>
                  )}
                </td>

                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span style={{ color: sumido ? 'var(--neg)' : a.diasSemOperar == null ? 'var(--ink-4)' : 'var(--ink-2)' }}>
                    {desdeQuandoOperou(a.diasSemOperar)}
                  </span>
                  <div className="text-[11px] truncate max-w-[220px]" style={{ color: 'var(--ink-4)' }}>
                    {a.atencao.faixa === FAIXA.RISCO_ALTO && a.radar
                      ? `${BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family} · ${a.atencao.motivo}`
                      : a.atencao.motivo}
                  </div>
                </td>

                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                  {semana?.comR ? (
                    <>
                      <span className="font-medium" style={{ color: semana.valor >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                        {semana.valor >= 0 ? '+' : ''}{semana.valor.toFixed(1)}R
                      </span>
                      <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                        {a.tradesSemana.length} {a.tradesSemana.length === 1 ? 'trade' : 'trades'}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: 'var(--ink-4)' }}>—</span>
                  )}
                </td>

                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                  {fora ? (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={fora.pct >= 30 ? 'font-semibold' : ''}
                        style={{ color: fora.pct >= 30 ? 'var(--neg)' : fora.pct > 0 ? 'var(--warn)' : 'var(--ink-2)' }}
                      >
                        {Math.round(fora.pct)}%
                      </span>
                      {Seta && <Seta className="w-3 h-3" strokeWidth={2} style={{ color: COR_SETA[fora.direcao] }} />}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-4)' }}>—</span>
                  )}
                  {fora?.regraPior && (
                    <div className="text-[11px] truncate max-w-[140px] ml-auto" style={{ color: 'var(--ink-4)' }}>{fora.regraPior}</div>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  {a.radar ? (
                    <>
                      <span style={{ color: 'var(--ink-2)' }}>{BEHAVIOR_LABELS[a.radar.code] ?? a.radar.family}</span>
                      <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                        severidade {String(SEVERITY_LABELS[a.radar.severity] ?? a.radar.severity).toLowerCase()}
                        {a.radar.graves > 1 && ` · ${a.radar.graves} graves`}
                        {a.radar.ocorrencias > a.radar.graves && ` · ${a.radar.ocorrencias} achados`}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: 'var(--ink-4)' }}>—</span>
                  )}
                </td>

                <td className="px-3 py-2.5 text-center tabular">
                  {a.pendencias?.feedback > 0 ? (
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--info)' }}>
                      {a.pendencias.feedback}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-4)' }}>—</span>
                  )}
                </td>

                {/* As ações só aparecem na linha sob o cursor. Vinte botões
                    permanentes numa lista de dez é ruído em toda a coluna. */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="icon-btn"
                        title="Falar no WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </a>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onAbrirAluno?.({ email: a.email, name: a.name, studentId: a.studentId }); }}
                      className="icon-btn"
                      title="Abrir ficha"
                    >
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
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
