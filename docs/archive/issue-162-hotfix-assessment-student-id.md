# Issue 162 — hotfix: Espelho fora do ar por implementação do issue #102
> **Branch:** `fix/issue-162-hotfix-assessment-student-id` (mergeada)
> **Worktree:** `~/projects/issue-162` (removido no encerramento)
> **Milestone:** —
> **Aberto em:** 20/04/2026
> **Encerrado em:** 20/04/2026
> **Status:** ✅ Encerrado — plataforma restaurada em produção
> **Versão entregue:** v1.38.1 (merge commit `3192353b`)
> **PR:** #163
> **Labels GitHub:** `epic:aluno-stability`, `module:dashboard-aluno`, `Sev1`, `type:bug`

---

## 1. CONTEXTO

Pós-merge do PR #160 (entrega do #102 — Revisão Semanal v2, commit `30af3a18`, v1.38.0) a
plataforma em produção renderiza tela branca no dashboard do aluno com o erro:

```
Uncaught ReferenceError: assessmentStudentId is not defined
    at AN (index-D-IbMnHz.js:64:1720)
```

Logs consecutivos de `[useTrades] Student mode`, `[usePlans] Student mode`,
`[useAccounts] Student mode` precedem o crash — confirma que os hooks de dados inicializam OK, o
erro é síncrono no render do componente `StudentDashboardBody` durante mount.

Causa raiz (linha 362 de `src/pages/StudentDashboard.jsx`):

```jsx
<PendingTakeaways
  studentId={assessmentStudentId}   // ← identificador não existe no escopo
  onNavigateToFeedback={onNavigateToFeedback}
/>
```

O componente `<PendingTakeaways>` é novo, introduzido pelo #102 (PR #160). A prop
`studentId` referencia a variável `assessmentStudentId` que **não está declarada** em
`StudentDashboardBody` (linha 88+). Resíduo de refactor/rename. No mesmo arquivo, a linha
558 (dentro de `StudentDashboard` wrapper) já define o padrão canônico para resolver o
UID do aluno neste dashboard:

```js
const scopeStudentId = overrideStudentId || user?.uid || 'anon';
```

E os 3 hooks irmãos no mesmo `StudentDashboardBody` (linhas 96-98) passam
`overrideStudentId` e aplicam o fallback `user?.uid` internamente
(`useTrades(overrideStudentId)`, `useAccounts(overrideStudentId)`,
`usePlans(overrideStudentId)`). `<PendingTakeaways>` consome `students/{studentId}/reviews`
(linha 28 do componente) — mesma semântica: UID do aluno dono das reviews = UID do aluno
dono das trades/accounts/plans.

## 2. ACCEPTANCE CRITERIA

- [x] `src/pages/StudentDashboard.jsx:362` deixa de referenciar `assessmentStudentId`
- [x] Prop recebe `overrideStudentId || user?.uid` (padrão canônico do arquivo)
- [x] Dashboard do aluno renderiza sem crash no `npm run build` + deploy Vercel em produção
- [x] Cenário mentor (`viewAs.uid`) coberto pelo mesmo padrão — UID do aluno
      visualizado, não o UID do mentor logado
- [x] Teste invariante adicionado (`studentDashboardReferences.test.js`) — trava reintrodução do identificador
- [x] 1728/1728 testes passando (+1 vs baseline 1727)
- [x] DebugBadge de `StudentDashboard` mostra v1.38.1 (build date 20260420)

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | Nenhuma (fix puramente de referência JSX) |
| Cloud Functions afetadas | Nenhuma |
| Hooks/listeners afetados | Nenhum novo — `PendingTakeaways` já listava `students/{studentId}/reviews` antes, a prop só voltará a receber um UID válido |
| Side-effects (PL, compliance, emotional) | Nenhum |
| Dados parciais/inválidos | N/A — não toca trade/plan writer |
| INV-01..INV-18 | Nenhuma tocada — fix sintético de 1 linha |
| Blast radius | Restaura dashboard aluno (todos os consumidores) em produção |
| Rollback | Trivial — revert do PR |

## 4. SOLUÇÃO

Alterar exatamente a linha 362 de `src/pages/StudentDashboard.jsx`:

```diff
-        studentId={assessmentStudentId}
+        studentId={overrideStudentId || user?.uid}
```

Ambos (`overrideStudentId` e `user`) já estão no escopo de `StudentDashboardBody` (linhas 89-90).

## 5. DELTA DE SHARED FILES

Aplicados no main ANTES da criação do worktree (commit `db665db3`, branch `main`):

- `src/version.js` — bump `1.38.0` → `1.38.1`, build `20260420`, changelog inline reservado
- `docs/PROJECT.md` — header `0.22.8` → `0.22.9`, entrada 0.22.9 na tabela de histórico,
  lock CHUNK-02 na §6.3 "Locks ativos", entrada `[1.38.1]` reservada no CHANGELOG §10

Nenhum shared file é editado dentro deste worktree — apenas o próprio arquivo de controle e
o fix em `StudentDashboard.jsx`/teste smoke.

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-02 | escrita | Alteração em `src/pages/StudentDashboard.jsx` (linha 362) |
| CHUNK-16 | leitura | Confirmar contrato de `src/components/reviews/PendingTakeaways.jsx` (prop `studentId`) — não modifica |

> Lock ativo registrado em PROJECT.md §6.3 (commit `db665db3` no main).
> CHUNK-16 não precisa de lock (modo leitura).

## 7. NOTAS DE INVESTIGAÇÃO

- PR #157 (rules `alunoDoneIds`) **não** está envolvido no crash — a falha é síncrona no
  render JSX, anterior a qualquer round-trip Firestore
- O erro **não** aparece no dev local do CC anterior porque o dashboard só é hit via URL
  roteada como aluno; o build minificado de produção (`index-D-IbMnHz.js:64:1720`) falha
  na primeira tentativa de mount
- Issue de QA #159 (tracker do #102) **não cobriu** o render do dashboard do aluno com
  `PendingTakeaways` montado — gap de validação da entrega v1.38.0

## 8. SESSÃO DE ENCERRAMENTO — 20/04/2026

**O que foi feito:**
- Diagnóstico completo em ~15min via grep (`assessmentStudentId` → único match em `StudentDashboard.jsx:362`)
- Gate Pré-Código: análise de impacto, identificação do padrão canônico (linha 558, hooks irmãos), aprovação explícita do Marcio
- Shared files commitados no main antes do worktree (commit `db665db3`): lock CHUNK-02, bump `version.js` 1.38.1, entrada PROJECT.md
- Worktree `~/projects/issue-162` criado (branch `fix/issue-162-hotfix-assessment-student-id`)
- Fix aplicado (1 linha): `studentId={assessmentStudentId}` → `studentId={overrideStudentId || user?.uid}`
- Teste invariante criado: `src/__tests__/invariants/studentDashboardReferences.test.js` (grep-based, padrão #156)
- Validação: 1728/1728 testes, build verde 15.28s
- PR #163 aberto com `Closes #162`, CI verde em 59s (PR) + 1m6s (main pós-merge)
- Validação em produção: Marcio confirmou "plataforma voltou"

**Timing da sessão:** abertura SEV1 → fix mergeado em ~45 min.

**Decisões:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| — | Não adicionar smoke test full-render de `<StudentDashboard>` | Componente com 10+ hooks + contexto + libs visuais exigiria setup pesado de mocks. Teste invariante grep-based cobre a regressão específica sem custo de infraestrutura. Alternativa escalável é tornar `npm run lint` required no CI (registrada como lição). |

**Arquivos tocados:**
- `src/pages/StudentDashboard.jsx` (1 linha)
- `src/__tests__/invariants/studentDashboardReferences.test.js` (novo, 34 linhas)
- `src/version.js` (bump 1.38.0 → 1.38.1, no main antes do worktree)
- `docs/PROJECT.md` (header, histórico, §6.3, CHANGELOG)
- `docs/dev/issues/issue-162-hotfix-assessment-student-id.md` (este arquivo)

**Testes:**
- 1728/1728 passando (1727 baseline + 1 novo invariante)

**Commits:**
```
db665db3  docs: registrar lock CHUNK-02 para issue-162 + reserva v1.38.1 (SEV1 hotfix #162)   [main]
c57095e3  fix: hotfix StudentDashboard assessmentStudentId not defined (#162)                 [branch]
3192353b  fix: hotfix StudentDashboard assessmentStudentId not defined (#162) (#163)          [merge squash na main]
```

**Pendências (backlog, não bloqueiam encerramento):**
- Tornar `npm run lint` required no CI — teria detectado este erro pré-merge (eslint `no-undef`). Registrado na seção Lições do CHANGELOG v1.38.1
- Adicionar render do dashboard do aluno com `<PendingTakeaways>` montado ao QA tracker #159 para futuras entregas envolvendo dashboard aluno
