# Issue 465 — fix: preço da ordem é a média das execuções; quantidade fracionária não zera calada

> **Branch:** `fix/issue-465-preco-medio-e-quantidade`
> **Aberto em:** 25/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.9
> **Épico:** #462 (Fase 2)

## Autorização

- [x] Mockup: não se aplica. A tela de erro do import só ganha o motivo escrito.
- [x] Memória de cálculo: preço = Σ(preço × qtd) / Σ qtd dos eventos "Trade". Sem evento, vale o "Preço Médio" da linha.
- [x] Marcio autorizou em 25/09/2026, na aprovação do plano do épico #462
- [x] Gate Pré-Código liberado

## Context

A DT-048 (antiga #448, cancelada): o parser usava o preço do primeiro fill. A quantidade `0,03` virava 0 e o arquivo inteiro era recusado com "0 ordens válidas", sem dizer o motivo.

## Phases

- A1 — `orderParsers`: `filledPrice` passa a ser a média ponderada dos eventos "Trade"; sem evento, vale o `avgFillPrice`
- A2 — `parseQty` lê o número no formato BR; `orderValidation` recusa quantidade fracionária com o motivo escrito
- A3 — `OrderImportPage`: quando nenhuma ordem é válida, a mensagem traz o motivo

## Sessions

- `task 01 [abertura] commit 6ad2223e ok`
- `task 02 [A1-A3] ok — harness: 11/09 16:17 passou a conferir (entrada removida da lista de falhas conhecidas); Eduardo 102/102 com a corretora; Italo com 2 diferenças de 1 pt`

## Limitação conhecida

O Italo tem 2 diferenças de 1 pt em ordens que viram a mão, num export sem eventos de execução. O "Preço Médio" da ordem mistura as duas pernas, e o arquivo não traz o preço de cada fill.

## Shared Deltas

- `src/version.js`: consumir a reserva da v1.92.9
- `docs/registry/versions.md`: marcar a 1.92.9 como consumida
- `docs/registry/chunks.md`: liberar o CHUNK-10
- `docs/tech-debt.md`: fechar a DT-048
- `CHANGELOG.md`: entrada `[1.92.9]`
- `docs/PROJECT.md`: encerramento

## Decisions

- DEC-465-01 — quantidade fracionária é recusada com o motivo escrito, e não aceita como contrato. O suporte fica no #453.

## Chunks

- CHUNK-10 (escrita)
