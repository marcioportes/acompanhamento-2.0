# CONTINUITY PROMPT — Sessão 10/03/2026
## Gerado: 2026-03-10 ~02:10 BRT
## Status: v1.19.0 COMPLETA na branch feature/v1.19.0-recalc-cascade-pl-context, pendente PR/merge
## Próximo: Issue de bugs consolidados, deploy CF, botão auditoria na UI

---

## 1. O QUE FOI FEITO NA SESSÃO 09/03/2026

### v1.18.2 — Currency Locale Fix (MERGEADO, PR #77)
- DEC-004: Forçado locale pt-BR para TODAS as moedas (10 arquivos)
- Eliminado formatCurrency local duplicado no TradesList
- 3 testes atualizados, 315 passando

### v1.19.0 — Issue #71 (B2+B4+B5) + Issue #73 (NÃO MERGEADO)

**B2: RR Assumido**
- `calculateAssumedRR` em tradeCalculations.js — currency-agnostic
- Fórmula: RO$ = PL × RO%, rrRatio = result / RO$, isCompliant = result >= rrTarget × RO$
- 14 testes novos (329 total)

**B4: PlanLedgerExtract RO/RR + Feedback Nav (absorve Issue #73)**
- ExtractSummary v2.0.0: linha RO$/RO%/RR Alvo com resultado esperado
- ExtractTable v3.0.0: RR estimado com badge "(est.)", coluna feedback com ícone
- PlanLedgerExtract v5.0.0: propaga planRiskInfo + onNavigateToFeedback
- StudentDashboard: conecta onNavigateToFeedback ao PlanLedgerExtract

**B5: P&L Contextual + Persistência RR**
- useTrades.addTrade: persiste rrRatio + rrAssumed no documento do trade
- useDashboardMetrics v2.0.0: novo plContext { label, type }
- MetricsCards v2.0.0: label dinâmico "P&L Hoje/Esta Semana/Plano/Total"

### Documentação adicionada
- docs/dev/trader_evolution_framework.md — Framework 4D (1287 linhas)
- docs/dev/mentor-dashboard-v2-mockup.png — Mockup Torre de Controle
- docs/CHANGELOG.md atualizado (v1.18.2 + v1.19.0)
- version.js → v1.19.0

### NÃO FEITO nesta sessão
- Botão de auditoria na UI (PlanCardGrid ou PlanManagementModal) — `auditPlan` está no hook mas sem UI
- Deploy de `functions/index.js` (alerta emocional no onTradeUpdated) — requer `firebase deploy --only functions`
- B3 focusTab: `App.jsx` precisa consumir `viewAs.focusTab` para abrir na aba emocional

---

## 2. BUGS IDENTIFICADOS — CONSOLIDAR EM ISSUE

| # | Bug | Severidade | Origem |
|---|---|---|---|
| 1 | **CSV Import não passa tickerRule** → cálculo errado + red flags espúrias em trades importados | ALTA | useCsvStaging.activateTrade / csvMapper não popula tickerRule |
| 2 | **Triângulos ⚠️ inconsistentes** grid vs detalhe — grid lê Firestore, detalhe recalcula | ALTA | Decorrente do #1 |
| 3 | **CsvImportManager pisca** durante ativação batch — overlay precisa ser opaco/bloqueante | MÉDIA | UX, listener suspend funciona mas UI não bloqueia |
| 4 | **Templates CSV vazam** entre alunos — useCsvTemplates não filtra por studentId | MÉDIA | Segurança/isolamento de dados |
| 5 | **CsvImportManager desperdiça espaço** vertical — só mostra 5 trades, metade vazia | BAIXA | Layout |
| 6 | **Auto-detect date format** MM/DD vs DD/MM não implementado | BAIXA | CSV parser |
| 7 | **Mentor não edita feedback** já enviado | MÉDIA | FeedbackThread/useTrades |
| 8 | **version.js** não era atualizado nos hotfixes v1.18.1/v1.18.2 | Processo | Corrigido nesta sessão |

### Bug #1 — Análise detalhada (tickerRule no CSV Import)

**Causa raiz:** O wizard CSV (csvMapper → staging → activate) nunca busca as specs do ticker (tickSize, tickValue, pointValue) do master data. O `activateTrade` passa `tickerRule: stagingTrade.tickerRule ?? null`, mas ninguém popula `stagingTrade.tickerRule`.

**Fix proposto:** No `activateTrade` (ou no wizard Step 3), buscar o ticker no master data via exchange+symbol e setar tickerRule antes de chamar addTrade. Alternativa: resolver no addTrade via lookup no master data quando tickerRule é null mas ticker+exchange existem.

**Impacto:** Trades já importados sem tickerRule precisam de script de backfill ou serem re-editados manualmente.

---

## 3. ESTADO DO REPO

```
Branch: feature/v1.19.0-recalc-cascade-pl-context
Último commit main: c8d60972 (v1.18.2)
Commits na branch: B2+B4+B5+docs+B1+B3 (todos commitados)
Version: v1.19.0
Testes: 344 passando (29 novos nesta sessão)
CF pendente deploy: functions/index.js (alerta emocional onTradeUpdated)
```

---

## 4. DÍVIDAS TÉCNICAS ATUALIZADAS

| ID | Item | Prioridade |
|---|---|---|
| DT-002 | Cycle transitions sem fechamento formal | ALTA |
| DT-004 | AccountStatement week filter US → BR | MÉDIA |
| DT-005 | useSetups isGlobal undefined → true | MÉDIA |
| DT-006 | Ticker alias auto-matching | BAIXA |
| DT-007 | DebugBadge duplo ComplianceConfigPage | BAIXA |
| DT-008 | formatCurrency hardcoded R$ no MentorDashboard | BAIXA |
| DT-009 | Filtro extrato — verificar createdAt vs entryTime | MÉDIA |
| DT-010 | CSV tickerRule ausente (Bug #1 acima) | ALTA |
| DT-011 | Templates CSV sem filtro studentId (Bug #4) | MÉDIA |
| DT-012 | Mentor não edita feedback (Bug #7) | MÉDIA |

---

## 5. VISÃO ESTRATÉGICA REGISTRADA

- **Framework 4D de Evolução Comportamental** — docs/dev/trader_evolution_framework.md
  - 4 dimensões: Emocional, Financeira, Operacional, Experiência
  - 5 estágios: Chaos → Mastery
  - Assessment inicial (entrevista 50min) + scoring contínuo + gates de progressão
  - Schema Firestore: students/{id}/assessment, ongoing_tracking, progression_log

- **MentorDashboard v2 (Torre de Controle)** — docs/dev/mentor-dashboard-v2-mockup.png
  - KPIs: Alunos Ativos, Alertas, Fora do Plano, Metas
  - Prioridade do Dia com recomendações acionáveis
  - Radar de Risco, Fora do Plano, Stop vs Gain, SWOT Turma

- **Algoritmo de Evolução Emocional** — trade quality scoring
  - Nota de qualidade por trade (menor unidade)
  - Validação matemática: emoção declarada vs padrão comportamental
  - Variáveis: disciplina entrada, RO, RR, tempo em trade, preço médio, overtrading pós-stop
  - Baseline entrevista → acompanhamento → comparação entrada vs saída

---

## 6. INVARIANTES (SEMPRE APLICAR — SEM EXCEÇÃO)

> **DIRETRIZ CRÍTICA:** Claude NUNCA entrega código (ZIP, arquivo, snippet) sem antes verificar TODOS os itens abaixo. Marcio NÃO deve precisar lembrar. Se Claude falhar em qualquer invariante, é uma falha de processo que deve ser corrigida antes da entrega, não depois.

### 6.1 Invariantes Arquiteturais

1. **INV-01:** Dados externos NUNCA em collections de produção. Staging + addTrade.
2. **INV-02:** Toda escrita em `trades` via `addTrade`.
3. **INV-03:** Pipeline trades → CF → PL/compliance é inquebrável. Análise de impacto obrigatória.
4. **INV-04:** DebugBadge em TUDO — telas, modais, cards. z-[51] em modais. Componentes embedded: `{!embedded && <DebugBadge>}`.
5. **INV-05:** Testes obrigatórios: análise de impacto + regressão + bug-first. Vitest + jsdom. NUNCA entregar lógica nova sem teste.
6. **INV-06:** Datas BR (DD/MM/YYYY), semana começa segunda.
7. **INV-07:** Autorização ANTES de codificar. Proposta → aprovação → código.
8. **INV-08:** CHANGELOG obrigatório antes do merge. Claude propõe entrada.
9. **Git:** commit single-line (PowerShell), ZIPs project-relative.
10. **Falsy zero:** `??` não `||`.
11. **Trade completo:** emotionEntry + emotionExit + setup (stopLoss opcional).
12. **Ticker field:** `symbol`, não `name`.
13. **Docs:** `/docs/ARCHITECTURE.md` é documento vivo — atualizar ao final de cada sessão.

### 6.2 Checklist Pré-Entrega (OBRIGATÓRIO antes de cada ZIP)

Claude DEVE verificar e confirmar explicitamente CADA item antes de apresentar qualquer entrega:

- [ ] **version.js** atualizado com a versão correta?
- [ ] **CHANGELOG.md** com entrada da versão?
- [ ] **Testes** criados para TODA lógica nova? (funções puras, cálculos, detecção de campos)
- [ ] **DebugBadge** presente em todos os componentes UI novos ou tocados?
- [ ] **CONTINUITY** gerado/atualizado ao final da sessão?
- [ ] **ARCHITECTURE.md** atualizado com decisões/dívidas novas?
- [ ] **Análise de impacto** feita para mudanças em collections/CF/hooks?

### 6.3 Lição da Sessão 09/03/2026

Claude entregou B2, B4, B5 e B1/B3 sem testes, sem verificar version.js, e precisou ser cobrado por Marcio em invariantes que já estavam documentadas. Isso desperdiçou tempo do Marcio e gerou retrabalho. A autocrítica está registrada. A correção é o checklist 6.2 — executar ANTES de cada entrega, não depois de ser lembrado.

---

## 7. PRÓXIMA SESSÃO — RECOMENDAÇÃO

**Prioridade 1:** Deploy CF (`firebase deploy --only functions`) + testar cascata localmente + PR/merge da v1.19.0.

**Prioridade 2:** Criar issue consolidada de bugs (#1-#8) e atacar Bug #1 (tickerRule no CSV) primeiro — é o mais impactante.

**Prioridade 3:** Botão de auditoria na UI (chama `auditPlan`) + consumir `focusTab` no App.jsx.

**Bug crítico identificado ao final da sessão:** CF `onTradeUpdated` sobrescreve `rrRatio` com `null` em trades sem stop, apagando o RR assumido que o frontend gravou. Fix: CF deve respeitar `rrAssumed: true` e não sobrescrever, ou replicar `calculateAssumedRR` no backend.
