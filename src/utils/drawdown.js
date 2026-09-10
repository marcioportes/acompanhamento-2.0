/**
 * drawdown.js — SSoT do drawdown do Dashboard do Aluno. Issues #413 (defeitos 1-3) e #432.
 *
 * TRÊS DEFEITOS QUE ESTE ARQUIVO EXISTE PARA MATAR:
 *
 * 1. ORDENAÇÃO (o grave). A série era ordenada por `trade.date`, que guarda só
 *    'YYYY-MM-DD'. Trades do mesmo dia empatam; o sort é estável; a sequência
 *    intradiária vira a ordem arbitrária em que o Firestore devolveu os documentos.
 *    No ciclo 2026-08 o card exibiu −R$ 1.170 / −3,9% — o PIOR caso de 432 ordenações
 *    possíveis — contra −R$ 950 / −3,17% na ordem cronológica real. Varia 2,3×.
 *    É a mesma família do #375: campo de DIA usado onde o INSTANTE importa.
 *
 * 2. SEMÂNTICA. O drawdown corrente media distância do saldo INICIAL, não do TOPO.
 *    Quem subiu 10% e caiu 8% aparecia com 0,0% de drawdown — ou seja, o número dizia
 *    "nenhuma queda" exatamente para quem tinha acabado de devolver quase todo o lucro.
 *    Drawdown é, por definição, queda desde o pico.
 *
 * 3. JANELA (#432). A base era `account.currentBalance − account.initialBalance`:
 *    escalares sem dimensão temporal. Selecionar um ciclo passado media a queda pelo
 *    patrimônio de hoje. Aqui a série abre na abertura DAQUELA janela.
 *
 * O percentual é sempre relativo ao PICO vigente — não ao aporte. Um drawdown de
 * R$ 1.000 sobre um pico de R$ 50.000 é 2%, independente de quanto o aluno aportou
 * quando abriu a conta.
 *
 * @see src/utils/windowBalance.js — abertura da janela (#432)
 * @see src/utils/openingBalance.js — carry-over entre ciclos (#267)
 */

/**
 * Instante do trade em ms. Precedência: saída > entrada > dia.
 * `exitTime` é o momento em que o resultado entrou no patrimônio — é ele que ordena a
 * curva. `date` é o último recurso: 'YYYY-MM-DD' resolve para o INÍCIO do dia, então um
 * trade sem hora ancora antes dos trades cronometrados do mesmo dia. Não é uma preferência
 * de negócio, é o que a data significa — e o ponto é ser DETERMINÍSTICO, porque o que
 * havia antes era a ordem em que o Firestore devolveu os documentos (defeito 1).
 * Na base atual `entryTime` está em 100% dos trades e `exitTime` em 99%, então o caso
 * só-dia é residual.
 */
export const tradeInstantMs = (trade) => {
  const raw = trade?.exitTime || trade?.entryTime || trade?.date;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Ordena cronologicamente de verdade. Trades sem instante algum vão para o fim, em
 * ordem estável — não há informação para posicioná-los, e fingir que há é o defeito 1.
 */
export const sortByInstant = (trades) => {
  const withIndex = (trades || []).map((t, i) => ({ t, i, ms: tradeInstantMs(t) }));
  withIndex.sort((a, b) => {
    if (a.ms === null && b.ms === null) return a.i - b.i;
    if (a.ms === null) return 1;
    if (b.ms === null) return -1;
    if (a.ms !== b.ms) return a.ms - b.ms;
    return a.i - b.i;
  });
  return withIndex.map(({ t }) => t);
};

/**
 * Drawdown da janela, peak-to-trough, sobre a curva de patrimônio.
 *
 * @param {Object} params
 * @param {Array}  params.trades         — trades da janela (ordem irrelevante; ordena aqui)
 * @param {number} params.openingBalance — patrimônio na abertura da janela
 * @returns {{
 *   current: { value: number, percent: number },
 *   max: { value: number, percent: number, date: string|null },
 *   peak: number,
 *   equityFinal: number,
 * }}
 */
export const computeDrawdown = ({ trades = [], openingBalance = 0 }) => {
  const base = Number(openingBalance) || 0;
  const sorted = sortByInstant(trades);

  let equity = base;
  let peak = base;
  let maxValue = 0;
  let maxPercent = 0;
  let maxDate = null;

  for (const trade of sorted) {
    equity += Number(trade?.result) || 0;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxValue) {
      maxValue = dd;
      // Relativo ao pico VIGENTE naquele momento — não ao pico final nem ao aporte.
      maxPercent = peak > 0 ? (dd / peak) * 100 : 0;
      maxDate = typeof trade?.date === 'string' ? trade.date : null;
    }
  }

  const currentValue = Math.max(0, peak - equity);
  const currentPercent = peak > 0 ? (currentValue / peak) * 100 : 0;

  return {
    current: { value: currentValue, percent: currentPercent },
    max: { value: maxValue, percent: maxPercent, date: maxDate },
    peak,
    equityFinal: equity,
  };
};

export default computeDrawdown;
