# Issue #145 — arch: Página dedicada Mesa Prop — extrair componentes prop do Dashboard

- **Estado:** OPEN
- **Milestone:** v1.1.0 — Espelho Self-Service
- **Epic pai:** #144
- **Branch:** `arch/issue-145-prop-firm-page`
- **Worktree:** `~/projects/issue-145`
- **Versão reservada:** v1.32.0 (reservada no main commit `155bb102` junto com locks)
- **Baseado em PROJECT.md:** v0.19.1 (15/04/2026)

---

## 1. Objetivo

Extrair PropAccountCard, PropAlertsBanner, PropPayoutTracker e PropAiApproachPlanSection do StudentDashboard para página dedicada "Mesa Prop" no sidebar. Dashboard volta a ser genérico (sem condicionais `type === 'PROP'`).

---

## 2. Chunks

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-02 | escrita | StudentDashboard (remoção componentes prop) + Sidebar (novo item) |
| CHUNK-17 | escrita | PropFirmPage nova + adaptador contexto + componentes prop migrados |

**Locks registrados:** PROJECT.md §6.3 (commit `8e6e9f1e` em main).

---

## 3. Escopo (do issue body)

1. Novo item "Mesa Prop" no Sidebar (condicional: só se aluno tem conta type PROP)
2. Nova página `PropFirmPage.jsx` consumindo StudentContextProvider
3. Remover componentes prop do `StudentDashboard.jsx`
4. ContextBar no topo governa a página (conta selecionada persiste)
5. Adaptador temporário `selectedPropAccountId` migrado para contexto direto
6. Fix sparkline DD threshold — altura mínima + range eixo Y corrigido
7. Plano phase-aware — attack plan e AI approach plan reconhecem fase PA/SIM_FUNDED/LIVE (não só EVALUATION)

---

## 4. Análise de impacto

### Collections tocadas
- Nenhuma nova. Leitura de `accounts`, `trades`, `plans`, `students` (existentes).

### Cloud Functions
- Nenhuma nova ou modificada.

### Hooks/listeners
- `useAccounts` — leitura (sem mudança)
- `useDrawdownHistory` — migra para PropFirmPage (consumo idêntico)
- `useMovements` — migra para PropFirmPage
- `useAssessment` — migra para PropFirmPage (para trader4DProfile)
- `useAiApproachPlan` — migra para PropFirmPage
- `useStudentContext` — PropFirmPage consumirá conta selecionada do contexto

### Side-effects
- Nenhum. Refator de layout, zero mudança em lógica de negócio.

### Invariantes
- INV-04 (DebugBadge): PropFirmPage terá `component="PropFirmPage"`
- INV-16 (worktree): `~/projects/issue-145`

### Blast radius
- Dashboard perde 4 componentes condicionais (PropAccountCard, PropAlertsBanner, PropPayoutTracker, PropAiApproachPlanSection)
- PropFirmPage ganha esses 4 + ContextBar
- Sidebar ganha 1 item condicional
- Se algo der errado: reverter = mover componentes de volta para Dashboard

### Testes que podem quebrar
- Nenhum teste existente testa layout do StudentDashboard diretamente
- Novos testes: verificar que PropFirmPage renderiza os 4 componentes + ContextBar

---

## 5. Deltas em shared files (propor aqui, aplicar no main via PR)

### 5.1 `src/App.jsx` — nova view
```jsx
case 'propfirm':
  return <PropFirmPage viewAs={viewAs} />;
```

### 5.2 `src/components/Sidebar.jsx` — novo item
```jsx
{ id: 'propfirm', label: 'Mesa Prop', icon: Shield, condition: hasPropAccount }
```
`hasPropAccount` derivado de `accounts.some(a => a.type === 'PROP')`.

---

## 6. Ordem de ataque

### Fase A — PropFirmPage + migração de componentes (~2h)
- [ ] Criar `src/pages/PropFirmPage.jsx` com ContextBar + PropAlertsBanner + PropAccountCard + PropPayoutTracker
- [ ] Consumir `useStudentContext` para conta selecionada + `useAccounts` + `useDrawdownHistory` + `useMovements` + `useAssessment`
- [ ] Remover PropAccountCard/PropAlertsBanner/PropPayoutTracker/PropAiApproachPlanSection do StudentDashboard.jsx
- [ ] Remover hooks que ficaram orphans no Dashboard (useDrawdownHistory, useMovements, useAssessment se só prop usava)
- [ ] DebugBadge `component="PropFirmPage"`

### Fase B — Sidebar + App.jsx routing (~1h)
- [ ] Novo item condicional no Sidebar (icon Shield, label "Mesa Prop", condition hasPropAccount)
- [ ] Nova view 'propfirm' no App.jsx renderContent switch
- [ ] Verificar que navegação via sidebar funciona

### Fase C — Fixes (sparkline + phase-aware) (~2h)
- [ ] Fix sparkline DD threshold: altura mínima + range eixo Y corrigido
- [ ] Attack plan phase-aware: reconhece PA/SIM_FUNDED/LIVE (suggestedPlan adapta)
- [ ] AI approach plan phase-aware: prompt/narrativa reconhece fase atual

### Fase D — Testes + validação browser (~1h)
- [ ] Testes regressão: suite completa passando
- [ ] Validação browser: sidebar mostra/oculta "Mesa Prop", página renderiza, Dashboard limpo
- [ ] DebugBadge correto em PropFirmPage

---

## 7. Gate Pré-Código

1. ✅ Issue #145 no GitHub
2. ✅ Worktree `~/projects/issue-145` (INV-16)
3. ✅ CHUNK-02 + CHUNK-17 locked em main (commit `8e6e9f1e`)
4. ⏳ **Aprovação INV-07** — escopo acima

---

## 8. Log da sessão

- **15/04/2026** — Abertura. Locks CHUNK-02/17 registrados em main (`8e6e9f1e`). Worktree criado. Arquivo de controle gerado. Aguardando aprovação Pré-Código.
- **15/04/2026** — Correção protocolo: versão v1.32.0 + PROJECT.md v0.20.0 reservados em main (`155bb102`) — ANTES do worktree, junto com locks. Worktree rebasado. Regra passa a ser obrigatória em toda abertura.

- **16/04/2026 — Fase A concluída:**
  - Criado `src/pages/PropFirmPage.jsx` com wrapper StudentContextProvider + body com ContextBar, PropAlertsBanner, PropAccountCard (com AI Approach Plan), PropPayoutTracker
  - Removido do `StudentDashboard.jsx`: imports PropAccountCard/PropAlertsBanner/PropPayoutTracker, hooks usePropFirmTemplates/useDrawdownHistory/useMovements/useAssessment, bloco JSX condicional prop (linhas ~369-474), import derivePropAlerts/getDangerAlerts
  - Dashboard agora genérico — zero condicional `type === 'PROP'`
  - DebugBadge `component="PropFirmPage"`
  - 1456/1456 testes passando, build OK

- **16/04/2026 — Fase B concluída:**
  - `src/App.jsx`: +import PropFirmPage, +case 'propfirm' no switch aluno, +useAccounts para detectar hasPropAccount, +prop hasPropAccount no Sidebar
  - `src/components/Sidebar.jsx`: +import Shield, +prop hasPropAccount, +item condicional "Mesa Prop" (icon Shield, entre Contas e Perfil de Maturidade)
  - Build OK, 1456/1456 testes passando
  - Bug Rules of Hooks corrigido: early return em PropFirmPageBody movido para DEPOIS de todos os hooks (useAccounts, usePlans, usePropFirmTemplates, useDrawdownHistory, useMovements, useAssessment, useMemo×3)

- **16/04/2026 — Sessão retomada + Fase C concluída:**
  - Fases A+B commitadas como `518e7fae`
  - Rebase sobre main (incorporou fix #146 — botão Novo Plano)
  - Fase C item 1 (sparkline): removida do card — sem escala/contexto, inútil como mini-dashboard
  - Fase C item 2 (attack plan phase-aware): `calculateMesaConstraints` agora usa `getActiveDrawdown(template, phase)` — SIM_FUNDED/LIVE usam `fundedDrawdown`
  - Fase C item 3 (AI approach plan phase-aware): `phase` threaded PropAccountCard → PropAiApproachPlanSection → useAiApproachPlan → prompt.js. Prompt condiciona narrativa e instrução 5 na fase
  - Fix: P&L dia removido do card (dado stale sem reset diário)
  - Fix: `tradingDays` derivado de `drawdownHistory` (datas únicas via `new Set`) — corrige contagem inflada por trades importados
  - Build OK, 1456/1456 testes passando
  - version.js atualizado para v1.32.0, CHANGELOG comment atualizado
  - Gate pré-entrega apresentado — aguarda validação browser do Marcio

- **17/04/2026 — Sessão pausada para retomada:**
  - **Estado:** Fases A+B+C completas e commitadas. Fase D (validação browser) pendente.
  - **Pendência única:** Marcio validar no browser → PR → merge → encerramento §4.3
  - **Commits na branch (5):**
    - `518e7fae` feat: PropFirmPage + Sidebar Mesa Prop + limpar Dashboard — Fases A+B
    - `d8de79dd` feat: Fase C — attack plan/AI phase-aware
    - `38996dc5` fix: remover P&L dia (stale) e sparkline DD (sem escala)
    - `88fc0850` fix: tradingDays derivado de drawdownHistory
    - `3f748c90` docs: atualizar issue doc + version.js para v1.32.0
  - **Para retomar:** `cd ~/projects/issue-145`, subir dev server `npx vite --port 5174`, validar browser, criar PR com `Closes #145`, executar §4.3
  - **Shared files pendentes no merge:** App.jsx (rota propfirm), Sidebar.jsx (item Mesa Prop), PROJECT.md (CHANGELOG [1.32.0])
  - **Bugs fora do scope (registrados no issue body):** bestDayProfit $0 (CF/CHUNK-04), deadline-exceeded CF AI (CF layer)

**Nota de protocolo (15/04/2026):** A partir desta sessão, a reserva de versão (`version.js` comment + `PROJECT.md` header bump + entrada na tabela histórica) é obrigatória na abertura §4.0 e deve ser commitada no main ANTES da criação do worktree, no mesmo commit dos locks (ou commit subsequente, desde que antes do worktree). O worktree nasce com a versão já reservada.
