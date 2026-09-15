# Issue #444 — feat: Precisam Atenção vira fila de trades prioritários
> **Branch:** `feat/issue-444-trades-precisam-atencao`
> **Aberto em:** 14/09/2026
> **Status:** 🔵 Rascunho — aguardando mockup + memória aprovados
> **Versão reservada:** 1.92.0

## Autorização

- [x] Mockup apresentado (14/09/2026)
- [x] Memória de cálculo apresentada (14/09/2026), **calibragem na base pendente**
- [x] Marcio autorizou (14/09/2026: "autorizado", modo autônomo acionado)
- [x] Gate Pré-Código liberado

## Context

Hoje "Precisam Atenção" lista **alunos** por prejuízo, win rate e profit factor da vida inteira (`calculations.js:239-241`). É uma situação, não um fato: o aluno entra e nenhum ato do mentor o tira de lá. A lista também não diz qual trade olhar, e dá falso positivo (um aluno lucrativo com acerto baixo aparece marcado).

Decisão do Marcio (13-14/09): a unidade passa a ser o **trade**. É um subconjunto do Aguardando Feedback, com o motivo escrito, e **sai quando o mentor dá o feedback**. Só alunos do Alpha. A Torre destaca esses trades no "Você deve", e o badge do menu passa a contá-los.

## Spec

Ver issue body: #444.

## Mockup

### M1 — aba "Precisam atenção" (MentorDashboard, `activeView === 'attention'`)

Pior caso de altura: a lista cresce com a fila, sem teto. Colapsa a partir do 6º aluno, com o mesmo `Bloco` da Torre.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Precisam atenção              7 trades · 3 alunos · feedback prioritário │
├───────────────────────────────────────────────────────────────────────────┤
│ ▌ Sandra Maria                                           3 trades        │
│ │   26/08 10:42  WINV26  −R$ 180   ● Revenge trading                     │
│ │               reentrada rápida após uma perda                [Abrir →] │
│ │   26/08 11:05  WINV26  −R$ 95    ● Revenge trading  ● Risco acima do RO│
│ │               o valor do stop passou do RO do plano          [Abrir →] │
│ │   26/08 11:31  WINV26  −R$ 96    ● Tilt / reatividade        [Abrir →] │
│ ▌ Joe Hott · Apex EOD 50K (USD)                          2 trades        │
│ │   11/09 09:45  MNQU26  −$ 314    ● Posição sem proteção      [Abrir →] │
│ │   ...                                                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Agrupamento:** por aluno e depois trade, mais recente primeiro. Aluno com dois planos: o nome do plano entra no cabeçalho do grupo (#442).
- **Cada linha:** data, hora (`fmtTradeTime`), ativo, resultado na moeda do plano e um **chip por motivo**, com rótulo de `BEHAVIOR_LABELS` e a primeira frase de `narrativeFor` embaixo.
- **Clique na linha ou "Abrir →":** abre o trade no compositor de feedback, o mesmo destino do Aguardando Feedback.
- **Vazio:** ✓ "Nenhum trade pesado esperando feedback."
- **Saída:** o mentor envia o feedback, o status sai de `OPEN`/`QUESTION` e a linha some no próximo snapshot.

### M2 — Torre, bloco 3 "Você deve"

```
 3  Você deve   tem gente parada esperando por você                        5
 ─────────────────────────────────────────────────────────────────────────
 ⚠ Sandra Maria   3 de 5 trades pesados · Revenge trading, Tilt  [Priorizar →]
 ⚠ Joe Hott       2 de 2 trades pesados · Posição sem proteção   [Priorizar →]
 ✉ Ana Souza      4 trades esperam seu feedback                  [Escrever →]
 ✉ Revisões em rascunho   2 rascunhos para publicar            [Fila de Revisão]
```

- **Ordem:** alunos com trade pesado vêm primeiro, com ícone ⚠ na cor `--warn`. Depois vêm os demais do jeito de hoje.
- **Unidade:** continua sendo a pessoa (a regra do "devo" não muda). O número do bloco não muda.
- **"Priorizar →":** vai para a aba Precisam atenção.

### M3 — menu lateral

O badge "Precisam Atenção" passa a contar **trades pesados sem feedback**, da mesma fonte que a aba (#430: um número só).

## Memória de Cálculo

### Inputs

| dado | caminho | uso |
|---|---|---|
| status do trade | `trades.status` | `OPEN` ou `QUESTION` = aguardando feedback (`useTrades.getTradesAwaitingFeedback`) |
| famílias do motor | `trades.behaviorProfile.families[]` com `canonicalCode`, `severity` | candidato a pesado |
| dispensa do mentor | `trades.mentorClearedViolations[]`, chave `canonicalCode:tradeId` | tira o padrão |
| taxonomia | `BEHAVIORAL_PATTERNS[code]` com `valence`, `feedsGates`, `severityDefault` | filtro |
| teto de leitura | `severidadeVigente(code, severity)` | gravidade efetiva |
| escopo Alpha | `isOnRadar(student, subs)`, que usa `inReviewScope(classifyStudent(student, subs))` | só Alpha e trial-alpha |

Nada é gravado. Tudo é derivado em memória, como a Torre (INV-15).

### Fórmula

```
familiasDeRisco(trade)             ← já existe (mentorRiskRadar.js:522):
                                     negativas, vigentes, sem as dispensadas
motivosPesados(trade) = familiasDeRisco(trade)
                         .filter(f => f.severity === 'HIGH' && GATE_CODES.includes(f.code))

precisaAtencao(trade) =
     trade.status ∈ {OPEN, QUESTION}
  ∧  aluno(trade) está no radar (Alpha)
  ∧  motivosPesados(trade).length > 0
```

**Uma regra só.** `motivosPesados` fica em `mentorRiskRadar.js`, ao lado de `familiasDeRisco`. A aba, o badge e a Torre consomem a mesma função (lição do #430).

### Quais padrões entram hoje (o corte proposto)

| padrão | rótulo | gravidade | alimenta gate | entra? |
|---|---|---|---|---|
| TILT | Tilt / reatividade | alta | sim | **sim** |
| LOSS_CHASING | Revenge trading | alta | sim | **sim** |
| STOP_PANIC | Pânico no stop | alta | sim | **sim** |
| RISK_OVER_RO | Risco acima do RO | alta | sim | **sim** |
| UNPROTECTED_SIZE | Posição sem proteção | alta | sim | **sim** |
| AVERAGING_DOWN | Preço médio contra | alta | não | não |
| DIRECTION_FLIP | Virada de mão | alta | não | não |
| CHASE_REENTRY, SUB_SIZING, OVERTRADING | — | média | sim | não |

- **Corte alternativo** (a decidir com a calibragem): toda gravidade alta, com ou sem gate. Isso acrescenta AVERAGING_DOWN e DIRECTION_FLIP, que estão no conjunto de risco da Torre (`FAMILIAS_RISCO`).
- **Fora:** "estourou o stop do dia" é fato do dia desde o #402, não do trade.

### Casos limite

- **Trade sem `behaviorProfile`** (legado ou motor não rodou): não é pesado, fica só no Aguardando Feedback.
- **Padrão dispensado pelo mentor:** sai do motivo. Se era o único, o trade sai da lista mesmo sem feedback. É o mesmo efeito que já tem na Torre.
- **`QUESTION` (aluno perguntou depois do feedback):** conta como aguardando, então o trade pesado **volta** à lista. Isso está coerente com "tem alguém esperando por você".
- **Aluno fora do Alpha** (Espelho ou VIP) ou com login bloqueado: não aparece.
- **Assinaturas ainda carregando:** `isOnRadar` sem subs cai para não-Alpha, e a lista aparece vazia no primeiro frame. Isso é o **inverso** do #430 ("não esconde enquanto carrega"). Aqui fica vazio até carregar, porque mostrar trade de aluno Espelho como prioridade seria alarme falso.
- **Aluno com dois planos:** as linhas agrupam por plano no cabeçalho, e o resultado vai na moeda do plano. Nunca se soma.
- **Contagem:** trades no badge e na aba, pessoas na Torre.

### Exemplo numérico (ilustrativo, a validar na calibragem)

Sandra, dia 26/08 no plano WINFUT, 5 trades em `OPEN`:

| trade | famílias (código:gravidade) | dispensadas | motivosPesados | pesado? |
|---|---|---|---|---|
| t1 10:15 | CLEAN_EXECUTION:— | — | [] | não |
| t2 10:42 | LOSS_CHASING:HIGH | — | [LOSS_CHASING] | **sim** |
| t3 11:05 | LOSS_CHASING:HIGH, RISK_OVER_RO:HIGH | — | [LOSS_CHASING, RISK_OVER_RO] | **sim** |
| t4 11:31 | TILT:HIGH, OVERTRADING:MEDIUM | — | [TILT] | **sim** |
| t5 11:50 | UNPROTECTED_SIZE:HIGH | `UNPROTECTED_SIZE:t5` | [] | não |

Resultado: a aba mostra 3 linhas, o badge conta 3, a Torre mostra "Sandra · 3 de 5 trades pesados". O mentor dá feedback em t2 e t2 vai para `REVIEWED`: aba 2, badge 2, Torre "2 de 4".

### Calibragem obrigatória antes do código (bloqueada)

Script de leitura (`scripts/issue-444-calibragem.mjs`, não escreve nada): trades `OPEN`/`QUESTION` de alunos no radar, contados por padrão × gravidade, com a proporção pesados ÷ aguardando nos dois cortes.

- **Critério de aceite do corte:** a prioridade fica abaixo de ~30% da fila. Acima disso, apertar o corte.
- Precisa de leitura de produção, e o classificador de segurança da sessão bloqueou em 13/09.

## 3.1 Decisões Antecipadas (Fase 2 — respostas do Marcio)

- **D1 — mockup e memória aprovados** como estão (M1 aba por trade com motivo, M2 Torre com ⚠ e "Priorizar →", M3 badge conta trades).
- **D2 — corte do "pesado" = A:** severidade vigente HIGH ∩ `GATE_CODES`, sem as dispensadas. Hoje isso dá TILT, LOSS_CHASING, STOP_PANIC, RISK_OVER_RO e UNPROTECTED_SIZE. Implementar como constante nomeada, derivada da taxonomia, sem lista fixa no código.
- **D3 — sem calibragem na base.** Nenhum script de contagem, nenhuma leitura de produção. O loop não bloqueia por isso.

## 3.2 Decisões Autônomas (Coord, durante o loop)

_(formato: `DEC-AUTO-444-NN: <decisão> | Justificativa: ...`)_

## Phases

Modo autônomo acionado por Marcio em 14/09/2026. Tasks na ordem, uma por worker:

- **01-regra-pura:** `motivosPesados(trade)` e `tradesPrecisamAtencao({ trades, students, subscriptions })` em `src/utils/mentorRiskRadar.js`, reaproveitando `familiasDeRisco` e `isOnRadar`. Testes antes da UI (INV-05) cobrindo os casos limite da Memória de Cálculo e o exemplo da Sandra.
- **02-aba-e-badge:** `studentsAttention.js` passa a expor trades (a mesma função para a aba e para o badge, #430). A aba em `MentorDashboard.jsx` segue M1. O badge em `App.jsx`/`Sidebar.jsx` segue M3. A lista antiga por aluno sai (`identifyStudentsNeedingAttention` só se não tiver outro consumidor). Testes de render.
- **03-torre-voce-deve:** `TorreAgenda.jsx`, bloco 3 segue M2 (quem tem trade pesado primeiro, ⚠, "Priorizar →" para a aba), com `pendencias.pesados` no radar. Testes.
- **04-entrega:** harness nas 3 superfícies, lint nos arquivos tocados, suíte completa e DebugBadge nos componentes tocados. Report com as fotos.

A calibragem na base (A0) fica fora do loop. Worker headless não tem leitura de produção, e o corte segue a decisão de §3.1.

## Sessions

## Shared Deltas

- `docs/PROJECT.md`: nova linha de versão, "Precisam Atenção por trade"
- `src/version.js`: 1.92.0 (já reservada no main)
- `docs/registry/versions.md`: marcar 1.92.0 como consumida
- `docs/registry/chunks.md`: liberar CHUNK-16
- `CHANGELOG.md`: entrada `[1.92.0]`

## Decisions

## Chunks

- CHUNK-16 (escrita): aba, badge do menu, TorreAgenda, `studentsAttention`, `mentorRiskRadar`
- CHUNK-11 (leitura): taxonomia, severidade, `GATE_CODES`
- CHUNK-08 (leitura): status do trade, fila Aguardando Feedback
