# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-04 | #308 | `feat/issue-308-trade-self-review` | 07/06/2026 | Auto-revisão de trade — campo `trade.selfReview` + gateway `submitTradeReview` + rules |
| CHUNK-02 | #309 | `fix/issue-309-deletestudent-orphans` | 10/06/2026 | deleteStudent deixa órfãos — movements (por accountId), cycleClosures, Storage dos trades |
