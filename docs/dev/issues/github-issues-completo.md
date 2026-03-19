# Issues para Criar no GitHub — Completo
# Sessao 14-15/03/2026 — Pronto para copiar/colar

---

## ISSUE 1

**Titulo:** [BUG] Flicker no CsvImportManager durante ativacao de trades

**Labels:** `type:bug`, `Sev1`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Ao ativar trades do staging para a collection de trades (botao "Ativar"), a tela pisca visivelmente. O usuario ve a UI atualizando a cada trade processado, causando experiencia degradada.

### Contexto tecnico
- `setSuspendListener(true)` ja esta ativo no `handleActivateStagingBatch` (StudentDashboard.jsx:168)
- O `CsvImportManager` chama `onClose()` antes de processar (linha 152), fechando o modal
- O listener de trades (`useTrades.js`) respeita a flag de suspend
- **Hipotese:** O listener da collection `csvStagingTrades` (useCsvStaging.js:78) NAO tem mecanismo de suspend. Cada `deleteDoc` do staging dispara `setStagingTrades(data)` que re-renderiza componentes que consomem `stagingTrades`
- **Hipotese secundaria:** `updatePlanPl` (CF) atualiza `plan.currentPl` a cada trade, disparando o listener de plans

### Proposta de solucao
1. Adicionar mecanismo de suspend no listener de `useCsvStaging.js` (mesmo padrao do `useTrades.js`: `suspendedRef` + `pendingSnapshotRef`)
2. Chamar `setSuspendStagingListener(true)` antes do batch e `false` no finally
3. Alternativa: overlay opaco bloqueante com progress bar durante a ativacao

### Ref
QA #3 do backlog

---

## ISSUE 2

**Titulo:** [FEATURE] CF scheduled — limpeza diaria da staging area (23h)

**Labels:** `type:feature`, `Sev1`, `epic:architecture`, `module:cloud-functions`

**Descricao:**

### Problema
Trades importados via CSV ficam na collection `csvStagingTrades` indefinidamente quando o aluno nao os converte (ativa). Isso acumula documentos inuteis no Firestore, aumentando custo e poluindo a UI do CsvImportManager.

### Proposta de solucao
1. Criar Cloud Function scheduled (`functions.pubsub.schedule('every day 23:00')`) que:
   - Query todos os docs em `csvStagingTrades` com `createdAt < 24h atras`
   - Delete em batch (writeBatch, 450 por commit)
   - Log: quantidade deletada por studentId
2. Alternativa: TTL configuravel por aluno (default 24h)
3. Considerar: notificacao ao aluno antes da limpeza? (email ou flag no dashboard)

### Impacto
- Nova CF scheduled (functions/index.js)
- Nenhuma mudanca no frontend
- Requer: `firebase deploy --only functions`

### Ref
DT-020

---

## ISSUE 3

**Titulo:** [TECH-DEBT] CF Node.js 20 depreca 30/04/2026

**Labels:** `type:architecture`, `Sev1`, `epic:architecture`, `module:cloud-functions`

**Descricao:**

### Problema
Cloud Functions estao rodando Node.js 20, que sera deprecated pelo Google em 30/04/2026 (decommission 30/10/2026). Apos a deprecacao, novos deploys podem falhar.

### Proposta de solucao
1. Alterar `engines.node` em `functions/package.json` para `"22"`
2. Upgrade `firebase-functions` SDK de 4.9.0 para >=5.1.0 (breaking changes documentados)
3. Testar todas as CFs: `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance`, scheduled (se implementada)
4. Deploy e validar em producao

### Breaking changes firebase-functions 5.x
- `functions.https.onCall` signature muda (verificar)
- Import paths podem mudar
- Consultar: https://firebase.google.com/docs/functions/migrate-to-2nd-gen

### Deadline
30/04/2026 (45 dias)

### Ref
DT-016

---

## ISSUE 4

**Titulo:** [BUG] WR Planejado ignora trades sem stop que atingiram RR

**Labels:** `type:bug`, `Sev1`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
O calculo de Win Rate Planejado (`calculatePlannedWinRate` em dashboardMetrics.js) conta como "win disciplinado" apenas trades com `result > 0 && rrRatio >= plan.rrTarget`. Trades sem stop loss que atingiram o RR alvo via RR assumido (DEC-007) podem nao estar sendo contabilizados porque `rrRatio` pode estar null ou `rrAssumed` nao eh considerado no filtro.

### Proposta de solucao
1. Verificar se `trade.rrRatio` inclui o RR assumido (DEC-007) ou se precisa fallback
2. No `calculatePlannedWinRate`: usar `trade.rrRatio || trade.rr` — ja esta assim, mas verificar se o campo eh populado pela CF para trades sem stop
3. Rodar auditoria nos planos afetados para confirmar se rrRatio esta presente

### Ref
QA #19

---

## ISSUE 5

**Titulo:** [BUG] FeedbackPage exibe preco de saida das parciais em vez do trade consolidado

**Labels:** `type:bug`, `Sev1`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Quando o mentor visualiza um trade com parciais na FeedbackPage, o preco de saida exibido eh o da ultima parcial individual (`exitPrice` de uma parcial), nao o preco medio ponderado de saida do trade (`exit` calculado via `calculateFromPartials`).

### Proposta de solucao
1. Na FeedbackPage, usar `trade.exit` (campo derivado) para exibicao
2. Se `trade.exit` nao existir, calcular via `calculateFromPartials(trade._partials)`
3. Verificar se o campo `exit` esta sendo populado corretamente pelo `addTrade`/`updateTrade`

### Ref
QA #29

---

## ISSUE 6

**Titulo:** [BUG] Aluno nao consegue deletar plano — "Missing permissions"

**Labels:** `type:bug`, `Sev1`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Ao tentar deletar um plano, o aluno recebe erro "Missing or insufficient permissions". O Firestore Rules provavelmente nao permite `delete` na collection `plans` para o role `student`.

### Proposta de solucao
1. Verificar `firestore.rules` — regra de delete para `plans` collection
2. Permitir delete quando: `request.auth.uid == resource.data.studentId` E plano em estado `IN_PROGRESS` (nao permitir delete de planos fechados)
3. Planos em `GOAL_HIT`/`STOP_HIT`/`POST_*`: definir regra com Marcio (soft delete? archive?)

### Ref
QA #24

---

## ISSUE 7

**Titulo:** [TECH-DEBT] Cycle transitions sem fechamento formal (PL entry)

**Labels:** `type:architecture`, `Sev1`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Transicoes de ciclo (IN_PROGRESS -> GOAL_HIT/STOP_HIT -> POST_*) nao gravam PL entry formalizando o resultado do ciclo anterior. O novo ciclo inicia sem registro explicito do PL acumulado. Risco de divergencia entre PL contabil e PL calculado.

### Proposta de solucao
1. Na transicao de estado do plano (PlanStateMachine), gravar documento de PL entry com:
   - PL do ciclo encerrado
   - Data de fechamento
   - Motivo (goal/stop)
   - PL base do novo ciclo
2. Novo ciclo inicia com `currentPl` resetado para `plan.pl` + PL acumulado (ou resetado a zero, conforme regra de negocio)
3. Relacionado com QA #17 (checklist de fechamento de ciclo)

### Ref
DT-002

---

## ISSUE 8

**Titulo:** [FEATURE] FeedbackPage — RR/RO/compliance no header do trade

**Labels:** `type:feature`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
O header do trade na FeedbackPage nao exibe metricas de compliance. O mentor precisa dessas informacoes visiveis ao dar feedback sem precisar voltar ao extrato.

### Proposta de solucao
1. Adicionar no header do trade: RR (com indicador compliant/non-compliant), RO%, lista de red flags (se houver), status compliance
2. Dados ja estao no documento do trade (`riskPercent`, `rrRatio`, `compliance`, `redFlags`)
3. Reutilizar componentes/logica do ExtractTable para consistencia visual

### Ref
QA #12

---

## ISSUE 9

**Titulo:** [FEATURE] Chat funcional entre aluno e mentor no contexto do trade

**Labels:** `type:feature`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Atualmente o feedback eh unidirecional (mentor -> aluno). O aluno nao pode responder/questionar, e o mentor nao pode continuar o dialogo alem do feedback inicial.

### Proposta de solucao
1. Thread de mensagens bidirecional por trade (subcollection `feedback/{id}/messages` ou campo array)
2. Status machine: OPEN -> REVIEWED -> QUESTION -> CLOSED (ja existe parcialmente)
3. Notificacao visual de nova mensagem (badge no sidebar ou card)
4. Push notification futura (fase 2)

### Impacto
- Nova subcollection ou campo no Firestore (requer aprovacao de Marcio — INV-10)
- Novos componentes de chat
- Firestore Rules para bidirecionalidade

### Ref
QA #9 + QA #15

---

## ISSUE 10

**Titulo:** [FEATURE] Botao "Extrato" no MentorDashboard

**Labels:** `type:feature`, `Sev2`, `module:mentor-dashboard`, `epic:dashboard-mentor`

**Descricao:**

### Problema
O mentor precisa de acesso rapido ao extrato (PlanLedgerExtract) de cada plano diretamente do dashboard, sem precisar navegar pelo fluxo do aluno.

### Proposta de solucao
1. Adicionar botao/link no card de plano do MentorDashboard
2. Abre PlanLedgerExtract em modal ou navegacao inline
3. Reutilizar o componente existente com prop `readOnly` (mentor mode)

### Ref
QA #20

---

## ISSUE 11

**Titulo:** [BUG] Icones olho e cerebro no StudentsManagement levam a mesma tela

**Labels:** `type:bug`, `Sev2`, `module:mentor-dashboard`, `epic:dashboard-mentor`

**Descricao:**

### Problema
Os dois icones de acao no grid de alunos (visualizar e perfil emocional) navegam para a mesma tela. Devem ter destinos distintos.

### Proposta de solucao
1. Icone olho -> StudentDashboard (view as student)
2. Icone cerebro -> Perfil Emocional (EmotionalProfileDetail ou secao dedicada)
3. Verificar se a rota/componente de perfil emocional standalone existe ou precisa ser criado

### Ref
QA #21

---

## ISSUE 12

**Titulo:** [FEATURE] Checklist de pendencias no fechamento de ciclo

**Labels:** `type:feature`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Ao fechar um ciclo (transicao para GOAL_HIT ou STOP_HIT), nao ha checklist validando pendencias. Risco de fechar ciclo com dados incompletos.

### Proposta de solucao
1. Modal de confirmacao exibindo:
   - Trades sem feedback (count)
   - Trades sem stop loss (count + compliance pendente)
   - PL do ciclo (calculado vs registrado)
2. Warning ou bloqueio (configuravel pelo mentor)
3. Relacionado com DT-002 (PL entry no fechamento)

### Ref
QA #17

---

## ISSUE 13

**Titulo:** [FEATURE] Alerta no grid (ExtractTable) sem tooltip de motivo

**Labels:** `type:feature`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Trades com alertas/red flags no grid exibem icone de warning mas sem tooltip explicando o motivo. O mentor/aluno precisa clicar no trade para entender o alerta.

### Proposta de solucao
1. Tooltip no icone de alerta listando os red flags do trade
2. Ex: "RR abaixo do minimo", "Sem stop loss", "Operou em POST_STOP"
3. Usar `title` attribute ou tooltip component com lista dos `trade.redFlags[].message`

### Ref
QA #27

---

## ISSUE 14

**Titulo:** [FEATURE] TradeDetailModal sem exibicao de compliance e red flags

**Labels:** `type:feature`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
O modal de detalhe do trade nao exibe informacoes de compliance. O mentor precisa dessas informacoes ao revisar trades individualmente.

### Proposta de solucao
1. Secao de compliance no TradeDetailModal:
   - Status (compliant/non-compliant/N-A)
   - RR comparativo (alvo vs realizado)
   - Lista de red flags com mensagens
2. Dados ja estao no documento do trade

### Ref
QA #28

---

## ISSUE 15

**Titulo:** [BUG] Templates CSV vazam entre alunos

**Labels:** `type:bug`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Templates de importacao CSV criados por um aluno ficam visiveis para outros alunos. Falta filtro `studentId` na query de templates.

### Proposta de solucao
1. Adicionar `where('studentId', '==', userId)` na query de `useCsvTemplates`
2. Verificar se templates criados pelo mentor devem ser visiveis para todos os alunos daquele mentor (scope diferente)

### Ref
QA #4, DT-011

---

## ISSUE 16

**Titulo:** [FEATURE] CsvImportManager sem tela de totalizacoes pre-ativacao

**Labels:** `type:feature`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Antes de ativar um batch de trades importados, o usuario nao ve um resumo totalizado. Dificulta validacao visual antes do commit.

### Proposta de solucao
1. Tela/secao de resumo pre-ativacao com:
   - Total de trades selecionados
   - P&L bruto total
   - Distribuicao por ticker
   - Trades com warnings (incompletos)
2. Botao "Confirmar ativacao" apos revisao

### Ref
QA #11

---

## ISSUE 17

**Titulo:** [FEATURE] Mentor nao consegue editar feedback ja enviado

**Labels:** `type:feature`, `Sev2`, `module:mentor-dashboard`, `epic:dashboard-mentor`

**Descricao:**

### Problema
Uma vez que o mentor envia feedback, nao ha opcao de editar o texto. Apenas criar novo (append). Necessario permitir edicao para corrigir erros ou complementar.

### Proposta de solucao
1. Botao de edicao no feedback do mentor (icone lapiz)
2. Edicao inline com save/cancel
3. Timestamp "editado em" visivel
4. Apenas o autor pode editar (Firestore Rules)

### Ref
QA #7, DT-012

---

## ISSUE 18

**Titulo:** [TECH-DEBT] Plan PL afetado por trades IMPORTED — auditoria pendente

**Labels:** `type:architecture`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Trades ativados via CSV import disparam `onTradeCreated` que chama `updatePlanPl`. Se os trades importados pertencem a periodos anteriores ao ciclo ativo, o PL do plano fica incorreto (inclui resultado de trades que nao pertencem ao ciclo).

### Proposta de solucao
1. Executar auditoria nos planos existentes para confirmar o problema
2. Se confirmado: CF `onTradeCreated` deve verificar se trade pertence ao ciclo ativo antes de atualizar `plan.pl`
3. Guard: `if (trade.importSource === 'csv') { verificar periodo do trade vs ciclo ativo }`

### Ref
DT-019

---

## ISSUE 19

**Titulo:** [TECH-DEBT] Filtro de extrato usa createdAt em vez de entryTime

**Labels:** `type:architecture`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
O filtro de periodo do extrato (PlanLedgerExtract) filtra por `createdAt` (timestamp de criacao do documento Firestore) em vez de `entryTime` (data/hora de entrada do trade). Trades importados retroativamente aparecem fora do periodo correto.

### Proposta de solucao
1. Filtro baseado em `entryTime`
2. Fallback para `createdAt` se `entryTime` nao existir
3. Verificar se o index Firestore suporta a query com `entryTime`

### Ref
DT-009

---

## ISSUE 20

**Titulo:** [TECH-DEBT] AccountStatement week filter usa padrao US em vez de BR

**Labels:** `type:architecture`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
O filtro de semana no AccountStatement usa domingo como primeiro dia da semana (padrao US). No Brasil, segunda-feira eh o primeiro dia.

### Proposta de solucao
1. Usar `startOfWeek` com opcao `{ weekStartsOn: 1 }` (segunda-feira)
2. Verificar se usa date-fns, moment, ou calculo manual
3. Pode ser configuravel por locale

### Ref
DT-004

---

## ISSUE 21

**Titulo:** [TECH-DEBT] useSetups isGlobal undefined tratado como true

**Labels:** `type:architecture`, `Sev2`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Quando `isGlobal` eh `undefined` no documento de setup no Firestore, o hook `useSetups` trata como `true` (setup global). Deveria tratar como `false` (especifico do aluno) ou exigir valor explicito.

### Proposta de solucao
1. Default: `isGlobal = false` quando undefined (mais seguro)
2. Ou: migrar documentos existentes para ter `isGlobal` explicito
3. Confirmar regra de negocio com Marcio

### Ref
DT-005

---

## ISSUE 22

**Titulo:** [FEATURE] CsvImportManager desperdica espaco vertical

**Labels:** `type:feature`, `sev3`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
O layout do CsvImportManager usa espaco vertical excessivo (padding, espacamento entre secoes). Em telas de mentoria com resolucao limitada, o wizard fica com scroll desnecessario.

### Proposta de solucao
1. Reduzir padding/gap entre secoes
2. Wizard steps visiveis sem scroll em resolucao 1366x768
3. Referencia: ExtractTable v4.1 como exemplo de compactacao

### Ref
QA #5

---

## ISSUE 23

**Titulo:** [FEATURE] Auto-detect date format MM/DD vs DD/MM no CSV import

**Labels:** `type:feature`, `sev3`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
O parser CSV nao detecta automaticamente se o formato de data eh MM/DD/YYYY (US) ou DD/MM/YYYY (BR). Depende de configuracao manual.

### Proposta de solucao
1. Heuristica baseada no exchange selecionado: B3 -> DD/MM, CME/NASDAQ -> MM/DD
2. Heuristica secundaria: se algum valor de dia > 12, o formato eh determinavel (ex: 25/01 so pode ser DD/MM)
3. Override manual sempre disponivel
4. Default: DD/MM (maioria dos usuarios BR)

### Ref
QA #6

---

## ISSUE 24

**Titulo:** [BUG] DebugBadge z-index no PlanLedgerExtract

**Labels:** `type:bug`, `sev3`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
DebugBadge fica atras de outros elementos no PlanLedgerExtract por z-index insuficiente.

### Proposta de solucao
1. Aumentar z-index do DebugBadge ou do container
2. Verificar se ha conflito com modais/tooltips overlay

### Ref
QA #13

---

## ISSUE 25

**Titulo:** [BUG] DebugBadge ausente na secao Perfil Emocional

**Labels:** `type:bug`, `sev3`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Secao de Perfil Emocional no StudentDashboard nao possui DebugBadge. INV-04 exige DebugBadge em todo componente UI novo ou tocado.

### Proposta de solucao
1. Adicionar `<DebugBadge component="EmotionalProfile" />` na secao

### Ref
QA #22

---

## ISSUE 26

**Titulo:** [TECH-DEBT] formatCurrency hardcoded R$ no MentorDashboard

**Labels:** `type:architecture`, `sev3`, `module:mentor-dashboard`, `epic:dashboard-mentor`

**Descricao:**

### Problema
`formatCurrency` usa R$ como simbolo fixo no MentorDashboard. Contas em USD exibem valores com simbolo errado.

### Proposta de solucao
1. Derivar moeda da account vinculada ao plano
2. Usar `formatCurrencyDynamic(value, account.currency)` — funcao ja existe em currency.js
3. Mesmo fix aplicavel no PlanManagementModal (bug reportado: exibe R$ em contas USD)

### Ref
DT-008

---

## ISSUE 27

**Titulo:** [TECH-DEBT] Ticker alias auto-matching

**Labels:** `type:architecture`, `sev3`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Tickers como "WINFUT", "WINZ26", "WIN$" referem-se ao mesmo instrumento. Nao existe mecanismo de alias que agrupe variantes para fins de compliance e metricas.

### Proposta de solucao
1. Tabela de alias na collection `tickers`: campo `aliases: ['WINZ26', 'WINV26', 'WIN$']`
2. No calculo de metricas e compliance, resolver alias para o ticker master
3. UI: autocomplete no campo ticker com sugestao de alias

### Ref
DT-006

---

## ISSUE 28

**Titulo:** [TECH-DEBT] recalculateCompliance nao usa writeBatch

**Labels:** `type:architecture`, `sev3`, `module:cloud-functions`, `epic:architecture`

**Descricao:**

### Problema
A funcao `recalculateCompliance` faz writes individuais para cada trade em vez de usar `writeBatch`. Para planos com muitos trades, gera N writes sequenciais, aumentando latencia e risco de falha parcial.

### Proposta de solucao
1. Usar `writeBatch` com commit a cada 450 operacoes (limite Firestore = 500)
2. Rollback automatico em caso de falha (batch eh atomico)
3. Progress callback para UI mostrar andamento

### Ref
DT-015

---

## ISSUE 29

**Titulo:** [TECH-DEBT] FeedbackPage dados stale apos Cloud Function write

**Labels:** `type:architecture`, `sev3`, `module:dashboard-aluno`, `epic:aluno-stability`

**Descricao:**

### Problema
Apos uma Cloud Function (ex: `recalculateCompliance`) gravar dados de compliance no trade, a FeedbackPage nao reflete as mudancas ate refresh manual.

### Proposta de solucao
1. Verificar se FeedbackPage usa listener (onSnapshot) ou query one-shot
2. Se one-shot: migrar para listener ou adicionar refresh apos CF call
3. Se listener: verificar se o campo atualizado pela CF esta na query/projection

### Ref
DT-018
