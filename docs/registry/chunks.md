# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-03 (Plans) — ESCRITA | #259 | `feat/issue-259-cycle-closure` | 07/05/2026 | abertura ritual fechamento ciclo (1A) |
| CHUNK-04 (Trade Ledger) — ESCRITA | #259 | `feat/issue-259-cycle-closure` | 07/05/2026 | hard seal em addTrade/updateTrade/deleteTrade |
| CHUNK-16 (Mentor Cockpit) — ESCRITA | #259 | `feat/issue-259-cycle-closure` | 07/05/2026 | nova tab Closures + componentes mentor |
| CHUNK-05 (Compliance) — leitura | #259 | `feat/issue-259-cycle-closure` | 07/05/2026 | input pra topErrors, ruleAdherenceRate |
| CHUNK-06 (Emotional) — leitura | #259 | `feat/issue-259-cycle-closure` | 07/05/2026 | input pra eventos comportamentais e curva emocional |
| CHUNK-08 (Mentor Feedback) — leitura | #259 | `feat/issue-259-cycle-closure` | 07/05/2026 | input pra mentor.threadsHighlighted |
| CHUNK-09 (Onboarding/4D) — leitura | #259 | `feat/issue-259-cycle-closure` | 07/05/2026 | input pra maturity scores |
| CHUNK-01 (Auth) — ESCRITA | #271 | `fix/issue-271-firestore-rules-accessstatus` | 12/05/2026 | fix regra Firestore bloqueava activateStudent — accessStatus fora da allowlist |
| CHUNK-02 (Student) — ESCRITA | #271 | `fix/issue-271-firestore-rules-accessstatus` | 12/05/2026 | fix regra Firestore + backfill via script (sync-access-from-auth) |
