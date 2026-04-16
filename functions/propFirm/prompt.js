/**
 * prompt.js — Prompt Sonnet 4.6 para generatePropFirmApproachPlan
 *
 * Gera narrativa estratégica de approach sobre um plano determinístico já calculado.
 * IA NÃO recalcula números — narra, contextualiza e gera guidance comportamental.
 *
 * Versão 1.1 — incorpora 6 correções de semântica identificadas via issue #136:
 *   1. Substitui "Meta diária" ambígua por MECÂNICA DIÁRIA (dailyGoal/dailyStop) + RITMO DE ACUMULAÇÃO (dailyTarget EV estatístico)
 *   2. Adiciona SEMÂNTICA DO PLANO como regra inviolável no system prompt
 *   3. executionPlan read-only (IA só narra números determinísticos)
 *   4. Cenários explícitos: dia ideal = +dailyGoal, dia ruim = -dailyStop, dia médio = 1W+1L
 *   5. Validação inclui coerência mecânica (ver validate.js)
 *   6. riskPerOperation = periodStop (teto por trade, permite Path B 1 trade × N contratos)
 *
 * @version 1.1
 * @since issue #133
 */

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4000;
const TEMPERATURE = 0;
const PROMPT_VERSION = '1.1';

// ── SYSTEM PROMPT ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o consultor estratégico do Espelho, uma plataforma de mentoria comportamental para traders. Sua função é gerar um plano de approach personalizado para um trader que vai enfrentar uma avaliação (eval) de mesa proprietária (prop firm).

CONTEXTO DO ESPELHO:
- RO (Risco Operacional) = risco máximo por trade = stop por trade em dólares
- O eval é um "ingresso" — o trader paga uma taxa e tem um prazo limitado para atingir o profit target dentro das regras de drawdown da mesa
- O drawdown NÃO é capital do trader — é a margem de erro que a mesa dá para provar competência
- O objetivo é PASSAR a avaliação, não preservar capital como se fosse conta pessoal

══════════════════════════════════════════════════════════════
SEMÂNTICA DO PLANO — REGRAS INVIOLÁVEIS
══════════════════════════════════════════════════════════════

Esta seção define o vocabulário exato do plano mecânico. Qualquer desvio invalida a narrativa.

1. MECÂNICA DIÁRIA (números operacionais — limites duros do dia):
   - dailyStop  = maxTradesPerDay × RO         → perda máxima permitida no dia
   - dailyGoal  = maxTradesPerDay × RO × RR    → ganho máximo esperado no dia operando o plano completo
   - Day RR === per-trade RR (o plano é autossimilar: mesmo RR em trade e em dia)

2. RITMO DE ACUMULAÇÃO (EV estatístico — NÃO é meta do dia):
   - dailyTarget = EV × maxTradesPerDay        → expectativa estatística de acumulação por dia
   - dailyTarget É UM RESULTADO ESPERADO NO LONGO PRAZO, jamais um objetivo do dia
   - Nunca instrua o trader a "buscar" dailyTarget. Ele emerge naturalmente ao executar o plano com disciplina.

3. CAMINHOS DE EXECUÇÃO (escolha do trader, ambos válidos):
   - Path A: N trades × 1 contrato — sizing mínimo, sequência de oportunidades
   - Path B: 1 trade × N contratos — alta convicção, posição concentrada, mesmo RO total
   - AMBOS respeitam o mesmo RO total do dia. riskPerOperation é TETO por trade, não sizing mínimo.
   - GUARD anti Path C: jamais recomende "N trades × N contratos" — isso multiplica risco e viola dailyStop.

4. riskPerOperation = periodStop (teto por trade)
   - NÃO é "roPerTrade com 1 contrato"
   - Permite ao trader escolher entre Path A e Path B sem violar compliance

5. Números determinísticos são READ-ONLY:
   - stopPoints, targetPoints, roUSD, maxTradesPerDay, contracts — já calculados pelo sistema
   - Você NARRA esses números com contexto, jamais os ajusta
   - Se identificar problema matemático, sinalize em "approach.profileOverride" (não mude o número)

══════════════════════════════════════════════════════════════

FRAMEWORK DE SESSÕES (AM Trades, CME futures):
- Ásia (18:00-01:00 EST): 17% do range diário, 58% direcional, corpo ~40% do range
- London (01:00-08:00 EST): 23% do range diário, 62% direcional, corpo ~55% do range
- New York (08:00-close EST): 60% do range diário, 86% direcional, corpo ~65% do range

DAILY PROFILES:
1. Reversão 18:00: Ásia faz high/low → London expande → NY continua (entrada em continuação)
2. Reversão 01:00: London penetra Ásia e reverte → NY continua (profile ideal, clareza máxima)
3. Reversão 08:00: Nem Ásia nem London definiram → NY forma reversão (mais arriscado, esperar confirmação)
4. Invalidação: Ásia + London consumiram o range → NÃO OPERAR

FRAMEWORK 4D DO ESPELHO (quando disponível):
- Técnica (0-100): conhecimento de setup, execução, leitura
- Emocional (0-100): controle, reação a perdas, TILT/revenge
- Disciplina (0-100): seguir plano, respeitar stops, consistência
- Gestão de Risco (0-100): sizing, RR, proteção
Stage de maturidade: 1 (Caos) → 2 (Estruturado) → 3 (Consistente) → 4 (Maestria) → 5 (Fluência)

REGRAS MATEMÁTICAS INVIOLÁVEIS:
- RO por trade NUNCA pode exceder dailyLossLimit da mesa
- Stop em pontos deve ser viável para o ATR (não pode ser ruído de mercado)
- Stop × maxTradesPerDay (= dailyStop) NUNCA pode exceder dailyLossLimit
- WR mínimo para EV positivo com RR 1:2 = 33.3% — abaixo é matematicamente inviável
- Se stop < 15pts para equity index full-size, recomende o micro equivalente

FORMATO DE RESPOSTA:
Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks, sem preâmbulo. O JSON deve seguir exatamente o schema fornecido.`;

// ── USER PROMPT BUILDER ─────────────────────────────────────────

/**
 * Monta o user prompt com os dados do trader/mesa/plano.
 * @param {object} ctx — contexto completo
 * @param {object} ctx.firm — { firmName, productName, accountSize, drawdownMax, profitTarget, dailyLossLimit, evalDays, drawdownType, consistencyRule }
 * @param {object} ctx.instrument — { symbol, pointValue, atrDaily, nyRange, nyRangePct }
 * @param {object} ctx.plan — plano determinístico (read-only)
 *   { profileName, roUSD, roPct, stopPoints, stopUSD, targetPoints, targetUSD, rr, maxTradesPerDay,
 *     lossesToBust, dailyGoal, dailyStop, dailyTarget, assumedWR, evPerTrade, approvalPct, bustPct, avgDaysToPass }
 * @param {string} ctx.dataSource — '4d_full' | 'indicators' | 'defaults'
 * @param {string} ctx.traderProfileBlock — bloco formatado (ver buildTraderProfileBlock)
 * @returns {string}
 */
function buildUserPrompt(ctx) {
  const { firm, instrument, plan, dataSource, phase, traderProfileBlock } = ctx;

  // Phase-aware label (issue #145 Fase C)
  const phaseLabel = {
    EVALUATION: 'AVALIAÇÃO — objetivo é PASSAR dentro do prazo',
    SIM_FUNDED: 'SIMULADO FUNDED — regras de funded se aplicam, não há prazo de eval',
    LIVE: 'CONTA REAL — gestão de risco prioritária sobre velocidade',
    EXPIRED: 'EXPIRADA',
  }[phase ?? 'EVALUATION'] ?? 'AVALIAÇÃO';

  return `Gere um plano de approach para este trader na ${phase === 'EVALUATION' ? 'avaliação de' : 'conta funded de'} prop firm.

DADOS DA MESA:
- Firma: ${firm.firmName}
- Produto: ${firm.productName}
- Tamanho da conta: $${firm.accountSize}
- Drawdown máximo: $${firm.drawdownMax}
- Profit target: $${firm.profitTarget}
- Daily loss limit: $${firm.dailyLossLimit}
- Prazo eval: ${firm.evalDays} dias úteis
- Tipo drawdown: ${firm.drawdownType}
- Consistency rule: ${firm.consistencyRule}
- FASE DA CONTA: ${phaseLabel}${phase !== 'EVALUATION' ? '\n  → Não há prazo de avaliação — foco em sustentabilidade, não urgência' : ''}

INSTRUMENTO ESCOLHIDO:
- Símbolo: ${instrument.symbol}
- Point value: $${instrument.pointValue}/ponto
- ATR diário: ${instrument.atrDaily} pontos
- Range sessão NY: ${instrument.nyRange} pontos (${instrument.nyRangePct}% do ATR)

PLANO DETERMINÍSTICO (READ-ONLY — use como base, JAMAIS recalcule):
- Perfil: ${plan.profileName}
- RO por trade: $${plan.roUSD} (${plan.roPct}% do drawdown)
- Stop: ${plan.stopPoints} pontos ($${plan.stopUSD})
- Target: ${plan.targetPoints} pontos ($${plan.targetUSD})
- RR: 1:${plan.rr}
- Max trades/dia: ${plan.maxTradesPerDay}
- Losses até bust: ${plan.lossesToBust}

MECÂNICA DIÁRIA (limites operacionais do dia — duros):
- dailyStop  = ${plan.maxTradesPerDay} × $${plan.roUSD} = $${plan.dailyStop}   ← perda máxima no dia
- dailyGoal  = ${plan.maxTradesPerDay} × $${plan.roUSD} × ${plan.rr} = $${plan.dailyGoal}   ← ganho máximo ao operar o plano completo
- Day RR === per-trade RR = 1:${plan.rr}

RITMO DE ACUMULAÇÃO (EV estatístico — NÃO É META DO DIA):
- dailyTarget = EV × maxTrades = $${plan.dailyTarget}   ← expectativa estatística de acumulação
- Assumed WR: ${plan.assumedWR}% | EV por trade: $${plan.evPerTrade}
- Aprovação: ${plan.approvalPct}% | Bust: ${plan.bustPct}% | Dias médios p/ aprovar: ${plan.avgDaysToPass}
- ⚠️ NUNCA instrua o trader a "buscar" dailyTarget. Ele emerge da execução disciplinada.

PERFIL DO TRADER (cenário ${dataSource}):
${traderProfileBlock}

INSTRUÇÕES:
1. Analise a combinação mesa + instrumento + perfil do trader.
2. Se o perfil 4D indica fragilidade emocional/disciplinar, ajuste as recomendações comportamentais (os números determinísticos NÃO mudam).
3. Gere cenários concretos usando os valores EXATOS do plano:
   - "Dia ideal"  = +$${plan.dailyGoal}  (= dailyGoal, trader atingiu todos os targets)
   - "Dia ruim"   = -$${plan.dailyStop}  (= -dailyStop, trader acionou todos os stops)
   - "Dia médio" = (1 win × ${plan.targetPoints}pts) + (1 loss × ${plan.stopPoints}pts) parciais, descrever em narrativa
4. Inclua protocolo de sequência de losses e quando parar (geralmente 2-3 losses consecutivos).
5. Recomende sessões e daily profiles adequados ao perfil. Se fase é SIM_FUNDED ou LIVE, substitua urgência de prazo por disciplina de longo prazo e gestão de drawdown conservadora.
6. Se WR do trader < 33.3%, alerte explicitamente que o plano é matematicamente inviável.
7. Se há flags comportamentais (hold time asymmetry, revenge), integre nas recomendações.
8. Ofereça os dois caminhos de execução (Path A: ${plan.maxTradesPerDay}×1 contrato, Path B: 1×N contratos) quando aplicável — NUNCA Path C (N×N).

SCHEMA OBRIGATÓRIO (TODOS os campos abaixo são obrigatórios — omissão invalida a resposta):

\`\`\`json
{
  "approach": {
    "summary": "string",
    "profileOverride": null,
    "sessionRecommendation": { "primary": "ny", "secondary": "london", "avoid": null, "reasoning": "string" },
    "dailyProfiles": { "recommended": ["LONDON_REVERSAL"], "avoid": [], "reasoning": "string" }
  },
  "executionPlan": {
    "stopPoints": ${plan.stopPoints},
    "targetPoints": ${plan.targetPoints},
    "maxTradesPerDay": ${plan.maxTradesPerDay},
    "roUSD": ${plan.roUSD},
    "contracts": ${plan.contracts ?? 1},
    "tradingStyle": "string",
    "entryStrategy": "string",
    "exitStrategy": "string",
    "pathRecommendation": "string"
  },
  "scenarios": [
    { "name": "Dia ideal", "description": "string", "trades": ${plan.maxTradesPerDay}, "result": ${plan.dailyGoal}, "cumulative": "string" },
    { "name": "Dia médio", "description": "string", "trades": 2, "result": 0, "cumulative": "string" },
    { "name": "Dia ruim", "description": "string", "trades": ${plan.maxTradesPerDay}, "result": ${-plan.dailyStop}, "cumulative": "string" },
    { "name": "Sequência de losses", "description": "string", "trades": 2, "result": ${-plan.roUSD * 2}, "cumulative": "string" }
  ],
  "behavioralGuidance": {
    "preSession": "string",
    "duringSession": "string",
    "afterLoss": "string",
    "afterWin": "string",
    "deadlineManagement": "string",
    "personalWarnings": ["string"]
  },
  "milestones": [
    { "day": 1, "targetBalance": 0, "description": "string" }
  ],
  "metadata": {
    "model": "${MODEL}",
    "promptVersion": "${PROMPT_VERSION}",
    "dataSource": "${dataSource}",
    "generatedAt": "ISO timestamp"
  }
}
\`\`\`

REGRAS CRÍTICAS:
- Ecoe os números determinísticos em executionPlan EXATAMENTE (stopPoints=${plan.stopPoints}, targetPoints=${plan.targetPoints}, roUSD=${plan.roUSD}, maxTradesPerDay=${plan.maxTradesPerDay}, contracts=${plan.contracts ?? 1})
- scenarios[0].result DEVE ser EXATAMENTE ${plan.dailyGoal} (dailyGoal)
- scenarios[2].result DEVE ser EXATAMENTE ${-plan.dailyStop} (-dailyStop)
- TODOS os 6 campos top-level (approach, executionPlan, scenarios, behavioralGuidance, milestones, metadata) são OBRIGATÓRIOS — nenhum pode ser omitido
- milestones deve ter pelo menos 1 entrada
- Retorne APENAS o JSON, sem backticks, sem texto antes ou depois.`;
}

// ── TRADER PROFILE BLOCK BUILDER ────────────────────────────────

/**
 * Monta o bloco de perfil do trader conforme cenário de dados disponíveis.
 * @param {string} scenario — '4d_full' | 'indicators' | 'defaults'
 * @param {object} profile — dados do perfil (shape varia por cenário)
 * @returns {string}
 */
function buildTraderProfileBlock(scenario, profile) {
  if (scenario === '4d_full') {
    return `Fonte: Assessment 4D + Revisão Semanal
Stage: ${profile.stage} (${profile.stageName})
Dimensões: Técnica ${profile.techScore}/100, Emocional ${profile.emotionalScore}/100, Disciplina ${profile.disciplineScore}/100, Gestão Risco ${profile.riskScore}/100
Indicadores reais (último período):
- Win Rate: ${profile.wr}%
- Payoff: ${profile.payoff}
- Profit Factor: ${profile.pf}
- EV por trade: $${profile.ev}
- Coeficiente de Variação: ${profile.cv}
- Tempo médio win: ${profile.avgWinHold}
- Tempo médio loss: ${profile.avgLossHold}
- Hold time asymmetry (L/W): ${profile.holdTimeAsymmetry}x
Flags comportamentais: ${profile.behaviorFlags || 'nenhuma'}`;
  }

  if (scenario === 'indicators') {
    return `Fonte: Indicadores calculados (sem assessment 4D)
Stage: não disponível
Indicadores reais (último período):
- Win Rate: ${profile.wr}%
- Payoff: ${profile.payoff}
- Profit Factor: ${profile.pf}
- EV por trade: $${profile.ev}
Nota: Sem assessment 4D, as recomendações comportamentais são genéricas. Complete o assessment para um plano mais preciso.`;
  }

  // defaults — este cenário NÃO chama a IA; retorna plano determinístico puro.
  // Incluído aqui para completude e testes.
  return `Fonte: Defaults (sem assessment e sem histórico)
Todos os indicadores são estimativas conservadoras.
WR assumido: 50%
Nota: Cenário 'defaults' não deve chamar a IA — retorna determinístico puro com aviso.`;
}

// ── RESPONSE SCHEMA (referência/documentação) ───────────────────

/**
 * Schema esperado da resposta da IA. Campos em `executionPlan` são READ-ONLY
 * — a IA ecoa os números determinísticos mas a validação rejeita qualquer alteração.
 * Cenários têm semântica explícita travada (ver comentários).
 */
const RESPONSE_SCHEMA = {
  approach: {
    summary: 'string — resumo de 2-3 frases do approach recomendado',
    profileOverride: 'string|null — se a IA recomenda perfil diferente do escolhido, justifica aqui (não muda números)',
    sessionRecommendation: {
      primary: 'ny|london|asia',
      secondary: 'ny|london|asia|null',
      avoid: 'ny|london|asia|null',
      reasoning: 'string',
    },
    dailyProfiles: {
      recommended: ['ASIA_REVERSAL', 'LONDON_REVERSAL', 'NY_REVERSAL'],
      avoid: ['ASIA_REVERSAL', 'LONDON_REVERSAL', 'NY_REVERSAL', 'INVALIDATION'],
      reasoning: 'string',
    },
  },
  executionPlan: {
    // READ-ONLY — ecoar valores do plano determinístico; qualquer divergência = validação falha
    stopPoints: 'number (read-only)',
    targetPoints: 'number (read-only)',
    maxTradesPerDay: 'number (read-only)',
    roUSD: 'number (read-only)',
    contracts: 'number (read-only)',
    // Narrativa (livre):
    tradingStyle: 'string — scalp/day trade/swing intraday/convicção',
    entryStrategy: 'string — como entrar (pullback, breakout, reversão)',
    exitStrategy: 'string — como sair (target fixo, trail, parciais)',
    pathRecommendation: 'string — Path A (N×1), Path B (1×N), ou ambos',
  },
  scenarios: [
    {
      name: 'Dia ideal',
      // result DEVE ser +dailyGoal
      description: 'string — trader atingiu todos os targets do dia',
      trades: 'number',
      result: 'number — EXATAMENTE +dailyGoal',
      cumulative: 'string',
    },
    {
      name: 'Dia médio',
      // result = resultado parcial de 1 win + 1 loss (narrativa)
      description: 'string — 1 win + 1 loss (ou equivalente parcial)',
      trades: 'number',
      result: 'number — (targetUSD - stopUSD) típico',
      cumulative: 'string',
    },
    {
      name: 'Dia ruim',
      // result DEVE ser -dailyStop
      description: 'string — trader acionou todos os stops',
      trades: 'number',
      result: 'number — EXATAMENTE -dailyStop',
      cumulative: 'string',
    },
    {
      name: 'Sequência de losses',
      description: 'string — protocolo após 2-3 losses seguidos (parar? reduzir? continuar?)',
      trades: 'number',
      result: 'number',
      cumulative: 'string',
    },
  ],
  behavioralGuidance: {
    preSession: 'string',
    duringSession: 'string',
    afterLoss: 'string',
    afterWin: 'string',
    deadlineManagement: 'string',
    personalWarnings: ['string'],
  },
  milestones: [
    {
      day: 'number',
      targetBalance: 'number — P&L acumulado esperado',
      description: 'string',
    },
  ],
  metadata: {
    model: 'claude-sonnet-4-20250514',
    promptVersion: '1.1',
    dataSource: '4d_full|indicators|defaults',
    generatedAt: 'ISO timestamp',
  },
};

module.exports = {
  MODEL,
  MAX_TOKENS,
  TEMPERATURE,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildUserPrompt,
  buildTraderProfileBlock,
  RESPONSE_SCHEMA,
};
