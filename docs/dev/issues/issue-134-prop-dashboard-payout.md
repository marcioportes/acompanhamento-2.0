# Issue #134 — feat: Dashboard card prop + alertas visuais + payout tracking

> **Branch:** `feat/issue-134-prop-dashboard-payout`
> **Worktree:** `~/projects/issue-134`
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Prioridade:** ALTA — fecha Fases 3/4 do epic #52
> **Versão base:** PROJECT.md v0.13.0, version.js v1.26.4
> **Data abertura:** 13/04/2026

---

## 1. CONTEXTO

Epic #52 (Prop Firms) tem 4 fases. Fases 1, 1.5 e 2 estão entregues (v1.25.0). Fase 2.5 parcial entregue (#136 v1.26.1-v1.26.4 — correção semântica + Ylos + TRAILING_TO_STATIC). Faltam **Fases 3 e 4**: experiência visual (dashboard card, alertas, gauges) e payout tracking.

O backend está completo:
- Engine de drawdown: 5 tipos (TRAILING_INTRADAY, TRAILING_EOD, STATIC, TRAILING_WITH_LOCK, TRAILING_TO_STATIC)
- CFs: onTradeCreated/Updated/Deleted recalculam `account.propFirm.*` via transação atômica
- Subcollection `drawdownHistory`: append-only, populada por CFs, sem leitura no frontend ainda
- Notificações: `notifyPropFirmFlag()` já cria notificações throttled (1×/flag/dia) para DD_NEAR, ACCOUNT_BUST, DAILY_LOSS_HIT
- Templates: Apex, MFF, Lucid, Ylos (25K-300K + Freedom)
- Helper: `calculateEvalDaysRemaining()` + `isEvalDeadlineNear()` já existem e testados

O que falta é o aluno e o mentor **verem** esses dados.

---

## 2. ANÁLISE DE IMPACTO

### 2.1 Checklist de Impacto

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | Collections tocadas? | `accounts` (leitura propFirm), `accounts/{id}/drawdownHistory` (leitura), `trades` (leitura — tempo médio), `propFirmTemplates` (leitura), `notifications` (leitura) |
| 2 | Cloud Functions disparam? | Nenhuma CF nova. CFs existentes (onTrade*) já populam drawdownHistory e notifications. Fase 4 pode precisar de CF para payout eligibility — analisar. |
| 3 | Hooks/listeners afetados? | `useAccounts` (já carrega propFirm), `useNotifications` (já existe), `usePropFirmTemplates` (já existe). Novos hooks: `useDrawdownHistory` (leitura subcollection) |
| 4 | Side-effects em PL, compliance, emotional? | Nenhum — esta issue é 100% leitura + apresentação |
| 5 | Dados parciais/inválidos no caminho crítico? | Contas sem propFirm (type !== PROP) devem ser ignoradas. Guard: `if (!account.propFirm) return null` |
| 6 | Invariantes respeitadas? | INV-04 (DebugBadge), INV-06 (datas BR), INV-12 (N/A), INV-16 (worktree ativo) |
| 7 | Blast radius se algo der errado? | BAIXO — tudo é UI de leitura. Pior caso: card não renderiza, fallback para dashboard sem card |
| 8 | Rollback viável? | Sim — revert do merge remove card/alertas, zero impacto no backend |
| 9 | Testes existentes que podem quebrar? | Nenhum — não toca engine nem CFs |
| 10 | DebugBadge em componentes novos? | Sim — todos os componentes novos |

### 2.2 Componentes que existem e serão reutilizados

| Componente/Hook | Arquivo | O que fornece |
|-----------------|---------|---------------|
| `useAccounts` | `src/hooks/useAccounts.js` | `account.propFirm.*` (peakBalance, currentDrawdownThreshold, distanceToDD, flags, phase, tradingDays, isDayPaused, dailyPnL, trailFrozen, evalDeadline) |
| `usePropFirmTemplates` | `src/hooks/usePropFirmTemplates.js` | Templates com regras da mesa (drawdownMax, profitTarget, dailyLossLimit, payout.*) |
| `useNotifications` | `src/hooks/useNotifications.js` | Notificações já criadas pelas CFs (DD_NEAR, ACCOUNT_BUST, etc.) |
| `calculateEvalDaysRemaining` | `src/utils/propFirmDrawdownEngine.js` | Dias restantes da eval (já testado, 8 testes) |
| `isEvalDeadlineNear` | `src/utils/propFirmDrawdownEngine.js` | Flag se deadline < 7 dias |
| `MetricsCards` | `src/components/dashboard/MetricsCards.jsx` | v5.0.0 — 3 paineis (Financeiro, Assimetria, EV). Ponto de extensão para tempo médio de trades |
| `StudentDashboard` | `src/pages/StudentDashboard.jsx` | v3.0.0 — ponto de inserção do card prop |
| `PROP_FIRM_PHASES` | `src/constants/propFirmDefaults.js` | Constantes de fase (EVALUATION, SIM_FUNDED, LIVE, EXPIRED) |
| `DRAWDOWN_FLAGS` | `src/constants/propFirmDefaults.js` | Flags (DD_NEAR, ACCOUNT_BUST, DAILY_LOSS_HIT, LOCK_ACTIVATED, TRAIL_FROZEN, EVAL_DEADLINE_NEAR) |

### 2.3 O que precisa ser criado

| Artefato | Tipo | Descrição |
|----------|------|-----------|
| `PropAccountCard` | componente | Card dedicado para conta PROP no dashboard (gauges, alertas, countdown) |
| `useDrawdownHistory` | hook | Leitura da subcollection `accounts/{id}/drawdownHistory` (para sparkline) |
| `PropPayoutTracker` | componente | Tracking de qualifying days, payout eligibility, simulador de saque |
| Extensão `MetricsCards` | delta | Tempo médio de trades (universal, todas as contas) |

---

## 3. SHARED FILES

| Arquivo | Delta proposto | Protocolo |
|---------|---------------|-----------|
| `src/pages/StudentDashboard.jsx` | Importar e renderizar `PropAccountCard` quando conta selecionada é PROP | Delta documentado, aguardar aprovação |
| `src/components/dashboard/MetricsCards.jsx` | Adicionar painel "Tempo Médio" (universal) | Delta documentado, aguardar aprovação |
| `src/version.js` | Bump para v1.27.0 | Gate pré-entrega |
| `docs/PROJECT.md` | DECs novas + CHANGELOG | Gate pré-entrega |

---

## 4. PROPOSTA DE FASEAMENTO

### Fase A — PropAccountCard (core)
- Componente `PropAccountCard` com:
  - Header: firmName + productName + phase badge (EVALUATION/SIM_FUNDED/LIVE)
  - Gauge 1: Drawdown (distanceToDD como barra, currentDrawdownThreshold vs balance)
  - Gauge 2: Profit vs Target (currentProfit / profitTarget)
  - Gauge 3: Eval countdown (dias restantes, vermelho se < 7)
  - Daily P&L vs daily loss limit (contas com dailyLossLimit, flag isDayPaused)
  - Consistency check visual (bestDayProfit vs 50% do profitTarget)
  - Contracts: atual vs max
- Integrar no StudentDashboard (renderiza quando conta PROP selecionada)
- DebugBadge, testes

### Fase B — Alertas visuais (3 níveis)
- **Vermelho (mesa):** DD_NEAR, ACCOUNT_BUST, DAILY_LOSS_HIT — risco de perder a conta
- **Amarelo (plano):** consistency prestes a violar, RR abaixo do mínimo — risco de descumprir o plano
- **Informativo (ataque):** nudge operacional ("5 dias restantes, faltam $800 para target")
- Lógica de derivação dos alertas a partir de `account.propFirm.flags` + cálculos locais
- As notificações ao mentor já são criadas pelas CFs (notifyPropFirmFlag) — Fase B apenas exibe

### Fase C — Sparkline + Tempo Médio
- Hook `useDrawdownHistory` para ler subcollection `accounts/{id}/drawdownHistory`
- Sparkline da evolução do drawdown threshold ao longo dos trades
- Tempo médio de trades nos MetricsCards (universal, todas as contas — não só PROP)
- No card prop: contextualização do tempo médio ("scalping", "day trade", etc.)

### Fase D — Payout Tracking (Fase 4 do epic)
- Qualifying days tracker (dias com profit entre min-max qualifying)
- Payout eligibility calculator (min days, qualifying days, min amount, consistency)
- Simulador: "Se eu sacar X, meu novo drawdown threshold será Y"
- Registro de payouts realizados (campo em account.propFirm ou subcollection)

---

## 5. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-17 | escrita | PropAccountCard, PropPayoutTracker, useDrawdownHistory |
| CHUNK-02 | escrita | StudentDashboard — inserção do card, MetricsCards — tempo médio |
| CHUNK-04 | leitura | trades — cálculo de tempo médio |

Locks registrados em PROJECT.md §6.3: CHUNK-17, CHUNK-02 (escrita).

---

## 6. ACCEPTANCE CRITERIA

### Fase 3
- [ ] PropAccountCard com gauges visuais (DD, profit/target, eval countdown)
- [ ] Indicador daily P&L vs daily loss limit (contas EOD)
- [ ] 3 níveis de alerta visual (vermelho/amarelo/informativo)
- [ ] Alertas do mentor exibidos (notificações já existem via CF)
- [ ] Sparkline drawdown via drawdownHistory
- [ ] Tempo médio de trades nos MetricsCards (universal)
- [ ] Countdown eval deadline na UI
- [ ] DebugBadge em todos os componentes novos (INV-04)
- [ ] Testes

### Fase 4
- [ ] Qualifying days tracker
- [ ] Payout eligibility calc
- [ ] Simulador de saque
- [ ] Registro de payouts realizados
- [ ] Testes

---

## 7. RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| drawdownHistory vazio (contas sem trades) | ALTA | Guard: se vazio, mostrar "Nenhum trade registrado" em vez de sparkline |
| Conta PROP sem template (templateId inválido) | BAIXA | Guard: fallback para dados raw de account.propFirm |
| Performance: sparkline com muitos pontos | BAIXA | Limitar query a últimos 100 docs da subcollection |
| Fase D (payout) requer campo novo em account.propFirm | MÉDIA | INV-15 gate: propor e aguardar aprovação antes de implementar |
