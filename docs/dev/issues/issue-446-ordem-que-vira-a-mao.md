# Issue #446 — fix: ordem que vira a mão é contada como um trade só, e inventa um que não existiu

> **Branch:** `fix/issue-446-ordem-que-vira-a-mao`
> **Aberto em:** 16/09/2026
> **Status:** 🟢 Autorizado
> **Versão reservada:** 1.92.1

## Autorização

- [x] Mockup — **não se aplica:** correção de regra pura, sem UI nova. As telas que consomem (Revisão de Operações, painel de ordens) não mudam de layout; mudam os números que recebem.
- [x] Memória de cálculo apresentada (16/09/2026), com o dia 09/09 rodado de ponta a ponta contra o Profit
- [x] Marcio autorizou (16/09/2026): *"então vai de a"* — escolha do caminho A para a ligação ordem→trade, depois da comparação de esforço e risco
- [x] Gate Pré-Código liberado

## Context

Uma ordem que atravessa o zero da posição (vende 10 estando comprado em 5) zera a posição e abre a oposta no mesmo instante. A reconstrução soma `+5 − 10 = −5`, a posição nunca zera, a operação não fecha ali, e a ordem seguinte — que era a **saída** — entra como **segunda entrada**.

O efeito não é só "não agrupou": some um trade real e nasce um que nunca existiu, com preço de entrada que é média de duas compras sem relação. No dia 09/09 o trade de +500 pontos desaparece dentro da operação anterior.

## Spec

Ver issue body no GitHub: #446.

## Mockup

Não se aplica (sem UI). Efeito visível: a Revisão de Operações passa a listar 4 operações no dia 09/09 onde hoje lista 3, e a de 14:28 aparece como venda de 5 com +500 pontos.

## Memória de Cálculo

### Inputs

| dado | caminho | uso |
|---|---|---|
| lado da ordem | `order.side` (`BUY`/`SELL`) | sinal do delta |
| quantidade executada | `order.filledQuantity ?? order.quantity` | módulo do delta |
| preço executado | `order.filledPrice` | preço das duas pernas (idêntico) |
| instante | `order.filledAt ?? order.submittedAt` | horário das duas pernas (idêntico) |
| posição corrente | `netPosition` (local do laço) | quanto da ordem fecha e quanto abre |

Nada novo é lido, nada é gravado. `origin: 'Inversão'` existe no documento mas **não** é usado: a regra é quantidade contra posição, e vale para qualquer corretora.

### Fórmula

No laço de posição líquida de `reconstructOperations`, para cada ordem com `delta = ±qty`:

```
atravessa = netPosition ≠ 0 ∧ sinal(delta) ≠ sinal(netPosition) ∧ |delta| > |netPosition|

se atravessa:
    qFecha = |netPosition|
    qAbre  = |delta| − |netPosition|
    perna A = { ...ordem, filledQuantity: qFecha }  → exits da operação corrente; fecha (netPosition = 0)
    perna B = { ...ordem, filledQuantity: qAbre  }  → entries da operação nova;  netPosition = sinal(delta) × qAbre
senão:
    comportamento atual (entrada adicional ou saída)
```

As duas pernas herdam preço, instante, ticker e `externalOrderId` do mesmo fill. A perna que **fecha** é a que carrega o vínculo com o trade (`correlatedTradeId`), conforme a decisão do caminho A.

### Casos limites

- **Virada exata** (`|delta| = |netPosition|`, ex.: vende 5 comprado em 5): não é travessia — fecha e pronto, comportamento atual.
- **Viradas em sequência** (vira e vira de novo): cada travessia parte de novo; a perna B de uma vira a posição aberta da próxima.
- **Travessia como última ordem do dia:** a perna B deixa operação aberta (`_isOpen: true`), tratada pelo bloco de operação incompleta que já existe.
- **Fills N×M:** a partição roda **depois** de `aggregateFills`, sobre a ordem lógica já somada — nunca sobre fill solto.
- **Stops e canceladas:** `associateNonFilledOrders` associa por intervalo de tempo; com duas operações no mesmo instante, a de 14:28:35 passa a ter um intervalo próprio. Conferir que o stop do bracket cai na operação certa.

### Exemplo numérico — 09/09/2026, WINV26, conta simulador

Posição comprada de 5 (compra 14:27:53 a 188.085). Chega venda de 10 a 188.045, `Origem = Inversão`.

| | hoje | com a regra |
|---|---|---|
| netPosition após a ordem | −5 (não fecha) | 0, depois −5 em operação nova |
| operação encerrada em 14:28:35 | nenhuma | LONG 5 · 188.085 → 188.045 · **−40 pts** |
| operação aberta em 14:28:35 | nenhuma | SHORT 5 · entrada 188.045 |
| fecho em 15:46:34 (compra 5 a 187.545) | vira 2ª **entrada** do LONG | saída do SHORT · **+500 pts** |
| resultado do dia | 3 ops: 25 · 1,67 · **+230 (inexistente)** | 4 ops: 25 · 1,67 · −40 · +500 |

Verdade de referência: CSV de performance do Profit do mesmo dia (`Res. Operação` R$ 25 / R$ 5 / −R$ 40 / R$ 500).

## Phases

- **A1** — regra de partição em `src/utils/orderReconstruction.js` + testes sintéticos (travessia, virada exata, viradas em sequência, travessia no fim do dia, travessia sobre fills N×M).
- **A2** — massa real como fixture: 09/09 (1 inversão) e 11/09 (4 inversões, uma de 50 contratos), com as operações conferidas contra o CSV de performance.
- **A3** — conferir `associateNonFilledOrders` com as operações novas (stop e canceladas na operação certa) e rodar a suíte completa.

## Sessions

- 16/09 — A1+A2: partição no laço de `orderReconstruction`, vínculo pela primeira escrita em `orderTradeLinks`, fixture `set-0911-inversao.csv` (09/09 + 11/09) e 16 testes novos.

## Achado fora de escopo — preço de execução de ordem com vários fills

Na operação de 135 contratos do 11/09 o Profit mostra −250,67 e a reconstrução dá −250. A diferença **não é do agrupamento** — as seis operações anteriores do dia batem exatas, e a saída dessa mesma operação também bate.

Causa: `parseProfitChartPro` preenche `filledPrice` com o preço do **primeiro evento de execução** (`if (!currentOrder.filledPrice && eventPrice)`), e só cai para `avgFillPrice` (`Preço Médio`) quando não há evento. Nas duas vendas de 50 contratos das 16:17:34 e 16:17:37 o arquivo traz `Preço Médio` 188.668,40 e 188.669,80, e o parser entrega 188.670 nas duas.

O próprio arquivo confirma qual é o certo: `Total Executado` 1.886.698,00 ÷ 50 ÷ 0,2 = 188.669,80.

Afeta qualquer ordem preenchida a mais de um preço, em qualquer dia — não só virada de mão. Fica registrado para virar issue própria; não entra aqui para não misturar dois defeitos no mesmo PR.

## Shared Deltas

- `src/version.js`: 1.92.1 (já reservada no main)
- `docs/registry/versions.md`: marcar 1.92.1 consumida
- `docs/registry/chunks.md`: liberar CHUNK-10
- `CHANGELOG.md`: entrada `[1.92.1]`
- `docs/PROJECT.md`: bump + parágrafo de encerramento **e linha na tabela de histórico**
- `docs/tech-debt.md`: `correlatedTradeId` escalar — a perna que abre fica sem apontador (medição: 12 arquivos de produção e 22 de teste leem o campo como escalar)

## Decisions

## Chunks

- CHUNK-10 (escrita) — `orderReconstruction`
- CHUNK-04 (leitura) — criação de trade a partir da operação
