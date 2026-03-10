# CONTINUITY PROMPT — Sessão 10/03/2026
## Gerado: 2026-03-09 ~23:00 BRT
## Status: v1.19.0 na branch feature/v1.19.0-recalc-cascade-pl-context, pendente PR/merge
## Próximo: Bugs consolidados (Issue #XX), B1 (Recálculo Cascata), B3 (Acesso Mentor Emocional)

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
- B1: Recálculo em Cascata (CF + hooks) — adiado, precisa de functions/index.js
- B3: Acesso Mentor ao Emocional — adiado, UI-only menor risco

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
Commits pendentes na branch: B2+B4+B5 (a serem commitados)
Version: v1.19.0 (no version.js)
Testes: 329 passando (14 novos)
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

## 6. INVARIANTES (SEMPRE APLICAR)

1-14: Sem mudanças — ver sessão anterior.

---

## 7. PRÓXIMA SESSÃO — RECOMENDAÇÃO

**Prioridade 1:** Criar issue consolidada de bugs (#1-#8) e atacar o Bug #1 (tickerRule) primeiro — é o mais impactante.

**Prioridade 2:** B1 (Recálculo Cascata) — precisa de functions/index.js atualizado.

**Prioridade 3:** B3 (Acesso Mentor Emocional) — UI-only, menor risco.

**Para fechar v1.19.0:**
1. Commitar B2+B4+B5 na branch
2. PR + merge
3. Fechar Issue #73 como absorvida pelo B4
4. Manter Issues #71 aberta (B1/B3 pendentes)
