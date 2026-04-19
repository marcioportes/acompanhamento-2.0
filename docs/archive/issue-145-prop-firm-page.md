# Issue #145 — arch: Página dedicada Mesa Prop — extrair componentes prop do Dashboard

- **Estado:** OPEN
- **Milestone:** v1.1.0 — Espelho Self-Service
- **Epic pai:** #144
- **Branch:** `arch/issue-145-prop-firm-page`
- **Worktree:** `~/projects/issue-145`
- **Versão reservada:** v1.32.0 (reservada no main commit `155bb102` junto com locks)
- **Baseado em PROJECT.md:** v0.22.0 (17/04/2026 — INV-17 + INV-18)

---

> **NOTA DE REVISÃO (17/04/2026 — Spec Review Gate INV-18, Opção C):**
>
> A execução original (Fases A+B+C) entregou extração mecânica mas produziu página ruim
> semanticamente (ver §8 log histórico). Crítica validada em revisão com Marcio:
> AI Approach Plan dentro de card de gauges = puxadinho (viola INV-17); níveis de abstração
> misturados; curva de equity inexistente; plano mecânico não tem card próprio.
>
> Esta versão da spec (v2) re-escreve §1-§8 com redesign em 3 zonas. O scaffolding
> (PropFirmPage, Sidebar item, App.jsx rota, ContextBar wiring) é preservado. O conteúdo
> (PropAccountCard, AI Approach Plan threading, sparkline-refactor tentativa) é reconstruído.
>
> Derivadas desta revisão:
> - Issue nova #NNN (próxima livre) — "Tela dedicada Plano de Approach (tático-estratégico)"
> - Hotfix imediato #NNN — fix `phase` missing em generatePropFirmApproachPlan.js (3 linhas)

---

## 1. Objetivo

Entregar a página **Mesa Prop** como resposta clara a perguntas operacionais de trader prop
firm, separando níveis de abstração (tático-agora × retrospectivo × contrato) com
componentes focais dedicados.

Não basta extrair do Dashboard — a extração original agrupou tudo em um PropAccountCard
que acumulou gauges + alerts + phase selector + narrativa IA colapsável. Isso é puxadinho
(INV-17). A página v2 entrega 4 zonas semânticas com componentes de propósito único.

---

## 2. Chunks

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-02 | escrita | StudentDashboard (já limpo, Fases A+B) + Sidebar (já feito) |
| CHUNK-17 | escrita | PropFirmPage redesenhada + decomposição PropAccountCard + novos componentes (PropStatusCard, TemplateCard, PlanoMecanicoCard, PropEquityCurve, ViabilityBadge) |

**Locks registrados:** PROJECT.md §6.3 (commit `8e6e9f1e` em main).

---

## 3. Perguntas que a página responde (INV-17 — arquitetura de informação)

**Zona 1 · TÁTICO (agora, durante sessão de trade):**
- Quanto do drawdown já comi? Quantos USD me restam hoje antes do daily stop?
- Meu best day violou consistency? Qual a porcentagem?
- Quantos dias operados / quantos restam até o deadline da avaliação?

**Zona 2 · RETROSPECTIVO (como cheguei aqui):**
- Qual o shape da minha equity curve dentro desta conta prop?
- Melhor dia $, pior dia $, consistency % atual, tempo médio/trade
- Há padrão de drawdown (dia da semana, sessão)?

**Zona 3 · CONTRATO (regra da mesa + plano mecânico):**
- Qual meu template? DD type (trailing/static/TRAIL_FROZEN)? Profit target? Daily loss?
  Consistency %? Eval deadline?
- Meu plano mecânico (RO, stop, target, daily goal, max trades/dia) é viável para minha fase?

**Zona 4 · PAYOUT (quando elegível):**
- Quando posso sacar? Quanto? Quanto cai do DD threshold?

**O que NÃO mora nesta página:**
- Plano operacional do aluno (`plans` collection) → `AccountDetailPage` (canônico desde #146)
- AI Approach Plan (narrativa estratégica) → nova tela dedicada (issue derivada)
- CRUD de conta → `AccountDetailPage` / `AccountSettingsModal`

---

## 4. Arquitetura — 4 zonas

```
┌─ ContextBar (conta PROP selecionada) ───────── [PhaseSelector no header]┐
│                                                                         │
│ ZONA 1 · STATUS AGORA                                                   │
│  PropAlertsBanner (persistente, só danger)                              │
│  PropStatusCard: saldo | profit | Gauge DD | Gauge Profit/Target        │
│                  Hoje: P&L dia correto | USD disponível | trades hoje   │
│                                                                         │
│ ZONA 2 · COMO CHEGUEI AQUI                                              │
│  PropEquityCurve: curva USD × data (Recharts, eixo Y em USD/%)          │
│  PropHistoricalKPIs: dias operados X/Y | melhor dia $ | pior dia $      │
│                     | consistency % | tempo médio/trade                 │
│                                                                         │
│ ZONA 3 · CONTRATO DA MESA                              (grid 2 cols)    │
│  ┌──────────────────────┐  ┌──────────────────────────────┐             │
│  │ TemplateCard         │  │ PlanoMecanicoCard            │             │
│  │ - firm, product      │  │ - RO, stopPoints, target     │             │
│  │ - DD type (trail/..) │  │ - dailyGoal, dailyStop       │             │
│  │ - profitTarget       │  │ - maxTradesPerDay            │             │
│  │ - dailyLossLimit     │  │ - RR                         │             │
│  │ - consistency %      │  │ - ViabilityBadge             │             │
│  │ - evalDeadline       │  │   (6 estados, phase-aware)   │             │
│  │ - phase rules        │  │                              │             │
│  └──────────────────────┘  └──────────────────────────────┘             │
│                                                                         │
│ ZONA 4 · PAYOUT (mantém PropPayoutTracker, renomear "Simulador")        │
│  PropPayoutTracker: elegibilidade + "Quando posso sacar?" + histórico   │
└─────────────────────────────────────────────────────────────────────────┘

MOBILE (< 768px): zonas empilham; grid 2 cols da Zona 3 vira 1 col
                  (padrão canônico `grid grid-cols-1 md:grid-cols-2`).
```

### 4.1 Decomposição do PropAccountCard

O atual PropAccountCard (~540 linhas) é decomposto em:

| Novo componente | Conteúdo | Zona |
|-----------------|----------|------|
| `PropStatusCard` | Saldo, profit, gauges DD/target, USD disponível hoje | Zona 1 |
| `TemplateCard` | Regras da mesa (firm, DD type, targets, consistency, deadline) | Zona 3 |
| `PlanoMecanicoCard` | Plano mecânico determinístico + ViabilityBadge | Zona 3 |
| `PropEquityCurve` | Curva de equity Recharts a partir de drawdownHistory | Zona 2 |
| `PropHistoricalKPIs` | Dias operados, melhor/pior dia, consistency, tempo médio | Zona 2 |

Phase selector sobe para o header da `PropFirmPage` (ação administrativa, rara).

### 4.2 PropEquityCurve — fonte de dados

**Decisão:** `drawdownHistory` (subcollection `accounts/{id}/drawdownHistory`).
**Justificativa:** já contém campo `balance` (saldo cumulativo após cada trade), populado por
`appendDrawdownHistory` em `functions/index.js:1089-1107`. Um doc por trade → granularidade
máxima. Sem necessidade de derivar de `trades` (evita carregar collection inteira).

**Fix necessário:** `src/hooks/useDrawdownHistory.js:37` tem `MAX_DOCS = 100`. Para contas com
500+ trades, curva ficaria truncada. Solução:
- **Opção Ampliar:** subir `MAX_DOCS` para 1000 (query ainda rápida, <1MB por conta).
- **Opção Paginar:** lazy load em 2 queries (first 100 + stream para UI, completo em background).

**Recomendação:** Opção Ampliar (simples, suficiente). Adicionar prop `limit` configurável
para usos que querem menos (ex: sparkline em card pequeno poderia pedir 50).

**Caveat:** trades deletados deixam snapshot órfão no drawdownHistory (intencional,
audit-log). Não afeta curva — `balance` permanece correto porque é cumulativo.

### 4.3 ViabilityBadge — 6 estados concretos

Baseado em `src/utils/attackPlanCalculator.js` output (modo `execution`).

| Estado | Condição técnica | Texto | Cor | Ação |
|--------|-----------------|-------|-----|------|
| `VIÁVEL_CONFORTÁVEL` | `!incompatible`, `constraintsViolated:[]`, `dailyStop < 0.60 × dailyLossLimit`, `lossesToBust ≥ 5`, `evPerTrade > 0` | "Plano consome {X}% do daily loss → confortável" | green | — |
| `VIÁVEL_APERTADO` | `!incompatible`, `0.60 ≤ dailyStop/dailyLossLimit < 0.90`, `lossesToBust 3-4`, `evPerTrade ≥ 0` | "Plano consome {X}% do daily loss → viável mas apertado, sem margem p/ erro" | amber | revisar perfil |
| `VIÁVEL_RESTRITO` | `!incompatible`, `nySessionViable: false`, `sessionRestricted: true` | "Stop pequeno para NY → operar em {recommendedSessions.join('/')}" | orange | mudar sessão |
| `INVIÁVEL_STOP_RUÍDO` | `incompatible`, `constraintsViolated` contém `'stop_below_min_viable'`, `microSuggestion` definido | "Stop {stopPts}pts < mínimo {minViable}pts → ruído. Sugerido: {micro}" | red | trocar p/ micro |
| `INVIÁVEL_RESTRIÇÃO_HARD` | `incompatible`, `constraintsViolated` contém `'stop_exceeds_ny_range'` OU `'ro_exceeds_daily_loss'` | "{inviabilityReason} — não-operável" | red | mudar instrumento ou perfil |
| `INVIÁVEL_ERRO` | `mode === 'error'` (instrumento não encontrado) | "Instrumento não encontrado na tabela" | gray | selecionar válido |

**Phase-aware:** texto prefixa com contexto de fase.
- EVALUATION: enfatiza deadline ("—, e você tem {N} dias para bater target")
- SIM_FUNDED/LIVE: enfatiza preservação ("—, foco em preservar capital fundado")

### 4.4 Responsividade (mobile)

App é mobile-first (viewport meta + Tailwind breakpoints padrão). Padrão dominante:
`grid grid-cols-1 md:grid-cols-2 gap-4` (ver `SwotAnalysis:290`, `MetricsCards:164`,
`StudentDashboard:470`). Zona 3 usa esse padrão literal — TemplateCard + PlanoMecanicoCard
lado a lado em desktop, empilhados em mobile. Gauges da Zona 1 já são responsivos no
PropAccountCard atual. PropEquityCurve usa `ResponsiveContainer` do Recharts
(`width="100%"`).

---

## 5. Análise de impacto

### Collections tocadas
- Nenhuma nova. Leitura de `accounts`, `drawdownHistory` (com MAX_DOCS ampliado),
  `movements`, `plans`.

### Cloud Functions
- Nenhuma nova ou modificada.

### Hooks/listeners
- `useDrawdownHistory` — **MODIFICAR** `MAX_DOCS = 100` → `MAX_DOCS = 1000` (ou prop `limit`)
- `useMovements` — consumo idêntico
- `useAccounts`, `usePlans`, `usePropFirmTemplates` — consumo idêntico
- `useAssessment` — **SAI da página** (era usado só pelo AI Approach Plan)
- `useAiApproachPlan` — **SAI da página** (migra para issue derivada)

### Side-effects
- Nenhum. Refator de layout + decomposição de componente.

### Invariantes
- INV-04 (DebugBadge): PropFirmPage com `component="PropFirmPage"`. Novos componentes
  internos não precisam de badge (embedded).
- INV-16 (worktree): `~/projects/issue-145` ✓
- INV-17 (arquitetura de informação): Mesa Prop domínio, 4 zonas declaradas, zero
  duplicação com Dashboard/AccountDetailPage. Budget ok (4 zonas vs. 6+ do gate).
- INV-18 (spec review): esta spec v2 é o artefato do gate.

### Blast radius
- PropAccountCard é quebrado em 5 componentes menores. Consumidores atuais: apenas
  PropFirmPage (pós Fase A+B). Zero consumidor externo após extração.
- Fix em `useDrawdownHistory.MAX_DOCS`: afeta também PropPayoutTracker (que consome o
  mesmo hook) — qualifying days agora olha janela maior (correto: era subestimado antes).
- Rollback: se algo der errado, revert por commits (scaffolding A+B separado de redesign).

### Testes que podem quebrar
- Nenhum teste existente testa layout do PropFirmPage ou PropAccountCard.
- Novos testes mandatórios:
  - `viabilityBadge.test.js` — 6 estados, phase-aware
  - `propEquityCurve.test.js` — curva derivada de drawdownHistory (fixture com gaps)
  - `useDrawdownHistory.test.js` — smoke test com `limit` configurável
  - Teste visual: PropFirmPage renderiza 4 zonas + componentes corretos

---

## 6. Deltas em shared files (aplicar no main via PR)

### 6.1 `src/App.jsx` — nova view (já aplicado Fase B)
```jsx
case 'propfirm':
  return <PropFirmPage viewAs={viewAs} />;
```

### 6.2 `src/components/Sidebar.jsx` — novo item (já aplicado Fase B)
```jsx
{ id: 'propfirm', label: 'Mesa Prop', icon: Shield, condition: hasPropAccount }
```

### 6.3 `docs/PROJECT.md` — CHANGELOG v1.32.0
Entrada resumindo: redesign Mesa Prop em 4 zonas, decomposição PropAccountCard,
PropEquityCurve, ViabilityBadge, fix MAX_DOCS drawdownHistory, AI Approach Plan migrado
para issue derivada.

### 6.4 `src/version.js` — CHANGELOG comment v1.32.0 (ampliado)
Atualizar comentário para refletir redesign, não apenas extração.

---

## 7. Ordem de ataque v2

### Fase D — Limpeza (remover AI Approach Plan da página) (~30min)
- [ ] Remover `PropAiApproachPlanSection` de `PropFirmPage`
- [ ] Remover `phase` threading PropAccountCard → ... → prompt.js (migra para issue nova)
- [ ] Remover `useAssessment` / `useAiApproachPlan` de PropFirmPage
- [ ] PropAccountCard volta ao que era antes do threading (gauges + phase selector + alerts)
- [ ] Build OK, testes passando

### Fase E — Fix drawdownHistory MAX_DOCS (~20min)
- [ ] `useDrawdownHistory`: `MAX_DOCS = 100` → `1000` com prop `limit` opcional
- [ ] Teste smoke `useDrawdownHistory.test.js`
- [ ] Verificar que PropPayoutTracker continua correto

### Fase F — Decomposição + 4 zonas (~4h)
- [ ] Criar `PropStatusCard` (gauges + saldo + USD disponível hoje)
- [ ] Criar `TemplateCard` (regras da mesa)
- [ ] Criar `PlanoMecanicoCard` (plano determinístico + ViabilityBadge)
- [ ] Criar `ViabilityBadge` (6 estados + phase-aware) — unit tests
- [ ] Criar `PropEquityCurve` (Recharts, ResponsiveContainer)
- [ ] Criar `PropHistoricalKPIs` (dias operados, melhor/pior, consistency, tempo médio)
- [ ] Atualizar `PropFirmPage` para compor as 4 zonas (PropAlertsBanner + 4 zonas)
- [ ] Mover phase selector para header da página
- [ ] PropAccountCard: marcar como deprecated (arquivar) — consumidor zero pós-refactor
- [ ] DebugBadge `component="PropFirmPage"`
- [ ] Smoke test visual: renderiza 4 zonas sem erros

### Fase G — Renomear PropPayoutTracker "Simulador" → "Quando posso sacar?" (~15min)
- [ ] Renomear label do simulador
- [ ] Ajustar copy para linguagem de decisão (não "simulação")

### Fase H — Testes + validação (~1h)
- [ ] Testes regressão: suite completa passando
- [ ] Testes novos: viabilityBadge, propEquityCurve, useDrawdownHistory, PropFirmPage smoke
- [ ] Validação browser:
  - [ ] Aluno com conta PROP vê 4 zonas corretamente
  - [ ] Mobile (viewport < 768px): zonas empilham, grid 2-cols da Zona 3 vira 1-col
  - [ ] Conta em EVALUATION: ViabilityBadge texto com deadline
  - [ ] Conta em SIM_FUNDED: ViabilityBadge texto com preservação
  - [ ] PropEquityCurve plota corretamente com 100+ trades
  - [ ] Aluno sem conta PROP: item sidebar não aparece (regressão A+B)

---

## 8. Spec Review Gate (INV-18) — artefatos

**Iteração 1 (17/04/2026):**
- Marcio aponta: "Plano não deveria estar nessa página, muito menos permitir que ele rode
  outro plano. Preciso de uma explicação semântica."
- CC: apresenta diagnóstico (3 "planos" no app, níveis de abstração misturados, bug IA 3
  linhas) + proposta 3 zonas + Opção A/B/C.

**Iteração 2 (17/04/2026):**
- Marcio: Opção C + ressalvas (fonte EquityCurve, responsivo mobile, ViabilityBadge
  específico com 3-5 estados) + AI Plan sai da #145 para issue derivada + fix IA é hotfix
  separado imediato.
- CC: pesquisa as 3 ressalvas (drawdownHistory é fonte correta com fix MAX_DOCS;
  `grid-cols-1 md:grid-cols-2` é padrão canônico; 6 estados ViabilityBadge mapeados
  contra attackPlanCalculator).

**Iteração 3 — aguardando aprovação:**
- CC apresenta spec v2 (este documento §1-§7).
- Marcio revisa → aprova OR aponta nova divergência → loop.
- Após "go"/"aprovado" explícito: executar Fases D–H.

---

## 9. Gate Pré-Código

1. ✅ Issue #145 no GitHub
2. ✅ Worktree `~/projects/issue-145` (INV-16)
3. ✅ CHUNK-02 + CHUNK-17 locked em main (commit `8e6e9f1e`)
4. ⏳ **Aprovação INV-07 + INV-18** — spec v2 (§1–§7)

---

## 10. Issues derivadas

### 10.1 Nova issue (próximo número livre): "Tela dedicada Plano de Approach"
- **Escopo:** migrar PropAiApproachPlanSection + useAiApproachPlan para tela/tab
  dedicada (sub-rota `/propfirm/approach` ou tab dentro de Mesa Prop).
- **Gate de disponibilidade:** assessment 4D completo + 30+ trades com shadowBehavior
  (conexão com #131 Dashboard Emocional — ambos dependem de massa crítica de shadow data).
- **Dependências:** #145 Mesa Prop v2 merged + #131 evolução.
- **Abrir após:** encerramento #145.

### 10.2 Hotfix imediato (próximo número livre): "fix: phase missing em generatePropFirmApproachPlan"
- **Diagnóstico:** `functions/propFirm/generatePropFirmApproachPlan.js:77` não desestrutura
  `phase` do `context`; `:108` não passa para `buildUserPrompt`. Prompt em `prompt.js:110`
  espera `phase`, recebe `undefined`, IA gera estrutura fora do contrato → validação rejeita
  3× → fallback determinístico silencioso (aluno vê "IA indisponível" sem entender por quê).
- **Fix:** 3 linhas (desestruturar + propagar + testar).
- **Motivação:** degradação de serviço em produção não-reportada; usuários atuais geram
  determinístico mesmo com assessment 4D completo.
- **Escopo:** separado de #145 para deploy rápido. Sessão paralela recomendada
  (worktree `~/projects/issue-NNN`, commit, merge, deploy via Firebase CLI).
- **Abrir antes OU em paralelo a:** Fase D de #145.

---

## 11. Log da sessão

- **15/04/2026** — Abertura. Locks CHUNK-02/17 registrados em main (`8e6e9f1e`). Worktree criado. Arquivo de controle gerado. Aguardando aprovação Pré-Código.
- **15/04/2026** — Correção protocolo: versão v1.32.0 + PROJECT.md v0.20.0 reservados em main (`155bb102`) — ANTES do worktree, junto com locks. Worktree rebasado. Regra passa a ser obrigatória em toda abertura.

- **16/04/2026 — Fase A concluída:**
  - Criado `src/pages/PropFirmPage.jsx` com wrapper StudentContextProvider + body com ContextBar, PropAlertsBanner, PropAccountCard (com AI Approach Plan), PropPayoutTracker
  - Removido do `StudentDashboard.jsx`: imports PropAccountCard/PropAlertsBanner/PropPayoutTracker, hooks usePropFirmTemplates/useDrawdownHistory/useMovements/useAssessment, bloco JSX condicional prop (linhas ~369-474), import derivePropAlerts/getDangerAlerts
  - Dashboard agora genérico — zero condicional `type === 'PROP'`
  - DebugBadge `component="PropFirmPage"`
  - 1456/1456 testes passando, build OK

- **16/04/2026 — Fase B concluída:**
  - `src/App.jsx`: +import PropFirmPage, +case 'propfirm' no switch aluno, +useAccounts para detectar hasPropAccount, +prop hasPropAccount no Sidebar
  - `src/components/Sidebar.jsx`: +import Shield, +prop hasPropAccount, +item condicional "Mesa Prop" (icon Shield, entre Contas e Perfil de Maturidade)
  - Build OK, 1456/1456 testes passando
  - Bug Rules of Hooks corrigido: early return em PropFirmPageBody movido para DEPOIS de todos os hooks (useAccounts, usePlans, usePropFirmTemplates, useDrawdownHistory, useMovements, useAssessment, useMemo×3)

- **16/04/2026 — Sessão retomada + Fase C concluída:**
  - Fases A+B commitadas como `518e7fae`
  - Rebase sobre main (incorporou fix #146 — botão Novo Plano)
  - Fase C item 1 (sparkline): removida do card — sem escala/contexto, inútil como mini-dashboard
  - Fase C item 2 (attack plan phase-aware): `calculateMesaConstraints` agora usa `getActiveDrawdown(template, phase)` — SIM_FUNDED/LIVE usam `fundedDrawdown`
  - Fase C item 3 (AI approach plan phase-aware): `phase` threaded PropAccountCard → PropAiApproachPlanSection → useAiApproachPlan → prompt.js. Prompt condiciona narrativa e instrução 5 na fase
  - Fix: P&L dia removido do card (dado stale sem reset diário)
  - Fix: `tradingDays` derivado de `drawdownHistory` (datas únicas via `new Set`) — corrige contagem inflada por trades importados
  - Build OK, 1456/1456 testes passando
  - version.js atualizado para v1.32.0, CHANGELOG comment atualizado
  - Gate pré-entrega apresentado — aguarda validação browser do Marcio

- **17/04/2026 — Sessão pausada para retomada:**
  - **Estado:** Fases A+B+C completas e commitadas. Fase D (validação browser) pendente.
  - **Pendência única:** Marcio validar no browser → PR → merge → encerramento §4.3
  - **Commits na branch (5):**
    - `518e7fae` feat: PropFirmPage + Sidebar Mesa Prop + limpar Dashboard — Fases A+B
    - `d8de79dd` feat: Fase C — attack plan/AI phase-aware
    - `38996dc5` fix: remover P&L dia (stale) e sparkline DD (sem escala)
    - `88fc0850` fix: tradingDays derivado de drawdownHistory
    - `3f748c90` docs: atualizar issue doc + version.js para v1.32.0
  - **Para retomar:** `cd ~/projects/issue-145`, subir dev server `npx vite --port 5174`, validar browser, criar PR com `Closes #145`, executar §4.3
  - **Shared files pendentes no merge:** App.jsx (rota propfirm), Sidebar.jsx (item Mesa Prop), PROJECT.md (CHANGELOG [1.32.0])
  - **Bugs fora do scope (registrados no issue body):** bestDayProfit $0 (CF/CHUNK-04), deadline-exceeded CF AI (CF layer)

- **19/04/2026 — Execução Fases D–G (spec v2):**
  - Fase D (commit `bd41c68d`): removido PropAiApproachPlanSection da PropFirmPage + PropAccountCard (imports + props + render); reset de `phase` em prompt.js, useAiApproachPlan, PropAiApproachPlanSection para estado de main (3 linhas). attackPlanCalculator mantém phase-aware (mechanical plan, não IA — valor real preservado).
  - Fase E (commit `c16d5039`): `useDrawdownHistory.MAX_DOCS = 100 → 1000` + exportação `DEFAULT_LIMIT` + segundo parâmetro `options.limit` para override (sparkline pode pedir menos). 5 testes novos em `src/__tests__/hooks/useDrawdownHistory.test.js`.
  - Fase F (commit `0579fbde`): decomposição PropFirmPage em 4 zonas. Novos componentes:
    - `src/utils/propViabilityBadge.js` — lógica pura (6 estados + phase-aware)
    - `src/__tests__/utils/propViabilityBadge.test.js` — 11 testes
    - `src/components/dashboard/PropViabilityBadge.jsx` — UI do badge
    - `src/components/dashboard/TemplateCard.jsx` — regras da mesa (read-only)
    - `src/components/dashboard/PlanoMecanicoCard.jsx` — plano determinístico + ViabilityBadge
    - `src/components/dashboard/PropEquityCurve.jsx` — curva Recharts sobre drawdownHistory
    - `src/components/dashboard/PropHistoricalKPIs.jsx` — dias operados / best / worst / consistency
    - `PropFirmPage.jsx` refatorada com ZoneHeader + 4 sections + grid responsivo `grid-cols-1 md:grid-cols-2` na Zona 3. Calcula `attackPlan` via `calculateAttackPlan(template, null, null, profile, phase, symbol)`.
  - Fase G (commit `dbfaa946`): label `"Simulador de Saque"` → `"Quando posso sacar?"` em PropPayoutTracker (linguagem de decisão, não simulação).
  - Fase H (commits `435233bd` + `d468c7c6`): validação browser do Marcio encontrou 4 bugs + 1 detalhe:
    - Bug 1: PropHistoricalKPIs "Dias operados 4/30" em conta PA (denominador é conceito de EVALUATION) → gated por fase
    - Bug 2: TemplateCard "Daily loss limit $0" em Apex PA/Funded (null-safety) → "N/A (apenas Total Loss)" muted
    - Bug 3: propViabilityBadge dailyStop/0 = NaN/Infinity quando mesa sem daily loss → branch alternativo usando reserva saudável (drawdownMax × 0.3), texto "Stop de $X em DD de $Y · margem N perdas"
    - Bug 4: TemplateCard "Prazo avaliação 30 dias" visível em SIM_FUNDED → render condicional (só EVALUATION); consistency também gated por fase
    - Extra: TemplateCard "Firma —" vazio → template usa `firm` (ex: "APEX"), não `firmName` (campo do account); fallback chain corrigido
  - 2 testes novos em propViabilityBadge.test.js cobrindo `dailyLossLimit: null` (PA) e `dailyLossLimit: 0` (SIM_FUNDED). 1474/1474 passando.
  - **19/04/2026 — Validação browser aprovada pelo Marcio.** Pronto para push + PR.

- **19/04/2026 — Hotfix #149 cancelada:**
  - Abertura: diagnóstico inicial apontou `phase` ausente em desestruturação/propagação no handler da CF.
  - Verificação profunda revelou: main/produção tem **zero** ocorrências de `phase` nos arquivos CF (prompt.js, generatePropFirmApproachPlan.js, validate.js). Último deploy foi v1.29.0 (#133). Bug só existia na branch issue-145 por causa de commit `92d52858` (Fase C original).
  - Fix de 3 linhas seria no-op em prod; Opção C (Fase D) já removeu phase threading. Nada a fixar.
  - Issue #149 fechada em GitHub com comentário explicativo; commit de lock/versão (`346990db`) revertido em main (`15bc8e64`).
  - Queixa real do Marcio ("IA sempre indisponível") é UX: badge "Plano determinístico (IA indisponível)" idêntico em 3 cenários distintos (defaults / validação 3× / rate limit). Escopo movido para #148 (UX diferenciada de fallback agregada ao body da issue).
  - Se homework Marcio (logs Firebase + query Firestore) revelar ≥10% de rejeição por arredondamento: abrir #150 isolado (1 linha: MONEY_TOLERANCE 1→5 em validate.js).
  - Lição candidato a anti-pattern: "Premissa de produção assumida a partir de estado de worktree" — AP-09 potencial.

- **17/04/2026 — Retomada e Spec Review Gate (INV-18) — Opção C acordada:**
  - Rebase sobre origin/main (incorporou INV-17 + INV-18 via commit `7de1797c`). Branch com 6 commits em cima, zero conflito.
  - Marcio subiu dev server, validou Fases A+B (OK) + crítica substantiva às Fases C:
    - "Plano não deveria estar nessa página, muito menos permitir que ele rode outro plano"
    - "IA sempre indisponível, volta com determinístico — muito ruim"
    - Pediu explicação semântica + crítica de trader high-perf + ultraplan
  - CC diagnosticou: puxadinho de AI Approach Plan dentro de PropAccountCard (viola INV-17); três "planos" ambíguos no app; bug 3 linhas em `generatePropFirmApproachPlan.js` (`phase` não propagado).
  - Proposta: 3 zonas (evoluiu para 4 incluindo Payout) + decomposição PropAccountCard + AI sai para issue derivada + fix IA é hotfix.
  - **Opção C** aprovada: reverter commits de conteúdo, manter scaffolding, reescrever spec, passar pelo Spec Review Gate antes de recodificar.
  - Pesquisa complementar (3 ressalvas):
    - EquityCurve: `drawdownHistory` é fonte correta (campo `balance` per-trade); fix `MAX_DOCS = 100 → 1000` em useDrawdownHistory
    - Mobile: app é mobile-first; padrão `grid grid-cols-1 md:grid-cols-2` é canônico
    - ViabilityBadge: 6 estados concretos mapeados contra `attackPlanCalculator.js:200-425`, phase-aware por fase
  - Spec v2 escrita (§1–§7 deste documento).
  - **Aguardando aprovação explícita Marcio (INV-18 iteração 3)** para executar Fases D–H.
  - **Derivadas:** issue nova "Tela Plano de Approach" + hotfix "phase missing CF AI" (ver §10).

**Nota de protocolo (15/04/2026):** A partir desta sessão, a reserva de versão (`version.js` comment + `PROJECT.md` header bump + entrada na tabela histórica) é obrigatória na abertura §4.0 e deve ser commitada no main ANTES da criação do worktree, no mesmo commit dos locks (ou commit subsequente, desde que antes do worktree). O worktree nasce com a versão já reservada.
