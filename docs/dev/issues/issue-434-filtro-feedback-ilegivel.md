# Issue #434 — fix: filtro da seção de Feedback ilegível

## Autorização

- [x] Marcio autorizou — 10/09/2026, "Urgente", depois do diagnóstico apresentado
- [x] Mockup — não se aplica: o alvo é restaurar o que o #428 quebrou, não desenhar
- [x] Gate Pré-Código liberado

## Context

Os dois seletores da barra de filtros do Feedback do aluno estão com o texto cortado e sem seta
desde a v1.90.0 (#428, face lift). O aluno não vê por qual ativo ou período está filtrando.

## Causa raiz

`index.css:91` aplica `px-4 py-3` a todo `input, textarea, select` — 12px de padding vertical de
cada lado. O #428 trocou altura automática por `h-8`/`h-9` fixos; com `border-box`, sobram 6px de
caixa de conteúdo para uma linha de 19,5px. Segundo defeito no mesmo bloco: `style={{ background:
... }}` é shorthand e zera o `background-image` onde `index.css:103` desenha a seta do select.

## Escopo

| arquivo | controle | antes | depois |
|---|---|---|---|
| `StudentFeedbackPage.jsx` | 2 selects (ativo, período) | `px-3 h-8`, `background:` | `pl-3 pr-9 py-1 h-8`, `backgroundColor:` |
| `ReviewQueuePage.jsx` | input "Buscar aluno" | `h-9` sem `py` | `py-1 h-9`, `backgroundColor:` |

O `ReviewQueuePage` **não estava no issue original** — apareceu quando o teste de regressão rodou.
A varredura que eu tinha feito procurava `<select>` com `h-8` e não via input com `h-9`.

Varredura completa depois: são esses 3 controles. O resto dos elementos com altura fixa é
`div`/`span`/`button`, que a regra global do `index.css` não alcança.

## Regressão

`e2e/controles-legiveis.spec.js` — para cada `select`/`input`/`textarea` e cada folha de texto das
telas com controle, exige `caixa de conteúdo >= line-height`. Roda sobre o harness do #427.

Verificado nos dois sentidos: reprova no código quebrado (caixa 6px contra linha 19,5px) e passa
no consertado. Sem isso o teste não vale — jsdom não faz layout, e foi assim que o defeito passou
por build verde, lint limpo e 4.706 testes.

Primeira rodada acusou 3 botões de aluno: falso positivo meu, container cujo texto vive nos filhos.
O filtro passou a medir só o que a regra global alcança, mais folhas de texto.

## Verificação

- 4.706 testes passando (298 arquivos)
- guarda novo: 3 telas verdes (`aluno-feedback`, `aguardando-feedback`, `fila-de-revisao`)
- foto antes/depois do harness: de fragmento de glifo para "Todos os ativos ⌄" / "Todo período ⌄"

## Lição

O harness do #427 fotografou este defeito desde o dia em que ele entrou. A foto existia e ninguém
abriu. Ferramenta de conferência sem hábito de conferir não é gate — por isso a regressão aqui é
teste que roda sozinho, não roteiro de screenshot para alguém olhar.

## Shared Deltas

- `src/version.js` — v1.90.4 (reservada no main)
- `docs/registry/versions.md` · `docs/registry/chunks.md` — feitos no main na abertura
- `CHANGELOG.md` — no encerramento

## Chunks

- CHUNK-08 (escrita) — Mentor Feedback
