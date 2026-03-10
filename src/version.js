/**
 * version.js — Single Source of Truth
 * @description Versão do produto Acompanhamento 2.0
 *
 * CHANGELOG:
 * - 1.19.0: RR assumido (B2), PlanLedgerExtract RO/RR + feedback nav (B4), P&L contextual (B5) (#71/#73)
 * - 1.18.2: Fix locale pt-BR para todas as moedas (DEC-004)
 * - 1.18.1: Inferência direção CSV (DEC-003), parseNumericValue, Step 2 redesign, ticker validation
 * - 1.18.0: CSV import v2 — staging collection (csvStagingTrades), csvParser, csvMapper, csvValidator, useCsvTemplates, useCsvStaging (#23)
 * - 1.17.0: Cycle navigation, gauge charts, period dropdown, cycle card breakdown (#53-F2)
 * - 1.16.0: State machine plano (#58), badge reclassification, quick fixes dívida técnica
 * - 1.15.0: Multi-currency (#40), account plan accordion (#39), dashboard partition
 */
const VERSION = {
  version: '1.19.0',
  build: '20260309',
  display: 'v1.19.0',
  full: '1.19.0+20260309',
};
export default VERSION;
export { VERSION };
