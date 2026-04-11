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
| DEC-PENDING | Renomear `masterRules` → `fundedRules` no schema do template | Nomenclatura Ylos usa "Funded", não "Master" — reduz ambiguidade |
| DEC-PENDING | Stop do período plano = `maxTrades × RO` (derivado attack plan), não `dailyLossLimit` | Daily loss da mesa é hard limit separado, não parâmetro do plano. Ylos Challenge sequer tem daily loss |
| DEC-PENDING | Linha "Daily loss mesa" no resumo é condicional (`if template.dailyLossLimit != null`) | Contas Ylos Challenge não têm — esconder a linha evita confusão |

**Pendências para próxima ação:**
- Apresentar Gate Pré-Código Fase A → aguardar aprovação do Marcio antes de tocar código

## 5. ENCERRAMENTO

**Status:** 🔵 Em andamento

**Checklist final:**
- [ ] Acceptance criteria atendidos (E1-E5)
- [ ] Testes passando (+ regressão Apex zero)
- [ ] PROJECT.md atualizado (DECs, CHANGELOG, liberar locks CHUNK-03/17)
- [ ] PR aberto e mergeado
- [ ] Issue #136 fechado no GitHub
- [ ] Worktree removido: `git worktree remove ~/projects/issue-136`
- [ ] Locks de chunks liberados no registry (§6.3)
- [ ] Arquivo de controle movido para `docs/archive/`

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-03 | escrita | `PlanManagementModal.jsx` — passo 2 (defaults stop período) e passo 3 (resumo coerente) — E1/E3 |
| CHUNK-17 | escrita | `AddAccountModal.jsx` (defaults + tooltip), `propFirmDrawdownEngine.js` (TRAILING_TO_STATIC), `functions/propFirmEngine.js` (espelho), `propFirmTemplates` (templates Ylos) — E1/E2/E4/E5 |

**Locks registrados em main:** PROJECT.md §6.3 commit `005d4bbb` (11/04/2026).
