# Issue #144 — arch: a Torre é a única porta — roteador real, shell e design system adotado

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

- [x] Mockup apresentado — 03/09/2026 (seção Mockup abaixo)
- [ ] Memória de cálculo — **não se aplica**: nenhuma fórmula, score ou agregação nova. A ordenação da turma e os três gatilhos de prioridade são os do #101 (`mentorRiskRadar`), intactos. Aguardando concordância.
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado

**Autorização parcial já dada (03/09/2026):** *"a Torre é a única porta de entrada, abre o #144"* — autoriza a abertura e a decisão de produto. **Não** autoriza código: falta o aceite do mockup abaixo.

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

## Achados a resolver no caminho

- `MentorDashboard.jsx:596` — o bloco `activeView === 'students'` ("Lista de Alunos") é **inalcançável**: `App.jsx:394` intercepta `currentView === 'students'` e renderiza `StudentsManagement` antes. Código morto desde que as duas navegações passaram a coexistir. Sai na B3.
- `StudentOnboardingPage.jsx:15` usa `useParams` sem Router montado. Verificar se está inerte hoje; passa a funcionar de verdade na A1.

## Sessions

_(log linear; 1 linha por task)_

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
