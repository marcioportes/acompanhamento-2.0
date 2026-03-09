# CONTINUITY PROMPT — Sessão 09/03/2026
## Gerado: 2026-03-08 ~23:50 BRT
## Status: MAIN ATUALIZADA, v1.18.1 MERGEADA, CI VERDE
## Próximo: Issue #71 (Recálculo Cascata + P&L Contextual) e Issue #73

---

## 1. O QUE FOI FEITO NA SESSÃO 08/03/2026

### v1.18.1 — CSV Import Improvements (MERGEADO, PR #76)
- Inferência genérica de direção (DEC-003): heurística cronológica buyTimestamp/sellTimestamp
- `parseNumericValue`: suporta $(93.00), R$ 1.234,56, formato BR/US
- Redesign Step 2: Exchange dropdown Firestore (obrigatório), formato data no topo, badges de campos faltantes
- Ticker validation por exchange, botão staging bloqueado com tickers inválidos
- Exclusão individual de linhas no preview (excludedRows levantado para Wizard)
- Fix deleteStagingBatch (usa IDs em memória, não query)
- Fix listener fallback (error handler + cleanup)
- Suspend listener durante batch activate (useTrades suspendedRef)
- 315 testes, zero regressão, 11 commits

### Documentação atualizada
- ARCHITECTURE.md: DEC-003, INV-08 (CHANGELOG obrigatório), ROAD-01 (Order Matching Engine)
- CHANGELOG.md: entrada v1.18.1
- Issue #75 fechada via PR #76

### Bugs identificados não corrigidos
- Tela pisca durante ativação: suspend listener funciona mas overlay do CsvImportManager precisa ser opaco durante processamento (UX fix)
- CsvImportManager desperdiça espaço vertical (só mostra 5 trades, metade vazia)
- Auto-detect date format (MM/DD vs DD/MM) não implementado

---

## 2. ESTADO ATUAL DO REPO

```
Branch: main (única)
Último commit: 2b5fe152 — feat: CSV Import Improvements v1.18.1 (#76)
CI: verde ✅
Version: v1.18.1
Testes: 315 passando
```

---

## 3. PRÓXIMA SESSÃO — ISSUES #71 e #73

### Issue #71: Recálculo em Cascata, Visibilidade Mentor e P&L Contextual (v1.19.0)

**5 sub-tasks:**

| ID | Descrição | Estimativa | Complexidade |
|----|-----------|-----------|-------------|
| B1 | Recálculo compliance + alertas emocionais em edição de trade/plano | 4-6h | Alta |
| B2 | RR assumido quando sem stop (entry ± RO% como stop teórico) | 2-3h | Média |
| B3 | Acesso mentor ao emocional do aluno sem feedback pendente | 2-3h | Média |
| B4 | PlanLedgerExtract: RO/RR no header, RR assumido no grid, navegação feedback | 3-4h | Média |
| B5 | P&L acumulado contextual no dashboard (label ciclo/filtro/total) | 3-4h | Média-Alta |

**Ordem sugerida:** B2 → B4 → B1 → B5 → B3

**Arquivos impactados:**
- `functions/index.js` — onTradeUpdated, possível onPlanUpdated
- `compliance.js`, `tradeCalculations.js` — recálculo, RR assumido
- `PlanLedgerExtract.jsx`, `ExtractSummary.jsx`, `ExtractTable.jsx` — RO/RR
- `TradeDetailModal.jsx` — navegação feedback
- `StudentDashboard.jsx`, `DashboardHeader.jsx`, `MetricsCards.jsx` — P&L contextual
- `useDashboardMetrics.js` — cálculo P&L por contexto
- `StudentsManagement.jsx` — acesso emocional
- `useTrades.js`, `usePlans.js` — triggers recálculo

### Issue #73: [PEDIR CONTEXTO AO MARCIO]
Não tenho detalhes sobre a Issue #73. Pedir na abertura da sessão.

---

## 4. DÍVIDAS TÉCNICAS PENDENTES

| ID | Item | Prioridade |
|---|---|---|
| DT-002 | Cycle transitions sem fechamento formal | ALTA |
| DT-004 | AccountStatement week filter US → BR | MÉDIA |
| DT-005 | useSetups isGlobal undefined → true | MÉDIA |
| DT-006 | Ticker alias auto-matching | BAIXA |
| DT-007 | DebugBadge duplo ComplianceConfigPage | BAIXA |
| DT-008 | formatCurrency hardcoded R$ no MentorDashboard | BAIXA |
| DT-009 | Filtro extrato — verificar se usa createdAt vs entryTime em todos os pontos | MÉDIA |
| — | CsvImportManager overlay opaco durante ativação | BAIXA |
| — | CsvImportManager layout — aproveitar espaço vertical | BAIXA |
| — | Auto-detect date format (MM/DD vs DD/MM) | MÉDIA |

---

## 5. INVARIANTES E CONVENÇÕES (SEMPRE APLICAR)

1. **INV-01:** Dados externos NUNCA em collections de produção. Staging + addTrade.
2. **INV-02:** Toda escrita em `trades` via `addTrade`.
3. **INV-03:** Pipeline trades → CF → PL/compliance é inquebrável.
4. **INV-04:** DebugBadge em tudo. z-[51] em modais.
5. **INV-05:** Testes obrigatórios: análise de impacto + regressão.
6. **INV-06:** Datas BR (DD/MM/YYYY), semana começa segunda.
7. **INV-07:** Autorização antes de codificar.
8. **INV-08:** CHANGELOG obrigatório antes do merge.
9. **Git:** commit single-line (PowerShell), ZIPs project-relative.
10. **Falsy zero:** `??` não `||`.
11. **Trade completo:** emotionEntry + emotionExit + setup (stopLoss opcional).
12. **Ticker field:** `symbol`, não `name`.
13. **Docs:** `/docs/ARCHITECTURE.md` é documento vivo — atualizar ao final de cada sessão.

---

## 6. RECOMENDAÇÃO PARA PRÓXIMA SESSÃO

Começar com arquivos frescos da main. O #71 toca em CF, hooks e múltiplos componentes — precisa de contexto limpo.

**Pedir ao Marcio:**
1. ZIP atualizado da src/ (usar script export existente)
2. `functions/index.js` atualizado
3. Contexto da Issue #73
4. Componentes específicos: `PlanLedgerExtract.jsx`, `ExtractSummary.jsx`, `ExtractTable.jsx`, `compliance.js`, `tradeCalculations.js`, `useDashboardMetrics.js`, `MetricsCards.jsx`

**Antes de codificar qualquer sub-task:**
1. Análise de impacto completa (checklist seção 4 do ARCHITECTURE.md)
2. Proposta ao Marcio para autorização (INV-07)
3. Branch: `feature/v1.19.0-recalc-cascade-pl-context`
