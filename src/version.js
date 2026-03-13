/**
 * version.js — Single Source of Truth
 * @description Versão do produto Acompanhamento 2.0
 *
 * CHANGELOG:
 * - 1.19.3: C3 (RR 2 casas decimais), C5 (resultInPoints null em override), coluna Status Feedback no ExtractTable
 * - 1.19.2: DEC-007 RR assumido integrado em calculateTradeCompliance (plan.pl base), guard C4 removido, updateTrade recalcula RR, diagnosePlan detecta rrAssumed stale
 * - 1.19.1: DEC-006 compliance sem stop (C1-C5), guard rrAssumed (C4), CSV tickerRule (C2), botão auditoria, PlanAuditModal diagnóstico bidirecional
 * - 1.19.0: RR assumido (B2), PlanLedgerExtract RO/RR + feedback nav (B4), P&L contextual (B5) (#71/#73)
 * - 1.18.2: Fix locale pt-BR para todas as moedas (DEC-004)
 * - 1.18.1: Inferência direção CSV (DEC-003), parseNumericValue, Step 2 redesign, ticker validation
 * - 1.18.0: CSV import v2 — staging collection (csvStagingTrades), csvParser, csvMapper, csvValidator, useCsvTemplates, useCsvStaging (#23)
 * - 1.17.0: Cycle navigation, gauge charts, period dropdown, cycle card breakdown (#53-F2)
 * - 1.16.0: State machine plano (#58), badge reclassification, quick fixes dívida técnica
 * - 1.15.0: Multi-currency (#40), account plan accordion (#39), dashboard partition
 */
const VERSION = {
  version: '1.19.3',
  build: '20260312',
  display: 'v1.19.3',
  full: '1.19.3+20260312',
};
export default VERSION;
export { VERSION };
