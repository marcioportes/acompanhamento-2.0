# Issue #302 — fix: hard seal #259 isenta feedback do mentor em ciclo fechado

> Template enxuto (R4). Fix de regra Firestore — sem UI nova.

## Autorização

**Status atual do documento:**
- [x] Mockup — N/A (fix de regra, sem UI)
- [x] Memória de cálculo — N/A (sem fórmula; lógica de allowlist abaixo)
- [x] Marcio autorizou — 01/06/2026: decisão de produto "Sim — feedback sempre liberado" (mentor revisa/classifica trade em qualquer estado de ciclo)
- [x] Gate Pré-Código liberado

## Context

Feedback em massa do mentor (`MentorDashboard`) falha com `permission-denied`. Regressão da v1.64.0 (#259): o hard seal `isTradeDateNotSealed(planId, date)` foi aplicado a TODO update de `/trades`, travando a revisão do mentor quando o trade está em ciclo fechado (caso A) ou quando o plano foi deletado e `get().data` quebra (caso B). Falha visível no bulk porque `writeBatch` é atômico — um trade selado/órfão derruba o lote inteiro.

## Spec

Ver issue body no GitHub: #302.

## Lógica do fix (allowlist)

Regra de update de `/trades` em `firestore.rules`. Hoje (linha 146):

```
&& isTradeDateNotSealed(resource.data.planId, resource.data.date)
```

Passa a:

```
&& (
  isTradeDateNotSealed(resource.data.planId, resource.data.date) ||
  ( isMentor() &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'mentorFeedback','feedbackDate','feedbackHistory','status','updatedAt',
      'mentorClassification','mentorClassificationFlags','mentorClassificationReason',
      'mentorClassifiedAt','mentorClassifiedBy','mentorClearedViolations'
    ])
  )
)
```

**Por que `hasOnly`:** quando o ÚNICO delta é metadado de revisão do mentor, o seal é dispensado — não chama `get()` (resolve caso B, plano órfão) e libera revisão em ciclo fechado (caso A). Se o diff tocar qualquer campo financeiro/comportamental, cai no ramo `isTradeDateNotSealed` e o seal volta a valer.

**Allowlist derivada de:** campos escritos por `addBulkFeedback`/`addFeedback` (feedback) + #219 classificação (`mentorClassification*`) + #221 `mentorClearedViolations`. Confere com a allowlist do bloco aluno-readonly (rules:138-142) — mesmos campos mentor-only.

## Phases
- A1 — Editar `firestore.rules` (isenção mentor no seal de update /trades)
- A2 — Testes de rules (mentor feedback em ciclo selado passa; aluno bloqueado; edição financeira em ciclo selado bloqueada)
- A3 — Deploy rules + smoke bulk feedback

## Sessions
- _(a preencher)_

## Shared Deltas
- `src/version.js` — bump v1.72.1 (aplicar no fechamento; main está em 1.73.0 por #301 — não rebaixar antes do merge)
- `docs/registry/versions.md` — marcar v1.72.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04
- `CHANGELOG.md` — nova entrada `[1.72.1] - 01/06/2026`

## Decisions
- DEC-AUTO-302-01 — feedback/classificação do mentor isento do hard seal #259 (decisão de produto Marcio 01/06/2026)

## Chunks
- CHUNK-04 (escrita) — regra Firestore de `/trades`
- CHUNK-08 (leitura) — contexto do fluxo de feedback do mentor
