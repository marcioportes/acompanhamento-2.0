# GITHUB ISSUES — 🟠 ALTA (6 issues)
## Pronto para colar em https://github.com/marcioportes/acompanhamento-2.0/issues/new

---

## ISSUE 1 de 6

**Título:** `bug: Aluno não consegue deletar próprio plano (Firestore rules)`

**Labels:** `type:bug`, `Sev2`, `module:dashboard-aluno`

**Corpo:**

Atualmente o aluno não consegue deletar seu próprio plano. A operação falha com "Missing or insufficient permissions".

### Root cause provável

A rule de `plans/{planId}` permite delete para `isMentor() || isOwner(resource.data.studentId) || isOwnerByEmail(resource.data.studentEmail)`. O problema pode estar em:
- `isMentor()` usa `marcio.portes@me.com` mas o login é `marcio.portes@icloud.com` (inconsistência conhecida)
- `isOwner` compara `request.auth.uid` com `resource.data.studentId` — se o plano foi criado pelo mentor (viewAs), o `studentId` pode ser o UID do aluno, não do usuário logado
- `isOwnerByEmail` depende de `studentEmail` existir no documento

### Investigar

1. `firestore.rules` — rule de `plans/{planId}` delete
2. Testar com aluno real (não mentor em viewAs)
3. Verificar se `studentId` e `studentEmail` estão preenchidos no documento do plano

### Referência
- QA#24 (backlog QA)

---

## ISSUE 2 de 6

**Título:** `bug: Screen flicker durante ativação de trades do CSV staging`

**Labels:** `type:bug`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Corpo:**

Durante a ativação de trades do staging CSV (botão "Ativar" no CsvImportManager), a tela pisca visivelmente. O dashboard re-renderiza múltiplas vezes conforme cada trade é adicionado via `addTrade`.

### Comportamento atual
- Cada `addTrade` dispara `onTradeCreated` (CF) → atualiza PL → listener `useTrades` re-renderiza
- Com 10+ trades, são 10+ re-renders visíveis
- `setSuspendListener(true)` existe mas o efeito visual persiste

### Comportamento esperado
Overlay opaco/bloqueante sobre o dashboard durante batch activation. Progress bar ou spinner dentro do overlay. Dashboard só re-renderiza uma vez ao final do batch.

### Arquivos
- `src/components/csv/CsvImportManager.jsx`
- `src/pages/StudentDashboard.jsx` (setSuspendListener)

### Referência
- QA#3 (backlog QA)
- CSV Import backlog (ARCHITECTURE.md)

---

## ISSUE 3 de 6

**Título:** `feat: Mentor editar feedback já enviado`

**Labels:** `type:feature`, `Sev2`, `epic:dashboard-mentor`, `module:trade-entry`

**Corpo:**

Uma vez que o mentor envia feedback em um trade, não há opção de editar. Erros de digitação, complementos ou correções exigem envio de novo feedback, poluindo o histórico da conversa.

### Comportamento esperado
- Botão "Editar" visível no último feedback enviado pelo mentor
- Edição inline (mesmo campo de texto, mesmo estilo)
- Indicador visual de "editado em DD/MM/YYYY HH:mm" após salvar
- Apenas o último feedback é editável (histórico anterior é imutável)

### Impacto
- `src/components/Feedback/*`
- `src/utils/feedbackHelpers.js`
- Firestore: campo `editedAt` + `editedText` no documento de feedback (ou versionamento inline)

### Referência
- QA#7 (backlog QA)
- DT-012 (ARCHITECTURE.md)

---

## ISSUE 4 de 6

**Título:** `bug: Parciais não exibidas no TradeDetailModal e FeedbackPage`

**Labels:** `type:bug`, `Sev1`, `module:trade-entry`, `epic:aluno-stability`

**Corpo:**

Trades com parciais (`_partials` no documento Firestore) não exibem as parciais nas telas de visualização:
1. **TradeDetailModal** (filtro calendário do Dashboard-aluno): mostra Entry/Exit/Qty mas NÃO mostra parciais individuais com horários
2. **FeedbackPage** ("Ver conversa completa"): mesmo problema
3. **Modal de edição**: parciais aparecem normalmente — confirma que os dados existem no Firestore

### Impacto na mentoria
Mentor não consegue avaliar timing de entradas/saídas durante revisão diária. Bloqueia workflow.

### Root cause (diagnosticado sessão 22/03/2026)

**TradeDetailModal:**
- Componente já suporta `getPartials` como prop
- `StudentDashboard.jsx` NÃO passa `getPartials` ao renderizar `TradeDetailModal`
- Sem `getPartials`, condição `trade.hasPartials && getPartials` = `true && undefined` = falsy
- Cai no fallback `trade._partials` que deveria funcionar, mas pode falhar em edge cases

**FeedbackPage:**
- Recebe `getPartials` via App.jsx
- Busca da subcollection `trades/{id}/partials`
- Se subcollection vazia (trades CSV entram com `_partials` como campo array, não subcollection), retorna vazio
- Fallback para `trade._partials` inline não está implementado

### Fix documentado
Prompt de merge com código exato (antes/depois) disponível em `docs/PROMPT-MERGE-PARTIALS-DISPLAY-FIX.md`.

Resumo do fix:
1. `StudentDashboard.jsx` — passar `getPartials` como prop ao `TradeDetailModal`
2. `TradeDetailModal.jsx` — fallback robusto: subcollection vazia → usa `trade._partials`
3. `FeedbackPage.jsx` — mesmo fallback robusto

### Arquivos
- `src/components/TradeDetailModal.jsx`
- `src/pages/FeedbackPage.jsx`
- `src/pages/StudentDashboard.jsx` (prop drilling getPartials)

### Referência
- Sessão B (CHUNK-10), 22/03/2026
- AVOID-SESSION-FAILURES.md, Seção 2 (estrutura Firestore _partials)
- CHUNK-04 (TradeDetailModal), CHUNK-08 (FeedbackPage)

---

## ISSUE 5 de 6

**Título:** `feat: Student Onboarding & Assessment 4D — Fase A (CHUNK-09)`

**Labels:** `type:feature`, `Sev1`, `epic:architecture`, `module:dashboard-aluno`

**Corpo:**

Implementação do setup inicial do aluno com assessment estruturado em 3 estágios, estabelecendo o marco zero para evolução emocional e comportamental.

### Assessment 3 estágios
1. **Questionário base** — 34 perguntas (22 fechadas + 12 abertas), aluno sozinho
2. **Sondagem adaptativa** — 3-5 perguntas geradas pela IA baseadas em incongruências e hesitações detectadas
3. **Validação pelo mentor** — entrevista 20-30 min com relatório completo incluindo sondagem

### Scoring engine 4D
- **Emocional:** média 3 sub-dimensões (autoconhecimento, regulação, resiliência)
- **Financeiro:** sizing×0.40 + risk_management×0.40 + stop_usage×0.20
- **Operacional 5D:** decision_mode×0.25 + timeframe×0.20 + strategy_fit×0.20 + tracking×0.15 + emotion_control×0.20 (herdado do emocional — DEC-013)
- **Experiência:** stage IA + stageBase
- **Composite:** E×0.25 + F×0.25 + O×0.20 + X×0.30 (dupla penalidade emocional ~0.29)

### Features
- Randomização de alternativas (Fisher-Yates + persistência Firestore) — DEC-015
- Detecção de incongruências intra + inter-dimensional (5 flags) — DEC-014
- Sondagem adaptativa pós-questionário (3-5 perguntas IA) — DEC-016
- 4 Cloud Functions com Anthropic API: classifyOpenResponse, generateProbingQuestions, analyzeProbingResponse, generateAssessmentReport
- State machine: lead → pre_assessment → ai_assessed → probing → probing_complete → mentor_validated → active
- Validação mentor com override por sub-dimensão + calibração IA vs mentor

### Entrega
- 33 arquivos (7 utils, 3 hooks, 11 components, 1 page, 4 CFs, 5 test suites, 2 docs)
- 128 testes novos, 5 suites
- ZIP + MERGE-INSTRUCTIONS pronto para aplicar
- Requer: `npm install @anthropic-ai/sdk` nas functions + `firebase functions:secrets:set ANTHROPIC_API_KEY`

### Decisões arquiteturais
- DEC-013: Operacional 5D com emotion_control herdado
- DEC-014: Cross-check inter-dimensional (5 flags)
- DEC-015: Randomização via persistência
- DEC-016: Sondagem adaptativa pós-questionário
- DEC-021: Stage diagnosticado por IA (pattern-matching, não fórmula)
- DEC-022: Marco zero tábula rasa (gates_met=0)

### Fase B (futuro — issue separado)
Evolution tracking: reviews mensais 3 camadas, gates de progressão híbridos, mentor journal, timeline 4D.

### Referências
- BRIEF: `docs/sprint-behavioral/BRIEF-STUDENT-ONBOARDING-v3.md` (v3.2)
- SPEC: `docs/sprint-behavioral/SPEC-EVOLUTION-TRACKING.md`
- COORDINATION: `COORDINATION-CHUNK09-FINAL-20260322.md`
- CHUNK-REGISTRY: CHUNK-09

---

## ISSUE 6 de 6

**Título:** `feat: Order Import v1.1 — Modo Criação (ordens→trades) + Confronto + Deduplicação`

**Labels:** `type:feature`, `Sev2`, `epic:architecture`, `module:dashboard-aluno`

**Corpo:**

Follow-up do #87 (CHUNK-10 v1.0, mergeado 22/03/2026). O v1.0 importa ordens para análise comportamental (collection `orders`). O v1.1 adiciona criação de trades e confronto com trades existentes.

### V1.1a — Modo Criação: Ordens → Trades

Quando operação reconstruída NÃO tem trade correspondente:
- Gerar trade via `addTrade` (gateway único, INV-01/INV-02) com dados reais da corretora
- Campos auto: ticker, side, entry, exit, qty, entryTime, exitTime, stopLoss, _partials
- Campos pendentes: emotionEntry, emotionExit, setup (aluno complementa depois)
- CFs disparam normalmente (compliance, PL, movements)
- Deduplicação: checar `ticker + side + entryTime (±5min) + qty` antes de criar

### V1.1b — Modo Confronto: Ordens vs Trades existentes

Quando operação reconstruída TEM trade correspondente:
- Comparação lado a lado (trade registrado vs dados da corretora)
- Divergências destacadas (parciais, stop, timestamps)
- Ações: "Aceitar como está" (vincula correlatedTradeId) ou "Atualizar com corretora" (DELETE + CREATE via addTrade)
- Regra: NÃO usar updateTrade para valores financeiros — DELETE + CREATE garante pipeline limpo

### V1.1c — UI Master/Detail: Ordens no Trade

Componente `TradeOrdersPanel` dentro de TradeDetailModal e FeedbackPage:
- Ordens de entrada/saída com timestamps
- Stop orders (presença/ausência/movimento)
- Canceladas relevantes
- Impacto: toca CHUNK-04 (TradeDetailModal) e CHUNK-08 (FeedbackPage)

### V1.1d — Deduplicação retroativa CSV Import

Hash de campos-chave protege contra reimportação do mesmo CSV de performance. Mesmo mecanismo protege importação de ordens.

### Limitações v1.0 que esta issue resolve
1. ~~Não cria trades a partir de ordens~~ → Modo Criação
2. ~~Correlação frágil~~ → Matching melhorado + confronto visual
3. ~~Não detecta duplicação~~ → Hash de deduplicação
4. ~~UI master/detail inexistente~~ → TradeOrdersPanel
5. Cross-check longitudinal → permanece para issue futuro

### Referências
- BRIEF: `docs/sprint-behavioral/BRIEF-ORDER-IMPORT-v1.1.md`
- ROADMAP: `docs/CHUNK-10-ROADMAP.md` (V2.1 a V2.4)
- PR #87 (v1.0 mergeado)
- Discussão sessão B 22/03/2026
