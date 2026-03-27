# CHUNK-REGISTRY.md
## Sistema de Controle de Concorrência — Acompanhamento 2.0
### Versão 1.0 — 16/03/2026

---

## 1. CONCEITO

O sistema é decomposto em **conjuntos técnicos atômicos (chunks)** — cada um agrupa arquivos, collections Firestore e Cloud Functions que formam uma unidade coesa. Uma sessão de trabalho faz **check-out** de chunks necessários; enquanto checked-out, nenhuma outra sessão modifica esses arquivos.

### 1.1 Regras de Operação

1. **Check-out:** Antes de iniciar, a sessão declara quais chunks precisa. Marcio verifica disponibilidade e marca como LOCKED.
2. **Exclusividade:** Chunk LOCKED não pode ser tocado por outra sessão.
3. **Check-in:** Ao final, a sessão entrega ZIP + CONTINUITY + delta files. Marcio faz merge e libera os chunks.
4. **Shared Infrastructure:** Arquivos transversais nunca são modificados diretamente. Cada sessão produz `MERGE-INSTRUCTIONS-<frente>.md`.
5. **Integrador único:** Marcio. Resolve conflitos, aplica deltas, atualiza registry.

### 1.2 Status Possíveis

| Status | Significado |
|--------|-------------|
| `AVAILABLE` | Livre para check-out |
| `LOCKED` | Em uso por uma sessão. Branch e data indicados. |
| `MERGE-PENDING` | Sessão entregou, aguardando integração pelo Marcio |

---

## 2. SHARED INFRASTRUCTURE (Nunca locked diretamente)

Estes arquivos são tocados por múltiplas frentes. Nenhuma sessão os modifica — cada uma produz um arquivo `MERGE-INSTRUCTIONS-<frente>.md` com as alterações necessárias.

| Arquivo | Tipo | Notas |
|---------|------|-------|
| `src/version.js` | Versionamento | Cada frente propõe bump; Marcio consolida |
| `docs/CHANGELOG.md` | Histórico | Cada frente entrega entrada; Marcio consolida |
| `docs/ARCHITECTURE.md` | Arquitetura viva | Cada frente propõe adições; Marcio integra |
| `src/App.jsx` | Rotas principais | Novas rotas via delta file |
| `functions/index.js` | Entry point Cloud Functions | Novos exports via delta file |
| `firestore.rules` | Regras de segurança | Novas rules via delta file |
| `package.json` | Dependências | Novas deps via delta file |
| `functions/package.json` | Deps Cloud Functions | Novas deps via delta file |

### Template de MERGE-INSTRUCTIONS

```markdown
# MERGE-INSTRUCTIONS: [Nome da Frente]
## Branch: feature/[nome]
## Data: DD/MM/YYYY

### version.js
- De: 1.19.x
- Para: 1.20.0 (ou conforme consolidação)

### CHANGELOG.md
- Entrada proposta:
  ```
  ## [1.20.0] - DD/MM/YYYY
  ### Added
  - [descrição]
  ```

### App.jsx
- Adicionar import: `import XPage from './pages/XPage';`
- Adicionar rota: `<Route path="/x" element={<XPage />} />`

### functions/index.js
- Adicionar export: `exports.novaFunction = require('./novaFunction');`

### firestore.rules
- Adicionar regra para collection `x`:
  ```
  match /x/{docId} {
    allow read: if isAuthenticated();
    allow write: if isMentor();
  }
  ```

### package.json
- Adicionar: `"nova-dep": "^1.0.0"`
```

---

## 3. REGISTRY DE CHUNKS

### CHUNK-01: Authentication & User Management

**Domínio:** Login, registro, perfis, roles (mentor/student)

| Tipo | Caminho |
|------|---------|
| Component | `src/components/Auth/*` |
| Context | `src/contexts/AuthContext.jsx` |
| Hook | `src/hooks/useAuth.js` |
| Firestore | Collection `users` |
| Config | Firebase Auth config |

**Status:** `AVAILABLE`
**Dependências:** Nenhuma
**Dependido por:** Todos os chunks

---

### CHUNK-02: Student Management

**Domínio:** Cadastro de alunos, listagem, StudentDashboard

| Tipo | Caminho |
|------|---------|
| Pages | `src/pages/StudentDashboard.jsx` |
| Components | `src/components/Student/*`, `DashboardHeader`, `PlanCardGrid`, `MetricsCards` |
| Hooks | `src/hooks/useDashboardMetrics.js` |
| Firestore | Collection `students`, doc fields |

**Status:** `AVAILABLE`
**Dependências:** CHUNK-01
**Dependido por:** CHUNK-03, CHUNK-04, CHUNK-07 (novo: Onboarding)

---

### CHUNK-03: Plan Management

**Domínio:** Criação/edição de planos, ciclos, state machine, PlanManagementModal

| Tipo | Caminho |
|------|---------|
| Components | `src/components/Plan/*`, `PlanManagementModal` |
| Hooks | `src/hooks/usePlanCycles.js`, `src/hooks/usePlanState.js` |
| Utils | `src/utils/planStateHelpers.js` |
| Firestore | Collection `plans`, subcollections de ciclos |

**Status:** `AVAILABLE`
**Dependências:** CHUNK-02
**Dependido por:** CHUNK-04, CHUNK-05
**Bug conhecido:** PlanManagementModal exibe R$ mesmo em contas USD

---

### CHUNK-04: Trade Ledger & Entry

**Domínio:** Registro de trades, addTrade gateway, ExtractTable, PlanLedgerExtract

| Tipo | Caminho |
|------|---------|
| Pages | `src/pages/PlanLedgerExtract.jsx` |
| Components | `src/components/Extract/*` (`ExtractTable`, `ExtractPeriodSelector`, `ExtractSummary`, `ExtractEvents`) |
| Utils | `src/utils/addTrade.js`, `src/utils/tradeValidation.js` |
| Hooks | `src/hooks/useTrades.js`, `src/hooks/useLedgerData.js` |
| Firestore | Collection `trades` |
| CF | `onTradeCreated`, `onTradeUpdated` |

**Status:** `AVAILABLE`
**Dependências:** CHUNK-03
**Dependido por:** CHUNK-05, CHUNK-06, CHUNK-08 (novo: Orders), CHUNK-09 (novo: Detecção)
**Invariante:** Toda escrita em `trades` DEVE passar por `addTrade`

---

### CHUNK-05: Compliance Engine

**Domínio:** compliance.js, ComplianceConfigPage, PlanAuditModal, recalculateCompliance

| Tipo | Caminho |
|------|---------|
| Utils | `src/utils/compliance.js` (v2.0.0) |
| Pages | `src/pages/ComplianceConfigPage.jsx` |
| Components | `src/components/Compliance/*`, `PlanAuditModal` |
| CF | `recalculateCompliance` (callable) |
| Firestore | Compliance fields em `trades`, config em `plans` |

**Status:** `AVAILABLE`
**Dependências:** CHUNK-04
**Dependido por:** CHUNK-09 (novo: Detecção)
**Nota:** DEC-006 implementado (loss→retroactive risk, win→N/A, BE→0)

---

### CHUNK-06: Emotional System

**Domínio:** Perfil emocional, scoring, TILT/REVENGE detection, MentorAlerts

| Tipo | Caminho |
|------|---------|
| Utils | `src/utils/emotionalAnalysisV2.js` |
| Hooks | `src/hooks/useEmotionalProfile.js` |
| Components | `src/components/Emotional/*`, `MentorAlerts` |
| Firestore | Emotion fields em `trades`, emotional profile docs |

**Status:** `AVAILABLE`
**Dependências:** CHUNK-04
**Dependido por:** CHUNK-09 (novo: Detecção)

---

### CHUNK-07: CSV Import Pipeline

**Domínio:** Importação CSV, staging, validação, CsvImportManager

| Tipo | Caminho |
|------|---------|
| Components | `src/components/CsvImport/*` |
| Utils | `src/utils/csvValidation.js`, `src/utils/csvParsers.js` |
| Firestore | Collection `csvStagingTrades` |

**Status:** `AVAILABLE`
**Dependências:** CHUNK-04 (usa addTrade para ingestão)
**Bugs conhecidos:** Screen flicker, CsvImportManager desperdiça espaço, auto-detect date format

---

### CHUNK-08: Mentor Feedback

**Domínio:** Feedback por trade, bulk feedback, imagem paste, feedback editing

| Tipo | Caminho |
|------|---------|
| Components | `src/components/Feedback/*` |
| Utils | `src/utils/feedbackHelpers.js` |
| Firestore | Feedback fields em `trades`, Firebase Storage (imagens) |

**Status:** `AVAILABLE`
**Dependências:** CHUNK-04
**Dívida:** Mentor não consegue editar feedback já enviado

---

## 4. CHUNKS NOVOS (A Criar)

### CHUNK-09: Student Onboarding & Baseline (NOVO)

**Domínio:** Setup inicial do aluno, entrevista estruturada 4D, marco zero emocional

| Tipo | Caminho Proposto |
|------|-----------------|
| Pages | `src/pages/StudentOnboardingPage.jsx` |
| Components | `src/components/Onboarding/*` (`AssessmentInterview`, `TraderProfileCard`, `BaselineReport`) |
| Utils | `src/utils/assessmentScoring.js` |
| Hooks | `src/hooks/useAssessment.js` |
| Firestore | Subcollection `students/{id}/assessment/`, doc `initial_assessment` |

**Status:** `AVAILABLE` — Pronto para check-out
**Dependências:** CHUNK-02 (students)
**NÃO TOCA:** CHUNK-04, CHUNK-05, CHUNK-06, CHUNK-07, CHUNK-08
**Branch proposta:** `feature/student-onboarding`

---

### CHUNK-10: Order Import Pipeline (NOVO)

**Domínio:** Importação de ordens brutas da corretora, parsing, correlação com trades

| Tipo | Caminho Proposto |
|------|-----------------|
| Pages | `src/pages/OrderImportPage.jsx` |
| Components | `src/components/OrderImport/*` (`OrderUploader`, `OrderPreview`, `OrderCorrelation`) |
| Utils | `src/utils/orderParsers.js`, `src/utils/orderCorrelation.js` |
| Hooks | `src/hooks/useOrders.js` |
| Firestore | Collection `ordersStagingArea`, collection `orders` |
| CF | `processOrders` (callable ou trigger) |

**Status:** `AVAILABLE` — Pronto para check-out
**Dependências:** CHUNK-04 (correlação com trades existentes)
**NÃO TOCA:** CHUNK-02, CHUNK-03, CHUNK-05, CHUNK-06, CHUNK-07, CHUNK-08, CHUNK-09
**Invariante:** Segue staging invariant — dados externos nunca escrevem direto em `orders` final
**Branch proposta:** `feature/order-import`

---

### CHUNK-11: Behavioral Detection Engine (NOVO — FUTURO)

**Domínio:** Motor de detecção comportamental, Camadas 1-4

| Tipo | Caminho Proposto |
|------|-----------------|
| Utils | `src/utils/behavioralDetection.js`, `src/utils/behavioralStats.js` |
| Components | `src/components/BehavioralAlerts/*` |
| CF | `analyzeBehavior` (scheduled ou callable) |
| Firestore | Fields em `trades` (flags[]), collection `behavioralAnalysis` |

**Status:** `BLOCKED` — Aguarda CHUNK-10 (ordens) para design completo
**Dependências:** CHUNK-04, CHUNK-05, CHUNK-06, CHUNK-10
**Branch proposta:** `feature/behavioral-detection`

---

### CHUNK-12: Cycle Alerts & Compliance Monitoring (NOVO — FUTURO)

**Domínio:** Alertas de ciclo não fechado, feedback pendente, compliance monitoring ativo

| Tipo | Caminho Proposto |
|------|-----------------|
| Components | `src/components/CycleAlerts/*` |
| Utils | `src/utils/cycleMonitoring.js` |
| CF | `checkCycleCompliance` (scheduled) |
| Firestore | Alert docs em subcollection de plans |

**Status:** `BLOCKED` — Pode ser desbloqueado independente da CHUNK-10
**Dependências:** CHUNK-03, CHUNK-04, CHUNK-08
**Branch proposta:** `feature/cycle-alerts`

---

## 5. MAPA DE DEPENDÊNCIAS

```
CHUNK-01 (Auth)
  └── CHUNK-02 (Students)
        ├── CHUNK-03 (Plans)
        │     ├── CHUNK-04 (Trades/Ledger) ←── INVARIANTE: addTrade gateway
        │     │     ├── CHUNK-05 (Compliance)
        │     │     ├── CHUNK-06 (Emotional)
        │     │     ├── CHUNK-07 (CSV Import)
        │     │     ├── CHUNK-08 (Feedback)
        │     │     ├── CHUNK-10 (Order Import) ←── NOVO
        │     │     └── CHUNK-11 (Behavioral Detection) ←── FUTURO
        │     └── CHUNK-12 (Cycle Alerts) ←── FUTURO
        └── CHUNK-09 (Onboarding/Baseline) ←── NOVO (independente de CHUNK-03+)
```

---

## 6. REGISTRO DE LOCKS ATIVOS

| Chunk | Status | Branch | Sessão | Check-out | Notas |
|-------|--------|--------|--------|-----------|-------|
| CHUNK-09 | `LOCKED` | feature/student-onboarding | Sessão A | 19/03/2026 | Onboarding & Baseline |
| CHUNK-10 | `LOCKED` | feature/order-import | Sessão B | 19/03/2026 | Order Import Pipeline |
| *(todos os demais)* | `AVAILABLE` | — | — | — | — |

> **Instruções para Marcio:** Ao iniciar uma frente, preencher esta tabela. Ao receber o ZIP de volta, marcar como `MERGE-PENDING`. Após merge, voltar para `AVAILABLE`.

---

## 7. CHECKLIST DE CHECK-OUT

Antes de iniciar uma sessão paralela:

- [ ] Identificar chunks necessários na tabela acima
- [ ] Verificar que todos estão `AVAILABLE`
- [ ] Marcar como `LOCKED` com branch name e data
- [ ] Incluir no briefing da sessão:
  - ARCHITECTURE.md (versão atual)
  - Este CHUNK-REGISTRY (versão atual)
  - Briefing específico da frente (BRIEF-*.md)
  - Lista explícita de "NÃO TOCA"
- [ ] Ao final da sessão, coletar:
  - ZIP com paths project-relative
  - CONTINUITY-session-YYYYMMDD.md
  - MERGE-INSTRUCTIONS-<frente>.md
  - Testes para lógica nova

## 8. CHECKLIST DE CHECK-IN / MERGE

Após receber entrega de uma sessão:

- [ ] Criar branch a partir de main: `git checkout -b feature/<nome>`
- [ ] Descompactar ZIP: `Expand-Archive -Path "Temp\<nome>.zip" -DestinationPath "." -Force`
- [ ] Aplicar MERGE-INSTRUCTIONS para shared files
- [ ] Consolidar version.js (bump único se múltiplas frentes)
- [ ] Consolidar CHANGELOG.md
- [ ] Rodar testes: `npm test`
- [ ] Verificar Firestore rules se alteradas
- [ ] Deploy Cloud Functions se alteradas
- [ ] Commit + PR + merge
- [ ] Atualizar esta tabela: status → `AVAILABLE`
- [ ] Atualizar ARCHITECTURE.md com decisões relevantes

---

*Registry Version 1.0 — 16/03/2026*
*Mantido por: Marcio Portes (integrador único)*
