# Issue #221 — feat: Mentor limpa violações (compliance + emocional) — Phase B de #218

## Autorização

- [x] Spec aprovada como parte do plano #218 (mockup + memória de cálculo)
- [x] INV-15: campo Firestore novo `mentorClearedViolations` aprovado por Marcio (DEC-AUTO-218 — "se eu mudei, é lei dentro de v1")
- [x] Marcio autorizou: "encerrar e seguir" (01/05/2026, após merge #220)
- [x] Gate Pré-Código liberado

## Context

Compliance e detecções emocionais hoje são determinísticas. STOP de R$ 1.005 num RO de R$ 1.000 (0,5% acima) é flagrado. Mentor entende contexto, sistema não. Bandas automáticas rejeitadas. Solução: mentor toggle = lei dentro de v1. Sem audit metadata (sem reason, sem timestamp).

Aluno read-only — vê chip "limpo pelo mentor" mas não toca.

## Spec

Ver issue body no GitHub: #221.

## Memória de Cálculo

```
isViolationCleared(trade, key) = (trade.mentorClearedViolations || []).includes(key)

effectiveRedFlags(trade) =
  (trade.redFlags || []).filter(f => !isViolationCleared(trade, f.type))

effectiveEmotionalEvents(trade) =
  (trade.emotionalEvents || []).filter(e => !isViolationCleared(trade, getEventKey(e)))

getEventKey(event) = `${event.type}:${event.timestamp}`
```

**Exemplo numérico**: trade T1 com redFlags=[{type:'NO_STOP'}, {type:'RR_BELOW_MINIMUM'}] e mentorClearedViolations=['NO_STOP'] →
- effectiveRedFlags(T1) = [{type:'RR_BELOW_MINIMUM'}]
- complianceRate em 10 trades, T1 com 1 violation cleared: antes (1 violador) 90% → após clear (0 violadores) 100%.

**Reverter**: arrayRemove('NO_STOP') de mentorClearedViolations → effectiveRedFlags volta a 2 → complianceRate volta a 90%.

## Schema (INV-15 aprovada)

| Campo | Tipo | Default |
|---|---|---|
| `mentorClearedViolations` | `string[]` | `[]` (não setado = vazio) |

Chaves possíveis:
- Compliance: `NO_STOP`, `RR_BELOW_MINIMUM`, `RISK_EXCEEDED`, `DAILY_LOSS_EXCEEDED`, `BLOCKED_EMOTION`
- Emocional: `${eventType}:${eventTimestamp}` (ex.: `TILT:2026-04-15T10:30:00Z`)

## Phases

- B1 — Helper puro `violationFilter.js` (ESM) + mirror CJS + 6 testes do helper
- B2 — Gateway `toggleViolationClearedAsMentor` + 5 testes
- B3 — Aplicar `effective*` nos 6 consumidores (hooks/utils + mirrors)
- B4 — UI mentor: chip `✕ Limpar` em ExtractEvents + bloco "Limpas" em FeedbackPage + tooltip TradesList + badge ExtractTable
- B5 — `firestore.rules` allowlist mentor-only para `mentorClearedViolations`
- B6 — CF trigger `onTradeUpdated` detecta mudança no array → invoca pipeline `recomputeStudentMaturity`
- B7 — Verificação smoke local + suite full

## Sessions

_(preenchido durante implementação)_

## Shared Deltas

- `src/version.js` — entrada 1.52.0 mantida (já reservada na abertura)
- `docs/registry/versions.md` — marcar 1.52.0 consumida no encerramento
- `docs/registry/chunks.md` — liberar CHUNK-04 + 05 + 06 + 08 no encerramento
- `CHANGELOG.md` — nova entrada `[1.52.0] - 01/05/2026`
- `docs/firestore-schema.md` — documentar `mentorClearedViolations` em trades/{id}

## Decisions

- DEC-AUTO-221-01: chave compliance = código; chave emocional = `${type}:${timestamp}`
- DEC-AUTO-221-02: sem audit metadata (sem reason/clearedAt/clearedBy) — refactor trivial pra `Array<{key,reason?}>` se necessário no futuro
- DEC-AUTO-221-03: detectores (detectTilt/detectRevenge) NÃO re-rodam sobre sequência ajustada — agregação filtra eventos cleared via EVENT_PENALTIES, mas detectores leem sequência crua
- DEC-AUTO-221-04: re-enrich (CSV/Order Import) preserva `mentorClearedViolations` (campo é do mentor, não do broker)

## Chunks

- CHUNK-04 (escrita) — Trade Ledger / gateway / hooks
- CHUNK-05 (escrita) — Compliance / complianceRate
- CHUNK-06 (escrita) — Emotional / emotionalAnalysisV2 + mirror
- CHUNK-08 (escrita) — Mentor Feedback / FeedbackPage + ExtractEvents
