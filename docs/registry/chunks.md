# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-04 (Trade Ledger) — ESCRITA | #285 | `feat/issue-285-trade-timezone` | 27/05/2026 | tz explícito no horário do trade + enrich usa tz + enrich no update |
