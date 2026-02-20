/**
 * Tchio-Alpha Version
 * @description Single Source of Truth para versionamento do projeto
 * 
 * SEMANTIC VERSIONING (SemVer 2.0.0)
 * MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * 
 * Incrementar:
 * - MAJOR: Breaking changes
 * - MINOR: Novas features (backward compatible)
 * - PATCH: Bug fixes
 * 
 * REGRA: Versão ÚNICA do produto. Proibido versão individual por componente.
 * @see /docs/governance/versioning.md
 */

export const VERSION = {
  major: 1,
  minor: 5,
  patch: 0,
  prerelease: null,  // 'alpha', 'beta', 'rc.1', ou null para stable
  build: '20260220',
  
  // Getters computados
  get full() {
    let v = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) v += `-${this.prerelease}`;
    if (this.build) v += `+${this.build}`;
    return v;
  },
  
  get short() {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
  
  get display() {
    return `v${this.short}${this.prerelease ? ` ${this.prerelease.toUpperCase()}` : ''}`;
  },

  get semver() {
    let v = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) v += `-${this.prerelease}`;
    return v;
  }
};

// Para uso em imports default
export default VERSION;

// Para uso em console/logs
export const logVersion = () => {
  console.log(`%c Tchio-Alpha ${VERSION.display} `, 'background: #3b82f6; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  console.log(`Build: ${VERSION.build}`);
};
