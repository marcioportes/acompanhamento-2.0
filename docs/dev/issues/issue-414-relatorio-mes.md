# Issue #414 — feat: relatório do mês no lugar do Diário

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

- [x] Mockup apresentado — no body do issue #414 e no chat de 31/08/2026
- [x] Memória de cálculo apresentada — no body do issue #414 (sem fórmula nova: dois filtros + agregação por moeda)
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado

## Context

O Diário (`TradesJournal.jsx`, rota `journal`) é segunda via do Dashboard: `TradesList`, `AddTradeModal`,
`CsvImportWizard`, `CsvImportManager`, `CsvImportCard` e `useCsvStaging` já existem no `StudentDashboard`
— verificado arquivo por arquivo. Ele acrescenta uma barra de filtros e uma ordenação própria, e não
responde a pergunta de fim de mês do aluno: **o que eu escrevi na entrada, e o que o mentor respondeu.**

A rota passa a servir um relatório mensal de leitura, só com trades que têm feedback do mentor.
Nada do CRUD se perde — ele continua no Dashboard.

## Spec

Ver issue body no GitHub: #414. Mockup e memória de cálculo estão lá.

## Phases

- A1 — `TradeReportPage.jsx`: seletor de mês, seleção de trades com feedback, 3 colunas, estado vazio
- A2 — Rota `journal` → `TradeReportPage`; item de menu "Diário" → "Relatório" (`Sidebar.jsx`)
- A3 — Clique na linha → `FeedbackPage` (reusa `onNavigateToFeedback`, já existente); lightbox das refs
- A4 — Apagar `TradesJournal.jsx` + imports órfãos em `App.jsx`
- A5 — Testes: filtro de mês, filtro "tem feedback" (legado + histórico), agregação por moeda, vazio

## Sessions

_(1 linha por task)_

## Shared Deltas

- `src/version.js` — bump v1.86.0 (**já aplicado no main**, commit `f752b01f`)
- `docs/registry/versions.md` — marcar 1.86.0 consumida no encerramento
- `docs/registry/chunks.md` — liberar CHUNK-02 no encerramento
- `CHANGELOG.md` — entrada `[1.86.0] - 31/08/2026`
- `docs/PROJECT.md` — linha de versão

## Decisions

_(IDs — texto em `docs/decisions.md`)_

## Chunks

- CHUNK-02 Student (escrita) — sidebar e rota do aluno
- CHUNK-04 Trade Ledger (leitura) — `useTrades`, campos do trade
- CHUNK-08 Mentor Feedback (leitura) — `mentorFeedback` / `feedbackHistory`
