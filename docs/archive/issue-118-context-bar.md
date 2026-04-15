# Issue 118 — arch: Barra de Contexto Unificado
> **Branch:** `feat/issue-118-context-bar`
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Aberto em:** 15/04/2026
> **Status:** Em andamento
> **Versao entregue:** — (a reservar no gate pré-entrega — provavelmente v1.29.0 ou v1.30.0 dependendo do merge do #133)

---

## 1. CONTEXTO

Fundacao arquitetural do Dashboard-Aluno (DEC-047). Hoje cada view opera com filtros independentes — o aluno troca de tela e perde contexto; KPIs nao batem entre views porque cada uma filtra diferente.

Solucao: barra persistente top-level com seletores encadeados **Conta → Plano → Ciclo → Periodo** que governa todas as views. Substitui filtros locais por contexto centralizado reativo.

**Epic pai:** #3 (Dashboard-Aluno MVP)
**Decisao de ordem:** fundacao (este issue) precede refactor de views. Bloqueia UX coerente entre telas.

**Restricao operacional (15/04/2026):** CHUNK-17 LOCKED pelo #133 (AI Approach Plan). Este issue entrega apenas fundacao + refactor StudentDashboard nesta sessao. Refactor dos componentes prop do #134 (PropAccountCard, PropAlertsBanner, PropPayoutTracker + hooks useDrawdownHistory/useMovements) fica para sessao subsequente apos merge do #133.

## 2. ACCEPTANCE CRITERIA

### Fundacao (esta sessao — CHUNK-13 + CHUNK-02)
- [ ] `StudentContextProvider` + `useStudentContext` + `ContextBar` criados
- [ ] `cycleResolver.js` — `detectActiveCycle(plan, now)` e `getDefaultContext(accounts, plans)` como utils puros testaveis
- [ ] Persistencia em localStorage com chave versionada (`studentContext_v1`)
- [ ] Encadeamento reativo sem race condition (Conta → Plano → Ciclo → Periodo)
- [ ] Default inicial respeita E2 (conta com plano ativo mais recente)
- [ ] Ciclo ativo detectado por datas (E3)
- [ ] Periodos predefinidos (E4): semana atual / mes atual / ciclo completo
- [ ] Modo read-only quando ciclo selecionado e anterior
- [ ] StudentDashboard refatorado para consumir contexto (filters local removido)
- [ ] TradesJournal, PlanLedgerExtract, MetricsCards refatorados
- [ ] Modo viewAs do mentor isolado por aluno (E5)
- [ ] MentorDashboard standalone NAO usa a barra (intocado)

### Refactor prop components (sessao subsequente — CHUNK-17 pos-#133)
- [ ] PropAccountCard consome contexto
- [ ] PropAlertsBanner consome contexto
- [ ] PropPayoutTracker consome contexto
- [ ] useDrawdownHistory / useMovements lem contexto
- [ ] Derivation `selectedPropAccountId` removida do StudentDashboard:135-141
- [ ] Teste de regressao #134 completo

### Qualidade
- [ ] Testes cycleResolver (funcao pura)
- [ ] Teste persistencia localStorage (mock)
- [ ] Teste encadeamento cascade
- [ ] Zero regressao no suite completo
- [ ] DebugBadge em ContextBar
- [ ] Validacao AP-08 browser

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | Nenhuma (zero Firestore novo) — usa `createdAt` de plans e `cycles[].startDate/endDate` ja existentes |
| Cloud Functions afetadas | Nenhuma |
| Hooks/listeners afetados | `useAccounts`/`usePlans`/`useMovements`/`useTrades` — continuam iguais, muda QUEM filtra (contexto ao inves de filters local) |
| Side-effects (PL, compliance, emotional) | Nenhum — so muda camada de apresentacao |
| Blast radius | ALTO — refactor transversal do StudentDashboard + consumidores. Mitigacao: atomic PR (E6), testes de regressao, AP-08 rigoroso |
| Rollback | Revert do PR unico restaura estado anterior |

### Shared files impactados (§6.2)
- `src/contexts/StudentContextProvider.jsx` — CRIAR (listado como shared)
- `src/pages/StudentDashboard.jsx` — refactor atomico nesta sessao
- `src/App.jsx` — adicionar Provider no tree (delta no issue, aplicar no merge)
- `docs/PROJECT.md` — lock registry + CHANGELOG + DEC (shared — delta no issue)
- `src/version.js` — bump no gate pre-entrega (shared — delta no issue)

## 4. SESSOES

### Sessao 1 — 15/04/2026

**O que foi feito ate o momento:**
- Protocolo de abertura executado (fases 1-5)
- Locks CHUNK-13 + CHUNK-02 registrados no main (commit 958e58b2)
- Worktree criado em ~/projects/issue-118
- Arquivo de controle criado
- Restricao CHUNK-17 documentada (locked por #133)

**Decisoes ja aprovadas (E1-E6, 15/04/2026):**

| ID | Decisao |
|----|---------|
| E1 | localStorage persiste selecao entre sessoes |
| E2 | Default: conta com plano ativo mais recente (createdAt DESC, id DESC) |
| E3 | Ciclo ativo detectado por datas (now between startDate and endDate) |
| E4 | Periodo: ciclo + predefinidos (semana/mes atual/ciclo completo) |
| E5 | Escopo: aluno + mentor em modo viewAs. Torre/grids multi-aluno NAO usam |
| E6 | Refactor atomico num PR. Sem compatibility layer, sem feature flag |

**Arquivos tocados ate o momento:**
- `docs/PROJECT.md` no main (§6.3 lock registry — commit 958e58b2)
- `docs/dev/issues/issue-118-context-bar.md` (criacao)

**Testes:**
- Nenhum ainda

**Commits:**
- Pendente — aguardando codificacao + aprovacao

**Pendencias para proxima etapa (Fases 6-7):**
- Leitura fresh dos arquivos do escopo (StudentDashboard, AccountFilterBar, DataContext, componentes prop do #134)
- Proposta de implementacao para aprovacao (Gate Pre-Codigo §4.1)
- Codificacao bottom-up: cycleResolver → Provider/Hook → ContextBar → refactor StudentDashboard → refactor consumidores
- Skip passo d (refactor prop components) — pendente CHUNK-17 liberar

---

### Sessao 2 — 15/04/2026 (Fases 6-7 executadas)

**Gate Pre-Codigo §4.1 — aprovado pelo Marcio.** Proposta consolidada incluiu:
- Schema do state (accountId, planId, cycleKey, period)
- API do hook (setAccount encadeado, setPlan, setCycleKey, setPeriodKind)
- Estrategia de rescope viewAs via `key={scopeStudentId}`
- Adaptador temporario para #134 (CHUNK-17 locked): `selectedPropAccountId` derivation mantida — le do contexto via sync bidirecional, passa prop para componentes PROP intocados
- Provider instanciado DENTRO da pagina StudentDashboard (nao em App.jsx) para refactor atomico contido

**Esclarecimento do "Periodo" (E4):** confirmado que e recorte de visualizacao INDEPENDENTE de `plan.operationPeriod` (que governa compliance). Seletores: CYCLE / WEEK / MONTH.

**Arquivos criados (6):**
- `src/hooks/useLocalStorage.js` — hook generico (read/write JSON, fallback SSR e erros)
- `src/utils/cycleResolver.js` — puros: `getCycleKey`, `parseCycleKey`, `detectActiveCycle`, `resolveCycle`, `getPeriodRange`, `getDefaultContext`, `getDefaultPlanForAccount`
- `src/contexts/StudentContextProvider.jsx` — provider + actions encadeadas + persistencia + rescope
- `src/hooks/useStudentContext.js` — hook consumidor
- `src/components/ContextBar.jsx` — UI com 4 dropdowns + badge ciclo read-only
- `src/__tests__/utils/cycleResolver.test.js` — 29 testes
- `src/__tests__/contexts/StudentContextProvider.test.jsx` — 17 testes

**Arquivos editados (1):**
- `src/pages/StudentDashboard.jsx` — corpo renomeado para `StudentDashboardBody`, wrapper novo instancia Provider com `key={scopeStudentId}`. Sincronizacao bidirecional `filters.accountId ↔ ctx.accountId` e `selectedPlanId ↔ ctx.planId` via useEffect. `onAccountSelect` e `onSelectPlan` delegam ao contexto. ContextBar renderizado no topo. `selectedPropAccountId` mantido como adaptador para #134 (le de filters, que reflete contexto).

**Testes:** 1413 total (+46 novos — 29 cycleResolver + 17 provider). Zero regressao, 60 suites.

**Vite dev server:** compilou todos os 6 modulos novos (HTTP 200, HMR clean). Validacao browser real AP-08 pendente do Marcio.

**Decisoes tomadas nesta sessao (DEC-PENDING, aplicar no encerramento):**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| DEC-PENDING-A | StudentContextProvider instanciado DENTRO do StudentDashboard.jsx (nao em App.jsx) | Mantem refactor atomico contido. Delta para App.jsx fica como follow-up quando outros consumidores (fora do StudentDashboard) precisarem do contexto |
| DEC-PENDING-B | Sincronizacao bidirecional filters.accountId ↔ ctx.accountId via useEffect | Permite preservar a estrutura de `filters` multi-campo (period/ticker/setup/etc.) sem refatorar todos os consumers de prop drilling. Contexto e fonte de verdade para conta; filters e caminho local |
| DEC-PENDING-C | `selectedPropAccountId` mantido como adaptador temporario | CHUNK-17 locked pelo #133. PropAccountCard/Banner/Tracker continuam via prop drilling. Migracao para contexto direto em sessao subsequente |
| DEC-PENDING-D | cycleKey canonico: "YYYY-MM" (Mensal) ou "YYYY-Qn" (Trimestral) | Formato determinístico, parseavel, ordenavel por string DESC. Evita Dates com timezones em localStorage |

**Delta para shared files (§6.2) — aplicar no encerramento/PR:**

**`src/App.jsx`** — NAO editado nesta sessao. Nenhuma mudanca necessaria: o StudentContextProvider e instanciado DENTRO do `StudentDashboard` (DEC-PENDING-A). O App.jsx continua exatamente igual. Se futuro issue precisar consumir contexto fora do StudentDashboard, delta sera proposto naquela sessao.

**`src/version.js`** — bump para v1.29.0 ou v1.30.0 no gate pre-entrega, dependendo se #133 mergear primeiro.

**`docs/PROJECT.md`** — aplicar no merge:
1. Bump 0.16.0 → 0.17.0
2. Nova entrada no historico
3. CHANGELOG entry (template abaixo)
4. DEC-080 a DEC-083 (codificados a partir de DEC-PENDING-A..D)
5. Liberar locks CHUNK-13 + CHUNK-02
6. Adicionar em §4.0 (apos "Regra de shared files") a diretiva operacional abaixo

**Delta adicional §4.0 — diretiva operacional para Claude Code:**
```markdown
> **Diretiva operacional para Claude Code — autorização permanente de leitura:**
> Operações de leitura completa NÃO requerem confirmação: `grep`, `cat`, `ls`, `find`, `view`,
> `gh issue view`, `git log/status/diff`, `npm test`, `npm run build`, `head`, `tail`, `wc`,
> `du`, `df`, `ps`, `free`.
>
> Parar para confirmar APENAS em operações destrutivas ou que afetem estado compartilhado:
> `commit`, `push`, `deploy`, `delete`, `rm -rf`, `git reset`, `firebase deploy`.
```

**Template CHANGELOG [v1.29.0 ou v1.30.0]:**
```markdown
### [1.29.0 ou 1.30.0] - 15/04/2026
**Issue:** #118 (arch: Barra de Contexto Unificado)
**Epic:** #3 (Dashboard-Aluno MVP) — fundação arquitetural DEC-047
**Milestone:** v1.1.0 — Espelho Self-Service
#### Adicionado
- **`src/utils/cycleResolver.js`** — utils puros: `getCycleKey`, `parseCycleKey`, `detectActiveCycle`, `resolveCycle`, `getPeriodRange`, `getDefaultContext`, `getDefaultPlanForAccount`
- **`src/contexts/StudentContextProvider.jsx`** — provider com state persistido (localStorage versionada `studentContext_v1_{scopeStudentId}`), actions encadeadas (setAccount → setPlan → setCycleKey → setPeriodKind), rescope por aluno via `key={scopeStudentId}`
- **`src/hooks/useStudentContext.js`** + **`src/hooks/useLocalStorage.js`**
- **`src/components/ContextBar.jsx`** — UI top-level com 4 dropdowns + badge de ciclo finalizado (read-only)
- 46 testes novos (29 cycleResolver + 17 provider), 1413 total (60 suites), zero regressão
#### Alterado
- **`src/pages/StudentDashboard.jsx`** — corpo renomeado para `StudentDashboardBody`, novo wrapper instancia Provider. Sincronização bidirecional `filters.accountId ↔ ctx.accountId` e `selectedPlanId ↔ ctx.planId`. ContextBar renderizado no topo
#### Decisões
- DEC-080 (DEC-PENDING-A): Provider dentro da página StudentDashboard
- DEC-081 (DEC-PENDING-B): Sincronização bidirecional filters ↔ contexto
- DEC-082 (DEC-PENDING-C): Adaptador `selectedPropAccountId` para #134 (CHUNK-17 pendente #133)
- DEC-083 (DEC-PENDING-D): cycleKey canônico YYYY-MM / YYYY-Qn
#### Pendente (sessão subsequente)
- Migração dos componentes do #134 (PropAccountCard, PropAlertsBanner, PropPayoutTracker) + hooks (useDrawdownHistory, useMovements) para consumir contexto direto — requer liberação do CHUNK-17 após merge do #133
- Migração dos consumidores secundários (TradesJournal, PlanLedgerExtract, MetricsCards) para contexto direto (hoje permanecem prop-driven funcionando via sync)
```

**Pendencias para encerramento:**
- Validacao AP-08 no browser (Marcio)
- Commit do worktree com mensagem `feat: barra de contexto unificado (#118)` + `Closes #118`
- Push + PR
- Pos-merge: aplicar delta PROJECT.md + bump version.js + mover issue file para archive + remover worktree + validar com ls

## 5. ENCERRAMENTO

**Status:** Em andamento

**Checklist final:**
- [ ] Acceptance criteria da fundacao atendidos
- [ ] Testes passando
- [ ] PROJECT.md delta documentado (CHANGELOG + DECs + bump version)
- [ ] AP-08 validado no browser
- [ ] PR aberto com Closes #118 no body
- [ ] PR mergeado
- [ ] Issue fechado no GitHub (via keyword)
- [ ] Locks CHUNK-13 + CHUNK-02 liberados
- [ ] Branch deletada
- [ ] Worktree removido (git + rm -rf + validar com ls)
- [ ] Issue file movido para docs/archive/

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-13 | escrita | Criar StudentContextProvider + ContextBar + useStudentContext + cycleResolver (arquivos novos) |
| CHUNK-02 | escrita | Refatorar StudentDashboard + consumidores secundarios (TradesJournal, PlanLedgerExtract, MetricsCards) |
| CHUNK-04 | leitura | useTrades continua existindo, so muda quem filtra (nao precisa lock) |
| CHUNK-17 | escrita (DEFERIDA) | Refactor PropAccountCard, PropAlertsBanner, PropPayoutTracker, useDrawdownHistory, useMovements — LOCKED pelo #133. Executar em sessao subsequente pos-merge |

> **Modo leitura:** a sessao consulta arquivos de qualquer chunk sem lock.
> **Modo escrita:** lock exclusivo obrigatorio — esta sessao tem CHUNK-13 + CHUNK-02.
