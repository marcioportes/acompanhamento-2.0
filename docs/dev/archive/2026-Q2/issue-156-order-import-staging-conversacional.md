# Issue #156 — arch: Import Orders staging conversacional + fix bypass #93

**Branch:** `arch/issue-156-order-import-staging-conversacional`
**Worktree:** `~/projects/issue-156`
**Modo:** coordenador (C nesta sessão) + worker (`claude -p` via mailbox)
**Chunks:** CHUNK-10 (ESCRITA), CHUNK-04 (LEITURA)
**Versão reservada:** v1.37.0
**Conflito:** nenhum (#102 não toca OrderImport)

## Dor

#93 introduziu staging bypass: operações vão direto para `trades` sem confirmação do aluno. Viola INV-01. Rompe o mecanismo de confronto que é a tese do Espelho.

## Escopo cirúrgico (DT-038 cancelou 3 camadas)

Mantém schema atual de `trades` + `_enrichmentSnapshot` inline. Foco no fix + UX.

### 4 blocos de trabalho

**(1) Fix do bypass:**
- Remover todo caminho direto para `trades` em `OrderImport/*`
- Única saída válida: `ordersStagingArea` → decisão do aluno → `tradeGateway.createTrade` ou `enrichTrade`
- Invariante auditável: `grep -r "addDoc(collection(db, 'trades'))" src/` retorna apenas `tradeGateway.js`

**(2) UX conversacional:**
- `match_confident` → "Minha hipótese: essas ordens são o trade X de {data/hora}. Confere?" confirmar/ajustar/descartar
- `ambiguous` → lista candidatos com score, seleção explícita
- `new` → "Nova operação detectada. Criar trade?" + lista de candidatos do dia
- `autoliq` → badge vermelho "Evento de sistema — AutoLiq detectado"
- `discarded` → respeita sem justificativa

**(3) Lógica de reconstrução:**
- Segmentação por ticker no mesmo dia (fixture ABR-17 PAAPEX bust day)
- Agrupamento N×M de fills explodidos (fixture FEV-12 PAAPEX)
- Bloco descontínuo (gap) → expõe em staging, não classifica
- Período sem plano ativo → badge bloqueia + link para plano retroativo

**(4) Enrichment de trade existente:**
- Match_confident ou confirmação manual → `enrichTrade` (preserva `_enrichmentSnapshot`)
- Não cria duplicata
- Trigger nativo `onTradeUpdated` dispara shadow/IA (DT-037)

## Critério de aceite

- [ ] `grep addDoc(collection(db, 'trades'))` retorna apenas `tradeGateway.js`
- [ ] 4 classifications têm UI dedicada
- [ ] Badge AutoLiq visível
- [ ] ABR-17: MNQ + NQ segmentados
- [ ] FEV-12: N fills agrupados em 1 operação
- [ ] Período sem plano bloqueia confirmação
- [ ] Match confidente → enrichTrade (sem duplicata)
- [ ] `npm test` passa + testes novos ABR-17/FEV-12/AutoLiq
- [ ] DebugBadge nos componentes novos/tocados

## Shared files

- `src/version.js` — bump para 1.37.0 no final

## Log de execução

**Modelo:** coordenador (sessão Claude Code do Marcio) + worker headless (`claude -p` disparado por listener tmux `cc-156`). Comunicação via file-drop em `.cc-mailbox/{inbox,outbox,processed}/`.

### Tasks enviadas ao worker

| # | Task | Entregue? | Commit | Report |
|---|------|-----------|--------|--------|
| 01 | Discovery — mapear Import Orders atual + identificar bypass + propor plano 5 fases (A→E) | ✓ 2026-04-19 | — (sem código, só análise) | `.cc-mailbox/outbox/01-discovery-report.md` |
| 02 | Fase A — remover shadow writer bypass + invariante auditável `tradeWriteBoundary` | ✓ 2026-04-19 | `1e034534` | `.cc-mailbox/outbox/02-fase-a-report.md` |
| 03 | Fase B — schema de classificação persistente (5 classes) + `autoLiqDetector` | ✓ 2026-04-19 | `556a6265` | `.cc-mailbox/outbox/03-fase-b-report.md` |
| 04 | Fase C — UX conversacional por operação + gate plano retroativo | ✓ 2026-04-19 | `a3be324a` | `.cc-mailbox/outbox/04-fase-c-report.md` |
| 05 | Fase D — reconstrução robusta (segmentação ticker + N×M fills + gap) | ✓ 2026-04-20 | `4ffba17a` | `.cc-mailbox/outbox/05-fase-d-report.md` |
| 06 | Fase E — enrichment sem duplicata + modal ajuste fino + discarded persist | ✓ 2026-04-20 | `a613248f` | `.cc-mailbox/outbox/06-fase-e-report.md` |
| 07 | Fase F — wire StudentDashboard retroativo + bump v1.37.0 + consolidação | ✓ 2026-04-20 | `6cdcf3e1` | `.cc-mailbox/outbox/07-fase-f-report.md` |

### Decisões do coordenador

1. **Escopo cirúrgico** — estrutura 3 camadas do trade (INV-21 da SPEC) cancelada via **DT-038** (registrada no PROJECT.md main v0.22.5). Motivo: over-engineering para estágio atual; `_enrichmentSnapshot` atual resolve 95% dos casos. Princípio: *"não é falta de controle, é ritmo"*.

2. **Versão reservada:** v1.37.0 (próximo minor livre). Bump único no fechamento da issue, não por fase.

3. **Workflow git:** worker faz commit local no branch `arch/issue-156-...` a cada fase, **sem push**. Coordenador revisa diff antes de autorizar PR final (consolidado depois da Fase E).

4. **Fase A — shadow writer bypass:** plano original do worker (canalizar escrita via gateway) foi **rejeitado**. Motivo: escrita já tinha dono oficial — a CF callable `analyzeShadowBehavior` via hook `useShadowAnalysis`. Correção correta: remover escrita duplicada do frontend, delegar à CF. Worker implementou.

5. **Fase A — invariante `tradeWriteBoundary`:** worker descobriu 4 writers legados em `trades` (pré-#156: `useTrades.js` 5 writes, `useAccounts.js` cascade delete, `usePlans.js` cascade delete, `seedTestExtract.js` seed). Coordenador aprovou whitelist composta **APPROVED** (tradeGateway.js) + **GRANDFATHERED** (4 legados) → **DT-039** registrada (PROJECT.md v0.22.6). Refactor dos legados fica para ISSUE 1 do épico #128.

6. **Fase B — preservar `origin`/`text` no staging:** worker decidiu **fora do spec explícito** persistir esses campos em `ordersStagingArea` (além dos 6 novos campos do enum). Coordenador aprovou: sem isso, re-classificação pós-staging ficaria inviável.

7. **Mensageria inversa (pendente de implementação):** Claude Code não tem endpoint nativo para receber injeção externa. Solução identificada: worker chama `PushNotification` tool no fim de cada task para alertar Marcio (desktop + mobile via Remote Control). **Aplicar a partir da Task 05** (Fase D).

### Próximos passos (em ordem)

- **Task 05 (Fase D)** em execução — reconstrução robusta (ABR-17 + FEV-12 + gap). PushNotification incluída no prompt (primeira task usando).
- **Task 06 (Fase E):** enrichment sem duplicata — match_confident → enrichTrade preservando `_enrichmentSnapshot`
- **Task 07 (Fase F — consolidação):** wire `onRequestRetroactivePlan` em `StudentDashboard` + persistir `discarded` em `ordersStagingArea` + polimento final
- **Encerramento:** bump v1.37.0, abrir PR consolidado, merge, protocolo §4.3

### Pendências registradas (Fase F)

Do report da Fase C §8:
- Wiring do `onRequestRetroactivePlan` em `StudentDashboard` (~20 linhas) — banner só renderiza botão se prop definida
- Persistir `userDecision === 'discarded'` no doc de `orders` (campo já existe no schema Fase B)
- `AmbiguousOperationsPanel` deprecated via jsdoc; remoção física pode esperar (auditoria externa)
- `onAdjust` é stub — futuro modal de diff fino pode abrir porta na Fase E

## Encerramento

**Versão entregue:** v1.37.0 (build `20260420`).

**Resumo por fase:**

- **Fase A (`1e034534`)** — Removido o shadow writer bypass no frontend: `OrderImportPage` deixa de escrever em `trades` diretamente e delega a análise de sombra à CF canônica `analyzeShadowBehavior` via hook `useShadowAnalysis`. Criada invariante auditável `tradeWriteBoundary` (teste greps o codebase e aceita apenas `tradeGateway.js` como writer; 4 writers legados whitelistados como GRANDFATHERED → **DT-039**).
- **Fase B (`556a6265`)** — Schema de classificação persistente em `ordersStagingArea`: 5 classes (`match_confident` / `ambiguous` / `new` / `autoliq` / `discarded`) + `autoLiqDetector` (heurística determinística para eventos de liquidação forçada pela mesa). Preservados os campos `origin` e `text` do fill original (decisão do worker, aprovada pelo coordenador — sem isso, re-classificação pós-staging ficaria inviável).
- **Fase C (`a3be324a`)** — UX conversacional por operação: `ConversationalOpCard` substitui o auto-create do #93 (cada op exige decisão explícita — `confirm` / `adjust` / `discard`), `AutoLiqBadge` destaca liquidações como evento de sistema, gate duro de plano retroativo bloqueia submit quando há operações em períodos sem plano vigente. `AmbiguousOperationsPanel` marcado `@deprecated` via jsdoc.
- **Fase D (`4ffba17a`)** — Reconstrução robusta: segmentação por instrument no mesmo dia (caso ABR-17 PAAPEX bust day MNQ+NQ não mais colapsa em 1 op), agregação N×M de fills explodidos (caso FEV-12 PAAPEX), detecção de gap temporal 60 min impede junção de blocos descontínuos em uma única operação.
- **Fase E (`a613248f`)** — Enrichment sem duplicata: helper puro `conversationalIngest` centraliza roteamento (create/enrich/discard), `enrichTrade` preserva `_enrichmentSnapshot`, `AdjustmentModal` mostra diff campo-a-campo antes de promover adjustment em enrichment, `userDecision === 'discarded'` é persistido em `orders` via fingerprint (orderKey).
- **Fase F (`6cdcf3e1`)** — Wire final: `App.jsx` ganha estado `accountsInitial` + handler `handleRequestRetroactivePlan` → `StudentDashboard` recebe a prop e repassa ao `OrderImportPage` (fechando o modal no caminho) → `OrderImportPage` já tinha `handleRetroactivePlan` ligado a `ConversationalReview` como `onCreateRetroactivePlan`. `AccountsPage` ganha props `initialAccount` / `onInitialConsumed` para preselecionar a conta e carregar flag `_autoOpenPlanModal` (padrão #154, `AccountDetailPage` abre `PlanManagementModal` via `useEffect`). Version bump v1.36.0 → v1.37.0. Changelog inline do `version.js` consolidado com narrativa das 5 fases.

**Testes:** 1689 / 1689 passando (81 arquivos, zero regressão). Invariante `tradeWriteBoundary` verde. Grep `addDoc(collection(db, 'trades'))` retorna apenas `src/utils/tradeGateway.js:165` (e o fixture literal no próprio teste de invariante).

**Débitos registrados durante a issue:**

- **DT-038** — Estrutura 3 camadas do trade (INV-21 da SPEC) cancelada via decisão do coordenador. Motivo: over-engineering para estágio atual; `_enrichmentSnapshot` atual resolve 95% dos casos. Princípio *"não é falta de controle, é ritmo"*. Registrada em PROJECT.md v0.22.5 (main).
- **DT-039** — 4 writers legados em `trades` (`useTrades.js` 5 writes, `useAccounts.js` cascade delete, `usePlans.js` cascade delete, `seedTestExtract.js` seed) são GRANDFATHERED na invariante `tradeWriteBoundary`. Refactor para passar todos por `tradeGateway.js` fica para ISSUE 1 do épico #128. Registrada em PROJECT.md v0.22.6 (main).

**Próximo passo:** coordenador abre PR consolidado após aprovação explícita e executa protocolo §4.3 pós-merge (mover arquivo para `docs/archive/`, remover worktree, atualizar histórico do PROJECT.md).

**Delta de shared files aplicado nesta issue (consolidado para o main pós-merge):**

- `src/version.js` — bump v1.36.0 → v1.37.0, build `20260420`, changelog inline consolidado.
- `src/App.jsx` — adicionado estado `accountsInitial` + handler `handleRequestRetroactivePlan` + passagem das props `initialAccount` / `onInitialConsumed` a `AccountsPage` e `onRequestRetroactivePlan` às duas instâncias de `StudentDashboard` (aluno logado + mentor viewing as).
- `src/pages/AccountsPage.jsx` — novos props `initialAccount` / `onInitialConsumed` + `useEffect` aplicando preseleção + flag `_autoOpenPlanModal`.
- `src/pages/StudentDashboard.jsx` — nova prop `onRequestRetroactivePlan` em `StudentDashboardBody`, repassada ao `OrderImportPage` fechando o modal no ato.
