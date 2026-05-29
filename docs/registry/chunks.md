# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-07 (CSV Import) — ESCRITA | #292 | `feat/issue-292-import-timezone` | 29/05/2026 | fuso por lote no wizard CSV + grava ISO+offset |
| CHUNK-10 (Order Import) — ESCRITA | #292 | `feat/issue-292-import-timezone` | 29/05/2026 | fuso por lote no OrderImport + reconstrução com offset |
