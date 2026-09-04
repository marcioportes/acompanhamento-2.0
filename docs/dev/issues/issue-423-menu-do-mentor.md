# Issue #423 — fix: o menu do mentor perdeu destinos e o Dashboard ficou abaixo da dobra

## Autorização

- [x] Reportado e autorizado por Marcio (04/09/2026): *"ficou uma bosta, cadê o resto das coisas? cadê o dashboard?"*
- [x] Mockup — não se aplica: nenhuma tela nova. É restauração de itens de menu e ordem de faixa.
- [x] Memória de cálculo — não se aplica.

## Context

Regressão de **desenho** do #144, não bug. O menu do mentor foi de 9 para 5 itens e os destinos removidos (Análises, Fila de Revisão, Aguardando Feedback, Fechamentos) passaram a existir só dentro da Torre.

O que o mockup escondeu: a faixa **A TURMA renderiza a turma inteira, sem limite de linhas** (`TorreTurma.jsx`, `turma.map` sem `slice`). A ordem real era:

```
tiles → Prioridade do Dia → alertas → A TURMA (n linhas) → Minhas Pendências → rodapé
```

Com 12 alunos, tudo que o mentor usa todo dia caía **abaixo da dobra**, e Análises virou o elemento visualmente mais fraco da página (`text-xs text-slate-500`, no rodapé).

O mockup aprovado desenhou a Torre como caixa compacta. A caixa não é compacta — a aprovação foi dada sobre um desenho que não representava a tela.

## Phases

- A1 — devolver ao menu do mentor: Análises, Fila de Revisão, Aguardando Feedback, Precisam Atenção, Fechamentos (com os badges, que são o que faz o item ser procurado).
- A2 — Minhas Pendências sobe na Torre, para antes de A Turma.
- A3 — remover o link de rodapé de Análises.
- A4 — "Precisam Atenção" volta como tela (rota, view e memo), revertendo DEC-144-02.

## O que do #144 fica de pé

Roteador (URL, back, deep link, fim dos oito contextos de retorno), casca única (`AppShell` + `PageHeader`) e a escala do design system. Nada disso é o que quebrou a experiência — e a Torre continua sendo o primeiro item do menu e o destino do login, que era a parte boa da decisão.

## Decisions

- DEC-423-01 — revoga DEC-144-01 na parte do menu: a Torre é a **home**, não a única porta. Item de menu é onde se procura o que se usa todo dia; enterrar destino dentro de uma página de altura variável não é hierarquia, é esconder.
- DEC-423-02 — revoga DEC-144-02: "Precisam Atenção" volta como tela. Os critérios são outros (performance acumulada × conduta e presença) e a diferença já tinha sido registrada como perda de sinal.
- DEC-423-03 — revoga DEC-144-04: Análises volta ao menu.
- DEC-423-04 — mantém DEC-144-03 (Fechamentos na faixa), mas a faixa sobe: o que decide o dia não fica depois de uma lista que cresce com a turma.

## Sessions

- `fix + testes commit <sha> ok`

## Shared Deltas

- `src/version.js` — bump v1.88.2 (reservada em `59d61ab5`)
- `docs/registry/versions.md` — marcar consumida
- `docs/registry/chunks.md` — liberar CHUNK-16
- `CHANGELOG.md` — entrada `[1.88.2]`
- `docs/decisions.md` — DEC-423-01..04 (revogam DEC-144-01/02/04)
- `docs/PROJECT.md` — encerramento

## Chunks

- CHUNK-16 (escrita) — Sidebar do mentor, MentorDashboard, Torre
