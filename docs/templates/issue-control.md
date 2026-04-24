# Issue #NNN — tipo: Título descritivo

> **Template enxuto (R4).** Máximo 400 linhas. Excedente vira anexo separado (`issue-NNN-anexo-*.md`).
> **Proibido:** CHANGELOG draft, reprodução de rationale (mora em `docs/decisions.md`), análise de impacto reescrita (mora em `docs/protocols/opening.md`), narrativa de sessão.

## Context
_(5–10 linhas — problema + objetivo, não repita o body do issue)_

## Spec
Ver issue body no GitHub: #NNN. _(Link, não duplicar.)_

## Phases
_(lista linear das fases acordadas — uma por linha)_
- A1 — ...
- A2 — ...
- B1 — ...

## Sessions
_(log linear; 1 linha por task)_
- `task NN [slug] commit <sha> ok`
- `task NN [slug] commit <sha> fail — <motivo em 1 linha>`

## Shared Deltas
_(diffs propostos para o integrador aplicar no MAIN após o merge)_
- `docs/PROJECT.md` — _(o que muda)_
- `src/version.js` — bump vX.Y.Z
- `docs/registry/versions.md` — marcar vX.Y.Z consumida
- `docs/registry/chunks.md` — liberar CHUNK-NN
- `CHANGELOG.md` — nova entrada `[X.Y.Z] - DD/MM/YYYY`

## Decisions
_(apenas IDs — texto mora em `docs/decisions.md`)_
- DEC-AUTO-NNN-01
- DEC-AUTO-NNN-02

## Chunks
- CHUNK-NN (escrita) — _(motivo)_
- CHUNK-NN (leitura) — _(motivo)_
