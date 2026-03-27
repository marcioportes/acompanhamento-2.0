# CONTINUITY — Sessao 18/03/2026

## Versao: 1.19.6+20260318

## Resumo
Investigacao completa dos indicadores do painel Assimetria de Risco a partir dos fontes em producao.
Descoberta que "Risco W/L" nao era Payoff (avgWin/avgLoss) mas sim Risk Asymmetry Ratio (avgRiskWins/avgRiskLosses),
"RO medio" nao era Resultado Operacional mas sim RO Efficiency (% do risco planejado utilizado),
e W:/L: eram medias de risco assumido, nao de resultado.

## Alteracoes realizadas

### A) Payoff com semaforo de saude do edge
- Nova funcao `calculatePayoff` em dashboardMetrics.js
- Semaforo: verde >=1.5, amarelo 1.0-1.5, vermelho <1.0
- Tooltip nativo com diagnostico de sustentabilidade do edge + WR minimo para breakeven
- Exibido no painel Assimetria de Risco, grid superior ao lado do Win Rate

### B) Diagnostico contextual da assimetria
- Novo `asymmetryDiagnostic` memo no hook (conta wins sem stop, losses over risk)
- `getPerformanceInsights` gera textos contextuais quando ratio < 1:
  - Losses que extrapolaram risco planejado
  - Wins sem stop (risco estimado)
  - Sizing real inconsistente

### C) Semaforo RO bidirecional
- Antes: >60% = verde (tratava >100% como excelente)
- Agora: 80-100% verde, 60-79% amarelo, <60% vermelho, 101-120% amarelo, >120% vermelho
- Icone AlertTriangle quando >100%
- Insight de extrapolacao no tooltip

### D) Cor PL Atual no ExtractSummary
- Antes: `currentPL >= startPL ? verde : vermelho` (errado — PL R$7.874 sobre R$8.000 ficava vermelho)
- Agora: verde (totalPnL >= 0), amarelo (totalPnL < 0 mas currentPL > 0), vermelho (currentPL <= 0)

### E) Labels
- "RO medio" → "Utiliz. RO"
- "Risco W/L" mantido na posicao nova (secao inferior do painel, ao lado de Utiliz. RO)
- Removido header "QUALIDADE DE EXECUCAO" — secao separada apenas por border-t
- Payoff W:/L: = medias de resultado; Risco W/L W:/L: = medias de risco assumido

## Layout do painel Assimetria de Risco (v5.0.0)
```
┌────────────────────────────────────┐
│  Win Rate     │  Payoff            │
│  (+ planejado)│  (+ W: avgWin      │
│               │    L: avgLoss)     │
├────────────────────────────────────┤
│  Risco W/L    │  Utiliz. RO        │
│  (+ W: L:     │  [barra + %]       │
│    risco medio)                    │
└────────────────────────────────────┘
```

## Arquivos modificados
- src/utils/dashboardMetrics.js (calculatePayoff)
- src/hooks/useDashboardMetrics.js (payoff + asymmetryDiagnostic)
- src/utils/metricsInsights.js (diagnostico assimetria + RO overuse)
- src/components/dashboard/MetricsCards.jsx v5.0.0
- src/components/extract/ExtractSummary.jsx v2.1.0
- src/pages/StudentDashboard.jsx (props)
- src/version.js
- src/__tests__/utils/v1196-payoff-ro-plcolor.test.js (23 testes novos)

## Testes
- Baseline: 406 testes (19 suites)
- Final: 429 testes (21 suites) — 23 novos, zero regressao
- Falha pre-existente: csvParser.test.js (papaparse nao instalado no ambiente de teste)

## Decisoes pendentes / backlog
- Payoff tooltip em producao: calibrar thresholds (1.0/1.5) com dados reais de alunos
- Consistencia de Risco: precisao aumenta com importacao de ordens (stop real vs estimado)
- DebugBadge no ExtractSummary: nao adicionado (sub-componente sem badge proprio, conforme padrao)
