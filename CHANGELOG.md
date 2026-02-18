# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.2.0] - 2026-02-17

### Adicionado
- **Cards de Feedback por Aluno (Mentor)**
  - Nova visualização na aba "Aguardando Feedback" com cards resumidos
  - Contadores clicáveis: 🕐 OPEN (Feedback) e ❓ QUESTION (Dúvidas)
  - Clique no ícone filtra trades por aluno + status específico
  - Ordenação por urgência (QUESTION > OPEN)

- **Filtros Avançados no FeedbackPage**
  - Mentor: filtro por aluno, período e busca
  - Aluno: filtro por conta, período e busca
  - Botão de limpar filtros

- **Coluna de Status no TradesList**
  - Nova prop `showStatus` para exibir/ocultar coluna
  - Badge visual com ícone e cor por status
  - Usado na visão geral (showStatus=true), oculto quando já filtrado

- **Botão "Ver histórico" no TradeDetailModal**
  - Link para FeedbackPage com o trade selecionado
  - Contador de mensagens no feedbackHistory

- **Script de Migração de Status**
  - `migrate-trade-status.js` para migrar dados legados
  - PENDING_REVIEW → OPEN
  - IN_REVISION → QUESTION

- **Helpers no useTrades**
  - `getStudentFeedbackCounts(email)`: contagem por status
  - `getTradesByStudentAndStatus(email, status)`: filtro combinado

### Modificado
- **useTrades.js**
  - `getTradesAwaitingFeedback()` agora inclui OPEN + QUESTION
  - Removido mapeamento de status legado (após migração)
  - Status padrão para novos trades: `OPEN`

- **Padronização de Versão**
  - Todos os arquivos agora seguem a versão do projeto (1.2.0)
  - Removidas versões individuais (3.x.x, 5.x.x, etc.)

### Corrigido
- Fix: `serverTimestamp()` dentro de `arrayUnion()` (usa ISO string)
- Fix: Trades com status QUESTION não apareciam na fila do mentor

### Arquivos Modificados
```
src/
├── version.js                      # 1.2.0
├── hooks/
│   └── useTrades.js                # 1.2.0 (fix + novos helpers)
├── pages/
│   ├── FeedbackPage.jsx            # 1.2.0 (+ filtros avançados)
│   └── MentorDashboard.jsx         # 1.2.0 (+ cards por aluno)
└── components/
    ├── TradeDetailModal.jsx        # 1.2.0 (+ botão "Ver histórico")
    ├── TradesList.jsx              # 1.2.0 (+ prop showStatus)
    └── StudentFeedbackCard.jsx     # NOVO

functions/
├── index.js                        # 1.2.0
└── migrate-trade-status.js         # NOVO (script de migração)
```

---

## [1.1.0] - 2026-02-15

### Adicionado
- **Máquina de Estados de Feedback**
  - Estados: OPEN → REVIEWED ↔ QUESTION → CLOSED
  - Thread de comentários com histórico completo
  - Validação de transições e permissões

- **Página de Feedback para Alunos**
  - FeedbackPage.jsx, FeedbackThread.jsx, TradeStatusBadge.jsx
  - Item "Feedback" no menu do aluno

- **Análise Emocional Avançada**
  - emotionalAnalysis.js com categorização de emoções
  - KPIs por trade e agregados
  - Dashboard e métricas por plano

- **Cloud Functions**
  - addFeedbackComment, closeTrade
  - cleanupOldNotifications (scheduled)

- **Melhorias de Segurança**
  - Validação de mentor em funções administrativas

---

## [1.0.0] - 2026-02-13

### Adicionado
- **View As Student**: Mentor visualiza dashboard como aluno
- **Smart Balance no Extrato do Plano**
- **Sistema de Versionamento** (SemVer 2.0.0)

### Modificado
- Hooks com Override Parameter (useTrades, usePlans, useAccounts)

---

## [0.x.x] - Histórico Anterior

Versões anteriores não seguiam SemVer consistente.
