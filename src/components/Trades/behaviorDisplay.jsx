/**
 * behaviorDisplay — constantes e helpers de apresentação do BehaviorPanel (Fase 2 #301).
 * Keyado por CÓDIGO CANÔNICO da taxonomia (LOSS_CHASING, SUB_SIZING, ...), não pelos
 * códigos legados do shadow. Canibaliza labels/educacional do ShadowBehaviorPanel (#129).
 *
 * Cor por severidade (decisão Marcio): ALTA=red · MÉDIA=amber · BAIXA=orange · positivo=emerald.
 */
import React from 'react';
import { formatCurrencyDynamic } from '../../utils/currency';
import { getPattern, valenciaVigente, severidadeVigente } from '../../constants/behavioralTaxonomy';
import { isConfrontable, confrontVerdictFor, CONFRONT_VERDICT } from '../../utils/emotionConfront';

// Estilo por severidade. Positivos (valence 'positive') sempre emerald, ignoram severity.
export const SEVERITY_STYLES = {
  HIGH: 'bg-red-500/20 text-red-300 border-red-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  LOW: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  POSITIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  // #477 — aviso neutro (montagem de posição): fato para a conversa com o mentor, sem cor de
  // gravidade. Nem vermelho/âmbar (não é violação) nem verde (não é elogio).
  NEUTRAL: 'bg-sky-500/10 text-sky-200 border-sky-500/25',
};

export const SEVERITY_LABELS = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };

/** Valência que vale na leitura (#477: `AVERAGING_DOWN` gravado como negativo é aviso neutro). */
export const familyValence = (family) => valenciaVigente(family) ?? family?.valence ?? null;

export const familyStyle = (family) => {
  const v = familyValence(family);
  if (v === 'positive') return SEVERITY_STYLES.POSITIVE;
  if (v === 'neutral') return SEVERITY_STYLES.NEUTRAL;
  return SEVERITY_STYLES[family.severity] ?? SEVERITY_STYLES.LOW;
};

export const EMOTION_LABELS = {
  FEAR: 'Medo', REVENGE: 'Vingança', GREED: 'Ganância', ANXIETY: 'Ansiedade',
  IMPULSIVITY: 'Impulsividade', DISCIPLINE: 'Disciplina', PATIENCE: 'Paciência',
  PANIC: 'Pânico', FOMO: 'FOMO', HOPE: 'Esperança', DENIAL: 'Negação',
  CONFUSION: 'Confusão / Viés', AVOIDANCE: 'Evitação do plano',
};

// Nome PT por código canônico (17 códigos da taxonomia).
export const BEHAVIOR_LABELS = {
  TILT: 'Tilt / reatividade',
  LOSS_CHASING: 'Revenge trading',
  STOP_PANIC: 'Pânico no stop',
  HESITATION: 'Hesitação',
  GREED_CLUSTER: 'Cluster de ganância',
  // #477 — aviso neutro. `AVERAGING_DOWN` é o código antigo, lido como o aviso equivalente.
  POSITION_BUILD_AGAINST: 'Montagem de posição',
  POSITION_BUILD_FAVOR: 'Montagem de posição',
  AVERAGING_DOWN: 'Montagem de posição',
  HOLD_ASYMMETRY: 'Assimetria de permanência',
  EARLY_EXIT: 'Saída antecipada',
  LATE_EXIT: 'Saída tardia',
  SUB_SIZING: 'Operação subdimensionada',
  CHASE_REENTRY: 'Reentrada perseguindo',
  FOMO_ENTRY: 'Entrada por FOMO',
  OVERTRADING: 'Overtrading',
  IMPULSE_CLUSTER: 'Cluster impulsivo',
  DIRECTION_FLIP: 'Virada de mão',
  RISK_OVER_RO: 'Risco acima do RO',
  UNPROTECTED_SIZE: 'Posição sem proteção',
  SIZING_DISCIPLINE: 'Condução de sizing',
  CLEAN_EXECUTION: 'Execução limpa',
  UNDECLARED_MODEL: 'Modelo não declarado',
  TARGET_HIT: 'Alvo atingido',
  // #369 — ordens montadas e desmontadas, atribuídas ao trade vizinho
  RECONSIDERATION: 'Reavaliou antes de entrar',
  ABORTED_ATTEMPT: 'Tentativa recuada',
};

export const BEHAVIOR_DESCRIPTIONS = {
  TILT: 'Reatividade emocional alta no período — regulação baixa após perdas.',
  LOSS_CHASING: 'Reentrada rápida após uma perda — tentativa de recuperar.',
  STOP_PANIC: 'Stop alargado seguido de saída manual rápida.',
  HESITATION: 'Múltiplas ordens canceladas antes de entrar — indecisão.',
  GREED_CLUSTER: 'Sequência de trades rápidos após ganhos — excesso de confiança.',
  POSITION_BUILD_AGAINST: 'Houve montagem de posição com preço médio para trás.',
  POSITION_BUILD_FAVOR: 'Houve montagem de posição com preço médio para frente.',
  AVERAGING_DOWN: 'Houve montagem de posição com preço médio para trás.',
  HOLD_ASYMMETRY: 'Trade perdedor mantido muito mais tempo que a média dos ganhadores.',
  EARLY_EXIT: 'Saída com lucro muito abaixo do alvo planejado.',
  LATE_EXIT: 'Saída atrasada após remoção do stop — segurou a perda.',
  SUB_SIZING: 'Risco real muito abaixo do RO planejado — se há medo do plano, ajuste o plano (não a operação).',
  CHASE_REENTRY: 'Entrada cancelada seguida de reentrada a preço pior — perseguição.',
  RECONSIDERATION: 'Você montou uma entrada, desmontou e voltou depois de mais de meia hora. Não conta contra você: esperar e reavaliar é decisão, não indecisão.',
  ABORTED_ATTEMPT: 'Depois deste trade fechar, você montou outra entrada no mesmo ativo e recuou antes de executar. Recuar é controle — o que vale olhar é a frequência, principalmente depois de prejuízo.',
  FOMO_ENTRY: 'Entrada tardia com ordem a mercado após hesitação.',
  OVERTRADING: 'Número de trades acima do limite na janela temporal.',
  IMPULSE_CLUSTER: 'Trades executados em sequência muito rápida, sem análise.',
  DIRECTION_FLIP: 'Inverteu o lado no mesmo instrumento sem tempo de reler o mercado — reação ao prejuízo (até 5 min) ou inversões em sequência (2+ em 30 min).',
  RISK_OVER_RO: 'O valor financeiro do stop passou do RO do plano — a distância do stop não acompanhou o aumento da posição.',
  UNPROTECTED_SIZE: 'Contratos abertos sem ordem de stop cobrindo — exposição sem barreira.',
  // #376 — a frase afirmava que o risco ficou dentro do RO. Agora o padrão só é
  // concedido quando isso é verdade (o detector recusa trade com violação de plano),
  // então a descrição pode afirmar sem mentir.
  SIZING_DISCIPLINE: 'Aumentou a posição e ajustou a proteção junto, mantendo o risco dentro do RO autorizado.',
  CLEAN_EXECUTION: 'Trade com stop presente, RR respeitado, sem padrões negativos e sem violação de plano.',
  UNDECLARED_MODEL: 'Trade registrado sem setup, ou com setup "Indefinido".',
  TARGET_HIT: 'Saída no alvo planejado — paciência na execução.',
};

const fmt = (value, currency) => (value == null ? '—' : formatCurrencyDynamic(value, currency || 'USD'));

const num = (v) => (v == null ? null : (typeof v === 'number' ? v : Number(v)));

/**
 * Narrativa semântica por código canônico — tece os números da evidência numa frase
 * que o aluno entende, em vez de despejar os campos técnicos crus no card. Retorna null
 * quando faltam campos esperados → o card cai na descrição (também prosa). Os campos
 * crus seguem disponíveis no accordion "evidência técnica".
 */
export const BEHAVIOR_NARRATIVE = {
  HOLD_ASYMMETRY: (e) => {
    const d = num(e.tradeDurationMinutes); const a = num(e.avgWinDurationMinutes); const r = num(e.ratio);
    if (d == null || a == null) return null;
    return `Você segurou este trade por ${d} min — ${r ? `${r}× ` : ''}muito mais que a média de ${a} min dos seus trades vencedores. Segurar o perdedor e cortar o vencedor cedo é o avesso do que o plano pede.`;
  },
  LOSS_CHASING: (e, c) => {
    const i = num(e.intervalMinutes); const pl = num(e.previousLoss);
    if (i == null) return null;
    return `Você reentrou ${i} min depois ${pl != null ? `de um stop de ${fmt(pl, c)}` : 'de uma perda'}. Reentrada quente logo após o stop costuma ser tentativa de recuperar, não uma leitura nova do mercado.`;
  },
  OVERTRADING: (e) => {
    const n = num(e.tradesInWindow); const t = num(e.threshold);
    if (n == null) return null;
    return `Foram ${n} trades na janela${t != null ? ` (acima do limite de ${t})` : ''}. Volume alto em pouco tempo dilui a seletividade e costuma vir da ansiedade de estar no mercado.`;
  },
  IMPULSE_CLUSTER: (e) => {
    const n = num(e.clusterCount);
    if (n == null) return null;
    return `${n} trades em sequência muito rápida, sem espaço para análise entre um e outro — execução no impulso.`;
  },
  DIRECTION_FLIP: (e, c) => {
    if (e.previousSide == null || e.currentSide == null) return null;
    const ativo = e.instrument || 'ativo';

    // #402 — a narrativa acompanha o gatilho. Virar a mão não é errado por si:
    // em meia hora dá para reler o mercado. O que é sinal são estes dois casos.
    if (e.trigger === 'PERDIDO') {
      const n = num(e.reversals);
      const span = num(e.spanMinutes);
      return `Você inverteu o lado ${n != null ? `${n} vezes` : 'mais de uma vez'} em ${ativo}${span != null ? ` dentro de ${span} min` : ''}. Não é releitura: quando a direção muda a esse ritmo, é sinal de que não havia leitura nenhuma.`;
    }

    const g = num(e.gapMinutes ?? e.intervalMinutes);
    return `${g != null ? `${g} min depois ` : 'Logo após '}de sair de um ${e.previousSide}${e.previousResult != null ? ` que deu ${fmt(num(e.previousResult), c)}` : ''}, você virou para ${e.currentSide} no mesmo ${ativo}. Nesse intervalo não houve tempo de reler o mercado — é reação ao prejuízo.`;
  },
  EARLY_EXIT: (e) => {
    const pct = num(e.rrAchievedPct); const ar = num(e.actualRR); const pr = num(e.planRR);
    if (pct == null && ar == null) return null;
    return `Você saiu com ${pct != null ? `${pct}% do alvo` : 'lucro abaixo do alvo'}${ar != null && pr != null ? ` (RR ${ar} contra ${pr} do plano)` : ''}. Cortar o vencedor cedo encolhe o R que precisa pagar os stops.`;
  },
  HESITATION: (e) => {
    const n = num(e.cancelledOrdersCount);
    if (n == null) return null;
    // #477 — conta só tentativa de entrada (mesmo lado, perto do preço, pouco antes);
    // cancelar e reenviar corrigido é ajuste e fica de fora.
    const m = num(e.hesitationMinutes);
    return `${n} tentativas de entrada canceladas${m != null ? ` nos ${fmtMin(m)} antes de você entrar` : ' antes de você entrar'}. Hesitar no gatilho costuma trocar o trade do plano por um pior.`;
  },
  // #477 — aviso neutro: diz o que houve, sem emoção e sem veredito.
  POSITION_BUILD_AGAINST: (e) => montagemTexto('para trás', 'contra a posição', e),
  POSITION_BUILD_FAVOR: (e) => montagemTexto('para frente', 'a favor da posição', e),
  AVERAGING_DOWN: (e) => montagemTexto('para trás', 'contra a posição', { additions: e.averagingCount }),
  TARGET_HIT: (e) =>
    `Você saiu no alvo planejado${e.planRR ? ` (${e.planRR}:1)` : ''}. Paciência na execução — o trade foi até onde o plano mandou.`,
  CLEAN_EXECUTION: () =>
    'Stop no lugar, RR respeitado, nenhum padrão negativo e nenhuma violação de plano. É exatamente assim que o plano espera que você opere.',
  UNDECLARED_MODEL: (e) =>
    `Este trade não diz de onde veio${e.setup ? ` (setup: "${e.setup}")` : ''}. Sem o modelo declarado não dá pra saber se funcionou ou se deu certo por acaso — e o que não se identifica não se repete.`,
};

/** Minutos em texto: "4 min", "1,5 min". */
function fmtMin(m) {
  const v = Math.round(m * 10) / 10;
  return `${String(v).replace('.', ',')} min`;
}

function montagemTexto(sentido, relacao, e) {
  const n = num(e.additions);
  const prot = num(e.additionsWithOwnProtection);
  const qtd = n == null ? '' : ` — ${n} ${n === 1 ? 'adição' : 'adições'} ${relacao}`;
  const comProt = n != null && prot != null && prot === n
    ? (n === 1 ? ', com proteção própria' : ', cada uma com proteção própria')
    : '';
  return `Houve montagem de posição com preço médio ${sentido}${qtd}${comProt}. Se foi leitura consciente ou erro, é conversa para ter com o mentor.`;
}

export const narrativeFor = (family) => {
  const builder = BEHAVIOR_NARRATIVE[family.canonicalCode];
  if (builder) {
    const out = builder(family.evidence || {}, family.currency);
    if (out) return out;
  }
  return BEHAVIOR_DESCRIPTIONS[family.canonicalCode] ?? '';
};

// Confronto emocional: estilo + copy por veredicto (matriz aprovada). Tom espelho, não acusação.
export const CONFRONT_TONE_STYLES = {
  red: 'bg-red-500/10 border-red-500/40 text-red-200',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  emerald: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300/90',
};

const emo = (code) => EMOTION_LABELS[code] ?? code;

const CONFRONT_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Emoção no meio da frase: "medo", "ganância" — sigla fica como está ("FOMO"). */
const emoFrase = (code) => {
  const l = emo(code);
  return l === l.toUpperCase() ? l : l.toLowerCase();
};

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * #477 — a EVIDÊNCIA que sustenta a hipótese, por padrão, a partir dos campos que o
 * detector gravou. Sem os campos esperados → null (a frase cai no nome do padrão).
 */
export const CONFRONT_EVIDENCE = {
  HESITATION: (e) => {
    const n = num(e.cancelledOrdersCount);
    if (n == null) return null;
    const m = num(e.hesitationMinutes);
    return `${plural(n, 'tentativa de entrada cancelada', 'tentativas de entrada canceladas')}${m != null ? ` em ${fmtMin(m)}` : ''}`;
  },
  LOSS_CHASING: (e) => {
    const i = num(e.intervalMinutes ?? e.gapMinutes);
    return i == null ? null : `reentrada ${fmtMin(i)} depois de uma perda`;
  },
  STOP_PANIC: (e) => {
    const m = num(e.exitAfterWidenMinutes);
    if (m == null) return null;
    const ato = e.motivo === 'removeu' ? 'stop retirado' : 'stop afastado';
    return `${ato} e saída ${fmtMin(m)} depois`;
  },
  LATE_EXIT: (e) => {
    const m = num(e.delayMinutes);
    return m == null ? null : `${fmtMin(m)} segurando a perda depois de tirar o stop`;
  },
  HOLD_ASYMMETRY: (e) => {
    const d = num(e.tradeDurationMinutes); const r = num(e.ratio);
    if (d == null) return null;
    return `perdedor segurado por ${fmtMin(d)}${r != null ? `, ${String(r).replace('.', ',')}× a média dos vencedores` : ''}`;
  },
  OVERTRADING: (e) => {
    const n = num(e.tradesInWindow);
    return n == null ? null : `${plural(n, 'trade', 'trades')} na mesma janela`;
  },
  IMPULSE_CLUSTER: (e) => {
    const n = num(e.clusterCount);
    return n == null ? null : `${plural(n, 'trade', 'trades')} em sequência muito rápida`;
  },
  GREED_CLUSTER: (e) => {
    const n = num(e.rapidTradesInWindow); const w = num(e.windowMinutes);
    return n == null ? null : `${plural(n, 'entrada', 'entradas')}${w != null ? ` em ${fmtMin(w)}` : ''} depois de ganhar`;
  },
  DIRECTION_FLIP: (e) => {
    if (e.trigger === 'PERDIDO') {
      const n = num(e.reversals); const span = num(e.spanMinutes);
      return n == null ? null : `${plural(n, 'inversão', 'inversões')} de lado${span != null ? ` em ${fmtMin(span)}` : ''}`;
    }
    const g = num(e.gapMinutes ?? e.intervalMinutes);
    return g == null ? null : `mão virada ${fmtMin(g)} depois de sair`;
  },
  SUB_SIZING: (e) => {
    const u = num(e.utilizationPct);
    return u == null ? null : `risco de ${String(u).replace('.', ',')}% do RO do plano`;
  },
  EARLY_EXIT: (e) => {
    const p = num(e.rrAchievedPct);
    return p == null ? null : `saída com ${p}% do alvo`;
  },
  FOMO_ENTRY: (e) => {
    const m = num(e.maxDelayMinutes);
    return m == null ? null : `entrada a mercado ${fmtMin(m)} depois da primeira ordem`;
  },
};

const evidenciaDe = (code, families) => {
  const fam = (families || []).find((f) => f?.canonicalCode === code);
  const builder = CONFRONT_EVIDENCE[code];
  const out = builder && fam ? builder(fam.evidence || {}) : null;
  if (out) return out;
  const label = BEHAVIOR_LABELS[code];
  return label ? `sinal de ${label.toLowerCase()}` : 'um padrão na execução';
};

/**
 * Confronto que VALE na leitura (#477). A CF grava o confronto no perfil; perfis gravados
 * antes do #477 elegeram padrão de gravidade BAIXA ou o `AVERAGING_DOWN` (Negação) como
 * "a emoção do trade". Trade discutido não é regravado (INV-30), então a regra é
 * reaplicada aqui, com as MESMAS funções da CF (`utils/emotionConfront`, espelho).
 *
 * Com `families`: refaz a eleição do dominante sobre as famílias gravadas. Sem elas: só
 * descarta a sugestão que não é mais confrontável. CONFIRMED gravado é mantido (depende
 * das ordens, que a leitura não tem).
 */
export const confrontVigente = (confront, families = null) => {
  if (!confront) return null;
  const declared = confront.declared ?? null;
  let suggested = confront.suggested?.emotion ? confront.suggested : null;
  // Sem famílias (ou lista vazia) não há sobre o que refazer a eleição: só a sugestão
  // gravada é conferida.
  if (Array.isArray(families) && families.length > 0) {
    let best = null;
    for (const f of families) {
      if (!f) continue;
      const sev = severidadeVigente(f.canonicalCode, f.severity);
      if (!isConfrontable(familyValence(f) ?? 'negative', f.emotionMapping, sev)) continue;
      const d = (CONFRONT_RANK[sev] ?? 0) - (CONFRONT_RANK[best?.severity] ?? 0);
      if (!best || d > 0 || (d === 0 && f.isGate && !best.isGate)) {
        best = { emotion: f.emotionMapping, code: f.canonicalCode, severity: sev, isGate: !!f.isGate };
      }
    }
    suggested = best ? { emotion: best.emotion, code: best.code, severity: best.severity } : null;
  } else if (suggested) {
    const p = getPattern(suggested.code);
    const sev = severidadeVigente(suggested.code, suggested.severity);
    if (!isConfrontable(p?.valence ?? 'negative', suggested.emotion, sev)) suggested = null;
  }
  let verdict = declared?.category
    ? confrontVerdictFor(declared.category, suggested ? suggested.severity : 'CLEAN')
    : CONFRONT_VERDICT.NO_DECLARED;
  if (confront.verdict === CONFRONT_VERDICT.CONFIRMED && verdict === CONFRONT_VERDICT.ALIGNED) {
    verdict = CONFRONT_VERDICT.CONFIRMED;
  }
  return { declared, suggested, verdict };
};

/**
 * Retorna {tone, text} para o banner do confronto, ou null quando não há o que dizer.
 *
 * #477 — HIPÓTESE, não sentença: "a execução tem sinais que costumam acompanhar medo —
 * 3 tentativas de entrada canceladas em 4 min. Confere com o que você sentiu?". Declaração
 * positiva confirmada pela execução vira confirmação (verde), não contradição.
 *
 * @param {Object} confront — `behaviorProfile.emotionConfront`
 * @param {Array} [families] — `behaviorProfile.families` (evidência da hipótese)
 */
export const emotionConfrontDisplay = (confront, families = null) => {
  const c = confrontVigente(confront, families);
  if (!c) return null;
  const { verdict, declared, suggested } = c;
  const dec = declared?.name;
  const hipotese = suggested
    ? `a execução tem sinais que costumam acompanhar ${emoFrase(suggested.emotion)} — ${evidenciaDe(suggested.code, families)}`
    : null;

  switch (verdict) {
    case 'MISALIGNED':
      if (!suggested) {
        return { tone: 'amber', text: `Você declarou “${dec}”, mas a execução saiu do plano — vale revisitar o que você sentiu de fato na entrada.` };
      }
      return { tone: 'amber', text: `Você declarou “${dec}”, e ${hipotese}. Confere com o que você sentiu?` };
    case 'ATTENTION':
      if (declared?.category === 'NEGATIVE' && suggested) {
        return { tone: 'amber', text: `Você declarou “${dec}”, e ${hipotese}. A emoção foi reconhecida — confere se foi ela que conduziu a operação?` };
      }
      if (!suggested) {
        return { tone: 'amber', text: `Você declarou “${dec}”, mas a execução saiu limpa — vale confirmar a intensidade.` };
      }
      return { tone: 'amber', text: `Você declarou “${dec}”, e ${hipotese}. Confere com o que você sentiu?` };
    case 'CONFIRMED': {
      const montagem = (families || []).some((f) => familyValence(f) === 'neutral' && num(f?.evidence?.additions) > 0);
      return {
        tone: 'emerald',
        text: `Você declarou “${dec}” e a execução confirma — stop enviado junto com a entrada${montagem ? ', e cada adição com proteção própria' : ''}.`,
      };
    }
    case 'ALIGNED':
      if (declared?.category === 'NEGATIVE' && !suggested) {
        return { tone: 'emerald', text: `Você declarou “${dec}” mas executou limpo — boa regulação emocional.` };
      }
      if ((declared?.category === 'NEGATIVE' || declared?.category === 'CRITICAL') && suggested) {
        return { tone: 'emerald', text: `Você declarou “${dec}” e a execução confirma — consciência emocional presente.` };
      }
      return null; // positiva/neutra + limpo = ideal, sem ruído
    case 'NO_DECLARED':
      // só vale nudge se há emoção detectada para confrontar
      return suggested
        ? { tone: 'amber', text: `A execução tem sinais que costumam acompanhar ${emoFrase(suggested.emotion)} — ${evidenciaDe(suggested.code, families)}. Declare a emoção da entrada para ativar o confronto.` }
        : null;
    default:
      return null;
  }
};

const UNDERSIZED_KEY_SENTENCE = (scenario, planRrTarget) => {
  switch (scenario) {
    case 'WIN_RR_HIT': return `RR de ${planRrTarget}:1 cumprido. Alvo do plano não atingido.`;
    case 'WIN_RR_MISS': return 'Operação subdimensionada e abaixo do alvo do trade.';
    case 'LOSS_BE': return 'Operação subdimensionada e tomada em loss.';
    default: return '';
  }
};

/** Bloco educacional do SUB_SIZING (preservado do ShadowBehaviorPanel — R-local vs R-plano). */
export const UndersizedEducational = ({ scenario, evidence, currency }) => {
  const {
    actualRiskAmount, utilizationPct, planRoAmount, actualGain,
    expectedGainAtPlanRR, rrLocalAchieved, planRsDelivered, planRrTarget,
  } = evidence;

  if (scenario === 'WIN_RR_HIT') {
    return (
      <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
        <p>Você arriscou {fmt(actualRiskAmount, currency)} ({utilizationPct}% do RO contratado de {fmt(planRoAmount, currency)}) e atingiu {fmt(actualGain, currency)} — menos de um stop cheio do plano e abaixo do alvo planejado de {fmt(expectedGainAtPlanRR, currency)}.</p>
        <p>Sua estatística (Payoff/PF/EV) lê este trade como +{rrLocalAchieved}R. Em Rs do plano são +{planRsDelivered}R. Quando vier um loss de RO cheio (−1R do plano), trades assim não cobrem o stop.</p>
        <p>Se o RO contratado parece grande, ajuste o plano. Subdimensionar esconde o desalinhamento e adia o acerto de contas.</p>
      </div>
    );
  }
  if (scenario === 'WIN_RR_MISS') {
    const localTarget = actualRiskAmount != null && planRrTarget != null ? actualRiskAmount * planRrTarget : null;
    return (
      <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
        <p>Você arriscou {fmt(actualRiskAmount, currency)} ({utilizationPct}% do RO contratado de {fmt(planRoAmount, currency)}) e saiu com {fmt(actualGain, currency)} — abaixo do alvo do próprio trade ({fmt(localTarget, currency)}) e muito abaixo do alvo do plano ({fmt(expectedGainAtPlanRR, currency)}).</p>
        <p>Duplo problema: subdimensionado + saída antes do RR. Sua estatística mede Rs locais (stop usado), não Rs do plano — o trade entra como ganho parcial mas em Rs do plano entregou só +{planRsDelivered}R.</p>
        <p>Se o RO contratado parece grande, ajuste o plano em vez de operar abaixo dele.</p>
      </div>
    );
  }
  return (
    <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
      <p>Você arriscou {fmt(actualRiskAmount, currency)} ({utilizationPct}% do RO contratado de {fmt(planRoAmount, currency)}) e tomou loss.</p>
      <p>Operar subdimensionado pode parecer prudente, mas distorce sua estatística cumulativa (Payoff/PF/EV) ao tratar Rs pequenos como equivalentes a Rs cheios do plano.</p>
    </div>
  );
};

/** Corpo do card de SUB_SIZING (evidência rica). Recebe `evidence` direto da família.
 *  O accordion "Evidência técnica" cru é mentor-only (#315) — aluno fica com o texto educacional. */
export const UndersizedBody = ({ evidence = {}, currency, expanded, isMentor = false }) => {
  const { scenario, planRrTarget, utilizationPct } = evidence;
  const hasAmounts = evidence.planRoAmount != null;
  const keySentence = UNDERSIZED_KEY_SENTENCE(scenario, planRrTarget);
  return (
    <>
      {hasAmounts ? (
        <p className="text-sm font-medium text-zinc-100 mt-2">{keySentence}</p>
      ) : (
        <p className="text-sm font-medium text-zinc-100 mt-2">Você utilizou {utilizationPct}% do RO contratado. {keySentence}</p>
      )}
      {hasAmounts && <UndersizedEducational scenario={scenario} evidence={evidence} currency={currency} />}
      {isMentor && expanded && (
        <div className="mt-3 pt-2 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Evidência técnica</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(evidence).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-zinc-500">{key}: </span>
                <span className="text-zinc-300">{value == null ? '—' : (Array.isArray(value) ? `${value.length} items` : String(value))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
