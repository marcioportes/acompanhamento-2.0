# Changelog

All notable changes to **Acompanhamento 2.0 / Espelho** will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version source of truth: `src/version.js`.

---

## [1.44.1] - 24/04/2026

**Issue:** #191 (fix: aderência recente no gate compliance-100 do stage Profissional)

#### Corrigido

- **Gate `compliance-100` (Metódico → Profissional) agora avalia a janela recente correta.** Antes, `complianceRate100` era apenas alias de `complianceRate` (linha ~126 de `functions/maturity/preComputeShapes.js`) — o gate reusava o cálculo da janela total do histórico em vez da aderência recente que o nome promete. Resultado: traders com violações antigas mas excelentes recentes podiam ser reprovados; traders com histórico bom mas violações recentes podiam ser aprovados.

#### Adicionado

- **`computeCycleBasedComplianceRate({trades, plans, now, minTrades=20})`** — helper puro novo em `functions/maturity/computeCycleBasedComplianceRate.js` (CommonJS) com mirror espelhado em `src/utils/maturityEngine/computeCycleBasedComplianceRate.js` (ESM). Aplica a regra:
  - **Janela** = união dos ranges `[cycleStart, cycleEnd]` do ciclo que contém `now` em cada plano (derivação por `adjustmentCycle`: Mensal/Trimestral/Semestral/Anual).
  - **Mínimo 20 trades CLOSED.** Se `< 20`, retrocede simultaneamente 1 ciclo em CADA plano e recoleta. Repete até atingir o mínimo ou esgotar.
  - **Esgotamento** = iteração que não acrescenta nenhum trade novo. Cap mecânico defensivo `MAX_LOOKBACK_CYCLES = 36`.
  - **Insuficiente** (`< 20` mesmo após esgotar) → `null`. Em `evaluateGates`, `null` cai em `met: null`, `reason: 'METRIC_UNAVAILABLE'` → gate fica pendente: **não promove** (`gatesMet < gatesTotal` bloqueia `proposeStageTransition`) e **não rebaixa** (`detectRegressionSignal` não consome este campo, DEC-020 preservada).
  - **Fórmula**: `(trades_sem_flag / total) * 100` sobre a janela final. Aceita `trade.date` em `YYYY-MM-DD`, `DD/MM/YYYY` ou `Date`. Dedup por `trade.id` em planos com ciclos sobrepostos.
- `preComputeShapes({trades, plans, now})` agora aceita `now` (default: `new Date()`) e propaga para o novo helper. `recomputeMaturity.js` repassa o `now` que já calcula.

#### Testes

- 17 testes em `src/__tests__/utils/maturityEngine/computeCycleBasedComplianceRate.test.js` cobrindo cenários A-E da memória de cálculo aprovada + invariantes (vazios, dates inválidos, formato BR/ISO/Date, redFlags array vs hasRedFlags, dedup por id, plano Trimestral, `minTrades` customizável, default `adjustmentCycle`, retrocesso multi-ciclo).
- 3 testes de paridade ESM↔CommonJS em `src/__tests__/functions/maturity/computeCycleBasedComplianceRate.test.js`.
- Suite total: **2421 testes (144 arquivos), 100% verde**.

#### Decisões

- DEC-AUTO-191-01 — Janela = união de ciclos ativos por plano + fallback retroativo simultâneo.
- DEC-AUTO-191-02 — Estado insuficiente = `null` (mapeia para `METRIC_UNAVAILABLE` no gate, semanticamente correto: pendente, não promove e não rebaixa).

---

## [1.44.0] - 24/04/2026

**Issue:** #119 (feat: Motor de progressão Maturidade 4D × 5 stages — modo autônomo)
**PR:** #192

Entrega consolidada das 28 tasks do issue #119 em 6 fases originais (A engine puro, B persistência CF, C UI aluno, D IA Sonnet 4.6, E freeze em review snapshot, F UI mentor Torre de Controle) + 2 fases de escopo adicional (H gatilhos single-point; I/J tela Revisões do aluno + hotfix final).

Reservada originalmente como 1.43.0 em 23/04/2026; bump mecânico para 1.44.0 após o #183 consumir 1.43.1 antes do merge. Registry de versões atualizado.

#### Adicionado

- **Engine puro de maturidade** — `src/utils/maturityEngine/*` com funções puras `evaluateGates`, `calculateStageScores`, `proposeStageTransition`. 4 dimensões (Emocional / Financeira / Operacional / Maturidade composta) × 5 stages (Caos · Reativo · Metódico · Profissional · Maestria). Composite `0.25E + 0.25F + 0.20O + 0.30M`. Janela rolling por stage (20/30/50/80/100 trades). 6 gates 1→2, 8 gates 2→3, 10 gates 3→4, 9 gates 4→5. Labels PT-BR.
- **Persistência** — `students/{uid}/maturity/{current|_historyBucket/history/{YYYY-MM-DD}}` via `functions/maturity/recomputeMaturity.js`. Schema validado em `maturityDocSchema.js`. Rules já cobrem via recursivo `{docId=**}`.
- **Triggers** — `onTradeCreated`/`onTradeUpdated` (close de trade), close de revisão semanal (freeze de `frozenSnapshot.maturitySnapshot`), pós-onboarding (welcome narrative). Isolamento total (exceções viram `skipped`).
- **Callable single-point** — `recomputeStudentMaturity` com rate limit 5min por caller (stamp em `_rateLimit.calls[<callerUid>]`). Mentor whitelist via `isMentorEmail(token.email)` pode recalcular qualquer aluno; aluno limitado a si mesmo.
- **IA Sonnet 4.6** — `classifyMaturityProgression` gera narrativa + padrões detectados + guidance para próximo stage. Triggers: UP, REGRESSION, ONBOARDING_INITIAL (novo). Cache policy em `src/utils/maturityAITrigger.js`; pipeline pós-onboarding bypassa `shouldGenerateAI` (helper `dispatchOnboardingMaturityAI` isolado).
- **UI aluno** — `MaturityProgressionCard` (stage atual, gates, barras 4D, botão "Atualizar agora" com countdown MM:SS e estados vazio/erro com CTA). `StudentReviewsPage` espelho READ-ONLY do mentor (5 seções: KPIs congelados com delta vs revisão anterior, trades revisados com link Feedback, takeaways checklist + texto livre, seção Reunião com meetingLink/videoLink, comparativo maturidade 4D, notas). Dashboard: card "Takeaways abertos da última revisão". Sidebar: rota "Revisões".
- **UI mentor (Torre de Controle)** — `MaturitySemaphoreBadge` por aluno, `MentorMaturityAlert` card de regressão expandível, botão "Atualizar agora" disparando o callable.
- **Componentes reusáveis extraídos da WeeklyReviewPage** — `ReviewKpiGrid`, `ReviewTradesSection`, `MaturityComparisonSection`, `reviewFormatters.js` (fmtMoney/fmtPct/fmtDateBR/deltaText/statusBadge etc.).
- **DECs (auto-geradas no modo autônomo)** — DEC-AUTO-119-01..18 registradas no doc de controle da issue.

#### Corrigido

- **DEC-020 respeitada** — engine detecta regressão mas nunca rebaixa automaticamente (stage floor = `max(storedStage, baselineStage)`). Corrige bug onde primeiro recompute pré-fix (`f4c72941`) gravava stage=1 para alunos com baseline>1.
- **Baseline lido do path correto** — `assessment.experience.stage` (schema real do StudentOnboardingPage) em vez de `assessment.stage` (nunca existiu). Dimensões lidas de `emotional.score`/`financial.score`/`operational.fit_score`.
- **DebugBadge** — movido para `bottom-2 right-2` com `opacity-60 hover:opacity-100` (evita sobrepor conteúdo inferior de cards).
- **Stage labels PT-BR em testes pré-existentes** — `EmotionAnalysis.test` e `MaturityComparisonSection.test` (METHODICAL/REACTIVE/MASTERY → Metódico/Reativo/Maestria).

#### Observações

- Auditoria de furos estruturais em gates × recursos (24/04 tarde) identificou 5 gaps que limitam promoção em stages específicos, mas não invalidam esta entrega. Todos em follow-up como issues próprias no projeto "Mentoria 2.0 - Product Board" com protocolo de captura (briefing + mockup + memória antes de código):
  - **#187** — MEP/MEN (MFE/MAE em PT-BR) + Sharpe com benchmark (gate 3→4 e 4→5)
  - **#189** — score emocional real (furo UNIVERSAL — dimensão E hardcoded em 50)
  - **#190** — rastreamento tilt/revenge trades (gate Maestria)
  - **#191** — fix semântico do gate `compliance-100` (janela dos últimos N trades)
  - **#184** — imutabilidade de trades em revisões
  - **#185** — painel diagnóstico do trade atômico (mentor)

---

## [1.43.1] - 24/04/2026

**Issue:** #183 (fix: Plano criado por mentor não é visível pelo aluno — Sev1)
**PR:** (a preencher quando mergeado)

Fast-track Sev1. `usePlans.addPlan` hardcodava `studentId: user.uid` mesmo quando o criador era o mentor atuando em nome do aluno. Plano ficava gravado com UID do mentor e o aluno (filtro `where studentId == own.uid`) nunca enxergava.

#### Corrigido

- **`src/hooks/usePlans.js:addPlan`** — prioridade do dono agora é `planData.studentId > overrideStudentId > user.uid`; campos `studentEmail`/`studentName` herdam do `planData`; ausentes e criador != dono ficam `null` (não vaza email do mentor para o dono); novo campo `createdBy`/`createdByEmail` sempre gravado para audit (pode diferir de `studentId` quando mentor cria em nome do aluno). Dependências do `useCallback` atualizadas com `overrideStudentId`.
- **`src/pages/AccountsPage.jsx`** — novo wrapper `handleCreatePlanForSelectedAccount` que enriquece `planData` com `studentId`/`studentEmail`/`studentName` do `selectedAccount` antes de chamar `addPlan`. Consumido via `onCreatePlan={handleCreatePlanForSelectedAccount}` em `<AccountDetailPage>` (substitui `onCreatePlan={addPlan}` direto). `StudentDashboard` já usava `usePlans(overrideStudentId)` — depende apenas do fix no hook.

#### Adicionado

- **`scripts/issue-183-repair-orphan-plans.mjs`** (run-once, firebase-admin via `createRequire` do `functions/node_modules/`) — REMAP dos planos órfãos em produção usando `account.studentId` como fonte da verdade. Estratégia não-destrutiva (preserva trades vinculados); cascade em `trades` (atualiza `studentId`/`studentEmail`) para planos que tenham histórico. Safety nets: skip com motivo registrado quando plano sem `accountId`, account inexistente, account sem `studentId`, ou account também pertencente ao mentor (conta de teste). Backup dos valores antigos gravado em `_repairedByIssue183PreviousStudentId`/`_repairedByIssue183PreviousStudentEmail` + timestamp `_repairedByIssue183At` no doc. Dry-run default; `--execute --confirm=SIM` exige dupla confirmação. Log JSON persistente em `scripts/logs/issue-183-{dryrun\|execute}-<ISO8601>.json`.
- **`src/__tests__/hooks/usePlans.addPlan.test.js`** — 5 casos cobrindo: aluno criando próprio plano (studentId = aluno.uid), mentor em view-as-student (studentId = aluno, createdBy = mentor, studentEmail/Name = null — não vaza mentor), `planData.studentId` prevalece sobre `overrideStudentId`, fallback legado (mentor sem contexto → studentId = mentor, cenário que o wrapper em `AccountsPage`/`StudentDashboard` elimina), preservação de campos financeiros (regressão).
- **Entrada em `.gitignore`** — `scripts/logs/` (logs de run-once de issue #183 e afins).

#### Operação em produção

Script executado (com autorização explícita) em `acompanhamento-20`:
- **2 planos remapeados**, 0 trades afetados (nenhum tinha histórico vinculado):
  - `8obzgGmrspLx1qT4GB2K` (**xT**) → `marcio.portes@icloud.com` (`studentId: VXLMNLg7arODTeAOAPr0bDTZVN93`)
  - `anhL0doKRm6Bg19nDQkv` (**PL-REAL20K**) → `rafael_perilo@hotmail.com` (`studentId: GWYzCCHHZEML0ThpZZUxzt8bldy2`)
- Log: `scripts/logs/issue-183-execute-2026-04-24T20-18-15-548Z.json` (local — não comitado; `scripts/logs/` em `.gitignore`).

#### Decisões

- **DEC-AUTO-183-01** — REMAP (não DELETE) dos planos órfãos. Intenção original era delete puro (evita heurística arriscada se mentor tivesse plano em conta própria/teste). Durante validação em `localhost:5184`, plano legado com risco de ter trades reais vinculados motivou pivot para REMAP com safety nets. Delete perderia histórico operacional.
- **DEC-AUTO-183-02** — Critério de órfão = `plan.studentEmail == 'marcio.portes@me.com'`. Mentor identificado por email fixo em `src/firebase.js:30` (`MENTOR_EMAIL`). Não há campo `role` no Firestore; derivação do papel vive nas rules e no frontend.

#### Testes

- 1895/1895 passando (baseline 1890 + 5 novos).

---

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

