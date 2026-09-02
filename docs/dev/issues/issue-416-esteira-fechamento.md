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
