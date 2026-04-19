# Issue #154 — fix: Card de conta precisa de botão para criar plano

**Branch:** `fix/issue-154-botao-criar-plano-card-conta`
**Worktree:** `~/projects/issue-154`
**Modo:** interativo (sem bundle formal — framework INV-19 abandonado em 19/04/2026)
**Chunks:** CHUNK-02 (ESCRITA), CHUNK-03 (LEITURA)

## Dor

Aluno cria conta Real/Demo sem ter lugar óbvio para criar plano. Workaround atual é perverso:
1. Cria conta como Mesa (wizard cria plano junto via `propFirm.suggestedPlan`)
2. Reverte a conta de Mesa para Real
3. Muda moeda
4. Corrige o plano manualmente

Botão "Novo Plano" existe apenas em `AccountDetailPage` (drill-in da conta), não no nível do card em `AccountsPage`.

## Solução

Padrão: card da conta = **ponto de entrada**; `AccountDetailPage` = **casa do pai** (dona da operação via `PlanManagementModal`). Card chama → pai executa. Preserva arquitetura (não viola AP-11).

## Mudanças

### 1. `src/pages/AccountsPage.jsx` — card visão aluno
- Adicionar botão "Novo Plano" (ícone `Target`) na área de ações hover do card (junto com Edit/Delete).
- Click: `setSelectedAccount({ ...acc, _autoOpenPlanModal: true })`.
- `e.stopPropagation()` para não disparar o click do card (que já navega para drill-in).

### 2. `src/pages/AccountDetailPage.jsx`
- `useEffect` no mount detecta `account._autoOpenPlanModal === true` → `setShowPlanModal(true); setEditingPlan(null);`.
- Flag consumida e não precisa ser limpa (account é prop, se re-entrar volta a disparar é OK porque é navegação intencional).

### 3. `src/pages/AccountsPage.jsx` — `StudentAccountGroup` (visão mentor)
- Mesmo botão no equivalente do card do grupo, passando mesma flag ao drill-in.

## Critério de aceite

- [ ] Botão "Novo Plano" visível no hover do card de conta (visão aluno)
- [ ] Botão "Novo Plano" visível no hover do card de conta (visão mentor)
- [ ] Click abre AccountDetailPage com PlanManagementModal aberto direto
- [ ] Funciona para conta Real, Demo e Mesa
- [ ] npm test passa
- [ ] DebugBadge mantido

## Shared files

- `src/version.js` — bump (patch v1.32.1 proposto, validar com Marcio antes)

## Testes

- Validação browser interativa (Marcio) — não é lógica de negócio, apenas UX.
- `npm test` completo passa (guard de regressão).

## Log de execução

_Preencher durante o trabalho._

## Encerramento

_Preencher no final._
