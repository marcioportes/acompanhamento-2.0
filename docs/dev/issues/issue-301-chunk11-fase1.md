# Issue #301 — feat: CHUNK-11 Fase 1 (motor unificado dark/compat)

## Autorização
- [x] Plano do épico aprovado (valiant-doodling-sunrise); Fase 0 mergeada (PR #300)
- [x] Gate Pré-Código liberado (dark — nada plugado em produção)

## Context
Constrói `detectBehavior` (motor único) reusando os detectores existentes, emitindo código canônico + legado (dual-emit). Deve reproduzir os 4 caminhos atuais e passar o baseline (#299) + paridade ESM≡CJS. Zero consumidor novo em produção.

## Spec
Ver #301 + Epic #298. Taxonomia: `src/constants/behavioralTaxonomy.js` (Fase 0).

## Phases (desta issue)
- A1 — `src/utils/behavioralDetection/index.js`: `detectBehavior` — caminho `events` (wrap `detectExecutionEvents` → canônico+legacyCode), guardado pelo baseline #299
- A2 — `byTrade` (wrap `analyzeShadowForTrade`) + `aggregates` (scoreInputs/gateInputs/byFamily)
- A3 — mirror CJS `functions/maturity/behavioralDetectionMirror.js` + teste de paridade
- A4 — baseline #299 inalterado; suíte + build verdes; nada plugado

## Sessions
- `A1 [events dual-emit] commit 64488685 ok` — wrap detectExecutionEvents, baseline #299 intacto (5 testes)
- `A2 [byTrade+aggregates] commit 3c52320f ok` — shadow ESM-only + scoreInputs/byFamily/gateInputs; dedupeByFamily puro testado (13 testes)
- `A3 [mirror CJS + paridade] commit d988536e ok` — behavioralDetectionMirror (events+scoreInputs+dedupe); paridade ESM≡CJS (6 testes)
- `A4 [verificação] ok` — suíte 3378/3378, build verde, baseline #299 intacto, motor dark (zero consumidor de produção)

## Shared Deltas
- src/version.js — v1.73.0 (reservada no main)
- docs/registry/versions.md — consumir v1.73.0 (encerramento)
- docs/registry/chunks.md — liberar CHUNK-11 (encerramento)
- CHANGELOG.md — entrada [1.73.0]

## Decisions
- DEC-AUTO-301-01 — shadow (byTrade) é ESM-only; sem mirror CJS (maturidade server-side não consome shadow per-trade). Paridade ESM≡CJS cobre só a superfície compartilhada (events + scoreInputs). Aprovado por Marcio 01/06/2026.
- DEC-AUTO-301-02 — byFamily colapsa por (tradeId, family); precedência DEC-074 (maior resolutionLayer; empate→events). Confirmado por Marcio 01/06/2026.
- DEC-AUTO-301-03 — gateInputs é sinal de gate UNIFICADO (execução+shadow+emocional): tilt/revenge emocional dobram em TILT/LOSS_CHASING; gate cruza por FAMÍLIA (membro não-gate aciona família gate, ex. IMPULSE_CLUSTER→OVERTRADING). Confirmado por Marcio 02/06/2026.

## Fase 2 — Ativação + UX + Confronto Emocional (incorporada ao #301)

### Phases
- B1 — `functions/behavior/buildBehaviorProfile.js` (fusão mirror+shadow, puro) + extração DRY `functions/shadow/shadowDetectors.js`
- B2 — ativação automática on-create/on-update (`recomputeForStudent`); anti-loop (campo fora do guard) + fingerprint
- B3 — on-plan-change (`recalculateCompliance`) + botão de backfill (callable `analyzeShadowBehavior` sobrescreve legados)
- C — UX consolidada `BehaviorPanel` (3 blocos + cor por severidade + slot do mentor); aposenta Shadow/ExecutionPatterns/redFlags inline
- C2 — narrativa semântica por finding; estado vazio (não-calculado vs limpo vs alinhado)
- C3 — Confronto Emocional (declarada × execução, matriz aprovada) `behaviorProfile.emotionConfront`

### Sessions
- `B1 commit ec5d19ec ok` — buildBehaviorProfile + shadowDetectors; 8 testes
- `B2 commit cbe3fdc0 ok` — recomputeBehaviorProfiles + wire; 5 testes; maturidade 107/107 intacta
- `B3 commit de9a222b ok` — recomputeBehaviorForStudent + backfill; 2 testes
- `C commit ef137974 ok` — BehaviorPanel + behaviorDisplay; 8 render tests; suíte 3404/3404
- `C2 commits 8638f282/af0ef741/59669d0e ok` — narrativa + estado vazio desacoplado
- `C3 commit 87dccd5a ok` — Confronto Emocional; matriz 7 + UI 3 testes
- Smoke prod: 4 CFs deployadas; `analyzeShadowBehavior` grava behaviorProfile+emotionConfront sem erro (log 14:50)

### Shared Deltas (Fase 2)
- docs/registry/chunks.md — somados CHUNK-04 + CHUNK-08 (ESCRITA); liberar no encerramento
- docs/decisions.md — DEC-AUTO-301-04 (campo behaviorProfile inline)
- docs/firestore-schema.md — campo `behaviorProfile` (feito na abertura)

### Decisions (Fase 2)
- DEC-AUTO-301-04 — campo inline `trade.behaviorProfile` (opção A; aluno read; INV-15 aprovado). Já em decisions.md (main).
- DEC-AUTO-301-05 — Confronto Emocional: matriz categoria-declarada × severidade-detectada → ALIGNED/ATTENTION/MISALIGNED/NO_DECLARED; tom espelho (não acusação); aluno vê tudo. Aprovado por Marcio 04/06/2026.

## Chunks
- CHUNK-11 (escrita) · CHUNK-04 (escrita) · CHUNK-08 (escrita) · CHUNK-06/03 (leitura)
