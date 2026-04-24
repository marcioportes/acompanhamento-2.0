# Issue 089 — fix: Aluno não consegue deletar próprio plano (Firestore rules)
> **Branch:** `fix/issue-089-aluno-deletar-plano`  
> **Milestone:** v1.1.0 — Espelho Self-Service  
> **Aberto em:** 03/04/2026  
> **Status:** ✅ Encerrado  
> **Versão entregue:** 1.22.1

---

## 1. CONTEXTO

O aluno não consegue deletar seu próprio plano. A operação falha com "Missing or insufficient permissions".

**Root cause confirmado:** A rule de `plans/{planId}` (firestore.rules:113) exige `isMentor() || isOwner(resource.data.studentId) || isOwnerByEmail(resource.data.studentEmail)`.

Problemas identificados:
- `isMentor()` compara com `marcio.portes@me.com` mas o login real usa `@icloud.com`
- `isOwner` compara `request.auth.uid` com `resource.data.studentId` — se o plano foi criado pelo mentor (viewAs), o `studentId` pode não corresponder ao UID do aluno logado
- `isOwnerByEmail` depende de `studentEmail` existir no documento

A rule deveria seguir DEC-025 (`auth != null` como default), como já aplicado em `assessment` (linhas 200-201).

## 2. ACCEPTANCE CRITERIA

- [ ] Aluno consegue deletar seu próprio plano sem erro de permissão
- [ ] Mentor continua podendo deletar planos
- [ ] Cascade delete (trades + movements) continua funcionando
- [ ] Nenhum usuário não-autenticado consegue deletar

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `plans` (regra de delete) |
| Cloud Functions afetadas | Nenhuma — delete de plan não dispara CFs |
| Hooks/listeners afetados | `usePlans.deletePlan` — já funciona, é a rule que bloqueia |
| Side-effects (PL, compliance, emotional) | `deletePlan` faz cascade delete de trades e movements (existente, não muda) |
| Blast radius | Baixo — só muda quem pode deletar plano |
| Rollback | Reverter a linha no firestore.rules |

## 4. SESSÕES

### Sessão — 03/04/2026

**O que foi feito:**
- Análise de impacto completa
- Root cause confirmado em firestore.rules:113
- Verificado que collections `trades`, `accounts`, `movements` usam mesmo padrão restritivo
- Verificado que `assessment` já usa `auth != null` (DEC-025 completo)

**Proposta pendente de aprovação:**

Duas opções apresentadas ao Marcio:
1. **Conservadora** — manter guards mas corrigir `isMentor()` para incluir `@icloud.com`
2. **DEC-025 completa** — simplificar para `allow update, delete: if isAuthenticated()`

**Decisão: opção 2 (DEC-025 completa)** — aprovada pelo Marcio em 03/04/2026.

**Arquivos tocados:**
- `firestore.rules` (shared infrastructure — delta aplicado)

**Delta proposto (opção 2):**
```
// ANTES (firestore.rules:110-117)
match /plans/{planId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
  allow update, delete: if isAuthenticated() && (
    isMentor() || 
    isOwner(resource.data.studentId) ||
    (resource.data.studentEmail != null && isOwnerByEmail(resource.data.studentEmail))
  );
}

// DEPOIS
match /plans/{planId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
  allow update, delete: if isAuthenticated();
}
```

**Issues descobertos durante investigação:**
- [#120](https://github.com/marcioportes/acompanhamento-2.0/issues/120) — fix: deletePlan cascade não recalcula currentBalance (race condition em CFs)
- Índice composto `movements` (accountId + date + createdAt) ausente — adicionado em `firestore.indexes.json` e deployado

**Pendências:**
- version.js bump, CHANGELOG
- Testar com aluno real
- Monitorar criação do índice no Firestore

## 5. ENCERRAMENTO

**Status:** Mergeado

**Checklist final:**
- [x] Acceptance criteria atendidos
- [x] Testes passando (teste manual — aluno deletou plano, saldo voltou para initialBalance)
- [x] PROJECT.md atualizado (CHANGELOG v1.22.1)
- [x] Mergeado na main
- [x] Issue fechado no GitHub
- [x] Branch deletada
- [ ] Locks de chunks liberados no registry (nenhum chunk lockado)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| Nenhum | — | Mudança é em `firestore.rules` (shared infrastructure), não em chunks de código |

> Arquivo `firestore.rules` é shared infrastructure. Delta documentado acima conforme protocolo.
