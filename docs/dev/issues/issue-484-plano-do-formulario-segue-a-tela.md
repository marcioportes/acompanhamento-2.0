# Issue #484 — fix: formulário de novo trade ignora a barra de contexto e grava no plano mais recente

> **Branch:** `fix/issue-484-plano-do-formulario-segue-a-tela` · **Aberto em:** 02/10/2026 · **Versão reservada:** 1.92.17

## Autorização

- [x] Mockup — texto abaixo (só muda o valor inicial do campo "Plano"; layout intacto).
- [x] Memória de cálculo — regra condicional de 3 passos, abaixo.
- [x] Marcio autorizou (02/10/2026): *"precisa usar o que está na tela né?"* → *"fast track pra corrigir isso"*.
- [x] Gate Pré-Código liberado

## Context

O formulário de novo trade pré-selecionava `plans[0]` (lista do `usePlans` em `createdAt desc` = plano mais recente) e ainda carregava o plano da abertura anterior. O dashboard filtra pela barra de contexto. Em 02/10/2026 dois trades de WIN lançados com a barra na conta Demo foram gravados no plano da conta PROP em USD criada na véspera: sumiram da tela e somaram +2.000 no saldo da prop.

## Spec

Ver issue body: #484.

## Mockup

```
Barra: [Demo - Mentoria ao Vivo] > [PL-Demo ao-vivo] > ...      →  Plano *  [ PL-Demo ao-vivo  v ]
Barra: [Demo - Mentoria ao Vivo] > (sem plano)                  →  Plano *  [ plano ativo mais recente da conta  v ]
Barra: [Todas as contas], aluno com 2+ planos                   →  Plano *  [ Selecione...  v ]  (submit barrado: "Selecione um plano")
Barra: [Todas as contas], aluno com 1 plano                     →  Plano *  [ o único plano  v ]
```

A lista do campo continua com todos os planos; edição de trade continua com o plano travado.

## Memória de Cálculo

- **Inputs:** `plans` (hook `usePlans`), `studentCtx.planId`, `studentCtx.accountId` (StudentContextProvider).
- **Regra** (`resolveDefaultTradePlanId`), sobre os planos com `active !== false`:
  1. `contextPlanId` existe entre eles → ele.
  2. senão, `contextAccountId` definido → plano mais recente dessa conta (`getDefaultPlanForAccount`).
  3. senão, exatamente 1 plano → ele.
  4. senão → `''` (aluno escolhe).
- **Casos limite:** plano da barra arquivado/inexistente cai para o passo 2; conta sem plano cai para 3/4; `plans` vazio/nulo → `''`.
- **Exemplo:** planos `[Lucid (01/10), PL-Demo (mar)]`, barra em Demo/PL-Demo → `PL-Demo` (antes: `Lucid`).

## Phases

- A1 — helper `defaultTradePlan.js` + prop `defaultPlanId` no `AddTradeModal` + ligação no `StudentDashboard`; testes.

## Sessions

- `A1 02/10/2026 ok` — 15 testes novos; suíte 5484 passed (TZ=UTC); build ok; lint 0 erros.

## Shared Deltas

- `src/version.js` — bump v1.92.17
- `docs/registry/versions.md` — marcar v1.92.17 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04
- `CHANGELOG.md` — entrada `[1.92.17] - 02/10/2026`
- `docs/PROJECT.md` — encerramento

## Decisions

- DEC-484-01 — o plano inicial do formulário de novo trade vem da barra de contexto (plano → conta → plano único); sem como saber, abre vazio e obriga a escolha. O formulário não guarda o plano da abertura anterior.

## Pendências (fora do escopo)

- `App.jsx:548` mantém um segundo `AddTradeModal` cujo gatilho (`'add-trade'`) não é disparado por ninguém — código morto. Com o fix ele também deixou de chutar o plano mais recente; remover fica para limpeza.
- `AddTradeModal` não tem `DebugBadge` (INV-04) — lacuna anterior a esta issue.
- Validação no navegador com aluno logado não foi feita nesta sessão (sem credencial); coberta por teste de componente.

## Chunks

- CHUNK-04 (escrita) — formulário de registro de trade (`AddTradeModal`).
- CHUNK-13 (leitura) — barra de contexto.
