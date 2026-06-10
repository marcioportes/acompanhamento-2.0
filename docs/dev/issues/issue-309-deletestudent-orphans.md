# Issue #309 — fix(CHUNK-02): deleteStudent deixa órfãos (movements, cycleClosures, Storage)

> Template enxuto (R4). Backend-only (Cloud Function) — sem UI, sem mockup visual.

## Autorização (OBRIGATÓRIA)

**Status atual do documento:**
- [x] Mockup — N/A (backend/CF; contrato em "Spec comportamental" abaixo)
- [x] Memória de cálculo — N/A (sem fórmula; é cascata de delete, lógica em "Spec comportamental")
- [x] Marcio autorizou — 10/06/2026 "go"
- [x] Gate Pré-Código liberado

## Context

A callable `deleteStudent` (`functions/index.js:728`) faz hard delete cascateado do aluno mas deixa
3 coisas órfãs: (1) `movements` de depósito/saque/INITIAL_BALANCE/ADJUSTMENT (que só têm `accountId`,
não `studentId`), (2) `cycleClosures` (top-level com `studentId`, fora do array), (3) screenshots
HTF/LTF dos trades no Storage (`trades/{tradeId}/...`). Objetivo: cleanup total LGPD-like real.

## Spec

Ver issue body no GitHub: #309.

## Spec comportamental (contrato do CF)

Por `studentId` (sid), na CF `deleteStudent`, ANTES de apagar as contas/trades coletar ids:

1. **accountIds** ← `accounts where studentId == sid` (id do doc = accountId usado em `movements.accountId`).
2. **tradeIds** ← `trades where studentId == sid` (pra limpar Storage).
3. Subcollections recursivas de `students/{sid}/*` (inalterado).
4. Top-level por `studentId`: **adicionar `cycleClosures`** ao array (já tem `studentId` — `closeCycle.js:181`).
5. **movements por accountId**: deletar `movements where accountId in [accountIds]` (chunks de 10, batches de 400).
   — Cobre TRADE_RESULT (tem studentId, mas accountId basta) + DEPOSIT/WITHDRAWAL/INITIAL_BALANCE/ADJUSTMENT (só accountId).
6. Doc `students/{sid}` + Auth user (inalterado).
7. **Storage best-effort**: por tradeId, `bucket.deleteFiles({ prefix: 'trades/{tradeId}/' })` em try/catch — falha não aborta a CF.

### Evidências (anti-AP-07)
- `cycleClosures.studentId` + `accountId`: `functions/cycleClosure/closeCycle.js:181`.
- movements só-accountId: `useMovements.js:99-111` (DEP/WTD), `useAccounts.js:155-166` (INITIAL), `:219-230` (ADJUST).
- TRADE_RESULT tem studentId: `useTrades.js:396-404`.
- account.studentId, id=accountId: `useAccounts.js:111-148`.
- Storage path `trades/{tradeId}/...`: `useTrades.js:191-195`.
- `admin.storage().bucket()` disponível (admin init em `functions/index.js:55-59`).

## Arquitetura (decisão técnica)

Extrair a cascata de `deleteStudent` para módulo testável `functions/students/deleteStudentData.js`
(espelha `deleteAccountCascade` ser módulo próprio). Assinatura: `deleteStudentData({ db, bucket, sid })`
→ retorna `counts`. `index.js` delega; mantém auth-delete + fallback-by-email inline. Permite teste
unitário com fake-db in-memory (sem emulador), satisfazendo INV-05 + critério de aceite.

## Phases
- A1 — extrair módulo `deleteStudentData.js` (move `deleteCollectionRecursive`/`deleteByStudentIdQuery`) + 3 fixes
- A2 — `index.js` delega ao módulo
- A3 — teste vitest com fake-db (movements DEP só-accountId + TRADE_RESULT; cycleClosures; storage best-effort)

## Sessions
- _(log)_

## Shared Deltas
- `src/version.js` — bump v1.74.1
- `docs/registry/versions.md` — marcar v1.74.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-02
- `CHANGELOG.md` — nova entrada `[1.74.1] - 10/06/2026`
- `docs/cloud-functions.md` — atualizar descrição de `deleteStudent` (movements/cycleClosures/Storage)

## Decisions
- DEC-AUTO-309-01 — Storage cleanup best-effort (try/catch, não aborta CF; "lixo barato" por issue)
- DEC-AUTO-309-02 — extração de `deleteStudentData` em módulo próprio p/ testabilidade

## Chunks
- CHUNK-02 (escrita) — `deleteStudent` em `functions/`
- CHUNK-04 (leitura) — modelo de `movements`/`accounts`/`cycleClosures`
