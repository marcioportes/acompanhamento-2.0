# Issue 122 — feat: Fluxo de caixa — previsao de renovacoes por mes
> **Branch:** `feature/issue-122-fluxo-caixa-renovacoes`  
> **Milestone:** v1.2.0 — Mentor Cockpit  
> **Aberto em:** 05/04/2026  
> **Status:** 🔵 Em andamento  
> **Versao entregue:** —

---

## 1. CONTEXTO

Visualizacao mensal de receita prevista por renovacao na SubscriptionsPage. Agrupa subscriptions ativas por endDate, soma amount por mes. Mostra quais alunos vencem em cada mes e valor total esperado. Nao inclui receita ja recebida — apenas previsao de renovacao futura.

### Sub-issue #123 — feat: Campo whatsapp no student

Adicionar campo `whatsappNumber` (string) na collection `students`. Campo de referencia para o mentor. Preparacao para futura integracao WhatsApp. INV-15: campo novo no student — dependencia conceitual ok (dado do aluno). Gate aprovado pelo Marcio.

**Justificativa de agrupamento:** ambos sao features do milestone v1.2.0 (Mentor Cockpit), baixa complexidade, sem sobreposicao de chunks. Enderecados na mesma sessao para eficiencia.

---

## 2. ACCEPTANCE CRITERIA

### #122 — Fluxo de caixa
- [ ] Componente `RenewalForecast` exibe projecao mensal de renovacoes
- [ ] Agrupa subscriptions ativas por mes de vencimento (campo `endDate`)
- [ ] Soma `amount` por mes, exibe total esperado
- [ ] Lista quais alunos vencem em cada mes
- [ ] Nao inclui receita ja recebida (apenas previsao futura)
- [ ] Integrado na SubscriptionsPage
- [ ] DebugBadge com `component="RenewalForecast"`
- [ ] Formato de datas BR (DD/MM/YYYY), moeda BRL (INV-06)

### #123 — Campo whatsapp
- [ ] Campo `whatsappNumber` (string) adicionado na collection `students`
- [ ] UI para mentor editar o campo (inline ou modal)
- [ ] Validacao basica de formato (string nao-vazia, apenas digitos/+)
- [ ] Exibido na area de dados do aluno visivel ao mentor
- [ ] DebugBadge nos componentes novos/tocados

---

## 3. ANALISE DE IMPACTO

### #122 — Fluxo de caixa

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `students/{id}/subscriptions` (LEITURA apenas) |
| Cloud Functions afetadas | Nenhuma — somente leitura |
| Hooks/listeners afetados | `useSubscriptions` (ja carrega endDate, amount, renewalDate) |
| Side-effects (PL, compliance, emotional) | Nenhum |
| Blast radius | Baixo — componente novo, somente leitura |
| Rollback | Remover componente da SubscriptionsPage |

### #123 — Campo whatsapp

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `students` (ESCRITA — campo novo `whatsappNumber`) |
| Cloud Functions afetadas | Nenhuma — campo nao e consumido por CFs |
| Hooks/listeners afetados | Nenhum listener existente afetado |
| Side-effects (PL, compliance, emotional) | Nenhum |
| Blast radius | Minimo — campo aditivo, sem dependencias |
| Rollback | Remover campo da UI; campo no Firestore e inerte |

**INV-15 (Aprovacao para Persistencia):**
- Justificativa: campo de contato do aluno, dependencia conceitual direta (dado do estudante)
- Opcoes: (a) campo no doc student (simples, leitura direta) vs (b) subcollection contacts (over-engineering)
- Recomendacao: campo no doc student — acesso direto, sem query adicional
- **Gate aprovado pelo Marcio** (declarado no body do issue #123)

---

## 4. SESSOES

### Sessao 1 — 05/04/2026

**O que foi feito:**
- Criacao do arquivo de controle
- Analise de impacto e proposta tecnica
- Testes ANTES da UI (31 testes: 14 whatsapp + 17 renewal forecast)
- Teste de shift de fuso pegou bug em formatDateBR — corrigido com UTC
- Helper `validateWhatsappNumber` (E.164, sanitizacao)
- Helper `groupRenewalsByMonth`, `formatDateBR` (UTC-safe), `formatBRL`
- Campo `whatsappNumber` inline edit na StudentsManagement (Web SDK updateDoc)
- Componente `RenewalForecast` — projecao mensal collapsible na SubscriptionsPage
- version.js 1.24.0, CHANGELOG, PROJECT.md v0.10.1
- Build limpo, 854 testes passando (39 test files)

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| DEC-057 | whatsappNumber como campo no doc student (nao subcollection) | Acesso direto, sem query adicional. INV-15 aprovado no body #123 |
| DEC-058 | formatDateBR usa getUTC* em vez de toLocaleDateString | Evita shift de fuso BR UTC-3 em datas midnight (licao sessao #94) |
| DEC-059 | RenewalForecast como componente collapsible | Nao ocupa espaco fixo na pagina, mentor expande quando necessario |

**Arquivos tocados:**
- `src/utils/whatsappValidation.js` (NOVO)
- `src/utils/renewalForecast.js` (NOVO)
- `src/components/RenewalForecast.jsx` (NOVO)
- `src/__tests__/utils/whatsappValidation.test.js` (NOVO)
- `src/__tests__/utils/renewalForecast.test.js` (NOVO)
- `src/pages/StudentsManagement.jsx` (EDITADO — inline whatsapp edit)
- `src/pages/SubscriptionsPage.jsx` (EDITADO — import + RenewalForecast)
- `src/version.js` (EDITADO — 1.23.0 → 1.24.0)
- `docs/PROJECT.md` (EDITADO — CHANGELOG, versao, historico)
- `docs/dev/issues/issue-122-fluxo-caixa-renovacoes.md` (este arquivo)

**Testes:**
- 31 testes novos (14 + 17), 854 total passando (39 test files)

**Commits:**
- `1c57046e` feat: RenewalForecast + whatsappNumber (issues #122 #123)

**Pendencias para proxima sessao:**
- Commit e PR
- Liberar locks CHUNK-02 e CHUNK-16 apos merge

---

## 5. ENCERRAMENTO

**Status:** Aguardando aprovacao

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] PROJECT.md atualizado (DEC, DT, CHANGELOG)
- [ ] PR aberto e mergeado
- [ ] Issues fechados no GitHub (#122, #123)
- [ ] Branch deletada
- [ ] Locks de chunks liberados no registry (secao 6.3)

---

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-16 | escrita | RenewalForecast na SubscriptionsPage (#122) |
| CHUNK-02 | escrita | Campo whatsappNumber na collection students (#123) |

> **Modo leitura:** a sessao consulta arquivos do chunk mas nao os modifica. Nao requer lock.
> **Modo escrita:** a sessao modifica arquivos do chunk. Requer lock obrigatorio.
