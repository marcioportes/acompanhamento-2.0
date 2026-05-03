# Issue #237 — feat: cadastro de alunos / assinaturas

> Template enxuto (R4). Spec original no body do issue: https://github.com/marcioportes/acompanhamento-2.0/issues/237

## Pivot durante a issue

Plano original: collection nova `contacts/` como SSoT de pessoas (lead/Espelho/Alpha/ex) com 6 fases (F1-F6). Após F4, Marcio reviu e descartou `contacts/` em favor da subcollection existente `students/{uid}/subscriptions/`. **Arquitetura final**: tudo em `students/` + `students/{uid}/subscriptions/` (com `payments/`). Collection `contacts/` foi populada (56 docs via F2) e depois deletada inteira em prod.

Razão: subscription já é sistema de fluxo de caixa completo (DEC-055/056). `contacts.subscription` como mero "campinho" duplicava o sistema canônico. UI consolidada em `/assinaturas` com criação inline de aluno (modal "Nova Assinatura").

## Context

`students/{uid}` continua sendo a única forma de "aluno" no Espelho. Assinaturas vivem como subcollection. Alunos podem existir sem Auth (criação inline com nome+celular sem email = pré-Alpha) — só viram Alpha-com-acesso quando email é adicionado. `StudentsManagement` filtra Alpha não-cancelled; busca live de proximidade dirige completar dados de alunos órfãos.

## Entregas

### UI
- `SubscriptionsPage`: modal "Nova Assinatura" suporta criar aluno inline (3 campos: nome/celular/email) ou usar existente. Edit aluno por linha (botão UserCog). Sort de colunas, paginação 20/30/50, filtro por 6 status. "Ativas" baseado em `status !== 'cancelled'` (inclui inadimplentes/pausados/expirados). Cards de sumário e badge "VIP" coerentes com plano `vip`.
- `StudentsManagement`: lista filtrada por `subscription.plan === 'alpha' && status !== 'cancelled'`. Busca live (nome/email/celular) sobre Alpha existentes — "Usar este" preenche email (se vazio) + celular (se diferente), preserva nome/plano/pagamento. Botão excluir removido (saída de Alpha = mudança de plano da subscription).

### Plano `vip`
- `PLAN_LABELS.vip='VIP'`, badge fuchsia. Modais Nova/Edit forçam `plan='vip'` quando `type='vip'` e ocultam select.
- Script `scripts/issue-237-fix-vip-plan.mjs` migrou 13 VIPs antigos `self_service` → `vip` em prod.

### Backfill da planilha (one-time, executado em prod)
- `scripts/issue-237-backfill-subscriptions.mjs` — 42 paid trimestrais R$1200 (`startDate = endsAt - 3m`, `renewalDate = endsAt` literal preservando planilha) + payment inicial.
- `scripts/issue-237-backfill-vip.mjs` — 12 VIPs órfãos (Daniel já existia, skipado por idempotência) sem cobrança.

### Helpers
- `src/utils/contactsNormalizer.js` (`normalizeName`/`normalizePhone`/`normalizeEmail`) — usado na busca live de proximidade no `StudentsManagement`. Único artefato sobrevivente do fluxo `contacts/`.

## Descartado / revertido

- `contacts/` collection (criada em F1, populada em F2, deletada em prod)
- `src/components/contacts/ContactsSection.jsx`
- `src/hooks/useContacts.js`
- `functions/contacts/{assignAlphaSubscription,assignEspelhoSubscription,removeSubscription}.js`
- `scripts/issue-237-bootstrap-contacts.mjs` + tests
- Bloco `match /contacts/` em `firestore.rules`
- Schema `contacts/` em `docs/firestore-schema.md`

## Shared Deltas

- `src/version.js` — bump v1.55.0 (CHANGELOG reescrito refletindo arquitetura final)
- `docs/registry/versions.md` — marcar v1.55.0 consumida (encerramento)
- `docs/registry/chunks.md` — liberar lock CHUNK-02 (encerramento)
- `CHANGELOG.md` — nova entrada `[1.55.0]` (encerramento)
- `docs/firestore-schema.md` — schema `contacts/` removido
- `firestore.rules` — bloco `contacts/` removido
- `functions/index.js` — exports dos callables `contacts/*` removidos

## Decisions

- DEC-237-01 — `contacts/` descartado; consolidação em `students/{uid}/subscriptions/` (subcollection canônica DEC-055)
- DEC-237-02 — Aluno pode existir sem Auth (pré-Alpha): nome+celular sem email; só vira Alpha-com-acesso quando email é adicionado
- DEC-237-03 — Plano `vip` é primeiro-classe (`PLAN_LABELS.vip`), distinto de Alpha/Espelho. Type='vip' força plan='vip'
- DEC-237-04 — Saída de Alpha não deleta student; muda plano da subscription preservando histórico (limitação de acesso por plano = issue futura)
- DEC-237-05 — `StudentsManagement` busca de proximidade restrita a Alpha não-cancelled; "Usar este" só completa dados, nunca sobrescreve nome/plano

## Chunks

- CHUNK-02 (escrita) — `students/` permanece SSoT; `subscriptions/` reusada
