# Issue #387 — fix: card Consistência Operacional pula de altura

> Template enxuto (R4). Modo AUTÔNOMO (§13) — trigger dado por Marcio em 24/08/2026.

## Autorização

- [x] Mockup — dispensado: a correção é remoção de estado transitório de layout, sem tela nova. Comportamento visual descrito em Phases.
- [ ] Memória de cálculo — não se aplica (nenhuma fórmula muda; Sharpe/CV/MEP/MEN permanecem idênticos)
- [x] Marcio autorizou o plano de fases — 24/08/2026, "A + B"
- [x] Gate Pré-Código liberado

## Context

O card Consistência Operacional troca o layout inteiro por um esqueleto de 4 colunas
enquanto o Sharpe (única métrica com I/O) não resolve. O esqueleto é mais baixo que o
layout real — que tem, abaixo do grid, o bloco "Tempo W vs L", o aviso de cobertura
MEP/MEN e a linha de Sharpe indisponível (#385). O card cresce quando o conteúdo chega e
empurra os vizinhos da mesma linha do grid.

Relato de 24/08 amplia o sintoma: durante a cascata de CFs do import (Order Import /
performance), o pulo **se repete continuamente** enquanto as CFs escrevem. Não é o
primeiro paint — é o efeito reentrando a cada snapshot.

## Spec

Ver issue body: #387. Diagnóstico ampliado de 24/08 registrado em Phases (fase B).

## Decisões Antecipadas (§3.1)

- **DA-01** (24/08/2026) — Escopo A + B. A issue absorve a causa em regime, não só o
  primeiro paint. Razão de Marcio, implícita no relato de hoje: o pulo que ele vê acontece
  durante a cascata de CFs do import, não no carregamento. Fase A sozinha esconderia o
  sintoma que originou a conversa.
- **DA-02** (24/08/2026) — `StudentContextProvider.jsx` é shared infra (§6.2): se a fase B
  precisar estabilizar a identidade de `selectedPlan`, o delta é proposto neste doc antes
  de editar. Preferência: resolver dentro do `useCycleConsistency`, sem tocar o provider.

## Phases (aprovadas 24/08/2026)

- A1 — card nasce com a altura final: CV/MEP/MEN pintam no primeiro tick; só a tile do
  Sharpe troca de conteúdo, sem mudar altura; blocos abaixo do grid deixam de aparecer
  "do nada". (WIP de 22/08 já cobre — falta revisar, testar e commitar.)
- B1 — `useCycleConsistency` para de reentrar por identidade: deps `trades`/`plan` são
  array/objeto novos a cada snapshot do Firestore; toda escrita de CF no trade ou no
  plano reseta o card. Chavear por valor estável.
- B2 — `getSelicForDate` ganha cache: hoje cada reentrada dispara uma leitura Firestore
  por dia com trade, sem memoização.

### Tasks (decomposição — trabalho do Interface, §13.8 passo 14)

- `01-primeiro-paint` (A1) — finaliza e commita o WIP de 22/08.
  Arquivos: `src/components/dashboard/CycleConsistencyCard.jsx`,
  `src/__tests__/components/dashboard/CycleConsistencyCard.test.jsx`,
  `src/__tests__/components/CycleConsistencyCard.resiliente.test.jsx`.
- `02-deps-estaveis` (B1) — `useCycleConsistency` chaveia por valor, não por identidade.
  Arquivos: `src/hooks/useCycleConsistency.js` + teste novo.
- `03-selic-cache` (B2) — memoização em `getSelicForDate`.
  Arquivos: `src/utils/marketData/getSelicForDate.js` + teste.

## Sessions

- `task 00 [setup] main 71b141a0 / worktree 6cd604b8 ok — re-reserva v1.83.31, rebase sobre main, control file`
- `task 01 [A1] 2743a6ba ok — 3907 passed / 0 failed; validator INV-27 exit 0 (commit_exists, tests_match, files_match)`

## Shared Deltas

- `src/version.js` — bump 1.83.31 (no encerramento)
- `docs/registry/versions.md` — marcar 1.83.31 consumida
- `docs/registry/chunks.md` — liberar CHUNK-02
- `CHANGELOG.md` — nova entrada `[1.83.31]`
- `src/contexts/StudentContextProvider.jsx` — shared infra (§6.2): só se a fase B exigir
  estabilizar a identidade de `selectedPlan`. Delta proposto aqui antes de editar.

## Decisions

- `DEC-AUTO-387-01` — placeholder `···` do Sharpe vai no slot do valor, não no parágrafo de
  texto longo do MetricTile (`isInsufficient={!loading && ...}`, invertido do WIP).
  | Justificativa: o WIP jogava o placeholder no `<p min-h-[2.5rem]>`, trocando o layout da
  tile ao resolver.
- `DEC-AUTO-387-02` — altura reservada com `md:min-h-[6rem]` no grid, em vez de paridade de
  linhas entre tile carregando/resolvida. | Justificativa: os dois requisitos do briefing
  (paridade de linhas E sem bandLabel/badge no loading) não coexistem; reservar no grid
  cobre também `insufficientReason`, erro e as reentradas da cascata de CFs.
  `cycleMetricTiles.jsx` (SSoT do wizard #282) não foi tocada.
- `DEC-AUTO-387-03` — `avgTradeDuration` no teste novo usa `{ all: 12 }` (o card lê `?.all`).
  | Justificativa: escalar silenciava o bloco. Mesmo defeito no describe do #385 ficou —
  fora do escopo da task.
- `DEC-AUTO-387-04` — asserções negativas sobre `cycle-consistency-skeleton` removidas e
  substituídas por asserções positivas. | Justificativa: critério de aceite pedia zero
  ocorrências do testid no `src/`.

### Pendência de verificação visual (handoff task 01)

`md:min-h-[6rem]` foi derivado somando as linhas da tile do Sharpe resolvida (~93px); jsdom
não faz layout, então nenhum teste prova o número. Conferir no dev server antes do
encerramento.

## Chunks

- CHUNK-02 (escrita) — CycleConsistencyCard, useCycleConsistency, StudentDashboard
