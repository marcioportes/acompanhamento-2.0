# Issue #294 — feat: Rebrand Espelho do Trader nas telas de entrada (Login + Sidebar)

## Autorização

- [x] Mockup apresentado — textual no body do #294 (3 superfícies) + fonte canônica `EspelhoLogo.tsx`
- [x] Memória de cálculo — N/A (mudança puramente de apresentação, sem fórmula/score/agregação)
- [x] Marcio autorizou — 31/05/2026 "atacar #294"
- [x] Gate Pré-Código liberado

## Context

Telas de entrada do app (Login + Sidebar) ainda carregam a marca antiga "Tchio Alpha" e paleta azul/roxo, desalinhadas da identidade pública do produto (`/espelho` no portal): marca ‹|› «Espelho / do Trader» em teal. Pré-lançamento da página exige alinhamento dessas superfícies de marca.

## Spec
Ver issue body no GitHub: #294. Escopo restrito (Marcio 31/05): recoloração teal **apenas** nas superfícies de marca de entrada; resto do glassmorphism azul/roxo preservado.

## Mockup
No body do #294 (mockup textual das 3 superfícies). Fonte canônica: `marcioportes-portal/app/components/EspelhoLogo.tsx`.

## Phases
- A1 — Portar marca ‹|› para `src/components/EspelhoLogo.jsx` (EspelhoMark + EspelhoLockup, teal)
- A2 — M1 Sidebar: wordmark "Espelho / do Trader" + marca teal + item ativo teal
- A3 — M2 LoginPage cabeçalho esquerdo: logo Espelho do Trader
- A4 — M3 LoginPage decoração direita: bump up teal (mark + gradientes), copy preservado
- A5 — Ajustar testes (Sidebar.test.jsx, v1197-sidebar-badge.test.js) + suite verde
- A6 — Smoke no dev server (worktree)

## Sessions
- (a preencher)

## Shared Deltas
- `src/version.js` — bump v1.71.0 (reservado no main)
- `docs/registry/versions.md` — marcar v1.71.0 consumida (encerramento)
- `CHANGELOG.md` — nova entrada `[1.71.0] - 31/05/2026` (encerramento)

## Decisions
- (nenhuma DEC-AUTO prevista; escopo de paleta já decidido por Marcio no chat)

## Chunks
- Nenhum chunk de domínio (UI shell / branding). Sem lock.
