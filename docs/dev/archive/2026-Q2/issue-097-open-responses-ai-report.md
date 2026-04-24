# issue-097 — Respostas Abertas com Análise IA no Relatório do Mentor

**Branch:** `feature/issue-097-open-responses-ai-report`  
**Base:** `main` (v1.21.2 → v1.21.4)  
**Tipo:** `feat`  
**CHUNK:** CHUNK-09  
**Status:** closed  
**Data:** 28–29/03/2026  
**Merged:** v1.21.3 (PR #98, 28/03) + v1.21.4 (PR pendente, 29/03)  

---

## Problema

No relatório pré-assessment (aba "Relatório IA", visível apenas para o mentor), as respostas abertas do aluno com análise da IA só apareciam **dentro das flags de incongruência** (`IncongruenceFlags`). Respostas abertas que não dispararam nenhuma flag ficavam invisíveis — o mentor precisava consultar o Firebase console para acessar o texto do aluno e a análise da IA.

Adicionalmente, durante testes foi identificado que:
- As perguntas do aprofundamento adaptativo (probing) não eram exibidas individualmente no relatório
- O `reportData` (incluindo `developmentPriorities`) não era persistido no Firestore — desaparecia no refresh
- O prompt da CF `generateAssessmentReport` acessava `probingData.flagsResolved` quando deveria ser `probingData.summary.flagsResolved`
- O botão "Re-processar IA" não re-gerava o relatório completo (só reprocessava classificações e probing)

---

## Solução

### v1.21.3 (sessão 28/03)

Nova seção **"Respostas Abertas — Análise IA"** adicionada ao `AIAssessmentReport`, posicionada entre "Flags de Incongruência" e "Resultado do Aprofundamento Adaptativo".

**Estrutura:** 4 grupos colapsáveis por dimensão (Emocional, Financeiro, Operacional, Maturidade). Cada grupo exibe o contador de respostas no header. Cada resposta exibe:
- Enunciado da pergunta (via `QUESTION_MAP`)
- Texto completo do aluno
- Score IA + badge de classificação (A/B/X/Y/Z) + barra de confiança
- `aiFinding` (observação clínica) — quando presente
- `aiJustification`
- "Aguardando processamento IA" para respostas sem `aiScore`

### v1.21.4 (sessão 29/03 — complemento)

1. **ProbingQuestionsPanel** — painel colapsável (purple theme) com perguntas individuais do aprofundamento: texto da pergunta gerada, flag investigado, resposta do aluno, badge de resolução (Esclarecido/Confirmado/Inconclusivo), finding, emotionalInsight, confiança

2. **reportData persistence** — `saveReportData()` no `useAssessment`, persiste no doc `questionnaire` do Firestore. Rehydration no useEffect da page.

3. **Fix probingData.summary** — CF `generateAssessmentReport` corrigida: `probingData?.summary?.flagsResolved` (antes `probingData.flagsResolved` → `undefined`)

4. **Re-processar IA Etapa 3** — `handleReprocessAI` agora re-chama `generateAssessmentReport` após reprocessar classificações e probing, regenerando stage + developmentPriorities + reportSummary

5. **Seção 4.4 PROJECT.md** — reescrita como "Diretriz Crítica de Verificação" com protocolo expandido cobrindo outputs de terminal, screenshots, logs

---

## Arquivos modificados

| Arquivo | Mudança | Versão |
|---------|---------|--------|
| `src/components/Onboarding/AIAssessmentReport.jsx` | OpenResponsesPanel + ProbingQuestionsPanel (v1.3.0) | v1.21.3 + v1.21.4 |
| `src/__tests__/utils/openResponsesFilter.test.js` | 9 testes unitários para `groupOpenResponsesByDimension` | v1.21.3 |
| `src/pages/StudentOnboardingPage.jsx` | reportData persistence, rehydration, handleReprocessAI Etapa 3 | v1.21.4 |
| `src/hooks/useAssessment.js` | `saveReportData()` | v1.21.4 |
| `functions/assessment/generateAssessmentReport.js` | Fix `probingData.summary.*`, prompt "mínimo 1" prioridade | v1.21.4 |
| `docs/PROJECT.md` | Seção 4.4 reescrita, CHANGELOG v1.21.4, DT-026 resolvido | v1.21.4 |
| `src/version.js` | 1.21.3 → 1.21.4 | v1.21.4 |

**NÃO tocados:** `IncongruenceFlags.jsx`, `App.jsx`, `functions/index.js`, `firestore.rules`

---

## Decisões

Nenhuma nova decisão formal (DEC-xxx). Mudanças são correções de bugs e complementos da funcionalidade existente.

---

## Dívidas técnicas resolvidas

| DT | Descrição | Status |
|----|-----------|--------|
| DT-026 | stageDiagnosis não gerado pelo Re-processar IA | RESOLVIDO v1.21.4 — Etapa 3 do handleReprocessAI agora re-gera via generateAssessmentReport |

---

## Testes

- `openResponsesFilter.test.js` — 9 casos para `groupOpenResponsesByDimension` (existente, não alterado)
- Teste funcional: Re-processar IA → verificar developmentPriorities no relatório e na validação

---

## Pendências

Nenhuma. Issue fechado.
