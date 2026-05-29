# Issue #292 — feat: timezone explícito no import de trades (CSV + Order)

> Template enxuto (R4). Spec completa no body do #292 (link, não duplicar).

## Autorização (OBRIGATÓRIA)

**Status: AUTORIZADO (29/05/2026, "autorizado, os dois fluxos, 1.70.0" do Marcio).**
- [x] Mockup/abordagem apresentados (seletor de fuso por lote no wizard CSV + OrderImportPage)
- [x] Memória de conversão apresentada (reusa `combineDateTimeWithTz` do #285)
- [x] Marcio autorizou (29/05/2026)
- [x] Gate Pré-Código liberado

## Context
Fast-follow do #285. Import (CSV + Order) grava horário naive → enrich assume Brasília → import de corretora US (ET/CT) sai com MEP/MEN desalinhado. Helper e enrich do #285 já cobrem ISO+offset; falta o seletor de fuso por lote nos dois fluxos.

## Spec
Ver issue body no GitHub: #292. (Link, não duplicar.)

## Mockup
- CSV: dropdown "Fuso" no passo de Mapeamento (ao lado de Exchange / Formato de data), por lote.
- Order: dropdown "Fuso" no OrderImportPage após seleção de plano.

## Memória de Cálculo
`combineDateTimeWithTz('2026-05-27','16:23','America/New_York')` → `'2026-05-27T16:23:00-04:00'` (DST automático). Enrich detecta HAS_TZ. Legado naive segue Brasília (#285 decisão b).

## Phases
- **Fase A** — CSV import: seletor de fuso por lote (default sticky + derivado da Exchange) + `buildTradeFromRow` grava ISO+offset
- **Fase B** — Order import: seletor de fuso por lote (sticky + fallback BRT) + corrige `reconstructOperations` (naive→UTC ambíguo) reconstruindo no fuso do lote
- testes em cada fase (INV-05)

## Sessions
_(log linear)_

## Shared Deltas
- `src/version.js` — bump v1.70.0 (reservada)
- `docs/registry/versions.md` — marcar v1.70.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-07/10
- `CHANGELOG.md` — nova entrada `[1.70.0]`

## Decisions
_(IDs — texto em docs/decisions.md no encerramento)_

## Chunks
- CHUNK-07 (escrita) — wizard CSV: seletor de fuso + gravação ISO+offset
- CHUNK-10 (escrita) — order import: seletor de fuso + reconstrução com offset
