# issue-097 — Respostas Abertas com Análise IA no Relatório do Mentor

**Branch:** `feature/issue-097-open-responses-ai-report`  
**Base:** `main` (v1.21.2)  
**Tipo:** `feat`  
**CHUNK:** CHUNK-09 (check-out nesta sessão)  
**Status:** pronto para integração  
**Data:** 28/03/2026  

---

## Problema

No relatório pré-assessment (aba "Relatório IA", visível apenas para o mentor), as respostas abertas do aluno com análise da IA só apareciam **dentro das flags de incongruência** (`IncongruenceFlags`). Respostas abertas que não dispararam nenhuma flag ficavam invisíveis — o mentor precisava consultar o Firebase console para acessar o texto do aluno e a análise da IA.

---

## Solução

Nova seção **"Respostas Abertas — Análise IA"** adicionada ao `AIAssessmentReport`, posicionada entre "Flags de Incongruência" e "Resultado do Aprofundamento Adaptativo".

**Estrutura:** 4 grupos colapsáveis por dimensão (Emocional, Financeiro, Operacional, Maturidade). Cada grupo exibe o contador de respostas no header. Cada resposta exibe:
- Enunciado da pergunta (via `QUESTION_MAP`)
- Texto completo do aluno
- Score IA + badge de classificação (A/B/X/Y/Z) + barra de confiança
- `aiFinding` (observação clínica) — quando presente
- `aiJustification`
- "Aguardando processamento IA" para respostas sem `aiScore`

**Seção oculta** quando não há respostas abertas (`totalOpen === 0`).

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/Onboarding/AIAssessmentReport.jsx` | Nova seção `OpenResponsesPanel` + componentes locais `DimensionGroup` + `OpenResponseCard` |
| `src/__tests__/utils/openResponsesFilter.test.js` | 9 testes unitários para `groupOpenResponsesByDimension` |

**NÃO tocados:** `StudentOnboardingPage.jsx`, `IncongruenceFlags.jsx`, `App.jsx`, `functions/index.js`, `firestore.rules`

---

## Função exportada (testável)

```javascript
// AIAssessmentReport.jsx
export function groupOpenResponsesByDimension(responses)
// Filtra type==='open', agrupa por dimensão, retorna objeto com 4 chaves fixas
```

---

## Delta de shared files (Marcio aplica no merge)

### `src/version.js`
```javascript
export const VERSION = '1.21.3';
export const BUILD_DATE = 'DD/MM/2026'; // substituir pela data do merge
```

### `PROJECT.md` — seção 10 CHANGELOG (inserir no topo)

```markdown
### [1.21.3] - DD/MM/2026
**Issue:** #097
#### Adicionado
- Seção "Respostas Abertas — Análise IA" no AIAssessmentReport
- 4 grupos colapsáveis por dimensão com texto do aluno + score IA + classificação + confiança + aiFinding + aiJustification
- Indicador "Aguardando processamento IA" para respostas não processadas
- Testes unitários: openResponsesFilter.test.js (9 casos)
```

---

## Acceptance criteria

- [x] Seção "Respostas Abertas — Análise IA" visível no relatório do mentor
- [x] 4 grupos colapsáveis por dimensão
- [x] Cada resposta exibe: enunciado, texto do aluno, score IA, classificação, confiança, justificativa, aiFinding (se existir)
- [x] Respostas sem `aiScore` exibem "Aguardando processamento IA"
- [x] Seção oculta quando não há respostas abertas
- [x] Não duplica IncongruenceFlags — seção separada, dados complementares
- [x] DebugBadge `component="AIAssessmentReport"` mantido
- [x] 9 testes unitários para `groupOpenResponsesByDimension`
- [x] `StudentOnboardingPage.jsx` não tocado
- [x] Shared files documentados como delta — não modificados na branch

---

## Instruções de integração

```powershell
# 1. Criar branch
git checkout main
git pull origin main
git checkout -b feature/issue-097-open-responses-ai-report

# 2. Extrair ZIP
Expand-Archive -Path "Temp\issue-097-open-responses-ai-report.zip" -DestinationPath "." -Force

# 3. Verificar arquivos
git status

# 4. Rodar testes
npm run test -- src/__tests__/utils/openResponsesFilter.test.js

# 5. Aplicar deltas de shared files (version.js + CHANGELOG no PROJECT.md)

# 6. Commit e PR
git add src/components/Onboarding/AIAssessmentReport.jsx src/__tests__/utils/openResponsesFilter.test.js src/version.js docs/PROJECT.md
git commit -m "feat: respostas abertas com analise IA no relatorio do mentor (issue #097)"
git push origin feature/issue-097-open-responses-ai-report
gh pr create --title "feat: respostas abertas com analise IA no relatorio do mentor" --body "Closes #097"
```
