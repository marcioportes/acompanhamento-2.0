# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-02-15

### Adicionado
- **Máquina de Estados de Feedback**
  - Estados: OPEN → REVIEWED ↔ QUESTION → CLOSED
  - Thread de comentários com histórico completo (idas e vindas)
  - Validação de transições e permissões
  - Compatibilidade com campo legado `mentorFeedback`

- **Página de Feedback para Alunos**
  - `FeedbackPage.jsx`: Lista trades com filtros por status
  - `FeedbackThread.jsx`: Thread de comentários
  - `TradeStatusBadge.jsx`: Badge visual de status
  - Item "Feedback" no menu do aluno

- **Análise Emocional Avançada**
  - `emotionalAnalysis.js`: Categorização de emoções (POSITIVE, NEUTRAL, NEGATIVE, CRITICAL)
  - KPIs por trade: Score emocional, consistência entry/exit
  - KPIs agregados: Detecção de tilt, best/worst emotion, compliance rate
  - `EmotionalAnalysisDashboard.jsx`: Dashboard completo
  - `PlanEmotionalMetrics.jsx`: Métricas por plano/período

- **Cloud Functions**
  - `addFeedbackComment`: Adiciona comentário e gerencia transições
  - `closeTrade`: Encerra trade (apenas aluno)
  - `cleanupOldNotifications`: Scheduled cleanup de notificações lidas > 30 dias

- **Melhorias de Segurança**
  - Validação de mentor em `createStudent`, `deleteStudent`, `resendStudentInvite`
  - Validação de ownership em `closeTrade`

### Modificado
- **TRADE_STATUS** expandido: OPEN, REVIEWED, QUESTION, CLOSED
  - Mapeamento automático de status legado (PENDING_REVIEW → OPEN, IN_REVISION → QUESTION)
- **App.jsx**: Adicionada rota para FeedbackPage
- **Sidebar.jsx**: Adicionado item "Feedback" no menu do aluno

### Técnico
- Red Flags preservadas da v1.0.0
- Compatibilidade total com dados existentes
- `feedbackHistory` usa ISO string para timestamps (limitação do Firestore arrayUnion)

### Arquivos Modificados
```
src/
├── version.js                      (MODIFICADO - 1.1.0)
├── App.jsx                         (MODIFICADO)
├── components/
│   ├── Sidebar.jsx                 (MODIFICADO)
│   ├── FeedbackThread.jsx          (NOVO)
│   ├── TradeStatusBadge.jsx        (NOVO)
│   ├── EmotionalAnalysisDashboard.jsx (NOVO)
│   └── PlanEmotionalMetrics.jsx    (NOVO)
├── pages/
│   └── FeedbackPage.jsx            (NOVO)
├── hooks/
│   └── useFeedback.js              (NOVO)
└── utils/
    └── emotionalAnalysis.js        (NOVO)

functions/
└── index.js                        (MODIFICADO - 1.1.0)
```

---

## [1.0.0] - 2026-02-13

### Adicionado
- **View As Student**: Mentor pode visualizar dashboard como se fosse o aluno
  - Botão de visualização na lista de alunos (ícone de olho)
  - Banner indicador no topo quando em modo visualização
  - Acesso completo ao dashboard do aluno selecionado
  
- **Smart Balance no Extrato do Plano**
  - Cálculo de saldo anterior (trades antes do período filtrado)
  - Filtros de período: Hoje, Semana, Mês, Trimestre, Ano, Tudo
  - Detecção de eventos META/STOP na linha exata
  - Marcação de trades pós-evento (Pós-Meta, Violação)
  - Estados de compliance: Disciplinado, Ganância, Catástrofe, Sorte

- **Sistema de Versionamento**
  - Arquivo `src/version.js` como Single Source of Truth
  - Exibição de versão no footer do Sidebar
  - Documento `VERSIONING.md` com padrões do projeto

### Modificado
- **Hooks com Override Parameter**
  - `useTrades(overrideStudentId)`: Carrega trades de aluno específico
  - `usePlans(overrideStudentId)`: Carrega planos de aluno específico
  - `useAccounts(overrideStudentId)`: Carrega contas de aluno específico
  - Todos mantêm retrocompatibilidade (parâmetro opcional)

---

## [0.x.x] - Histórico Anterior

Versões anteriores não seguiam SemVer consistente.
A partir de 1.0.0, todas as versões seguirão este padrão.
