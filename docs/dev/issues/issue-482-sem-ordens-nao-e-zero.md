# Issue #482 — fix: Passo 2 do fechamento mostra "Stop deslocado 0" sem ordens e avisa em jargão

> **Branch:** `fix/issue-482-sem-ordens-nao-e-zero` · **Aberto em:** 01/10/2026 · **Versão reservada:** 1.92.16

## Autorização

- [x] Mockup — texto abaixo (mudança de um aviso e de um quadro; estrutura da tela intacta).
- [x] Memória de cálculo — trivial: "sem ordens" = nenhuma ordem com `correlatedTradeId` em trade do ciclo.
- [x] Marcio autorizou (01/10/2026): *"corrige"* — sobre o "Stop deslocado 0" não medido e o aviso em jargão.
- [x] Gate Pré-Código liberado

## Context

No Passo 2 do fechamento, sem ordens importadas, o quadro "Stop deslocado" mostrava `0` igual aos quadros medidos, e o aviso dizia "Sem orders ingestadas… STOP_TAMPERING e RAPID_REENTRY… ingestão por CSV". A tela é a mesma do aluno. O aviso também olhava o plano inteiro, não o ciclo.

## Spec

Ver issue body: #482.

## Mockup

```
Padrões observados
⚠ Este ciclo não tem ordens importadas. Stop deslocado, reentrada após stop, perseguição de
  preço, hesitação e breakeven cedo só aparecem com as ordens da corretora — aqui eles não
  foram medidos. Tilt, vingança e excesso de trades vêm dos trades e estão medidos.

[ TILT 0 ] [ VINGANÇA 0 ] [ EXCESSO DE TRADES 0 ] [ STOP DESLOCADO —  sem ordens ]
```

## Phases

- A1 — `Step2Notice`: `hasCycleOrders`, aviso, quadro; testes.

## Sessions

- `A1 01/10/2026 ok`

## Shared Deltas

- `src/version.js` — bump v1.92.16
- `docs/registry/versions.md` — marcar v1.92.16 consumida
- `docs/registry/chunks.md` — liberar CHUNK-03
- `CHANGELOG.md` — entrada `[1.92.16] - 01/10/2026`
- `docs/PROJECT.md` — encerramento

## Decisions

- DEC-482-01 — no Passo 2, "sem ordens" é do ciclo (nenhuma ordem ligada a trade dele) e padrão não medido aparece como "—", nunca como zero. Os números gravados no fechamento não mudam.

## Chunks

- CHUNK-03 (escrita) — Passo 2 do fechamento de ciclo.
