# Issue 102 — feat: Revisão Semanal
> **Branch:** `feat/issue-102-revisao-semanal`
> **Milestone:** v1.2.0 — Mentor Cockpit
> **Aberto em:** 15/04/2026
> **Status:** Em andamento
> **Versao reservada:** v1.33.0

---

## 1. CONTEXTO

Revisao Semanal e o principal ritual de mentoria do Espelho: mentor congela KPIs da semana, analisa padroes via SWOT IA, rankeia melhores/piores trades, documenta takeaways e publica para o aluno. Implementada como modo do PlanLedgerExtract (DEC-045), nao tela separada.

#106 (PlanLedgerExtract rename + acumulado periodo) absorvido como Fase A deste issue.

## 2. ACCEPTANCE CRITERIA

### Fase A — PlanLedgerExtract fundacao (#106 absorvido)
- [ ] Label renomeado: "Extrato Emocional" → "Extrato do Plano: {nome}"
- [ ] Coluna PL acumulado do periodo filtrado
- [ ] Header resumo (qty trades, PL, WR do recorte)
- [ ] Prop `mode: 'live' | 'review'` preparatoria (live = default)

### Fase B — Backend reviews
- [ ] Collection `students/{id}/reviews/{reviewId}` + rules + indice
- [ ] CF callable `createWeeklyReview` (snapshot + ranking)
- [ ] CF callable `generateWeeklySwot` (Sonnet 4.6, gating 1/semana/aluno, re-gerar sobrescreve)
- [ ] Hook `useWeeklyReviews(studentId)`
- [ ] Testes CFs + gating + snapshot

### Fase C — UI modo revisao
- [ ] PlanLedgerExtract `mode='review'` consome frozenSnapshot
- [ ] WeeklyReviewModal (SWOT + ranking + takeaways + zoom/meeting fields)
- [ ] Botao "Nova Revisao" no PlanLedgerExtract (trigger primario G8)
- [ ] Seletor periodo ajustavel (semana ISO default, livre G3)
- [ ] Comparacao KPIs revisao anterior vs atual (DEC-045)

### Fase D — Integracao mentor + publicacao aluno
- [ ] Card "Revisoes Pendentes" no MentorDashboard (trigger secundario G8)
- [ ] Status machine DRAFT → CLOSED → ARCHIVED
- [ ] Aluno le revisao CLOSED (read-only, G6)
- [ ] Evolucao Maturidade (4D vs marco zero)
- [ ] Navegacao contextual conta/plano

### Qualidade (todas as fases)
- [ ] Testes passando
- [ ] DebugBadge
- [ ] AP-08 browser
- [ ] Validacao mentor em producao

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `students/{id}/reviews` (escrita — NOVA, DEC-045/G1 aprovado), `trades` (leitura) |
| Cloud Functions afetadas | 2 CFs callable novas: `createWeeklyReview`, `generateWeeklySwot` |
| Hooks/listeners afetados | Novo `useWeeklyReviews`. PlanLedgerExtract ganha modo review |
| Side-effects (PL, compliance, emotional) | Nenhum — reviews sao read-only snapshots, nao alteram trades/PL |
| Blast radius | Fase A: MEDIO (refactor PlanLedgerExtract). Fases B-D: BAIXO (novos componentes/collections) |
| Rollback | Reverter PR por fase. Collection reviews pode ser deletada sem impacto |

## 4. SESSOES

### Sessao 1 — 15/04/2026

**O que foi feito:**
- Body do #102 reescrito com decisoes G1-G8 + faseamento A-D + #106 absorvido
- Body do #106 atualizado como absorvido
- Lock CHUNK-16 registrado no main (commit 4fc7deae)
- v1.33.0 reservada em version.js + PROJECT.md v0.20.1 (commit 2bc38f57)
- Worktree criado em ~/projects/issue-102
- Arquivo de controle criado

**Decisoes aprovadas (referencia — body do #102):**

| ID | Decisao |
|----|---------|
| G1 | DEC-045 cobre schema reviews (INV-15 OK) |
| G2 | 1 SWOT/semana/aluno, re-gerar sobrescreve |
| G3 | Semana ISO default, ajustavel periodo livre |
| G4 | Campos manuais zoom (link + summary texto) |
| G5 | reviews.status='DRAFT' na mesma collection |
| G6 | Aluno le revisao publicada (status CLOSED) |
| G7 | Snapshot e foto, trade muda livre depois |
| G8 | Trigger primario PlanLedgerExtract, secundario MentorDashboard |

**Arquivos tocados:**
- `docs/PROJECT.md` no main (lock CHUNK-16 + v0.20.1 + v1.33.0 reservada)
- `src/version.js` no main (v1.33.0 [RESERVADO])
- `docs/dev/issues/issue-102-revisao-semanal.md` (criacao)

**Testes:** nenhum ainda
**Commits no worktree:** nenhum ainda

---

### Sessao 2 — 16/04/2026 (Fase 0 completa, Fase A pendente)

**O que foi feito:**
- Faseamento revisado: adicionada **Fase 0** (PlanLedgerExtract modal → view via currentView) antes da Fase A
- Body do #102 reescrito no GitHub com Fase 0 + INV-17 declaracao AI
- Gate Pre-Codigo §4.1 executado: explorers leram PlanLedgerExtract (v5.0.0, 302 linhas), Sidebar (currentView pattern), App.jsx (renderContent switch), fluxo feedback ida-e-volta
- Explorer separado mapeou CFs assessment como molde para Fase B (generateAssessmentReport pattern)
- **Fase 0 codificada e testada:**

**Arquivos editados (3, no worktree):**
- `src/App.jsx` (shared file — delta §6.2):
  - State `ledgerPlanId` para rastrear qual plano esta aberto
  - `handleOpenLedger(planId)` seta state + currentView='ledger'
  - `handleBackFromFeedback` agora volta ao extrato (nao ao dashboard) quando `feedbackReturnPlanId` existe
  - Case `'ledger'` no renderContent: renderiza PlanLedgerExtract com plan, trades filtrados, currency
  - Injeta `_fromLedgerPlanId` no onNavigateToFeedback do extrato
  - Import PlanLedgerExtract, useAccounts, getPlanCurrency
  - Prop `hasPlans` passada ao Sidebar
  - Prop `onOpenLedger` passada ao StudentDashboard (ambos: aluno direto e mentor viewAs)
- `src/pages/StudentDashboard.jsx`:
  - Aceita prop `onOpenLedger`
  - Remove state `ledgerPlan`/`setLedgerPlan`
  - Remove useEffect de returnToPlanId (delegado ao App.jsx handleBackFromFeedback)
  - PlanCardGrid.onOpenLedger delega `onOpenLedger(plan.id)` para App
  - Remove render modal de PlanLedgerExtract (agora vive no App.jsx)
  - Remove import PlanLedgerExtract
- `src/components/Sidebar.jsx`:
  - Import `FileText` (lucide)
  - Prop `hasPlans = false`
  - Item "Extrato do Plano" (id='ledger', icon=FileText) condicional a hasPlans no menu do aluno

**Testes:** 1456/62 suites, zero regressao
**Commits no worktree:** nenhum ainda (pendente validacao AP-08 browser)

**Fluxo novo (Fase 0):**
```
Sidebar "Extrato do Plano" → currentView='ledger' → App.jsx renderiza PlanLedgerExtract
  OU PlanCardGrid "Extrato" → onOpenLedger(plan.id) → handleOpenLedger → currentView='ledger'
    → Clica trade → feedback → handleBackFromFeedback → volta ao extrato (nao dashboard)
    → Botao fechar → currentView='dashboard'
```

**IMPORTANTE — Shared file App.jsx editado no worktree:**
- App.jsx e shared file (§6.2). Editado diretamente no worktree por necessidade (renderContent case + state + handlers sao essenciais para a feature funcionar)
- #145 (sessao paralela) tambem pode tocar App.jsx — merge pode gerar conflito no renderContent
- Delta documentado acima para resolucao de conflito se necessario

**Pendencias para proxima sessao (retomar daqui):**
1. **Validacao AP-08 browser** — rodar `npm run dev` no worktree, abrir localhost, testar:
   - Sidebar mostra "Extrato do Plano" (so se aluno tem planos)
   - Clicar abre extrato como view (nao modal)
   - Clicar "Extrato" no PlanCardGrid abre extrato como view
   - Feedback ida-e-volta funciona (extrato → trade → feedback → volta ao extrato)
   - MentorDashboard intocado
2. **Commit da Fase 0** apos validacao AP-08
3. **Iniciar Fase A** — rename label + coluna acumulado periodo + resumo + prop mode

**Estado do worktree:**
- Diretorio: `~/projects/issue-102`
- Branch: `feat/issue-102-revisao-semanal`
- Working tree: 3 arquivos modificados (nao commitados)
- Testes: 1456 passando

**Estado do main:**
- HEAD: `2bc38f57 docs: reservar v1.33.0 + PROJECT.md v0.20.1 para issue-102`
- Locks ativos: CHUNK-16 (#102), CHUNK-02 (#145), CHUNK-17 (#145)
- Versao reservada: v1.33.0

**Delta para PROJECT.md (aplicar no merge):**

**1. Nova invariante INV-17 — Gate de Arquitetura de Informacao (adicionar apos INV-16 na secao 3):**
```markdown
### INV-17: Gate de Arquitetura de Informacao
Antes de propor qualquer componente de UI novo ou modificacao de tela existente, declarar:
1. **Nivel** — sidebar / tab / card / modal
2. **Dominio** — Dashboard, Operacao, Mesa Prop, Feedback, Analise, Contas, Revisao, Config
3. **Justificativa** se o dado ja aparece em outra tela
4. **Budget** — se a tela destino ja tem 6+ secoes visiveis, remover ou colapsar algo antes de adicionar

Resposta a "secao colapsavel no componente X" e sempre: "qual tela existente deveria mostrar isso, ou precisa de tela nova?"
```

**2. Mapa de dominios (adicionar ao §5 Checklist de Impacto, novo item 11):**
```markdown
11. Gate de AI (INV-17):
    - Nivel do componente (sidebar/tab/card/modal)
    - Dominio correto (ver mapa abaixo)
    - Budget da tela destino (6+ secoes = remover/colapsar antes de adicionar)
```

**Mapa de dominios:**

| Dominio | Sidebar | O que mora | O que NAO mora |
|---------|---------|-----------|----------------|
| Dashboard | Sim | KPIs resumo, equity curve, calendario, SWOT | Detalhes prop, payout, AI plan |
| Operacao (Diario) | Sim | Registro e historico de trades | Analises agregadas |
| Mesa Prop | Sim (condicional) | Gauges DD, alertas, payout, AI plan, sparkline | KPIs genericos |
| Feedback | Sim | Chat mentor-aluno por trade | Shadow (mora no detalhe do trade) |
| Analise | Futuro | Dashboard emocional (#131), evolucao temporal | Registro de trades |
| Contas | Sim | CRUD contas e planos | Dados operacionais |
| Revisao | Futuro | Revisao semanal (#102), historico de revisoes | Tudo que nao e revisao |
| Config | Sim | Settings mentor, templates, compliance | Dados de aluno |

**3. Declaracao AI para o #102:**
Revisao Semanal mora no dominio **Revisao** — item novo no sidebar do mentor (nivel 1). Modo revisao do PlanLedgerExtract e nivel 2 (tab/modo dentro do dominio Operacao, acessivel via botao "Nova Revisao").

**4. CHANGELOG [1.33.0] — template (adicionar no topo da secao 10):**
(a preencher ao concluir codificacao das fases)

## 5. ENCERRAMENTO

**Status:** Em andamento

**Checklist final:**
- [ ] Acceptance criteria atendidos (por fase)
- [ ] Testes passando
- [ ] PROJECT.md delta documentado (CHANGELOG [1.33.0] + DECs)
- [ ] version.js aplicado (v1.33.0)
- [ ] AP-08 validado no browser
- [ ] PR aberto com Closes #102 + Closes #106 no body
- [ ] PR mergeado
- [ ] Issues #102 e #106 fechados no GitHub (auto via keywords)
- [ ] Lock CHUNK-16 liberado
- [ ] Branch deletada
- [ ] Worktree removido (pkill vite → git worktree remove → rm -rf → validar com ls)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-16 | escrita | PlanLedgerExtract refactor + ReviewManager + WeeklyReviewModal + CFs |
| CHUNK-04 | leitura | Trades para snapshot e ranking |
| CHUNK-02 | leitura (Fase D: escrita) | Sidebar aluno — seção "Revisões". NOTA: CHUNK-02 LOCKED pelo #145 — Fase D pode precisar aguardar |

> **Restrição operacional:** CHUNK-02 está LOCKED pelo #145 (sessão paralela). Fase D (sidebar aluno) pode precisar aguardar liberação. Fases A-C usam apenas CHUNK-16 (escrita) + CHUNK-04 (leitura).
