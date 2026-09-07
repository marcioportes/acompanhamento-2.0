/**
 * TorreAgenda — a fila de atos do mentor.
 *
 * O QUE ISTO RESOLVE. A Torre mostrava o estado da turma em seis recortes que não
 * se falavam (três tiles, prioridade, lista, duas faixas de pendência) e deixava
 * para o mentor a parte mais cara do trabalho: montar, de cabeça e todo dia, a
 * ordem em que aquilo tudo vira ação. Aqui a ordem é a tela.
 *
 * A ORDEM É POR CUSTO DE NÃO FAZER, não por gravidade abstrata:
 *
 *   1. RISCO VIVO      — está queimando dinheiro agora. Custo: o prejuízo de hoje.
 *   2. SUMIU           — assinatura viva, sem operar. Custo: churn que só aparece
 *                        no boleto, quando já não dá para reverter.
 *   3. VOCÊ DEVE       — feedback, rascunho, fechamento sem comentário. Custo: tem
 *                        alguém parado esperando por você.
 *   4. DECISÃO         — promoção pronta, regressão detectada. Custo: reconhecimento
 *                        dado fora da hora não vale o mesmo.
 *
 * SEM CAIXINHA DE "FEITO" (e sem campo novo — INV-15). O item sai da fila quando o
 * fato que o gerou deixa de existir: o feedback foi escrito, então o trade não está
 * mais pendente. Marcar manualmente criaria um segundo estado para manter em dia com
 * o primeiro, e o dia em que os dois discordassem a agenda passaria a mentir.
 *
 * A fila cresce com a turma: doze alunos em prejuízo produzem doze linhas, e é isso
 * mesmo que tem que aparecer. Cada bloco colapsa a partir do sexto item.
 */
import { useState } from 'react';
import {
  Flame, ShieldAlert, TrendingDown, MessageCircle, ArrowRight,
  MoonStar, MessageSquare, Check, ChevronDown,
} from 'lucide-react';
import { TRIGGER, FAIXA } from '../../utils/mentorRiskRadar';

const GATILHO = {
  [TRIGGER.FURIA]: { icon: Flame, titulo: 'Dia de fúria' },
  [TRIGGER.ALEM_DO_STOP]: { icon: TrendingDown, titulo: 'Além do stop' },
  [TRIGGER.RISCO]: { icon: ShieldAlert, titulo: 'Risco na operação' },
};

const linkWhatsapp = (numero, texto) => {
  const limpo = String(numero ?? '').replace(/\D/g, '');
  return limpo ? `https://wa.me/${limpo}?text=${encodeURIComponent(texto)}` : null;
};

const primeiroNome = (nome) => String(nome ?? '').split(' ')[0] ?? '';

/** Cabeçalho de bloco: o número é o que o mentor procura, então ele vem grande. */
const Bloco = ({ ordem, titulo, subtitulo, cor, itens, children }) => {
  const [expandido, setExpandido] = useState(false);
  const LIMITE = 5;
  // `.flat()`: o bloco 3 recebe [array_de_alunos, item, item] — sem achatar, o
  // corte contava três filhos onde havia sete atos e nunca colapsava.
  const lista = [children].flat(2).filter(Boolean);
  const visiveis = expandido ? lista : lista.slice(0, LIMITE);
  const escondidos = lista.length - visiveis.length;

  return (
    <section className="glass-card overflow-hidden">
      <div className="panel-head">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold tabular flex-shrink-0"
            style={{ background: itens > 0 ? cor : 'var(--surface-3)', color: itens > 0 ? 'var(--bg)' : 'var(--ink-4)' }}
          >
            {ordem}
          </span>
          <h3 className="panel-title">{titulo}</h3>
          <span className="meta truncate">{subtitulo}</span>
        </div>
        <span className="text-[13px] font-semibold tabular" style={{ color: itens > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
          {itens}
        </span>
      </div>

      {itens === 0 ? (
        <div className="px-4 py-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" strokeWidth={2} style={{ color: 'var(--pos)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Nada aqui hoje.</span>
        </div>
      ) : (
        <>
          {visiveis}
          {escondidos > 0 && (
            <button
              onClick={() => setExpandido(true)}
              className="w-full px-4 py-2.5 flex items-center justify-center gap-1.5 text-[12px] transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderTop: '1px solid var(--line)', color: 'var(--ink-3)' }}
            >
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
              mais {escondidos} {escondidos === 1 ? 'item' : 'itens'}
            </button>
          )}
        </>
      )}
    </section>
  );
};

/**
 * Uma linha = um ato. Sempre a mesma anatomia, em qualquer bloco: quem, o motivo
 * em uma linha, a evidência que o produziu, e o botão que abre onde se trabalha.
 */
const Ato = ({ icone: Icone, cor, quem, motivo, evidencia, acoes, onClick }) => (
  <div
    onClick={onClick}
    className="px-4 py-2.5 flex items-center justify-between gap-4 transition-colors hover:bg-[var(--surface-2)]"
    style={{ borderTop: '1px solid var(--line)', boxShadow: cor ? `inset 2px 0 0 ${cor}` : undefined, cursor: onClick ? 'pointer' : 'default' }}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      {Icone && <Icone className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} style={{ color: cor ?? 'var(--ink-3)' }} />}
      <div className="min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{quem}</div>
        <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>{motivo}</div>
      </div>
    </div>

    <div className="flex items-center gap-2 flex-shrink-0">
      {evidencia && <span className="text-[11px] tabular hidden md:inline" style={{ color: 'var(--ink-4)' }}>{evidencia}</span>}
      {acoes}
    </div>
  </div>
);

const BotaoWhatsapp = ({ href }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="flex items-center gap-1.5 text-[12px] px-2.5 h-7 transition-colors"
    style={{ borderRadius: 'var(--r-sm)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)' }}
  >
    <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> WhatsApp
  </a>
);

const BotaoPrincipal = ({ children, onClick }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    className="flex items-center gap-1.5 text-[12px] px-2.5 h-7 transition-colors whitespace-nowrap"
    style={{
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--accent-line)',
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
    }}
  >
    {children} <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
  </button>
);

const TorreAgenda = ({
  radar,
  onAbrirAluno,
  onIrParaFeedback,
  onIrParaRevisoes,
  onIrParaFechamentos,
  rascunhos = 0,
  fechamentosPendentes = 0,
  decisoes = null,
  totalDecisoes = 0,
}) => {
  const { priority = [], turma = [] } = radar ?? {};

  const sumidos = turma.filter((a) => a.atencao?.faixa === FAIXA.SUMIU);

  // "Devo" é dívida MINHA, então a unidade é a pessoa que está esperando — não o
  // trade. Quinze trades de três alunos são três conversas, não quinze.
  const devoFeedback = turma
    .filter((a) => (a.pendencias?.feedback ?? 0) > 0)
    .sort((a, b) => (b.pendencias.feedback - a.pendencias.feedback));

  const totalDevo = devoFeedback.length + (rascunhos > 0 ? 1 : 0) + (fechamentosPendentes > 0 ? 1 : 0);
  const totalAtos = priority.length + sumidos.length + totalDevo + totalDecisoes;

  const abrir = (a) => () => onAbrirAluno?.({ email: a.email, name: a.name, studentId: a.studentId });

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-semibold tabular leading-none" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {totalAtos}
          </span>
          <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
            {totalAtos === 1 ? 'ato hoje' : 'atos hoje'}
          </span>
        </div>
        {/* Não há caixinha de "feito": o contador cai sozinho quando o trabalho
            acontece, porque a fila é derivada do fato, não de uma marcação. */}
        <span className="meta">a fila diminui sozinha conforme você resolve</span>
      </div>

      <Bloco
        ordem={1}
        titulo="Está queimando agora"
        subtitulo="custo de ignorar: o prejuízo de hoje"
        cor="var(--neg)"
        itens={priority.length}
      >
        {priority.map((a) => {
          const cfg = GATILHO[a.prioridade.trigger] ?? GATILHO[TRIGGER.RISCO];
          const wa = linkWhatsapp(a.whatsappNumber, `${primeiroNome(a.name)}, vi seu dia de hoje — ${a.prioridade.motivo}. Podemos falar?`);
          const semana = a.resultadoSemanaR;
          return (
            <Ato
              key={a.studentId}
              icone={cfg.icon}
              cor="var(--neg)"
              quem={a.name}
              motivo={`${cfg.titulo} · ${a.prioridade.motivo}`}
              evidencia={semana?.comR ? `${semana.valor >= 0 ? '+' : ''}${semana.valor.toFixed(1)}R na semana` : null}
              onClick={abrir(a)}
              acoes={(
                <>
                  {wa && <BotaoWhatsapp href={wa} />}
                  <BotaoPrincipal onClick={abrir(a)}>Abrir ficha</BotaoPrincipal>
                </>
              )}
            />
          );
        })}
      </Bloco>

      <Bloco
        ordem={2}
        titulo="Sumiu"
        subtitulo="paga e não aparece — o churn começa aqui"
        cor="var(--warn)"
        itens={sumidos.length}
      >
        {sumidos.map((a) => {
          const wa = linkWhatsapp(a.whatsappNumber, `${primeiroNome(a.name)}, tudo bem? Faz um tempo que não vejo operação sua.`);
          return (
            <Ato
              key={a.studentId}
              icone={MoonStar}
              cor="var(--warn)"
              quem={a.name}
              motivo={a.atencao.motivo}
              evidencia={a.visaoRapida?.planName ?? null}
              onClick={abrir(a)}
              acoes={(
                <>
                  {wa && <BotaoWhatsapp href={wa} />}
                  <BotaoPrincipal onClick={abrir(a)}>Abrir ficha</BotaoPrincipal>
                </>
              )}
            />
          );
        })}
      </Bloco>

      <Bloco
        ordem={3}
        titulo="Você deve"
        subtitulo="tem gente parada esperando por você"
        cor="var(--info)"
        itens={totalDevo}
      >
        {devoFeedback.map((a) => (
          <Ato
            key={a.studentId}
            icone={MessageSquare}
            cor="var(--info)"
            quem={a.name}
            motivo={`${a.pendencias.feedback} ${a.pendencias.feedback === 1 ? 'trade espera' : 'trades esperam'} seu feedback`}
            evidencia={a.atencao?.motivo}
            onClick={onIrParaFeedback}
            acoes={<BotaoPrincipal onClick={onIrParaFeedback}>Escrever</BotaoPrincipal>}
          />
        ))}
        {rascunhos > 0 && (
          <Ato
            key="rascunhos"
            icone={MessageSquare}
            cor="var(--info)"
            quem="Revisões em rascunho"
            motivo={`${rascunhos} ${rascunhos === 1 ? 'rascunho' : 'rascunhos'} para publicar`}
            onClick={onIrParaRevisoes}
            acoes={<BotaoPrincipal onClick={onIrParaRevisoes}>Fila de Revisão</BotaoPrincipal>}
          />
        )}
        {fechamentosPendentes > 0 && (
          <Ato
            key="fechamentos"
            icone={MessageSquare}
            cor="var(--info)"
            quem="Fechamentos de ciclo"
            motivo={`${fechamentosPendentes} ${fechamentosPendentes === 1 ? 'ciclo fechado sem seu comentário' : 'ciclos fechados sem seu comentário'}`}
            onClick={onIrParaFechamentos}
            acoes={<BotaoPrincipal onClick={onIrParaFechamentos}>Ver</BotaoPrincipal>}
          />
        )}
      </Bloco>

      <Bloco
        ordem={4}
        titulo="Decisão sua"
        subtitulo="promoção e regressão não esperam sem custo"
        cor="var(--pos)"
        itens={totalDecisoes}
      >
        {decisoes}
      </Bloco>
    </div>
  );
};

export default TorreAgenda;
