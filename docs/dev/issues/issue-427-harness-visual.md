# Issue #427 — chore: harness de render visual — fotografar as telas do mentor

## Autorização

- [x] Marcio, 04/09/2026: plano de face lift aprovado; esta é a **Fase 1**. Nada de aparência muda aqui.
- [x] Mockup — não se aplica: nenhuma tela nova, nenhuma alteração visual. O produto é a foto do que já existe.
- [x] Memória de cálculo — não se aplica: sem fórmula, score ou regra numérica nova.

## Context

Duas entregas seguidas foram para produção com build verde, lint limpo e a suíte inteira passando, e mesmo assim quebraram a tela: #421 (tela branca) e #423 (navegação pior, aprovada sobre mockup que não representava a tela). O gate que falhou nas duas é o mesmo — **ninguém olhou a tela renderizada**.

Teste de unidade prova que a função calcula. Só a foto prova que a tela existe. Sem o "antes" fotografado, "melhor" não é julgamento, é opinião.

## Spec

Issue #427 no GitHub.

## Método — onde fica o ponto de corte

O corte é em **`firebase/*`, não nos hooks**. `resolve.alias` em `vite.harness.config.js` troca os cinco specifiers do SDK por um shim em memória; `src/firebase.js`, `AuthProvider`, `useTrades` e o resto rodam **reais e sem modificação**. O que a foto mostra é o código de produção.

Stubar hook reproduziria a forma e não o comportamento — e quando divergisse, o harness ficaria certo e a produção errada. É exatamente o defeito que este trabalho existe para eliminar.

Superfície do fake = superfície medida no `src/`: 20 símbolos do Firestore, 4 operadores de `where` (`==` 68 usos, `in` 3, `>=` 2, `<=` 1), ~15 collections raiz, 3 collectionGroups. Operador, collection ou caminho desconhecido **lança nomeando o chamador** — devolver `[]` em silêncio é como bug de dado vira "achei que era assim mesmo".

`onSnapshot` entrega assíncrono com latência configurável: é o que faz o estado de carregando existir de verdade, e ele é uma das telas fotografadas.

## Isolamento

Estrutural, não flag: `npm run build` roda com `vite.config.js`, que só enxerga `index.html`. `harness.html` é entrada separada. `src/__tests__/invariants/harnessIsolation.test.js` fecha o outro lado — nada fora de `src/harness/` (exceto a fixture) pode importar de lá, e `vite.config.js` não pode citar harness.

## Fixture

`src/__tests__/fixtures/mentor/` — 12 alunos, ~260 trades em 10 semanas, PRNG determinística. Uma fonte de dado, dois consumidores (harness + Vitest).

Todas as datas são relativas ao `hoje` injetado: `buildMentorRadar` classifica por `diasSemOperar` e semana corrente, então fixture com data absoluta envelhece em 24h e a turma inteira migra para "Inativo" — o screenshot de ontem deixaria de ser comparável com o de hoje.

Composição deliberada: cada uma das 7 faixas de atenção tem pelo menos um aluno, e os buckets de assinatura são mistos para o header da Torre (só alpha + trial-alpha) mostrar número **diferente** da lista de Acompanhamento (mais larga). Fixture homogênea esconderia esse comportamento, que é correto.

## Toque em produção

Duas linhas, sem efeito visual:

- `data-view={item.id}` no botão do `Sidebar`
- `data-tab={tab.id}` no botão de aba do `MentorDashboard`

Sem elas o roteiro navega por texto — e o texto muda em toda tela redesenhada, que é o que as fases seguintes vão fazer.

## Entrega

**26 PNGs** (13 telas × 2 viewports: desktop-1440 e laptop-1024, `deviceScaleFactor: 2`). O escopo dizia 12 telas; a 13ª (`carregando`) foi separada porque com os listeners pendurados o `MentorDashboard` devolve `<Loading/>` e a barra de abas nem existe — clicar nela era esperar por um elemento que o próprio estado impede de existir.

`.screenshots/` é gitignorado: é artefato de olhar, regenerável por `npm run test:e2e`, não conteúdo de repositório.

## Decisions

- DEC-427-01 — o corte é em `firebase/*`, não nos hooks.
- DEC-427-02 — fake que não conhece um operador/caminho **lança**; nunca devolve vazio silencioso.
- DEC-427-03 — uma fixture só, com datas relativas ao `hoje` injetado, servindo harness e Vitest.
- DEC-427-04 — navegação do roteiro por `data-view`/`data-tab`, não por texto de rótulo.
- DEC-427-05 — screenshots não versionados; o que se versiona é o roteiro que os reproduz.

## Sessions

- `harness + fixture + roteiro + 26 screenshots commit <sha> ok`

## Shared Deltas

- `src/version.js` — bump v1.89.1 (reservada em `74f8b754`)
- `docs/registry/versions.md` — marcar v1.89.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-01/16
- `CHANGELOG.md` — entrada `[1.89.1]`
- `docs/decisions.md` — DEC-427-01..05
- `docs/PROJECT.md` — encerramento

## Chunks

- CHUNK-01 (escrita) — `data-view` no `Sidebar`
- CHUNK-16 (escrita) — `data-tab` no `MentorDashboard`
