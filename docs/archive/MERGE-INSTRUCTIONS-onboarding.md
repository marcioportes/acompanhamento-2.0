# MERGE-INSTRUCTIONS: Student Onboarding (CHUNK-09) — Fase A COMPLETA
## Branch: feature/student-onboarding
## Data: 22/03/2026

> **ENTREGA COMPLETA da Fase A.** Contém toda a lógica de negócio, hooks, Cloud Functions, componentes React e testes.
> Fase B (Evolution Tracking) será uma entrega separada.

---

### version.js (APLICAR APENAS NA ENTREGA FINAL)
- De: 1.19.6
- Para: 1.20.0 (MINOR — new feature backward-compatible)
- Build: 20260322

### CHANGELOG.md (APLICAR APENAS NA ENTREGA FINAL)
- Entrada proposta:
  ```
  ## [1.20.0] - 2026-03-22

  ### Adicionado
  - **Student Onboarding & Assessment 4D:** Questionário de 34 perguntas (22 fechadas + 12 abertas) com scoring automático por IA
  - **Scoring engine:** Fórmulas 4D completas — Emocional (média 3 sub-dims), Financeiro (ponderado 0.40/0.40/0.20), Operacional (5D com emotion_control herdado, pesos 0.25/0.20/0.20/0.15/0.20), Experiência (stage diagnosticado por IA + stageBase, DEC-021/DEC-022)
  - **Composite score:** E×0.25 + F×0.25 + O×0.20 + X×0.30 com dupla penalidade emocional intencional (~0.29 efetivo)
  - **Randomização de alternativas:** Fisher-Yates com persistência no Firestore (DEC-015, Opção B) + fallback PRNG seeded
  - **Detecção de incongruências:** Intra-dimensional (fechadas vs abertas, delta ≥ 25) + inter-dimensional (5 flags DEC-014: STOP_CLAIM_VS_BEHAVIOR, PROCESS_VS_IMPULSE, SIZING_VS_REVENGE, DISCIPLINE_VS_LOCUS, JOURNAL_VS_AWARENESS)
  - **Gaming detection:** Flag quando ≥80% das fechadas = score máximo
  - **Sondagem adaptativa:** 3-5 triggers priorizados (inter-dim > intra-dim > gaming > hesitação > respostas rasas), fallback genérico emocional
  - **Classificação de perfis:** SAGE/LEARNER/DEVELOPING/FRAGILE, FORTIFIED/SOLID/VULNERABLE/CRITICAL, MASTERY FIT/GOOD FIT/PARTIAL FIT/MISMATCH, PROFESSIONAL TRADER/COMMITTED LEARNER/DEVELOPING TRADER/AT RISK
  - **State machine onboarding:** lead → pre_assessment → ai_assessed → probing → probing_complete → mentor_validated → active

  ### Decisões
  - DEC-021: Stage de experiência diagnosticado por IA (não por fórmula aritmética)
  - DEC-022: Marco zero é tábula rasa — gates_met=0, sem métricas históricas declaradas

  ### Testes
  - 128 novos testes (5 suites): assessmentScoring, profileClassifier, questionRandomizer, incongruenceDetector, probingTriggers
  ```

### App.jsx (APLICAR APENAS NA ENTREGA FINAL)
- Adicionar import: `import StudentOnboardingPage from './pages/StudentOnboardingPage';`
- Adicionar rota: `<Route path="/onboarding/:studentId" element={<StudentOnboardingPage />} />`

### functions/index.js (APLICAR APENAS NA ENTREGA FINAL)
- Adicionar exports:
  ```javascript
  exports.classifyOpenResponse = require('./assessment/classifyOpenResponse');
  exports.generateProbingQuestions = require('./assessment/generateProbingQuestions');
  exports.analyzeProbingResponse = require('./assessment/analyzeProbingResponse');
  exports.generateAssessmentReport = require('./assessment/generateAssessmentReport');
  ```

### firestore.rules (APLICAR APENAS NA ENTREGA FINAL)
- Adicionar regras para assessment:
  ```
  // Assessment — Student Onboarding (CHUNK-09)
  match /students/{studentId}/assessment/{docId} {
    allow read: if isAuthenticated();
    allow write: if isMentor() || (isStudent(studentId) && docId == 'questionnaire');
  }
  match /students/{studentId}/assessment/{docId}/{subcol}/{subId} {
    allow read: if isAuthenticated();
    allow write: if isMentor();
  }
  ```
  Nota: Aluno só pode escrever no doc `questionnaire` (suas respostas). 
  `probing` responses são gravadas pelo aluno mas via CF callable (não escrita direta).
  `initial_assessment` e subcollections de tracking: apenas mentor.

### package.json
- Nenhuma dependência nova nesta entrega

### functions/package.json (APLICAR APENAS NA ENTREGA FINAL)
- Adicionar: `"@anthropic-ai/sdk": "^0.39.0"`

---

## ARQUIVOS ENTREGUES NESTA PARCIAL

### Utils (lógica pura — 6 arquivos)
```
src/utils/assessmentQuestions.js    — Catálogo 34 perguntas (single source of truth)
src/utils/assessmentScoring.js      — Motor de scoring 4D + composite
src/utils/profileClassifier.js      — Classificação scores → labels
src/utils/questionRandomizer.js     — Randomização com persistência
src/utils/incongruenceDetector.js   — Detecção intra/inter-dimensional + gaming
src/utils/probingTriggers.js        — Seleção de triggers para sondagem
```

### Testes (5 suites — 128 testes)
```
src/__tests__/utils/assessmentScoring.test.js
src/__tests__/utils/profileClassifier.test.js
src/__tests__/utils/questionRandomizer.test.js
src/__tests__/utils/incongruenceDetector.test.js
src/__tests__/utils/probingTriggers.test.js
```

## PENDENTE PARA PRÓXIMA ENTREGA

- [ ] `src/utils/stageMapper.js` — Prepara payload de evidências EXP para CF (DEC-021)
- [ ] 3 hooks: useAssessment, useQuestionnaire, useProbing
- [ ] 4 Cloud Functions: classifyOpenResponse, generateProbingQuestions, analyzeProbingResponse, generateAssessmentReport
- [ ] 12 componentes React (QuestionnaireFlow, MentorValidation, TraderProfileCard, etc.)
- [ ] StudentOnboardingPage.jsx
- [ ] DebugBadge em todos os componentes
- [ ] Integração completa + testes de integração
