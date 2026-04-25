# Issue #189 — feat: score emocional real no motor de maturidade

**Branch:** `feat/issue-189-emotional-engine-real`
**Worktree:** `~/projects/issue-189`
**Versão reservada:** v1.46.0
**Chunks:** CHUNK-09 (escrita) · CHUNK-06 (leitura — mirror)
**Modo:** interativo

## Autorização

- [x] Mockup pulado — UI já existe (`MaturityProgressionCard` de #119 D13). Marcio confirmou em sessão 25/04: "a resposta da engine emocional está no documento supracitado. Siga."
- [x] Memória de cálculo pulada — fórmula é DEC-AUTO-119-03 já aprovada em 23/04/2026 (issue-119 §3.1 D3).
- [x] Marcio autorizou em 25/04/2026: "Siga."
- [x] Gate Pré-Código liberado.

## Context

Stub explícito em `functions/maturity/preComputeShapes.js:129` foi declarado como TODO em `DEC-AUTO-119-task07-02` durante a entrega de #119:

```js
// Stubs neutros (DEC-AUTO-119-task07-02): aguardam mirror dedicado.
const emotionalAnalysis = { periodScore: 50, tiltCount: 0, revengeCount: 0 };
```

Resultado: dimensão emocional do motor de maturidade trava em 50/100 fixo, gates emocionais (`emotional-out-of-fragile`, `emotional-55`, `emotional-75`, `emotional-85`, `zero-tilt-revenge`) não discriminam, aluno não evolui em E. Furo universal — bloqueia promoção em todos os stages.

Engine V2 que produz números reais já existe em `src/utils/emotionalAnalysisV2.js` (ESM). Falta mirror CommonJS para `functions/maturity/` (mesmo padrão de `computeCycleBasedComplianceRate` em #191).

## Spec

Issue body no GitHub: #189. Decisões já fechadas:

- **Fórmula** — issue-119 §3.1 D3 + DEC-AUTO-119-03: `E = 0.60·periodScore + 0.25·invTilt(0,0.30) + 0.15·invRevenge(0,0.20)`.
- **Janela** — issue-119 §3.1 D1 STAGE_WINDOWS rolling (Stage 1=20/30, 2=30/45, 3=50/60, 4=80/90, 5=100/90; floor 5).
- **Fallback** — issue-119 §3.1 D6 "evolução sempre visível": NUNCA null. `N=0` ou `periodScore` ausente → `NEUTRAL_SCORE=50` com `neutralFallback: 'emotional:periodScore'`. `tiltCount/revengeCount` ausentes → tratar como 0.
- **Inputs** — `calculatePeriodScore(W, getEmotionConfig, complianceEvents)` retorna `{ score }` (0-100). `detectTiltV2(W, getEmotionConfig, config)` retorna `{ totalTiltTrades }`. `detectRevengeV2(W, getEmotionConfig, config)` retorna `{ count }`.

Nada novo a decidir.

## Phases

- **A1** Mirror `functions/maturity/emotionalAnalysisMirror.js` (CommonJS) com `calculatePeriodScore`, `detectTiltV2`, `detectRevengeV2`, `calculateTradeEmotionalScore`, `EVENT_PENALTIES`, `DEFAULT_DETECTION_CONFIG` + helpers de ordenação/intervalo. Estritamente equivalente ao ESM source. Testes paridade ESM↔CommonJS (mesmo padrão #191).
- **A2** Mirror tabela de emoções (`getEmotionConfig`) — vem de `useMasterData` (ESM/Firestore). Decidir entre: (a) injetar como parâmetro do `preComputeShapes` (CF carrega da `master_data` collection antes de chamar) ou (b) snapshot estático no mirror. Preferência: (a) — carrega 1× por trigger, evita drift.
- **A3** Substituir stub em `preComputeShapes.js:129` por chamada real ao mirror. Atualizar shape `emotionalAnalysis` para `{ periodScore, tiltCount, revengeCount }` derivado dos retornos. Preservar fallback `{ 50, 0, 0 }` quando inputs ausentes (D6).
- **A4** Testes integração no engine (`recomputeMaturity`): aluno com 30 trades em emoção POSITIVE → `E > 70`; aluno com sequência de tilt → `E < 50`; aluno legado sem `emotionEntry` → `E = 50` com `neutralFallback`.
- **A5** Validação browser: aluno teste com trades reais; `MaturityProgressionCard` deve mostrar barra emocional não-50.
- **A6** Encerramento §4.3: bump v1.46.0 consumida + entrada CHANGELOG + PROJECT.md + liberar lock CHUNK-09 + remover worktree.

## Sessions

- 25/04/2026 — abertura: lock CHUNK-09 + reserva v1.46.0 (commit `8a26b45e` no main) + worktree + doc de controle (commit `39c679d7`)
- 25/04/2026 — A1+A2+A3 mirror `emotionalAnalysisMirror.js` + wire `preComputeShapes` + carga `emotions` em `recomputeForStudent` (commit `50bdc1e5`); 17 testes paridade ESM↔CJS; suite 2438/2438 verde
- 25/04/2026 — review contra framework + §3.1 D1-D18: aderência total, sem bloqueadores; follow-ups documentados (calculatePeriodScore([])=100 vs D6, aluno legado sem emotionEntry pega E≈60, cache de `emotions` no CF runtime)
- 25/04/2026 — Marcio testou no browser, autorizou encerramento

## Shared Deltas

- `src/version.js` — VERSION export 1.44.1 → 1.46.0 + finalizar entrada CHANGELOG header
- `docs/registry/versions.md` — marcar 1.46.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-09
- `docs/PROJECT.md` — entrada §10 v1.46.0 (encerramento)
- `CHANGELOG.md` — `[1.46.0] - 25/04/2026`

## Decisions

_(IDs DEC-AUTO-189-NN conforme surgem; rationale em `docs/decisions.md`)_

## Chunks

- CHUNK-09 (escrita) — `functions/maturity/emotionalAnalysisMirror.js` novo + `preComputeShapes.js` editado
- CHUNK-06 (leitura) — `src/utils/emotionalAnalysisV2.js` é fonte de verdade do mirror; coexiste com lock write de #188 (#188 não toca esses arquivos pelo que apurei na abertura — confirmar no encerramento se houver overlap)

## Pointers de implementação

- Source ESM: `src/utils/emotionalAnalysisV2.js:188` (`calculatePeriodScore`), `:241` (`detectTiltV2`), `:325` (`detectRevengeV2`)
- Stub a remover: `functions/maturity/preComputeShapes.js:129`
- Caller que consome shape: `src/utils/maturityEngine/computeEmotional.js:56`
- Padrão de mirror ESM↔CommonJS: ver #191 `computeCycleBasedComplianceRate.js` + testes de paridade
