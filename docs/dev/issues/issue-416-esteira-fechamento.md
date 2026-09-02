# Issue #416 — fix: a esteira de fechamento está mentindo (13 correções nítidas)

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [ ] Mockup apresentado (ou exceção autorizada por Marcio)
- [ ] Memória de cálculo apresentada — **no body do issue #416**, seção "Memória de cálculo" (A1, C1, C3, D1)
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado

**Bloqueio ativo:** duas decisões abertas antes de codar C1 e C2 (ver Decisões pendentes). Blocos A, B e D não dependem delas.

## Context

O fechamento do ciclo de agosto/2026 (conta do Marcio, 20 trades, v1.86.0) foi lido passo a passo contra o código. A esteira exibe números e textos que não correspondem ao dado — dois deles viram recomendação formal do produto ao aluno, e um (Monte Carlo) erra por 30× num número forward-looking.

Causa raiz da maioria: texto ou número derivado de um **proxy** em vez do dado. Faixa de pontuação, taxa, constante fixa, string fixa, sinal do P&L, outlier.

Escopo = só o inequívoco. Calibração de pesos, gates estatísticos, redundância Sharpe×CV e ranking por custo ficam para issue de decisão de produto.

## Spec

Ver issue body no GitHub: #416. Cada item tem `arquivo:linha`.

## Mockup

Não há tela nova. Todas as mudanças de UI são de expressão sobre layout existente:

```
A5 — Custo emocional do ciclo        [ícone fixo, não condicionado ao P&L]
┌──────────────────────────────┬──────────────────────────────┐
│ Em dias com tilt/vingança(1) │ Em dias sem tilt/vingança(10)│   ← A6: rótulo
│ +R$ 560          (vermelho)  │ −R$ 134           (vermelho) │   ← A5: cor por
│                              │                              │      valência
└──────────────────────────────┴──────────────────────────────┘
  Cor do número: dia sujo SEMPRE vermelho/neutro. Dia limpo segue o sinal.

A1/A2 — Distribuição (base = 20 trades do plano)     ← A2: samplePoolSize real
  Sobre o capital base R$ 30.426: mediana +1,3%,     ← A1: /baseCapital
  cenário ruim (p10) −4,5%, cenário bom (p90) +7,5%.
  [baseCapital ausente/≤0 → exibe em R$, sem %]

A3 — cards do TPS: hint só aparece quando o predicado do dado é verdadeiro.
     PF 1,18 (payoff > 1) → SEM hint. DD 3,9% com stop de ciclo 8,5% → SEM hint.

A4 — Q3 "Erro próprio": conta compliance.violations. Zero violações → o texto
     de evidência é o 'weak' que já existe, não "4 violações de regras".

B1 — Q4 SUSTENTAR: com tilt/vingança/tampering no ciclo, os chips de outlier
     (melhor trade, melhor dia) não são oferecidos. Mesma regra do chip de
     aderência, que já se comporta assim.

C3 — Aderência: "16 de 18 avaliados (2 trades sem compliance)" quando houver
     trade fora da avaliação. Cobertura zero → tile "sem dado", peso redistribuído.
```

## Memória de Cálculo

No body do #416 (seção "Memória de cálculo"), cobrindo os quatro itens que mudam número: **A1** (percentual do Monte Carlo), **C1** (`ruleViolationRate` honrando `feedsGates`), **C3** (`ruleAdherenceRate` excluindo trade sem `compliance`) e **D1** (`maxDD` com desempate por hora). Inclui exemplo numérico do ciclo de agosto em A1 e o precedente de `computeFinancial.js:79` em C3.

Não duplicar aqui (R4).

## Decisões pendentes (bloqueiam C1 e C2)

- **C1 — `feedsGates`:** honrar o flag em `aggregateBehaviorWeights` (recomendado) ou removê-lo da taxonomia. Não pode ficar declarado e não lido.
- **C2 — gate de estratégia:** o que "manter a mesma estratégia" significa. (1) setup dominante com limiar menor que 60%, (2) estabilidade do conjunto de setups, ou (3) ausência de mudança nos parâmetros do plano — o `plans` que hoje é descartado por `void plans`.

## §3.1 Decisões Antecipadas

Fechadas antes do loop. Worker aplica sem perguntar.

- **D-01 (A1)** — `baseCapital` ausente, não-finito ou ≤ 0 → exibir o valor em R$ e **omitir** o percentual. Nunca cair em divisor alternativo.
- **D-02 (A1)** — a conversão vira helper puro exportado e testado; o JSX não faz aritmética inline.
- **D-03 (A3)** — predicado por fator, avaliado sobre o dado (nomes canônicos a confirmar no cross-check):
  - `pf` → hint só se o payoff realizado for < 1 (ganho médio menor que perda média de fato)
  - `dd` → hint só se o drawdown do ciclo alcançou ≥ 80% do stop de ciclo do plano. Atenção à unidade: `maxDD.percent` é fração decimal, `plan.cycleStop` é percentual — cross-check obrigatório
  - `exp` → hint só se a expectância for ≤ 0. Estar abaixo do teto da escala não é defeito
  - `consistency` → hint só se o CV normalizado indicar errático pela banda já usada em `cvTheme`
  - `rule` → hint só se houver violação declarada de fato
  - Fator sem predicado verdadeiro não exibe hint, mesmo com pontuação baixa
- **D-04 (A4)** — contar `compliance.violations` como `topErrors` já faz. Aderência abaixo do limiar **sem** violação declarada → usar o texto de evidência `weak` que já existe. Nunca derivar contagem de taxa.
- **D-05 (A6)** — renomear o rótulo, **não** redefinir o que suja um dia. Incluir eventos de execução na definição de dia sujo é decisão de produto e está fora deste issue.
- **D-06 (B1)** — o guard é exatamente o `hasCriticalSignal` já calculado em `Step3Reflect.jsx:131`. Não criar condição nova.
- **D-07 (C3)** — zero trades avaliáveis → retorna `null` (o TPS já renormaliza o peso desde o #337). Retorno passa a carregar o que a UI precisa para a linha de cobertura.
- **D-08 (D1)** — desempate por horário de entrada; empate remanescente resolve pela ordem estável do array.
- **D-09** — nenhuma task cria campo, collection ou subcollection. INV-15 não é acionada em lugar nenhum deste issue.
- **D-10 (C1) — resolvida pelo registro, não é decisão nova.** O body do #416 afirma que `feedsGates` "não é lido em lugar nenhum". **Está errado.** Ele é lido pela via derivada `GATE_CODES` (`behavioralTaxonomy.js:266`), consumida em `behavioralDetection/index.js:170` para montar `gateInputs` (DEC-AUTO-301-03). Existem **duas vias de gate** e só uma honra o flag:
  1. `gateInputs` via `GATE_CODES` → honra `feedsGates`. Alimenta os gates `count==0`.
  2. `ruleViolationRate` via `aggregateBehaviorWeights` → conta toda família negativa, ignora o flag.

  O mapa de pesos aprovado (`docs/dev/behavioral-weight-map.md`, aprovado 01/06/2026, recalibrado 05/06/2026 no #305) é explícito por padrão sobre qual efeito cada um tem: `TILT` (linha 54) diz "penalidade E alta; **entra na rule-violation rate**; gate 4→5"; `EARLY_EXIT` (linha 60) diz **apenas** "penalidade E+F"; `LATE_EXIT` (59) e `HESITATION` (67), idem. O mapa nunca colocou esses três na taxa.

  Portanto a task 07 **não escolhe semântica** — ela alinha `aggregateBehaviorWeights` ao mapa já aprovado, usando `GATE_CODES` como fonte, exatamente como `behavioralDetection` já faz. `byDimension`/`bonusByDimension` seguem contando tudo (governados por `feedsScore`). Corrigir também a afirmação errada no body do issue.
- **D-11 (C2) — Marcio decidiu: parâmetros do plano.** Verificado que o histórico necessário **existe parcialmente**:
  - `plan.editHistory[]` (`usePlans.js:200-206`) grava `{by, email, fields[], timestamp}` por edição — presente em 9/28 planos (32%); ausência = nenhuma edição registrada, o que é informação válida.
  - `RISK_FIELDS = ['riskPerOperation','rrTarget','periodStop','cycleStop']` (`usePlans.js:34`) já é a constante canônica dos parâmetros de risco.
  - `plan.updatedAt` é sobrescrito a cada escrita — serve como carimbo, não como série.

  **Métrica:** `strategyConsMonths` = meses decorridos desde a entrada mais recente de `editHistory` cujo `fields ∩ RISK_FIELDS ≠ ∅`. Sem entrada qualificada → conta desde a criação do plano. Vários planos ativos → o menor valor entre eles (a mudança mais recente manda).

  **Ponto cego e correção junto:** hoje `editHistory` só é escrito quando `auditInfo.editedBy === 'mentor'`. Edição do próprio aluno bumpa só `updatedAt` e some do histórico — o que faria a métrica mentir em 68% dos planos daqui pra frente. A task 08 passa a gravar `editHistory` também na edição do aluno (`by: 'student'`), mesmo shape. Campo já existe, INV-15 não é acionada. Ampliação deliberada de escopo, registrada aqui porque sem ela a semântica escolhida não se sustenta.

  **Limitação declarada:** o histórico começa onde os dados começam. Planos sem `editHistory` contam desde a criação; mudanças de parâmetro anteriores ao campo existir são invisíveis. O gate fica honesto daqui pra frente, não retroativamente.

## §3.2 Decisões Autônomas

_(coord consolida DEC-AUTO-416-XX aqui)_

- **DEC-AUTO-416-01 (task 01)** — `pctOfBase` rejeita `value` não-finito além da base. | Justificativa: D-01 só cobria a base; `NaN` no valor produziria `NaN%` e furaria o critério de aceitação.
- **DEC-AUTO-416-02 (task 01)** — separador decimal do percentual fica **ponto** (`+1.3%`), não vírgula. | Justificativa: padrão estabelecido no código (`toFixed(1)}%` em `MentorClosuresInbox.jsx:19`, `CycleExpiredGuard.jsx:53`, `MentorClosureView.jsx:331+`); INV-06 rege datas, não percentuais. O `+1,3%` do critério de aceitação era prosa. Trocar para vírgula é decisão de produto de escopo maior que este issue.
- **DEC-AUTO-416-03 (task 01)** — texto "Sobre o capital base" passa a usar `currencyFmt`, respeitando `account.currency` em vez de hardcodar "R$". | Justificativa: coerência com o card de capital base logo acima (`Step6Adjust.jsx:313`); efeito colateral aceito: passa a exibir centavos.
- **DEC-AUTO-416-04 (task 01)** — sinal explícito nos três percentis do Monte Carlo. | Justificativa: o código antigo fixava `+` no p90 e omitia sinal no p50, o que mentiria em pool de expectância negativa.
- **DEC-AUTO-416-05 (task 02, coord)** — ícone do cabeçalho do custo emocional condicionado à presença de dias sujos (`tiltDaysCount === 0 ? Smile : Frown`), não a um ícone literalmente constante. | Justificativa: o body do #416 proíbe condicionar **ao P&L**; a fase A5 pede "cor e ícone por valência comportamental". Fixar `Frown` faria a seção parecer sombria num ciclo com zero tilt — troca de mentira. Valência ≠ resultado.
- **DEC-AUTO-416-06 (task 03, coord)** — predicados dos hints do TPS vão para helper puro exportado e testado (`src/utils/cycleClosure/tpsHints.js`), não inline no JSX. | Justificativa: mesma razão de D-02 no A1 — predicado inline no render não é testável, e foi assim que os cinco hints viraram proxy sem ninguém notar.
- **DEC-AUTO-416-07 (task 03, coord)** — fronteira de "errático" do fator consistência é a banda de `cvTheme` (`> 1.5`), não constante nova. | Justificativa: `cvTheme` (`cycleMetricTiles.jsx:107`) já é a SSoT visual da banda e `cvToConsistencyNorm` já se ancora nela.
- **DEC-AUTO-416-08 (task 03, coord)** — CV `< 0.5` (banda "Suspeito") não dispara hint. | Justificativa: é flag de qualidade de dado, não erro do aluno (docstring de `cvToConsistencyNorm`, `tradingPerformanceScore.js:44-46`); punir com hint repetiria o vício do A3.
- **DEC-AUTO-416-09 (task 03, worker)** — hint de `rule` passou de "violações de RO/RR" para "violações declaradas no ciclo", e `violationsCount` conta **todas** as violações (`topErrors(trades, MAX)`), não o `top3Errors`. | Justificativa: o predicado novo cobre qualquer tipo em `compliance.violations`; manter "RO/RR" repetiria em escala menor o vício que o A3 corrige, e contagem parcial com nome de total é a mesma classe de erro.
- **DEC-AUTO-416-10 (task 04, coord)** — o A4 se resolve **removendo** o ramo derivado da taxa, não somando um total de violações no `Step3Reflect`. | Justificativa: não há total honesto na shape persistida — `metrics.topErrors` é top-3 e `patterns.unifiedErrors` é top-5 misturando compliance e behavioral (`cycleMetrics.js:317-344`). O total exigiria `metrics.violationsCount` **persistido** → INV-15, vetado por D-09. Limitação declarada, não dívida silenciosa.
- **DEC-AUTO-416-11 (task 04, coord)** — a soma dos dias limpos é `patterns.correlation.performanceOnCleanDays`, não `dayBreakdown.cleanPnl` como diz o body do #416. | Justificativa: `cleanPnl` não sobrevive à serialização de `patterns` (`Step2Notice.jsx:200-204`); `performanceOnCleanDays` é o mesmo número na shape que persiste e já é lido por `swotHeuristics.js:315`. Seguir o body literalmente daria `undefined > 0` — sustain sumindo por acidente, não por regra. Body do #416 a corrigir no encerramento.
- **DEC-AUTO-416-12 (task 05, coord)** — desempate do `maxDD` usa `sortTradesChrono`/`compareTradesChrono` (`src/utils/tradeInstant.js`), não comparador local por `entryTime`. | Justificativa: D-08 previa "ordem estável do array" como desempate remanescente, mas o comparador do #402 resolve o naive-vs-offset do `entryTime` (`planStateMachine.js:322-324`) e desempata por `id`, tornando a saída invariante a permutação — que é exatamente a propriedade que faltava. D-08 fica atendida com garantia mais forte, não contrariada.
- **DEC-AUTO-416-13 (task 06, coord) — SUPERSEDIDA por DEC-AUTO-416-15.** — o **campo persistido** `metrics.ruleAdherenceRate` continua `number | null`; quem muda de contrato é só o util `computeRuleAdherenceRate` (passa a devolver `{rate, evaluated, total}` ou `null`). | Justificativa: a memória de cálculo pede o retorno rico para a UI, e isso é atendido no util; mas `metrics` é seção persistida (`docs/firestore-schema.md:47`) lida como número por `MentorClosureView.jsx:365-367,396`, `swotHeuristics.js:119,204`, `closurePlanAdvisor.js:228-234` e `computeTPS`. Persistir objeto quebraria closures já seladas.
- **DEC-AUTO-416-14 (task 06, coord)** — a linha de cobertura da aderência fica **fora** do tile, espelhando o `coverageLabel` do MEP/MEN (`Step1Read.jsx:333-334`); `adherenceContent` não é tocada. | Justificativa: `cycleMetricTiles` é SSoT compartilhada com o dashboard (#282) e o caso de cobertura zero já resolve certo lá (`rate == null` → "—"). Mudar assinatura de tile por causa de uma tela é o que o #282 proibiu.
- **DEC-AUTO-416-15 (task 06, coord)** — `computeRuleAdherenceRate` **mantém** o retorno `number | null`; a cobertura sai por `computeAdherenceCoverage`, função irmã que compartilha o predicado `isComplianceEvaluated`. **Supersede DEC-AUTO-416-13.** | Justificativa: o worker levantou `STOP: INVARIANT` correto — existe um 2º caller de produção, `ResultadoDoAluno.jsx:58` (entrou em `4ab2c3eb`/#411, depois da redação do spec), que passa o retorno cru a `adherenceContent`; trocar o contrato apagaria o tile de Aderência do MentorDashboard sem erro e sem teste vermelho, e o fix cairia em CHUNK-16, que o #416 não detém. Esta opção entrega o C3 inteiro, corrige o denominador **nas duas telas** sem tocar CHUNK-16, sem `Number` boxed e sem duplicar cálculo.
- **DEC-AUTO-416-16 (task 06, coord)** — aceito o efeito de ciclo **sem nenhum** trade com `compliance.roStatus` passar a ficar **sem nota de TPS**, em vez de pontuar sobre um zero falso. **Corrige premissa de D-07 e da própria spec do #416**, que afirmam "o TPS já renormaliza o peso": `computeTPS:112-114` trata `rule` como fator **obrigatório** (junto com `pf`) e devolve `score: null` — não há renormalização para este fator. | Justificativa: (1) pontuar sobre aderência 0 fabricada penaliza o aluno por CF que não rodou, que é exatamente a classe de mentira do issue; (2) a obrigatoriedade de `pf`+`rule` é decisão de framework pré-existente (Mark Douglas), e mexer nela é calibração — fora de escopo declarado do #416; (3) impacto real é de cauda: `compliance` está preenchido em 376/381 trades (99%, `docs/data-dictionary.md:41`), e o caso exige um ciclo em que **nenhum** trade tenha o campo. **Limitação declarada**, a revisitar se aparecer na base.
- **DEC-AUTO-416-17 (task 07, worker)** — o corte do `ruleViolationRate` é por **código canônico** (`p.code` resolvido por `getPattern`, cobrindo alias legado `STOP_TAMPERING` → `STOP_PANIC`), não por família. | Justificativa: a spec enumera códigos. **Assimetria declarada:** `behavioralDetection/index.js:162-170` intersecta `GATE_CODES` por **família**; o observável é `IMPULSE_CLUSTER` (`feedsGates: false`, família `OVERTRADING` que é gate) ficando **fora** da taxa e **dentro** do `gateInputs`. Se a intenção do produto for família, é uma linha — decisão de Marcio, não de código.
- **DEC-AUTO-416-18 (task 08, coord)** — `computeStrategyConsistencyMonths` passa a `(plans, options)`. | Justificativa: manter `(trades, plans)` com `void trades` reproduziria o anti-padrão que o próprio C2 denuncia; são 2 call sites (`evaluateMaturity` ESM + CJS). A paridade com a versão semanal perde sentido — as duas passam a medir coisas diferentes.
- **DEC-AUTO-416-19 (task 08, coord)** — label do gate `strategy-12-months` passa a descrever a métrica; `id`, `metric` e `threshold` intactos. | Justificativa: rótulo prometendo "mesma estratégia" sobre métrica de parâmetro de risco é o defeito que o #416 cataloga. Id é chave persistida — não se renomeia por estética.
- **DEC-AUTO-416-20 (task 08, coord)** — `options.now` injetável (default `new Date()`). | Justificativa: métrica ancorada no relógio sem injeção gera teste que passa hoje e quebra na virada do mês.
- **DEC-AUTO-416-21 (task 08, worker)** — além do `label`, mudou `friendlyLabel`, `whatIs` e `howTo` do gate. | Justificativa: os quatro são renderizados no `Step5Check.jsx:99,126,132`, e o `howTo` antigo ("Refinar parâmetros sim, trocar paradigma não") instruía exatamente o que **zera** a métrica nova. Rótulo corrigido com instrução invertida ao lado é a mesma mentira mudando de campo. `id`/`threshold`/`metric`/`dim` intactos. **Extrapolou a letra da restrição do briefing — aprovado pelo coord.**
- **DEC-AUTO-416-22 (task 08, worker)** — `planInstantToMs` é função nova, não extensão do `toEpochMs` do `resolveWindow`. | Justificativa: aquele é estrito por contrato (`trade.date`); aceitar número/Timestamp lá mudaria a janela de trades.
- **DEC-AUTO-416-23 (task 08, worker)** — `fields` = `changedFields || Object.keys(planData)` nas duas mãos. | Justificativa: `handleMentorSavePlan` (`AccountsPage.jsx:597`) **nunca** passou `changedFields`, então o caminho do mentor gravava `fields: []` desde sempre e a métrica nova jamais veria uma edição de mentor. Corrigido no hook (menor blast radius, sem tocar CHUNK-16). **Limitação declarada:** `Object.keys` é o formulário inteiro, não o diff real — salvar o modal sem mudar nada reseta a contagem (mesmo denominador que a cascata de compliance já usa, `usePlans.js:216`). Diff real exigiria ler o doc anterior → **candidato a follow-up**.

## Plano de tasks

| # | Task | Bloco | Depende de |
|---|------|-------|------------|
| 01 | Monte Carlo: percentual sobre `baseCapital` + pool real | A1, A2 | — |
| 02 | Custo emocional: cor por valência, ícone fixo, rótulo honesto | A5, A6 | — |
| 03 | Hints do TPS por predicado sobre o dado | A3 | — |
| 04 | Contagem real de violações + guard nos sustains de outlier | A4, B1 | — |
| 05 | `maxDD` com desempate por hora + `slice` do pool | D1, D2 | — |
| 06 | Aderência exclui trade sem `compliance` + cobertura na UI | C3 | 03, 04 (tocam os mesmos arquivos) |
| 07 | `ruleViolationRate` alinhado ao mapa aprovado via `GATE_CODES` + espelho CJS | C1 | D-10 (resolvida) |
| 08 | Gate de estratégia = meses sem mudança de parâmetro de risco do plano | C2 | D-11 (resolvida) |

Gate humano respondido em 01/09/2026 — ver D-10 e D-11. Todas as 8 tasks liberadas; 07 e 08 entram depois das 01-06 por tocarem os mesmos motores.

## Phases

- **A — expressão (não depende de decisão)**
  - A1 — Monte Carlo: divisor `1000` → `baseCapital` (6 ocorrências) + guarda de base ausente
  - A2 — pool do Monte Carlo: exibir `mc.samplePoolSize` em vez da string fixa
  - A3 — hints do TPS por predicado sobre o dado, não por faixa de pontos
  - A4 — "N violações de regras" conta `compliance.violations`
  - A5 — cor e ícone do custo emocional por valência comportamental
  - A6 — rótulo "dias limpos" → "dias sem tilt/vingança"
- **B — guarda de recomendação**
  - B1 — `hasCriticalSignal` nos dois sustains de outlier (`Step3Reflect` + `swotHeuristics`); sustain do melhor dia exige `cleanPnl > 0`
- **C — motor (após decisão)**
  - C1 — honrar `feedsGates` em `aggregateBehaviorWeights`
  - C2 — gate `strategy-12-months` conforme decisão
  - C3 — `ruleAdherenceRate` exclui trade sem `compliance` + cobertura na UI
- **D — latentes**
  - D1 — `maxDD` com desempate por `entryTime`
  - D2 — `.slice(-200)` → `.slice(0, 200)` em `planTrades`

## Sessions

_(1 linha por task)_

- **08 — Gate de estratégia por parâmetro de risco (C2)** — OK. Commit `0c1fcb48`; root 4646 / 0, functions 260 / 0; validator INV-27 exit 0. Assinatura `(plans, options)`, métrica por `editHistory` ∩ `RISK_FIELDS` com fallback em `createdAt` e mínimo entre planos ativos; `RISK_FIELDS` virou SSoT em `src/utils/planRiskFields.js` (espelhada em functions, paridade travada por teste); `editHistory` passa a gravar `by: 'student'`. Meses por aniversário, não diff de calendário. Sem backfill, sem campo novo. **CFs em `functions/maturity/` tocadas → deploy no passo 0a do cc-close.** DEC-AUTO-416-21/22/23.
- **07 — `ruleViolationRate` via `GATE_CODES` + espelho CJS (C1)** — OK. Commit `820b81c5`; root 4611 / 0, functions 253 / 0; validator INV-27 exit 0. `hasViolation` exige `GATE_CODES.includes(p.code) && elegivel`; guard #394 e clearing preservados; `wpen`/`wbon` intocados. Efeito medido contra `HEAD:` na mesma fixture: dimensões e `gateCounts` idênticos, taxa 0,75 → 0,25. 3 testes existentes mudaram de valor (embutiam família não-gate); gate B2 do `evaluateMaturity` reprovava com `GREED_CLUSTER` — o inalcançável do #376/#377. DEC-AUTO-416-17.
- **06 — Aderência + cobertura (C3)** — OK no 2º despacho. Commit `990fd227`; 4598 passed / 0 failed; validator INV-27 exit 0. Denominador só do avaliável, retorno segue `number | null`, `computeAdherenceCoverage` irmã com predicado `isComplianceEvaluated` compartilhado; linha de cobertura no padrão MEP/MEN. `ResultadoDoAluno`/`cycleMetricTiles`/`functions/` fora do diff. Fixture `LOW_SCORE_TRADES` ganhou `roStatus: 'FORA_DO_PLANO'` (declara o que já assumia; taxa/score/hints idênticos). DEC-AUTO-416-15/16.
- **06 (1º despacho)** — `STOP: INVARIANT` legítimo, zero código, HEAD intacto. 2º caller (`ResultadoDoAluno.jsx:58`, CHUNK-16 sem lock) invalidava a troca de contrato. Redespachada com DEC-AUTO-416-15.
- **05 — maxDD determinístico + pool dos 200 recentes (D1, D2)** — OK. Commit `17ebbe41`; 4582 passed / 0 failed; validator INV-27 exit 0. `sortTradesChrono` no `maxDD` (fórmula intocada), `.slice(0, 200)` no pool do Kelly/MC. Testes verificados vermelhos no código antigo antes do fix. Achado: `tradeInstantMs` nunca retorna null com `date` válido — trade sem horário colapsa no meio-dia local, não vai pro fim do dia. DEC-AUTO-416-12.
- **04 — Violações reais + guard nos sustains de outlier (A4, B1)** — OK. Commit `01892f95`; 4575 passed / 0 failed; validator INV-27 exit 0. Ramo derivado da taxa removido; guard aplicado nos 4 pontos (wizard + SWOT do mentor); melhor dia exige `performanceOnCleanDays > 0`. Zero campo novo em `metrics`/`patterns` — INV-15 não acionada. Fixture de `swotHeuristics.test.js:193` completada com `correlation` (cenário preservado, não enfraquecido). DEC-AUTO-416-10/11.
- **03 — Hints do TPS por predicado (A3)** — OK. Commit `3bdbb4f9`; 4556 passed / 0 failed; validator INV-27 exit 0. `tpsHints.js` novo (`buildTpsHints`), gate `filled < 0.5` removido, 5 predicados sobre o dado. Nota, pesos e normalização intocados. DEC-AUTO-416-06..09.
- **02 — Custo emocional por valência (A5, A6)** — OK. Commit `cd7b998f`; 4522 passed / 0 failed; validator INV-27 exit 0. Dia sujo sempre vermelho, dia limpo pelo sinal, ícone por `tiltDaysCount`, rótulo "dias sem tilt/vingança" nos 3 pontos (+ `swotHeuristics.js:319`). `Step2Notice.test.jsx` novo, 9 casos. `isDirty` intacto. DEC-AUTO-416-05.
- **01 — Monte Carlo percentual + pool real (A1, A2)** — OK. Commit `5b4fb058`; 4513 passed / 0 failed; validator INV-27 exit 0. `pctOfBase` helper puro + 13 testes; 6 divisores `1000` removidos; `samplePoolSize` real no rótulo. DEC-AUTO-416-01..04.

## Shared Deltas

- `src/version.js` — bump v1.86.1 (**já aplicado no main na abertura**)
- `docs/registry/versions.md` — marcar v1.86.1 consumida (encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-03 e CHUNK-09 (encerramento)
- `CHANGELOG.md` — nova entrada `[1.86.1] - DD/09/2026` (encerramento)
- `docs/PROJECT.md` — encerramento
- `docs/decisions.md` — DEC de C1 e C2 quando decididas

## Decisions

_(apenas IDs — texto em `docs/decisions.md`)_

## Chunks

- CHUNK-03 (escrita) — wizard e utils de `cycleClosure`: `Step1Read`, `Step2Notice`, `Step3Reflect`, `Step6Adjust`, `cycleMetrics`, `swotHeuristics`
- CHUNK-09 (escrita) — `maturityEngine`: `behaviorWeights` (C1), `helpers`/`constants` (C2)
- CHUNK-04 (leitura) — trades
- CHUNK-05 (leitura) — `compliance.js`, para o predicado de A3 e o filtro de C3
- CHUNK-06 (leitura) — tilt/revenge que alimentam A5/A6
- CHUNK-11 (leitura) — `behavioralTaxonomy`, origem do `feedsGates`

## Fora de escopo

Ver seção "Fora de escopo" do body do #416 — vira issue de decisão de produto.
