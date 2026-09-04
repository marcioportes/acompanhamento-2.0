# Issue #144 — arch: a Torre é a única porta — roteador real, shell e design system adotado

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

- [x] Mockup apresentado — 03/09/2026 (seção Mockup abaixo)
- [x] Memória de cálculo — **não se aplica**: nenhuma fórmula, score ou agregação nova. A ordenação da turma e os três gatilhos de prioridade são os do #101 (`mentorRiskRadar`), intactos.
- [x] Marcio autorizou — 03/09/2026: *"a Torre é a única porta de entrada, abre o #144"* e, sobre o mockup, *"autorizado, pode ir"*.
- [x] Gate Pré-Código liberado

## Context

O mentor não tem endereço. A navegação inteira é uma string em `App.jsx:81`, e por isso cada travessia entre telas foi resolvida à mão — 8 estados de contexto de retorno e flags `_from*` penduradas no objeto do trade. Sobre isso, dois sistemas de navegação concorrentes (sidebar de 9 itens × 6 abas do dashboard) fazem o mentor logar em **Análises** em vez da Torre, que o próprio código declara ser a home. E quatro filas de trabalho como irmãs contradizem a premissa da Torre.

Objetivo: **uma porta (a Torre), endereços de verdade, uma casca só.**

## Spec

Ver issue body no GitHub: #144.

## Mockup

### 1. Menu do mentor — antes × depois

```
ANTES (9 itens, 2 sistemas)              DEPOIS (5 itens, 1 sistema)
─────────────────────────────            ─────────────────────────────
  Dashboard        → cai em Análises       Torre de Controle   ← home, destino do login
  Fila de Revisão                          Acompanhamento
  Acompanhamento                           Contas
  Contas                                   Assinaturas
  Aguardando Feedback                      Configurações
  Precisam Atenção
  Fechamentos                            + abas do dashboard: ELIMINADAS
  Assinaturas
  Configurações

  (Torre: sem item de menu,
   só aba dentro do dashboard)
```

As quatro filas somem do menu. Não somem do produto: viram a faixa **Minhas Pendências**, dentro da Torre.

### 2. A Torre depois

```
┌─ TORRE DE CONTROLE ──────────────────────── hoje · 03/09/2026 ─┐
│                                                                 │
│  [ 12 alunos ]  [ 4 operaram hoje ]  [ 3 atenção ]  [ 2 fora ]  │  ← tiles filtram A TURMA
│                                              ↑ era a tela "Precisam Atenção"
│                                                                 │
│  ▸ AGIR AGORA                                                   │
│    🔥 João — dia de fúria           [ficha] [WhatsApp]          │
│    ⬇ Ana — além do stop             [ficha] [WhatsApp]          │
│    ✅ Pedro pronto para promoção     [avaliar]                   │
│                                                                 │
│  ▸ A TURMA                          (12, ordenada por urgência) │
│    uma linha por aluno → clica, abre a ficha                    │
│                                                                 │
│  ▸ MINHAS PENDÊNCIAS                                            │
│    📋 Revisões a fazer          3   →  /pendencias/revisoes     │
│    💬 Aguardando feedback       7   →  /pendencias/feedback     │
│    📦 Fechamentos a aprovar     2   →  /pendencias/fechamentos  │  ← NOVO na faixa
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Calendário da turma e trades por dia → Análises                │  ← link de rodapé
└─────────────────────────────────────────────────────────────────┘
```

Contador zerado fica cinza e sem link — não some, para o mentor saber que a caixa existe e está vazia.

### 3. Mapa de rotas

```
MENTOR
  /                                     → redirect /torre
  /torre                                Torre de Controle (home)
  /analises                             calendário da turma + trades do dia
  /alunos                               Acompanhamento (gestão: cadastro, bloqueio, contas)
  /alunos/:studentId                    ficha do aluno (o atual "View As Student")
  /alunos/:studentId/plano/:planId      extrato do plano
  /alunos/:studentId/revisao/:reviewId  Revisão Semanal
  /alunos/:studentId/assessment         assessment 4D
  /trades/:tradeId                      feedback do trade
  /pendencias/revisoes                  fila de revisão
  /pendencias/feedback                  aguardando feedback (árvore aluno→dia→plano→trade, #408)
  /pendencias/fechamentos               inbox de fechamentos
  /contas · /assinaturas · /configuracoes

ALUNO
  /                                     → redirect /painel
  /painel · /feedback · /revisoes · /ciclos · /relatorio
  /contas · /mesa-prop · /maturidade
  /plano/:planId                        extrato
  /trades/:tradeId                      feedback do trade
```

**O que isso resolve, em uma frase cada:** F5 não perde o lugar · o back do browser volta de verdade · o mentor manda `/alunos/joao/revisao/2026-09` no WhatsApp e a pessoa abre ali · os 8 estados de retorno e as flags `_from*` deixam de existir, porque "voltar" vira rota-pai.

### 4. Estados e mensagens

| Situação | Comportamento |
|---|---|
| Rota inexistente | volta pra Torre (mentor) / painel (aluno), sem tela de erro |
| Aluno tenta rota de mentor | volta pro painel — o guard de role vive na rota, não na página |
| `:studentId` que não existe | "Aluno não encontrado" + link pra Torre |
| Dados ainda carregando | shell renderiza, conteúdo em loading — o menu nunca pisca |
| Mentor na ficha do aluno | faixa de contexto no topo com o nome + "voltar à Torre" (substitui o banner roxo fixo de hoje) |

### 5. Decisões de produto embutidas no mockup

- **D1 — "Precisam Atenção" deixa de ser tela.** Vira o tile-filtro que **já existe** no header da Torre (`filtro === 'atencao'`). A faixa A TURMA já lista todo mundo ordenado por urgência; a tela separada recortava a mesma população uma segunda vez.
- **D2 — "Análises" sai do menu** e vira link de rodapé da Torre. É diagnóstico: serve depois de escolher a pessoa, não para competir com a triagem.
- **D3 — Fechamentos entra em Minhas Pendências.** Hoje a faixa só tem revisões e feedback; o inbox de fechamentos ficava só no menu.
- **D4 — "Acompanhamento" continua no menu.** É administração (cadastro, bloqueio de login, contas), não trabalho do dia. A Torre não substitui isso.
- **D5 — Sem tela nova e sem tela apagada** além do D1. O trabalho todo é de endereço, casca e menu.

## Phases

- **A1** — Router + shell: `AuthProvider > Router > AppShell`, rotas do mentor e do aluno, guard de role na rota, redirects. Sem mudança visual.
- **A2** — Matar os contextos de retorno: os 8 `useState` do App e as flags `_fromLedgerPlanId`/`_fromReviewContext` saem; "voltar" vira rota-pai.
- **A3** — `View As Student` vira rota (`/alunos/:studentId`), não estado global.
- **B1** — Menu do mentor reduzido a 5 itens; Torre como destino do login.
- **B2** — Minhas Pendências completa (fechamentos) e Precisam Atenção convertida em filtro (D1).
- **B3** — Análises vira `/analises`, saída pelo rodapé da Torre. Remover a barra de abas do MentorDashboard e o `viewMapping`.
- **C1** — `AppShell` assume header/padding/título; as 10 páginas param de declarar `min-h-screen p-6` e `<h1>`.
- **C2** — Adoção do design system: 227 superfícies cruas → `glass-card`; botões → `btn-*`; escala de raio única.

## Entregue × mockup

| Mockup | Entregue |
|---|---|
| Menu do mentor 9 → 5 itens | sim |
| Torre como destino do login | sim |
| Minhas Pendências com Fechamentos | sim — três linhas iguais, contador zerado fica cinza |
| D1 "Precisam Atenção" vira filtro | sim — a TELA saiu; ver ressalva abaixo |
| D2 Análises sai do menu, vira rodapé da Torre | sim |
| Mapa de rotas | sim, com um ajuste: a ficha do aluno (`/alunos/:id`) e o "ver como aluno" (`/alunos/:id/como-aluno`) eram DUAS coisas diferentes no código antigo (`selectedStudent` interno do dashboard × `viewingAsStudent` global do App) e viraram dois endereços |

**Ressalva do D1 (a decisão que merece o olho de Marcio):** a tela "Precisam Atenção" recortava por **performance acumulada** — prejuízo, win rate < 40%, profit factor < 0,8 (`identifyStudentsNeedingAttention`). O tile "atenção" da Torre recorta por **conduta e presença** (`faixaDeAtencao` ≤ FORA_DO_PLANO). **Não são a mesma população.** Removi a tela como o mockup aprovado dizia, e o critério de performance não sobreviveu em lugar nenhum. É coerente com #376 ("Financeiro mede conduta de risco, não performance"), mas é uma perda real de sinal — se fizer falta, volta como tile.

## Decisão aberta (não bloqueia)

**Qual é o botão primário do produto?** Existem dois idiomas convivendo: o gradiente azul→ciano do `.btn-primary` (35 usos) e um azul chapado escrito à mão (19 usos, em 8 combinações de padding). Criei `.btn-primary-sm` e converti o que casava exatamente, mas escolher entre gradiente e chapado muda a cara de toda ação principal — e o `ConfirmDialog` tem um argumento a favor do chapado: lá o azul é uma variante ao lado de vermelho e âmbar, e um gradiente sozinho no meio de dois botões chapados fica pior. Decidido isso, é uma linha em `index.css`.

## Achados a resolver no caminho

- `MentorDashboard.jsx:596` — o bloco `activeView === 'students'` ("Lista de Alunos") é **inalcançável**: `App.jsx:394` intercepta `currentView === 'students'` e renderiza `StudentsManagement` antes. Código morto desde que as duas navegações passaram a coexistir. Sai na B3.
- `StudentOnboardingPage.jsx:15` usava `useParams` sem Router montado — inerte até agora, passa a funcionar de verdade.
- `StudentEmotionalCardWrapper` (MentorDashboard) era consumido só pelo bloco morto; saiu, e com ele `useComplianceRules`/`useEmotionalProfile` do arquivo.
- `useMentorClosureInbox` no Sidebar: listener do Firestore assinado só para pintar um número no menu. Saiu com o item.

## Sessions

- `fase A+B [roteador + Torre única porta] commit c4228f30 ok` — App.jsx 562→28 linhas
- `fase C [shell + design system] commit 8f66f9f2 ok` — 14 páginas sem container próprio
- `fase C [testes de rota + invariante de chrome] commit 3c743fd7 ok`
- `limpeza [resíduos mortos do shell] commit d76d978d ok`
- `PR #420 aberto` — suíte 4768/301 arquivos · lint sem erro novo · build ok · aguardando revisão visual de Marcio

## Shared Deltas

- `src/version.js` — bump v1.88.0 (reservada em `7621bf6d`)
- `docs/registry/versions.md` — marcar 1.88.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-01, CHUNK-02, CHUNK-16
- `CHANGELOG.md` — nova entrada `[1.88.0]`
- `docs/PROJECT.md` — encerramento
- `docs/decisions.md` — DEC-144-01..05 (D1..D5 acima)
- `CLAUDE.md` / `docs/invariants.md` — **avaliar** invariante de arquitetura de informação (nível 1 menu / nível 2 rota / nível 3 card / nível 4 modal) que a Fase 3 do épico original pedia. Delta proposto no encerramento, não agora.

## Decisions

- DEC-144-01 (D1) · DEC-144-02 (D2) · DEC-144-03 (D3) · DEC-144-04 (D4) · DEC-144-05 (D5)

## Chunks

- CHUNK-01 (escrita) — shell, sessão, guard de role na rota
- CHUNK-02 (escrita) — rotas e menu do aluno
- CHUNK-16 (escrita) — Torre, dashboard do mentor, filas
- CHUNK-03/04/05/08/09/10/17 (leitura) — páginas atravessadas pelas rotas
