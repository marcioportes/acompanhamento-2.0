/**
 * Dimensão FINANCEIRA — mede CONDUTA de risco, não performance.
 *
 * #376 (23/08/2026) — reescrita a partir da regra de Marcio:
 *
 *   "eficiência, payoff, consistência e drawdown são indicadores de PERFORMANCE, não
 *    de maturidade. Se um aluno teve drawdown de 100% respeitando o limite de sua
 *    perda, usou o modelo de entrada, parou o ciclo e se manteve disciplinado sem
 *    operar até o fechamento — como pode ser penalizado?"
 *
 * Das três dimensões, Emocional e Operacional sempre mediram o que o aluno FEZ. A
 * Financeira media o que ele GANHOU, e era a única assim. O aluno do exemplo fazia
 * tudo certo e a nota caía.
 *
 * O que a versão antiga media, e por que caiu (medido na base real em 23/08):
 *   - eScore (30%)  — captura do ganho teórico. `evLeakage` é null no servidor, então
 *                     a conta comparava o número consigo mesmo: **100 para TODOS os 16
 *                     alunos com dados**, e 0 se a expectativa fosse negativa. Trinta
 *                     por cento da nota era um sim/não disfarçado de nota.
 *   - pScore (25%)  — payoff. Performance.
 *   - cvScore (20%) — a escala (0,3 a 2,0) foi calibrada para dispersão de resultado
 *                     MENSAL, mas o que entrava era dispersão trade a trade, que é
 *                     estruturalmente maior: **0 para 12 dos 16 alunos**.
 *   - ddScore (25%) — queda contra régua ABSOLUTA de 25%, igual para todo mundo,
 *                     ignorando o limite que o próprio aluno definiu no plano.
 *
 * O que mede agora — três componentes de igual peso, todos com dado disponível na base
 * real (`riskPerOperation` e `cycleStop` em 28/28 planos, `roStatus` em 346/351 trades,
 * stop definido em 253/351):
 *
 *   roScore   = % dos trades cujo risco ficou dentro do RO que o plano autoriza
 *   ddScore   = queda medida contra o CYCLE STOP DO PRÓPRIO ALUNO, não contra régua fixa
 *   stopScore = % dos trades que nasceram com proteção definida
 *
 * Disciplina de tamanho (piramidação, sub-sizing, ganância, saída antecipada/tardia)
 * NÃO vira quarto componente: já entra em F pela modulação comportamental
 * (`aggregateBehaviorWeights().netByDimension.F`, aplicada em `evaluateMaturity`).
 * Contar duas vezes seria dobrar a punição pelo mesmo comportamento.
 *
 * Sobre o ddScore — a decisão que responde ao exemplo do Marcio: queda DENTRO do limite
 * pontua 100, qualquer que seja o tamanho dela. Quanto da folga o aluno consumiu é
 * performance; ter respeitado a folga é conduta. Estouro decai proporcionalmente e zera
 * ao dobro do limite — estourar 1% não é a mesma coisa que continuar operando até
 * dobrar a perda planejada.
 *
 * Payoff, expectativa, consistência e drawdown absoluto continuam calculados e exibidos
 * nos painéis. Só pararam de decidir promoção.
 *
 * ⚠️ ESPELHO em functions/maturity/computeFinancial.js — MANTER SINCRONIZADO ⚠️
 */

const FLOOR_TRADES = 5;
const MED_CEILING = FLOOR_TRADES + 30;
const NEUTRAL_SCORE = 50;

// Peso igual para os três. Média direta em vez de 3 × (1/3): `0.333… × 100` três vezes
// devolve 99.99999999999999, e nota cheia precisa ser exatamente 100.

// Estouro do limite: razão 1,0 = exatamente no limite (100); 2,0 = dobro do limite (0).
const DD_BREACH_ZERO = 2.0;

// Régua de segurança quando o plano não define `cycleStop`. Não deveria acontecer
// (28/28 planos preenchem), mas sem denominador a conta viraria gate impossível — foi
// exatamente o defeito do `initialBalance` que este mesmo issue corrigiu.
const DD_FALLBACK_LIMIT_PCT = 25;

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function resolveConfidence(n) {
  if (n >= MED_CEILING) return 'HIGH';
  if (n >= FLOOR_TRADES) return 'MED';
  return 'LOW';
}

/** % dos trades cujo risco por operação ficou dentro do que o plano autoriza. */
export function scoreRiscoPorOperacao(trades) {
  const avaliados = trades.filter((t) => t && typeof t.compliance?.roStatus === 'string');
  if (avaliados.length === 0) return null;
  const dentro = avaliados.filter((t) => t.compliance.roStatus === 'CONFORME').length;
  return (dentro / avaliados.length) * 100;
}

/** Queda contra o limite que o PRÓPRIO aluno definiu. Dentro do limite = 100. */
export function scoreQuedaContraLimite(maxDrawdown, plans) {
  const quedaPct = isFiniteNum(maxDrawdown?.maxDDPercent) ? maxDrawdown.maxDDPercent : null;
  if (quedaPct === null) return null;
  const doPlano = plans
    .map((p) => Number(p?.cycleStop))
    .find((v) => isFiniteNum(v) && v > 0);
  const limite = doPlano ?? DD_FALLBACK_LIMIT_PCT;
  const razao = Math.abs(quedaPct) / limite;
  if (razao <= 1) return 100;
  const excedente = (razao - 1) / (DD_BREACH_ZERO - 1);
  return Math.max(0, 100 * (1 - excedente));
}

/** % dos trades que nasceram com proteção definida. */
export function scoreProtecao(trades) {
  if (trades.length === 0) return null;
  const comStop = trades.filter(
    (t) => t && t.stopLoss != null && isFiniteNum(Number(t.stopLoss)),
  ).length;
  return (comStop / trades.length) * 100;
}

/**
 * @param {{
 *   trades: Array<object>,
 *   plans?: Array<object>,
 *   maxDrawdown?: { maxDDPercent?: number } | null,
 * }} input
 * @returns {{
 *   score: number,
 *   breakdown: { roScore: number, ddScore: number, stopScore: number },
 *   confidence: 'HIGH'|'MED'|'LOW',
 *   neutralFallback: string|null,
 * }}
 */
export function computeFinancial({ trades, plans, maxDrawdown } = {}) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const safePlans = Array.isArray(plans) ? plans : [];
  const N = safeTrades.length;

  if (N === 0) {
    return {
      score: NEUTRAL_SCORE,
      breakdown: { roScore: NEUTRAL_SCORE, ddScore: NEUTRAL_SCORE, stopScore: NEUTRAL_SCORE },
      confidence: 'LOW',
      neutralFallback: 'financial:empty-window',
    };
  }

  const flags = [];
  const ou = (valor, flag) => {
    if (valor === null) {
      flags.push(flag);
      return NEUTRAL_SCORE;
    }
    return valor;
  };

  const roScore = ou(scoreRiscoPorOperacao(safeTrades), 'financial:roScore');
  const ddScore = ou(scoreQuedaContraLimite(maxDrawdown, safePlans), 'financial:ddScore');
  const stopScore = ou(scoreProtecao(safeTrades), 'financial:stopScore');

  const score = (roScore + ddScore + stopScore) / 3;

  return {
    score,
    breakdown: { roScore, ddScore, stopScore },
    confidence: resolveConfidence(N),
    neutralFallback: flags.length === 0 ? null : flags.join(';'),
  };
}
