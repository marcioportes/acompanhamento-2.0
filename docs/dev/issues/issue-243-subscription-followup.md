# Issue #243 — feat: campo follow-up em assinatura

## Autorização

- [x] Mockup apresentado — exceção autorizada (issue simples, descrição UI suficiente)
- [x] Memória de cálculo apresentada — exceção autorizada (filtro trivial: `arr.filter(s => s.inFollowUp)`)
- [x] Marcio autorizou — 04/05/2026 chat: "procura pela tela assinatura SubscriptionPage e coloque um campo de followup, quero saber se estou em followup com a pessoa ou não, e preciso de um filtro para esse estado"
- [x] Gate Pré-Código liberado

## Context

Marcio cobra inadimplentes/pendentes por WhatsApp. Hoje não tem como marcar quem está em follow-up — esquece ou cobra duplicado. Quer flag binária na assinatura + filtro pra ver só os em follow-up.

## Spec

Ver issue body no GitHub: #243.

## Mockup

Tela `/subscriptions` (`SubscriptionsPage`) ganha 2 elementos:

1. **Chip de filtro top-level** — após os filtros de tipo (Pagos/Trial/VIP), separador `|` e chip único `📞 Follow-up (N)`. Clique alterna ON/OFF (visual: borda emerald + bg quando ON; cinza quando OFF).
2. **Botão toggle na coluna Ações** — ícone `MessageCircle` antes do botão "Editar aluno". Tooltip "Em follow-up" / "Marcar follow-up". Cor: emerald quando `inFollowUp === true`, slate quando `false/undefined`. 1 clique persiste no Firestore via `updateSubscription(sub, { inFollowUp: !sub.inFollowUp })`.

Sem modal, sem timestamp visível, sem confirm.

## Memória de Cálculo

- **Input**: campo `inFollowUp: boolean | undefined` em cada doc `students/{uid}/subscriptions/{id}`.
- **Default**: `undefined` em docs antigos → tratado como `false` no filtro e na UI.
- **Filtro**: `subs.filter(s => s.inFollowUp === true)`.
- **Contador do chip**: `subs.filter(s => s.inFollowUp === true).length` (mesma lógica).
- **Toggle**: `updateSubscription(sub, { inFollowUp: !sub.inFollowUp })` — `useSubscriptions` já adiciona `updatedAt: serverTimestamp()`.
- **Casos limites**: doc sem o campo → `!undefined === true` → primeiro clique grava `true` (correto); doc com `false` explícito → primeiro clique grava `true` (correto); doc com `true` → primeiro clique grava `false` (correto).

## Phases

- A1 — UI: chip filtro + botão toggle + filtro logic em `SubscriptionsPage.jsx`
- A2 — Teste unitário do filtro (pure helper, padrão `subscriptions.test.js`)
- A3 — Build + smoke manual

## Sessions

- task A1 [ui] commit `<sha>` ok
- task A2 [test] commit `<sha>` ok
- task A3 [build] commit `<sha>` ok

## Shared Deltas

- `src/version.js` — bump v1.55.3 (já reservada no main)
- `docs/registry/versions.md` — marcar 1.55.3 consumida (no encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-16 (no encerramento)
- `CHANGELOG.md` — entrada `[1.55.3] - 04/05/2026`

## Decisions

(Sem decisões formais — escopo trivial, todas as escolhas cosméticas no chat de captura.)

## Chunks

- CHUNK-16 (escrita) — campo novo na subcollection `subscriptions` + UI da página de mentor
