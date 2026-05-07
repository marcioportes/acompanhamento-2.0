# Issue #259 — feat: 1A Ritual completo de Fechamento de Ciclo (v1.58.0)

> **Template enxuto (R4).** Spec completa mora no body do GitHub: #259.
> **Draft de design** (fonte canônica do desenho): `Temp/ritual-fechamento-ciclo-draft.md`.
> **Mockup HTML interativo** (9 telas): `Temp/cycle-closure-mockup.html`.

## Autorização

- [x] **Mockup apresentado** — `Temp/cycle-closure-mockup.html` (9 telas: dashboard + wizard etapas 1/3/6 + override + 4 mentor) revisado por Marcio em 06-07/05/2026
- [x] **Memória de cálculo apresentada** — TPS, Kelly, Monte Carlo, IA stub heurístico documentados no draft §4 e replicados no body do issue #259
- [x] **Marcio autorizou** — 07/05/2026 ("vamos para programação", após autorizar bump v1.58.0)
- [x] **Gate Pré-Código liberado** — 07/05/2026 (locks CHUNK-03/04/16 ESCRITA + 05/06/08/09 leitura registrados, worktree criado, versão 1.58.0 reservada)

## Context

Hoje um ciclo expira sem ritual. Aluno vê o número, fecha mentalmente, segue. Sem captura de aprendizado, padrões cumulativos viram ruído. Plano CRUD anterior (snapshot+realocação) foi rejeitado por "simplista, não simples". Opção B aprovada: ritual completo desde 1A com Kelly+MC+IA stub heurístico determinístico (LLM real entra em 1B sobre stub validado em produção).

## Spec

Ver issue body no GitHub: **#259**. Detalhe estrutural completo (10 seções A-J, modelo de dados v2, wireframes, worked example) em `Temp/ritual-fechamento-ciclo-draft.md`.

## Mockup

`Temp/cycle-closure-mockup.html` — 9 telas standalone (HTML/Tailwind glassmorphism dark, fiel ao projeto):

1. Dashboard com `<CycleExpiredGuard>` (3 cards de ciclos vencidos sequenciais)
2. Wizard etapa 1 (Read) — Snapshot + equity curve + métricas + TPS gauge
3. Wizard etapa 3 (Reflect) — AAR Q1-Q4 com auto-fill, multi-checkbox, chips sustain/improve
4. Wizard etapa 6 (Adjust) — Kelly card + MC histograma + IA stub recommendation + 3 botões
5. Mentor override de stage promotion (gates list + rationale obrigatória)
6. Mentor inbox de closures (semáforo de urgência, 6 items)
7. Mentor view do closure (read-only 8 etapas em accordion + sticky comment panel)
8. Mentor wizard modo demonstração (badge roxo + hints pedagógicos)
9. Flow C: MentorDashboard com `selectedStudent` (CycleExpiredGuard contextualizado)

## Memória de Cálculo

### TPS (Trading Performance Score 0-100)
```
TPS = clamp(profitFactor / 3, 0, 1) × 0.20
    + (1 - maxDDPercent / 0.05) × 0.25       # maxAcceptableDD = cap fixo 5% (Q3)
    + clamp(expectancy_R / 0.5, 0, 1) × 0.20
    + winRateConsistency × 0.15               # weekly buckets (5+ sem) ou daily
    + ruleAdherenceRate × 0.20                # peso ↑ Mark Douglas (Q12)
    × 100
```

### R-multiple, Expectancy_R, ruleAdherenceRate
```
R                    = plan.pl × plan.riskPerOperation / 100   # trade.riskOnEntry NÃO existe
trade_R_multiple     = trade.result / R
expectancy_R         = winRate × avgWinR + lossRate × avgLossR  (Van Tharp)
ruleAdherenceRate    = trades com compliance.roStatus='OK' E rrStatus='OK' / total
```

### Kelly real (Quarter)
```
edge        = expectancy_R × R
variance    = std(trade_R_multiples)²
kelly_full  = edge / (variance × R²)
kelly_safe  = kelly_full × 0.25  # Quarter-Kelly default (Q7), configurável global
```

### Monte Carlo bootstrap
```
sample_pool = ciclo_anterior.trades  if ciclo_anterior.tradesCount ≥ 30 else últimos 100
N_sims      = 1000
N_per_sim   = ciclo.tradesCount
mc_p10/50/90 = percentis das somas bootstrap
```

### IA stub heurístico (closurePlanAdvisor.js — determinístico)
```
if sample_size < 50:                                 → manter (edge precisa n≥50)
elif kelly_safe > 2 × current AND no_regression:     → subir size em 25%
elif maxDD > 70% × stop AND ruleAdherence < 90%:     → reduzir size em 25%
elif regression_dimensions ≠ []:                     → manter + foco no improve do Q4
else:                                                → manter + observar
```

### Forward actions auto-suggest (stub)
- Sugestão 1: derivada do top 1 erro do ciclo (ex: NO_STOP → "gate na entrada bloqueia entry sem SL")
- Sugestão 2: derivada do valley emocional ↔ contexto (ex: TILT após 3-loss → "hard stop após 3 losses consecutivos")
- Aluno aceita / edita / escreve do zero (max 2 commitments)

### Hard seal
```
addTrade/updateTrade/deleteTrade rejeitam se:
  trade.date ∈ [closure.cycleStart, closure.cycleEnd]
  AND closure.status = 'CLOSED'
  AND closure.cycleEnd ≤ plan.lastClosedCycleEnd  # cache O(1)
```

### Exemplo numérico (Clear-DT FEV/2026 hipotético)

Ver `Temp/ritual-fechamento-ciclo-draft.md` §11. Resumo:
- 18 trades, +5,6%, Sharpe 1,42, expectancy +0,28R, TPS 67/100
- Kelly safe 9,6% (mas n<50 → IA stub recomenda manter 1%)
- MC p10/p50/p90: −2,1% / +5,0% / +12,4%
- Stage 3 reprovado: 7/8 gates ok, rule_adherence 88,9% < 95%

## Phases (proposta — confirmar antes do despacho de tasks)

- **A1 — Schema + CFs base** — Collection `cycleClosures` + rules; CFs `closeCycle`/`reopenCycle` com permission gate aluno OU mentor; `closeMode` enum
- **A2 — Hard seal** — Gate em `addTrade`/`updateTrade`/`deleteTrade` + cache `lastClosedCycleEnd` no plan
- **A3 — Métricas novas** — `kellyCalculator.js` (substitui stub `buildRetailConstraints`), `monteCarlo.js`, `tradingPerformanceScore.js` (TPS), R-multiple/Expectancy_R/ruleAdherenceRate em `metricsCycle.js`
- **A4 — IA stub heurístico** — `closurePlanAdvisor.js` (regras determinísticas), `swotHeuristics.js` (Opportunities/Threats), `forwardActionsHeuristics.js` (top error + valley)
- **A5 — Wizard 8 etapas (aluno)** — `<CycleClosureWizard>` componente principal + 8 sub-componentes etapa, draft autosave, sticky header
- **A6 — `<CycleExpiredGuard>`** — fila sequencial de backlog no StudentDashboard
- **A7 — Camada mentor (CHUNK-16)** — `<MentorClosuresInbox>` + `<MentorCommentPanel>` + `<ClosurePendingBadge>` + indicador "modo mentor" no wizard
- **A8 — Flow C (MentorDashboard)** — Renderizar `<CycleExpiredGuard>` dentro de `if (selectedStudent)` do MentorDashboard.jsx
- **A9 — Card "Capítulo N" no perfil** — Histórico de closures como timeline
- **A10 — Polish + smoke + Sharpe/CV copy fix** — fix labels Sharpe/CV, smoke test ponta a ponta no browser

## Sessions
_(log linear; 1 linha por task. Format: `task NN [slug] commit <sha> ok|fail`)_

- A1 [schema-cfs] commit `3d80497d` ok — collection `cycleClosures` + closeCycle/reopenCycle/setMentorClosureComment CFs + sealCheck + rules
- A2 [hard-seal] commit `0cb138fb` ok — gate em createTrade/editTradeAsMentor + sealCheck CJS mirror + 33 testes CJS + 97 tradeGateway sem regressão
- A3 [metricas] commit `c975c1bc` ok — cycleMetrics/kellyCalculator/monteCarlo/tradingPerformanceScore + 61 testes ESM
- A4 [ia-stub] commit `9e23d968` ok — closurePlanAdvisor/swotHeuristics/forwardActionsHeuristics + 45 testes ESM
- A5.1-5 [wizard-base] commit `8231dc45` ok — useCycleClosureDraft + WizardHeader/Footer + Step1Read/Step2Notice/Step3Reflect (parcial)
- A5.6 [wizard-completo] commit `dc0711e2` ok — Step3Reflect/Step4Map/Step5Check/Step6Adjust/Step7Commit/Step8Seal + ChipPicker
- A6 [guard-modal] commit `565b00cc` ok — CycleExpiredGuard + CycleClosureModal + wire StudentDashboard
- A7 [mentor-camada] commit `cbae79f7` ok — MentorClosuresInbox + MentorClosureView + ClosurePendingBadge + tab Closures + setMentorClosureComment integrado
- A8 [flow-c] commit `ee0dffb8` ok — CycleExpiredGuard + Modal no MentorDashboard `selectedStudent` (mentor fecha pelo aluno)
- A9 [timeline] commit `e8a66142` ok — useStudentClosures + ClosureChapterCard + ClosureTimeline (perfil aluno + view mentor)
- A10 [polish-smoke] em curso — A10.1 skip (CycleConsistencyCard shipped/estável), A10.2 update issue doc, A10.3 smoke + checklist

## Shared Deltas
_(diffs propostos para o integrador aplicar no MAIN após o merge)_

- `docs/PROJECT.md` — bump versão pra v1.58.0 + entrada de ritual de fechamento
- `src/version.js` — bump string `version: '1.58.0'` + remover marca [RESERVADA] da entrada CHANGELOG
- `docs/registry/versions.md` — marcar v1.58.0 consumida (PR #NNN squash `<sha>`)
- `docs/registry/chunks.md` — liberar CHUNK-03/04/16 ESCRITA + 05/06/08/09 leitura
- `CHANGELOG.md` — nova entrada `[1.58.0] - DD/MM/2026`
- `docs/firestore-schema.md` — adicionar `cycleClosures` collection (INV-15 aprovação implícita pela aprovação do issue)
- `docs/cloud-functions.md` — adicionar `closeCycle` + `reopenCycle` callables; gate em `addTrade`/`updateTrade`/`deleteTrade`
- `docs/chunks.md` — atualizar CHUNK-03/04/16 com domínios novos se aplicável
- `docs/decisions.md` — DEC-AUTO-259-NN entries

## Decisions
_(apenas IDs — texto detalhado mora em `docs/decisions.md`; rationales longos em `docs/decisions/DEC-AUTO-259-NN.md` se >200 tokens)_

- DEC-AUTO-259-01 — Symlink `~/projects/issue-259/node_modules → ~/projects/acompanhamento-2.0/node_modules` (root) pra Vitest rodar no worktree; `functions/` reusa via `../node_modules/.bin/vitest`. Evita reinstalação 800MB. Decisão técnica autônoma.
- DEC-AUTO-259-02 — Email digest pra mentor cortado (over-engineering); badge intra-app `<ClosurePendingBadge>` cobre o sinal sem canal externo.
- DEC-AUTO-259-03 — Customização de SWOT por mentor adiada pra issue #262 (fast-follow). 1A entrega heurísticas universais hardcoded.
- DEC-AUTO-259-04 — A10.1 (polish CycleConsistencyCard labels) skipped: card shipped em v1.54.0, labels já claras, mexer arrisca regressão sem ganho real. Foco no fechamento de #259.
- _(12 open questions originais já resolvidas no draft §8 — Q3 cap 5%, Q7 Quarter-Kelly default, Q8 ≥30 trades pra ciclo anterior, Q9 Claude API, Q12 weights TPS rebalanced)_

## Chunks
- **CHUNK-03 (Plans) — ESCRITA** — mutação `plan.pl/currentPl/cycleNumber/lastClosedCycleEnd`
- **CHUNK-04 (Trade Ledger) — ESCRITA** — hard seal nos CFs
- **CHUNK-16 (Mentor Cockpit) — ESCRITA** — nova tab "Closures" + componentes mentor
- **CHUNK-05 (Compliance) — leitura** — input pra `topErrors`, `ruleAdherenceRate`
- **CHUNK-06 (Emotional) — leitura** — input pra eventos comportamentais e curva emocional
- **CHUNK-08 (Mentor Feedback) — leitura** — input pra `mentor.threadsHighlighted`
- **CHUNK-09 (Onboarding/4D) — leitura** — input pra maturity scores

## Notas operacionais

- **INV-04** DebugBadge obrigatório em todos componentes novos com prop `component`. Wizard precisa `pb-16` no container externo (`feedback_debug_badge_overlay`).
- **INV-15** aprovação pra collection `cycleClosures` v2 — coberta pela aprovação do issue (versão completa, expandida vs proposta CRUD anterior; schema em §5 do draft)
- **INV-13** rastreabilidade: issue #259 + control file (este) + branch `feat/issue-259-cycle-closure` ✅
- **INV-16** worktree `~/projects/issue-259` ✅
- **Modo interativo** — pair programming assíncrono. Specs viram referência citável, não gate. Faseamento autônomo coord/worker pode ser despachado fase-a-fase, com gate humano só em decisões destrutivas.
- **Issues filhos:** #260 (1B v1.59.0 LLM real) e #261 (1C v1.60.0 stage promotion automation) ficam dependentes do merge de #259.
