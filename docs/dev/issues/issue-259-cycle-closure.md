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
- A10 [polish-smoke] commits `9e9b1daa` + `518ab28a` ok — 2 bugs do guard descobertos em validação browser via Tailscale: (1) hook forçava override `useTrades(studentId)` divergente do `useTrades(null)` que dashboards usam; corrigido aceitando `{plans, trades}` injetados; (2) `startDate` ignorava trades antigos com import retroativo, fix usa `min(planCreatedAt, firstTradeDate)`. Plus: ciclo vazio com >7d entra na fila pra forçar reflexão.
- A11 [massa-teste] sem commit — gerador Python `Temp/gen-massa-teste-259.py` produz 6 CSVs (PERF + ORDER × MAR/ABR/MAI 2026) em `/mnt/c/000-Marcio/Temp/massa-teste-259/`. Cenários: MAR trágico (TILT+REVENGE+OVERTRADING+HESITATION), ABR equilibrado (BREAKEVEN+STOP_TAMPERING+RAPID_REENTRY), MAI atual sem fechar. Encoding ISO-8859-1 CRLF; tickers WINH/J/K26.

### R2 — Rebuild crítico (15/05/2026)

Smoke test de Marcio com massa de março revelou que o wizard inteiro estava cego: TILT/REVENGE/STOP_TAMPERING = 0 em todos, "Zero detecção" sugerido como ponto positivo, advisor recomendando "reduzir 25%" pra alguém que violou stop 3×. Mapa do ciclo praticamente vazio. Reconsiderar todo o processo. Plan: `/home/mportes/.claude/plans/flickering-hugging-shell.md`.

- R2.B1 [pipeline-detecção] — `computeStopBreach` em cycleMetrics; `Step1Read` renderiza badge de breach (trade #N, +K trades depois, severidade); `analyzeEmotionsV2` propaga `executionEvents` a `detectTiltV2/RevengeV2` (parâmetro existia, nunca era passado); `Step2Notice` invoca `detectExecutionEvents({trades, orders})` e expõe `patterns` rico com counts por tipo + `dayBreakdown` (clean × dirty) + `executionEvents[]` + `stopBreach`. Hook `useOrders` adicionado ao Step2.
- R2.B2 [swot-cientes] — `swotHeuristics.buildStrengths/Weaknesses/Opportunities/Threats` reescritos para receber `metrics + patterns + snapshot`. Strengths exigem sinal positivo MEDIDO (aderência alta SEM red flag comportamental, profit factor sólido, melhor dia limpo). Threats listam violação de stop com trades pós-breach, tilt sistêmico (≥3 dias), revenge (≥2), stop tampering (≥1), perda ≥ 1.5× cap. Step4Map remove regra "Zero padrões → STRENGTH".
- R2.B3 [reflexão-real] — `Step3Reflect.buildSuggestions` elimina "Zero detecção" como sustain (anti-pattern). Q2 actualText gera narrativa rica: resultado, breach, contagens comportamentais. Sustain só vem de positivo medido. Improve prioriza pausa/auto-bloqueio quando há violação.
- R2.B4 [advisor-pausa] — `closurePlanAdvisor` ganha REGRA 0 `pause_restructure` que dispara ANTES de qualquer regra quando: `tradesAfterStop ≥ 3` OU `tiltDaysCount ≥ 5` OU `revenge ≥ 3` OU `stopTampering ≥ 2` OU `pnlPctOfStop ≥ 1.5`. Retorna `newRiskPerOp: 0`, `notifyMentor: true`, rationale com triggers reais. Capital base recalculado sobre `snapshotPlEnd`, não `plan.pl` (Mark Douglas: opera sobre saldo real). REGRA 3 absorve sinais menores (tilt ≥2 OU stop tampering ≥1 OU revenge ≥1). Step6Adjust renderiza banner crítico vermelho + capital base com comparação pré-ciclo + R em R$ recalculado por trade.
- R2.B5 [forward-actions] — `forwardActionsHeuristics` ganha chaves `STOP_VIOLATION`/`STOP_TAMPERING_SYS`/`TILT_SYSTEMIC` em VALLEY_TO_COMMITMENT, com prioridade SOBRE error-derived commitments (sinal comportamental é mais crítico que violação de regra isolada). Step7Commit recebe `snapshot` do wizard pra acessar stopBreach.
- R2.B6 [schema-behavioral] — `closeCycle` CF deriva e persiste `closure.behavioralSummary` (counts + breach + severity + critical + notifyMentor). `useMentorClosureInbox` lê esse campo, força tone='red' em items críticos e os move pro topo da fila (sort prioritário). `MentorClosuresInbox` realça row crítica com borda vermelha + signal "🚨 CRÍTICO — pausa sugerida".
- R2.B7 [testes] — +23 testes novos: `closurePlanAdvisor.test` cobre REGRA 0 PAUSA (5 triggers + cenário CRÍTICO de março + ciclo equilibrado de controle), capital base = plEnd, REGRA 3 expandida. `cycleMetrics.test` cobre `computeStopBreach` (clean / disciplined / worsened / critical). `swotHeuristics.test` garante que zero counts NÃO geram "zero detecção" sustain. 87 testes na suite cycleClosure (era 64). Suite global continua verde.
- R2.B9 [tps-desdobramento] — `Step1Read` ganha bloco "Composição" abaixo do gauge da Nota geral. 5 mini-cards (Lucro÷Prejuízo, Queda do capital, Ganho médio, Consistência semanal, Disciplina) mostram valor bruto + pontos contribuídos `X/Y pts` + mini-barra + tom dinâmico (red <33%, amber <66%, emerald ≥66%) + dica de melhoria quando preenchimento <50%. Colapsado por default (`<details>`), abre só se o aluno clicar. Reusa `tps.breakdown` e `TPS_WEIGHTS`.
- R2.B10 [step3-reflexao-frustracao] — Q3 do Step3Reflect realinhada ao trader_evolution_framework (Kahneman + Mark Douglas + Stage 1-2 sob frustração). Mudanças: (1) `isCritical` derivado de `snapshot.stopBreach.severity`, `forward.aiSuggestion.triggeredRule === 'pause_restructure'`, ou perda ≥ 1.5× cap. (2) Banner âmbar empático no topo da Q3 quando crítico — "esse ciclo foi duro, marcar nenhuma é resposta válida". (3) Pergunta muda de "Por que a diferença?" para "O que encaixa com o que você viu?" — convite, não cobrança. (4) Cada uma das 4 atribuições ganha linha de EVIDÊNCIA derivada de metrics/patterns/snapshot via `buildAttributionEvidence`; tone='strong' marca opção com ◉ quando crítico, tone='weak' esmaece. (5) Textarea vira "nota pro mentor (opcional)" sem mínimo. (6) Novo `behavioralSummary.denialFlag` derivado no servidor (closeCycle CF): true quando ciclo crítico + erros internos detectados + aluno marca só luck/market sem error. (7) MentorClosuresInbox sufixa signal crítico com "· ⚠ atribuição externa apesar de erros detectados". DEC-AUTO-259-09.
- R2.B11 [step5-refactor] — Step 5 (Avaliar) reescrito do zero com foco pedagógico. Mudanças: (1) Bug fix em `functions/maturity/preComputeShapes.js:104` — `maxDDPercent` retorna `null` em vez de `0` quando `initialBalance` é falsy (antes virava ✓ verde por bug `0 ≤ 5`). (2) `GATES_BY_TRANSITION` ganha campos pedagógicos por gate: `friendlyLabel` (sem siglas), `unit`, `whatIs` (o que é, 1 linha PT-BR), `howTo` (ação concreta pra atingir). Catálogo cobre os 36 gates do framework (4 transições). (3) `evaluateGates.js` propaga os 4 campos novos no shape de cada gate retornado. (4) `Step5Check.jsx` reescrito: cards expansíveis com 3 estados visuais (✓ atendido, ✗ falta, ⊘ aguardando dados — antes coalescia em 2), agrupamento por dimensão (💗 Emocional / 📈 Financeiro / ⚙️ Operacional), valor atual vs alvo sempre visível, símbolo de operador correto (`≥`/`≤`/`<`/`>`/`=`), resumo no topo "X atendidos · Y faltam · Z aguardando", bloco "🎯 Foco pro próximo ciclo" com top 3 gates mais perto de passar. (5) Substituição MFE/MAE → MEP/MEN em `stageMapper.js:101` e `assessmentQuestions.js:538` (alinhar com nomenclatura PT-BR adotada em #187). DEC-AUTO-259-10.

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
- DEC-AUTO-259-05 — `useCycleExpiredQueue` aceita `{plans, trades}` injetados; dashboards passam os arrays já carregados (mesma fonte que renderiza ledger). Hook continua chamando `usePlans/useTrades` por simetria de hooks rules, mas resultado é descartado quando inject vier. Resolve divergência studentEmail vs studentId.
- DEC-AUTO-259-06 — `startDate` da fila = `min(planCreatedAt, firstTradeDate)`. Cobre import CSV histórico depois de criar plano. Trade datado antes do `createdAt` é ground truth.
- DEC-AUTO-259-07 — Ciclo vazio entra na fila apenas se atraso ≥7d. Sub-7d skip preserva UX limpa em ciclos no início; ≥7d força reflexão (TILT/pausa/abandono são sinais valiosos, não buracos).
- DEC-AUTO-259-08 — Fast-follow mobile-responsive ritual proposto como issue separada (#264 sugerido, não criada ainda). Wizard atual desktop-first; mentor camera (inbox grid-12 + sticky comment panel) inviável em mobile vertical.
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
