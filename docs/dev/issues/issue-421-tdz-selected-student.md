# Issue #421 — fix: tela do mentor não sobe em produção (TDZ em selectedStudent)

## Autorização

- [x] Hotfix de produção autorizado por Marcio (04/09/2026): *"quebrou o sistema, não sobe"*.
- [x] Mockup — não se aplica: nenhuma mudança de UI. É ordem de declaração.
- [x] Memória de cálculo — não se aplica.

## Context

A v1.88.0 (#144, PR #420) subiu e a tela do mentor não carrega: `Uncaught ReferenceError: Cannot access 'K' before initialization`, depois de os listeners subirem — ou seja, no render do `MentorDashboard`.

`selectedStudent` era `useState` no topo do componente. Ao virar derivado da rota (`useMemo` sobre `studentIdSelecionado`, #144 Fase A1), foi declarado na linha 238; `selectedStudentTrades` o lê na 187. `const` em TDZ derruba a árvore inteira.

## Por que atravessou os gates

Build verde, lint sem erro novo, 4.768 testes verdes. **Nenhum teste montava o `MentorDashboard`** — a suíte cobre utilitários, hooks e componentes pequenos, e o teste de rotas do #144 stuba a página. Ordem de declaração só aparece executando o corpo do componente. AP-08 (Build Verde, App Quebrada).

O gate que faltou não foi de código, foi de verificação: eu declarei "build ok / suíte verde" e tratei isso como cobertura da tela, quando a tela nunca era executada em teste nenhum.

## Phases

- A1 — mover a declaração de `selectedStudent` para depois de `students`, antes do primeiro uso.
- A2 — `MentorDashboardMount.test.jsx`: montar a página nas quatro views e nos três casos da ficha (id, email, não encontrado).

## Verificação do teste

Rodado contra o código quebrado (o que está em produção): falha com `ReferenceError: Cannot access 'selectedStudent' before initialization` — a mensagem exata do incidente. Com o fix: 7/7.

## Sessions

- `fix + teste de mount commit <sha> ok`

## Shared Deltas

- `src/version.js` — bump v1.88.1 (reservada em `c12ec276`)
- `docs/registry/versions.md` — marcar consumida
- `docs/registry/chunks.md` — liberar CHUNK-16
- `CHANGELOG.md` — entrada `[1.88.1]`
- `docs/PROJECT.md` — encerramento

## Chunks

- CHUNK-16 (escrita) — MentorDashboard
