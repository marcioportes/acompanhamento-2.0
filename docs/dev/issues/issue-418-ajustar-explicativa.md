# Issue #418 — feat: a etapa Ajustar explica Kelly e Monte Carlo — e o histograma passa a ser o real

## Autorização

- [x] Mockup apresentado — estrutura da tela negociada em plan mode (02/09/2026); Marcio pediu explicitamente as duas leituras juntas ("não dá pra ter os dois?") → ordem híbrida veredito → evidência → recomendação → decisão.
- [x] Memória de cálculo apresentada — abaixo (histograma + pLoss; a matemática existente não muda).
- [x] Marcio autorizou — 02/09/2026, aprovação do plano `~/.claude/plans/humming-dancing-candle.md`.
- [x] Gate Pré-Código liberado.

**Gate humano remanescente:** o texto de `whatIs` / `whyExists` / `soWhat` de Kelly e Monte Carlo vai a review antes de virar código.

## Context

A etapa 6 do wizard de fechamento (`Step6Adjust.jsx`) é a única das oito sem título, sem frase de abertura e sem explicação clicável. O aluno decide quanto arriscar no próximo ciclo diante de um card "Risco ótimo (Kelly ¼)" com badge `matemática` e percentis crus `p10/p50/p90`. Não sabe o que os modelos fazem nem que vantagem tem em olhar para eles.

Junto, um defeito de credibilidade: o histograma é decorativo — altura derivada do índice da barra, não dos 1000 resultados, que existem e são descartados.

## Spec

Issue body no GitHub: #418. Plano completo: `~/.claude/plans/humming-dancing-candle.md`.

## Mockup

```
Quanto arriscar por trade no próximo ciclo            ← h3 + frase de abertura
→ Manter 0,84% por trade                              ← veredito, 1 linha

[banner capital alocado > equity]      (condicional, inalterado)
[banner crítico PAUSAR]                (condicional, cópia sem jargão)
[capital base]                         (condicional, inalterado)

DE ONDE VEM ESSE NÚMERO
 ▸ Até quanto dá pra arriscar sem se tirar do jogo          Kelly ¼   2,4%
 ▸ Que faixa de resultado esperar do próximo ciclo    Monte Carlo   38% no vermelho
   └ ao abrir: o que é / por que existe / o que muda na sua decisão
     + histograma real com marcação de zero e p10/p50/p90

A RECOMENDAÇÃO
 [capital base]  [risco por trade ↺]  [alvo por trade →]
 ▸ Riscos identificados (2)

SUA DECISÃO
 [Aceitar]  [Editar]  [Manter sem aceitar]
```

Estados do explicador: fechado (default) → header com rótulo amigável + número-chave + chevron; aberto → corpo em três blocos rotulados. `useState(new Set())`, padrão `Step5Check.jsx:251`. Expansível, não `title=` — tooltip não existe em touch.

## Memória de Cálculo

**A matemática não muda.** Kelly, bootstrap e `closurePlanAdvisor` ficam intactos; percentis, `min`, `max`, `mean` e `reason` byte-idênticos. Só se expõe dado que o motor já calcula e descarta.

**Inputs** — `runMonteCarloBootstrap` já produz `outcomes[]` ordenado (`monteCarlo.js:75`), um R$ por simulação, aditivo (sem composição).

**Novos campos (aditivos):**
- `pLoss = |{ o ∈ outcomes : o < 0 }| / nSims` — fração de cenários que terminam no vermelho.
- `histogram = { bins, binWidth, min, max, counts[] }` com `binWidth = (max − min) / bins`, `bins = 24` default, `Σ counts === nSims`.

**Casos limites:**
- `max === min` (pool homogêneo, teste vigente em `monteCarlo.test.js:68`) → `binWidth` 0 e índice `NaN`; devolver `{ bins: 1, binWidth: 0, counts: [nSims] }`.
- Early-returns de erro (`empty_pool`, `invalid_n_per_sim`) → `histogram: null`, `pLoss: null` — shape uniforme.
- `v === max` → clamp do índice em `bins − 1`.
- `pctOfBase() === null` (D-01 do #416) → leitura em moeda, nunca `NaN%`.
- Amostra pequena qualifica `pLoss` na cópia — número frágil não domina a leitura.

**Exemplo numérico** (ciclo de agosto, base R$ 30.426, risco R$ 256, 20 trades): expectância +0,08R → esperado ≈ +R$ 410 (+1,3%); σ do ciclo ≈ 4,5R ≈ 3,8%. Com `pLoss ≈ 0,38`, a leitura é "em 380 dos 1000 cenários o próximo ciclo termina no vermelho" — número que responde "o que eu ganho olhando isso" melhor que qualquer percentil.

## Phases

- A — motor: `histogram` + `pLoss` em `monteCarlo.js` + testes de não-regressão dos percentis
- B — cópia: `adjustExplainers.js` (catálogo + builders) + testes — **texto a review antes**
- C — desenho: `McDistribution.jsx` + `ExplainerCard.jsx` + testes
- D — tela: `Step6Adjust.jsx` — cabeçalho, veredito, reordenação, fiação, limpeza de jargão
- E — verificação: suíte cheia, build, passada manual no wizard (inclui conta em USD)

## Sessions

## Shared Deltas

- `docs/PROJECT.md` — entrada de encerramento v0.40.40
- `src/version.js` — bump v1.87.0 (já reservada)
- `docs/registry/versions.md` — marcar v1.87.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-03
- `CHANGELOG.md` — entrada `[1.87.0]`

## Decisions

## Chunks

- CHUNK-03 (escrita) — wizard de fechamento + `utils/cycleClosure`
- CHUNK-04, CHUNK-05, CHUNK-06 (leitura) — trades, compliance e emocional alimentam o pool do bootstrap
