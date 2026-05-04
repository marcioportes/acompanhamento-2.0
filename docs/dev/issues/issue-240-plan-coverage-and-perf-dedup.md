# Issue #240 — fix: plano retroativo (hora vs data) + dedup performance import

## Autorização

- [x] Mockup — N/A (fix técnico, sem UI nova; exceção autorizada por Marcio: "precisa corrigir tudo... fast track")
- [x] Memória de cálculo — abaixo
- [x] Marcio autorizou: "precisa corrigir tudo. E a importação de performance precisa checar se existe trade seja por criação manual ou por ordem... assim como a importação de ordem faz. Agora esse erro do plano é ridículo, precisa corrigir asap. Não há sessões em paralelo, faça fast track" (04/05/2026)
- [x] Gate Pré-Código liberado

## Context

Bug 1 — `planCoverage.planCoversDate` compara timestamps com hora; plano criado às 14h não cobre ordem das 11h do mesmo dia. Bloqueia importação de ordens do dia em que o plano nasceu.

Bug 2 — `useCsvStaging.confirmStaging` cria trades sem checar duplicatas. Aluno que importa ordens (gera trades `order_import`) e depois importa performance no mesmo plano vê trades duplicados.

## Spec

Issue body em `gh issue view 240`.

## Memória de Cálculo

### Bug 1 — Cobertura por dia local

**Inputs (atual):**
- `plan.createdAt` → Firestore Timestamp / ISO / ms (com hora exata)
- `plan.closedAt` → idem (opcional)
- `op.entryTime` → string ISO (`2026-05-04T11:39:20`)

**Fórmula nova:**
```
toDay(value) → 'YYYY-MM-DD' (timezone local do servidor que gravou)
opDay = toDay(opMs)
createdDay = toDay(createdMs)  // se houver
closedDay = toDay(closedMs)    // se houver

cobre = (createdMs == null || opDay >= createdDay)
     && (closedMs == null || opDay <= closedDay)
     && (plan.active !== false)
     && (accountId match)
```

**Exemplo (cenário do CSV `040526-ORDER.csv`):**
- `op.entryTime = '2026-05-04T11:39:20'` → `opDay = '2026-05-04'`
- `plan.createdAt = '2026-05-04T14:00:00'` → `createdDay = '2026-05-04'`
- `opDay >= createdDay` → **true** → plano cobre ✓ (antes retornava false)

**Caso limite — fuso horário:** `toMs` já normaliza para epoch ms; `toDay` aplica `Date.toISOString().slice(0,10)` (UTC) — consistente entre cliente e Firestore (que sempre serializa em UTC). Plano criado 04/05 23h BRT (= 05/05 02h UTC) cobre ordem 04/05 23:30 BRT (= 05/05 02:30 UTC) — ambos viram `'2026-05-05'` em UTC, comparação consistente. **Aceito o tradeoff:** dia de virada (entre 21h BRT e meia-noite) o "dia" é UTC, não local — mas como `entryTime` do CSV também é serializado pelo broker em hora local sem fuso, o resultado é simétrico.

### Bug 2 — Dedup em performance import

**Reusar:** `checkDuplication(tradeData, existingTrades)` em `src/utils/orderTradeCreation.js:244-292`.

**Critério (já implementado):** ticker (case-insensitive) ∧ side ∧ qty (±0.01) ∧ entryTime (±5min via `CORRELATION_WINDOW_MS`). Fallback por data quando trade existente sem hora.

**Integração no CSV staging:**
1. `useCsvStaging.confirmStaging(batchId)` lê `existingTrades` do plano (já tem via `useTrades` no caller).
2. Antes de cada `addTrade(tradeData)`, chama `checkDuplication(tradeData, existingTrades)`.
3. Se `isDuplicate` → pula, incrementa `duplicatesSkipped`, registra `matchedTradeId` no return.
4. Caller (`CsvImportWizard`) exibe contagem na tela final ("X duplicatas ignoradas — já existiam de import anterior").

**Caso limite — trade manual sem `entryTime`:** `checkDuplication` cai no fallback por data (linha 277-287); cobre. Trade do plano sem ticker (legado) é comparado por uppercase('') ≠ uppercase('WINM26') → não bate (correto, segue criando).

## Phases

- A1 — fix `planCoverage.js` (compare por dia, não ms)
- A2 — testes `planCoverage.test.js` (caso 14h-cobre-11h-mesmo-dia + edges)
- B1 — propagar `existingTrades` ao caller de `confirmStaging`
- B2 — `confirmStaging` chama `checkDuplication` antes de `addTrade`
- B3 — atualizar `CreationResultPanel` ou tela DONE do `CsvImportWizard` para mostrar "X duplicatas ignoradas"
- B4 — testes do dedup no `useCsvStaging` (mock trades existentes, casos: same window / outside window / different ticker)
- C1 — npm test full + smoke local
- C2 — encerramento via `cc-close-issue.sh 240`

## Sessions

- task A1+A2 [planCoverage day-of-year] commit `1cd32a16` — `planCoversDate` compara `YYYY-MM-DD` UTC; 4 testes novos + 16 baseline preservados (20/20 ok)
- task B1..B3 [csv-staging dedup] commit `1cd32a16` — `useCsvStaging.activateTrade/Batch` aceitam `existingTrades`, reusam `checkDuplication` exportado de `orderTradeCreation`, retornam `skipped[]`; wrappers em `StudentDashboard`+`TradesJournal`+`CsvImportManager` propagam trades do plano
- task B4 [test cross-source] commit `1cd32a16` — 1 teste novo em `orderTradeCreation.test.js` documenta cobertura cross-source (manual + order_import + csv)
- task D1+D2 [csv perf MEP/MEN auto-enrich] commit pending — opt (A) auto-enrich silencioso. Novo helper puro `src/utils/csvEnrichmentPatch.js` (preenche só campos vazios, nunca sobrescreve, default `excursionSource: 'profitpro'`). `useCsvStaging` aceita `options.updateTradeFn`; quando duplicata + CSV traz mep/men que faltam → chama `updateTradeFn(matchedId, patch)` validado por `validateExcursionPrices`; retorna `enriched[]`. 13 testes novos (`csvEnrichmentPatch.test.js`).
- task C1 [suite full] — 185 arquivos / 2952 testes passando; vite build limpo

## Shared Deltas

- `src/version.js` — bump v1.55.1 (já no main, commit `6d37fa9d`)
- `docs/registry/chunks.md` — lock CHUNK-10+CHUNK-07 (já no main)
- `docs/registry/versions.md` — v1.55.1 reservada (já no main)
- `CHANGELOG.md` — entrada `[1.55.1] - 04/05/2026` (no encerramento)

## Decisions

- DEC-AUTO-240-01 — `planCoversDate` compara dia local (UTC normalizado) ao invés de timestamp ms; tradeoff de borda noturna documentado em memória de cálculo.
- DEC-AUTO-240-02 — `useCsvStaging` reusa `checkDuplication` exportado de `orderTradeCreation.js` (DRY); ambos pipelines passam a aplicar o mesmo critério.
- DEC-AUTO-240-03 — Auto-enrich silencioso de MEP/MEN/`excursionSource` quando duplicata é detectada e o trade existente NÃO tem o campo. Conservador: nunca sobrescreve, sempre via `updateTrade` (gateway oficial), validado por `validateExcursionPrices` antes do write. Default `excursionSource: 'profitpro'` quando CSV não vem com origem explícita.

## Chunks

- CHUNK-10 (escrita) — `planCoverage.js`
- CHUNK-07 (escrita) — `useCsvStaging.js` + caller
- CHUNK-04 (leitura) — `tradeGateway.addTrade` chamado pelo caller
