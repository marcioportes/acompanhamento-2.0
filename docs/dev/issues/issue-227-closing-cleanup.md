# Issue #227 — refactor: limpar resíduos doc↔script no flow de encerramento

## Autorização

- [x] Mockup — N/A (mudança em script + docs, sem UI)
- [x] Memória de cálculo — N/A (sem fórmula)
- [x] Marcio autorizou — pediu pra atacar em 01/05/2026 após crosscheck (chat: "sim, ela é candidata a modo autonomo?" → modo interativo escolhido)
- [x] Gate Pré-Código liberado

## Context

Crosscheck pós-#225 detectou 3 inconsistências funcionais e 2 cosméticas entre `cc-close-issue.sh` e a doc do §4.3. Política do refactor #199 (Fase 2.4) mudou de "arquivar control doc" para "deletar" mas resíduos ficaram. Issue #225 introduziu gates novos que `closing-manual.md` não absorveu.

## Spec

Ver issue body no GitHub: #227.

## Phases

- F1 — Remover `scripts/archive-issue.sh` (script órfão, política `git rm` é a vigente).
- F2 — Atualizar `docs/PROJECT.md:147` para refletir delete via `cc-close-issue.sh` (substitui menção a `archive-issue.sh`).
- F3 — Atualizar `docs/protocols/closing-manual.md` com 2 seções novas: pré-deploy CF e cross-check anti-órfã DEC.
- C1 — Renumerar etapas em `docs/protocols/closing.md` para casar com prints do script (`[0/8]`, `[0a/8]`, `[1/8]`…`[8/8]`); ou ajustar texto "8 etapas" para refletir 9 itens.
- C2 — Limpar comentário em `cc-close-issue.sh:95` ("Fix (issue #225 v2)" → "Fix (issue #225 — Parte D)").

## Sessions

_(preenchido durante execução)_

## Shared Deltas

- `scripts/archive-issue.sh` — `git rm` (F1).
- `docs/PROJECT.md` — 1 linha (F2).
- `docs/protocols/closing-manual.md` — 2 seções novas (F3).
- `docs/protocols/closing.md` — renumeração + ajuste de header (C1).
- `scripts/cc-close-issue.sh` — comentário limpo na linha 95 (C2).
- Sem `src/version.js` bump, sem reserva em `registry/versions.md`, sem CHUNK locks (precedente: #214/#216/#225).

## Decisions

- F1: deletar em vez de marcar "uso ad-hoc" — script foi rodado UMA vez (#181) e nunca mais; manter código morto polui repo. Se necessidade re-emergir, recover via `git log`.
- C1: alinhar doc ao script (não o contrário) — script é executável, doc é referência; números do script aparecem no terminal do operador, então é fonte primária visual.

## Chunks

Nenhum CHUNK de produto envolvido. Shared files + script de infra apenas.
