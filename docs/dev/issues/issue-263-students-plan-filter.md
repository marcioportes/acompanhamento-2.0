# Issue #263 — feat: filtro Alpha/Espelho na tela de Alunos + click → dashboard

## Autorização

**Status:**
- [x] Mockup apresentado (ASCII no plan + HTML em `~/Temp/students-management-mockup.html`)
- [x] Memória de cálculo apresentada (MC-1..MC-4 abaixo)
- [x] Marcio autorizou (07/05/2026 — "User has approved your plan" pós ExitPlanMode + "abre issue")
- [ ] Gate Pré-Código executado (próximo passo)

## Context

Tela `src/pages/StudentsManagement.jsx` lista hoje só alunos Alpha. Marcio quer ampliar para alunos Espelho (`self_service`) e usar como porta de entrada para o dashboard via View As. Sem collection nova, sem complicar. Toda gestão de produto continua em `SubscriptionsPage`.

## Spec

Body do GitHub: https://github.com/marcioportes/acompanhamento-2.0/issues/263.
Plano completo: `~/.claude/plans/giggly-puzzling-valley.md`.

## Mockup

```
╔══════════════════════════════════════════════════════════════════════╗
║ 👥 Alunos                                          [ + Novo aluno ]  ║
║ Lista de alunos Alpha e Espelho · clique para entrar no dashboard    ║
╠══════════════════════════════════════════════════════════════════════╣
║  [Total 34] [Alpha 28] [Espelho 6] [Pendentes 4]                     ║
║  Plano   [Todos 34]  [Mentoria Alpha 28]  [Espelho 6]                ║
║  ┌─ Lista ─────────────────────────────────── 34 alunos ─────────┐  ║
║  │ J  João Silva    [Alpha]  [✓ Ativo]  [Assess ✓]            ▸  │  ║
║  │    joao.silva@email.com  ·  +55 21 99888-7766                 │  ║
║  │ M  Maria Souza   [Alpha]  [⏱ Pendente]                     ▸  │  ║
║  │ R  Rafael Mota   [Espelho] [✓ Ativo]                       ▸  │  ║
║  │ A  Ana Lima      [Alpha]  [✓ Ativo]  [Assess ✓]            ▸  │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════╝
```

Glassmorphism dark, paleta Alpha=roxo (`bg-purple-500/15`) e Espelho=ciano (`bg-cyan-500/15`) reusando de `SubscriptionsPage.jsx:673`. Estilo dos chips reusa `SubscriptionsPage.jsx:559-577`.

Toda a área central da row é clicável → `handleViewAs(student)`. Botões filhos (AssessmentToggle, reenviar invite, editar WhatsApp) param a propagação.

HTML standalone para visualização em browser: `~/Temp/students-management-mockup.html` (versão anterior — vai ser atualizada se o look mudar materialmente durante implementação).

## Memória de Cálculo

### MC-1 — Universo

**Inputs:** `students` (snapshot), `subscriptions` (saída de `useSubscriptions()`).

```
RELEVANT_PLANS = ['alpha', 'self_service']
ordered = [...subscriptions].sort((a, b) => (b.renewalDate ?? 0) - (a.renewalDate ?? 0))
planByStudentId = new Map()
for sub of ordered:
  if sub.plan in RELEVANT_PLANS && sub.status !== 'cancelled':
    if !planByStudentId.has(sub.studentId):
      planByStudentId.set(sub.studentId, sub.plan)
managedStudents = students.filter(s => planByStudentId.has(s.id))
```

Edge case — múltiplas subs ativas em planos diferentes (migração Espelho→Alpha sem cancelar): a sub mais recente pelo `renewalDate` vence (precedência por data, com `setIfAbsent`).

### MC-2 — Stats

```
total      = managedStudents.length
alpha      = managedStudents.filter(s => planByStudentId.get(s.id) === 'alpha').length
espelho    = managedStudents.filter(s => planByStudentId.get(s.id) === 'self_service').length
pendentes  = managedStudents.filter(s => s.status === 'pending').length
```

`alpha + espelho === total` (invariante: cada aluno tem exatamente uma entrada no Map).
`pendentes` é transversal aos planos.

**Exemplo numérico:**
- 34 alunos no Map. 28 alpha, 6 self_service. 4 com status=pending (3 alpha, 1 espelho).
- Header: Total=34, Alpha=28, Espelho=6, Pendentes=4.

### MC-3 — Filtro

```
visíveis = managedStudents.filter(s => {
  if (planFilter === 'all')  return true
  return planByStudentId.get(s.id) === planFilter
})
```

Combinado com a busca livre (`suggestions`/match por nome/email/tail8 — preservado).

**Exemplo:** planFilter='alpha' + busca='silva' → 1 aluno (João Silva).

### MC-4 — Click na row

```
onRowClick(student):
  onViewAsStudent({
    uid: student.uid || student.id,
    email: student.email,
    name: student.name,
  })
```

Botões filhos: `e.stopPropagation()` para não disparar View As.

## Phases

- A1 — Trocar `alphaStudentIds` (Set) por `planByStudentId` (Map) + ampliar para `['alpha', 'self_service']` com tie-break por `renewalDate desc`.
- A2 — Adicionar `planFilter` state + 3 chips estilo SubscriptionsPage.
- A3 — Badge do plano em cada row (Alpha=roxo, Espelho=ciano).
- A4 — Row clicável → View As; `stopPropagation` nos botões filhos.
- A5 — Renomear título "Gerenciar Alunos" → "Alunos"; stats `Total/Alpha/Espelho/Pendentes`; renomear sidebar.
- A6 — Limpeza: remover `useEffect` linhas 65-78 (N+1 trades), `StudentEmotionalCardInline` (linhas 406-416), botão Brain (linhas 361-369), state `studentTrades`.
- A7 — Testes (vitest): cálculo de `planByStudentId` com tie-break + filtros + counts dos chips.

## Sessions

_(linear, 1 linha por task — preencher conforme evolui)_

## Shared Deltas

Na abertura (já feito no main, commit `aad3feb3`):
- `src/version.js` — entrada 1.61.0 RESERVADA #263
- `docs/registry/versions.md` — linha 1.61.0 #263
- `docs/registry/chunks.md` — lock CHUNK-02 (Student) ESCRITA #263

No encerramento (TODO):
- `src/version.js` — bump para 1.61.0 (consumida) + remover marcador RESERVADA
- `docs/registry/versions.md` — marcar 1.61.0 consumida (PR squash)
- `docs/registry/chunks.md` — liberar CHUNK-02
- `CHANGELOG.md` — entrada `[1.61.0] - DD/MM/2026`

## Decisions

_(IDs apenas — texto em `docs/decisions.md`)_

- DEC-AUTO-263-01 — universo da página: `plan ∈ {alpha, self_service}` e `status !== 'cancelled'`. VIP e self_service no escopo separado (subs sem plano não entram).
- DEC-AUTO-263-02 — múltiplas subs ativas: precedência por `renewalDate desc` (sub mais recente vence).

## Chunks

- CHUNK-02 (Student) — ESCRITA — alteração no contrato de filtragem da tela de gestão de alunos.

## Aceite

Espelhado no body do issue. Validação manual no smoke + `npm test`.
