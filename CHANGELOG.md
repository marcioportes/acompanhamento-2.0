# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
  
- **Monitor de Status de Email**
  - Trigger `onMailStatusChange` para monitorar entrega
  - Campo `emailError` no documento do aluno
  - Badge visual "Erro Email" na lista de alunos
  - Limpeza automática de erro ao reenviar/sucesso

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

- **Cloud Functions**
  - Versão unificada 1.0.0
  - APP_NAME atualizado para "Tchio-Alpha"
  - Templates de email otimizados

### Corrigido
- Funções `getTradesAwaitingFeedback` e `getTradesGroupedByStudent` agora exportadas em useTrades
- Query por `studentId` com fallback para quando índice não existe

### Requisitos de Deploy

#### Pré-requisitos
1. Criar índice Firestore:
   - Collection: `trades`
   - Fields: `studentId` (ASC), `date` (DESC)

#### Ordem de Deploy
1. `firebase deploy --only functions`
2. Deploy do frontend (todos os arquivos juntos)

### Arquivos Modificados
```
src/
├── version.js              (NOVO)
├── App.jsx                 (MODIFICADO)
├── hooks/
│   ├── useTrades.js        (MODIFICADO)
│   ├── usePlans.js         (MODIFICADO)
│   └── useAccounts.js      (MODIFICADO)
├── pages/
│   ├── StudentDashboard.jsx    (MODIFICADO)
│   └── StudentsManagement.jsx  (MODIFICADO)
└── components/
    ├── Sidebar.jsx         (MODIFICADO)
    └── PlanExtractModal.jsx (REESCRITO)

functions/
└── index.js                (MODIFICADO)
```

### Notas de Migração
- Nenhuma migração de dados necessária
- Retrocompatível com dados existentes
- Novos campos (`emailError`, `emailErrorAt`, `emailSentAt`) são opcionais

---

## [0.x.x] - Histórico Anterior

Versões anteriores não seguiam SemVer consistente.
A partir de 1.0.0, todas as versões seguirão este padrão.
