# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
