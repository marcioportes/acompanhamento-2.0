# Registry de Locks Ativos (write-hot)

> Locks ativos por chunk. Edita-se APENAS na Abertura (§4.0) e Encerramento (§4.3).
> Tabela de domínios (estática) em `docs/chunks.md`.

| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| CHUNK-11 | #315 | `feat/issue-315-humanize-evidence` | 25/06/2026 | evidência técnica mentor-only no BehaviorPanel |
| CHUNK-04 | #315 | `feat/issue-315-humanize-evidence` | 25/06/2026 | imagens HTF/LTF opcionais no registro de trade |
| CHUNK-08 | #315 | `feat/issue-315-humanize-evidence` | 25/06/2026 | reflexão do aluno visível na composição de feedback |
| CHUNK-08 | #316 | `fix/issue-316-feedback-classify-args` | 01/07/2026 | HOTFIX co-lock com #315 — gate de feedback quebrado (args de classifyStudent). Coordenar ordem de merge |
| CHUNK-04 | #316 | `fix/issue-316-feedback-classify-args` | 01/07/2026 | HOTFIX co-lock com #315 — toca só `useTrades.js:46` (gate). Coordenar ordem de merge |
