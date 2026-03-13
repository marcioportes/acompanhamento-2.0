# Issues para Criar no GitHub — Acompanhamento 2.0
## Gerado: 13/03/2026 — Pós v1.19.3

> **Critério de deduplicação:** QA items e DTs que cobrem o mesmo problema foram unificados numa única issue.
> Items já presentes no GitHub (#26–#37) NÃO estão listados aqui.
> Items resolvidos na v1.19.1–v1.19.3 (QA#14, #25, #26, #10+16) NÃO estão listados.

---

## BUGS (label: `bug`)

### Issue: WR Planejado ignora trades sem stop que atingiram RR
- **Labels:** `bug`, `priority:high`, `module:metrics`
- **Origem:** QA #19
- **Módulo:** `useDashboardMetrics`
- **Descrição:**
O cálculo de Win Rate Planejado não contabiliza trades que não possuem stop loss mas que atingiram o RR alvo. Após a implementação do DEC-006 (compliance sem stop), esses trades passaram a ter RR assumido, mas o WR Planejado continua ignorando-os.
- **Verificar:** Se a auditoria (`auditPlan`) já normaliza esses trades. Se sim, pode ser apenas um filtro incorreto no hook.
- **Acceptance criteria:** WR Planejado deve incluir trades sem stop cujo RR assumido >= alvo do plano.

---

### Issue: FeedbackPage exibe preço de saída das parciais em vez do trade consolidado
- **Labels:** `bug`, `priority:high`, `module:feedback`
- **Origem:** QA #29
- **Módulo:** `FeedbackPage`
- **Descrição:**
Quando o mentor visualiza um trade com parciais na FeedbackPage, o preço de saída exibido é o da última parcial individual, não o preço médio ponderado de saída do trade. Isso gera confusão na análise do trade.
- **Acceptance criteria:** FeedbackPage deve exibir `exit` (preço médio ponderado de saída calculado via `calculateFromPartials`), não o `exitPrice` de uma parcial individual.

---

### Issue: Aluno não consegue deletar plano — "Missing permissions"
- **Labels:** `bug`, `priority:high`, `module:plans`
- **Origem:** QA #24
- **Módulo:** Firestore Rules
- **Descrição:**
Ao tentar deletar um plano, o aluno recebe erro "Missing or insufficient permissions". Provável causa: Firestore Rules não permitem `delete` na collection `plans` para o role `student` (owner do plano).
- **Acceptance criteria:** Aluno (owner do plano) deve conseguir deletar planos com state `IN_PROGRESS`. Planos em `GOAL_HIT`/`STOP_HIT`/`POST_*` devem ter regras específicas (definir com Marcio).

---

### Issue: CRUD do Plano (PlanManagementModal) exibe R$ mesmo em contas USD
- **Labels:** `bug`, `priority:medium`, `module:plans`
- **Origem:** BUG backlog (memória), relacionado DT-008
- **Módulo:** `PlanManagementModal`
- **Descrição:**
O modal de criação/edição de plano exibe símbolo R$ para todos os campos monetários, independente da moeda da conta vinculada. Deve exibir a moeda correta (R$, USD, etc.) com base na account associada ao plano.
- **Ref:** DT-008 (formatCurrency hardcoded R$)
- **Acceptance criteria:** Campos monetários no PlanManagementModal devem usar a moeda da conta vinculada ao plano.

---

### Issue: FeedbackPage exibe dados stale após Cloud Function escrever compliance
- **Labels:** `bug`, `priority:low`, `module:feedback`
- **Origem:** DT-018
- **Módulo:** `FeedbackPage`
- **Descrição:**
Após uma Cloud Function (ex: `recalculateCompliance`) gravar dados de compliance no trade, a FeedbackPage não reflete as mudanças até refresh manual. Provável causa: query/cache separado que não é invalidado pelo write da CF.
- **Acceptance criteria:** FeedbackPage deve refletir dados atualizados após CF write sem necessidade de refresh manual.

---

### Issue: CsvImportManager pisca na ativação de trades
- **Labels:** `bug`, `priority:medium`, `module:csv-import`
- **Origem:** QA #3
- **Módulo:** `CsvImportManager`
- **Descrição:**
Ao ativar trades do staging, o componente CsvImportManager apresenta flicker visual — o overlay de ativação não é opaco, permitindo ver a UI mudando por baixo. Necessário overlay opaco durante a operação de batch activation.
- **Acceptance criteria:** Overlay opaco durante ativação. Sem flicker visível para o usuário.

---

### Issue: Templates CSV vazam entre alunos
- **Labels:** `bug`, `priority:medium`, `module:csv-import`
- **Origem:** QA #4, DT-011
- **Módulo:** `useCsvTemplates`
- **Descrição:**
Templates de importação CSV criados por um aluno ficam visíveis para outros alunos. Falta filtro `studentId` na query de templates. Adicionalmente, templates devem ser restritos ao aluno criador (ou ao mentor que os criou para aquele aluno).
- **Acceptance criteria:** Query de templates filtrada por `studentId`. Template criado por aluno A não aparece para aluno B.

---

## MELHORIAS / FEATURES (label: `enhancement`)

### Issue: FeedbackPage — exibir RR, RO$ e compliance no header do trade
- **Labels:** `enhancement`, `priority:medium`, `module:feedback`
- **Origem:** QA #12
- **Módulo:** `FeedbackPage`
- **Descrição:**
O header do trade na FeedbackPage não exibe métricas de compliance (RR alcançado, RO$ realizado, status de compliance, red flags). O mentor precisa dessas informações visíveis ao dar feedback sem precisar voltar ao extrato.
- **Acceptance criteria:** Header do trade na FeedbackPage exibe: RR (com indicador compliant/non-compliant), RO$, lista de red flags (se houver), status compliance.

---

### Issue: Chat funcional entre aluno e mentor no contexto do trade
- **Labels:** `enhancement`, `priority:medium`, `module:feedback`
- **Origem:** QA #9 + QA #15
- **Módulo:** `ExtractTable` / `FeedbackThread`
- **Descrição:**
Implementar comunicação bidirecional (chat) entre aluno e mentor no contexto de um trade específico. Atualmente o feedback é unidirecional (mentor → aluno). O aluno precisa poder responder/questionar, e o mentor precisa poder continuar o diálogo.
- **Acceptance criteria:** Thread de mensagens bidirecional por trade. Notificação de nova mensagem (pode ser visual, sem push por enquanto).

---

### Issue: Botão "Extrato" no MentorDashboard
- **Labels:** `enhancement`, `priority:medium`, `module:mentor`
- **Origem:** QA #20
- **Módulo:** `MentorDashboard`
- **Descrição:**
O mentor precisa de acesso rápido ao extrato (PlanLedgerExtract) de cada plano diretamente do dashboard, sem precisar navegar pelo fluxo do aluno.
- **Acceptance criteria:** Botão/link no card de plano do MentorDashboard que abre o PlanLedgerExtract do plano selecionado.

---

### Issue: Ícones 👁 e 🧠 no StudentsManagement levam à mesma tela
- **Labels:** `enhancement`, `priority:medium`, `module:mentor`
- **Origem:** QA #21
- **Módulo:** `StudentsManagement`
- **Descrição:**
Os dois ícones de ação no grid de alunos (visualizar e perfil emocional) navegam para a mesma tela. Devem ter destinos distintos: um para o dashboard do aluno e outro para o perfil emocional.
- **Acceptance criteria:** Ícone 👁 → StudentDashboard. Ícone 🧠 → Perfil Emocional (EmotionalProfile ou seção dedicada).

---

### Issue: Checklist de pendências no fechamento de ciclo
- **Labels:** `enhancement`, `priority:medium`, `module:plans`
- **Origem:** QA #17, relacionado DT-002
- **Módulo:** `PlanStateMachine`
- **Descrição:**
Ao fechar um ciclo (transição para GOAL_HIT ou STOP_HIT), não há checklist validando pendências: trades sem feedback, PL não registrado, compliance não recalculada. Risco de fechar ciclo com dados incompletos.
- **Ref:** DT-002 (Cycle transitions sem fechamento formal)
- **Acceptance criteria:** Modal de confirmação no fechamento de ciclo exibindo: trades sem feedback, trades sem stop (com compliance pendente), PL do ciclo. Bloqueio opcional ou warning.

---

### Issue: Exibir Expectancy no dashboard do aluno
- **Labels:** `enhancement`, `priority:medium`, `module:metrics`
- **Origem:** QA #18
- **Módulo:** `MetricsCards`
- **Descrição:**
Expectancy (expectativa matemática = WR × avgWin − LossRate × avgLoss) não é exibida no dashboard do aluno. É uma métrica fundamental para avaliação de edge.
- **Acceptance criteria:** Card de Expectancy nos MetricsCards com valor em R$/pts e indicador visual (positivo verde, negativo vermelho, neutro cinza).

---

### Issue: Alerta no grid (ExtractTable) sem tooltip de motivo
- **Labels:** `enhancement`, `priority:medium`, `module:extract`
- **Origem:** QA #27
- **Módulo:** `ExtractTable` (TradesList)
- **Descrição:**
Trades com alertas/red flags no grid exibem ícone de warning mas sem tooltip explicando o motivo. O mentor/aluno precisa clicar no trade para entender o alerta.
- **Acceptance criteria:** Tooltip no ícone de alerta listando os red flags do trade (ex: "RR abaixo do mínimo", "Sem stop loss", "Operou em POST_STOP").

---

### Issue: TradeDetailModal sem exibição de compliance e red flags
- **Labels:** `enhancement`, `priority:medium`, `module:trades`
- **Origem:** QA #28
- **Módulo:** `TradeDetailModal`
- **Descrição:**
O modal de detalhe do trade não exibe informações de compliance (status, RR alvo vs realizado, red flags). O mentor precisa dessas informações ao revisar trades individualmente.
- **Acceptance criteria:** Seção de compliance no TradeDetailModal: status (compliant/non-compliant/N-A), lista de red flags, RR comparativo (alvo vs realizado).

---

### Issue: CsvImportManager sem tela de totalizações pré-ativação
- **Labels:** `enhancement`, `priority:medium`, `module:csv-import`
- **Origem:** QA #11
- **Módulo:** `CsvImportManager`
- **Descrição:**
Antes de ativar um batch de trades importados, o usuário não vê um resumo totalizado: quantidade de trades, P&L bruto, distribuição por ticker, etc. Isso dificulta validação visual antes do commit.
- **Acceptance criteria:** Tela de resumo pré-ativação com: total de trades, P&L total, trades por ticker, trades com warnings, botão de ativação final.

---

### Issue: Mentor não consegue editar feedback já enviado
- **Labels:** `enhancement`, `priority:medium`, `module:feedback`
- **Origem:** QA #7, DT-012
- **Módulo:** `FeedbackThread`
- **Descrição:**
Uma vez que o mentor envia feedback para um trade, não há opção de editar o texto. Apenas criar novo feedback (append). Necessário permitir edição inline do feedback mais recente (ou de qualquer feedback próprio).
- **Acceptance criteria:** Botão de edição no feedback do mentor. Edição inline com save/cancel. Timestamp de "editado em" visível.

---

### Issue: CsvImportManager desperdiça espaço vertical
- **Labels:** `enhancement`, `priority:low`, `module:csv-import`
- **Origem:** QA #5
- **Módulo:** `CsvImportManager`
- **Descrição:**
O layout do CsvImportManager usa espaço vertical excessivo (padding, espaçamento entre seções). Em telas de mentoria com resolução limitada, o wizard fica com scroll desnecessário.
- **Acceptance criteria:** Layout compactado. Wizard steps visíveis sem scroll em resolução 1366×768.

---

### Issue: Auto-detect date format MM/DD vs DD/MM no CSV import
- **Labels:** `enhancement`, `priority:low`, `module:csv-import`
- **Origem:** QA #6
- **Módulo:** `csvParser`
- **Descrição:**
O parser CSV não detecta automaticamente se o formato de data é MM/DD/YYYY (US) ou DD/MM/YYYY (BR). Atualmente depende de configuração manual ou assume um padrão. Brokers BR usam DD/MM, brokers US usam MM/DD.
- **Acceptance criteria:** Heurística de detecção automática baseada no exchange selecionado (B3 → DD/MM, CME/NASDAQ → MM/DD) com override manual.

---

## DÍVIDAS TÉCNICAS (label: `tech-debt`)

### Issue: Cloud Functions — migrar Node.js 20 → 22 antes de 30/04/2026
- **Labels:** `tech-debt`, `priority:high`, `module:cloud-functions`
- **Origem:** DT-016
- **Módulo:** `functions/`
- **Descrição:**
Cloud Functions estão rodando Node.js 20, que será deprecated pelo Google em 30/04/2026 (48 dias). Necessário migrar para Node.js 22. Também avaliar upgrade do `firebase-functions` SDK de 4.9.0 para ≥5.1.0.
- **Deadline:** 30/04/2026
- **Acceptance criteria:** CF deployada com Node.js 22 e firebase-functions ≥5.1.0. Todos os testes passando. Zero regressão em triggers.

---

### Issue: Cycle transitions sem fechamento formal (PL entry)
- **Labels:** `tech-debt`, `priority:high`, `module:plans`
- **Origem:** DT-002
- **Módulo:** `PlanStateMachine`
- **Descrição:**
Transições de ciclo (IN_PROGRESS → GOAL_HIT/STOP_HIT → POST_*) não gravam PL entry formalizando o resultado do ciclo anterior. O novo ciclo inicia sem registro explícito do PL acumulado. Risco de divergência entre PL contábil e PL calculado.
- **Acceptance criteria:** Transição de ciclo grava documento de PL entry com: PL do ciclo, data de fechamento, motivo (goal/stop). Novo ciclo inicia com PL reset.

---

### Issue: AccountStatement week filter usa padrão US em vez de BR
- **Labels:** `tech-debt`, `priority:medium`, `module:dashboard`
- **Origem:** DT-004
- **Módulo:** `AccountStatement`
- **Descrição:**
O filtro de semana no AccountStatement usa domingo como primeiro dia da semana (padrão US). No Brasil, segunda-feira é o primeiro dia. Afeta a agregação semanal de trades.
- **Acceptance criteria:** Semana inicia na segunda-feira para locale pt-BR.

---

### Issue: useSetups — isGlobal undefined tratado como true
- **Labels:** `tech-debt`, `priority:medium`, `module:settings`
- **Origem:** DT-005
- **Módulo:** `useSetups`
- **Descrição:**
Quando `isGlobal` é `undefined` no documento de setup, o hook trata como `true` (global). Deveria tratar como `false` (específico do aluno) ou exigir valor explícito.
- **Acceptance criteria:** `isGlobal` undefined → default `false` (ou `true` se definido como regra de negócio — confirmar com Marcio). Nunca undefined em runtime.

---

### Issue: Filtro de extrato usa createdAt em vez de entryTime
- **Labels:** `tech-debt`, `priority:medium`, `module:extract`
- **Origem:** DT-009
- **Módulo:** `PlanLedgerExtract`
- **Descrição:**
O filtro de período do extrato filtra por `createdAt` (timestamp de criação do documento) em vez de `entryTime` (data de entrada do trade). Trades importados retroativamente aparecem fora do período correto.
- **Acceptance criteria:** Filtro de período baseado em `entryTime`. Fallback para `createdAt` apenas se `entryTime` não existir.

---

### Issue: Plan PL potencialmente afetado por trades IMPORTED — auditoria pendente
- **Labels:** `tech-debt`, `priority:medium`, `module:plans`
- **Origem:** DT-019
- **Módulo:** `onTradeCreated` (CF)
- **Descrição:**
Trades ativados via CSV import disparam `onTradeCreated`, que pode atualizar `plan.pl`. Se os trades importados pertencerem a períodos anteriores ao ciclo ativo, o PL do plano fica incorreto. Necessário auditoria para confirmar se isso está acontecendo e, se sim, implementar guard na CF.
- **Acceptance criteria:** Auditoria executada. Se confirmado: CF `onTradeCreated` verifica se trade pertence ao ciclo ativo antes de atualizar `plan.pl`.

---

### Issue: recalculateCompliance não usa writeBatch
- **Labels:** `tech-debt`, `priority:low`, `module:cloud-functions`
- **Origem:** DT-015
- **Módulo:** `recalculateCompliance` (CF callable)
- **Descrição:**
A função `recalculateCompliance` faz writes individuais para cada trade em vez de usar `writeBatch`. Para planos com muitos trades, isso gera N writes sequenciais ao Firestore, aumentando latência e risco de falha parcial.
- **Acceptance criteria:** Usar `writeBatch` com commit a cada 450 operações (limite Firestore = 500). Rollback automático em caso de falha.

---

### Issue: Ticker alias auto-matching
- **Labels:** `tech-debt`, `priority:low`, `module:settings`
- **Origem:** DT-006
- **Módulo:** Ticker management
- **Descrição:**
Tickers como "WINFUT", "WINZ26", "WIN$" referem-se ao mesmo instrumento. Não existe mecanismo de alias que agrupe variantes do mesmo ticker para fins de compliance e métricas.
- **Acceptance criteria:** Sistema de alias de tickers (ex: WIN* → WINFUT) para agrupamento em métricas e compliance.

---

### Issue: DebugBadge duplicado na ComplianceConfigPage
- **Labels:** `tech-debt`, `priority:low`, `module:ui`
- **Origem:** DT-007
- **Módulo:** `ComplianceConfigPage`
- **Descrição:**
ComplianceConfigPage exibe dois DebugBadges quando renderizada em contexto embedded. Causa: componente pai e filho ambos renderizam `<DebugBadge />` sem guard `{!embedded && ...}`.
- **Acceptance criteria:** Apenas um DebugBadge visível, independente do contexto (embedded ou standalone).

---

### Issue: formatCurrency hardcoded R$ no MentorDashboard
- **Labels:** `tech-debt`, `priority:low`, `module:mentor`
- **Origem:** DT-008
- **Módulo:** `MentorDashboard`
- **Descrição:**
`formatCurrency` usa R$ como símbolo fixo no MentorDashboard. Contas em USD exibem valores com símbolo errado. Necessário derivar moeda da account vinculada.
- **Acceptance criteria:** `formatCurrency` recebe currency code da account. Exibe USD/R$/EUR conforme a conta.

---

### Issue: DebugBadge não visível no PlanLedgerExtract (z-index)
- **Labels:** `tech-debt`, `priority:low`, `module:ui`
- **Origem:** QA #13
- **Módulo:** `PlanLedgerExtract`
- **Descrição:**
DebugBadge fica atrás de outros elementos no PlanLedgerExtract por z-index insuficiente.
- **Acceptance criteria:** DebugBadge visível com z-index adequado.

---

### Issue: DebugBadge ausente na seção Perfil Emocional
- **Labels:** `tech-debt`, `priority:low`, `module:ui`
- **Origem:** QA #22
- **Módulo:** `StudentDashboard` (seção Perfil Emocional)
- **Descrição:**
Seção de Perfil Emocional no StudentDashboard não possui DebugBadge. INV-04 exige DebugBadge em todo componente UI novo ou tocado.
- **Acceptance criteria:** DebugBadge presente na seção Perfil Emocional.

---

## RESUMO

| Tipo | Quantidade | Alta | Média | Baixa |
|------|-----------|------|-------|-------|
| Bug | 7 | 3 | 2 | 2 |
| Enhancement | 14 | 0 | 11 | 3 |
| Tech Debt | 10 | 2 | 4 | 4 |
| **Total** | **31** | **5** | **17** | **9** |

### Sobreposições resolvidas (deduplicação):
- DT-011 ↔ QA#4 → Issue única "Templates CSV vazam entre alunos"
- DT-012 ↔ QA#7 → Issue única "Mentor não edita feedback"
- DT-002 ↔ QA#17 → Issues separadas (DT-002 é o PL entry, QA#17 é o checklist UI), mas referenciadas mutuamente
- DT-008 ↔ BUG PlanManagementModal → Issues separadas (DT-008 é MentorDashboard, BUG é PlanManagementModal), mesma causa raiz
