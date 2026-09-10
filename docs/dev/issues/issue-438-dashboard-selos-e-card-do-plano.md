# Issue #438 — fix: Dashboard, selos de debug e card do plano

## Autorização

- [x] Marcio, 10/09/2026: *"principais modificações - asap - dashboard"*
- [x] Mockup — não se aplica: restaura legibilidade, não redesenha
- [x] Gate Pré-Código liberado

## Defeitos

**1. Selos de debug comiam o topo.** `DebugBadge` no modo `embedded` era `relative mt-1 ... pb-1` — bloco com altura própria **no fluxo**. O Dashboard renderiza sete; dois caem entre o cabeçalho e a barra de contexto e abriam ~130px de buraco. São 24 `embedded` no app.

**2. Card do plano colava rótulo e valor.** `flex justify-between` numa coluna de ~170px: o span do valor quebrava linha, o `/` ficava sozinho em cima e `R$ 1.000,00` descia colado no rótulo truncado — `DIÁRIOR$ 1.000,00`, com o fim cortado.

## Correção

| defeito | correção |
|---|---|
| selo no fluxo | wrapper de altura zero, selo ancorado no canto do próprio bloco. Visível (INV-04 mantida), não empurra layout. Expandido volta ao fluxo, senão o painel nasceria cortado pelo `h-0` |
| rótulo colado | rótulo e valor **empilhados** |

**Tentativa descartada:** primeiro tentei `whitespace-nowrap` no valor com `truncate` no rótulo. O valor parou de quebrar e o rótulo virou `D.` — "MENSAL" sumiu inteiro. Truncar o rótulo é pior que o defeito original; na largura real da coluna os dois não cabem lado a lado, então empilhar é a única saída que preserva os dois.

## Verificação

- página encolheu de 2904px para 2736px — os 168px que os selos comiam
- foto do harness antes e depois, conferida: topo sem buraco; `DIÁRIO` / `/ R$ 1.000,00` e `MENSAL` / `/ -R$ 10.000,00` íntegros
- build verde; suíte completa no CI do PR

## Shared Deltas

- `src/version.js` — v1.90.6 (reservada no main)
- `docs/registry/*` — na abertura
- `CHANGELOG.md` · `docs/PROJECT.md` — no encerramento

## Chunks

- CHUNK-02 (escrita) — Student
