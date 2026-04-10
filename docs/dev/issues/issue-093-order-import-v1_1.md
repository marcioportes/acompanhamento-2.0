# Issue 093 — feat: Order Import v1.1 - Criacao Automatica + Confronto Enriquecido + Deduplicacao
> **Branch:** `feature/issue-093-order-import-v1.1`
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Aberto em:** 04/04/2026
> **Status:** 🔵 Em andamento — REDESIGN 08/04/2026
> **Versao entregue:** —

---

## 1. CONTEXTO

Follow-up do #87 (CHUNK-10 v1.0, mergeado 22/03/2026). O v1.0 importa ordens para a collection `orders`. O v1.1 transforma ordens importadas em trades reais no diario.

### 1.1 ERRATA DE DESIGN (08/04/2026)

O design original (04/04/2026) tratava o Order Import como ferramenta de **auditoria** — ordens iam para a collection `orders` e o "Modo Criacao" exigia clique manual num botao (GhostOperationsPanel) para criar trades. Esse design foi **erro da sessao master (Opus 4.6)**, nao solicitacao do Marcio.

**Problema raiz:** confusao entre airlock (INV-01) e confirmacao manual. O airlock correto e a tela de staging review (onde o aluno seleciona quais operacoes confirmar). Apos confirmacao, trades devem ser criados automaticamente — como o CSV Import de performance faz.

**Redesign aprovado pelo Marcio (08/04/2026):** o fluxo correto e:
```
CSV ordens → parse → reconstruir operacoes → staging review (selecao) → confirmar
  → operacoes SEM trade correspondente → createTrade AUTOMATICO (sem clique extra)
  → operacoes COM trade correspondente → Confronto (enriquecer parciais + stop + precos)
  → operacoes MISTAS (parcialmente correlacionadas) → Confronto (nao cair em limbo)
```

### 1.2 ENTREGAS REVISADAS

- **V1.1a — Criacao Automatica:** operacoes confirmadas sem trade correspondente viram trades automaticamente via `createTrade` (tradeGateway.js) no ato da confirmacao. Sem painel intermediario, sem botao extra. Campos comportamentais (emotion, setup) ficam pendentes. CFs disparam normalmente.
- **V1.1b — Confronto Enriquecido:** operacoes confirmadas COM trade correspondente enriquecem o trade existente: reconstroem `_partials` reais, verificam stop (presenca e preco), corrigem precos de entrada/saida com dados exatos da corretora. Divergencias sinalizadas.
- **V1.1c — UI Master/Detail:** componente `TradeOrdersPanel` dentro de TradeDetailModal e FeedbackPage. **JA IMPLEMENTADO.**
- **V1.1d — Deduplicacao retroativa:** hash de campos-chave protege contra reimportacao. **JA IMPLEMENTADO.**

### 1.3 TRATAMENTO DE OPERACOES MISTAS

Operacao mista = algumas ordens correlacionam com trade existente, outras nao.

Regra: se a operacao reconstruida tem QUALQUER ordem correlacionada com um trade existente, ela entra no Modo Confronto (nao no Modo Criacao). O Confronto mostra as divergencias incluindo ordens adicionais que o trade manual nao capturou.

Se a operacao NAO tem nenhuma ordem correlacionada → Modo Criacao (automatico).

Operacoes mistas NUNCA caem em limbo.

### 1.4 CONSIDERACOES TECNICAS (da revisao externa)

**Throttling de batch:** se o CSV gera > 20 trades de uma vez, criar sequencialmente (nao paralelo) para evitar contencao nas CFs. FieldValue.increment e atomico para PL/saldo, mas muitas CFs simultaneas geram latencia. UI deve mostrar indicador de progresso durante criacao em batch.

**Validacao de resolucao temporal:** na parse, verificar se timestamps do CSV tem segundos ou apenas minutos. Propagar flag `lowResolution: true` nos trades criados (campo no trade doc). Issues futuros (shadow trade) consomem essa flag para ajustar thresholds de deteccao comportamental — padroes que dependem de segundos ficam como 'inconclusive' em vez de false positive.

## 2. ACCEPTANCE CRITERIA

### Criacao Automatica (V1.1a — REDESIGN)
- [ ] Apos confirmacao no staging review, operacoes sem trade correspondente sao convertidas em trades automaticamente via createTrade
- [ ] NAO requer clique adicional — criacao e consequencia da confirmacao
- [ ] GhostOperationsPanel removido ou simplificado para informar resultado ("X trades criados")
- [ ] Campos comportamentais (emotionEntry, emotionExit, setup) ficam vazios para complemento
- [ ] source: 'order_import' + importSource: 'order_import' em cada trade criado
- [ ] CFs (onTradeCreated, compliance, PL, movements) disparam normalmente
- [ ] Deduplicacao verificada ANTES de criar (hash existente do V1.1d)
- [ ] Labels do STEP DONE mostram contagens corretas: "X ordens importadas, Y trades criados, Z trades correlacionados"
- [ ] Throttling: batch > 20 trades → criacao sequencial com indicador de progresso
- [ ] Flag `lowResolution: true` no trade se timestamps do CSV nao tem segundos

### Confronto Enriquecido (V1.1b — REDESIGN)
- [ ] Operacoes com trade correspondente enriquecem `_partials` com dados reais das ordens (entradas e saidas individuais com timestamps e precos exatos)
- [ ] Verifica presenca de stop: se corretora mostra stop order e trade no Espelho nao tem stopPrice, sinaliza divergencia
- [ ] Verifica preco do stop: se trade diz stop em X e corretora mostra stop em Y, sinaliza divergencia
- [ ] Corrige precos de entrada/saida: precos manuais substituidos por precos exatos de execucao da corretora
- [ ] Operacoes mistas (parcialmente correlacionadas) entram no Confronto, nunca em limbo
- [ ] Acao "Aceitar enriquecimento" atualiza trade existente com parciais/stop/precos da corretora + `enrichedByImport: true` + `enrichedAt: Timestamp`
- [ ] Acao "Manter manual" vincula correlatedTradeId sem modificar o trade
- [ ] Divergencias exibidas visualmente lado a lado
- [ ] Testes cobrindo: enriquecimento parciais, deteccao stop ausente, correcao precos, ops mistas

### Ja implementado (manter)
- [ ] Componente `TradeOrdersPanel` funcional em TradeDetailModal ✅
- [ ] Componente `TradeOrdersPanel` funcional em FeedbackPage ✅
- [ ] Hash de deduplicacao protege contra reimportacao de CSV ✅
- [ ] DebugBadge em todos os componentes novos/tocados ✅
- [ ] tradeGateway.js extraido e testado (Fases 0-2) ✅
- [ ] Cross-Check removido do dashboard-aluno (movido para #102 Revisao Semanal) ✅

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `orders` (leitura), `trades` (escrita via createTrade + update parciais/stop), `plans` (side-effect PL) |
| Cloud Functions afetadas | `onTradeCreated` (dispara para trades criados), `onTradeUpdated` (dispara para enriquecimento) |
| Hooks/listeners afetados | `useTrades`, TradeDetailModal, FeedbackPage, OrderImportPage |
| Side-effects | PL recalculado para novos trades. Enriquecimento de parciais/stop pode afetar compliance |
| Blast radius | MEDIO-ALTO — criacao automatica irreversivel. Enriquecimento modifica trades existentes |
| Rollback | Trades criados: DELETE via script. Enriquecimento: `enrichedByImport: true` + snapshot para rollback |

### 3.1 Riscos criticos

**Risco 1 — Batch grande:** N trades simultaneos → N CFs. Mitigacao: throttling sequencial para batch > 20. FieldValue.increment atomico confirmado na Fase 0.

**Risco 2 — Enriquecimento modifica trade existente:** updateDoc dispara onTradeUpdated → recalcula PL e compliance. Side-effect visivel mas CORRETO (corrige dados errados).

**Risco 3 — Ops mistas em limbo:** `identifyGhostOperations.every()` exclui ops parcialmente correlacionadas. Corrigir: ANY correlacao → Confronto.

**Risco 4 — Labels mentindo:** STEP DONE mostra contagens do parse cheio. Corrigir para contagens confirmadas.

**Risco 5 — Resolucao temporal:** CSVs com timestamps so em minutos podem gerar dados imprecisos em trades criados. Mitigacao: flag lowResolution propagado.

### 3.2 Invariantes

| Invariante | Aplicacao |
|------------|-----------|
| INV-01 (Airlock) | Airlock = staging review. Apos confirmacao, createTrade e caminho validado |
| INV-02 (Gateway) | Toda escrita via createTrade (tradeGateway.js) |
| INV-03 (Pipeline) | Trades criados e enriquecidos disparam CFs normalmente |
| INV-04 (DebugBadge) | Em todos componentes novos/tocados |
| INV-05 (Testes) | Criacao automatica, enriquecimento, ops mistas, labels, throttling, lowResolution |
| INV-12 (Parciais) | `_partials` array inline — reconstruidos pelas ordens |

### 3.3 Shared files

| Arquivo | Delta | Protocolo |
|---------|-------|-----------|
| `src/version.js` | Bump na entrega | Propor no doc do issue |
| `docs/PROJECT.md` | DECs e CHANGELOG | Propor no doc do issue |

## 4. SESSOES

### Sessao — 04/04/2026 — Briefing Master (Opus 4.6)

**Decisoes aprovadas:**

| # | Decisao | Status |
|---|---------|--------|
| 1 | Campo `source: 'order_import'` nos trades criados | APROVADO |
| 2 | Modo Confronto: DELETE + CREATE viavel | APROVADO |
| 3 | Deduplicacao: hash ticker+side+entryTime+-5min+qty | APROVADO |
| 4 | Gateway: extrair logica para tradeGateway.js (Opcao A) | APROVADO |

### Sessao — 04-05/04/2026 — Claude Code (Fases 0-3 + V1.1c + V1.1d)

**Completado:** Fase 0 (cross-check addTrade), Fase 1 (tradeGateway.js), Fase 2 (rewire hook), Fase 3 (Modo Criacao — design errado), V1.1c (TradeOrdersPanel), V1.1d (deduplicacao), Cross-Check removido do dashboard. 838+ testes.

**DTs encontrados:** DT-030 (batch setSuspendListener), DT-031 (balanceBefore/After batch).

### Sessao — 08/04/2026 — Redesign Master (Opus 4.6)

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| — | Criacao automatica (sem GhostOperationsPanel) | Airlock = staging review |
| — | Confronto enriquece parciais + stop + precos | Ordens tem dados reais |
| — | Ops mistas → Confronto (nunca limbo) | every() → some() |
| — | Labels refletem confirmadas | Parse cheio ≠ confirmado |
| — | Throttling batch > 20 | Contencao CFs (critica externa) |
| — | Flag lowResolution em trades | Timestamps sem segundos (critica externa) |

### Sessao — 09-10/04/2026 — Claude Code (Redesign Fases 1-7)

**Tipo:** codigo + testes + gate pre-entrega

**O que foi feito (7 fases):**

| Fase | Commit | Descricao |
|------|--------|-----------|
| 1 | `46fc9a75` | `lowResolution` flag na parse + propagacao no tradeData |
| 2 | `0b0406d6` | `categorizeConfirmedOps` — 3 grupos (ghost/confront/ambiguo) via _rowIndex |
| 3a | `9023e636` | `orderTradeBatch` helper — criacao automatica com throttling >20 |
| 3b | `3cd492a9` | `CreationResultPanel` — display read-only de trades criados |
| 3c | `ba979e83` | Refactor handleStagingConfirm — criacao automatica, delete GhostOperationsPanel |
| 4a | `557253ae` | `TradeStatusBadges` + labels STEP DONE consumindo importSummary |
| 4b | `59b90993` | Integracao badges em TradesList, TradeDetailModal, ExtractTable, FeedbackPage |
| 5a | `3d8f9b14` | `enrichTrade` no tradeGateway — enriquecimento com snapshot |
| 5b | `5249c29f` | `AmbiguousOperationsPanel` — MVP informativo |
| 5c | `a94e4b70` | Refactor MatchedOperationsPanel — enriquecimento em vez de DELETE+CREATE |
| 5d | `af5a1a1d` | Refactor OrderImportPage + limpeza codigo legado (-491 linhas) |
| 6 | `37b1c31c` | Testes de integracao end-to-end (10 cenarios) |
| 7 | (este) | Gate pre-entrega: version.js, issue file, CHANGELOG |

**Decisoes tomadas (aprovadas pelo Marcio):**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| A | `enrichTrade` no tradeGateway (INV-02) | Gateway unico cobre criacao E enriquecimento |
| B | CreationResultPanel read-only (substitui GhostOperationsPanel) | Aluno quer ver o que foi criado |
| C | Dedup: pula silenciosamente, conta em importSummary | Label informativa |
| D | Throttling threshold = 20 | Abaixo paralelo, acima sequencial |
| E | Snapshot inline (_enrichmentSnapshot) | Sem subcollection, sobrescreve anterior |
| F | Ops mistas → 3 grupos (toCreate/toConfront/ambiguous) | Ops nunca caem em limbo |

**Testes:** 953 testes totais (46 test files). Delta: +80 testes novos, -17 testes legado removidos.

**Arquivos criados:** orderTemporalResolution.js, orderTradeBatch.js, orderKey.js, CreationResultPanel.jsx, AmbiguousOperationsPanel.jsx, TradeStatusBadges.jsx + 5 arquivos de teste.

**Arquivos deletados:** GhostOperationsPanel.jsx.

**Codigo legado removido:** identifyGhostOperations, prepareBatchCreation, identifyMatchedOperations, prepareConfrontBatch, handleUpdateMatched (DELETE+CREATE), handleCreateGhostTrades.

## 5. ENCERRAMENTO

**Status:** Aguardando PR + merge + validacao manual
**Versao entregue:** v1.24.0

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] PROJECT.md atualizado (DEC, DT, CHANGELOG)
- [ ] PR aberto e mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
- [ ] Locks de chunks liberados no registry

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-10 | escrita | Order Import, matching, deduplicacao |
| CHUNK-04 | escrita | TradeDetailModal + createTrade + enriquecimento parciais |
| CHUNK-07 | leitura | Referencia deduplicacao |
| CHUNK-08 | escrita | FeedbackPage (TradeOrdersPanel) |
