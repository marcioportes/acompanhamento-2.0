# Issue #408 — Aguardando Feedback: aluno → dia → plano → trade

**Versão reservada:** 1.85.0 (feature = minor sobre 1.84.0, última consumida)
**Branch:** `feat/issue-408-fila-por-dia` · **Worktree:** `~/projects/issue-408`
**Chunks:** CHUNK-16 ESCRITA (lock 29/08) · CHUNK-05 LEITURA

---

## 1. Context

A tela Aguardando Feedback agrupa só por aluno; ao abrir um aluno, o mentor recebe
uma lista plana de trades — sem dia, sem plano, sem resultado, sem sequência. O
contexto que só existe no conjunto fica invisível: três operações que fecharam no
zero contam história diferente de três que fecharam em −R$ 800, e o mesmo trade
isolado merece feedbacks opostos nos dois casos.

O #402 deu ao trade a posição dele no dia, mas isso só aparece DEPOIS de abrir o
trade. Na triagem, o mentor ainda não tem nada.

**Spec completa, mockup e memória de cálculo:** corpo do issue #408 (SSoT).

## 2. Hierarquia

`aluno → dia → plano → trade` (Marcio, 27/08).

O nível de PLANO não é detalhe: o período é medido por plano, com limiares e moeda
próprios. Aluno com B3 e mesa no mesmo dia tem **dois períodos independentes** —
juntá-los somaria reais com dólares e mediria o total contra o stop de um só.

## 3. Fases

- **Fase A** — agregação da árvore (`filaDeFeedback`) + testes antes da UI (INV-05).
  Uma passada sobre os pendentes produzindo aluno → dia → plano → linhas, com o
  cabeçalho agregado por aluno.
- **Fase B** — UI: árvore navegável com estado de expansão, cabeçalho do aluno,
  card do dia por plano (reusando `DayTile`/`dayMetricTiles`), linhas de operação
  com `authorizationNotice`.
- **Fase C** — colapso do nível de plano quando há um só, casos limites (sem plano,
  ordem não confiável), e a passagem para a `FeedbackPage` sem mudá-la.

## 4. O que já existe — a evolução é montagem

- `buildPeriodState(trades, plan)` (#402) — o período por plano, testado
- `dayMetricTiles` + `DayTile` — render denso com bandas e tooltips
- `authorizationNotice(row, ps)` — o texto por operação
- `sortTradesChrono` — a ordem dentro do dia
- `getTradesAwaitingFeedback()` — a fonte dos pendentes

O trabalho real é a árvore, o estado de expansão e o cabeçalho agregado.

## 5. Shared Deltas (editados no MAIN na abertura)

- `src/version.js` 1.84.0 → 1.85.0
- `docs/registry/versions.md` — reserva 1.85.0
- `docs/registry/chunks.md` — lock CHUNK-16
- Commit `e568a67a` (main) + push. Nenhum outro shared file pendente.

## 6. Decisions

(a preencher — DEC-AUTO-408-NN)

## 7. Sessions

- 29/08/2026 — abertura §4.0: lock + reserva no main, worktree, doc de controle.
