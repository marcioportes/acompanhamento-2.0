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
