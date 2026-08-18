# Issue #349 — refactor(tooling): cc-close-issue.sh — 5 gaps

## Autorização

- [x] Mockup — **N/A** (script de processo, sem UI; comportamento descrito no issue body)
- [x] Memória de cálculo — **N/A** (sem fórmula/score/agregação)
- [x] Marcio autorizou — 17/08/2026: "ok, abre e resolve"
- [x] Gate Pré-Código liberado

## Context

Cinco gaps do `scripts/cc-close-issue.sh` observados no encerramento do #347. Três novos
(abort de DEC órfã depois dos deltas; CHANGELOG sem guarda de idempotência; bullets extraídas
da seção errada do PR body) e dois já contornados na mão todo encerramento (PROJECT.md em
`[skip]` silencioso; branch remota órfã). O arquivo tem histórico de regressão em shared file
(#212 corrompeu `registry/versions.md`, #214 duplicou entrada no `version.js`) — mesma classe
que os gaps A e B reintroduzem.

## Spec

Ver issue body no GitHub: #349.

## Phases

- A — cross-check anti-órfão de DEC roda ANTES de qualquer delta
- B — guarda de idempotência no bloco do CHANGELOG
- C — extração de bullets ignora seções de teste/verificação
- D — PROJECT.md vira pendência explícita (passo 3a + passo 7), não `[skip]` silencioso
- E — passo 8 deleta também a branch remota

## Sessions

- `task 01 [A-E] 5 gaps corrigidos — bash -n ok, dry-run e2e contra #347 ok, red test do gate anti-órfão ok`

**Validação executada** (não há suíte bash no repo):
- `bash -n` limpo.
- Dry-run ponta a ponta contra #347 (já encerrado), rodando o script do worktree a partir do main:
  2b reporta `[ok] nenhuma DEC órfã` antes da etapa 3; 3a imprime `[PENDENTE]` do PROJECT.md e o
  passo 7 repete; 3b reporta `[skip] CHANGELOG.md já tem entrada ## [1.83.4]`; passo 8 checa remota.
- Red test do gate anti-órfão: menção forjada `DEC-AUTO-347-04` no CHANGELOG → abort no 2b com
  `git status` mostrando **só** a edição forjada. Antes do fix, o mesmo abort deixava CHANGELOG,
  version.js, versions.md e chunks.md sujos.
- Extração de bullets (C) conferida contra 4 PRs reais: #346 e #342 retornam as bullets de
  mudança; #348 e #344 retornam vazio (as únicas bullets de 1º nível estavam sob `## Testes` e
  `## Validação`) e caem no placeholder — que é o comportamento correto: o script admite que não
  sabe resumir em vez de escrever algo errado com confiança.

## Shared Deltas

Nenhum. Não toca `CHANGELOG.md`, `src/version.js`, `docs/registry/*` nem `docs/PROJECT.md`
(tooling não consome versão de produto — `PR_TYPE=refactor` desliga `TOUCHES_PRODUCT`).

## Decisions

- DEC-AUTO-349-01 — o cross-check anti-órfão de DEC vira passo de validação (2b), antes de qualquer delta, em vez de tornar a etapa 3 transacional com rollback. Resolve o caso real observado (#347) sem refactor de atomicidade.
- DEC-AUTO-349-02 — o script NÃO passa a escrever o parágrafo de encerramento do `docs/PROJECT.md` (prosa densa e específica, sem forma canônica automatizável); em vez disso troca o `[skip]` silencioso por pendência explícita repetida nas verificações finais.

> No encerramento: criar `.deccs-349.md` no main com estas 2 linhas antes de rodar o script
> (o próprio gate 2b vai cobrar).

## Chunks

Nenhum — tooling de processo, fora do mapa de domínios de `docs/chunks.md`. Sem lock.
