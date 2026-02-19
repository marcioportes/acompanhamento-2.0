# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
