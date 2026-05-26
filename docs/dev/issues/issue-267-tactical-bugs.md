# Issue #267 — bug: Correção de Bugs Táticos

> Guarda-chuva. Escopo final: bugs 1, 2, 6. Desmembrados: bug 3→#275, bug 4→#269, bug 5 retirado (purge de cancelados = decisão futura).

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado + APROVADO (bug 2 — "Todos os ciclos" no dropdown Ciclo; 25/05)
- [x] Memória de cálculo apresentada (bug 1 — MEN/MEP; confirmada 25/05)
- [~] Memória de cálculo apresentada (bug 2 — saldo de abertura transportado/carry-over; 26/05) **← aguardando Marcio validar 3 pontos** (semântico do carry-over; sub-período no escopo?; validar persistência de `cycleBaseline.plInicial` do #259 antes de B1)
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado (bug 2)

## Context

Bugs táticos de produção que afetam confiança/usabilidade. Três frentes independentes:
- **bug 1** — MEN/MEP calculados errado com dados Yahoo (CF enrichment).
- **bug 2** — Context Bar engessada: obriga Conta+Ciclo+período; falta modo "todo histórico" (ciclo mensal limita visão a ~2 meses).
- **bug 6** — limpeza de compliance via `mentorClearedViolations` (v1.52.0) não persiste no extrato/gates 4D.

## Spec
Ver issue body no GitHub: #267. (Link, não duplicar.)

## Mockup
**bug 2 — pendente.** Modo "todo histórico" destravando obrigatoriedade de Ciclo na Context Bar do dashboard do aluno. A apresentar antes de codar.
bugs 1 e 6 são backend/diagnóstico — sem UI nova.

## Memória de Cálculo

**bug 1 — MEN/MEP (Máxima Exposição Negativa/Positiva) via Yahoo**
- **Premissa:** trade tem `entryTime` e `exitTime`. Faltando qualquer um → **abortar** (`excursionSource: 'unavailable'`), nunca calcular com janela inventada.
- **Inputs:** `trades/{id}.entryTime`, `.exitTime`, `.side` (LONG|SHORT), `.ticker`; barras Yahoo 1m via `fetchYahooBars`.
- **Fórmula** (já correta em `functions/marketData/computeExcursionFromBars.js`): janela [entryTime, exitTime] → `LONG: MEP=max(high), MEN=min(low)`; `SHORT: MEP=min(low), MEN=max(high)`.
- **Causa raiz (2 pontos a montante):**
  1. `enrichTradeWithExcursions.js:66-67` faz fallback `from = entryTime || date` / `to = exitTime || entryTime` → janela errada/duração-zero em vez de abortar.
  2. `fetchYahooBars.js` / `toUnixSeconds`: timezone — `entryTime`/`exitTime` precisam refletir o horário real do trade do aluno; string sem offset lida como UTC desloca a janela e produz min/max de minutos errados (silencioso).
- **Correção:** abortar quando faltar horário + converter timezone corretamente. Não cravar "qual dos dois" — ambos entram (decisão de Marcio 25/05).

## Phases
- A1 — bug 1: abortar enrichment quando faltar entryTime/exitTime (remover fallback)
- A2 — bug 1: conversão correta de timezone na janela de busca Yahoo
- A3 — bug 1: testes (massa Yahoo; cases de abort; tz)
- B1 — bug 2: mockup modo "todo histórico" (aprovação) → implementação
- B2 — bug 2: testes
- C1 — bug 6: diagnóstico (hook leitura do extrato vs CF recomputeForStudent/onTradeUpdated)
- C2 — bug 6: fix causa raiz + testes

## Sessions
_(log linear; 1 linha por task)_
- A1+A2 [bug1-men-mep-abort-tz] ok — enrichTradeWithExcursions: remove fallback (date/janela-zero) + toBrasiliaISO (naive→UTC-3); suíte 3251 verde
- A3 [bug1-testes] ok — 6 testes novos (abort falta entry/exit; toBrasiliaISO; janela 13:30 UTC não 10:30)
- B1-design [bug2-carryover] discussão — mockup "Todos os ciclos" aprovado; memória de cálculo do saldo de abertura transportado apresentada (curva de ciclo abre em effectivePL = closure.cycleBaseline.plInicial → snapshot.plStart → plan.pl). Achados: EquityCurve recebe aggregatedInitialBalance (StudentDashboard.jsx:613); plan.pl seeded de account.initialBalance (AccountSetupWizard.jsx:166), rola em closeCycle.js:245; curva ideal já usa plan.pl (equityCurveIdeal.js:49) → mismatch visível. Aguardando 3 validações de Marcio (ver Autorização).

## Shared Deltas
- `src/version.js` — bump v1.65.0
- `docs/registry/versions.md` — marcar v1.65.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04/13/05
- `CHANGELOG.md` — nova entrada `[1.65.0] - DD/MM/2026`
- `docs/PROJECT.md` — avaliar nota no encerramento (se houver mudança de contrato)

## Decisions
_(apenas IDs — texto em docs/decisions.md, formalizar no encerramento)_
- DEC-AUTO-267-01 — entryTime/exitTime naive interpretados como America/Sao_Paulo (UTC-3 fixo, Brasil sem DST desde 2019); strings com offset/Z respeitadas
- DEC-AUTO-267-02 — enrichment aborta (unavailable) quando falta entryTime OU exitTime; sem fallback pra trade.date

## Chunks
- CHUNK-04 (escrita) — bug 1 (CF enrichment) + bug 6 (leitura de trades no extrato)
- CHUNK-13 (escrita) — bug 2 (Context Bar)
- CHUNK-05 (escrita) — bug 6 (compliance/extrato/gates 4D)
- CHUNK-03 (leitura) — bug 1 (plan/instrumento para contexto)
