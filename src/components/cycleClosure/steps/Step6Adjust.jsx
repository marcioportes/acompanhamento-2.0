/**
 * Step6Adjust.jsx — Etapa 6: quanto arriscar por trade no próximo ciclo.
 *
 * Kelly, Monte Carlo e a recomendação do advisor, com a decisão do aluno.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 * Issue #418 — a etapa era a única das oito sem título, sem frase de abertura e
 * sem uma linha explicando os modelos: o aluno caía num card "Risco ótimo
 * (Kelly ¼)" com badge `matemática` e percentis crus. Ordem nova: veredito em
 * uma linha → de onde vem o número (dois modelos expansíveis) → a recomendação
 * completa → a decisão. Quem confia decide na primeira linha; quem quer
 * entender encontra a matemática ANTES dos botões. O texto mora em
 * `adjustExplainers.js` (puro e testável), e o histograma passou a ser o real.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Edit3, MinusCircle, CheckCircle, AlertOctagon } from 'lucide-react';
import { useTrades } from '../../../hooks/useTrades';
import { usePlans } from '../../../hooks/usePlans';
import { useAccounts } from '../../../hooks/useAccounts';
import { computeKelly } from '../../../utils/cycleClosure/kellyCalculator';
import { projectNextCycle, pctOfBase } from '../../../utils/cycleClosure/monteCarlo';
import { advisePlanAdjustment } from '../../../utils/cycleClosure/closurePlanAdvisor';
import {
  EXPLAINERS, DECISION_LABELS, formatRiskPct,
  buildKellyReading, buildMcReading, buildAdviceCopy,
} from '../../../utils/cycleClosure/adjustExplainers';
import ExplainerCard from '../ExplainerCard';
import McDistribution from '../McDistribution';

const isInRange = (date, start, end) => date >= start && date <= end;

function fmtR(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
}
// Percentual com sinal explícito. Usado nos números forward-looking do Monte
// Carlo, onde omitir o sinal (ou fixá-lo em '+') esconde o cenário real.
function fmtSignedPct(v, digits = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export default function Step6Adjust({
  studentId,
  planId,
  cycleStart,
  cycleEnd,
  metrics,
  snapshot,
  patterns,
  forward,
  maturityRegression,
  onChange,
  onBlockSeal,
}) {
  const { trades = [] } = useTrades(studentId);
  const { plans = [] } = usePlans(studentId);
  const { accounts = [] } = useAccounts(studentId);
  const plan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId]);
  const account = useMemo(
    () => (plan?.accountId ? accounts.find((a) => a.id === plan.accountId) : null),
    [accounts, plan],
  );

  const cycleTrades = useMemo(
    () => trades.filter((t) => t.planId === planId && t.date && isInRange(t.date, cycleStart, cycleEnd)),
    [trades, planId, cycleStart, cycleEnd],
  );

  // Saldo disponível pra alocar como newPl do próximo ciclo = equity do plano
  // ao FIM do ciclo que está sendo fechado (plan.pl + Σ trades_do_ciclo).
  // NÃO usa account.currentBalance porque a conta pode estar contaminada com
  // resultados de trades posteriores ao cycleEnd (ex.: abril deixado aberto
  // enquanto maio já operava — o saldo da conta inclui maio, mas o newPl
  // deveria ser limitado ao que abril sozinho gerou).
  // snapshot.plEnd vem do Step1Read, já calculado como plan.pl + Σ cycle_trades.
  const availableBalance = useMemo(() => {
    const plEnd = Number(snapshot?.plEnd);
    if (Number.isFinite(plEnd)) return plEnd;
    // Fallback: equity-on-the-fly se o snapshot ainda não estiver pronto.
    if (!plan) return null;
    const basePl = Number(plan.pl) || 0;
    const cycleTradesSum = cycleTrades.reduce((s, t) => s + (Number(t.result) || 0), 0);
    return basePl + cycleTradesSum;
  }, [snapshot, plan, cycleTrades]);

  const effectivePL = useMemo(() => {
    const adj = forward?.planAdjustment;
    if (adj?.changed && typeof adj.newPl === 'number' && adj.newPl > 0) return adj.newPl;
    return Number(plan?.pl ?? 0);
  }, [forward, plan]);

  const plExceedsBalance = availableBalance !== null && effectivePL > availableBalance + 0.1;

  // Avisar wizard pra bloquear "Próximo" no Passo 6 e "Selar" no Passo 8.
  // Servidor tem o gate de fato (defesa em profundidade); aqui só evita
  // que o aluno chegue a clicar e leve um erro 400 silencioso.
  useEffect(() => {
    onBlockSeal?.(plExceedsBalance);
  }, [plExceedsBalance, onBlockSeal]);

  // Pool pra Kelly: histórico do plano (max útil)
  // #416 (D2) — `useTrades` entrega orderBy('date','desc'), então cortar pela
  // CAUDA pegava os 200 mais ANTIGOS: acima de 200 trades no plano, Kelly e
  // Monte Carlo projetariam o próximo ciclo pelo histórico mais velho
  // disponível. `slice(0, 200)` são os 200 mais recentes e não reordena.
  const planTrades = useMemo(
    () => trades.filter((t) => t.planId === planId).slice(0, 200),
    [trades, planId],
  );

  const kelly = useMemo(() => computeKelly(planTrades, plan), [planTrades, plan]);

  const mc = useMemo(
    () => projectNextCycle({
      priorCycleTrades: cycleTrades,
      allTrades: planTrades,
      nPerSim: cycleTrades.length || 18,
      options: { nSims: 1000 },
    }),
    [cycleTrades, planTrades],
  );

  const advice = useMemo(
    () => advisePlanAdjustment({
      kelly,
      cycleMetrics: metrics,
      maxDDPercent: metrics?.maxDrawdown?.percent,
      ruleAdherenceRate: metrics?.ruleAdherenceRate,
      currentPlan: plan ? {
        pl: plan.pl, riskPerOperation: plan.riskPerOperation,
        rrTarget: plan.rrTarget, cycleStop: plan.cycleStop,
      } : null,
      regression: maturityRegression || [],
      behavioralCounts: patterns?.eventCounts || {},
      stopBreach: snapshot?.stopBreach || null,
      snapshotPlEnd: snapshot?.plEnd,
      cycleResultPct: snapshot?.resultPercent,
    }),
    [kelly, metrics, plan, maturityRegression, patterns, snapshot],
  );

  const isCritical = advice.triggeredRule === 'pause_restructure';
  const baseCapital = advice.baseCapital ?? plan?.pl;

  // Snapshot info no draft.forward
  useEffect(() => {
    if (!plan) return;
    onChange({
      ...forward,
      kellyRecommendation: kelly && kelly.reason === null ? {
        edge: kelly.edge, variance: kelly.variance,
        kellyFull: kelly.kellyFull, kellySafe: kelly.kellySafe,
      } : null,
      mcSimulation: mc && mc.reason === null ? {
        samplePool: mc.samplePool, samplePoolSize: mc.samplePoolSize, n: mc.nSims,
        p10: mc.p10, p50: mc.p50, p90: mc.p90,
      } : null,
      aiSuggestion: {
        newPl: advice.newPl, newRisk: advice.newRiskPerOp, newRRTarget: advice.newRRTarget,
        newRiskRS: advice.newRiskRS, baseCapital: advice.baseCapital,
        rationale: advice.rationale, risks: advice.risks,
        triggeredRule: advice.triggeredRule, notifyMentor: advice.notifyMentor,
        source: advice.source,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelly, mc, advice, plan]);

  // Padrão da etapa 5 (Step5Check.jsx:251): Set de ids abertos.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpand = (id) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const [editing, setEditing] = useState(false);
  const [editPl, setEditPl] = useState('');
  const [editRisk, setEditRisk] = useState('');
  const [editRR, setEditRR] = useState('');

  const startEdit = () => {
    // Pré-preenche com o equity do ciclo (com centavos) — máximo permitido.
    // Evita confusão do display arredondado vs precisão do gate.
    const defaultPl = Number.isFinite(availableBalance) && availableBalance > 0
      ? availableBalance.toFixed(2)
      : String(plan?.pl ?? '');
    setEditPl(defaultPl);
    setEditRisk(String(plan?.riskPerOperation ?? ''));
    setEditRR(String(plan?.rrTarget ?? ''));
    setEditing(true);
  };

  const acceptSuggestion = () => {
    onChange({
      ...forward,
      planAdjustment: {
        changed: !!advice.changed,
        newPl: advice.newPl,
        newRiskPerOp: advice.newRiskPerOp,
        newRRTarget: advice.newRRTarget,
        decisionSource: advice.changed ? 'suggestion_accepted' : 'kept',
      },
    });
  };

  const keepPlan = () => {
    onChange({
      ...forward,
      planAdjustment: {
        changed: false,
        newPl: plan?.pl ?? null,
        newRiskPerOp: plan?.riskPerOperation ?? null,
        newRRTarget: plan?.rrTarget ?? null,
        decisionSource: 'kept',
      },
    });
  };

  const submitEdit = () => {
    const newPl = parseFloat(editPl);
    const newRisk = parseFloat(editRisk);
    const newRR = parseFloat(editRR);
    onChange({
      ...forward,
      planAdjustment: {
        changed: newPl !== plan?.pl || newRisk !== plan?.riskPerOperation || newRR !== plan?.rrTarget,
        newPl: Number.isFinite(newPl) ? newPl : plan?.pl,
        newRiskPerOp: Number.isFinite(newRisk) ? newRisk : plan?.riskPerOperation,
        newRRTarget: Number.isFinite(newRR) ? newRR : plan?.rrTarget,
        decisionSource: 'manual_edit',
      },
    });
    setEditing(false);
  };

  if (!plan) {
    return <div className="glass-card p-8 text-center text-red-300">Plano não encontrado.</div>;
  }

  const decision = forward?.planAdjustment?.decisionSource;

  const kellyReading = buildKellyReading(kelly, plan.riskPerOperation);
  const adviceCopy = buildAdviceCopy(advice, plan.riskPerOperation);

  const currencyFmt = (v) => {
    const code = account?.currency || 'BRL';
    const sym = code === 'USD' ? 'US$' : code === 'EUR' ? '€' : 'R$';
    return `${sym} ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const p50Pct = pctOfBase(mc.p50, baseCapital);
  const mcReading = buildMcReading(mc, { p50Pct, formatCurrency: currencyFmt });
  const mcLossPct = typeof mc.pLoss === 'number' ? Math.round(mc.pLoss * 100) : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          Quanto arriscar por trade no próximo ciclo
        </h3>
        <p className="text-sm text-slate-400">
          Duas contas olham o seu histórico e respondem perguntas diferentes: até onde dá pra ir sem se
          tirar do jogo, e que faixa de resultado esperar. Clique em cada uma pra ver o que ela faz e no
          que ela ajuda na sua decisão.
        </p>
      </div>

      {/* Veredito — a resposta antes da matemática, pra quem não vai atravessá-la */}
      {!isCritical && (
        <div className="glass-card p-4 border border-blue-500/30 bg-blue-500/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">A decisão sugerida</p>
          <p className="text-lg font-semibold text-slate-100">{adviceCopy.headline}</p>
        </div>
      )}

      {/* Banner de saldo insuficiente — PL efetivo excede o equity do ciclo.
          Servidor (closeCycle) rejeita o fechamento; aviso visual aqui força recalibrar. */}
      {plExceedsBalance && (
        <div className="glass-card p-5 border-2 border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-amber-500/5">
          <div className="flex items-start gap-3">
            <div className="bg-amber-500/30 text-amber-200 rounded-xl p-2.5 flex-shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-amber-100 mb-1">Capital alocado maior que o equity do ciclo</h4>
              <p className="text-sm text-slate-200 leading-relaxed">
                O novo PL seria <strong className="text-amber-200">{currencyFmt(effectivePL)}</strong>,
                mas este ciclo terminou com equity de <strong className="text-amber-200">{currencyFmt(availableBalance)}</strong>
                (PL inicial + resultado do ciclo). Você não pode alocar capital que o ciclo não gerou.
              </p>
              <p className="text-[11px] text-amber-100/80 mt-2">
                Edite manualmente abaixo e reduza o PL pra um valor ≤ equity do ciclo. O fechamento será bloqueado enquanto isso não couber.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner crítico — PAUSAR (REGRA 0) */}
      {isCritical && (
        <div className="glass-card p-5 border-2 border-red-500/60 bg-gradient-to-br from-red-500/15 to-red-500/5">
          <div className="flex items-start gap-3">
            <div className="bg-red-500/30 text-red-300 rounded-xl p-2.5 flex-shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <h4 className="text-lg font-bold text-red-200">{adviceCopy.headline}</h4>
                <span className="badge bg-red-500/30 text-red-200 border border-red-500/60 text-[10px]">crítico</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{adviceCopy.body}</p>
              {adviceCopy.risks?.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-red-200/80 pl-4 list-disc">
                  {adviceCopy.risks.map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              )}
              <p className="text-[11px] text-red-200/70 mt-3">
                Mentor notificado automaticamente no inbox · você ainda pode editar manualmente abaixo, mas isso fica registrado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Capital base — mostra comparação quando difere */}
      {typeof baseCapital === 'number' && typeof plan?.pl === 'number' && baseCapital !== plan.pl && (
        <div className="glass-card p-4 border border-slate-700/50 bg-slate-800/30">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Capital base para o próximo ciclo</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-2xl font-bold text-slate-100 mono">{currencyFmt(baseCapital)}</p>
            <p className="text-xs text-slate-500">
              capital pré-ciclo {currencyFmt(plan.pl)}
              {' · '}
              <span className={baseCapital < plan.pl ? 'text-red-400' : 'text-emerald-400'}>
                {baseCapital < plan.pl ? '−' : '+'}{Math.abs(((baseCapital - plan.pl) / plan.pl) * 100).toFixed(1)}%
              </span>
            </p>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            R do próximo ciclo recalculado sobre o saldo real — não sobre o capital inicial do plano. Máximo alocável = capital base (com centavos).
          </p>
        </div>
      )}

      {/* De onde vem esse número — os dois modelos, explicáveis */}
      <div className="glass-card p-5">
        <h4 className="text-sm font-semibold text-slate-200 mb-1">De onde vem esse número</h4>
        <p className="text-[11px] text-slate-500 mb-3">
          Clique em cada modelo pra ver o que ele faz, por que existe e no que ele muda a sua decisão.
        </p>

        <div className="space-y-3">
          <ExplainerCard
            explainer={EXPLAINERS.kelly}
            reading={kellyReading}
            keyValue={kelly.reason ? null : `${formatRiskPct(kelly.kellySafe * 100)} por trade`}
            expanded={expandedIds.has('kelly')}
            onToggle={() => toggleExpand('kelly')}
            preview={!kelly.reason && typeof baseCapital === 'number' ? (
              <p className="text-[11px] text-slate-400 mono">
                {currencyFmt(baseCapital)} × {formatRiskPct(kelly.kellySafe * 100)}
                {' = '}{currencyFmt(baseCapital * kelly.kellySafe)} por trade
              </p>
            ) : null}
          >
            {!kelly.reason && (
              <p className="text-[11px] text-slate-500 mono">
                ganho médio {fmtR(kelly.expectancy_R)} por trade · base de {kelly.sampleSize} trades do plano
              </p>
            )}
          </ExplainerCard>

          <ExplainerCard
            explainer={EXPLAINERS.monteCarlo}
            reading={mcReading}
            keyValue={mc.reason ? null : (mcLossPct != null ? `${mcLossPct}% dos cenários no vermelho` : null)}
            expanded={expandedIds.has('monteCarlo')}
            onToggle={() => toggleExpand('monteCarlo')}
            preview={mc.reason ? null : (
              <div className="text-[11px] text-slate-400 leading-relaxed">
                {typeof mc.p50 === 'number' && (
                  p50Pct != null ? (
                    <p>
                      Sobre o capital base {currencyFmt(baseCapital)}:{' '}
                      cenário ruim <span className="text-red-300 mono">{fmtSignedPct(pctOfBase(mc.p10, baseCapital))}</span>,
                      mediana <span className="text-slate-200 mono">{fmtSignedPct(p50Pct)}</span>,
                      cenário bom <span className="text-emerald-300 mono">{fmtSignedPct(pctOfBase(mc.p90, baseCapital))}</span>.
                    </p>
                  ) : (
                    // Sem capital base utilizável não há percentual honesto a
                    // exibir: a projeção sai em moeda (D-01, issue #416).
                    <p>
                      Projeção em valor (capital base indisponível):{' '}
                      cenário ruim <span className="text-red-300 mono">{currencyFmt(mc.p10)}</span>,
                      mediana <span className="text-slate-200 mono">{currencyFmt(mc.p50)}</span>,
                      cenário bom <span className="text-emerald-300 mono">{currencyFmt(mc.p90)}</span>.
                    </p>
                  )
                )}
                <p className="text-slate-500 mt-0.5">
                  base = {mc.samplePoolSize} {mc.samplePoolSize === 1 ? 'trade' : 'trades'}{' '}
                  {mc.samplePool === 'priorCycle' ? 'do ciclo anterior' : 'do plano'}
                </p>
              </div>
            )}
          >
            {/* Sem histograma (projeção antiga, ou motor em early-return) o card
                não desenha nada e mantém a faixa acima. */}
            {mc.histogram && (
              <div>
                <McDistribution
                  histogram={mc.histogram}
                  p10={mc.p10}
                  p50={mc.p50}
                  p90={mc.p90}
                  ariaSummary={mcReading.headline}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Cada barra é a quantidade de cenários que terminou naquele resultado. A linha clara
                  marca o zero; os tracinhos, o cenário ruim, a mediana e o cenário bom.
                </p>
              </div>
            )}
          </ExplainerCard>
        </div>
      </div>

      {/* IA suggestion */}
      <div className="glass-card p-6 border border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-blue-500/20 text-blue-400 rounded-xl p-2.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-100 mb-1">A recomendação</h4>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">{adviceCopy.body}</p>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Capital base</p>
                <p className="font-mono text-slate-100">
                  {currencyFmt(baseCapital ?? plan.pl)}
                </p>
                <p className="text-[10px] text-slate-500">saldo pós-ciclo</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Risco por trade</p>
                <p className="font-mono text-slate-100">
                  {advice.newRiskPerOp ?? plan.riskPerOperation}%
                  {typeof advice.newRiskRS === 'number' && advice.newRiskRS > 0 && (
                    <span className="text-slate-400 text-xs ml-1 mono">· {currencyFmt(advice.newRiskRS)}</span>
                  )}
                  <span className="text-slate-500 text-xs ml-1 block">{advice.changed && advice.newRiskPerOp !== plan.riskPerOperation ? (advice.newRiskPerOp === 0 ? '⛔ pausa' : '↺ alterar') : '→ manter'}</span>
                </p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Alvo por trade (RR)</p>
                <p className="font-mono text-slate-100">
                  {advice.newRRTarget ?? plan.rrTarget}×
                  <span className="text-slate-500 text-xs ml-1">{advice.changed && advice.newRRTarget !== plan.rrTarget ? '↺ alterar' : '→ manter'}</span>
                </p>
                <p className="text-[10px] text-slate-500">a vitória vale {advice.newRRTarget ?? plan.rrTarget}× a perda</p>
              </div>
            </div>

            {adviceCopy.risks?.length > 0 && (
              <details>
                <summary className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
                  ⚠️ O que observar ({adviceCopy.risks.length})
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-400 pl-4 list-disc">
                  {adviceCopy.risks.map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              </details>
            )}
          </div>
        </div>

        {/* Decisão */}
        <div className="border-t border-slate-700/50 pt-4">
          <p className="text-xs text-slate-500 mb-3">Sua decisão:</p>
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    Capital (PL)
                    {Number.isFinite(availableBalance) && availableBalance > 0 && (
                      <span className="text-[10px] text-slate-600"> · máx {currencyFmt(availableBalance)}</span>
                    )}
                  </label>
                  <input value={editPl} onChange={(e) => setEditPl(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white" type="number" step="0.01" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Risco/trade (%)</label>
                  <input value={editRisk} onChange={(e) => setEditRisk(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white" type="number" step="0.1" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Alvo por trade (RR)</label>
                  <input value={editRR} onChange={(e) => setEditRR(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white" type="number" step="0.1" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitEdit} className="btn-primary text-sm flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Salvar manual
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={acceptSuggestion}
                className={`btn-success text-sm flex items-center justify-center gap-2 ${decision === 'suggestion_accepted' ? 'ring-2 ring-emerald-400/50' : ''}`}
              >
                <CheckCircle className="w-4 h-4" /> Aceitar sugestão
              </button>
              <button
                type="button"
                onClick={startEdit}
                className={`btn-secondary text-sm flex items-center justify-center gap-2 ${decision === 'manual_edit' ? 'ring-2 ring-blue-400/50' : ''}`}
              >
                <Edit3 className="w-4 h-4" /> Editar manualmente
              </button>
              <button
                type="button"
                onClick={keepPlan}
                className={`btn-secondary text-sm flex items-center justify-center gap-2 ${decision === 'kept' ? 'ring-2 ring-slate-400/50' : ''}`}
              >
                <MinusCircle className="w-4 h-4" /> Manter sem aceitar
              </button>
            </div>
          )}

          {decision && (
            <p className="text-[11px] text-slate-500 mt-3 text-right">
              Registrado: <span className="text-slate-300">{DECISION_LABELS[decision] || decision}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
