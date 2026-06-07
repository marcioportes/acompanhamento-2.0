# Issue #308 — feat: Auto-revisão de trade (questionário processo × resultado)

> Template enxuto (R4). Plano: `~/.claude/plans/groovy-roaming-raven.md`. Staging: `Temp/auto-revisao-trade-staging.md`.

## Autorização (OBRIGATÓRIA)

**Status atual do documento:**
- [x] Mockup apresentado
- [x] Memória de cálculo apresentada
- [x] Marcio autorizou — 07/06/2026: "nomes OK, perguntas OK, libera o campo. abre a issue"
- [x] Gate Pré-Código liberado

## Context

Auto-revisão por trade para o aluno: questionário curto ancorado no `trader_evolution_framework.md`
que separa **processo** de **resultado** ("tomei um trade que não faria de novo"). Gera consciência
para o aluno e contexto interpretativo para o mentor. **Não mexe no score 4D.** Campos preparados
para o futuro feedback IA autônomo (esta issue entrega só a camada determinística — o espelho).

## Spec

Ver issue body no GitHub: #308.

## Mockup

Renderizado no detalhe do trade (`TradeDetailModal`), perto do `BehaviorPanel`.

**Estado A — não revisado** (trade com `result` e sem `selfReview`):
```
┌ Auto-revisão ────────────────────────────────┐
│ Este trade ainda não foi revisado.            │
│ [ Revisar agora ]   [ depois ]                │
└───────────────────────────────────────────────┘
```

**Estado B — fluxo (após "Revisar agora")**: resultado é automático por `sign(result)`.
```
┌ Auto-revisão · RESULTADO: GANHO (verde) / PERDA (vermelho) ┐
│ Faria de novo sem saber o resultado?  ( SIM )  ( NÃO )     │
│ ── (após escolher, revela o quadrante) ──                 │
│ [O] O que refina ainda mais a execução deste setup?       │
│     [textarea]                                            │
│ [F] Havia espaço para gerir melhor o ganho (sizing/saída)?│
│     [textarea]                                            │
│ [M] O que torna este trade replicável?                    │
│     [textarea]                                            │
│                         [ Cancelar ]  [ Salvar revisão ]  │
└───────────────────────────────────────────────────────────┘
```
Quadrante = f(sign(result), wouldRepeat): GANHO+SIM=good_win · GANHO+NÃO=bad_win ·
PERDA+SIM=good_loss · PERDA+NÃO=bad_loss. Badges de dimensão [E/F/O/M] por pergunta.

**Estado C — revisado** (read-only + confronto declarado×detectado):
```
┌ Auto-revisão · GANHO · "Faria de novo: SIM" ──────────────┐
│ [O] refina execução? → "<resposta>"                       │
│ [F] geriu melhor?    → "<resposta>"                       │
│ [M] replicável?      → "<resposta>"                       │
│ ┌ Espelho ───────────────────────────────────────────┐   │
│ │ ⚠ DESALINHADO — você aprovaria, mas a execução      │   │
│ │   sugere um furo grave (revenge). Ponto cego?       │   │
│ └─────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```
Banner do confronto: emerald=ALIGNED · amber=ATTENTION · red=MISALIGNED (reusa estética `behaviorDisplay`).
Imutável após `DISCUSSED` (#269).

## Memória de Cálculo

**Inputs**: `trade.result` (number), `trade.selfReview.wouldRepeat` (bool),
`trade.behaviorProfile.families[]` (já persistido por CHUNK-11).

**Classificação derivada** (não persistida):
```
outcome = trade.result > 0 ? 'win' : 'loss'
quadrant = `${wouldRepeat ? 'good' : 'bad'}_${outcome}`
// good_win | bad_win | good_loss | bad_loss
```

**Confronto declarado × detectado** (não persistido no MVP):
- `declared` = wouldRepeat (SIM=aprova / NÃO=reprova).
- `detected` = severidade do padrão negativo dominante (reusa `dominantNegativeFamily`); CLEAN se nenhum.

| wouldRepeat | CLEAN | LOW | MEDIUM | HIGH |
|---|---|---|---|---|
| SIM | ALIGNED | ALIGNED | ATTENTION | MISALIGNED |
| NÃO | ATTENTION | ALIGNED | ALIGNED | ALIGNED |

Casos limites: sem `behaviorProfile` → detected=CLEAN. Sem `wouldRepeat` → sem confronto (estado A).
`result` ausente/zero → trata como loss (`<=0`); nudge só aparece com trade fechado/com result.

**Exemplo** (massa-301): win + SIM + família dominante HIGH (LOSS_CHASING) → MISALIGNED.
loss + NÃO + nenhuma família negativa → ATTENTION (viés de resultado).

## Phases

- A1 — testes do helper `tradeReviewConfront` (8 células + classificação) — INV-05
- A2 — `src/constants/tradeReviewFramework.js` (catálogo SSoT) + `src/utils/tradeReviewConfront.js` (puro)
- A3 — gateway `submitTradeReview` em `tradeGateway.js` (INV-02) + teste
- A4 — `firestore.rules`: `selfReview` gravável só pelo aluno dono; imutável após DISCUSSED
- B1 — `TradeReviewSection.jsx` + nudge/integração no `TradeDetailModal.jsx`
- B2 — reconciliação #269: nota em `Temp/spec-269.md` (vocabulário + slot da auto-revisão)

## Sessions

_(log)_

## Shared Deltas

- `src/version.js` — bump v1.75.0
- `docs/registry/versions.md` — marcar v1.75.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04
- `CHANGELOG.md` — nova entrada `[1.75.0]`
- `docs/firestore-schema.md` — campo `trade.selfReview`
- `docs/PROJECT.md` — versão + histórico

## Decisions

- DEC-AUTO-308-01 — `trade.selfReview` inline (não subcollection); classificação/confronto derivados não persistidos
- DEC-AUTO-308-02 — vocabulário "Auto-revisão" (aluno, `selfReview`) × "Revisão" (mentor, `reviewState` #269)

## Chunks

- CHUNK-04 (escrita) — campo `trade.selfReview`, gateway `submitTradeReview`, firestore.rules
- CHUNK-06 / CHUNK-08 / CHUNK-11 (leitura) — reuso do confronto/painel comportamental e display
