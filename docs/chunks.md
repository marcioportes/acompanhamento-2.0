# Chunks — Domínios técnicos atômicos

> CHUNK-01..17 — domínios de código isolados. Modo leitura: sem lock. Modo escrita: lock exclusivo em `docs/registry/chunks.md`.

## 6. PROTOCOLO DE SESSÕES PARALELAS

### 6.1 Conceito

Cada frente de desenvolvimento opera em um branch isolado. Arquivos transversais (shared infrastructure) nunca são modificados diretamente — cada sessão produz um delta que o integrador (Marcio) aplica no merge.

### 6.2 Shared Infrastructure (nunca editar diretamente em sessão paralela)

| Arquivo | Tipo | Protocolo |
|---------|------|-----------|
| `src/version.js` | Versionamento | Propor bump no documento do issue |
| `docs/PROJECT.md` | Este documento | Propor adições no documento do issue |
| `src/App.jsx` | Rotas principais | Delta de rotas no documento do issue |
| `functions/index.js` | Entry point CFs | Delta de exports no documento do issue |
| `firestore.rules` | Regras de segurança | Delta de rules no documento do issue |
| `package.json` | Dependências | Novas deps no documento do issue |
| `src/contexts/StudentContextProvider.jsx` | Contexto do aluno (NOVO) | Consumido por CHUNK-02, 13, 14, 15. Delta no doc do issue |
| `src/utils/compliance.js` | Engine compliance | Tocado por #113, #114. Delta no doc do issue |
| `src/hooks/useComplianceRules.js` | Hook compliance | Tocado por #113, #114. Delta no doc do issue |

**Protocolo de contenção para sessões paralelas:**
1. Sessão que encontrar bloqueio em shared file documenta no `issue-NNN.md`
2. Propõe delta (nunca edita direto)
3. Notifica Marcio para resolução antes de prosseguir
4. NUNCA assume que o shared file está no mesmo estado da última leitura — lê fresh

### 6.3 Registry de Chunks


**Como usar:** antes de iniciar qualquer sessão de código, consultar o campo "Chunks necessários" no issue do GitHub. Verificar que todos estão AVAILABLE. Registrar lock. Ao encerrar, liberar lock.

| Chunk | Domínio | Descrição | Arquivos principais | Status |
|-------|---------|-----------|-------------------|--------|
| CHUNK-01 | Auth & User Management | Autenticação, login, roles, sessão do usuário | `AuthContext`, `useAuth` | AVAILABLE |
| CHUNK-02 | Student Management | Dashboard do aluno, gestão de dados do estudante, sidebar do aluno | `StudentDashboard`, `students` collection | AVAILABLE |
| CHUNK-03 | Plan Management | CRUD de planos, ciclos, metas, stops, state machine do plano | `PlanManagementModal`, `plans` collection | AVAILABLE |
| CHUNK-04 | Trade Ledger | Registro de trades, gateway addTrade/enrichTrade, parciais, cálculo de PL | `useTrades`, `trades` collection, `tradeGateway` | AVAILABLE |
| CHUNK-05 | Compliance Engine | Regras de compliance, cálculo de scores, configuração do mentor | `compliance.js`, `ComplianceConfigPage` | AVAILABLE |
| CHUNK-06 | Emotional System | Scoring emocional, detecção TILT/REVENGE, perfil emocional | `emotionalAnalysisV2`, `useEmotionalProfile` | AVAILABLE |
| CHUNK-07 | CSV Import | Parser CSV, staging, mapeamento de colunas, validação | `CsvImport/*`, `csvStagingTrades` | AVAILABLE |
| CHUNK-08 | Mentor Feedback | Feedback do mentor por trade, chat, status de revisão | `Feedback/*`, `feedbackHelpers` | AVAILABLE |
| CHUNK-09 | Student Onboarding | Assessment 4D, probing, baseline report, marco zero | `Onboarding/*`, `assessment` subcollection | AVAILABLE |
| CHUNK-10 | Order Import | Import ordens, parse ProfitChart-Pro, criação automática, confronto enriquecido | `OrderImport/*`, `orders` collection, `tradeGateway` | AVAILABLE |
| CHUNK-11 | Behavioral Detection | Motor de detecção comportamental em 4 camadas — FUTURO | `behavioralDetection` | BLOCKED |
| CHUNK-12 | Cycle Alerts | Monitoramento de ciclos, alertas automáticos — FUTURO | `cycleMonitoring` | BLOCKED |
| CHUNK-13 | Context Bar | Barra de contexto unificado Conta>Plano>Ciclo>Período, provider, hook | `StudentContextProvider`, `ContextBar`, `useStudentContext` | AVAILABLE |
| CHUNK-14 | Onboarding Auto | Pipeline CSV→indicadores→Kelly→plano sugerido, wizard de onboarding | `OnboardingWizard`, `kellyCalculator`, `planSuggester` | AVAILABLE |
| CHUNK-15 | Swing Trade | Módulo de carteira, indicadores de portfólio, stress test | `PortfolioManager`, `portfolioIndicators` | AVAILABLE |

### 6.4 Checklist de Check-Out

```
□ Ler campo "Chunks necessários" no issue do GitHub
□ Para cada chunk com modo ESCRITA:
   → Verificar status AVAILABLE no registry acima
   → Se LOCKED: PARAR e notificar Marcio
□ Registrar lock: chunk + issue + branch + data (editar tabela acima)
□ Criar branch: git checkout -b feature/issue-NNN-descricao
□ Criar documento da sessão: docs/dev/issues/issue-NNN-descricao.md
```

> **Modo leitura** não requer lock — a sessão pode consultar arquivos de qualquer chunk.
> **Modo escrita** requer lock exclusivo — apenas uma sessão por chunk.

### 6.5 Checklist de Check-In / Merge

```
□ Documento do issue atualizado com resumo da sessão
□ Deltas de shared files documentados no issue
□ ZIP com paths project-relative
□ Testes passando: npm test
□ PR aberto com referência ao issue
□ Merge e PR fechado
□ Issue fechado no GitHub
□ Lock liberado nesta seção
□ PROJECT.md atualizado (DEC, DT, CHANGELOG)
```

---
