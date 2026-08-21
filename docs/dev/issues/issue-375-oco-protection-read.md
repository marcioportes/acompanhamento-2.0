# Issue #375 — fix: proteção cancelada pelo OCO lida como "sem stop"

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado
- [x] Memória de cálculo apresentada
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado

## Context

Trade WINV26 LONG 10 de 21/08/2026 (entradas 174.050 e 174.010 às 11:25, saída 174.290 às 11:27, +R$ 520) tinha proteção: duas pernas SELL 173.755 de 5 contratos, canceladas às 11:27:51 pelo OCO quando a saída no alvo executou. O painel exibiu "Sem stop", o motor emitiu `UNPROTECTED_SIZE` HIGH (que trava progressão de estágio) e o confronto emocional imprimiu a palavra `null` na tela.

Três leituras diferentes das mesmas duas ordens, nenhuma correta.

**Regra de negócio (Marcio, 21/08/2026):** cancelar o stop não é o problema. O problema é a posição **ficar sem stop enquanto está aberta**. Cancelar e criar outra é condução de posição — o sistema precisa **mostrar** isso, não acusar. O que acusa é o intervalo de tempo em que havia contratos abertos e nenhuma proteção cobrindo.

## Spec

Ver issue body no GitHub: #375.

## Mockup

### Painel "Ordens da Corretora" — o trade de referência

Hoje:

```
Ordens da Corretora  6     🛡️✗ Sem stop
Cancel   SELL  173755  5  CANCELLED  21/08, 11:27:51
Entrada  BUY   174050  5  FILLED     21/08, 11:25:15
Cancel   SELL  173755  5  CANCELLED  21/08, 11:27:51
Entrada  BUY   174010  5  FILLED     21/08, 11:25:18
Saída    SELL  174290  5  FILLED     21/08, 11:27:51
Saída    SELL  174290  5  FILLED     21/08, 11:27:51
```

Proposto:

```
Ordens da Corretora  6     🛡️✓ Protegido o tempo todo
Entrada  BUY   174050  5  FILLED           21/08, 11:25:15
Entrada  BUY   174010  5  FILLED           21/08, 11:25:18
Stop     SELL  173755  5  ativa até a saída  21/08, 11:25:15
Stop     SELL  173755  5  ativa até a saída  21/08, 11:25:18
Saída    SELL  174290  5  FILLED           21/08, 11:27:51
Saída    SELL  174290  5  FILLED           21/08, 11:27:51
```

Linha de proteção — o que a coluna de status diz, e o que cada caso significa:

| Status na linha | Quando | Leitura |
|---|---|---|
| `executada` | a proteção disparou | o stop fez o trabalho dele |
| `ativa até a saída` | cancelada junto com a saída (OCO) | protegeu do começo ao fim — desfecho normal |
| `substituída por 173.900 ↑` | cancelada e outra proteção entrou no lugar | **condução de posição** — informa, não acusa; a seta mostra se apertou ou afrouxou |
| `retirada — 1m22s sem proteção` | cancelada e nada entrou no lugar | a posição ficou nua desse instante até a saída |

Badge do cabeçalho, três estados:

- 🛡️✓ **Protegido o tempo todo** — nunca houve contrato aberto sem cobertura
- 🛡️⚠ **Sem proteção por 1m22s (10 contratos)** — houve janela nua; mostra a maior
- 🛡️✗ **Sem stop** — nunca houve proteção nenhuma

### Faixa de exposição (novo, dentro do painel)

Quando houve janela nua, uma faixa abaixo da tabela mostra onde:

```
11:25:15 ├────────── protegido ──────────┤ 11:26:29
11:26:29 ├══════ SEM PROTEÇÃO 1m22s ═════┤ 11:27:51 (saída)
```

É o fato que interessa: quanto tempo, quantos contratos, em que trecho.

### Confronto emocional

Hoje o card diz: *"Você declarou 'Calmo', mas a execução sugere **null**."*

O confronto compara **a emoção que o aluno declarou na entrada** com **a emoção que a execução sugere**. Alguns padrões carregam emoção — saída antecipada → Medo, reentrada rápida → Vingança. "Posição sem proteção" hoje não carrega nenhuma (`emotionMapping: null`, `behavioralTaxonomy.js:152`) e aparece no painel com o rótulo `gate`. O sistema elegeu esse padrão como *a emoção do trade*, foi buscar o nome, não achou, e imprimiu `null` na tela.

Duas correções, uma de robustez e uma de conteúdo.

**Robustez:** padrão sem emoção nunca é usado no confronto. Sob nenhuma condição a copy sai com `null`.

**Conteúdo — a emoção de tirar a proteção (Marcio, 21/08/2026).** Ficar sem proteção não é um fato só. São dois, com psicologias opostas:

| caso | o que aconteceu | emoção | severidade |
|---|---|---|---|
| **nunca protegeu** | entrou e não colocou stop nenhum | nenhuma — é processo, não emoção | HIGH, gate |
| **retirou com posição viva** | tinha stop, tirou, não recolocou | **Esperança** (`HOPE`) | HIGH, gate |
| **retirou e ainda aumentou** | tirou o stop e acrescentou contratos contra a posição | **Negação** (`DENIAL`) | HIGH, gate |

Descrição de Marcio do que move o segundo e o terceiro caso: *"quem tira a proteção não quer ser stopado, quer estar certo e aceita o loss maior em função de acertar, mesmo que aumente a posição inadvertidamente até sair no 0x0"*.

Por que não Raiva/Vingança: vingança é reação a prejuízo **já consumado** — o aluno levou o stop e revida no trade seguinte. É o que `RAPID_REENTRY` e o cluster de vingança já medem. Tirar o stop é o oposto no tempo: o prejuízo ainda **não** foi aceito, e é justamente para não aceitá-lo que a proteção sai. A taxonomia já nomeia essas duas: `LATE_EXIT → HOPE` ("segurei esperando voltar") e `AVERAGING_DOWN → DENIAL` ("não estou errado, vou aumentar"). Tirar a proteção é o gesto que abre exatamente essa sequência — mesma família, mesmo vocabulário, sem inventar emoção nova nem sujar o agregado de Vingança com trades que não tiveram perda anterior.

"Negligência" fica onde já está: é a leitura de **processo**, e é o que o gate diz quando trava a progressão de estágio. Emoção e processo são canais diferentes sobre o mesmo fato.

## Memória de Cálculo

### Inputs

- `orders`: `side`, `status`, `stopPrice`, `limitPrice`, `price`, `filledPrice`, `quantity`, `submittedAt`, `cancelledAt`, `filledAt`, `isStopOrder`, `externalOrderId`, `correlatedTradeId`
- `trades`: `side`, `qty`, `entry`, `entryTime`, `exitTime`
- `OCO_TOLERANCE_MS = 2000` (`executionBehaviorEngine.js:221`), já existente

### 1. É proteção? (definição única, já vigente no motor)

```
entryRef = limitPrice da 1ª ordem de entrada (fallback price → filledPrice → trade.entry)
oposto   = LONG ? SELL : BUY
preço    = stopPrice ?? limitPrice ?? price

proteção = isStopOrder
         || (side === oposto && (LONG ? preço < entryRef : preço > entryRef))
```

Vale em qualquer `status`, CANCELLED incluído. É `protectiveLegsOf` (`executionBehaviorEngine.js:264`); o painel passa a consumir a mesma regra em vez da própria.

### 2. Linha do tempo da posição (o coração do fix)

Substitui a foto única no instante da saída por uma linha do tempo. Dois degraus, ambos derivados das ordens:

```
aberto(t)   = Σ qty das entradas executadas até t − Σ qty das saídas executadas até t
coberto(t)  = Σ qty das pernas de proteção vivas em t
              perna viva em t  ⇔  submittedAt ≤ t < (cancelledAt ?? filledAt ?? exitTime)
```

Percorre os instantes de mudança (cada fill de entrada, cada fill de saída, cada criação e cada cancelamento de proteção) e mede:

```
nu(t)     = max(0, aberto(t) − coberto(t))
janela    = intervalo maximal com nu(t) > 0
```

**Janelas com duração ≤ `REPLACEMENT_TOLERANCE_MS` não contam.** É a troca de ordem: o aluno cancela 173.755 e cria 173.900, e a corretora leva alguns instantes entre uma e outra. Valor: **20s** (Marcio, 21/08/2026 — tempo real de trocar uma ordem na plataforma). Abaixo disso é substituição; acima é exposição.

O cancelamento no alvo já cai fora sozinho: a perna morre no mesmo instante da saída, quando `aberto(t)` já é zero. Não precisa de regra especial.

### 3. `UNPROTECTED_SIZE` passa a medir a janela

Hoje: foto no instante da saída — `uncovered = qty − Σ pernas vivas na saída`. Emite sempre que a foto der descoberto, sem saber por quanto tempo.

Proposto: emite quando existe janela nua acima da tolerância. Evidência ganha o que faltava:

```
maiorJanela: { inicio, fim, duracaoMs, contratos }
tempoNuTotal: soma das janelas
proporcaoNua: tempoNuTotal / duração da posição
nuncaProtegido: true quando não houve proteção em instante nenhum
```

Severidade sai do binário: `nuncaProtegido` ou janela cobrindo a maior parte da posição → HIGH (trava estágio, como hoje); janela curta e isolada no meio de uma posição protegida → MEDIUM, informativa. Entrada escalonada sem cobrir os novos contratos — o cenário de referência do #357, 5 protegidos de 8 — continua HIGH: `nu(t) = 3` durante todo o resto da posição.

### 4. Emoção do `UNPROTECTED_SIZE` — derivada da janela

`emotionMapping` deixa de ser fixo no padrão e passa a sair do que a linha do tempo mostra:

```
nuncaProtegido                          → emoção nenhuma (gate puro)
retirou proteção com posição viva       → HOPE
retirou e aumentou posição depois       → DENIAL
```

"aumentou depois" = existe fill de entrada com timestamp posterior ao início da janela nua. O `AVERAGING_DOWN` continua emitindo em separado quando for o caso — não é o mesmo evento, é o vizinho.

Padrão que resolver para emoção nenhuma fica fora do confronto emocional (e só dele): continua na lista de padrões, continua alimentando gate e score.

### 5. Substituição de proteção vira informação, não alerta

Perna cancelada com outra entrando dentro da tolerância → par `substituída → substituta`. Registra direção comparando a distância até a entrada:

```
apertou  = nova proteção mais perto da entrada  (menos risco)
afrouxou = nova proteção mais longe da entrada  (mais risco)
```

Vai para o painel como `substituída por 173.900 ↑`. **Não emite evento comportamental por si só** — mover stop é condução normal (é o que o #357 já concluiu ao aposentar o `STOP_TAMPERING`). O que continua sendo medido é o risco em dinheiro contra o RO, que é o `RISK_OVER_RO`, intocado aqui.

### 6. Identidade de ordem no dedup

Hoje (`protectiveLegsOf:299`): `side|preço|qtd|submittedAt`. Duas pernas irmãs de entrada escalonada colidem quando a corretora as cria no mesmo segundo, e o dedup apaga proteção real.

Proposto: `makeOrderKey(order)` (`orderKey.js:23`) — a SSoT já usada por staging, ingest e confirmação: `eid:<externalOrderId>` quando existe, composto como fallback. Perna irmã tem `ClOrdID` distinto; cópia de reimportação tem o mesmo. Preserva o anti-duplicata do #362 sem apagar proteção.

Desde o #362 o doc em `orders` já tem id derivado dessa chave, então duplicata de reimportação não chega mais ao Firestore — o dedup em memória cobre só docs anteriores àquele fix.

### Exemplo numérico — o trade de referência

| instante | evento | aberto | coberto | nu |
|---|---|---|---|---|
| 11:25:15 | entrada 5 + proteção 5 | 5 | 5 | 0 |
| 11:25:18 | entrada 5 + proteção 5 | 10 | 10 | 0 |
| 11:27:51 | saída 10, pernas canceladas | 0 | 0 | 0 |

Nenhuma janela nua → sem `UNPROTECTED_SIZE` → sem gate → sem confronto emocional falso. Badge: **Protegido o tempo todo**.

| | hoje | com o fix |
|---|---|---|
| pernas de proteção | 2 → 1 após dedup | 2 |
| leitura | descoberto 5 de 10 na saída | zero segundo nu |
| evento | `UNPROTECTED_SIZE` HIGH (trava estágio) | nenhum |
| confronto | "execução sugere null" | sem confronto |
| badge | Sem stop | Protegido o tempo todo |

### Casos limites

- **ordem sem `externalOrderId`** (parser genérico, docs pré-#362) → fallback composto do `makeOrderKey`
- **trade aberto** (`exitTime` ausente) → linha do tempo até agora; janela nua em curso conta com `fim = null`
- **proteção criada antes da entrada executar** → só passa a cobrir quando há contrato aberto; ordem anterior à posição é tentativa abortada (#369), não proteção
- **saída parcial** → `aberto(t)` cai e a cobertura remanescente pode passar a sobrar; sobra não vira crédito, `nu` tem piso zero
- **proteção maior que a posição** → cobertura limitada a `aberto(t)` (o cap de sanidade de hoje, preservado)
- **trade manual sem ordens correlacionadas** → painel não renderiza e detector não afirma nada (comportamento atual, mantido)
- **timestamps com resolução de minuto** (CSV low-res) → janela menor que a resolução do arquivo é inconclusiva; não emite

## Phases

- A1 — probe: confirmar em produção se as duas pernas do trade de referência têm `submittedAt` idêntico e `externalOrderId` distinto
- A2 — `protectiveLegsOf`: dedup por `makeOrderKey`; testes com perna irmã e com cópia de reimportação
- A3 — linha do tempo de proteção: helper puro `protectionTimeline(trade, orders)` → janelas nuas + substituições
- A4 — `detectUnprotectedSize` passa a consumir a linha do tempo; severidade por duração/proporção
- A5 — paridade `functions/maturity/executionBehaviorMirror.js`
- B1 — `TradeOrdersPanel`: status de proteção pelos quatro casos + badge de três estados + faixa de exposição
- B2 — confronto emocional: padrão sem emoção fora do confronto, zero `null` na copy (front + `functions/behavior/buildBehaviorProfile.js`)
- B3 — emoção do `UNPROTECTED_SIZE` derivada da janela (HOPE / DENIAL / nenhuma) + taxonomia
- C1 — recompute dos `behaviorProfile` afetados (gates falsos gravados seguem travando estágio)

## Sessions

## Shared Deltas

- `docs/PROJECT.md` — bump + registro do fix
- `src/version.js` — bump v1.83.20
- `docs/registry/versions.md` — marcar v1.83.20 consumida
- `docs/registry/chunks.md` — liberar CHUNK-10 e CHUNK-11
- `CHANGELOG.md` — nova entrada `[1.83.20] - 21/08/2026`

## Decisions

## Chunks

- CHUNK-10 (escrita) — `TradeOrdersPanel`, leitura de ordens no painel
- CHUNK-11 (escrita) — `protectiveLegsOf`, `detectUnprotectedSize`, linha do tempo, confronto emocional, espelho em `functions/`
