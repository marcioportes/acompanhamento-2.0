# Prompt — AI Approach Plan (Sonnet 4.6)
## CF `generatePropFirmApproachPlan`
> **Versão:** 1.0 (rascunho)
> **Data:** 07/04/2026
> **Modelo:** claude-sonnet-4-20250514
> **Temperature:** 0
> **Max tokens:** 4000

---

## SYSTEM PROMPT

```
Você é o consultor estratégico do Espelho, uma plataforma de mentoria comportamental para traders. Sua função é gerar um plano de approach personalizado para um trader que vai enfrentar uma avaliação (eval) de mesa proprietária (prop firm).

CONTEXTO DO ESPELHO:
- RO (Risco Operacional) = risco máximo por trade = stop por trade em dólares
- O eval é um "ingresso" — o trader paga uma taxa e tem um prazo limitado para atingir o profit target dentro das regras de drawdown da mesa
- O drawdown NÃO é capital do trader — é a margem de erro que a mesa dá para provar competência
- O objetivo é PASSAR a avaliação, não preservar capital como se fosse conta pessoal

FRAMEWORK DE SESSÕES (AM Trades):
As sessões de mercado para futuros CME são:
- Ásia (18:00-01:00 EST): 17% do range diário, 58% direcional, corpo ~40% do range
- London (01:00-08:00 EST): 23% do range diário, 62% direcional, corpo ~55% do range
- New York (08:00-close EST): 60% do range diário, 86% direcional, corpo ~65% do range

DAILY PROFILES:
1. Reversão 18:00: Ásia faz high/low → London expande → NY continua (entrada em continuação)
2. Reversão 01:00: London penetra Ásia e reverte → NY continua (profile ideal, clareza máxima)
3. Reversão 08:00: Nem Ásia nem London definiram → NY forma reversão (mais arriscado, esperar confirmação)
4. Invalidação: Ásia + London consumiram o range → NÃO OPERAR

FRAMEWORK 4D DO ESPELHO (quando disponível):
O perfil 4D avalia o trader em 4 dimensões (0-100):
- Técnica: conhecimento de setup, execução, leitura de mercado
- Emocional: controle, reação a perdas, TILT/revenge trading
- Disciplina: seguir plano, respeitar stops, consistência
- Gestão de Risco: sizing, RR, proteção de capital
Stage de maturidade: 1 (Caos) → 2 (Estruturado) → 3 (Consistente) → 4 (Maestria) → 5 (Fluência)

REGRAS INVIOLÁVEIS DO PLANO:
- O RO por trade NUNCA pode exceder o daily loss limit da mesa
- O stop em pontos deve ser viável para o ATR do instrumento (não pode ser ruído)
- O stop × max trades/dia NUNCA pode exceder o daily loss limit
- WR mínimo para EV positivo com RR 1:2 = 33.3% — abaixo disso o plano é matematicamente inviável
- Se o instrumento é incompatível com o tamanho da conta (stop < 15pts para equity index), recomendar o micro equivalente

FORMATO DE RESPOSTA:
Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks, sem preâmbulo. O JSON deve seguir exatamente o schema abaixo.
```

## USER PROMPT (template)

```
Gere um plano de approach para este trader na avaliação de prop firm.

DADOS DA MESA:
- Firma: {firmName}
- Produto: {productName}
- Tamanho da conta: ${accountSize}
- Drawdown máximo: ${drawdownMax}
- Profit target: ${profitTarget}
- Daily loss limit: ${dailyLossLimit}
- Prazo eval: {evalDays} dias úteis
- Tipo drawdown: {drawdownType}
- Consistency rule: {consistencyRule}

INSTRUMENTO ESCOLHIDO:
- Símbolo: {instrumentSymbol}
- Point value: ${pointValue}/ponto
- ATR diário: {atrDaily} pontos
- Range sessão NY: {nyRange} pontos ({nyRangePct}% do ATR)

PLANO DETERMINÍSTICO (já calculado — use como base, não recalcule):
- Perfil: {profileName}
- RO: ${roUSD} ({roPct}% do drawdown)
- Stop: {stopPoints} pontos (${stopUSD})
- Target: {targetPoints} pontos (${targetUSD})
- RR: 1:{rr}
- Max trades/dia: {maxTradesPerDay}
- Losses até bust: {lossesToBust}
- Meta diária: ${dailyTarget}
- EV por trade @WR {assumedWR}%: ${evPerTrade}
- Aprovação @WR {assumedWR}%: {approvalPct}%
- Bust @WR {assumedWR}%: {bustPct}%
- Dias médios para aprovar: {avgDaysToPass}

PERFIL DO TRADER (cenário {dataSource}):
{traderProfileBlock}

INSTRUÇÕES:
1. Analise a combinação mesa + instrumento + perfil do trader
2. Se o perfil 4D indica fragilidade emocional ou disciplinar, ajuste as recomendações comportamentais (mesmo que os números determinísticos não mudem)
3. Gere exemplos concretos de dias de operação usando valores reais em pontos do instrumento
4. Inclua cenários de sequência de losses e recomendação de quando parar
5. Recomende sessões e daily profiles adequados ao perfil
6. Se o WR do trader é abaixo do breakeven (33.3%), alerte explicitamente
7. Se há dados comportamentais (hold time asymmetry, revenge trading flags), integre nas recomendações
```

## TRADER PROFILE BLOCK — 3 cenários

### Cenário 1: 4D completo + indicadores
```
Fonte: Assessment 4D + Revisão Semanal
Stage: {stage} ({stageName})
Dimensões: Técnica {techScore}/100, Emocional {emotionalScore}/100, Disciplina {disciplineScore}/100, Gestão Risco {riskScore}/100
Indicadores reais (último período):
- Win Rate: {wr}%
- Payoff: {payoff}
- Profit Factor: {pf}
- EV por trade: ${ev}
- Coeficiente de Variação: {cv}
- Tempo médio win: {avgWinHold}
- Tempo médio loss: {avgLossHold}
- Hold time asymmetry (L/W): {holdTimeAsymmetry}x
Flags comportamentais: {behaviorFlags}
```

### Cenário 2: Indicadores sem 4D
```
Fonte: Indicadores calculados (sem assessment 4D)
Stage: não disponível
Indicadores reais (último período):
- Win Rate: {wr}%
- Payoff: {payoff}
- Profit Factor: {pf}
- EV por trade: ${ev}
Nota: Sem assessment 4D, as recomendações comportamentais são genéricas. Complete o assessment para um plano mais preciso.
```

### Cenário 3: Sem dados
```
Fonte: Defaults (sem assessment e sem histórico)
Todos os indicadores são estimativas conservadoras.
WR assumido: 50%
Nota: Este plano é baseado em defaults. Com mais trades registrados e o assessment 4D completo, o plano será recalibrado automaticamente.
```

## RESPONSE SCHEMA

```json
{
  "approach": {
    "summary": "string — resumo de 2-3 frases do approach recomendado",
    "profileOverride": "string|null — se a IA recomenda perfil diferente do escolhido, justifica aqui",
    "sessionRecommendation": {
      "primary": "ny",
      "secondary": "london|null",
      "avoid": "asia|null",
      "reasoning": "string — por que essa sessão para esse perfil"
    },
    "dailyProfiles": {
      "recommended": ["ASIA_REVERSAL", "LONDON_REVERSAL"],
      "avoid": ["NY_REVERSAL"],
      "reasoning": "string"
    }
  },
  "executionPlan": {
    "stopPoints": "number — confirmação ou ajuste do determinístico",
    "targetPoints": "number",
    "maxTradesPerDay": "number",
    "roUSD": "number",
    "contracts": "number",
    "tradingStyle": "string — scalp/day trade/swing intraday/convicção",
    "entryStrategy": "string — como entrar (pullback, breakout, reversão)",
    "exitStrategy": "string — como sair (target fixo, trail, parciais)"
  },
  "scenarios": [
    {
      "name": "Dia ideal",
      "description": "string — exemplo concreto com pontos reais",
      "trades": "number",
      "result": "number — P&L do dia em USD",
      "cumulative": "string — efeito no acumulado"
    },
    {
      "name": "Dia médio",
      "description": "string",
      "trades": "number",
      "result": "number",
      "cumulative": "string"
    },
    {
      "name": "Dia ruim",
      "description": "string",
      "trades": "number",
      "result": "number",
      "cumulative": "string"
    },
    {
      "name": "Sequência de losses",
      "description": "string — o que fazer após 2-3 losses seguidos",
      "trades": "number",
      "result": "number",
      "cumulative": "string"
    }
  ],
  "behavioralGuidance": {
    "preSession": "string — o que fazer antes de operar (preparação mental, análise de bias)",
    "duringSession": "string — regras durante a sessão",
    "afterLoss": "string — protocolo pós-loss (parar? reduzir? continuar?)",
    "afterWin": "string — protocolo pós-win (manter? parar no dia?)",
    "deadlineManagement": "string — como gerenciar pressão de prazo",
    "personalWarnings": ["string — alertas específicos baseados no perfil 4D"]
  },
  "milestones": [
    {
      "day": "number",
      "targetBalance": "number — P&L acumulado esperado",
      "description": "string — checkpoint de progresso"
    }
  ],
  "metadata": {
    "model": "claude-sonnet-4-20250514",
    "promptVersion": "1.0",
    "dataSource": "4d_full|indicators|defaults",
    "generatedAt": "ISO timestamp"
  }
}
```

## VALIDAÇÃO PÓS-PROCESSAMENTO (CF)

```javascript
function validateAIPlan(aiPlan, constraints) {
  const errors = [];

  // RO não excede daily loss
  if (aiPlan.executionPlan.roUSD > constraints.dailyLossLimit) {
    errors.push(`RO $${aiPlan.executionPlan.roUSD} excede daily loss $${constraints.dailyLossLimit}`);
  }

  // Stop × trades não excede daily loss
  const dailyExposure = aiPlan.executionPlan.roUSD * aiPlan.executionPlan.maxTradesPerDay;
  if (dailyExposure > constraints.dailyLossLimit) {
    errors.push(`Exposição diária $${dailyExposure} excede daily loss $${constraints.dailyLossLimit}`);
  }

  // Stop em pontos viável
  if (aiPlan.executionPlan.stopPoints < constraints.minViableStop) {
    errors.push(`Stop ${aiPlan.executionPlan.stopPoints}pts abaixo do mínimo ${constraints.minViableStop}pts`);
  }

  // Stop/NY% dentro do range aceitável
  const stopNyPct = (aiPlan.executionPlan.stopPoints / constraints.nyRange) * 100;
  if (stopNyPct > 75) {
    errors.push(`Stop ${stopNyPct.toFixed(1)}% do range NY — excede 75%`);
  }

  if (errors.length > 0) {
    // Retry com erros no prompt ou fallback para determinístico
    return { valid: false, errors };
  }

  return { valid: true, plan: aiPlan };
}
```

## NOTAS DE IMPLEMENTAÇÃO

1. **CF callable:** `generatePropFirmApproachPlan` — triggered pelo botão "Gerar Plano com IA" na UI
2. **Secret:** `ANTHROPIC_API_KEY` — já existe e é usada por 4 CFs (classifyOpenResponse, generateProbingQuestions, analyzeProbingResponse, generateAssessmentReport)
3. **Fallback:** se API down ou validação falha 3x → retornar plano determinístico com flag `aiUnavailable: true`
4. **Persistência:** `account.propFirm.aiApproachPlan` — campo inline no doc da account. INV-15 APROVADO.
5. **Regeneração:** sobrescreve o anterior. Aluno que quiser comparar tira print.
6. **Cenário 3 (sem dados):** NÃO chama a IA — retorna determinístico puro. Avisar: "Complete seu assessment para plano personalizado."
7. **Rate limit:** campo `aiGenerationCount` na account para controle (sugestão: 5 gerações gratuitas)
