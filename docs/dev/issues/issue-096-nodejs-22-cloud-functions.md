# Issue 096 — debt: Node.js 20 para 22 nas Cloud Functions (deadline 30/04/2026)
> **Branch:** `debt/issue-096-nodejs-22-cloud-functions`
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Aberto em:** 01/04/2026
> **Status:** ✅ Encerrado
> **Versão entregue:** v1.22.0

---

## 1. CONTEXTO

Cloud Functions rodam Node.js 20, que será deprecated pelo Google em 30/04/2026 (decommission 30/10/2026). Após a data, novos deploys podem falhar. Além disso, o SDK `firebase-functions` está na versão `^4.5.0` e precisa ser atualizado para `>=5.1.0` (DT-028).

**Referências:** DT-016, DT-028 (PROJECT.md seção 9)

## 2. ACCEPTANCE CRITERIA

- [x] `engines.node` em `functions/package.json` alterado de `"20"` para `"22"`
- [x] `firebase-functions` SDK atualizado de `^4.5.0` para `>=5.1.0` (instalado 5.1.1)
- [x] Breaking changes do SDK 5.x avaliados — compatibilidade total com imports `/v1` e `/v2/https`
- [x] Todas as 18 CFs testadas localmente via `node -e require('./index.js')` — zero erros
- [x] Deploy em produção validado — 18/18 CFs atualizadas para Node.js 22
- [x] DT-016 e DT-028 marcados como resolvidos no PROJECT.md

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | Nenhuma alteração de schema — impacto é infra/runtime |
| Cloud Functions afetadas | **Todas** (18 exports): mudança de runtime Node.js 20→22 + SDK 4.x→5.x |
| Hooks/listeners afetados | Nenhum diretamente — mas CFs com trigger Firestore (onTradeCreated, onTradeUpdated, onTradeDeleted, onMovementCreated, onMovementDeleted) precisam validar compatibilidade |
| Side-effects (PL, compliance, emotional) | Pipeline trades→CFs→PL/compliance intacto se signatures forem preservadas (INV-03) |
| Blast radius | **Alto** — todas as CFs param de funcionar se o upgrade quebrar algo |
| Rollback | Reverter `engines.node` para `"20"` e SDK para `^4.5.0` + redeploy |

### Breaking changes conhecidos (firebase-functions 5.x)

- `functions.https.onCall` signature muda — afeta: createStudent, deleteStudent, resendStudentInvite, addFeedbackComment, closeTrade, recalculateCompliance, seedInitialData
- Import paths podem mudar — afeta: todos os 4 módulos em `./assessment/`
- Referência: https://firebase.google.com/docs/functions/migrate-to-2nd-gen

## 4. SESSÕES

### Sessão — 01/04/2026

**O que foi feito:**
- Verificado estado real do codebase: `engines.node: "20"`, `firebase-functions: "^4.5.0"`
- Descoberto codebase híbrido: `index.js` usa `/v1`, `assessment/*.js` usa `/v2/https`
- Confirmado SDK 5.x mantém compatibilidade com ambos import paths
- Atualizado `engines.node` de `"20"` para `"22"`
- Atualizado `firebase-functions` de `"^4.5.0"` para `"^5.1.0"` (instalado 5.1.1)
- Testado todos os import paths: `/v1`, `/v2/https`, `onCall`, `HttpsError`, `firestore.document`, `pubsub.schedule` — todos OK
- 755 testes passando (36 test files)
- `version.js` atualizado para v1.22.0
- CHANGELOG atualizado no PROJECT.md
- DT-016 e DT-028 marcados como resolvidos

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| — | Manter imports `/v1` no index.js (não migrar para v2 gen) | SDK 5.x suporta ambos; migração de signatures é escopo separado |

**Arquivos tocados:**
- `functions/package.json`
- `functions/package-lock.json`
- `src/version.js`
- `docs/PROJECT.md`
- `CLAUDE.md`
- `docs/dev/issues/issue-096-nodejs-22-cloud-functions.md`

**Testes:**
- 755 testes passando, 36 test files, 0 falhas

**Commits:**
- `010b31cc debt: Node.js 20→22 + firebase-functions SDK 4.5→5.1 (issue #96, DT-016, DT-028)`

**Deploy:**
- 3 CFs órfãs deletadas (activateStudent, onFeedbackAdded, onMailStatusChange — zero referências no codebase)
- 18/18 CFs deployadas em Node.js 22 (14 × 1st Gen + 4 × 2nd Gen)

**Pendências:**
- Nenhuma

## 5. ENCERRAMENTO

**Status:** Mergeado

**Checklist final:**
- [x] Acceptance criteria atendidos
- [x] Testes passando (755/755)
- [x] PROJECT.md atualizado (DT-016, DT-028 resolvidos, CHANGELOG v1.22.0)
- [x] PR #105 aberto e mergeado
- [x] Issue #96 fechado no GitHub
- [x] Branch deletada (local + remota)
