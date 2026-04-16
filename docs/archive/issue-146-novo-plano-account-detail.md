# Issue #146 — fix: Botão Novo Plano inacessível após issue-118

> **Status:** Implementado — aguardando PR  
> **Versão reservada:** v1.34.0  
> **Branch:** `fix/issue-146-novo-plano-account-detail`  
> **Worktree:** `~/projects/issue-146`  
> **Chunks:** CHUNK-02 (ESCRITA, bypass lock #145), CHUNK-03 (ESCRITA)  

---

## 1. Contexto

O issue #118 (Context Bar) tornou o botão "Novo Plano" no `DashboardHeader` inacessível. O botão só aparece com `selectedAccountId === 'all'`, mas a Context Bar força conta selecionada por padrão.

## 2. Solução

Mover criação de plano para `AccountDetailPage`, onde a conta já está selecionada e os planos vinculados já são exibidos. Limpar código órfão no `DashboardHeader` e `StudentDashboard`.

## 3. Escopo de Alterações

| Arquivo | Ação | Chunk |
|---------|------|-------|
| `src/pages/AccountDetailPage.jsx` | Adicionar botão "Novo Plano" + prop `onCreatePlan` | CHUNK-03 |
| `src/pages/AccountsPage.jsx` | Passar `onCreatePlan` callback com `defaultAccountId` | CHUNK-03 |
| `src/components/dashboard/DashboardHeader.jsx` | Remover botão "Novo Plano" e prop `onCreatePlan` | CHUNK-02 |
| `src/pages/StudentDashboard.jsx` | Limpar state/props órfãos de criação de plano | CHUNK-02 |

## 4. Análise de Impacto

- **Collections tocadas:** nenhuma (apenas UI)
- **Cloud Functions:** nenhuma afetada
- **Side-effects:** nenhum
- **Blast radius:** baixo — apenas reorganização de UI existente
- **Rollback:** trivial (reverter commits)

## 5. Gate Pré-Código

- [x] Issue aberto no GitHub (#146)
- [x] Arquivo de controle criado
- [x] Worktree isolado criado
- [x] Chunks lockados (CHUNK-02 bypass autorizado, CHUNK-03)
- [x] Versão reservada (v1.34.0)
- [x] Análise de impacto documentada
- [x] Aprovação do Marcio

## 6. Chunks

| Chunk | Modo | Status |
|-------|------|--------|
| CHUNK-02 | ESCRITA | LOCKED (bypass #145 autorizado) |
| CHUNK-03 | ESCRITA | LOCKED |

## 7. Shared Files — Deltas Propostos

| Arquivo | Delta |
|---------|-------|
| `src/version.js` | Bump para 1.34.0 (reservado no main) |
| `docs/PROJECT.md` | CHANGELOG v1.34.0 (no merge) |

## 8. Testes

- Verificação visual: botão "Novo Plano" acessível na AccountDetailPage
- Verificação visual: modal abre com conta pré-selecionada
- Verificação visual: DashboardHeader sem botão órfão
