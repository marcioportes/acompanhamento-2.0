/**
 * adjustExplainers.js — cópia da etapa 6 (Ajustar) do ritual de fechamento.
 *
 * Issue #418. A etapa era a única das oito sem título, sem frase de abertura e
 * sem uma linha explicando os dois modelos que sustentam a decisão de quanto
 * arriscar no próximo ciclo. O aluno via "Risco ótimo (Kelly ¼)" com um badge
 * escrito `matemática` e percentis crus `p10/p50/p90`.
 *
 * Duas camadas:
 *   1. EXPLAINERS — catálogo estático (o que é / por que existe / o que muda na
 *      sua decisão). Mesmo papel que `GATES_BY_TRANSITION` cumpre na etapa 5.
 *   2. builders — leitura do NÚMERO do aluno, cada uma com predicado sobre o
 *      dado. Precedente direto: `tpsHints.js` (#416), criado porque predicado
 *      inline no JSX não é testável — e foi assim que cinco hints viraram proxy
 *      da nota em vez de leitura do dado.
 *
 * Regra contra drift: a cópia lê `triggeredRule` e números já decididos pelo
 * `closurePlanAdvisor`. NUNCA re-deriva regra. O `rationale` cru do advisor
 * continua indo para o Firestore e para o `MentorClosureView`, onde o
 * vocabulário técnico é adequado.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Abaixo disto a probabilidade de perda é frágil demais para virar manchete
// sozinha — a leitura passa a qualificar o número pelo tamanho do pool.
const SMALL_POOL = 30;

// Folga mínima entre Kelly e o risco atual para a leitura dizer que há espaço.
// Abaixo disso os dois números são o mesmo dentro do erro da amostra.
const KELLY_SLACK_RATIO = 1.15;

/**
 * Percentual de risco por trade com a precisão que o número exige.
 *
 * Kelly em amostra ruim devolve frações de décimo (0,0285%); com uma casa
 * decimal isso vira "0.0%", que lido ao pé da letra manda o aluno parar de
 * operar. Abaixo de 0,1% mostra duas casas.
 */
export function formatRiskPct(pct) {
  if (!isNum(pct)) return '—';
  const abs = Math.abs(pct);
  if (abs > 0 && abs < 0.1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

export const EXPLAINERS = Object.freeze({
  kelly: Object.freeze({
    id: 'kelly',
    friendlyLabel: 'Até quanto dá pra arriscar sem se tirar do jogo',
    technicalLabel: 'Kelly ¼',
    whatIs:
      'Uma conta que olha o seu histórico — quanto você ganha em média por trade e o quanto os '
      + 'resultados variam — e devolve o maior risco por operação que esse histórico sustenta.',
    whyExists:
      'Arriscar pouco demais deixa dinheiro na mesa. Arriscar demais te tira do jogo antes de o '
      + 'método aparecer, porque uma sequência ruim leva o capital embora. Existe um ponto de virada '
      + 'entre os dois, e ele depende do seu histórico, não da sua vontade. Usamos um quarto do que a '
      + 'fórmula aponta: o valor cheio é agressivo demais para quem ainda tem poucos trades.',
    soWhat:
      'Se o número está acima do que você arrisca hoje, há folga — dá pra crescer sem mudar de '
      + 'estratégia. Se está abaixo, o seu tamanho de posição está apoiado num histórico que não o '
      + 'sustenta, e reduzir é o que protege o próximo ciclo.',
  }),
  monteCarlo: Object.freeze({
    id: 'monteCarlo',
    friendlyLabel: 'Que faixa de resultado esperar do próximo ciclo',
    technicalLabel: 'Monte Carlo',
    whatIs:
      'Sorteamos mil vezes um ciclo inteiro, tirando trades do seu próprio histórico com reposição, '
      + 'e somamos o resultado de cada um. O que aparece é a distribuição dos ciclos que a sua '
      + 'operação é capaz de produzir.',
    whyExists:
      'O resultado do mês que vem não é um número, é uma faixa. Um ciclo bom e um ciclo ruim saem '
      + 'exatamente da mesma operação — muda só a ordem em que os trades caíram. Ver a faixa impede '
      + 'as duas leituras erradas: comemorar um mês bom como prova de método, e condenar um mês ruim '
      + 'como prova de fracasso.',
    soWhat:
      'A probabilidade de perda diz com que frequência a sua operação, do jeito que está hoje, '
      + 'termina um ciclo no vermelho. Se esse número é alto, disciplina não resolve — o que precisa '
      + 'mudar é o tamanho do risco ou a estratégia. E a largura da faixa diz o quanto o seu '
      + 'resultado ainda depende de sorte.',
  }),
});

/**
 * Leitura do Kelly para ESTE aluno.
 *
 * @param {Object} kelly — saída de `computeKelly` (kellySafe, sampleSize, expectancy_R, reason)
 * @param {number} currentRisk — `plan.riskPerOperation`, em PONTOS PERCENTUAIS (0,84 = 0,84%)
 * @returns {{ headline: string, tone: 'positive'|'caution'|'neutral'|'unavailable', note: string|null }}
 */
export function buildKellyReading(kelly, currentRisk) {
  const k = kelly || {};
  if (k.reason === 'insufficient_sample') {
    return {
      headline: `Ainda não dá pra calcular: ${k.sampleSize} trade${k.sampleSize === 1 ? '' : 's'} no histórico, e a conta precisa de pelo menos 10.`,
      tone: 'unavailable',
      note: 'Com amostra menor que isso, a variação dos resultados não é estimável — qualquer número sairia inventado.',
    };
  }
  if (k.reason === 'no_trades') {
    return {
      headline: 'Ainda não dá pra calcular: não há trades no histórico deste plano.',
      tone: 'unavailable',
      note: null,
    };
  }
  if (k.reason === 'no_plan') {
    return {
      headline: 'Ainda não dá pra calcular: o plano não tem capital e risco por operação definidos.',
      tone: 'unavailable',
      note: null,
    };
  }
  if (k.reason === 'zero_variance') {
    return {
      headline: 'Ainda não dá pra calcular: todos os trades do histórico têm o mesmo resultado.',
      tone: 'unavailable',
      note: 'Resultado idêntico em toda a amostra costuma ser importação incompleta, não operação real.',
    };
  }
  if (!isNum(k.kellySafe) || !isNum(currentRisk) || currentRisk <= 0) {
    return { headline: 'Ainda não dá pra calcular.', tone: 'unavailable', note: null };
  }

  const safePct = k.kellySafe * 100;
  const safeStr = formatRiskPct(safePct);
  const curStr = `${currentRisk}%`;

  if (safePct > currentRisk * KELLY_SLACK_RATIO) {
    return {
      headline: `O seu histórico sustenta até ${safeStr} por trade, e você arrisca ${curStr}. Há folga.`,
      tone: 'positive',
      note: 'Folga não é ordem de aumentar: a recomendação abaixo só escala se a disciplina do ciclo também tiver fechado limpa.',
    };
  }
  if (safePct < currentRisk) {
    return {
      headline: `O seu histórico sustenta ${safeStr} por trade, abaixo dos ${curStr} que você arrisca hoje.`,
      tone: 'caution',
      note: 'O tamanho atual está apoiado num resultado que a sua própria série não sustenta. É o sinal mais direto para reduzir.',
    };
  }
  return {
    headline: `O seu histórico sustenta ${safeStr} por trade, praticamente o que você já arrisca (${curStr}).`,
    tone: 'neutral',
    note: 'Os dois números estão colados: não há informação aqui para mexer no tamanho em nenhuma direção.',
  };
}

/**
 * Leitura do Monte Carlo para ESTE aluno.
 *
 * `pLoss` é a manchete: responde "o que eu ganho olhando isso" melhor que
 * qualquer percentil. Vem qualificado pelo tamanho do pool — com amostra
 * pequena o número é frágil e não pode dominar a leitura sozinho.
 *
 * @param {Object} mc — saída de `projectNextCycle` (pLoss, p10, p50, p90, samplePoolSize, reason)
 * @param {Object} [opts]
 * @param {number|null} [opts.p50Pct] — mediana já convertida em % do capital base, ou null
 *   quando `pctOfBase` não sustenta a conversão (D-01, #416: sem base a leitura sai em moeda)
 * @param {(v: number) => string} [opts.formatCurrency]
 * @returns {{ headline: string, tone: string, note: string|null }}
 */
export function buildMcReading(mc, opts = {}) {
  const m = mc || {};
  const fmt = typeof opts.formatCurrency === 'function' ? opts.formatCurrency : (v) => String(v);

  if (m.reason === 'empty_pool') {
    return {
      headline: 'Ainda não dá pra projetar: não há trades no histórico para sortear cenários.',
      tone: 'unavailable',
      note: null,
    };
  }
  if (m.reason) {
    return { headline: 'Ainda não dá pra projetar o próximo ciclo.', tone: 'unavailable', note: null };
  }
  const notes = [];
  if (isNum(m.samplePoolSize) && m.samplePoolSize < SMALL_POOL) {
    notes.push(
      `Os cenários saem de ${m.samplePoolSize} trade${m.samplePoolSize === 1 ? '' : 's'} do seu histórico. `
      + 'Amostra pequena: a faixa é uma indicação, não uma previsão.',
    );
  }

  // Mediana: em % do capital base quando há base; em moeda quando não há
  // (D-01, #416: sem base utilizável não existe percentual honesto).
  const medianStr = isNum(opts.p50Pct)
    ? `${opts.p50Pct >= 0 ? '+' : ''}${opts.p50Pct.toFixed(1)}% do capital base`
    : (isNum(m.p50) ? fmt(m.p50) : null);

  // Sem `pLoss` — draft antigo, ou projeção vinda de fora do motor atual — a
  // leitura cai na faixa em vez de sumir da tela.
  if (!isNum(m.pLoss) || !isNum(m.nSims)) {
    if (!medianStr) {
      return { headline: 'Ainda não dá pra projetar o próximo ciclo.', tone: 'unavailable', note: null };
    }
    return {
      headline: `O ciclo mediano fecha em ${medianStr} — mas a faixa abaixo é o que a sua operação realmente produz.`,
      tone: 'neutral',
      note: notes.length ? notes.join(' ') : null,
    };
  }

  const lossSims = Math.round(m.pLoss * m.nSims);
  const lossPct = Math.round(m.pLoss * 100);
  const headline = `Em ${lossSims} dos ${m.nSims} cenários o próximo ciclo termina no vermelho — ${lossPct}%.`;
  if (medianStr) notes.push(`O ciclo mediano fecha em ${medianStr}.`);

  const tone = m.pLoss >= 0.5 ? 'caution' : m.pLoss <= 0.3 ? 'positive' : 'neutral';
  return { headline, tone, note: notes.length ? notes.join(' ') : null };
}

/**
 * Cópia da recomendação, a partir do `triggeredRule` já decidido pelo advisor.
 *
 * O `rationale` cru é a maior fonte de jargão da tela ("Sample 20 < 50 trades",
 * "edge", "escalar size", "Expectancy +0.20R"). Reescrever as strings do advisor
 * quebraria as asserções de `closurePlanAdvisor.test.js` e mexeria em lógica de
 * negócio — aqui só se traduz o que ele já decidiu.
 *
 * @param {Object} advice — saída de `advisePlanAdjustment`
 * @param {number} [currentRisk] — `plan.riskPerOperation` vigente, em pontos percentuais
 * @returns {{ headline: string, body: string, risks: string[] }}
 *   `risks` é a versão do aluno; `advice.risks` cru continua indo ao mentor.
 */
export function buildAdviceCopy(advice, currentRisk) {
  const a = advice || {};
  const rule = a.triggeredRule;
  // `currentRisk` vem do plano, não do advisor: o retorno do advisor traz o
  // risco NOVO (`newRiskPerOp`), nunca o vigente.
  const cur = isNum(currentRisk) ? currentRisk : null;
  const next = isNum(a.newRiskPerOp) ? a.newRiskPerOp : null;

  switch (rule) {
    case 'pause_restructure':
      return {
        risks: [
          'Repetir no próximo ciclo o padrão que quebrou este',
          'Perder mais capital do que já perdeu aqui',
          'Entrar na espiral de tentar recuperar o que saiu',
        ],
        headline: 'Pausar antes de operar o próximo ciclo',
        body:
          'O ciclo teve sinais de descontrole graves o bastante para que continuar no tamanho atual '
          + 'seja risco real de perder a conta. A sugestão é não operar até conversar com o mentor e '
          + 'reconstruir o plano. O mentor já foi avisado.',
      };
    case 'insufficient_sample':
      return {
        risks: ['Com poucos trades, o que parece método ainda pode ser sequência de sorte'],
        headline: 'Manter o plano e acumular mais trades',
        body:
          'Ainda são poucos trades para saber se o resultado veio do método ou do acaso. Enquanto a '
          + 'amostra não crescer, mexer no tamanho da posição é apostar numa leitura que os números '
          + 'ainda não sustentam.',
      };
    case 'scale_up':
      return {
        risks: [
          'Posição maior faz a perda funda do ciclo ficar maior também — acompanhe o recuo máximo',
          'Se a aderência cair, voltar ao tamanho anterior na hora',
        ],
        headline: next != null && cur != null ? `Subir o risco por trade de ${cur}% para ${next}%` : 'Subir o risco por trade',
        body:
          'O histórico sustenta um tamanho maior, não houve retrocesso na sua maturidade e o ciclo '
          + 'fechou sem sinal comportamental pendente. É o cenário em que crescer é decisão de plano, '
          + 'não de impulso.',
      };
    case 'scale_down':
      return {
        risks: ['Posição menor rende menos no ciclo — é troca deliberada por estabilidade'],
        headline: next != null && cur != null ? `Reduzir o risco por trade de ${cur}% para ${next}%` : 'Reduzir o risco por trade',
        body:
          'O ciclo deixou marcas — perda funda demais, regras quebradas ou episódios de descontrole. '
          + 'Reduzir o tamanho não é punição: é o que dá margem para a disciplina firmar antes de o '
          + 'capital ser cobrado por ela.',
      };
    case 'regression':
      return {
        risks: ['Uma dimensão da sua avaliação andou para trás — crescer agora empilha risco sobre instabilidade'],
        headline: 'Manter o plano e recuperar o terreno perdido',
        body:
          'Alguma dimensão da sua avaliação andou para trás neste ciclo. Antes de mexer em tamanho, o '
          + 'próximo ciclo tem um alvo mais útil: o ponto que você mesmo marcou para melhorar.',
      };
    case 'observe':
    default:
      return {
        risks: [],
        headline: 'Manter o plano como está',
        body:
          'Nada no ciclo pede mudança de tamanho e nada pede recuo. O próximo ciclo é de observação: '
          + 'repetir o processo e ver se o resultado se sustenta.',
      };
  }
}

/**
 * Rótulos da decisão registrada. Antes a tela imprimia a chave crua do draft
 * ("Decisão registrada: suggestion_accepted").
 */
export const DECISION_LABELS = Object.freeze({
  suggestion_accepted: 'você aceitou a recomendação',
  manual_edit: 'você ajustou os números à mão',
  kept: 'você manteve o plano como estava',
});

export const ADJUST_COPY_CONSTANTS = Object.freeze({ SMALL_POOL, KELLY_SLACK_RATIO });
