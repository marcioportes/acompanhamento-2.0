/**
 * Versão do produto — Single Source of Truth
 * @description SemVer 2.0.0 — MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * 
 * CHANGELOG:
 * - 1.10.1: Hotfix — RO/RR com tickSize, validação HH:MM:SS range, data+hora em listas, risco pts vs %
 * - 1.10.0: Issue #41 — Campo Stop Loss, HH:MM:SS parciais, red flag NO_STOP, compliance RR via resultado
 * - 1.9.0: Sistema Emocional v2 — Fase 1.5.0 (UI Completa: Extrato Ledger + Alertas Mentor)
 * - 1.8.0: Sistema Emocional v2 — Fase 1.4.0 (Perfil Emocional do Aluno)
 * - 1.7.1: Hotfix: Filtro master de conta no dashboard aluno (AccountFilterBar)
 * - 1.7.0: Sistema Emocional v2 — Fase 1.3.1 (engine + hooks) + Fase 1.3.2 (ComplianceConfig)
 * - 1.6.0: Trade Partials, Auditoria Saldo, Feedback Parciais, Mentor Accounts UX
 * - 1.5.0: Plan-centric ledger
 * - 1.4.1: StudentFeedbackPage master-detail
 * - 1.4.0: State machine, dashboard mirror
 */
export const VERSION = {
  major: 1,
  minor: 10,
  patch: 1,
  prerelease: null,
  build: '20260225',

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
    return '2026-02-25';
  }
};

export default VERSION;// hotfix-v1.10.1
