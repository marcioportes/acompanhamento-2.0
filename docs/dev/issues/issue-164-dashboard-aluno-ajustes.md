# Issue 164 — feat: Ajustes Dashboard Aluno
> **Branch:** `feat/issue-164-dashboard-aluno-ajustes`
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Aberto em:** 21/04/2026
> **Status:** 🟢 Pronto para PR (pendente validação browser)
> **Versão entregue:** 1.41.0

---

## 1. CONTEXTO

Issue do GitHub (corpo original):
> - Retirar cards que não estão atualizados — consultar com Márcio para escrever o spec final.
> - Incluir Card com Coef. Variação + Tempo médio dos trades com padrão de cor: se delta-T de W > L verde, se próximo amarelo, se abaixo vermelho.
> - A seção de SWOT deriva da Revisão, retirar a que está atualmente.

Sev2 · `epic:aluno-stability` · `module:dashboard-aluno` · `type:bug`.

Após spec review iterado com Marcio (3 iterações, INV-18), o escopo foi consolidado em **4 entregas (E1, E2, E3, E5)**. **E4 (cards desatualizados) foi removida** — Marcio confirmou que nenhum dos 10 cards do `MetricsCards` está stale ("estão funcionando bem").

Marcio referenciou `~/.claude/plans/transient-drifting-acorn.md` como **padrão de enriquecimento 4D** (1 métrica por dimensão, zero campo novo em Firestore, grid 2×2 + sparkline) — esse padrão é replicado em E3 (Matriz Emocional 4D).

## 2. ACCEPTANCE CRITERIA

### E1 · SWOT lê review.swot
- [ ] `<SwotAnalysis>` no `StudentDashboard` consome `review.swot` da última review com `status === 'CLOSED'` (subcollection `students/{id}/reviews`).
- [ ] Hook `useLatestClosedReview(studentId, planId?)` filtra reviews CLOSED ordenadas por `weekStart desc`, retorna a primeira.
- [ ] Layout 2×2 mantido (cores emerald/red/blue/amber, ícones Lucide), igual `WeeklyReviewPage` `SwotSection`.
- [ ] Estado vazio (sem review CLOSED): card único com mensagem "Aguardando primeira Revisão Semanal fechada pelo mentor." + CTA "Ver Revisão Semanal".
- [ ] Badge no header com `modelVersion` + `generatedAt` da geração IA (ou label "fallback determinístico" quando `aiUnavailable`).
- [ ] Lógica determinística antiga removida do `SwotAnalysis.jsx` (~322 linhas → ~100 linhas).
- [ ] DebugBadge mantido (INV-04).

### E2 · Card "Consistência Operacional" (CV + ΔT)
- [ ] Card novo em `MetricsCards` (Painel 2 Desempenho, último bloco antes do divisor de EV).
- [ ] **CV de P&L**: `std(results) / |mean(results)|` com semáforo DEC-050: `<0.5 🟢 Consistente · 0.5–1.0 🟡 Moderado · >1.0 🔴 Errático`. Barra horizontal proporcional.
- [ ] **ΔT W vs L**: `(tempoW − tempoL) / tempoL × 100%` com semáforo: `>+20% 🟢 winners run · -10% a +20% 🟡 · <-10% 🔴 segurando loss`. Mostra `tempoW`, `tempoL` e `ΔT%`.
- [ ] Tooltip contextual em ambas linhas (pattern `getPayoffTooltip`).
- [ ] **Card "Consistência" antigo (RR Asymmetry, #6)** removido — semântica errada.
- [ ] **Card "Tempo Médio" isolado (#10, linhas 398-426)** removido — integrado ao card novo.
- [ ] Cálculo de CV em `useDashboardMetrics` (extensão do hook), zero campo Firestore novo.

### E3 · Matriz Emocional 4D (Opção A)
- [ ] `EmotionAnalysis.jsx` reescrito mantendo agrupamento por `emotionEntry` (fallback `emotion` legado).
- [ ] Cada item da lista vira card com **grid 2×2 micro-KPIs** + **sparkline** no rodapé:
  - **Financial**: expectância (`avgPL`) + payoff por emoção (`avgWin / |avgLoss|`).
  - **Operational**: shift rate = `% trades onde emotionExit !== emotionEntry`.
  - **Emotional**: Δ WR = `WR_emocao - WR_global` (destaca se emoção drena ou puxa).
  - **Maturity**: sparkline de PL acumulado nos últimos N trades dessa emoção (tendência).
- [ ] Header passa de "Matriz Emocional" para "Matriz Emocional 4D".
- [ ] Rodapé reescrito com insight acionável (ex: "Você tem *shift rate* alto em 'Ansioso' — entra calmo e termina ansioso → costuma virar perda").
- [ ] Sparkline inline SVG (~30 linhas), sem lib nova (padrão `transient-drifting-acorn.md`).
- [ ] Zero campo Firestore novo.

### E5 · EquityCurve ampliado
- [ ] **Tabs por moeda** quando contexto agrega ≥2 moedas distintas:
  - Tabs no header (BRL · USD · EUR), default = moeda com maior volume de trades no período.
  - Cada tab tem sua própria série + eixo Y próprio (nunca mistura).
  - Quando só 1 moeda: tabs ocultas, comportamento atual.
- [ ] **Curva ideal do plano** quando `useStudentContext().planId` é string (plano único):
  - Linha tracejada verde (meta): `pl × (1 + cycleGoal)` linear de `cycle.startDate` a `cycle.endDate`, **dias corridos**.
  - Linha tracejada vermelha (stop): `pl × (1 − cycleStop)` linear, dias corridos.
  - Curva real acima da meta → segmento emerald denser; abaixo do stop → red denser.
  - Badge no header: `+X% acima da meta` / `dentro do corredor` / `-X% abaixo do stop`.
  - **Trajetória linear** (dias corridos), **linha suave**, **continua extrapolando após meta** (não congela).
- [ ] Quando `planId === null` (todos planos) → comportamento atual sem overlay.
- [ ] Quando `planId !== null` mas ciclo sem `startDate`/`endDate` → sem ideal, badge "sem ciclo ativo".

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | **Leitura:** `students/{id}/reviews` (E1), `trades` (E2/E3/E5), `plans` (E5), `accounts` (E5). **Escrita:** zero. |
| Cloud Functions afetadas | Nenhuma. `generateWeeklySwot` consumida apenas como produtora do dado já persistido em `review.swot`. |
| Hooks/listeners afetados | `useDashboardMetrics` estendido (CV, ΔT). Novo `useLatestClosedReview`. `useStudentContext` lido (planId). `useAccounts`/`usePlans` consumidos para curva ideal. |
| Side-effects (PL, compliance, emotional) | Zero. Tudo é apresentação derivada de dados existentes. |
| Blast radius | Médio. `StudentDashboard` é hot path — qualquer regressão visual atinge 100% dos alunos. Mitigação: testes antes de UI (E2 cálculos, E5 curva ideal); validação browser por contexto (aluno + mentor view-as), conforme §4.2 pós-#162. |
| Rollback | Cada entrega isolável por commit. `git revert` granular. PR único v1.41.0 mas commits split por entrega. |

**INV checklist:**
- INV-01/02 ok (zero escrita em `trades`/`plans`).
- INV-04 DebugBadge mantido em todos os componentes tocados.
- INV-05 testes antes de UI: E2 cálculos CV/ΔT, E5 curva ideal (geometria linear), E3 cálculos shift rate / Δ WR / sparkline series.
- INV-10/15 zero estrutura Firestore nova.
- INV-17 declarado abaixo.
- INV-18 spec review concluído (3 iterações com Marcio, todos os pontos confirmados).

## 3.1 Gate INV-17 — Arquitetura de Informação

| Entrega | Nível | Domínio | Duplicação | Budget |
|---------|-------|---------|------------|--------|
| E1 | seção (componente substituído) | Dashboard do Aluno | Reuso de SWOT da Revisão Semanal — elimina duplicação local-vs-IA. | Net-zero (substitui). |
| E2 | card (dentro do MetricsCards) | Dashboard do Aluno | Substitui card "Consistência" RR Asymmetry e "Tempo Médio" isolado — elimina duplicação semântica. | Net-zero (2 cards → 1). |
| E3 | seção (componente reescrito) | Dashboard do Aluno | Sparkline por emoção é intersecção, não duplicação de Análise por Setup. | Net-zero (mesmo componente). |
| E5 | seção (componente ampliado) | Dashboard do Aluno | Tabs evitam mistura de moedas. Curva ideal não duplica nada — é overlay novo. | Net-zero (mesmo componente). |

## 4. SESSÕES

### Sessão — 21/04/2026 (abertura)

**O que foi feito:**
- Análise de impacto e inventário de cards do `StudentDashboard` (Explore agent, 14 seções mapeadas).
- Investigação de `EquityCurve.jsx`, multi-currency em `useDashboardMetrics`, plano selecionado via `useStudentContext`, campos `cycleGoal/cycleStop` em `plans`.
- Identificação de `Matriz Emocional` (`EmotionAnalysis.jsx`) como componente desatualizado: descritivo demais, ignora `emotionExit`/shift entry→exit, não cruza com baseline.
- Mapeamento da estrutura `review.swot` (CF `generateWeeklySwot.js:1-156`, schema 4 arrays + metadata).
- Spec review iterado em 3 iterações (INV-18) com Marcio, todos os pontos confirmados.
- Lock CHUNK-02 + reserva v1.41.0 commitados no main (commit `7d44626f`).
- Worktree `~/projects/issue-164` criado em `feat/issue-164-dashboard-aluno-ajustes`.

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| (E1) | SWOT do Dashboard reaproveita `review.swot` ao invés de calcular local. | Single source of truth — IA do mentor é canônica; análise determinística local virava ruído competidor. |
| (E1) | Fallback "aguardando revisão" quando não há review CLOSED. | Aluno entende ausência sem confusão; CTA leva para WeeklyReviewPage. |
| (E2) | Card novo "Consistência Operacional" combina CV de P&L + ΔT W/L. | Semântica correta — "consistência" hoje é nome de RR Asymmetry, conceitualmente errado. CV (DEC-050) + comportamento em posição (ΔT) são os dois eixos reais de consistência. |
| (E2) | Thresholds ΔT: `>+20% 🟢 / -10% a +20% 🟡 / <-10% 🔴`. | Margem assimétrica favorece "winners run" (princípio do trader maduro). |
| (E3) | Matriz Emocional 4D Opção A (extensão do componente atual com 4 micro-KPIs por dimensão + sparkline). | MVP coerente com escopo do issue; B (heatmap 2D) e C (TEF score) ficam para fase 2. |
| (E5) | Tabs por moeda quando contexto agrega ≥2 moedas (não eixos duplos). | Eixos duplos confundem leitura; tabs são UX clara e zero risco de comparação cross-currency errada. |
| (E5) | Curva ideal: trajetória linear pelos dias corridos, linha suave, continua extrapolando após meta. | Simplicidade implementacional + leitura natural; degraus diários e dias úteis ficam para iteração futura se demanda surgir. |

**Arquivos a tocar (planejado):**
- `src/components/SwotAnalysis.jsx` — reescrita (E1)
- `src/hooks/useLatestClosedReview.js` — novo (E1)
- `src/components/dashboard/MetricsCards.jsx` — ajuste cards (E2)
- `src/hooks/useDashboardMetrics.js` — extensão CV/ΔT (E2)
- `src/components/EmotionAnalysis.jsx` — reescrita 4D (E3)
- `src/components/EquityCurve.jsx` — ampliação (E5)
- `src/utils/equityCurveIdeal.js` — novo, lógica pura curva ideal (E5)
- `src/__tests__/utils/dashboardMetrics.test.js` — testes CV/ΔT (E2)
- `src/__tests__/utils/equityCurveIdeal.test.js` — testes curva ideal (E5)
- `src/__tests__/components/SwotAnalysis.test.jsx` — testes hook + estado vazio (E1)
- `src/__tests__/components/EmotionAnalysis.test.jsx` — testes 4D (E3)
- `src/pages/StudentDashboard.jsx` — wire dos hooks novos (mínimo)

**Testes:**
- Antes da UI (INV-05): cálculos puros (CV, ΔT, curva ideal).
- Depois: render dos componentes (estado vazio, dados normais, dados extremos).
- Meta: ~30-40 testes novos, baseline atual 1732/1732.

**Pendências para próxima sessão:**
- Implementar na ordem: testes E2 → E2 UI → testes E5 → E5 UI → E1 → E3.
- Validação browser nos contextos: aluno logado, mentor view-as, contexto multi-moeda real.
- `npm run lint` em arquivos tocados (gate pré-entrega §4.2).

### Sessão — 21/04/2026 (entrega inicial E1-E5 + review pós-validação browser)

**Entrega das 4 tarefas** (commits `40961b15` → `5fb80776`, 14 commits, TDD):
- E2 util + hook + UI (`calculateConsistencyCV`, `calculateDurationDelta`, card "Consistência Operacional")
- E5 util + UI (`generateIdealEquitySeries`, `calculateIdealStatus`, tabs multi-moeda + overlay curva ideal)
- E1 hook + refactor (`useLatestClosedReview`, `SwotAnalysis` consumindo `review.swot`)
- E3 util + UI (`buildEmotionMatrix4D`, Matriz Emocional 4D — Opção A)

**Review pós-validação browser** (commits `3bcaa214` → `e4023c29`, 9 fixes):
- Card Consistência em grid 2-col (fix layout)
- Matriz Emocional em grid 2-col + sparkline compacto 60×24
- EquityCurve inicial sem tabs (tentativa de simplificação — revertida em 22/04)
- DebugBadge embedded em EmotionAnalysis/DashboardHeader/MetricsCards/ContextBar
- Toggle Eye/EyeOff para curva ideal (`equityCurve.showIdeal.v1` no localStorage)
- AccountFilterBar removido (redundante com ContextBar #118); `accountTypeFilter` passou a `'all'` fixo no `useDashboardMetrics`
- 4 painéis indicadores em grid 2×2 (lg:grid-cols-2 auto-rows-fr)
- DashboardHeader antes da ContextBar (reorder — z-index de dropdowns)
- ContextBar wrapper `relative z-40` (backdrop-blur-sm cria stacking context)

**Testes:** 1732 → 1839 (+107 novos). Lint: warnings baseline preservados (sem novos erros introduzidos).

**Encerrado por:** shutdown WSL do Marcio no pregão. Dev server (`npm run dev`, porta 5173) morreu junto.

---

### Sessão — 22/04/2026 (recovery + round final de review + bugs carregados)

Recovery a partir do filesystem usando `.recovery_session_164` (INV-26 known-exception no coord-id). Segunda rodada de review após Marcio operar e identificar regressões + bugs adicionais.

**Review adicional** (commits `a2e7ea8b` → `29260f7c`, 6 fixes):
- **Multi-moeda restaurada** (`a2e7ea8b`): tabs USD/R$ voltaram no EquityCurve quando ≥2 moedas; fix do stale activeTab via `useEffect` em `tabsFingerprint` (reset quando o conjunto de moedas muda); overlay renderiza apenas na tab da moeda dominante.
- **Cascata do filtro** (`454ac778`): `selectedPlanId` passa a ter precedência em `useDashboardMetrics`; novo memo `accountsInScope` vira fonte única para `aggregatedInitialBalance`, `aggregatedCurrentBalance`, `balancesByCurrency`, `dominantCurrency` (elimina 3 blocos if/else duplicados, −44 +29 linhas).
- **ContextBar preserva accountId** (`904d96c7`): `setPlan` NÃO propaga mais `accountId = plan.accountId`; ContextBar lista TODOS os planos ativos quando "Todas as contas"; opção "Todos os planos" para desmarcar; dropdown habilitado mesmo sem conta específica.
- **SwotAnalysis respeita conta** (`6da58bb2`): `useLatestClosedReview` aceita `planFilter: string | string[] | null`; StudentDashboard calcula `swotAccountPlanIds` (planos ativos da conta) e passa ao SwotAnalysis; conta sem reviews → fallback "aguardando revisão".
- **SwotAnalysis tolera planId stale** (`29260f7c`): query broader (últimas 20 CLOSED) + filtro client-side aceita match em `planId` top-level OU `frozenSnapshot.planContext.planId`. Resiliente a planos renomeados/recriados.

**E3-revised — Matriz Emocional 4D** (`43c8d7d7`): consolidação pós-auditoria com Plan agent. 4 decisões aprovadas pelo Marcio:
- D1: Sublabels permanentes por quadrante (Opção D) — driver visível sem hover (Financial · edge por trade; Operational · aderência sob stress; Emotional · impacto da emoção no WR; Maturidade · evolução recente).
- D2: Rename "Maturity" → "Maturidade" (DEC-014 pt-BR).
- D3: Grid `xl:grid-cols-3` (md mantém 2-col, mobile 1-col).
- D4: Sparkline mantido como "evolução recente" agora; engine de maturidade por gates tratada em #119 (body enriquecido com framework 4D × 5 estágios + 6 fases de entrega + DECs + chunks).

**Bugs out-of-scope carregados pela branch** (pragmatismo — diff pequeno, evita ceremony de worktree novo):
- `c21b6f2b` · **Trade edit exchange undefined**: import CSV não propagava `exchange` no `tradeData`; `<select value={undefined}>` degradava para uncontrolled; `updateTrade` não sanitizava undefined antes do `updateDoc`. 3 fixes em cadeia: `useCsvStaging`, `AddTradeModal`, `useTrades`.
- `8be50158` · **#102 PinToReviewButton**: fluxo "Feedback Trade > Continuar Rascunho" salvava texto em `takeawayItems` + `takeaways` (legado) — correto é `sessionNotes`. Novo `appendSessionNotes` no `useWeeklyReviews`; PinToReviewButton usa ele.

**Testes finais:** 1840/1840 verde (+1 novo em `useLatestClosedReview.test.jsx` cobrindo planId stale via frozenSnapshot).

**Pendências para encerramento:**
- Validação browser pós-todos-os-fixes (dev server precisa subir)
- CHANGELOG [1.41.0] definitivo (texto abaixo)
- PR + merge + §4.3

## 5. ENCERRAMENTO

**Status:** 🟢 Pronto para PR — aguardando validação browser antes do merge.

**Checklist final:**
- [x] Acceptance criteria E1/E2/E3/E5 atendidos (+ review fixes consolidados)
- [x] Testes passando — **1840/1840** (baseline era 1732 no início; +108 novos)
- [x] `npm run lint` — warnings pré-existentes, **nenhum erro introduzido** em arquivos tocados nesta sessão
- [ ] Validação browser — **PENDENTE** (dev server morreu no shutdown WSL; subir antes do merge)
- [ ] PROJECT.md atualizado (CHANGELOG [1.41.0] definitivo — delta proposto em §7)
- [ ] PR aberto com `Closes #164`
- [ ] PR mergeado, branch deletada
- [ ] Lock CHUNK-02 liberado em §6.3 (status AVAILABLE, removido de Locks ativos)
- [ ] Worktree removido (`git worktree remove` + `rm -rf`, §4.3)
- [ ] Issue doc movida para `docs/archive/`

**Commits totais na branch:** 36 (1 doc + 14 implementação + 9 review inicial + 6 review final + 1 E3-revised + 1 exchange CSV + 1 PinToReviewButton #102 + 3 outros fixes ContextBar).

**Débitos herdados (não bloqueiam merge, tratados em follow-up):**
- Testes de regressão para o fix de `exchange` undefined (INV-05 pediria 2 casos: `updateTrade` sem exchange + `activateTrade` propaga exchange).
- Backfill de trades CSV já importados sem campo `exchange` (fix #2 permite editar e regravar um a um; script de backfill opcional se volume for grande).

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-02 | escrita | StudentDashboard, MetricsCards, SwotAnalysis, EmotionAnalysis, EquityCurve, useDashboardMetrics |
| CHUNK-04 | leitura | `useTrades` para dados base de CV e Δ WR |
| CHUNK-06 | leitura | `useEmotionalProfile` para baseline de Δ WR (E3) — se necessário |
| CHUNK-13 | leitura | `useStudentContext` (planId, accountId, currency) |
| CHUNK-16 | leitura | `students/{id}/reviews` para `review.swot` (E1) |

## 7. SHARED FILES — DELTAS

| Arquivo | Delta | Status |
|---------|-------|--------|
| `src/version.js` | bump 1.40.0 → 1.41.0 com entrada CHANGELOG reservada | ✅ aplicado no main (commit `7d44626f`) |
| `docs/PROJECT.md` | Versão 0.23.8 → 0.24.0, lock CHUNK-02 em §6.3, entrada CHANGELOG [1.41.0] reservada na seção 10 | ✅ aplicado no main (commit `7d44626f`) |
| `docs/PROJECT.md` | **Delta final de encerramento** — ver proposta abaixo | ⏳ aplicar no main pós-merge |
| `docs/PROJECT.md` | Liberar lock CHUNK-02 em §6.3 (status AVAILABLE, tirar de Locks Ativos) | ⏳ aplicar no main pós-merge |

### 7.1 CHANGELOG [1.41.0] definitivo (substituir entrada RESERVADA)

```markdown
- 1.41.0: feat: Ajustes Dashboard Aluno (issue #164, Sev2) — 4 entregas consolidadas
  após spec review iterado (INV-18) + 2 rodadas de review pós-validação browser:
  **E1** SWOT do Dashboard reaproveita `review.swot` via novo hook `useLatestClosedReview`
  (query broader + filtro client-side aceita `planId` top-level e
  `frozenSnapshot.planContext.planId` para tolerar planId stale); fallback
  "aguardando revisão". **E2** card "Consistência Operacional" (CV P&L com
  semáforo DEC-050 + ΔT W/L com semáforo ±20%/±10%) substitui "Consistência"
  RR Asymmetry e Tempo Médio isolado. **E3** Matriz Emocional 4D Opção D
  (expectância + payoff; shift rate entry→exit; WR + Δ WR vs baseline;
  sparkline "evolução recente"); sublabels permanentes por quadrante
  (Financial · edge por trade / Operational · aderência sob stress / Emotional ·
  impacto da emoção no WR / Maturidade · evolução recente); rename
  Maturity→Maturidade (DEC-014 pt-BR); grid `xl:grid-cols-3`. **E5** EquityCurve
  com tabs por moeda quando contexto agrega ≥2 moedas (fix stale activeTab via
  `useEffect` em `tabsFingerprint`) + curva ideal do plano (meta/stop linear
  pelos dias corridos do ciclo) com toggle Eye/EyeOff persistido em
  `equityCurve.showIdeal.v1`. **Cascata de filtro ContextBar → todos os cards**:
  `selectedPlanId` tem precedência em `useDashboardMetrics`; novo memo
  `accountsInScope` é fonte única para saldos/moeda/agregações (−44 +29 linhas).
  **ContextBar preserva `accountId` do usuário** (selecionar plano NÃO muda
  conta); lista todos os planos ativos quando "Todas as contas"; opção "Todos
  os planos" desmarca. **AccountFilterBar removido** (redundante com ContextBar
  #118). **Bugs carregados** (fora de escopo #164, corrigidos na mesma branch
  por pragmatismo): (a) trade edit falhava com `exchange: undefined` após
  import CSV — fix em 3 camadas (`useCsvStaging` propaga exchange,
  `AddTradeModal` fallback para trades legados, `useTrades` stripa undefined
  antes do `updateDoc`); (b) #102 PinToReviewButton salvava texto em
  `takeawayItems` + `takeaways` ao invés de `sessionNotes` — novo
  `appendSessionNotes` no `useWeeklyReviews` corrige o fluxo "Feedback Trade >
  Continuar Rascunho". 1732 → 1840 testes. 36 commits.
```

### 7.2 §6.3 — Liberar lock CHUNK-02

Mover de "Locks Ativos" para "AVAILABLE"; registrar entrega em histórico do chunk com issue #164 + versão 1.41.0.

> Nenhum outro shared file foi editado dentro do worktree. Todos os deltas acima são propostos aqui e serão aplicados no main após merge do PR.
