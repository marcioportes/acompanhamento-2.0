# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-13 (Context Bar) — ESCRITA | #289 | `feat/issue-289-context-gated-analytics` | 28/05/2026 | gate de visibilidade governado por plano/ciclo |
| CHUNK-04 (Trade Ledger) — ESCRITA | #289 | `feat/issue-289-context-gated-analytics` | 28/05/2026 | analytics do dashboard gated por plano |
| CHUNK-08 (Mentor Feedback) — ESCRITA | #289 | `feat/issue-289-context-gated-analytics` | 28/05/2026 | SWOT/maturidade escopados ao ciclo (Fase 2) |
