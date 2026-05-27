# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-04 (Trade Ledger) — ESCRITA | #267 | `fix/issue-267-tactical-bugs` | 25/05/2026 | bug 1 MEN/MEP Yahoo (CF enrichment) + bug 6 compliance/extrato |
| CHUNK-13 (Context Bar) — ESCRITA | #267 | `fix/issue-267-tactical-bugs` | 25/05/2026 | bug 2 modo "todo histórico" destravando Ciclo |
| CHUNK-05 (Compliance) — ESCRITA | #267 | `fix/issue-267-tactical-bugs` | 25/05/2026 | bug 6 mentorClearedViolations não persiste no extrato/gates 4D |
