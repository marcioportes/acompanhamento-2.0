# Issue #315 — feat: evidência mentor-only + imagens opcionais + reflexão na composição de feedback

> Template enxuto (R4). Fast-track autorizado por Marcio (25/06/2026).
> Consolidado em 1 issue (Marcio: "inclui aqui mesmo, sai com uma issue só").

## Autorização

**Status atual do documento:**
- [x] Mockup — N/A (esconde/move elementos existentes; sem UI nova)
- [x] Memória de cálculo — N/A (sem fórmula)
- [x] Marcio autorizou — 25/06/2026 (escopo A "rebaixa pra opção 1"; B "imagens não obrigatórias"; C "inclui aqui mesmo, sai com uma issue só")
- [x] Gate Pré-Código liberado

## Context

Três ajustes no fluxo de trade/feedback, consolidados:
- **A (CHUNK-11)** — accordion "Evidência técnica" do `BehaviorPanel` despeja campos crus
  do schema. ROI de humanizar é baixo (painel colapsado, epic ativo). → evidência crua
  vira **mentor-only**; aluno fica com a narrativa.
- **B (CHUNK-04)** — `AddTradeModal` exige imagem HTF e LTF na criação do trade. → tornar
  ambas **opcionais**.
- **C (CHUNK-08)** — a reflexão do aluno (`trade.selfReview`: "Faria de novo" + respostas)
  não aparece na `FeedbackPage` (onde o mentor compõe feedback) nem na `StudentReviewsPage`.
  → exibir a reflexão read-only nessas telas, com estado explícito quando o aluno ainda
  não refletiu.

## Spec
Ver issue body no GitHub: #315.

## Mockup
N/A — esconde/move blocos existentes (`TradeReviewSection` já é read-only auto-suficiente).

## Memória de Cálculo
N/A.

## Phases
- A — Evidência mentor-only: `BehaviorPanel.jsx` + `UndersizedBody` gate `isMentor` + testes ✅ (commit fd66e522)
- B — Imagens opcionais: `AddTradeModal.jsx` remove validação HTF/LTF + asterisco; teste
- C — Reflexão na composição: `FeedbackPage` renderiza `TradeReviewSection`; `StudentReviewsPage`
      passa `showSelfReview`; estado "aluno ainda não refletiu" pro mentor; testes

## Chunks
- CHUNK-11 (escrita) — display do `behaviorProfile`
- CHUNK-04 (escrita) — registro de trade (`AddTradeModal`)
- CHUNK-08 (escrita) — composição de feedback (`FeedbackPage`, `StudentReviewsPage`)

## Sessions
- _(a preencher)_

## Shared Deltas
- `src/version.js` — bump v1.78.0 (reservado no main)
- `docs/registry/versions.md` — marcar v1.78.0 consumida (no encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-11 / CHUNK-04 / CHUNK-08 (no encerramento)
- `CHANGELOG.md` — nova entrada `[1.78.0] - 25/06/2026`

## Decisions
- _(a preencher se houver DEC-AUTO)_
