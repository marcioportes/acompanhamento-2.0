# Issue #339 — feat: exibir timezone do horário de entrada em todas as telas de trade

## Autorização
- [x] Mockup apresentado — exceção "fast track" (Marcio, 15/07/2026); mockup mínimo abaixo
- [x] Memória de cálculo — trivial (offset→label determinístico, DST já resolvido em `tradeTimezone.js`)
- [x] Marcio autorizou — "fast track" (15/07/2026)
- [x] Gate Pré-Código liberado

## Context
Fuso do trade está embutido no offset do ISO (`entryTime`/`exitTime`) desde #285/#292, mas nenhuma tela exibe. Há dois renders divergentes: Grupo A (wall-clock, offset descartado) e Grupo B (converte pro fuso do navegador). Objetivo: exibir `16:23 ET` em todas as telas, com comportamento único (wall-clock do trade).

## Spec
Ver issue body no GitHub: #339.

## Mockup (mínimo)
Antes: `27/05/2026 16:23` · Depois: `27/05/2026 16:23 ET`
- Label curto: `ET` (America/New_York), `CT` (America/Chicago), `BRT` (America/Sao_Paulo).
- ISO legado sem offset → sem label (só `16:23`), sem quebrar.
- Grupo B passa a mostrar wall-clock do trade (não do navegador) — corrige inconsistência.

## Memória de Cálculo
- **Input:** `iso` string (`entryTime`/`exitTime`/`p.dateTime`), ex. `2026-05-27T16:23:00-04:00`.
- **Regra:** extrai offset do sufixo do ISO → mapeia p/ label. `-03:00`→BRT. `-04:00`/`-05:00`→ET ou CT conforme DST + qual exchange? Offset sozinho não distingue ET-DST (-04) de EST (-05) vs CT. Estratégia: reidratar via `tzFromStoredIso` (IANA) e mapear IANA→label curto. `tzFromStoredIso` já existe e é testado.
- **Casos limite:** iso null/vazio → `''`; sem offset (`Z` ausente e sem `±HH:MM`) → sem label; IANA desconhecido → sem label (defensivo).

## Phases
- A1 — helper `shortTzLabelFromIso` em `tradeTimezone.js` + testes (INV-05, antes da UI)
- A2 — `fmtTradeTime(iso)` SSoT (`reviewFormatters` ou `tradeTimezone`) + testes
- B1 — plugar Grupo A (FeedbackPage, MentorDashboard×2, StudentFeedbackPage, TradesList, TradeDetailModal)
- B2 — plugar Grupo B (reviewFormatters.fmtTime → ReviewTradesSection, OrderStagingReview, ConversationalOpCard)
- C1 — build + suíte verdes

## Sessions
- (log por task)

## Shared Deltas
- `src/version.js` — bump v1.83.0 (reservado no main)
- `docs/registry/versions.md` — marcar v1.83.0 consumida (no encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-04/08/16 (no encerramento)
- `CHANGELOG.md` — nova entrada `[1.83.0]`
- `docs/PROJECT.md` — bump + resumo

## Decisions
- DEC-AUTO-339-01 — label curto ET/CT/BRT via IANA (não via offset cru, que é ambíguo)
- DEC-AUTO-339-02 — unificar Grupo B no wall-clock do trade (corrige fuso-do-navegador)

## Chunks
- CHUNK-04 (escrita) — TradesList/TradeDetailModal display
- CHUNK-08 (escrita) — FeedbackPage/StudentFeedbackPage/ReviewTradesSection
- CHUNK-16 (escrita) — MentorDashboard cockpit
