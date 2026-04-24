# Issue #119 — Escopo Adicional (tasks 20-27)

> Complementa `issue-119-maturidade-engine.md` (escopo A-G já entregue nas 19 primeiras tasks).
> Origem: sessão interativa 24/04/2026 — gaps de gatilho de maturidade + tela de Revisões do aluno identificados após o close das fases A-F.
> Template R4 enxuto (≤400 linhas).

## Context
As 19 tasks das fases A-F + G1 entregaram a **engine e UIs de maturidade**, mas a engine só é chamada em `onTradeCreated/Updated`. Alunos legados, dashboards abertos e fechamentos de revisão **não recalculam**. Além disso, o aluno não tem acesso às próprias revisões semanais (elas ficam gated por `isMentor()`).

**Objetivo:** single-point de recálculo + tela Revisões do aluno. Engine `recomputeForStudent(studentId)` já existe em `functions/maturity/recomputeMaturity.js:222` — falta wiring.

## Spec
Ver conversa de design 24/04/2026 (aprovada por Marcio em sessão interativa):
- Gatilho sob demanda (callable) — só engine, rate limit 1×/hora
- Gatilho no close da revisão semanal — engine + IA
- Gatilho pós-onboarding (close do assessment 4D) — engine + IA
- Tela `StudentReviewsPage` (lista só revisões fechadas, leitura, sem edição)
- Sidebar aluno: item "Revisões" abaixo de "Feedback"
- Dashboard aluno: card "Takeaways abertos da última revisão"
- Botão "atualizar agora" no card de maturidade (aluno) e Torre de Controle (mentor)

**Regras de cadência:**
- Gatilho sob demanda: **só engine** (determinístico) — 1×/hora
- IA automática por evento (UP/REGRESSION): **continua como está** (policy atual em `src/utils/maturityAITrigger.js`)
- IA no close da revisão: 1 chamada/aluno/semana (~US$ 3-5/mês para 50 alunos)

## Phases
- **H1 (task 20)** Callable `recomputeStudentMaturity` + rate limit 1/h + testes
- **H2 (task 21)** Trigger engine+IA no close da revisão semanal + validar freeze de gates
- **H3 (task 22)** Trigger engine+IA pós-onboarding (close do assessment 4D)
- **I1 (task 23)** Botão "atualizar agora" no `MaturityProgressionCard` (aluno) → callable H1
- **I2 (task 24)** Botão "atualizar agora" na Torre de Controle (mentor) → callable H1
- **J1 (task 25)** `StudentReviewsPage` — lista só revisões fechadas + visão leitura (takeaways abertos+fechados, comparativo maturidade, notas mentor)
- **J2 (task 26)** Sidebar aluno: item "Revisões" abaixo de "Feedback"
- **J3 (task 27)** Dashboard aluno: card "Takeaways abertos da última revisão"
- **J4 (task 28)** Revisão completa — `StudentReviewsPage` expandida (KPIs congelados com delta vs anterior + tabela trades com link feedback). Extração de `ReviewKpiGrid` / `ReviewTradesSection` / `reviewFormatters.js` reusáveis no mentor também. Origem: task 25 entregue com spec pobre (3 blocos em vez de espelho READ-ONLY do mentor). Mockup aprovado por Marcio com "go" em 24/04/2026. Formalizada nova seção "Autorização + Mockup" no `docs/templates/issue-control.md`.

**Ordem de dispatch:** 20 → 21 → 22 (backend) → [gate humano] → 23, 24 (paralelizáveis) → 25 → 26, 27 (paralelizáveis) → 28 (fix de spec da 25, aprovado via mockup).

## Sessions
_(preenchido por task — 1 linha cada)_
- 24/04/2026 — Task 21 (H2) commit 84dbfd50 ok
- 24/04/2026 — Task 22 (H3) trigger engine+IA pós-onboarding ok
- 24/04/2026 — Task 23 (I1) botão atualizar agora aluno commit 696e40d0 ok (validator false-positive em result.log PT — precedente task 10; CLAIMS bem-formada, files/commit conferem)
- 24/04/2026 — Task 24 (I2) botão atualizar agora mentor commit e28be575 ok (validator exit 0, 2320 passed)
- 24/04/2026 — Task 25 (J1) StudentReviewsPage leitura commit 93d72045 ok (validator exit 0, 2330 passed, +10 testes)
- 24/04/2026 — Task 26 (J2) sidebar aluno Revisões + rota 2a330f69 ok (validator exit 0, 2334 passed)
- 24/04/2026 — Task 27 (J3) card takeaways última revisão fc693c82 ok (validator exit 0, 2343 passed, +9 testes, Approach A refator in-place). Plano tasks 20-27 completo.
- 24/04/2026 — Task 28 (J4) revisão completa — mockup aprovado por Marcio ("go"). Extração ReviewKpiGrid + ReviewTradesSection + reviewFormatters. StudentReviewsPage expandida com 5 seções (espelho READ-ONLY do mentor). WeeklyReviewPage reusa os componentes extraídos. 45 testes novos nos componentes/utils.

## Shared Deltas
_(nenhum shared file esperado além do próprio issue doc. v1.43.0 reservada continua suficiente — sem bump novo.)_

## Decisions
_(IDs DEC-AUTO-119-NN conforme surgem a partir de 11+)_

- **DEC-AUTO-119-11** — Autorização mentor via `isMentorEmail(token.email)` (whitelist). Padrão canônico do repo (`functions/index.js`, `functions/reviews/validators.js`); `students/{id}.mentorId` não é usado hoje, então não há base confiável para a checagem alternativa proposta no brief. Alunos continuam limitados a si mesmos (`auth.uid === studentId`).
- **DEC-AUTO-119-12** — Rate limit persistido em `students/{studentId}/maturity/_rateLimit.calls[<callerUid>]` (campo map, chave = uid). Permite mentor e aluno terem stamps independentes sem shadowing; `lastRecomputeAt` também é gravado como conveniência para observabilidade. Campo `calls` é um map inline no mesmo doc, não subcollection (segue INV-12 em espírito — zero estrutura nova).
- **DEC-AUTO-119-13** — Ordem no close da revisão (task 21 H2): `recomputeStudentMaturity` ANTES do `rebuildSnapshot`. Garante que `frozenSnapshot.maturitySnapshot` reflita o motor fresco do momento do publish. Rate-limit throttled (1×/h por caller) é tolerante — se já recomputou há menos de 1h, o doc atual já é representativo e a sequência prossegue lendo direto `maturity/current`.
- **DEC-AUTO-119-14** — `classifyMaturityProgression` no close é **fire-and-forget** (não aguarda). A CF persiste `aiNarrative/aiTrigger/aiGeneratedAt` em `maturity/current` via cache (§3.1 D12); o próximo render do dashboard/ReviewPage detecta via listener. Aguardar síncrono bloquearia o publish por segundos (Claude Sonnet) sem ganho — a narrativa entra no `maturitySnapshot` congelado da próxima revisão quando já estiver cacheada, e o `alunoNarrativePanel`/`MaturityNarrativeCard` atual lê o doc vivo, não o snapshot. `tradesSummary` enviado à CF é derivado do `kpis` já computado pelo `buildClientSnapshot` (winRate/payoff/evPerTrade/emotional/compliance) — não duplica engine.

- **DEC-AUTO-119-16** — Novo trigger `ONBOARDING_INITIAL` em `classifyMaturityProgression` para welcome narrative pós-assessment 4D (task 22 H3). Adição MÍNIMA: 1 linha no validator (`['UP', 'REGRESSION', 'ONBOARDING_INITIAL']`), 1 branch `else` no `triggerDescription` do prompt + 1 hint nos campos `narrative/nextStageGuidance`. Cache policy **inalterada**: `currentTrigger(maturity)` em `src/utils/maturityAITrigger.js` continua retornando apenas `'UP' | 'REGRESSION' | null`. O aiTrigger persistido pode valer `ONBOARDING_INITIAL`, e após o primeiro trade real a comparação `cachedTrigger !== currentTrigger` (cached='ONBOARDING_INITIAL' vs UP/REGRESSION) dispara a próxima narrativa como esperado.

- **DEC-AUTO-119-17** — Pipeline pós-onboarding **bypassa `shouldGenerateAI`** (único caller que o faz). Motivo: no marco zero o aluno ainda não tem trades, logo `proposedTransition.proposed === null` e `signalRegression.detected === false` → `currentTrigger()` retorna `null` → `shouldGenerateAI()` retorna `false`. O pipeline força o dispatch porque o trigger é externo ao estado da maturidade (é um evento de ciclo de vida do aluno, não da engine). Isolamento: helper `dispatchOnboardingMaturityAI` é separado de `maybeDispatchMaturityAI` (close de revisão) exatamente para manter essa semântica explícita — o close respeita a cache policy, o onboarding a ignora por design.

- **DEC-AUTO-119-18** — Wiring em `StudentOnboardingPage.handleMentorSave`, ANTES do `setSaving(false)` e DEPOIS do `saveInitialAssessment`. A transição `onboardingStatus: 'active'` é parte do `saveInitialAssessment` (useAssessment.js linha 290) e NÃO pode depender do pipeline de maturidade — se a engine/IA falhar, o aluno ainda fica ativo. O `await runOnboardingMaturityPipeline({ studentId })` é envelopado em try/catch warning; o pipeline em si nunca relança, mas o try/catch é defensivo.

## Chunks
- CHUNK-09 (escrita) — já locked desde abertura #119
- CHUNK-04, CHUNK-05, CHUNK-06, CHUNK-08 (leitura) — já declarados
- CHUNK-02 (leitura+escrita limitada) — wire na sidebar/dashboard do aluno (novo arquivo `StudentReviewsPage.jsx`, edições pontuais em `Sidebar.jsx` e `StudentDashboard.jsx`)

## Pointers de implementação

- Engine central: `functions/maturity/recomputeMaturity.js` — `recomputeForStudent(studentId)` já reusável
- IA: `functions/assessment/classifyMaturityProgression.js` — callable Sonnet 4.6, cache policy em `src/utils/maturityAITrigger.js`
- Hook leitura: `src/hooks/useMaturity.js`
- Card maturidade: `src/components/MaturityProgressionCard.jsx`
- Torre mentor: componente de semáforo `src/components/MaturitySemaphoreBadge.jsx` + overview `MentorMaturityAlert.jsx`
- Revisões (mentor): `src/pages/WeeklyReviewPage.jsx` (gated por `isMentor()` — para aluno, nova página `StudentReviewsPage.jsx`)
- Takeaways: padrão já existente em `src/components/reviews/PendingTakeaways.jsx` (já consumido pelo StudentDashboard — reutilizar lógica)
- Sidebar aluno: procurar `Sidebar` + role aluno; item "Feedback" já existe (CHUNK-08)

## Gate humano recomendado
Após task 22 (backend completo), Marcio valida uma rodada manual (disparar callable, fechar revisão, testar snapshot) antes das tasks de frontend (23-27).
