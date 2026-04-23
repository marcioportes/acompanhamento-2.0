# PROJECT.md — Acompanhamento 2.0
## Documento Mestre do Projeto · Single Source of Truth

> **Versão:** 0.35.0  
> **Última atualização:** 23/04/2026 — v0.35.0: Encerramento #176 — scripts de orquestração §13 entregues. Template canônico `~/cc-mailbox/templates/coord-briefing.md` + `cc-spawn-coord.sh` (wrapper §13.8 passo 8b com precondição cwd=worktree, render template com placeholders do control file, captura session_id do JSON) + `cc-dispatch-task.sh` (wrapper passos 8d/36 com `flock` + `--resume` da Coord). **Smoke integration 5/5 OK** em worktree sintético `issue-998`: spawn retornou session_id válido, start.sh gravou `.coord-id`/`.coord-dir` READ-ONLY, dispatch FIRST acordou Coord via `flock + --resume`, Coord leu control file e escreveu `inbox/01-smoke.md` com `SMOKE_OK` e morreu. §13.11 atualizado com 3 componentes novos **IMPLEMENTADO**, protocolo declarado **OPERACIONAL END-TO-END**. Próxima sessão dispara "atacar #NNN em modo autônomo" sem improviso. Pendente apenas Fase D (rodada real com worker + validator + email + recovery). Sem chunk lock. Sem bump `src/version.js`.  
> **Última atualização (histórica):** 23/04/2026 — v0.33.0: Encerramento #174 v1.42.1 (PR #175 mergeado, merge commit `d871fad2`). Wire de `setupsMeta` em `MentorDashboard` via `filterSetupsForStudent(setups, selectedStudent?.studentId)` (util puro em `src/utils/setupsFilter.js`, 10 testes). Completa E4 da spec de #170 cortado injustamente durante o merge. Isolamento estrito: setup de aluno X não vaza para aluno Y; fallback `null` retorna apenas globais. MentorDashboard agora importa `useSetups` + memoiza filtro + passa `setupsMeta={selectedStudentSetups}` ao `<SetupAnalysis>`. Aderência RR renderiza corretamente na visão do mentor. 1890/1890 testes (+10). Lock CHUNK-16 liberado. Issue doc arquivada. Worktree `~/projects/issue-174` removido. Memória operacional `feedback_spec_scope_respeito.md` gravada para não repetir o corte.   Substitui `SetupAnalysis.jsx` por card de diagnóstico operacional com 4 KPIs em grid 2×2 (EV por trade · Payoff · ΔT W vs L com semáforo ±20%/±10% · Contribuição ao EV total). Aderência RR condicional (só quando `setups.targetRR`), Sparkline 6m, Insight 1-linha, ordenação por \|contribEV\| desc, accordion "Esporádicos (N)" para setups com n<3. Util puro `src/utils/setupAnalysisV2.js`. Zero campo Firestore novo. Consumido em `StudentDashboard` via `useSetups` já presente. MentorDashboard sem `setupsMeta` (não filtra por student, fast-follow). Fast-fix `0bffe1f1` pré-merge: overflow do card corrigido (header em 2 linhas, truncate no nome, sublabels curtos, `Xm` em vez de `Xmin`). 1880/1880 testes (+40: 23 util + 17 render). Lock CHUNK-02 liberado (AVAILABLE). Issue doc arquivada. Worktree `~/projects/issue-170` removido.  
> **Criado:** 26/03/2026 — sessão de consolidação documental  
> **Fontes originais:** ARCHITECTURE.md, AVOID-SESSION-FAILURES.md, VERSIONING.md, CHANGELOG.md, CHUNK-REGISTRY.md  
> **Mantido por:** Marcio Portes (integrador único)

### Versionamento do PROJECT.md (INV-14)

Este documento segue versionamento semântico:
- **MAJOR (X.0.0):** reestruturação de seções, mudança de invariantes existentes, remoção de seções
- **MINOR (0.X.0):** novas invariantes, novas seções, novos chunks, novas DECs, mudança de protocolo
- **PATCH (0.0.X):** correções textuais, ajustes de formatação, atualização de status de DTs

**Histórico de versões do documento:**

| Versão | Data | Sessão | Mudanças |
|--------|------|--------|----------|
| 0.1.0 | 26/03/2026 | Consolidação documental | Criação — merge de 5 documentos |
| 0.2.0 | 29/03/2026 | Branding e tiers | DEC-029 a DEC-038, milestones, DT-027/028 |
| 0.3.0 | 30/03/2026 | Probing rehydration | DEC-043/044, INV-13, template issue-NNN |
| 0.4.0 | 02/04/2026 | Design Revisão Semanal | DEC-045/046, design #102, bash migration |
| 0.5.0 | 03/04/2026 | Dashboard-Aluno MVP | DEC-047 a DEC-052, CHUNK-13 a 16, INV-14, protocolo chunks |
| 0.5.1 | 03/04/2026 | Registro de issues | Issues #106-#119 nos milestones, #3 reescrito, #19 fechado |
| 0.6.0 | 03/04/2026 | Revisão #52 Prop Firms | DEC-053, escopo #52 atualizado com regras Apex Mar/2026 |
| 0.6.1 | 03/04/2026 | Fix #89 + v1.22.1 | firestore.rules DEC-025 plans, índice movements, #120 aberto, #66 fechado |
| 0.6.2 | 03/04/2026 | Reescrita #31 Feedback Semântico | DEC-054, abordagem escalonada rule-based + Gemini Flash |
| 0.6.3 | 04/04/2026 | Limpeza milestones | Fechar #44/#55/#56/#117, DT-007 RESOLVIDO, contagens atualizadas |
| 0.7.0 | 05/04/2026 | Controle de Assinaturas | #94 v1.23.0, DEC-055/DEC-056, CHUNK-16 liberado |
| 0.8.0 | 05/04/2026 | Revisão documental | INV-15/16, DT-030/031, mapa CFs atualizado, convenções bash, #94 fechado |
| 0.9.0 | 05/04/2026 | CHUNK-17 + lock #52 | CHUNK-17 Prop Firm Engine criado no registry, lock registrado para #52 |
| 0.10.0 | 05/04/2026 | v1.24.0 #122/#123 | RenewalForecast + whatsappNumber, CHANGELOG v1.24.0, CHUNK-02/16 lock |
| 0.10.1 | 05/04/2026 | Encerramento #122/#123 | DEC-060/061/062 adicionados, locks CHUNK-02/16 registrados retroativamente em §6.3 |
| 0.10.2 | 06/04/2026 | #122/#123 mergeados | PR #124 mergeado, locks CHUNK-02/16 liberados (AVAILABLE), removidos de Locks ativos |
| 0.12.0 | 10/04/2026 | Order Import V1.1 redesign | #93 v1.26.0, DEC-063 a DEC-067, criação automática + confronto enriquecido |
| 0.12.1 | 11/04/2026 | Reforço INV-16 worktree | INV-16 reescrita (obrigatória sempre), padrão único `~/projects/issue-{NNN}`, passo worktree explícito em §4.0 e CLAUDE.md §Ativação Automática |
| 0.13.0 | 12/04/2026 | #136 Prop Plan semântica + Ylos | DEC-068 a DEC-073, CHANGELOG v1.26.1-v1.26.4, templates Ylos + engine TRAILING_TO_STATIC phase-aware, correção semântica mecânica plano PROP, locks CHUNK-03/17 |
| 0.11.0 | 09/04/2026 | Prop Firm Engine deployado | #52 Fases 1/1.5/2 v1.25.0, DEC-060/061/062, DT-034/035, correção ATR v2 |
| 0.14.0 | 13/04/2026 | #134 Prop Dashboard v1.27.0 | PropAccountCard gauges + PropAlertsBanner 3 níveis + sparkline drawdownHistory + tempo médio trades universal + PropPayoutTracker (qualifying days, eligibility, simulador saque), CHUNK-02/17 lock, 77 testes novos |
| 0.14.1 | 13/04/2026 | Encerramento #134 | PR #138 mergeado, locks CHUNK-02/17 liberados (AVAILABLE), issue doc movida para archive, DEC adicional: PhaseSelector (transição de fase semântica) + DebugBadge `embedded` prop |
| 0.14.2 | 13/04/2026 | Protocolo §4.3 — rm -rf worktree | Adicionada 2ª etapa obrigatória no passo 5 de encerramento: `rm -rf ~/projects/issue-{NNN}` após `git worktree remove` para limpar diretório físico residual (cache .vite, etc.) |
| 0.15.0 | 13/04/2026 | Encerramento #134 + reforço protocolo | AP-08 Build Verde App Quebrada, §4.0 reordenado (shared files antes do worktree), §4.2 validação browser obrigatória |
| 0.16.0 | 14/04/2026 | Encerramento #129 Shadow Behavior | v1.28.0, 15 padrões comportamentais, CF callable analyzeShadowBehavior, DEC-074 a DEC-079, CHANGELOG [1.28.0], lock CHUNK-04 liberado |
| 0.17.0 | 15/04/2026 | #133 AI Approach Plan v1.29.0 | CF generatePropFirmApproachPlan Sonnet 4.6, prompt v1.1 com 6 correções #136 (MECÂNICA DIÁRIA, RITMO DE ACUMULAÇÃO, read-only, coerência mecânica, Path A/B), validate.js com 7 grupos incluindo coerência mecânica, fallback determinístico sem consumo de cota, UI seção colapsável PropAccountCard, 24 testes novos, lock CHUNK-17 |
| 0.17.1 | 15/04/2026 | Encerramento #133 | PR #140 mergeado, lock CHUNK-17 liberado (AVAILABLE), issue doc movida para archive, worktree removido |
| 0.18.0 | 15/04/2026 | #118 Barra de Contexto Unificado + encerramento | v1.30.0, StudentContextProvider + ContextBar + cycleResolver, DEC-080 a DEC-083, CHANGELOG [1.30.0], §4.0 diretiva operacional Claude Code (autorização permanente de leitura), 46 testes novos, locks CHUNK-02/13 liberados, PR #141 mergeado |
| 0.18.1 | 15/04/2026 | §4.0 reserva de versão na abertura | Fase 3 ler `version.js` + reservar próximo minor + commitar junto com locks. §4.2 passa a aplicar versão reservada. Elimina conflito de versão na origem (lição aprendida após rebase #118 ter precisado bumpar 1.29→1.30 em cima do #133) |
| 0.19.0 | 15/04/2026 | #142 Order Import Tradovate v1.31.0 | FORMAT_REGISTRY extensível em orderParsers.js, auto-detect ProfitChart vs Tradovate por header signature (threshold 0.5 / 0.6), parser parseTradovateOrders com Papa.parse quote-aware, remove gatekeep hardcoded em OrderImportPage.jsx, detecção multi-delimitador (; e ,), shape canônico idêntico entre parsers, downstream agnóstico inalterado, 19 testes novos (2 Fase A + 17 Fase B), fixtures reais april/feb conta Apex, validado em browser |
| 0.19.1 | 15/04/2026 | Encerramento #142 | PR #143 mergeado, lock CHUNK-10 liberado (AVAILABLE), issue doc movida para archive, worktree removido |
| 0.20.0 | 15/04/2026 | Abertura #145 Mesa Prop v1.32.0 | Locks CHUNK-02/17, v1.32.0 reservada em version.js, Página dedicada Mesa Prop — extrair componentes prop do Dashboard (epic #144) |
| 0.20.1 | 15/04/2026 | Abertura #102 Revisão Semanal v1.33.0 | Lock CHUNK-16, v1.33.0 reservada em version.js, Revisão Semanal Fases A-D (#106 absorvido como Fase A) |
| 0.21.0 | 16/04/2026 | Abertura #146 fix Novo Plano v1.34.0 | Locks CHUNK-02/03 (bypass CHUNK-02 lock #145 — sessão solo autorizada), v1.34.0 reservada, mover criação de plano de DashboardHeader para AccountDetailPage |
| 0.21.1 | 16/04/2026 | Encerramento #146 v1.34.0 | PR #147 mergeado, locks CHUNK-02/03 liberados (AVAILABLE), issue doc arquivada, worktree removido, CHANGELOG [1.34.0] |
| 0.22.0 | 17/04/2026 | INV-17 + INV-18 — gates de arquitetura e spec review | INV-17 (Gate de Arquitetura de Informação — nível/domínio/duplicação/budget + mapa de slots fixos) e INV-18 (Spec Review Gate — validação de entendimento obrigatória antes de codificar, formato por tipo UI/CF/lógica/Firestore) adicionadas a CLAUDE.md e §3 Invariantes. §4.1 Gate Pré-Código ganhou itens de checklist para INV-17/INV-18. §5 checklist de impacto atualizado para "INV-01 a INV-18" |
| 0.22.1 | 19/04/2026 | Encerramento #145 v1.32.0 | PR #152 mergeado (redesign Mesa Prop em 4 zonas: status agora / retrospectivo / contrato da mesa / payout). 5 componentes novos (PropEquityCurve, PropHistoricalKPIs, TemplateCard, PlanoMecanicoCard, PropViabilityBadge) + lógica pura propViabilityBadge (6 estados phase-aware). useDrawdownHistory MAX_DOCS 100→1000. AI Approach Plan migrou para #148 (RESERVADO, gate 4D+30 shadow trades). Hotfix #149 cancelada (bug só existia em branch). Locks CHUNK-02 + CHUNK-17 liberados. Issue doc arquivada em docs/archive/. Spec Review Gate INV-18 aplicado (iteração 3). 16 testes novos, 1567/1567 passando |
| 0.22.2 | 19/04/2026 | #128 deepdive — SPEC v1.0 + IMPACT v0.2 em referência | SPEC-importacao-plano-v1.0 e IMPACT-importacao-plano-v0.2 adicionados a `docs/reference/` como material de domínio citável (não protocolo formal). Deepdive produziu: 4 INVs (INV-19 a INV-22), 4 APs (AP-09 a AP-12), 7 DECs (DEC-084 a DEC-090), 6 issues derivadas (ISSUE 1-6). ISSUE 7 (migração shadowBehavior) cancelada, virou DT-036 com trigger de reconsideração em > 5000 trades. Framework de bundle formal INV-19 abandonado em favor de modo interativo (pair programming assíncrono com coder). Invariantes da spec ficam como vocabulário/referência, não como gate. |
| 0.22.3 | 19/04/2026 | Cancelar ISSUE 6 — reconciliação vira DT-037 | ISSUE 6 (reconciliação de agregados INV-22) cancelada. DT-037 registrada com trigger de reconsideração em > 1000 trades OU primeiro incidente real de divergência OU escala que exija observabilidade defensiva. Priorização do Marcio: resultado concreto dia-a-dia + material para marketing/lead capture. Issues ativas do deepdive #128 agora: ISSUE 1 a ISSUE 5 (fundação + imports + plano + mesa). |
| 0.22.4 | 19/04/2026 | Encerramento #154 v1.36.0 | PR #155 mergeado (fast-forward, merge commit 6caf02c9). Card de conta em `AccountsPage` (visão aluno) e `StudentAccountGroup` (visão mentor) ganha botão "Novo plano" (ícone `PlusCircle` emerald); click passa flag `_autoOpenPlanModal` para `AccountDetailPage` que abre `PlanManagementModal` via `useEffect`. Preserva "casa do pai" (modal não duplica surface, AP-11 não violado). Resolve workaround crítico: hoje aluno criava conta Mesa → revertia para Real → corrigia plano. **Primeira issue entregue em modo interativo** (sem bundle formal INV-19, sem R1/R2/R3) — protocolo §4.0 disciplina básica (issue + worktree + control file + PR + Closes) foi suficiente. 1567/1567 testes passando, zero regressão. Worktree removido, issue doc arquivada. |
| 0.22.5 | 19/04/2026 | DT-038 — cancelar estrutura 3 camadas do trade | Revisão pragmática da ISSUE 1 do deepdive #128. Estrutura proposta (`_rawPayload` imutável + projeção canônica + `_enrichments[]` append-only) responde a perguntas que o produto não faz hoje: (A) preservação após N enrichments — `_enrichmentSnapshot` atual cobre 95%; (B) histórico granular — sem demanda de UI; (C) rollback específico — caso de borda raro; (D) auditoria evolutiva — sem necessidade. Migração custaria 2-3 dias + risco em prod. DT-038 registrada com 3 triggers de reconsideração. Parte técnica de ISSUE 1 desarmada. **ISSUE 3 cirúrgica destravada** (fix bypass #93 + UX conversacional + AutoLiq badge + segmentação por ticker), sem dependência de refactor arquitetural. Princípio operacional formalizado: "não é falta de controle, é ritmo" — cancelar rigor que responde perguntas ainda não feitas é cadência correta. Também: scripts `cc-worktree-start.sh` + `cc-worktree-stop.sh` criados (commit c52da7ef) para orquestração coordenador→coder via mailbox em `.cc-mailbox/` dentro do worktree (POC validado). |
| 0.22.6 | 19/04/2026 | Fase A de #156 entregue + DT-039 | **Primeira issue entregue em modelo coordenador+worker via mailbox file-drop** (este coordenador escreve prompt → listener tmux `cc-156` dispara `claude -p` headless no worktree → worker executa e relata em `.cc-mailbox/outbox/`). Task 01 (discovery) e Task 02 (Fase A) completas. Commit `1e034534` no branch `arch/issue-156-order-import-staging-conversacional`: `OrderImportPage.jsx` não escreve mais `shadowBehavior` direto em `trades` (removidas 52 linhas); hook `useShadowAnalysis` invoca CF canônica `analyzeShadowBehavior`. Novo arquivo `src/__tests__/invariants/tradeWriteBoundary.test.js` (106 linhas, 6 testes) — grep-based, falha build se novos writers aparecerem em `trades` fora da whitelist. 1573/1573 testes passando. DT-039 registrada: 4 arquivos legados mantidos em whitelist GRANDFATHERED (useTrades/useAccounts/usePlans CRUD + seedTestExtract) — refatoração fica para ISSUE 1 do épico #128 ou primeiro incidente que exija migração. |
| 0.22.8 | 20/04/2026 | Encerramento #102 v1.38.0 | PRs #157 (rules alunoDoneIds — merged `e9d5de8d` + deployado via `firebase deploy --only firestore:rules`) e #160 (squash `30af3a18`) mergeados em sequência. Entrega consolidada da **Revisão Semanal v2**: (a) `WeeklyReviewPage` nova com 8 subitens conforme mockup aprovado (Trades tabela + day-grouping, Notas da sessão, 8 KPIs com tooltip inline, SWOT IA 4 quadrantes, Takeaways checklist, Ranking top/bottom, Maturidade 4D, Navegação contextual) + Action Footer Publicar/Arquivar (gate de fechamento que faltava); (b) **carry-over de takeaways** `!done` entre revisões do mesmo plano, badge `↻ anterior`; (c) **PendingTakeaways** no dashboard do aluno (rule nova permite `alunoDoneIds` via arrayUnion em CLOSED, badge `aluno ✓` amber visível pro mentor na revisão); (d) **PendingReviewsCard** trigger secundário G8 no MentorDashboard (N-listener pattern, evita índice COLLECTION_GROUP novo). Coexiste com `PlanLedgerExtract` 3-col baseline (ReviewToolsPanel), preservado intacto para comparação. Bugfixes relevantes: hijack `viewingAsStudent → StudentDashboard` movido para DEPOIS do check `currentView==='onboarding'` no App.jsx; retorno contextual do ledger e assessment; `closeReview` preserva campos não-passados (undefined-check). DEC-086/087 adicionados. Issue **#159** criado como QA tracker (14 blocos ~120 checkboxes, validação em produção). Lock CHUNK-16 liberado (AVAILABLE). Issue doc arquivada em `docs/archive/`. Worktree `/home/mportes/projects/issue-102` removido (git worktree remove + rm -rf). 1727/1727 testes passing (baseline pré-sessão 1583 + carry-over +4 + outros merges). Zero regressão. |
| 0.22.9 | 20/04/2026 | Abertura #162 SEV1 hotfix | Plataforma fora do ar em produção — `ReferenceError: assessmentStudentId is not defined` em `src/pages/StudentDashboard.jsx:362` (prop `studentId` de `<PendingTakeaways>` referencia identificador inexistente). Introduzido pelo merge PR #160 (#102 v1.38.0, commit `30af3a18`). Lock CHUNK-02 registrado em §6.3 para `fix/issue-162-hotfix-assessment-student-id`. `src/version.js` bumped para v1.38.1 + entrada CHANGELOG reservada. Worktree `~/projects/issue-162` a criar no próximo passo §4.0. Fix: substituir por `overrideStudentId \|\| user?.uid` (padrão canônico linha 558 e hooks irmãos `useTrades/useAccounts/usePlans`). |
| 0.22.10 | 20/04/2026 | Encerramento #162 v1.38.1 | PR #163 mergeado (merge commit `3192353b`, squash). Fix 1-linha em `StudentDashboard.jsx:362` — `assessmentStudentId` → `overrideStudentId \|\| user?.uid`. Deploy Vercel validado em produção por Marcio ("plataforma voltou"). Adicionado teste invariante `studentDashboardReferences.test.js` (grep-based, padrão #156 `tradeWriteBoundary`). 1728/1728 testes passing (+1 vs baseline pré-hotfix 1727). Lock CHUNK-02 liberado (AVAILABLE). Issue doc arquivada em `docs/archive/`. Worktree `~/projects/issue-162` removido (git worktree remove + rm -rf). **Lições:** (a) QA tracker #159 não cobriu render do dashboard aluno com `<PendingTakeaways>` montado — gap de validação do #102; (b) `npm run lint` (eslint `no-undef`) teria pegado o erro em CI — candidato a fast-follow tornar required. |
| 0.23.8 | 21/04/2026 | §4.3 rm -rf obrigatório | `rm -rf ~/projects/issue-{NNN}` é passo obrigatório após `git worktree remove` — sessões anteriores omitiam, deixando resíduos físicos. Verificação `ls ~/projects/` adicionada ao protocolo. |
| 0.27.0 | 22/04/2026 | Encerramento #164 v1.41.0 | PR #171 mergeado (merge commit `f3d46895`). Dashboard Aluno ajustes: 4 entregas (E1 SWOT via `useLatestClosedReview` resiliente a `planId` stale / E2 card "Consistência Operacional" CV+ΔT / E3 Matriz Emocional 4D Opção D com sublabels e rename Maturidade / E5 EquityCurve tabs multi-moeda + curva ideal do plano). Cascata `selectedPlanId` → cards via `accountsInScope` em `useDashboardMetrics`. ContextBar preserva `accountId` do usuário e lista todos os planos em "Todas as contas". AccountFilterBar removido. **2 bugs out-of-scope carregados**: (a) trade edit `exchange: undefined` pós import CSV (fix em 3 camadas `useCsvStaging`+`AddTradeModal`+`useTrades`); (b) #102 PinToReviewButton salvava em `takeawayItems`/`takeaways` — corrigido para `sessionNotes` via novo `appendSessionNotes`. 1732 → 1840 testes (+108). 37 commits. Lock CHUNK-02 liberado (AVAILABLE). Issue doc arquivada em `docs/archive/`. Worktree removido. |
| 0.26.0 | 22/04/2026 | §13 amendments — bugs rodada #164 (cross-worktree, recovery, CLAIMS obrigatório) | Primeira execução real do §13 (issue #164) expôs 3 bugs com evidência direta: (1) **Cross-worktree do `.coord-dir`** — session `5cd03bd7` (pts/4) criada com cwd = main repo teve JSONL em project-scope `-acompanhamento-2-0`; listener do worktree invocando `--resume` falhou silenciosamente. §13.7 ganha `.coord-dir` com mesma disciplina READ-ONLY da INV-26; §13.8 passo 8b explicita pré-condição "cwd = worktree" como dura. (2) **§13 sem cláusula de recovery** — CC-Interface morreu; nova precisou sobrescrever `.coord-id` pra funcionar, violando INV-26 literalmente. Nova §13.15 "Protocolo de Recovery de CC-Interface" formaliza os 5 passos (process check, JSONL scope check, spawn sem --resume, escrita excepcional de .coord-id + .coord-dir, registro em §3.2). INV-26 ganha amendment explicitando recovery como única exceção ao READ-ONLY. (3) **Briefing sem exigência de CLAIMS** — worker E3 entregou em formato livre porque o prompt não pediu CLAIMS, deixando validação INV-27 totalmente manual. §13.9 ganha parágrafo obrigando cláusula explícita de CLAIMS em todo briefing, sob pena de STOP-HALLUCINATION. Escopo intencionalmente enxuto: 2 bugs adicionais ("fantasma de ação não-tomada", dedup-por-brewing-prolongado) foram desinflados por evidência circunstancial — ficam como observações em memória, não amendments estruturais. Lição de método: em fase de design pós-execução, desinflar antes de commitar — pressão social de "ser útil" + narrativa do humano podem inflar diagnóstico para além da evidência. |
| 0.25.0 | 21/04/2026 | §13 Implementação Autônoma + INV-27/28 + amendment INV-26 | Sessão de design de 5+ horas consolidada. Adiciona §13 com protocolo completo de modo autônomo (CC-Interface + CC-Coord + CC-Worker), 6 fases compactas, canais de comunicação com ownership de diretórios, máquinas de estado por ator, regra de trigger explícito ("atacar #NNN em modo autônomo"), critério opt-in vs modo interativo default, bloco CLAIMS obrigatório em report do worker, validator com 3 checks (commit/tests/files), 10 decisões de design enxutas (bugs 1-10), tipos de email + rate limit, notas operacionais sobre prompt cache. INV-27 formaliza validação externa contra cegueira epistêmica (modelo pode não detectar própria alucinação; auto-declaração "não aluciei" insuficiente). INV-28 estabelece email iCloud como canal primário de gate humano. INV-26 amendment explicita que CC-Interface também é READ-ONLY para `.coord-id`. Scripts python (`cc-notify-email.py`, `cc-validate-task.py`) e refactor de `cc-worktree-start.sh` ficam pra issue formal futura (INV-07/09); esta entrada é SPEC TEXTUAL, não implementação. Lição crítica: design aprovado em sessão não é autoridade até ser commitado no main — qualquer sessão nova só enxerga o que está no PROJECT.md. |
| 0.24.0 | 21/04/2026 | Abertura #164 — lock CHUNK-02 + v1.41.0 reservada | Dashboard Aluno ajustes: spec aprovada com 4 entregas (E1 SWOT reaproveita `review.swot` + fallback / E2 card "Consistência Operacional" CV P&L + ΔT W/L substitui RR Asymmetry e Tempo Médio isolado / E3 Matriz Emocional 4D Opção A com expectância+payoff+shift+ΔWR+sparkline / E5 EquityCurve com tabs por moeda + curva ideal do plano por trajetória linear de dias corridos quando planId único). E4 (cards desatualizados) removida — Marcio confirmou nenhum dos 10 cards stale. CHUNK-02 escrita; CHUNK-04/06/13/16 leitura. |
| 0.23.7 | 21/04/2026 | Encerramento #166 v1.40.0 | PR #168 mergeado (merge commit `ca74b289`). Fix Sev1: botão "Finalizar" em ProbingQuestionsFlow com try/catch + disabled + spinner; fromStatus='probing' em completeProbing; DebugBadge corrigido. 4 testes novos, 1732/1732 passando. CHUNK-09 liberado (AVAILABLE). Issue doc arquivada. Worktree removido. |
| 0.23.6 | 21/04/2026 | INV-26: `.coord-id` é responsabilidade do start script | Coord nunca sobrescreve `.coord-id` — valor gravado pelo `cc-worktree-start.sh` no boot do listener. Anti-pattern: inventar session ID quando `$CLAUDE_SESSION_ID` retorna vazio. Lição #166. |
| 0.23.5 | 21/04/2026 | Abertura #166 — lock CHUNK-09 + v1.40.0 reservada |
| 0.23.4 | 21/04/2026 | Encerramento #165 v1.39.0 | PR #167 mergeado (merge commit `0bdaa1a0`). sessionNotes no painel lateral, filtro trades revisados via `includedTradeIds`, botão contextual "Continuar Rascunho". 16 testes novos, 1744/1744 passando. Locks CHUNK-02/08 liberados (AVAILABLE). Issue doc arquivada. Worktree removido. |
| 0.23.3 | 21/04/2026 | INV-25: outbox antes de resume | Formaliza invariante do padrão coord/worker: output do worker persiste em outbox antes do `--resume`. Coord relê sempre do disco, nunca assume memória do worker. Origin: recovery manual #165. |
| 0.23.2 | 20/04/2026 | §4.0 coord/worker: coord deve abrir do worktree | Lição #165: `claude --resume` procura JSONL no projeto correspondente ao cwd de invocação. Coord aberto no main → listener no worktree não encontra sessão. Regra adicionada: após criar worktree, entrar nele (`cd ~/projects/issue-NNN`) antes de abrir a sessão coord. |
| 0.23.1 | 20/04/2026 | Abertura #165 — locks CHUNK-02/08 + v1.39.0 reservada |
| 0.23.0 | 20/04/2026 | §4.2 Gate Pré-Entrega — precauções #162 | Lições do SEV1 #162 incorporadas como ITENS OBRIGATÓRIOS do gate pré-entrega (antes eram apenas notas no CHANGELOG v1.38.1): (a) **`npm run lint` em arquivos tocados no branch** — zero `no-undef`, zero `no-unused-vars` críticos, zero regressão em regras já ativas. Custo ~5s/arquivo. Origem: ReferenceError `assessmentStudentId` teria sido pego aqui. (b) **Validação em browser por contexto de consumo** — aluno logado / mentor viewAs / override-embedded, quando aplicáveis. Origem: o #102 validou apenas o contexto mentor (WeeklyReviewPage) e deixou o contexto aluno (dashboard com `<PendingTakeaways>`) passar para prod sem render-check. Bump MINOR (mudança de protocolo §1 do versionamento). Sem lock de chunk — edição exclusivamente em shared file `docs/PROJECT.md`. |
| 0.22.7 | 20/04/2026 | Encerramento #156 v1.37.0 | PR #158 mergeado. Épico de 6 fases (A-F) consolidado em um único PR: (A) shadow writer bypass removido + invariante `tradeWriteBoundary`; (B) schema classificação persistente (5 classes) em `ordersStagingArea` + `autoLiqDetector`; (C) UX conversacional `ConversationalOpCard` substitui auto-create #93 + `AutoLiqBadge` + gate plano retroativo; (D) reconstrução robusta — segmentação por instrument + agregação N×M fills + gap 60min; (E) enrichment sem duplicata — helper puro `conversationalIngest` + `AdjustmentModal` diff fino + persist `discarded` em `orders`; (F) wire `onRequestRetroactivePlan` em App→StudentDashboard→OrderImportPage fechando gate + bump v1.37.0. **1689/1689 testes** (+122 vs baseline pré-#156 de 1567), invariante verde, zero regressão. Delta de shared files: `version.js` bumped, `firestore.rules` não tocado pela issue. Worktree removido, tmux `cc-156` killed, issue doc arquivada em `docs/archive/`, Product Board item movido para Done. **Infra operacional nova:** scripts `cc-worktree-{start,stop}.sh` + mailbox file-drop (`.cc-mailbox/`) + suporte opcional a `COORD_SESSION_ID` para notificação inversa via `claude --resume` validada em teste isolado — aplicável a partir do próximo épico. |
| 0.28.0 | 22/04/2026 | Abertura #170 SetupAnalysis V2 v1.42.0 | Lock CHUNK-02 (escrita), CHUNK-04/16 (leitura). v1.42.0 reservada em version.js + entrada CHANGELOG RESERVADA. Spec aprovada: card de setup com 4 KPIs operacionais em grid 2×2 (EV por trade, Payoff, ΔT W vs L com semáforo ±20%/±10%, Contribuição ao EV total) + Aderência RR condicional quando `setups.targetRR` existe + Sparkline 6m (reusa padrão Matriz 4D) + Insight 1-linha. Ordenação por \|contribEV\| desc; setups <3 trades em accordion "Esporádicos (N)" no rodapé. Util puro novo `src/utils/setupAnalysisV2.js` com 15-20 testes antes da UI. `SetupAnalysis.jsx` substituído mantendo API externa (prop `trades`) + nova prop opcional `setupsMeta`. Zero campo Firestore novo. Consumido em `StudentDashboard` e `MentorDashboard` (ambos já importam). Origem: spin-off do review de #164. Milestone v1.2.0 Mentor Cockpit. Modo autônomo degradado (scripts `cc-notify-email.py` + `cc-validate-task.py` ainda não existem — email manual via RC). |
| 0.29.0 | 22/04/2026 | Abertura #169 scripts Protocolo Autônomo §13 Fases A+B+C | Meta-infra: tirar §13 do modo degradado. Escopo desta sessão: (A) `~/cc-mailbox/{bin,log,templates}/` + `.env.example` + `cc-notify-email.py` (iCloud SMTP `smtp.mail.me.com:587` STARTTLS, rate limit por `(issue, type)` em 4h via `notify-state.json`, 7 TIPOs §13.10, body template com seção COMO RESPONDER, log agregado); (B) `cc-validate-task.py` com 3 checks §13.9 (commit_exists, tests_match, files_match), <300ms, STOP-HALLUCINATION em falha, regra `tests: skipped` apenas para `.md`/`docs/`, pytest unit; (C) refactor `cc-worktree-start.sh` 3-tier (aceita `INTERFACE_SESSION_ID` + `COORD_SESSION_ID`, grava `.coord-id` + `.coord-dir` READ-ONLY — INV-26, pré-condição `cwd = worktree` abortando execução, cria todos os dirs §13.7), template canônico `~/cc-mailbox/templates/worker-briefing.md` com cláusula CLAIMS obrigatória. **Fase D (rodada end-to-end + bump §13.11 "A ESCREVER" → implementado) separada** — requer issue-teste real em modo autônomo puro. Sem chunk lock (infra fora do produto Espelho). Sem bump em `src/version.js`. Branch `arch/issue-169-scripts-protocolo-autonomo`. |
| 0.35.0 | 23/04/2026 | Encerramento #176 — scripts de orquestração §13 | Entregues 3 componentes meta-infra: (1) `~/cc-mailbox/templates/coord-briefing.md` — template canônico da CC-Coord com placeholders `{{issue_num}}`, `{{issue_title}}`, `{{branch}}`, `{{worktree_path}}`, `{{control_file_path}}`. Cobre identidade, ciclo de vida "sempre morrer", wake-ups (DISPATCH_TASK, TASK_DELIVERED com fluxo result.log→report.md→`cc-validate-task.py`→decide, HUMAN_GATE_RESOLVED), resolução de ambiguidades (spec→PROJECT.md→padrão→§3.2 com DEC-AUTO-NNN-XX), tipos de gate humano §13.10 + rate limit, checklist antes de morrer. (2) `~/cc-mailbox/bin/cc-spawn-coord.sh` (~110 linhas bash) — wrapper §13.8 passo 8b: precondição dura `readlink -f pwd == $WORKTREE` abortando exit 2, localiza control file via glob, extrai `{{issue_title}}` da primeira linha, render via perl com escape-safe `\Q...\E`, invoca `claude --permission-mode auto --output-format json -p`, extrai `session_id` via `jq` (com fallback `grep`), valida formato UUID, imprime `COORD_SESSION_ID=<uuid>` parsable via cut. (3) `~/cc-mailbox/bin/cc-dispatch-task.sh` (~90 linhas bash) — wrapper §13.8 passos 8d/36: lê `.coord-id` + `.coord-dir` (INV-26 read-only), valida UUID, `flock -w 30 .cc-mailbox/locks/coord.lock` + `cd $COORD_DIR` + `claude --resume --permission-mode auto -p "DISPATCH_FIRST_TASK\|DISPATCH_TASK slug=...\|HUMAN_GATE_RESOLVED ref=..."`. Log estruturado em `.cc-mailbox/log/dispatch.log`. **Smoke integration 5/5 OK** em worktree sintético `issue-998` criado a partir do branch do #176: spawn retornou UUID `2fbe3f35-d77d-...`, start.sh com esse ID gravou `.coord-id`/`.coord-dir` READ-ONLY, kill tmux para isolar, dispatch FIRST invocou `--resume` sob flock, Coord acordou, leu control file (plano sintético pedindo `inbox/01-smoke.md` com `SMOKE_OK`), obedeceu literal, morreu. Arquivo `inbox/01-smoke.md` contém exatamente 9 bytes `SMOKE_OK` como esperado. **§13.11 atualizado** com 3 novas entradas IMPLEMENTADO e status do protocolo promovido para OPERACIONAL END-TO-END. Próxima sessão dispara "atacar #NNN em modo autônomo" e o protocolo trilha mecanicamente sem improviso do modelo no spawn/dispatch. **Fora do escopo, próximas sessões**: rodada end-to-end real (Fase D) com worker + validator + email real + recovery §13.15, `cc-notify-whatsapp.sh`. Sem chunk lock. Sem bump `src/version.js`. Worktree `~/projects/issue-176` removido. Issue doc arquivada em `docs/archive/`. |
| 0.34.0 | 23/04/2026 | Abertura #176 scripts de orquestração §13 | Fecha gaps do §13.8 passos 8b (spawn da Coord) e 8d (dispatch da primeira task) identificados no review pós-#169. Escopo: (1) `~/cc-mailbox/templates/coord-briefing.md` (template canônico com placeholders — identidade da Coord, ciclo de vida "sempre morrer", TASK_DELIVERED flow result.log→report.md→validator→decide, tratamento de STOP + email, resolução de ambiguidades spec→PROJECT.md→padrão→§3.2, tipos §13.10); (2) `cc-spawn-coord.sh` (wrapper do passo 8b com precondição cwd=worktree, render do template, `claude --output-format json -p`, captura de `session_id`); (3) `cc-dispatch-task.sh` (wrapper do passo 8d com `flock` + `--resume` da Coord). Smoke test em worktree sintético. Objetivo: próxima sessão dispara "atacar #NNN em modo autônomo" e o protocolo trilha sem improviso do modelo. **Fora do escopo**: rodada end-to-end real (Fase D separada), re-teste Recovery §13.15, `cc-notify-whatsapp.sh`. Sem chunk lock. Sem bump `src/version.js`. Branch `arch/issue-176-scripts-orquestracao-protocolo`. |
| 0.33.0 | 23/04/2026 | Encerramento #174 v1.42.1 | PR #175 mergeado (merge commit `d871fad2`). Wire definitivo de `setupsMeta` em `MentorDashboard`: util puro novo `src/utils/setupsFilter.js` com `filterSetupsForStudent(setups, studentId)` — retorna globais + pessoais do aluno indicado, isolamento estrito (setup de aluno X nunca vaza para Y), fallback `studentId` null → só globais (posição neutra). `MentorDashboard.jsx` importa `useSetups`, memoiza `filterSetupsForStudent(allSetups, selectedStudent?.studentId)` em `selectedStudentSetups`, passa ao `<SetupAnalysis setupsMeta={selectedStudentSetups}>`. Aderência RR (linha condicional do card) renderiza corretamente na visão do mentor quando aluno tem setups com `targetRR` cadastrado. 10 testes unitários do filtro (defensivo null/undefined/não-array + studentId vazio + isolamento estrito + preservação de targetRR + pureza). 1880 → 1890 testes (+10). Zero regressão. Commit chain: `2547a980` (control file) → `89c842ef` (fix + testes). **Memória operacional adicionada** (`feedback_spec_scope_respeito.md`): cortes de escopo declarados em spec NUNCA sem discutir com Marcio — "decidir sozinho" só vale para decisões cosméticas. Lock CHUNK-16 liberado (AVAILABLE). Issue doc movida para `docs/archive/`. Worktree `~/projects/issue-174` removido. |
| 0.32.0 | 23/04/2026 | Abertura #174 — fix MentorDashboard setupsMeta (E4 de #170) | Lock CHUNK-16 (escrita). v1.42.1 reservada como patch. Detectado no review pós-merge do #170 pelo Marcio: a spec de E4 dizia "Consumido em StudentDashboard e **MentorDashboard** (ambos já importam)" — CC passou wire só no StudentDashboard e rotulou MentorDashboard como "fast-follow" sem discutir. Violação registrada em memória operacional (`feedback_spec_scope_respeito.md`). Escopo mínimo: importar `useSetups` no MentorDashboard + filtrar por `s.isGlobal \|\| s.studentId === selectedStudent?.uid` (memoizado) + passar ao `<SetupAnalysis>`. ~15 linhas de código + teste garantindo que setup de outro aluno não aparece. Branch `fix/issue-174-mentor-setups-meta`. |
| 0.31.0 | 23/04/2026 | Encerramento #170 v1.42.0 SetupAnalysis V2 | PR #173 mergeado (merge commit `15a6dca3`). Substitui `SetupAnalysis.jsx` (barra proporcional + WR) por card de diagnóstico operacional com 4 KPIs em grid 2×2 (Financial EV por trade · Financial Payoff · Operational ΔT W vs L com semáforo ±20%/±10% + tempos brutos · Impact Contribuição ao EV total). **Aderência RR** sub-linha condicional — renderiza apenas quando `setups.targetRR` existe (banda [target×0.8, target×1.2]). **Sparkline 6m** (PL acumulado mensal) reusando padrão visual da Matriz 4D. **Insight 1-linha** priorizando ofensor com contribEV<-20% → best performer payoff≥1.5 → aderência RR<50% → fallback positivo. **Ordenação** por \|contribEV\| desc; setups com `n<3` em accordion "Esporádicos (N)" colapsado por default (expandido quando nenhum setup atinge n≥3). Util puro novo `src/utils/setupAnalysisV2.js` (245 linhas, zero campo Firestore novo). API externa preservada (prop `trades`) + prop opcional `setupsMeta`. Consumido em `StudentDashboard` via `useSetups` (1-linha). **MentorDashboard não alterado** — setups globais/pessoais mistos sem filtro por `selectedStudent.uid`; aderência RR omitida (condicional). Wire mentor-side → fast-follow ou issue dedicada. **Fast-fix pré-merge** (commit `0bffe1f1`): card overflow corrigido via header em 2 linhas (nome+badge, depois PL+WR), `truncate min-w-0` no nome com `title` tooltip, `shrink-0` + `whitespace-nowrap` no badge/ícones, sublabels encurtados (EV por trade→por trade; ΔT W vs L→W vs L; Contribuição ao EV→ao EV total), tempos brutos `Xm` em vez de `Xmin`, `overflow-hidden` no card container. 1880/1880 testes (+40: 23 util + 17 render) pós-rebase. **Histórico do branch**: squash merge do #172 incluiu a diff da abertura #170 (commit `3b69ea4b` local estava no histórico do branch arch/#169), resultado é que `version: 1.42.0` e lock CHUNK-02 entraram no main via #172 antes do merge do #173; rebase do branch pós-#172 droppou o commit duplicado (`git rebase --skip`). Lock CHUNK-02 liberado (AVAILABLE). Issue doc arquivada em `docs/archive/`. Worktree `~/projects/issue-170` removido. |
| 0.30.0 | 23/04/2026 | Encerramento #169 Fases A+B+C | PR #172 mergeado (squash `4afa033f`). Scripts entregues em `~/cc-mailbox/bin/`: `cc-notify-email.py` (280 linhas, email real testado vivo no iCloud do Marcio), `cc-validate-task.py` (233 linhas, 12/12 pytest em 0.92s, integration vs commit real do #170 OK e vs `deadbeef` STOP-HALLUCINATION) + test suite `test_cc_validate_task.py` (266 linhas, 12 testes). Refactor `scripts/cc-worktree-start.sh` 3-tier com pré-condição cwd=worktree (aborta exit 2), todos os 7 dirs §13.7 (antes só 3: inbox/outbox/processed; agora +coord-inbox, locks, notify-scratch, log), `.coord-id`/`.coord-dir`/`.interface-id` gravados e `chmod 444` (READ-ONLY, INV-26 + amendments v0.25.0/v0.26.0), listener usa `flock -w 30 locks/coord.lock` antes de `--resume` + log estruturado. Template `~/cc-mailbox/templates/worker-briefing.md` com cláusula CLAIMS obrigatória (§13.9 amendment v0.26.0). **Dry-run integration 5/5 OK** em worktree sintético `issue-999`: start.sh cria infra completa, validator aprova CLAIMS real, rejeita hash `deadbeef` com STOP-HALLUCINATION, rejeita skipped com `.js`, email em dry-run renderiza body completo com OPÇÕES + COMO RESPONDER. **Efeito colateral do squash merge**: diff das aberturas #169 + #170 (locais `3b69ea4b` e `315cecb9` no histórico do branch) entraram junto com o squash — resultado é `version: 1.42.0` reservada e lock CHUNK-02 para #170 já presentes no main consistentes com `#170 OPEN`. **Fora do escopo, próximas sessões**: Fase D (rodada real com issue-teste + bump §13.11), `cc-notify-whatsapp.sh` opcional, fast-follow `EMAIL_DRY_RUN=1` também grava per-worktree log, re-teste Recovery §13.15 pós-amendment. Issue doc movida para `docs/archive/`. Worktree `~/projects/issue-169` removido. Credencial SMTP reusada de `~/morning_call_auto/.env` (decisão operacional do Marcio). |

**Regra de uso:**
- Toda sessão que modificar este documento DEVE incrementar a versão e adicionar entrada na tabela acima
- Toda proposta de atualização DEVE declarar "baseado na versão X.Y.Z" para detecção de conflito
- Na abertura de sessão, comparar versão do repo com versão em mãos — se divergir, o arquivo está stale e deve ser relido

---

## COMO USAR ESTE DOCUMENTO

Este é o único documento de referência permanente do projeto. Todos os outros documentos de diretrizes, arquitetura e processo foram consolidados aqui.

**O que vive aqui:**
- Stack, infraestrutura e convenções
- Invariantes arquiteturais (regras invioláveis)
- Protocolo de sessão de desenvolvimento (gate pré-código, pré-entrega, encerramento)
- Protocolo de sessões paralelas (chunks, locks, shared files)
- Decision log (DEC-xxx)
- Dívidas técnicas ativas (DT-xxx)
- Anti-patterns documentados (AP-xxx)
- Changelog de versões
- Ferramentas do ambiente de desenvolvimento

**O que NÃO vive aqui:**
- Especificação de features → `docs/dev/issues/issue-NNN-nome.md`
- Documentação operacional (deploy, install, migration) → `docs/ops/`
- Arquivos históricos de sessões encerradas → `docs/archive/`

### Como atualizar este documento

Toda sessão de desenvolvimento que produzir uma decisão arquitetural, nova invariante, novo anti-pattern, ou mudança de versão **deve** atualizar as seções relevantes antes de encerrar. O formato de rastreabilidade é obrigatório:

```
| DEC-028 | Descrição da decisão | issue-NNN | 26/03/2026 14:30 |
```

Cada entrada deve conter: ID sequencial, descrição, issue de origem, data e hora. Isso garante que em caso de perda de contexto, seja possível reconstruir o histórico.

**Nunca** remover entradas antigas — apenas marcar como `SUPERSEDED` se uma decisão posterior a invalida.

---

## 1. STACK & INFRAESTRUTURA

| Camada | Tecnologia | Notas |
|--------|-----------|-------|
| Frontend | React 18 + Vite | SPA, glassmorphism dark theme |
| Styling | Tailwind CSS | Utility-first |
| Backend | Firebase (Firestore, Cloud Functions, Auth, Storage) | Serverless |
| Deploy | Vercel | Frontend only; Cloud Functions via Firebase CLI |
| Testes | Vitest + jsdom | Cobertura obrigatória em business logic |
| Versionamento | Git + GitHub | Issues numeradas, branches `feature/issue-NNN-descricao` |

### Ferramentas do ambiente de desenvolvimento

| Ferramenta | Versão | Uso |
|-----------|--------|-----|
| Node.js | 22.x (migrado de 20 — DT-016 resolvido v1.22.0) | Runtime local + Cloud Functions |
| Firebase CLI | latest | Deploy de CFs e Firestore rules |
| GitHub CLI (`gh`) | 2.86.0 | Gestão de issues, PRs e milestones via script |
| bash | Linux | Shell padrão — commits em linha única obrigatório |
| Obsidian | latest | Leitura e edição de `.md` — abrir repo como vault |
| Vite | 4.x | Dev server + build |

**Convenções bash — obrigatórias:**

1. **Commit messages** — sempre em linha única (`git commit -m "mensagem"`)
2. **ZIPs** — `unzip -o <arquivo>.zip` na raiz do projeto (substitui `Expand-Archive`)
3. **Scripts** — ASCII-only em strings passadas ao `gh` CLI (acentos podem causar encoding issues)

**GitHub CLI — comandos frequentes:**
```bash
gh issue list --state open          # listar issues abertos
gh issue create --title "..." --body "..." --label "type:feat"
gh issue edit NNN --title "..." --add-label "milestone:v1.1.0"
gh issue close NNN
gh pr create --title "..." --body "..."
```

---

## 2. MILESTONES E ROADMAP

### v1.1.0 — Espelho Self-Service
**Foco:** Dois tiers (self-service + Alpha), rename externo, Node.js migration, stability fixes
**Prioridade:** CRÍTICA — migração do grupo ativo (48 alunos) em andamento
**GitHub Milestone:** `v1.1.0 - Espelho Self-Service` (12 issues)

Issues:
- `#118` arch: Barra de Contexto Unificado — Conta/Plano/Ciclo/Período persistente
- `#116` epic: Onboarding Automatizado — CSV → indicadores → Kelly → plano sugerido
- `#114` feat: Breakeven threshold configurável no compliance
- `#111` debt: Padronização de exibição de moeda em todo o sistema
- `#107` fix: CSV Import — parse silencioso quando formato não reconhecido
- `#100` epic: Espelho — Modo Self-Service (tier self-service + rename externo)
- `#93`  feat: Order Import v1.1 — Modo Criação
- `#91`  debt: Mentor editar feedback já enviado
- `#90`  fix: Screen flicker CSV staging activation
- `#64`  refactor: Dashboard Aluno — Refatorar tabela SWOT
- `#52`  epic: Gestão de Contas em Mesas Proprietárias (Prop Firms)
- `#48`  refactor: Student Emotional Detail — Reorganizar UX
- `#3`   epic: Dashboard-Aluno MVP — Redesign com contexto unificado e views reativas

Sub-tarefas (#100):
- C1: Campo `mentorshipTier` no student
- C2: UI condicional — esconder funcionalidades Alpha para self-service
- C3: Dashboard self-service — ajustes de layout
- C4: Rename externo — Espelho (title, logo, textos UI)
- C5: Custom domain — app.marcioportes.com.br

### v1.2.0 — Mentor Cockpit
**Foco:** Dashboard mentor consolidado (Torre de Controle) + revisão semanal + performance
**GitHub Milestone:** `v1.2.0 - Mentor Cockpit` (16 issues)

Épico guarda-chuva: `#101` epic: Dashboard Mentor — Torre de Controle

Issues:
- `#119` feat: Maturidade — barra de evolução por gate com progressão baseada em trades
- `#115` feat: Desvio padrão dos resultados como métrica de consistência operacional
- `#113` feat: Overtrading — detecção por clustering temporal (substituir maxTradesPerDay)
- `#112` epic: Módulo Swing Trade — Gestão de Carteira e Indicadores de Portfolio
- `#110` feat: Curva de Patrimônio — agrupamento por moeda, benchmark, guard multi-ciclo
- `#109` feat: FeedbackPage — rascunho de revisão semanal por trade
- `#108` feat: FeedbackPage — mentor override de emoção declarada pelo aluno
- `#106` feat: PlanLedgerExtract — rename, acumulado do período e resumo de trades
- `#103` feat: Performance — visão analítica retrospectiva (SWOT IA, Stop por Motivo)
- `#102` feat: Revisão Semanal — modo revisão do PlanLedgerExtract

#### #102 — Revisão Semanal: Design consolidado (02/04/2026)

**Princípio arquitetural:** a Revisão Semanal é um **modo do PlanLedgerExtract**, não uma tela separada. O extrato do plano é a fundação — os subitens são camadas ativadas em contexto de revisão.

**Evento de criação:** botão "Criar Revisão" dispara CF `createWeeklyReview` que:
1. Congela snapshot dos KPIs (WR, RR, Payoff, EV, compliance, drawdown)
2. Calcula ranking top 3 piores/melhores trades
3. Gera SWOT do aluno via chamada IA (custo controlado pelo trigger explícito)
4. Persiste tudo em `students/{id}/reviews/{reviewId}` com status `open`

**Subitens (pós-criação, preenchidos pelo mentor no frontend):**
1. Seleção de Trades — default: trades da semana. Período ajustável.
2. Comparação de Indicadores — snapshot congelado da revisão anterior vs snapshot atual (DEC-045).
3. SWOT do Aluno — gerado pela CF no momento da criação da revisão.
4. Notas de Sessões — últimas sessões fechadas + sessão aberta em andamento.
5. Takeaways — itens de ação com checkbox (completo / aberto).
6. Ranking de Trades — top 3 piores + top 3 melhores (congelados no snapshot).

**Camadas adicionais:**
7. Evolução de Maturidade — perfil 4D atual vs marco zero. Progressão/regressão via trades.
8. Navegação contextual — acesso direto à conta e plano do aluno sem sair da revisão.

**Modelo de dados (Firestore):**
```
students/{studentId}/reviews/{reviewId}
  createdAt, planId, cycleNumber, period: { start, end }
  snapshot: { wr, rr, payoff, ev, compliance, drawdown, ... }
  topTrades: { worst: [3], best: [3] }
  swot: { strengths, weaknesses, opportunities, threats }
  meetingNotes, zoomLink, zoomSummary
  takeaways: [{ text, completed: bool }]
  status: open | closed
```

**DEC-045:** Snapshots de revisão semanal são independentes do fechamento de ciclo (#72). Revisão congela indicadores parciais para comparação longitudinal semana a semana. Ciclo congela o consolidado final. Sem dependência entre eles.

- `#94`  feat: Controle de Assinaturas da Mentoria → **FECHADO** (v1.23.0)
- `#72`  epic: Fechamento de Ciclo — Apuração, Transição e Realocação
- `#70`  feat: Dashboard Mentor — Template na inclusão de Ticker
- `#45`  refactor: Dashboard Mentor — Aba "Precisam de Atenção" → **FECHADO** (absorvido pelo Ranking por Aluno, Torre de Controle)
- `#31`  feat: Dashboard Mentor — Preset de Feedback Semântico

`#1` refactor: Configurações — Upload Seed → **FECHADO** (não relevante, DEC-041)

#### Torre de Controle — Design (DEC-042, 29/03/2026)

**Header KPIs (4 cards):**
- Revisões Pendentes (trades com feedback pendente + revisados sem fechar)
- Alertas (com direção ▲▼ vs ontem)
- Fora do Plano (compliance < 80% no ciclo)
- Pendências Operacionais (staging, inativos 7d+, assessment pendente)

**Seções:**
- Ranking por Aluno: top-5 piores do dia com badges de causa (VIOLAÇÃO purple-flag, TILT/REVENGE/SEM STOP red, PÓS-META yellow)
- Ranking por Causa: causas agregadas + contagem alunos + diagnóstico coletivo no rodapé (60%+ mesma causa = alerta de mercado)
- Fora do Plano: compliance ciclo + pior regra violada (NO_STOP/RISK_EXCEEDED/RR_BELOW_MINIMUM) + evolução meta + dias em dívida
- Stop vs Gain: barras semanais agregadas da turma + badge liquidez
- Visão Rápida por Aluno: painel lateral com KPIs + flags ativas + eventos ciclo

**Sidebar Mentor:**
- Torre de Controle (operacional, diário)
- Performance (analítico, retrospectivo — #103)
- Fila de Revisão (individual — #102)
- Alunos / Assinaturas / Configurações

**Flags disponíveis para a torre (Fase A — dados existentes):**
- Compliance: NO_STOP, RISK_EXCEEDED, RR_BELOW_MINIMUM (`compliance.js`)
- Comportamental: TILT_DETECTED, REVENGE_DETECTED (`emotionalAnalysisV2.js`)
- Plano/Ciclo: META, PÓS-META, STOP, PÓS-STOP/VIOLAÇÃO (`planLedger.js`)
- Não implementadas: NO_PLAN, DAILY_LOSS_EXCEEDED, BLOCKED_EMOTION

**Fases:**
- Fase A: dados existentes (compliance, planLedger, emotionalAnalysisV2)
- Fase B: Behavioral Detection Engine (Prioridade do Dia com recomendações, futuro)

### Portal marcioportes.com.br (Maio-Junho 2026)
**Foco:** Landing page institucional + Fibonaccing + Diagnóstico Comportamental
**Documento de referência:** `docs/marcioportes_portal_v2_0.md`

Fases:
- Fase 1: Landing page MVP (Next.js, Vercel, domínio principal)
- Fase 2: Seção Fibonaccing (curadoria 100h+ conteúdo existente)
- Fase 3: Diagnóstico Comportamental público (lead magnet com IA)

---

## 3. INVARIANTES ARQUITETURAIS

> Invariantes são regras que **NUNCA** devem ser violadas. Qualquer proposta que quebre uma invariante deve ser redesenhada antes de ser implementada.

### INV-01: Airlock de Dados Externos
Dados externos (CSV, API, migração, bulk import) **NUNCA** escrevem diretamente em collections de produção. Sempre usar staging collection separada + ingestão via métodos validados (`addTrade`, `updatePlan`, etc.).

### INV-02: Gateway Único para `trades`
Toda escrita na collection `trades` **DEVE** passar por `addTrade` (ou equivalente explicitamente validado e aprovado).

### INV-03: Integridade do Pipeline de Side-Effects
O pipeline `trades → Cloud Functions → (PL, compliance, emotional scoring, mentor alerts)` é uma cadeia inquebrável. Qualquer mudança em um elo exige análise de impacto em todos os elos downstream.

### INV-04: DebugBadge Universal
Todo componente de UI (tela, modal, card) deve exibir `DebugBadge` com `version + build + git commit hash`. Componentes embedded recebem `{!embedded && <DebugBadge component="NomeExato" />}`. **`component` prop é obrigatória** — sem ela o campo fica vazio.

### INV-05: Testes como Pré-Requisito
Toda alteração de business logic exige: análise de impacto documentada + testes incrementais de regressão + bug fixes reproduzidos em teste antes do fix.

### INV-06: Formato de Datas BR
Todas as datas usam formato brasileiro (DD/MM/YYYY). Parsing prioriza formato BR. Semana começa na segunda-feira.

### INV-07: Autorização Antes de Codificar
Antes de codificar qualquer feature ou mudança arquitetural — especialmente Firestore, campos de status, ou Cloud Functions — a proposta deve ser apresentada e aprovada explicitamente.

### INV-08: CHANGELOG Obrigatório
Toda versão (major, minor, patch) deve ter entrada no CHANGELOG (seção 10 deste documento) antes do merge.

### INV-09: Gate Obrigatório Pré-Código e Pré-Entrega

**Pré-código:**
1. Análise de impacto formal (collections, CFs, hooks, side-effects, dados parciais)
2. Proposta apresentada → AGUARDAR aprovação explícita
3. Codificar somente após aprovação

**Pré-entrega (antes de cada ZIP):**
4. `version.js` atualizado
5. CHANGELOG atualizado (seção 10 deste documento)
6. Testes criados para toda lógica nova
7. DebugBadge em todos os componentes novos/tocados com `component="NomeExato"`
8. ZIP com `Expand-Archive` + instruções git
9. PARAR e aguardar confirmação

**Claude deve listar explicitamente cada item com ✅/❌ antes de gerar o ZIP.**

### INV-10: Verificar Estrutura Firestore Antes de Criar/Modificar
Antes de criar qualquer collection, subcollection, campo ou estrutura nova: `grep` pelo nome do campo nos hooks, CF e componentes. Nunca criar estrutura nova sem aprovação explícita.

### INV-11: Nunca Priorizar Velocidade sobre Rigor
Se houver conflito entre entregar rápido e seguir as invariantes, as invariantes vencem. Sempre.

### INV-12: Parciais São Campo no Documento — NÃO Subcollection
`_partials` é um campo array dentro do documento `trades/{id}`. Não existe subcollection `trades/{id}/partials`. Todo trade tem parciais (mínimo 1 ENTRY + 1 EXIT).

### INV-13: Rastreabilidade Obrigatória por Issue
Toda modificação de código exige: (1) issue aberto no GitHub, (2) arquivo de controle `docs/dev/issues/issue-NNN-descricao.md` criado a partir do template (seção 4.0), (3) branch nomeada `tipo/issue-NNN-descricao`. Sem esses três artefatos, o Gate Pré-Código não pode ser iniciado. O arquivo de issue é o documento de continuidade — se a sessão for interrompida, qualquer sessão subsequente deve conseguir retomar o trabalho exclusivamente a partir dele + PROJECT.md + código.

### INV-14: Versionamento do PROJECT.md
Toda modificação deste documento DEVE: (1) incrementar a versão no header (semver: major.minor.patch), (2) adicionar entrada na tabela de histórico de versões, (3) declarar "baseado na versão X.Y.Z" na proposta. Na abertura de sessão, a versão do repo deve ser comparada com a versão em contexto — divergência indica arquivo stale que deve ser relido antes de qualquer ação.

### INV-15: Aprovação Obrigatória para Persistência
Toda criação de collection, subcollection, ou campo novo no Firestore exige: (1) justificativa escrita com análise de dependência conceitual (a entidade existe sozinha ou depende de outra?), (2) parecer técnico com prós/contras das opções de modelagem (collection raiz vs subcollection vs field inline), (3) aprovação explícita do Marcio antes de implementar. Nenhuma estrutura de dados é criada sem passar por este gate.

### INV-16: Isolamento via Worktree — OBRIGATÓRIO SEMPRE
**Toda sessão de código opera dentro de um git worktree dedicado. Sem exceção — paralela ou não.** Editar código na working tree principal (`~/projects/acompanhamento-2.0`) é **PROIBIDO**. O repo principal é trunk exclusivo: recebe merges, nunca edições diretas.

**Padrão único e inequívoco de nome:** `~/projects/issue-{NNN}`
(nomes antigos como `acomp-{NNN}` estão **descontinuados**)

**Comando de criação (passo §4.0 obrigatório):**
```
git worktree add ~/projects/issue-{NNN} -b tipo/issue-NNN-descricao
```

**Comando de remoção (passo §4.3 obrigatório após merge — duas etapas):**
```
git worktree remove ~/projects/issue-{NNN}    # desregistra do git
rm -rf ~/projects/issue-{NNN}                 # remove diretório físico residual
```

**Gate de verificação antes de qualquer edição de código:** se `pwd` não retorna `~/projects/issue-{NNN}`, PARE — o worktree não foi criado ou você está no diretório errado. Crie/entre no worktree antes de prosseguir. A criação do worktree **não pode ser omitida nem adiada** sob nenhuma justificativa.

### INV-17: Gate de Arquitetura de Informação
Antes de propor qualquer componente de UI novo ou modificação de tela existente, a sessão DEVE declarar:

1. **Nível:** sidebar / tab / card / modal
2. **Domínio:** Dashboard / Operação / Mesa Prop / Feedback / Análise / Contas / Revisão / Config
3. **Duplicação:** se o mesmo dado já aparece em outra tela, justificar ou consolidar
4. **Budget:** se a tela destino já tem 6+ seções visíveis, remover ou colapsar algo antes de adicionar

**Mapa de domínios (slots fixos):**

| Domínio | Sidebar | O que mora | O que NÃO mora |
|---------|---------|-----------|---------------|
| Dashboard | Sim | KPIs resumo, equity curve, calendário, SWOT | Detalhes prop, payout, AI plan |
| Operação (Diário) | Sim | Registro e histórico de trades | Análises agregadas |
| Mesa Prop | Sim (condicional) | Gauges DD, alertas, payout, AI plan, sparkline | KPIs genéricos |
| Feedback | Sim | Chat mentor-aluno por trade | Shadow (mora no detalhe do trade) |
| Análise | Futuro | Dashboard emocional, evolução temporal | Registro de trades |
| Contas | Sim | CRUD contas e planos | Dados operacionais |
| Revisão | Futuro | Revisão semanal, histórico de revisões | Tudo que não é revisão |
| Config | Sim | Settings mentor, templates, compliance | Dados de aluno |

Toda feature nova declara domínio + nível. "Seção colapsável no componente X" é sinal de puxadinho — a pergunta correta é "qual tela existente deveria mostrar isso, ou precisa de tela nova?"

> Origem: auditoria de arquitetura de informação 15/04/2026 — 3 sessões paralelas mapearam telas, duplicações e puxadinhos.

### INV-18: Spec Review Gate — Validação de Entendimento Obrigatória
Nenhuma feature, Cloud Function ou modificação de UI é implementada sem validação explícita de entendimento entre o CC e Marcio. O gate NÃO é "entendi, posso codar?" — é "mostra o que você entendeu e eu confirmo".

**Protocolo obrigatório:**
1. Marcio descreve a ideia (verbal, texto, screenshot)
2. CC escreve spec/mockup e APRESENTA de volta ao Marcio
3. Marcio confronta: "é isso que eu quis dizer?" — aponta divergências
4. CC corrige até alinhar — ciclo 2-3 repete quantas vezes necessário
5. Só após confirmação explícita ("aprovado", "go", "sim") o CC codifica

**Formato da validação por tipo:**
- **UI:** mockup visual (descrição de tela com campos, layout, fluxo de navegação, onde cada dado aparece)
- **Backend / CF:** schema JSON com exemplo concreto de input E output
- **Lógica de negócio:** cenário de teste em linguagem natural ("se o aluno tem 3 trades no período com WR 66%, o acumulado do período mostra R$ 150 e o do ciclo mostra R$ 2.300")
- **Dados / Firestore:** documento de exemplo com todos os campos, tipos e valores realistas

**Anti-pattern:** CC diz "entendi" e sai codificando sem mostrar o que entendeu. Isso é VIOLAÇÃO da INV-18 — mesmo que o código resultante esteja tecnicamente correto, se não passou pelo gate de validação, deve ser revertido.

> Origem: sessão de voz 15/04/2026 — diagnóstico do gap entre descrição verbal e interpretação do modelo como causa raiz de retrabalho sistemático.

### INV-25: Outbox Antes de Resume — Padrão Coord/Worker
No modelo de orquestração coord/worker, todo output de worker é persistido em arquivo no outbox (`.cc-mailbox/outbox/`) **antes** de o coord ser invocado via `claude --resume`. O coord nunca depende de memória de processo do worker — lê sempre do outbox.

**Por que:** `claude --resume` opera com semântica at-least-once. Se o `--resume` falhar por qualquer motivo (diretório errado, rede, processo morto), o output continua acessível em disco e pode ser lido manualmente ou reprocessado. Violação — coord assumir que "sabe" o output sem reler o outbox — reintroduz exatamente as fragilidades que o padrão elimina.

**Verificação:** antes de despachar a próxima task, o coord confirma que `outbox/<task>-result.log` existe e tem conteúdo.

> Origem: lição aprendida #165 — `--resume` falhou silenciosamente por cwd incorreto; output estava no outbox e permitiu recovery manual.

### INV-26: `.coord-id` É Responsabilidade do Start Script — Coord Nunca Sobrescreve
O arquivo `.cc-mailbox/.coord-id` é gravado pelo `cc-worktree-start.sh` no momento em que o tmux listener é criado (session ID do coord passado como 3º argumento ao script). **O coord nunca escreve nesse arquivo.** O valor correto já está lá desde a criação do worktree. Sobrescrever destrói o session ID real e quebra o loop de notificação inversa.

**Regra:** o coord só grava `.cc-mailbox/.coord-dir` (caminho do worktree), e apenas se o script não o tiver criado. `.coord-id` é somente leitura para o coord.

**Amendment (v0.25.0):** `.coord-id` é READ-ONLY para **todos os atores**, incluindo CC-Coord, CC-Interface (modo autônomo — §13), e listener tmux. Somente `cc-worktree-start.sh` pode escrever, e apenas uma vez, no momento da criação do tmux.

**Amendment (v0.26.0):** a única exceção ao READ-ONLY é o **Protocolo de Recovery de CC-Interface (§13.15)**. Quando CC-Interface morre e nova sessão assume, ela pode (e deve) atualizar `.coord-id` com seu próprio session_id e `.coord-dir` com o worktree path. Fora dessa exceção e da escrita única pelo start script, qualquer ator que escreva nesses arquivos comete anti-pattern de alteração de estrutura sem aprovação. `.coord-dir` passa a ter a mesma disciplina READ-ONLY de `.coord-id` — divergência entre `.coord-dir` e worktree real causa falha silenciosa do `--resume` do listener (observado na rodada #164).

**Anti-pattern:** coord (ou qualquer outro ator) inventar ou derivar um session ID (ex: `coord-issue-NNN-taskNN`) quando `$CLAUDE_SESSION_ID` retorna vazio. O ID real foi gravado pelo start script — não tocá-lo é suficiente.

> Origem: lição aprendida #166 — coord sobrescreveu `.coord-id` com valor inventado, destruindo session ID real que já estava gravado pelo start script.

### INV-27: Validação Externa de Claims — Cegueira Epistêmica

Dados inventados em processo real (commits, contagem de testes, arquivos tocados) são falha crítica. Modelos de linguagem podem **não detectar a própria alucinação** — cegueira epistêmica no caso "não sei que não sei"; auto-declaração "não aluciei" é estatisticamente correlacionada com honestidade mas não é garantia determinística, e sob pressão o sycophancy bias pode vencer.

**Consequência:** toda claim verificável emitida por worker, coord, ou pelo próprio CC em modo interativo após delegação sem supervisão humana ativa DEVE ser externamente validada. Auto-declaração não é suficiente.

**Mecanismos obrigatórios (modo autônomo — §13):**
- Worker grava bloco `CLAIMS` estruturado em todo `<N>-report.md` do outbox (commit_hash, tests{passed,failed,cmd}, files_touched)
- Coord roda `cc-validate-task.py` em todo `TASK_DELIVERED`, antes de despachar próxima task
- Validator executa 3 checks baratos (<300ms total): commit_exists (`git cat-file -e`), tests_match (contagem declarada = `result.log`), files_match (`git show --name-only` ⊆ `files_touched`)
- Qualquer check em falha → STOP-HALLUCINATION + email humano
- `tests: skipped` permitido APENAS se `files_touched` contém somente `.md` ou `docs/`; caso contrário STOP

**Mecanismo em modo interativo:** quando CC delega/executa tasks sem supervisão (ex: "vai implementando isso"), o CC DEVE rodar `cc-validate-task.py` contra o próprio commit antes de relatar "pronto". Se fail → para e sinaliza.

> Origem: sessão de design 21/04/2026 (bugs 1-10 do protocolo autônomo). Reframe da versão inicial após discussão sobre cegueira epistêmica: o problema não é modelo desonesto, é modelo que literalmente não consegue detectar a própria invenção. Solução é verificação externa, não confiança.

### INV-28: Email iCloud É Canal Primário de Gate Humano

Notificação humana (STOP-XXX do coord autônomo para Marcio) usa **email iCloud SMTP** como canal primário, sempre. Outros canais (WhatsApp via Evolution API, push notifications) são estritamente opcionais.

**Regras:**
- Helper único: `~/cc-mailbox/bin/cc-notify-email.py` (global, reutilizado por todas as issues)
- Interface via JSON stdin com campos tipados (`type`, `issue`, `task`, `summary`, `detail`, `options`, `recommendation`)
- Rate limit por `(issue, type)`: silencia se mesmo par enviado <4h atrás
- Sem re-envio automático — um gate, um email. Se Marcio quer status, RC em CC-Interface e pergunta
- Canais opcionais (WhatsApp) usam try/except com exit silent em falha — nunca bloqueiam o loop
- SMTP iCloud via `EMAIL_PASSWORD` em `~/cc-mailbox/.env` (separado de outros .env do repositório)
- Log global em `~/cc-mailbox/log/emails.log` + per-issue em `.cc-mailbox/log/emails-<data>.log`

**Subject scaneável:** `[Espelho #<NNN>] <STOP_TYPE>: <título 5-8 palavras>`

**Tipos de gate:** `TEST_FAIL`, `DESTRUCTIVE`, `CONFLICT`, `INVARIANT`, `HALLUCINATION`, `HUMAN_GATE`, `FINISHED`.

**Body — COMO RESPONDER (linguagem natural, sem código Morse):** Marcio abre Claude Code mobile, RC na sessão tmux `cc-NNN`, fala em linguagem natural ("vai com a A", "explica esse erro", "aborta"). CC-Interface entende contexto e relaya.

> Origem: sessão de design 21/04/2026 — validação por dry-run (4 emails enviados, SMTP funcional, subject chega legível no iPhone). PushNotification inviável em `claude -p` headless (testado, sempre "user active" suppressed). WhatsApp depende de Docker/Evolution API rodando, logo não pode ser canal primário.

---

## 4. PROTOCOLO DE SESSÃO

### 4.0 Abertura de Sessão (obrigatório, antes de tudo — starta automaticamente em sessões de codificação)

```
□ Ler PROJECT.md do repo (main) — verificar versão no header (INV-14)
   → Se versão diverge do que a sessão tem em contexto: PARAR, reler o arquivo fresh
□ Ler o issue no GitHub (gh issue view NNN)
□ Identificar campo "Chunks necessários" no body do issue
□ Consultar Registry de Chunks (seção 6.3) — verificar que TODOS estão AVAILABLE
   → Se algum chunk está LOCKED: PARAR. Notificar Marcio com "CHUNK-XX locked por issue-YYY"
   → Se chunk não existe no registry: PARAR. Propor novo chunk ao Marcio
□ AINDA NO MAIN: registrar locks na tabela §6.3 (chunk + issue + branch + data)
□ AINDA NO MAIN: ler `src/version.js` e reservar o próximo minor disponível (ex: v1.30.0 → reservar v1.31.0)
□ AINDA NO MAIN: commit único — "docs: registrar locks CHUNK-XX + reservar vX.Y.Z para issue-NNN"
□ Criar worktree: git worktree add ~/projects/issue-{NNN} -b tipo/issue-NNN-descricao (INV-16)
   (worktree nasce com locks e versão já commitados — zero conflito no merge)
□ **Entrar no worktree antes de prosseguir:** `cd ~/projects/issue-{NNN}`
   → Se usar modelo coord/worker (mailbox + `--resume`): a sessão coord DEVE ser aberta de dentro
     do worktree. O JSONL fica ancorado ao diretório de invocação. Coord aberto no main → listener
     no worktree não encontra a sessão ao chamar `--resume` ("No conversation found").
□ Criar arquivo docs/dev/issues/issue-NNN-descricao.md DENTRO do worktree a partir do template abaixo
□ Confirmar pwd = ~/projects/issue-{NNN}
□ Preencher seções 1 (Contexto), 2 (Acceptance Criteria), 3 (Análise de Impacto) e 6 (Chunks)
□ Só então iniciar Gate Pré-Código (seção 4.1)
```

**Regra:** sem issue no GitHub + chunks verificados + arquivo de controle em `docs/dev/issues/`, nenhuma linha de código é escrita. Se a sessão for perdida, outra sessão reconstrói o contexto completo a partir do arquivo de issue.

**Regra de chunks:** o campo "Chunks necessários" no issue do GitHub é OBRIGATÓRIO para issues de código. A sessão NÃO infere chunks — lê do issue. Se o campo estiver ausente, a sessão preenche antes de prosseguir (grep no código + análise de impacto → propõe chunks → aguarda aprovação).

**Regra de shared files:** locks e edições em shared files (PROJECT.md §6.3, etc.) são feitos e commitados no main ANTES da criação do worktree. Dentro do worktree, shared files nunca são editados diretamente — apenas deltas propostos no arquivo de controle do issue. O integrador aplica os deltas no merge.

> **Diretiva operacional para Claude Code — autorização permanente de leitura:**
> Operações de leitura completa NÃO requerem confirmação: `grep`, `cat`, `ls`, `find`, `view`,
> `gh issue view`, `git log/status/diff`, `npm test`, `npm run build`, `head`, `tail`, `wc`,
> `du`, `df`, `ps`, `free`.
>
> Parar para confirmar APENAS em operações destrutivas ou que afetem estado compartilhado:
> `commit`, `push`, `deploy`, `delete`, `rm -rf`, `git reset`, `firebase deploy`.

#### Template: `docs/dev/issues/issue-NNN-descricao.md`

```markdown
# Issue NNN — tipo: Título descritivo
> **Branch:** `tipo/issue-NNN-descricao`  
> **Milestone:** vX.Y.Z — Nome do Milestone  
> **Aberto em:** DD/MM/YYYY  
> **Status:** 🔵 Em andamento | ✅ Encerrado  
> **Versão entregue:** —

---

## 1. CONTEXTO

Descrição do problema ou feature. Por que existe. Qual o impacto.

## 2. ACCEPTANCE CRITERIA

- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | — |
| Cloud Functions afetadas | — |
| Hooks/listeners afetados | — |
| Side-effects (PL, compliance, emotional) | — |
| Blast radius | — |
| Rollback | — |

## 4. SESSÕES

### Sessão — DD/MM/YYYY

**O que foi feito:**
- Item 1
- Item 2

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| DEC-xxx | — | — |

**Arquivos tocados:**
- `path/to/file.js`

**Testes:**
- X testes novos, Y total passando

**Commits:** (listar como bloco de código)
- `hash mensagem`

**Pendências para próxima sessão:**
- Item 1

## 5. ENCERRAMENTO

**Status:** Aguardando PR | Mergeado | Cancelado

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] PROJECT.md atualizado (DEC, DT, CHANGELOG)
- [ ] PR aberto e mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
- [ ] Locks de chunks liberados no registry (seção 6.3)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-XX | leitura / escrita | Descrição do que será tocado |

> **Modo leitura:** a sessão consulta arquivos do chunk mas não os modifica. Não requer lock.
> **Modo escrita:** a sessão modifica arquivos do chunk. Requer lock obrigatório.
```

### 4.1 Gate Pré-Código (obrigatório, nesta ordem)

```
□ Leitura completa dos arquivos relevantes (grep + view + bash) — NUNCA inferir
□ Análise de impacto: collections, CFs, hooks, side-effects, dados parciais
□ Proposta apresentada ao Marcio → AGUARDAR aprovação explícita
□ Checklist de impacto (seção 5) executado mentalmente
□ INV-17 cumprida: nível + domínio + duplicação + budget declarados (se a proposta toca UI)
□ INV-18 cumprida: spec/mockup apresentada ao Marcio e aprovada explicitamente
   → Se UI: mockup visual validado
   → Se CF/backend: schema JSON com exemplo validado
   → Se lógica: cenário de teste em linguagem natural validado
   → Se Firestore: documento de exemplo com campos/tipos/valores validado
```

### 4.2 Gate Pré-Entrega (obrigatório, antes de cada entrega)

```
□ version.js aplicado com a versão reservada na abertura (Fase 3) + build date atualizado
□ CHANGELOG (seção 10) com entrada da versão reservada
□ Testes para toda lógica nova criados e passando
□ DebugBadge em todos os componentes novos/tocados com component="NomeExato"
□ npm run lint em arquivos tocados no branch — ZERO erros `no-undef`, `no-unused-vars`
  críticos e zero regressão em regras já ativas. Origem: #162 SEV1 — um `no-undef` não
  detectado (`assessmentStudentId`) quebrou produção. Custo do item: ~5s por arquivo
□ Rodar npm run dev e confirmar no browser que telas afetadas renderizam sem erros no
  console — validar CADA contexto de consumo da tela:
    (a) aluno logado abrindo a própria tela
    (b) mentor com viewAs apontando para aluno (se aplicável)
    (c) modo override / embedded (se aplicável)
  Origem: #162 — gap de validação do contexto (a) no #102 deixou o ReferenceError passar
  ao deploy. QA tracker de sessões com dashboard do aluno deve exigir este check explícito
□ Commit via Claude Code ou git direto (commits em linha única)
□ PARAR — aguardar confirmação do Marcio
```

> **Regra de versão (Fase 3 → Gate Pré-Entrega):** a versão é reservada no main no ato de abertura da sessão (lida de `src/version.js` + próximo minor), commitada junto com os locks. A próxima sessão lê o main, vê a versão reservada, e reserva o próximo. Conflito de versão eliminado na origem — no gate pré-entrega a versão já está decidida, só aplica no `version.js` + CHANGELOG. Se a sessão da frente mergear primeiro (raro), rebase resolve a versão; se a própria sessão descobrir que precisa bumpar major, renegocia com Marcio.

### 4.3 Protocolo de Encerramento de Sessão

Ao final de cada sessão, antes de encerrar:

1. **Atualizar `docs/dev/issues/issue-NNN-nome.md`** com:
   - Resumo do que foi feito
   - Decisões tomadas (formato DEC-xxx)
   - Arquivos tocados
   - Comandos git executados
   - Testes rodados
   - Pendências para próxima sessão

2. **Atualizar este PROJECT.md** com:
   - Novas entradas no Decision Log (seção 7)
   - Novas/resolvidas dívidas técnicas (seção 9)
   - Entrada no CHANGELOG (seção 10)

3. **Commit dos docs** junto com o código:
   ```bash
   git add docs/PROJECT.md docs/dev/issues/issue-NNN-nome.md
   git commit -m "docs: atualizar PROJECT.md e issue-NNN sessão DD/MM/YYYY"
   ```

4. **Liberar locks de chunks desta sessão** no registry (seção 6.3) — liberar APENAS os locks registrados por esta sessão/issue. Nunca tocar em locks de outras sessões.

5. **Remover worktree** após merge confirmado (duas etapas — ambas obrigatórias, nenhuma pode ser omitida):
   ```bash
   git worktree remove ~/projects/issue-{NNN}           # desregistra do git
   rm -rf ~/projects/issue-{NNN}                        # remove diretório físico residual (cache .vite, node_modules stale, etc.)
   ```
   `git worktree remove` pode deixar o diretório físico intacto. O `rm -rf` é **sempre necessário** — não é opcional. Verificação obrigatória após ambos os comandos:
   ```bash
   ls ~/projects/                                        # issue-{NNN} NÃO deve aparecer
   git worktree list                                     # apenas main deve aparecer
   ```
   Se `issue-{NNN}` ainda aparecer no `ls`, o `rm -rf` não foi executado — executar agora.

6. **Mover issue file para archive** após merge confirmado:
   `git mv docs/dev/issues/issue-NNN-nome.md docs/archive/`

### 4.4 Diretriz Crítica de Verificação

**Regra absoluta: toda afirmação verificável exige verificação prévia. Sem exceção.**

Aplica-se a QUALQUER conclusão sobre o estado do projeto, incluindo mas não limitado a:

- Fluxo de dados, origem de campos, estrutura de collections
- Estado de branches, PRs, merges, deploys
- Existência ou ausência de arquivos, funções, componentes, campos
- Interpretação de outputs de terminal (git, npm, firebase, logs)
- Interpretação de screenshots, erros, stack traces
- Estado de features (implementado, pendente, quebrado)
- Compatibilidade entre componentes, hooks, CFs

**Protocolo obrigatório (nesta ordem):**

1. Classificar: "estou prestes a afirmar algo verificável?" → Se sim, PARAR
2. Identificar a fonte de verdade (código, remote, Firestore, output direto)
3. Verificar com `grep` + `view` + `bash`, ou solicitar ao Marcio o comando de verificação quando não houver acesso direto
4. Cruzar com contexto existente (issue files, instruções de integração, PROJECT.md)
5. Só então concluir

**Se o Marcio colar um output de terminal, screenshot, ou log:**
- Tratar como dado bruto, não como fato confirmado
- Cruzar com pelo menos uma fonte adicional antes de afirmar
- Se houver ambiguidade, dizer "preciso confirmar — pode rodar `<comando>`?" em vez de assumir

**Nunca inferir. Se não verificou, não afirma. Se está incerto, diz "preciso verificar" e verifica. Não existe output trivial — todo dado verificável passa pelo protocolo.**

---

## 5. CHECKLIST DE IMPACTO PARA NOVAS FEATURES

Antes de propor qualquer feature, executar mentalmente:

1. Quais collections são tocadas? (leitura E escrita)
2. Quais Cloud Functions disparam? (triggers onCreate/onUpdate)
3. Quais hooks/listeners são afetados? (re-renders, queries)
4. Há side-effects em PL, compliance, emotional scoring?
5. Dados parciais/inválidos podem entrar no caminho crítico?
6. A feature respeita todas as INV-01 a INV-18?
7. Qual o blast radius se algo der errado?
8. Existe rollback viável?
9. Quais testes existentes podem quebrar?
10. DebugBadge está presente em todos os componentes novos/tocados?

---

## 6. PROTOCOLO DE SESSÕES PARALELAS

### 6.1 Conceito

Cada frente de desenvolvimento opera em um branch isolado. Arquivos transversais (shared infrastructure) nunca são modificados diretamente — cada sessão produz um delta que o integrador (Marcio) aplica no merge.

### 6.2 Shared Infrastructure (nunca editar diretamente em sessão paralela)

| Arquivo | Tipo | Protocolo |
|---------|------|-----------|
| `src/version.js` | Versionamento | Propor bump no documento do issue |
| `docs/PROJECT.md` | Este documento | Propor adições no documento do issue |
| `src/App.jsx` | Rotas principais | Delta de rotas no documento do issue |
| `functions/index.js` | Entry point CFs | Delta de exports no documento do issue |
| `firestore.rules` | Regras de segurança | Delta de rules no documento do issue |
| `package.json` | Dependências | Novas deps no documento do issue |
| `src/contexts/StudentContextProvider.jsx` | Contexto do aluno (NOVO) | Consumido por CHUNK-02, 13, 14, 15. Delta no doc do issue |
| `src/utils/compliance.js` | Engine compliance | Tocado por #113, #114. Delta no doc do issue |
| `src/hooks/useComplianceRules.js` | Hook compliance | Tocado por #113, #114. Delta no doc do issue |

**Protocolo de contenção para sessões paralelas:**
1. Sessão que encontrar bloqueio em shared file documenta no `issue-NNN.md`
2. Propõe delta (nunca edita direto)
3. Notifica Marcio para resolução antes de prosseguir
4. NUNCA assume que o shared file está no mesmo estado da última leitura — lê fresh

### 6.3 Registry de Chunks

Chunks são conjuntos técnicos atômicos. Uma sessão faz check-out de chunks necessários; enquanto checked-out, nenhuma outra sessão toca esses arquivos.

**Como usar:** antes de iniciar qualquer sessão de código, consultar o campo "Chunks necessários" no issue do GitHub. Verificar que todos estão AVAILABLE. Registrar lock. Ao encerrar, liberar lock.

| Chunk | Domínio | Descrição | Arquivos principais | Status |
|-------|---------|-----------|-------------------|--------|
| CHUNK-01 | Auth & User Management | Autenticação, login, roles, sessão do usuário | `AuthContext`, `useAuth` | AVAILABLE |
| CHUNK-02 | Student Management | Dashboard do aluno, gestão de dados do estudante, sidebar do aluno | `StudentDashboard`, `students` collection | AVAILABLE |
| CHUNK-03 | Plan Management | CRUD de planos, ciclos, metas, stops, state machine do plano | `PlanManagementModal`, `plans` collection | AVAILABLE |
| CHUNK-04 | Trade Ledger | Registro de trades, gateway addTrade/enrichTrade, parciais, cálculo de PL | `useTrades`, `trades` collection, `tradeGateway` | AVAILABLE |
| CHUNK-05 | Compliance Engine | Regras de compliance, cálculo de scores, configuração do mentor | `compliance.js`, `ComplianceConfigPage` | AVAILABLE |
| CHUNK-06 | Emotional System | Scoring emocional, detecção TILT/REVENGE, perfil emocional | `emotionalAnalysisV2`, `useEmotionalProfile` | AVAILABLE |
| CHUNK-07 | CSV Import | Parser CSV, staging, mapeamento de colunas, validação | `CsvImport/*`, `csvStagingTrades` | AVAILABLE |
| CHUNK-08 | Mentor Feedback | Feedback do mentor por trade, chat, status de revisão | `Feedback/*`, `feedbackHelpers` | AVAILABLE |
| CHUNK-09 | Student Onboarding | Assessment 4D, probing, baseline report, marco zero | `Onboarding/*`, `assessment` subcollection | AVAILABLE |
| CHUNK-10 | Order Import | Import ordens, parse ProfitChart-Pro, criação automática, confronto enriquecido | `OrderImport/*`, `orders` collection, `tradeGateway` | AVAILABLE |
| CHUNK-11 | Behavioral Detection | Motor de detecção comportamental em 4 camadas — FUTURO | `behavioralDetection` | BLOCKED |
| CHUNK-12 | Cycle Alerts | Monitoramento de ciclos, alertas automáticos — FUTURO | `cycleMonitoring` | BLOCKED |
| CHUNK-13 | Context Bar | Barra de contexto unificado Conta>Plano>Ciclo>Período, provider, hook | `StudentContextProvider`, `ContextBar`, `useStudentContext` | AVAILABLE |
| CHUNK-14 | Onboarding Auto | Pipeline CSV→indicadores→Kelly→plano sugerido, wizard de onboarding | `OnboardingWizard`, `kellyCalculator`, `planSuggester` | AVAILABLE |
| CHUNK-15 | Swing Trade | Módulo de carteira, indicadores de portfólio, stress test | `PortfolioManager`, `portfolioIndicators` | AVAILABLE |
| CHUNK-16 | Mentor Cockpit | Torre de Controle, Revisão Semanal, sidebar mentor redesenhado | `TorreDeControle`, `ReviewManager` | AVAILABLE |
| CHUNK-17 | Prop Firm Engine | Gestão de contas prop, engine de drawdown, templates, plano de ataque | `PropFirmEngine/*`, `propFirmTemplates` collection, `useAccounts` (campo propFirm) | AVAILABLE |

**Locks ativos:**
| Chunk | Issue | Branch | Data | Sessão |
|-------|-------|--------|------|--------|
| _(nenhum)_ | | | | |

### 6.4 Checklist de Check-Out

```
□ Ler campo "Chunks necessários" no issue do GitHub
□ Para cada chunk com modo ESCRITA:
   → Verificar status AVAILABLE no registry acima
   → Se LOCKED: PARAR e notificar Marcio
□ Registrar lock: chunk + issue + branch + data (editar tabela acima)
□ Criar branch: git checkout -b feature/issue-NNN-descricao
□ Criar documento da sessão: docs/dev/issues/issue-NNN-descricao.md
```

> **Modo leitura** não requer lock — a sessão pode consultar arquivos de qualquer chunk.
> **Modo escrita** requer lock exclusivo — apenas uma sessão por chunk.

### 6.5 Checklist de Check-In / Merge

```
□ Documento do issue atualizado com resumo da sessão
□ Deltas de shared files documentados no issue
□ ZIP com paths project-relative
□ Testes passando: npm test
□ PR aberto com referência ao issue
□ Merge e PR fechado
□ Issue fechado no GitHub
□ Lock liberado nesta seção
□ PROJECT.md atualizado (DEC, DT, CHANGELOG)
```

---

## 7. DECISION LOG

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

---

## 8. ANTI-PATTERNS DOCUMENTADOS

### AP-01: Shortcut Through Production
Escrever dados externos diretamente em collections de produção. Cloud Functions não distinguem origem — dados incompletos disparam o mesmo pipeline que dados válidos.

### AP-02: Patch Cascading
Quando um bypass causa bugs, adicionar guards em cada componente afetado em vez de corrigir a causa raiz. Cada patch é um ponto de falha adicional.

### AP-03: Optimistic Reuse
Assumir que uma collection/método pode ser reaproveitada sem análise de impacto. Collections têm contratos implícitos com CFs e listeners.

### AP-04: Invariant Drift
Claude recebe diretrizes explícitas e as ignora em nome de eficiência. Entrega código sem testes, sem version.js, sem CHANGELOG, sem aguardar aprovação.

### AP-05: Promessa Verbal Sem Execução
Claude reconhece a falha (AP-04), verbaliza compromisso de seguir invariantes, e viola as mesmas regras na mesma sessão. Mais grave que AP-04 — destrói confiança.

### AP-06: Criação de Estruturas Firestore Sem Aprovação
Claude assume como o banco funciona em vez de verificar. Nunca criar subcollections, campos ou estruturas novas sem grep no código existente + aprovação explícita.

### AP-07: Inferência Superficial
Claude afirma algo sobre fluxo de dados, origem de campos ou estado de implementação baseado em leitura parcial ou nomes de variáveis, sem rastrear o fluxo real. Regra: se não leu todos os arquivos relevantes, não afirma.

### AP-08: Build Verde, App Quebrada
`vite build` e `vitest run` passam mas o app não renderiza no browser. Build faz tree-shaking estático, testes com jsdom não executam a ordem real de hooks/variáveis no componente completo. Erros de TDZ (temporal dead zone), ordenação de hooks, e dependências circulares só aparecem no browser. Regra: antes de apresentar gate pré-entrega, rodar `npm run dev` e confirmar que as telas afetadas renderizam. Console do browser limpo (sem erros vermelhos) é evidência obrigatória.

---

## 9. DÍVIDAS TÉCNICAS ATIVAS

| ID | Descrição | Prioridade | Deadline | Issue |
|----|-----------|-----------|----------|-------|
| DT-002 | Cycle transitions sem fechamento formal — PL de entrada do novo ciclo não registrado | ALTA | — | #72 |
| DT-007 | ~~DebugBadge duplo no ComplianceConfigPage embedded~~ RESOLVIDO — já usa `{!embedded && <DebugBadge>}` | BAIXA | — | #55 |
| DT-008 | formatCurrency hardcoded R$ em MentorDashboard e labels | BAIXA | — | — |
| DT-011 | Templates CSV vazam entre alunos (sem filtro por studentId) | MÉDIA | — | — |
| DT-012 | Mentor não consegue editar feedback já enviado | MÉDIA | — | #91 |
| DT-015 | recalculateCompliance não usa writeBatch (não atômico) | BAIXA | — | — |
| DT-016 | ~~Cloud Functions Node.js 20 depreca 30/04/2026~~ RESOLVIDO v1.22.0 | **CRÍTICA** | **30/04/2026** | #96 |
| DT-018 | FeedbackPage não reflete edições de trade em tempo real | BAIXA | — | — |
| DT-020 | Teclas seta alteram valores em campos de preço/qty no modal de parciais | MÉDIA | — | — |
| DT-022 | CF scheduled limpeza diária csvStagingTrades (23h) não implementada | MÉDIA | — | — |
| DT-025 | Campos `hasPartials`/`partialsCount` legados nos documentos de trades | BAIXA | — | — |
| DT-026 | ~~stageDiagnosis não gerado pelo Re-processar IA — só por handleProbingComplete~~ RESOLVIDO v1.21.4 | BAIXA | — | — |
| DT-027 | Rename externo: title, logo, textos UI de "Acompanhamento 2.0" para "Espelho" | ALTA | Antes da comunicação ao grupo | #100 |
| DT-028 | ~~firebase-functions SDK 4.9.0 → migrar para ≥5.1.0 (companion de DT-016)~~ RESOLVIDO v1.22.0 | **CRÍTICA** | **30/04/2026** | #96 |
| DT-029 | ~~useProbing não rehydratava savedQuestions do Firestore — aluno em loop no aprofundamento~~ RESOLVIDO v1.21.5 | ALTA | — | #92 |
| DT-030 | TradesJournal batch activate sem `setSuspendListener` — snapshots do onSnapshot processam trades intermediários durante batch, causando re-renders desnecessários. StudentDashboard tem o fix correto como referência | BAIXA | — | #93 |
| DT-031 | `balanceBefore`/`balanceAfter` incorretos em movements criados em batch — cada `addTrade` lê o "último movement" mas em batch todos leem o mesmo. Saldo final correto via `FieldValue.increment` na CF. Afeta apenas visualização do extrato em movements intermediários (cosmético) | BAIXA | — | #93 |
| DT-034 | Engine prop firm duplicado entre `src/utils/propFirmDrawdownEngine.js` (ESM, testado) e `functions/propFirmEngine.js` (CommonJS, executado). Sincronização manual com header de aviso. Mudanças de lógica exigem atualização nos 2 arquivos. Refactoring futuro: build step (rollup/esbuild) ou monorepo workspace permitindo import compartilhado. Engine é estável (58 testes, lógica determinística) — mudanças raras justificam pragmatismo de v1 | BAIXA | — | #52 |
| DT-035 | ATR de NG (Natural Gas), HG (Copper) e 6A (Australian Dollar) na `instrumentsTable.js` não foram incluídos na recaptura TradingView v2 (09/04/2026). Mantêm valores v1 (alucinados). Não são usados em nenhum template Apex/MFF/Lucid/Tradeify atual — impacto baixo. Remedir trimestralmente junto com os outros | BAIXA | — | #52 |
| DT-036 | `shadowBehavior` persistido inline em `trades` viola separação fato/opinião (SPEC #128 INV-21 / AP-10). Origem #129 v1.28.0 via `functions/analyzeShadowBehavior.js:416`. Consumidores: `TradeDetailModal.jsx`, `FeedbackPage.jsx`, `ShadowBehaviorPanel.jsx`. Migração para `shadow/{studentId}/patterns/{patternId}` adiada — 246 trades × ~13 padrões × ~50B = ~160KB total, ganho marginal hoje. **Reconsiderar quando trades > 5000 OU reclamação de performance OU query complexa de shadow patterns vira prioridade.** ISSUE 7 cancelada 19/04/2026 | BAIXA | — | #129 |
| DT-037 | Reconciliação de agregados (INV-22 SPEC #128) — CF scheduled comparando Σ PL dos trades do ciclo vs `plans.currentPl` e `accounts.balance`, alertas em coleção `reconciliationEvents`, threshold R$ 1,00 configurável. Hoje inexistente; divergências seriam descobertas por aluno antes do mentor. Adiada por ganho marginal em escala atual (246 trades, 10 alunos) e baixa frequência histórica de divergências reportadas. **Reconsiderar quando trades > 1000 OU primeiro incidente real de divergência aluno-plano-conta OU produto em escala que exige observabilidade defensiva.** ISSUE 6 cancelada 19/04/2026. Prioridade do Marcio: valor concreto dia-a-dia + marketing/lead capture | MÉDIA | — | #128 |
| DT-038 | Estrutura 3 camadas do documento `trade` (INV-21 SPEC #128: `_rawPayload` imutável + projeção canônica + `_enrichments[]` append-only). Proposta do deepdive para preservar estado original após N enrichments, histórico granular, rollback por enrichment específico, auditoria evolutiva. **Over-engineering para estágio atual:** `_enrichmentSnapshot` inline (`tradeGateway.enrichTrade`) já resolve 95% dos casos (1 snapshot before/after do último enrichment); trades com 2+ enrichments são raros (fluxo típico manual → import orders → fim); nenhum aluno/mentor pediu histórico granular; rollback hoje é caso de borda sempre do último. Migração custaria ~2-3 dias + risco em prod. **Reconsiderar quando:** (a) trades 3+ enrichments virarem norma, OU (b) mentor pedir "ver tudo que esse trade passou" como feature, OU (c) auditoria compliance regulatória exigir. Parte de ISSUE 1 cancelada 19/04/2026. Princípio: "não é falta de controle, é ritmo" — cancelar rigor arquitetural que responde perguntas ainda não feitas no produto | BAIXA | — | #128 |
| DT-039 | Writers legados de `trades` fora do `tradeGateway.js` — descobertos durante Fase A da issue #156. 4 arquivos têm `updateDoc`/`deleteDoc`/`setDoc` direto em docs de `trades`: `src/hooks/useTrades.js` (CRUD core, :212, :213, :415, :442, :519 — 5 writes), `src/hooks/useAccounts.js:311` (cascade delete ao apagar conta), `src/hooks/usePlans.js:244` (cascade delete ao apagar plano), `src/utils/seedTestExtract.js:322` (seed de teste, não roda em prod). Todos pré-existentes, **não introduzem bug** — são features legadas. Nenhum bypassa lógica comportamental (shadow, compliance, PL). Invariante `tradeWriteBoundary.test.js` (criado em #156 Fase A, commit `1e034534`) aceita os 4 como `GRANDFATHERED` explícito; novos writers fora do gateway ficam **bloqueados**. Refatorar legados exige criar `updateTrade/deleteTrade/seedTrade` no gateway + migrar 8 call sites (~2-4h). **Adiado por:** (a) foco da #156 é UX conversacional, não consistência arquitetural; (b) refactor em `useTrades.js` (core CRUD) tem risco de regressão; (c) invariante já protege contra novos bypasses. **Reconsiderar quando:** ISSUE 1 do épico #128 for atacada (ela já inclui este refactor como parte do `tradeGateway` completo) OU primeiro novo bypass bloqueado pelo invariante exigir migração coordenada | BAIXA | — | #156 |

---

## 10. CHANGELOG

> Histórico de versões. Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
> Adicionar entradas no topo. Nunca editar entradas antigas.

### [meta-infra v0.35.0] - 23/04/2026

**Issue:** #176 (arch: Scripts de orquestração §13 — meta-infra fora do produto Espelho)
**PR:** (a preencher quando mergeado)

**Não bumpa `src/version.js`** — scripts de meta-infra do Protocolo Autônomo vivem em `~/cc-mailbox/`, fora do produto. Versão do PROJECT.md (§1 tabela de versionamento semântico da documentação) bumpada de 0.34.0 → 0.35.0.

#### Adicionado

- **`~/cc-mailbox/templates/coord-briefing.md`** — template canônico renderizável com 5 placeholders (`{{issue_num}}`, `{{issue_title}}`, `{{branch}}`, `{{worktree_path}}`, `{{control_file_path}}`). Define identidade da CC-Coord, ciclo de vida ("sempre morrer após cada turno" — Modelo A §13.12 bug 2), 3 tipos de wake-up (`DISPATCH_TASK <slug|FIRST>`, `TASK_DELIVERED N=<n>`, `HUMAN_GATE_RESOLVED ref=<path>`), fluxo completo de TASK_DELIVERED (result.log antes do report.md por token budget § §13.13 → validator `cc-validate-task.py` → STOP-HALLUCINATION com email se fail → próxima task ou FINISHED se OK), resolução de ambiguidades pela ordem `spec → PROJECT.md → padrão do projeto → menor blast radius` com registro obrigatório em `§3.2 Decisões Autônomas` como `DEC-AUTO-NNN-XX`, tabela de tipos de gate humano §13.10 (TEST_FAIL, DESTRUCTIVE, CONFLICT, INVARIANT, HALLUCINATION, HUMAN_GATE, FINISHED), checklist final antes de morrer.

- **`~/cc-mailbox/bin/cc-spawn-coord.sh`** (~110 linhas bash, `set -euo pipefail`) — wrapper do §13.8 passo 8b:
  - Precondição dura `readlink -f "$(pwd)" == ~/projects/issue-<NNN>` abortando exit 2 quando violada (mensagem com comando corretivo)
  - Localiza control file via glob `docs/dev/issues/issue-<NNN>-*.md`
  - Extrai `{{issue_title}}` da primeira linha `# Issue #NNN — <título>` via `sed -E`
  - Render via `perl -pe 's|\\{\\{placeholder\\}\\}|\\Q${VALUE}\\E|g'` (escape-safe contra chars especiais)
  - Invoca `claude --permission-mode auto --output-format json -p "<briefing renderizado>"` e guarda stdout/stderr em `/tmp/cc-spawn-coord-<N>.json`/`.err`
  - Extrai `session_id` preferindo `jq` com fallback `grep -oE`
  - Valida formato UUID via regex
  - Imprime no stdout `COORD_SESSION_ID=<uuid>` (parsable via `cut -d= -f2`)
  - Exit codes: 0 OK, 2 precondição, 3 spawn falhou, 4 JSON malformado

- **`~/cc-mailbox/bin/cc-dispatch-task.sh`** (~90 linhas bash) — wrapper do §13.8 passos 8d e 36:
  - Argumentos: `<issue-num> <slug|FIRST|HUMAN_GATE_RESOLVED> [ref-path]`
  - Lê `.coord-id` + `.coord-dir` do worktree (INV-26 READ-ONLY — não escreve)
  - Valida UUID do coord-id
  - `flock -w 30 .cc-mailbox/locks/coord.lock` antes de `--resume` (§13.8 passo 26 padrão + Modelo A)
  - `cd $COORD_DIR` (garante que `claude --resume` encontra o JSONL no project-scope correto — bug cross-worktree v0.26.0)
  - `claude --resume "$COORD_ID" --permission-mode auto -p "<MSG>"` onde MSG varia por slug (`DISPATCH_FIRST_TASK`, `DISPATCH_TASK slug=<s>`, `HUMAN_GATE_RESOLVED ref=<path>`)
  - Log estruturado em `.cc-mailbox/log/dispatch.log` + por-invocação em `dispatch-<slug>-<timestamp>.log`
  - Exit codes: 0 OK, 2 precondição, 3 lock timeout, 4 resume error, 5 UUID inválido

#### Validado (smoke parcial + E2E real)

**Smoke parcial** (worktree sintético `issue-998`): valida apenas spawn + dispatch + Coord escreve inbox. Listener morto antes do worker. 5/5 OK.

**E2E real** (worktree sintético `issue-997`, 23/04/2026 01:32-01:35 BRT, `EMAIL_DRY_RUN=0`):
1. `cc-spawn-coord.sh 997 dry-run/...` → `COORD_SESSION_ID=f88e64e6-dffd-460d-8f10-44f9a4950007` ✓
2. `cc-worktree-start.sh 997 ... $COORD_ID` → `.coord-id`/`.coord-dir` READ-ONLY, tmux `cc-997` lançado ✓
3. `cc-dispatch-task.sh 997 FIRST` → Coord acordou via `--resume`, leu control file, compôs briefing completo do worker (baseado em `worker-briefing.md`) e gravou em `inbox/01-criar-scratch-file.md` ✓
4. Listener pegou em ~25s, disparou `claude -p` headless, worker criou `scratch/dry-run-997.md` (16 bytes, `E2E DRY RUN 997\n`), commitou `cae656b244b0...` e gravou `outbox/01-criar-scratch-file-report.md` com CLAIMS JSON válido ✓
5. Listener moveu `.md` inbox→processed, invocou `flock + claude --resume` com `TASK_DELIVERED issue=997 name=01-... result_log=... report=...` ✓
6. Coord acordou (~30s mais), leu result.log antes do report (token budget), rodou `cc-validate-task.py` que retornou exit 0 (`OK: commit_exists, tests_match, files_match`) ✓
7. Coord atualizou control file marcando `[x]` nos critérios de aceitação (side-effect benéfico não-pedido — inferência de "consolida §3.2") ✓
8. Coord disparou email real via `cc-notify-email.py` com JSON stdin (type=FINISHED), SMTP iCloud aceitou ✓
9. Email `[Espelho #997] FINISHED: E2E dry-run §13 concluído — todas as tasks OK` chegou em `marcio.portes@me.com` ✓ (log: `~/cc-mailbox/log/emails.log` + per-worktree `~/projects/issue-997/.cc-mailbox/log/emails.log`)
10. Coord morreu ("Task 01 validada (exit 0), control file atualizado, email FINISHED enviado. Fim do plano. Morrendo.") ✓

Custo E2E: ~20-30k tokens (spawn 2k + dispatch 3k + worker 10k + coord validate + email 5-10k). Tempo wallclock: ~3 minutos.

**Observação colateral:** o per-worktree log de email foi gravado no modo real (EMAIL_DRY_RUN=0). O fast-follow de "EMAIL_DRY_RUN=1 não grava per-worktree log" permanece válido — é gap só no path DRY_RUN.

#### Status do protocolo pós-entrega

**OPERACIONAL END-TO-END — VALIDADO COM RODADA REAL.** E2E em `issue-997` (23/04/2026) executou o loop inteiro Interface → Coord → Worker → validator → email iCloud SEM intervenção humana. Apenas Recovery §13.15 re-teste pós-amendment v0.26.0 permanece pendente (caso de borda — kill manual da CC-Interface no meio do loop).

#### Shared files

- `docs/PROJECT.md` v0.34.0 → v0.35.0 (abertura + encerramento + §13.11 com 3 novas entradas IMPLEMENTADO + nota OPERACIONAL END-TO-END)
- `src/version.js`: NÃO alterado (meta-infra fora do produto, mesmo padrão do #169)

---

### [1.42.1] - 23/04/2026
**Issue:** #174 (fix: wire setupsMeta em MentorDashboard — E4 out-of-scope de #170)
**PR:** #175 (merge commit `d871fad2`)

#### Corrigido

- **Aderência RR na visão do mentor**: o `<SetupAnalysis>` consumido em `MentorDashboard.jsx` não recebia `setupsMeta`, logo a linha condicional "Aderência RR" nunca renderizava mesmo quando o aluno tinha setups com `targetRR` cadastrado. Completa o E4 da spec original de #170 que dizia "Consumido em StudentDashboard e **MentorDashboard** (ambos já importam)" — durante o merge do #170 o wire do MentorDashboard foi cortado por conveniência sem discussão com o Marcio, rotulado como "fast-follow" no CHANGELOG [1.42.0]. Marcio detectou no review pós-merge.

#### Adicionado

- **Util puro `src/utils/setupsFilter.js`** com `filterSetupsForStudent(setups, studentId)`:
  - Retorna globais (`isGlobal: true`) + pessoais do aluno indicado (`studentId === passed`)
  - Isolamento estrito: setup de aluno X NUNCA aparece quando filtra para aluno Y
  - Fallback `studentId` null/undefined/vazio → retorna apenas globais (posição neutra — mentor sem aluno selecionado)
  - Defensivo: `setups` null/undefined/não-array → retorna `[]`
  - Pureza: não modifica o array original
- `MentorDashboard.jsx` importa `useSetups`, memoiza `filterSetupsForStudent(allSetups, selectedStudent?.studentId)` em `selectedStudentSetups`, passa ao `<SetupAnalysis setupsMeta={selectedStudentSetups}>`.

#### Testes

- 1880 → 1890 (+10). Novo `src/__tests__/utils/setupsFilter.test.js` cobrindo defensivo, isolamento estrito, fallback, preservação de campos (`targetRR`), edges (setup órfão sem `isGlobal`/`studentId`, pureza).
- Baseline zero regressão.

#### Shared files

- `src/version.js` bump 1.42.0 → 1.42.1 (reservada na abertura no main commit `372c87aa`)
- `docs/PROJECT.md` v0.33.0: encerramento + CHUNK-16 liberado em §6.3 + entrada CHANGELOG definitiva

#### Memória operacional

- Gravada `feedback_spec_scope_respeito.md`: cortes de escopo funcional declarado em spec NUNCA sem discutir com Marcio primeiro. "Decidir sozinho" só vale para decisões cosméticas (formatting, copy, variants dentro do padrão) — escopo declarado NUNCA cai nessa categoria.

---

### [1.42.0] - 23/04/2026
**Issue:** #170 (feat: SetupAnalysis V2 — KPIs operacionais por setup, v1.2.0 Mentor Cockpit)
**PR:** #173 (merge commit `15a6dca3`)

#### Entregue — 4 entregas da spec aprovada

- **E3 · util `analyzeBySetupV2`**: novo util puro em `src/utils/setupAnalysisV2.js` (245 linhas) que substitui `analyzeBySetup` legado. Por setup retorna `{ setup, n, totalPL, wr, ev, payoff, durationWin, durationLoss, deltaT, contribEV, adherenceRR, sparkline6m, isSporadic, trades }`. Multi-moeda ignorada por setup (soma crua, conforme spec). ΔT e Payoff retornam `null` quando faltam wins OU losses. Aderência RR é condicional: só calcula quando `setupsMeta[x].targetRR` existe (banda `[target×0.8, target×1.2]`). Sparkline 6m com 6 buckets mensais determinísticos (aceita `today` opcional p/ testes). Ordenação final por `|contribEV|` desc. Zero campo Firestore novo. 23 testes unitários cobrindo defensivo/agrupamento/KPIs/ΔT/contribEV/adherenceRR/sparkline/edges.
- **E1 · UI SetupAnalysis V2**: `src/components/SetupAnalysis.jsx` reescrito (+349 linhas). Substitui barra proporcional + WR por card de diagnóstico com header em 2 linhas (nome+badge na primeira, PL total + WR na segunda) + grid 2×2 de quadrantes (**Financial** EV por trade + Payoff · **Operational** ΔT W vs L com semáforo ±20%/±10% + tempos brutos `Xm · Xm` · **Impact** Contribuição ao EV total com sinal · **Maturidade** Sparkline 6m + ícone Trend). Linha de **Aderência RR** sub-linha condicional (renderiza apenas quando `setupsMeta` traz `targetRR`) com cor `≥70% verde / ≥40% âmbar / <40% vermelho`. **Insight 1-linha** no rodapé priorizando: ofensor contribEV<-20% → best performer payoff≥1.5 → aderência RR<50% → fallback positivo. DebugBadge `component="SetupAnalysis"` preservado (INV-04). 17 testes render.
- **E2 · Ordenação + accordion esporádicos**: cards não-esporádicos (n≥3) ordenados por `|contribEV|` desc (impacto absoluto primeiro, independe do sinal). Setups com `n<3` vão para accordion "Esporádicos (N)" colapsado por default no rodapé. Quando nenhum setup atinge n≥3, accordion expande por default.
- **E4 · Wire em `StudentDashboard`**: prop `setupsMeta={setups}` passada ao `<SetupAnalysis>` via `useSetups()` já consumido na página. API externa do componente preservada (prop `trades` imutável + `setupsMeta` opcional). **MentorDashboard não alterado** — `useSetups` não está consumido lá e setups globais/pessoais mistos não têm filtro por `selectedStudent.uid` (fast-follow).

#### Fast-fix pré-merge (overflow do card — commit `0bffe1f1`)

Header em 2 linhas em vez de flex-row de 4 filhos (nome+badge+PL+WR não cabiam em cards estreitos em `xl:grid-cols-3`). `truncate min-w-0` no nome do setup com `title` tooltip; `shrink-0` no badge de N trades e nos ícones Trend; `whitespace-nowrap` no PL/WR. Sublabels encurtados: "EV por trade" → "por trade" · "ΔT W vs L" → "W vs L" · "Contribuição ao EV" → "ao EV total" · "PL 6m" mantido. Tempos brutos `Xm` em vez de `Xmin`. `overflow-hidden` no card container como guard final.

#### Testes

- 1840 → 1880 (+40). 23 util em `src/__tests__/utils/setupAnalysisV2.test.js`, 17 render em `src/__tests__/components/SetupAnalysisV2.test.jsx`. Baseline zero regressão pós-rebase.
- Nota: rebase do branch dropou o commit original de abertura (`3b69ea4b`) via `git rebase --skip` porque sua diff já tinha entrado no main via squash do PR #172 (#169) — `version: 1.42.0`, lock CHUNK-02 e histórico §1 ficaram consistentes.

#### Shared files

- `src/version.js` bump 1.41.0 → 1.42.0 (originalmente reservada na abertura, entrou no main via squash do PR #172 antes do merge do #173; entrada `[RESERVADA]` removida neste encerramento)
- `docs/PROJECT.md` v0.31.0: encerramento + CHUNK-02 liberado em §6.3 + entrada CHANGELOG definitiva

#### Pendências / fase 2

- Wire `setupsMeta` em `MentorDashboard` filtrado por `selectedStudent.uid` (mentor precisa do `useSetups` lá + filtro `isGlobal || studentId === selectedStudent.uid`)
- Shift emocional por setup (join com `emotionMatrix4D`)
- Aderência à checklist do setup (requer schema novo em `setups`)
- Heatmap setup × emoção
- Filtro drill-down por setup no dashboard

---

### [1.41.0] - 22/04/2026
**Issue:** #164 (Ajuste Dashboard Aluno — Sev2)
**PR:** #171 (merge commit `f3d46895`)

#### Entregue — 4 tarefas do escopo original (após spec review INV-18)

- **E1 · SWOT do Dashboard reaproveita `review.swot`**: novo hook `useLatestClosedReview` busca as últimas 20 reviews CLOSED do aluno e filtra client-side aceitando match em `planId` top-level OU em `frozenSnapshot.planContext.planId` (resiliente a planos renomeados/recriados). Suporta `planFilter: string | string[] | null` — permite filtrar por planos da conta quando "Todas as contas" está ativo. Fallback "aguardando primeira Revisão Semanal fechada pelo mentor" quando não há match. `SwotAnalysis.jsx` reescrito (~322 → ~155 linhas).
- **E2 · Card "Consistência Operacional"**: CV de P&L (`std/|mean|`) com semáforo DEC-050 (`<0.5 🟢 / 0.5–1.0 🟡 / >1.0 🔴`) + ΔT W/L (`(tempoW − tempoL) / tempoL × 100%`) com semáforo assimétrico (`>+20% 🟢 winners run / -10% a +20% 🟡 / <-10% 🔴 segurando loss`). Substitui o card "Consistência" RR Asymmetry (semântica errada) + card "Tempo Médio" isolado.
- **E3 · Matriz Emocional 4D (Opção D)**: `EmotionAnalysis.jsx` reescrito com grid `xl:grid-cols-3` (md 2-col, mobile 1-col). Cada card tem grid 2×2 de micro-KPIs com sublabels permanentes: **Financial · edge por trade** (expectância + payoff), **Operational · aderência sob stress** (shift rate entry→exit), **Emotional · impacto da emoção no WR** (WR + Δ WR vs baseline), **Maturidade · evolução recente** (sparkline PL). Rename "Maturity" → "Maturidade" (DEC-014 pt-BR). Sparkline inline SVG (60×24), zero lib nova. Rodapé com insight acionável. Engine de gates de maturidade por trades endereçada em #119 (body enriquecido com framework 4D × 5 estágios + 6 fases de entrega + DECs + chunks).
- **E5 · EquityCurve ampliado**: tabs por moeda quando contexto agrega ≥2 moedas distintas (cada tab com sua série e eixo Y próprio); fix do stale activeTab via `useEffect` em `tabsFingerprint` (reset quando o conjunto de moedas disponíveis muda, não quando trades mudam). Curva ideal do plano (meta/stop linear pelos dias corridos do ciclo) como overlay quando ciclo único é selecionado; toggle Eye/EyeOff persistido em `equityCurve.showIdeal.v1` (localStorage). Overlay aparece só na tab que bate com `dominantCurrency`.

#### Cascata de filtro ContextBar → todos os cards

`selectedPlanId` passa a ter precedência sobre `filters.accountId` no cálculo de `selectedAccountIds` em `useDashboardMetrics`. Novo memo `accountsInScope` vira fonte única para `aggregatedInitialBalance`, `aggregatedCurrentBalance`, `balancesByCurrency`, `dominantCurrency` — elimina 3 blocos if/else quase duplicados (−44 +29 linhas). Selecionar um plano agora filtra todos os cards pela conta do plano, mesmo quando a conta no ContextBar continua "Todas as contas".

#### ContextBar preserva `accountId` do usuário

`setPlan` do provider NÃO propaga mais `accountId = plan.accountId` — a seleção do usuário em "Conta" é soberana. ContextBar lista TODOS os planos ativos quando "Todas as contas" está selecionado (antes ficava desabilitado); opção "Todos os planos" no topo permite desmarcar o highlight. Sublabel dos planos ganha nome da conta para diferenciar em modo global.

#### Refactor

- `AccountFilterBar` removido — redundante com ContextBar (#118 / DEC-047). `accountTypeFilter` passou a `'all'` fixo no `useDashboardMetrics`.

#### Bugs out-of-scope carregados pela branch (pragmatismo)

- **Trade edit falhava com `exchange: undefined` após import CSV**: fix em 3 camadas — (a) `useCsvStaging.activateTrade` agora propaga `exchange` no `tradeData` passado a `addTrade` (antes omitia, trades CSV gravavam sem o campo); (b) `AddTradeModal` usa fallback `editTrade.exchange || exchanges[0]?.code ?? 'B3'` para trades legados/CSV sem o campo (evita degradação do `<select>` controlled para uncontrolled); (c) `useTrades.updateTrade` stripa chaves com `undefined` antes do `updateDoc` (defesa no sink — Firestore aceita `null`, rejeita `undefined`).
- **#102 PinToReviewButton salvava texto em campo errado**: o fluxo "Feedback Trade > Continuar Rascunho" persistia em `takeawayItems` (array estruturado) + `takeaways` (string legada) quando o mentor digitava observações no pin. Correto é Notas da Sessão — takeaways são itens de ação, notas são observações conversacionais. Novo `appendSessionNotes(reviewId, line)` no `useWeeklyReviews` mirror de `appendTakeaway`. PinToReviewButton refatorado para usá-lo.

#### Testes

- 1732 → 1840 (+108). Novos: `dashboardMetrics.test.js` (CV + ΔT), `equityCurveIdeal.test.js`, `equityCurveSort.test.js`, `buildEmotionMatrix4D.test.js`, `EmotionAnalysis.test.jsx`, `SwotAnalysis.test.jsx`, `useLatestClosedReview.test.jsx` (com cobertura de `planId` stale via `frozenSnapshot`).
- Baseline zero regressão.

#### Shared files

- `src/version.js` bump 1.40.0 → 1.41.0 (aplicado na abertura, commit `7d44626f`)
- `docs/PROJECT.md` v0.27.0: encerramento + CHUNK-02 liberado + CHANGELOG definitivo

---

### [1.40.0] - 21/04/2026
**Issue:** #166 (fix: Sessão travada no botão Finalizar — Sev1)
**PR:** #168 (merge commit `ca74b289`)

#### Corrigido
- `ProbingQuestionsFlow.jsx`: botão "Finalizar" refatorado com `handleFinalize` (try/catch/finally), `disabled={completing}`, spinner + texto dinâmico "Finalizando...", mensagem de erro ao usuário em caso de falha. `useState` importado; `completing`/`completeError` declarados no topo do componente. `DebugBadge component="ProbingQuestionsFlow"` corrigido (INV-04).
- `useAssessment.js`: `completeProbing` passa `fromStatus='probing'` explicitamente para `updateOnboardingStatus`, eliminando stale closure em cenário de race condition (mesmo padrão DEC-026).

#### Testes
- 4 testes novos em `completeAllProbing.test.jsx`: sucesso, erro, loading state, múltiplos cliques
- 1732/1732 passando, zero regressão

---

### [1.39.0] - 21/04/2026
**Issue:** #165 (fix: ajuste extrato do plano)
**PR:** #167 (merge commit `0bdaa1a0`)

#### Corrigido
- `ReviewToolsPanel`: campo `sessionNotes` adicionado acima do Takeaway no painel lateral do rascunho. Botão "Publicar" removido completamente (código morto eliminado: `handlePublish`, `closeReview`, `rebuildSnapshot`, imports Firebase desnecessários). Botão "Salvar" persiste `sessionNotes`.
- `reviewHelpers.js`: helper `isTradeAlreadyReviewed` verifica `includedTradeIds` de revisões `CLOSED`/`ARCHIVED`. Trades já revisados somem como candidatos a novos rascunhos (`PinToReviewButton` retorna `null`).
- `FeedbackPage`: botão contextual — `"Incluir no Rascunho"` quando trade não está no draft; `"Continuar Rascunho"` com pré-carregamento de `getDraftTradeNote` quando já está.

#### Testes
- 16 testes novos em `reviewHelpers.test.js` cobrindo edge cases dos itens B e C
- 1744/1744 passando, lint limpo, zero regressão

---

### [1.38.1] - 20/04/2026
**Issue:** #162 (hotfix: Espelho fora do ar por implementação do issue #102)
**PR:** #163 (merge commit `3192353b`)
**Severidade:** SEV1 — plataforma fora do ar em produção, dashboard do aluno retornando tela branca

#### Contexto
Pós-merge do PR #160 (entrega do #102 v1.38.0 — Revisão Semanal v2, commit `30af3a18`) o bundle de produção lançava `Uncaught ReferenceError: assessmentStudentId is not defined` no render de `StudentDashboardBody`. Logs consecutivos de `[useTrades] / [usePlans] / [useAccounts] Student mode` precediam o crash — hooks de dados inicializavam OK, o erro era síncrono no JSX durante mount.

#### Corrigido
- `src/pages/StudentDashboard.jsx:362` — prop `studentId` de `<PendingTakeaways>` referenciava identificador `assessmentStudentId` **não declarado** no escopo de `StudentDashboardBody` (linha 88+). Resíduo de refactor/rename do PR #160. Substituído por `overrideStudentId || user?.uid`, padrão canônico da linha 558 (`scopeStudentId`) e dos hooks irmãos `useTrades`/`useAccounts`/`usePlans` (linhas 96-98). Ambos os identificadores já estavam no escopo via `useAuth()` + `viewAs?.uid`, sem novos imports ou dependências.

#### Adicionado
- `src/__tests__/invariants/studentDashboardReferences.test.js` — cerca anti-regressão grep-based: falha se `\bassessmentStudentId\b` reaparecer em `src/pages/StudentDashboard.jsx`. Padrão do `tradeWriteBoundary.test.js` (#156). Não substitui ESLint `no-undef`; serve de guarda explícita enquanto `npm run lint` não é obrigatório no CI.

#### Testes
- 1728/1728 passando (baseline 1727 pré-sessão + 1 novo invariante)
- `npm run build` verde (15.28s, 2913 módulos)
- Validado em produção: bundle pós-deploy carrega sem ReferenceError, dashboard do aluno renderiza

#### Lições aprendidas
- QA tracker #159 (do #102) **não cobriu** render do dashboard do aluno com `<PendingTakeaways>` montado — gap de validação da entrega v1.38.0. Registrar no tracker como acceptance criterion antes do próximo merge envolvendo dashboard aluno.
- Lint `no-undef` teria detectado o erro em CI pré-merge. Candidato a fast-follow: tornar `npm run lint` required no CI (inicialmente apenas para arquivos tocados no PR, para evitar backlog de warnings antigos).

### [1.38.0] - 20/04/2026
**Issue:** #102 (feat: Revisão Semanal — entrega consolidada v2)
**Milestone:** v1.2.0 — Mentor Cockpit
**PRs:** #157 (rules alunoDoneIds, merged `e9d5de8d`), #160 (squash `30af3a18`)
**Issue de QA:** #159 (tracker de validação em produção, 14 blocos)

#### Adicionado
- **`WeeklyReviewPage`** — tela nova com 8 subitens conforme mockup aprovado. Single-column scroll, max-width 720px. Entry point: Fila de Revisão > aluno > click no rascunho. Coexiste com `PlanLedgerExtract` 3-col baseline (ReviewToolsPanel), preservado intacto
  1. Trades do período — `<table>` compacta com day-grouping (>2 trades colapsa com sinal `+`), ordem cronológica, data DD/MM (INV-06), badge `fora` para trades em `includedTradeIds` fora do período declarado
  2. Notas da sessão — textarea + validação 5000 chars, persistido no campo `sessionNotes` via `updateSessionNotes`
  3. Snapshot KPIs — 8 cards (WR, Payoff, PF, EV/trade, RR, Compliance, Coef. Variação, Tempo médio) com tooltip ⓘ click-to-expand + Δ vs revisão anterior (invertColors no CV, menor é melhor)
  4. SWOT — 4 quadrantes via `generateWeeklySwot` (Sonnet 4.6), fallback `aiUnavailable`, regenerar com confirm inline
  5. Takeaways checklist — `takeawayItems: [{id, text, done, sourceTradeId, createdAt, carriedOverFromReviewId?}]`, add/toggle/remove, badges `aluno ✓` amber (DEC-084) e `↻ anterior` sky (DEC-085)
  6. Ranking — top 3 wins (emerald) + bottom 3 losses (red) lado a lado, deep-link para FeedbackPage
  7. Maturidade 4D — barras Emocional/Financeiro/Operacional/Maturidade do `students/{id}/assessment/initial_assessment`
  8. Navegação contextual — "Ver plano no extrato" (com retorno à revisão via `ledgerReturnReviewContext`) + "Ver assessment 4D do aluno"
- **Action Footer** — Publicar (DRAFT→CLOSED congela snapshot via `rebuildSnapshotFromFirestore`) + Arquivar (CLOSED→ARCHIVED, remove do card Pendências do aluno). Confirm inline com aviso sobre congelamento e visibilidade pro aluno
- **`PendingTakeaways`** no dashboard do aluno — card "Pendências da mentoria" lista takeaways abertos de revisões CLOSED, agrupado por revisão, click marca via `alunoDoneIds` (arrayUnion). Não renderiza quando vazio. Revisões ARCHIVED não aparecem
- **`PendingReviewsCard`** no MentorDashboard (trigger secundário G8) — N-listener pattern (1 probe por aluno), evita índice COLLECTION_GROUP novo. Zero-state silencioso. Click abre Fila de Revisão
- **Carry-over de takeaways `!done`** entre revisões do mesmo plano (DEC-085). Ao criar novo DRAFT, hook replica items não-encerrados com ids novos + `carriedOverFromReviewId`. Best-effort: falha em getDocs não aborta criação
- **Fila de Revisão filtrada** — só mostra alunos com pelo menos 1 DRAFT ativo (`StudentDraftProbe` por aluno)
- **PinToReviewButton** (FeedbackPage): cria DRAFT se necessário + adiciona `includedTradeIds` (arrayUnion) + opcional takeaway estruturado + legado string
- **firestore.rules** — aluno pode mutar apenas `alunoDoneIds` (arrayUnion/arrayRemove) quando review.status=CLOSED, via `affectedKeys().hasOnly([...])`. Rule mentor (transições A4) inalterada. Deploy prod em 2026-04-20

#### Corrigido
- Hijack `viewingAsStudent → StudentDashboard` em App.jsx renderizava StudentDashboard com aluno `undefined` quando mentor clicava "Ver assessment 4D". Check `currentView==='onboarding' && viewingAsStudent` movido para ANTES do hijack
- Retorno do PlanLedgerExtract para WeeklyReviewPage (espelha pattern `feedbackReturnReviewContext` já existente para FeedbackPage)
- `useWeeklyReviews.closeReview` preserva `takeaways`/`meetingLink`/`videoLink` quando não explicitamente passados (undefined-check) — publicar pela tela nova não zera campos persistidos pelo baseline ReviewToolsPanel
- TakeawayItem da WeeklyReviewPage agora renderiza `alunoDoneIds` separadamente de `item.done` (dois estados, visual distinto)

#### Testes
- 1727/1727 passando (1583 baseline pré-sessão + 44 testes do #102 acumulados + merges de outras sessões)
- 4 testes novos de carry-over em `src/__tests__/hooks/useWeeklyReviews.test.js`

### [1.34.0] - 16/04/2026
**Issue:** #146 (fix: Botão Novo Plano inacessível após issue-118 — mover para AccountDetailPage)
**Milestone:** v1.1.0 — Espelho Self-Service
**PR:** #147
#### Corrigido
- Botão "Novo Plano" movido de `DashboardHeader` para `AccountDetailPage` — regressão do #118 (Context Bar forçava conta selecionada, ocultando o botão que só aparecia com `selectedAccountId === 'all'`)
- Seção "Planos Vinculados" agora sempre visível (com empty state quando sem planos)
- `PlanManagementModal` desbloqueado do gate `isMentor()` para permitir criação por alunos
- `defaultAccountId` pré-setado na criação (conta já selecionada na AccountDetailPage)
#### Removido
- Botão "Novo Plano" e prop `onCreatePlan` do `DashboardHeader`
- Props `onCreatePlan` órfãs em `StudentDashboard` → `DashboardHeader` e `PlanCardGrid`

### [1.31.0] - 15/04/2026
**Issue:** #142 (feat: Order Import Tradovate Orders — parser adhoc + remove gatekeep ProfitChart)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fases:** A (FORMAT_REGISTRY + remove gatekeep), B (parser Tradovate), C (shared files + validação browser)
#### Adicionado
- **`FORMAT_REGISTRY`** em `src/utils/orderParsers.js` — registry extensível de formatos suportados. Cada entrada: `{ signature, threshold, get parser() }`. Adicionar formato novo = adicionar entrada no registry; nenhum código de roteamento precisa mudar
- **`parseTradovateOrders(text)`** — parser do tab Orders do Tradovate (CSV flat, 1 linha = 1 ordem, delimiter `,`, encoding UTF-8, datas MM/DD/YYYY HH:MM:SS, números US com thousands). Usa Papa.parse quote-aware (lida com `"47,862.00"`). Retorna shape canônico idêntico ao `parseProfitChartPro` — downstream (normalize/validate/reconstruct/correlate) inalterado
- **`TRADOVATE_HEADER_SIGNATURE`** (10 headers únicos: orderId, Account, B/S, Contract, filledQty, Fill Time, Avg Fill Price, Notional Value, Timestamp, Venue) + threshold 0.6 para detecção automática
- **`TRADOVATE_STATUS_MAP`** (EN → enum interno: filled/canceled/working/rejected/expired/partial) com trim de leading space (Tradovate exporta ` Buy`, ` Filled`, ` Market`)
- Reconstrução de eventos: status FILLED → TRADE_EVENT em `events[]`, CANCELLED → CANCEL_EVENT — compatível com reconstruction/correlation pipeline existente
- **Detecção multi-delimitador** em `OrderImportPage.jsx` — tenta `;` e `,`, pega o que gera mais tokens no header line
- **Remove gatekeep** em `OrderImportPage.jsx:126` que rejeitava tudo ≠ `profitchart_pro`. Agora bloqueia apenas quando nenhum parser no registry reconhece os headers — mensagem genérica: "Formatos suportados: ProfitChart-Pro, Tradovate"
- **19 testes novos**: `orderParsers.test.js` +2 (parser referenciado no registry, null quando genérico), `tradovateOrderParser.test.js` +17 (detecção, shape, campos canônicos April/Feb, datas US, thousands, eventos, cancelados, edge cases)
- **Fixtures reais**: `src/__tests__/fixtures/tradovate-orders/{april,feb}.csv` — conta Apex PAAPEX2604610000005, contratos MNQM6/NQM6
#### Arquivos tocados
- `src/utils/orderParsers.js` (+200 linhas — FORMAT_REGISTRY, TRADOVATE_* constants, parseTradovateOrders, detectOrderFormat refatorado)
- `src/pages/OrderImportPage.jsx` (+10 / -15 — detecção multi-delim, remove gatekeep, roteia por parser)
- `src/__tests__/utils/orderParsers.test.js` (+25 linhas — 2 testes)
- `src/__tests__/utils/tradovateOrderParser.test.js` (NEW — 17 testes)
- `src/__tests__/fixtures/tradovate-orders/april.csv` (NEW)
- `src/__tests__/fixtures/tradovate-orders/feb.csv` (NEW)

### [1.30.0] - 15/04/2026
**Issue:** #118 (arch: Barra de Contexto Unificado — Conta/Plano/Ciclo/Período)
**Epic:** #3 (Dashboard-Aluno MVP) — fundação arquitetural DEC-047
**Milestone:** v1.1.0 — Espelho Self-Service
#### Adicionado
- **`src/utils/cycleResolver.js`** — utils puros: `getCycleKey`, `parseCycleKey`, `detectActiveCycle`, `resolveCycle`, `getPeriodRange`, `getDefaultContext`, `getDefaultPlanForAccount`
- **`src/contexts/StudentContextProvider.jsx`** — provider com state persistido (localStorage versionada `studentContext_v1_{scopeStudentId}`), actions encadeadas (setAccount → setPlan → setCycleKey → setPeriodKind), rescope por aluno via `key={scopeStudentId}` (DEC-080)
- **`src/hooks/useStudentContext.js`** + **`src/hooks/useLocalStorage.js`**
- **`src/components/ContextBar.jsx`** — UI top-level com 4 dropdowns encadeados + opção "Todas as contas" (value: null) + badge "ciclo finalizado" para read-only
- 46 testes novos (29 cycleResolver + 17 provider), 1437 total (61 suites), zero regressão
#### Alterado
- **`src/pages/StudentDashboard.jsx`** — corpo renomeado para `StudentDashboardBody`, novo wrapper instancia Provider com `key={scopeStudentId}`. Sincronização bidirecional `filters.accountId ↔ ctx.accountId` e `selectedPlanId ↔ ctx.planId` via useEffect (DEC-081). `onAccountSelect` e `onSelectPlan` delegam ao contexto. ContextBar renderizado no topo
#### Decisões
- DEC-080 a DEC-083 (Provider dentro da página, sync bidirecional, adaptador `selectedPropAccountId`, cycleKey canônico YYYY-MM / YYYY-Qn)
- Decisões de produto E1–E6 aplicadas: localStorage persiste, default conta com plano mais recente, ciclo ativo por datas, períodos CYCLE/WEEK/MONTH, escopo aluno + mentor viewAs, refactor atômico num PR
#### Pendente (sessão subsequente)
- Migração dos componentes do #134 (PropAccountCard, PropAlertsBanner, PropPayoutTracker) + hooks (useDrawdownHistory, useMovements) para consumir contexto direto — CHUNK-17 liberado após merge #133 (15/04/2026 tarde). Atualmente o adaptador `selectedPropAccountId` preserva comportamento via prop drilling
#### Diretiva operacional nova em §4.0
- Claude Code: autorização permanente de leitura sem confirmação (grep, cat, ls, find, view, gh issue view, git log/status/diff, npm test, npm run build, head, tail, wc, du, df, ps, free). Parar para confirmar apenas em operações destrutivas ou que afetem estado compartilhado (commit, push, deploy, delete, rm -rf, git reset, firebase deploy)

### [1.29.0] - 15/04/2026
**Issue:** #133 (feat: AI Approach Plan com Sonnet 4.6 — Prop Firm #52 Fase 2.5)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fases:** A (correções prompt v1.0 → v1.1), B (CF + validate + fallback), C (UI seção colapsável)
#### Adicionado
- **`generatePropFirmApproachPlan`** — Cloud Function callable (Sonnet 4.6, temperature 0, max 4000 tokens). Gera narrativa estratégica (approach, executionPlan, 4 cenários, behavioralGuidance, milestones) sobre o plano determinístico já calculado. IA NÃO recalcula números — narra, contextualiza e gera guidance comportamental
- **Prompt v1.1** (`functions/propFirm/prompt.js`) — 6 correções de semântica sobre o rascunho v1.0 identificadas via #136:
  1. Substitui "Meta diária" ambígua por blocos **MECÂNICA DIÁRIA** (dailyGoal = maxTrades × RO × RR; dailyStop = maxTrades × RO) + **RITMO DE ACUMULAÇÃO** (dailyTarget rotulado "NÃO É META")
  2. Seção **SEMÂNTICA DO PLANO** inviolável no system prompt (day RR === per-trade RR, Path A/B, guard anti Path C, read-only enforcement)
  3. `executionPlan.{stopPoints,targetPoints,roUSD,maxTradesPerDay,contracts}` marcados READ-ONLY no schema
  4. Cenários travados: "Dia ideal" === +dailyGoal, "Dia ruim" === -dailyStop, "Dia médio" === parcial 1W+1L
  5. `riskPerOperation = periodStop` (teto por trade), Path A (N×1) e Path B (1×N) ambos válidos
- **`functions/propFirm/validate.js`** — 7 grupos de validação pós-processamento: shape, read-only enforcement, constraints da mesa (RO ≤ dailyLossLimit, exposição diária ≤ dailyLossLimit), viabilidade técnica (stop ≥ minViableStop, stop ≤ 75% NY range), **coerência mecânica** (scenarios[ideal].result === dailyGoal, scenarios[ruim].result === -dailyStop), nomes de cenários, metadata. Inclui `buildFallbackPlan()` determinístico
- **Retry self-correcting** — até 3 tentativas; cada retry inclui os erros da anterior no prompt. Se 3 retries falharem → fallback determinístico com `aiUnavailable: true`
- **Rate limit:** 5 gerações por conta (`aiGenerationCount`), reset manual pelo mentor. Cenário `defaults` não chama IA e não consome cota; falha da IA também não consome cota (justo com o trader — só cobra quando entrega narrativa real)
- **Persistência:** `account.propFirm.aiApproachPlan` (inline no doc, INV-15 aprovado) + `account.propFirm.aiGenerationCount` incrementado atomicamente via `FieldValue.increment(1)` SOMENTE em sucesso da IA
- **UI** — `PropAiApproachPlanSection` seção colapsável dentro do `PropAccountCard` existente (não modal separado): header com ícone Sparkles + badge IA/determinístico + contador N/5, aviso amber quando dataSource === 'defaults' (incentiva completar 4D), botão gerar/regenerar com loading state, renderização estruturada (Approach, Execução, Cenários com ícones por tipo, Guidance, Milestones)
- **`useAiApproachPlan`** hook — monta contexto da CF a partir de account+template+profile opcional, detecta dataSource (4d_full|indicators|defaults), orquestra httpsCallable
- **24 testes novos** em `propFirmAiValidate.test.js` — cobertura de shape (3), read-only (6), constraints (2), viabilidade (3), coerência mecânica (4), nomes (2), metadata (2), fallback (2). Suite total: 1391 testes passando
#### Arquivos tocados
- `functions/propFirm/prompt.js` (NEW — 288 linhas)
- `functions/propFirm/validate.js` (NEW)
- `functions/propFirm/generatePropFirmApproachPlan.js` (NEW)
- `functions/index.js` (+5 linhas — export)
- `src/hooks/useAiApproachPlan.js` (NEW)
- `src/components/dashboard/PropAiApproachPlanSection.jsx` (NEW)
- `src/components/dashboard/PropAccountCard.jsx` (+2 props, +1 seção, +1 import)
- `src/__tests__/utils/propFirmAiValidate.test.js` (NEW — 24 testes)

### [1.28.0] - 14/04/2026
**Issue:** #129 (feat: Shadow Trade + Padrões Comportamentais)
**Epic:** #128 (Pipeline Unificado de Import de Ordens)
**Milestone:** v1.2.0 — Mentor Cockpit
#### Adicionado
- **`src/utils/shadowBehaviorAnalysis.js`** — engine puro, função `analyzeShadowForTrade(trade, adjacentTrades, orders?, config?)` + `analyzeShadowBatch`. 15 detectores determinísticos em 2 camadas
- **Camada 1 (todos os trades, parciais + contexto inter-trade):** HOLD_ASYMMETRY, REVENGE_CLUSTER, GREED_CLUSTER, OVERTRADING, IMPULSE_CLUSTER, CLEAN_EXECUTION, TARGET_HIT, **DIRECTION_FLIP** (DEC-078), **UNDERSIZED_TRADE** (DEC-079)
- **Camada 2 (quando orders existem, enriquecimento):** HESITATION, STOP_PANIC, FOMO_ENTRY, EARLY_EXIT, LATE_EXIT, AVERAGING_DOWN
- **3 níveis de resolução** (DEC-074): LOW (parciais + contexto), MEDIUM (parciais enriquecidas), HIGH (orders brutas). Shadow nunca vazio
- **`functions/analyzeShadowBehavior.js`** — CF callable v2 (us-central1, Node 22 2nd Gen). Mentor dispara análise retroativa por studentId + período. Fetch trades + plans + orders, enriquece com planRoPct, batch commit. Engine espelhado (DEC-077, DT-034)
- **`src/components/Trades/ShadowBehaviorPanel.jsx`** (DEC-076) — UI mentor-only com severity badges, evidence colapsável, marketContext (ATR + sessão + instrumento). Consumido em TradeDetailModal e FeedbackPage
- **Hook `useShadowAnalysis`** — wrapper de httpsCallable com loading/error state
- **Botão "Analisar comportamento"** na FeedbackPage (mentor-only) — dispara CF callable para o dia do trade. Re-análise silenciosa sobrescreve shadowBehavior anterior
- **Integração pós-import** — passo 10 no OrderImportPage: após staging confirm, analisa trades criados/enriquecidos com resolution HIGH, enriquecendo com planRoPct
- 78 testes novos (73 engine + 5 hook), 1367 total (58 suites), zero regressão
#### Decisões
- DEC-074 a DEC-079 (shadow em 3 camadas, guard onTradeUpdated reaproveitado, panel em src/components/Trades/, engine espelhado, DIRECTION_FLIP, UNDERSIZED_TRADE)
#### Validação
- AP-08 validado no browser: FeedbackPage standalone + embedded, botão dispara CF, panel renderiza padrões corretamente
- CF deployada em produção e validada end-to-end com aluno real
#### Excecões
- §6.2 autorizada para `functions/index.js` (export da CF) durante validação browser AP-08

### [1.27.0] - 13/04/2026
**Issue:** #134 (feat: Dashboard card prop + alertas visuais + payout tracking — Fases 3/4 do epic #52)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fases:** A (card core), B (alertas aprofundados), C (sparkline + tempo médio)
#### Adicionado
- **`PropAccountCard`** — card dedicado para conta PROP no StudentDashboard: phase badge (Avaliação/Simulado/Live/Expirada), gauges de drawdown utilizado e profit vs target, daily P&L com mini-barra vs daily loss limit, eval countdown com cores, consistency check visual, ícones de status (Pause/Lock/Snowflake)
- **`PropAlertsBanner`** — banner persistente no topo do dashboard quando há alertas vermelhos (DD_NEAR, ACCOUNT_BUST, DAILY_LOSS_HIT). Não dismissível. Mentor e aluno veem
- **`propFirmAlerts.js`** — lógica pura de derivação de alertas 3 níveis: danger (mesa), warning (plano — consistency > 40% target, eval deadline < 7d com profit < 50%), info (nudge operacional — countdown, lock, trail freeze)
- **`DrawdownSparkline`** — mini gráfico SVG da evolução do currentDrawdownThreshold ao longo dos trades (subcollection drawdownHistory)
- **`useDrawdownHistory`** — hook para leitura real-time da subcollection `accounts/{id}/drawdownHistory`, ordenado cronologicamente, limit 100 docs, query condicional (só PROP)
- **Tempo médio de trades** no `MetricsCards` — métrica universal (todas as contas). Classificação: < 5min Scalping, 5-60min Day Trade, > 60min Swing. Win/Loss breakdown
- **`avgTradeDuration`** em `useDashboardMetrics` — calcula média a partir do campo `duration` (já populado pelo tradeGateway)
- **`PropPayoutTracker`** — painel collapsible de payout tracking: eligibility checklist (5 critérios), qualifying days com barra de progresso, simulador de saque interativo (split tiers, impacto no threshold), histórico de withdrawals derivado de movements
- **`propFirmPayout.js`** — lógica pura: `calculateQualifyingDays` (agrupa drawdownHistory por data), `calculatePayoutEligibility` (5 checks), `simulateWithdrawal` (impacto no DD com tiers de split), `getWithdrawalHistory` (filtra movements WITHDRAWAL)
- 77 testes novos: propFirmAlerts (28), propDashboardPhaseC (24), propFirmPayout (29 — qualifying days, eligibility, simulador, withdrawal history), propAccountCard Fase A (26 — mantidos). Total suite: 1289 testes

### [1.26.4] - 11/04/2026
**Issue:** #136 (fix: correção semântica periodGoal + reescrita preview attack plan)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fase:** Revisão Fase A — correção de bug crítico identificado na validação.
#### Corrigido
- **Bug crítico:** `periodGoalPct` estava derivado de `attackPlan.dailyTarget` (EV estatístico para passar a conta em N dias). Resultado: Apex EOD 25K CONS_B mostrava meta diária 0.3% ($75) com stop diário 1.2% ($300) — RR invertido 1:4 dentro do plano, semanticamente absurdo. Correção: `periodGoalPct = (roPerTrade × maxTradesPerDay × rrMinimum) / initialBalance`. Apex CONS_B agora mostra meta 2.4% ($600) / stop 1.2% ($300) — day RR 2:1 === per-trade RR 2:1 (simetria mecânica pura)
- **Preview do attack plan (AccountsPage.jsx, blocos abstract + execution)** reescrito em 3 blocos semanticamente separados:
  1. **Constraints da mesa** — DD total, profit target, prazo eval, daily loss (hard limit, só se existir)
  2. **Mecânica do plano** — RO/RR por trade, max trades/dia, stop operacional diário (vermelho), meta operacional diária (verde), texto de execução explicando "{N} trades × 1 contrato OU 1 trade × {N} contratos — mesma distância em pontos — não reduzir stop/target para compensar"
  3. **Ritmo de acumulação** — EV diário rotulado explicitamente como "contexto, não meta"
- Tooltip `Info` supérfluo removido da "Meta diária" (texto dos 3 blocos torna a explicação redundante)
#### Adicionado
- 4 testes novos em `propPlanDefaults.test.js` cobrindo: periodGoal Apex CONS_B 2.4%, Ylos Challenge 2.4%, rejeita 0.3% (EV), abstract mode fallback `periodStop × RR = 4%`. Total de testes do arquivo: 14 (era 10)

### [1.26.3] - 11/04/2026
**Issue:** #136 (fix: Plano sugerido em contas PROP — Fase C templates Ylos + engine phase-aware)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fase:** C (E4) — encerramento de #136. Último commit antes do PR único A+B+C.
#### Adicionado
- **`PROP_FIRMS.YLOS`** + label "Ylos Trading" + `YLOS_BASE` (feeModel ONE_TIME, consistência Funded 40%, min 10 trading days, 7 qualifying days com $50+ min profit, payout 100% até $15K / 90% após, min balance saque DD + $100)
- **7 templates Ylos em `DEFAULT_TEMPLATES`**: 6 Challenge (25K/50K/100K/150K/250K/300K) com `drawdown: TRAILING_EOD` e `fundedDrawdown: TRAILING_TO_STATIC` (staticTrigger 100); 1 Freedom 50K com EOD em ambas fases e consistência/newsTrading afrouxados
- **`getActiveDrawdown(template, phase)`** — helper que resolve qual config de drawdown está ativa baseado na fase da conta. EVALUATION → `template.drawdown`. SIM_FUNDED/LIVE → `template.fundedDrawdown ?? template.drawdown` (back-compat para Apex e mesas sem funded diferenciado)
- **Engine `calculateDrawdownState` aceita `phase` como arg** — default cascata `phase arg → propFirm.phase → 'EVALUATION'`. Todas as leituras de `drawdownType/maxAmount/lockAt/lockFormula/staticTrigger` passam a consumir `activeDrawdown` resolvido (não mais `template.drawdown.*` direto)
- 6 testes phase-aware: EVAL lê drawdown, SIM_FUNDED lê fundedDrawdown, LIVE idem, phase ausente cai em EVAL, Apex sem fundedDrawdown em phase SIM_FUNDED usa drawdown default (regressão zero), trail sobe antes do trigger em Ylos SIM_FUNDED
#### Corrigido
- **Gap de Fase B:** `functions/index.js:361-374` não persistia `trailFrozen` em `account.propFirm.trailFrozen` — CF agora grava o campo junto com os demais via `t.update` (conta perderia o estado congelado ao reiniciar engine sem isto)
- **CF passa `phase: propFirm.phase`** ao chamar `calculateDrawdownState` — contas existentes com phase `'EVALUATION'` preservam comportamento, contas Ylos em SIM_FUNDED/LIVE passam a usar `fundedDrawdown` automaticamente
#### Alterado
- Módulo exportado de `functions/propFirmEngine.js` inclui `getActiveDrawdown` (simetria com `src/utils/`)

### [1.26.2] - 11/04/2026
**Issue:** #136 (fix: Plano sugerido em contas PROP — Fase B engine TRAILING_TO_STATIC)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fase:** B (E5) — novo tipo de drawdown para contas Funded Ylos (Standard/No Fee). Fase C (templates Ylos) em sequência.
#### Adicionado
- **`DRAWDOWN_TYPES.TRAILING_TO_STATIC`** — novo tipo de drawdown. Comporta-se como `TRAILING_INTRADAY` até `newBalance >= accountSize + drawdownMax + staticTrigger`; nesse momento captura `currentDrawdownThreshold = peakBalance - drawdownMax` e congela — threshold não se move mais, peak não se move mais (DEC-PENDING-2)
- **`DRAWDOWN_FLAGS.TRAIL_FROZEN`** — flag emitida uma única vez, no trade em que o trigger é atingido
- **Campo runtime `account.propFirm.trailFrozen: boolean`** (default `false`) — INV-15 aprovado 11/04/2026, extensão do objeto `propFirm` existente
- **Campo template `template.drawdown.staticTrigger: number`** (opcional, default 100) — distância em USD acima do lucro mínimo viável que dispara o freeze
- 10 testes novos cobrindo: trail sobe antes do trigger, freeze exato no trigger, freeze após salto, balance cai após freeze, balance sobe após freeze (não reabre), bust detection com threshold congelado, flag emitida uma única vez, staticTrigger custom, staticTrigger ausente (default 100), regressão Apex EOD (path antigo intocado)
#### Alterado
- `calculateDrawdownState` ganha branches condicionais isoladas para TRAILING_TO_STATIC — paths existentes (STATIC, TRAILING_INTRADAY, TRAILING_EOD, TRAILING_WITH_LOCK) **permanecem intocados** (regressão zero confirmada por teste dedicado)
- `functions/propFirmEngine.js` espelha o novo branch (DT-034 — duplicação consciente até monorepo workspace)

### [1.26.1] - 11/04/2026
**Issue:** #136 (fix: Plano sugerido em contas PROP — incoerência semântica meta vs RO + inclusão Ylos)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fase:** A (E1+E2+E3) — correção semântica UI. Fases B (engine TRAILING_TO_STATIC) e C (templates Ylos) em sequência.
#### Adicionado
- `src/utils/propPlanDefaults.js` — função pura `computePropPlanDefaults(attackPlan, initialBalance)` deriva defaults do plano a partir do attack plan da conta PROP (DEC-PENDING-1)
- Tooltip `Info` na "Meta diária" do preview do attack plan (AddAccountModal) — explica que é ritmo médio de acumulação, não target por trade (E2)
- Linha condicional "Daily loss mesa (hard limit)" no resumo do plano (PlanManagementModal passo 3) — aparece apenas quando `suggestedPlan.dailyLossLimit > 0`, oculta em contas Ylos Challenge (E3)
- `DebugBadge` em `AddAccountModal` e `PlanManagementModal` (INV-04 — dívida antiga quitada)
- 10 testes unitários para `computePropPlanDefaults` cobrindo Apex execution, Ylos execution, modo abstract Apex, modo abstract Ylos, fallback chain, rrTarget, riskPctPerOp
#### Corrigido
- **Semântica crítica:** `periodStopPct` do plano PROP agora é derivado de `roPerTrade × maxTradesPerDay` (attack plan), não mais `dailyLossLimit` da mesa. Cenário Apex EOD 25K MNQ CONS_B agora mostra stop diário de 1.2% ($300) em vez de 2% ($500) — aluno não opera mais com RR invertido (E1, AccountsPage.jsx:472-476)
- Ylos Challenge (sem daily loss) passa a ter `periodStopPct` correto (1.2% no cenário 25K) em vez do fallback arbitrário 2%
#### Alterado
- `AccountsPage.jsx` auto-abertura do modal de plano após criação de conta PROP consome `computePropPlanDefaults` (função extraída, testável)

### [1.26.0] - 10/04/2026
**Issue:** #93 (feat: Order Import V1.1 redesign)
**Epic:** #128 (Pipeline Unificado de Import de Ordens)
**Milestone:** v1.1.0 — Espelho Self-Service
#### Adicionado
- Criação automática de trades após confirmação no staging review — sem painel intermediário (DEC-063)
- `enrichTrade` no tradeGateway — enriquecimento de trade existente com `_enrichmentSnapshot` inline (DEC-064)
- `categorizeConfirmedOps` — particiona ops em 3 grupos sem limbo (DEC-065)
- `createTradesBatch` helper com throttling ≤20 paralelo / >20 sequencial (DEC-066)
- `CreationResultPanel` — display read-only de trades criados automaticamente
- `AmbiguousOperationsPanel` — MVP informativo para ops com 2+ trades correlacionados
- `TradeStatusBadges` — badges "Importado" (blue) + "Complemento pendente" (amber) em TradesList, TradeDetailModal, ExtractTable, FeedbackPage (DEC-067)
- Labels STEP DONE consumindo `importSummary` (contagens corretas, não parse cheia)
- Flag `lowResolution` na parse + propagação nos trades (shadow behavior futuro)
- `orderKey.js` — chave canônica de ordem (single source of truth para filtro)
- 10 testes de integração end-to-end + 70 testes unitários novos (953 total)
#### Alterado
- `MatchedOperationsPanel` — "Aceitar enriquecimento" substitui "DELETE+CREATE"
- `handleStagingConfirm` refatorado — criação automática + confronto enriquecido
#### Removido
- `GhostOperationsPanel` (botão manual de criação)
- `identifyGhostOperations`, `prepareBatchCreation`, `identifyMatchedOperations`, `prepareConfrontBatch` (substituídos)
- `handleUpdateMatched` (DELETE+CREATE) — substituído por `enrichTrade`
- CrossCheckDashboard do OrderImportPage (movido para #102)

### [1.25.0] - 09/04/2026
**Issue:** #52 (epic: Gestão de Contas em Mesas Proprietárias)
**Milestone:** v1.1.0 — Espelho Self-Service
**Fases:** 1 (Templates/Config/Plano rule-based) + 1.5 (Instrument-aware + 5 perfis + viabilidade) + 2 (Engine Drawdown + CFs)
#### Adicionado
- **Collection raiz `propFirmTemplates`** (INV-15 aprovado) — catálogo com 21 templates pré-configurados: Apex EOD 25K-300K, Apex Intraday, MFF Starter/Core/Scale, Lucid Pro/Flex, Tradeify Select 25K-150K
- **`PropFirmConfigPage`** (Settings → aba Prop Firms) — mentor seed/edit/delete templates, agrupado por firma, botão "Limpar Todos"
- **`src/constants/instrumentsTable.js`** — 23 instrumentos curados (equity_index, energy, metals, currency, agriculture, crypto) com ATR real TradingView v2, point value, micro variants, availability por firma, session profiles (AM Trades framework)
- **`src/constants/propFirmDefaults.js`** — constantes `PROP_FIRM_PHASES`, `DRAWDOWN_TYPES`, `FEE_MODELS`, `DAILY_LOSS_ACTIONS`, `ATTACK_PLAN_PROFILES` (5 códigos), `ATTACK_PROFILES` (5 perfis com metadata), `MIN_VIABLE_STOP` por type, `MAX_STOP_NY_PCT=75`, `NY_MIN_VIABLE_STOP_PCT=12.5`, `normalizeAttackProfile()` legacy compat
- **`src/utils/attackPlanCalculator.js`** — plano de ataque determinístico 5 perfis instrument-aware: `roUSD = drawdownMax × profile.roPct`, `stopPoints = roUSD / instrument.pointValue` back-calculado, RR fixo 1:2, `lossesToBust`, `evPerTrade`, viabilidade por 3 critérios + sugestão de micro, restrição sessão NY (`nySessionViable`, `recommendedSessions`) (DEC-060, DEC-061)
- **`src/utils/propFirmDrawdownEngine.js`** — engine puro 4 tipos de drawdown (STATIC, TRAILING_INTRADAY, TRAILING_EOD, TRAILING_WITH_LOCK), `resolveLockAt()` com lockFormula `BALANCE + DD + 100`, `calculateDrawdownState()`, `initializePropFirmState()`, `calculateEvalDaysRemaining()`, 5 flags (`ACCOUNT_BUST`, `DD_NEAR`, `DAILY_LOSS_HIT`, `LOCK_ACTIVATED`, `EVAL_DEADLINE_NEAR`)
- **`functions/propFirmEngine.js`** — cópia CommonJS do engine para Cloud Functions (DEC-062, DT-034)
- **CF `onTradeCreated/onTradeUpdated/onTradeDeleted` estendidas** — branch prop firm com `runTransaction` (atomicidade peakBalance), helpers `recalculatePropFirmState`, `appendDrawdownHistory`, `notifyPropFirmFlag` throttled 1×/dia/flag via doc id determinístico
- **Subcollection `accounts/{accountId}/drawdownHistory/{tradeId}`** — append-only audit log (INV-15 aprovado)
- **Campo `propFirm` inline em `accounts`** — templateId, firmName, productName, phase, evalDeadline, selectedInstrument, suggestedPlan + runtime (peakBalance, currentDrawdownThreshold, lockLevel, isDayPaused, tradingDays, dailyPnL, lastTradeDate, currentBalance, distanceToDD, flags, lastUpdateTradeId)
- **Seletor PROP 2 níveis** no `AccountsPage` (firma → produto) + 5 botões de perfil com tooltip + seletor de instrumento derivado de `getAllowedInstrumentsForFirm`
- **Modal de conta redesenhado** — `max-w-lg` → `max-w-4xl`, layout 2/3 colunas, preview de execução em grid 3 cols
- **Auto-abertura do `PlanManagementModal`** após criar conta PROP com defaults derivados do attackPlan (currency dinâmica, cycleGoalPct/cycleStopPct/periodGoalPct/periodStopPct derivados)
#### Corrigido
- **Bug crítico ATR alucinado (instrumentsTable v1)** — 13 valores corrigidos com ATR real TradingView v2 (ES 55→123, NQ 400→549, YM 420→856, RTY 30→70, CL 2.5→9.11, GC 40→180, SI 0.60→5.69, 6B/6J/ZC/ZW/ZS/MBT). Bug MES Apex 25K CONS_B 30pts: antes 90.9% do range NY (INVIÁVEL), agora 40.65% (VIÁVEL day trade) ✅
- **Bug `availableCapital` dobrado no PlanManagementModal** — flag `__isDefaults: true` em propPlanDefaults evita que `currentPlanPl` dobre o saldo em conta PROP nova
- **Currency BRL fixa no PlanManagementModal** — agora deriva `accountCurrency` da conta selecionada, símbolo dinâmico US$/€/R$
- **Edit modal não rehydratava propFirm** — `openModal(account)` agora seta `propFirmData` a partir de `account.propFirm` quando existe
#### Testes
- **905 testes totais** (58 engine drawdown + 52 attackPlan calculator + 46 instrumentsTable + 749 pré-existentes) — zero regressão
- Cobertura engine drawdown: 4 tipos × cenários, lock Apex, daily loss soft, distanceToDD edge cases, cenário integrado eval realista 5 dias
- Cobertura attackPlan: 5 perfis × instrumentos, viabilidade, sugestão micro, restrição NY, validação operacional Apex 25K MNQ CONS_B
- Cobertura instrumentsTable: 46 testes pós-correção ATR v2
#### Infraestrutura
- **CF bump v1.9.0 → v1.10.0** com CHANGELOG header
- **`firestore.rules`** — regras para `propFirmTemplates` (mentor write) + subcollection `accounts/{id}/drawdownHistory` (read autenticado, write false apenas CF admin SDK)
- **CHUNK-17 Prop Firm Engine** locked para #52 no registry (§6.3)
#### Decisões
- DEC-053 — Escopo revisado com regras Apex Mar/2026
- **DEC-060** — 5 perfis determinísticos instrument-aware com RR fixo 1:2
- **DEC-061** — Restrição sessão NY threshold 12.5%
- **DEC-062** — Engine duplicado Opção A (DT-034 registra refactoring futuro)
#### Dívida técnica nova
- **DT-034** — Unificar engine prop firm via build step ou monorepo workspace
- **DT-035** — Re-medir ATR de NG/HG/6A no TradingView (não incluídos no v2)
#### Limitações v1 documentadas
- `onTradeUpdated` aplica delta incremental, NÃO reconstrói histórico do peakBalance (trade editado antigo pode dessincronizar)
- `onTradeDeleted` aplica reversão mas NÃO remove snapshot do drawdownHistory (append-only audit log — análises filtram por tradeId existente)
- Pre-read `account.get()` em todos os trades (~50ms overhead para non-PROP — aceito v1, monitorar)
#### Pendente (fases futuras)
- **Fase 2.5** — CF `generatePropFirmApproachPlan` com Sonnet 4.6 (prompt v1.0 em `Temp/ai-approach-plan-prompt.md`)
- **Fase 3** — Dashboard card prop + gauges + alertas visuais (depende CHUNK-04 unlock #93)
- **Fase 4** — Payout tracking + qualifying days + simulador de saque
#### Deploys realizados
- `firebase deploy --only firestore:rules` — 09/04/2026 (subcollection drawdownHistory)
- `firebase deploy --only functions:onTradeCreated,onTradeUpdated,onTradeDeleted` — 09/04/2026 (v1.10.0)
- Validado ao vivo na conta `gJ3zjI9OoF5PqM2puV0H` (Apex EOD 25K)

### [1.24.0] - 05/04/2026
**Issues:** #122 (feat: Fluxo de caixa — previsão de renovações), #123 (feat: Campo WhatsApp no student)
**Milestone:** v1.2.0 — Mentor Cockpit
#### Adicionado
- `RenewalForecast` — componente de projeção mensal de receita por renovação na SubscriptionsPage
- `groupRenewalsByMonth` helper — agrupa subscriptions ativas paid por mês de vencimento (endDate), soma amount
- `formatDateBR` (UTC-safe) e `formatBRL` helpers em `renewalForecast.js`
- Campo `whatsappNumber` (string) no doc `students` — edição inline na StudentsManagement
- `validateWhatsappNumber` helper — validação E.164 (10-15 dígitos, sanitização de formatação)
- 31 testes novos (14 whatsapp validation + 17 renewal forecast + formatação BRL/datas BR)

### [1.23.0] - 05/04/2026
**Issue:** #94 (feat: Controle de Assinaturas da Mentoria)
**Milestone:** v1.2.0 — Mentor Cockpit
#### Adicionado
- `SubscriptionsPage` — gestão de assinaturas: tabela, filtros status/tipo, modais criar/editar/pagamento/histórico
- `SubscriptionSummaryCard` — card semáforo no dashboard mentor (ativos/vencendo/inadimplentes)
- `useSubscriptions` hook — CRUD completo via `collectionGroup('subscriptions')` + subcollection writes
- CF `checkSubscriptions` (onSchedule 8h BRT) — detecta vencimentos, marca overdue, expira trials, sincroniza `accessTier`, envia email ao mentor
- Subcollection `students/{id}/subscriptions` com subcollection `payments` (DEC-055)
- Campo `type: trial/paid`, `trialEndsAt`, `billingPeriodMonths`, `accessTier` (DEC-056)
- Upload de comprovante (imagem/PDF) via file input + paste no registro de pagamento
- `DateInputBR` — input de data DD/MM/AAAA com calendário nativo (INV-06)
- Payment registra `plan` vigente no momento (histórico de upgrade/downgrade)
- Firestore rules para subcollection + collectionGroup (mentor read/write)
- Storage rules para `subscriptions/**`
- 52 testes (grace period, trial expiration, accessTier, receita, formatBrDate, isoToBr, billingPeriodMonths)
#### Deploys realizados
- `firebase deploy --only firestore:rules` — 04/04/2026
- `firebase deploy --only storage` — 04/04/2026

### [1.22.1] - 03/04/2026
**Issue:** #89 (fix: Aluno não consegue deletar próprio plano)
#### Corrigido
- `firestore.rules`: rule de `plans/{planId}` simplificada para `isAuthenticated()` (DEC-025)
- `firestore.indexes.json`: índice composto `movements` (accountId + date + createdAt) adicionado — query do `useMovements` falhava silenciosamente
#### Descoberto durante investigação
- #120: `deletePlan` cascade não recalcula `currentBalance` (race condition em CFs) — issue aberto

### [docs] - 03/04/2026
**Sessão:** Design Dashboard-Aluno MVP + backlog de issues + protocolo de chunks
**Issues criadas:** #106-#117 (12 issues via gh CLI)
#### Adicionado
- #3 reescrito como épico Dashboard-Aluno MVP com contexto unificado e views reativas
- DEC-047 a DEC-052 no decision log
- INV-14: Versionamento obrigatório do PROJECT.md (semver + histórico + detecção de conflito)
- CHUNK-13 (Context Bar), CHUNK-14 (Onboarding Auto), CHUNK-15 (Swing Trade), CHUNK-16 (Mentor Cockpit) no registry
- Descrições em todos os chunks (registry expandido com coluna Descrição)
- Shared infrastructure: StudentContextProvider, compliance.js, useComplianceRules adicionados
- Protocolo de contenção para sessões paralelas (seção 6.2)
- Campo "Chunks necessários" obrigatório no template de issue (seção 4.0)
- Seção 6 (Chunks) no template do issue-NNN.md com modo leitura/escrita
- Protocolo de abertura reescrito: starta automático em sessão de código, verificação de chunks obrigatória
#### Decisões-chave
- Barra de Contexto Unificado como fundação do Dashboard-Aluno (DEC-047)
- Onboarding Automatizado: CSV → indicadores → Kelly → plano sugerido (DEC-051)
- Overtrading por clustering temporal (DEC-048)
- Desvio padrão como métrica de consistência (DEC-050)
- Chunks obrigatórios no issue, modo leitura/escrita, lock exclusivo (DEC-052)
#### Mockups
- Arquitetura de informação Dashboard-Aluno (barra de contexto + sidebar + views)
- View Resumo detalhada (6 seções + KPIs + ciclos anteriores)

### [1.22.0] - 01/04/2026
**Issue:** #96 (debt: Node.js 20→22 Cloud Functions)
#### Alterado
- `functions/package.json`: `engines.node` de `"20"` para `"22"`
- `functions/package.json`: `firebase-functions` de `"^4.5.0"` para `"^5.1.0"`
#### Resolvido
- DT-016: Cloud Functions Node.js 20 → 22
- DT-028: firebase-functions SDK 4.5 → 5.1
#### Notas
- SDK 5.x mantém compatibilidade com imports `firebase-functions/v1` (index.js) e `firebase-functions/v2/https` (assessment modules)
- Sem mudança de signatures — todas as 18 CFs mantêm a mesma API
- 755 testes passando

### [docs] - 29/03/2026
**Sessão:** Branding, portal institucional, reestruturação de tiers
**Issue:** #100 (criação)
#### Adicionado
- `docs/dev/issues/issue-100-espelho-self-service.md` — épico modo self-service
- `docs/marcioportes_portal_v2_0.md` — documento de referência do portal institucional
- DEC-029 a DEC-038 no decision log (naming, tiers, Fibonaccing, rename, SWOT)
- Milestone v1.3.0 (Espelho Self-Service + Rename) no roadmap
- Milestone Portal marcioportes.com.br (Maio-Junho 2026) no roadmap
- DT-027 (Rename externo Espelho) e DT-028 (firebase-functions SDK) nas dívidas técnicas
#### Decisões-chave
- Marca pessoal "Marcio Portes", framework "Modelo Portes", plataforma "Espelho", mentoria "Mentoria Alpha"
- Dois tiers: self-service (KPIs + diário + gates) vs Alpha (+ ciclos + assessment + SWOT + feedback)
- SWOT dinâmico exclusivo Alpha — analisa KPIs, diagnostica por gate, prescreve evolução
- KPIs alimentam nota de evolução (gates) para ambos tiers
- Fibonaccing (100h+ conteúdo gratuito) como motor de aquisição principal
- Rename externo via custom domain + UI, sem refactoring de codebase

### [1.21.5] - 30/03/2026
**Issue:** #92 (fix probing rehydration)
#### Corrigido
- `useProbing` rehydrata `savedQuestions` do Firestore ao retornar à página — resolve loop onde aluno via "Começar" repetidamente
- `effectiveStatus` detecta `onboardingStatus === 'ai_assessed'` com `savedProbing.questions` existente e trata como `probing`
- Badge de status, tabs e tab highlight usam `effectiveStatus`
#### Adicionado
- `src/utils/probingUtils.js` — `calculateRehydrationIndex` (função pura, testável)
- 6 testes unitários: `probingRehydration.test.js`
#### Decisão
- DEC-043: useProbing rehydrata do Firestore + effectiveStatus

### [1.21.4] - 29/03/2026
**Issue:** #097 (complemento)
#### Adicionado
- Painel "Perguntas do Aprofundamento" colapsável no AIAssessmentReport (v1.3.0)
- `saveReportData` em useAssessment — persiste reportData no Firestore
- Rehydration de reportData (developmentPriorities, profileName, reportSummary) no refresh
- Etapa 3 no Re-processar IA — regenera relatório completo com developmentPriorities
#### Corrigido
- CF generateAssessmentReport: `probingData.summary.flagsResolved` (era `probingData.flagsResolved` → undefined)
- Prompt alterado para "mínimo 1, máximo 3" prioridades de desenvolvimento
#### Alterado
- Seção 4.4 do PROJECT.md reescrita: "Diretriz Crítica de Verificação" com protocolo expandido

### [1.21.3] - 28/03/2026
**Sessão:** issue-097 open responses AI report  
**Issue:** #097
#### Adicionado
- Seção "Respostas Abertas — Análise IA" no AIAssessmentReport (mentor only)
- 4 grupos colapsáveis por dimensão: texto do aluno + score IA + classificação + confiança + aiFinding + aiJustification
- Indicador "Aguardando processamento IA" para respostas não processadas
- `groupOpenResponsesByDimension` exportada para testes
- Testes unitários: `openResponsesFilter.test.js` (9 casos)

---

### [1.21.2] - 26/03/2026
**Sessão:** consolidação documental + fix labels UI  
**Issue:** #92 (pós-merge)
#### Corrigido
- Rename "Marco Zero" → "Perfil de Maturidade" em `BaselineReport` header e `Sidebar` label
- stageDiagnosis card movido para full-width (fora do grid 2×2)

---

### [1.21.1] - 25/03/2026
**Sessão:** CHUNK-09 fix guard rehydration
#### Corrigido
- Guard `if (assessmentScores) return` bloqueava rehydration de stageDiagnosis — removido
- stageDiagnosis rehydrata independentemente do estado de assessmentScores

---

### [1.21.0] - 25/03/2026
**Sessão:** CHUNK-09 fixes
#### Adicionado
- `useAssessment.saveStageDiagnosis` — persiste diagnóstico no doc `questionnaire`
- Rehydration de stageDiagnosis no useEffect ao reabrir a página
- TraderProfileCard Maturidade usa escala cromática por stage (não score numérico)

---

### [1.20.x] - 25/03/2026
**Sessão:** CHUNK-09 onboarding UX completo (v1.20.1 a v1.20.9)
#### Adicionado
- BaselineReport v2.0 — régua 4D, grid 2×2, plano do mentor
- MentorValidation v1.1 — prioridades editáveis pré-carregadas da IA
- IncongruenceFlags v2.0 — labels semânticos, master/detail, respostas reais
- Prompt classifyOpenResponse reescrito com Trader Evolution Framework completo
- Re-processar IA (questionário + probing)
- Dimensão "Experiência" renomeada para "Maturidade" em toda UI
- "Perfil de Maturidade" no sidebar do aluno (hasBaseline=true)
- stageDiagnosis persistido e rehydratado
#### Corrigido
- Fix saveInitialAssessment stale closure (DEC-026)
- Fix loop infinito AssessmentGuard

---

### [1.20.0] - 22/03/2026
**Issue:** #87 (CHUNK-10 mergeado)
#### Adicionado
- Order Import Pipeline — parse ProfitChart-Pro CSV, reconstrução de operações net-position-zero, staging review, cross-check comportamental, KPI validation

---

### [1.19.7] - Mar/2026
#### Adicionado
- Badge notificação REVIEWED no Sidebar do aluno

---

### [1.19.x] - Mar/2026
#### Adicionado
- v1.19.6: Payoff semáforo edge health, semáforo RO bidirecional, PL tricolor
- v1.19.5: Layout 3 painéis agrupados, tooltips diagnósticos, NaN guards
- v1.19.4: riskPercent usa plan.pl (DEC-009)
- v1.19.3: RR 2 decimais, resultInPoints override, status feedback no extrato
- v1.19.2: RR assumido via plan.pl (DEC-007), Guard C4 removido
- v1.19.1: Compliance sem stop (DEC-006), CSV tickerRule, PlanAuditModal
- v1.19.0: RR assumido, PlanLedgerExtract RO/RR + feedback nav

---

### [1.18.x] - Mar/2026
- v1.18.2: Fix locale pt-BR todas as moedas
- v1.18.1: Inferência direção CSV, parseNumericValue, Step 2 redesign
- v1.18.0: CSV Import v2 — staging collection, csvParser, csvMapper, csvValidator

---

### [1.17.0 e anteriores] - Jan-Mar/2026
- v1.17.0: Cycle navigation, gauge charts, period selectors
- v1.16.0: State machine plano, PlanLedgerExtract
- v1.15.0: Multi-currency, StudentDashboard partition
- v1.0-1.14: Scaffolding, 42 issues, arquitetura base, emotional system v2.0

---

## 11. MAPA DE DEPENDÊNCIAS

### Collections Firestore e consumidores

```
trades (collection principal)
├── Escritor: addTrade — GATEWAY ÚNICO (INV-02)
├── CFs: onTradeCreated, onTradeUpdated
├── Campo _partials: array INLINE no documento (INV-12) — NÃO subcollection
└── Consumers: StudentDashboard, TradingCalendar, AccountStatement, FeedbackPage,
               PlanLedgerExtract, MentorDashboard

plans → cycles, currentCycle, state machine (IN_PROGRESS→GOAL_HIT/STOP_HIT→POST_GOAL/POST_STOP)
accounts → currency, balance, broker
emotions → scoring -4..+3 normalizado 0-100, TILT/REVENGE detection
csvStagingTrades → staging CSV, nunca dispara CFs diretamente
orders → staging de ordens brutas (CHUNK-10)
students/{id}/assessment/ → questionnaire, probing, initial_assessment (CHUNK-09)
students/{id}/subscriptions → type, status, accessTier, payments subcollection (DEC-055/056)
  └── payments → amount, date, proof, plan vigente no momento
```

### Cloud Functions

| Function | Trigger | Responsabilidade |
|----------|---------|-----------------|
| `onTradeCreated` | trades create | Atualiza PL do plano, compliance stats |
| `onTradeUpdated` | trades update | Recalcula PL, compliance |
| `classifyOpenResponse` | callable | Classifica respostas abertas via API Claude |
| `generateProbingQuestions` | callable | Gera 3-5 perguntas de sondagem adaptativa |
| `analyzeProbingResponse` | callable | Analisa respostas do probing |
| `generateAssessmentReport` | callable | Gera relatório completo pré-mentor |
| `checkSubscriptions` | onSchedule (8h BRT) | Detecta vencimentos, marca overdue, expira trials, sincroniza accessTier, envia email |

---

## 12. CONVENÇÕES DE DESENVOLVIMENTO

### Branches e commits
```
feature/issue-NNN-descricao   ← nova feature ou refactor
fix/issue-NNN-descricao       ← bug fix
debt/issue-NNN-descricao      ← dívida técnica
arch/issue-NNN-descricao      ← mudança arquitetural
```

Commit messages em linha única (bash):
```
feat: descrição da feature (issue #NNN)
fix: descrição do fix (issue #NNN)
debt: descrição da dívida resolvida (issue #NNN)
docs: atualizar PROJECT.md sessão DD/MM/YYYY
```

### Classificação de issues (prefixo no título)
```
feat:   nova funcionalidade
fix:    correção de bug
debt:   dívida técnica / tech debt
arch:   decisão arquitetural / refactor estrutural
ops:    infra, deploy, Cloud Functions, Node.js
epic:   agrupa outros issues (não implementável diretamente)
```

### Testes
- Framework: Vitest + jsdom
- Localização: `src/__tests__/utils/` para novos utils
- Padrão: bug fix → reproduzir bug em teste → corrigir → teste passa
- Nunca regressão — testes existentes devem continuar passando

### UI
- Theme: Glassmorphism dark
- DebugBadge: obrigatório em tudo, com `component="NomeExato"`
- Datas: DD/MM/YYYY sempre
- Semana: começa na segunda-feira

---

## 13. IMPLEMENTAÇÃO AUTÔNOMA

> Seção formalizada em 21/04/2026 (v0.25.0) após sessão de design de 5+ horas consolidando bugs 1-10, validando arquitetura 3-tier, INVs 26 amendment / 27 / 28, e arquitetura de notificação por email.
> 
> Esta seção é a SPEC TEXTUAL do modo autônomo. A implementação dos scripts python (`cc-notify-email.py`, `cc-validate-task.py`) e o refactor de `cc-worktree-start.sh` exigem issue formal própria (INV-07/09). O protocolo pode ser executado em modo degradado (email manual) enquanto os scripts não existem — o gate humano continua funcionando via RC em CC-Interface.

### 13.1 Objetivo

Executar issues do projeto em modo autônomo: Marcio dispara "atacar #NNN em modo autônomo", três sessões Claude se coordenam (Interface / Coord / Worker), PR fica pronto para review manual. Gates humanos por email. Zero polling, custo 0 quando idle.

### 13.2 Modo Autônomo vs Modo Interativo

**O modo autônomo é opt-in explícito.** O modo **padrão do projeto continua sendo o modo interativo** (§4.0 — pair programming assíncrono com coder, bundle formal INV-19 descartado em v0.22.2).

**Triggers:**
- Marcio diz "atacar #NNN em modo autônomo" (ou variante "em modo autônomo") → Fase 1 desta seção
- Qualquer outro fraseamento → modo interativo (§4.0)
- Na dúvida, a sessão PERGUNTA. Autônomo nunca é assumido.

**Quando usar AUTÔNOMO:**
- Issue bem desambiguado (spec claro, decisões estruturais já fechadas)
- Trabalho paralelizável em tasks de 1-5 commits cada (~30-90min por task)
- Marcio quer se ausentar (noite, outro compromisso)
- Escopo mecânico (refactor, add tests, migração, bulk rename, atualização em massa)

**Quando usar INTERATIVO (§4.0):**
- Design em discovery (ambiguidade estrutural ainda não resolvida)
- Debugging com hipótese incerta
- Feature pequena (1 commit, <30min)
- Marcio disponível para pair em tempo real

**Regra prática:** se a conversa precisa de deliberação livre entre Marcio e CC, é interativo. Se pode ser reduzida a "tasks pré-especificadas + gates humanos pontuais", é autônomo.

### 13.3 O Que É Universal (Aplica aos Dois Modos)

INV-27 + bloco CLAIMS + `cc-validate-task.py` **não são exclusivos do modo autônomo**. Aplicam-se sempre que CC executa tasks sem supervisão humana ativa — inclui delegações durante modo interativo ("vai implementando isso enquanto eu faço outra coisa"). No interativo, o CC roda `cc-validate-task.py` contra o próprio commit antes de relatar "pronto"; se fail → para e sinaliza.

Seção `§3.2 Decisões Autônomas` no control file do issue também é universal: registra qualquer decisão tomada pelo CC sem consulta explícita ao Marcio, independentemente do modo.

### 13.4 Atores

| Ator | Papel | Lifetime | Modo | TTY/RC |
|------|-------|----------|------|--------|
| **Marcio** | humano | persistente | — | celular/desktop |
| **CC-Interface** | endpoint humano; setup; desambiguação; relay de respostas | persistente em tmux durante toda a issue | interativo | ✅ TTY via tmux, RC-atachada |
| **CC-Coord** | orquestrador; despacha workers; valida entregas; decide ambiguidades autônomas; notifica humano | **efêmero — 1 ciclo por wake-up via `--resume`** | `-p` headless | ❌ |
| **CC-Worker** | executor stateless; uma task por vida | **efêmero — 1 task** | `-p` headless | ❌ |

**Invariante de vida:** Coord e Worker SEMPRE morrem após emitir seu artefato. Wake-up sempre via `claude --resume <session-id>`.

### 13.5 Canais de Comunicação

| Origem → Destino | Canal | Mecanismo |
|------------------|-------|-----------|
| Marcio ↔ CC-Interface | tmux + RC | padrão Claude Code |
| CC-Interface → CC-Coord | `coord-inbox/human-response-<N>.md` + `claude --resume <coord-id> --permission-mode auto -p "HUMAN_GATE_RESOLVED ref=<path>"` | flock 30s no `coord.lock` |
| CC-Coord → CC-Worker | `inbox/<N>.md` + listener tmux detecta arquivo novo | listener `cc-NNN` |
| CC-Worker → CC-Coord | `outbox/<N>-result.log` + `<N>-report.md` (com CLAIMS) + `claude --resume <coord-id> -p "TASK_DELIVERED N=<N>"` | flock 30s |
| CC-Coord → Marcio (gate) | email iCloud SMTP via `cc-notify-email.py` | canal primário (INV-28) |
| CC-Coord → Marcio (urgente opcional) | WhatsApp Evolution API | só se Docker up; skip silent caso contrário |

### 13.6 Ownership de Diretórios `.cc-mailbox/`

- `inbox/` — CC-Coord escreve, listener lê
- `outbox/` — CC-Worker escreve; CC-Coord lê via TASK_DELIVERED; CC-Interface lê em STOPs
- `coord-inbox/` — CC-Interface escreve; CC-Coord lê via HUMAN_GATE_RESOLVED
- `locks/coord.lock` — flock advisório, qualquer ator antes de `--resume`
- `notify-scratch/` — CC-Coord escreve scratch JSONs antes de invocar `cc-notify-email.py`
- `log/` — auditoria de emails enviados (rate limit + histórico)
- `.coord-id` — gravado pelo start script, READ-ONLY para todos (INV-26)

### 13.7 Topologia de Armazenamento

```
~/cc-mailbox/                        # GLOBAL — reutilizado por todas as issues
├── bin/
│   ├── cc-notify-email.py           # helper único de email
│   ├── cc-validate-task.py          # validator INV-27
│   ├── cc-notify-whatsapp.sh        # opcional, check Docker interno
│   └── cc-worktree-start.sh         # refactor para suportar Interface/Coord/Worker
├── log/emails.log                   # auditoria global (rate limit + histórico)
└── .env                             # EMAIL_PASSWORD iCloud

~/projects/issue-NNN/.cc-mailbox/    # POR-ISSUE — dentro do worktree
├── inbox/<N>.md                     # CC-Coord escreve, listener lê
├── outbox/<N>-result.log            # CC-Worker escreve (log curto, token-eficiente)
├── outbox/<N>-report.md             # CC-Worker escreve (report + bloco CLAIMS)
├── coord-inbox/human-response-<N>.md # CC-Interface escreve, CC-Coord lê
├── locks/coord.lock                 # flock advisório antes de qualquer --resume
├── notify-scratch/<uuid>.json       # CC-Coord escreve antes de invocar email
├── log/emails-<data>.log            # auditoria per-issue
├── .coord-id                        # session_id do CC-Coord, READ-ONLY (INV-26)
└── .coord-dir                       # worktree path absoluto, gravado pelo cc-worktree-start.sh,
                                     # READ-ONLY depois. Consumido pelo listener antes de `claude --resume`.
                                     # Mesma disciplina READ-ONLY da INV-26 (amendment v0.26.0).
                                     # Divergência main vs worktree → --resume falha silenciosa
                                     # (JSONL em project-scope errado). Bug observado na rodada #164.
```

### 13.8 Fluxo das 6 Fases

#### Fase 1 — Setup (NO MAIN, auto mode ON, RC OFF)

| # | Ator | Ação |
|---|------|------|
| 1 | Marcio → CC-Interface | "Atacar issue #NNN em modo autônomo" |
| 2 | CC-Interface | Confirma protocolo, ativa INV-27, avisa que RC só ativa depois |
| 3 | CC-Interface | §4.0 NO MAIN: verifica versão PROJECT.md (INV-14), `gh issue view NNN`, valida chunks §6.3 |
| 4 | CC-Interface | NO MAIN: registra locks + reserva próximo minor em `version.js` |
| 5 | CC-Interface | Commit no main: `docs: registrar locks + reservar vX.Y.Z para issue-NNN` |
| 6 | CC-Interface | `git worktree add ~/projects/issue-NNN -b tipo/issue-NNN-descricao` |
| 7 | CC-Interface | `cd worktree`, cria `docs/dev/issues/issue-NNN-*.md`, preenche §1-3, §6 |
| 8a | CC-Interface | Cria `.cc-mailbox/{inbox,outbox,coord-inbox,locks,notify-scratch,log}/` |
| 8b | CC-Interface | **Pré-condição dura: cwd = `~/projects/issue-NNN`** (herdado do passo 7). Executar do main repo invalida o session_id — JSONL fica em project-scope `-acompanhamento-2-0`, listener do worktree invocando `--resume` falha silenciosa por project-scope mismatch. Comando: `claude --permission-mode auto --output-format json -p "<contexto>; confirme ready e morra"` → captura `coord_session_id` do JSON. Bug observado na rodada #164 (v0.26.0). |
| 8c | CC-Interface | `cc-worktree-start.sh NNN <path> <coord_session_id>` → cria tmux + grava `.coord-id` (INV-26) |
| 8d | CC-Interface | `flock -w 30 locks/coord.lock claude --resume <coord-id> --permission-mode auto -p "DISPATCH_FIRST_TASK"` → coord despacha `inbox/01.md`, morre |

#### Fase 2 — Desambiguação (gate humano único, pesado, upfront)

| # | Ator | Ação |
|---|------|------|
| 9 | CC-Interface | Varredura ativa de ambiguidades no spec |
| 10 | CC-Interface | Aplica INV-18 em bloco: cada ambiguidade = pergunta concreta com opções |
| 11 | Marcio | Responde bloco completo |
| 12 | CC-Interface | Registra em `§3.1 Decisões Antecipadas` do control file |
| 13 | CC-Interface | Re-varre spec; se restar ambiguidade → volta ao 10 |
| 14 | CC-Interface | Decompõe issue em tasks usando spec desambiguada (regra: 1-5 commits, ~30-90min; micro-tasks merge na próxima — heurística, não regra dura) |
| 15-16 | CC-Interface ↔ Marcio | Plano de fases apresentado e aprovado |

#### Fase 3 — Transição

| # | Ator | Ação |
|---|------|------|
| 19 | Marcio | Ativa Remote Mode (auto mode da CC-Interface cai aqui — ok, ela já escreveu tudo) |
| 20 | CC-Interface | Idle no prompt, sem polling, token cost = 0 |

#### Fase 4 — Loop Autônomo (sem humano)

| # | Ator | Ação |
|---|------|------|
| 22 | Listener `cc-NNN` | Detecta `inbox/<N>.md` → `claude -p` headless no worktree |
| 23-25 | CC-Worker | Lê task, edita, testa, commita, grava `outbox/<N>-result.log` + `<N>-report.md` (com bloco CLAIMS — INV-27), **morre** |
| 26 | Listener | `flock -w 30 locks/coord.lock claude --resume <coord-id> --permission-mode auto -p "TASK_DELIVERED N=<N>"` |
| 27 | CC-Coord | Lê `result.log` ANTES do `report.md` (token budget — result.log é ~1KB, report.md ~20-50KB) |
| 28 | CC-Coord | Relê control file (§3.1, §3.2, plano) |
| 29 | CC-Coord | **Roda `cc-validate-task.py`** (INV-27) contra CLAIMS do worker |
| 30 | CC-Coord | Se ambiguidade nova → resolve pela ordem: spec → PROJECT.md → padrão → menor blast radius. Registra em `§3.2 Decisões Autônomas` (DEC-AUTO-NN) |
| 31 | CC-Coord | Decide: OK → `inbox/<N+1>.md` + **morre**. STOP de qualquer tipo → grava STOP-XXX no outbox + invoca `cc-notify-email.py` + **morre**. **Sempre morre.** |

#### Fase 5 — Gate Humano Excepcional (durante loop)

| # | Ator | Ação |
|---|------|------|
| 32 | Marcio | Recebe email no celular |
| 33 | Marcio | Abre Claude Code mobile, RC em CC-Interface |
| 34 | CC-Interface | Lê outbox proativamente quando Marcio digita algo, mostra STOPs |
| 35 | Marcio | Responde em **linguagem natural** ("vai com a A", "explica esse erro", "aborta") |
| 36 | CC-Interface | Interpreta intent. Registra resposta em `§4 Sessões` do control file. Escreve `coord-inbox/human-response-<N>.md` |
| 37 | CC-Interface | `flock -w 30 locks/coord.lock claude --resume <coord-id> --permission-mode auto -p "HUMAN_GATE_RESOLVED ref=<path>"` |
| 38 | CC-Coord | Acorda, lê resposta humana, ajusta plano, despacha próxima task ou aplica correção, **morre** |

#### Fase 6 — Fechamento

| # | Ator | Ação |
|---|------|------|
| 39 | CC-Coord | Última task validada → consolida `§3.2` + relatório de execução → email "FINISHED" |
| 40-42 | Marcio + CC-Interface | Revisa decisões §3.2; contestadas → revert/rebase + task corretiva (rollback **por task**, não por decisão — INV-13 + princípio de unidade indivisível) |
| 43 | CC-Interface | Atualiza control file §5; propõe deltas de PROJECT.md (CHANGELOG, DEC, DT) e `version.js` no control file |
| 44 | CC-Interface | Email "pronto para PR" |
| 45 | Marcio | Aprova → CC-Interface cria PR (com `Closes #NNN`) → Marcio merga manualmente |
| 46 | CC-Interface | §4.3: aplica deltas no main, fecha issue, deleta branch, libera locks §6.3, `git worktree remove`, `rm -rf`, mata tmux |

### 13.9 CLAIMS + Validator (INV-27 operacional)

**Exigência de CLAIMS no briefing do worker (v0.26.0):** todo prompt gravado em `inbox/<N>.md` DEVE conter, próximo à seção de relatório, a cláusula:

> Você DEVE entregar, no `report.md`, bloco `## CLAIMS (machine-readable, do not edit)` em JSON com `commit_hash`, `tests{passed,failed,cmd}`, `files_touched`. Ausência → coord marca STOP-HALLUCINATION automaticamente.

Sem essa cláusula explícita, o worker entrega em formato livre e o validator (`cc-validate-task.py` ou equivalente manual) não tem artefato parseável. Observado na rodada #164: worker E3 entregou sem CLAIMS por omissão da Interface ao compor o briefing — validação INV-27 ficou totalmente manual (`git cat-file -e` + `vitest run`), funcional mas frágil. Template de briefing canônico com cláusula CLAIMS deve ser parte de `~/cc-mailbox/templates/worker-briefing.md` (componente da issue formal futura dos scripts).

**Bloco CLAIMS obrigatório em todo `<N>-report.md` do worker:**

````
## CLAIMS (machine-readable, do not edit)
```json
{
  "commit_hash": "a1b2c3d",
  "tests": {"passed": 1573, "failed": 0, "cmd": "npm test"},
  "files_touched": ["src/utils/foo.js", "src/__tests__/foo.test.js"]
}
```
````

**Regra `tests: skipped`:** permitido APENAS se `files_touched` contém somente `.md` ou `docs/`. Qualquer `.js|.jsx|.ts|.tsx|.cjs|.mjs|functions/**` com `tests: skipped` → STOP-HALLUCINATION.

**`cc-validate-task.py` — 3 checks, <300ms total:**

| Check | Verifica | Falha → |
|-------|----------|---------|
| `commit_exists` | `git cat-file -e <hash>` | STOP-HALLUCINATION |
| `tests_match` | contagem declarada bate com `result.log` | STOP-HALLUCINATION |
| `files_match` | `git show --name-only <hash>` ⊆ `files_touched` declarado | STOP-HALLUCINATION |

Edge cases (símbolos, contagem de linhas, DECs/INVs citadas) caem na revisão humana no fechamento via `§3.2`. Validador é intencionalmente minimalista — cobre alucinação grave, não tuning fino.

### 13.10 Tipos de Email (Gate Humano)

```
Subject: [Espelho #NNN] <TIPO>: <título 5-8 palavras>

TIPOS:
  TEST_FAIL        — testes quebraram, coord quer orientação
  DESTRUCTIVE      — worker quer ação destrutiva, precisa aprovação
  CONFLICT         — merge conflict, shared file bloqueado
  INVARIANT        — invariante violada (INV-XX)
  HALLUCINATION    — validator pegou claim falsa
  HUMAN_GATE       — ambiguidade genuinamente nova durante loop
  FINISHED         — todas as tasks ok, pronto para revisão de §3.2
```

**Rate limit:** mesmo `(issue, type)` silenciado se enviado <4h atrás. **Sem re-envio automático** — um gate, um email. Se Marcio quer status, RC em CC-Interface e pergunta.

**Body — seção COMO RESPONDER:**
```
Abra Claude Code mobile, RC em CC-Interface (sessão tmux:cc-NNN),
fale o que quer em linguagem natural. CC-Interface entende contexto e relaya.

Exemplos:
  "vai com a A"
  "explica esse erro"
  "aborta a issue"
  "tenta de novo sem mexer no compliance"
  "olha antes o histórico de testes desse arquivo, depois decida"
```

### 13.11 Componentes a Construir (Status)

| Componente | Localização | Status |
|------------|-------------|--------|
| `cc-notify-email.py` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#169 PR #172, v0.30.0) — email real via iCloud SMTP, 7 TIPOs, rate limit 4h, 280 linhas |
| `cc-validate-task.py` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#169 PR #172, v0.30.0) — 3 checks §13.9 em <300ms, 12/12 pytest, 233 linhas |
| `cc-notify-whatsapp.sh` | `~/cc-mailbox/bin/` | LOW PRIORITY — canal opcional, não crítico pro loop (email iCloud é canal primário INV-28; WhatsApp fica como redundância caso Evolution API esteja de pé) |
| `cc-worktree-start.sh` | `scripts/` (repo) | **REFATORADO 3-TIER** (#169 PR #172, v0.30.0) — pré-condição cwd=worktree, 7 dirs §13.7, `.coord-id`/`.coord-dir`/`.interface-id` READ-ONLY, `flock` no listener |
| `~/cc-mailbox/templates/worker-briefing.md` | `~/cc-mailbox/templates/` | **IMPLEMENTADO** (#169 PR #172, v0.30.0) — cláusula CLAIMS obrigatória, formato exato do bloco JSON, regras skipped, exemplo de report |
| `~/cc-mailbox/templates/coord-briefing.md` | `~/cc-mailbox/templates/` | **IMPLEMENTADO** (#176, v0.35.0) — template canônico com placeholders (`{{issue_num}}`, `{{issue_title}}`, `{{branch}}`, `{{worktree_path}}`, `{{control_file_path}}`), cobre identidade/ciclo-de-vida/TASK_DELIVERED/DISPATCH_TASK/HUMAN_GATE_RESOLVED + resolução de ambiguidades spec→PROJECT.md→padrão→§3.2 + tipos §13.10 |
| `cc-spawn-coord.sh` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#176, v0.35.0) — wrapper §13.8 passo 8b: precondição cwd=worktree, render do template com placeholders do control file (perl escape-safe), `claude -p --output-format json`, captura `session_id`, imprime `COORD_SESSION_ID=<uuid>` parsable. Smoke OK em issue-998. |
| `cc-dispatch-task.sh` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#176, v0.35.0) — wrapper §13.8 passos 8d/36: lê `.coord-id`/`.coord-dir`, `flock -w 30 locks/coord.lock`, `cd $COORD_DIR`, `claude --resume --permission-mode auto -p "DISPATCH_FIRST_TASK\|DISPATCH_TASK slug=...\|HUMAN_GATE_RESOLVED ref=..."`. Smoke OK em issue-998. |
| `~/cc-mailbox/.env` | `~/cc-mailbox/` | Setup manual (EMAIL_PASSWORD iCloud — senha reusada de `~/morning_call_auto/.env` via decisão operacional) |

**Status do protocolo:** **OPERACIONAL END-TO-END** a partir de v0.35.0 (#176). **Validado com rodada real** em worktree sintético `issue-997` (23/04/2026 01:32-01:35 BRT, ~3min, EMAIL_DRY_RUN=0): `cc-spawn-coord.sh` → `COORD_SESSION_ID=f88e64e6-...` → `cc-worktree-start.sh` grava RO + lança listener → `cc-dispatch-task.sh FIRST` → Coord escreve briefing completo do worker em `inbox/01-criar-scratch-file.md` → listener polling pega em ~25s → worker headless `claude -p` executa (cria arquivo, commita `cae656b2`, escreve report com CLAIMS válido `{commit_hash, tests.skipped:true, files_touched}`) → listener faz `TASK_DELIVERED` via `flock + --resume` → Coord acorda, roda `cc-validate-task.py` (exit 0 OK), atualiza control file marcando `[x]` nos critérios (side-effect benéfico não-pedido) → Coord dispara email real `[Espelho #997] FINISHED: E2E dry-run §13 concluído — todas as tasks OK` via `cc-notify-email.py` → email chega no iCloud do Marcio → Coord morre. Loop inteiro sem intervenção humana. **Pendente apenas**: Recovery §13.15 re-testado pós-amendment v0.26.0 (a rodada original usou protocolo anterior).

**Fast-follows identificados nos dry-runs:**
- `cc-notify-email.py` em `EMAIL_DRY_RUN=1` não escreve em per-worktree log (só no global); assimetria trivial de 3 linhas
- Criar worktree novo a partir do `main` pós-merge #172 pega a versão refatorada do `cc-worktree-start.sh` automaticamente (nota operacional: worktrees criados ANTES do merge continuam com script antigo até recriarem)

### 13.12 Decisões de Design (Bugs 1-10)

Ver histórico em `/mnt/c/000-Marcio/Temp/proto-autonomo-state.md` para o design completo. Síntese:

| Bug | Decisão |
|-----|---------|
| 1 | Coord nasce em 8b (antes do start script) via `claude -p` com captura de `session_id` do JSON |
| 2 | Modelo A — Coord SEMPRE morre após turn. Wake-up sempre via `--resume` |
| 3 | CC-Interface idle no prompt, zero polling, trigger único = Marcio digitar algo |
| 4 | `coord-inbox/` declarado + ownership definido (§13.6) |
| 5 | `flock -w 30 coord.lock` antes de todo `--resume`. Lock per-worktree. Timeout → 1 retry → email Marcio |
| 6 | CLAIMS mínimo (3 campos) + validator com 3 checks (commit, testes, arquivos). Resto cai na revisão humana em §3.2 (versão enxuta — não inflar) |
| 7 | Rate limit por `(issue, type)` em 4h no script. Sem re-envio automático de gate não resolvido |
| 8 | Task = 1-5 commits, ~30-90min. Micro-task (1 linha) merge na próxima. Heurística, não regra dura |
| 9 | `cc-notify-whatsapp.sh` faz `curl -sf localhost:8080/` interno. Exit silent se Docker off. Outros atores não sabem |
| 10 | Task = unidade indivisível. Decisões dentro da task ficam no mesmo commit. Rollback por task, não por decisão. §3.2 + PR review cobrem |

### 13.13 Notas Operacionais (Não-Invariantes)

**Prompt cache:**
- `claude -p` usa prompt cache por default; Coord/Worker não precisam de `cache_control` explícito
- Loop apertado (Worker entrega → Coord acorda em <5min): cache hit natural, economia esperada
- Gate humano longo (>5min até Marcio responder): TTL de 5min do Anthropic expira → `--resume` re-carrega transcript inteiro. Comportamento esperado, não é bug
- Entre workers: cada worker é sessão nova `claude -p`, sem cache compartilhado
- Otimização futura possível (fora do MVP): se telemetria mostrar custo alto em gates longos, avaliar `coord-state.md` condensado que `--resume` usa em vez do transcript inteiro

**Dry-runs validados (sessão de design 21/04/2026):**

| Teste | Resultado | Implicação |
|-------|-----------|-----------|
| `claude --resume <id> --permission-mode auto -p` | ✅ executa Bash sem prompt, `permission_denials: []` | Resume preserva auto mode; loop coord/worker viável |
| `claude -p` headless sem TTY | ✅ executa, mas refuse soft em writes fora de cwd | Headless funciona; modelo tem judgment próprio |
| `PushNotification` em `-p` headless | ❌ 4 tentativas, todas "user active" suppressed | PushNotification inviável como canal primário |
| Email iCloud SMTP via Python `smtplib` | ✅ enviado, chegou no celular (latência iCloud) | Canal primário validado |
| WhatsApp Evolution API | ⚠️ não testado vivo (Evolution offline no momento) | Funcional em arquitetura, requer Docker up |

### 13.14 Referência Cruzada

- **INV-25** — Outbox antes de resume (fundação do TASK_DELIVERED)
- **INV-26** — `.coord-id` e `.coord-dir` read-only, start script responsabilidade única (+ amendments v0.25.0 e v0.26.0)
- **INV-27** — Validação externa de claims (cegueira epistêmica)
- **INV-28** — Email iCloud canal primário
- **§4.0** — Protocolo padrão interativo (default do projeto)
- **§6.3** — Registry de chunks e locks (obrigatório antes de qualquer worktree)
- **§13.15** — Protocolo de Recovery de CC-Interface (única exceção ao READ-ONLY da INV-26)
- **DEC-AUTO-NN** — convenção de identificador de decisão autônoma do coord (registrada em `§3.2` do control file do issue)

### 13.15 Protocolo de Recovery de CC-Interface

> Adicionado em v0.26.0 após primeiro caso real de queda (rodada #164, 21-22/04/2026).

Quando CC-Interface morre durante a execução de um issue (crash, kill, desconexão permanente), uma nova sessão pode assumir o papel sem perder o trabalho em progresso. Passos:

| # | Ação | Observação |
|---|------|-----------|
| 1 | **Process check** da session anterior | `ps -p <old_PID>`. Se não responde → session morta, recovery autorizada |
| 2 | **JSONL scope check** | `find ~/.claude/projects -name "<old_session_id>*"`. Se project-scope ≠ worktree (bug cross-worktree — §13.7/§13.8), documentar como causa raiz e justificativa para override |
| 3 | **Nova CC-Interface spawna** | `cd ~/projects/issue-NNN && claude --permission-mode auto` — **sem `--resume`** (recovery real, não reanimação). Aplicar prompt padrão de recovery (template abaixo) |
| 4 | **Escrita excepcional** | `.coord-id` ← `$CLAUDE_SESSION_ID` da nova Interface; `.coord-dir` ← worktree absoluto. **Esta é a ÚNICA exceção à INV-26** (amendment v0.26.0) |
| 5 | **Registro obrigatório** | Nova Interface adiciona em `§3.2 Decisões Autônomas` do control file: `"RECOVERY: CC-Interface anterior <PID> morta; override de .coord-id e .coord-dir — bug cross-worktree <confirmado|não-confirmado>"` |

**Template de prompt de recovery** (colar na nova sessão após spawn):

```
Você é CC-Interface de RECUPERAÇÃO para issue #NNN.
A CC-Interface anterior morreu (PID <X>).
Reconstrua o estado a partir do filesystem — sem contexto da sessão anterior.

1. Ler docs/PROJECT.md §13 + CLAUDE.md
2. Ler docs/dev/issues/issue-NNN-*.md (control file: escopo, entregas E1..)
3. Listar .cc-mailbox/processed/ (tasks processadas) + outbox/ (reports)
4. git log --oneline main..HEAD (commits da branch)
5. Ler reports em outbox/ para confirmar o que cada worker entregou
6. Rodar npx vitest run (validação INV-27 manual enquanto scripts ausentes)
7. Atualizar .coord-id (seu $CLAUDE_SESSION_ID) + .coord-dir (worktree absoluto)
   — única exceção à INV-26 (§13.15, passo 4)
8. Registrar ação em §3.2 do control file (passo 5)

Reporte em 10 linhas:
- Entregas por fase — quais feitas, quais pendentes (base nos reports + git log)
- Próxima ação sugerida (validar, despachar pendente, ou fechar issue)
- Inconsistências entre commits e reports (INV-27 manual)
- Confirmar que atualizou .coord-id + .coord-dir
```

**Critério de sucesso da recovery:**
- Nova Interface identifica entregas sem alucinar
- Pega session_id antigo como inválido e atualiza
- Sugere ação coerente com fase real do issue (não re-despachar se tudo entregue)
- Não assume estado — verifica via filesystem

**Validação histórica:** rodada #164 — CC-Interface `5cd03bd7` morreu (kill manual após 5h40min); nova `4ec7b999` aplicou este protocolo e reconstruiu estado em ~2min (4 entregas E1/E2/E3/E5, 19 commits, 1838/1838 testes confirmados). Bug cross-worktree confirmado: JSONL antigo em `-acompanhamento-2-0`, novo em `-issue-164`.

---

*Documento criado em 26/03/2026 a partir da consolidação de: ARCHITECTURE.md, AVOID-SESSION-FAILURES.md, VERSIONING.md, CHANGELOG.md (parcial), CHUNK-REGISTRY.md*  
*Próxima revisão obrigatória: ao final de cada sessão de desenvolvimento*
