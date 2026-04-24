/**
 * ReviewKpiGrid
 * @description Grade 2×4 com os 8 KPIs congelados de uma revisão semanal,
 *              com delta opcional vs revisão anterior (seta ↑↓ + %).
 *
 * Origem: extração de WeeklyReviewPage.jsx (issue #119 task 28). Reusado pelo
 * mentor (`WeeklyReviewPage`) e pelo aluno (`StudentReviewsPage`).
 *
 * Props:
 * - kpis: snapshot.kpis do review corrente (obrigatório)
 * - prevKpis: snapshot.kpis da revisão anterior do MESMO plano (opcional)
 * - currency: moeda ('USD' default, pode ser 'BRL')
 */

import { useState } from 'react';
import { fmtMoney, fmtPct, fmtNum, deltaText } from '../../utils/reviewFormatters';

const KpiCard = ({ label, value, delta, prev, tooltip }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white/5 rounded-lg px-3 py-2.5 ${tooltip ? 'cursor-pointer hover:bg-white/10' : ''}`}
      onClick={() => tooltip && setOpen((v) => !v)}
    >
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className={`text-[10px] ${open ? 'text-emerald-400' : 'text-slate-500'}`}>
            {open ? '×' : 'ⓘ'}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-medium text-white">{value}</span>
        {delta && <span className={`text-[11px] font-medium ${delta.cls}`}>{delta.text}</span>}
      </div>
      {prev && <div className="text-[11px] text-slate-500 mt-0.5">{prev}</div>}
      {open && tooltip && (
        <div className="mt-2 pt-2 border-t border-slate-700/60 text-[11px] leading-snug text-slate-300">
          {tooltip}
        </div>
      )}
    </div>
  );
};

const ReviewKpiGrid = ({ kpis, prevKpis, currency = 'USD' }) => {
  if (!kpis) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-6 text-center text-[11px] text-slate-500 italic">
        Snapshot indisponível.
      </div>
    );
  }
  const prev = prevKpis || {};
  const c = kpis;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <KpiCard
        label="Win rate"
        value={fmtPct(c.wr)}
        delta={deltaText(c.wr, prev.wr, (d) => `${d.toFixed(1)}%`)}
        prev={Number.isFinite(Number(prev.wr)) ? `anterior: ${fmtPct(prev.wr)}` : null}
        tooltip="% de trades vencedores (result > 0). Breakeven = 50%. Sozinho não diz se sistema é rentável — precisa ler junto com Payoff."
      />
      <KpiCard
        label="Payoff"
        value={fmtNum(c.payoff, 2)}
        delta={deltaText(c.payoff, prev.payoff, (d) => d.toFixed(2))}
        prev={Number.isFinite(Number(prev.payoff)) ? `anterior: ${fmtNum(prev.payoff, 2)}` : null}
        tooltip="Média dos ganhos dividida pela média absoluta das perdas. Payoff 1.5 = em média, wins são 1,5× maiores que losses. Acima de 1.0 com WR ≥40% tende a ser rentável."
      />
      <KpiCard
        label="Profit factor"
        value={fmtNum(c.profitFactor, 2)}
        delta={deltaText(c.profitFactor, prev.profitFactor, (d) => d.toFixed(2))}
        prev={Number.isFinite(Number(prev.profitFactor)) ? `anterior: ${fmtNum(prev.profitFactor, 2)}` : null}
        tooltip="Razão entre total ganho e total perdido (Σwins / |Σlosses|). >1 é rentável; >2 robusto; >3 excepcional. Complementa Payoff — este usa médias, PF usa totais."
      />
      <KpiCard
        label="EV / trade"
        value={fmtMoney(c.evPerTrade, currency)}
        delta={deltaText(c.evPerTrade, prev.evPerTrade, (d) => fmtMoney(d, currency))}
        prev={Number.isFinite(Number(prev.evPerTrade)) ? `anterior: ${fmtMoney(prev.evPerTrade, currency)}` : null}
        tooltip="Expectativa matemática por trade (P&L total / nº de trades). Positivo = sistema tem edge. Multiplicado pelo nº de trades projetado, dá estimativa de retorno."
      />
      <KpiCard
        label="RR médio"
        value={c.avgRR ? `1:${fmtNum(c.avgRR, 2)}` : '—'}
        prev="target: 1:2.0"
        tooltip="Razão risco-retorno realizada média dos trades. 1:1.82 = em média ganha 1,82R por cada 1R arriscado. Comparar com o target do plano (normalmente 1:2.0)."
      />
      <KpiCard
        label="Compliance"
        value={fmtPct(c.compliance?.overall)}
        delta={deltaText(c.compliance?.overall, prev.compliance?.overall, (d) => `${d.toFixed(1)}%`)}
        prev={Number.isFinite(Number(prev.compliance?.overall)) ? `anterior: ${fmtPct(prev.compliance.overall)}` : null}
        tooltip="Disciplina agregada: média do % de trades que respeitaram stop, RR-alvo e RO-limite do plano. Queda indica que o aluno está flexibilizando regras — sinal de alerta."
      />
      <KpiCard
        label="Coef. variação"
        value={fmtNum(c.coefVariation, 2)}
        delta={deltaText(c.coefVariation, prev.coefVariation, (d) => d.toFixed(2), true)}
        prev={Number.isFinite(Number(prev.coefVariation)) ? `anterior: ${fmtNum(prev.coefVariation, 2)}` : null}
        tooltip="Consistência dos resultados: desvio-padrão ÷ |média|. Menor = melhor. CV <0.5 trades homogêneos; >2.0 erráticos (P&L dominado por 1-2 trades grandes — risco escondido)."
      />
      <KpiCard
        label="Tempo médio"
        value={c.avgHoldTimeMin ? `${c.avgHoldTimeMin} min` : '—'}
        prev={c.avgHoldTimeWinMin || c.avgHoldTimeLossMin ? `win: ${c.avgHoldTimeWinMin || 0}m · loss: ${c.avgHoldTimeLossMin || 0}m` : null}
        tooltip="Duração média de cada trade em minutos. Breakdown win/loss revela hold time assimétrico — cortar wins cedo e segurar losses é padrão comportamental típico de auto-sabotagem."
      />
    </div>
  );
};

export default ReviewKpiGrid;
export { KpiCard };
