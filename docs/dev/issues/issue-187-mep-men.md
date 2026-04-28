# Issue #187 — feat: coleta de MEP/MEN (Maximum Excursion Positiva/Negativa)

> Modo: autônomo (>5 fases). Branch: `feat/issue-187-mep-men`. Versão reservada: v1.48.0.
> Locks: CHUNK-04 (escrita), CHUNK-07 (escrita).

## Autorização

**Decisões de negócio já fechadas em sessão remota (27/04/2026):**

- DEC-AUTO-187-01 — Storage MEP/MEN como **preço** (`mepPrice`/`menPrice`), parser converte pts/% → preço na entrada
- DEC-AUTO-187-02 — Fonte para brokers sem MEP/MEN: Yahoo Finance 1m + compute&discard, janela 7d, falha → `unavailable`
- DEC-AUTO-187-03 — Gate Stage 3→4 quando MEP/MEN ausente: opcional/condicional (marca "insuficiente", não bloqueia)

Status do gate pré-código:

- [x] Mockup apresentado (seção abaixo)
- [x] Memória de cálculo apresentada (seção abaixo)
- [x] Marcio autorizou ("Go" — 27/04/2026)
- [x] Gate Pré-Código liberado

## Context

Engine de maturidade 4D × 5 stages (#119) exige na transição Stage 3→4 a métrica MEP/MEN (= MFE/MAE). Hoje o Espelho não coleta nem deriva. Furo estrutural: aluno trava por dado ausente, não por comportamento. Issue entrega: form manual + parser ProfitPro + loader Yahoo + integração engine. Sharpe sai pra issue separado.

## Spec

GitHub: https://github.com/marcioportes/acompanhamento-2.0/issues/187

## Mockup

### M1 — AddTradeModal (form manual, Fase 2)

Bloco novo após `stopLoss`, opcional, colapsável (default colapsado):

```
┌─ Métricas avançadas (opcional) ────────────────────┐
│ ⓘ Usado pelo motor de maturidade Stage 3→4         │
│                                                     │
│ MEP — Pico favorável         [_______] (preço)     │
│ MEN — Pior tick adverso      [_______] (preço)     │
│                                                     │
│ Validação inline:                                   │
│   LONG: MEP ≥ max(entry,exit), MEN ≤ min(entry,exit)│
│   SHORT: MEP ≤ min(entry,exit), MEN ≥ max(entry,exit)│
│                                                     │
│ Erro: "MEP de LONG precisa estar acima do exit"    │
└─────────────────────────────────────────────────────┘
```

Estados:
- Vazio (default): submit OK, `mepPrice/menPrice = null`, `excursionSource: null`
- Preenchido válido: `excursionSource: 'manual'`
- Preenchido inválido: bloqueia submit com erro inline (vermelho)

### M2 — TradeDetailModal (visualização, Fase 1+5)

Após `stopLoss`, em qualquer trade que tenha MEP/MEN:

```
Stop Loss:    194.080,00
MEP:          194.245,00  ↑ +10 pts (R$ +4,00)   [yahoo]
MEN:          193.785,00  ↓ -450 pts (R$ -180,00) [yahoo]
```

Badges de fonte: `[manual]` cinza, `[profitpro]` verde, `[yahoo]` azul, `[unavailable]` âmbar com tooltip "MEP/MEN não disponível — broker não exportou e trade tem >7d para enrichment".

### M3 — Engine Maturidade (Fase 5, sem mudança visual)

`MaturityProgressionCard` já exibe gates por stage. Quando `advancedMetricsPresent: false`:
- Gate Stage 3→4 que depende de MEP/MEN aparece como "insuficiente" (cinza, não vermelho)
- Tooltip: "Preencha MEP/MEN nos trades recentes para liberar este gate"
- Não bloqueia outros gates do stage

## Memória de Cálculo

### Fórmulas de conversão pts/% → preço (Fase 3, parser ProfitPro)

**Inputs:**
- `entry: number` — preço de abertura (`Preço Compra` para LONG, `Preço Venda` para SHORT)
- `mepRaw: number` — coluna `MEP` do CSV
- `menRaw: number` — coluna `MEN` do CSV
- `instrumentType: 'futures' | 'equity'` — derivado do prefixo do símbolo
- `side: 'LONG' | 'SHORT'`

**Para futures (WIN, WDO, IND, BIT, DOL, BGI, CCM, etc):**

```
mepPrice = entry + (side === 'LONG' ? +mepRaw : -mepRaw)
menPrice = entry + (side === 'LONG' ? -|menRaw| : +|menRaw|)
```

Onde `mepRaw` em pontos vem signed positivo, `menRaw` em pontos vem signed negativo no CSV.

**Para ações (PETR4, VALE3, etc — não-futures):**

```
mepPrice = entry × (1 + mepRaw / 100)    // mepRaw em %
menPrice = entry × (1 + menRaw / 100)    // menRaw em % (negativo)
```

**Auto-detect instrumentType:**
- Prefixos de futures B3: `WIN`, `WDO`, `IND`, `DOL`, `BIT`, `BGI`, `CCM`, `ICF` → `futures`
- Demais → `equity`

### Fórmulas de excursion via Yahoo Finance (Fase 4, CF enrichment)

**Inputs:**
- `symbol: string` — extraído do trade (ex: `MNQH6`)
- `boughtTimestamp: Date`
- `soldTimestamp: Date`
- `side: 'LONG' | 'SHORT'`

**Pipeline:**

```
yahooSymbol = mapToYahoo(symbol)              // MNQH6 → MNQ=F
bars = fetchYahoo1m(yahooSymbol, t1, t2)      // OHLC dentro do range
high = max(bars.map(b => b.high))
low  = min(bars.map(b => b.low))

if (side === 'LONG'):
  mepPrice = high
  menPrice = low
else (SHORT):
  mepPrice = low   // pico favorável de SHORT é preço mais baixo
  menPrice = high  // pior tick de SHORT é preço mais alto
```

**Symbol mapper inicial:**

| Espelho | Yahoo |
|---------|-------|
| MNQ\* | MNQ=F |
| NQ\* | NQ=F |
| ES\* | ES=F |
| MES\* | MES=F |
| MGC\* | GC=F |
| MCL\* | CL=F |
| MYM\* | YM=F |
| M2K\* | RTY=F |

(Sufixos de contract month como `H6`/`M6` ignorados — `=F` retorna front-month vigente.)

### Validação por lado (Fase 1, gateway)

```
if (side === 'LONG'):
  assert mepPrice >= max(entry, exit)
  assert menPrice <= min(entry, exit)

if (side === 'SHORT'):
  assert mepPrice <= min(entry, exit)
  assert menPrice >= max(entry, exit)
```

Falha de validação → erro do gateway, gravação rejeitada.

### Exemplo numérico (amostra real do CSV ProfitPro fornecido)

**Trade:** `WINM26` (mini-índice, futures), side `C` (LONG), qty 2.
- entry (`Preço Compra`) = `194.235,00`
- exit (`Preço Venda`) = `194.105,00`
- `MEP` (CSV) = `10,00` (pontos)
- `MEN` (CSV) = `-180,00` (pontos)

**Conversão:**

```
instrumentType = 'futures' (WIN prefix)
mepPrice = 194.235 + 10 = 194.245    (pico favorável durante o trade)
menPrice = 194.235 + (-180) = 194.055 (pior tick adverso)
```

**Validação LONG:**

```
max(entry, exit) = 194.235
min(entry, exit) = 194.105
mepPrice = 194.245 ≥ 194.235 ✓
menPrice = 194.055 ≤ 194.105 ✓
```

**Persistência:**

```javascript
trades/{id}: {
  ...campos existentes,
  mepPrice: 194245,
  menPrice: 194055,
  excursionSource: 'profitpro'
}
```

(Nota: storage interno em centavos? — confirmar com schema atual de `entry`/`exit`. Padrão do projeto é `number` em unidade base do instrumento; `194.245` armazenado como `194245` se em pontos centesimais ou `194.245` se em pontos. Verificar em Fase 1.)

### Casos limites

| Cenário | Comportamento |
|---------|---------------|
| Trade sem MEP/MEN no CSV | `mepPrice/menPrice = null`, `excursionSource: null` |
| Trade > 7d, broker sem MEP/MEN | `excursionSource: 'unavailable'`, gates marcam "insuficiente" |
| Yahoo retorna 0 bars (rate limit/falha) | `excursionSource: 'unavailable'`, log warn |
| Yahoo retorna bars parciais (gap durante trade) | computa com o que veio, marca `excursionSource: 'yahoo'` mesmo assim |
| Símbolo sem mapping Yahoo | `excursionSource: 'unavailable'` |
| Trade SHORT com timestamps invertidos (Tradovate) | parser detecta side por ordem dos timestamps; enrichment usa side correto |
| Aluno preenche manual depois de Yahoo já ter rodado | overwrite (`'manual'` sobrescreve `'yahoo'` — humano > automated) |

## Phases

- 1 — schema + gateway + preComputeShapes + testes
- 2 — form manual no AddTradeModal + DebugBadge + testes
- 3 — parser ProfitPro com conversão pts/% → preço + testes (amostra real WINM26)
- 4 — loader Yahoo + CF `enrichTradeWithExcursions` + symbol mapper + testes mock
- 5 — integração engine (gate "insuficiente" não-bloqueante) + Firestore trigger async para trades sem MEP/MEN + testes
- 6 — encerramento: DEC-AUTO-187-01..N em decisions.md, CHANGELOG, version.js bump, PR

## Sessions

- task 01 [fase-1-schema-gateway-precompute] commit `40692acf` ok — 30 novos testes (18 excursão + 12 advancedMetricsPresent), 2563/2563 total

## Shared Deltas

- `src/version.js` — bump v1.46.1 → v1.48.0 + finalizar entrada (encerramento)
- `docs/registry/versions.md` — marcar v1.48.0 consumida (encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-04 + CHUNK-07 (encerramento)
- `CHANGELOG.md` — nova entrada `[1.48.0] - DD/MM/2026 · #187 · PR #XXX`
- `docs/decisions.md` — DEC-AUTO-187-01..03 (já decididas) + adicionais durante execução
- `docs/firestore-schema.md` — campos novos em `trades`: `mepPrice`, `menPrice`, `excursionSource`
- `docs/cloud-functions.md` — nova CF callable `enrichTradeWithExcursions` + trigger `onTradeCreated` async
- `firestore.rules` — verificar regras existentes para campos novos (validação de tipos)

## Decisions

- DEC-AUTO-187-01 — storage como preço
- DEC-AUTO-187-02 — Yahoo + compute&discard 7d
- DEC-AUTO-187-03 — gate opcional/condicional (advancedMetricsPresent nunca `false`, só `true` ou `null`)
- DEC-AUTO-187-04 — threshold derivação: ≥10 trades + ≥80% com MEP+MEN não-null → `true`; senão `null`

## Chunks

- CHUNK-04 (Trade Ledger) — escrita: schema + gateway + preComputeShapes + form
- CHUNK-07 (CSV Import) — escrita: parser ProfitPro extension
- Maturity Engine — escrita (não em registry de chunks): gate "insuficiente" — tratado como shared file delta
- marketData CFs — escrita greenfield (não em registry): `functions/marketData/fetchYahooBars.js` + `functions/marketData/enrichTradeWithExcursions.js`
