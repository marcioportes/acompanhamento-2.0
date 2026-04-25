# Decision Log (DEC-001..090+)

> Registro de decisões arquiteturais. **Nunca remover** — marcar como SUPERSEDED se inválida.



> Registro de decisões arquiteturais significativas. **Nunca remover entradas** — marcar como `SUPERSEDED` se inválida.
> Formato: `| ID | Decisão | Issue | Sessão | Data/Hora |`

| ID | Decisão resumida | Issue | Data |
|----|-----------------|-------|------|
| DEC-001 | CSV Import usa staging collection (csvStagingTrades) — não escreve direto em trades | #23 | 07/03/2026 |
| DEC-002 | Direção de trade inferida por buyTimestamp vs sellTimestamp (Tradovate) | #23 | 07/03/2026 |
| DEC-003 | Inferência genérica de direção no CSV — campo configurável no template | #23 | 08/03/2026 |
| DEC-004 | Locale pt-BR para todas as moedas via Intl.NumberFormat | — | 08/03/2026 |
| DEC-005 | Compliance sem stop: loss→risco retroativo, win→N/A, BE→0 | — | 10/03/2026 |
| DEC-006 | Compliance sem stop — fórmula definitiva (C1-C5) | — | 10/03/2026 |
| DEC-007 | RR assumido via plan.pl (capital base), não currentPl flutuante | — | 11/03/2026 |
| DEC-008 | Navegação contextual Feedback ↔ Extrato via flag `_fromLedgerPlanId` | — | 12/03/2026 |
| DEC-009 | riskPercent usa plan.pl como denominador primário | — | 14/03/2026 |
| DEC-010 | EV esperado e EV real — leakage = 1 - (EV_real / EV_esperado) | — | 15/03/2026 |
| DEC-011 | Layout MetricsCards em 3 painéis temáticos com tooltips diagnósticos | — | 15/03/2026 |
| DEC-012 | Payoff como indicador de saúde do edge (semáforo ≥1.5/1.0/<1.0) | — | 18/03/2026 |
| DEC-013 | Operacional 5D com emotion_control herdado do emocional | #92 | 20/03/2026 |
| DEC-014 | Cross-check inter-dimensional — 5 flags iniciais | #92 | 20/03/2026 |
| DEC-015 | Randomização de alternativas via persistência Firestore (não PRNG puro) | #92 | 20/03/2026 |
| DEC-016 | Sondagem adaptativa pós-questionário (3-5 perguntas IA, transparente) | #92 | 20/03/2026 |
| DEC-017 | Scoring mensal 3 camadas: score_trades + mentor_delta + score_final | #92 | 20/03/2026 |
| DEC-018 | Mentor aplica delta (não score absoluto) no review mensal | #92 | 20/03/2026 |
| DEC-019 | Gates de progressão hardcoded, avaliação híbrida (CF + mentor confirma) | #92 | 20/03/2026 |
| DEC-020 | Regressão de stage nunca automática — alerta + decisão do mentor | #92 | 20/03/2026 |
| DEC-021 | Stage diagnosticado por IA (pattern-matching contra framework, não fórmula) | #92 | 22/03/2026 |
| DEC-022 | Marco zero tábula rasa: gates_met=0 independente de respostas | #92 | 22/03/2026 |
| DEC-023 | Assessment acionado pelo mentor, não automático | #92 | 22/03/2026 |
| DEC-024 | Parciais são campo inline `_partials` no documento — subcollection eliminada | — | 22/03/2026 |
| DEC-025 | Firestore rules read = isAuthenticated() — simplificação de isMentor()/isOwner() | — | 23/03/2026 |
| DEC-026 | saveInitialAssessment escreve onboardingStatus: 'active' direto via updateDoc | #92 | 24/03/2026 |
| DEC-027 | Onboarding UX: BaselineReport redesenhado, IncongruenceFlags rich detail, prompt framework-aligned, rename Experiência→Maturidade | #92 | 25/03/2026 |
| DEC-028 | Consolidação documental: PROJECT.md como single source of truth, issue-NNN.md por issue ativo | — | 26/03/2026 |
| DEC-029 | Marca pessoal "Marcio Portes" como guarda-chuva — não institucional | #100 | 29/03/2026 |
| DEC-030 | "Modelo Portes" como nome público do framework comportamental (4D + TEF + maturidade) | #100 | 29/03/2026 |
| DEC-031 | "Espelho" como nome público da plataforma SaaS — codebase/repo/Firebase permanecem "acompanhamento-2.0" | #100 | 29/03/2026 |
| DEC-032 | "Mentoria Alpha" como nome do serviço premium individual (substitui "Tchio-Alpha" externamente) | #100 | 29/03/2026 |
| DEC-033 | "Diagnóstico Comportamental" como lead magnet #1 — assessment gratuito com IA baseado no Modelo Portes | #100 | 29/03/2026 |
| DEC-034 | Dois tiers: Espelho self-service (KPIs + diário + gates) e Mentoria Alpha (+ ciclos + assessment + SWOT + feedback) | #100 | 29/03/2026 |
| DEC-035 | SWOT dinâmico exclusivo Mentoria Alpha — analisa KPIs + diagnostica por gate/dimensão + prescreve evolução | #100 | 29/03/2026 |
| DEC-036 | KPIs alimentam nota de evolução por dimensão (gates) — visível para ambos tiers. SWOT interpreta e prescreve — exclusivo Alpha | #100 | 29/03/2026 |
| DEC-037 | Fibonaccing como motor de aquisição principal — 100h+ conteúdo gratuito, funil: Fibonacci → Diagnóstico → Espelho → Alpha | #100 | 29/03/2026 |
| DEC-038 | Rename externo via custom domain (app.marcioportes.com.br) + UI (title, logo) — sem refactoring de codebase | #100 | 29/03/2026 |
| DEC-039 | GitHub é SSOT para numeração de issues — PROJECT.md reflete o GitHub, nunca o contrário | — | 29/03/2026 |
| DEC-040 | Apenas 2 milestones: v1.1.0 Espelho Self-Service (prioridade) + v1.2.0 Mentor Cockpit. Student Experience absorvido pelo Espelho | — | 29/03/2026 |
| DEC-041 | #101 é épico Torre de Controle — agrupa todos os sub-issues do dashboard mentor. #1 (Upload Seed) fechado como não relevante | #101 | 29/03/2026 |
| DEC-042 | Torre de Controle: header redesenhado (4 KPIs operacionais), seções Ranking por Aluno + Ranking por Causa (dual view), SWOT e Stop por Motivo movidos para nova tela Performance (#103) | #101 | 29/03/2026 |
| DEC-043 | useProbing rehydrata savedQuestions do Firestore + effectiveStatus resolve status preso ai_assessed quando probing já gerado | #92 | 30/03/2026 |
| DEC-044 | INV-13: rastreabilidade obrigatória — toda modificação de código exige issue GitHub + arquivo docs/dev/issues/issue-NNN.md + branch nomeada. Template formal definido na seção 4.0 | — | 30/03/2026 |
| DEC-045 | Revisão semanal é evento persistido (collection reviews), não visualização on-the-fly. CF createWeeklyReview congela snapshot + gera SWOT + persiste. Independente do fechamento de ciclo (#72) | #102 | 02/04/2026 |
| DEC-046 | #45 (Aba Precisam de Atenção) absorvido pelo Ranking por Aluno da Torre de Controle (#101) | #45 | 02/04/2026 |
| DEC-047 | Barra de Contexto Unificado: Conta > Plano > Ciclo > Período, persistente no topo, reativa. Governa todas as views do Dashboard-Aluno. Fundação arquitetural — implementar antes de refatorar views | #3 | 03/04/2026 |
| DEC-048 | Overtrading detectado por clustering temporal (janela configurável: windowMinutes, maxTradesInWindow, cooldownMinutes), não por maxTradesPerDay fixo. Base: Barber & Odean 2000 | #113 | 03/04/2026 |
| DEC-049 | BE threshold configurável no compliance (percentual do capital base ou valor absoluto), não hardcoded | #114 | 03/04/2026 |
| DEC-050 | Desvio padrão (Coefficient of Variation) como métrica de consistência operacional. CV < 0.5 consistente, 0.5-1.0 moderado, > 1.0 errático. Alimenta Dashboard, Torre, Revisão e SWOT IA | #115 | 03/04/2026 |
| DEC-051 | Onboarding Automatizado: pipeline CSV performance + ordens → cruzamento → indicadores → Kelly Criterion → plano sugerido. Self-service aceita direto, Alpha mentor valida. Mínimo 30 trades para relevância estatística | #116 | 03/04/2026 |
| DEC-052 | Chunks mapeados no issue do GitHub (campo obrigatório). Issues concretos mapeados em batch, épicos mapeados na decomposição em sub-issues. Modo leitura não requer lock, modo escrita requer lock exclusivo | #117 | 03/04/2026 |
| DEC-053 | Revisão de escopo #52 (Prop Firms): regras Apex março 2026 incorporadas — campos removidos (maeRule, maxRR), campos adicionados (dailyLossAction, evalTimeLimit, bracketOrderRequired, dcaAllowed, restrictedInstruments, qualifyingDays). Templates agora diferenciam Apex EOD vs Intraday como produtos separados | #52 | 03/04/2026 |
| DEC-054 | Feedback semântico (#31) em 2 fases: Fase 1 rule-based (custo zero, dados existentes), Fase 2 Gemini Flash (incluso no Google Workspace, mesmo ecossistema GCP/Firebase). Claude API descartado por custo recorrente | #31 | 03/04/2026 |
| DEC-055 | Subscriptions como subcollection de students (`students/{id}/subscriptions`), não collection raiz. Assinatura é entidade dependente — nunca existe sem aluno. Mentor queries via `collectionGroup('subscriptions')` | #94 | 04/04/2026 |
| DEC-056 | Campo `type: trial/paid` + `trialEndsAt` na subscription + `accessTier` no student. Separa leads (trial) de convertidos (paid). Trial sem cobrança, CF expira automaticamente. `accessTier` derivado da subscription ativa, sincronizado pela CF `checkSubscriptions` | #94 | 04/04/2026 |
| DEC-057 | Campo `whatsappNumber` como propriedade do documento `students/{id}`, não subcollection de contatos. WhatsApp é atributo direto do aluno, acesso em leitura única, sem necessidade de query adicional. Subcollection seria over-engineering para um único campo string | #123 | 05/04/2026 |
| DEC-058 | `formatDateBR` usa `getUTCDate/getUTCMonth/getUTCFullYear` em vez de `toLocaleDateString('pt-BR')`. Datas ISO midnight (ex: `2026-05-01T00:00:00Z`) em fuso BR (UTC-3) convertem para dia anterior via `toLocaleDateString`. Teste de regressão em `renewalForecast.test.js` pegou o bug antes da UI | #122 | 05/04/2026 |
| DEC-059 | `RenewalForecast` implementado como componente collapsible (colapsado por default) na `SubscriptionsPage`, não como bloco fixo. Projeção de caixa é consulta ocasional do mentor, não informação de primeira camada. Preserva espaço vertical para lista de subscriptions | #122 | 05/04/2026 |
| DEC-060 | **Plano de ataque prop firm — 5 perfis determinísticos instrument-aware** (CONS_A 10% DD, CONS_B 15% ★, CONS_C 20%, AGRES_A 25%, AGRES_B 30%). Lógica invertida: mais risco = menos trades (conservadores 2/dia, agressivos 1/dia). RR fixo 1:2. `roUSD = drawdownMax × roPct`, `stopPoints = roUSD / instrument.pointValue`. Viabilidade por 3 critérios + sugestão micro. Substitui modelo binário conservador/agressivo — `normalizeAttackProfile()` compat legado | #52 | 07/04/2026 |
| DEC-061 | **Restrição de sessão NY** — stops abaixo de `NY_MIN_VIABLE_STOP_PCT = 12.5%` do range NY não viáveis na sessão NY, mas viáveis em Ásia/London. Flag `sessionRestricted` + `recommendedSessions`. Threshold 12.5% genérico; calibração com ATR real v2: NQ NY range 329.4 pts → 12.5% = ~41 pts mínimo | #52 | 08/04/2026 |
| DEC-062 | **Engine prop firm duplicado (Opção A)** — `src/utils/propFirmDrawdownEngine.js` (ESM, testado 58 testes) e `functions/propFirmEngine.js` (CommonJS para CFs) são cópias manuais. Header de aviso obrigatório. DT-034 registra unificação futura via build step ou monorepo workspace | #52 | 09/04/2026 |
| DEC-063 | **Order Import cria trades automaticamente** após staging review — airlock = tela de seleção do aluno, criação é consequência da confirmação. GhostOperationsPanel (botão manual) descartado | #93 | 10/04/2026 |
| DEC-064 | **Confronto Enriquecido via updateDoc** com `_enrichmentSnapshot` inline — preserva campos comportamentais (emoção, setup, feedback), sobrescreve snapshot anterior (sem histórico infinito). DELETE+CREATE descartado | #93 | 10/04/2026 |
| DEC-065 | **Categorização de ops em 3 grupos**: toCreate (0 correlações) / toConfront (1 trade) / ambiguous (2+ trades). Lookup por `_rowIndex` — sem fallback por instrumento que causa falsos positivos. Ops mistas nunca caem em limbo | #93 | 10/04/2026 |
| DEC-066 | **Throttling de criação em batch**: ≤20 → Promise.allSettled paralelo; >20 → for/await sequencial com progresso dinâmico ("Criando trade N de M...") | #93 | 10/04/2026 |
| DEC-067 | **Badges "Importado" + "Complemento pendente"** em 4 componentes do diário. "Importado" (blue, permanente) = `source === 'order_import'`. "Pendente" (amber, transitório) = `!(emotionEntry\|\|emotion) \|\| !setup`. emotionExit não entra no critério | #93 | 10/04/2026 |
| DEC-068 | **Renomear `masterRules` → `fundedDrawdown`** no schema do template. Nomenclatura Ylos usa "Funded", não "Master". Campo `fundedDrawdown` é drawdown ativo quando `phase === 'SIM_FUNDED' \|\| 'LIVE'`; ausente (Apex) → cai em `template.drawdown` | #136 | 11/04/2026 |
| DEC-069 | **Plano é mecânica, não estatística.** `periodStop = maxTrades × RO`, `periodGoal = maxTrades × RO × RR`. Day RR === per-trade RR por construção. `dailyTarget` (EV profitTarget÷evalDays) é contexto de acumulação, NUNCA meta do plano | #136 | 11/04/2026 |
| DEC-070 | **Daily loss mesa no resumo do plano é condicional** — só aparece quando `suggestedPlan.dailyLossLimit > 0`. Contas Ylos Challenge (null) não mostram linha | #136 | 11/04/2026 |
| DEC-071 | **Engine phase-aware.** `calculateDrawdownState` aceita arg `phase`, resolve `activeDrawdown = getActiveDrawdown(template, phase)`. EVAL → `template.drawdown`, SIM_FUNDED/LIVE → `template.fundedDrawdown ?? template.drawdown`. Back-compat Apex (sem fundedDrawdown) | #136 | 12/04/2026 |
| DEC-072 | **`riskPerOperation = periodStopPct`** (teto diário por trade), não `roPerTrade/pl` (sizing mínimo de 1 contrato). Permite Path A (N trades × 1 contrato) e Path B (1 trade × N contratos) sem flag compliance | #136 | 12/04/2026 |
| DEC-073 | **Preview attack plan em 3 blocos**: (1) Constraints da mesa, (2) Mecânica do plano com stop/meta operacional + caminhos de execução, (3) Ritmo de acumulação rotulado como contexto | #136 | 12/04/2026 |
| DEC-074 | **Shadow Behavior em 3 camadas de resolução** (LOW/MEDIUM/HIGH). Camada 1 (todos os trades, parciais + contexto inter-trade) sempre ativa — shadow nunca fica vazio. Camada 2 (orders brutas) enriquece quando disponíveis. Trades manuais recebem análise LOW; trades importados recebem HIGH | #129 | 13/04/2026 |
| DEC-075 | **Guard `onTradeUpdated:1033` já cobre `shadowBehavior`** — early return automático quando só `shadowBehavior` muda (resultChanged/planChanged/complianceChanged todos false). Zero edição na CF para o guard | #129 | 13/04/2026 |
| DEC-076 | **`ShadowBehaviorPanel` em `src/components/Trades/`** (não OrderImport) — domínio de trades, consumido por TradeDetailModal e FeedbackPage | #129 | 13/04/2026 |
| DEC-077 | **Engine shadow puro espelhado em `functions/analyzeShadowBehavior.js`** — mesmo padrão DT-034 do propFirmEngine. Header de aviso obrigatório nos dois arquivos | #129 | 13/04/2026 |
| DEC-078 | **DIRECTION_FLIP** (14º padrão, Layer 1, janela 120min) — virada de mão no mesmo instrumento após loss. Mapeamento: CONFUSION. Adicionado em validação real após algoritmo retornar vazio para 2 losses opostas | #129 | 14/04/2026 |
| DEC-079 | **UNDERSIZED_TRADE** (15º padrão, Layer 1) — risco real <50% do RO planejado. Mapeamento: AVOIDANCE. Caller enriquece trade com `planRoPct`. Detecta disfunção financeira: subdimensionar silenciosamente em vez de renegociar o plano | #129 | 14/04/2026 |
| DEC-080 | **StudentContextProvider instanciado DENTRO do StudentDashboard.jsx** (não em App.jsx). Mantém refactor atômico contido. Delta para App.jsx fica como follow-up quando outros consumidores (fora do StudentDashboard) precisarem do contexto | #118 | 15/04/2026 |
| DEC-081 | **Sincronização bidirecional `filters.accountId ↔ ctx.accountId` via useEffect** — contexto é fonte de verdade para conta; `filters` multi-campo local (period/ticker/setup/emotion/etc.) preserva estrutura original sem ripple nos consumidores prop-drilled | #118 | 15/04/2026 |
| DEC-082 | **Adaptador temporário `selectedPropAccountId` para #134** — CHUNK-17 liberado após merge #133 (15/04/2026 tarde). Derivation mantida no commit de #118; migração dos componentes PROP (PropAccountCard, PropAlertsBanner, PropPayoutTracker) + hooks (useDrawdownHistory, useMovements) para consumir contexto direto fica em sessão subsequente | #118 | 15/04/2026 |
| DEC-083 | **cycleKey canônico:** "YYYY-MM" (Mensal) ou "YYYY-Qn" (Trimestral). Formato determinístico, parseável, ordenável por string DESC. Evita Dates com timezones em localStorage | #118 | 15/04/2026 |
| DEC-084 | **`alunoDoneIds` separado de `item.done`** — checkbox do aluno no card Pendências do dashboard (mutação via `arrayUnion`/`arrayRemove` em status=CLOSED, rule granular via `affectedKeys().hasOnly(['alunoDoneIds'])`) NÃO encerra o takeaway oficialmente. Semântica dual: mentor encerra (`item.done=true`, emerald ✓) vs aluno executa (`alunoDoneIds.includes(id)`, amber ✓). No TakeawayItem da WeeklyReviewPage, mentor vê badge "aluno ✓" como sinal de accountability sem confundir com deliberação | #102 | 20/04/2026 |
| DEC-085 | **Carry-over de takeaways `!done` entre revisões do mesmo plano** — ao criar novo DRAFT via `createWeeklyReview`, hook cliente busca última CLOSED/ARCHIVED do mesmo plano (em memória, sem índice composto novo), replica items não-encerrados pelo mentor com ids novos + campo `carriedOverFromReviewId` para rastreabilidade (badge `↻ anterior` sky no TakeawayItem). Revisão anterior permanece congelada. Implementação client-side (não CF) porque: (a) evita redeploy de functions; (b) cliente já tem permissão write em DRAFT; (c) best-effort — falha em getDocs/updateDoc não aborta criação da revisão, só loga warn | #102 | 20/04/2026 |
| DEC-AUTO-183-01 | **REMAP (não DELETE) dos planos órfãos do #183.** Intenção original era delete puro (evita heurística: mentor pode ter plano em conta própria/teste). Pivot durante validação em `localhost:5184` ao descobrir que planos legados podem ter trades reais vinculados. Script `scripts/issue-183-repair-orphan-plans.mjs` atualiza `plan.studentId/Email/Name` via `account.studentId` com cascade em `trades` (filtram por `studentId`/`studentEmail`). Safety nets com skip registrado: plano sem `accountId`, account inexistente, account sem `studentId`, account também do mentor. Backup dos valores antigos em `_repairedByIssue183PreviousStudentId/Email` + timestamp `_repairedByIssue183At` no doc do plano | #183 | 24/04/2026 |
| DEC-AUTO-183-02 | **Critério de órfão = `plan.studentEmail == 'marcio.portes@me.com'`** (`MENTOR_EMAIL` em `src/firebase.js:30`). Não há campo `role` no Firestore; derivação do papel vive nas rules (`firestore.rules:22`) e no frontend (`AuthContext`). Filtro trivial, resiliente a mudanças de UID | #183 | 24/04/2026 |
| DEC-AUTO-191-01 | **Janela do gate `compliance-100` (Metódico→Profissional) = união dos ciclos ativos do trader, todos os planos.** Maturidade é do trader, não de plano específico — não faz sentido avaliar aderência por plano isoladamente. Para cada plano, ciclo ativo é derivado por `adjustmentCycle` (Mensal/Trimestral/Semestral/Anual). Mínimo 20 trades CLOSED na união; se não atinge, retrocede simultaneamente 1 ciclo em CADA plano e recoleta. Repete até bater 20 ou esgotar (iteração que não acrescenta nada; cap defensivo `MAX_LOOKBACK_CYCLES=36`). Substitui o alias `complianceRate100 = complianceRate` (cálculo da janela total — semanticamente errado para um gate chamado "compliance-100") | #191 | 25/04/2026 |
| DEC-AUTO-191-02 | **Estado "insuficiente" do `complianceRate100` = `null`** (não flag adicional). Mapeia automaticamente para `met: null`/`reason: 'METRIC_UNAVAILABLE'` em `evaluateGates.js`: gate fica pendente — **não promove** (`gatesMet < gatesTotal` bloqueia `proposeStageTransition`) e **não rebaixa** (`detectRegressionSignal` não consome este campo, DEC-020 preservada). Alternativa descartada: flag `complianceRate100Sufficient: false` separada — desnecessária, `null` já carrega a semântica. Trader sem histórico suficiente segue no stage atual sem bloqueio até atingir o mínimo | #191 | 25/04/2026 |

---

