# Issue 052 — epic: Gestao de Contas em Mesas Proprietarias (Prop Firms)
> **Branch:** `feature/issue-052-prop-firms`  
> **Milestone:** v1.1.0 — Espelho Self-Service  
> **Aberto em:** 01/03/2026  
> **Status:** 🔵 Em andamento  
> **Versao entregue:** —

---

## 1. CONTEXTO

Muitos alunos operam em mesas proprietarias (prop firms). Cada mesa tem regras proprias de drawdown, profit target, consistencia e payout. O sistema atual trata todas as contas como genericas — nao ha mecanismo para monitorar compliance com as regras da mesa, calcular drawdown trailing/EOD, ou alertar quando o trader esta proximo de violar limites.

**Revisao v2.0 (03/04/2026):** Apex reformulou regras significativamente em marco 2026. Secao de pesquisa no body do issue do GitHub (#52) documenta o comparativo completo e changelog de regras.

**Revisao v3.0 (05/04/2026):** Discussao com sessao master (Opus 4.6) definiu modelo semantico completo, plano de ataque personalizado, 3 camadas de alerta, e decisoes de persistencia.

### Modelo semantico — 3 camadas

**Camada 1 — Template (regras da mesa):**
`propFirmTemplates` e um catalogo. Nao muda por aluno. Cada template define: tipo de drawdown, limites, instrumentos, prazos. O mentor seleciona ao vincular uma conta. Entidade independente — collection raiz (diferente de subscriptions que e dependente).

**Camada 2 — Instancia (conta do aluno):**
Campo `propFirm` na account e a instancia — o template aplicado aquela conta especifica, com o estado runtime: peakBalance, currentDrawdownThreshold, lockLevel, fase (EVALUATION → SIM_FUNDED → LIVE), dias de trading, daily P&L, plano de ataque sugerido.

**Camada 3 — Monitoramento (engine + alertas):**
A cada trade, a engine recalcula o estado da instancia. Drawdown atualiza, daily loss atualiza, dias incrementam. Se limiar e atingido, gera flag/alerta. Paralelo ao pipeline existente (PL/compliance/emotional) — nao interfere, adiciona.

### 3 niveis de alerta (nao confundir)

| Nivel | Origem | Severidade | Exemplo |
|-------|--------|-----------|---------|
| Regra da mesa | Hard limit — viola = perde conta | Vermelho (urgente, irreversivel) | Drawdown atingido, daily loss estourado |
| Regra do plano | Soft limit — viola = compliance cai | Amarelo (corrigivel) | RR abaixo do target, trade sem stop |
| Plano de ataque | Guidance — ignora = opera sem framework | Informativo (nudge) | "Voce esta usando 3 trades hoje, plano sugere max 2" |

### Plano de ataque personalizado

O sistema sugere parametros operacionais para atacar a conta prop, calibrados pelo perfil 4D do aluno. 100% rule-based (funcao pura, sem IA, sem custo recorrente).

**Dois perfis:** conservador (prioriza sobrevivencia) e agressivo (prioriza velocidade). Binario por design — suficiente para Fase 1. Se dados mostrarem que mentores ajustam frequentemente, adicionar granularidade futura.

**Formula de calibragem:**
```javascript
// Fatores derivados do 4D
emotionalFactor = emotionalScore / 100              // 0.0 a 1.0
maturityFactor = stage / 5                           // 0.2 a 1.0
consistencyFactor = 1 - coefficientOfVariation       // CV do DEC-050

// Fator composto (media ponderada)
adjustmentFactor = (emotionalFactor * 0.4) + (maturityFactor * 0.3) + (consistencyFactor * 0.3)

// Faixas por perfil
conservativeRange = { roMin: 0.04, roMax: 0.06 }    // 4-6% do DD max
aggressiveRange   = { roMin: 0.08, roMax: 0.12 }    // 8-12% do DD max

// RO final
range = selectedProfile === 'conservative' ? conservativeRange : aggressiveRange
roPercent = range.roMin + (adjustmentFactor * (range.roMax - range.roMin))
roPerTrade = drawdownMax * roPercent
stopPerTrade = roPerTrade * (1 / rrMinimum)
dailyTarget = profitTarget / (evalDays * dayUsageFactor)
maxTradesPerDay = Math.round(dailyLossLimit / stopPerTrade)
```

**Cascata de fontes de dados:**

| Prioridade | Fonte | adjustmentFactor |
|-----------|-------|-----------------|
| 1a | Perfil 4D completo (assessment + trades) | Preciso — emotional, stage, CV reais |
| 2a | Indicadores sem 4D (trades sem assessment) | WR como proxy de maturidade, CV direto, emotional default 50 |
| 3a | Defaults (conta nova, sem historico) | Conservador: 0.3 (pessimista). Agressivo: 0.6 (moderado) |

O plano mostra de onde veio (`dataSource`) e alerta quando baseado em defaults: "Este plano e baseado em defaults — com mais trades, sera recalibrado."

**Parametros por fase da conta:**

| Parametro | EVALUATION | SIM_FUNDED | LIVE |
|-----------|-----------|------------|------|
| Prioridade | Passar avaliacao (target + regras) | Manter consistencia | Lucro real + payout |
| RO sugerido | Conservador (DD apertado, sem 2a chance) | Moderado (DD resetou) | Conforme perfil real |
| Alertas | Pressao de prazo + margem de DD | Complacencia pos-aprovacao | Payout eligibility |

### Faseamento (revisado)

| Fase | Escopo | Estimativa | Restricoes |
|------|--------|-----------|-----------|
| 1 | Templates `propFirmTemplates` + configuracao mentor + extensao `accounts` + plano de ataque rule-based | 1.5 sessoes | Sem conflito de chunks |
| 2 | Engine de drawdown (4 tipos) + CFs com transacao + daily loss + eval deadline | 1.5 sessoes | CF usa `runTransaction` para drawdown |
| 3 | Dashboard card prop + gauges + alertas mentor + tempo medio trades (universal) | 1 sessao | CHUNK-02 + CHUNK-04 (leitura) — #93 deve liberar locks antes |
| 4 | Payout tracking + qualifying days + simulador | 0.5 sessao | — |

### Decisoes arquiteturais (DEC-053 + discussao 05/04/2026)

| Decisao | Justificativa |
|---------|---------------|
| DEC-053 | Escopo revisado com regras Apex Mar/2026 |
| `propFirmTemplates` (nao `propFirmRules`) | Evita colisao semantica com compliance rules. Template e o que e — modelo pre-configurado |
| Collection raiz para templates | Entidade independente (catalogo de referencia, como tickers). Nao depende de aluno. INV-15 gate: APROVADO |
| `propFirm` inline na account | Estado runtime + plano de ataque. Account ja e container logico |
| `accounts/{id}/drawdownHistory` subcollection | Historico de drawdown cresce com cada trade — nao inflar documento da account. INV-15 gate: APROVADO |
| Plano de ataque 100% rule-based | Funcao pura deterministica. IA nao se justifica — e calculo com constraints, nao interpretacao de texto |
| Conservador/Agressivo binario | Suficiente para Fase 1. Granularidade futura se dados justificarem |
| Daily loss = soft (warning + flag + alerta) | Nao bloquear addTrade — o trade que estourou o limite precisa ser registrado |
| Drawdown usa `runTransaction` na CF | Trailing depende de read-then-write atomico do peakBalance. FieldValue.increment nao serve aqui |
| Tempo medio de trades e metrica universal | Vai nos MetricsCards para todas as contas, nao so prop. No card prop mostra com contexto |
| Eval deadline conta dias corridos | Apex conta corridos, nao dias de trading. UI deve ser explicita |

## 2. ACCEPTANCE CRITERIA

### Fase 1 — Templates, Configuracao e Plano de Ataque
- [ ] Collection `propFirmTemplates` com templates pre-configurados (Apex EOD/Intraday, MFF Starter/Core/Scale, Lucid Pro/Flex)
- [ ] Tela de configuracao de regras da mesa (mentor configura)
- [ ] Extensao do modelo `accounts` com campo `propFirm` (objeto aninhado)
- [ ] Seletor de mesa ao criar conta tipo PROP (dois niveis: firma → produto)
- [ ] Fase da conta: EVALUATION → SIM_FUNDED → LIVE → EXPIRED (transicao manual pelo mentor)
- [ ] Validacao de instrumentos restritos ao registrar trade (warning, nao bloqueio)
- [ ] Funcao pura `calculateAttackPlan(mesaRules, alunoProfile, perfil)` com cascata 4D → indicadores → defaults
- [ ] Campo `suggestedPlan` em `account.propFirm` com profile, dataSource, roPerTrade, stopPerTrade, rrMinimum, maxTradesPerDay, dailyTarget, daysToTarget, sizing
- [ ] Plano recalibra automaticamente quando novos dados 4D/indicadores ficam disponiveis
- [ ] UI mostra dataSource e alerta quando baseado em defaults
- [ ] Testes unitarios da formula de calibragem (todos os cenarios: 4D completo, indicadores only, defaults, stage 1-5, conservador/agressivo)

### Fase 2 — Engine de Drawdown
- [ ] Engine implementa 4 tipos: trailing intraday, EOD trailing, static, trailing+lock
- [ ] `peakBalance` e `currentDrawdownThreshold` atualizados via `runTransaction` (atomico)
- [ ] Deteccao de lock (safety net atingido → trail para)
- [ ] Daily loss limit com acao soft: flag `isDayPaused` + warning + alerta mentor (NAO bloqueia addTrade)
- [ ] Countdown de eval deadline (dias corridos, nao para com pausa)
- [ ] Red flags: distance to DD < 20%, consistency violada, eval deadline < 7 dias
- [ ] CF `onTradeCreated`/`onTradeUpdated` recalculam drawdown da conta prop
- [ ] Subcollection `accounts/{id}/drawdownHistory` com ponto por trade

### Fase 3 — Dashboard e Alertas
- [ ] Card de conta prop no StudentDashboard com gauges (DD, profit/target, dias restantes)
- [ ] Indicador de daily P&L vs daily loss limit (contas EOD)
- [ ] 3 niveis de alerta visual: vermelho (mesa), amarelo (plano), informativo (ataque)
- [ ] Alerta ao mentor quando aluno a <25% do drawdown
- [ ] Alerta quando consistency rule prestes a ser violada
- [ ] Tracking de trading days e payout eligibility
- [ ] Historico de drawdown (sparkline via subcollection)
- [ ] Tempo medio de trades (win/loss/overall) nos MetricsCards — universal, todas as contas
- [ ] No card prop: tempo medio com contexto ("operacoes curtas = scalping, compativel com perfil X")

### Fase 4 — Payout Tracking
- [ ] Ciclo de payout com tracking de dias lucrativos
- [ ] Qualifying days tracker (Apex: 5 dias com $100-$300 net profit)
- [ ] Calculo de payout eligibility (min days, qualifying days, min amount, consistency)
- [ ] Simulador: "Se eu sacar X, meu novo threshold sera Y"
- [ ] Registro de payouts realizados

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `propFirmTemplates` (NOVA — INV-15 APROVADO), `accounts` (escrita — campo `propFirm`), `accounts/{id}/drawdownHistory` (NOVA subcollection — INV-15 APROVADO), `trades` (leitura — validacao instrumentos) |
| Cloud Functions afetadas | `onTradeCreated` (extensao — recalcular drawdown prop via runTransaction), `onTradeUpdated` (idem) |
| Hooks/listeners afetados | `useAccounts` (novo campo propFirm), `useTrades` (warning instrumentos restritos) |
| Side-effects (PL, compliance, emotional) | Drawdown prop e paralelo ao PL existente — nao interfere. Compliance da mesa e independente do compliance do plano |
| Blast radius | MEDIO — nova collection + extensao de accounts + extensao de CFs existentes |
| Rollback | Campo `propFirm` e opcional — contas sem ele continuam funcionando. Collection `propFirmTemplates` pode ser removida sem impacto |

### 3.1 Riscos identificados pelo cross-check master

**Risco 1 — Blast radius no onTradeCreated:**
CF fica mais pesada: ler account → verificar se e prop → ler template → runTransaction para drawdown → verificar flags → criar alerta. Em batch (30 trades do Modo Criacao #93), sao 30 execucoes. Mitigacao: runTransaction garante atomicidade do peakBalance.

**Risco 2 — Race condition no drawdown trailing em batch:**
Drawdown trailing depende de leitura do peakBalance atual. Em batch, multiplas CFs concorrentes leem o mesmo valor. Mitigacao: `runTransaction` (read-then-write atomico no Firestore). Diferente do PL que usa FieldValue.increment.

**Risco 3 — Documento da account inflando:**
`propFirm` inline pode ficar grande. Mitigacao: estado runtime + plano de ataque inline, historico de drawdown como subcollection separada.

**Risco 4 — Fase 3 bloqueada por locks da #93:**
CHUNK-02 (StudentDashboard) e CHUNK-04 (trades leitura) — CHUNK-04 esta LOCKED pela #93. Fases 1-2 podem comecar sem conflito. Fase 3 aguarda liberacao.

### 3.2 Invariantes aplicaveis

| Invariante | Como se aplica |
|------------|---------------|
| INV-01 (Airlock) | Templates sao dados de configuracao, nao dados externos — OK direto |
| INV-02 (Gateway trades) | Nao escreve em trades — apenas leitura para validacao |
| INV-03 (Pipeline side-effects) | Extensao de onTradeCreated/onTradeUpdated — analise de impacto em elos downstream |
| INV-04 (DebugBadge) | Card de conta prop + tela de configuracao + plano de ataque |
| INV-05 (Testes) | Engine de drawdown (4 tipos) + formula de calibragem do plano de ataque |
| INV-10 (Verificar Firestore) | `propFirmTemplates` e collection NOVA — grep + aprovacao |
| INV-15 (Persistencia) | `propFirmTemplates` (collection raiz — APROVADO), `drawdownHistory` (subcollection — APROVADO), campo `propFirm` em accounts (inline — APROVADO) |
| INV-16 (Worktree) | Sessao deve criar worktree isolado |

### 3.3 Shared files — nao editar direto

| Arquivo | Delta necessario | Acao |
|---------|-----------------|------|
| `functions/index.js` | Extensao de onTradeCreated/onTradeUpdated para drawdown prop | Delta no doc do issue |
| `firestore.rules` | Rules para `propFirmTemplates` (mentor read/write) + `drawdownHistory` | Delta no doc do issue |
| `src/version.js` | Bump na entrega de cada fase | Propor no doc do issue |
| `docs/PROJECT.md` | Nova DEC, CHANGELOG, CHUNK-17 | Propor no doc do issue |

### 3.4 Isolamento de sessao paralela

**CHUNK-04 esta LOCKED pela #93.** Fases 1-2 nao tocam CHUNK-04 (so leitura na Fase 3). Iniciar Fases 1-2 sem conflito.
**CHUNK-02** esta AVAILABLE — mas so e necessario na Fase 3.
Se encontrar conflito com shared file: documentar aqui e notificar Marcio.

## 4. SESSOES

### Sessao — 05/04/2026 — Briefing Master (Opus 4.6)

**Tipo:** planejamento (sem codigo)

**O que foi feito:**
- Modelo semantico de 3 camadas definido (template → instancia → monitoramento)
- 3 niveis de alerta definidos (mesa = vermelho, plano = amarelo, ataque = informativo)
- Plano de ataque personalizado desenhado: 100% rule-based, calibrado por 4D, cascata de fontes
- Formula de calibragem especificada (adjustmentFactor = emotional*0.4 + maturity*0.3 + consistency*0.3)
- Cross-check profundo com 10 pontos de analise (riscos, contras, edge cases)
- Decisoes de persistencia aprovadas via INV-15 (propFirmTemplates raiz, drawdownHistory subcollection, propFirm inline)
- Renomear propFirmRules → propFirmTemplates (evitar colisao semantica com compliance rules)
- Daily loss como soft warning (nao bloqueia addTrade)
- Drawdown trailing via runTransaction (nao FieldValue.increment)
- Tempo medio de trades como metrica universal (todas as contas, nao so prop)
- Faseamento revisado com restricoes de chunks documentadas

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| — | propFirmTemplates collection raiz | Catalogo independente de alunos (como tickers). INV-15 APROVADO |
| — | drawdownHistory como subcollection de account | Historico cresce com trades — nao inflar doc account. INV-15 APROVADO |
| — | propFirm inline na account | Estado runtime + plano de ataque. Container logico correto |
| — | Plano de ataque 100% rule-based | Calculo com constraints, nao interpretacao. Funcao pura, testavel, sem custo |
| — | Conservador/Agressivo binario | Suficiente para Fase 1. Granularidade futura se justificada por dados |
| — | Daily loss soft (warning + flag) | Trade que estourou limite precisa ser registrado. Hard block cria problemas praticos |
| — | runTransaction para drawdown | Trailing exige read-then-write atomico. increment nao serve |
| — | Tempo medio universal | MetricsCards todas as contas. Card prop adiciona contexto |

**Pendencias para sessao de codigo (Claude Code):**
- Criar CHUNK-17 (Prop Firm Engine) no registry
- Criar worktree isolado (INV-16)
- Iniciar Fase 1 (templates + configuracao + plano de ataque)
- Consultar body do issue GitHub (#52) para templates detalhados das mesas

### Sessao — 09/04/2026 — Fase 2 passo 2.b + 2.d (CF + drawdownHistory)

**Tipo:** codigo (worktree `~/projects/acomp-052`)
**Baseado em:** propFirmDrawdownEngine.js v1 (passo 2.a, 58 testes Vitest)

**Escopo aprovado:** estender `functions/index.js` (`onTradeCreated`/`onTradeUpdated`/`onTradeDeleted`) com branch prop firm engine + `runTransaction` + write em `accounts/{id}/drawdownHistory`. Decisoes A/2/3/4/5 confirmadas pelo Marcio antes de codificar.

**O que foi feito:**

1. **`functions/propFirmEngine.js`** (NEW) — copia CommonJS do `src/utils/propFirmDrawdownEngine.js`. Header de aviso "ESPELHO — manter sincronizado". Smoke test via `node -e` confirmou paridade com o engine ESM.

2. **`functions/index.js`** — bump v1.9.0 → **v1.10.0**:
   - CHANGELOG header atualizado
   - VERSION constant: minor=10, patch=0, build=20260409
   - `require('./propFirmEngine')` no topo (apos `db = admin.firestore()`)
   - Helpers novos apos `updatePlanPl`:
     - `recalculatePropFirmState(accountId, trade, tradeId)` — pre-check fora da tx (early return non-PROP), le template, runTransaction com re-read do propFirm + chamada engine + update dos campos runtime
     - `appendDrawdownHistory(accountId, docId, trade, state)` — append-only snapshot
     - `notifyPropFirmFlag(accountId, trade, state)` — throttle 1×/dia/flag via doc id deterministico `propfirm-{accountId}-{flag}-{date}`
   - `onTradeCreated`: bloco 5 "PROP FIRM ENGINE" apos alerta emocional, isolado em try/catch
   - `onTradeUpdated`: bloco "PROP FIRM RECALC" apos compliance recalc, antes do bloco emocional. Aplica `delta = newResult - oldResult` (LIMITACAO v1)
   - `onTradeDeleted`: bloco "PROP FIRM RECALC" apos `updatePlanPl`. Aplica `-trade.result` (reversao). drawdownHistory permanece append-only (snapshot orfao intencional)

3. **`firestore.rules`** — nova subcollection `accounts/{accountId}/drawdownHistory/{historyId}`: `read: isAuthenticated()`, `write: false` (apenas CF via admin SDK).

**Schema novo em `account.propFirm` (expansao do objeto ja aprovado, INV-15):**

| Campo | Tipo | Descricao |
|---|---|---|
| `peakBalance` | number | maior saldo ja visto (ou snapshot EOD) |
| `currentDrawdownThreshold` | number | nivel abaixo do qual a conta quebra |
| `lockLevel` | number\|null | threshold congelado pos-lock (ou null) |
| `isDayPaused` | boolean | daily loss limit atingido hoje |
| `tradingDays` | number | dias com pelo menos 1 trade |
| `dailyPnL` | number | P&L acumulado do dia (zera ao virar) |
| `lastTradeDate` | string YYYY-MM-DD | usado pra detectar isNewDay |
| `currentBalance` | number | saldo runtime mantido pelo engine |
| `distanceToDD` | number 0..1 | margem proporcional ainda disponivel |
| `flags` | string[] | snapshot atual de flags |
| `lastUpdateTradeId` | string | ultimo tradeId que disparou recalc |

**Subcollection `accounts/{accountId}/drawdownHistory/{tradeId}`:**

```js
{
  tradeId, date, balance, peakBalance, drawdownThreshold,
  distanceToDD, dailyPnL, flags, lockLevel, createdAt
}
```

Doc id = `tradeId` para idempotencia (re-execucao do trigger nao duplica). Para edits: doc id = `${tradeId}-edit-${Date.now()}`.

**Notificacoes `PROP_FIRM_FLAG`:**
- `severity: CRITICAL` para `ACCOUNT_BUST`, `WARNING` para os demais
- Idempotencia: doc id = `propfirm-{accountId}-{flag}-{date}` (1× por flag-tipo por dia)
- Cobre: `ACCOUNT_BUST`, `DAILY_LOSS_HIT`, `DD_NEAR`, `LOCK_ACTIVATED`

**Decisoes registradas (executadas conforme aprovacao do Marcio):**

| ID | Decisao | Status |
|----|---------|--------|
| Engine sharing | Opcao A — duplicacao com header + DT-034 | ✅ Executado |
| Schema novo | Campos runtime no propFirm (expansao INV-15) | ✅ Aprovado verbalmente |
| Throttle | 1× por (flag-tipo, accountId, dia) | ✅ Executado |
| onTradeDeleted | Snapshot append-only orfao | ✅ Executado |
| Overhead account.get() | Aceito v1, monitorar | ✅ Aceito |

**Limitacoes documentadas (v1):**
- `onTradeUpdated` aplica DELTA incremental, NAO reconstrói historico do peakBalance
- `onTradeDeleted` aplica reversao do delta, NAO remove snapshot do drawdownHistory
- Trade editado muito antigo pode dessincronizar peakBalance — aceito (Marcio)
- Pre-read `account.get()` em todos os trades — overhead ~50ms para non-PROP
- DT-034 (NOVA): unificar engine prop firm via build step (rollup/esbuild) para eliminar a duplicacao

**Validacao:**
- `node --check functions/index.js` ✅
- `node --check functions/propFirmEngine.js` ✅
- Smoke test do engine CommonJS via `node -e` ✅ paridade com ESM
- 963 testes Vitest passando (engine `src/utils/` inalterado) ✅
- Build cliente limpo ✅

**Arquivos tocados:**

NOVOS:
- `functions/propFirmEngine.js`

EDITADOS:
- `functions/index.js` (CHANGELOG, VERSION, helpers, onTradeCreated, onTradeUpdated, onTradeDeleted)
- `firestore.rules` (subcollection drawdownHistory)
- `docs/dev/issues/issue-052-prop-firms.md` (esta sessao)

**Pendencias:**
- Bump `src/version.js` (cliente) e `version` em `functions/package.json` se aplicavel
- CHANGELOG do produto
- DT-034 (NOVA) registrar em PROJECT.md
- Deploy CFs: `firebase deploy --only functions:onTradeCreated,functions:onTradeUpdated,functions:onTradeDeleted` + `firebase deploy --only firestore:rules`
- Validacao manual no browser apos deploy (criar trade em conta PROP, verificar campos runtime)
- Fase 2.e (alerta mentor para flags) ja embutido neste passo via `notifyPropFirmFlag`
- Fase 2.f (eval deadline countdown helper) — ja existe no engine puro como `calculateEvalDaysRemaining`/`isEvalDeadlineNear`. Pendente integracao com flag em algum lugar (provavelmente Fase 3 — UI)
- Fase 3: card prop no StudentDashboard (depende de CHUNK-04 unlock)

### Sessao — 09/04/2026 — Correcao critica de ATR (instrumentsTable v2)

**Tipo:** correcao de bug critico (worktree `~/projects/acomp-052`)

**Bug:** Fase 1.5 v1 da `instrumentsTable.js` tinha valores `avgDailyRange` ALUCINADOS — nao baseados em dados reais do TradingView. Impacto: viabilidade do plano de ataque calculada errada. Exemplo concreto: MES CONS_B Apex 25K com 30 pts → calculator dizia 90.9% do range NY (INVIAVEL), mas real e 40.6% (VIAVEL day trade).

**Fonte de verdade:** `Temp/instruments-table-v2-atr-real.md` v2.0, captura TradingView ATR(14) diario em 09/04/2026.

**O que foi feito:**

1. **`src/constants/instrumentsTable.js`** — atualizado SOMENTE `avgDailyRange` (preserva availability, micros, types):

| Símbolo | ATR v1 (alucinado) | ATR v2 (real) | Delta |
|---|---|---|---|
| ES | 55 | 123 | 2.24× |
| NQ | 400 | 549 | 1.37× |
| YM | 420 | 856 | 2.04× |
| RTY | 30 | 70 | 2.33× |
| CL | 2.5 | 9.11 | 3.64× |
| GC | 40 | 180 | 4.50× |
| SI | 0.60 | 5.69 | 9.48× |
| 6B | 0.0110 | 0.0117 | 1.06× |
| 6J | 0.00070 | 0.000046 | 0.066× (10× menor) |
| ZC | 10 | 8.87 | 0.89× |
| ZW | 15 | 17.75 | 1.18× |
| ZS | 18 | 19.15 | 1.06× |
| MBT | 4000 | 3201 | 0.80× |

NG, HG, 6A: marcados como "ATR pendente de recaptura" — nao incluidos no v2, mantem valores v1.

2. **`src/constants/propFirmDefaults.js`** — comentario do `NY_MIN_VIABLE_STOP_PCT` recalibrado: threshold 12.5% × NY range NQ (329.4) = ~41 pts (era 30 pts no calculo errado).

3. **Testes recalculados — `attackPlanCalculator.test.js`:**
   - "stop como % do range NY" — expected 240 → 329.4, stopNyPct 31.25 → 22.77
   - "stop > 75% NY → INVIAVEL" — RTY 50K AGRES_B nao dispara mais (35.7%). Substituido por **M2K Apex 25K CONS_C**: 40 pts / 42 pts = 95.2% > 75% INVIAVEL ✓
   - "AGRES_A NQ 50K — NY viavel" — 31.25/329.4 = 9.49% nao mais NY viavel. Substituido por **AGRES_B NQ 100K (DD $3000)**: 45 pts / 329.4 = 13.66% > 12.5% NY viavel ✓
   - "threshold NY exato 12.5%" — recalculado: NQ DD $5490 CONS_B → RO $823.50 → 41.175 pts → 12.5% exato
   - Comentarios de `NQ Apex 50K CONS_B/CONS_C` atualizados (5.69%/7.59% reais)
   - **NOVO teste regressao**: `MES Apex 25K CONS_B com 30 pts é VIÁVEL na NY` (40.65% do range, nao 90.9%)

4. **Testes recalculados — `instrumentsTable.test.js`:**
   - `getSessionRange NQ NY` — 240 → 329.4
   - `getSessionRange ES London` — 12.65 → 28.29
   - `getRecommendedStop NQ` — 20pts/$400 → 27.45pts/$549 (atr passa a prevalecer)
   - `getRecommendedStop MNQ` — $40 → $54.90
   - `getRecommendedStop ES` — 4pts ($200, source min) → 6.15pts ($307.50, source atr)
   - `getRecommendedStop YM` — 25pts ($125, source min) → 42.8pts ($214, source atr)
   - Substituido teste "minStop prevalece" por **6E** (0.00045 × 5% < minStop 0.0008) — único caso onde minStop ainda ganha

**Validacao chave:**
- MES Apex 25K CONS_B: stop 30 pts, $150, 40.65% do range NY → ✅ VIAVEL day trade (era ❌ INVIAVEL)
- MNQ Apex 25K CONS_B: stop 75 pts, 22.77% do range NY → ✅ VIAVEL NY (era 31.25% — mesma classificacao, valores diferentes)
- NQ Apex 50K CONS_B: stop 18.75 pts, 5.69% do range NY → ⚠ session restricted (era 7.81% — mesma classificacao)

**Decisoes tomadas:**

| Decisao | Justificativa |
|---|---|
| Atualizar SO `avgDailyRange`, nao tocar availability/micros/types | User explicitamente disse "Atualizar TODOS os avgDailyRange". Mudancas estruturais sao escopo separado |
| Preservar GC `apex: false` (nota "suspenso Abr/2026") | v2 file mostra `apex: true` mas isso e sobre catalogo bruto. Nota de suspensao operacional permanece |
| `getRecommendedStop` mantido como helper legado | Nao mais usado pelo calculator novo (5 perfis), mas testes ainda existem. Manter funcao + atualizar testes |
| Threshold 12.5% generico mantido | Mesma logica da regra anterior do user, agora com numeros reais. Calibragem traduz para ~41 pts no NQ (era 30 com ATR errado) |
| Adicionar teste de regressao MES Apex 25K | Caso pedagogico do user — garantir que o bug nao reaparece |

**Arquivos tocados:**

EDITADOS:
- `src/constants/instrumentsTable.js` (16 valores avgDailyRange)
- `src/constants/propFirmDefaults.js` (comentario calibragem)
- `src/__tests__/utils/attackPlanCalculator.test.js` (4 testes corrigidos + 1 novo regressao)
- `src/__tests__/utils/instrumentsTable.test.js` (6 testes recalculados)

**Testes:**
- 905 testes totais passando (era 904 — +1 regressao MES)
- Build: limpo

**Pendencias:**
- Re-medir ATR de NG, HG, 6A no TradingView (nao incluidos no v2)
- Re-medir trimestralmente (recomendacao do user) ou quando VIX mudar significativamente
- Bump version.js + CHANGELOG (aguardando direcao)

## 5. ENCERRAMENTO

**Status:** ✅ FECHADO — v1.25.0, PR #132 mergeado, CFs deployadas

**Checklist final:**
- [x] Acceptance criteria Fases 1/1.5/2 atendidos
- [x] 1010 testes passando
- [x] PROJECT.md v0.11.0 atualizado (DEC-060/061/062, DT-034/035, CHANGELOG v1.25.0)
- [x] PR #132 mergeado (10/04/2026)
- [x] Issue #52 fechado no GitHub
- [x] Branch `feature/issue-052-prop-firms` deletada (local + remota)
- [ ] Locks de chunks liberados no registry (secao 6.3)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-17 (NOVO) | escrita | Prop Firm Engine — templates, engine drawdown, plano de ataque, card prop |
| CHUNK-02 | escrita | StudentDashboard — card prop + tempo medio trades (so Fase 3) |
| CHUNK-04 | leitura | trades — validacao instrumentos restritos (so Fase 3 — LOCKED pela #93 ate liberacao) |
| CHUNK-13 | leitura | Context Bar — conta prop selecionavel |

> **CHUNK-17 — Prop Firm Engine (proposta de criacao):**
> Dominio: Gestao de contas prop, engine de drawdown, templates, plano de ataque
> Arquivos principais: `PropFirmEngine/*`, `propFirmTemplates` collection, `useAccounts` (campo propFirm), CF extensao drawdown
> Justificativa: dominio novo e isolado, nao se encaixa em chunks existentes
> **Aguarda aprovacao do Marcio para registrar no PROJECT.md**

## 7. REFERENCIA — PESQUISA E ARQUITETURA

> O body completo do issue no GitHub (#52) contem: comparativo de drawdown entre mesas, tipos de drawdown (modelo mental), modelo de dados `propFirmTemplates` e extensao de `accounts`, mockup do dashboard card, consideracoes tecnicas, e changelog de regras Apex Mar/2026.
>
> Nao duplicar aqui — consultar via `gh issue view 52`.

### 7.1 Schema — propFirm inline na account

```javascript
// accounts/{accountId} — campo propFirm adicionado
{
  // ... campos existentes (currency, balance, broker, etc.)
  
  propFirm: {
    // --- Template vinculado ---
    templateId: string,          // ref ao propFirmTemplates
    firmName: string,            // desnormalizado (ex: "Apex")
    productName: string,         // desnormalizado (ex: "EOD 50k")
    
    // --- Fase ---
    phase: string,               // 'EVALUATION' | 'SIM_FUNDED' | 'LIVE' | 'EXPIRED'
    phaseStartDate: Timestamp,
    evalDeadline: Timestamp,     // so EVALUATION — dias corridos
    
    // --- Estado runtime ---
    peakBalance: number,
    currentDrawdownThreshold: number,
    lockLevel: number | null,    // trailing+lock: nivel onde trail parou
    isDayPaused: boolean,        // daily loss atingido hoje
    tradingDays: number,         // dias com pelo menos 1 trade
    
    // --- Plano de ataque sugerido ---
    suggestedPlan: {
      profile: string,           // 'conservative' | 'aggressive'
      dataSource: string,        // '4d_full' | 'indicators' | 'defaults'
      roPerTrade: number,
      stopPerTrade: number,
      rrMinimum: number,
      maxTradesPerDay: number,
      dailyTarget: number,
      daysToTarget: number,
      bufferDays: number,
      sizing: number,
      adjustmentFactor: number,  // 0.0 a 1.0 — transparencia do calculo
      generatedAt: Timestamp
    }
  }
}

// accounts/{accountId}/drawdownHistory/{entryId}
{
  tradeId: string,
  date: string,                  // YYYY-MM-DD
  balance: number,
  peakBalance: number,
  drawdownThreshold: number,
  distanceToDD: number,          // percentual restante
  dailyPnL: number,
  createdAt: Timestamp
}
```
