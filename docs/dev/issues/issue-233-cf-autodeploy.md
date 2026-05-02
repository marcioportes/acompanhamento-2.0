# Issue #233 — refactor: cc-close-issue.sh auto-deploy de CF no gate 0a

## Autorização

- [x] Mockup — N/A (mudança em script + docs, sem UI)
- [x] Memória de cálculo — N/A (sem fórmula)
- [x] Marcio autorizou — chat: "coloque no (1) e implementa - abre issue e implementa" em 01/05/2026
- [x] Gate Pré-Código liberado

## Context

Encerramento #229 demonstrou que marker explícito + autorização per-deploy bloqueia o flow. Se squash tocou `functions/` e operador está rodando `cc-close-issue.sh`, deploy é parte do encerramento, não decisão à parte.

## Spec

Ver issue body no GitHub: #233.

## Phases

- F1 — `scripts/cc-close-issue.sh` gate `0a`: auto-deploy via `firebase deploy --only functions`. Pré-check de `firebase` CLI. Marker existente preserva backcompat (skip deploy + consume marker).
- F2 — `docs/protocols/closing.md`: atualizar descrição do gate `0a` para refletir auto-deploy.
- F3 — `docs/protocols/closing-manual.md`: atualizar §0a do recovery (operador continua deployando manualmente em recovery — script não está em jogo).

## Sessions

_(preenchido durante execução)_

## Shared Deltas

- `scripts/cc-close-issue.sh` — passo `0a` reescrito com auto-deploy + backcompat.
- `docs/protocols/closing.md` — descrição do passo `0a` atualizada.
- `docs/protocols/closing-manual.md` — §0a mantém deploy manual (sem mudança vs hoje).
- Sem `src/version.js`, sem reserva, sem CHUNK locks.

## Decisions

- Backcompat via marker: operador que prefere deployar manualmente antes do script ainda pode (`touch .cf-deployed-${PR}` → skip auto-deploy). Cobre caso de revert PR sem CF mudou e hotfix sem deploy.
- Pré-check de `firebase` CLI (`command -v firebase`) ANTES de tentar deploy: aborta com mensagem clara se não instalada. Evita falha confusa no meio do encerramento.
- Pré-check de auth (`firebase projects:list`) — overkill, vamos confiar que `firebase deploy` falha graceful se desautenticado. Mensagem de erro do firebase já é clara.

## Chunks

Nenhum CHUNK de produto envolvido.
