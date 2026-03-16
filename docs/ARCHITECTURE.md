# ARCHITECTURE.md — Atualizado Sessao 14-15/03/2026

## Secao 5 (Decision Log) — Adicionar:

### DEC-008: Navegacao Contextual Feedback <-> Extrato (12/03/2026)
**Problema:** Ao clicar feedback no extrato do plano e voltar, o extrato fechava e o usuario voltava ao dashboard. O componente StudentDashboard desmontava quando App.jsx renderizava FeedbackPage, perdendo o state `ledgerPlan`.
**Decisao:** Flag `_fromLedgerPlanId` enriquecida no trade pelo StudentDashboard apenas quando a navegacao vem do PlanLedgerExtract. App.jsx inspeciona a flag: se presente, guarda `feedbackReturnPlanId`; se ausente (veio do dashboard), nao guarda. Ao voltar, useEffect no StudentDashboard reabre o extrato via `setLedgerPlan`.
**Impacto:** App.jsx (state + props), StudentDashboard (props + useEffect + callback enrichment). Zero impacto em collections/CF.

### DEC-009: riskPercent usa plan.pl como denominador (14/03/2026)
**Problema:** Calculo de RO% usava plan.currentPl (PL flutuante, potencialmente corrompido) como denominador. Trade com loss R$885 sobre capital R$200k mostrava 0.8% (sobre currentPl=R$115k) em vez de 0.44%.
**Decisao:** planPl = plan.pl ?? plan.currentPl ?? 0. Capital base (plan.pl) eh o denominador primario. Fallback para currentPl apenas em planos legados sem campo pl.
**Impacto:** compliance.js (frontend), functions/index.js (calculateTradeCompliance + dailyLossPercent). Zero impacto em collections. Correcao de dados via salvar plano ou auditoria.
**Consistencia:** Alinha com DEC-007 que ja usava plan.pl para RR assumido.

### DEC-010: EV esperado e EV real (15/03/2026)
**Problema:** Nao existia metrica que quantificasse quanto do potencial do plano o aluno captura.
**Decisao:**
- EV esperado (teorico) = RO$ x (WR x rrTarget - LossRate). Usa RO$ fixo do plano.
- EV real = soma(resultados) / total_trades (Expectancy).
- Trades sem stop: risco assumido = plan.riskPerOperation (RO$ do plano).
- Leakage = 1 - (EV_real / EV_esperado). Mede % do edge perdido na execucao.
**Impacto:** dashboardMetrics.js (calculateEVLeakage, calculateRiskAsymmetry), MetricsCards.jsx, metricsInsights.js. Zero impacto em Firestore/CF — calculos client-side puros.

### DEC-011: Layout MetricsCards agrupado (15/03/2026)
**Problema:** 7 cards individuais ocupavam espaco excessivo e nao comunicavam diagnostico ao mentor.
**Decisao:** 3 paineis tematicos (Financeiro / Assimetria de Risco / EV) com tooltips diagnosticos dinamicos. Cada painel tem botao (i) que gera conclusoes acionaveis baseadas nos dados.
**Impacto:** MetricsCards.jsx v4.1.0 (rewrite), metricsInsights.js (novo). Grid: grid-cols-1 lg:grid-cols-3.

## Secao 6 (Dividas Tecnicas) — Atualizar:

- DT-010: **RESOLVIDO** v1.19.1
- DT-013: **RESOLVIDO** v1.19.2
- DT-014: **RESOLVIDO** v1.19.1
- DT-017: **RESOLVIDO** v1.19.2

### Adicionar:
- DT-020: CF scheduled para limpeza diaria da staging area (csvStagingTrades) as 23h. Trades nao convertidos sao deletados. Aluno deve reimportar se necessario.

## Secao 8 (Historico de Versoes) — Adicionar:

| v1.19.5 | Mar/2026 | Layout 3 paineis agrupados, tooltips diagnosticos, NaN guards, trades sem stop assumem RO$, metricsInsights.js, paste imagem AddTradeModal |
| v1.19.4 | Mar/2026 | DEC-009 riskPercent plan.pl, cards Risk Asymmetry + EV Leakage, 31 testes novos |
| v1.19.3 | Mar/2026 | C3 RR 2 decimais, C5 resultInPoints override, ExtractTable v4.1 compacto, status feedback, navegacao contextual, RR compliant azul. Issue #78 fechado |
| v1.19.2 | Mar/2026 | DEC-007 RR assumido via plan.pl, guard C4 removido, updateTrade recalcula RR, diagnosePlan detecta stale |
| v1.19.1 | Mar/2026 | DEC-006 compliance sem stop, CSV tickerRule lookup, PlanAuditModal, botao auditoria |
