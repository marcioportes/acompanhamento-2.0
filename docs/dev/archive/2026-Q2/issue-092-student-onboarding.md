# Issue 092 — feat: Student Onboarding & Assessment 4D — Fase A
> **Branch:** `feature/student-onboarding`  
> **Milestone:** v1.1.0 — Student Experience  
> **Aberto em:** 22/03/2026  
> **Status:** ✅ Encerrado  
> **PR:** pendente merge  
> **Versão entregue:** v1.21.2

---

## 1. SPEC

### Contexto
Implementação do setup inicial do aluno com assessment estruturado em 3 estágios, estabelecendo o Perfil de Maturidade para evolução emocional e comportamental.

### Assessment 3 estágios
1. **Questionário base** — 34 perguntas (22 fechadas + 12 abertas), aluno sozinho
2. **Sondagem adaptativa** — 3-5 perguntas geradas pela IA baseadas em incongruências e hesitações
3. **Validação pelo mentor** — entrevista 20-30 min com relatório completo

### Acceptance criteria — todos atendidos ✅
- [x] 34 perguntas (22 fechadas + 12 abertas)
- [x] Randomização de alternativas com persistência Firestore
- [x] 5 flags inter-dimensionais (STOP_CLAIM_VS_BEHAVIOR, PROCESS_VS_IMPULSE, SIZING_VS_REVENGE, DISCIPLINE_VS_LOCUS, JOURNAL_VS_AWARENESS)
- [x] Sondagem adaptativa 3-5 perguntas (DEC-016)
- [x] 4 CFs: classifyOpenResponse, generateProbingQuestions, analyzeProbingResponse, generateAssessmentReport
- [x] Scoring engine 4D com fórmulas corretas (E×0.25 + F×0.25 + O×0.20 + X×0.30)
- [x] emotion_control herdado no operacional (DEC-013)
- [x] State machine completa (7 estados)
- [x] score_ia e score_mentor persistidos
- [x] 128+ testes, 5 suites
- [x] BaselineReport, MentorValidation, IncongruenceFlags, TraderProfileCard
- [x] "Perfil de Maturidade" no sidebar do aluno

### Fase B (issue separado)
Evolution tracking: reviews mensais 3 camadas, gates de progressão, mentor journal, timeline 4D.
→ Ver `docs/dev/SPEC-EVOLUTION-TRACKING.md` e `docs/dev/BRIEF-EVOLUTION-TRACKING-FASEB.md`

---

## 2. SESSÕES

### Sessão — 19-22/03/2026 (CHUNK-09 Fase A)

**O que foi feito:**
- Implementação completa do assessment 3 estágios
- 35 arquivos novos: 7 utils, 3 hooks, 11 components, 1 page, 4 CFs, 5 test suites
- 128 testes passando

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| DEC-013 | Operacional 5D com emotion_control herdado | Cross-link emocional impede inflação por auto-relato |
| DEC-014 | Cross-check inter-dimensional (5 flags) | Aluno tende a inflar financeiro/operacional |
| DEC-015 | Randomização via persistência Firestore | Robusto para retomada e troca de device |
| DEC-016 | Sondagem adaptativa pós-questionário | Sondar enquanto aluno está no contexto |
| DEC-021 | Stage diagnosticado por IA (pattern-matching) | Não fórmula — framework qualitativo |
| DEC-022 | Marco zero tábula rasa (gates_met=0) | Baseline limpa independente de respostas |
| DEC-023 | Assessment acionado pelo mentor | Não automático — mentor decide quando iniciar |

**Commits principais:**
```
4a565820 feat(CHUNK-09): Student Onboarding & Assessment 4D - Fase A
09f16e60 feat(CHUNK-09): integrar AssessmentToggle no StudentsManagement
0794bfaf fix: corrigir import path firebase
7838b1d7 fix: move AssessmentGuard from StudentDashboard to App.jsx
d49008eb fix: guard loop + DEC-024 firestore rules
ceb227b2 docs: DEC-025 Firestore rules simplificadas
d1c54d01 fix: onboarding guard App.jsx + múltiplos fixes (v1.20.1)
1ad85dd4 chore: remove codigo-fonte.zip do tracking
```

---

### Sessão — 24/03/2026 (UX + Framework Prompt)

**O que foi feito:**
- BaselineReport v2.0 — régua 4D, grid 2×2, plano do mentor
- MentorValidation v1.1 — prioridades editáveis pré-carregadas da IA
- IncongruenceFlags v2.0 — labels semânticos, master/detail, respostas reais
- Prompt classifyOpenResponse reescrito com Trader Evolution Framework completo
- Re-processar IA (questionário + probing)
- Rename "Experiência" → "Maturidade" em toda UI

**Decisões:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| DEC-026 | saveInitialAssessment direto para 'active' via updateDoc | Fix stale closure — aluno ficava preso em mentor_validated |
| DEC-027 | Onboarding UX completo (BaselineReport, IncongruenceFlags, prompt) | Qualidade de apresentação para MVP |

**ZIPs entregues:** feat-baseline-sidebar, fix-assessment-active, feat-baseline-report, feat-incongruence-detail, feat-framework-prompt, feat-maturidade, feat-reprocess-complete, fix-baseline-stagediagnosis

---

### Sessão — 25/03/2026 (Fixes rehydration + merge prep)

**O que foi feito:**
- Fix stageDiagnosis rehydration (guard bloqueava incorretamente)
- TraderProfileCard Maturidade usa escala por stage, não score numérico
- saveStageDiagnosis persiste no questionnaire doc
- Re-deploy CF classifyOpenResponse com novo prompt
- Commit consolidado + push

**ZIPs:** fix-stage-rehydration-v1.21.0, fix-stagediagnosis-guard-v1.21.1

**Commit consolidado:**
```
a91effb6 feat: onboarding UX completo — Maturidade, BaselineReport 2D grid...
078a0d95 feat: stageDiagnosis rehydration, Re-processar IA c/ probing... (v1.21.1)
```

---

### Sessão — 26/03/2026 (Fix labels + organização)

**O que foi feito:**
- Rename "Seu Marco Zero" → "Perfil de Maturidade" no BaselineReport header
- stageDiagnosis card movido para full-width (fora do grid 2×2)
- Rename "Marco Zero" → "Perfil de Maturidade" no Sidebar label
- version.js bump para v1.21.2

**ZIP:** fix-sidebar-label-v1.21.2.zip

**Commit:**
```powershell
git add src/components/Sidebar.jsx src/components/Onboarding/BaselineReport.jsx src/version.js
git commit -m "fix: rename Marco Zero para Perfil de Maturidade em Sidebar e BaselineReport (v1.21.2)"
git push origin feature/student-onboarding
```

---

## 3. ENCERRAMENTO

**Status:** Aguardando PR e merge `feature/student-onboarding → main`

**Checklist final:**
- [x] Todos os acceptance criteria atendidos
- [x] Testes passando (128+ testes, 5 suites)
- [x] PROJECT.md atualizado (DEC-013 a DEC-027)
- [x] CHANGELOG entry adicionada (PROJECT.md seção 10)
- [ ] PR aberto no GitHub
- [ ] Merge feature/student-onboarding → main
- [ ] Issue #92 fechado no GitHub (`gh issue close 92`)
- [ ] Branch deletada (`git push origin --delete feature/student-onboarding`)

**Comando para abrir o PR:**
```powershell
gh pr create --title "feat: Student Onboarding & Assessment 4D — Fase A (v1.21.2)" --body "Closes #92`n`nImplementação completa do assessment 3 estágios, scoring engine 4D, sondagem adaptativa, validação do mentor e Perfil de Maturidade.`n`nVer docs/dev/issues/issue-092-student-onboarding.md para histórico completo." --base main --head feature/student-onboarding
```
