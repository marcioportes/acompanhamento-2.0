# AUDIT — Parser Clear DayTrade vs motor atual de importação de ordens

**Data:** 04/05/2026
**Origem:** prompt do Claude Opus em `Temp/PROMPT-CC-parser-comparison.md`, CSV real `Temp/040526-ORDER.csv` (sessão 04/05/2026, WINM26)
**Escopo:** **diagnóstico**, sem modificar código (INV-09). Issues propostas para entrada futura no backlog.
**Reconstrução manual de referência:** 4 trades / WR 50% / PL +R$72 / 1 trade sem stop loss real (25%).

---

## Sumário executivo

| # | Tema | Status no motor atual | Severidade |
|---|------|-----------------------|------------|
| 1 | Encoding ISO-8859-1 (preâmbulo + acentos) | ✓ tratado em `OrderUploader` (UTF-8 → fallback ISO-8859-1) | OK |
| 2 | `parseQty` resiliente a "2.0" e "2,0" | ✓ usa `parseInt` direto, não BR-num | OK |
| 3 | Filtro de linhas-evento (`Cancel`/`Trade`) | ✓ `isMasterRow = cols[0] !== ''` | OK |
| 4 | Datas BR `DD/MM/YYYY HH:mm:ss` | ✓ `parseDateTime` com regex explícita | OK |
| 5 | Pareamento entrada/saída | ✓ via net position por instrumento | OK p/ caso simples |
| 6 | **Stop loss vs Stop de Ganho (semântica)** | ❌ **AUSENTE** — só checa `tipoOrdem` | **CRÍTICA** |
| 7 | **Bracket OCO LIMIT com Preço Stop** | ❌ **REGRESSÃO** desde #208 | **CRÍTICA** |
| 8 | Bracket criado APÓS execução | ❌ ausente | ALTA |
| 9 | Trade sem stop loss real | ❌ ausente | ALTA (compliance) |
| 10 | RR planejado < 1 na entrada | parcial (RR é gravado, não há flag dedicada) | MÉDIA |
| 11 | Slippage de entrada como sinal | ❌ ausente | BAIXA (Layer 2) |
| 12 | Realização precoce sob hipótese válida | ❌ ausente | MÉDIA |
| 13 | Viés direcional contra regime do dia | ❌ ausente | MÉDIA (Layer 2) |
| 14 | Revenge directional reentry | ✓ `RAPID_REENTRY_POST_STOP` | OK (refinar com proximidade de preço) |

Os bugs **CRÍTICOS** (#6 e #7) explicam por que **trades stopados são classificados como sem proteção** e por que **trades sem stop loss real não são flagrados**. O motor está confundindo duas coisas semanticamente opostas.

---

## Parte 1 — Pitfalls de parsing (pontos 1.2 do prompt)

### #1 Encoding (resolvido)

`OrderUploader.handleFile` lê o arquivo como UTF-8; se detectar caracteres de substituição (`�`) ou bigrama típico de Latin-1 mal-decodificado (`Ã`), refaz como ISO-8859-1. Cobertura está ok para o CSV de referência.

**Fragilidade conhecida:** detecção de `Ã` é heurística — um nome legítimo com `Ã` (raro em PT-BR) poderia disparar o fallback, mas o UTF-8 inicial já teria decodificado certo, então o resultado seria idêntico (idempotente). Sem regressão conhecida.

### #2 `parseQty` (sem bug BR-num)

`orderParsers.parseQty` (linha 139-143) usa `parseInt(raw, 10)`. **Não tem o bug** descrito no prompt do Opus (que é específico do Python `pd.read_csv` com função BR custom). `parseInt("2", 10) === 2`, `parseInt("2.0", 10) === 2`, `parseInt("2,0", 10) === 2`. Cobertura via `__tests__/utils/orderParsers.test.js`.

### #3 Linhas-evento (resolvido)

`isMasterRow = cols[0] && cols[0].trim() !== ''` (linha 292). Linhas com `;;;;;;Cancel;...` ou `;;;;;;Trade;...` caem no ramo de evento e são anexadas ao `currentOrder.events`. Comportamento conferido no CSV de referência.

### #4 Datas BR (resolvido)

`parseDateTime(value, 'DD/MM/YYYY')` em `csvMapper.js:60-64` aplica regex explícita `^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$`. Sem ambiguidade `dayfirst`.

---

## Parte 2 — Reconstrução de operações

### Algoritmo atual (`reconstructOperations`)

- Agregação N×M por `externalOrderId` (`aggregateFills`).
- Filtragem por `status === 'FILLED' | 'PARTIALLY_FILLED'`, ordenação cronológica.
- **Net position por instrumento**: BUY soma, SELL subtrai. Quando `net=0` → operação completa.
- Stops/cancelados associados pela janela temporal `[entryTime - 60s, exitTime + 60s]` em `associateNonFilledOrders`.

### Resultado para o CSV `040526-ORDER.csv`

Aplicando o algoritmo a 8 ordens FILLED ordenadas por `filledAt`:

| Seq | Side | Qty | filledAt | Net pós | Op fechada |
|-----|------|-----|----------|---------|------------|
| BUY  190500 | +2 | 10:44:46 | +2 | — |
| SELL 190515 | −2 | 10:49:52 | 0  | **OP-001 LONG** ✓ |
| BUY  190365 | +2 | 11:32:03 | +2 | — |
| SELL 190130 | −2 | 11:35:20 | 0  | **OP-002 LONG** ✓ |
| BUY  190370 | +2 | 11:39:20 | +2 | — |
| SELL 190120 | −2 | 11:46:32 | 0  | **OP-003 LONG** ✓ |
| SELL 189830 | −2 | 12:17:16 | −2 | — |
| BUY  189180 | +2 | 12:21:23 | 0  | **OP-004 SHORT** ✓ |

**4 operações fechadas** — bate com a reconstrução manual. Algoritmo de net-position **funciona** para esse caso.

### Diferença vs heurística do prompt (1.3)

O prompt sugere **bracket por timestamp de Criação** (ordens criadas no mesmo `Criação` pertencem ao mesmo bracket). O motor atual **não usa** essa heurística — usa net position. Os dois métodos convergem para o caso comum de bracket OCO contínuo, mas divergem quando o trader **adiciona à posição** (`scale-in`) ou **fragmenta saída**:

- Net position trata scale-in como entrada adicional e exit fragmentada como saída adicional → 1 operação só.
- Bracket por timestamp trataria como 2 operações independentes se brackets foram criados em momentos distintos.

Para a sessão de referência, ambos convergem.

### Bug #7 — Bracket OCO da Clear: ordem LIMIT com Preço Stop preenchido

**Ground truth:** A Clear DayTrade (e por extensão ProfitChart-Pro) emite o **stop condicional** de um bracket OCO como ordem do **Tipo "Limite"** com o campo **`Preço Stop`** preenchido. Não é "Stop Limite" no `Tipo de Ordem` — é literalmente "Limite" + gatilho.

Exemplo do CSV (saída do trade #2, stop hit):
```
NLGC...416255;...;V;Executada;...;189.980,00;190.130,00;2;190.130,00;...;Limite;-;BMF;Estratégia
                                  preço     pStop  qty   avgFill           tipoOrdem
```
- `Tipo de Ordem = Limite`
- `Preço Stop = 190.130` (gatilho condicional)
- A ordem foi disparada e executou em 190.130 (avgFill).

**O que o parser faz hoje** (`orderParsers.js:307-312`):
```js
const isStopOrder = orderType === 'STOP' || orderType === 'STOP_LIMIT';
```
→ `isStopOrder = false` (porque `tipoOrdem = 'LIMIT'`).

**Consequência:**
- A ordem entra em `exitOrders` (não em `stopOrders`).
- `op.hasStopProtection = false` mesmo o stop tendo disparado.
- `op.stopExecuted = false`.
- `executionBehaviorEngine.detectStopTampering` não tem como observar a ordem (ela não é classificada como stop).
- O ALVO PLANNED cancelado vai para `cancelledOrders` corretamente, mas o stop "não existe" para o engine.

**Origem da regressão:** comentário no código (linha 307-311):
> "ProfitChartPro preenche `Preço Stop` em Limites também (entries SuperDOM com stop anexado, legs de bracket OCO com gatilho), então usar `stopPrice != null` classificava entradas e saídas comuns como stops e bagunçava a detecção de STOP_TAMPERING/PARTIAL_SIZING (issue #208)."

A solução em #208 foi correta sobre **entries** SuperDOM, mas **errada sobre legs de bracket OCO**. Diferenciador correto:
- Entry SuperDOM com Preço Stop: ordem no **mesmo lado da posição** (ou no lado oposto da pré-existente, se for entry inversa).
- Stop leg de bracket OCO: ordem no **lado oposto da posição aberta** com Preço Stop preenchido.

Reconstrução manual cobre essa distinção (tabela do prompt linha 110-115). Motor atual não.

### Bug #6 — Stop loss vs Stop de Ganho (semântica direcional)

Mesmo se #7 for corrigido (ordem com Preço Stop vira `stopOrder`), o motor **ainda não distingue** se o stop é loss ou ganho. Critério (cf. prompt linha 199-207):

```
LONG  + Preço Stop ABAIXO da entrada → Stop Loss
LONG  + Preço Stop ACIMA da entrada  → Stop de Ganho (trail/scale-out)
SHORT + Preço Stop ACIMA da entrada  → Stop Loss
SHORT + Preço Stop ABAIXO da entrada → Stop de Ganho
```

**Caso real do trade #1 (LONG)** no CSV:
- Entrada @ 190.500
- Saída exec @ 190.515 (Tipo "Limite", Preço Stop 190.515)
- 190.515 > 190.500 → **Stop de Ganho**, não Stop Loss
- O trade operou **descoberto** (sem proteção contra queda)

Motor atual: classifica como `stopExecuted=true` se #7 for corrigido sem contexto direcional — falsa proteção. Compliance gate "trade sem stop loss" geraria **falso negativo**.

---

## Parte 3 — Cobertura dos detectores propostos (3.1–3.7)

### 3.1 — Trade sem stop loss configurado simultaneamente à entrada — **AUSENTE**

Ramificações de #6+#7 acima. Detector ideal:
```
flag: NO_STOP_LOSS_AT_ENTRY
condição:
  - operação fechada
  - E nenhuma ordem com (lado oposto × Preço Stop em direção de loss real) foi criada
    em [entryTime - 30s, entryTime + 30s]
severidade: HIGH (compliance)
camada: 1 (determinística)
schema: nenhum campo novo — derivado da reconstrução
```

### 3.2 — Revenge directional reentry — **PARCIAL**

`RAPID_REENTRY_POST_STOP` (`executionBehaviorEngine.js:218`) cobre:
- mesmo `side` ✓
- mesmo `instrument` ✓
- gap < 10min ✓
- prev em loss (`tradeClosedInLoss`) ✓

**Falta:** filtro por proximidade de preço (`|T2.entry - T1.entry| < M pts`). Hoje aciona em qualquer reentry rápida em loss, mesmo se T2 entrou 1.000 pts longe (cenário diferente). Refinamento proposto: adicionar `priceDelta` em `evidence` e severity `LOW` quando |delta| > tolerância.

### 3.3 — RR planejado < 1 na entrada — **PARCIAL**

`tradeGateway.addTrade` calcula `rrRatio` a partir de `entry/exit/stopLoss`. Hoje:
- Se trade tem `stopLoss` setado → calcula RR real do que aconteceu.
- Se trade tem só `targetPrice` planejado → calcula `rrPlanned` em `compliance.computePlanned`.
- Compliance v1 valida RR contra `plan.rrTarget` (banda).

**Falta:** detector dedicado `RR_PLANNED_BELOW_THRESHOLD` (threshold default 1.5, configurável por aluno) que registra `evidence` com cálculo + setup whitelist. Hoje a regra está implícita em compliance, sem flag visível ao mentor.

### 3.4 — Slippage favorável correlation — **AUSENTE**

`slipPts = entry_avg - entry_lim` (LONG) não é coletado. Para colher, parser precisa preservar `priceLimit` (campo `preco`) e `avgFillPrice` separados — **ambos já existem** na ordem parseada. Falta apenas:
1. Calcular `slipPts` ao reconstruir a operação.
2. Persistir `_partials[].slipPts` ou top-level `entrySlipPts`.
3. Análise estatística Layer 2 com mínimo N=30.

### 3.5 — Realização precoce sob hipótese válida — **AUSENTE**

Detector ideal:
```
flag: EARLY_EXIT_UNDER_VALID_HYPOTHESIS
condição:
  - exit classificado como ALVO ou MANUAL (não STOP)
  - E exit_pts < 0.3 × planned_reward
  - E hold_time < 0.5 × hold_time mediano do estudante (Layer 2)
severidade: MEDIUM (emocional — Kahneman/Tversky)
camada: 1 (regra) + 2 (calibração mediana)
```
Pré-requisitos:
- Detectar `target` planejado da operação (ordem cancelada do lado oposto sem Preço Stop, dentro do bracket).
- Hoje o parser registra a ordem cancelada em `cancelledOrders[]`, mas **não classifica** como "alvo planejado". Falta heurística de classificação.

### 3.6 — Bracket criado APÓS execução de entrada — **AUSENTE**

Caso trade #1: entry executou às 10:44:46, bracket de proteção criado às 10:44:52 (+6s). Detector trivial assumindo que estamos comparando timestamps:
```
flag: BRACKET_POST_ENTRY
condição:
  - timestamp_criação_de_alguma_ordem_de_proteção > timestamp_execução_da_entrada
severidade: HIGH (gestão de risco)
camada: 1
```

Já temos `entryTime` (filledAt da primeira entrada) e `submittedAt` de cada ordem cancelada/protetiva — só falta o engine.

### 3.7 — Viés direcional contra regime — **AUSENTE (Layer 2)**

Requer dado de regime do dia (close-open, EMA20, MACD, ou contexto externo). Camada 2 estatística. Esforço maior — recomendo adiar até pipeline de market data estabilizado (issue futura).

---

## Parte 4 — Issues propostas (sem código)

Ordem por prioridade:

### Issue A (CRÍTICA) — fix bracket OCO LIMIT + stop loss vs stop de ganho

**Título:** `fix: bracket OCO da Clear (LIMIT com Preço Stop) + distinção stop loss vs stop de ganho`

**Body:**
- Reverter parcialmente regressão de #208: ordem com `Preço Stop` preenchido E `Lado` oposto à posição da operação volta a ser candidata a `stopOrder`.
- Diferenciador entry vs proteção: passar a aceitar contexto da operação (lado da posição) na classificação. Implementação: mover `isStopOrder` para fase de associação (`associateNonFilledOrders`) onde o lado da posição já é conhecido, em vez de decidir no parsing isolado.
- Adicionar campo derivado `stopSemantic = 'STOP_LOSS' | 'STOP_GAIN' | null` baseado em (lado da posição × Preço Stop relativo à entrada média).
- Garantir que `STOP_TAMPERING` / `PARTIAL_SIZING` continuem ignorando ordens entry SuperDOM (lado igual à posição).
- Tests: regression para os 4 trades do CSV de referência (`Temp/040526-ORDER.csv`) — esperado: trade #1 com `stopSemantic = STOP_GAIN` e `hasRealStopLoss = false`; trades #2/#3/#4 com `stopSemantic = STOP_LOSS` e `hasRealStopLoss = true`.

**Severidade:** CRÍTICA. Hoje produz falso positivo de "trade protegido" e falso negativo de "trade sem stop". Afeta compliance score, SHADOW behavior, e gates de promoção de maturidade.

**Chunks:** CHUNK-10 (escrita) + CHUNK-04 (leitura).

### Issue B (ALTA) — Detector NO_STOP_LOSS_AT_ENTRY

**Título:** `feat: detector trade sem stop loss configurado simultaneamente à entrada`

Depende de Issue A.

**Body:**
- Definir `noStopLossAtEntry = true` quando: nenhuma ordem com `stopSemantic = STOP_LOSS` foi criada em `[entryTime - 30s, entryTime + 30s]`.
- Severidade HIGH em compliance.
- Cruzar com flag composta com Issue C (`bracket_post_entry`).
- Schema: nenhum campo novo (compute on-the-fly, padrão Opção C de #208).

**Chunks:** CHUNK-05 + CHUNK-10.

### Issue C (ALTA) — Detector BRACKET_POST_ENTRY

**Título:** `feat: detector bracket criado após execução da entrada`

**Body:**
- Trigger: `min(stopOrders[].submittedAt, alvosCancelados[].submittedAt) > entryFill.filledAt`.
- Severidade HIGH.
- Composição com Issue B: `bracket_post_entry AND no_stop_loss_at_entry` é a pior combinação.

**Chunks:** CHUNK-10 (escrita).

### Issue D (MÉDIA) — Detector RR_PLANNED_BELOW_THRESHOLD

**Título:** `feat: flag RR planejado abaixo do threshold (default 1.5)`

**Body:**
- Calcular `rrPlanned` na criação do trade a partir de `entry`, `target` e `stopTrig`.
- Threshold configurável por aluno (`student.rrThreshold`, default 1.5).
- Cruzar com win rate empírico do setup (Layer 2): se `rrPlanned < 1.5 AND winRate < 1/(1+rr)` → flag EV-negativa.
- Severidade HIGH operacional.

**Chunks:** CHUNK-04 + CHUNK-05.

### Issue E (MÉDIA) — Detector EARLY_EXIT_UNDER_VALID_HYPOTHESIS

Depende de Issue A (precisa identificar alvo planejado vs stop).

**Body:**
- Classificar saída como ALVO / STOP / MANUAL via comparação com ordens canceladas do bracket.
- Detectar `exit_pts < 0.3 × planned_reward AND hold_time < 0.5 × mediana_aluno`.
- Layer 2 calibra mediana do aluno (mínimo N=20 trades positivos).

**Chunks:** CHUNK-06 (emocional) + CHUNK-10.

### Issue F (BAIXA) — slippage como sinal contrarian (Layer 2)

**Body:**
- Coletar `entrySlipPts` em todo trade reconstruído (parser já tem `priceLimit` e `avgFillPrice` separados).
- Análise estatística Layer 2 — relatório por aluno com correlação slippage × outcome.
- Não criar flag binária ainda — primeiro validar a hipótese empiricamente em N≥30.

**Chunks:** CHUNK-04 + (futuro) CHUNK-11.

### Issue G — refinar `RAPID_REENTRY_POST_STOP` com proximidade de preço

**Body:**
- Adicionar critério `|currEntryPrice - prevEntryPrice| < tolerance` (default 50 pts WIN, 5 pts ES — derivado de tickerRule).
- Severity LOW quando preço afasta da hipótese invalidada (já é improvável); MEDIUM quando preço está dentro da tolerância.
- Schema: nenhum (já tem `entryPrice` em ambos trades).

**Chunks:** CHUNK-06.

### Issue H — Diretional bias vs regime (Layer 2, defer)

Backlog futuro — esperar pipeline de market data estabilizado.

---

## Parte 5 — Recomendação priorizada

Os 3 próximos a implementar, em ordem:

1. **Issue A** — fix bracket OCO + semântica stop loss/ganho. **Prerequisite** para todas as outras (Issues B, C, E dependem). Sozinha já elimina bug crítico de classificação. Esforço médio (refactor isStopOrder + novo campo `stopSemantic`).

2. **Issue B** — `NO_STOP_LOSS_AT_ENTRY`. Maior impacto em compliance (ground truth: 1/4 trades da sessão real estavam descobertos sem o sistema flagrar). Depende de A. Esforço baixo (regra determinística sobre output do parser corrigido).

3. **Issue C** — `BRACKET_POST_ENTRY`. Combinada com B detecta o pior cenário de gestão de risco. Esforço baixo (timestamp comparison). Pode ir junto com B no mesmo PR se cabível.

Issues D/E/F/G são valor incremental e podem ser priorizados depois que A+B+C estabilizem. Issue H fica adiada.

---

## Apêndice — Tabela de cobertura dos 7 detectores

| Detector | Existe? | Layer | Status | Issue proposta |
|---|---|---|---|---|
| 3.1 trade sem stop loss real | Não | 1 | Ausente | B |
| 3.2 revenge directional reentry | Sim | 1 | Parcial (faltam filtros) | G (refinamento) |
| 3.3 RR planejado < 1 | Quase | 1+2 | Implícito em compliance | D |
| 3.4 slippage como sinal | Não | 2 | Ausente | F |
| 3.5 early exit hypothesis válida | Não | 1+2 | Ausente | E |
| 3.6 bracket post-entry | Não | 1 | Ausente | C |
| 3.7 directional bias vs regime | Não | 2 | Ausente | H (defer) |

**Bug crítico bloqueante:** A (semântica do parser de stop) — sem isso, B/C/E quebram em runtime.
