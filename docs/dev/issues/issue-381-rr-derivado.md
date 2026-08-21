# Issue #381 — fix: R:R derivado no lugar do escalar gravado

## Autorização

- [x] Marcio autorizou — 21/08/2026: *"saída antecipada por que? fiz uma posição que tomou 125 de risco para 250 de alvo, sai antecipado por quê?"* + *"então não resolveu nada"*
- [x] Gate Pré-Código liberado

## Context

O card de Comportamento do WINV26 LONG 10 de 21/08 dizia as duas coisas ao mesmo tempo: **"Saída antecipada — você saiu com 21% do alvo (RR 0.42 contra 2 do plano)"** e **"Alvo atingido — você saiu no alvo planejado (2:1)"**. E depois do #375 a saída antecipada virou a família dominante, então passou a ditar o confronto emocional do trade ("a execução sugere Medo").

Conta do Marcio, correta: risco de 125 pts para um alvo de 250. Saiu em 174.290, dez pontos **além** do alvo de 174.280. R:R real **2,08**.

## Spec

Ver issue body no GitHub: #381.

## Memória de Cálculo

### De onde vinha o 0,42

`detectEarlyExit` não calculava nada — lia o escalar `trade.rrRatio`, gravado pela CF de compliance. O valor no documento era `0.42`, que é o que a fórmula produz **sem `tickerRule`**:

```
com tickerRule (tickSize 5):  (520 / (1 × 10)) × 5 = 260 pts  →  260/125 = 2,08
sem tickerRule (default 1):   (520 / (1 × 10)) × 1 =  52 pts  →   52/125 = 0,42
```

O documento tem `tickerRule` hoje e tem `resultInPoints: 260` correto — só o `rrRatio` ficou velho. Prova de que são escritas de momentos diferentes: o mesmo doc traz `compliance.rrStatus: 'CONFORME'` contra um alvo de 2, o que é incompatível com 0,42.

### A derivação nova

```
riskPts = |entry − stopLoss|
gainPts = (exit − entry) × (side === 'SHORT' ? −1 : 1)
rr      = gainPts / riskPts
```

Base é **preço**, não dinheiro. É a mesma geometria que `detectTargetHit` já usava para calcular `entrada ± risco × alvo`. Com os dois na mesma régua, a contradição deixa de ser possível por construção, e o número não depende de `tickerRule`, de `result` nem de qualquer campo que possa envelhecer.

Trade de referência: `(174290 − 174030) / |174030 − 173905| = 260/125 = 2,08`.

### Segundo defeito, no mesmo caminho

`detectEarlyExit` e `detectTargetHit` liam `trade.planRR` para o alvo do plano. Esse campo **nunca existiu no modelo**: o que `buildBehaviorProfile` anexa é `planRrTarget` (`plan.rrTarget ?? 2`). O `?? 2.0` de fallback mascarava a ausência, então todo aluno era julgado contra 2:1 qualquer que fosse o `rrTarget` do plano dele. AP-07 clássico — nome canônico inventado, silenciado por default.

### Casos limites

- **sem stop informado** → `null`, não zero. `Number(null)` é 0 e passaria por finito: sem a guarda, um trade sem stop viraria "risco = entrada inteira" e R:R 0,00, que o detector leria como saída antecipada gravíssima. Mesma armadilha que o #373 pegou em `rrBreakdown` — e que este issue quase repetiu (pega por teste).
- **stop na entrada** (risco zero) → `null`; não é R:R infinito, é ausência de razão.
- **SHORT** → direção invertida no ganho.
- **`rrAssumed`** (trade sem stop, RR inferido do RO) → detectores continuam saindo cedo, como antes.

## Phases

- ~~A1~~ FEITO — `realizedRR` + `planRrTargetOf` em `shadowBehaviorAnalysis.js`, consumidos por EARLY_EXIT, TARGET_HIT e CLEAN_EXECUTION
- ~~A2~~ FEITO — paridade em `functions/shadow/shadowDetectors.js`
- ~~A3~~ FEITO — testes (10 novos + fixtures do bloco EARLY_EXIT reescritas em preço)
- B1 — recompute dos `behaviorProfile` afetados
- B2 — varrer os demais consumidores de `trade.rrRatio` (dashboard, ledger, snapshot) — fora deste issue se for grande

## Sessions

- `A1+A2+A3 [rr-derivado] ok` — suíte completa verde (250 arquivos)

## Shared Deltas

- `src/version.js` — bump v1.83.21
- `docs/registry/versions.md` — marcar v1.83.21 consumida
- `docs/registry/chunks.md` — liberar CHUNK-05 e CHUNK-11
- `CHANGELOG.md` — entrada `[1.83.21]`
- `docs/PROJECT.md` — bump + parágrafo de encerramento

## Decisions

- DEC-AUTO-381-01

## Chunks

- CHUNK-05 (escrita) — origem do escalar `rrRatio`
- CHUNK-11 (escrita) — detectores que o liam
