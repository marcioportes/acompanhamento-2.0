# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.19.2] - 2026-03-11

### Corrigido
- **DEC-007: RR assumido integrado em calculateTradeCompliance:** Trades sem stop agora calculam RR dentro do motor de compliance (não mais como cálculo isolado no addTrade). Usa `plan.pl` (capital base do ciclo) em vez de `currentPl` (flutuante). Resolve DT-017 (rrRatio -3.14 inconsistente)
- **Guard C4 removido:** `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance` e `diagnosePlan` não preservam mais valores stale de rrRatio. O `calculateTradeCompliance` agora retorna RR correto para todos os cenários (com/sem stop)
- **RR compliance só avalia wins:** Loss com RR negativo não é violação — perder 1R é o risco planejado. RR target (2:1) é critério de gain. Trades com takeProfit continuam avaliados independente do resultado
- **updateTrade recalcula RR:** Edição de resultado, stop, entry, exit ou qty agora recalcula rrRatio (real com stop, assumido sem stop). Antes o rrRatio ficava congelado do addTrade original
- **updateTrade recalcula resultInPoints:** Edição de entry/exit/qty/side agora recalcula pontos. Antes resultInPoints ficava stale (Issue #78/C5)
- **updateTrade atualiza parciais (B3):** Quando trade é editado via modal com parciais, subcollection é substituída e trade recalculado via `calculateFromPartials`. Sem histórico — editou, sobrescreveu
- **diagnosePlan detecta rrAssumed stale:** Auditoria agora identifica trades com RR assumido incorreto como divergentes

### Modificado
- `compliance.js` v3.0.0: `calculateTradeCompliance` retorna `rrAssumed: boolean`. Trades sem stop: RR = result / (plan.pl × RO%). rrStatus NAO_CONFORME só para wins ou trades com takeProfit
- `functions/index.js` v1.9.0: `calculateTradeCompliance` com DEC-007 + RR compliance wins-only. Guards C4 removidos
- `useTrades.js`: `addTrade` usa `plan.pl` (DEC-007). `updateTrade` recalcula RR + resultInPoints + parciais (subcollection)
- `usePlans.js`: `diagnosePlan` comparação direta de rrRatio (sem guard C4)
- `FeedbackPage.jsx`: Badge "(est.)" quando `rrAssumed=true` no card de risco
- `ExtractTable.jsx`: RR usa `trade.rrAssumed` para badge "(est.)". Eventos inline removem compliance redundante (S/Stop, RO, RR) — mantém apenas state machine (META/STOP) + emocional (TILT/REVENGE/CRÍTICO). Cores ciclo diferenciadas (yellow/orange vs emerald/red período)
- `ExtractCycleCard.jsx`: Gauge segue período selecionado — mostra PnL/Meta/Stop do período ativo em vez do ciclo. Header label dinâmico
- `version.js`: v1.19.2+20260311

### Testes
- 20 novos testes: 12 DEC-007 RR assumido, 1 diagnosePlan stale, 7 calculateFromPartials (B3 regressão): 12 para DEC-007 RR assumido (win/loss/breakeven, plan.pl vs currentPl, moeda diferente, red flags, loss não viola RR), 1 para diagnosePlan stale detection
- 386 testes totais, zero regressão

---

## [1.19.1] - 2026-03-10

### Corrigido
- **DEC-006: Compliance sem stop loss (Issue #78):** Trades sem stop não marcam mais RO=100% incorretamente. Nova lógica: loss → risco retroativo (`|result| / planPl`), win → N/A (riskPercent null), breakeven → 0%. Aplicado no frontend (`compliance.js` v2.0.0) e em TODAS as Cloud Functions (`onTradeCreated`, `onTradeUpdated`, `recalculateCompliance`)
- **C4: Guard rrAssumed em Cloud Functions:** `onTradeCreated`, `onTradeUpdated` e `recalculateCompliance` não sobrescrevem mais `rrRatio` com null quando o frontend já calculou RR assumido (`rrAssumed: true`). Resolve DT-013
- **C2: CSV Import tickerRule lookup:** `activateTrade` agora busca `tickerRule` (tickSize, tickValue, pointValue) do master data (collection `tickers`) via exchange+symbol quando o staging não possui tickerRule. Resolve DT-010
- **Red flags contextualizados:** Mensagem NO_STOP não afirma mais "risco ilimitado". Loss mostra risco retroativo %, win mostra "risco não mensurado". Flag RISK_EXCEEDED só gerada quando riskPercent é numérico

### Adicionado
- **Botão de Auditoria na UI:** Ícone ShieldCheck no hover do PlanCard (PlanCardGrid v2.1.0), posicionado após delete. Abre `PlanAuditModal` com diagnóstico bidirecional
- **PlanAuditModal (diagnóstico bidirecional):** Modal que verifica integridade do plano antes de agir. Ida: compara PL atual vs PL calculado (soma trades). Volta: compara compliance dos trades vs parâmetros do plano. Se saudável → "Plano saudável". Se divergente → mostra detalhes + botão "Corrigir Divergências". Resolve DT-014
- **`diagnosePlan` em usePlans:** Função de leitura pura que executa o diagnóstico bidirecional sem escritas. 10 testes unitários

### Modificado
- `compliance.js` v2.0.0: `calculateTradeCompliance` retorna `riskPercent: null` (não 0) nos defaults e em wins sem stop. `generateComplianceRedFlags` com mensagens contextualizadas
- `functions/index.js` v1.8.0: DEC-006 + guard rrAssumed em 3 pontos (onCreate, onUpdate, recalculate)
- `useCsvStaging.js` v1.1.0: `activateTrade` com lookup Firestore de tickerRule
- `usePlans.js`: novo `diagnosePlan` (leitura pura) + import `calculateTradeCompliance`
- `PlanCardGrid.jsx` v2.1.0: prop `onAuditPlan`, botão ShieldCheck após delete
- `StudentDashboard.jsx`: `PlanAuditModal` + `diagnosePlan`/`auditPlan` handlers, state `auditPlanId`
- `version.js`: v1.19.1+20260310
- `ARCHITECTURE.md`: INV-09 (Gate Obrigatório), AP-04 (Invariant Drift), DEC-004/005/006, DT-009 a DT-016

### Testes
- 34 testes compliance (12 novos para DEC-006: loss retroativo, win N/A, breakeven, red flags contextualizados, moeda diferente)
- 10 testes diagnosePlan (ida PL, volta compliance, rrAssumed guard, combinações)
- 366 testes totais, zero regressão

---

## [1.19.0] - 2026-03-09

### Adicionado
- **RR Assumido (B2 — Issue #71):** Nova função `calculateAssumedRR` — quando trade não tem stop loss, calcula RR baseado no risco planejado (RO$ = PL × RO%). Currency-agnostic. Persistido no documento do trade via `addTrade` com campos `rrRatio` + `rrAssumed: true`
- **PlanLedgerExtract RO/RR no header (B4 — Issue #71/#73):** Linha de referência no resumo do extrato exibindo RO$ (valor absoluto), RO%, RR Alvo e resultado esperado do plano
- **RR estimado no grid do extrato (B4):** Trades sem stop mostram RR calculado com badge "(est.)" na coluna RR. Trades com RR abaixo do alvo mostram ícone de non-compliance
- **Navegação feedback no extrato (B4 — Issue #73):** Ícone de chat em cada trade do grid permite navegar diretamente para a tela de feedback sem perder contexto
- **P&L Contextual no Dashboard (B5 — Issue #71):** Card de P&L exibe label dinâmico conforme contexto — "P&L Hoje", "P&L Esta Semana", "P&L Plano: [nome]" ou "P&L Total"
- **Documentação:** Framework Evolutivo de Classificação Comportamental (4D) e mockup MentorDashboard v2

### Modificado
- `tradeCalculations.js` v1.19.0: Nova função exportada `calculateAssumedRR`
- `useTrades.js`: `addTrade` agora calcula e persiste `rrRatio`/`rrAssumed` (real com stop, assumido sem stop)
- `useDashboardMetrics.js` v2.0.0: Novo retorno `plContext` com label e tipo do P&L contextual
- `PlanLedgerExtract.jsx` v5.0.0: Recebe e propaga `planRiskInfo` e `onNavigateToFeedback`
- `ExtractSummary.jsx` v2.0.0: Linha RO$/RR Alvo com resultado esperado
- `ExtractTable.jsx` v3.0.0: Coluna RR com badge "(est.)" + coluna feedback
- `MetricsCards.jsx` v2.0.0: Label P&L contextual via prop `plContext`
- `StudentDashboard.jsx`: Propaga `plContext` e `onNavigateToFeedback`

### Testes
- 14 novos testes para `calculateAssumedRR` (329 total)
- Cenários: win/loss/breakeven, com/sem stop, USD, RO% fracionário, edge cases
- Zero regressão nos 315 testes existentes

---

## [1.18.2] - 2026-03-09

### Corrigido
- **Locale pt-BR sistêmico (DEC-004):** Forçado locale `pt-BR` para formatação de TODAS as moedas (BRL, USD, EUR, GBP, ARS). Antes, contas em USD usavam `en-US` gerando `$10,000.50` — agora exibe `US$ 10.000,50` (formato brasileiro)
- Eliminado `formatCurrency` local duplicado no `TradesList.jsx` — agora usa `formatCurrencyDynamic` centralizado

### Modificado
- `currency.js` v1.1.0: `CURRENCY_CONFIG` — todas as locales agora `pt-BR`
- `calculations.js`: `formatCurrency` — hardcoded `pt-BR`
- `tradeCalculations.js`: `formatCurrencyValue` — locales `pt-BR`
- `constants/index.js`: `formatCurrency` — locales `pt-BR`
- `TradesList.jsx`: Import centralizado de `formatCurrencyDynamic`
- `TradeDetailModal.jsx`, `AddTradeModal.jsx`, `AccountStatement.jsx`, `AccountsPage.jsx`, `FeedbackPage.jsx`: locales corrigidos

### Testes
- 3 testes de `currency.test.js` atualizados para refletir DEC-004 (USD → formato BR)
- 315 testes passando, zero regressão

---

## [1.18.1] - 2026-03-08

### Adicionado
- **Inferência genérica de direção** (DEC-003): quando CSV não traz coluna de lado/direction, o sistema infere automaticamente a partir dos timestamps de compra/venda (heurística cronológica)
- **`parseNumericValue`**: parse robusto de valores numéricos com suporte a formato US com parênteses (`$(93.00)` → -93.00), símbolo de moeda ($, R$), formato BR e US
- **Novos SYSTEM_FIELDS**: `buyTimestamp` e `sellTimestamp` para mapeamento de CSVs com timestamps separados
- **`REQUIRED_FIELDS_INFERRED`**: conjunto reduzido de campos obrigatórios no modo inferência (ticker + qty)
- **Step 2 redesign**: Exchange dropdown (carregado de Firestore, obrigatório) e formato de data no topo, campos obrigatórios faltantes com badges inline, banner de inferência ativa
- **Step 3 melhorias**: badge ⚡ para direção inferida, ticker validation por exchange selecionado, botão de exclusão individual de linhas, contagem de excluídos nos stats

### Modificado
- `csvMapper.js` v1.2.0: `side` em SYSTEM_FIELDS mudou de `required: true` para `required: false` (inferível). `buildTradeFromRow` com modo inferência. `parseNumericValue` substituiu parse inline.
- `CsvMappingStep.jsx` v1.1.0: layout redesenhado (config no topo, mapeamento no meio, template no fundo)
- `CsvImportWizard.jsx` v2.1.0: `canAdvance` relaxado para inferência, carrega exchanges internamente, exchange default vazio
- `CsvPreviewStep.jsx` v1.1.0: ticker validation por exchange, exclusão de linhas, badges visuais

### Corrigido
- Label `Resultado (R$)` → `Resultado` (removido moeda hardcoded)

### Testes
- 62 novos testes (315 total): suite `csvDirectionInference.test.js`, fixture `tradovate-sample.csv`
- Zero regressão nos 253 testes existentes

---

## [1.3.0] - 2026-02-18

### Adicionado
- **Sistema de Estados Psicológicos (ESM v2.0)**
  - Set de 15 emoções pré-definidas com scores (+3 a -4)
  - Categorias: Positivas, Neutras, Negativas, Críticas
  - Emojis e descrições para cada emoção

- **Detecção de Padrões Comportamentais**
  - `detectTilt()`: 3+ trades consecutivos negativos
  - `detectRevenge()`: Aumento de posição após loss
  - `detectFomo()`: Entradas ansiosas sem setup
  - `detectOvertrading()`: Trades acima do limite diário
  - `detectZoneState()`: Sequência de disciplina positiva

- **Novos Componentes**
  - `EmotionSelector`: Dropdown categorizado para seleção de emoção
  - `EmotionalAlerts`: Exibição de alertas de padrões detectados
  - `PlanEmotionalMetrics` v1.3.0: Integrado com detecção de padrões

### Corrigido
- **Bug #1**: `formatDate` não tratava Firestore Timestamp `{seconds, nanoseconds}`
- **Bug #2**: `identifyStudentsNeedingAttention` incompatível com `getTradesGroupedByStudent`
- **Bug #3**: `FeedbackThread` não exibia `mentorFeedback` legado quando trade estava em QUESTION
- **Bug #4**: `TradeDetailModal` com área muito pequena, botão enviar cortado

### Modificado
- `calculations.js` v1.3.0: Refatorado `formatDate` e `identifyStudentsNeedingAttention`
- `FeedbackThread.jsx` v1.3.0: Lógica de mensagens corrigida
- `TradeDetailModal.jsx` v1.3.0: Modal expandido, melhor responsividade
- `emotionalAnalysis.js` v1.3.0: Reescrito com novo sistema de emoções

---

## [1.2.0] - 2026-02-17

### Adicionado
- Cards de Feedback por Aluno (Mentor)
- Filtros Avançados no FeedbackPage
- Coluna de Status no TradesList (prop `showStatus`)
- Script de Migração de Status (`migrate-trade-status.js`)

### Corrigido
- `getTradesAwaitingFeedback` agora inclui OPEN + QUESTION
- `serverTimestamp()` em array corrigido

---

## [1.1.0] - 2026-02-15

### Adicionado
- Máquina de Estados de Feedback (OPEN → REVIEWED ↔ QUESTION → CLOSED)
- Página de Feedback para Alunos
- Análise Emocional básica

---

## [1.0.0] - 2026-02-13

### Adicionado
- View As Student
- Sistema de Versionamento SemVer
