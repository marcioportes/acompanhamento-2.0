# Issue 136 — fix: Plano sugerido em contas PROP — incoerência semântica meta vs RO + inclusão Ylos Trading

> **Branch:** `fix/issue-136-prop-plan-semantics`
> **Worktree:** `~/projects/issue-136`
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Aberto em:** 11/04/2026
> **Status:** 🔵 Em andamento — Fase A (Gate Pré-Código)
> **Versão entregue:** —
> **Prioridade:** ALTA · Sev1 · aluno ativo na Ylos, plano atual induz decisão errada

---

## 1. CONTEXTO

PlanManagementModal/AddAccountModal mistura três conceitos distintos sem explicação quando a conta é PROP:

| Conceito | Quem define | Exemplo Apex EOD 25K MNQ CONS_B |
|----------|-------------|---------------------------------|
| **Meta diária** | target ÷ dias úteis | $72/dia |
| **Stop por trade (RO)** | attack plan | $150 |
| **Daily loss limit (mesa)** | regra da mesa (template) | $500 |
| **Stop do plano (período)** | deveria ser `maxTrades × RO` | $500 (ERRADO — usando daily loss da mesa) |

**Resultado atual:** aluno interpreta o resumo "Meta $75 / Stop $500 / RO $150 / RR 1:2" como "aceito perder $500 pra ganhar $75" — RR invertido. Fecha trades no target errado, dimensiona risco errado.

Paralelamente, o aluno assinou conta Ylos Trading — precisa de templates e novo tipo de drawdown `TRAILING_TO_STATIC` no engine.

## 2. ACCEPTANCE CRITERIA

### E1 — Stop do plano vs daily loss (Fase A)
- [ ] PlanManagementModal (passo 2) pre-calcula stop diário como `maxTrades × RO` para contas PROP
- [ ] Cenário Apex EOD 25K MNQ CONS_B: stop diário default = 1.2% ($300), não 2% ($500)
- [ ] Campo continua editável pelo aluno
- [ ] Daily loss da mesa aparece como info separada quando `template.dailyLossLimit != null`
- [ ] Contas Ylos (dailyLossLimit = null) não mostram linha "Daily loss mesa" no resumo

### E2 — Contexto na meta diária (Fase A)
- [ ] Tooltip no "Meta diária" do attack plan preview (AddAccountModal) explicando que é ritmo médio, não target por trade
- [ ] Texto menciona o target real por trade para contraste (ex: "target por trade: 150 pts / $300")
- [ ] Ícone `Info` de `lucide-react`, consistente com tooltips existentes

### E3 — Resumo do plano coerente (Fase A)
- [ ] Passo 3 mostra daily loss da mesa como info de contexto (texto menor/cor diferente) quando existe
- [ ] Stop do período é o valor derivado (E1), não o daily loss da mesa
- [ ] Contas sem daily loss (Ylos): resumo não tem linha "Daily loss mesa" — apenas stop derivado

### E5 — Drawdown TRAILING_TO_STATIC (Fase B)
- [ ] Engine suporta novo tipo com `staticTrigger` configurável
- [ ] Trail congela quando `newBalance >= accountSize + drawdownMax + staticTrigger`
- [ ] Flag `TRAIL_FROZEN` emitida uma única vez
- [ ] Campo novo `account.propFirm.trailFrozen: boolean` (default false) — **aprovado Marcio 11/04/2026 (INV-15 gate)**
- [ ] Engine espelhado em `functions/propFirmEngine.js` (DT-034)
- [ ] +8-10 testes novos cobrindo: sobe antes do trigger, congela no trigger, não move após freeze (sobe ou cai), bust detection com threshold congelado, flag emitida uma única vez, contas Apex não afetadas (regressão zero)

### E4 — Templates Ylos (Fase C)
- [ ] 6 templates Challenge Ylos (25K, 50K, 100K, 150K, 250K, 300K) criados via PropFirmConfigPage
- [ ] 1 template Freedom 50K criado (sem regras de consistência)
- [ ] Campo `fundedRules` com regras Funded (renomeado de `masterRules` — Ylos usa "Funded", não "Master")
- [ ] Instrumentos restritos e regra de corretagem verificados com aluno antes de persistir

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `propFirmTemplates` (escrita — novos templates Ylos, Fase C), `accounts` (campo `propFirm.trailFrozen`, Fase B) |
| Cloud Functions afetadas | `onTradeCreated/Updated/Deleted` — engine recalc já existente, novo case TRAILING_TO_STATIC no switch |
| Hooks afetados | `usePropFirmTemplates` (novos templates aparecem automaticamente) |
| Side-effects | Nenhum novo — engine já integrado nas CFs |
| Blast radius | BAIXO Fase A (UI only), MÉDIO Fase B (engine core + CF espelho), BAIXO Fase C (dados) |
| Rollback | A: revert UI. B: revert engine + CF espelho. C: deletar templates |

### Invariantes aplicáveis

| INV | Aplicação |
|-----|-----------|
| INV-02 | Não afeta — trades não são tocados |
| INV-04 | DebugBadge em todos componentes tocados (`AddAccountModal`, `PlanManagementModal`, `PropFirmConfigPage`) |
| INV-10 | Campo `trailFrozen` em `account.propFirm` — extensão de objeto existente (grep confirmou inexistência antes) |
| INV-15 | Campo `trailFrozen` APROVADO por Marcio em 11/04/2026 (resposta do coordenador) |
| INV-16 | Worktree `~/projects/issue-136` ✅ |

### Shared files (delta documentado — nunca editar direto sem proposta)

| Arquivo | Delta previsto | Fase |
|---------|---------------|------|
| `functions/propFirmEngine.js` | Espelhar novo case `TRAILING_TO_STATIC` (DT-034) | B |
| `src/utils/propFirmDrawdownEngine.js` | Novo case + leitura de `account.propFirm.trailFrozen` | B |
| `src/version.js` | Bump patch no gate pré-entrega | A+B+C |
| `docs/PROJECT.md` | DEC nova (semântica stop plano vs mesa), CHANGELOG, liberar locks | encerramento |

### Chunks — ver seção 6

## 4. SESSÕES

### Sessão 1 — 11/04/2026 (abertura)

**O que foi feito:**
- Issue #136 aberto com body preenchido (contexto + E1-E5 + AC)
- Dados Ylos confirmados pelo coordenador — body do issue atualizado com tabela E4 completa (6 Challenge + Freedom 50K), schema `fundedRules`
- PROJECT.md v0.12.1: INV-16 reforçada (worktree obrigatório sempre), padrão único `~/projects/issue-{NNN}`, passo explícito em §4.0 e CLAUDE.md
- Locks registrados em main: CHUNK-03 + CHUNK-17 para #136
- Worktree criado: `~/projects/issue-136` + branch `fix/issue-136-prop-plan-semantics`
- INV-15 gate atendido: campo `account.propFirm.trailFrozen: boolean` aprovado
- Fatiamento aprovado: A→B→C sequencial (não agrupar)

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| DEC-068 | Renomear `masterRules` → `fundedRules`/`fundedDrawdown` no schema do template | Nomenclatura Ylos usa "Funded", não "Master" — reduz ambiguidade |
| DEC-069 | Stop do período plano = `maxTrades × RO`, meta do período = `maxTrades × RO × RR` (mecânica) | Plano é mecânica de risco/retorno, NÃO média estatística de acumulação. `dailyTarget` (EV) é contexto, nunca meta |
| DEC-070 | Linha "Daily loss mesa" no resumo do PlanManagementModal é condicional | Contas Ylos Challenge não têm dailyLossLimit — ocultar evita confusão |
| DEC-071 | Engine `calculateDrawdownState` aceita `phase` e resolve `activeDrawdown` por fase | Ylos Challenge (EVAL) = TRAILING_EOD, Ylos Funded (SIM_FUNDED/LIVE) = TRAILING_TO_STATIC. Template único, engine phase-aware |
| DEC-072 | `riskPerOperation = periodStopPct` (teto diário por trade), não `roPerTrade/pl` (sizing mínimo) | Permite Path A (N trades × 1 contrato) e Path B (1 trade × N contratos) sem flag compliance |
| DEC-073 | Preview do attack plan em 3 blocos: Constraints/Mecânica/Acumulação | Evita alucinação semântica — separa visualmente o que é hard limit, o que é plano, o que é estatística |

**Sessão 2 — 11-12/04/2026 (implementação + validação + revisão)**

**O que foi feito:**
- **Fase A** (bc4bb1be): `computePropPlanDefaults` extraído, periodStop derivado, DebugBadge em PlanManagementModal, 10 testes
- **Fase B** (cf6a8213): `TRAILING_TO_STATIC` no engine + espelho CF, flag `TRAIL_FROZEN`, campo `trailFrozen`, 10 testes
- **Fase C** (2d8faebe): 7 templates Ylos + `YLOS` enum/label/base, `getActiveDrawdown` phase-aware, CF passa `phase` e persiste `trailFrozen`, 6 testes
- **Revisão Fase A** (822a6b5d): `periodGoalPct = maxTrades × RO × RR` (2.4% Apex CONS_B, não 0.3% EV). Preview attack plan reescrito em 3 blocos (Constraints/Mecânica/Acumulação). Tooltip Info removido.
- **Hotfix localização** (b2e0ba51): Preview estava em `AddAccountModal.jsx` (código morto). Movido para `AccountsPage.jsx` (blocos abstract + execution). Revertido AddAccountModal ao estado original.
- **riskPerOperation** (3b822949): Alterado de `roPerTrade/pl` (0.6%) para `periodStopPct` (1.2%) — teto diário por trade, permite Path A e Path B.
- **instrumentsTable Ylos** (29db3523): Adicionado `ylos: true/false` nos 17 instrumentos. Permitidos: ES/NQ/YM/RTY/CL/GC/SI/6E/6B. Restritos: NG/HG/6J/6A/ZC/ZW/ZS/MBT.
- **Issue #133 atualizado**: referência cruzada ao #136, 6 correções pendentes no prompt IA documentadas

**Arquivos tocados:**
- `src/utils/propPlanDefaults.js` (novo)
- `src/__tests__/utils/propPlanDefaults.test.js` (novo, 14 testes)
- `src/__tests__/utils/propFirmDrawdownEngine.test.js` (+16 testes: 10 TRAILING_TO_STATIC + 6 phase-aware)
- `src/utils/propFirmDrawdownEngine.js` (TRAIL_FROZEN, trailFrozen, getActiveDrawdown, phase arg, activeDrawdown)
- `functions/propFirmEngine.js` (espelho: TRAIL_FROZEN, trailFrozen, getActiveDrawdown, phase, activeDrawdown)
- `functions/index.js` (CF passa phase, persiste trailFrozen)
- `src/constants/propFirmDefaults.js` (YLOS enum/label/base, TRAILING_TO_STATIC, 7 templates, DRAWDOWN_TYPE_LABELS)
- `src/constants/instrumentsTable.js` (+ylos availability em 17 instrumentos)
- `src/pages/AccountsPage.jsx` (computePropPlanDefaults, preview 3 blocos abstract + execution)
- `src/components/PlanManagementModal.jsx` (DebugBadge, linha condicional daily loss mesa)
- `src/components/AddAccountModal.jsx` (revertido — código morto identificado)
- `src/version.js` (1.26.0 → 1.26.4)
- `docs/PROJECT.md` (CHANGELOG v1.26.1-v1.26.4, locks CHUNK-03/17)
- `docs/dev/issues/issue-136-prop-plan-semantics.md` (arquivo de controle)

**Testes:** 1186/1186 (era 1152 no início da sessão, +34 novos). 52/52 test files. Zero regressão.

**Commits:**
```
29db3523 fix: #136 adicionar ylos em instrumentsTable.availability
3b822949 fix: #136 riskPerOperation = periodStopPct
b2e0ba51 fix: #136 hotfix — rewrite preview no arquivo correto (AccountsPage)
822a6b5d fix: #136 revisão — periodGoal mecânico + preview attack plan em 3 blocos
2d8faebe feat: Fase C #136 — templates Ylos Trading + engine phase-aware
0ba3dad4 chore: remover symlink node_modules do tracking
cf6a8213 feat: Fase B #136 — engine TRAILING_TO_STATIC (Ylos Funded freeze)
bc4bb1be fix: Fase A #136 — semântica stop plano PROP + tooltip meta diária + resumo coerente
60d3a857 docs: arquivo de controle issue-136 — abertura de sessão
```

**Observações:**
- `AddAccountModal.jsx` é código morto (não importado em nenhum lugar). Candidato a deletar em follow-up issue.
- Issue #133 (AI Approach Plan) body atualizado com 6 correções pendentes no prompt v1.0 para evitar mesma alucinação semântica.
- Instrumentos restritos na Ylos e regra de corretagem na Funded ainda pendentes de verificação com aluno (seção 6 do issue body).

## 5. ENCERRAMENTO

**Status:** ✅ Encerrado — aguardando PR merge

**Checklist final:**
- [x] Acceptance criteria atendidos (E1-E5 + revisões semânticas)
- [x] Testes passando (1186/1186, +34 novos, regressão Apex zero)
- [x] PROJECT.md atualizado (DEC-068 a DEC-073, CHANGELOG v1.26.1-v1.26.4)
- [ ] PR aberto e mergeado
- [ ] Issue #136 fechado no GitHub
- [ ] Worktree removido: `git worktree remove ~/projects/issue-136`
- [ ] Locks de chunks liberados no registry (§6.3)
- [ ] Arquivo de controle movido para `docs/archive/`

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-03 | escrita | `PlanManagementModal.jsx` — DebugBadge + daily loss mesa condicional (E3) |
| CHUNK-17 | escrita | `AccountsPage.jsx` (computePropPlanDefaults + preview 3 blocos), `propFirmDrawdownEngine.js` (TRAILING_TO_STATIC + phase-aware), `functions/propFirmEngine.js` (espelho + CF persiste trailFrozen), `propFirmDefaults.js` (YLOS + 7 templates), `instrumentsTable.js` (ylos availability) |

**Locks registrados em main:** PROJECT.md §6.3 commit `005d4bbb` (11/04/2026).
