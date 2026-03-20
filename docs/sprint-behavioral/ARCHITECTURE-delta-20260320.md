# ARCHITECTURE.md — Delta Sessao 20/03/2026

## Secao 5 (Decision Log) — Adicionar:

### DEC-013: Operacional 5D com emotion_control herdado (20/03/2026)
**Problema:** Estrutura Firestore do assessment operacional (4.3) definia 4 sub-dimensoes (decision_mode, timeframe, risk_attitude, emotion_control herdado) mas as formulas de scoring (6.3) usavam taxonomia diferente derivada das perguntas (decision_mode, timeframe, strategy_fit, tracking). Divergencia impediria implementacao coerente.
**Decisao:** Operacional passa a ter 5 sub-dimensoes: decision_mode (OPE-01+05+06), timeframe (OPE-02), strategy_fit (OPE-03), tracking (OPE-04), emotion_control (herdado do emotionalScore). Formula ponderada: (decision_mode x 0.25) + (timeframe x 0.20) + (strategy_fit x 0.20) + (tracking x 0.15) + (emotion_control x 0.20). O cross-link garante que fragilidade emocional impacte o score operacional — aluno com emocional fragil nao pode ter operacional excelente. Contribuicao efetiva do emocional no composite: ~0.29 (direta 0.25 + indireta via operacional 0.04).
**Impacto:** assessmentScoring.js (formula operacional), Firestore initial_assessment.operational (5 sub-dims em vez de 4). emotion_control nao tem override pelo mentor na dimensao operacional — derivado automaticamente.

### DEC-014: Cross-check inter-dimensional (20/03/2026)
**Problema:** Cross-check do assessment so comparava fechadas vs abertas dentro da mesma dimensao. Aluno pode inflar financeiro/operacional ("uso stop sempre") enquanto respostas emocionais revelam fragilidade.
**Decisao:** 5 flags inter-dimensionais iniciais: STOP_CLAIM_VS_BEHAVIOR (FIN-03 vs EMO-07), PROCESS_VS_IMPULSE (OPE-01 vs EMO-05), SIZING_VS_REVENGE (FIN-01 vs EMO-06), DISCIPLINE_VS_LOCUS (FIN-03 vs EMO-09), JOURNAL_VS_AWARENESS (OPE-04 vs EMO-03). Executados apos coleta completa. Extensivel via incongruenceDetector.js.
**Impacto:** incongruenceDetector.js (novo), Firestore questionnaire.incongruenceFlags (novo campo inter-dim com suggestedInvestigation). Zero impacto em collections existentes.

### DEC-015: Randomizacao via persistencia (20/03/2026)
**Problema:** BRIEF original sugeria Math.random() com seed estavel, mas JS nao suporta seed nativo. Aluno que retoma questionario veria ordem diferente.
**Decisao:** Na primeira renderizacao de cada pergunta, gerar ordem aleatoria e salvar optionOrder no Firestore imediatamente. Se aluno retomar, usar ordem salva. PRNG seeded (mulberry32) como fallback offline.
**Impacto:** questionRandomizer.js (novo), useQuestionnaire.js (persistencia de optionOrder). Zero impacto em collections existentes.

### DEC-016: Sondagem adaptativa pos-questionario (20/03/2026)
**Problema:** Flags de incongruencia eram registrados como dados frios para o mentor investigar dias depois. O aluno ja nao esta no contexto emocional quando o mentor sonda.
**Decisao:** Apos questionario base (34 perguntas), IA analisa respostas e gera 3-5 perguntas de sondagem adaptativa. Timing: pos-questionario, pre-mentor (estagio 1.5). Transparente: "Baseado nas suas respostas, gostariamos de aprofundar alguns pontos." Triggers: incongruencia inter-dim (delta >= 30), incongruencia intra-dim (delta >= 25), hesitacao suspeita (responseTime < 5s), gaming suspect, respostas rasas (charCount < 80). Respostas de sondagem NAO alteram scores base — geram probingAnalysis qualitativo para o mentor. State machine: lead -> pre_assessment -> ai_assessed -> probing -> probing_complete -> mentor_validated -> active.
**Impacto:** Novo doc Firestore students/{id}/assessment/probing. Novas CFs: generateProbingQuestions, analyzeProbingResponse. Novos componentes: ProbingQuestionsFlow.jsx, ProbingIntro.jsx. Novo hook: useProbing.js. Novo util: probingTriggers.js. assessmentMethod bumped para three_stage_v1.
