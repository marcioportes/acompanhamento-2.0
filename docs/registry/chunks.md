# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-08 | #325 | `feat/issue-325-review-note-in-composer` | 01/07/2026 | anotação de sessão no compositor (nasce com REVIEWED); remove botão solto #318 |
| CHUNK-04 | #325 | `feat/issue-325-review-note-in-composer` | 01/07/2026 | escrita transiente _pendingReviewNote no trade |
