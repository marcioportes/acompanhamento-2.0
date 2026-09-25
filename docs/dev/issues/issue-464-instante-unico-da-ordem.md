# Issue 464 — fix: instante único da ordem

> **Branch:** `fix/issue-464-instante-unico-da-ordem`
> **Aberto em:** 25/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.8
> **Épico:** #462 (Fase 1)

## Autorização

- [x] Mockup: **não se aplica** (pipeline, sem UI)
- [x] Memória de cálculo: não se aplica (não há fórmula; é resolução de instante)
- [x] Marcio autorizou em 25/09/2026, na aprovação do plano do épico #462
- [x] Gate Pré-Código liberado

## Context

O instante da ordem é resolvido em pelo menos seis lugares. A mesma defasagem de fuso já foi corrigida quatro vezes (#296, #375, #388, #449). O harness do #463 mostrou que a operação aberta grava `entryTime` em `Z`. O export "ordens recentes" (sem as linhas de execução) inverte 23 operações do Italo, porque o empate no mesmo segundo é resolvido pela ordem das linhas do arquivo.

## Spec

Ver o issue #464.

## Phases

- A1 — helper único: `functions/shared/orderInstant.js` mais o espelho ESM `src/utils/orderInstant.js`, com paridade testada
- A2 — cópias removidas: `orderCorrelation`, `orderReconstruction`, `executionBehaviorEngine` e seu mirror, `orderCrossCheck`, `planCoverage`
- A3 — operação aberta passa a gravar o offset do lote; `offsetDasOperacoes` deixa de depender da primeira operação
- A4 — execução sem evento usa a "Última Atualização"; empate no mesmo segundo nunca é resolvido pela ordem do arquivo
- A5 — `orders` gravada com offset; o leitor aceita os dois formatos

## Sessions

- `task 01 [abertura] commit 19ff26e8 ok`
- `task 02 [A1-A5] ok — 5.291 testes em UTC e em BRT, 312 em functions, build ok. Italo: 23 → 0 lados invertidos, 64/64 operações da corretora`

## Shared Deltas

- `src/version.js`: consumir a reserva da v1.92.8
- `docs/registry/versions.md`: marcar a 1.92.8 como consumida
- `docs/registry/chunks.md`: liberar o CHUNK-10 e o CHUNK-06
- `CHANGELOG.md`: entrada `[1.92.8]`
- `docs/PROJECT.md`: encerramento

## Decisions

- DEC-464-01 — ids e chaves de `orders` não mudam: a chave tira o offset do lote; o id é calculado a partir do staging ingênuo
- DEC-464-02 — cancelamento sem evento usa "Última Atualização", pelo mesmo motivo da execução
- DEC-464-03 — empate no mesmo instante é resolvido pela hora de envio e depois pelo id da corretora, nunca pela ordem do arquivo
- DEC-464-04 — deploy das CFs (`linkOrdersToCreatedTrade`, `purgeOrphanOrders`) antes do cliente

## Chunks

- CHUNK-10 (escrita): parser, reconstrução, correlação, gravação de `orders`
- CHUNK-06 (escrita): `executionBehaviorEngine` e o mirror
