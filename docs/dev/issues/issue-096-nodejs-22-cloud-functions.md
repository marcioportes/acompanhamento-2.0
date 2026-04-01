# Issue 096 — debt: Node.js 20 para 22 nas Cloud Functions (deadline 30/04/2026)
> **Branch:** `debt/issue-096-nodejs-22-cloud-functions`
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Aberto em:** 01/04/2026
> **Status:** 🔵 Em andamento
> **Versão entregue:** —

---

## 1. CONTEXTO

Cloud Functions rodam Node.js 20, que será deprecated pelo Google em 30/04/2026 (decommission 30/10/2026). Após a data, novos deploys podem falhar. Além disso, o SDK `firebase-functions` está na versão `^4.5.0` e precisa ser atualizado para `>=5.1.0` (DT-028).

**Referências:** DT-016, DT-028 (PROJECT.md seção 9)

## 2. ACCEPTANCE CRITERIA

- [ ] `engines.node` em `functions/package.json` alterado de `"20"` para `"22"`
- [ ] `firebase-functions` SDK atualizado de `^4.5.0` para `>=5.1.0`
- [ ] Breaking changes do SDK 5.x avaliados e adaptados (signatures `onCall`, import paths)
- [ ] Todas as CFs testadas localmente: onTradeCreated, onTradeUpdated, onTradeDeleted, onMovementCreated, onMovementDeleted, createStudent, deleteStudent, resendStudentInvite, addFeedbackComment, closeTrade, recalculateCompliance, cleanupOldNotifications, classifyOpenResponse, generateProbingQuestions, analyzeProbingResponse, generateAssessmentReport, healthCheck, seedInitialData
- [ ] Deploy em produção validado
- [ ] DT-016 e DT-028 marcados como resolvidos no PROJECT.md

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
- *(pendente — aguardando confirmação)*

**Pendências para próxima sessão:**
- Deploy em produção (`firebase deploy --only functions`) — requer ambiente de produção
- Validação pós-deploy de todas as 18 CFs em produção

## 5. ENCERRAMENTO

**Status:** Aguardando deploy em produção

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] PROJECT.md atualizado (DEC, DT, CHANGELOG)
- [ ] PR aberto e mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
