/**
 * PrecisamAtencaoLista — a aba "Precisam atenção" por trade (issue #444, M1).
 *
 * Cada linha é um trade aguardando feedback com um motivo pesado, escrito. A linha
 * sai quando o mentor dá o feedback — não há o que marcar à mão. Clique abre o
 * trade no compositor de feedback, o mesmo destino da Fila de Feedback.
 *
 * Grupos por aluno; com dois planos na fila, um cabeçalho por plano, com a moeda
 * do plano e nunca um total entre eles (#442). A partir do 6º aluno a lista
 * colapsa, no mesmo padrão do `Bloco` da Torre.
 *
 * Nada é calculado aqui: a fila vem de `tradesNeedingAttention` e os grupos de
 * `agruparPorAlunoEPlano` (`utils/studentsAttention.js`).
 */
import { useState } from 'react';
import { Check, ChevronDown, ArrowRight } from 'lucide-react';
import { BEHAVIOR_LABELS, narrativeFor } from '../Trades/behaviorDisplay';
import { formatCurrencyDynamic } from '../../utils/currency';
import { fmtTradeTime } from '../../utils/tradeTimezone';

const LIMITE_ALUNOS = 5;

const dataCurta = (iso) => {
  const m = String(iso ?? '').match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : '--/--';
};

/** Primeira frase da narrativa. Ponto seguido de espaço (ou fim) — "1.234" não corta. */
export const primeiraFrase = (texto) => {
  const t = String(texto ?? '').trim();
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : t;
};

/**
 * A narrativa precisa da família como o motor gravou (`canonicalCode` + `evidence`);
 * o motivo da regra só guarda o código.
 */
const narrativaDoMotivo = (trade, motivo) => {
  const original = (trade?.behaviorProfile?.families ?? []).find((f) => f?.canonicalCode === motivo.code);
  return primeiraFrase(narrativeFor(original ?? { canonicalCode: motivo.code }));
};

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const LinhaTrade = ({ item, moeda, onAbrirTrade }) => {
  const { trade, motivos } = item;
  const res = Number(trade.result) || 0;
  const abrir = () => onAbrirTrade?.(trade);

  return (
    <div
      onClick={abrir}
      data-testid="precisam-atencao-linha"
      className="group px-4 py-2.5 flex items-start justify-between gap-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
      style={{ borderTop: '1px solid var(--line)', boxShadow: 'inset 2px 0 0 var(--neg)' }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-[11px] font-mono tabular mt-0.5 flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
          {dataCurta(trade.date)} {trade.entryTime ? fmtTradeTime(trade.entryTime) : '--:--'}
        </span>
        <span className="text-[13px] font-medium flex-shrink-0" style={{ color: 'var(--ink)' }}>{trade.ticker}</span>
        <span className={`text-[13px] font-mono tabular flex-shrink-0 ${res >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {res >= 0 ? '+' : ''}{formatCurrencyDynamic(res, trade.currency ?? moeda ?? 'BRL')}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {motivos.map((m) => (
              <span key={m.code} className="chip" style={{ color: 'var(--neg)' }}>
                <span className="chip-dot" style={{ background: 'var(--neg)' }} />
                {BEHAVIOR_LABELS[m.code] ?? m.code}
              </span>
            ))}
          </div>
          {motivos.map((m) => {
            const frase = narrativaDoMotivo(trade, m);
            return frase ? (
              <p key={m.code} className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{frase}</p>
            ) : null;
          })}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); abrir(); }}
        className="flex items-center gap-1 text-[12px] px-2.5 h-7 flex-shrink-0 transition-colors hover:text-[var(--ink)]"
        style={{ color: 'var(--ink-3)' }}
      >
        Abrir <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
};

const PrecisamAtencaoLista = ({ alunos = [], totalTrades = 0, onAbrirTrade }) => {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? alunos : alunos.slice(0, LIMITE_ALUNOS);
  const escondidos = alunos.length - visiveis.length;

  return (
    <div className="glass-card overflow-hidden">
      <div className="panel-head">
        <h3 className="panel-title">Precisam atenção</h3>
        <span className="meta tabular">
          {plural(totalTrades, 'trade', 'trades')} · {plural(alunos.length, 'aluno', 'alunos')} · feedback prioritário
        </span>
      </div>

      {totalTrades === 0 ? (
        <div className="px-4 py-10 text-center">
          <Check className="w-6 h-6 mx-auto mb-2" strokeWidth={1.5} style={{ color: 'var(--pos)' }} />
          <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>Nenhum trade pesado esperando feedback.</p>
        </div>
      ) : (
        <>
          {visiveis.map((aluno) => (
            <div key={aluno.studentId}>
              {aluno.grupos.map((grupo) => (
                <div key={grupo.planId ?? '(sem plano)'}>
                  <div
                    className="px-4 py-2 flex items-center justify-between gap-4"
                    style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}
                  >
                    <span className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {aluno.studentName}
                      {grupo.planName && (
                        <span style={{ color: 'var(--ink-3)' }}>
                          {' · '}{grupo.planName}{grupo.moeda ? ` (${grupo.moeda})` : ''}
                        </span>
                      )}
                    </span>
                    <span className="text-[12px] tabular flex-shrink-0" style={{ color: 'var(--ink-3)' }}>
                      {plural(grupo.itens.length, 'trade', 'trades')}
                    </span>
                  </div>
                  {grupo.itens.map((item) => (
                    <LinhaTrade key={item.trade.id} item={item} moeda={grupo.moeda} onAbrirTrade={onAbrirTrade} />
                  ))}
                </div>
              ))}
            </div>
          ))}
          {escondidos > 0 && (
            <button
              onClick={() => setExpandido(true)}
              className="w-full px-4 py-2.5 flex items-center justify-center gap-1.5 text-[12px] transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderTop: '1px solid var(--line)', color: 'var(--ink-3)' }}
            >
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
              mais {plural(escondidos, 'aluno', 'alunos')}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default PrecisamAtencaoLista;
