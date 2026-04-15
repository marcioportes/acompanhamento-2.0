# Issue #133 — feat: AI Approach Plan com Sonnet 4.6 (Prop Firm #52 Fase 2.5)

- **Estado:** OPEN
- **Milestone:** v1.1.0 — Espelho Self-Service
- **Branch:** `feat/issue-133-ai-approach-plan`
- **Worktree:** `~/projects/issue-133`
- **Baseado em PROJECT.md:** v0.16.0 (14/04/2026)

---

## 1. Objetivo

Complementar o plano de ataque determinístico (Fase 1.5, já mergeado via #126/#134/#136) com **narrativa estratégica personalizada** gerada por Claude Sonnet 4.6. A IA **não recalcula** números — apenas narra, contextualiza e gera guidance comportamental em cima do plano mecânico já calculado.

---

## 2. Chunks

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-17 | escrita | Prop Firm Engine — CF nova + persistência em `account.propFirm` |

**Lock registrado:** PROJECT.md §6.3 — CHUNK-17 / #133 / 14/04/2026.

---

## 3. Estado do código (verificado)

### Plano determinístico já implementado
- `src/utils/attackPlanCalculator.js:175-284` — `calculateAttackPlan()` (RO%, stop/target pts, maxTradesPerDay, dailyGoal)
- `src/utils/propFirmDrawdownEngine.js` — engine DD (TRAILING_INTRADAY/EOD/STATIC/TRAILING_TO_STATIC)
- `src/utils/propPlanDefaults.js` — fórmulas pós-#136: `periodGoal = maxTrades × RO × RR`, `periodStop = maxTrades × RO`, `riskPerOperation = periodStop`
- Acionamento: `AddAccountModal.jsx:76-89` → `account.propFirm.suggestedPlan`

### CFs Claude modelo
- `functions/assessment/generateAssessmentReport.js` (modelo ideal — orquestração + parsing JSON robusto)
- Padrão: `const Anthropic = require('@anthropic-ai/sdk').default; const client = new Anthropic();`
- Secret: `onCall({ maxInstances: 5, secrets: ['ANTHROPIC_API_KEY'] }, ...)`
- Modelo: `claude-sonnet-4-20250514`

### Prompt v1.0
- Rascunho em `Temp/ai-approach-plan-prompt.md` (system + user + schema + validação)
- **6 correções pendentes** identificadas via #136 (listadas no body do issue — ver seção 8)

### UI
- Botão "Gerar Plano com IA" em `src/components/PropAccountCard.jsx` (card criado em #134 v1.27.0) ou `src/pages/AccountsPage.jsx:479`
- Plano determinístico exibido hoje em `AccountDetailPage.jsx:288-291`

### Testes existentes (referência de padrão)
- `src/__tests__/utils/propFirmDrawdownEngine.test.js` (58 testes)
- `src/__tests__/utils/attackPlanCalculator.test.js`
- `src/__tests__/utils/propFirmAlerts.test.js`, `propFirmPayout.test.js`

---

## 4. Análise de Impacto

### Collections tocadas
- `accounts` (leitura + escrita): novos campos em subobjeto `propFirm`
  - `propFirm.aiApproachPlan` (objeto JSON — narrativa + schema da IA)
  - `propFirm.aiGenerationCount` (número — rate limit)

⚠️ **INV-15 — Aprovação de persistência:** ambos os campos são novos. Preciso de aprovação explícita do Marcio antes de escrever esses campos. (Justificativa conceitual: expansão do mesmo documento `accounts` já existente — não é nova collection/subcollection. Alternativa rejeitada: subcollection separada `aiPlans/` introduziria fan-out desnecessário para dado 1:1 com a conta.)

### Cloud Functions
- Nova CF callable: `functions/propFirm/generatePropFirmApproachPlan.js`
- Export em `functions/index.js`
- Secret: `ANTHROPIC_API_KEY` (já configurado)
- `maxInstances: 5` (baixo volume: 1 chamada por criação de conta PROP, cap 5 por conta)

### Hooks/listeners afetados
- `useAccounts` (leitura — novo campo renderizado na UI; sem breaking change)
- Nenhum listener novo

### Side-effects em PL/compliance/emotional
- Nenhum. CF é puramente generativa — não toca `trades`, não dispara recálculo.

### Dados parciais/inválidos no caminho crítico
- Fallback: se API Claude down OU validação falha 3x → retorna plano determinístico com `aiUnavailable: true`. Não corrompe estado da conta.

### Invariantes respeitadas
- INV-02 (gateway trades): N/A — não escreve em trades
- INV-04 (DebugBadge): componente UI novo terá `component="PropAiApproachPlan"` (ou similar)
- INV-07 (autorização): este arquivo é a proposta
- INV-08 (CHANGELOG): entrada a criar
- INV-15 (persistência): **PENDENTE aprovação Marcio para os 2 campos novos**

### Blast radius
- Falha da CF: UI exibe fallback determinístico — usuário não fica sem plano
- Escrita corrompida: campo isolado, não afeta engine DD nem suggestedPlan
- Rollback: remover CF + campos — `suggestedPlan` continua funcionando

### Testes que podem quebrar
- Nenhum existente deve quebrar (novos campos opcionais)
- Novos testes: wrapper da CF, validação pós-processamento, coerência mecânica (cenário "dia ideal" == `dailyGoal`, "dia ruim" == `-dailyStop`)

---

## 5. Escopo da entrega

### 5.1 Backend
- [ ] `functions/propFirm/generatePropFirmApproachPlan.js` (CF callable)
  - Input: `{ accountId, studentId }` (CF lê template + suggestedPlan + perfil 4D do student)
  - Chama Sonnet 4.6 com prompt v1.0 (já corrigido — ver 5.3)
  - Validação pós-processamento:
    - RO ≤ daily loss limit
    - stop ≥ minViable
    - stop ≤ 75% NY range
    - **Coerência mecânica:** cenário "dia ideal" == `dailyGoal`; "dia ruim" == `-dailyStop`
  - Retry até 3x em validação; se falhar → fallback determinístico
  - Persiste `account.propFirm.aiApproachPlan` + incrementa `aiGenerationCount`
  - Rate limit: rejeita com erro explícito se `aiGenerationCount >= 5`
- [ ] Export em `functions/index.js`

### 5.2 Frontend
- [ ] Botão "Gerar Plano com IA" em `PropAccountCard.jsx` (ou novo modal dedicado)
- [ ] Componente `PropAiApproachPlanView.jsx` para renderizar narrativa estruturada (approach, execution, scenarios, behavioral, milestones)
- [ ] DebugBadge com `component="PropAiApproachPlanView"`
- [ ] Loading state + erro + fallback UI

### 5.3 Correções no prompt v1.0 (antes de chamar a IA)
1. Linha 83 `Meta diária: ${dailyTarget}` → bloco MECÂNICA DIÁRIA + bloco RITMO DE ACUMULAÇÃO
2. System prompt: adicionar seção SEMÂNTICA DO PLANO como regra inviolável
3. Response schema `executionPlan`: tornar `stopPoints/targetPoints/roUSD/maxTradesPerDay/contracts` read-only
4. Response schema `scenarios`: explicitar "dia ideal" == `dailyGoal`, "dia ruim" == `-dailyStop`, "dia médio" == 1W+1L
5. Validação pós-processamento: adicionar coerência mecânica
6. `riskPerOperation = periodStopPct` (teto por trade) — não `roPerTrade/pl`

### 5.4 Testes
- [ ] `functions/__tests__/propFirm/generatePropFirmApproachPlan.test.js` — wrapper CF (mock Anthropic)
- [ ] Validação pós-processamento (RO, stop, coerência mecânica)
- [ ] Fallback determinístico (API down, validação 3x falha)
- [ ] Rate limit

### 5.5 Deltas em shared files (documentar aqui antes de editar)
- `src/version.js` — bump (sugestão: v1.29.0 — feature nova)
- `functions/index.js` — export `generatePropFirmApproachPlan`
- `docs/PROJECT.md` — CHANGELOG [1.29.0], DEC nova se aplicável
- `firestore.rules` — validar se `accounts.propFirm.aiApproachPlan`/`aiGenerationCount` passam nas rules existentes (a rule é por documento, não por campo — provável OK, verificar)

---

## 6. Fases

| Fase | Entregável | Estimativa |
|------|-----------|------------|
| A | Correções no prompt v1.0 + schema final | 0.3 sessão |
| B | CF + validação + fallback + testes | 0.8 sessão |
| C | UI (botão + view) + DebugBadge | 0.5 sessão |
| D | Integração, smoke test browser, CHANGELOG, bump version | 0.3 sessão |

**Total:** ~2 sessões.

---

## 7. Gate Pré-Código — PENDÊNCIAS

Antes de começar a codificar, preciso de:

1. ✅ Issue + branch + arquivo de controle criados (INV-13)
2. ✅ Worktree isolado `~/projects/issue-133` (INV-16)
3. ✅ CHUNK-17 locked no registry (INV-09 §6.3)
4. ⏳ **Aprovação INV-15**: persistir `aiApproachPlan` + `aiGenerationCount` como campos em `accounts` (não subcollection)
5. ⏳ **Aprovação INV-07**: escopo geral desta proposta
6. ⏳ Confirmar limite `aiGenerationCount` = 5 (ou outro valor)
7. ⏳ Confirmar local do botão: `PropAccountCard` (card compacto) vs modal dedicado (mais espaço para narrativa)
8. ⏳ Confirmar nome da CF: `generatePropFirmApproachPlan` (do issue) — OK?

**Aguardando aprovação explícita do Marcio antes de escrever código.**

---

## 8. Referências

- Issue GitHub: https://github.com/marcioportes/acompanhamento-2.0/issues/133
- Epic pai: #52 (CLOSED)
- Dependência semântica: #136 (CLOSED, v1.26.1–1.26.4)
- Prompt v1.0: `Temp/ai-approach-plan-prompt.md`
- Modelo CF: `functions/assessment/generateAssessmentReport.js`
- PROJECT.md base: v0.16.0

---

## 9. Deltas em shared files pendentes (aplicar no MAIN ao fechar sessão — nunca editar dentro do worktree)

### 9.1 `functions/index.js` — adicionar export da CF
Inserir ao final do arquivo (após bloco `SHADOW BEHAVIOR`):

```js
// ============================================
// PROP FIRM — AI Approach Plan (CHUNK-17, issue #133)
// ============================================
exports.generatePropFirmApproachPlan = require("./propFirm/generatePropFirmApproachPlan");
```

### 9.2 `src/version.js` — bump
- De: versão atual (consultar ao fechar)
- Para: **v1.29.0** — feature nova (CF + UI AI Approach Plan)

### 9.3 `docs/PROJECT.md` — ao encerrar
- CHANGELOG seção 10: entrada `[1.29.0]` com descrição da feature
- Atualizar header (versão do PROJECT.md — INV-14)
- DEC nova se aplicável (decisão: cenário 'defaults' não consome cota; fallback por falha da IA também não consome)
- Liberar lock CHUNK-17 em §6.3

### 9.4 `firestore.rules` — verificação
Rules existentes de `accounts` são por documento, não por campo. Novos campos `propFirm.aiApproachPlan` e `propFirm.aiGenerationCount` são escritos pela CF com credenciais admin — passam. Verificar no momento da entrega se há rules específicas que bloqueiam o update.

### 9.5 `CHANGELOG.md` (se existir como arquivo separado)
Entrada `[1.29.0] — 14/04/2026` com a feature.

(Lock CHUNK-17 já aplicado no MAIN em 14/04/2026 via commit `c63aef42`.)

---

## 10. Log da sessão

- **14/04/2026** — Abertura. Tentativa inicial violou ordem §4.0 (worktree criado antes do lock em main). Corrigido:
  - Reversão do edit em PROJECT.md dentro do worktree
  - Commit `0b813703` em main: reforço do protocolo em CLAUDE.md (ordem inviolável main→worktree)
  - Commit `c63aef42` em main: registro do lock CHUNK-17 em PROJECT.md §6.3
  - Worktree agora oficialmente ativo com lock reservado no trunk

- **14/04/2026 — Gate Pré-Código aprovado pelo Marcio** (todos os 5 itens de §7 confirmados):
  - INV-15: `account.propFirm.aiApproachPlan` + `aiGenerationCount` aprovados (campos inline)
  - INV-07: escopo geral aprovado
  - Rate limit: `aiGenerationCount` = 5, reset manual pelo mentor
  - UI: seção colapsável dentro do `PropAccountCard` existente (não modal separado)
  - Nome da CF: `generatePropFirmApproachPlan`

- **14/04/2026 — Fase A concluída** — correções no prompt v1.0 aplicadas, schema final consolidado:
  - Criado `functions/propFirm/prompt.js` (v1.1) com SYSTEM_PROMPT, `buildUserPrompt()`, `buildTraderProfileBlock()`, `RESPONSE_SCHEMA`
  - **Correção 1** ✅ — substituído `Meta diária: ${dailyTarget}` por bloco **MECÂNICA DIÁRIA** (dailyStop, dailyGoal, day RR === per-trade RR) + bloco **RITMO DE ACUMULAÇÃO** (dailyTarget rotulado explicitamente "NÃO É META DO DIA")
  - **Correção 2** ✅ — adicionada seção "SEMÂNTICA DO PLANO — REGRAS INVIOLÁVEIS" no system prompt: mecânica diária, ritmo de acumulação, Path A vs Path B (guard anti Path C), números determinísticos read-only
  - **Correção 3** ✅ — `executionPlan.stopPoints/targetPoints/roUSD/maxTradesPerDay/contracts` marcados como READ-ONLY no schema; campos de narrativa (tradingStyle, entryStrategy, exitStrategy, pathRecommendation) livres
  - **Correção 4** ✅ — cenários explícitos: "Dia ideal" = +dailyGoal (EXATAMENTE), "Dia ruim" = -dailyStop (EXATAMENTE), "Dia médio" = narrativa parcial 1W+1L, "Sequência de losses" = protocolo de parada
  - **Correção 5** ✅ — coerência mecânica será enforced em `validate.js` (Fase B) — scenarios[0].result === dailyGoal, scenarios[2].result === -dailyStop
  - **Correção 6** ✅ — system prompt explicita `riskPerOperation = periodStop` (teto por trade), Path A (N×1) e Path B (1×N) ambos válidos, guard anti Path C (N×N)
  - Arquivo: `functions/propFirm/prompt.js` (288 linhas)
  - Próximo: Fase B — CF wrapper + validate.js + testes

- **14/04/2026 — Fase B concluída** — CF wrapper + validação + testes:
  - `functions/propFirm/validate.js` — 7 grupos de validação (shape, read-only, constraints da mesa, viabilidade técnica, coerência mecânica, nomes de cenários, metadata) + `buildFallbackPlan()`
  - `functions/propFirm/generatePropFirmApproachPlan.js` — CF callable onCall v2 com:
    - Auth check
    - Validação de input (`accountId`, `context.{firm,instrument,plan}`)
    - Cenário `defaults` → fallback imediato, sem IA, sem consumir cota
    - Rate limit: rejeita com `resource-exhausted` se `aiGenerationCount >= 5`
    - Retry loop (até 3 tentativas) — cada retry inclui os erros da anterior no prompt
    - Fallback determinístico (`buildFallbackPlan`) com `aiUnavailable: true` se 3 retries falharem
    - Persistência: `propFirm.aiApproachPlan` + `FieldValue.increment(1)` em `aiGenerationCount` SOMENTE se a IA respondeu válido
    - Decisão: falha da IA não consome cota (justo com o trader)
  - `src/__tests__/utils/propFirmAiValidate.test.js` — **24 testes, todos passando** (shape 3, read-only 6, constraints 2, viabilidade 3, coerência mecânica 4, nomes 2, metadata 2, fallback 2)
  - Erro de protocolo detectado e corrigido: editei `functions/index.js` direto no worktree; revertido e documentado como delta §9.1 (aplicar no main ao encerrar via PR)
  - Próximo: Fase C — UI (seção colapsável no `PropAccountCard`)

- **15/04/2026 — Fase C concluída** — UI + integração:
  - `src/hooks/useAiApproachPlan.js` — hook que monta contexto da CF a partir de account+template+profile opcional, detecta dataSource (`4d_full`|`indicators`|`defaults`), chama `httpsCallable('generatePropFirmApproachPlan')`, expõe `{generate, loading, error, plan, aiUnavailable, generationCount, remaining, limitReached, dataSource}`
  - `src/components/dashboard/PropAiApproachPlanSection.jsx` — seção colapsável com:
    - Header: ícone Sparkles, badge "IA"/"determinístico", contador `N/5`, chevron
    - Aviso amber quando `dataSource === 'defaults'` (incentiva completar 4D)
    - Botão "Gerar plano com IA" (ou "determinístico" em cenário defaults), spinner durante loading
    - Após gerar: summary narrativo + sub-seções colapsáveis (Approach, Execução, Cenários, Guidance, Milestones)
    - Cenários com ícones por tipo (CheckCircle/MinusCircle/XCircle/AlertCircle) e cor do resultado
    - Botão "Regenerar" / "Limite atingido" conforme cota
    - Erro handling (quota, rede)
  - `PropAccountCard.jsx` integrado — novas props `trader4DProfile`, `traderIndicators`; seção inserida após Alertas, antes do DebugBadge
  - **Regressão:** `npm run test` → 1391/1391 testes passando
  - **Build:** `npm run build` → OK (10.95s, sem erros TS/lint)
  - Nenhum shared file tocado no worktree
