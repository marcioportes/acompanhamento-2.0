# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
