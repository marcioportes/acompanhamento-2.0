# Issue #285 — feat: timezone explícito no horário do trade (MEP/MEN manual+import + gate de promoção)

> Template enxuto (R4). Spec completa no body do #285 (link, não duplicar).

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status: AUTORIZADO (27/05/2026, "go" do Marcio)**
- [x] Mockup apresentado (seletor sticky no AddTradeModal + helper "Equivalente BRT" + botão "Recalcular MEP/MEN" no TradeDetail)
- [x] Memória de cálculo apresentada (offset por data+tz com DST automático; ISO+offset gravado; enrich HAS_TZ já cobre)
- [x] 4 decisões resolvidas: (a) sticky+default por instrumento, (b) legado como está, (c) manual+backend agora/import fast-follow, (INV-15) ISO+offset
- [x] Marcio autorizou (27/05/2026, "go")
- [x] Gate Pré-Código liberado

## Context
Horário de entrada/saída do trade é gravado naive (sem tz), manual e import. Enrich MEP/MEN assume Brasília fixo, mas o aluno lê ET/CT na plataforma → janela Yahoo desalinhada → MEP/MEN errado/`unavailable`. Corrompe o gate de promoção `advanced-metrics` (exige ≥80% trades com mep/men). Ambiguidade nasce no input.

## Spec
Ver issue body no GitHub: #285. (Link, não duplicar.)

## Mockup
_(a apresentar — seletor de fuso no campo de hora do AddTradeModal; campo de fuso por lote no wizard de import; ação "recalcular MEP/MEN")_

## Memória de Cálculo
_(a apresentar — `excursionWindow = [toAbsolute(entryTime, tz), toAbsolute(exitTime, tz)]` UTC → Yahoo 1m → LONG MEP=max(high)/MEN=min(low) rel. à entrada; ET com DST vs Brasília fixo)_

## Decisões em aberto (Gate Pré-Código)
- (a) Default do seletor de fuso manual.
- (b) Tratamento do legado naive (Brasília-assumido vs backfill).
- (c) Import: campo de fuso agora ou fast-follow.
- (INV-15) Design do campo: instante absoluto (ISO+offset) vs naive + campo `timezone`.

## Phases
_(a definir após decisões)_
- A1 — schema/storage do tz no trade (INV-15)
- A2 — AddTradeModal: seletor de fuso + gravação do instante absoluto
- A3 — enrich usa tz do trade (remove Brasília fixo)
- A4 — enrich no update (onTradeUpdated) + ação "recalcular MEP/MEN" + guard idempotência
- B* — import (CSV/Order): fuso por lote (condicional decisão c)
- C* — legado (condicional decisão b)
- testes em cada fase (INV-05)

## Shared Deltas
- `src/version.js` — bump v1.68.0 (reservada)
- `docs/registry/versions.md` — marcar v1.68.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04 (+ CHUNK-07/10 se decisão c)
- `CHANGELOG.md` — nova entrada `[1.68.0]`
- `docs/firestore-schema.md` — campo novo do trade (tz) — INV-15
- `docs/cloud-functions.md` — enrich no update (onTradeUpdated)

## Decisions
_(IDs — texto em docs/decisions.md no encerramento)_

## Chunks
- CHUNK-04 (escrita) — schema do trade + enrich + AddTradeModal
- CHUNK-07 (escrita, condicional c) — wizard CSV import
- CHUNK-10 (escrita, condicional c) — order import
- CHUNK-06/maturity (leitura) — dependência do gate
