# PROJECT.md — Acompanhamento 2.0
## Documento Mestre do Projeto · Single Source of Truth

> **Versão:** 0.23.3  
> **Última atualização:** 21/04/2026 — INV-25: outbox antes de resume (padrão coord/worker). Lição aprendida #165.  
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
| 0.23.3 | 21/04/2026 | INV-25: outbox antes de resume | Formaliza invariante do padrão coord/worker: output do worker persiste em outbox antes do `--resume`. Coord relê sempre do disco, nunca assume memória do worker. Origin: recovery manual #165. |
| 0.23.2 | 20/04/2026 | §4.0 coord/worker: coord deve abrir do worktree | Lição #165: `claude --resume` procura JSONL no projeto correspondente ao cwd de invocação. Coord aberto no main → listener no worktree não encontra sessão. Regra adicionada: após criar worktree, entrar nele (`cd ~/projects/issue-NNN`) antes de abrir a sessão coord. |
| 0.23.1 | 20/04/2026 | Abertura #165 — locks CHUNK-02/08 + v1.39.0 reservada |
| 0.23.0 | 20/04/2026 | §4.2 Gate Pré-Entrega — precauções #162 | Lições do SEV1 #162 incorporadas como ITENS OBRIGATÓRIOS do gate pré-entrega (antes eram apenas notas no CHANGELOG v1.38.1): (a) **`npm run lint` em arquivos tocados no branch** — zero `no-undef`, zero `no-unused-vars` críticos, zero regressão em regras já ativas. Custo ~5s/arquivo. Origem: ReferenceError `assessmentStudentId` teria sido pego aqui. (b) **Validação em browser por contexto de consumo** — aluno logado / mentor viewAs / override-embedded, quando aplicáveis. Origem: o #102 validou apenas o contexto mentor (WeeklyReviewPage) e deixou o contexto aluno (dashboard com `<PendingTakeaways>`) passar para prod sem render-check. Bump MINOR (mudança de protocolo §1 do versionamento). Sem lock de chunk — edição exclusivamente em shared file `docs/PROJECT.md`. |
| 0.22.7 | 20/04/2026 | Encerramento #156 v1.37.0 | PR #158 mergeado. Épico de 6 fases (A-F) consolidado em um único PR: (A) shadow writer bypass removido + invariante `tradeWriteBoundary`; (B) schema classificação persistente (5 classes) em `ordersStagingArea` + `autoLiqDetector`; (C) UX conversacional `ConversationalOpCard` substitui auto-create #93 + `AutoLiqBadge` + gate plano retroativo; (D) reconstrução robusta — segmentação por instrument + agregação N×M fills + gap 60min; (E) enrichment sem duplicata — helper puro `conversationalIngest` + `AdjustmentModal` diff fino + persist `discarded` em `orders`; (F) wire `onRequestRetroactivePlan` em App→StudentDashboard→OrderImportPage fechando gate + bump v1.37.0. **1689/1689 testes** (+122 vs baseline pré-#156 de 1567), invariante verde, zero regressão. Delta de shared files: `version.js` bumped, `firestore.rules` não tocado pela issue. Worktree removido, tmux `cc-156` killed, issue doc arquivada em `docs/archive/`, Product Board item movido para Done. **Infra operacional nova:** scripts `cc-worktree-{start,stop}.sh` + mailbox file-drop (`.cc-mailbox/`) + suporte opcional a `COORD_SESSION_ID` para notificação inversa via `claude --resume` validada em teste isolado — aplicável a partir do próximo épico. |

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

5. **Remover worktree** após merge confirmado (duas etapas — ambas obrigatórias):
   ```bash
   git worktree remove ~/projects/issue-{NNN}           # desregistra do git
   rm -rf ~/projects/issue-{NNN}                        # remove diretório físico residual (cache .vite, node_modules stale, etc.)
   ```
   `git worktree remove` pode deixar o diretório pai com artefatos não-tracked (ex: `.vite/`). O `rm -rf` garante limpeza completa. Verificar com `ls -d ~/projects/issue-{NNN}` — deve retornar "No such file or directory".

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
| CHUNK-02 | Student Management | Dashboard do aluno, gestão de dados do estudante, sidebar do aluno | `StudentDashboard`, `students` collection | LOCKED |
| CHUNK-03 | Plan Management | CRUD de planos, ciclos, metas, stops, state machine do plano | `PlanManagementModal`, `plans` collection | AVAILABLE |
| CHUNK-04 | Trade Ledger | Registro de trades, gateway addTrade/enrichTrade, parciais, cálculo de PL | `useTrades`, `trades` collection, `tradeGateway` | AVAILABLE |
| CHUNK-05 | Compliance Engine | Regras de compliance, cálculo de scores, configuração do mentor | `compliance.js`, `ComplianceConfigPage` | AVAILABLE |
| CHUNK-06 | Emotional System | Scoring emocional, detecção TILT/REVENGE, perfil emocional | `emotionalAnalysisV2`, `useEmotionalProfile` | AVAILABLE |
| CHUNK-07 | CSV Import | Parser CSV, staging, mapeamento de colunas, validação | `CsvImport/*`, `csvStagingTrades` | AVAILABLE |
| CHUNK-08 | Mentor Feedback | Feedback do mentor por trade, chat, status de revisão | `Feedback/*`, `feedbackHelpers` | LOCKED |
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
| CHUNK-02 | #165 | fix/issue-165-ajuste-extrato-plano | 20/04/2026 | 23d09bd0 |
| CHUNK-08 | #165 | fix/issue-165-ajuste-extrato-plano | 20/04/2026 | 23d09bd0 |

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

*Documento criado em 26/03/2026 a partir da consolidação de: ARCHITECTURE.md, AVOID-SESSION-FAILURES.md, VERSIONING.md, CHANGELOG.md (parcial), CHUNK-REGISTRY.md*  
*Próxima revisão obrigatória: ao final de cada sessão de desenvolvimento*
