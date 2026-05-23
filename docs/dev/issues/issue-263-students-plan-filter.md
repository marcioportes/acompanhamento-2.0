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

### Retomada (B)

- B1 — Renomear "Alunos" → "Acompanhamento": item da sidebar (`Sidebar.jsx`) + título e subtítulo da página (`StudentsManagement.jsx`).
- B2 — Remover botão "+ Novo aluno", componente `AddStudentModal.jsx`, import, handlers `createStudentFromModal` e `onUseExisting`, e qualquer estado relacionado (`showAddModal`, etc).
- B3 — Copy do badge pendente: "pendente" → "aguardando 1º login" (linha ~304).
- B4 — Chip "Pendentes (N)" no header de filtros, transversal aos buckets. Estado `pendingFilter` boolean; quando ativo, intersecta com `tierFilter`. Counter = `students.filter(s => s.status === 'pending').length`.
- B5 — `AssessmentToggle` ganha guard universal: toda mudança de estado (ativar / desativar / resetar) entra em modo "confirmar inline" (reusa estilo `confirmingReset` já existente). Refatorar `handleToggle` pra sempre setar `setConfirmingReset(true)` e generalizar copy do prompt.
- B6 — Testes: chip "Pendentes" filtra correto; counter; AssessmentToggle exige confirmação em todos os 3 fluxos. Smoke manual em `npm run dev`.

## Sessions

- task A1-A7 [filtro+row+limpeza+testes] commit c50fabc7 ok — 2998/2998 testes, build verde
- task modal [form inline → AddStudentModal] commit 33d7dab5 ok — alinhar mockup #263
- task accessTier [hipótese 3: Alpha/Espelho via accessTier] commit 465d16bd ok — 3014/3014
- task tabela [visual mockup #237: tabela + 5 buckets] commit 5545114f ok — 3014/3014
- task 3-buckets [reduz pra alpha/espelho/trial; remove Lead/Ex/VIP] commit ca1018c3 ok — 3014/3014
- task sem-plano [bucket condicional p/ órfãos de sub] commit a8eadbb2 ok — 23/23 nos arquivos
- pausa 08/05/2026 — Marcio identificou ambiguidade SSoT (esta tela vs SubscriptionsPage). Código no worktree em standby; sem PR enquanto direção arquitetural não fechar. Memo: `project_issue_263_paused`.
- retomada 08/05/2026 — direção arquitetural fechada (ver §Retomada abaixo). Escopo cirúrgico: rename "Acompanhamento", remover botão "+ Novo aluno", melhorar copy pendente, chip filtro Pendentes, guard universal AssessmentToggle. Schema/callable/classifier intactos.

## Retomada (08/05/2026)

### Direção arquitetural

**Domínio (3 segmentos de aluno):**
1. **WhatsApp-only** — paga sub, nunca toca plataforma. Vive em `/students` via `createInlineStudent` (uid `student_*`, status `active` artificial, `firstLoginAt=null` permanente). Visível em Assinaturas, **invisível em Acompanhamento**.
2. **Plataforma pendente** — convidado pelo callable `createStudent` (uid = Auth UID, `status='pending'`, email enviado). Aguardando 1º login.
3. **Plataforma ativo** — `firstLoginAt != null`. Logou pelo menos uma vez.

**SSoT longo prazo:** cadastro de pessoa nasce em **Assinaturas** (todo aluno, inclusive WhatsApp-only). Acompanhamento é o workspace operacional do mentor sobre Alpha + Espelho — apenas (2) e (3). Self-service Espelho ainda não existe no produto.

**Nome:** "Alunos" → **Acompanhamento** na sidebar e no título da página (DEC-AUTO-263-03).

### Escopo desta issue (cirúrgico)

Sem flag novo no schema, sem migração, sem mexer em callable/classifier/createInlineStudent/bucket "Sem plano". Apenas UI:

| Item | Ação |
|---|---|
| Sidebar/título "Alunos" → "Acompanhamento" | renomear (`Sidebar.jsx` + título da página) |
| Botão "+ Novo aluno" + `AddStudentModal.jsx` | remover (deletar componente + import) |
| Handlers órfãos da página (`createStudentFromModal`, `onUseExisting`) | remover |
| Edição inline de WhatsApp | manter |
| Badge "pendente" (linha 304-306) | melhorar copy → "aguardando 1º login" |
| Chip "Pendentes (N)" no header com filtro | adicionar (transversal aos buckets) |
| `AssessmentToggle` — guard universal | estender padrão de confirmação inline (já existe pra reset DEC-026) para ativar/desativar — DEC-AUTO-263-05 |
| `classifyStudent`, callable `createStudent`, `createInlineStudent`, schema, bucket "Sem plano" | intactos |

### Por que cirúrgico

Tudo o que afeta `/students` schema (`platformAccess` flag, criar sub no callable, mudar `createInlineStudent`) ficou fora — Marcio explicitamente decidiu manter modelo atual. Migração SSoT pra Assinaturas vira issue futura: callable `createStudent` permanece vivo pra ser invocado por Assinaturas quando aluno-de-plataforma for criado lá.

### Pendências de outra issue (não tocar aqui)

- Mover entrada de aluno-de-plataforma pra Assinaturas (Assinaturas chama callable `createStudent` quando sub Alpha/Espelho é criada).
- Aluno WhatsApp-only segue criado pelo `createInlineStudent` (sem Auth) — ok.
- Bucket "Sem plano" hoje é inalcançável pelo fluxo "+ Novo aluno" depois desta issue (botão sai); permanece como rabicho diagnóstico pra alunos legados.

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
- DEC-AUTO-263-03 — sidebar/página renomeadas "Alunos" → "Acompanhamento". Reflete o papel real (workspace operacional do mentor sobre Alpha+Espelho), separa do conceito de cadastro (que é Assinaturas). "Alunos Alpha" rejeitado porque Espelho mora junto.
- DEC-AUTO-263-04 — escopo cirúrgico: zero mudança em schema/callable/classifier. SSoT em Assinaturas é direção arquitetural acordada mas implementação fica em issue futura. Nesta issue só UI.
- DEC-AUTO-263-05 — `AssessmentToggle` ganha confirmação inline em **toda** mudança de estado (ativar / desativar / resetar), não só reset. Generaliza o padrão de DEC-026 pra evitar acionamento acidental na lista densa. Toggle ganha label "Assessment" (uppercase, slate-500) pra clareza visual.
- DEC-AUTO-263-06 — `classifyStudent` retorna `null` quando `student.email` é vazio/null. Acompanhamento só lida com gente que pode logar na plataforma; aluno criado pelo `createInlineStudent` da `SubscriptionsPage` (email opcional) é fantasma — segue em Assinaturas, invisível aqui. Descoberto durante teste manual da B1/B2 (Marcio relatou "2 fantasmas").
- DEC-AUTO-263-07 — campo `accessStatus: 'none' \| 'pending' \| 'active'` em `/students`, ortogonal ao bucket. `'none'` = não passou pelo ritual; `'pending'` = ritual feito (callable createStudent), aguardando 1º login; `'active'` = fez 1º login. Helper `getAccessStatus()` faz fallback derivado dos campos legados (firstLoginAt/status) pra cobrir docs ainda não tocados pelo backfill. Callable `backfillAccessStatus(dryRun?)` roda 1x. Atualiza callable createStudent (seta 'pending'), AuthContext.activateStudent (seta 'active'), createInlineStudent (seta 'none').
- DEC-AUTO-263-08 — Hard delete via callable `deleteStudent` cascateado: payments → subscriptions → student → Auth user. Trades / reviews / accounts / outras dependências por studentId NÃO são tocadas (fast-follow se cleanup completo for necessário). Linha de Acompanhamento deixa de ser clickable; View As vira ícone Eye próprio ao lado do lápis (que abre master/detail).
- DEC-AUTO-263-09 — Bucket "Sem plano" REMOVIDO. `classifyStudent` retorna `null` quando aluno não tem sub ativa. **REVERTIDA EM PARTE pela DEC-AUTO-263-10** após Marcio apontar que aluno em ritual (passou pelo callable, sem sub criada ainda) era justamente quem precisava ser monitorado e estava sumindo da tela.
- DEC-AUTO-263-10 — Bucket `aguardando-plano` (label "Aguardando plano", cor amarela). Aluno **sem sub ativa** aparece em Acompanhamento se passou pelo ritual (`accessStatus ∈ pending|active`, ou fallback `firstLoginAt!=null`/`status='pending'`). Caso contrário continua invisível (DEC-AUTO-263-06). Resolve o caso real: aluno foi convidado pelo callable, está aguardando 1º login, mas a sub Alpha/Espelho ainda não foi criada em Assinaturas. Mentor monitora 1º login aqui e cria sub depois pra promover ao bucket Alpha/Espelho.
- DEC-AUTO-263-11 — Callable `createStudent` em modo upsert. Quando recebe `studentId` no payload, entra em modo PROMOTE: cria Auth user com novo UID, copia recursivamente o doc `/students/{studentId}` + subscriptions + payments aninhados pra `/students/{authUid}`, apaga o original. Restaura invariante "doc.id == authUid".
- DEC-AUTO-263-12 — Callable `setStudentLoginBlocked({uid, blocked})` aplica `admin.auth().updateUser({disabled})` + grava `loginBlocked` + auditoria (`loginBlockedAt`, `loginBlockedBy`) no doc. Bloqueio de login é aplicado pelo mentor em caso de inadimplência. Drawer ganha toggle "Bloquear/Desbloquear login" com confirmação inline; substitui o botão "Iniciar ritual" que existia ali.
- DEC-AUTO-263-13 — Disparo do ritual sai do drawer e vai pro botão "Candidatos ao ritual" no header da tela. Lista filtra alunos com `accessStatus='none'` + sub Alpha/Espelho com `status='active'` (pagamento em dia) + email preenchido. Click numa linha dispara `createStudent` em modo PROMOTE. Drawer (CRUD do aluno) passa a assumir que o aluno já está na plataforma.
- DEC-AUTO-263-14 — Helper `lacksAuthUser(student)` detecta aluno sem Auth pelo padrão do id (`student_*` = pseudo-id de `createInlineStudent`; qualquer outro = Auth UID). Filtro de candidatos ao ritual usa esse helper em vez de `accessStatus !== 'none'` pra evitar falso-positivo quando aluno tem Auth mas `firstLoginAt` não foi gravado em prod legado (relato: "Antonio aparece na lista mesmo já tendo logado").
- DEC-AUTO-263-15 — `updateSubscription` agora sincroniza `student.accessTier` quando `plan/status/type` mudam (caso típico: upgrade espelho → alpha). Antes o doc do student ficava defasado. Adicionado callable `syncAccessTier(dryRun?)` pra corrigir os docs já desalinhados em prod.

## Chunks

- CHUNK-02 (Student) — ESCRITA — alteração no contrato de filtragem da tela de gestão de alunos.

## Aceite

Espelhado no body do issue. Validação manual no smoke + `npm test`.
