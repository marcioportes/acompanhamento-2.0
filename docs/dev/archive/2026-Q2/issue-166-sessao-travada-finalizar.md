# fix: 166 — Sessão Travada no Botão Finalizar

> **Branch:** `fix/issue-166-sessao-travada-finalizar`
> **Versão reservada:** v1.40.0
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Prioridade:** Sev1
> **Chunks:** CHUNK-09 (escrita)
> **PROJECT.md base:** v0.23.5

---

## 1. ESCOPO

Botão "Finalizar" na tela de conclusão do aprofundamento (`ProbingQuestionsFlow.jsx`) está travado — não responde ao clique ou trava sem feedback visual.

**Tela afetada:**
```
Aprofundamento concluído
Suas respostas serão analisadas e apresentadas ao seu mentor para a entrevista de validação.
[Finalizar]
```

**Causa provável (a confirmar no discovery):**
- `completeAllProbing()` é async sem loading state nem error handling — se a operação falhar ou demorar, o botão não dá feedback
- Sem `disabled` durante execução — cliques múltiplos possíveis
- Sem `try/catch` — falha silenciosa trava o fluxo

---

## 2. ACCEPTANCE CRITERIA

- [ ] Botão "Finalizar" responde ao clique com loading state visível
- [ ] Cliques múltiplos durante execução são ignorados (disabled enquanto processa)
- [ ] Erro em `completeAllProbing()` é capturado e exibe mensagem ao usuário (não trava silenciosamente)
- [ ] Fluxo completo testado: clique → loading → success → `onComplete()` chamado
- [ ] Teste cobrindo o comportamento do botão (loading, disabled, error)

---

## 3. ANÁLISE DE IMPACTO

- Collections tocadas: `students/{id}/assessment/` (escrita via `completeAllProbing`)
- CFs afetadas: nenhuma prevista (operação local via hook)
- Hooks: `useProbing` (`completeAllProbing`)
- Side-effects: nenhum além da atualização de status no Firestore
- Blast radius: BAIXO — UI only, componente isolado

---

## 4. SHARED FILES (delta — aplicar no main via PR)

| Arquivo | Delta |
|---------|-------|
| `src/version.js` | Aplicar v1.40.0 (já reservada) + entrada CHANGELOG |
| `docs/PROJECT.md` | CHANGELOG [1.40.0] + encerramento |

---

## 5. LOG DE EXECUÇÃO

**Coordenador:** sessão a registrar (abrir de `~/projects/issue-166`)
**Worker:** headless via tmux `cc-166` + mailbox `.cc-mailbox/`

| # | Task | Status | Commit | Report |
|---|------|--------|--------|--------|
| 01 | Discovery — mapear fluxo completo do botão + causa raiz + propor fix | pendente | — | — |
| 02 | Implementação — fix loading state + disabled + error handling + testes | pendente | — | — |
