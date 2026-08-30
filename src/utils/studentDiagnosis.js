/**
 * studentDiagnosis — o que dói e o que funciona, na ficha do aluno.
 *
 * MOTIVO (Marcio, 29/08): *"a página deveria ser mais contundente em responder o
 * que causa mais dor e o que melhor funciona, tanto no setup quanto no emocional,
 * e sugerir ao mentor subsídio para feedback"*. A ficha tinha os dados espalhados
 * em cards densos — "uma sequência de postes com fios embaraçados".
 *
 * E tinha um viés grave: a Análise por Setup escondia atrás de "Esporádicos"
 * qualquer setup com menos de 3 trades. Medido em 29/08, na ficha do próprio
 * Marcio isso ocultava os TRÊS melhores setups (Ponto de Reação +1.021 em 2/2,
 * Rompimento +630 em 2/2, Continuidade +320) e deixava visíveis só os dois que
 * perdiam. A tela mostrava a dor e escondia o que funciona.
 *
 * UNIDADE: R, não dinheiro. O aluno pode operar duas contas em moedas diferentes
 * (Wilson opera BRL e USD), e somar isso num número só é o erro que o #267/#289
 * já custou caro. Dinheiro só aparece quando o grupo inteiro está numa moeda.
 */

import { rrBreakdown } from './rrBreakdown';

const num = (v) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Risco autorizado por operação, em dinheiro, do plano do trade. */
const roDoTrade = (trade, planoPorId) => {
  const p = planoPorId?.get?.(trade?.planId) ?? null;
  if (!p || !(p.pl > 0) || !(p.riskPerOperation > 0)) return null;
  return p.pl * (p.riskPerOperation / 100);
};

/** Chave do setup: o que o aluno declarou, ou "Sem setup". */
export const chaveSetup = (t) => (t?.setup ? String(t.setup).trim() : 'Sem setup');

/** Chave emocional: emoção de ENTRADA — é a que descreve a decisão. */
export const chaveEmocao = (t) => {
  const bruto = t?.emotionEntry ?? t?.emotion;
  if (!bruto) return 'Não informada';
  const s = String(bruto).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Agrupa trades por uma chave e mede impacto.
 *
 * @returns {Array<{chave, n, wins, losses, wr, r, comR, moedas:Set, pl, plPorTrade, rPorTrade}>}
 *   ordenado do mais negativo para o mais positivo (a dor primeiro).
 */
export function agruparImpacto(trades, chaveFn, planoPorId = null) {
  const grupos = new Map();

  for (const t of trades ?? []) {
    const res = num(t?.result);
    if (res == null) continue;
    const chave = chaveFn(t);
    const g = grupos.get(chave) ?? {
      chave, n: 0, wins: 0, losses: 0, r: 0, comR: 0, pl: 0, moedas: new Set(),
    };
    g.n += 1;
    if (res > 0) g.wins += 1;
    else if (res < 0) g.losses += 1;
    g.pl += res;
    g.moedas.add(t.currency ?? 'BRL');

    const ro = roDoTrade(t, planoPorId);
    if (ro) { g.r += res / ro; g.comR += 1; }
    grupos.set(chave, g);
  }

  return [...grupos.values()]
    .map((g) => ({
      ...g,
      wr: g.n > 0 ? Math.round((g.wins / g.n) * 100) : 0,
      r: Math.round(g.r * 100) / 100,
      pl: Math.round(g.pl * 100) / 100,
      plPorTrade: g.n > 0 ? Math.round((g.pl / g.n) * 100) / 100 : 0,
      rPorTrade: g.comR > 0 ? Math.round((g.r / g.comR) * 100) / 100 : null,
      // Dinheiro só é somável quando o grupo inteiro está numa moeda só.
      moedaUnica: g.moedas.size === 1 ? [...g.moedas][0] : null,
    }))
    .sort((a, b) => impacto(a) - impacto(b));
}

/** Impacto comparável: R quando há plano, dinheiro quando não há. */
const impacto = (g) => (g.comR > 0 ? g.r : g.pl);

/**
 * O extremo negativo e o positivo de um agrupamento.
 *
 * NENHUM CORTE POR AMOSTRA: um setup com 2 trades e 2 ganhos é exatamente o que o
 * mentor quer levar para a conversa. O tamanho da amostra vai junto, para ele
 * pesar — esconder era o defeito, não a solução.
 */
export function extremos(grupos) {
  const lista = grupos ?? [];
  const dor = lista.find((g) => impacto(g) < 0) ?? null;
  const positivos = lista.filter((g) => impacto(g) > 0);
  const forca = positivos.length ? positivos[positivos.length - 1] : null;
  return { dor, forca };
}

/**
 * Diagnóstico completo da ficha.
 *
 * @param {Array} trades — trades do aluno
 * @param {Map} planoPorId — planos por id, para converter em R
 */
export function diagnosticoDoAluno(trades, planoPorId = null) {
  const lista = Array.isArray(trades) ? trades : [];
  const setups = agruparImpacto(lista, chaveSetup, planoPorId);
  const emocoes = agruparImpacto(lista, chaveEmocao, planoPorId);

  return {
    trades: lista.length,
    setups: { todos: setups, ...extremos(setups) },
    emocoes: { todos: emocoes, ...extremos(emocoes) },
  };
}

/**
 * Subsídio para o feedback: uma frase que o mentor pode dizer ao aluno.
 *
 * Não é texto de IA nem motivacional — é a leitura direta dos dois extremos, com
 * os números que a sustentam. Se não houver contraste, não inventa frase.
 */
export function fraseParaOFeedback(diag) {
  const s = diag?.setups ?? {};
  const e = diag?.emocoes ?? {};
  const partes = [];

  if (s.dor && s.forca) {
    partes.push(
      `No setup, ${s.dor.chave} é onde ele perde (${s.dor.n} ${s.dor.n === 1 ? 'trade' : 'trades'}, ${s.dor.wr}% de acerto) enquanto ${s.forca.chave} entrega (${s.forca.n} ${s.forca.n === 1 ? 'trade' : 'trades'}, ${s.forca.wr}%).`,
    );
  } else if (s.dor) {
    partes.push(`No setup, ${s.dor.chave} concentra a perda e nenhum outro compensa.`);
  } else if (s.forca) {
    partes.push(`No setup, ${s.forca.chave} sustenta o resultado e nada está drenando.`);
  }

  if (e.dor) {
    partes.push(
      e.dor.chave === 'Não informada'
        ? 'A maior perda vem de trades sem emoção declarada — sem isso não há conversa emocional possível.'
        : `Emocionalmente, o prejuízo se concentra quando ele entra em "${e.dor.chave}".`,
    );
  }
  if (e.forca && e.forca.chave !== 'Não informada') {
    partes.push(`O melhor dele aparece em "${e.forca.chave}".`);
  }

  return partes.length ? partes.join(' ') : null;
}

// ============================================================================
// Prescrições — o que MUDAR e o que PRESERVAR, pronto para a revisão
// ============================================================================

/**
 * Marcio, 29/08: *"preciso de uma análise concisa para entender o que pode mudar
 * para resolver a dor e manter o que funciona... que me dê leverage de não ter que
 * minerar informação cada vez que tenho que fazer uma revisão"*.
 *
 * Cada regra aqui só existe porque o campo que ela lê EXISTE na base. Medido em
 * 29/08 sobre 381 trades: `takeProfit` em 0, `mepPrice` em 55, `stopLoss` em 282,
 * `emotionEntry` em 377, `entryTime`/`exitTime` em ~379. Prescrição sobre campo
 * vazio é adivinhação com cara de análise.
 *
 * Cada item devolve: o que mudar, a evidência numérica, e como dizer ao aluno.
 */

const TIPO = { OPERACIONAL: 'operacional', EMOCIONAL: 'emocional', PRESERVAR: 'preservar' };

/**
 * Quanto dos GANHOS chegou ao alvo que o plano define (`plan.rrTarget`).
 *
 * Só ganho entra: perda não alcança alvo positivo, e misturar os dois produziria um
 * percentual que não descreve nada. O risco vem do `rrBreakdown` (#402) — mesma
 * conversão de tick da compliance, sem fórmula nova.
 *
 * @returns {{alvo, vencedores, atingiram, pctAtingiu, rrMedio}|null}
 */
export function alcanceDoAlvo(trades, planoPorId) {
  let vencedores = 0;
  let atingiram = 0;
  let somaRR = 0;
  let alvo = null;

  for (const t of trades ?? []) {
    const plano = planoPorId?.get?.(t?.planId) ?? null;
    if (!plano?.rrTarget) continue;
    const b = rrBreakdown(t, plano);
    if (b.rrTaken == null || !(num(t.result) > 0)) continue;
    vencedores += 1;
    somaRR += b.rrTaken;
    if (b.rrTaken >= plano.rrTarget) atingiram += 1;
    alvo = plano.rrTarget; // alvo do plano em que ele opera
  }

  if (!vencedores) return null;
  return {
    alvo,
    vencedores,
    atingiram,
    pctAtingiu: Math.round((atingiram / vencedores) * 100),
    rrMedio: somaRR / vencedores,
  };
}

const duracaoMin = (t) => {
  if (!t?.entryTime || !t?.exitTime) return null;
  const ms = new Date(t.exitTime) - new Date(t.entryTime);
  return Number.isFinite(ms) && ms > 0 ? ms / 60000 : null;
};

const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

/** Dias em que o aluno tomou 3+ perdas seguidas — a sequência que ninguém corta sozinho. */
export function diasDeSequenciaRuim(trades, minimo = 3) {
  const porDia = new Map();
  for (const t of trades ?? []) {
    if (!t?.date) continue;
    const arr = porDia.get(t.date) ?? [];
    arr.push(t);
    porDia.set(t.date, arr);
  }
  const dias = [];
  for (const [data, lista] of porDia) {
    const ordenada = [...lista].sort((a, b) => String(a.entryTime ?? '').localeCompare(String(b.entryTime ?? '')));
    let seq = 0;
    let maior = 0;
    for (const t of ordenada) {
      if ((num(t.result) ?? 0) < 0) { seq += 1; maior = Math.max(maior, seq); } else seq = 0;
    }
    if (maior >= minimo) dias.push({ data, perdasSeguidas: maior });
  }
  return dias.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * O que fazer, em ordem de impacto na conversa.
 *
 * @returns {Array<{tipo, mudanca, evidencia, comoDizer}>}
 */
export function prescricoes(trades, planoPorId = null) {
  const lista = (trades ?? []).filter((t) => num(t?.result) != null);
  if (!lista.length) return [];

  const diag = diagnosticoDoAluno(lista, planoPorId);
  const out = [];
  const n = lista.length;

  // ── OPERACIONAL ───────────────────────────────────────────────────────────

  // O ALVO ESTÁ NO PLANO (Marcio, 29/08). Eu tinha escrito uma prescrição pedindo
  // que o aluno declarasse alvo por trade porque `trade.takeProfit` está vazio nos
  // 381 — mas o alvo nunca morou ali. Ele é `plan.rrTarget`, presente nos 28 planos
  // da base. A pergunta certa não é "declarou?", é "chegou lá?".
  const alvo = alcanceDoAlvo(lista, planoPorId);
  if (alvo && alvo.vencedores >= 4 && alvo.pctAtingiu < 50) {
    out.push({
      tipo: TIPO.OPERACIONAL,
      mudanca: `Levar o ganho até o alvo do plano (${alvo.alvo}R)`,
      evidencia: `${alvo.vencedores - alvo.atingiram} de ${alvo.vencedores} ganhos ficaram abaixo do alvo · R:R médio no ganho ${alvo.rrMedio.toFixed(2)}`,
      comoDizer: `Seu plano define alvo de ${alvo.alvo}R e ${alvo.vencedores - alvo.atingiram} dos seus ${alvo.vencedores} ganhos saíram antes disso. O trade não está errado — a saída está sendo antecipada. O que te tira da posição antes do alvo?`,
    });
  }

  // Sem stop declarado: risco vira retroativo (DEC-006) e o plano perde o freio.
  const semStop = lista.filter((t) => t.stopLoss == null || t.stopLoss === '').length;
  if (semStop / n >= 0.2) {
    out.push({
      tipo: TIPO.OPERACIONAL,
      mudanca: 'Declarar o stop em toda operação',
      evidencia: `${semStop} de ${n} trades (${Math.round((semStop / n) * 100)}%) entraram sem stop declarado`,
      comoDizer: 'Operação sem stop declarado não tem risco definido — o risco vira o que o mercado decidir. Não é sobre acertar o ponto, é sobre existir um.',
    });
  }

  // Setup que drena, com amostra que sustenta a conversa.
  const dorSetup = diag.setups.dor;
  if (dorSetup && dorSetup.n >= 3) {
    out.push({
      tipo: TIPO.OPERACIONAL,
      mudanca: `Suspender ${dorSetup.chave} até revisar o critério de entrada`,
      evidencia: `${dorSetup.n} trades, ${dorSetup.wr}% de acerto${dorSetup.comR ? `, ${dorSetup.r.toFixed(1)}R acumulados` : ''}`,
      comoDizer: `${dorSetup.chave} é onde o dinheiro sai. Antes de operar de novo, quero ver o critério escrito: o que precisa estar na tela para ser esse setup, e o que o desqualifica.`,
    });
  }

  // ── EMOCIONAL ─────────────────────────────────────────────────────────────

  // Estado emocional com prejuízo e acerto baixo: vira porta, não sermão.
  // Exige MAGNITUDE, não só sinal: sem isso, "Neutro" com −0,3R em 4 trades virava
  // prescrição emocional ao lado de "Ansioso" com −3,8R e 0% de acerto. Um risco
  // autorizado inteiro perdido é o piso do que merece virar regra.
  const emocaoToxica = diag.emocoes.todos.find(
    (e) => e.chave !== 'Não informada' && e.n >= 3 && e.wr <= 30
      && (e.comR ? e.r <= -1 : e.pl < 0),
  );
  if (emocaoToxica) {
    out.push({
      tipo: TIPO.EMOCIONAL,
      mudanca: `Não abrir operação em estado "${emocaoToxica.chave}"`,
      evidencia: `${emocaoToxica.n} trades nesse estado, ${emocaoToxica.wr}% de acerto${emocaoToxica.comR ? `, ${emocaoToxica.r.toFixed(1)}R` : ''}`,
      comoDizer: `Quando você marca "${emocaoToxica.chave}" na entrada, o resultado não aparece — são ${emocaoToxica.n} trades e ${emocaoToxica.wr}% de acerto. A regra não é controlar a emoção, é não operar nela.`,
    });
  }

  // Sequência de perdas no mesmo dia: regra de parada, não força de vontade.
  const dias = diasDeSequenciaRuim(lista);
  if (dias.length) {
    out.push({
      tipo: TIPO.EMOCIONAL,
      mudanca: 'Parar o dia após duas perdas seguidas',
      evidencia: `${dias.length} ${dias.length === 1 ? 'dia' : 'dias'} com 3 ou mais perdas em sequência`,
      comoDizer: 'Depois da segunda perda seguida, o dia já disse o que tinha para dizer. A regra existe para não depender de você estar bem naquele momento.',
    });
  }

  // Trades sem emoção declarada: sem isso a conversa emocional não tem sobre o quê.
  const semEmocao = lista.filter((t) => !t.emotionEntry && !t.emotion).length;
  if (semEmocao / n >= 0.3) {
    out.push({
      tipo: TIPO.EMOCIONAL,
      mudanca: 'Registrar o estado na entrada',
      evidencia: `${semEmocao} de ${n} trades sem emoção declarada`,
      comoDizer: 'Sem o estado registrado na hora, a gente reconstrói a conversa pela memória — e a memória conta a história que o resultado sugere.',
    });
  }

  // ── PRESERVAR ─────────────────────────────────────────────────────────────

  const forcaSetup = diag.setups.forca;
  if (forcaSetup) {
    out.push({
      tipo: TIPO.PRESERVAR,
      mudanca: `Manter ${forcaSetup.chave}`,
      evidencia: `${forcaSetup.n} ${forcaSetup.n === 1 ? 'trade' : 'trades'}, ${forcaSetup.wr}% de acerto${forcaSetup.comR ? `, ${forcaSetup.r >= 0 ? '+' : ''}${forcaSetup.r.toFixed(1)}R` : ''}${forcaSetup.n < 3 ? ' — amostra pequena, observar' : ''}`,
      comoDizer: `${forcaSetup.chave} é o que está entregando. Antes de procurar setup novo, quero ver frequência maior nesse.`,
    });
  }

  const forcaEmocao = diag.emocoes.forca;
  if (forcaEmocao && forcaEmocao.chave !== 'Não informada') {
    out.push({
      tipo: TIPO.PRESERVAR,
      mudanca: `Reproduzir a condição de "${forcaEmocao.chave}"`,
      evidencia: `${forcaEmocao.n} trades nesse estado, ${forcaEmocao.wr}% de acerto`,
      comoDizer: `Seu melhor resultado sai em "${forcaEmocao.chave}". O que você fez ANTES do pregão nesses dias? É isso que a gente quer transformar em rotina.`,
    });
  }

  // Corta o perdedor rápido e deixa o vencedor correr — quando é verdade, é a
  // coisa mais difícil do ofício e ninguém diz ao aluno que ele já faz.
  const comDuracao = lista.map((t) => ({ r: num(t.result) ?? 0, d: duracaoMin(t) })).filter((x) => x.d != null);
  const tv = media(comDuracao.filter((x) => x.r > 0).map((x) => x.d));
  const tp = media(comDuracao.filter((x) => x.r < 0).map((x) => x.d));
  if (tv != null && tp != null && comDuracao.length >= 8 && tp / tv <= 0.8) {
    out.push({
      tipo: TIPO.PRESERVAR,
      mudanca: 'Manter a assimetria de tempo entre ganho e perda',
      evidencia: `vencedor dura ${Math.round(tv)}min contra ${Math.round(tp)}min do perdedor`,
      comoDizer: 'Você corta a perda rápido e deixa o ganho correr — é o inverso do que a maioria faz sob pressão. Isso não é sorte, é execução, e é o que sustenta o resto.',
    });
  }

  return out;
}

export const TIPO_PRESCRICAO = TIPO;

/**
 * Episódios — os dias em que o processo saiu do trilho, com data.
 *
 * É o que sobra de útil do Perfil Emocional depois do teste da conversa: score
 * 68/100 é nota de prova (gera defesa, não mudança) e a distribuição de emoções
 * descreve sem cruzar com resultado. O que se discute com o aluno é EVENTO —
 * "no dia 26 você tomou três perdas seguidas e continuou" — porque evento tem
 * data, tem contexto e vira regra.
 *
 * Duas fontes: o motor comportamental (`behaviorProfile.families`, CHUNK-11) e a
 * sequência de perdas do próprio dia, que nenhum detector cobre.
 */
const FAMILIAS_EPISODIO = {
  TILT: 'perdeu o controle depois de uma perda',
  LOSS_CHASING: 'reentrou quente para recuperar',
  IMPULSE_CLUSTER: 'sequência rápida de entradas',
  CHASE_REENTRY: 'perseguiu o preço',
  DIRECTION_FLIP: 'virou a mão',
  STOP_PANIC: 'saiu no pânico',
};

export function episodios(trades, planoPorId = null) {
  const lista = trades ?? [];
  const porData = new Map();

  const add = (data, texto, peso) => {
    if (!data) return;
    const e = porData.get(data) ?? { data, marcas: [], peso: 0 };
    if (!e.marcas.includes(texto)) e.marcas.push(texto);
    e.peso += peso;
    porData.set(data, e);
  };

  for (const t of lista) {
    const fams = t?.behaviorProfile?.families;
    if (!Array.isArray(fams)) continue;
    const cleared = Array.isArray(t.mentorClearedViolations) ? t.mentorClearedViolations : [];
    for (const f of fams) {
      const texto = FAMILIAS_EPISODIO[f?.canonicalCode];
      if (!texto) continue;
      if (cleared.includes(`${f.canonicalCode}:${t.id}`)) continue;
      add(t.date, texto, f.severity === 'HIGH' ? 3 : f.severity === 'MEDIUM' ? 2 : 1);
    }
  }

  for (const d of diasDeSequenciaRuim(lista)) {
    add(d.data, `${d.perdasSeguidas} perdas seguidas`, 3);
  }

  // Resultado do dia, em R quando há plano — o episódio custou quanto?
  const resultadoPorDia = new Map();
  for (const t of lista) {
    if (!t?.date) continue;
    const res = num(t.result);
    if (res == null) continue;
    const plano = planoPorId?.get?.(t.planId) ?? null;
    const ro = plano?.pl > 0 && plano?.riskPerOperation > 0 ? plano.pl * (plano.riskPerOperation / 100) : null;
    const acc = resultadoPorDia.get(t.date) ?? { r: 0, comR: 0, trades: 0 };
    acc.trades += 1;
    if (ro) { acc.r += res / ro; acc.comR += 1; }
    resultadoPorDia.set(t.date, acc);
  }

  return [...porData.values()]
    .map((e) => {
      const dia = resultadoPorDia.get(e.data) ?? { r: 0, comR: 0, trades: 0 };
      return {
        ...e,
        trades: dia.trades,
        r: dia.comR ? Math.round(dia.r * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

/**
 * A conta PRINCIPAL do aluno: aquela onde ele de fato opera.
 *
 * Difere do `planoEmFoco` da Torre, que é a conta DO DIA — lá a pergunta é "o que
 * ele fez hoje". Aqui a pergunta é "onde está o histórico dele", e escolher pelo
 * último trade dava resultado ruim: medido em 29/08, o Daniel apareceria com
 * 1 de 7 trades porque o último trade dele foi numa conta quase vazia.
 *
 * Empate no volume decide pelo trade mais recente.
 *
 * @returns {{planId, trades, fora}|null} `fora` = trades do aluno em outras contas
 */
export function contaPrincipal(trades) {
  const porPlano = new Map();
  let total = 0;
  for (const t of trades ?? []) {
    if (!t?.planId) continue;
    total += 1;
    const g = porPlano.get(t.planId) ?? { planId: t.planId, trades: 0, ultima: '' };
    g.trades += 1;
    if ((t.date ?? '') > g.ultima) g.ultima = t.date ?? '';
    porPlano.set(t.planId, g);
  }
  if (!porPlano.size) return null;
  const principal = [...porPlano.values()].sort(
    (a, b) => b.trades - a.trades || b.ultima.localeCompare(a.ultima),
  )[0];
  return { planId: principal.planId, trades: principal.trades, fora: total - principal.trades };
}
