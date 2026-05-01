# Issue #219 — feat: mentor classifica trade — técnico ou sorte

## Autorização

**Status:**
- [x] Mockup apresentado (na sessão de plano — radio binário Técnico/Sorte + chips condicionais + textarea)
- [x] Memória de cálculo apresentada (% técnico/sorte sobre trades classificados; exemplo 41/59)
- [x] Marcio autorizou ("Confirmo" — 01/05/2026, sessão de planejamento + epic #218)
- [x] Gate Pré-Código liberado

## Context

Mentor precisa registrar julgamento qualitativo por trade — foi técnico (seguiu modelo) ou sorte (narrativa solta, sizing fora do plano, alucinação). Sistema não infere. Resultado vira KPI diagnóstico (% técnico vs % sorte) que sinaliza inconsistência operacional do aluno. Maturity v1 NÃO consome; é diagnóstico v1, governance defer v2.

## Spec

GitHub #219. Épico #218.

## Mockup

**MentorClassificationPanel (TradeDetailModal seção mentor, abaixo de MentorEditPanel)**

Collapsed:
```
[icon] Classificação do trade (mentor)        [▼ expandir]
       — não classificado  /  Técnico  /  Sorte
```

Expanded:
```
○ Técnico    ○ Sorte    [já marcado: <valor>]

Se Sorte → chips multi-select:
  □ narrativa solta   □ sizing fora do plano   □ desvio do modelo   □ outro

Motivo (opcional):
  [textarea ~3 linhas]

[Salvar]  [Cancelar]
```

Aluno: mesmo painel, read-only (sem radios, sem chips clicáveis, sem botões — só leitura).

**MentorClassificationCard (StudentDashboard)**

```
┌─ Qualidade técnica do período ─────────────┐
│  41% técnico  ·  59% sorte                  │
│  (98 de 100 trades classificados)           │
│                                             │
│  Fatores em sorte:                          │
│    narrativa solta   30                     │
│    sizing fora        18                    │
│    desvio modelo       8                    │
│    outro               3                    │
└─────────────────────────────────────────────┘
```

Filtrado pelo ContextBar (período + plano + ciclo).

**SetupAnalysis luckRate**

Tooltip ou linha extra por setup: `luckRate: 67% (8/12)`. Visual: cor neutra; cor amber se >50%, red se >70%.

## Memória de Cálculo

**Inputs**:
- `trades/{id}.mentorClassification` — `'tecnico' | 'sorte' | null`
- `trades/{id}.mentorClassificationFlags` — `string[]`, valores em `['narrativa', 'sizing', 'desvio_modelo', 'outro']`
- ContextBar fornece filtro de período/plano/ciclo (já existe no `StudentContextProvider`)

**Fórmula** (KPI dashboard):
```
classified = trades.filter(t => t.mentorClassification != null)
total      = classified.length
tecnico    = classified.filter(t => t.mentorClassification === 'tecnico').length
sorte      = classified.filter(t => t.mentorClassification === 'sorte').length
pctTecnico = total === 0 ? null : tecnico / total * 100
pctSorte   = total === 0 ? null : sorte / total * 100
flagsRanking = countBy(flatMap(classified.filter(sorte), .mentorClassificationFlags))
              .sort desc
```

**Casos limites**:
- 0 trades classificados → mostrar "Aguardando classificação do mentor" (não mostrar 0% / 0%, vira ruído).
- Trades classificados como `tecnico` têm flags vazio (validação no gateway). Não entram no flagsRanking.
- Aluno em onboarding/sem trades → card não renderiza (return null).
- ContextBar filter sem trades → mesma mensagem "Aguardando classificação".

**Exemplo numérico**: 100 trades no período, 98 classificados, 41 técnico + 57 sorte (mais 2 que faltou contar = ajusta), flags em sorte: narrativa(30), sizing(18), desvio_modelo(8), outro(3). pctTecnico=41.8%, pctSorte=58.2%.

**luckRate por setup** (`evaluateSetup`):
```
classifiedInSetup = trades.filter(t => t.setup === setupName && t.mentorClassification != null)
luckCount = classifiedInSetup.filter(t => t.mentorClassification === 'sorte').length
luckRate  = classifiedInSetup.length === 0 ? null : luckCount / classifiedInSetup.length
```

## Phases

- A1 — schema + gateway `classifyTradeAsMentor` + testes unitários
- A2 — firestore.rules allowlist mentor-only para os 5 campos
- A3 — `MentorClassificationPanel` componente + montagem em `TradeDetailModal`
- A4 — `MentorClassificationCard` componente + montagem em `StudentDashboard`
- A5 — `setupAnalysisV2.evaluateSetup` luckRate + UI tooltip/cor em `SetupAnalysis`
- A6 — testes integração (gateway aceita mentor; rejeita aluno; flags só em sorte; card 41/59)
- A7 — smoke local + PR

## Sessions

_(será preenchido conforme commits)_

## Shared Deltas

(Aplicados no main pelo `cc-close-issue.sh` no encerramento. Worktree não toca.)

- `src/version.js` — bump 1.49.1 → 1.50.0; remoção da tag [RESERVADA] na entrada longa
- `docs/registry/versions.md` — marcar v1.50.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04 + CHUNK-08
- `CHANGELOG.md` — entrada `[1.50.0] - 01/05/2026` (resumo via PR body)

## Decisions

Registrar no `docs/decisions.md` no encerramento:
- DEC-XXX-219-01 — Classificação é discricionária; sistema não infere.
- DEC-XXX-219-02 — Classificação NÃO entra em maturity engine v1 (defer v2).
- DEC-XXX-219-03 — Aluno read-only nos 5 campos mentor (rules-enforced).

## Chunks

- CHUNK-04 (Trade Ledger) — escrita: 5 campos novos no documento `trades/{id}`
- CHUNK-08 (Mentor Feedback) — escrita: novo painel `MentorClassificationPanel` na seção mentor do `TradeDetailModal`
