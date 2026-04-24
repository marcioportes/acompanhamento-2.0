# fix: 102-Ajuste Extrato do Plano (#165)

> **Branch:** `fix/issue-165-ajuste-extrato-plano`
> **Versão reservada:** v1.39.0
> **Milestone:** v1.1.0 — Espelho Self-Service
> **Prioridade:** Sev2
> **Chunks:** CHUNK-02 (escrita), CHUNK-08 (escrita)
> **PROJECT.md base:** v0.23.1

---

## 1. ESCOPO

Três ajustes no fluxo Extrato do Plano / Feedback:

### A — Notas da Sessão no Extrato
- Incluir "Notas da Sessão" na tela inicial do PlanLedgerExtract
- Retirar o botão "Publicar"
- Manter botão "Salvar" abaixo à direita

### B — Investigar trades revisados como candidatos a rascunho
- Trades que já foram objeto de revisão NÃO devem ser candidatos para novos rascunhos ou revisões
- Investigar onde e como esse filtro deve ser aplicado (FeedbackPage, helpers, query)

### C — Botão "Continuar Rascunho"
- Na tela FeedbackPage, quando o trade já faz parte de um rascunho existente:
  - Botão atual: "Incluir no Rascunho"
  - Botão correto: "Continuar Rascunho"
  - Trazer o conteúdo já gravado

---

## 2. CHUNKS

| Chunk | Modo | Arquivos esperados |
|-------|------|--------------------|
| CHUNK-02 | ESCRITA | `PlanLedgerExtract`, `StudentDashboard` |
| CHUNK-08 | ESCRITA | `FeedbackPage`, `feedbackHelpers` |

---

## 3. ANÁLISE DE IMPACTO (a preencher pelo worker na Task 01)

- Collections tocadas: `reviews` (leitura), `trades` (leitura)
- CFs afetadas: nenhuma prevista
- Hooks: `usePlanLedgerExtract`, `useFeedback` (a verificar)
- Side-effects: nenhum previsto
- Blast radius: BAIXO — UI only

---

## 4. ACCEPTANCE CRITERIA

### A — Notas da Sessão no Extrato
- [ ] Campo "Notas da Sessão" visível na tela inicial do PlanLedgerExtract
- [ ] Botão "Publicar" removido
- [ ] Botão "Salvar" presente abaixo à direita

### B — Filtro trades revisados
- [ ] Trades já incluídos em revisão publicada (CLOSED/ARCHIVED) não aparecem como candidatos
- [ ] Lógica documentada com teste

### C — Botão contextual
- [ ] Trade sem rascunho: "Incluir no Rascunho"
- [ ] Trade já em rascunho: "Continuar Rascunho" com conteúdo pré-carregado
- [ ] Teste cobrindo ambos os estados

---

## 5. SHARED FILES (delta — aplicar no main via PR)

| Arquivo | Delta |
|---------|-------|
| `src/version.js` | Aplicar v1.39.0 (já reservada) + entrada CHANGELOG |
| `docs/PROJECT.md` | CHANGELOG [1.39.0] + encerramento |

---

## 6. LOG DE EXECUÇÃO

**Coordenador:** sessão `23d09bd0-2806-4e77-aa53-3fefca3e6a76`
**Worker:** headless via tmux `cc-165` + mailbox `.cc-mailbox/`

| # | Task | Status | Commit | Report |
|---|------|--------|--------|--------|
| 01 | Discovery — mapear PlanLedgerExtract + FeedbackPage + propor fases | pendente | — | — |
