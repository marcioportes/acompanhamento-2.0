# Issue #282 — feat: Paridade de indicadores e nomenclatura Dashboard ↔ Fechamento de Ciclo

> Template enxuto (R4). Máx 400 linhas.

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento: EM ANDAMENTO**
- [x] Mockup apresentado (26/05/2026)
- [x] Memória de cálculo / dicionário de indicadores apresentado (26/05/2026)
- [x] Decisão de vocabulário: **TÉCNICO (label canônico) + tooltip didático** (Marcio, 26/05/2026) → DEC-AUTO-282-01
- [x] Marcio autorizou — "autorizado" (26/05/2026)
- [x] Gate Pré-Código liberado (26/05/2026)

## Context

Indicadores de performance/consistência de ciclo divergem entre dashboard (card "Consistência Operacional" #235 + `MetricsCards`) e o wizard de fechamento (#259, `Step1Read`): (a) Sharpe/CV norm./MEP médio/MEN médio existem só no dashboard; (b) métricas comuns têm nomes diferentes nos dois lugares. Causa raiz: cálculo por caminhos separados (sem fonte única). Objetivo: SSoT única de métricas + vocabulário canônico único + trazer os 4 indicadores ausentes para o fechamento.

## Spec
Ver issue body no GitHub: #282.

## Mockup

Padrão canônico = o do card "Consistência Operacional" (#235): `MetricTile` com **label técnico (uppercase)** + valor + dot colorido + bandLabel + **tooltip didático** no hover. Estados insuficientes mostram a mensagem (ex.: "Plano sem saldo inicial registrado").

Wizard `Step1Read` passa a renderizar **dois grupos** no mesmo padrão:

```
┌─ Leitura do ciclo ────────────────────────────────────────────┐
│ Resultado +14,4% · R$ 2.920   │ Como terminou: META BATIDA      │
│ Capital fim R$ 23.220         │ Atividade: 31 trades            │
├─ PERFORMANCE ─────────────────────────────────────────────────┤
│ EXPECTANCY (R)  WIN RATE   PAYOFF      PROFIT FACTOR            │
│   +1,01R          67,7%     1,94        4,15                    │
│ MAX DRAWDOWN    ADERÊNCIA                                       │
│   0,5%            100%                                          │
├─ CONSISTÊNCIA OPERACIONAL  (NOVO no fechamento) ──────────────┤
│ SHARPE         CV NORM.    MEP MÉDIO   MEN MÉDIO                │
│   2,3            0,59       +1,2%       −0,4%                   │
│ Excepcional    No plano    (hover: tooltip didático)           │
└────────────────────────────────────────────────────────────────┘
```

- Grupo PERFORMANCE: indicadores que já existem no Step1, **re-rotulados pro termo técnico** + tooltip didático (hoje têm rótulo didático sem tooltip).
- Grupo CONSISTÊNCIA: os 4 do dashboard, **idênticos** (mesmo componente, bandas, tooltips, badge Selic).
- Reuso: extrair `MetricTile` + funções de banda/tooltip/conteúdo pra módulo compartilhado (parte da SSoT) consumido por dashboard e wizard — zero duplicação.

## Memória de Cálculo

**Sem fórmula nova** — todos os cálculos já existem. Esta é a SSoT de inventário + nomenclatura: label técnico canônico, tooltip didático, fonte e faixa boa→ruim. A SSoT extrai os cálculos pra um módulo único; o wizard deixa de recalcular por conta própria.

### Grupo PERFORMANCE (fonte: `cycleClosure/cycleMetrics.js` + drawdown)
| Label técnico | Tooltip didático | Fonte | Faixa |
|---|---|---|---|
| Expectancy (R) | Ganho médio esperado por trade, em múltiplos de risco (R) | `metrics.expectancy_R` | >0,5 excelente / 0,2–0,5 bom / 0–0,2 frágil / <0 negativo |
| Win Rate | % de trades vencedores (taxa de acerto) | `metrics.winRate` | ≥40% saudável |
| Payoff | Quanto a vitória média vale vs a perda média (em R) | `avgWinR/avgLossR` | >1,5 robusto |
| Profit Factor | Soma dos lucros ÷ soma dos prejuízos | `metrics.profitFactor` | ≥1,5 sólido / ≥1 positivo / <1 negativo |
| Max Drawdown | Maior queda do capital de um pico ao fundo no ciclo | maxDD inline → SSoT | <20% bom |
| Aderência | % de trades dentro das regras do plano (RO/RR) | `computeRuleAdherenceRate` | ≥80% bom |

### Grupo CONSISTÊNCIA (fonte: `cycleConsistency/*` — NOVO no wizard)
| Label técnico | Tooltip didático | Fonte | Faixa / pré-condição |
|---|---|---|---|
| Sharpe | Retorno ajustado ao risco, com a Selic do dia descontada | `computeCycleSharpe` | ≥2 Excepcional / ≥1,5 Bom / ≥1 OK / ≥0 Fraco / <0 Negativo · **precisa `plan.pl` + ≥5 dias** |
| CV norm. | Consistência dos resultados diários vs o esperado pro plano | `computeCVNormalized` | <0,5 Suspeito / ≤1,2 No plano / ≤1,5 Lev. errático / ≤2 Errático / >2 Muito errático · **precisa `plan.rrTarget` + ≥5 dias** |
| MEP médio | Em média, quanto o trade chegou a favor (%) antes de fechar | `computeAvgExcursion` | maior = melhor · **coverage ≥0,7 de `mepPrice`** |
| MEN médio | Em média, quanto o trade foi contra (%) antes do desfecho | `computeAvgExcursion` | perto de 0 = melhor · **coverage ≥0,7 de `menPrice`** |

**Casos-limite:** <5 dias → Sharpe/CV "Insuficiente · ≥5 dias"; `plan.pl` ausente → Sharpe "Plano sem saldo inicial"; `plan.rrTarget` ausente → CV insuficiente; coverage <0,7 → MEP/MEN com aviso "⚠ em N de M trades". Wizard usa a MESMA janela `cycleStart..cycleEnd` do ciclo sendo fechado (não depende de `selectedCycle` do dashboard).

## Phases
- [x] A1 — SSoT de apresentação `src/components/metrics/cycleMetricTiles.jsx` (MetricTile + themes/contents/tooltips de consistência extraídos do #235 + content fns novas de performance, técnico+tooltip).
- [x] A2 — Dashboard `CycleConsistencyCard` consome a SSoT (removidas ~240 linhas locais), sem regressão visual.
- [x] A3 — Wizard `Step1Read`: grupo Performance re-rotulado pro técnico+tooltip + grupo Consistência (Sharpe/CV/MEP/MEN) via `useCycleConsistency` + breakdown do TPS re-rotulado pro técnico.

## Sessions
- `A1 [ssot-module] cycleMetricTiles.jsx + 11 testes ok`
- `A2 [dashboard-refactor] CycleConsistencyCard importa SSoT — 7 testes card verdes (sem regressão)`
- `A3 [wizard-parity] Step1Read 2 grupos + TPS técnico + 3 testes de render ok`
- Build vite ok · suíte completa 3258/3258 verde

## Shared Deltas
- `src/version.js` — bump v1.66.0 (reservado na abertura).
- `docs/registry/versions.md` — marcar v1.66.0 consumida no encerramento.
- `docs/registry/chunks.md` — liberar CHUNK-02 no encerramento.
- `CHANGELOG.md` — nova entrada `[1.66.0] - DD/MM/YYYY`.
- `docs/PROJECT.md` — avaliar nota de SSoT de métricas (se aplicável).

## Decisions
_(IDs a registrar — texto em docs/decisions.md no encerramento)_
- DEC-AUTO-282-01 — Vocabulário canônico = label TÉCNICO + tooltip didático nos dois lugares (dashboard e wizard). Decidido por Marcio, 26/05/2026.
- DEC-AUTO-282-02 — Métricas de consistência no wizard são display-time (calculadas on-the-fly via `useCycleConsistency`), NÃO entram no `frozenSnapshot` — evita tocar contrato C4 e INV-15.
- DEC-AUTO-282-03 — Breakdown do TPS re-rotulado pro vocabulário técnico (Profit Factor/Max Drawdown/Expectancy (R)/Aderência) p/ coerência na mesma tela; "Consistência semanal" mantida (métrica própria do TPS sem conflito).
- DT — drawdown ainda calculado em 2 lugares (maxDD inline no Step1 vs `dashboardMetrics`); unificação adiada (fora do escopo, baixo risco).

## Chunks
- CHUNK-02 (Student Management) — ESCRITA — dashboard do aluno + wizard de fechamento + camada de apresentação/SSoT de métricas.
- CHUNK-03 (Plan), CHUNK-05 (Compliance), CHUNK-06 (Emotional) — LEITURA apenas (consome `plan.pl/rrTarget/riskPerOperation`, aderência, dados emocionais; não altera engines).
