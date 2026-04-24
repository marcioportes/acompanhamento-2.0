# Issue #181 — refactor: consolidação documental para sustentabilidade de tokens

## Context
`CLAUDE.md` + `docs/PROJECT.md` inchados (7,4K + 55K tokens). 88% de espelhamento entre os dois. Write-hot (CHANGELOG §12 = 738 linhas) invalida prompt cache constantemente. Loops autônomos consumindo volume incompatível com plano PLUS — risco de cancelamento.

**Objetivo:** reduzir consumo de tokens em 60-75% preservando integralmente invariantes, anti-patterns, decisões, protocolos e controles.

## Spec
Ver issue GitHub #181 e plano em `/home/mportes/.claude/plans/curious-soaring-crystal.md`.

## Phases
- 0 Setup (issue + lock main + worktree) — **done**
- 1A Extrair read-static (invariants, anti-patterns, decisions, milestones, tech-debt, chunks)
- 1B Extrair protocolos (opening, closing, autonomous, parallel)
- 1C Agregados novos (cloud-functions, firestore-schema)
- 1D Extrair write-hot (CHANGELOG raiz, registry/chunks, registry/versions)
- 1E Reescrever PROJECT.md residual (~250 linhas)
- 2 Reescrever CLAUDE.md como índice (~200 linhas)
- 3 Templates (issue-control, worker-report)
- 4 Atualizar referências cruzadas (`PROJECT.md §N` → anchors)
- 5 Script `scripts/archive-issue.sh` + wire em closing.md
- 6 Dogfood + validação + PR

## Sessions
- 24/04/2026 — Fase 0 (lock main 2bf8e1e8, worktree criado, issue #181, control file)
- 24/04/2026 — Fase 1A (read-static: invariants 193L, decisions 99L, milestones 135L, anti-patterns 32L, tech-debt 34L, chunks 83L, registry/chunks 13L)
- 24/04/2026 — Fase 1B (protocols: opening 163L, closing 78L, autonomous 355L, parallel 65L)
- 24/04/2026 — Fase 1C (agregados: cloud-functions 34L, firestore-schema 51L)
- 24/04/2026 — Fase 1D (write-hot: CHANGELOG.md raiz 743L, registry/versions 7L)
- 24/04/2026 — Fase 1E (PROJECT.md reescrito 2161 → 287 linhas)
- 24/04/2026 — Fase 2 (CLAUDE.md reescrito 450 → 159 linhas como índice)
- 24/04/2026 — Fase 3 (templates: issue-control 38L, worker-report 65L)
- 24/04/2026 — Fase 4 (refs cruzadas: arquivos encerrados saíram do path via archive, 0 refs quebradas ativas)
- 24/04/2026 — Fase 5 (scripts/archive-issue.sh + wire em closing.md + --all-closed arquivou 9 issues em docs/dev/archive/2026-Q2/)
- 24/04/2026 — Fase 6 (validação R1 todos arquivos ≤600L; CLAUDE 159≤200; 22 INV + 8 AP + 17 CHUNK com anchors ok)

## Shared Deltas
_(diffs propostos pro integrador aplicar no main; o próprio refactor é a "delta" — será aplicado inteiro via merge)_

## Decisions
_(IDs DEC-AUTO-181-NN conforme surgem)_

## Chunks
- CHUNK-META (docs) — refactor documental, não toca código
