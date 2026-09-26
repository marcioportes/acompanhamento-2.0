# Issue 475 — fix: trade protegido acusado de "sem stop"; stop movido vira pendência

> **Branch:** `fix/issue-475-stop-movido-pendencia`
> **Aberto em:** 26/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.13

## Autorização

- [x] Mockup: detalhe do trade de 24/09 (abaixo)
- [x] Memória de cálculo: sem stop, com proteção nas ordens do trade (`protectiveLegsOf` > 0) → `STOP_A_INFORMAR` (pendência); sem proteção → `TRADE_SEM_STOP` (violação)
- [x] Marcio autorizou em 26/09/2026: *"sim, abre a issue e faz"*
- [x] Gate Pré-Código liberado

## Mockup — 24/09

```
Ordens da Corretora (8)   🛡 Protegido o tempo todo
Comportamento do trade
  ESTA OPERAÇÃO
  ┆ 📋 PENDÊNCIA (âmbar)
  ┆ Stop movido durante a operação — informe o stop inicial
```

Não aparece mais o bloco "Violações".

## Phases

- A1 — regra única `stopFlagOf` (`src/utils/stopFlag.js` e o espelho em `functions/shared/`)
- A2 — CF: `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance` e `finalizeOrderImport` (este atualiza o aviso depois de ligar as ordens)
- A3 — consumidores de `redFlags` passam a ignorar a pendência:
  - compliance e ciclo;
  - gates de maturidade;
  - Torre;
  - `quebrouPlano`/`violouPlano`;
  - notificação de RED_FLAG
- A4 — `BehaviorPanel`: bloco "Pendência" em âmbar
- A5 — `scripts/issue-475-stop-pendencia.mjs`: recálculo dos trades gravados (dry-run por padrão; discutido intocado)

## Sessions

- `task 01 [abertura] commit 48518f4e ok`
- `task 02 [A1-A5] ok`

## Limitações conhecidas

- Na criação do trade pelo import, o mentor ainda pode receber a notificação "Red Flags (1)" antes de `finalizeOrderImport` ligar os stops. O aviso é corrigido logo depois, mas a notificação já foi enviada.
- Trade perdedor sem stop continua sem aviso (stop implícito), como antes.

## Shared Deltas

- `src/version.js`, `docs/registry/*`: v1.92.13; liberar o CHUNK-05
- `CHANGELOG.md`, `docs/PROJECT.md`, `docs/decisions.md` (DEC-475-01)

## Decisions

- DEC-475-01 — sem stop comprovado, mas com proteção nas ordens = pendência para informar, não violação

## Chunks

- CHUNK-05 (escrita); CHUNK-10 e CHUNK-04 (leitura)
