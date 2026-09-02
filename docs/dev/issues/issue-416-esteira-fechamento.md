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
