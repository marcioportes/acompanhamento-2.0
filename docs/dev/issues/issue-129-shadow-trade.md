# Issue 129 — feat: Shadow Trade + Padroes Comportamentais
> **Branch:** `feat/issue-129-shadow-trade`  
> **Milestone:** v1.2.0 — Mentor Cockpit  
> **Aberto em:** 13/04/2026  
> **Status:** Aguardando PR  
> **Versao entregue:** v1.28.0

---

## 1. CONTEXTO

Analise comportamental por trade a partir de ordens da corretora. O Order Import v1.0 (#87) trouxe ordens para a collection `orders` e o v1.1 (#93) criou trades automaticamente a partir dessas ordens. O proximo passo e analisar o comportamento do trader por trade usando os dados das ordens (timestamps, stop moves, clustering, hesitacao, saida antecipada).

O resultado e um objeto `shadowBehavior` fixo no documento do trade — visivel apenas ao mentor. 13 padroes deterministicos com mapeamento emocional (REVENGE_CLUSTER, GREED_CLUSTER, IMPULSE_CLUSTER, HOLD_ASYMMETRY, STOP_PANIC, EARLY_EXIT, OVERTRADING, HESITATION, AVERAGING_DOWN, FOMO_ENTRY, LATE_EXIT, CLEAN_EXECUTION, TARGET_HIT).

Inclui `marketContext` (ATR + sessao) e flag `lowResolution` para timestamps com resolucao de minutos.

**Epico pai:** #128 (Pipeline Unificado de Import de Ordens)
**Depende de:** #93 (trades criados + ordens correlacionadas) — FECHADO

## 2. ACCEPTANCE CRITERIA

- [ ] Objeto `shadowBehavior` gravado no documento do trade apos correlacao com ordens
- [ ] 13 padroes deterministicos implementados com deteccao + severidade + mapeamento emocional
- [ ] `marketContext` (ATR + sessao) presente no shadowBehavior
- [ ] Flag `lowResolution` propagada e respeitada (padroes dependentes ficam `inconclusive`)
- [ ] Visivel apenas ao mentor (UI condicional por role)
- [ ] Testes unitarios para cada padrao
- [ ] Testes de integracao para pipeline ordens → shadowBehavior
- [ ] DebugBadge em componentes novos/tocados

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `trades` (escrita: campo shadowBehavior), `orders` (leitura) |
| Cloud Functions afetadas | Nova CF callable `analyzeShadowBehavior`. Guard existente em `onTradeUpdated:1033` ja cobre (early return quando so shadowBehavior muda) |
| Hooks/listeners afetados | `useTrades` ja consome trades — campo shadowBehavior vem no snapshot automaticamente |
| Side-effects (PL, compliance, emotional) | Nenhum — shadowBehavior e campo informativo, nao altera PL/compliance |
| Blast radius | Baixo — campo novo adicional no trade, sem alterar campos existentes |
| Rollback | Remover campo shadowBehavior dos docs (campo opcional, sem dependencias) |

## 4. SESSOES

### Sessao 1 — 13/04/2026

**O que foi feito:**
- Abertura de sessao: protocolo 4.0 completo
- Lock CHUNK-04 registrado no PROJECT.md
- Worktree criado em ~/projects/issue-129
- Arquivo de controle criado
- Gate Pre-Codigo: analise de impacto, proposta com 3 camadas de resolucao, aprovada
- Engine `shadowBehaviorAnalysis.js` implementado — 13 detectores, 2 camadas, funcao pura
- 57 testes unitarios cobrindo todos os 13 padroes + engine principal + batch
- `ShadowBehaviorPanel.jsx` — UI mentor-only com severity badges, evidence colapsavel, DebugBadge
- CF callable `analyzeShadowBehavior` — analise retroativa por periodo, batch commit
- 1243 testes totais passando (53 suites), zero regressao

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| DEC-PENDING-1 | Shadow behavior em 3 camadas de resolucao (LOW/MEDIUM/HIGH) | Todos os trades recebem analise (camada 1 = parciais + contexto inter-trade). Orders enriquecem quando disponiveis (camada 2). |
| DEC-PENDING-2 | Guard onTradeUpdated nao precisa de edicao | Guard existente (linha 1033) ja faz early return quando so shadowBehavior muda — resultChanged, planChanged e complianceChanged sao todos false |
| DEC-PENDING-3 | ShadowBehaviorPanel em src/components/Trades/ | Dominio de trades, nao de OrderImport. Consumido por TradeDetailModal e FeedbackPage |

**Arquivos criados:**
- `src/utils/shadowBehaviorAnalysis.js` — engine puro, 13 detectores, 2 camadas
- `src/__tests__/utils/shadowBehaviorAnalysis.test.js` — 57 testes
- `src/components/Trades/ShadowBehaviorPanel.jsx` — UI mentor-only
- `functions/analyzeShadowBehavior.js` — CF callable
- `src/hooks/useShadowAnalysis.js` — hook wrapper da CF callable
- `src/__tests__/hooks/useShadowAnalysis.test.js` — 5 testes do hook
- Botao "Analisar comportamento" na FeedbackPage (mentor-only, escopo dia do trade)

**Arquivos tocados:**
- `docs/dev/issues/issue-129-shadow-trade.md` (criacao + atualizacao)
- `docs/PROJECT.md` (lock CHUNK-04)

**Delta para shared files (§6.2 — NAO editar direto):**

**`functions/index.js`** — delta APLICADO no worktree (excecao §6.2 autorizada pelo Marcio 14/04/2026):
```javascript
// ============================================
// SHADOW BEHAVIOR — Padrões comportamentais (CHUNK-04, issue #129)
// ============================================
exports.analyzeShadowBehavior = require("./analyzeShadowBehavior");
```
CF refatorada para o padrao do projeto: `module.exports = onCall(...)` direto (mesmo padrao de classifyOpenResponse, checkSubscriptions).

**`docs/PROJECT.md`** — CHANGELOG entry (inserir no topo da secao 10):
```markdown
### [1.28.0] - 13/04/2026
**Issue:** #129 (feat: Shadow Trade + Padroes Comportamentais)
**Epic:** #128 (Pipeline Unificado de Import de Ordens)
**Milestone:** v1.2.0 — Mentor Cockpit
#### Adicionado
- **`shadowBehaviorAnalysis.js`** — engine puro com 13 detectores deterministicos em 2 camadas. Camada 1 (todos os trades): HOLD_ASYMMETRY, REVENGE_CLUSTER, GREED_CLUSTER, OVERTRADING, IMPULSE_CLUSTER, CLEAN_EXECUTION, TARGET_HIT. Camada 2 (quando orders existem): HESITATION, STOP_PANIC, FOMO_ENTRY, EARLY_EXIT, LATE_EXIT, AVERAGING_DOWN
- **3 niveis de resolucao**: LOW (parciais + contexto inter-trade), MEDIUM (parciais enriquecidas), HIGH (orders brutas). Shadow nunca fica vazio — trades manuais recebem analise LOW
- **`ShadowBehaviorPanel.jsx`** em `src/components/Trades/` — UI mentor-only com severity badges, evidence colapsavel, marketContext (ATR + sessao + instrumento). DebugBadge obrigatorio (INV-04)
- **CF callable `analyzeShadowBehavior`** — mentor dispara analise retroativa por studentId + periodo. Batch commit. Layer 1 + Layer 2 para trades com ordens correlacionadas
- **Integracao pos-import** — passo 10 no OrderImportPage: apos staging confirm, analisa trades criados/enriquecidos com resolution HIGH
- **Integracao visual** — ShadowBehaviorPanel consumido em TradeDetailModal e FeedbackPage (embedded + standalone), condicional a isMentor + trade.shadowBehavior
- **Hook `useShadowAnalysis`** — wrapper de httpsCallable com loading/error state
- **Botao "Analisar comportamento"** na FeedbackPage (mentor-only) — dispara CF callable para o dia do trade. Re-analise silenciosa sobrescreve shadowBehavior anterior. Feedback inline success/error.
- 78 testes novos (73 engine + 5 hook), 1367 total, zero regressao
- **DIRECTION_FLIP** (14o padrao, Layer 1) — virada de mao no mesmo instrumento apos loss em janela ate 120min. Mapeamento emocional: CONFUSION (viés/narrativa quebrada). Severidade HIGH ≤15min, MEDIUM ≤60min, LOW ≤120min. Adicionado apos validacao real revelar gap (aluno fez 2 losses opostas no mesmo instrumento e algoritmo retornou patterns vazios)
- **UNDERSIZED_TRADE** (15o padrao, Layer 1) — operacao com risco real <50% do RO planejado. Mapeamento emocional: AVOIDANCE (medo do plano). Severidade HIGH <25%, MEDIUM <40%, LOW <50%. Pre-requisito: trade.planRoPct enriquecido pelo caller. CF fetcha plans e enriquece automaticamente; OrderImportPage tambem. Adicionado apos identificacao de disfuncao financeira: trader subdimensiona silenciosamente em vez de renegociar o plano, inflando RR estatistico mas escondendo desalinhamento de capital
#### Decisoes
- DEC-PENDING-1: Shadow em 3 camadas de resolucao (LOW/MEDIUM/HIGH)
- DEC-PENDING-2: Guard onTradeUpdated existente (linha 1033) ja cobre shadowBehavior — zero edicao no functions/index.js para o guard
- DEC-PENDING-3: ShadowBehaviorPanel em src/components/Trades/ (dominio trades, nao OrderImport)
```

**Testes:**
- 62 testes novos (57 engine + 5 hook), 1351 total passando (58 suites)

**Fixes pos-rebase:**
- CF `analyzeShadowBehavior` originalmente filtrava `orders` por `date` — campo inexistente no schema (orders usam `submittedAt`/`filledAt`/`importedAt`). Corrigido para buscar orders por `studentId` (single-field, sem indice composto) e amarrar ao periodo via `correlatedTradeId x trades do periodo`. Sem impacto no firestore.indexes.json.
- CF `analyzeShadowBehavior` originalmente fazia range query `where('date', '>=', dateFrom)` em trades — exigia novo indice composto `studentId ASC + date ASC` (o existente e `date DESC`). Corrigido para query single-field por `studentId` + filtro de periodo client-side. Mesmo padrao aplicado para orders. Sem impacto no firestore.indexes.json. Descoberto em runtime apos primeiro deploy (FAILED_PRECONDITION nos logs).

**Commits:**
- (pendente — aguardando confirmacao)

**Pendencias:**
- Integrar ShadowBehaviorPanel no TradeDetailModal e FeedbackPage (consumir trade.shadowBehavior)
- Integracao pos-import: apos staging confirm, chamar engine para upgrade LOW→HIGH
- Commit + PR

## 5. ENCERRAMENTO

**Status:** Aguardando PR

**Checklist final:**
- [x] Acceptance criteria atendidos (15 padroes implementados, resolution HIGH/MEDIUM/LOW, integracao visual + pos-import)
- [x] Testes passando (1367/58 suites, 78 novos)
- [x] PROJECT.md lock CHUNK-04 liberado
- [ ] PROJECT.md CHANGELOG [1.28.0] aplicado (delta documentado abaixo, aplicar no merge)
- [x] AP-08 validado no browser (FeedbackPage standalone + embedded, botao Analisar comportamento, panel renderizando padroes corretamente)
- [x] CF deployada em producao (us-central1, Node 22 2nd Gen)
- [ ] PR aberto
- [ ] PR mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
- [x] Locks de chunks liberados no registry (§6.3)
- [ ] Locks de chunks liberados no registry (secao 6.3)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-04 | escrita | Campo `shadowBehavior` no documento do trade |
| CHUNK-10 | leitura | Consultar ordens correlacionadas para analise |
