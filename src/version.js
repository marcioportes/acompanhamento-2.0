/**
 * Versão do produto — Single Source of Truth
 * @description SemVer 2.0.0 — MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * 
 * CHANGELOG:
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
  minor: 8,
  patch: 0,
  prerelease: null,
  build: '20260222',

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
    return '2026-02-22';
  }
};

export default VERSION;
