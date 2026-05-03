# Issue #237 — feat: cadastro de alunos / assinaturas

> Template enxuto (R4). Spec completa no body do issue: https://github.com/marcioportes/acompanhamento-2.0/issues/237

## Autorização

**Construído com Marcio em modo interativo (02/05/2026)**:
- Issue body sucessivamente refinado (3 rounds): proposta inicial → INV-15 schema → planilha real lida.
- Mockup HTML em `/home/mportes/Temp/issue-237-mockup.html` (Contacts acima, Assinaturas abaixo) — Marcio visualizou e confirmou layout.
- Memória de cálculo: tabela de transições de estado em `## Memória de cálculo — transições de estado` no body.
- 10 open questions resolvidas em sequência: nome canônico (`contacts/`), triplo match, formato Excel, lead/oportunidade unificado, Cancelado SKIP no bootstrap, VIP não paga, nome livre (sem regex de qualidade), email não existe (mentor adiciona um-a-um), Vencimento null = alpha sem prazo, rota top-level `/assinaturas`.

**Status**:
- [x] Mockup apresentado
- [x] Memória de cálculo apresentada
- [x] Marcio autorizou ("boa, sim", confirmando rota top-level e fechando todas as questions)
- [ ] Gate Pré-Código liberado (próximo passo)

## Context

`students/{uid}` hoje é a única forma de "aluno" no Espelho — assume Alpha (email + dashboard + onboarding). Não há SSoT pra leads/Espelho/ex-alunos; vivem em planilha externa. Esta issue cria `contacts/` como SSoT canônica, com página `/assinaturas` (top-level mentor-only) que dirige todas as transições de estado.

## Spec

Body do issue: #237 (link autoritativo).

## Mockup

`/home/mportes/Temp/issue-237-mockup.html` — layout stacked numa página só:
- Header: breadcrumb + título "Contacts & Assinaturas" + botões "Importar .xlsx" / "+ Novo contato"
- Seção 1 (Contacts): tabela com 56 contatos, busca, filtros por status (Todos/Alpha/Espelho/Lead/Ex/VIP), linha JL em destaque (⚠ sem email)
- Seção 2 (Assinaturas ativas): 4 stat cards (Alpha 43 / Espelho 0 / VIP 13 / Vence ≤7d 3) + tabela com vencimento relativo + link pra `student/`

## Memória de Cálculo

Ver tabela no body do issue (`## Memória de cálculo — transições de estado`). Pontos críticos:
- Bootstrap NÃO cria student (planilha sem email); só popula `contacts/` com `subscription.type='alpha'` e `studentUid=null`.
- Mentor adiciona email pela UI → callable `assignAlphaSubscription` cria student.
- Cancelado na planilha → SKIP no bootstrap (só log, não vai pra `contacts/`).
- Triplo match (nome OR celular OR email) bloqueia duplicatas em insert.

## Phases

- F1 — Schema `contacts/` + INV-15 + rules (campo `nameNormalized` derivado pra suportar query de dedup)
- F2 — Bootstrap one-time `scripts/issue-237-bootstrap-contacts.mjs` (xlsx lib + dry-run/execute, padrão `bootstrap-selic-history.mjs`)
- F3 — Adapter callables: `assignAlphaSubscription`, `removeSubscription`, `assignEspelhoSubscription`
- F4 — Página `/assinaturas` top-level mentor-only (Contacts em cima, Assinaturas embaixo)
- F5 — `createStudent` CF passa por `contacts/` (rejeita criação direta)
- F6 — Backfill students existentes → contacts (`status='alpha'`)

## Sessions

_(log linear, 1 linha por task — preencher conforme avança)_

## Shared Deltas

Para o integrador aplicar no main após o merge:
- `src/version.js` — bump v1.55.0 (já feito na abertura)
- `docs/registry/versions.md` — marcar v1.55.0 consumida (encerramento)
- `docs/registry/chunks.md` — liberar lock CHUNK-02 (encerramento)
- `CHANGELOG.md` — nova entrada `[1.55.0] - 02/05/2026` (encerramento)
- `docs/firestore-schema.md` — novo schema `contacts/` (durante F1)
- `docs/decisions.md` — DEC-237-NN entries (durante implementação)
- `firestore.rules` — allowlist mentor-only para `contacts/` (durante F1)
- `functions/index.js` — exports dos 3 callables novos (durante F3)
- `package.json` — nova dep `xlsx` (durante F2; verificar se já existe via outras issues)
- `src/App.jsx` — rota `/assinaturas` mentor-only (durante F4)

### Proposta — adicionar CHUNK-18 (Contacts) a `docs/chunks.md`

Atualmente `contacts/` cai sob CHUNK-02 (Student Management) por proximidade semântica. Proposta de split em chunk próprio:

```
| CHUNK-18 | Contacts & Subscriptions | Cadastro mestre de pessoas (leads/Espelho/Alpha/ex), página `/assinaturas`, callables de adapter Alpha | `contacts` collection, `assignAlphaSubscription`, `Assinaturas/*` | AVAILABLE |
```

**Decisão**: deixar como expansão de CHUNK-02 nesta v1; adicionar CHUNK-18 depois se a área crescer (ex: billing, segmentação, automação). Não bloqueia esta issue.

## Decisions

_(IDs only — texto em `docs/decisions.md`)_
- DEC-237-01 — collection canônica `contacts/` (vs `subscribers/`/`members/`/`people/`)
- DEC-237-02 — triplo match (nome/celular/email) pra dedup
- DEC-237-03 — bootstrap NÃO cria student (planilha sem email); Alpha materializa via callable depois
- DEC-237-04 — Cancelado na planilha = SKIP no bootstrap, só reporta no log
- DEC-237-05 — VIP não paga (case-insensitive); `isVIP=true` é flag de billing-skip
- DEC-237-06 — `students/{uid}` ganha `status: 'active'|'inactive'`; nunca deleta (preserva histórico de trades)
- DEC-237-07 — página `/assinaturas` top-level mentor-only com layout stacked (Contacts + Assinaturas) numa página

## Chunks

- CHUNK-02 (escrita) — `students/` ganha campo `status`, `createStudent` CF passa a exigir `contacts/{id}` upstream
- CHUNK-01 (leitura) — reuso do fluxo Auth no `assignAlphaSubscription`
