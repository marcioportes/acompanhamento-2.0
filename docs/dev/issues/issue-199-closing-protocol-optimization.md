# Issue #199 — refactor: §4.3 encerramento agressivo + script + hook

## Autorização

- [x] Mockup: dispensado (refactor de tooling/docs, sem UI)
- [x] Memória: o próprio plano em `/home/mportes/.claude/plans/optimized-soaring-giraffe.md` (aprovado via ExitPlanMode 25/04/2026)
- [x] Marcio autorizou: aprovação do plano + auto mode
- [x] Gate Pré-Código liberado

## Context

§4.3 atual: 2 problemas convergentes — verbosidade redundante (175 KB de archives, 70-80 % duplicado com GitHub) + CC pula passos (improviso recorrente apesar de protocolo completo + memória dura). Solução: GitHub é SSoT do detalhe; local vira índice mínimo; encerramento via script orquestrador + Stop hook bloqueante.

## Spec

Plano completo: `/home/mportes/.claude/plans/optimized-soaring-giraffe.md`. Issue body GitHub: #199.

## Phases

- F1.1 — `docs/maturity-engine-spec.md` (extraído de #119)
- F1.2 — `docs/mentor-lock-spec.md` (extraído de #188)
- F3 — `scripts/cc-close-issue.sh` orquestrador (+ `--dry-run`)
- F4 — `~/.claude/hooks/check-closing.sh` + Stop hook em `~/.claude/settings.json`
- F6.1 — Reescrever `docs/protocols/closing.md` (~30 linhas)
- F6.1b — `docs/protocols/closing-manual.md` (backup do §4.3 atual)
- F6.2 — Memória nova `feedback_encerramento_via_script.md`
- F6.3 — Atualizar `feedback_worktree_no_encerramento.md` + `MEMORY.md`
- F5 — Apagar `docs/dev/archive/2026-Q2/issue-*.md`
- F-end — PR + smoke + dogfood (encerrar #199 via `cc-close-issue.sh`)

## Sessions

_(log linear; 1 linha/task)_

## Shared Deltas

- `docs/PROJECT.md` — bump v0.40.5 → v0.41.0 (refactor estrutural, paralelo #181)
- `docs/registry/chunks.md` — liberar CHUNK-META
- `CHANGELOG.md` — entrada novo formato (≤8 linhas) testando F2
- **NÃO bumpa** `src/version.js` — refactor docs+tooling não muda código de produto
- **NÃO consome** linha de `docs/registry/versions.md` — não há versão de produto reservada
- `docs/dev/issues/issue-199-*.md` — DELETADO no encerramento (não arquivado, testando F2.4)

## Decisions

- DEC-AUTO-199-01 — GitHub (issue + PR) é SSoT do detalhe de encerramento. Docs locais (CHANGELOG/PROJECT.md/version.js) viram índice ≤8 linhas com link para PR.
- DEC-AUTO-199-02 — Encerramento sempre via `./scripts/cc-close-issue.sh NNN`. Manual só em recovery (`closing-manual.md`).
- DEC-AUTO-199-03 — Memória técnica de feature complexa (memória de cálculo, decisões antecipadas, framework) migra para `docs/{tema}-spec.md` reusável; não reside em `docs/dev/archive/`.

## Chunks

- CHUNK-META (escrita) — refactor docs+tooling+protocolos
