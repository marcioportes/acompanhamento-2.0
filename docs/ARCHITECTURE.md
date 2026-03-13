# Propostas de Atualização ARCHITECTURE.md — Sessão 13/03/2026

## Seção 5 (Decision Log) — Adicionar:

### DEC-008: Navegação Contextual Feedback ↔ Extrato (12/03/2026)
**Problema:** Ao clicar feedback no extrato do plano e voltar, o extrato fechava e o usuário voltava ao dashboard. O componente StudentDashboard desmontava quando App.jsx renderizava FeedbackPage, perdendo o state `ledgerPlan`.
**Decisão:** Flag `_fromLedgerPlanId` enriquecida no trade pelo StudentDashboard apenas quando a navegação vem do PlanLedgerExtract. App.jsx inspeciona a flag: se presente, guarda `feedbackReturnPlanId`; se ausente (veio do dashboard), não guarda. Ao voltar, useEffect no StudentDashboard reabre o extrato via `setLedgerPlan`.
**Impacto:** App.jsx (state + props), StudentDashboard (props + useEffect + callback enrichment). Zero impacto em collections/CF.

## Seção 6 (Dívidas Técnicas) — Atualizar:

- DT-010: **RESOLVIDO** v1.19.1 (já marcado)
- DT-013: **RESOLVIDO** v1.19.2 (já marcado)
- DT-014: **RESOLVIDO** v1.19.1 (já marcado)
- DT-017: **RESOLVIDO** v1.19.2 (já marcado)

## Seção 8 (Histórico de Versões) — Adicionar:

| v1.19.3 | Mar/2026 | C3 RR 2 decimais, C5 resultInPoints override, ExtractTable v4.1 compacto, status feedback, navegação contextual, RR compliant azul. Issue #78 fechado. |
| v1.19.2 | Mar/2026 | DEC-007 RR assumido via plan.pl, guard C4 removido, updateTrade recalcula RR, diagnosePlan detecta stale |
| v1.19.1 | Mar/2026 | DEC-006 compliance sem stop, CSV tickerRule lookup, PlanAuditModal, botão auditoria |
