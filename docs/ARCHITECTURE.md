# Acompanhamento 2.0 — Documento de Arquitetura Vivo

> **Propósito:** Este documento é a "posição do tabuleiro" do sistema. Deve ser atualizado ao final de cada sessão de desenvolvimento com decisões, erros e lições aprendidas. Qualquer instância de IA ou desenvolvedor que trabalhe no projeto deve ler este documento antes de propor mudanças arquiteturais.

> **Localização no repo:** `/docs/ARCHITECTURE.md`

> **Última atualização:** 07/03/2026 — Sessão de reflexão pós-Issue #23 (CSV Import)

---

## 1. Stack & Infraestrutura

| Camada | Tecnologia | Notas |
|--------|-----------|-------|
| Frontend | React 18 + Vite | SPA, glassmorphism dark theme |
| Styling | Tailwind CSS | Utility-first |
| Backend | Firebase (Firestore, Cloud Functions, Auth, Storage) | Serverless |
| Deploy | Vercel | Frontend only; Cloud Functions via Firebase CLI |
| Testes | Vitest + jsdom | 100+ testes, cobertura obrigatória em business logic |
| Versionamento | Git + GitHub | Issues numeradas, branches `feature/vX.Y.Z-descricao` |

---

## 2. Invariantes Arquiteturais

> **Invariantes são regras que NUNCA devem ser violadas.** Qualquer proposta que quebre uma invariante deve ser redesenhada.

### INV-01: Airlock de Dados Externos
**Dados externos (CSV, API, migração, bulk import) NUNCA escrevem diretamente em collections de produção.**

Sempre usar:
1. Collection de staging separada (ex: `csvStagingTrades`)
2. Validação completa no staging
3. Ingestão via métodos já validados em produção (`addTrade`, `updatePlan`, etc.)

**Razão:** Cloud Functions, listeners e side-effects (PL, compliance, emotional scoring) assumem que documentos em collections de produção são completos e válidos. Bypass = cascata de bugs.

**Violação conhecida:** Issue #23 v1 — escrita direta em `trades` via `addTradesBatch` causou: CF disparando em dados incompletos, PL poluído, regressão em múltiplos módulos.

### INV-02: Gateway Único para `trades`
**Toda escrita na collection `trades` DEVE passar por `addTrade` (ou equivalente explicitamente validado e aprovado).**

`addTrade` é o gateway que garante:
- Estrutura completa do documento
- Campos obrigatórios preenchidos
- Formato compatível com Cloud Functions
- Consistência com partials (subcollections)

### INV-03: Integridade do Pipeline de Side-Effects
**O pipeline `trades` → Cloud Functions → (PL, compliance, emotional scoring, mentor alerts) é uma cadeia inquebrável.** Qualquer mudança em um elo exige análise de impacto em todos os elos downstream.

Cadeia atual:
```
trades (write) 
  → onTradeCreated (CF) → atualiza PL, compliance stats
  → onTradeUpdated (CF) → recalcula PL, compliance stats
  → useTrades (hook) → UI reativa
  → listeners em StudentDashboard, TradingCalendar, AccountStatement, MentorDashboard
```

### INV-04: DebugBadge Universal
**Todo componente de UI (tela, modal, card) deve exibir DebugBadge com version + build + git commit hash.** Sem exceção. Componentes embedded recebem `{!embedded && <DebugBadge />}`.

### INV-05: Testes como Pré-Requisito
**Toda alteração de business logic exige:**
1. Análise de impacto documentada
2. Testes incrementais de regressão cobrindo áreas afetadas
3. Bug fixes devem reproduzir o bug em teste ANTES do fix

### INV-06: Formato de Datas BR
**Todas as datas no sistema usam formato brasileiro (DD/MM/YYYY).** Parsing de datas deve priorizar formato BR como default. Semana começa na segunda-feira (não domingo).

### INV-07: Autorização Antes de Codificar
**Antes de codificar qualquer feature nova ou mudança arquitetural — especialmente qualquer coisa que toque Firestore collections, campos de status, ou Cloud Functions — a proposta deve ser apresentada ao Marcio para autorização explícita.**

### INV-08: CHANGELOG Obrigatório
**Toda versão (major, minor, patch) DEVE ter entrada no `/docs/CHANGELOG.md` antes do merge.** O CHANGELOG segue formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) com seções: Adicionado, Modificado, Corrigido, Removido, Testes. Claude deve propor a entrada do CHANGELOG como parte da fase de documentação de cada issue.

---

## 3. Mapa de Dependências Críticas

### 3.1 Collections Firestore e seus consumidores

```
trades (collection principal)
├── Escritor: addTrade (via AddTradeModal, futuro: csvStaging Activate)
├── Cloud Functions: onTradeCreated, onTradeUpdated
├── Hooks: useTrades
├── Subcollections: partials (para trades com parciais)
├── Consumers UI: StudentDashboard, TradingCalendar, AccountStatement,
│                  FeedbackPage, PlanLedgerExtract, MentorDashboard
└── Side-effects: PL calculation, compliance rate, emotional scoring

plans (planos de trading)
├── Escritor: createPlan, updatePlan (via PlanManagementModal)
├── Campos críticos: cycles, currentCycle, state machine
│   (IN_PROGRESS → GOAL_HIT/STOP_HIT → POST_GOAL/POST_STOP)
├── Hooks: usePlans
└── Consumers: StudentDashboard (PlanCardGrid), AccountsPage

accounts (contas do aluno)
├── Escritor: createAccount, updateAccount
├── Campos: currency, balance, broker
├── Hooks: useAccounts
└── Consumers: StudentDashboard, AccountStatement

emotions (sistema emocional)
├── Escritor: addEmotionEntry (emotionEntry/emotionExit por trade)
├── Scoring: algoritmo -4 a +3 normalizado para 0-100
├── Detecção: TILT/REVENGE patterns
├── Cloud Functions: emotional scoring integrado ao trade pipeline
└── Consumers: EmotionalLedgerExtract, MentorAlerts

tickers (gestão de ativos)
├── Estrutura: exchange → ticker hierarchy
├── Specs: tickSize, tickValue, minLot (para futuros)
├── Cascade delete: exchange delete → deleta tickers filhos
└── Dívida técnica: ticker alias auto-matching (WIN[A-Z]\d{2} → WINFUT)

csvStagingTrades (staging para import CSV — v2 architecture)
├── Escritor: CSV Import Wizard (csvParser → csvMapper → csvValidator)
├── Leitor: CsvImportManager (review/approve)
├── Ação: botão "Activate" → chama addTrade para cada trade aprovado
├── Isolamento: NUNCA dispara Cloud Functions diretamente
└── Rollback: batch rollback por importação
```

### 3.2 Cloud Functions — Triggers e Responsabilidades

| Function | Trigger | Responsabilidade | Premissas |
|----------|---------|-----------------|-----------|
| `onTradeCreated` | `trades/{id}` create | Atualiza PL do plano, compliance stats | Documento completo e válido |
| `onTradeUpdated` | `trades/{id}` update | Recalcula PL, compliance | Documento mantém integridade |

### 3.3 Hooks Reativos Críticos

| Hook | Collection(s) | Usado em |
|------|--------------|----------|
| `useTrades` | `trades` | StudentDashboard, TradingCalendar, AccountStatement, FeedbackPage |
| `usePlans` | `plans` | StudentDashboard (PlanCardGrid), PlanManagementModal |
| `useAccounts` | `accounts` | StudentDashboard, AccountsPage |
| `useSetups` | `setups` | AddTradeModal (bug: `isGlobal === undefined` deve ser `true`) |
| `useCsvTemplates` | `csvTemplates` | CSV Import Wizard |

---

## 4. Checklist de Impacto para Novas Features

> **Antes de propor qualquer feature, rodar mentalmente esta checklist:**

1. **Quais collections são tocadas?** (leitura E escrita)
2. **Quais Cloud Functions disparam?** (triggers onCreate/onUpdate)
3. **Quais hooks/listeners são afetados?** (re-renders, queries)
4. **Há side-effects em PL, compliance, emotional scoring?**
5. **Dados parciais/inválidos podem entrar no caminho crítico?**
6. **A feature respeita todas as INV-01 a INV-07?**
7. **Qual o blast radius se algo der errado?** (uma tela? todo o dashboard? dados corrompidos?)
8. **Existe rollback viável?** (batch delete? flag de status?)
9. **Quais testes existentes podem quebrar?**
10. **DebugBadge está presente em todos os componentes novos/tocados?**

---

## 5. Decision Log

> **Registro de decisões arquiteturais significativas, com contexto e justificativa.**

### DEC-001: CSV Import — Staging Collection (07/03/2026)

**Contexto:** Issue #23 — importação de trades via CSV.

**Decisão v1 (REJEITADA):** Escrever trades importados diretamente na collection `trades` usando `addTradesBatch` com campo `origin: 'IMPORTED'`.

**Problema:** Violou INV-01 e INV-02. Cloud Functions (`onTradeCreated`) dispararam sobre documentos incompletos. PL do plano foi poluído por trades IMPORTED. Listeners em múltiplas telas receberam dados inesperados. Cascata de bugs exigiu patches em Cloud Functions e múltiplos componentes.

**Decisão v2 (APROVADA):** Usar collection separada `csvStagingTrades` para staging. Wizard de importação (csvParser → csvMapper → csvValidator) escreve no staging. Botão "Activate" na UI chama `addTrade` individualmente para cada trade aprovado. Zero alterações necessárias em `useTrades`, Cloud Functions ou qualquer listener existente.

**Lição:** O custo de um staging intermediário é trivial comparado ao custo de contaminar o pipeline de produção. A tentação de "reaproveitar" a collection existente é um anti-pattern clássico.

**Artefatos reutilizáveis da v1:** csvParser, csvMapper, csvValidator, useCsvTemplates, wizard step components, 62 testes. Descartados: splitAndSet, addTradesBatch, patches de Cloud Functions.

---

### DEC-002: State Machine de Ciclos de Plano (v1.17.0)

**Contexto:** Necessidade de controlar períodos operacionais dentro de um plano.

**Decisão:** State machine formal com transições:
```
IN_PROGRESS → GOAL_HIT → POST_GOAL
IN_PROGRESS → STOP_HIT → POST_STOP (sempre violação)
```

**Regra:** POST_STOP é **sempre** uma violação — o trader ultrapassou o stop loss e continuou operando.

**Dívida técnica:** Quando há troca de ciclo sem fechamento formal, é preciso registrar o PL de entrada do novo ciclo. Prioridade alta.

---

### DEC-003: Inferência Genérica de Direção no CSV Import (08/03/2026)

**Contexto:** CSV da Tradovate (Performance tab) não traz coluna de direção (side). Traz `buyPrice`, `sellPrice`, `boughtTimestamp`, `soldTimestamp` separados.

**Proposta Haiku (REJEITADA):** Criar transformer específico `csvTransformTradovate.js` com detecção de formato por nome de broker.

**Problema:** Abordagem não escalável. Cada broker novo exigiria um transformer dedicado. Naming acoplado a vendor. O problema é genérico: qualquer CSV sem coluna de direção.

**Decisão (APROVADA):** Inferência genérica no `csvMapper.js`. Quando o usuário não mapeia `side` mas mapeia `buyTimestamp` + `sellTimestamp` + `buyPrice` + `sellPrice`, o sistema ativa modo inferência automaticamente:
- Heurística cronológica: `buyTimestamp < sellTimestamp` → LONG, vice-versa → SHORT
- Flag `directionInferred: true` no trade para rastreabilidade
- `entryTime`/`exitTime` calculados a partir do timestamp mais antigo/recente
- `parseNumericValue` com suporte a PnL em formato US com parênteses: `$(93.00)` → -93.00

**Mudanças em SYSTEM_FIELDS:** `side` mudou de `required: true` para `required: false` (inferível). Novos campos `buyTimestamp`, `sellTimestamp` (opcionais, grupo `inference`). `canAdvance` do wizard relaxado para aceitar modo inferência.

**Validação:** 14/14 linhas do Performance.csv Tradovate processadas corretamente. 62 novos testes. Zero regressão nos 253 existentes.

**Zero impacto em:** Cloud Functions, `useTrades`, `addTrade`, collections de produção. Inferência acontece 100% pré-staging.

**Lição:** Quando o problema parece vendor-specific, provavelmente é genérico. Identificar a abstração correta (ausência de direção) vs o sintoma (formato Tradovate) evita proliferação de código.

---

## 6. Dívidas Técnicas Ativas

| ID | Descrição | Prioridade | Origem |
|----|-----------|-----------|--------|
| DT-001 | PL do plano "Clear-DT" poluído por trades IMPORTED antes do guard na CF | CRÍTICA | Issue #23 v1 — **RESOLVIDO** 07/03 (PL corrigido manualmente) |
| DT-002 | Cycle transitions sem fechamento formal precisam registrar PL de entrada do novo ciclo | ALTA | v1.17.0 |
| DT-003 | Trades IMPORTED ainda visíveis em TradingCalendar, FeedbackPage, PlanLedgerExtract, MentorDashboard | ALTA | Issue #23 v1 — **RESOLVIDO** 07/03 (trades limpos do Firestore) |
| DT-004 | AccountStatement week filter usa convenção US (fix: `day === 0 ? 6 : day - 1`) | MÉDIA | v1.18.0 |
| DT-005 | `useSetups` deve tratar `isGlobal === undefined` como `true` | MÉDIA | v1.18.0 |
| DT-006 | Ticker alias auto-matching (WIN[A-Z]\d{2} → WINFUT) | BAIXA | v1.18.0 |
| DT-007 | Fix DebugBadge duplo no ComplianceConfigPage embedded | BAIXA | Backlog |
| DT-008 | formatCurrency hardcoded R$ em MentorDashboard e labels SYSTEM_FIELDS | BAIXA | v1.18.1 — label corrigido em csvMapper |

---

## 7. Convenções de Desenvolvimento

### Git
- Branch naming: `feature/vX.Y.Z-descricao` ou `hotfix/vX.Y.Z-descricao`
- Commits: mensagem em linha única (PowerShell constraint)
- Toda PR com business logic requer: análise de impacto + testes

### Testes
- Framework: Vitest + jsdom
- Localização: `src/__tests__/utils/` para novos utils
- Padrão: bug fix → reproduzir bug em teste → corrigir → teste passa
- Meta: cobertura incremental, nunca regressão

### UI
- Theme: Glassmorphism dark
- DebugBadge: obrigatório em tudo
- Datas: DD/MM/YYYY sempre
- Semana: começa na segunda-feira

---

## 8. Histórico de Versões Relevantes

| Versão | Data | Destaques |
|--------|------|-----------|
| v1.18.1 | Mar/2026 | Inferência genérica de direção (DEC-003), parseNumericValue com formato US/parênteses, Step 2 redesign (Exchange dropdown, formato data no topo, badges), ticker validation por exchange, exclusão de linhas no preview |
| v1.18.0 | Mar/2026 | CSV Import Wizard (v1 → v2 refactor), AddTradeModal paste/drop images |
| v1.17.0 | Mar/2026 | Cycle navigation, gauge charts, period selectors, META!/STOP! labels, test seed |
| v1.15-16 | Mar/2026 | Multi-currency, StudentDashboard partition (698→340 lines), state machine |
| v1.11-14 | Mar/2026 | Bulk mentor feedback, image paste, mentor plan audit, CRLF normalization |
| v1.9-10 | Fev/2026 | Sistema Emocional v2.0, TILT/REVENGE detection, PlanLedgerExtract |
| v1.5-8 | Fev/2026 | Trade partials, ticker management, futures pricing, student security |
| v1.0-4 | Jan-Fev/2026 | Scaffolding, 42 issues, arquitetura base, emotional control framework |

---

## 9. Roadmap — Features Futuras Documentadas

> **Features discutidas, especificadas ou parcialmente desenhadas mas NÃO implementadas.** Servem de referência para sessões futuras.

### ROAD-01: Order Matching Engine — Importação de Ordens (v1.19.0+)

**Contexto (08/03/2026):** O módulo CSV Import v1.18.x suporta CSVs com trades consolidados (1 linha = 1 operação fechada). Brokers como Tradovate (aba Orders) e ProfitChart-Pro exportam **ordens individuais** (múltiplas linhas = 1 operação). Ex: 3 compras de 2 contratos + 1 venda de 6 = 4 linhas → 1 trade com 3 parciais.

**Solução aprovada (design):** Duas entradas no wizard: "Importar Trades (Performance)" e "Importar Ordens". O modo ordens usa um algoritmo FIFO de matching por símbolo:
1. Ordena execuções cronologicamente por símbolo
2. Acumula posição: BUY +qty, SELL -qty
3. Quando posição = 0 → fecha o trade, calcula preço médio ponderado
4. Cada grupo de execuções de entrada vira um `partial` na subcollection (infraestrutura já existe, Issue #13 v1.5.0)
5. Resultado vai para staging via `addTrade` com partials (INV-01/INV-02 respeitadas)

**Referência:** TradesViz usa FIFO com opções de split por flat-position ou por símbolo. TradeZella exige export pela aba Orders com coluna B/S.

**Estimativa:** ~8-12h (4 camadas: matching engine puro JS ~3h, order CSV parsers ~2h, wizard integration ~3h, partials mapping ~2h).

**Benefício:** Resolve qualquer broker que exporte ordens. Gera parciais automaticamente. ProfitChart-Pro, NinjaTrader Orders, Tradovate Orders ficam todos cobertos.

**Pré-requisito:** v1.18.1 mergeada (inferência de direção + redesign wizard).

---

## Apêndice A: Anti-Patterns Documentados

### AP-01: Shortcut Through Production
**O que é:** Escrever dados externos diretamente em collections de produção para "economizar" uma etapa de staging.
**Por que é perigoso:** Cloud Functions, listeners e side-effects não distinguem origem. Dados incompletos disparam o mesmo pipeline que dados válidos.
**Solução:** Sempre usar staging collection + ingestão via métodos validados.

### AP-02: Patch Cascading
**O que é:** Quando um bypass (AP-01) causa bugs, a tentação é adicionar guards/patches em cada componente afetado (CF, hooks, UI) em vez de corrigir a causa raiz.
**Por que é perigoso:** Cada patch é um ponto de falha. A complexidade cresce exponencialmente. O código fica cheio de `if (origin !== 'IMPORTED')` que ninguém lembra de adicionar em novos componentes.
**Solução:** Corrigir a causa raiz (remover o bypass). Se necessário temporariamente, documentar CADA patch como dívida técnica com prazo de remoção.

### AP-03: Optimistic Reuse
**O que é:** Assumir que uma collection/método existente pode ser "reaproveitada" para um novo propósito sem análise de impacto completa.
**Por que é perigoso:** Collections têm contratos implícitos com Cloud Functions e listeners. Mudar o contrato sem atualizar todos os consumidores causa regressão silenciosa.
**Solução:** Rodar o Checklist de Impacto (Seção 4) antes de reutilizar qualquer collection para um propósito não-original.

---

*Este documento é vivo. Atualize-o ao final de cada sessão de desenvolvimento.*
