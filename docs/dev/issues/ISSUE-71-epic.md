# Issue #71: Recálculo em Cascata, Visibilidade Mentor e P&L Contextual

**Versão alvo:** v1.19.0
**Tipo:** Epic (5 sub-tasks)
**Prioridade:** Alta
**Módulos impactados:** Cloud Functions, compliance, tradeCalculations, PlanLedgerExtract, StudentDashboard, StudentsManagement

---

## Contexto

O sistema hoje tem lacunas na integridade dos cálculos quando trades ou planos são editados após a criação, na visibilidade do mentor sobre dados emocionais do aluno, e na clareza do P&L exibido no dashboard. Esta issue agrupa 5 sub-tasks que endereçam esses problemas de forma coesa.

---

## B1: Recálculo em Cascata (Compliance + Alertas Emocionais)

### Problema
Quando um trade é **editado** (preço, qty, side) ou um plano é **ajustado** (RO, stops, metas), os indicadores de compliance e alertas emocionais não são recalculados. O aluno vê dados stale até que um novo trade seja criado.

### Solução
- `onTradeUpdated` (Cloud Function): recalcular compliance rate, PL do plano, e re-disparar alertas emocionais
- `onPlanUpdated` (novo trigger ou extensão): recalcular compliance de todos os trades do ciclo ativo quando parâmetros de risco mudam (RO, stops)
- Garantir que edição de trade recalcula: PL cascata, compliance rate, emotional scoring

### Arquivos impactados
- `functions/index.js` — onTradeUpdated, possível onPlanUpdated
- `compliance.js` — recálculo batch
- `useTrades.js` — updateTrade trigger
- `usePlans.js` — updatePlan trigger

---

## B2: RR Assumido (Quando Sem Stop Loss)

### Problema
Trades sem stop loss não têm Risk/Reward (RR) calculado. O mentor não consegue avaliar a qualidade da entrada. O campo stopLoss é opcional no sistema (decisão de design), mas isso não deveria impedir o cálculo de RR.

### Solução
- Quando `stopLoss` é null/undefined, calcular **RR assumido** usando: `stop teórico = entry ± (entry * RO%)`, onde RO% vem do plano vinculado
- Flag `rrAssumed: true` no trade para rastreabilidade
- Exibir no PlanLedgerExtract com badge "(assumido)"
- RR assumido = `|entry - exit| / |entry - stopTeórico|`

### Arquivos impactados
- `tradeCalculations.js` — nova função `calculateAssumedRR`
- `PlanLedgerExtract.jsx` — exibir RR com badge
- `ExtractTable.jsx` — coluna RR
- `ExtractSummary.jsx` — RR médio no header

---

## B3: Acesso Mentor ao Emocional do Aluno

### Problema
O mentor só acessa `StudentEmotionalDetail` quando há feedback pendente (via fluxo de feedback). Não consegue ver o perfil emocional do aluno proativamente para orientação.

### Solução
- Adicionar acesso direto ao emocional do aluno a partir de:
  - `StudentsManagement` — botão/link no card do aluno
  - `PlanLedgerExtract` — link no trade individual
- Não exigir feedback pendente como pré-condição
- Manter read-only para o mentor (não edita emoções do aluno)

### Arquivos impactados
- `StudentsManagement.jsx` — botão acesso emocional
- `StudentDashboard.jsx` — rota/modal emocional
- `TradeDetailModal.jsx` — link para emocional

---

## B4: PlanLedgerExtract — RO/RR no Header e Navegação Feedback

### Problema
O extrato do plano (PlanLedgerExtract) não mostra RO e RR no header/resumo, obrigando o mentor a calcular mentalmente. Também não há navegação direta do grid para o feedback do trade.

### Solução
- **Header/Resumo:** Exibir RO (configurado no plano), RR alvo, RR médio realizado, RR assumido médio
- **Grid:** Coluna RR por trade (real ou assumido com badge)
- **Navegação:** Clicar no trade no grid abre TradeDetailModal com aba de feedback

### Arquivos impactados
- `PlanLedgerExtract.jsx` — header com RO/RR
- `ExtractSummary.jsx` — métricas RR
- `ExtractTable.jsx` — coluna RR, link feedback
- `TradeDetailModal.jsx` — navegação

---

## B5: P&L Acumulado Contextual no Dashboard do Aluno

### Problema
O P&L acumulado exibido no dashboard do aluno não informa **qual período** está sendo acumulado. O aluno não sabe se está vendo o P&L do ciclo, do mês, ou de todo o histórico. Deve ser compatível com:
1. O **ciclo ativo** do plano (quando não há filtro manual)
2. A **seleção de filtros** do dashboard (quando o aluno filtra por período)

### Solução
- Exibir label contextual no card de P&L: "P&L do Ciclo (Semanal: 03/03 - 07/03)" ou "P&L Filtrado (Este Mês)" ou "P&L Total"
- Lógica de prioridade:
  1. Se há filtro de período ativo → P&L respeita o filtro, label mostra o período filtrado
  2. Se não há filtro → P&L acumula o ciclo ativo do plano selecionado, label mostra tipo e datas do ciclo
  3. Se não há plano selecionado → P&L total, label "Todos os períodos"
- O P&L deve recalcular dinamicamente quando o filtro muda

### Arquivos impactados
- `StudentDashboard.jsx` — lógica de contexto do P&L
- `DashboardHeader.jsx` ou `MetricsCards.jsx` — label contextual
- `useDashboardMetrics.js` — cálculo de P&L por contexto
- `PlanCardGrid.jsx` — indicar ciclo ativo

---

## Acceptance Criteria (Global)

- [ ] B1: Editar trade recalcula PL, compliance e alertas emocionais em cascata
- [ ] B1: Editar plano (RO, stops) recalcula compliance de todos os trades do ciclo
- [ ] B2: Trades sem stop mostram RR assumido com badge "(assumido)"
- [ ] B2: RR assumido usa RO% do plano como base de cálculo
- [ ] B3: Mentor acessa emocional do aluno sem feedback pendente
- [ ] B3: Acesso via StudentsManagement e PlanLedgerExtract
- [ ] B4: Header do extrato mostra RO, RR alvo, RR médio, RR assumido médio
- [ ] B4: Grid do extrato tem coluna RR com navegação para feedback
- [ ] B5: P&L acumulado mostra label de contexto (ciclo/filtro/total)
- [ ] B5: P&L muda dinamicamente com filtros do dashboard
- [ ] B5: P&L sem filtro acumula pelo ciclo ativo do plano
- [ ] Testes de regressão para cada sub-task
- [ ] Zero quebra em Cloud Functions existentes
- [ ] CHANGELOG atualizado (INV-08)
- [ ] DebugBadge em componentes novos/tocados (INV-04)

---

## Dependências

- v1.18.1 mergeada ✅
- State machine de ciclos documentada (DEC-002, v1.17.0)
- DT-002 (cycle transitions sem fechamento formal) — pode ser pré-requisito de B5

---

## Estimativa

| Sub-task | Estimativa | Complexidade |
|----------|-----------|-------------|
| B1: Recálculo cascata | 4-6h | Alta (CF + hooks) |
| B2: RR assumido | 2-3h | Média |
| B3: Acesso mentor emocional | 2-3h | Média |
| B4: PlanLedgerExtract RO/RR | 3-4h | Média |
| B5: P&L contextual | 3-4h | Média-Alta |
| **Total** | **14-20h** | |

---

## Ordem de implementação sugerida

1. **B2** (RR assumido) — base de cálculo usada por B4
2. **B4** (PlanLedgerExtract) — depende de B2
3. **B1** (Recálculo cascata) — impacta tudo, melhor fazer com B2/B4 estáveis
4. **B5** (P&L contextual) — independente, pode ser paralelo
5. **B3** (Acesso mentor) — UI only, menor risco
