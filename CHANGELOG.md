# Changelog

All notable changes to **Acompanhamento 2.0 / Espelho** will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version source of truth: `src/version.js`.

---

## [1.83.0] - 16/07/2026 · #339 · PR #340

**feat:** exibir timezone do horário de entrada em todas as telas de trade

- **Helper** `shortTzLabelFromIso(iso)` → `ET|CT|BRT` (reidrata IANA via `tzFromStoredIso` — offset cru é ambíguo: -05:00 = ET-inverno ou CT-verão).
- **SSoT de exibição** `fmtTradeTime` / `fmtTradeDateTime` em `tradeTimezone.js` — usa o **relógio de parede do trade**, não o fuso do navegador.
- **Grupo A** (mostravam wall-clock sem label): FeedbackPage, MentorDashboard ×2, StudentFeedbackPage, TradesList, TradeDetailModal.
- **Grupo B** (mostravam no fuso do navegador → mesma operação divergia por quem abria): `reviewFormatters.fmtTime` passa a delegar ao SSoT (corrige ReviewTradesSection), OrderStagingReview, ConversationalOpCard.
- ISO legado sem offset → só a hora, sem label (fallback defensivo, não quebra).
- Grupo B agora mostra o horário que o trader operou, não o do navegador (correção de inconsistência — DEC-AUTO-339-02).


## [1.82.5] - 04/07/2026 · #337 · PR #338

**fix:** TPS fator Consistência real (CV normalizado) + fim do placeholder 0,70

- **Consistência real:** `cvToConsistencyNorm(cvValue)` mapeia o **CV normalizado do ciclo** (SSoT `useCycleConsistency`, mesma fonte do tile 'CV norm.') para 0..1 — `clamp01((2 - value)/1)`: value ≤ 1 (no plano/mais suave) → 1,0; = 1,5 → 0,5; ≥ 2,0 (muito errático) → 0. O 2,0 é a fronteira 'muito errático' já existente nas bandas de `cvTheme`. Mata o placeholder **e** a duplicação de conceito (uma consistência só).
- **Renormalização:** quando um fator não-crítico não tem dado (ex.: CV null em ciclo curto), `computeTPS` **redistribui o peso** proporcionalmente sobre os presentes — nada de crédito 0,70 fantasma nem zero injusto. Caso completo mantém peso nominal bit-exato. PF + Aderência seguem obrigatórios.
- **Composição enxuta:** os 5 cards param de reimprimir o valor bruto (já está no tile acima) — mostram só **contribuição em pts / peso efetivo** ('por que a nota'). Fator sem dado → 'sem dado' + aviso de redistribuição.


## [1.82.4] - 03/07/2026 · #335 · PR #336

**fix:** DISCUSSED restante — seção Feedback do aluno + subcontagem no card do mentor (follow-up #333)

- **`StudentFeedbackPage.jsx`** (seção Feedback do sidebar do aluno): `STATUS_CONFIG` não tratava `DISCUSSED` → badge caía no fallback OPEN e mostrava **"Pendente"**; contador e pills de filtro também o ignoravam. Agora config própria "Discutido" (índigo, ícone MessageSquare) + bucket no contador + pill de filtro.
- **`MentorDashboard.jsx`** (`studentsWithPending`): `counts.reviewed` só somava `REVIEWED`; um trade `DISCUSSED` sumia do resumo "revisados" do card do mentor (`StudentFeedbackCard`). Agora DISCUSSED conta como revisado.
- **`useTrades.js`** (`getStudentFeedbackCounts`): mesmo ajuste no bucket `reviewed`; enum `STATUS` local ganhou `DISCUSSED`.
- Auditoria completa de todos os consumidores de `trade.status` — demais pontos (guards de pendência, awaiting-feedback, transições, badges de review) tratam DISCUSSED corretamente ou não devem incluí-lo.
- `useTrades.test.js` +1: `getStudentFeedbackCounts` conta DISCUSSED como revisado.
- Display/contagem puro — **sem CF, sem Firestore, sem migração**.


## [1.82.3] - 03/07/2026 · #333 · PR #334

**fix:** trade DISCUSSED aparecia como "Pendente" / "Aguardando Revisão"

- **Causa-raiz:** o #269 v2 introduziu o status terminal `DISCUSSED` (revisado + discutido numa revisão semanal publicada, setado por `publishReview.js`), mas 4 mapeamentos de badge de status não o tratavam e caíam no fallback — dando a impressão de que a revisão nunca fora feita.
- `ExtractTable.jsx` (coluna Status do extrato): `DISCUSSED` mostrava **"Pendente"**; agora → **"Discutido"** (índigo, espelhando o `TradeStatusBadge`). `getFeedbackStatusConfig` exportado p/ teste.
- `FeedbackPage.jsx`: `DISCUSSED` caía no fallback `config.OPEN` → **"Aguardando Revisão"**; agora config própria "Discutido".
- `TradesList.jsx` e `TradeDetailModal.jsx`: idem, config `DISCUSSED` adicionada.
- **Recolor** no extrato: "Fechado" (CLOSED) de cinza → roxo (paridade com "Encerrado"); "Pendente" ganhou contraste (`slate-400`) — Pendente e Fechado deixam de compartilhar a mesma cor.
- `feedbackStatusConfig.test.js` (novo): trava DISCUSSED → "Discutido" (nunca "Pendente"), cores distintas por status, fallback preservado (6 testes).
- Display puro — **sem CF, sem Firestore, sem migração**.


## [1.82.2] - 03/07/2026 · #331 · PR #332

**fix:** SWOT em revisão DRAFT — CF aceita snapshot do cliente

- **CF** `generateWeeklySwot`: aceita `data.snapshot` opcional; `resolveSwotSnapshot(clientSnapshot, review)` → snapshot do cliente (DRAFT) ou `frozenSnapshot` (publicada); **400 só quando ambos ausentes**. planId/prompt/fallback usam o snapshot resolvido.
- **Hook** `generateSwot({ reviewId, snapshot })` repassa à CF.
- **Surfaces** `WeeklyReviewPage` e `ReviewToolsPanel` montam e passam o snapshot em DRAFT. (`WeeklyReviewModal` é legado/não montado — intocado.)
- **Refactor**: builder extraído para `src/utils/rebuildReviewSnapshot.js` (fonte única, DRAFT-correta — planId de `review.planId`, membros por `reviewId`); elimina duplicação.
- `generateWeeklySwot.test.js` (novo): `resolveSwotSnapshot` — 5 casos (DRAFT usa cliente / publicada cai no frozen / prioridade / null→400 / defensivo não-objeto).
- `useWeeklyReviews.test.js`: pass-through do snapshot (2).
- Suítes completas verdes: **src 3524**, **functions 203**; build ok.


## [1.82.1] - 02/07/2026 · #329 · PR #330

**feat:** colapso na fila 'trades a refletir' quando há muitos pendentes

- Card **colapsável**: header (Eye + título + contador + chevron) sempre visível; clique recolhe/expande.
- **Default colapsado quando `pending > 8`**; poucos → expandido. Toggle do usuário sobrepõe.
- Corpo expandido com `max-h-72 overflow-y-auto` (não empurra a página).
- **Sem** ação de 'dispensar'/rastreio de 'não vou refletir' (aluno carrega a responsabilidade) — o contador segue cobrando mesmo colapsado.


## [1.82.0] - 02/07/2026 · #327 · PR #328

**feat:** fila 'trades a refletir' — cobra reflexão de fechados sem selfReview

- `PendingReflections` (9): filtro fechado/refletido/aberto/breakeven, planId, contador sing/plural, clique.
- `TradeDetailModal` gate (4): aluno vê nudge; mentor não; sem onSubmitReview não; aberto não.
- Frontend **3519 passed / 226 files**. Build verde.


## [1.81.0] - 01/07/2026 · #325 · PR #326

**feat:** anotação de sessão no compositor de feedback (nasce com REVIEWED)

- Campo 'ponto pra revisão (opcional)' **no compositor** de feedback (mentor-only), nos dois layouts.
- Ao **enviar feedback** (OPEN→REVIEWED ou QUESTION→REVIEWED), a nota (prefixada com dados do trade) vai como `_pendingReviewNote` no mesmo write.
- O trigger `onTradeUpdated` persiste a nota no `sessionNotes` do rascunho **na transição** e limpa o campo. Como enviar feedback leva o trade a REVIEWED, a nota **sempre** cai num rascunho que contém o trade.
- Se o mentor escreve a nota e **não envia** → descartada (nenhum rascunho órfão / trade OPEN no rascunho).
- `appendReviewSessionNote` (5), `addFeedbackComment` _pendingReviewNote (4).
- Frontend **3506 passed / 225 files** + functions **198 passed**. Build verde.


## [1.80.1] - 01/07/2026 · #323 · PR #324

**fix:** reflexão do aluno no feedback — full-page + aviso ao mentor quando ausente

- Reflexão feita → `TradeReviewSection` read-only.
- Ausente + mentor → **alerta âmbar** ('aluno não fez a auto-análise — cobre no feedback').
- Ausente + não-mentor → nada.


## [1.80.0] - 01/07/2026 · #315 · PR #322

**feat:** evidência mentor-only + imagens HTF/LTF opcionais + reflexão do aluno no feedb

- `BehaviorPanel.jsx` + `UndersizedBody` (`behaviorDisplay.jsx`): gate `isMentor`.
- Removida a validação `newErrors.htf/ltf` + asterisco dos labels. Edição inalterada.
- `FeedbackPage`: renderiza `<TradeReviewSection trade={trade} />` read-only perto do `BehaviorPanel`.
- `StudentReviewsPage`: passa `showSelfReview` ao `ReviewTradesSection` (paridade com `WeeklyReviewPage`).
- Estado explícito "o aluno ainda não fez a auto-análise deste trade" quando não há `selfReview`.
- `BehaviorPanel.test.jsx` (21) + `ReviewTradesSection.test.jsx` (11) — 32 passando. Build verde.
- Versão (bump v1.80.0) + CHANGELOG + liberação de locks ficam pro encerramento (`cc-close-issue.sh`). A reserva original de v1.78.0 ficou obsoleta — main avançou pra 1.79.1 (#318/#320) enquanto a issue estava aberta.


## [1.79.1] - 01/07/2026 · #320 · PR #321

**fix:** botão 'Anotar ponto pra revisão' faltava no layout full-page da FeedbackPage

- _(decisões/testes/files — ajustar antes do commit)_


## [1.79.0] - 01/07/2026 · #318 · PR #319

**feat:** anotar ponto pra Revisão (Notas da Sessão) direto do trade

- `useWeeklyReviews.appendSessionNote(reviewId, text)` — read-modify-write (`getDoc` → append `
` → `updateDoc`); **não** sobrescreve o blob (≠ `updateSessionNotes`).
- `utils/reviewNotePrefix.fmtTradePrefix` — âncora `[DD/MM HH:MM SÍMBOLO ±RESULT]` (restore do helper antigo).
- `components/reviews/AddReviewNoteButton` (mentor-only) — acha o DRAFT aberto de `trade.planId`; se não existe ainda, **desabilitado** ("disponível após o 1º feedback — a revisão nasce aí"). **Não cria revisão no cliente** → evita rascunho duplicado (bug do hotfix `14cca576`).
- Wire na FeedbackPage (linha de ações do mentor).
- Sem collection/campo novo (`sessionNotes` já existe) → INV-15 não dispara.
- Sem mudança de rules (mentor já edita DRAFT via cliente).
- Sem novo CF / sem deploy.
- `reviewNotePrefix` (7) + `appendSessionNote` (5: append preserva prévio, no-op vazio, trim, error).


## [1.77.1] - 01/07/2026 · #316 · PR #317

**fix:** mentor não consegue dar feedback — classifyStudent com args trocados

- Backend `functions/_shared/studentClassify.js`: `classifyStudent(subs)` — 1 arg
- Frontend `src/utils/studentClassify.js`: `classifyStudent(_student, subs)` — subs é o **2º** arg
- **`useTrades.reviewScope.test.js` (novo):** exercita o gate com o `classifyStudent` **real** (sem mock) — alpha/trial-alpha passam, espelho/sem-sub bloqueiam. Validado que fica **vermelho sem o fix** (3 falhas).
- **`useTrades.test.js`:** trazido pro commit (coverage da #269 que ficou untracked no working tree).
- Suite completa: **3487 passed / 223 files**. Build verde.


## [1.77.0] - 25/06/2026 · #313 · PR #314

**feat:** Reflexão na entrada do trade + copy de auto-análise

- `AddTradeModal`: pós-create (trade novo, com result, `onSubmitReview` presente) abre o passo de Reflexão do trade recém-criado em vez de fechar; botão "Pular por agora". Edição segue fechando direto.
- `TradeReviewSection`: prop `startOpen` abre direto nas perguntas (pula o nudge) no fluxo de registro. Copy reescrita (Reflexão / auto-análise / "Análise ·"); **não** toca o nome do produto/plano "Espelho".
- `TradesJournal`/`StudentDashboard`: `handleAddTrade` retorna o trade criado; fechamento passa a ser do `onClose`. View-as do mentor não dispara reflexão.


## [1.76.0] - 24/06/2026 · #269 · PR #312

**feat:** Revisão por backlog (FK reviewId) + SWOT customizável + filtro matriz Alpha/Tr

- `trade.reviewId: string|null` — FK imortal para a revisão semanal. Carimbada no 1º feedback do mentor (`OPEN→REVIEWED`), nunca apagada.
- `trade.status` ganha terminal `DISCUSSED` (publicação trava o trade).
- Pertencimento = `trades WHERE reviewId == id` (morre `includedTradeIds`/`reviewState`/`draftReviewId`).
- Rascunho aberto nasce sob demanda (`getOrCreateOpenReview`), publicado em `publishReview`.
- Definição pelo plano/subscription (`classifyStudent`), sem campo novo.
- `onTradeUpdated` não ancora `reviewId` fora de escopo; `useTrades` bloqueia feedback do mentor (individual+bulk); migração pula fora-de-escopo.
- `migrateReviewStateBackfill`: 584 mudanças, 241 órfãos-com-feedback ancorados no rascunho vigente, 13 rascunhos provisionados. Safeguard D8.
- Correção retroativa filtro matriz: 60 trades un-anchorados + 7 drafts removidos (alunos fora de escopo hoje).


## [1.75.0] - 10/06/2026 · #308 · PR #311

**feat:** Espelho (auto-revisão de trade) + fixes de import + email

- **Espelho (CHUNK-04):** questionário processo × resultado por trade; espelho determinístico (confronto declarado × detectado), não mexe no 4D. Escrita no fluxo de edição (lápis, só trade fechado); olho read-only. `firestore.rules`: aluno grava `selfReview`, isento do seal #259, imutável após DISCUSSED.
- **Coverage gap no import (CHUNK-10):** banner lista ops sem plano e oferece Descartar / Aceitar no plano atual / Criar plano retroativo (gate duro → resolúvel).
- **Timezone (#292):** trade novo exige eleger fuso (MEP/MEN); edição deriva do banco (`tzFromStoredIso`); import sem sticky silencioso (corrige "Brasília → NY"). Fix de closure stale do `importTimezone`.
- **Email de boas-vindas (CHUNK-01):** `APP_NAME` nome de código → **Espelho**; `APP_URL` → **app.marcioportes.com.br**.

## [1.74.1] - 10/06/2026 · #309 · PR #310

**fix:** deleteStudent limpa movements/cycleClosures/Storage órfãos (#309)

- `movements` de **DEPOSIT/WITHDRAWAL/INITIAL_BALANCE/ADJUSTMENT** só têm `accountId` (sem `studentId`) → ficavam órfãos. Só `TRADE_RESULT` tem `studentId`.
- `cycleClosures` (top-level com `studentId`) estava **fora** de `TOP_LEVEL_COLLECTIONS`.
- Screenshots HTF/LTF em `trades/{tradeId}/...` no Storage nunca eram limpas.
- movement de **depósito (só accountId)** E de **trade (studentId)** ambos apagados;
- `cycleClosures` apagado; isolamento dos dados de outro aluno;
- Storage best-effort (falha não aborta) + bucket null;
- aluno sem contas; counts por coleção.
- `firebase deploy --only functions` (toca `functions/`).


## [1.74.0] - 05/06/2026 · #305 · PR #306

**feat:** pesos do comportamento no 4D + ruleViolationRate gates + clearing (#305)

- _(decisões/testes/files — ajustar antes do commit)_


## [1.73.0] - 04/06/2026 · #301 · PR #304

**feat:** motor unificado detectBehavior + ativação + UX + Confronto Emocional (#301)

- `detectBehavior` (`src/utils/behavioralDetection/`) wrap dos 4 caminhos (execução #208, shadow #129, emocional #189, agregados) com dual-emit (canônico+legado). Baseline #299 intacto + paridade ESM≡CJS. Taxonomia SSoT `src/constants/behavioralTaxonomy.js` (Fase 0).
- **Persistência:** campo inline `trade.behaviorProfile` (DEC-AUTO-301-04, INV-15 aprovado).
- **Auto-trigger:** `recomputeForStudent` (onTradeCreated/onTradeUpdated) grava só o delta por fingerprint; campo fora do guard → sem loop. on-plan-change via `recalculateCompliance`.
- **Backfill:** callable `analyzeShadowBehavior` sobrescreve legados.
- **DRY:** detectores shadow extraídos p/ `functions/shadow/shadowDetectors.js` (desacoplado de firebase-functions).
- `BehaviorPanel` consolida ① adesão ao plano → ② padrões (narrativa semântica + cor por severidade) → ③ trava de gate → interpretação do mentor. Aposenta ShadowBehaviorPanel + ExecutionPatternsPanel + redFlags inline. Aluno vê os dados.
- Estado vazio distingue não-calculado / limpo / alinhado.
- Confronta `emotionEntry` declarada × emoção que a execução sugere (matriz aprovada). Banner manchete 🔴/◐/✓, tom espelho.


## [1.72.1] - 03/06/2026 · #302 · PR #303

**fix:** hard seal #259 isenta feedback do mentor em ciclo fechado

- **A) Trade em ciclo fechado.** Status `OPEN` (workflow de revisão) e ciclo selado (fechamento) são ortogonais — aluno fecha ciclo com trades ainda `OPEN` esperando o mentor.
- **B) Plano órfão.** `get(/plans/planId).data` quebra se o plano foi deletado → `permission-denied`.
- Sem harness de rules-unit-testing no repo (consistente com #271/#254 — deploy + smoke). Validação de sintaxe via deploy.
- Smoke pós-deploy: feedback em massa em trade de ciclo fechado.


## [1.72.0] - 01/06/2026 · #299 · PR #300

**feat:** baseline + taxonomia + mapa de pesos do framework

- **`docs/dev/behavioral-weight-map.md`** — mapa de pesos derivado do `trader_evolution_framework.md` (aprovado por Marcio 01/06; findings passam a mapear viés→dimensão E/F/O; positivos como bônus; `ruleViolationRate` §5.3 como gate). Números finais calibram na Fase 2.
- **`src/constants/behavioralTaxonomy.js`** (+ mirror CJS `functions/maturity/behavioralTaxonomyMirror.js`) — SSoT: 17 padrões canônicos, `LEGACY_CODE_ALIAS` colapsando as 4 sobreposições (hesitação×3, loss-chasing×2, stop-panic×2, sub-sizing×2), helpers `resolveCanonical`/`getPattern`, `SCORING_CODES`/`GATE_CODES`.
- **`behavioralBaseline.snapshot.test.js`** — congela outputs atuais (STOP_TAMPERING/HIGH, tilt 3, revenge×2, periodScore 40) como contrato de não-regressão das Fases 1/3/5.
- **`behavioralTaxonomy.parity.test.js`** — paridade ESM≡CJS + invariantes.
- Suíte completa **3354/3354** + build verdes. Zero regressão.
- Paridade ESM≡CJS verde. Nenhuma alteração de Firestore/CF.


## [1.71.1] - 31/05/2026 · #296 · PR #297

**fix:** correlator op↔trade compara wall-clock (offset-neutro)

- Massa real: **59/59** ordens casam em qualquer fuso (naive/BRT/ET/CT). Era 3/59 em ET.
- +5 testes de regressão; suite correlator 31/31; suites order/csv/reconstruction 111/111; build verde.
- Sem alteração de Firestore/CF.
- Vigência de plano = fim do período do ciclo (cobertura de trades genuinamente novos; hoje ancora em `plan.createdAt`).
- Default de fuso do order import = BRT fixo (vs ET no CSV/manual) → instante absoluto errado em trades novos do order import.


## [1.71.0] - 31/05/2026 · #294 · PR #295

**feat:** rebrand Espelho do Trader nas telas de entrada (Login + Sidebar)

- **Nova marca** `src/components/EspelhoLogo.jsx` — `EspelhoMark` (símbolo ‹|› teal isolado) + `EspelhoLockup` («‹|› Espelho» com reflexo). Porte JSX de `marcioportes-portal/app/components/EspelhoLogo.tsx`.
- **Sidebar** — "Tchio / Alpha" → ‹|› + "Espelho / do Trader"; item de menu ativo migra de azul para teal.
- **Login (esquerda)** — "Acompanhamento 2.0 Trading Journal" → logo Espelho do Trader.
- **Login (decoração direita) — hero elevado** — porte do ambiente visual do portal: `HeroParticles` (canvas de partículas teal), orbs flutuantes, grain, `EspelhoLockup` em 6xl/7xl com eyebrow "Produto" + tagline "do Trader" + headline do produto. Animações `espelho-in` (fade-up escalonado), respeitando `prefers-reduced-motion`.
- `npm run build` verde.
- Suite Sidebar 12/12 (sem testes acoplados ao wordmark antigo).
- Smoke visual em `localhost:5173` aprovado por Marcio (31/05/2026).


## [1.70.0] - 29/05/2026 · #292 · PR #293

**feat:** timezone explícito no import de trades (CSV + Order)

- Seletor **"Fuso dos horários"** no passo de Mapeamento (layout vira 3 colunas: Bolsa · Data · Fuso), por lote.
- Default **sticky** (localStorage) + **derivado da Exchange** (CME/CBOT/NYMEX/COMEX → ET, B3 → BRT); persiste no template.
- `csvMapper.buildTradeFromRow`/`applyMapping` gravam `entry`/`exitTime` via `naiveIsoToOffset` — ponto único, cobre modo padrão e inferência. tz **não vaza** como campo do trade.
- Seletor "Fuso" na etapa de seleção de plano (sticky, fallback BRT).
- **Bug latente corrigido:** `reconstructOperations` fazia `new Date(naive).toISOString()`, interpretando o horário no fuso do servidor → `Z` ambíguo. Agora reconstrói no fuso do lote (`_iso`) → ISO+offset; ordens já com offset/Z passam direto; **duração preservada** (offset constante não distorce `durationMs`).
- `csvMapper`: +6 casos de fuso (naive/ET-EST/ET-EDT/BRT/sem-vazamento/applyMapping).
- `orderReconstruction`: +5 casos (naive/BRT/ET-DST/offset-passa-direto/duração).
- Suíte **3335 verdes** (209 arquivos) + build.


## [1.69.0] - 29/05/2026 · #289 · PR #291

**feat:** SWOT e Maturidade escopados ao ciclo (Fase 2, PR 2/2)

- **SWOT segue o ciclo**: `useLatestClosedReview` ganha filtro `cycleKey` (match no topo ou em `frozenSnapshot.planContext.cycleKey`); `null` = sem filtro ("Todos os ciclos" → última revisão).
- **Arquitetura**: fetch da review elevado para `StudentDashboard` (fonte única, compartilhada entre SWOT e Maturidade). `SwotAnalysis` vira presentacional (`review`/`loading` como props).
- **Maturidade segue o ciclo**:
- **Gate**: SWOT + Maturidade agora atrás de `planSelected` (precisam de ciclo → plano). Convergência final: **sem plano = só Curva de Patrimônio + CTA.**
- `useLatestClosedReview`: +4 casos de `cycleKey` (14 total).
- `SwotAnalysis.test.jsx`: reescrito para props (8).
- Invariante de gate: +1 caso Fase 2 (5).
- Suíte **3324 verdes** (209 arquivos) + build.


## [1.68.0] - 28/05/2026 · #285 · PR #288

**feat:** timezone explícito no horário do trade — MEP/MEN correto (manual + backend)

- **AddTradeModal**: seletor **Fuso** sticky (`useLocalStorage`), default **ET** pra CME, **BRT** pro resto; helper **"≈ Brasília"** pro aluno conferir mentalmente.
- **`combineDateTimeWithTz`**: grava `entryTime`/`exitTime` como **ISO+offset** (ex.: `2026-05-27T16:23:00-04:00`) — instante absoluto.
- **TradeDetailModal**: botão **"🔄 Recalcular MEP/MEN"** (CME futures + `excursionSource`), zera mep/men → `onTradeUpdated` re-enriquece.
- **`onTradeUpdated`**: detecta `timeChanged || mepCleared`, dispara `runEnrichment` idempotente; loop guard (enrich só toca mep/men/excursionSource).
- **`enrichTradeWithExcursions`**: reconhece `HAS_TZ` → ISO+offset passa direto sem aplicar Brasília fixo; legado naive segue Brasília-assumido.
- **`utils/tradeTimezone`**: `isUSDST` (2º dom março / 1º dom novembro), `getOffset` com DST automático ET/CT, BRT fixo -03:00, `defaultTzForTicker`.
- (a) Seletor sticky + default por instrumento.
- (b) Legado naive mantido como está (Brasília-assumido).


## [1.67.0] - 27/05/2026 · #267 · PR #283

**fix:** bugs táticos — MEN/MEP Yahoo, carry-over de patrimônio, cleared no 4D

Guarda-chuva. Escopo final: bugs 1, 2, 6 (bug 3→#275, bug 4→#269, bug 5 retirado).

- **bug 1 — MEN/MEP via Yahoo** (`functions/marketData/enrichTradeWithExcursions.js`): enrichment **aborta** (`excursionSource: 'unavailable'`) quando falta `entryTime` OU `exitTime`, em vez de cair em janela inventada (`date`/duração-zero); `entryTime`/`exitTime` naive interpretados como America/Sao_Paulo (UTC-3) — janela Yahoo reflete o horário real do trade (DEC-AUTO-267-01/02).
- **bug 2 — carry-over de patrimônio** (`src/utils/openingBalance.js`, `useDashboardMetrics`, `EquityCurve`, `equityCurveIdeal`): a curva de patrimônio de um ciclo abre no **fechamento do ciclo anterior** (não no aporte), por forward-sum derivado `aporte + Σ trades antes da janela + Σ ajuste-não-trade de fechamentos`. Corredor ideal ancora na mesma abertura (alinha as curvas em ciclos passados). Single-currency; multi-moeda mantém saldo por moeda (DEC-AUTO-267-03/04).
- **bug 2 — "Todos os ciclos"** (`ContextBar`, `cycleResolver`, `StudentContextProvider`): sentinela `__ALL__` no dropdown Ciclo destrava a obrigatoriedade de ciclo → todo o histórico (Período fica "Todo o histórico", desabilitado).
- **bug 6 — limpeza de compliance reflete no extrato e no 4D** (`functions/maturity/preComputeShapes.js`, `src/components/extract/ExtractTable.jsx`): `calcComplianceRate` conta via `hasEffectiveRedFlags` → propaga `mentorClearedViolations` aos gates Compliance ≥80%/≥95% e à dimensão Operacional; extrato suprime badges NO_STOP/RO/RR limpos pelo mentor. Eventos de execução (#208) ficam fora — não são limpáveis (DEC-AUTO-267-05).
- Cosmético (sugestão de aluno): campo Observações do modal de entrada `rows` 2→4.
- Testes: +29 (openingBalance, sentinela, calcComplianceRate cleared-aware, tz/abort do enrichment). Suíte 3288/3288. **Deploy de CFs** (`enrichTradeWithExcursions` + `preComputeShapes`).


## [1.66.0] - 27/05/2026 · #282 · PR #284

**feat:** paridade de indicadores e nomenclatura Dashboard ↔ Fechamento de Ciclo

- **SSoT de apresentação** `src/components/metrics/cycleMetricTiles.jsx` — `MetricTile` + themes/contents/tooltips, consumido por dashboard e wizard. Vocabulário **técnico + tooltip didático** (DEC-AUTO-282-01).
- **Dashboard** `CycleConsistencyCard` passa a consumir a SSoT (−240 linhas locais), sem regressão visual.
- **Wizard de Fechamento** (`Step1Read`) ganha o grupo **Consistência** (Sharpe / CV norm. / MEP médio / MEN médio via `useCycleConsistency`), o grupo **Performance** re-rotulado pro técnico e o breakdown do TPS alinhado. Consistência é display-time, não congela no `frozenSnapshot` (DEC-AUTO-282-02).
- Testes: +14 (11 SSoT + 3 wizard). Suíte 3258/3258. Sem mudança em Firestore/CFs.


## [1.64.1] - 24/05/2026 · #280 · PR #281

**fix:** 'marcar sem comentário' não remove item do inbox do mentor

- `useMentorClosureInbox` filtrava por presença de conteúdo em `mentor.closingComment` (vira `null` no fluxo "no comment"); trocado por `!!c.mentor?.closingCommentAt` (timestamp sempre setado pela CF) em 2 lugares — filtro de itens (`:86`) e `pendingCount` (`:150`)
- Semântica passa a ser "mentor processou (com ou sem comentário)" em vez de "tem texto de comentário"
- Edge case aceito: mentor digita, salva e apaga o texto → item fica fora do inbox (timestamp persiste)
- Teste de regressão em `useMentorClosureInbox.test.js`; 5 testes verdes


## [1.64.0] - 24/05/2026 · #259 · PR #264

**feat:** 1A — Ritual completo de Fechamento de Ciclo

- Wizard 8 etapas (Read/Notice/Reflect/Map/Check/Adjust/Commit/Seal) com autosave + CycleExpiredGuard sequencial + Timeline de capítulos
- Camada mentor: inbox com semáforo de urgência + comment panel + gate de reabertura encadeada
- 6 Cloud Functions (closeCycle, reopenCycle, setMentorClosureComment, deleteAccountCascade, deletePlanCascade, sealCheckMirror) + 2 composite indexes
- Métricas: TPS, R-multiple, Expectancy_R, ruleAdherenceRate, Kelly real Quarter, Monte Carlo bootstrap
- IA stub heurístico: 6 regras (PAUSE crítico → fallback)
- Contratos C1-C5: PL imutável, saldo derivado on-the-fly, snapshot/restore na reabertura, gate retroativo
- Sistema inline de toast/confirm substituindo window.alert/confirm em 13 arquivos
- 203 suítes / 3239 testes verdes
- Reserva 1.58.0 original pulada — main avançou pra 1.63.0 durante o dev, reserva re-tomada em 1.64.0


## [1.63.0] - 22/05/2026 · #278 · PR #279

**feat:** UNDERSIZED_TRADE — calibragem 65% + evidência educacional R-local vs R-plano

- _(decisões/testes/files — ajustar antes do commit)_


## [1.62.0] - 14/05/2026 · #273 · PR #274

**feat:** mesa Zero7 Tesouraria + catálogo Lucid completo + plano de ataque per-template

- **Zero7 Tesouraria** (6ª firma do portfólio CHUNK-17, primeira BR/BRL): 8 templates (TRAINEE/JÚNIOR/PLENO/SÊNIOR/EXPERT/MASTER + BIT 8/16). Schema com 5 campos novos no template: `currency`, `consistency.maxDayPercentOfTarget`, `payout.scheduleType` (FIXED_DAYS) / `fixedDays` ([10,20,30]) / `maxWithdrawalsByPhase` ({SIM_FUNDED: 4}) / `ineligibleTradeFilter` ({WIN: 10, WDO: 0.5, BIT: 1000}). `accountSize: 0` no engine (modelo Zero7 = "saldo positivo soma ao limite de perda"). 3 instrumentos B3 novos: WIN, WDO, BIT.
- **Regra de consistência 50%** Zero7 (`src/utils/propFirmConsistency.js`, novo): EVALUATION desclassifica conta em dia > 50% do target; SIM_FUNDED descarta o dia inflado do saldo elegível para payout. Flag `CONSISTENCY_VIOLATION` em `propFirmAlerts`.
- **Payout fixed-days** (calendário 10/20/30 — Zero7) com branch `FIXED_DAYS` em `propFirmPayout.js`. Contador "X/4 saques na Incubadora" + nota "Limite atingido, próximos lucros migram para margem". Filtro de saldos inaptos por instrumento aplicado na agregação.
- **Phase labels por firma** via `getPhaseLabelByFirm` — Zero7 mostra "Avaliação/Incubadora/Conta Real" (regulamento Zero7), demais firmas mantêm "Evaluation/Simulado Funded/Live".
- **Sharpe multi-currency** (`computeCycleSharpe` opts.currency + getRiskFreeRateFn) — BRL→Selic, USD→PLACEHOLDER rate=0 (DT-Zero7-03 — SOFR real fica como DT). Fecha bug latente: Selic era aplicada a trades USD.
- **Catálogo Lucid completo** *(scope creep autorizado em sessão de revisão)*: 12 templates (Pro/Flex/Direct × 25K/50K/100K/150K). 3 existentes corrigidos com regras reais publicadas pela Lucid: Pro 50K DLL `$500 PERCENT_PROFIT/FAIL` → `$1200 FIXED/PAUSE_DAY`, target `$2500→$3000`, fundedRule `0.35→0.40`, contracts `10→4`; ajustes análogos para Pro 100K (DLL $1800, target $6K) e Flex 50K (target $3K, evalRule 0.50). Direct é instant funded (`phases: ['SIM_FUNDED','LIVE']`, consistência 20%). DT-Lucid-01 registra LucidMaxx (invite-only, não catalogado).
- **Plano de ataque per-template (Sweet Spot adaptativo)**: bug arquitetural pré-existente — `ATTACK_PROFILES.CONS_B.recommended = true` era hardcoded com mcStats derivados de Apex 50K (issue #201). Agora `scripts/issue-273-monte-carlo/run-per-template.mjs` parametriza `{DD, target, days}` por template e gera `src/constants/propFirmMcStats.js` (47 templates × 5 perfis × 3 WRs × 100k iter). Algoritmo `pickRecommended`: score = pass − 2×bust @WR50, tie-break prefere CONS_B. Resultado: 39 US recomendam CONS_B (sweet spot histórico), 8 Zero7 recomendam CONS_A (janela 42d + DD/target 1:1 dá folga). UI lê `template.mcStats[code]`/`template.recommendedProfile` via `enrichTemplate` + `formatTemplateMcTip`. Tooltip/label trocam "MC Apex 50K" pelo nome do template ativo.
- **UI fixes (Zero7-driven)**: símbolo `$` hardcoded → `formatCurrencyDynamic` com `selectedTemplate.currency` em `AddAccountModal` (8 lugares) e `AccountsPage` (17 lugares). RO/Stop com sinal negativo e cor vermelha (consistente com Stop diário). "Stop/Meta operacional" → "Stop/Meta diária" (4 lugares — Marcio: "operacional" confundia com Risco Operacional). Dropdown moeda tentativa de lock quando tipo=PROP (não verificada visualmente — DT-273-CurrencyLock).
- **Mirror CJS** em `functions/cycleConsistency/computeCycleSharpe.js` (Sharpe multi-currency).
- **Decisões:** DEC-AUTO-273-01 (STATIC drawdown com accountSize=0 = modelo Zero7), DEC-AUTO-273-02 (carreira Zero7 = troca manual de templateId), DEC-AUTO-273-03 (regra 50% em módulo próprio), DEC-AUTO-273-04 (currencyRiskFreeRate resolve bug Selic vs USD).
- **DTs registradas:** DT-Zero7-01 (promoção automática), DT-Zero7-02 (sensor pós-close 17:30), DT-Zero7-03 (SOFR real), DT-Zero7-04 (migration currency legados — resolvido via seed), DT-Zero7-05 (mirror CJS propFirmConsistency), DT-Lucid-01 (LucidMaxx invite-only), DT-273-CurrencyLock (dropdown moeda).
- **Testes:** suite 3072/3072 verde (3037 baseline + 35 novos: `propFirmConsistency.test.js` 25, `propFirmPayout.test.js` +4, `propFirmAlerts.test.js` +2, `propFirmDrawdownEngine.test.js` accountSize=0, `computeCycleSharpe.test.js` +3).
- **Deploy:** Firestore prod com 47 templates seedados (12 APEX + 12 Lucid + 4 MFF + 4 Tradeify + 7 Ylos + 8 Zero7) via botão "Seed Defaults" do mentor. Cloud Functions redeployadas para refletir mirror CJS Sharpe.


## [1.61.3] - 12/05/2026 · #271 · PR #272

**fix:** causa raiz do badge "aguardando 1º login" — regra Firestore bloqueava `activateStudent`

- **Bug:** `firestore.rules:45` permitia ao aluno (`isOwner`) atualizar apenas `['status', 'firstLoginAt', 'onboardingStatus']`. `AuthContext.activateStudent` tentava escrever 3 campos incluindo `accessStatus: 'active'` — fora da allowlist. Regra rejeitava o update inteiro (não campo-por-campo); o `catch` em `activateStudent` fazia `console.error` e engolia. Nada era gravado — nem `firstLoginAt`, nem `accessStatus`, nem `status`. Regressão silenciosa do DEC-AUTO-263-07: campo `accessStatus` adicionado no cliente sem propagar para a regra. v1.61.2 (#270) corrigiu o lado de leitura (`getAccessStatus`) mas não tinha como ajudar enquanto a escrita falhava.
- **A1 (`firestore.rules`):** adiciona `'accessStatus'` na allowlist do `hasOnly` (DEC-AUTO-271-01). Deploy `firebase deploy --only firestore:rules`.
- **A2 (`AuthContext.activateStudent`):** política extraída para `src/utils/studentActivation.js` (`shouldActivateStudent` + `buildActivatePayload`, puros e testáveis). Guard mudou de `status === 'pending'` para `accessStatus !== 'active'` (DEC-AUTO-271-02) — cobre alunos com `status='active'` mas `accessStatus='pending'` (legado, ou `createInlineStudent` → PROMOTE → escrita falhou). Idempotente: chamada extra não escreve.
- **A3 (testes):** `studentActivation.test.js` com 8 casos. Inclui invariante crítica `payload ⊆ allowlist` — qualquer adição de campo no `buildActivatePayload` sem propagar para `firestore.rules` quebra o teste antes de virar bug.
- **B1 (backfill — `functions/scripts/sync-access-from-auth.js`):** script Admin SDK que para cada doc com `accessStatus !== 'active'` faz `auth.getUserByEmail(email)`; se Auth user existe e tem `metadata.lastSignInTime`, escreve `{status: 'active', accessStatus: 'active', firstLoginAt: lastSignInTime}`. Dry-run default; `--apply` para escrever. Idempotente.
- **Auto-recovery sem backfill:** alunos com sessão Firebase Auth ainda válida se autorrecuperam ao reabrir a app — `onAuthStateChanged` dispara `activateStudent`, regra agora passa, doc fica certo.
- **Decisões:** DEC-AUTO-271-01 (allowlist inclui accessStatus), DEC-AUTO-271-02 (guard por accessStatus, política em util puro).
- **Testes:** suite 3037/3037 verde (3029 + 8 novos). Build verde.
- **Deploy:** rules deployadas no script de encerramento; backfill `sync-access-from-auth.js` rodado após validação.


## [1.61.2] - 12/05/2026 · #270 · hotfix main

**fix:** badge "aguardando 1º login" persiste após aluno logar

- **Bug:** `getAccessStatus` em `src/utils/studentClassify.js` priorizava o campo declarativo `student.accessStatus` antes da evidência factual `student.firstLoginAt`. Aluno com doc inconsistente (`accessStatus='pending'` + `firstLoginAt` populado) ficava preso no chip amarelo "aguardando 1º login" em Acompanhamento, mesmo após login real. Cenários afetados: (1) docs legados que ganharam `accessStatus='pending'` no backfill DEC-AUTO-263-07 mas tinham `status='active'`; (2) alunos onde `AuthContext.activateStudent` não disparou porque guard usa `status === 'pending'`, não `accessStatus`; (3) qualquer caminho que escreva `firstLoginAt` sem mexer em `accessStatus`.
- **Fix:** reordem em `getAccessStatus` — `firstLoginAt` vira sinal de maior precedência; `accessStatus` explícito vence apenas quando não há evidência de login. Mudança puramente derivada (read-only no cliente), sem deploy de CF, sem migração de dados Firestore.
- **Testes:** `describe('getAccessStatus')` novo em `studentClassify.test.js` com 6 casos cobrindo regressão (`accessStatus='pending'` + `firstLoginAt` → `'active'`), precedência do campo explícito quando sem `firstLoginAt`, fallback `status='pending'`, input vazio/null. Suite full verde.
- **Modo:** hotfix direto em `main` (aprovado por Marcio em 12/05/2026, exceção a INV-16) — escopo de 1 linha funcional, alto custo de UX em produção (mentor vê alunos como inválidos), sem risco de regressão lateral.
- **Fast-follow:** Frente B (refatorar `AuthContext.activateStudent` para usar `accessStatus !== 'active'` em vez de `status === 'pending'`, eventual re-run de `backfillAccessStatus` sem guard) sai em issue separado.


## [1.61.1] - 11/05/2026 · #266 · PR #268

**fix:** relatório diário Assinaturas — auto-recovery + label + BRT today

- **Backend:** `checkSubscriptions` ganha auto-recovery — sub com `status='overdue'` e `renewalDate >= today − graceDays` volta para `'active'` no batch. Reconcilia divergência entre UI (computa on-the-fly via `useSubscriptions.deriveStatus`) e CF (lia literal de Firestore). Mirror do autobloqueio G1 #263: desbloqueia Auth user se `student.loginBlockedReason === 'auto'` (bloqueios manuais preservados). Subject + comparações trocadas para `getBrazilToday()` BRT-midnight estável via `Intl.DateTimeFormat` + `Date.UTC` — antes `new Date(); setHours(0)` no servidor UTC mostrava data D-1.
- **Backend:** label condicional `formatDateLabel` substitui `Math.abs(daysBetween)` enganoso — `vence em N dias` / `vence hoje` / `vence amanhã` / `venceu ontem` / `venceu há N dias` com plural correto.
- **Hook:** `updateSubscription` defensive — se `renewalDate` é updated para futuro/dentro-do-grace e status atual é `'overdue'`, reset `'active'` no mesmo update (status explícito em `updates` tem precedência).
- **Refactor:** helpers extraídos para `functions/subscriptions/helpers.js` (puros, testáveis CJS via `createRequire`).
- **Script:** `scripts/issue-266-diag-overdue.mjs` readonly — agrupa subs `overdue` por recuperáveis/legítimos/anomalias. Run em prod confirmou 4 recuperáveis (Wilson, Yoaquim, Rodrigo, Gizele) + 5 legítimos.
- **Decisões:** DEC-AUTO-266-01 (auto-recovery safe-by-default), DEC-AUTO-266-02 (desbloqueio condicional a `reason='auto'`).
- **Validação prod:** deploy + trigger manual via `gcloud scheduler jobs run` — `Batch: 4 operacoes`, `overdue: 9 → 5`. Email com layout correto recebido.
- **Testes:** 3023/3023 verde · functions 108/108 verde (24 novos em `__tests__/subscriptions/helpers.test.js`, 6 novos em `subscriptions.test.js`) · `npm run lint` zero erros · CI verde no PR #268.


## [1.61.0] - 11/05/2026 · #263 · PR #265

**feat:** Acompanhamento — drawer master/detail + autobloqueio + lugar do registro

- **UI:** drawer `StudentDetailDrawer` promovido pra `src/components/Students/`, compartilhado entre Acompanhamento e Assinaturas. Email read-only quando `accessStatus='active'`. Histórico híbrido (sub atual em destaque + flat por data). Botão "Registrar na plataforma" pra candidatos. Drawer reativo via `state=id` derivado de `students[]` real-time.
- **UI:** aba "Alunos" em SubscriptionsPage lista 100% dos `/students` (inclui órfãos) com filtros Todos/Com Auth/Sem Auth/Bloqueados/Sem sub.
- **UI:** modal "Candidatos a Registro" filtra por Auth real (não heurística) via `getInviteStatusBatch`.
- **Backend:** `getInviteStatusBatch` (novo callable) — ground truth via `admin.auth().getUsers()` em batch. `deleteStudent` (refatorado) — cascade LGPD-like (trades/orders/notifications/plans/csvStaging\*/accounts/crossCheck + subcollections + Auth user). `setStudentLoginBlocked` grava `loginBlockedReason='manual'`. `createStudent`/`resendStudentInvite` registram audit `emailSentAt`/`emailSentBy`/`emailSentCount`.
- **Backend:** `checkSubscriptions` (G1 autobloqueio) — sub vira overdue → `auth.disabled=true` + `loginBlocked=true` + `reason='auto'`. Idempotente (não sobrescreve `'manual'`). `onSubscriptionStatusChange` (G3, novo trigger) — sub volta de overdue → `active`/`pending` → auto-unblock se `reason='auto'`.
- **Cleanup:** `AddStudentModal` removido (substituído pelo drawer). Bucket `'aguardando-plano'` removido de `classifyStudent`.
- **Decisões:** DEC-AUTO-263-06 (revogada), DEC-AUTO-263-20 (loginBlockedReason), DEC-AUTO-263-21 (autobloqueio + auto-unblock), DEC-AUTO-263-22 (remove aguardando-plano).
- **Testes:** 3017/3017 verde · `npm run build` verde · CI verde no PR #265.


## [1.56.3] - 05/05/2026 · #256 · PR #257

**fix:** contadores intersect com filtros + remove chip Pendentes

- _(decisões/testes/files — ajustar antes do commit)_


## [1.56.2] - 04/05/2026 · #254 · PR #255

**fix:** regra de leitura para collectionGroup('payments')

- _(decisões/testes/files — ajustar antes do commit)_


## [1.56.1] - 04/05/2026 · #252 · PR #253

**fix:** expand de mês mostra Recebidos + Inadimplentes + Vencimentos

- _(decisões/testes/files — ajustar antes do commit)_


## [1.56.0] - 04/05/2026 · #250 · PR #251

**feat:** resumo de pagamentos do mês no Fluxo de Caixa

- _(decisões/testes/files — ajustar antes do commit)_


## [1.55.5] - 04/05/2026 · #248 · PR #249

**feat:** redesign filtro follow-up — checkbox + on/off (compacto)

- _(decisões/testes/files — ajustar antes do commit)_


## [1.55.4] - 04/05/2026 · #246 · PR #247

**feat:** 3 chips de filtro de follow-up (Todos / Em / Sem)

- _(decisões/testes/files — ajustar antes do commit)_


## [1.55.3] - 04/05/2026 · #243 · PR #245

**feat:** campo follow-up em assinatura + filtro

- _(decisões/testes/files — ajustar antes do commit)_


## [1.55.2] - 04/05/2026 · #242 · PR #244

**fix:** parser distingue stop loss vs stop de ganho em bracket OCO LIMIT

- _(decisões/testes/files — ajustar antes do commit)_


## [1.55.1] - 04/05/2026 · #240 · PR #241

**fix:** gate plano retroativo (dia, não hora) + dedup performance import

- _(decisões/testes/files — ajustar antes do commit)_


## [1.55.0] - 03/05/2026 · #237 · PR #238

**feat:** cadastro de alunos / assinaturas — consolidação em students/subscriptions

- Pivot: `contacts/` collection descartada; tudo em `students/{uid}/subscriptions/` (DEC-237-01).
- `SubscriptionsPage`: criação inline de aluno no modal Nova Assinatura (nome+celular+email opcional, pré-Alpha sem Auth), CRUD por linha, sort/filtro por 6 status/paginação 20-30-50, cards de sumário em `status !== 'cancelled'`. Plano `vip` primeiro-classe (`PLAN_LABELS.vip='VIP'`, badge fuchsia); modais Nova/Edit forçam `plan='vip'` quando `type='vip'`.
- `StudentsManagement`: filtra Alpha não-cancelled (via `useSubscriptions`), busca live de proximidade (nome/email/celular) sobre Alpha existentes, "Usar este" só completa email (se vazio) + celular (se diferente) sem mexer em nome/plano/pagamento. Botão excluir removido — saída de Alpha = troca de plano da subscription preservando histórico.
- Backfill executado em prod: 42 paid trimestrais R$1200 (`startDate=endsAt-3m`, `renewalDate=endsAt` literal) + payment inicial; 12 VIPs órfãos (Daniel já existia, skip idempotente); fix-vip-plan migrou 13 subs `self_service`→`vip`.
- DECs: DEC-237-01 (consolidação em students/subscriptions), DEC-237-02 (aluno pré-Alpha sem Auth), DEC-237-03 (plano `vip` first-class), DEC-237-04 (saída Alpha por mudança de plano), DEC-237-05 (busca proximidade restrita a Alpha).


## [1.54.0] - 02/05/2026 · #235 · PR #236

**feat:** redesign card Consistência Operacional — Sharpe+CV norm+MEP/MEN+Selic (#235)

- _(decisões/testes/files — ajustar antes do commit)_


## [1.53.0] - 01/05/2026 · #229 · PR #230

**feat:** detectar stop em breakeven prematuro + hesitação no stop

- _(decisões/testes/files — ajustar antes do commit)_


## [1.53.0] - 01/05/2026 · #229 · PR #230

**feat:** detectar stop em breakeven prematuro + hesitação no stop

- 2 detectores novos no `executionBehaviorEngine` + paridade `executionBehaviorMirror` (CF): `STOP_BREAKEVEN_TOO_EARLY` (Δt < 5min entre entry e reissue do stop em breakeven) e `STOP_HESITATION` (sinal de indecisão, fora de `TILT_EXEC_TYPES`).
- Tolerance por prefixo de ticker (`getInstrumentTolerance`): WIN=5, WDO=0.5, IND=5, MNQ/NQ/MES/ES=0.25, fallback `max(0.01, 0.05%·entry)`.
- Decisões: DEC-AUTO-229-01 (tolerance + fallback), DEC-AUTO-229-02 (Δt-only na v1, runUp fica como fast-follow), DEC-AUTO-229-03 (STOP_HESITATION não entra em `TILT_EXEC_TYPES`, mas rebate via `EVENT_PENALTIES`).
- Testes: `executionBehaviorMirror.breakevenHesitation.test.js` (108L) + `executionBehaviorEngine.breakevenHesitation.test.js` (284L) + ajuste em `ExecutionPatternsPanel.test.jsx`.
- Files: `functions/maturity/{emotionalAnalysisMirror,executionBehaviorMirror}.js` (CF — deploy obrigatório), `src/utils/{emotionalAnalysisV2,executionBehaviorEngine}.js`, `src/components/Trades/{ExecutionPatternsPanel.jsx,executionPatternsDisplay.js}`.


## [1.52.0] - 01/05/2026 · #221 · PR #224

**feat:** mentor limpa violações com toggle (compliance + emocional) (Phase B de #218)

Compliance e detecções emocionais hoje são determinísticas; mentor entende contexto, sistema não. Solução: mentor toggle = lei dentro de v1, sem audit metadata. Pipeline de recompute automático paralelo a mudança de plano.

**Schema (INV-15 aprovada):**
- 1 campo novo em `trades/{id}`: `mentorClearedViolations: string[]`. Aluno read-only via `firestore.rules`.
- Chave compliance: o code (`NO_STOP`, `RR_BELOW_MINIMUM`, `RISK_EXCEEDED`, `DAILY_LOSS_EXCEEDED`, `BLOCKED_EMOTION`).
- Chave emocional: `${eventType}:${tradeId}` — DEC-AUTO-221-01 (revisão do plano original que usava timestamp; tradeId é mais estável e mantém isolamento por trade).

**Helper puro `violationFilter`:**
- `effectiveRedFlags(trade)` — filtra `trade.redFlags` pelo type cleared.
- `hasEffectiveRedFlags(trade)` — boolean para `complianceRate`. Trade com `hasRedFlags: true` legacy sem array fica intacto (sem types não dá pra limpar parcialmente).
- `effectiveEmotionalEventsForTrade(trade, events)` — UI per-row.
- `effectiveEmotionalEventsForPeriod(trades, events)` — agregação. Mantém evento se ALGUM trade vinculado ainda não limpou.

**Mirror CJS** em `functions/maturity/violationFilter.js` — paridade obrigatória ESM↔CJS.

**Gateway:** `toggleViolationClearedAsMentor(tradeId, key, ctx)` com `arrayUnion`/`arrayRemove`. Validação mentor + key string + trade existe.

**Wire `effective*`** em 6 consumidores: `dashboardMetrics.calculateComplianceRate`, `useDashboardMetrics.complianceRate`, `computeCycleBasedComplianceRate` ESM + CJS (gate compliance-100), `emotionalAnalysisV2.calculatePeriodScore` + `calculateStudentStatus`, `emotionalAnalysisMirror.calculatePeriodScore`, `useEmotionalProfile`.

**UI mentor (FeedbackPage):** bloco "Violações" mostra effective com botão `✕ Limpar` mentor-only; bloco separado "Limpas pelo mentor" com strike-through + `↺ Restaurar`. Aluno vê ambos em read-only.

**`firestore.rules`:** allowlist mentor-only para `mentorClearedViolations`.

**CF `onTradeUpdated`:** detecta mudança no array via fingerprint sorted; invoca `recomputeForStudent(db, studentId, {admin})` igual a plan-change. Erros logados, não bloqueiam outros side-effects (PropFirm, etc).

**Decisões:**
- DEC-AUTO-221-01: chave compliance = code; chave emocional = `${type}:${tradeId}`
- DEC-AUTO-221-02: sem audit metadata (sem reason/clearedAt/clearedBy)
- DEC-AUTO-221-03: detectores não re-rodam — só agregação filtra

**Testes:** 41 novos (25 helper + 4 mirror paridade + 12 gateway). Suite full **2838/2838** (baseline 2797).


## [1.51.0] - 01/05/2026 · #220 · PR #223

**feat:** pendency guard no StudentDashboard — modal de pendências bloqueante (Phase C de #218)

Aluno deixa de fechar trades já revisados pelo mentor (sinal de não estar lendo) e takeaways das revisões ficam abertos. Sem email (custo). Resolução: modal popup ao abrir StudentDashboard listando 2 categorias de pendência derivadas de estado existente — zero campo Firestore novo.

**Categorias:**
- Trades pendentes: `t.status === 'REVIEWED'` (já existe — badge sidebar v1.19.7).
- Takeaways pendentes: por revisão CLOSED/ARCHIVED, `item.done=false` E `item.id` NÃO em `alunoDoneIds`.

**Persistência por fingerprint (não boolean):**
- `sessionStorage[pendency_dismissed_${uid}]` guarda o fingerprint do conjunto dispensado (`{trades: [ids], takeaways: [reviewId:itemId]}` JSON ordenado).
- Modal só fica fechado enquanto o conjunto for exatamente o mesmo. F5 mantém. Mentor adiciona novo trade REVIEWED → fingerprint diverge → modal volta automaticamente, mesmo na mesma sessão.
- `closeForNow()` (clique em item da lista) é state local; auto-reset quando set muda.

**Implementação:**
- `src/hooks/usePendencyGuard.js` (novo) — agrega via `useTrades` + `useWeeklyReviews`; helpers puros `computePendencies` + `computeFingerprint`.
- `src/components/PendencyGuard.jsx` (novo) — modal glass z-60, 2 seções (âmbar trades + emerald takeaways), top-5 + contador "+N", clique navega.
- `src/App.jsx` — mount alongside `<StudentDashboard>` no case dashboard default. Skip por composição: não monta em `viewingAsStudent`; AssessmentGuard já redireciona onboarding ativo antes.

**Reorganização de #219 (qualidade técnica):**
- Card faixa horizontal `MentorClassificationCard` removido (dead code).
- `% Sorte (mentor)` agora é linha inline no card FINANCEIRO, slot Profit factor, junto com Conformidade — par de sinais qualitativos no mesmo lugar visual. Mais compacto. Semáforo: 0% verde · <30% amber · ≥30% red. `MetricsCards` ganha prop `mentorClassificationStats`.

**Testes:** 31 novos (19 hook + 12 componente). Suite full **2797/2797** (baseline 2785 + 31 − reorg = +12 net).


## [1.50.0] - 01/05/2026 · #219 · PR #222

**feat:** mentor classifica trade — técnico ou sorte (Phase A de #218)

- _(decisões/testes/files — ajustar antes do commit)_


## [1.49.1] - 30/04/2026 · #210 · PR #211

**chore:** remover campo takeaways (string) — tratar apenas takeawayItems[]

- _(decisões/testes/files — ajustar antes do commit)_


## [1.49.0] - 30/04/2026 · #208 · PR #209

**feat:** sensor comportamental de execução (5 detectores + gates 3→4)

- _(decisões/testes/files — ajustar antes do commit)_


## [1.48.0] - 27/04/2026 · #187 · PR _pendente_

**feat:** coleta de MEP/MEN (Maximum Excursion Positiva/Negativa) — fundação para gate Stage 3→4 do motor de maturidade (#119)

- **Schema (DEC-AUTO-187-01):** novos campos `mepPrice` / `menPrice` (preço puro) + `excursionSource` (`'manual' | 'profitpro' | 'yahoo' | 'unavailable'`) em `trades/{id}`. Helper puro `validateExcursionPrices({side, entry, exit, mepPrice, menPrice})` valida coerência por lado: LONG → `mepPrice >= max(entry,exit)` e `menPrice <= min(entry,exit)`; SHORT inverte. `tradeGateway.createTrade` e `enrichTrade` aceitam, validam e persistem (este último é aditivo: só toca os 3 campos quando o payload trouxe ≥1).
- **Engine maturidade (DEC-AUTO-187-03 + DEC-AUTO-187-04):** `preComputeShapes.js` substitui o stub `advancedMetricsPresent = false` (literal — bloqueava promoção 3→4 de QUALQUER aluno por falta de dado) por `deriveAdvancedMetricsPresent(trades)`, que retorna `null` ou `true`, **NUNCA `false`**. Threshold: ≥10 trades + ≥80% com `mepPrice` E `menPrice` não-null → `true`; senão `null`. `evaluateGates` já tratava `null` como `METRIC_UNAVAILABLE` — gate fica pendente (não promove + não rebaixa, DEC-020 preservada). Resultado: aluno sem dado fica parado em Metódico até começar a registrar; não rebaixa.
- **Form manual (Fase 2 + 7):** AddTradeModal ganha bloco colapsável "Métricas avançadas (opcional)" com ⓘ tooltip "Usado pelo motor de maturidade Stage 3→4" (mockup M1). Inputs MEP/MEN agora em pts (futures) ou % (equity) — suffix dinâmico baseado em `detectInstrumentType(ticker)`, não mais "preço". Submit converte pts/% → preço via `convertExcursionRawToPrice` antes de gravar. Validação inline reaproveita `validateExcursionPrices` pós-conversão. Carrega valores existentes ao editar trade convertendo preço de volta para pts/% via `derivePtsFromPrice`.
- **Parser ProfitPro (Fase 3):** novo módulo `src/utils/excursionParsing.js` com `detectInstrumentType(ticker)` (futures B3 + CME por prefixo, equity como default) e `convertExcursionRawToPrice({entry, side, mepRaw, menRaw, instrumentType})` — futures somam pontos direto, equity multiplica proporcional `(1 ± |raw|/100)`, robusto a sinais arbitrários no input. `csvMapper.SYSTEM_FIELDS` ganha `mepRaw`/`menRaw` mapeáveis; `buildTradeFromRow` pós-processa após resolver entry/side, remove os campos raw do output e seta `excursionSource: 'profitpro'` (overridable via `defaults`).
- **Loader Yahoo (Fase 4 — DEC-AUTO-187-02):** novo namespace `functions/marketData/`:
  - `symbolMapper.mapToYahoo(ticker)` — 12 contratos CME (micros antes dos cheios pra prevenir match ambíguo MNQ/NQ, MES/ES, MGC/GC). BR futures retorna `null` por design (sem fonte 1m gratuita de B3; ProfitPro entrega nativamente).
  - `fetchYahooBars` — endpoint público `query1.finance.yahoo.com/v8/finance/chart`, free tier, janela 7d hard-coded, retry só em 5xx, AbortController timeout 8s. Retorna `{ok, bars}` ou `{ok:false, reason}` em vez de throw.
  - `computeExcursionFromBars({bars, side})` — função pura: LONG → `mep=max(highs)/men=min(lows)`; SHORT inverte. Ignora bars com h/l null (Yahoo às vezes retorna gaps). Guard explícito contra `Number(null)=0`.
  - `enrichTradeWithExcursions` — CF callable v2 + helper puro `runEnrichment` reusável por triggers. Compute&discard: lê trade → mapeia symbol → fetch bars → calcula → grava `mepPrice/menPrice/source` → bars vão pro garbage collector. Idempotente. Authz: dono do trade ou mentor.
- **Async trigger (Fase 5):** `onTradeCreatedAutoEnrich` Firestore trigger desacoplado do `onTradeCreated` principal. Skip rápido (sem fetch) quando: já tem MEP+MEN, source manual/profitpro, ticker não mapeia, trade > 7d ou sem timestamps. Falha silenciosa via catch global — import de trade NUNCA falha por enrichment opcional.
- **Display universal (Fase 2.5 + 7 — DEC-AUTO-187-05):** novo componente `ExcursionDisplay` com variants `compact` (inline pts/% para tabelas) e `full` (grid 3-col MEP/MEN/Fonte para modais e páginas). Helper `derivePtsFromPrice({mepPrice, menPrice, entry, side, instrumentType})` — inverso de `convertExcursionRawToPrice`, retorna deltas com sinal padronizado (MEP `+`, MEN `-`) independente do side. Aplicado em: TradeDetailModal (full, refator do bloco custom), TradesList (compact na cell de ticker), ExtractTable (compact), FeedbackPage (full após preços), ReviewTradesSection (compact, snapshot ganha campos `entry/mepPrice/menPrice/excursionSource`), MentorDashboard (compact em cards de pendentes), StudentFeedbackPage (compact em master-detail).
- **Não-objetivos declarados:** Sharpe ratio (issue separado a abrir, com 4 decisões de negócio em aberto: rfr, janela, threshold, N mínimo); Tradovate Trade Performance Report (formato não exporta MFE/MAE); cache persistente de bars Yahoo; backfill > 7d; BR futures via Yahoo.
- **DebugBadge no AddTradeModal:** ausente pré-existente (INV-04 violation independente, fora de escopo).
- **Tests:** 2533 → 2666 (+133). Distribuição: Fase 1 (+30), Fase 3 (+27), Fase 4 (+40), Fase 5 (+10), Fase 2.5 inicial (+7), Fase 7 (+19: derivePtsFromPrice +10, ExcursionDisplay +9). Zero regressão (161 test files).
- **Decisões:** DEC-AUTO-187-01..05 em `docs/decisions.md`.


## [1.47.0] - 26/04/2026 · #201 · PR #202

**refactor:** `calculatePlanMechanics` — motor universal de plano (mesa + retail), stop estrutural por estilo + sizing dinâmico

- Substitui o back-calc linear de `attackPlanCalculator` (sizing fixo=1, stop = roUSD/pointValue) — causa do bug 187pts × 1 contrato MNQ Apex 50K — por motor de 4 camadas: Constraints → Tactical Stop (ATR × `STYLE_ATR_FRACTIONS[style]` × `profileVariance`) → Sizing dinâmico (`floor(roBudget / (stopBase × pointValue))`) → Viability (gates hard + soft).
- Hard conditions: `instrument` e `style` mandatórios. Estilo (scalp 0.05 / day 0.10 / swing 0.20 / conviction 0.30 ATR) é eixo independente do profile; profile modula stopBase em ±10% (`PROFILE_STOP_VARIANCE`).
- UIs (`AddAccountModal`, `AccountsPage`, `PropFirmPage`) ganharam seletores de instrumento + estilo. PlanoMecanicoCard, propPlanDefaults e propViabilityBadge consomem o motor via `toLegacyAttackPlanShape` (zero-regressão para call sites legados).
- `riskPctPerOp` agora consome `roPerTrade` direto (DEC-AUTO-201-XX supersedes DEC-072 — Path B virou escolha explícita de profile AGRES_A/B).
- `roPerTrade` no shape legacy mapeia para `roEffective` (realizado com sizing discreto), não `roBudget` (alocado pelo profile). Card e wizard agora alinhados em $329.40 (= 13.2% DD), não $375 (= 15% DD orçado).
- Tooltips MC nos perfis: `ATTACK_PROFILES[*].mcStats` (PASS/BUST/dias para WR 45/50/55) baseado em comportamento real (stop-on-win + recovery, 100k iter Apex Intraday 50K). Scripts reproduzíveis em `scripts/issue-201-monte-carlo/`.
- DT-042 resolvida: `effectiveMinStop = max(MIN_VIABLE_STOP[type], instrument.minStopPoints || 0)`. RTY scalp clipa em 15 (type) > 3 (instrument); MNQ scalp usa 20 (instrument) > 15 (type).
- `attackPlanCalculator` marcado `@deprecated` (mantido para zero-regressão de 6 call sites; 52/52 testes legados verdes).
- Decisões: DEC-AUTO-201-01..05 em `docs/decisions.md`.
- Tests: 2533/2533 pass (44 novos em `calculatePlanMechanics.test.js`, 14 atualizados em `propPlanDefaults.test.js`).


## [1.46.1] - 25/04/2026

**Issue:** #197 (fix: salvar/atualizar link de reunião e gravação na revisão semanal pós-publicação)
**PR:** #198

#### Corrigido

- **Atualização de `meetingLink`/`videoLink` pós-publicação.** Mentor publicava a revisão semanal (CLOSED) e ficava preso — único caminho de gravação dos 2 links era em DRAFT, mas o link da gravação (Loom/Drive/YouTube) só existe DEPOIS da reunião terminar. Caminho real impossível. Os campos passam a ser tratados como metadata operacional (não conteúdo congelável), editáveis por mentor em DRAFT e CLOSED, bloqueados em ARCHIVED. Não fazem parte do `frozenSnapshot` (DEC-AUTO-197-01).

- **Acesso a revisões CLOSED na Fila de Revisão.** `ReviewQueuePage` filtrava apenas alunos com pelo menos 1 DRAFT (`StudentDraftProbe` com `where('status', '==', 'DRAFT')`). Mentor que publicou todas as revisões ficava sem caminho para reabrir CLOSED — bloqueando o fix do meetingLink na prática. Toggle "Incluir publicadas" (default OFF, preserva intent original da fila como working items) com probe paralelo de CLOSED ativado on-demand.

#### Adicionado

- **`useWeeklyReviews.updateMeetingLinks(reviewId, { meetingLink, videoLink })`** — `updateDoc` parcial em `students/{uid}/reviews/{rid}` com `{ meetingLink, videoLink, updatedAt: serverTimestamp() }`. Não muda `status`. Valida URLs via `validateReviewUrl` (regex https + allowlist `zoom.us`, `meet.google.com`, `teams.microsoft.com`, `loom.com`, `youtube.com`, `drive.google.com`, `vimeo.com`). Aceita parcial: `undefined` preserva valor existente.
- **`MeetingLinksSection`** (inline em `WeeklyReviewPage.jsx`) — Subitem 3 "Reunião" entre Notas (2) e Snapshot (4). 2 inputs `<input type="url">` + botão "Salvar links" + validação inline + estado read-only em ARCHIVED com banner. Renumeração visível 3-9.
- **Botão dedicado "Salvar links"** em `ReviewToolsPanel` (Section "Reunião" no Extrato) e `WeeklyReviewModal` (tab "Reunião"). Funciona em DRAFT e CLOSED, separado do "Salvar rascunho" (que segue exclusivo de DRAFT cobrindo takeaways/sessionNotes).
- **`StudentStatusProbe`** (refatoração de `StudentDraftProbe`) — probe genérico parametrizável por status. `ReviewQueuePage` instancia 1 por aluno × DRAFT, e adicional para CLOSED on-demand via toggle.
- **Toggle "Incluir publicadas"** no header da Fila de Revisão (default OFF). Quando ON, soma alunos com CLOSED > 0 ao filtro `studentsToShow`. Copy do header e empty state condicionais.

#### Inalterado

- `firestore.rules`: linhas 65-71 já permitiam mentor `CLOSED→CLOSED` com qualquer campo. Sem alteração.
- Schema Firestore: `meetingLink`/`videoLink` aprovados em #102 (v1.33.0). INV-15 não acionada.
- `ReviewToolsPanel.handleSaveDraft` permanece exclusivo de DRAFT — cobre takeaways/sessionNotes que continuam imutáveis pós-publicação.

#### Decisões

- **DEC-AUTO-197-01** — `meetingLink`/`videoLink` em `students/{uid}/reviews/{rid}` são metadata operacional, não conteúdo congelável. Editáveis por mentor em DRAFT e CLOSED via `updateMeetingLinks` (update parcial sem mudar status). ARCHIVED bloqueia. Não entram no `frozenSnapshot` ao publicar — preserva imutabilidade da análise (takeaways/SWOT/snapshot/maturity) sem travar metadata operacional.

#### Testes

- **7 testes novos** em `src/__tests__/hooks/useWeeklyReviews.test.js > updateMeetingLinks`:
  - DRAFT/CLOSED feliz com ambos os campos
  - Strings vazias para limpar links
  - URL inválida (não-https) rejeita sem chamar `updateDoc`
  - Host fora da allowlist rejeita sem `updateDoc`
  - Ambos `undefined` = no-op defensivo (zero chamadas)
  - Parcial: só `meetingLink` quando `videoLink` é `undefined`
  - Erro do `updateDoc` propaga + `error` exposto no hook
- Suite full: **2489/2489 verde** (149 arquivos). Sem regressão.

#### Smoke

- Validado em `localhost:5173` (Marcio, 25/04/2026): mentor publica → marca toggle "Incluir publicadas" → expande aluno → click em revisão CLOSED → Subitem 3 "Reunião" → cola link → "Salvar links" → recarrega → link persiste.

#### Files Touched

- `src/hooks/useWeeklyReviews.js` — novo método `updateMeetingLinks`, `validateReviewUrl` importado
- `src/pages/WeeklyReviewPage.jsx` — `MeetingLinksSection` inline + state + handler + render como Subitem 3 + renumeração 3→9
- `src/components/reviews/ReviewToolsPanel.jsx` — `handleSaveLinks` + `linksDirty` + botão dedicado
- `src/components/reviews/WeeklyReviewModal.jsx` — idem na tab "Reunião"
- `src/pages/ReviewQueuePage.jsx` — `StudentStatusProbe` + `closedCounts` + toggle "Incluir publicadas"
- `src/__tests__/hooks/useWeeklyReviews.test.js` — 7 testes do `updateMeetingLinks`
- `docs/decisions.md` — DEC-AUTO-197-01
- `docs/firestore-schema.md` — nota sobre `meetingLink`/`videoLink` como metadata operacional
- `docs/dev/issues/issue-197-...md` → `docs/dev/archive/2026-Q2/`
- `docs/registry/{versions,chunks}.md` — consumida + liberado
- `src/version.js` — bump 1.46.0 → 1.46.1
- `docs/PROJECT.md` — bump v0.40.4 → v0.40.5

---

## [1.46.0] - 25/04/2026

**Issue:** #189 (feat: score emocional real no motor de maturidade — furo universal de progressão)
**PR:** #196

#### Corrigido

- **Score emocional real no motor de maturidade.** Substitui stub explícito `{ periodScore: 50, tiltCount: 0, revengeCount: 0 }` em `functions/maturity/preComputeShapes.js:129` (DEC-AUTO-119-task07-02 declarava como TODO) por mirror CommonJS de `emotionalAnalysisV2.calculatePeriodScore` + `detectTiltV2` + `detectRevengeV2`. Antes, a dimensão emocional travava em E=50 fixo independente de comportamento — bloqueando promoção em todos os stages. Agora os 5 gates emocionais do framework (`emotional-out-of-fragile`, `emotional-55`, `emotional-75`, `emotional-85`, `zero-tilt-revenge`) discriminam por dados reais.

#### Adicionado

- **`functions/maturity/emotionalAnalysisMirror.js`** (CommonJS) — mirror determinístico do source ESM em `src/utils/emotionalAnalysisV2.js`. Inclui `calculatePeriodScore`, `detectTiltV2`, `detectRevengeV2`, `calculateTradeEmotionalScore`, `buildGetEmotionConfig` (replica `useMasterData.getEmotionConfig`), `computeEmotionalAnalysisShape` (entry point para `preComputeShapes`), constants `DEFAULT_DETECTION_CONFIG` + `EVENT_PENALTIES` + `SCORE_WEIGHTS` + `UNKNOWN_EMOTION_CONFIG`. Paridade testada via 8 cenários ESM↔CJS.
- **Carga de `emotions` em `recomputeForStudent`** — `functions/maturity/recomputeMaturity.js` lê collection `emotions` antes de invocar `preComputeShapes`. Falha no fetch é graceful (warn + fallback neutro `{50,0,0}` — preserva D6 "evolução sempre visível", INV-03 isolamento mantido).
- **`preComputeShapes` aceita `emotions` ou `getEmotionConfig`** opcional. Sem inputs, mantém fallback histórico `{50,0,0}` — backward compat com testes legados e callers ainda não atualizados.

#### Inalterado (decisões 23/04/2026 preservadas)

- Fórmula DEC-AUTO-119-03: `E = 0.60·periodScore + 0.25·invTilt(0,0.30) + 0.15·invRevenge(0,0.20)`.
- Janela rolling STAGE_WINDOWS (issue-119 §3.1 D1): Stage 1=20/30, 2=30/45, 3=50/60, 4=80/90, 5=100/90 (floor 5).
- Política D6 "evolução sempre visível": engine NUNCA retorna null para emocional.
- DEC-020 (regressão nunca automática) intocada.

#### Testes

- **17 testes novos** em `src/__tests__/functions/maturity/emotionalAnalysisMirror.test.js` (paridade ESM↔CJS + cobertura `buildGetEmotionConfig` + `computeEmotionalAnalysisShape`).
- **Suite full 2438/2438** (baseline 2421 + 17 novos), zero regressão.

#### Follow-ups (não bloqueadores, fora do escopo "remover stub")

- `calculatePeriodScore([], ...)` retorna 100 (paridade com source ESM) enquanto D6 espera 50 quando trades vazios. Apenas `computeEmotionalAnalysisShape` aplica D6 via early return — consumidor futuro que invoque `calculatePeriodScore` direto pega 100. Mitigação: comentário no header do mirror.
- Aluno legado sem `emotionEntry` em todos os trades pega E≈60 (consistency bonus em UNKNOWN/UNKNOWN, ambos NEUTRAL). Comportamento herdado do source ESM, não regressão — vale issue própria de revisão semântica.
- CF carrega collection `emotions` por trigger (`db.collection('emotions').get()`). ~15-30 docs, latência baixa, mas escala linear com volume de triggers. Cache em memória runtime seria otimização futura.

---

## [1.45.0] - 25/04/2026

**Issue:** #188 (fix: Melhoria na Experiência de Feedback + Revisão — Sev1)
**PR:** —

Entrega consolidada de 4 frentes em 8 fases A-H (pair programming fast-track, tudo num PR):

#### Adicionado

- **F2 — Currency multi-moeda no MentorDashboard.** `aggregateTradesByCurrency(trades)` em `src/utils/currency.js` retorna `Map<currency, {totalPL, count}>` sem somar cross-currency. Novo componente `src/components/MultiCurrencyAmount.jsx` (stack vertical em multi-currency com cor por linha; cor semântica em single-currency). Aplicado em P&L Total Turma, P&L Total aluno detalhado, lista de alunos, ranking. Pending list + bulk modal usam `formatCurrencyDynamic(trade.result, trade.currency)` direto. FX conversion fora de escopo (DEC-AUTO-188-05).
- **F3 — PlanSummaryCard no FeedbackPage.** `src/components/PlanSummaryCard.jsx` colapsado por default (chat continua sendo o foco). Header: nome do plano + moeda + badge "arquivado" se inativo. Linha 1: 🎯 RO/RR/Cap. Linha 2 (condicional): 🚫 Bloqueadas. Linha 3: 📅 Ciclo X/N. Expand mostra Período (Diário) Meta/Stop, Ciclo Meta/Stop, PL atual %ciclo. Inserido em ambos modos (embedded + standalone) entre `TradeInfoCard` e `ShadowBehaviorPanel`. `usePlans/useAccounts` com `overrideStudentId=trade.studentId` para mentor enxergar planos do aluno dono. Fallback "Plano deletado · ID NNN" quando `planId` sem match.
- **F4 — TODOS os cards do StudentDashboard respeitam ContextBar sem exceção (DEC-AUTO-188-06).** `useDashboardMetrics` aceita parâmetro `context` (`{accountId, planId, cycleKey, periodRange}`). Filtragem central inclui janela temporal (end inclusivo até 23:59:59); todas as métricas derivadas (stats, MaxDD, payoff, EV, consistency, compliance, durations) herdam o filtro. `plContext.label` derivado de `periodRange.kind` (CYCLE/MONTH/WEEK). `filters.period` legado removido (SoT única). Dropdown "Período" do `Filters.jsx` removido (ContextBar é a única fonte). `PendingTakeaways` aceita prop `planId` e filtra última review CLOSED pelo plano selecionado. Teste invariante novo `src/__tests__/hooks/useDashboardMetrics.contextBar.test.js` com 7 cenários.
- **F1 — Mentor edit + lock comportamental (Sev1 core, INV-15 aprovada).** 5 campos novos em `trades`:
  - `_lockedByMentor: boolean` — flag binária do lock.
  - `_lockedAt: Timestamp` — quando o lock foi aplicado.
  - `_lockedBy: { uid, email, name }` — autor do lock.
  - `_mentorEdits: array` (append-only auditável) — cada entry `{ field, oldValue, newValue, editedAt, editedBy:{uid,email} }`.
  - `_studentOriginal: { emotionEntry, emotionExit, setup, capturedAt }` — gravado APENAS na 1ª edição do mentor; preserva o que o aluno declarou originalmente (imutável após).
  - Metadata complementar: `_unlockedAt`, `_unlockedBy.{uid,email,reason}`.
- **Gateway (INV-02).** `src/utils/tradeGateway.js`: `MENTOR_EDITABLE_FIELDS = ['emotionEntry','emotionExit','setup']`. Funções novas:
  - `editTradeAsMentor(tradeId, edits, ctx, deps)` — whitelist; rejeita não-mentor; rejeita trade já locked; grava `_studentOriginal` na 1ª edit; `arrayUnion` em `_mentorEdits` apenas para campos que mudaram; aceita `null` (mentor remove emoção); noop quando edits não mudam nada.
  - `lockTradeByMentor(tradeId, ctx, deps)` — grava `_lockedByMentor=true`, `_lockedAt`, `_lockedBy`. Rejeita não-mentor.
  - `unlockTradeByMentor(tradeId, ctx, deps)` — preserva auditoria; captura motivo via `unlockReason`.
- **Firestore rules.** Trades update agora tem 3 gates combinados:
  1. Ownership: mentor OU owner OU owner-by-email.
  2. Lock check: quando `_lockedByMentor==true`, `affectedKeys` NÃO pode tocar `emotionEntry`/`emotionExit`/`setup`.
  3. Metadata guard: só mentor pode tocar `_lockedByMentor`/`_lockedAt`/`_lockedBy`/`_mentorEdits`/`_studentOriginal`/`_unlockedAt`/`_unlockedBy`. CFs bypassam via admin SDK.
- **Cloud Function `onTradeUpdated`.** `complianceFields` agora inclui `emotionEntry` (corrige bug pré-existente: flag `BLOCKED_EMOTION` ficava estale quando aluno/mentor mudava emoção). Bloco de reconstrução de `redFlags` filtra `BLOCKED_EMOTION` antes de regerar conforme emoção corrente vs `plan.blockedEmotions`. Adicionalmente, novo bloco detecta `importBatchId` mudou + `after._lockedByMentor==true` e destrava server-side preservando `_mentorEdits`/`_studentOriginal` (DEC-AUTO-188-03 — broker é fonte de verdade superior ao mentor).
- **UI mentor edit + lock.** `src/components/feedback/MentorEditPanel.jsx` colapsável (escondido pós-lock) com 3 selects (`useMasterData.emotions` + `useSetups` filtrados por aluno via `filterSetupsForStudent`), botão "Reverter ao original" (visível só com `_studentOriginal`), botão "Confirmar e travar (N)" abrindo modal de confirmação dupla. `src/components/TradeLockBadge.jsx` reutilizável (header do FeedbackPage, tooltip com autor + data DD/MM/AAAA, suporte Firestore Timestamp). Asterisco âmbar (`*`) nos campos corrigidos do `TradeInfoCard` com tooltip "Original: X · corrigido pelo mentor". Ícone `Lock` inline na `ExtractTable` ao lado do ticker. Bloco "Histórico de correções (N)" no rodapé do `TradeDetailModal` listando cada `_mentorEdits` (data · email · campo: old → new) + linha "🔒 Travado por <email>".
- **Hooks.** `useTrades` expõe `editTradeAsMentor`/`lockTradeAsMentor`/`unlockTradeAsMentor` (import dinâmico do gateway).

#### Decisões registradas

- **DEC-AUTO-188-01** — Schema do lock: 5 campos inline no doc trade + array append-only `_mentorEdits` (não map). `_studentOriginal` imutável após 1ª edit (auditoria do que o aluno declarou).
- **DEC-AUTO-188-02** — Escopo do lock limitado a 3 campos comportamentais (`emotionEntry`, `emotionExit`, `setup`); campos factuais (entry/exit/qty/result) seguem fluxo normal.
- **DEC-AUTO-188-03** — Import (CSV/Order) destrava lock server-side via CF preservando auditoria; broker é fonte de verdade superior ao mentor.
- **DEC-AUTO-188-04** — Admin destrava lock manualmente (sem UI dedicada v1; campo editável direto via Firestore console + `unlockTradeByMentor`).
- **DEC-AUTO-188-05** — Agregação multi-moeda no MentorDashboard via stack vertical; FX conversion fora de escopo.
- **DEC-AUTO-188-06** — ContextBar é SoT única de janela temporal no StudentDashboard; `filters.period` legado removido sem override vitalício.
- **DEC-AUTO-188-07** — `onTradeUpdated.complianceFields` passa a incluir `emotionEntry` (fix bug pré-existente entra junto com a Sev1).

#### Testes

- 2445/2445 (baseline 2401 + 44 novos):
  - 7 `aggregateTradesByCurrency`
  - 11 `PlanSummaryCard`
  - 7 `useDashboardMetrics.contextBar` (cenários: sem janela, com janela, borda end, combinado com granular, periodRange null, plContext label, MaxDD por ciclo)
  - 13 `tradeGatewayMentorLock` (whitelist, rejeições, noop, null, _studentOriginal preservado)
  - 6 `TradeLockBadge` (render condicional, tooltip, fallback email, Firestore Timestamp)
- Build limpo. Lint sem erros novos.

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

