# SISTEMA-ESPELHO-CONTEXTO.md — Mapa de Sistema do Espelho do Trader

> **Audiência:** modelo Opus 4.8 (sessão coordenadora), não usuário final.
> **Propósito:** entender o produto **de dentro** — como o aluno o usa, o que cada peça faz, como comportamento vira dado — antes de desenhar qualquer vídeo de apresentação.
> **Este doc NÃO é:** copy de marketing, roteiro, beat sheet, gancho, nem metodologia de vídeo. É mapa de sistema da jornada do aluno. A metodologia de vídeo será definida em pesquisa separada.
> **Regra de leitura:** toda afirmação aqui vem de arquivo real lido (caminho citado). O que não foi verificável está marcado `[VERIFICAR]`.
> **Versão do produto na captura:** `src/version.js` → `1.73.0` (build 20260601). Data da captura: 03/06/2026.

---

## 0. Reconciliação de fontes e divergências (ler primeiro)

### 0.1 Onde mora a verdade
O **código em produção é a fonte canônica** do framework e dos cálculos. Docs de marketing (portal) são **copy derivada** — alinham com o produto, não o contrário (explicitado no próprio portal v3.0 §Apêndice D e issue #239).

### 0.2 Divergência 4D doc × código — RESOLVIDA no v3.0, ainda viva no v2.0 in-repo

| Fonte | 4 dimensões | Status |
|---|---|---|
| **Código (canônico)** | **Emotional · Financial · Operational · Maturity** | `functions/maturity/constants.js:82-86` |
| Portal **v3.0** (master, fora do git) | **Emocional · Financeiro · Operacional · Maturidade** | **BATE com o código** (patch 3.0.1, 15/05/2026, issue #239) |
| Portal **v2.0** (in-repo, archived) | Emocional · **Plano · Modelo** · Operacional ("Modelo Portes") | **DIVERGENTE** — legado revogado |

**Sinalização (regra 5):** a premissa de que "o portal v3.0 lista Plano·Modelo" está **desatualizada**. O v3.0 já foi reconciliado (`Plano/Modelo → Financeiro/Maturidade`, issue #239) e hoje **bate com o motor**. Quem ainda carrega a nomenclatura antiga é o `docs/marcioportes_portal_v2_0.md` (archived no repo). Fonte: `/mnt/c/000-Marcio/marcioportes.com.br/marcioportes_portal_v3_0.md:94,214` + `docs/marcioportes_portal_v2_0.md:77,103,296`.

### 0.3 Glossário código ↔ público

| No código / motor | Público (portal v3.0) | Nota |
|---|---|---|
| Framework 4D (E/F/O/M) | "framework comportamental de 4 dimensões" (sem nome próprio) | "Modelo Portes" **REVOGADO** (DEC-P02-REV, portal v3.0:35) |
| dimension `maturity` / `stage` | "Maturidade" | barra de 5 estágios CHAOS→MASTERY |
| Plataforma | **Espelho do Trader** | "Espelho modo self-service" (tier base) e "modo mentorado" |
| Mentoria premium 1:1 | **Mentoria Alpha** | inclui Espelho mentorado + sessões 1:1 + validação de ciclo |
| Assessment de onboarding | **Diagnóstico Comportamental** | versão gratuita = lead magnet (5-8 perguntas) |
| — | **Fibonaccing** (técnico) / **Caderno de Comportamento** (editorial) | marcas paralelas de conteúdo |

Fonte: portal v3.0 §3 (catálogo) linhas 94, 114-132, 184-239.

### 0.4 Arquivos canônicos de arquitetura (os citados na missão que não existem)
`ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/CONTINUITY-*` **ativos não existem**. A SSoT de arquitetura é: `docs/PROJECT.md` + `docs/firestore-schema.md` + `docs/cloud-functions.md` + `docs/invariants.md` + `docs/decisions.md`. CHANGELOG está na raiz (`CHANGELOG.md`); CONTINUITY só em `docs/archive/` (03/2026).

---

## 1. Produto em camada de sistema — o loop central

### (a) O que é
O Espelho cruza **três declarações sobre a mesma operação** e transforma a distância entre elas em dado:

```
   emoção declarada   ×   plano escrito   ×   execução real   →   dado comportamental
   (emotionEntry/Exit)     (plan: RO/RR/        (entry/exit/qty/      (score E/F/O/M,
                            stop/metas)          stopLoss/horários)    redFlags, padrões shadow)
```

O sistema não promete prever mercado. Promete mostrar **o que acontece entre o que o trader sabe e o que executa** (posicionamento, portal v3.0:73). Cada trade que entra dispara um pipeline determinístico (§5) que produz compliance, padrões comportamentais e atualização de maturidade.

### (b) O que o aluno vê
Um app SaaS dark (glassmorphism) com: dashboard de KPIs, diário de trades, modais de registro, wizard de fechamento de ciclo, revisões semanais, e — se for Mentoria Alpha — feedback do mentor e SWOT. (`src/pages/StudentDashboard.jsx`.)

### (c) Invariantes que sustentam o loop
- **INV-01** Airlock: CSV/API nunca escreve direto em `trades`/`plans`/`accounts` (staging isolado).
- **INV-02** Gateway único `addTrade` para a collection `trades`.
- **INV-03** Integridade do pipeline de side-effects (trade → CFs → downstream).
- **INV-12** Parciais inline em `_partials` (não subcollection).
Fonte: `docs/invariants.md`.

### (d) DECs estruturais
DEC-020 (maturidade sinaliza, mentor decide), DEC-086 / DEC-P02-REV (nome "Modelo Portes" revogado). `docs/decisions.md`.

### (e) Momentos demonstráveis
- **O confronto do loop:** três fontes (emoção/plano/execução) convergindo num único registro e gerando um veredito que o aluno não declarou. (Detalhe do confronto na §2(e) e §5(e).)

---

## 2. Onboarding + Assessment 4D

Arquivos: `src/pages/StudentOnboardingPage.jsx`; `src/components/Onboarding/{QuestionnaireFlow,ProbingIntro,ProbingQuestionsFlow,AIAssessmentReport,MentorValidation,BaselineReport,IncongruenceFlags}.jsx`; `src/hooks/{useAssessment,useQuestionnaire,useProbing}.js`; `functions/assessment/{generateProbingQuestions,classifyOpenResponse,analyzeProbingResponse,generateAssessmentReport}.js`; `functions/maturity/{computeEmotional,computeFinancial,computeOperational,computeMaturity,constants,helpers}.js`.

### (a) Camada de sistema — máquina de estados
```
lead → pre_assessment → ai_assessed → probing → probing_complete → (mentor_validated) → active
```
Transições validadas em `useAssessment.js`. Em produção, `probing_complete → active` é **direta** (DEC-026): `saveInitialAssessment` grava `onboardingStatus: 'active'`. Documentos Firestore: `students/{id}/assessment/{questionnaire|probing|initial_assessment}`.

**Pipeline de classificação (IA = Claude Sonnet 4):**
1. **Questionário base** — 34 perguntas em 4 dimensões (Emocional ~12, Financeira ~9, Operacional ~8, Experiência/Maturidade ~6). Fechadas têm score por opção; abertas vão para `classifyOpenResponse` (retorna `aiScore` 0-100, classificação, justificativa, confiança), prompt alinhado a Kahneman/Prospect Theory/CMM (DEC-027). Fonte: `functions/assessment/classifyOpenResponse.js`, `src/utils/assessmentScoring.js`.
2. **Detecção de incongruência** — `incongruenceDetector.js`: intra-dimensional (média fechadas vs abertas, flag se Δ≥25), inter-dimensional (5 cross-checks), gaming suspect.
3. **Probing adaptativo** — `generateProbingQuestions` gera 3-5 perguntas abertas a partir dos triggers priorizados (`probingTriggers.js`); `analyzeProbingResponse` classifica cada resposta (`flagResolution`: resolved/reinforced/inconclusive).
4. **Relatório + diagnóstico de stage** — `generateAssessmentReport` produz, em paralelo: diagnóstico de stage 1-5 por **pattern-matching** (não fórmula, DEC-021) + prioridades de desenvolvimento.
5. **Validação do mentor** — mentor confirma/sobrescreve scores (override → fundo âmbar + nota obrigatória) e confirma 1-3 prioridades.

### As 4 dimensões — COMO O CÓDIGO CALCULA (verificado linha a linha)

Pesos do composite (`functions/maturity/constants.js:82-86`):
```
composite = 0.25·Emotional + 0.25·Financial + 0.20·Operational + 0.30·Maturity
```

**Emocional (E)** — `computeEmotional.js:50-53`
```
E = 0.60·periodScore
  + 0.25·normInverted(tiltRate,    0, 0.30)
  + 0.15·normInverted(revengeRate, 0, 0.20)
```
`tiltRate = tiltCount/N`, `revengeRate = revengeCount/N` (N = trades na janela). Inputs vêm de `emotionalAnalysisMirror.computeEmotionalAnalysisShape` (§5). Janela vazia → 50 (NEUTRAL).

**Financeira (F)** — `computeFinancial.js:98-102`
```
F = 0.30·eScore   (EV real / EV teórico, norm 0..1.0)
  + 0.25·pScore   (payoff ratio, norm 0.8..3.0)
  + 0.20·cvScore  (coef. variação, normInverted 0.3..2.0 — menor CV = melhor)
  + 0.25·ddScore  (max drawdown %, normInverted 0..25% — menor DD = melhor)
```

**Operacional (O)** — `computeOperational.js:72-76`
```
O = 0.40·complianceRate   (% trades sem violação de regra)
  + 0.20·stratScore       (semanas de consistência de estratégia, norm 0..12)
  + 0.20·jScore           (% trades com journal: notes≥10 chars OU emotionEntry)
  + 0.20·planAdherence    (% trades com planId vinculado)
```

**Maturidade (M)** — `computeMaturity.js:67`
```
M = min(100, stageBase + gateBoost + (6·selfAware)/100)
  stageBase  = {1:0, 2:20, 3:40, 4:60, 5:80}[stage]   (constants STAGE_BASES)
  gateBoost  = 14 · (gatesMet / gatesTotal)            (GATE_WEIGHT=14)
  selfAware  = computeSelfAwareness(baseline, dims)    (peso 6)
```
**`computeSelfAwareness` (helpers.js:200-216)** = `100 − média(|baseline_dim − current_dim|)` sobre E/F/O. **Isto é o coração do confronto:** mede o quanto o perfil **declarado no Marco Zero** (baseline) coincide com o **detectado pela operação real** (dims correntes). Quanto maior a distância declarado×real, menor a autoconsciência.

### Maturidade CMM — 5 estágios e gates
`STAGE_NAMES` (constants.js:17-23): **1 CHAOS · 2 REACTIVE · 3 METHODICAL · 4 PROFESSIONAL · 5 MASTERY**.
Gates por transição (constants.js `GATES_BY_TRANSITION`): 1→2 (6 gates), 2→3 (8), 3→4 (13, inclui gates comportamentais #208: no-stop-tampering/no-chase/disciplined-sizing), 4→5 (9). Cada gate = condição booleana sobre métrica (ex.: `compliance-95` → complianceRate≥95; `emotional-85 (SAGE)` → E≥85).
**DEC-020:** a engine **nunca** muda `stage.current` sozinha — calcula `proposedTransition` e o mentor decide. Regressão é detectada (`detectRegressionSignal.js`) mas também só sinalizada.
**DEC-022 (Marco Zero, tábula rasa):** `gates_met=0` ao ativar, independente do assessment.

### (b) O que o aluno vê
- **lead:** tela "Começar Questionário" (34 perguntas, ~20-30 min).
- **questionário:** pergunta-a-pergunta, opções randomizadas com persistência (DEC-015), progresso por dimensão, abertas exigem ≥80 chars.
- **probing:** "Vamos aprofundar alguns pontos" → perguntas contextualizadas, spinner "Analisando..." após cada resposta.
- **probing_complete:** "Suas respostas foram enviadas / aguardando mentor".
- **active — BaselineReport "Marco Zero":** 4 dimensões com réguas coloridas + marcador do score; faixas semânticas (Emocional: FRAGILE/DEVELOPING/LEARNER/SAGE; Financeiro: CRITICAL/VULNERABLE/SOLID/FORTIFIED; etc.); score composto (AT RISK/DEVELOPING/COMMITTED/PROFESSIONAL); diagnóstico de stage com justificativa; plano de desenvolvimento.
- **(mentor) AIAssessmentReport + MentorValidation:** scores IA com barra de confiança, flags de incongruência colapsáveis (resposta real + justificativa IA + resolução do probing), override do mentor.

### (c) Collections / CFs / hooks
Collections: `students/{id}/assessment/{questionnaire,probing,initial_assessment}`, `students/{id}/maturity/current`.
CFs: `generateProbingQuestions`, `classifyOpenResponse`, `analyzeProbingResponse`, `generateAssessmentReport`, `classifyMaturityProgression`.
Hooks: `useAssessment`, `useQuestionnaire`, `useProbing`.

### (d) DECs
DEC-013 (emotion_control herdado do Emocional, não editável), DEC-015 (randomização persistida), DEC-016 (probing transparente), DEC-021 (stage por pattern-matching IA), DEC-022 (tábula rasa), DEC-026 (transição atômica para active), DEC-027 (UX rich + rename Experiência→Maturidade).

### (e) Momentos demonstráveis — **PONTO DE CONFRONTO (densidade narrativa máxima)**
- **Incongruência declarada × detectada, na própria tela do assessment:** em `AIAssessmentReport`/`IncongruenceFlags`, o aluno (ou mentor) vê um card que confronta o que foi **dito** com o que os dados mostram — ex.: resposta fechada "sigo meu plano / uso stop sempre" vs. resposta aberta ou cross-check indicando o contrário, com badge **"Confirmado ✗"** após o probing reforçar a contradição. Factual na tela: header com label semântico da contradição + a resposta real do aluno + a justificativa da IA + o resultado do probing.
- **O Marco Zero como linha de base do confronto futuro:** o BaselineReport fixa o perfil **declarado**; tudo que a operação real produzir (§5) será medido contra ele via `selfAwareness`. É o "antes" que o sistema vai contradizer.
- (O confronto se completa em produção quando o motor nomeia um padrão que contradiz a autopercepção — ver §5(e).)

---

## 3. Conta + Plano

Arquivos: `src/pages/{AccountsPage,AccountDetailPage}.jsx`; `src/components/PlanManagementModal.jsx`; `src/hooks/{useAccounts,usePlans}.js`; `docs/firestore-schema.md`.

### (a) Camada de sistema
**Conta (`accounts`)** = container de capital. Campos: `name`, `broker`, `currency` (BRL/USD/EUR), `type` (REAL/DEMO/PROP), `initialBalance` (imutável), `currentBalance` (derivado de `movements`), `active`. Toda mudança de saldo nasce em `movements` (ledger: INITIAL_BALANCE, ADJUSTMENT, TRADE_RESULT). Contas PROP carregam objeto `propFirm` inline (firma, fase EVALUATION/SCALING/FUNDED, drawdown, instrumento) — CHUNK-17 Prop Firm Engine, mencionado aqui só onde toca o fluxo, sem seção própria.

**Plano (`plans`)** = o plano escrito como estrutura de dados:
| Campo | Significado | Contrato |
|---|---|---|
| `pl` | capital alocado (lastro) | **IMUTÁVEL após criação (C1, #259)** — só `closeCycle` muda |
| `currentPl` | saldo do plano | **derivado on-the-fly** (C2): `pl + Σ trades do ciclo aberto`, não persistido |
| `riskPerOperation` (RO%) | risco máx por trade | base do cálculo de RR assumido e de violação |
| `rrTarget` | risco/retorno alvo (ex. 1:2) | gate de compliance |
| `cycleGoal`/`cycleStop`, `periodGoal`/`periodStop` | metas/stops macro e micro (%) | `periodStop ≤ cycleStop` |
| `sealedCycleRanges[]`, `lastClosedCycleEnd`, `currentCycleNumber` | controle do hard seal (#259) | fonte de verdade do travamento |

### (b) O que o aluno vê
**PlanManagementModal — wizard 3 etapas:** (1) Capital — nome, tipo, conta, capital alocado (read-only + cadeado se editando; barra % do saldo da conta); (2) Metas — ciclo de ajuste (macro) e período operacional (micro), cada um com meta/stop %; (3) Risco — RO% e RR (1:X), com "Resumo do Plano" (capital × RO × max trades → $/dia). Conta PROP abre seletor de mesa/produto/fase/instrumento/estilo com preview do plano de ataque (`AccountsPage.jsx`).

### (c) Collections / CFs / hooks
`accounts`, `movements`, `plans`; CFs `deleteAccountCascade`, `deletePlanCascade`; hooks `useAccounts`, `usePlans`.

### (d) DECs
C1/C2 #259 (pl imutável / currentPl derivado), DEC-AUTO-259-02 (strip de `pl` no update), DEC-009 (compliance usa `plan.pl`, nunca currentPl).

### (e) Momentos demonstráveis
- Capital alocado com cadeado (imutabilidade visível: "o lastro do plano não muda no meio do ciclo").
- Preview do plano de ataque PROP (mesa → constraints → mecânica → ritmo de acumulação).

---

## 4. Entrada de trades

Arquivos: `src/utils/tradeGateway.js`; `src/components/AddTradeModal.jsx`; `src/hooks/{useTrades,useCsvStaging,useOrderStaging}.js`; `src/pages/OrderImportPage.jsx`; `src/utils/orderReconstruction.js`; `docs/firestore-schema.md`.

### (a) Camada de sistema
**Gateway único `createTrade` (INV-02, `tradeGateway.js`)** — toda escrita em `trades` passa por aqui:
1. valida plano/conta; 2. **hard seal #259** (rejeita trade em ciclo selado ou retroativo a ciclo fechado); 3. calcula resultado (parciais via `_partials` / ticks / fallback); 4. normaliza/valida MEP/MEN (excursão, #187, coerência LONG/SHORT); 5. timestamps com timezone explícito (#285/#292); 6. **RR real** (se há `stopLoss`) ou **RR assumido** (`rrAssumed:true`); 7. monta doc com `status:'OPEN'`, `_partials` inline (INV-12); 8. grava + cria `movements` TRADE_RESULT se `result≠0`.

**Três rotas de entrada, um só gateway:**
- **Manual** — `AddTradeModal` → `createTrade`.
- **CSV** (INV-01 airlock) — parse → `csvStagingTrades` (nenhuma CF observa) → aluno revisa/completa → ativação chama `createTrade`; dedup por ticker+side+entryTime±5min+qty (#240), com enriquecimento silencioso de MEP/MEN se trade já existe.
- **Order import / FIFO** — `reconstructOperations` agrupa ordens da corretora em operações (entry/exit por ticker+side em sequência), enriquece com stop analysis, correlaciona com trades manuais existentes (confidence + matchType), grava em `ordersStagingArea`, revisão conversacional (confirm/adjust/discard), `ingestBatch` cria/enriquece trades.

### (b) O que o aluno vê
- **AddTradeModal (registro ~30s):** ticker (autocomplete) + side; entry/exit/qty/stopLoss; MEP/MEN (pts ou %, dinâmico por instrumento); **emotionEntry / emotionExit / setup / notes** (campos pedagógicos); planId (obrigatório); datas/horas DD/MM/AAAA + HH:MM com seletor de fuso e preview "Equivalente em Brasília"; parciais (ENTRY+EXIT automáticos, intermediárias opcionais); upload HTF/LTF; override manual de resultado.
- **CSV:** wizard upload → tabela de staging → "Ativar" → resumo (X novos / Y enriquecidos / Z duplicatas).
- **Order import:** UPLOAD → PREVIEW → PLAN_SELECT → STAGING_REVIEW → CONVERSATIONAL_REVIEW (card por operação: confirmar/ajustar/descartar) → INGESTING → DONE.

### (c) Collections / CFs / hooks
`trades` (+`_partials` inline), `movements`, `orders`, staging `csvStagingTrades`/`ordersStagingArea`; CFs `onTradeCreated`/`onTradeUpdated`/`ingestBatch`; hooks `useTrades`, `useCsvStaging`, `useOrderStaging`, `useOrders`.

### (d) DECs
INV-01/02/12; C1/C2 #259; DEC-006/007 (stop implícito / RR assumido), DEC-AUTO-187-* (MEP/MEN preço puro, UX pts/%), DEC-AUTO-240-02 (dedup compartilhado), DEC-AUTO-242-01 (preço de stop = limitPrice), #285/#292 (timezone explícito).

### (e) Momentos demonstráveis
- **Hard seal disparando:** tentar registrar trade num ciclo já fechado → mensagem "Cronologia inválida! Ciclo selado em [range]".
- **Revisão conversacional do order import:** o sistema reconstrói operações a partir de ordens cruas e propõe correlação com confiança — o aluno confirma/ajusta.
- Registro manual com os campos de emoção/setup — o instante em que o aluno **declara** a emoção que depois será confrontada.

---

## 5. Transformação + detecção

Arquivos: `functions/index.js` (pipeline `onTradeCreated`), `functions/marketData/onTradeCreatedAutoEnrich.js`, `functions/analyzeShadowBehavior.js`, `functions/maturity/emotionalAnalysisMirror.js`; `src/utils/{emotionalAnalysisV2,violationFilter,shadowBehaviorAnalysis}.js`; `src/constants/behavioralTaxonomy.js`; `src/hooks/{useEmotionalProfile,useComplianceRules,useShadowAnalysis}.js`.

### (a) Camada de sistema — pipeline `onTradeCreated` (INV-03, isolamento total)
Cada side-effect roda em try/catch próprio; **trade criado nunca falha** por causa de enrichment/compliance:
1. **PL do plano** (no-op em C2 — PL é derivado).
2. **Compliance + redFlags** (`calculateTradeCompliance`): `TRADE_SEM_STOP` (stop implícito se loss não emite flag, DEC-AUTO-208-04), `RISCO_ACIMA_PERMITIDO`, `RR_ABAIXO_MINIMO`, `LOSS_DIARIO_EXCEDIDO`, `EMOCIONAL_BLOQUEADO`.
3. **Notificações ao mentor** (RED_FLAG / NEW_TRADE / EMOTIONAL_ALERT).
4. **Prop Firm Engine** (recalcula drawdown, append em `accounts/{id}/drawdownHistory`).
5. **Maturity recompute** (escreve `students/{uid}/maturity/current` + bucket de histórico).
6. **Auto-enrich MEP/MEN** (Yahoo bars; falha silenciosa).

**Score emocional** — `emotionalAnalysisMirror.js` (server) / `emotionalAnalysisV2.js` (client): por trade `score = 0.6·entryScore + 0.4·exitScore + bônus consistência − penalidade piora`; por período `calculatePeriodScore` normaliza a média de [−4,+3.5]→[0,100] e **subtrai penalidades por evento** (TILT −20, REVENGE −15, STOP_TAMPERING −20, etc.). `computeEmotionalAnalysisShape` retorna `{periodScore, tiltCount, revengeCount}` consumido por `computeEmotional` (§2). Eventos limpos pelo mentor (#221) são filtrados de volta para cima.

**Adesão ao plano** — `violationFilter.js`: `effectiveRedFlags`/`effectiveEmotionalEvents` retornam só o que **não** foi limpo pelo mentor (`trade.mentorClearedViolations`). Thresholds de detecção em `mentorConfig/{uid}` (`useComplianceRules`): tilt (3 trades consecutivos, ≤60min, resultado negativo), revenge (3 trades/15min, qty×1.5), overtrading (>10/dia).

### Padrões SHADOW — enumeração real (`shadowBehaviorAnalysis.js`, `PATTERN_CODES`)
**Layer 1 (todos os trades):** `HOLD_ASYMMETRY` (perdedor segurado 3×+ tempo dos ganhadores — disposition effect), `REVENGE_CLUSTER` (2+ trades ≤5min após loss), `GREED_CLUSTER` (trades rápidos após ganho), `OVERTRADING` (5+ em 60min ou >5/dia), `IMPULSE_CLUSTER` (2+ trades ≤2min), `CLEAN_EXECUTION` (win + stop + RR≥1 sem padrões negativos), `TARGET_HIT` (saída ≈ target ±5%), `DIRECTION_FLIP` (inverte side no mesmo ativo ≤120min após loss), `UNDERSIZED_TRADE` (risco real <65% do RO planejado).
**Layer 2 (quando há ordens):** `HESITATION` (2+ ordens canceladas antes do entry), `STOP_PANIC` (saída manual ≤5min após hit de stop), `FOMO_ENTRY` (market order ≥10min após hesitação), `EARLY_EXIT` (win com RR<50% do plano), `LATE_EXIT` (segura após remover stop), `AVERAGING_DOWN` (reentrada com preço piorando — martingale).
Taxonomia (viés → dimensão 4D) em `docs/dev/behavioral-weight-map.md` e `src/constants/behavioralTaxonomy.js`. Disparo via callable `analyzeShadowBehavior` (mentor invoca; escreve `trade.shadowBehavior.patterns[]` com code/severity/confidence/evidence).

### (b) O que o aluno vê
No `TradeDetailModal` → `ShadowBehaviorPanel`: cada padrão com nome traduzido, emoji emocional, descrição educacional e **evidência numérica** (durations, ratio, count). Badges de redFlag nas linhas/cards. Score emocional do período com trend (IMPROVING/STABLE/WORSENING).

### (c) Collections / CFs / hooks
`trades.{compliance,redFlags,shadowBehavior,mentorClearedViolations}`, `students/{uid}/maturity/current`, `mentorConfig/{uid}`, `accounts/{id}/drawdownHistory`; CFs `onTradeCreated`/`onTradeUpdated`/`analyzeShadowBehavior`/`onTradeCreatedAutoEnrich`; hooks `useEmotionalProfile`, `useShadowAnalysis`, `useComplianceRules`.

### (d) DECs
INV-03; DEC-006/007/009; DEC-AUTO-208-04 (stop implícito); DEC-AUTO-119-03 (mirror substitui stub neutro); #221 (mentor limpa violação por par evento×trade).

### (e) Momentos demonstráveis — **CONFRONTO EM PRODUÇÃO (hook de maior contraste)**
- **O sistema nomeia o que o aluno negou sobre si:** o trader declarou no Marco Zero (§2) "sou disciplinado / não faço revenge", e o motor, sobre a operação real, marca `REVENGE_CLUSTER` recorrente (ou `STOP_PANIC`, `HOLD_ASYMMETRY`) com **evidência numérica** na tela do `ShadowBehaviorPanel`. A contradição é factual e mensurável: a autopercepção declarada vs. o padrão detectado, quantificado em `selfAwareness = 100 − distância(declarado, detectado)`. Este é o ponto de densidade narrativa máxima do produto.
- **A penalidade visível:** um evento TILT/REVENGE derruba o score emocional do período em pontos concretos (−20/−15); quando o mentor "limpa" a violação (#221), o score sobe e o badge some — mudança observável na tela.

---

## 6. Indicadores / KPIs

Arquivos: `src/hooks/{useDashboardMetrics,useMaturityHistory,useDrawdownHistory,useCycleConsistency}.js`; `src/components/dashboard/MetricsCards.jsx`; `src/components/{EquityCurve,EmotionAnalysis,MaturityProgressionCard,SwotAnalysis}.jsx`; `src/utils/equityCurveIdeal.js`; `src/pages/StudentDashboard.jsx`.

### (a) Camada de sistema
- **Por operação:** `riskPercent` (RO% efetivo), `rrRatio` (real/assumido), `result`, `shadowBehavior`.
- **Por período:** win rate, profit factor, max drawdown, **compliance rate** (trades sem redFlag / total), EV leakage (`useDashboardMetrics`).
- **Curvas 30/60/90:** maturity history (E/F/O por dia em `students/{uid}/maturity/_historyBucket/history/{YYYY-MM-DD}`), drawdown history (prop), cycle consistency (Sharpe descontado da Selic, CV normalizado, excursão MEP/MEN média).
- **Curva ideal (`equityCurveIdeal.js`):** corredor linear meta/stop pelos **dias corridos** do ciclo (`generateIdealEquitySeries`), ancorado no `basePl` de abertura do ciclo (carry-over #267, não no `plan.pl` atual); `calculateIdealStatus` retorna `above`/`inside`/`below`. O aluno vê a **curva real sobreposta ao corredor ideal** — quão dentro do plano a execução está.

### (b) O que o aluno vê (`StudentDashboard.jsx`)
DashboardHeader (seletor de conta + período CYCLE/MONTH/WEEK), PlanCardGrid (saldo inicial/atual por plano), MetricsCards (win rate, profit factor, max DD, compliance — label "Financeiro" etc.), EquityCurve (real vs corredor ideal com carry-over), EmotionAnalysis (score do período + distribuição + trend), **MaturityProgressionCard** (barra de 5 stages "Progressão de Maturidade" + gates pendentes + guidance IA — **a 4ª dimensão é "Maturidade", não "Comportamental"**), TradingCalendar (heatmap de P&L), TradesList, SetupAnalysis, SwotAnalysis.

### (c) Collections / CFs / hooks
`students/{uid}/maturity/{current,_historyBucket}`, `accounts/{id}/drawdownHistory`; hooks listados acima.

### (d) DECs
DEC-AUTO-267-03/04 (carry-over forward-sum, single-currency), #259 C2 (saldo derivado).

### (e) Momentos demonstráveis
- **Curva real vs corredor ideal:** o instante em que a linha do aluno cai abaixo do piso (`below`) do plano que ele mesmo escreveu.
- **A barra de maturidade subindo um stage** (CHAOS→REACTIVE…), com "X/Y gates para [próximo stage]".

---

## 7. Fechamento de ciclo

Arquivos: `functions/cycleClosure/{closeCycle,reopenCycle,sealCheckMirror,setMentorClosureComment,validators}.js`; `src/components/cycleClosure/CycleClosureWizard.jsx` + `steps/Step1..8`; `src/hooks/{useCycleClosureDraft,useStudentClosures,usePlanClosures}.js`; `src/utils/{openingBalance,cycleClosure/cycleMetrics,cycleClosure/swotHeuristics}.js`; `src/pages/ClosuresPage.jsx`.

### (a) Camada de sistema
**Wizard de 8 etapas:** Step1 Read (snapshot + métricas Van Tharp: R-multiples, win-rate, expectancy, payoff, profit-factor), Step2 Notice (top erros + eventCounts + curva emocional V2 + eventos de execução), Step3 Reflect (AAR 4 perguntas), Step4 Map (SWOT via heurísticas), Step5 Check (conformidade), Step6 Adjust (Kelly real + Monte Carlo + IA stub; **gate de saldo**: `newPl` não pode exceder `cycleBaseline.plFinal`), Step7 Commit (1-2 comportamentos + nextReviewDate +7d), Step8 Seal (checkbox de irreversibilidade).

**CF `closeCycle` — transação atômica** grava doc imutável `cycleClosures/{planId}_{cycleKey}` (idempotente, `schemaVersion:3`) com 10 seções (snapshot, metrics, patterns, aar, maturity, swot, mentor, forward, notes, auditoria). Contratos:
- **C2 `cycleBaseline`** = `{plInicial, saldoFinal, plFinal}` (verdade do ciclo, gravada pelo servidor).
- **C3 `preClosePlanSnapshot`** = foto do plano pré-ajuste (para reversão segura).
- **C4 virada de PL:** `planUpdate.pl = adj.newPl>0 ? adj.newPl : plFinal`; se capital insuficiente, mata a transação ("equity gap").
- **Hard seal** (`sealCheckMirror.js`): trades em `sealedCycleRanges` ou ≤ `lastClosedCycleEnd` são bloqueados (espelha §4). `reopenCycle` restaura `preClosePlanSnapshot` e reverte `currentCycleNumber`.

**PL de entrada do novo ciclo (`openingBalance.js`, DEC-AUTO-267-03):**
```
abertura(N+1) = Σ aportes_iniciais + Σ result(trades com date < início do ciclo N+1)
              + Σ ajusteNaoTrade(closures com cycleEnd < início)
ajusteNaoTrade(closure) = rollPL − cycleBaseline.plFinal,  rollPL = adj.newPl>0 ? adj.newPl : plFinal
```

### (b) O que o aluno vê
Wizard guiado de 8 passos com badge de resultado (% + GOAL_HIT/STOP_HIT/meio), SWOT editável com chips auto-fill, e a tela final de selagem com confirmação irreversível. Timeline de ciclos fechados em `ClosuresPage`.

### (c) Collections / CFs / hooks
`cycleClosures/{closureId}` (imutável); CFs `closeCycle`/`reopenCycle`/`setMentorClosureComment`; hooks `useCycleClosureDraft` (state machine + autosave + gate `canSeal`), `useStudentClosures`, `usePlanClosures`.

### (d) DECs
C2/C3/C4 #259, DEC-AUTO-267-03 (openingBalance forward-sum), DEC-280 ("no comment" explícito do mentor), #281 (daemon pausa conta após blow-up). `[VERIFICAR: Step5Check — função exata lida parcialmente]`.

### (e) Momentos demonstráveis
- **A selagem irreversível:** checkbox + "Selar e Fechar Ciclo" — o ritual que congela o ciclo e trava edição retroativa.
- **Step6 Adjust:** Kelly + Monte Carlo projetando o próximo ciclo, com o gate de saldo bloqueando ajuste acima do patrimônio real.

---

## 8. Revisão semanal

Arquivos: `src/pages/{WeeklyReviewPage,StudentReviewsPage,ReviewQueuePage}.jsx`; `src/components/reviews/*`; `src/hooks/{useWeeklyReviews,useReviewMaturitySnapshot,useLatestClosedReview}.js`; CFs `createWeeklyReview`/`generateWeeklySwot`.

### (a) Camada de sistema
Revisão é **evento persistido** (collection `students/{uid}/reviews/{reviewId}`, DEC-045), independente do fechamento de ciclo. Máquina de estados **DRAFT → CLOSED → ARCHIVED**: mentor cria DRAFT (CF congela `frozenSnapshot` — planId, cycleKey, subset de trades, patternSnapshot — e gera SWOT heurístico); marca CLOSED (aluno passa a ver); ARCHIVED (histórico). **Carry-over de takeaways (DEC-085):** ao criar novo DRAFT, replica itens `!done` da última review do mesmo plano (client-side, best-effort, rastreável via `carriedOverFromReviewId`).

### (b) O que o aluno vê (`WeeklyReviewPage`, single-column ~700px)
9 blocos: trades do período, notas da sessão, links de reunião (editáveis pós-CLOSED, #197), KPIs congelados (`ReviewKpiGrid`), SWOT (4 quadrantes, regenerável se IA indisponível), takeaways (checklist com dupla semântica "aluno ✓" âmbar vs "mentor ✓" emerald, DEC-084), ranking top/bottom 3 setups, evolução de maturidade (gates ganhos/perdidos/estagnados em `MaturityComparisonSection` — **não é um radar "Comportamental"; é comparação de gates**), navegação contextual. O mentor vê o inbox de DRAFTs em `ReviewQueuePage`/`StudentReviewsPage` e edita notas/links/SWOT.

### (c) Collections / CFs / hooks
`students/{uid}/reviews/{reviewId}`; CFs `createWeeklyReview`, `generateWeeklySwot`; hooks `useWeeklyReviews`, `useReviewMaturitySnapshot`, `useLatestClosedReview`.

### (d) DECs
DEC-045 (review persistida), DEC-084 (takeaway dual-semântica), DEC-085 (carry-over), #197 (links como metadata operacional editável).

### (e) Momentos demonstráveis
- **Evolução de maturidade entre reviews:** gates ganhos vs perdidos lado a lado (o progresso ou a regressão tornados explícitos).
- **Takeaway carregado de uma semana para a outra** — a continuidade do acompanhamento visível.

---

## 9. Camada Mentoria Alpha

Arquivos: `src/pages/{MentorDashboard,FeedbackPage,StudentFeedbackPage}.jsx`; `src/components/cycleClosure/{MentorClosuresInbox,MentorClosureView}.jsx`; `src/hooks/{useFeedback,useMentorClosureInbox,useMentorMaturityOverview}.js`; `src/utils/cycleClosure/swotHeuristics.js`.

### (a) Camada de sistema
- **SWOT dinâmico** (`swotHeuristics.js`): `buildStrengths/Weaknesses/Opportunities/Threats` derivam frases de regras sobre as métricas do ciclo (ex.: aderência ≥95% sem red flags → força; tilt sistêmico ≥3 dias → ameaça). Gerado no fechamento (Step4 Map) e na review semanal (`generateWeeklySwot`).
- **Feedback do mentor:** individual (`FeedbackPage`, máquina OPEN → REVIEWED → CLOSED, com QUESTION→REVIEWED loop; chat async com imagens) e **em massa** (`MentorDashboard`, `addBulkFeedback` via `writeBatch` atômico — *contexto recente: a regra de seal foi corrigida no #302 para não bloquear feedback do mentor em ciclo fechado*).
- **Inbox de closures** (`useMentorClosureInbox`): closures dos últimos 7 dias sem `closingCommentAt`, com semáforo de urgência (≤2d red, 3-5d amber, 6-7d emerald; críticos sempre red). DEC-280: "no comment" explícito marca closure como visto.
- **Overview de maturidade** (`useMentorMaturityOverview`): collectionGroup listener sobre `maturity/current` de todos os alunos.

### (b) O que o aluno/mentor vê
Aluno: SWOT na review e no fechamento; respostas de feedback no `StudentFeedbackPage`. Mentor: `MentorDashboard` (overview emocional, seleção múltipla de trades para feedback em massa, tabs de closures), `MentorClosureView` (painel + chat de comentário de fechamento).

### (c) Collections / CFs / hooks
`students/{uid}/reviews`, `cycleClosures`, `trades` (feedback fields); CFs `setMentorClosureComment`; hooks `useFeedback`, `useMentorClosureInbox`, `useMentorMaturityOverview`.

### (d) DECs
DEC-280 (no-comment explícito), #221 (mentor limpa violação), #302 (mentor revisa/classifica em qualquer estado de ciclo — feedback isento do hard seal).

### (e) Momentos demonstráveis
- **Inbox com semáforo de urgência** dos fechamentos a comentar.
- **Feedback em massa** movendo vários trades para REVIEWED de uma vez.

### Nota sobre sessões de mentoria
**Fora do sistema — agendamento externo.** Não há collection/agenda de sessões no código (grep por "session/sessão" não encontrou feature dedicada). As "sessões 1:1" da Mentoria Alpha são agendadas fora do Espelho (ex.: Calendly); o sistema só guarda links de reunião como metadata da review (#197). Não há tela de sessão a demonstrar.

---

## 10. Guardrail CVM (extraído do canônico — sem interpretação)

Fonte: portal v3.0 §14 + Apêndice C (`/mnt/c/000-Marcio/marcioportes.com.br/marcioportes_portal_v3_0.md:781-1010`), DEC-P12/DEC-P13.

**Posição:** o produto vende **educação comportamental + mentoria de processo**, NÃO recomendação de valores mobiliários. Marcio não é analista credenciado CVM (Instrução CVM 20/2021 + Resolução CVM 178). Sinal/screening foi **descontinuado** por risco regulatório (DEC-P13).

**Métricas SEGURAS de exibir como evolução** (vocabulário permitido, Apêndice C): score emocional, compliance pessoal / score de compliance, padrão (emocional/de execução), viés cognitivo, processo, plano operacional (do aluno), aderência ao plano, gestão de risco como conceito, sizing / stop estrutural, payoff, drawdown, RO, frequência de padrão, gates, maturidade. Verbos centrais: identificar, mostrar, observar, mensurar.

**PROIBIDO (Apêndice C — termos que caracterizam recomendação):** sinal/alerta de compra-venda, recomendação/recomendado, oportunidade do dia, alvo/target de preço, ativo do dia / papel quente, carteira recomendada / top picks, stop sugerido de ativo específico, screening. **Implicação para o produto:** P&L / retorno % / ROI **não** podem ser usados como prova de resultado do método — o sistema promete consciência comportamental, não lucro (portal v3.0:106).

**Disclaimer obrigatório (texto exato, v3.0:811):**
> *"Aviso: Este conteúdo tem caráter educacional e comportamental. Não constitui recomendação, oferta, sinal ou aconselhamento de investimentos. Marcio Portes não é analista de valores mobiliários credenciado pela CVM."*

**Nuance (v3.0:819):** discussão 1:1 sobre operações do **próprio aluno** em contexto fechado (Mentoria Alpha) ≠ broadcast público; mas material de marketing da Alpha não pode prometer indicação de ativos/sinais.

---

## Manifesto de fontes lidas

**Verificadas diretamente nesta sessão (Opus):**
`functions/maturity/{constants,computeMaturity,computeEmotional,computeFinancial,computeOperational,helpers,emotionalAnalysisMirror}.js`; `src/utils/equityCurveIdeal.js`; `src/components/MaturityProgressionCard.jsx`, `src/components/reviews/MaturityComparisonSection.jsx`; `docs/marcioportes_portal_v2_0.md` (greps), `/mnt/c/000-Marcio/marcioportes.com.br/marcioportes_portal_v3_0.md` (dimensões §3/§Apêndice D + CVM §14/Apêndice C); `src/version.js`; estrutura de `src/{pages,components,hooks,utils}` e `functions/`.

**Lidas via frentes de recon (leitura real, citadas por caminho):**
`src/pages/{StudentOnboardingPage,StudentDashboard,AccountsPage,AccountDetailPage,OrderImportPage,WeeklyReviewPage,FeedbackPage,StudentFeedbackPage,MentorDashboard,ClosuresPage}.jsx`; `src/components/Onboarding/*`; `src/components/cycleClosure/*` + `steps/Step1..8`; `src/components/{AddTradeModal,PlanManagementModal,EquityCurve,EmotionAnalysis,SwotAnalysis}.jsx`; `src/components/Trades/ShadowBehaviorPanel.jsx`; `src/components/dashboard/MetricsCards.jsx`; `src/hooks/{useAssessment,useQuestionnaire,useProbing,useAccounts,usePlans,useCsvStaging,useOrderStaging,useTrades,useDashboardMetrics,useEmotionalProfile,useComplianceRules,useShadowAnalysis,useMaturityHistory,useDrawdownHistory,useCycleConsistency,useCycleClosureDraft,useMentorClosureInbox,useWeeklyReviews,useMentorMaturityOverview,useStudentClosures,usePlanClosures}.js`; `src/utils/{tradeGateway,emotionalAnalysisV2,violationFilter,shadowBehaviorAnalysis,openingBalance,assessmentScoring,profileClassifier,incongruenceDetector,probingTriggers,stageMapper,cycleClosure/cycleMetrics,cycleClosure/swotHeuristics}.js`; `src/constants/behavioralTaxonomy.js`; `functions/index.js`, `functions/marketData/onTradeCreatedAutoEnrich.js`, `functions/analyzeShadowBehavior.js`, `functions/assessment/{generateProbingQuestions,classifyOpenResponse,analyzeProbingResponse,generateAssessmentReport,classifyMaturityProgression}.js`, `functions/cycleClosure/{closeCycle,reopenCycle,sealCheckMirror,setMentorClosureComment,validators}.js`; `docs/{decisions,invariants,firestore-schema,PROJECT,maturity-engine-spec}.md`, `docs/dev/{trader_evolution_framework,behavioral-weight-map}.md`.

---

## Lista consolidada de [VERIFICAR]

1. **Step5Check do wizard de fechamento** — função exata lida só parcialmente; confirmar o que valida.
2. **`stopUsageRate` / `advancedMetricsPresent` / Sharpe mensal×anual** — usados em gates de maturidade; origem em `src/utils/kpiValidation.js` e `src/utils/maturityEngine/*`. Fórmula não verificada na 5ª casa (decisão: irrelevante para o objetivo — o que importa é que o gate existe e o que mede).
3. **Portal v3.0 fora do git** — lido só nas seções de 4D e CVM (escopo autorizado). Demais seções (preços, catálogo completo) não incorporadas — fora do escopo deste mapa.
4. **`MaturityComparisonSection` (review)** — confirmado que mostra gates ganhos/perdidos, não radar 4D; se existir em algum lugar um radar com eixo rotulado "Comportamental", não foi encontrado (a 4ª dimensão aparece como "Maturidade"/"Progressão de Maturidade").
5. **Prop Firm Engine (CHUNK-17)** — mencionado só onde toca o pipeline (§3/§5), por decisão de escopo (não pedido pela missão).

---

*Fim do mapa de sistema. Documento de contexto para a sessão coordenadora Opus 4.8.*
