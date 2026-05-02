# Issue #225 — fix: cc-close-issue.sh — DEC-AUTO órfã + gate CF deploy + backfill #221

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
- D1 — Gate bloqueante de CF deploy substitui alerta não-bloqueante de #216. Novo passo `0a` exige marker `.cf-deployed-${PR}` no repo root quando squash do PR tocou `functions/`. Sem marker → abort. Com marker → continua e remove marker pós-verificação. Remove passo 9 antigo.
- D2 — Documentar gate em `docs/protocols/closing.md` como passo `1a` na descrição das 8 etapas.
- D3 — Validação real do gate: encerramento do próprio #225 (squash não toca `functions/` → caminho `[skip]`); caminho `[ok] marker presente` será exercitado em próximo encerramento que tocar `functions/`.

## Sessions

_(preenchido durante execução)_

## Shared Deltas

- `scripts/cc-close-issue.sh` — substituir bloco 3f (linhas 246–255) + adicionar passo `0a` (gate bloqueante CF deploy) + remover passo 9 (alerta não-bloqueante de #216).
- `docs/protocols/closing.md` — bullet 4 em §3 + novo passo `1a` documentando gate de CF deploy.
- `docs/protocols/autonomous.md` — Fase 6 (Encerramento).
- `docs/decisions.md` — append 3 linhas (Parte A).
- Sem `src/version.js` bump, sem reserva em `registry/versions.md`, sem CHUNK locks (precedente: #214, #216).

## Decisions

- Abort em vez de auto-stub no script: placeholder em `decisions.md` discoverability zero meses depois; falha alta força preenchimento com contexto fresco (custo 1 min).
- Comparação ignora case e ordena IDs no abort message para reprodutibilidade.
- Extração busca apenas `DEC-AUTO-${ISSUE}-` (escopo restrito ao issue do encerramento) — DECs de outros issues mencionadas no body não disparam o gate.
- Substituir alerta não-bloqueante de #216 por gate bloqueante (passo `0a`): casos #211/#210/#221 mergearam mudança em `functions/` sem deploy imediato — paridade prod↔main quebrou na surdina. Custo de UX (rodar `touch .cf-deployed-${PR}` após `firebase deploy`) compensa risco de drift silencioso. Marker effêmero (não vai pro git, removido pós-verificação) evita poluir repo.

## Chunks

Nenhum CHUNK de produto envolvido. Shared files + infra script apenas.
