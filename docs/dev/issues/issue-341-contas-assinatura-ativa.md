# Issue #341 — fix: Contas do mentor lista alunos sem assinatura ativa

## Autorização (OBRIGATÓRIA)

**Status atual do documento:**
- [x] Mockup apresentado (abaixo — modificação de UI trivial: filtro de visibilidade)
- [x] Memória de cálculo apresentada (regra de filtro, abaixo)
- [x] Marcio autorizou (19/07/2026 — "vai")
- [x] Gate Pré-Código liberado

## Context
A seção **Contas** (visão do mentor) lista todos os alunos que já tiveram conta,
inclusive inativos/ex-alunos/órfãos. Objetivo: mostrar só alunos com assinatura
ativa, com paridade de critério à tela de Acompanhamento.

## Spec
Ver issue body no GitHub: #341.

## Mockup
Tela `AccountsPage` (mentor), grid de `StudentAccountGroup`.

- **Antes:** N grupos = todo `studentId` distinto presente em `accounts` (+ grupo
  `unknown` de conta órfã sem `studentId`).
- **Depois:** só grupos cujo aluno tem `classifyStudent(student, subs) !== null`.
  VIP ativo, sem-sub, expired/cancelled e `unknown` desaparecem.
- Busca (searchTerm) opera sobre o conjunto já filtrado.
- Caminho do aluno (`!isMentor()`) inalterado — vê só as próprias contas.
- Estado vazio: se nenhum grupo sobra, o grid fica vazio (comportamento atual do
  grid, sem mensagem nova nesta issue).

## Memória de Cálculo
- **Inputs:**
  - `accounts` (via `useAccounts`, modo mentor = todas) — agrupadas por `acc.studentId`.
  - `students` (via `useStudents`) — doc do aluno por `id`.
  - `subscriptions` (via `useSubscriptions`) — subs enriquecidas com `studentId` + status canônico.
- **Regra:** `studentId` é visível ⇔ `classifyStudent(student, subsDoAluno) !== null`.
  - `classifyStudent` retorna `null` para VIP ativo e para ausência de sub Alpha/Espelho/Trial ativa.
  - Paridade exata com o Acompanhamento (mesma fonte/shape de `subs`) — ref. negativa #316
    (assinaturas divergentes de `classifyStudent` front/back).
- **Casos limites:**
  - `studentId === 'unknown'` (conta órfã) → sem doc de aluno → `null` → escondido.
  - Aluno com conta mas sem doc em `students` → `null` → escondido.
  - Sub `overdue` (grace): classifyStudent trata conforme `findActiveSub`/`ENDED_STATUSES`
    — replicar o comportamento do Acompanhamento, não reinventar.

## Phases
1. Teste do filtro (util puro `visibleStudentIds` ou seleção equivalente) — antes da UI.
2. Fix em `AccountsPage.jsx` (caminho mentor): filtrar `groupedAccounts`/`filteredGroups`.
3. Build + suíte verdes. PR com `Closes #341`.

## Shared Deltas
Nenhum além do lock/reserva já feitos no main (v1.83.1, CHUNK-16).

## Decisions
- Critério = `classifyStudent` (paridade Acompanhamento); VIP escondido — decisão de Marcio (AskUserQuestion 19/07).
- Inativos escondidos por completo (não seção separada) — decisão de Marcio (idem).

## Chunks
- CHUNK-16 (Mentor Cockpit) — ESCRITA (lock ativo).
- CHUNK-02 (`classifyStudent`, `students`) — leitura.
