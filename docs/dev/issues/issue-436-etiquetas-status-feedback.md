# Issue #436 — fix: etiquetas de status do Feedback à direita e sem cor

## Autorização

- [x] Marcio, 10/09/2026: *"A TELA DE FEEDBACK AINDA MANTEM OS ICONES À DIREITA, ELES ESTAVAM ALINHADOS À ESQUERDA, COM CORES... AGORA NADA."*
- [x] Mockup — não se aplica: restaura o que o #428 mudou, referência é a tela anterior
- [x] Gate Pré-Código liberado

## Causa (#428)

1. **Foram para a direita:** as etiquetas viraram o `acoes` do `PageHeader`, e `acoes` é `ml-auto` por contrato. O comentário no código seguia dizendo `{/* Título + Pills à esquerda */}` — descrevendo o que deixara de ser verdade.
2. **Perderam a cor:** `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}` virou `color: ink/ink-2/ink-4`. A cor de `STATUS_CONFIG.cor` sobrou num ponto de 5px.
3. **`StatusBadge` perdeu o ícone:** `const Icon = cfg.icon` foi removido e trocado pelo ponto.

## Correção

| o quê | como |
|---|---|
| volta para a esquerda | `PageHeader` ganha slot `aoLado` — aditivo, default `null`, nenhuma outra tela muda |
| cor de volta | ícone e contagem em `cfg.cor`; ativo com fundo e anel tingidos via `color-mix`; contagem 0 segue apagada |
| ícone de volta | `StatusBadge` renderiza `cfg.icon` na cor do status |

`aoLado` existe em vez de reusar `contexto` porque `contexto` embrulha em `<span class="meta truncate">` — fileira de botões dentro de um span que trunca não sobrevive.

## Decisão de design

A regra do face lift (fundo neutro, cor num ponto de 5px) vale para etiqueta solta numa lista de dez, onde dez cores não destacam ninguém. Aqui são **cinco estados fixos e distintos** num seletor: a cor é o que faz "Dúvidas" saltar antes da leitura. Cinza obriga a ler os cinco rótulos para achar o que interessa.

## Verificação

- 4.706 testes / 298 arquivos
- `e2e/controles-legiveis.spec.js` (guarda do #434) verde nas 3 telas
- foto do harness: etiquetas coladas ao título, "1 Dúvidas" em âmbar, "11 Revisados" em verde, zeradas apagadas

## Shared Deltas

- `src/version.js` — v1.90.5 (reservada no main)
- `docs/registry/*` — feitos no main na abertura
- `CHANGELOG.md` · `docs/PROJECT.md` — no encerramento

## Chunks

- CHUNK-08 (escrita) — Mentor Feedback
