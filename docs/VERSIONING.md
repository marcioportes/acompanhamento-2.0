# Tchio-Alpha - Padrão de Versionamento

## Semantic Versioning (SemVer)

O projeto adota **Semantic Versioning 2.0.0** como padrão único.

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
Exemplo: 1.0.0-beta.1+build.2024
```

### Regras de Incremento

| Tipo | Quando | Exemplo |
|------|--------|---------|
| **MAJOR** | Breaking changes, incompatibilidade | 1.0.0 → 2.0.0 |
| **MINOR** | Novas features, backward-compatible | 1.0.0 → 1.1.0 |
| **PATCH** | Bug fixes, melhorias internas | 1.0.0 → 1.0.1 |

### Pré-releases

- `alpha` - Desenvolvimento inicial, instável
- `beta` - Feature-complete, em teste
- `rc` - Release candidate

---

## Versão Central

**Single Source of Truth:** `src/version.js`

```javascript
export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  prerelease: null,
  build: '20260213',
  
  get display() {
    let v = `v${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) v += `-${this.prerelease}`;
    return v;
  }
};
```

---

## Exibição na UI

A versão aparece no **footer do Sidebar** (padrão Slack, VSCode):

```
┌─────────────────┐
│   SIDEBAR       │
│   ...           │
│─────────────────│
│ v1.0.0          │  ← Versão aqui
│ © 2026 Tchio    │
└─────────────────┘
```

---

## Branches e Tags

| Branch | Versão |
|--------|--------|
| main | Produção (ex: 1.0.0) |
| develop | Próxima (ex: 1.1.0-dev) |
| feature/* | Alpha |
| hotfix/* | Patch |

### Convenção de Tags

```bash
git tag -a v1.0.0 -m "Release 1.0.0 - Mirror"
```

---

## Commit Convention

```
feat: nova feature (MINOR)
fix: correção (PATCH)
BREAKING CHANGE: (MAJOR)
docs: documentação
chore: manutenção
```

---

**Versão Atual:** 1.0.0  
**Codename:** Mirror  
**Data:** 2026-02-13