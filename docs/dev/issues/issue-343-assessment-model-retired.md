# Issue #343 — fix: assessment travado — modelo Claude aposentado derruba 5 CFs (404)

> **Branch:** `fix/issue-343-assessment-model-retired`
> **Worktree:** `~/projects/issue-343`
> **Versão reservada:** v1.83.2 (patch sobre a consumida 1.83.1 — v1.84.0 reservada por #101, pendente)
> **Chunks:** CHUNK-09 (escrita), CHUNK-17 (escrita)
> **PROJECT.md base:** v0.40.11

## Autorização

- [x] Mockup — **exceção autorizada**: fast-track ("sim, abre o issue fast-track", 06/08/2026). Sem tela nova; B altera só estados de erro de UI já existentes.
- [x] Memória de cálculo — **não aplicável**: nenhuma fórmula, score ou agregação. Troca de identificador de modelo + tratamento de exceção.
- [x] Marcio autorizou — 06/08/2026: "sim, abre o issue fast-track"
- [x] Gate Pré-Código liberado

## Context

`claude-sonnet-4-20250514` foi aposentado pela Anthropic; a API responde 404 `not_found_error`. Cinco call sites ainda usam esse ID. O mais visível: `classifyOpenResponse` roda antes de gravar `completedAt` no questionário, então o aluno que responde as 34 perguntas clica em Finalizar e nada acontece — o `catch` só faz `console.error`, sem superfície de erro. Sandra Maria está presa nesse estado com 34/34 respostas.

Objetivo: restaurar o pipeline de assessment ponta a ponta e garantir que a próxima falha de CF seja visível em vez de silenciosa.

## Spec

Ver issue body no GitHub: #343.

## Phases

- A1 — migrar as 4 CFs de assessment para `claude-sonnet-4-6` (`classifyOpenResponse`, `analyzeProbingResponse`, `generateProbingQuestions`, `generateAssessmentReport`)
- A2 — migrar `functions/propFirm/prompt.js` (2 call sites) para `claude-sonnet-4-6`
- A3 — sincronizar as 3 strings `aiModelVersion` no front (`useAssessment.js:193`, `useProbing.js:68`, `StudentOnboardingPage.jsx:227`)
- B1 — superfície de erro em `handleQuestionnaireComplete` e `handleProbingComplete`: estado de erro visível, botão desabilitado durante execução, guard de duplo clique (paridade com o fix do #166 em `ProbingQuestionsFlow`)
- C1 — `startQuestionnaire`: trocar `setDoc` por escrita que não destrói `responses` existentes (DEC-026 promete preservação no reset)
- V1 — suíte completa + build; validação manual do fluxo com a Sandra após deploy

## Sessions

- `A1+A2 [migrar-modelo] commit 9ed030ab ok` — 4 CFs assessment + propFirm (2 sites) → `claude-sonnet-4-6`; `RESPONSE_SCHEMA` passa a referenciar `MODEL`/`PROMPT_VERSION`
- `B1 [superficie-erro] commit 114b80a3 ok` — submitting/submitError no QuestionnaireFlow, guard de duplo clique, `handleProbingComplete` re-lança, `await onComplete()` no ProbingQuestionsFlow, `aiModelVersion` vindo da CF
- `C1 [preservar-respostas] commit 129e639f ok` — `startQuestionnaire` não sobrescreve `responses`; fallback hardcoded de `aiModelVersion` removido
- `V1 [validacao] ok` — suíte 3568/3568 (230 arquivos; baseline 3561 + 7 novos), build verde; red-green confirmado revertendo C1

## Verificação pendente (pós-deploy)

O modelo alvo só pode ser exercitado de verdade contra a API depois do
`firebase deploy --only functions`. Validar com a Sandra: Finalizar → aprofundamento
→ relatório IA. Enquanto não deployar, as CFs em produção seguem no modelo morto.

## Shared Deltas

_(aplicar no MAIN após o merge)_
- `src/version.js` — bump v1.83.2 + entrada CHANGELOG (resolver contra o estado do main: constante está em 1.84.0 pela reserva do #101)
- `docs/registry/versions.md` — marcar v1.83.2 consumida
- `docs/registry/chunks.md` — liberar CHUNK-09 e CHUNK-17
- `CHANGELOG.md` — nova entrada `[1.83.2] - 06/08/2026`
- `docs/PROJECT.md` — bump + encerramento
- `docs/cloud-functions.md` — atualizar modelo documentado das 5 CFs, se citado

## Decisions

- DEC-AUTO-343-01 — alvo `claude-sonnet-4-6` em vez de Sonnet 5 / Opus 5: paridade com `classifyMaturityProgression` e `reviews/prompt.js` já em produção, mesma família do modelo original, rubricas de score não precisam de recalibração. Upgrade de geração fica como decisão separada com teste de qualidade.

## Chunks

- CHUNK-09 (escrita) — CFs de assessment, `useAssessment`, `useProbing`, `StudentOnboardingPage`
- CHUNK-17 (escrita) — `functions/propFirm/prompt.js`

## Notas operacionais

- Toca `functions/` → `firebase deploy --only functions` obrigatório após o merge.
- `functions/node_modules` symlinkado no worktree (runner de functions é separado do vitest root).
- Antonio Pina resetado em 06/08 (DEC-026, `onboardingStatus: lead`, `requiresAssessment: false`); questionário preservado. Não reativar antes de C1 — o `setDoc` apagaria as 34 respostas.
