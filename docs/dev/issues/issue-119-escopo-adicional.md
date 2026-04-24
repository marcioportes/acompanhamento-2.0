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

**Ordem de dispatch:** 20 → 21 → 22 (backend) → [gate humano] → 23, 24 (paralelizáveis) → 25 → 26, 27 (paralelizáveis).

## Sessions
_(preenchido por task — 1 linha cada)_

## Shared Deltas
_(nenhum shared file esperado além do próprio issue doc. v1.43.0 reservada continua suficiente — sem bump novo.)_

## Decisions
_(IDs DEC-AUTO-119-NN conforme surgem a partir de 11+)_

- **DEC-AUTO-119-11** — Autorização mentor via `isMentorEmail(token.email)` (whitelist). Padrão canônico do repo (`functions/index.js`, `functions/reviews/validators.js`); `students/{id}.mentorId` não é usado hoje, então não há base confiável para a checagem alternativa proposta no brief. Alunos continuam limitados a si mesmos (`auth.uid === studentId`).
- **DEC-AUTO-119-12** — Rate limit persistido em `students/{studentId}/maturity/_rateLimit.calls[<callerUid>]` (campo map, chave = uid). Permite mentor e aluno terem stamps independentes sem shadowing; `lastRecomputeAt` também é gravado como conveniência para observabilidade. Campo `calls` é um map inline no mesmo doc, não subcollection (segue INV-12 em espírito — zero estrutura nova).

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
