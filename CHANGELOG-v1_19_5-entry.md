## [1.19.5] - 2026-03-15

### Adicionado
- **Layout agrupado 3 paineis no dashboard:** MetricsCards v4.1.0 reorganiza 7 cards em 3 paineis tematicos — Financeiro (Saldo, P&L, Expectancy, Drawdown, PF), Assimetria de Risco (WR, WR Planejado, Risco W/L, RO medio), EV (EV esperado vs EV real, gap, perda acumulada). Grid responsivo lg:grid-cols-3.
- **Tooltips diagnosticos dinamicos:** Cada painel tem botao (i) que abre tooltip com conclusoes geradas com base nos dados reais — ex: "Acerta 80% mas so 20% atingem o alvo — ansiedade de saida", "Causa principal: sizing inconsistente". Novo util `metricsInsights.js` com 3 geradores (financial, performance, planVsResult).
- **Trades sem stop assumem RO$ do plano:** `calculateRiskAsymmetry` agora atribui `plan.riskPerOperation` como risco para trades sem `riskPercent` (sem stop loss). Elimina "N/D" e "0.00x" no card de assimetria.
- **Numero de trades no card EV:** Exibe contagem ao lado de "Perda acumulada" para o mentor fechar a conta mentalmente.

### Corrigido
- **NaN guards em dashboardMetrics.js:** `Number()` + `isNaN()` + `isFinite()` em todos os inputs de `calculateRiskAsymmetry`. Previne "NaNx" e "NaN%" em planos com dados incompletos.
- **NaN guards em MetricsCards.jsx:** Helper `safe()` com fallback "-" em todos os `.toFixed()` da UI.
- **Sinal do EV leakage:** 90% de perda agora mostra "90%" (nao "-90%").
- **Tooltips nativos restaurados:** `title` attributes de Drawdown (data pior vale), Profit Factor (trades sem violacoes), Win Rate (WR planejado detalhado) que foram perdidos na refatoracao v1.19.4.

### Modificado
- `MetricsCards.jsx` v4.1.0: Rewrite completo — 3 paineis, tooltips diagnosticos, NaN guards
- `metricsInsights.js` (novo): getFinancialInsights, getPerformanceInsights, getPlanVsResultInsights
- `dashboardMetrics.js`: NaN guards + trades sem stop assumem RO$
- `riskAsymmetry.test.js`: Teste atualizado para nova semantica (assume RO$ em vez de ignorar)
- `version.js`: v1.19.5+20260315

### Testes
- 15 novos testes `metricsInsights.test.js`: insights financeiros (expectancy +/-, drawdown, PF), desempenho (ansiedade saida, sizing critico/consistente, compliance), plano vs resultado (leakage critico, superando, diagnostico causas combinadas)
- `riskAsymmetry.test.js`: 1 teste atualizado (sem stop assume RO$)
