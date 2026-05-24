# Issue #280 — fix: closure inbox "no comment" não remove item

## Autorização

- [x] Sem mockup (hook puramente lógico)
- [x] Memória de cálculo no body do issue (filtro `closingComment` → `closingCommentAt`)
- [x] Marcio autorizou (24/05/2026: "O mais rápido possível")
- [x] Gate Pré-Código liberado

## Context

`MentorClosureView.markNoComment` chama `setMentorClosureComment({ comment: '' })`. CF grava `closingComment: null` (vazio.trim()) + `closingCommentAt: now`. `useMentorClosureInbox:86` filtra por presença de conteúdo em `closingComment` (null fail), não pelo timestamp do processamento. Item nunca sai do inbox.

## Spec

Ver issue body no GitHub: #280.

## Phases

- **A1 — Fix + teste** (1 task): trocar 2 ocorrências em `useMentorClosureInbox.js` (`inbox` useMemo + `pendingCount` useMemo) de `closingComment não-vazio` para `!!c.mentor?.closingCommentAt`. Teste novo cobre 5 cenários (regression + texto + sem processamento + mode=all + enabled=false).

## Sessions

- task 01 [fix-filter-by-timestamp] commit <a definir> ok — 5 testes novos, suite 3244/3244

## Shared Deltas

- `src/version.js` — bump 1.64.0 → 1.64.1 no encerramento
- `docs/registry/versions.md` — marcar 1.64.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-08 ESCRITA
- `CHANGELOG.md` — nova entrada `[1.64.1] - 24/05/2026`

## Decisions

Sem DEC-AUTO. Edge case "limpar comentário devolve ao inbox" deferido (não há demanda).

## Chunks

- CHUNK-08 (Mentor Feedback) — ESCRITA (hook do mentor inbox)
