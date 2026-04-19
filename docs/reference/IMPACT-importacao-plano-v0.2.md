---
name: Impact Doc — Importação e Plano
version: 0.2.0
status: approved
baseSpec: SPEC-importacao-plano-v1.0.md
baseVersion: IMPACT v0.1.0
author: Sessão C (CC)
reviewer: Sessão C (self-review contra repo)
data: 2026-04-19
epic: "#128"
---

# 1. Changelog

| Versão | Data | Mudança |
|--------|------|---------|
| 0.2.0 | 2026-04-19 | Absorção do self-review (2 HIGH + 2 MEDIUM + 1 LOW) e fechamento das 7 DECs + 5 Q-IMP. **Correções estruturais:** (HIGH-1) versão v1.33.0/v1.34.0 ocupadas → troca para **v1.35.0** (§5.1, §7.1, §13). (HIGH-2) nome `_raw` colide com uso em `orderReconstruction.js` → renomeado para `_rawPayload` em todos os pontos (§4.1, §4.2, DEC-085, DEC-090). (MEDIUM-3) rules mortas de subcoleção `partials` adicionadas ao delta de `firestore.rules` (§5.4). (MEDIUM-4) 5 call sites de `movements` reconhecidos no gateway proposto (§4.3, §7.4). (LOW-5) verificação de `src/constants/` incluída como pré-commit (§7.1). **Decisões Marcio:** DEC-084 subcampo (sem histórico); DEC-086 sem Cloud Tasks (Firestore trigger com retry nativo + reconciliação como safety net); DEC-087 staging flat (1 doc por operação); Q-IMP-01 manter nomes existentes `csvStagingTrades` + `ordersStagingArea`; Q-IMP-02 threshold R$ 1,00; Q-IMP-04 até 4 sessões paralelas (3 coders + 1 coordinator); Q-IMP-05 246 trades → backfill trivial. |
| 0.1.0 | 2026-04-19 | Primeira tradução spec-in → spec-out. |

---

# 2. Escopo deste documento

**Cobre:**
- Tradução de cada termo conceitual da SPEC v1.0 em nome concreto.
- Mecanismo técnico para cada invariante nova (INV-19 a INV-22) e anti-padrão novo (AP-09 a AP-12).
- Chunks do registry §6.3 afetados, ordem de ataque, locks necessários.
- Sequência de entrega em fases com critérios de aceite.
- Shared file deltas a aplicar no main antes de abrir worktrees.

**Não cobre:**
- Código (nenhuma linha é escrita nesta fase).
- Testes exaustivos — aqui vai apenas a estratégia; casos concretos ficam nas issues derivadas.

---

# 3. Inventário atual (verificado contra o repo em 2026-04-19)

## 3.1 Gateway único de trades — já existe

**Arquivo:** `src/utils/tradeGateway.js` (linhas 58-189 `createTrade`, 215-327 `enrichTrade`).

**Estado:** `createTrade` valida plano ativo, calcula result, cria doc em `trades` + doc em `movements`. `enrichTrade` aceita patch, preserva campos comportamentais, grava `_enrichmentSnapshot` inline (snapshot ÚNICO, sobrescrito a cada enrichment).

**Gap vs SPEC v1.0 (§5.3.A):** estrutura de 3 camadas (`_rawPayload`, projeção canônica, `_enrichments[]` append-only) é mudança estrutural. Exige migração.

## 3.2 Stagings existentes — mantidos

**Arquivos:** `src/hooks/useOrderStaging.js` (coleção `ordersStagingArea`), `src/hooks/useCsvStaging.js` + `src/components/csv/*` (coleção `csvStagingTrades`).

**Gap vs SPEC v1.0 (§5.3.B):** staging deve ser **conversacional** — sequência de perguntas (match / ambíguo / novo / autoliq). Issue #93 introduziu regressão de staging bypass.

**Decisão (DEC-087):** manter nomes existentes. Refatorar **conteúdo dos docs** adicionando `classification`, `matchCandidates`, `userDecision`. Zero migração de coleção.

## 3.3 Origem do trade — campo `source` ad hoc

**Verificado:** `source: 'order_import'` e `source: 'csv_import'` aparecem em testes, mas `tradeGateway.js:createTrade` não marca `source` explicitamente — depende do chamador.

**Gap vs SPEC v1.0 glossário:** `source ∈ {manual, import_performance, import_orders}` deve ser imutável, validado no gateway, via enum (DEC-089).

## 3.4 Cloud Functions de trade/movement — existem

**Arquivo:** `functions/index.js`.
- `onTradeCreated` (845), `onTradeUpdated` (1014), `onTradeDeleted` (1154)
- `onMovementCreated` (1191), `onMovementDeleted` (1200)
- `closeTrade` (791), `recalculateCompliance` (1275)
- `analyzeShadowBehavior` (1379) — **escreve inline em `trades`** (§12 VL-01 spec; WL-04 plano de remediação).

**Gap vs SPEC v1.0:** nenhuma CF de reconciliação periódica (INV-22). Nenhum recálculo assíncrono durável de shadow/IA pós-enrichment (HIGH-3 da spec).

## 3.5 Plano — CRUD disperso

**Arquivos:** `src/hooks/usePlans.js`, `src/components/plan/PlanManagementModal.jsx`, `src/pages/PropFirm*`, `src/pages/AccountsPage.jsx`.

**Gap vs SPEC v1.0 §6.B-6:** superfície canônica única `Contas > Plano` ainda não imposta. Edição de plano aparece em Mesa Prop, Accounts, modais — **AP-11 violado**.

## 3.6 Movements — 5 call sites diretos (MEDIUM-4 do self-review)

**Verificado:**
- `src/utils/tradeGateway.js:178` (dentro do gateway, ok)
- `src/hooks/useAccounts.js:154` (aporte/retirada)
- `src/hooks/useAccounts.js:218` (aporte/retirada)
- `src/hooks/useMovements.js:111` (CRUD direto via hook)
- `src/hooks/useTrades.js:391` (escrita **fora** do tradeGateway — possível violação de INV-02 para Movimento)

**Gap:** movementGateway proposto terá que absorver 5 pontos, não 2 como v0.1 sugeria.

## 3.7 Convenção `_rawPayload` (HIGH-2 do self-review)

**Verificado:** `_raw` já é usado em `src/utils/orderReconstruction.js:314,317` como campo interno de **ordem** (linha crua do CSV). Propor `_raw` também em `trades` causaria ruído semântico.

**Decisão:** usar `_rawPayload` (mais explícito) para a camada 1 do Detalhe do Trade.

## 3.8 Versão em prod (HIGH-1 do self-review)

**Verificado em `src/version.js`:**
- `VERSION.version = '1.32.0'` (consumida por #145, já mergeada)
- Changelog inline reserva `1.33.0` para #102 Revisão Semanal (em construção — CHUNK-16 LOCKED)
- Changelog inline reserva `1.34.0` para #146 (fix botão Novo Plano, já mergeado)
- **Próximo minor genuinamente livre: v1.35.0**

## 3.9 Colocações atuais das collections

| Nome | Propósito atual | SPEC v1.0 trata como |
|------|----------------|---------------------|
| `trades` | Fato trade | Agregado canônico — estrutura 3 camadas imposta |
| `plans` | Fato plano | Agregado canônico — superfície única `Contas > Plano` |
| `accounts` | Fato conta | Agregado canônico — Σ PLs ≤ saldo validado no gateway |
| `movements` | Fato movimento | Agregado canônico — movementGateway novo |
| `orders` | Fato ordem | Agregado canônico — já referenciado por trade |
| `csvStagingTrades` | Staging Import Performance | Mantida; staging conversacional acoplado (DEC-087) |
| `ordersStagingArea` | Staging Import Orders | Mantida; staging conversacional acoplado (DEC-087) |

---

# 4. Tradução spec-in → spec-out (nomes concretos)

## 4.1 Estrutura de 3 camadas do Trade (INV-21, §5.3.A)

| Conceito (spec) | Campo Firestore (concreto) | Notas |
|-----------------|---------------------------|-------|
| `rawPayload` | `_rawPayload` | Congelado pós-criação. |
| `canonicalFields` | Campos top-level do documento (entry, exit, qty, result, etc.) | Reprojeção materializada — estado atual, apenas formalizado. |
| `enrichments[]` | `_enrichments[]` | **Substitui** `_enrichmentSnapshot` atual. Array append-only. |
| `source` | `source ∈ {'manual','import_performance','import_orders'}` | Enum validado no gateway. Imutável (DEC-089). |
| `enrichment.source` | `origin ∈ {'import_performance','import_orders','manual_edit'}` | Distingue origem do enriquecimento. |
| `enrichment.timestamp` | `ts` (Firestore Timestamp) | |
| `enrichment.diff` | `diff` (map) | Snapshot dos campos antes do enrichment. |
| `enrichment.author` | `author` (uid) | |

**Por que prefix `_`:** convenção existente (`_partials` por INV-12, `_enrichmentSnapshot` atual).

**Migração (DEC-090):**
- 246 trades → batch único online, ~30 segundos, zero manutenção.
- Script `functions/migrate-trade-3layer.js` idempotente.
- Backfill lê cada doc, cria `_rawPayload` = snapshot do estado, converte `_enrichmentSnapshot` existente em primeira entrada de `_enrichments[]`.
- Commit separado removendo `_enrichmentSnapshot` pós-validação.

## 4.2 Mecanismo de imutabilidade de `_rawPayload` (DEC-085)

**Defesa em 2 camadas.**

**Camada 1 — Firestore rule** em `firestore.rules`:
```
// Pseudocódigo — implementação concreta na issue derivada
match /trades/{tradeId} {
  allow update: if isAuthenticated() &&
                   request.resource.data._rawPayload == resource.data._rawPayload;
}
```

**Camada 2 — CF guard:** `onTradeUpdated` verifica igualdade de `_rawPayload` before/after; se divergir, reverte via `updateDoc` e loga alerta.

## 4.3 Agregados canônicos — nomes de gateway

| Agregado | Gateway existente | Ação |
|-----------------|-------------------|------|
| Trade | `src/utils/tradeGateway.js` | Estender: 3 camadas, source enum, append-only enrichments |
| Plano | **Não há gateway dedicado** | **Criar** `src/utils/planGateway.js` — createPlan, updatePlan, setSuggestion, acceptSuggestion, dismissSuggestion, closeCycle |
| Conta | `AccountsPage.jsx` + `useAccounts.js` direto | **Criar** `src/utils/accountGateway.js` — createAccount, updateAccount. Invariante Σ PLs ≤ saldo. |
| Movimento | **5 call sites de addDoc(movements)** (§3.6) | **Criar** `src/utils/movementGateway.js` — createMovement unificado. Migrar os 5 sites. |
| Ordem | `useOrderStaging.ingestBatch` grava em `orders` | **Criar** `src/utils/orderGateway.js` e chamar do ingestBatch |

**Convenção:** todo gateway exporta funções puras `(data, userContext, deps?) => Promise<Result>`. Injeção via `deps` para testabilidade (padrão de `enrichTrade`).

## 4.4 Staging conversacional (§5.3.B) — DEC-087 flat

**Manter coleções existentes:**
- `csvStagingTrades` — 1 doc por operação de Import Performance
- `ordersStagingArea` — 1 doc por operação de Import Orders

**Adições aos docs (staging conversacional):**

```
(doc do staging){
  // campos atuais + novos abaixo
  classification: 'match_confident' | 'ambiguous' | 'new' | 'autoliq',
  matchCandidates: [{ tradeId, score }],
  userDecision: 'pending' | 'confirmed' | 'adjusted' | 'discarded',
  userDecisionAt: Timestamp,
  userAdjustments: map?,
  importBatchId: string,
  uploadedAt: Timestamp,
}
```

**Comportamento:**
- Aluno confirma operação → gateway cria trade + remove doc do staging (ou marca `confirmed` para auditoria).
- Aluno descarta → doc marcado `discarded` com `userDecisionAt`.
- Browser fecha no meio → docs pendentes persistem; ao voltar, tela lista "pendentes" via query `where userDecision == 'pending'`.

**Sem nova coleção.** Zero migração.

## 4.5 DEC-084 — `suggestedPlan` como subcampo

**Caminho:** `plans/{planId}.currentSuggestion` (subcampo do doc plano).

**Estrutura:**
```
plans/{id} {
  // campos atuais do plano +
  currentSuggestion: {
    status: 'pending',  // apenas 'pending' vive aqui; ao decidir, campo é limpo ou substituído
    trigger: 'cycle_close' | 'promotion_eval_funded' | 'user_demand',
    proposedPlan: { pl, riskPerOperation, rrTarget, ... },
    calculatedAt,
    kellyInputs: {...},
    montecarloSummary: {...},
    aiRationale: string,
  } | null
}
```

**Comportamento:**
- Sistema calcula ajuste → escreve em `currentSuggestion`.
- Aluno aceita → plano inteiro substituído pelo `proposedPlan`; `currentSuggestion` limpo.
- Aluno descarta → `currentSuggestion` limpo. **Sem histórico persistido** (decisão Marcio).

## 4.6 CFs novas (INV-22) — DEC-086 sem Cloud Tasks

### 4.6.1 `reconcileAggregates` — reconciliação periódica (INV-22, DEC-088)

**Arquivo novo:** `functions/reconcileAggregates.js`.

**Trigger:** `functions.pubsub.schedule('0 3 * * *').timeZone('America/Sao_Paulo')`.

**Comportamento:**
1. Para cada aluno ativo, Σ PL dos trades do ciclo ativo de cada plano.
2. Compara com `plans.currentPl` e `accounts.balance`.
3. Se `|diff| > R$ 1,00` (threshold default, DEC-088), escreve em nova coleção `reconciliationEvents/{eventId}` visível ao mentor.
4. Auto-heal **não implementado** (WL-01). Apenas alerta.

**Coleção nova:** `reconciliationEvents/{eventId}` com `studentId, planId?, accountId?, detectedAt, expected, actual, diff, aggregate, status, resolvedBy?, resolvedAt?`.

**Threshold configurável:** lido de `config/reconciliation/{aggregate}`.

### 4.6.2 Recálculo de shadow/IA pós-enrichment (DEC-086)

**Abordagem:** Firestore trigger direto, sem Cloud Tasks. Marcio aceitou risco raro de perda em exchange por zero custo de quota.

**Mitigações (3 camadas):**
1. **Retry nativo** do Firebase Functions v2 — on-failure, retry até 7 dias. Cobre crash durante execução.
2. **Reconciliação noturna (INV-22)** — detecta divergência persistente entre fato e opinião, alerta mentor.
3. **Log estruturado** em cada execução — permite reprocessar manualmente se tudo mais falhar.

**Mecanismo concreto:**
- `onTradeUpdated` CF detecta enrichment persistido → dispara `analyzeShadowBehavior` + CFs de IA sobre `canonicalFields` atualizado.
- Sem fila externa. Sem nova CF consumidora de fila.
- Custo: zero adicional.

## 4.7 Badge AutoLiq (§6.A-3)

No componente `src/components/importStaging/OperationCard.jsx` (novo), quando `operation.classification === 'autoliq'`, renderiza badge vermelho discreto: `<Badge variant="autoliq">Evento de sistema — AutoLiq detectado</Badge>`.

---

# 5. Shared file deltas (aplicar no main antes de worktrees)

## 5.1 `src/version.js`

Bump para **v1.35.0** (v1.33.0 reservada #102, v1.34.0 consumida #146).

```js
const VERSION = {
  version: '1.35.0',
  build: '20260419',
  display: 'v1.35.0',
  full: '1.35.0+20260419',
};
```

Entrada reservada no changelog inline:
```
 * - 1.35.0: arch: Épico #128 — Correção de Rota Importação + Plano (SPEC v1.0 + IMPACT v0.2). [RESERVADO]
```

**Commit:** `chore: reserva v1.35.0 para épico #128 bundle`.

## 5.2 `docs/PROJECT.md`

**5.2.1 Registry de Chunks (§6.3) — locks:**
- CHUNK-04 (Trade Ledger) → ISSUE-A
- CHUNK-07 (CSV Import) → ISSUE-B
- CHUNK-10 (Order Import) → ISSUE-C
- CHUNK-03 (Plan Management) → ISSUE-D
- CHUNK-17 (Prop Firm Engine) → ISSUE-E
- CHUNK-05 (Compliance Engine) → ISSUE-F

**5.2.2 Novos INVs:** INV-19 a INV-22 adicionados em §5.

**5.2.3 Novos APs:** AP-09 a AP-12 adicionados em §6.

**5.2.4 Novas DECs:** 057 a 063 (7 DECs consolidadas).

**5.2.5 VL-01** registrada como violação ativa rastreada.

## 5.3 `CLAUDE.md`

- INV-19 a INV-22 em INVARIANTES.
- AP-09 a AP-12 em ANTI-PATTERNS com contra-exemplos curtos.

## 5.4 `firestore.rules`

- **Remover** bloco `match /partials/{partialId}` dentro de `trades/{tradeId}` (linhas 97-101 atuais — rule morta pós-INV-12/DEC-024, MEDIUM-3 do self-review).
- **Nova regra** para `trades/{id}` — bloqueio de edit em `_rawPayload` e `source`.
- **Nova regra** para `reconciliationEvents/{id}` — read apenas mentor.

## 5.5 `functions/index.js`

Exports novos:
- `reconcileAggregates` (§4.6.1)

**Nenhum consumer de fila** (DEC-086). `analyzeShadowBehavior` continua sendo disparado via trigger nativo de `onTradeUpdated`.

---

# 6. Chunks afetados + issues derivadas

## 6.1 Mapa chunk → issue derivada

| Chunk | Issue | Escopo resumido | Modo | Lock |
|-------|-------|-----------------|------|------|
| CHUNK-04 | **ISSUE-A** | Gateway 3 camadas + source enum + migração `_rawPayload`/`_enrichments` + movementGateway (5 sites) | ESCRITA | sim |
| CHUNK-07 | **ISSUE-B** | Staging conversacional Import Performance + plano retroativo + fill explodido FEV-12 | ESCRITA | sim |
| CHUNK-10 | **ISSUE-C** | Staging conversacional Import Orders + fix bypass #93 + AutoLiq badge + ABR-17 | ESCRITA | sim |
| CHUNK-03 | **ISSUE-D** | Plano canônico: planGateway + superfície única `Contas > Plano` + accountGateway | ESCRITA | sim |
| CHUNK-17 | **ISSUE-E** | Mesa evaluation vs funded + algoritmo micro+agressivo + promoção fecha ciclo | ESCRITA | sim |
| CHUNK-05 | **ISSUE-F** | Reconciliação de agregados (INV-22) + coleção `reconciliationEvents` | ESCRITA | sim |
| CHUNK-16 (leitura) | N/A | `createWeeklyReview` reusa função de snapshot de `closeCycle` | LEITURA | não |

**Total:** 6 issues derivadas. Todas `arch:` (tocam gateway/invariantes) → **INV-19 requer bundle para cada**.

## 6.2 Issue paralela WL-04 (shadowBehavior)

**ISSUE-WL04** — migração de `shadowBehavior` inline para coleção dedicada. Bundle próprio. ~1 dia. Independente do épico #128.

## 6.3 Ordem de ataque (Q-IMP-04: até 4 sessões paralelas)

**Fase 1 (fundação — sequencial):** ISSUE-A. Bloqueia todas as outras porque muda schema de `trades`.

**Fase 2 (paralela com 3 coders + 1 coordinator):** ISSUE-B + ISSUE-C + ISSUE-D podem rodar simultâneas após Fase 1 completar.

**Fase 3:** ISSUE-E depende de ISSUE-D (planGateway já existindo).

**Fase 4:** ISSUE-F depende de Fases 1-3 em prod para ter dados reais.

**Paralelo independente a qualquer hora:** ISSUE-WL04.

---

# 7. Sequência de entrega em fases

## 7.1 Fase 0 — Pré-código (main)

1. Rodar `ls /home/mportes/projects/acompanhamento-2.0/src/constants/` para confirmar path do enum (LOW-5 do self-review). Se não existir, fallback para `src/utils/tradeSource.js`.
2. Reservar **v1.35.0** em `src/version.js` → commit.
3. Atualizar `docs/PROJECT.md` com INV-19 a INV-22, AP-09 a AP-12, DECs 057-063 → commit.
4. Atualizar `CLAUDE.md` com INVs/APs → commit.
5. Registrar locks no PROJECT.md §6.3 para CHUNK-04/07/10/03/17/05 → commit.
6. Abrir 7 issues (ISSUE-A a ISSUE-F + ISSUE-WL04) no GitHub com body: link para SPEC v1.0, campo "Chunks necessários", referência a este Impact Doc.
7. Criar arquivos de controle `docs/dev/issues/issue-NNN-*.md` para cada.

**Critério de saída:** locks registrados + 7 issues abertas + CLAUDE.md/PROJECT.md atualizados + v1.35.0 reservada.

## 7.2 Fase 1 — ISSUE-A (Gateway 3 camadas + movementGateway)

**Worktree:** `~/projects/issue-{A}`.

**Tarefas:**
1. Refactor `tradeGateway.js`: adicionar `_rawPayload`, `_enrichments[]`, enum `source` (DEC-089).
2. Migração: `functions/migrate-trade-3layer.js` idempotente. Backfill dos 246 trades.
3. Imutabilidade: `firestore.rules` bloqueia edit em `_rawPayload`; CF guard em `onTradeUpdated`.
4. Deprecation: `_enrichmentSnapshot` migra para primeira entrada de `_enrichments[]`.
5. Criar `src/utils/movementGateway.js` e migrar os 5 call sites (tradeGateway:178, useAccounts:154, useAccounts:218, useMovements:111, useTrades:391).
6. Limpar rule morta de `partials` subcoleção em `firestore.rules` (MEDIUM-3).
7. Testes: 100% cobertura de gateway (createTrade + enrichTrade com novas semânticas + fold policy + movementGateway).

**Critério de saída:** PR mergeado + migração executada + rule deployed + testes verdes + DebugBadge nas telas que mudaram + `grep addDoc\(collection\(db, 'movements'\)` retorna apenas `movementGateway.js`.

## 7.3 Fase 2 — ISSUE-B (Import Performance) + ISSUE-C (Import Orders) + ISSUE-D (Plano canônico)

Até 3 worktrees paralelos + 1 coordinator supervisionando via git.

**ISSUE-B:**
- Refactor `CsvImport*.jsx` → staging conversacional (DEC-087 flat).
- Badge "Sem plano vigente no período" para período sem plano ativo.
- Fold de fills explodidos (caso FEV-12 PAAPEX) — correlator antes do staging.
- Plano retroativo: "criar plano para este período" abre `Contas > Plano` com datas pré-preenchidas.

**ISSUE-C:**
- Refactor `OrderImport/*` → staging conversacional (DEC-087 flat).
- Classificação: match_confident / ambiguous / new / autoliq.
- Badge AutoLiq visível.
- Segmentação por ticker no mesmo dia (caso ABR-17 PAAPEX).
- Fix staging bypass do #93.
- Recálculo de shadow/IA via `onTradeUpdated` trigger nativo (DEC-086 sem fila).

**ISSUE-D:**
- Criar `src/utils/planGateway.js` + `src/utils/accountGateway.js`.
- Subcampo `plans/{id}.currentSuggestion` (DEC-084).
- `PlanManagementModal.jsx` como única superfície de CRUD. Outras telas viram sinalizadoras + redirecionamento.
- Invariante Σ PLs ≤ saldo.
- Validação de plano retroativo (sobreposição bloqueada).

**Critério de saída (cada uma):** PR + testes + DebugBadge + verificação via grep.

## 7.4 Fase 3 — ISSUE-E (Mesa evaluation vs funded)

Sequencial após ISSUE-D.

1. Refactor `PropFirmEngine/*` para usar `planGateway`.
2. Distinção eval/funded no algoritmo de criação.
3. Fix do bug micro+agressivo.
4. Promoção eval→funded fecha ciclo evaluation e abre ciclo funded.

**Critério de saída:** PR + testes + validação browser com conta Mesa real.

## 7.5 Fase 4 — ISSUE-F (Reconciliação)

Sequencial após Fase 3 (precisa de dados reais).

1. CF `reconcileAggregates` com schedule 03:00 BRT.
2. Coleção `reconciliationEvents`.
3. Tela mentor `MentorDashboard > Reconciliação`.
4. Threshold configurável em `config/reconciliation`, default R$ 1,00.
5. Alerta em falha persistente de CF crítica (DLQ do próprio Functions v2).

**Critério de saída:** PR + CF deployed + 1 ciclo executado em prod + threshold validado.

## 7.6 Fase paralela — ISSUE-WL04

Pode rodar a partir de Fase 1.

1. Nova coleção `shadow/{studentId}/patterns/{patternId}`.
2. Atualizar `analyzeShadowBehavior.js` para escrever lá.
3. Consumidores (`TradeDetailModal`, `FeedbackPage`, `ShadowBehaviorPanel`) leem da nova coleção.
4. Backfill dos trades existentes.
5. Remover escrita inline.
6. Remover campo inline dos docs em commit separado pós-validação.

**Critério de saída:** PR + backfill + grep sem `shadowBehavior` em `trades` + VL-01 marcada resolvida no PROJECT.md.

---

# 8. Estratégia de testes

| Fase | Framework | Cobertura mínima | Fixtures |
|------|-----------|------------------|----------|
| 1 | Vitest + jsdom | 100% tradeGateway + movementGateway | Trade manual, enrichment duplo, fold policy, 5 call sites migrados |
| 2B | Vitest + jsdom | Correlator fill explodido | FEV-12 PAAPEX |
| 2C | Vitest + jsdom | Correlator + segmentação ticker | ABR-17 PAAPEX |
| 2D | Vitest + jsdom | planGateway + accountGateway | Plano retroativo, aceite/descarte, ciclo fechado |
| 3 | Vitest + jsdom | Criação eval/funded + promoção | Mesa micro+agressivo, promotion day |
| 4 | Integração real | 1 ciclo completo em test tenant | Dados sintéticos de 30 dias |
| WL04 | Vitest + jsdom | Backfill idempotente | Shadow inline + shadow dedicada |

---

# 9. Riscos e mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migração de 246 trades quebrar (Fase 1) | Baixa | Médio | Script idempotente + dry-run em test tenant + backup do Firestore antes |
| Rule bloqueia legitimamente update em `_rawPayload` mas admin SDK passa | Baixa | Médio | CF guard em `onTradeUpdated` reverte |
| Recálculo de shadow/IA perde evento raro | Baixa | Baixo | 3 camadas de mitigação (DEC-086): retry nativo + reconciliação + log |
| Staging conversacional piora UX | Média | Alto | Validação em voz com Marcio após ISSUE-B antes de ISSUE-C |
| Plano retroativo conflita com dados históricos | Média | Médio | Bloqueio de sobreposição no gateway + mensagem clara |
| Σ PLs ≤ saldo quebra contas em bust | Média | Alto | Validação apenas em criação/edição de plano, não em trades |
| Threshold R$ 1,00 gera alertas demais | Média | Baixo | Configurável em `config/reconciliation` — calibrar pós-deploy |
| 4 sessões paralelas geram conflito em shared files | Média | Médio | Fase 0 no main aplica todos os deltas antes de worktrees; durante Fase 2, shared files ficam congelados |

---

# 10. Dependências externas

- **#102 (Revisão Semanal):** dependência bidirecional (SPEC §10). CHUNK-16 LOCKED para #102. Fase 4 (reconciliação) pode rodar em paralelo. Merge de #102 em main antes da Fase 0 é **pré-requisito** (resolve conflito Sidebar.jsx trivial).
- **#129 (Shadow 15 patterns):** consumidor de `canonicalFields` atualizado. ISSUE-WL04 remove acoplamento.
- **#131 (Dashboard Emocional):** consumidor de AutoLiq detectado. Apenas leitura.

---

# 11. DebugBadge (INV-04)

Componentes novos/tocados:
- `OperationCard.jsx` (staging conversacional) → `component="OperationCard"`
- `ImportStagingView.jsx` (tela principal de staging) → `component="ImportStagingView"`
- `PlanSuggestionPanel.jsx` (aceite/descarte de `currentSuggestion`) → `component="PlanSuggestionPanel"`
- `ReconciliationEventsList.jsx` (tela mentor) → `component="ReconciliationEventsList"`
- Qualquer componente de plano que mudar lado de consumo do gateway.

Embedded: `{!embedded && <DebugBadge component="..." />}`.

---

# 12. DECs consolidadas para PROJECT.md

| ID | Decisão | Status |
|----|---------|--------|
| DEC-084 | `suggestedPlan` como subcampo `plans/{id}.currentSuggestion` — sem histórico de sugestões passadas | Aprovada |
| DEC-085 | Imutabilidade de `_rawPayload` via defesa 2 camadas: `firestore.rules` + CF guard em `onTradeUpdated` | Aprovada |
| DEC-086 | Recálculo de shadow/IA via Firestore trigger nativo (sem Cloud Tasks). Mitigações: retry nativo + reconciliação noturna + log estruturado | Aprovada |
| DEC-087 | Staging conversacional em formato flat (1 doc por operação) em coleções existentes `csvStagingTrades` e `ordersStagingArea`, refatorando conteúdo dos docs | Aprovada |
| DEC-088 | Reconciliação via `pubsub.schedule('0 3 * * *')` BRT, threshold default R$ 1,00, override via `config/reconciliation/{aggregate}` | Aprovada |
| DEC-089 | Enum `source ∈ {manual, import_performance, import_orders}` imutável, validado no gateway, em `src/constants/tradeSource.js` (ou `src/utils/` como fallback — confirmar em Fase 0) | Aprovada |
| DEC-090 | Migração `_enrichmentSnapshot` → primeira entrada de `_enrichments[]` via script idempotente; commit separado removendo `_enrichmentSnapshot` pós-validação. 246 trades = batch único ~30s | Aprovada |

---

# 13. Q-IMP consolidadas

| ID | Pergunta | Resolução |
|----|----------|-----------|
| Q-IMP-01 | Nome da coleção de staging | **Manter nomes existentes** (`csvStagingTrades` + `ordersStagingArea`), refatorar conteúdo. Zero migração. |
| Q-IMP-02 | Threshold inicial da reconciliação | **R$ 1,00** default. Calibrar empírico pós-deploy. |
| Q-IMP-03 | Versão minor ou major | **v1.35.0** (minor). v1.33.0 reservada #102, v1.34.0 consumida #146. |
| Q-IMP-04 | Ordem das Fases | **Até 4 sessões paralelas** (3 coders + 1 coordinator) comunicando via git com supervisão Marcio. Fase 1 sequencial; Fase 2 paralela (B+C+D). |
| Q-IMP-05 | Volume de trades em prod | **246 trades, 10 alunos ativos**. Backfill trivial em batch único. |

---

# 14. Checklist de aprovação do bundle (INV-19)

- [x] SPEC-importacao-plano-v1.0.md aprovada
- [x] IMPACT-importacao-plano-v0.2.md revisado e aprovado (este doc)
- [ ] AI Review Log consolidado anexo ao control file — **pendente**
- [x] Q-IMP-01 a Q-IMP-05 respondidas
- [x] DECs 057-063 aprovadas
- [ ] Fase 0 executada (shared file deltas commitados no main) — **pendente, aguarda #102 fechar**
- [ ] 7 issues abertas no GitHub com Chunks necessários declarados — **pendente**
- [ ] Locks registrados no PROJECT.md §6.3 — **pendente**

**Pré-condição:** #102 (Revisão Semanal) deve ser mergeada em main antes da Fase 0, resolvendo o conflito trivial em `Sidebar.jsx` (união de 3 ícones lucide-react).

---

**Fim do Impact Doc v0.2. Bundle pronto para execução da Fase 0 assim que #102 mergear.**
