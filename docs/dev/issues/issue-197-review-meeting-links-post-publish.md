# Issue #197 — fix: salvar/atualizar link de reunião e gravação na revisão semanal pós-publicação

## Autorização (OBRIGATÓRIA)

- [x] Mockup apresentado (texto inline no body do issue, Subitem Reunião 3 estados)
- [x] Memória de cálculo dispensada — metadata operacional pura, sem fórmula/score/agregação. Validação reaproveita `validateReviewUrl` existente.
- [x] Marcio autorizou — 25/04/2026 ("sim" em resposta à proposta de fix com 4 entregas + chunk + versão alvo)
- [x] Gate Pré-Código liberado

## Context

Mentor publica revisão semanal e fica preso: não consegue mais gravar `meetingLink`/`videoLink`. Caminho real: link da gravação só existe após a reunião terminar — depois de publicar. Hoje os 2 únicos pontos de edição (`ReviewToolsPanel` no Extrato; tab "Reunião" do `WeeklyReviewModal`) são gated em `isDraft`. `WeeklyReviewPage` (página dedicada do mentor) sequer tem esses campos. `StudentReviewsPage` já consome read-only; basta o mentor conseguir gravar.

Causa: os 2 campos foram tratados como conteúdo congelável (junto com SWOT/takeaways/snapshot). São metadata operacional — corrigir o modelo de imutabilidade só para esses campos.

## Spec

Ver issue body no GitHub: #197.

## Mockup

Ver issue body — Subitem "Reunião" no `WeeklyReviewPage` (logo abaixo de Notas da Sessão), 3 estados (DRAFT editável / CLOSED editável caminho novo / ARCHIVED read-only com banner). Componente novo `MeetingLinksSection` com 2 inputs `<input type="url">` + botão "Salvar links" + validação `validateReviewUrl`. `ReviewToolsPanel` ganha botão dedicado "Salvar links" liberado em CLOSED (separado do `Salvar rascunho`).

## Memória de Cálculo

Dispensada. Não há cálculo: `updateMeetingLinks` é `updateDoc({ meetingLink, videoLink, updatedAt })`. Validação existente.

## Phases

- E1 — testes de `useWeeklyReviews.updateMeetingLinks` (DRAFT/CLOSED felizes, ARCHIVED falha, URL inválida não persiste)
- B1 — implementar `useWeeklyReviews.updateMeetingLinks`
- D1 — testes de firestore.rules (mentor CLOSED hasOnly passa; aluno falha; ARCHIVED falha; campos extras junto falha)
- D2 — implementar regra `update` em `students/{uid}/reviews/{rid}` com `hasOnly(['meetingLink','videoLink','updatedAt'])`
- A1 — testes do componente `MeetingLinksSection` (3 estados × papel)
- A2 — implementar `MeetingLinksSection` + integrar no `WeeklyReviewPage` (Subitem 5, posição abaixo de Notas)
- C1 — destravar inputs do `ReviewToolsPanel` em CLOSED + botão "Salvar links" dedicado
- C2 — espelho no `WeeklyReviewModal` tab "Reunião" — botão "Salvar links" se status=CLOSED (consistência tri-superficial)
- F1 — smoke browser (mentor publica → atualiza link → aluno vê novo link)

## Sessions

_(log linear; 1 linha por task)_

## Shared Deltas

_(diffs propostos para o integrador aplicar no MAIN após o merge)_

- `docs/PROJECT.md` — bump v0.40.5 + entrada de encerramento #197
- `src/version.js` — entrada definitiva v1.46.1 substituindo [RESERVADA]
- `docs/registry/versions.md` — marcar v1.46.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-08
- `CHANGELOG.md` — nova entrada `[1.46.1] - 25/04/2026`
- `docs/decisions.md` — DEC-AUTO-197-01 (`meetingLink`/`videoLink` editáveis em CLOSED; banidos em ARCHIVED)
- `docs/firestore-schema.md` — nota na seção `reviews` declarando os 2 campos como metadata operacional editável pós-CLOSED

## Decisions

- DEC-AUTO-197-01 — `meetingLink`/`videoLink` em `students/{uid}/reviews/{rid}` são metadata operacional, editáveis por mentor em DRAFT e CLOSED via update parcial (`hasOnly`). ARCHIVED bloqueia. Não fazem parte do `frozenSnapshot`.

## Chunks

- CHUNK-08 (escrita) — Mentor Feedback (status de revisão)
