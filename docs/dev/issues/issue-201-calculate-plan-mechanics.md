# Issue #201 — refactor: extrair `calculatePlanMechanics` — motor universal de plano (mesa + retail)

## Autorização (OBRIGATÓRIA)

**Status atual do documento:**
- [x] Plano arquitetural aprovado (sessão 25/04/2026, `~/.claude/plans/iridescent-riding-pascal.md`)
- [ ] **Mockup do seletor de instrumento + estilo** apresentado (este doc, seção Mockup)
- [x] **Memória de cálculo** apresentada (este doc, seção Memória de Cálculo — derivada de `docs/dev/research/spec-original-attack-plan-2026-04-07.md`)
- [ ] **Marcio autorizou mockup** (aguardando)
- [ ] Gate Pré-Código liberado

## Context

Aluno desafiou plano da prop firm na revisão semanal. Achado: stop 187pts × 1 contrato MNQ Apex Intraday 50K — taticamente inviável. Causa raiz: `attackPlanCalculator.js` fixa `roUSD = drawdownMax × profile.roPct`, back-calcula `stopPoints = roUSD / pointValue`, fixa `sizing = 1`. Spec original Opus 07/04 (recuperada em `docs/dev/research/`) prescrevia stop estrutural por estilo + sizing dinâmico — implementação atual rasga essa spec.

**Outcome**: extrair `calculatePlanMechanics(input)` como motor universal (mesa + retail), com 4 camadas (Constraints → Tactical Stop por estilo → Sizing dinâmico → Viability). Hard conditions: instrumento mandatório, estilo mandatório. Reuso direto pela retail #116 (Onda 1) com `type: 'retail'`.

## Spec

Ver issue body no GitHub: #201.

## Mockup

### Tela atual (PropFirmPage / AddAccountModal — preview do plano)

```
┌─ Conta Apex Intraday 50K ────────────────────┐
│ Profile: [CONS_B ▼]                           │
│ ─────────────────────────────────────         │
│ Plano sugerido (modo abstract):              │
│   RO/trade: $375                              │
│   Max trades/dia: 2                           │
│   ⚠ Selecione instrumento para plano completo │
└──────────────────────────────────────────────┘
```

### Tela proposta (mockup desta issue)

```
┌─ Conta Apex Intraday 50K ────────────────────┐
│ Profile:   [CONS_B Sweet Spot ▼]              │
│ Instrumento: [MNQ — Micro Nasdaq ▼]  *        │
│ Estilo:    [Day trade ▼]             *        │
│ ─────────────────────────────────────         │
│ Plano sugerido:                               │
│   Stop:        55 pts ($110/contrato)         │
│   Contratos:   3                              │
│   RO efetivo:  $330 (dentro de $375 budget)   │
│   Target:      110 pts ($660 total) RR 1:2    │
│   Max trades/dia: 2 — dailyStop $660          │
│   Sessões:     NY · London · Asia              │
│ ─────────────────────────────────────         │
│ [▶ Gerar plano com IA]                        │
└──────────────────────────────────────────────┘

Sem instrumento OU sem estilo:
┌──────────────────────────────────────────────┐
│ ⚠ Selecione instrumento e estilo para        │
│   visualizar o plano sugerido.               │
└──────────────────────────────────────────────┘
```

### Interações

- **Seletor instrumento**: dropdown listando instrumentos da `instrumentsTable` permitidos pela mesa (`isInstrumentAllowed(symbol, firm)`). `*` = mandatório. Sem opção default — aluno escolhe ativamente.
- **Seletor estilo**: dropdown com 4 opções e tooltip de descrição:
  - **Scalp** — stop apertado (~5% ATR), entrada cirúrgica
  - **Day trade** — stop moderado (~10% ATR), pullback
  - **Swing intraday** — stop largo (~20% ATR), convicção
  - **Convicção** — stop muito largo (~30% ATR), 1 trade do dia
- **Recálculo reativo**: muda profile/instrumento/estilo → re-render imediato do plano.
- **Estado vazio**: instrumento OU estilo ausente → banner amber, sem números mecânicos.
- **Estado incompatível**: `contracts < 1` → banner vermelho com sugestão de micro alternativo.
- **DebugBadge** (INV-04): novo componente `<PlanoMecanicoCard component="PlanoMecanicoCard">` mantém badge.

### Páginas afetadas

- `src/pages/PropFirmPage.jsx` — preview da conta (já existe, ganha 2 selects)
- `src/components/AddAccountModal.jsx` — criação da conta PROP (ganha 2 selects)
- `src/components/dashboard/PlanoMecanicoCard.jsx` — output recebe novo shape, exibe `stopBase/contracts/roEffective` em vez de `stopPoints/sizing=1`
- `src/utils/propViabilityBadge.js` — preserva 6 estados, alimentado por novo `viability`

## Memória de Cálculo

Derivada de `docs/dev/research/spec-original-attack-plan-2026-04-07.md` (tabela determinística v2.0) + decisões da sessão 25/04/2026.

### Inputs (Firestore + tabelas)

| Input | Origem | Default |
|---|---|---|
| `constraints.drawdownBudget` | mesa: `getActiveDrawdown(template, account.propFirm.phase).maxAmount` (preserva DEC-068) / retail: `kelly × balance` (futuro F) | obrigatório |
| `constraints.targetGoal` | mesa: `template.profitTarget` / retail: opcional | obrigatório (mesa) |
| `constraints.dailyLossLimit` | mesa: `template.dailyLossLimit ?? max(1, drawdownBudget × 0.25)` (fallback existente em `attackPlanCalculator.js:143-144`) | fallback |
| `constraints.contractsMax` | mesa: `template.contracts.max` / retail: `Infinity` | obrigatório (mesa) |
| `profile.roPct` | `ATTACK_PROFILES[code].roPct` (constante, `propFirmDefaults.js:99-156`) | sem default — aluno escolhe |
| `profile.maxTradesPerDay` | `ATTACK_PROFILES[code].maxTradesPerDay` | derivado do profile |
| `style` | input do aluno (novo seletor) | sem default — aluno escolhe |
| `instrument.atrDaily` | `instrumentsTable[symbol].avgDailyRange` (estático até roadmap E) | sem default |
| `instrument.pointValue` | `instrumentsTable[symbol].pointValue` ou `microPointValue` | sem default |
| `instrument.type` | `instrumentsTable[symbol].type` (`equity_index | energy | metals | currency | agriculture | crypto`) | sem default |
| `MIN_VIABLE_STOP[type]` | `propFirmDefaults.js:163` | constante (DT-042 — consolidar fonte) |
| `MAX_STOP_NY_PCT` | `propFirmDefaults.js:174` (= 75) | constante |
| `NY_RANGE_FRACTION` | `propFirmDefaults.js:186` (= 0.60) | constante |

### Constantes novas (a adicionar em `propFirmDefaults.js`)

```javascript
export const STYLE_ATR_FRACTIONS = {
  scalp: 0.05,
  day: 0.10,
  swing: 0.20,
  conviction: 0.30,
};

export const PROFILE_STOP_VARIANCE = 0.10;  // ±10% do stopBase entre profiles dentro do estilo
```

Valores derivados da tabela seção 7 do `spec-original-attack-plan-2026-04-07.md`:
- Scalp 6-10% range NY → 5% ATR (range NY = 60% ATR → 5% ATR ≈ 8.3% range NY ✓)
- Day 21-33% range NY → 10% ATR (≈ 16.7% range NY — borda inferior do day, conservador)
- Swing 33-50% range NY → 20% ATR (≈ 33% range NY ✓)
- Convicção 50-70% range NY → 30% ATR (≈ 50% range NY ✓)

### Fórmula completa

```
// Camada 2 — Tactical Stop
stopBaseRaw = atrDaily × STYLE_ATR_FRACTIONS[style]
profileVariance = 1 + ((profile.roPct - 0.15) / 0.15) × (-PROFILE_STOP_VARIANCE)
   // CONS_A (10%) → +6.7% (mais largo); CONS_B (15%) → 0; AGRES_B (30%) → -10%
nyRange = atrDaily × NY_RANGE_FRACTION
stopBase = clamp(
  stopBaseRaw × profileVariance,
  MIN_VIABLE_STOP[instrument.type],
  MAX_STOP_NY_PCT / 100 × nyRange
)

// Camada 3 — Sizing Dinâmico
roBudget = drawdownBudget × profile.roPct
contracts = floor(roBudget / (stopBase × pointValue))
roEffective = contracts × stopBase × pointValue

// Camada 4 — Viability
incompatible = (
  stopBase × profileVariance < MIN_VIABLE_STOP[instrument.type] ||
  stopBase / nyRange × 100 > MAX_STOP_NY_PCT ||
  roBudget > dailyLossLimit ||
  contracts < 1
)
```

### Baseline (regressão zero)

Wrapper `calculateAttackPlan(templateRules, profile4D, indicators, planProfile, phase, instrumentSymbol)` mantido em `src/utils/attackPlanCalculator.js`:

```javascript
function calculateAttackPlan(templateRules, profile4D, indicators, planProfile, phase, instrumentSymbol = null) {
  if (!instrumentSymbol) {
    return legacyAbstractMode(templateRules, planProfile, phase);  // preserva mode 'abstract' atual
  }
  return calculatePlanMechanics({
    constraints: { type: 'prop', ...mesaConstraintsFromTemplate(templateRules, phase) },
    profile: ATTACK_PROFILES[planProfile],
    style: 'day',  // default para back-compat dos 6 call sites legados
    instrument: getInstrument(instrumentSymbol),
  });
}
```

Testes existentes em `attackPlanCalculator.test.js` rodam contra wrapper, esperando shape antigo. Novos testes em `calculatePlanMechanics.test.js` rodam shape novo.

### Casos limites

| Cenário | Comportamento esperado |
|---|---|
| `instrument` ausente no novo shape | `throw new Error('instrument is mandatory')` |
| `style` ausente | `throw new Error('style is mandatory')` |
| `style` inválido | `throw new Error('style must be one of: scalp, day, swing, conviction')` |
| `contracts < 1` (RO insuficiente para 1 contrato no estilo) | `incompatible: true`, `microSuggestion` se há micro alternativo |
| `stopBase` clipado por `MIN_VIABLE_STOP` | `stopBase = MIN_VIABLE_STOP[type]`, log warning interno |
| `stopBase` clipado por `MAX_STOP_NY_PCT` | `incompatible: true`, sugere estilo mais conservador |
| `phase = SIM_FUNDED` em template Ylos com `fundedDrawdown` | `drawdownBudget = template.fundedDrawdown.maxAmount` (preserva DEC-068) |
| `template.dailyLossLimit = null` (Apex Intraday) | fallback `max(1, drawdownBudget × 0.25)` (preserva linha 143 atual) |
| `instrument.isMicro = true` e `incompatible` | `microSuggestion: null` (já é micro, sem alternativa menor) |
| Template sem `contracts.max` declarado | `contractsMax = Infinity` (sem cap) |

### Exemplo numérico — Apex Intraday 50K + MNQ + day + CONS_B

```
INPUTS:
  drawdownBudget = 2500, dailyLossLimit fallback = max(1, 2500×0.25) = 625
  profile = CONS_B { roPct: 0.15, maxTradesPerDay: 2, rrTarget: 2 }
  style = 'day'
  instrument MNQ: pointValue=2, atrDaily=549, type='equity_index'
  contractsMax = 10

CAMADA 2:
  stopBaseRaw = 549 × 0.10 = 54.9 pts
  profileVariance = 1 + ((0.15 - 0.15) / 0.15) × (-0.10) = 1.0
  nyRange = 549 × 0.60 = 329.4 pts
  stopBase = clamp(54.9 × 1.0, 15, 247.05) = 54.9 pts ✓

CAMADA 3:
  roBudget = 2500 × 0.15 = 375
  contracts = floor(375 / (54.9 × 2)) = floor(3.42) = 3
  roEffective = 3 × 54.9 × 2 = 329.4

CAMADA 4 (viability):
  stopBase 54.9 ≥ MIN_VIABLE_STOP equity_index 15 ✓
  stopNyPct 54.9/329.4 = 16.7% < 75% ✓
  roBudget 375 < dailyLossLimit 625 ✓
  contracts 3 ≥ 1 ✓
  → incompatible: false

OUTPUT:
  stopBase: 54.9, stopUSD: 109.8, targetPoints: 109.8, targetUSD: 219.6,
  contracts: 3, roEffective: 329.4,
  maxTradesPerDay: 2, dailyStop: 658.8, dailyGoal: 1317.6,
  rrMinimum: 2, recommendedSessions: ['ny','london','asia']
```

**Comparação com hoje** (mesma conta + MNQ + CONS_B): stop 187,5pts × 1 contrato vs proposta **54,9pts × 3 contratos**. Stop ~3,4x menor, sizing 3x maior, RO efetivo 88% do budget (vs 100% no atual com sizing fixo).

## Phases

- A1 — Adicionar `STYLE_ATR_FRACTIONS` + `PROFILE_STOP_VARIANCE` em `propFirmDefaults.js` + DT-042 (consolidar `MIN_VIABLE_STOP`)
- A2 — Criar `src/utils/calculatePlanMechanics.js` (4 camadas) + testes unitários (4 estilos × 5 profiles × 6 contas Apex chave)
- B1 — Refatorar `src/utils/attackPlanCalculator.js` como wrapper de back-compat
- B2 — Atualizar `src/utils/propPlanDefaults.js` (consume novo shape com adapter back-compat)
- B3 — Atualizar `src/utils/propViabilityBadge.js` (consume `viability` do novo output)
- C1 — Refatorar `src/pages/PropFirmPage.jsx` — adicionar seletores instrumento + estilo (mandatórios)
- C2 — Refatorar `src/components/AddAccountModal.jsx` — idem
- C3 — Atualizar `src/components/dashboard/PlanoMecanicoCard.jsx` — exibir `stopBase/contracts/roEffective`
- C4 — Atualizar `src/pages/AccountsPage.jsx` — adapter
- D1 — DEC-AUTO-201-XX (estilo independente, ±10% banda, STYLE_ATR_FRACTIONS) em `docs/decisions.md`
- D2 — Resolver DT-042 (consolidar fontes de `MIN_VIABLE_STOP`) dentro do refactor
- E1 — Validação manual browser (AP-08) com 3+ combinações conta × instrumento × estilo
- E2 — Bundle entregáveis: `issue-201-spec.md`, `issue-201-impact.md`, `issue-201-ai-review.md`
- F1 — PR com `Closes #201` apontando para v1.47.0

## Sessions

- 25/04/2026 A1+A2 — `STYLE_ATR_FRACTIONS`/`PROFILE_STOP_VARIANCE`/`DEFAULT_ATTACK_STYLE` em propFirmDefaults; motor `calculatePlanMechanics.js` (4 camadas, ~520 linhas) + 44 testes (4 estilos × profiles × Apex; DT-042; retail; viability gates). 2533/2533 testes pass. Commit `c5bcaab9`.
- 25/04/2026 B1 — `attackPlanCalculator.js` marcado @deprecated (banner header + jsdoc); re-exporta motor novo. 6 call sites preservados intactos. 52/52 testes legados pass. Commit `c5bcaab9` (mesmo).
- 25/04/2026 C1+C2 — `AddAccountModal.jsx` ganhou seletores instrumento + estilo (mandatórios); `AccountsPage.jsx` ganhou estilo (instrumento já existia); ambos usam motor novo via `toLegacyAttackPlanShape` adapter. `PropFirmPage.jsx` lê style/instrument salvos e renderiza com motor novo. Persistência: `propFirm.suggestedPlan.style` + `propFirm.selectedInstrument`. Commit `1b44201c`.
- 25/04/2026 D1 — DEC-AUTO-201-01..05 + DT-042 marcada resolvida. Commit `e71c04f8` (main).
- 25/04/2026 E2 — `npm test`: 2533/2533 pass; `npx vite build`: clean.
- _Pendente:_ E2 browser smoke (AP-08) — handoff Marcio: criar conta Apex Intraday 50K + MNQ + day, validar `stopBase ≈ 55pts × 3 contratos × $330 RO`. Trocar para conviction → 165pts × 1 contrato. Trocar profile AGRES_B → maxTradesPerDay=1.

## Shared Deltas

_(propostos para integração no MAIN no encerramento)_
- `src/version.js` — bump v1.46.1 → v1.47.0
- `docs/registry/versions.md` — marcar v1.47.0 consumida com PR squash sha
- `docs/registry/chunks.md` — liberar CHUNK-17
- `CHANGELOG.md` — nova entrada `[1.47.0] - DD/MM/2026` resumindo refactor + UX nova
- `docs/decisions.md` — DEC-AUTO-201-01..NN
- `docs/tech-debt.md` — atualizar DT-042 (resolvido)
- `docs/PROJECT.md` — bump versão metadata + nota de release

## Decisions

_(IDs apenas — texto mora em `docs/decisions.md`)_
- DEC-AUTO-201-01 (a registrar) — estilo operacional como eixo independente do profile
- DEC-AUTO-201-02 (a registrar) — banda ±10% do stopBase entre profiles
- DEC-AUTO-201-03 (a registrar) — STYLE_ATR_FRACTIONS valores iniciais (5/10/20/30%)
- DEC-AUTO-201-04 (a registrar) — instrumento mandatório (mode abstract deprecated)
- DEC-AUTO-201-05 (a registrar) — wrapper back-compat preserva 6 call sites com style default 'day'

## Chunks

- **CHUNK-17 Prop Firm Engine** — ESCRITA (motor + propFirmDefaults)
- **CHUNK-13 Context Bar** — LEITURA (PropFirmPage consome StudentContextProvider)
- **CHUNK-03 Plan Management** — LEITURA (output consumido por PlanManagementModal)
- **CHUNK-02 Student Management** — LEITURA (AccountsPage / AddAccountModal)
