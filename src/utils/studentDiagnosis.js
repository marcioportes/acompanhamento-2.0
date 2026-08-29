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
