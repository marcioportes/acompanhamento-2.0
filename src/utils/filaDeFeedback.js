/**
 * filaDeFeedback — a fila de Aguardando Feedback, em árvore (issue #408).
 *
 * `aluno → dia → plano → trade` (hierarquia definida por Marcio, 27/08/2026).
 *
 * POR QUE O PLANO É CHAVE, E NÃO ATRIBUTO: o período é medido POR PLANO, com
 * limiares e moeda próprios. Aluno com B3 e mesa no mesmo dia tem DOIS períodos
 * independentes — juntá-los somaria reais com dólares e mediria o total contra o
 * stop de um só. É o mesmo erro que a D12 do #101 corrigiu no estado do dia, e
 * que o #402 corrigiu no fato do trade.
 *
 * POR QUE ISTO EXISTE: a tela agrupava só por aluno e entregava uma lista plana de
 * trades — sem dia, sem resultado, sem sequência. O contexto que só existe no
 * conjunto ficava invisível: três operações que fecharam no zero contam história
 * diferente de três que fecharam em −R$ 800, e o mesmo trade isolado merece
 * feedbacks opostos nos dois casos. Caso real da base: a Sandra em 26/08 aparece
 * como cinco linhas soltas; agrupada, é UM dia em que o plano autoriza uma
 * operação, o stop foi atingido na primeira, e ela abriu mais três.
 *
 * NADA É RECALCULADO AQUI: o período vem de `buildPeriodState` (#402), a ordem
 * vem de `sortTradesChrono`. Esta função monta a árvore.
 */
import { buildPeriodState, AUTHORIZATION } from './dayState';

const SEM_PLANO = '(sem plano)';

/** Moeda do período: a do trade, que é onde ela é declarada. */
const moedaDoGrupo = (trades) => {
  const moedas = new Set((trades ?? []).map((t) => t?.currency ?? 'BRL'));
  return moedas.size === 1 ? [...moedas][0] : null;
};

/**
 * @param {Object} p
 * @param {Array} p.pendentes — trades aguardando feedback (`OPEN`/`QUESTION`)
 * @param {Array} p.plans
 * @returns {Array} um nó por aluno, ordenado por urgência de triagem
 */
export function buildFilaDeFeedback({ pendentes, plans } = {}) {
  const planoPorId = new Map((plans ?? []).filter((p) => p?.id).map((p) => [p.id, p]));

  // aluno → dia → plano
  const porAluno = new Map();
  for (const t of pendentes ?? []) {
    if (!t?.date) continue;
    const chave = t.studentId || String(t.studentEmail ?? '').toLowerCase();
    if (!chave) continue;

    const aluno = porAluno.get(chave) ?? {
      studentId: t.studentId ?? null,
      email: t.studentEmail ?? null,
      name: t.studentName || String(t.studentEmail ?? '').split('@')[0] || chave,
      dias: new Map(),
    };
    if (t.studentName) aluno.name = t.studentName;

    const dia = aluno.dias.get(t.date) ?? new Map();
    const planId = t.planId ?? SEM_PLANO;
    const doPlano = dia.get(planId) ?? [];
    doPlano.push(t);
    dia.set(planId, doPlano);
    aluno.dias.set(t.date, dia);
    porAluno.set(chave, aluno);
  }

  const saida = [];
  for (const aluno of porAluno.values()) {
    const dias = [];
    const moedas = new Set();
    let totalPendentes = 0;
    let diasAlemDoStop = 0;
    let opsSemOrcamento = 0;
    let opsAposStop = 0;
    let somaLiquido = 0;
    const planIds = new Set();

    for (const [data, porPlano] of [...aluno.dias.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
      const planos = [];
      let algumAlemDoStop = false;

      for (const [planId, trades] of porPlano.entries()) {
        const plano = planId === SEM_PLANO ? null : planoPorId.get(planId) ?? null;
        // Sem plano não há limiar: o período existe só para dar ordem e líquido.
        const periodState = buildPeriodState(trades, plano, { periodKey: data });
        const porTradeId = new Map(trades.map((t) => [t.id, t]));

        const linhas = periodState.rows.map((row) => ({
          ...row,
          trade: porTradeId.get(row.tradeId) ?? null,
        }));

        totalPendentes += trades.length;
        if (planId !== SEM_PLANO) planIds.add(planId);
        moedas.add(moedaDoGrupo(trades) ?? 'MISTA');
        somaLiquido += periodState.net;
        if (periodState.closedBeyondStop) { diasAlemDoStop += 1; algumAlemDoStop = true; }
        for (const r of periodState.rows) {
          if (r.authorization === AUTHORIZATION.NO_ROOM) opsSemOrcamento += 1;
          if (r.authorization === AUTHORIZATION.AFTER_STOP) opsAposStop += 1;
        }

        planos.push({
          planId: planId === SEM_PLANO ? null : planId,
          planName: plano?.name ?? null,
          moeda: moedaDoGrupo(trades),
          periodState,
          linhas,
        });
      }

      // Plano com pior resultado primeiro: é onde a conversa começa.
      planos.sort((a, b) => a.periodState.net - b.periodState.net);
      dias.push({ data, planos, alemDoStop: algumAlemDoStop, trades: planos.reduce((n, p) => n + p.linhas.length, 0) });
    }

    // Líquido agregado só quando há UMA moeda. Com duas, não existe total honesto
    // — o número desce para o nível do plano (mesma regra do #101/#402).
    const moedaUnica = moedas.size === 1 && !moedas.has('MISTA') ? [...moedas][0] : null;

    saida.push({
      ...aluno,
      dias,
      totalPendentes,
      diasDistintos: dias.length,
      planosDistintos: planIds.size,
      moedaUnica,
      liquidoAgregado: moedaUnica ? Math.round(somaLiquido * 100) / 100 : null,
      diasAlemDoStop,
      opsSemOrcamento,
      opsAposStop,
    });
  }

  // Ordem de triagem: quem estourou o stop primeiro, depois quem operou sem
  // orçamento, depois volume. Nome desempata para a lista não dançar entre renders.
  return saida.sort((a, b) =>
    b.diasAlemDoStop - a.diasAlemDoStop
    || (b.opsAposStop + b.opsSemOrcamento) - (a.opsAposStop + a.opsSemOrcamento)
    || b.totalPendentes - a.totalPendentes
    || String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

export default buildFilaDeFeedback;

/**
 * Lembretes do período — o que levar para a conversa da revisão semanal.
 *
 * Marcio, 30/08: *"na revisão semanal seria interessante ter algo para lembrar o
 * aluno na conversa"*.
 *
 * A revisão já lista os trades agrupados por dia, mas sem os FATOS do período:
 * qual era o stop, o que o plano autorizava, e o que o aluno fez depois de bater
 * o limite. Sem isso, a conversa volta a ser trade a trade — que é o problema que
 * a fila resolveu do outro lado da tela.
 *
 * Cada lembrete é um DIA de um PLANO, com o fato e o número que o sustenta. Os
 * bons entram junto com os ruins: "bateu a meta e parou" é o que se quer reforçar,
 * e nunca é dito porque não gera alarme.
 *
 * @returns {Array<{data, planId, planName, moeda, tom, titulo, detalhe, net, trades}>}
 *   mais recente primeiro.
 */
export function lembretesDoPeriodo(trades, plans) {
  const [aluno] = buildFilaDeFeedback({ pendentes: trades, plans });
  if (!aluno) return [];

  const out = [];
  for (const dia of aluno.dias) {
    for (const p of dia.planos) {
      const ps = p.periodState;
      const base = {
        data: dia.data,
        planId: p.planId,
        planName: p.planName,
        moeda: p.moeda,
        net: ps.net,
        trades: p.linhas.length,
      };
      const aposStop = ps.tradesAfterStop ?? 0;
      const semFolga = ps.rows.filter((r) => r.authorization === AUTHORIZATION.NO_ROOM).length;

      // Continuar operando depois do stop é o fato mais forte do dia: vem primeiro
      // e cala os outros, porque é dele que a conversa trata.
      if (aposStop > 0) {
        out.push({
          ...base,
          tom: 'alerta',
          titulo: 'Continuou operando depois do stop',
          detalhe: `o stop do dia foi atingido na ${ordinalPt(ps.stopHitIndex)} das ${ps.count} operações, e mais ${aposStop} ${aposStop === 1 ? 'foi aberta' : 'foram abertas'} depois.`,
        });
        continue;
      }
      if (ps.closedBeyondStop) {
        out.push({
          ...base,
          tom: 'alerta',
          titulo: 'O dia fechou além do stop',
          detalhe: `nenhuma operação foi aberta fora das regras, mas o conjunto passou o limite do dia${ps.beyondStopBy != null ? ` por ${ps.beyondStopBy}` : ''}.`,
        });
        continue;
      }
      if (semFolga > 0) {
        out.push({
          ...base,
          tom: 'atencao',
          titulo: 'Operação aberta sem orçamento',
          detalhe: `${semFolga} ${semFolga === 1 ? 'operação abriu' : 'operações abriram'} com folga menor que o risco que o plano autoriza.`,
        });
        continue;
      }
      if (ps.reachedGoal) {
        const depois = ps.goalHitIndex != null ? ps.count - ps.goalHitIndex - 1 : 0;
        out.push({
          ...base,
          tom: depois > 0 ? 'atencao' : 'bom',
          titulo: depois > 0 ? 'Bateu a meta e continuou' : 'Bateu a meta e parou',
          detalhe: depois > 0
            ? `a meta do dia foi atingida na ${ordinalPt(ps.goalHitIndex)} operação, e vieram mais ${depois}.`
            : 'meta do dia atingida e o dia encerrado — é o comportamento que o plano pede.',
        });
      }
    }
  }
  return out;
}

const ORDINAIS_PT = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
const ordinalPt = (i) => (Number.isInteger(i) ? (ORDINAIS_PT[i] ?? `${i + 1}ª`) : '—');
