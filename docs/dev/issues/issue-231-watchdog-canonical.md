# Issue #231 — fix: cc-worktree-start.sh lança versão velha do watchdog

## Autorização

- [x] Mockup — N/A (mudança em script + docs, sem UI)
- [x] Memória de cálculo — N/A (sem fórmula)
- [x] Marcio autorizou — chat: "abre issue e resolve" em 01/05/2026
- [x] Gate Pré-Código liberado

## Context

Crosscheck pós-#227 detectou `cc-worktree-start.sh:226` apontando pra versão velha do watchdog (`~/cc-mailbox/bin/cc-watchdog.sh`, 316L) em vez da canônica (`scripts/cc-watchdog.sh`, 459L). Loop autônomo recente usou TTL fixo + 3 tipos genéricos em vez de 7 granulares + retry pós-quota do #178.

## Spec

Ver issue body no GitHub: #231.

## Phases

- F1 — `scripts/cc-worktree-start.sh:226`: trocar `$HOME/cc-mailbox/bin/cc-watchdog.sh` por `$REPO/scripts/cc-watchdog.sh` (`$REPO` já definido na linha 57).
- F2 — `docs/protocols/autonomous.md`: pequena nota documentando política `scripts/` canônica para infra autônoma duplicada (`cc-watchdog.sh`, `cc-status.sh`); `~/cc-mailbox/bin/` versões dos duplicados são deprecated.

## Sessions

_(preenchido durante execução)_

## Shared Deltas

- `scripts/cc-worktree-start.sh` — 1 linha (F1).
- `docs/protocols/autonomous.md` — nota curta (F2).
- Sem `src/version.js`, sem reserva, sem CHUNK locks.

## Decisions

- Não tocar `~/cc-mailbox/bin/cc-watchdog.sh` ou `~/.claude/hooks/check-closing.sh.bak` no PR — fora do repo. Cleanup local fica no PR body como nota operacional.
- Não converter `cc-status.sh` em symlink ou wrapper: arquivos byte-idênticos hoje, sem dor; documentação de política basta.

## Chunks

Nenhum CHUNK de produto envolvido.
