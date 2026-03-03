/**
 * Versão do produto — Single Source of Truth
 * @description SemVer 2.0.0 — MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * 
 * CHANGELOG:
 * - 1.14.0: Issue #43 — Mentor visualiza e edita planos do aluno
 *   - AccountDetailPage: seção "Planos Vinculados" com indicadores estratégicos
 *   - PL atual, RO, Stop Período/Ciclo, Meta Período/Ciclo — tudo calculado
 *   - Mentor edita via PlanManagementModal com audit trail
 *   - usePlans.updatePlan: registra lastEditedBy, lastEditedByEmail, editHistory[]
 *   - Badge "Ajustado pelo Mentor" nos planos editados
 *   - AccountsPage passa plans e handler para AccountDetailPage
 * - 1.13.0: Issue #60 — Imagem no feedback via copy/paste (mentor only)
 * - 1.12.0: Issue #9 — Feedback em massa para múltiplos trades
 * - 1.11.0: Issue #22 Phase 1 — Testes automatizados + CI/CD pipeline
 * - 1.10.2: Hotfix — TradesList sort ASC, planId lock em edit, delete trade fix
 * - 1.10.1: Hotfix — RO/RR com tickSize, validação HH:MM:SS range
 * - 1.10.0: Issue #41 — Campo Stop Loss, HH:MM:SS parciais, red flag NO_STOP
 * - 1.9.0: Sistema Emocional v2 — Fase 1.5.0
 * - 1.8.0: Sistema Emocional v2 — Fase 1.4.0
 * - 1.7.1: Hotfix: Filtro master de conta no dashboard aluno
 * - 1.7.0: Sistema Emocional v2 — Fase 1.3.1 + 1.3.2
 * - 1.6.0: Trade Partials, Auditoria Saldo, Feedback Parciais
 * - 1.5.0: Plan-centric ledger
 * - 1.4.1: StudentFeedbackPage master-detail
 * - 1.4.0: State machine, dashboard mirror
 */
export const VERSION = {
  major: 1,
  minor: 14,
  patch: 0,
  prerelease: null,
  build: '20260303',

  get number() {
    return `${this.major}.${this.minor}.${this.patch}`;
  },

  get semver() {
    let v = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) v += `-${this.prerelease}`;
    return v;
  },

  get full() {
    let v = this.semver;
    if (this.build) v += `+${this.build}`;
    return v;
  },

  get display() {
    return `v${this.semver}`;
  },

  get date() {
    return '2026-03-03';
  }
};

export default VERSION;
