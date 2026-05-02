# Issue #225 — fix: cc-close-issue.sh — abort se DEC-AUTO órfã + backfill #221

> Plano aprovado em `/home/mportes/.claude/plans/enumerated-cooking-anchor.md`. Spec completa no body do issue #225 no GitHub.

## Autorização

- [x] Mockup — N/A (mudança em script + docs, sem UI)
- [x] Memória de cálculo — N/A (sem fórmula)
- [x] Marcio autorizou — plano aprovado via ExitPlanMode em 01/05/2026
- [x] Gate Pré-Código liberado

## Context

Encerramento #221 deixou `DEC-AUTO-221-01..03` órfãs em CHANGELOG/PR body, ausentes de `docs/decisions.md`. Causa: passo 3f do `cc-close-issue.sh` é opt-in via `.deccs-NNN.md` e faz skip silencioso. Conserta porta + backfill.

## Phases

- B1 — Patch `scripts/cc-close-issue.sh`: extrair menções `DEC-AUTO-NNN-XX`, validar contra `docs/decisions.md`, abort com mensagem clara se órfã.
- B2 — Test do script em cenário fictício (`#999` dummy).
- C1 — Atualizar `docs/protocols/closing.md` (§3 bullet 4 + exemplo de linha `.deccs-NNN.md`).
- C2 — Atualizar `docs/protocols/autonomous.md` (Fase 6 — Encerramento — bullet de criação do `.deccs`).
- A1 — Backfill `DEC-AUTO-221-01..03` em `docs/decisions.md`.

## Sessions

_(preenchido durante execução)_

## Shared Deltas

- `scripts/cc-close-issue.sh` — substituir bloco 3f (linhas 246–255).
- `docs/protocols/closing.md` — bullet 4 em §3.
- `docs/protocols/autonomous.md` — Fase 6 (Encerramento).
- `docs/decisions.md` — append 3 linhas (Parte A).
- Sem `src/version.js` bump, sem reserva em `registry/versions.md`, sem CHUNK locks (precedente: #214, #216).

## Decisions

- Abort em vez de auto-stub no script: placeholder em `decisions.md` discoverability zero meses depois; falha alta força preenchimento com contexto fresco (custo 1 min).
- Comparação ignora case e ordena IDs no abort message para reprodutibilidade.
- Extração busca apenas `DEC-AUTO-${ISSUE}-` (escopo restrito ao issue do encerramento) — DECs de outros issues mencionadas no body não disparam o gate.

## Chunks

Nenhum CHUNK de produto envolvido. Shared files + infra script apenas.
