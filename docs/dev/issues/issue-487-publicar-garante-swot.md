# Issue #487 — fix: revisão pode ser publicada sem SWOT

> **Branch:** `fix/issue-487-publicar-garante-swot`
> **Aberto em:** 20/10/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.19

## Autorização

- [x] Mockup apresentado (abaixo)
- [x] Memória de cálculo — exceção: sem cálculo; regra condicional descrita no mockup
- [x] Marcio autorizou — 20/10/2026, "sim"
- [x] Gate Pré-Código liberado

Decisão de produto (20/10/2026, Marcio): **bloquear a publicação até o SWOT ser gerado** (não gerar sozinho).

## Context

O SWOT só existe se o mentor clicar em "Gerar SWOT" com a revisão em rascunho; publicar não exige
nem gera. Depois de publicada, o botão some (`isDraft`), embora a CF `generateWeeklySwot` aceite
revisão publicada (usa o `frozenSnapshot`; só recusa arquivada). Aluno fica em "Aguardando…" para sempre.

## Spec

Issue #487 no GitHub.

## Mockup

Tela da Revisão do mentor (`WeeklyReviewPage`):

**Rascunho sem SWOT**
- Seção SWOT: igual hoje — "SWOT ainda não foi gerado para esta revisão." + [Gerar SWOT via IA].
- Rodapé: `Gere o SWOT antes de publicar.   [Publicar revisão]` — botão desabilitado.

**Rascunho com SWOT** — igual hoje (Publicar liberado; Regenerar disponível).

**Publicada sem SWOT** (revisões antigas)
- Seção SWOT: "SWOT ainda não foi gerado para esta revisão." + [Gerar SWOT via IA].
- Gera a partir do retrato congelado (o mesmo que o aluno vê). O aluno passa a ver na hora.
- Gerou → some o botão; **Regenerar continua bloqueado** em revisão publicada (como hoje).

**Publicada com SWOT / arquivada** — iguais hoje.

## Phases

- A1 — trava de publicar sem SWOT (botão + guarda no handler) + geração em publicada sem SWOT, com testes

## Sessions

- `A1 trava-swot` — reviewSwotGate 6 testes; suíte 5499 passed (TZ=UTC); build ok

## Shared Deltas

- `src/version.js` — 1.92.19 consumida
- `docs/registry/versions.md` — marcar 1.92.19 consumida
- `docs/registry/chunks.md` — liberar CHUNK-16
- `CHANGELOG.md` — entrada `[1.92.19]`
- `docs/PROJECT.md` — histórico de versão

## Decisions

- DEC-487-01 — publicar exige SWOT; revisão publicada sem SWOT pode gerar uma vez (sem regenerar)

## Chunks

- CHUNK-16 (escrita) — `WeeklyReviewPage`
- CHUNK-02 (leitura) — card SWOT do aluno
