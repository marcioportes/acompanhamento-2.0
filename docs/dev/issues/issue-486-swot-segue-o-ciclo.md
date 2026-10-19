# Issue #486 — fix: SWOT e Maturidade do aluno somem com ciclo selecionado

> **Branch:** `fix/issue-486-swot-segue-o-ciclo`
> **Aberto em:** 19/10/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.18

## Autorização

- [x] Mockup apresentado — sem tela nova; muda só qual revisão os cards mostram
- [x] Memória de cálculo apresentada (abaixo)
- [x] Marcio autorizou — 19/10/2026, "sim"
- [x] Gate Pré-Código liberado

## Context

Com um ciclo selecionado na barra, o dashboard do aluno escolhe a revisão pelo campo
`cycleKey` da revisão. Revisões nascidas do feedback (#269 v2) gravam `cycleKey: null`, e
nas antigas o campo está em 19% da base e em formato de data (`2026-04-01`), enquanto a
barra usa `2026-04`. Resultado: com ciclo selecionado, o SWOT (e a Maturidade de ciclo
passado) não acham revisão nenhuma. Correção na leitura: o ciclo da revisão passa a sair
das datas dela, que existem em 100% das revisões. Sem escrita, sem backfill, sem CF.

## Spec

Issue #486 no GitHub.

## Mockup

Sem mudança visual. Estados dos cards "Análise Estratégica (SWOT)" e "Maturidade" (ciclo passado):
- Ciclo da barra com revisão publicada → mostra a última revisão publicada desse ciclo.
- Ciclo sem revisão publicada → mantém "Aguardando primeira Revisão Semanal…".
- "Todos os ciclos" → última revisão publicada (como hoje).

## Memória de Cálculo

**Inputs:** `students/{uid}/reviews` com `status == 'CLOSED'`, ordenadas por `weekStart` desc (limite 20, como hoje);
campos `periodStart`/`periodEnd` (50%) com fallback `weekStart`/`weekEnd` (100%), strings `YYYY-MM-DD`.
Janela do ciclo: `studentCtx.selectedCycle.start/end` → `cycleWindow {startISO, endISO}` (já existe, #432).

**Regra:** a revisão pertence ao ciclo se o período dela cruza a janela do ciclo:
`inicio = periodStart || weekStart`, `fim = periodEnd || weekEnd || inicio`;
pertence ⇔ `inicio <= endISO && fim >= startISO`. Entre as que pertencem, vale a de `weekStart` mais recente.
O `cycleKey` gravado na revisão deixa de ser lido.

**Casos limites:**
- Revisão que atravessa a virada (25/09 → 02/10) aparece nos dois ciclos — ela tem trades dos dois.
- `periodEnd` é gravado como a data da publicação quando o último trade é anterior; uma revisão de trades
  de setembro publicada em 02/10 também conta para outubro.
- Sem datas válidas → não pertence a ciclo nenhum (só aparece em "Todos os ciclos").
- Filtro de plano inalterado.

**Exemplo:** barra em out/2026 (01/10–31/10). Revisão A: 22/09–29/09 → fora. Revisão B: 30/09–08/10 → dentro.
Revisão C: 13/10–17/10 → dentro e mais recente → SWOT mostra C.

## Phases

- A1 — `useLatestClosedReview` recebe a janela do ciclo em vez da chave; regra de pertencimento por datas, com testes
- A2 — `StudentDashboard` passa `cycleWindow`

## Sessions

- `A1+A2 janela-do-ciclo` — hook 23 testes; suíte 5493 passed (TZ=UTC); build ok

## Shared Deltas

- `src/version.js` — 1.92.18 consumida
- `docs/registry/versions.md` — marcar 1.92.18 consumida
- `docs/registry/chunks.md` — liberar CHUNK-02
- `CHANGELOG.md` — entrada `[1.92.18]`
- `docs/PROJECT.md` — histórico de versão

## Decisions

- DEC-486-01 — ciclo da revisão derivado das datas na leitura; `cycleKey` gravado ignorado

## Chunks

- CHUNK-02 (escrita) — `useLatestClosedReview`, `StudentDashboard`
- CHUNK-13 (leitura) — janela do ciclo selecionado
