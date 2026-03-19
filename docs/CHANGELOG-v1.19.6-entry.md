## [1.19.6] - 2026-03-18

### Adicionado
- **Payoff com semaforo de saude do edge:** Novo indicador `calculatePayoff` (avgWin/avgLoss) com cor semantica — verde (≥1.5, edge sustentavel), amarelo (1.0-1.5, edge fragil), vermelho (<1.0, sem edge). Tooltip nativo explica a saude do edge e informa WR minimo para breakeven
- **Diagnostico contextual da assimetria:** Quando Consistencia de Risco < 1.0, tooltip (i) agora explica a causa — losses que extrapolaram o risco planejado, wins sem stop com risco estimado, ou sizing real inconsistente. Novo `asymmetryDiagnostic` no hook
- **Insight de extrapolacao de RO:** Tooltip de desempenho agora alerta quando RO medio > 100% (leve) ou > 120% (severa)

### Corrigido
- **Semaforo RO bidirecional:** Barra de Utiliz. RO agora penaliza extrapolacao (>100% amarelo, >120% vermelho) em vez de tratar como "excelente". Icone ⚠ quando > 100%
- **PL Atual tricolor no ExtractSummary:** Antes comparava com PL inicial (vermelho se menor). Agora: verde (resultado positivo), amarelo (resultado negativo mas PL positivo), vermelho (capital zerado)

### Modificado
- `dashboardMetrics.js`: Nova funcao `calculatePayoff` exportada
- `useDashboardMetrics.js`: Novos memos `payoff` e `asymmetryDiagnostic`
- `metricsInsights.js`: `getPerformanceInsights` aceita `asymmetryDiagnostic`, gera insights de causa da assimetria e extrapolacao de RO
- `MetricsCards.jsx` v5.0.0: Layout reorganizado — WR+Payoff no grid superior, secao "Qualidade de Execucao" com Consistencia de Risco + Utiliz. RO. Labels renomeados (Risco W/L → Consistencia de Risco, RO medio → Utiliz. RO)
- `ExtractSummary.jsx` v2.1.0: Cor PL Atual tricolor
- `StudentDashboard.jsx`: Props `payoff` e `asymmetryDiagnostic` propagadas ao MetricsCards
- `version.js`: v1.19.6+20260318

### Testes
- 23 novos testes: calculatePayoff (9), diagnostico assimetria (5), semaforo RO bidirecional (4), cor PL Atual (5)
- 429+ testes totais (21 suites), zero regressao

---
