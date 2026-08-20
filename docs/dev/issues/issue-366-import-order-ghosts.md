# Issue #366 — fix: import de ordens grava antes da decisão do aluno

## Autorização

- [x] Mockup apresentado (seção abaixo — mudanças de UI são banners/cards, sem tela nova)
- [x] Memória de cálculo — N/A (não há fórmula; a "regra" é de identidade de ordem, documentada em Spec)
- [x] Marcio autorizou — 20/08/2026, aprovação do plano em modo plano (`/plan`), após revisão de desenho
- [x] Gate Pré-Código liberado

## Context

Import travado em produção com `Missing or insufficient permissions` na Revisão de Operações. O erro é
sintoma: o wizard grava em `orders` **antes** da decisão por operação, então descartar não descarta, e
a reimportação (fix #362, `set(merge)` sobre doc existente) bate em `allow update: if false`. Somado a
isso não há dedup de entrada, aviso de lote pendente nem cleanup ao sair.

Objetivo: `orders` só recebe escrita depois da decisão e só das confirmadas; porta de entrada
reconhece o que já existe; sair não deixa resíduo; lote pendente visível e retomável; passivo apagado.

## Spec

Ver issue body: #366. Plano de execução completo (7 fases + furos mapeados na revisão de desenho):
`/home/mportes/.claude/plans/tender-booping-tide.md`.

**Identidade de ordem (regra central):** `makeOrderKey` (`src/utils/orderKey.js:23`) devolve `eid:<id>`
quando há `externalOrderId`, senão `comp:<instrument>|<side>|<submittedAt>|<quantity>|<filledAt>`. Doc
gravado antes do #362 **não tem** `externalOrderId` → gera `comp:`, enquanto a ordem entrante gera
`eid:`. As duas chaves nunca colidem, logo toda dedup precisa ser **bi-chave**.

## Mockup

**PREVIEW — banner de dedup (novo, acima da tabela):**
`⚠ 12 de 17 ordens já foram importadas (último lote 19/08/2026).` — as duplicadas entram
pré-excluídas; botão secundário `Importar mesmo assim` limpa a exclusão. Todas duplicadas → banner
vira bloqueio e o botão de avançar fica desabilitado.

**UPLOAD — banner de lote pendente (novo, topo):**
`Você tem uma importação não finalizada — 17 ordens, 20/08/2026.` + `Retomar` / `Descartar`.

**Dashboard — card de lote pendente (novo, ao lado do CsvImportCard):**
`Ordens em rascunho · 17 ordens · 1 lote` → abre manager com Retomar / Descartar (confirm danger).

**Decisão por Operação — gate de pendentes:** ao concluir com N ops sem decisão, confirm:
`N operações sem decisão. As ordens delas não serão importadas. Continuar?`

**Header do wizard:** X desabilitado durante `STAGING_WRITE` e `INGESTING`; nos demais passos com lote
vivo, confirm `Descartar importação em andamento? As N ordens do rascunho serão removidas.`

## Phases

| # | Fase | Estado |
|---|------|--------|
| 0 | Testes primeiro (INV-05) | ok |
| 1 | Helpers puros — `orderImportPipeline.js` + `orderDedup.js` | ok (`716d7fb2`) |
| 2 | `ingestBatch` idempotente (skip de existentes, BATCH_SIZE 200, retry-safe, `importTimezone`, tenant) | ok (`a4da6d33`) |
| 3 | Mover a escrita para depois da decisão (`OrderImportPage`) | ok (`ae3c44b3`) |
| 4 | Dedup no PREVIEW + banner de lote pendente | ok (`90e5e052`) |
| 5 | Sair sem resíduo (confirm, X travado, `beforeunload`) | ok (`90e5e052`) |
| 6 | Card + manager de lote pendente, com retomada | ok (`00b45b0d`) |
| 7 | Script de limpeza do passivo (dry-run → apply) | dry-run ok — apply pendente (bloqueio de permissão; Marcio roda) |

## Passivo medido (dry-run 20/08/2026)

651 ordens lidas · 348 trades vivos · **519 abandonadas** em 3 lotes:

| Lote | Aluno | Data | Ordens | Composição |
|---|---|---|---|---|
| `ord_1787256854597_c6s1yu` | Marcio | 20/08/2026 | 17 | 10 FILLED + 7 CANCELLED — o lote que travou e originou o issue |
| `ord_1779999250591_psdaxk` | Wagner | 28/05/2026 | 500 | 273 FILLED + 226 CANCELLED + 1 REJECTED (ordens de fev-mar) |
| `ord_1780083831444_atsyeh` | Elza | 29/05/2026 | 2 | 2 CANCELLED sem correlação |

Wagner tem **zero trades** no sistema: nada a correlacionar, nem por backfill.
Nenhuma das 519 tem `correlatedTradeId` para trade vivo. Preservadas: 70 (batch gerou
trade) + 62 (ligadas a trade vivo).

## Shared Deltas

- `src/version.js` — reserva v1.83.15 (main, feito)
- `docs/registry/versions.md` + `docs/registry/chunks.md` — lock CHUNK-10 + CHUNK-04 (main, feito)
- `docs/firestore-schema.md` — campo `importTimezone` em `ordersStagingArea` (INV-15 aprovado por
  Marcio em 20/08/2026; editar no main no encerramento)
- `CHANGELOG.md` — no encerramento

## Decisions

- DEC-AUTO-366-01 — não abrir `update` em `/orders`; ingest pula doc existente e toda escrita vira `create`
- DEC-AUTO-366-02 — ordem obrigatória no passo final: ordens confirmadas → depois trades (guarda do #351)
- DEC-AUTO-366-03 — dedup bi-chave (`eid:` + `comp:`) escopada por `studentId`
- DEC-AUTO-366-04 — `importTimezone` persistido no staging (INV-15)
- DEC-AUTO-366-05 — crossCheck mantém a semântica de confronto contra trades pré-existentes

## Dívidas identificadas (fora do escopo)

- Fills múltiplos do mesmo `externalOrderId` colapsam num doc só (`orderFillAggregator.js:50-65` ×
  id determinístico) — teste `.skip` documentando
- `cleanupOrphans.js:202` faz `deleteDoc` em `orders` — sempre negado, caminho morto
- `useOrders` sem índice composto (`useOrders.js:48`) — roda sempre pelo fallback

## Chunks

CHUNK-10 (ESCRITA) · CHUNK-04 (ESCRITA)
