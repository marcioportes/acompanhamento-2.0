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

- 19/04/2026 — issue #154 criada + item no Product Board em "Review".
- Worktree `~/projects/issue-154` criado a partir de `main@d736b37b`.
- Implementação (3 arquivos + version.js):
  - `src/pages/AccountsPage.jsx:15` — import `PlusCircle`; linha ~581 — botão no hover do card (entre Edit2 e Trash2), `setSelectedAccount({ ...acc, _autoOpenPlanModal: true })` + `e.stopPropagation()`.
  - `src/components/StudentAccountGroup.jsx:16-20` — import `PlusCircle`; nova ação no row actions entre Target (accordion) e Edit2, `onAccountClick({ ...acc, _autoOpenPlanModal: true })`.
  - `src/pages/AccountDetailPage.jsx:18` — import `useEffect`; linha ~78 — `useEffect` dispara `setShowPlanModal(true); setEditingPlan(null);` quando `account?._autoOpenPlanModal && onCreatePlan`.
  - `src/version.js` — bump 1.32.0 → 1.36.0 + entrada no changelog inline.
- Testes: 1567/1567 passando (zero regressão).
- Commit `32693927` → push `fix/issue-154-botao-criar-plano-card-conta` → PR #155 → merge fast-forward `6caf02c9`.

## Encerramento

- PR #155 mergeado em 19/04/2026.
- Branch remoto deletado (pelo Marcio via GitHub UI).
- Worktree `~/projects/issue-154` removido (passo §4.3).
- Branch local `fix/issue-154-botao-criar-plano-card-conta` deletado.
- Product Board item #154 movido para "Done".
- Nenhuma dívida residual. Nenhum lock a liberar (issue em modo interativo, sem CHUNK lock formal).
- Validação browser executada pelo Marcio (merge indica aprovação).
