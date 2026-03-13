## [1.19.4] - 2026-03-13

### Corrigido
- **DEC-009: riskPercent usa plan.pl (capital base) como denominador:** O cálculo de Risco Operacional (RO%) usava `plan.currentPl` (PL flutuante) como denominador em vez de `plan.pl` (capital base do ciclo). Isso distorcia o percentual de risco — ex: trade com loss R$885 sobre capital base R$200k mostrava 0.8% (calculado sobre currentPl=R$115k) em vez do correto 0.44%. Corrigido em `compliance.js` (frontend) e `functions/index.js` (CF). Consistente com DEC-007 que já usava `plan.pl` para RR assumido.
- **dailyLossPercent também corrigido:** O cálculo de loss diário percentual na CF (red flag DAILY_LOSS_EXCEEDED) sofria do mesmo bug — agora usa `plan.pl` como base.

### Adicionado
- **Card "Eficiência do Risco" no dashboard (Risk Asymmetry):** Novo card (6º) no MetricsCards exibindo a razão entre risco médio nos wins vs losses (W/L). Detecta o padrão comportamental onde o aluno arrisca menos quando acerta e mais quando perde — corroendo o edge mesmo com WR e RR conformes. Inclui RO Efficiency (% médio do RO utilizado), breakdown W/L em R$, barra de severidade visual, e tooltip de referência com escala (Excelente 0.9-1.1 / Bom 0.7-0.9 / Atenção 0.4-0.7 / Crítico <0.4).

### Modificado
- `compliance.js` v3.1.0: `planPl = plan.pl ?? plan.currentPl ?? 0` (antes: `plan.currentPl ?? plan.pl ?? 0`)
- `functions/index.js`: Mesma correção em `calculateTradeCompliance` (linha 305) e `dailyLossPercent` (linha 768)
- `dashboardMetrics.js`: Nova função `calculateRiskAsymmetry`
- `useDashboardMetrics.js`: Novo `useMemo` para `riskAsymmetry`
- `MetricsCards.jsx` v3.0.0: Grid 5→6 colunas, novo card com Shield icon, tooltip interativo, barra de severidade
- `StudentDashboard.jsx`: Passa `riskAsymmetry` prop para MetricsCards
- `version.js`: v1.19.4+20260313

### Testes
- 6 novos testes DEC-009: riskPercent sobre plan.pl com stop, sem stop (reproduz bug reportado), loss que excede RO, currentPl divergente não afeta resultado, fallback para currentPl em planos legados
- 13 novos testes `riskAsymmetry.test.js`: sizing consistente, assimetria clássica (caso 0.1x), sizing inverso, RO efficiency, sem wins/losses, breakeven, múltiplos planos, edge cases
- Testes existentes atualizados para consistência com DEC-009
