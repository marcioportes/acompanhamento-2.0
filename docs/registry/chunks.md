# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-04 (Trade Ledger) — leitura | #278 | `feat/issue-278-undersized-evidence` | 22/05/2026 | shadow lê trades + Panel é renderizado em TradeDetailModal |
| CHUNK-08 (Mentor Feedback) — leitura | #278 | `feat/issue-278-undersized-evidence` | 22/05/2026 | ShadowBehaviorPanel também consumido em FeedbackPage |
