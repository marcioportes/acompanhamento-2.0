# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.20.1] - 2026-03-23

### Corrigido
- **Fix loop infinito AssessmentGuard:** `useAssessmentGuard` no `StudentDashboard` causava "Maximum update depth exceeded" — `onSnapshot` no doc `students/{id}` disparava re-render cascata com todos os hooks do dashboard. Guard movido para `App.jsx` onde é isolado dos hooks pesados (useTrades, useAccounts, usePlans, etc.)
- **Fix loading infinito aluno (DEC-024):** Firestore rules de trades/accounts/plans exigiam `isOwner(studentId) || isOwnerByEmail(studentEmail)` no read — queries do aluno falhavam silenciosamente. Simplificado read para `isAuthenticated()` em todas as collections de dados do aluno (trades, accounts, plans, movements, csvStagingTrades). Write mantém ownership check.
- `StudentDashboard.jsx` — removidos imports e hook call do guard
- `App.jsx` — guard intercepts no `renderContent()` antes de qualquer view
- `firestore.rules` — read simplificado para `isAuthenticated()` em 5 collections

## [1.20.0] - 2026-03-22

### Adicionado
- **Order Import Pipeline (CHUNK-10):** Importação de ordens brutas da corretora com detecção automática de formato (ProfitChart-Pro + genérico). Pipeline: Upload → Parse → Validação 3 camadas → Preview → Staging → Reconstrução de operações (net position zero) → Confirmação do aluno → Ingestão → Cross-check
- **Parser ProfitChart-Pro:** CSV hierárquico master+events, PT-BR, encoding Latin-1, delimiter `;`, preamble hash+data. Suporte a fills parciais, sub-events Trade/Cancel
- **Reconstrução de operações:** Algoritmo net position zero — agrupa ordens FILLED em operações consolidadas. Validado contra 5 operações reais (19/03/2026, WINJ26, +265 pts)
- **Stop movement analysis:** Detecção de cancelamento, reemissão, widening/tightening de stop orders. Fato objetivo com tipo + flag + observação editável
- **Staging review:** Tela de confirmação com operações reconstruídas, cada uma expandível com parciais de entrada/saída, stop orders, flags e observações
- **Cross-check comportamental:** 8 métricas derivadas de ordens vs trades — stopOrderRate, modifyRate, cancelRate, marketOrderPct, holdTimeAsymmetry, averagingDownCount, ghostOrderCount, orderToTradeRatio
- **KPI Validation:** Detecção de inflação de KPIs (win rate inflado por ausência de stop, ghost orders, hold time asymmetry). Severidades NONE/MODERATE/SEVERE com alertas automáticos
- **Correlação ordem↔trade:** Matching por instrumento + timestamp + side + quantity com confidence score (0-1). Ghost orders detectados automaticamente
- **CrossCheckDashboard:** Painel mentor com métricas agrupadas (Proteção, Hold Time, Padrões, KPI Validation) + alertas comportamentais
- **KPIValidationCard:** Card compacto de status KPI para StudentDashboard
- **OrderImportPage:** Wizard modal com etapas (Upload → Preview → Plano → Staging Review → Confirmar → Resultado)
- **Novas collections Firestore:** `ordersStagingArea` (temporária), `orders` (imutável), `orderAnalysis` (cross-check por período)
- **Botão "Importar Ordens"** no DashboardHeader (ao lado de "Importar Performance")
- **Botão "Importar CSV" renomeado** para "Importar Performance"

### Componentes novos
- `src/pages/OrderImportPage.jsx` v2.0.0
- `src/components/OrderImport/OrderUploader.jsx`
- `src/components/OrderImport/OrderPreview.jsx`
- `src/components/OrderImport/OrderValidationReport.jsx`
- `src/components/OrderImport/OrderStagingReview.jsx`
- `src/components/OrderImport/OrderCorrelation.jsx`
- `src/components/OrderImport/CrossCheckDashboard.jsx`
- `src/components/OrderImport/KPIValidationCard.jsx`

### Utils novos
- `src/utils/orderParsers.js` v2.0.0 — ProfitChart-Pro + genérico, reutiliza parseDateTime/parseNumericValue de csvMapper.js
- `src/utils/orderNormalizer.js` — Schema unificado + dedup por ClOrdID
- `src/utils/orderValidation.js` — Pipeline 3 camadas (structural, consistency, business)
- `src/utils/orderReconstruction.js` — Net position zero + associação de stops/canceladas
- `src/utils/stopMovementAnalysis.js` — Detecção de movimentações de stop + flags
- `src/utils/orderCorrelation.js` — Matching ordem↔trade com confidence
- `src/utils/orderCrossCheck.js` — 8 métricas cross-check + averaging down detection
- `src/utils/kpiValidation.js` — KPI inflation detection + alertas

### Hooks novos
- `src/hooks/useOrderStaging.js` — Staging CRUD com ingestBatch via query direta
- `src/hooks/useOrders.js` — Listener read-only da collection orders
- `src/hooks/useCrossCheck.js` — Cross-check compute + persist

### Modificado
- `src/pages/StudentDashboard.jsx` — Integração Order Import (hooks, state, modal, CrossCheckDashboard)
- `src/components/dashboard/DashboardHeader.jsx` — Botão "Importar Ordens" + rename "Importar CSV" → "Importar Performance"
- `firestore.rules` — Rules para ordersStagingArea, orders, orderAnalysis (auth != null)

### Testes
- 141 novos testes em 7 suites: orderParsers (37), orderValidation (23), orderCorrelation (14), orderCrossCheck (15), kpiValidation (21), orderReconstruction (21), stopMovementAnalysis (10)
- 612 testes totais (29 suites), zero regressão

### Decisões
- DEC-021: Order Import Pipeline — Staging com confirmação (client-side, zero CFs)
- DEC-022: Reconstrução de operações via net position zero
- DEC-023: Stop movement analysis — fato objetivo sem julgamento automático

---

## [1.19.6] - 2026-03-18

### Adicionado
- **Payoff com semaforo de saude do edge:** Novo indicador `calculatePayoff` (avgWin/avgLoss) com cor semantica — verde (≥1.5, edge sustentavel), amarelo (1.0-1.5, edge fragil), vermelho (<1.0, sem edge). Tooltip nativo explica a saude do edge e informa WR minimo para breakeven
- **Diagnostico contextual da assimetria:** Quando Consistencia de Risco < 1.0, tooltip (i) agora explica a causa — losses que extrapolaram o risco planejado, wins sem stop com risco estimado, ou sizing real inconsistente. Novo `asymmetryDiagnostic` no hook
- **Insight de extrapolacao de RO:** Tooltip de desempenho agora alerta quando RO medio > 100% (leve) ou > 120% (severa)

### Corrigido
- **Semaforo RO bidirecional:** Barra de Utiliz. RO agora penaliza extrapolacao (>100% amarelo, >120% vermelho) em vez de tratar como "excelente". Icone ⚠ quando > 100%
- **PL Atual tricolor no ExtractSummary:** Antes comparava com PL inicial (vermelho se menor). Agora: verde (resultado positivo), amarelo (resultado negativo mas PL positivo), vermelho (capital zerado)

### Modificado
- `dashboardMetrics.js`: Nova funcao `calculatePayoff` exportada
- `useDashboardMetrics.js`: Novos memos `payoff` e `asymmetryDiagnostic`
- `metricsInsights.js`: `getPerformanceInsights` aceita `asymmetryDiagnostic`, gera insights de causa da assimetria e extrapolacao de RO
- `MetricsCards.jsx` v5.0.0: Layout reorganizado — WR+Payoff no grid superior, Risco W/L + Utiliz. RO na secao inferior. Semaforo RO bidirecional. Tooltip com max-h scroll. Label RO medio → Utiliz. RO
- `ExtractSummary.jsx` v2.1.0: Cor PL Atual tricolor
- `StudentDashboard.jsx`: Props `payoff` e `asymmetryDiagnostic` propagadas ao MetricsCards
- `version.js`: v1.19.6+20260318

### Testes
- 23 novos testes: calculatePayoff (9), diagnostico assimetria (5), semaforo RO bidirecional (4), cor PL Atual (5)
- 429+ testes totais (21 suites), zero regressao

---

## [1.19.5] - 2026-03-15

### Adicionado
- **Layout agrupado 3 paineis no dashboard:** MetricsCards v4.1.0 reorganiza 7 cards em 3 paineis — Financeiro (Saldo, P&L, Expectancy, Drawdown, PF), Assimetria de Risco (WR, WR Planejado, Risco W/L, RO medio), EV (EV esperado vs EV real, gap, perda acumulada). Grid responsivo lg:grid-cols-3
- **Tooltips diagnosticos dinamicos:** Cada painel tem botao (i) com conclusoes geradas com base nos dados reais — ex: "Acerta 80% mas so 20% atingem o alvo — ansiedade de saida". Novo util `metricsInsights.js`
- **Trades sem stop assumem RO$ do plano:** `calculateRiskAsymmetry` atribui `plan.riskPerOperation` como risco para trades sem `riskPercent`. Elimina "N/D" e "0.00x"
- **Numero de trades no card EV**
- **Copy/paste imagem HTF/LTF no AddTradeModal (Ctrl+V)**

### Corrigido
- NaN guards em dashboardMetrics.js e MetricsCards.jsx
- Sinal do EV leakage invertido
- Tooltips nativos restaurados (DD, PF, WR)

### Testes
- 15 novos testes metricsInsights.test.js
- riskAsymmetry.test.js atualizado (sem stop assume RO$)
- 427+ testes totais (21 suites)

---

## [1.19.4] - 2026-03-13

### Corrigido
- **DEC-009: riskPercent usa plan.pl (capital base) como denominador:** Calculo de RO% usava `plan.currentPl` (flutuante) em vez de `plan.pl` (capital base). Trade com loss R$885 sobre capital R$200k mostrava 0.8% em vez de 0.44%. Corrigido em compliance.js e functions/index.js (3 pontos). Consistente com DEC-007
- **dailyLossPercent tambem corrigido** (mesma causa)

### Adicionado
- **Card Risk Asymmetry:** Razao risco medio wins/losses + RO efficiency + breakdown W/L + barra severidade
- **Card EV Leakage:** EV esperado vs real + gap + perda acumulada + barra severidade

### Modificado
- `compliance.js` v3.1.0, `functions/index.js`, `dashboardMetrics.js`, `useDashboardMetrics.js`, `MetricsCards.jsx` v3.0.0, `StudentDashboard.jsx`, `version.js`

### Testes
- 6 testes DEC-009, 13 riskAsymmetry, 12 evLeakage
- 412+ testes totais (19 suites)

---

## [1.19.3] - 2026-03-12

### Corrigido
- **C3: RR exibido com 2 casas decimais:** ExtractTable agora mostra `1.99:1` em vez de `2.0:1`. Red flags de RR também usam 2 casas. Resolve visual enganoso onde 1.99 arredondava para 2.0 parecendo compliant com alvo 2:1
- **C5: resultInPoints null quando há resultOverride:** Trades com resultado editado manualmente agora gravam `resultInPoints: null`. UI exibe "pts: editado" no TradeDetailModal e FeedbackPage
- **Navegação feedback ida/volta contextual:** Ao clicar feedback no extrato e voltar, o extrato reabre no plano correto. Feedback chamado do dashboard volta ao dashboard normalmente. Mecanismo: `_fromLedgerPlanId` enriquecido no trade pelo StudentDashboard, `feedbackReturnPlanId` no App.jsx

### Adicionado
- **Coluna Status Feedback no ExtractTable (QA #14):** Badge visual por trade — Pendente (OPEN), Revisado (REVIEWED), Dúvida (QUESTION), Fechado (CLOSED). Badge clicável quando `onNavigateToFeedback` presente
- **RR compliant em azul:** Trades com resultado positivo e RR dentro do alvo exibem RR em `text-blue-400` (antes era cinza)

### Modificado
- `ExtractTable.jsx` v4.1.0: Grid compactado — emoção só emoji (tooltip nome), side como superscript L/S, S/Stop só ícone (tooltip), RR assumido asterisco `*`, padding reduzido (px-2 py-1.5), status+feedback fundidos em coluna única clicável
- `compliance.js`: Red flag RR_BELOW_MINIMUM com 2 casas decimais na mensagem
- `useTrades.js`: `addTrade` e `updateTrade` (parciais e legado) setam `resultInPoints: null` quando `resultOverride`
- `TradeDetailModal.jsx`: Exibe "pts: editado" quando `resultInPoints` null e `resultEdited` true
- `FeedbackPage.jsx`: Mesmo tratamento de "Pontos: editado"
- `StudentDashboard.jsx`: Props `returnToPlanId`/`onReturnConsumed`, `useEffect` reabre extrato, `_fromLedgerPlanId` no callback do PlanLedgerExtract
- `App.jsx`: `feedbackReturnPlanId` state, só guarda quando `_fromLedgerPlanId` presente
- `version.js`: v1.19.3+20260312

### Testes
- 8 novos testes: `resultInPointsOverride.test.js` — override zera pontos, sem override mantém, override zero válido, override negativo, string numérica, resultEdited flag
- 394 testes totais (17 suites), zero regressão

---

## [1.19.2] - 2026-03-11

### Corrigido
- **DEC-007: RR assumido integrado em calculateTradeCompliance:** Trades sem stop agora calculam RR dentro do motor de compliance (não mais como cálculo isolado no addTrade). Usa `plan.pl` (capital base do ciclo) em vez de `currentPl` (flutuante). Resolve DT-017 (rrRatio -3.14 inconsistente)
- **Guard C4 removido:** `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance` e `diagnosePlan` não preservam mais valores stale de rrRatio. O `calculateTradeCompliance` agora retorna RR correto para todos os cenários (com/sem stop)
- **updateTrade recalcula RR:** Edição de resultado, stop, entry, exit ou qty agora recalcula rrRatio (real com stop, assumido sem stop). Antes o rrRatio ficava congelado do addTrade original
- **diagnosePlan detecta rrAssumed stale:** Auditoria agora identifica trades com RR assumido incorreto (ex: calculado com PL antigo) como divergentes

### Modificado
- `compliance.js` v3.0.0: `calculateTradeCompliance` retorna `rrAssumed: boolean`. Trades sem stop: RR = result / (plan.pl × RO%). RR compliance (rrStatus) agora avaliado para todos os trades
- `functions/index.js` v1.9.0: `calculateTradeCompliance` com DEC-007. Guards C4 removidos em `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance`. Persiste `rrAssumed` no documento do trade
- `useTrades.js`: `addTrade` usa `plan.pl` (DEC-007). `updateTrade` recalcula RR quando campos relevantes mudam
- `usePlans.js`: `diagnosePlan` comparação direta de rrRatio (sem guard C4)
- `version.js`: v1.19.2+20260311

### Testes
- 12 novos testes: 11 para DEC-007 RR assumido no compliance (win/loss/breakeven, plan.pl vs currentPl, moeda diferente, red flags), 1 para diagnosePlan rrAssumed stale detection
- 1 teste atualizado: loss sem stop agora gera 2 flags (NO_STOP + RR_BELOW_MINIMUM)
- 378 testes totais, zero regressão

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
