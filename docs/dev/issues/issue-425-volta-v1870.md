# Issue #425 — revert: interface volta ao estado da v1.87.0

## Autorização

- [x] Marcio, 04/09/2026: *"não houve modificação como eu esperava, gostaria de um face lift completo para competir com SaaS top de linha, mas não houve essa entrega. Pode fazer rollback e deixar como estava."*
- [x] Mockup / memória de cálculo — não se aplicam: é restauração de estado.

## Context

O pedido era **qualidade visual** — parecer um SaaS de primeira linha. O #144 entregou **arquitetura de navegação**: roteador, casca única, escala de tokens. É higiene de código real e nada disso é visível para quem usa. O diagnóstico traduziu o problema para o vocabulário técnico em vez de atacar o que foi pedido, e o saldo para o usuário foi negativo — duas regressões em produção no mesmo dia (#421 tela branca; #423 menu esvaziado).

## Método

Rollback **por conteúdo**, não `git revert`: os três squashes (#420, #422, #424) se empilham e o revert encadeado conflita — verificado.

`src/` restaurado a partir de `be8657e8`, preservando apenas `src/version.js`. Confirmado por `git diff be8657e8 -- src/`: o único arquivo diferente é o `version.js`.

Os 63 arquivos de `src/` alterados desde `be8657e8` vieram todos de #144/#421/#423 — nenhuma outra frente tocou `src/` no período, então a restauração é completa e verificável.

## O que fica

Todo o histórico documental: CHANGELOG, PROJECT.md, DEC-144-*, DEC-423-*, e a nota de incidente no AP-08. O código volta; o que foi aprendido não.

## O que morre com o rollback

`src/routes/*`, `PageHeader`, `TorrePendencias`, `usePendingReviewsCount` e os testes `routes/*`, `invariants/pageChrome`, `pages/MentorDashboardMount`.

**Perda que vale nomear:** o `MentorDashboardMount.test.jsx` (do #421) era o único teste que montava a tela do mentor. Some porque foi escrito contra a assinatura nova do componente. A lacuna que ele cobria volta a existir — anotada como dívida.

## Volta a valer

`App.jsx` com `currentView`, menu de 9 itens, barra de abas do dashboard, tela "Precisam Atenção", `PendingReviewsCard`. E os defeitos conhecidos junto: sem URL, sem back do browser, sem deep link.

## Decisions

- DEC-425-01 — o #144 é revertido por não atender ao pedido, não por estar tecnicamente errado. Se a arquitetura de navegação voltar à pauta, volta como issue própria e com o problema declarado em termos de produto.
- DEC-425-02 — dívida registrada: nenhum teste monta o `MentorDashboard`. Era a lacuna que causou o #421.

## Sessions

- `rollback por conteúdo commit <sha> ok`

## Shared Deltas

- `src/version.js` — bump v1.89.0 (reservada em `c0ff0585`)
- `docs/registry/versions.md` — marcar consumida
- `docs/registry/chunks.md` — liberar CHUNK-01/02/16
- `CHANGELOG.md` — entrada `[1.89.0]`
- `docs/tech-debt.md` — DT do teste de mount do MentorDashboard
- `docs/PROJECT.md` — encerramento

## Chunks

- CHUNK-01, CHUNK-02, CHUNK-16 (escrita)
