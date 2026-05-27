# Issue #267 — bug: Correção de Bugs Táticos

> Guarda-chuva. Escopo final: bugs 1, 2, 6. Desmembrados: bug 3→#275, bug 4→#269, bug 5 retirado (purge de cancelados = decisão futura).

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado + APROVADO (bug 2 — "Todos os ciclos" no dropdown Ciclo; 25/05)
- [x] Memória de cálculo apresentada (bug 1 — MEN/MEP; confirmada 25/05)
- [x] Memória de cálculo apresentada (bug 2 — saldo de abertura transportado/carry-over; 26/05)
- [x] Marcio validou os 3 pontos (26/05): (1) carry-over semântico confirmado — ciclo abre no fechamento do anterior; (2) sub-período (semana/mês) **entra** no escopo; (3) **decidido 3b** (derivado, ancorado em fechamento real) — placeholder-snap (3a) rejeitado
- [x] Marcio autorizou implementação bug 2 (26/05, "ok, 3b")
- [x] Gate Pré-Código liberado (bug 2)
- [x] +cosmético: aumentar altura do campo Observações no modal de entrada (sugestão de aluno; `AddTradeModal.jsx` rows 2→4; 26/05)

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

**bug 2 — saldo de abertura transportado (carry-over) — regra 3b (derivado, ancorado)**
- **Regra única:** `abertura(janela) = último fechamento formal ≤ início da janela (+) Σ result(trades entre esse fechamento e o início da janela)`. Sem fechamento anterior → `account.initialBalance + Σ trades antes da janela`.
- **Por recorte:** Todos os ciclos → `account.initialBalance` (O(1)); Ciclo inteiro → `effectivePL(ciclo)` = `closure.cycleBaseline.plInicial → snapshot.plStart → plan.pl` (O(1), zero soma); Sub-período → `effectivePL(ciclo) + Σ trades do ciclo antes do período` (O(k), k = trades de 1 ciclo).
- **Por que 3b e não placeholder (3a):** ajuste não-trade (aporte/saque) só nasce no ritual de fechamento (`Step6Adjust → adj.newPl`); logo onde não há fechamento, `aporte+Σtrades` é exato; onde há, a âncora do fechamento já captura o ajuste. Placeholder-snap poluiria `cycleClosures` (alimenta inbox do mentor + fila sequencial `useCycleExpiredQueue`) e exigiria escrita nova (INV-15/AP-06). Fechamentos formam prefixo contíguo (fila sequencial) → âncora sempre limpa, sem buraco.
- **Implementação:** elevar `effectivePL` (hoje preso em `PlanLedgerExtract.jsx:153`) → util/hook compartilhado `openingBalance(window)`; alimentar `EquityCurve.buildEquityCurve(trades, initialBalance)` (`EquityCurve.jsx:51`) e `calculateIdealStatus` (`StudentDashboard.jsx:330`) no lugar de `aggregatedInitialBalance` (`StudentDashboard.jsx:613`). Curva ideal já usa `plan.pl` (`equityCurveIdeal.js:49`) → alinha de graça. Sem cache/escrita nova.

**bug 6 — `mentorClearedViolations` não persiste no extrato/gates 4D — diagnóstico C1 (26/05)**
Causa raiz: propagação do cleared (#221) ficou INCOMPLETA. Aplicada à compliance headline (`hasEffectiveRedFlags` no dashboard; `computeCycleBasedComplianceRate`/`complianceRate100`; mirror emocional) mas faltou em 3 superfícies:
1. **Extrato (client)** — `ExtractTable.jsx:169-192` lê `trade.redFlags` + `trade.compliance.roStatus/rrStatus` CRUS (sem `violationFilter`). Mentor limpa → badge NO_STOP/RO/RR continua na tabela.
2. **Gates 4D / compliance (server)** — `preComputeShapes.js:139` `calcComplianceRate` conta red flag cru (`t.hasRedFlags || redFlags.length>0`), ignora cleared. Alimenta o metric `complianceRate` → gates `rule-compliance-80` e `compliance-95` (constants.js:28,40) E a dimensão Operacional (`evaluateMaturity.js:61 computeOperational({complianceRate})`). (`complianceRate100` já respeita.)
3. ~~Gates 4D / execução~~ — **DESCARTADO** (over-scope inicial). Eventos de execução (STOP_TAMPERING/CHASE, #208, de order data) NÃO são limpáveis: mentor só limpa via `onToggleViolation(flag.type)` = entradas de `trade.redFlags` (FeedbackPage:272,296). Sem chave de cleared → nada a propagar; `executionBehaviorMirror` fica como está.
CF wiring OK (`functions/index.js:1541` clearedChanged → `recomputeForStudent`); não é deploy — era métrica crua dentro do recompute. Marcio confirmou (26/05): limpeza é decisão REAL, reflete no 4D. Fix = completar propagação (já existia em complianceRate100/emocional). Emocional (TILT/REVENGE) já respeitado no server mirror. **Mapa de chaves:** chave de cleared = `flag.type` literal (`TRADE_SEM_STOP`/`RISCO_ACIMA_PERMITIDO`/`RR_ABAIXO_MINIMO`; RED_FLAG_TYPES em compliance.js); roStatus/rrStatus co-emitem a red flag (CF index.js:1483-1488).

## Phases
- A1 — bug 1: abortar enrichment quando faltar entryTime/exitTime (remover fallback)
- A2 — bug 1: conversão correta de timezone na janela de busca Yahoo
- A3 — bug 1: testes (massa Yahoo; cases de abort; tz)
- B1 — bug 2: "Todos os ciclos" no dropdown Ciclo (sentinela) + carry-over 3b (util/hook `openingBalance` → EquityCurve + curva ideal)
- B2 — bug 2: testes (openingBalance: todo histórico / ciclo / sub-período; âncora em fechamento; sem fechamento)
- B3 — cosmético: campo Observações `AddTradeModal` rows 2→4 (✅ feito)
- C1 — bug 6: diagnóstico ✅ (2 lacunas reais: extrato client + calcComplianceRate server; execução descartada)
- C2 — bug 6: fix causa raiz + testes ✅ — calcComplianceRate via hasEffectiveRedFlags + ExtractTable via effectiveRedFlags/isViolationCleared

## Sessions
_(log linear; 1 linha por task)_
- A1+A2 [bug1-men-mep-abort-tz] ok — enrichTradeWithExcursions: remove fallback (date/janela-zero) + toBrasiliaISO (naive→UTC-3); suíte 3251 verde
- A3 [bug1-testes] ok — 6 testes novos (abort falta entry/exit; toBrasiliaISO; janela 13:30 UTC não 10:30)
- B1-design [bug2-carryover] discussão — mockup "Todos os ciclos" aprovado; memória de cálculo do saldo de abertura transportado apresentada (curva de ciclo abre em effectivePL = closure.cycleBaseline.plInicial → snapshot.plStart → plan.pl). Achados: EquityCurve recebe aggregatedInitialBalance (StudentDashboard.jsx:613); plan.pl seeded de account.initialBalance (AccountSetupWizard.jsx:166), rola em closeCycle.js:245; curva ideal já usa plan.pl (equityCurveIdeal.js:49) → mismatch visível. 3 validações de Marcio CONCLUÍDAS 26/05 → 3b decidido, sub-período no escopo (ver Autorização + regra na Memória de Cálculo).
- B3 [observacoes-altura] ok — AddTradeModal.jsx:1091 textarea Observações rows 2→4 (sugestão de aluno; cosmético, resize-none mantido).
- B1+B2 [bug2-carryover-impl] ok — openingBalance util (forward-sum 3b) + useDashboardMetrics windowOpeningBalance/cycleOpeningBalance + EquityCurve/corredor ideal + sentinela __ALL__. Commit 891b65f8. +18 testes; suíte 3269 verde.
- C1+C2 [bug6-cleared-4d] ok — diagnóstico (3 superfícies, execução descartada) + fix calcComplianceRate (hasEffectiveRedFlags) + ExtractTable (effectiveRedFlags/isViolationCleared). +5 testes. Marcio confirmou propagar ao 4D.

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
- DEC-AUTO-267-03 — carry-over de patrimônio por forward-sum derivado (3b), não placeholder-snap (3a): abertura = aporte + Σ trades antes da janela + Σ ajuste-não-trade de fechamentos anteriores. Sem escrita nova (INV-15) nem poluição de cycleClosures.
- DEC-AUTO-267-04 — carry-over aplica-se ao caminho single-currency da EquityCurve; modo multi-moeda (tabs, ≥2 moedas) segue usando saldo inicial por moeda (limitação conhecida, fora do escopo do bug report).
- DEC-AUTO-267-05 — mentorClearedViolations propaga ao 4D: calcComplianceRate (server) passa a contar via hasEffectiveRedFlags; extrato (ExtractTable) suprime badges NO_STOP/RO/RR limpos. Limpeza é decisão real de maturidade (confirmado por Marcio), não cosmética. Eventos de execução (#208) ficam fora — não são limpáveis pelo mentor.

## Chunks
- CHUNK-04 (escrita) — bug 1 (CF enrichment) + bug 6 (leitura de trades no extrato)
- CHUNK-13 (escrita) — bug 2 (Context Bar)
- CHUNK-05 (escrita) — bug 6 (compliance/extrato/gates 4D)
- CHUNK-03 (leitura) — bug 1 (plan/instrumento para contexto)
