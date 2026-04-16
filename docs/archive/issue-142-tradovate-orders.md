# Issue #142 — feat: Order Import Tradovate Orders — parser adhoc + remover gatekeep ProfitChart

- **Estado:** OPEN
- **Milestone:** v1.1.0 — Espelho Self-Service
- **Branch:** `feat/issue-142-tradovate-orders`
- **Worktree:** `~/projects/issue-142`
- **Versão reservada:** v1.31.0
- **Baseado em PROJECT.md:** v0.18.1 (15/04/2026)

---

## 1. Objetivo

Permitir que alunos Apex/MFF/Lucid/Tradeify executando via **Tradovate** consigam importar suas ordens. Hoje o Order Import só aceita ProfitChart-Pro — gatekeep hardcoded em `OrderImportPage.jsx:126` rejeita qualquer outro formato.

Escopo **reduzido, adhoc** — refator template-based rejeitado como over-engineering (YAGNI). Só 1 parser novo não justifica abstração prematura; padrão emerge melhor quando houver 2+ parsers concretos convivendo.

---

## 2. Chunks

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-10 | escrita | Order Import — parser novo + refactor gatekeep |

**Lock registrado:** PROJECT.md §6.3 — CHUNK-10 / #142 / 15/04/2026 (commit `fec42493` em main).

---

## 3. Estado do código (verificado na exploração)

### Order Import hoje (CHUNK-10)
- `src/utils/orderParsers.js` — `parseProfitChartPro` hardcoded, `parseGenericOrders` scaffolded mas nunca invocado
- `src/utils/orderNormalizer.js` / `orderValidation.js` / `orderReconstruction.js` / `orderCorrelation.js` — **downstream agnóstico ao formato**, zero mudança necessária
- `src/pages/OrderImportPage.jsx:126` — gatekeep `if (detection.format !== 'profitchart_pro') return reject(...)` que precisa ser removido
- `src/hooks/useOrderStaging.js` — agnóstico, ingestão funciona com qualquer output canônico

### Contrato canônico dos parsers (invariante)
```js
{
  orders: [{ externalOrderId, account, instrument, side, status, orderType,
    submittedAt, filledAt, cancelledAt, price, stopPrice, quantity,
    filledQuantity, avgFillPrice, isStopOrder, events, ... }],
  meta: {...},
  errors: [...],
  lowResolution: boolean,
}
```

---

## 4. Formato Tradovate Orders (sample confirmado)

- **32 colunas, delimitador `,`, encoding UTF-8**
- **Estrutura flat** — 1 linha = 1 ordem, sem hierarquia master+events do ProfitChart
- **Datas:** `MM/DD/YYYY HH:MM:SS` (ex: `04/02/2026 11:06:37` = 2 abril)
- **Números US:** `.` decimal, `,` thousands (ex: `"47,862.00"`)
- **Leading space** em `B/S`, `Status`, `Type` — trim obrigatório

**Headers (ordem):**
```
orderId, Account, Order ID, B/S, Contract, Product, Product Description,
avgPrice, filledQty, Fill Time, lastCommandId, Status, _priceFormat,
_priceFormatType, _tickSize, spreadDefinitionId, Version ID, Timestamp,
Date, Quantity, Text, Type, Limit Price, Stop Price, decimalLimit,
decimalStop, Filled Qty, Avg Fill Price, decimalFillAvg, Venue,
Notional Value, Currency
```

**Samples em `Temp/Tradovate-{April,Feb}-Orders.csv`** — conta Apex `PAAPEX2604610000005`, contratos MNQM6/NQM6, status Filled/Canceled, types Market/Limit/Stop.

---

## 5. Análise de impacto

### Collections tocadas
- `orders` (leitura + escrita) — mesmo schema, output canônico já compatível

### Cloud Functions
- Nenhuma nova. CFs existentes (staging, ingest) consomem schema canônico, agnósticas a formato de entrada.

### Hooks/listeners
- `useOrderStaging` — sem mudança. Consome output canônico.

### Side-effects em PL/compliance/emotional
- Nenhum novo. Reconstrução → trades → CFs já existentes. Zero mudança em pipeline downstream.

### Invariantes respeitadas
- INV-01 (airlock): import vai pra `orders` staging, não escreve em `trades` direto
- INV-04 (DebugBadge): componentes tocados (`OrderImportPage`) mantêm badges
- INV-07 (autorização): este arquivo é a proposta
- INV-08 (CHANGELOG): entrada v1.31.0 no encerramento
- INV-15 (persistência): **N/A** — não cria collections/campos novos

### Blast radius
- Regressão ProfitChart-Pro: parser existente fica intacto, só é roteado pelo detector
- Gatekeep removido: parsers não registrados continuam rejeitados via detector
- Rollback: reverter parser novo + reinstalar gatekeep é 1 commit

### Testes que podem quebrar
- Nenhum teste existente deve quebrar — `parseProfitChartPro` inalterado
- Novos testes: parse Tradovate, detecção, mapas status/side/type, datas US, números US

---

## 6. Ordem de ataque

### Fase A — Refactor gatekeep + auto-detect (NÃO depende do sample, ~1h)
- [ ] Refatorar `detectOrderFormat(headers)` para retornar `{ format, confidence, parser }` com registry `{ profitchart_pro: parseProfitChartPro }` (Tradovate adicionado na Fase B)
- [ ] Remover gatekeep em `OrderImportPage.jsx:126` — rotear por `detection.parser`
- [ ] Mensagem de erro mais genérica quando nenhum parser reconhece
- [ ] Testes de detecção com headers ProfitChart (regressão)

### Fase B — Parser Tradovate (depende do sample, ~2h)
- [ ] `parseTradovateOrders(text)` em `src/utils/orderParsers.js` (ou novo `src/utils/parsers/tradovate.js` se ficar grande)
- [ ] `TRADOVATE_STATUS_MAP`, `TRADOVATE_SIDE_MAP`, `TRADOVATE_TYPE_MAP` (mapas EN com trim)
- [ ] `parseDateTimeUS()` helper (MM/DD/YYYY HH:MM:SS) — ou estender `parseDateTime` de csvMapper
- [ ] `parseNumericUS()` helper (remover `,` thousands, `.` decimal) — pode reusar se csvMapper já faz
- [ ] Adicionar `tradovate` ao registry do detector com signature: `orderId,Account,Order ID,B/S,Contract` nas primeiras 5 colunas

### Fase C — Testes + validação (~1h)
- [ ] Mover fixtures: `Temp/Tradovate-April-Orders.csv` + `Temp/Tradovate-Feb-Orders.csv` → `src/__tests__/fixtures/tradovate-orders/`
- [ ] Testes unitários: parse flat, detecção confidence ≥ 0.8, mapas, datas, números, orders cancelados sem filledPrice
- [ ] Validação browser: import real dos 2 CSVs no dev server, verificar staging + reconstrução + correlação

**Total estimado:** 3–4h · 1 sessão.

---

## 7. Deltas em shared files (aplicar no encerramento)

- `docs/PROJECT.md` — CHANGELOG [1.31.0] em §10, liberar lock CHUNK-17 §6.3, bump header (INV-14)
- `src/version.js` — ajustar `version: '1.31.0'` + `build: '20260415'` (já reservado no comentário)

---

## 8. Gate Pré-Código

1. ✅ Issue #142 criado
2. ✅ Worktree `~/projects/issue-142` (INV-16)
3. ✅ CHUNK-10 locked em main (commit `fec42493`)
4. ✅ v1.31.0 reservada em `src/version.js` (commit `fec42493`)
5. ✅ Arquivo de controle presente
6. ⏳ **Aprovação INV-07** (autorização para codificar)
7. ⏳ Sample CSV Tradovate já disponível em `Temp/`

---

## 9. Log da sessão

- **15/04/2026** — Abertura. Ordem §4.0 seguida corretamente:
  - Issue #142 criado no GitHub com escopo reduzido (parser adhoc, sem refator template-based)
  - Commit `fec42493` em main: lock CHUNK-10 + reserva v1.31.0
  - Worktree criado a partir do main atualizado
  - Arquivo de controle gerado
  - Aguardando aprovação Pré-Código para iniciar Fase A

- **15/04/2026 — Fase A concluída** (commit `addd49b8`):
  - `FORMAT_REGISTRY` extensível em orderParsers.js (getter lazy para evitar TDZ)
  - `detectOrderFormat` retorna `{ format, confidence, parser }` — parser é referência direta
  - OrderImportPage.jsx: detecção multi-delim (`;` e `,`), remove gatekeep, roteia por parser
  - 2 testes novos: parser referenciado, null quando genérico
  - 1439/1439 testes passando, zero regressão

- **15/04/2026 — Fase B concluída** (commit próximo):
  - `parseTradovateOrders` com Papa.parse quote-aware (lida com `"47,862.00"`)
  - `TRADOVATE_HEADER_SIGNATURE` + `TRADOVATE_STATUS_MAP` + threshold 0.6
  - Registrado em FORMAT_REGISTRY (getter lazy)
  - Shape canônico idêntico ao ProfitChart — downstream inalterado
  - Eventos reconstruídos: FILLED → TRADE_EVENT, CANCELLED → CANCEL_EVENT
  - Fixtures reais `april.csv` + `feb.csv` (conta Apex PAAPEX2604610000005, contratos MNQM6/NQM6)
  - 17 testes novos: detecção, shape, datas US, thousands, eventos, cancelados, edge cases
  - 1456/1456 testes passando

- **15/04/2026 — Fase C concluída** (commit próximo):
  - `src/version.js` bump 1.30.0 → 1.31.0
  - `docs/PROJECT.md` header v0.18.1 → v0.19.0, entrada histórica, CHANGELOG §10 [1.31.0]
  - **Validação browser end-to-end**: import real dos CSVs April + Feb funcionou, auto-detecção rotea corretamente Tradovate, ProfitChart continua funcionando sem mudança
