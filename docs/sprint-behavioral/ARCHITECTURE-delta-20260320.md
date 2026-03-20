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

### DEC-017: Scoring mensal 3 camadas com pesos variaveis (20/03/2026)
**Problema:** Nao existia mecanismo para acompanhar evolucao 4D do aluno apos o marco zero. Reviews mensais eram notas informais sem estrutura.
**Decisao:** Scoring mensal em 3 camadas: (1) score_trades automatico derivado de metricas reais dos trades no periodo, (2) mentor_delta ajuste empirico por dimensao sobre o score_trades, (3) score_final blendado com pesos variaveis por dimensao conforme confiabilidade das metricas automaticas — Financeiro 0.70/0.30, Operacional 0.50/0.50, Emocional 0.30/0.70, Experiencia 0.80/0.20. Clamp [0, 100] com delta original preservado para auditoria.
**Impacto:** Rewrite de monthly_reviews no Firestore (3 camadas com metrics_used, deltas, final_scores). Novos utils: tradeScoreMapper.js, evolutionCalculator.js. Nova CF: calculateMonthlyScores. Novo componente: MonthlyReviewForm.jsx (reformulado). Reads de CHUNK-04 (trades), CHUNK-05 (compliance), CHUNK-06 (emotional) — sem modificacao.

### DEC-018: Mentor aplica delta no review mensal (20/03/2026)
**Problema:** Mentor precisava atribuir score absoluto 0-100 por dimensao a cada review, duplicando trabalho que o sistema ja faz via metricas automaticas.
**Decisao:** Mentor aplica delta (ex: +5, -3) sobre o score_trades calculado automaticamente, nao score absoluto. Reduz carga cognitiva — mentor reage ao dado, nao cria do zero. Preserva auditabilidade: sempre se sabe quanto veio dos trades (score_trades) e quanto do sentimento do mentor (delta).
**Impacto:** MonthlyReviewForm.jsx (inputs de delta por dimensao em vez de scores absolutos). evolutionCalculator.js (blending formula).

### DEC-019: Gates de progressao hibridos (20/03/2026)
**Problema:** Progressao de stage (1->2->3->4->5) nao tinha mecanismo definido — nao estava claro se era automatica, manual, ou hibrida.
**Decisao:** Gates hardcoded em progressionGates.js (versionados com o codigo). CF evaluateProgression calcula elegibilidade automaticamente contra gates definidos. Mentor confirma/veta promocao com 4 opcoes: PROMOTE, HOLD, OVERRIDE_PROMOTE (promover sem todos os gates, com justificativa), OVERRIDE_HOLD (reter com todos os gates, com justificativa). Decisao registrada em progression_log com snapshot de elegibilidade.
**Impacto:** progressionGates.js (novo — definicao de gates por stage com metricas, thresholds, sustainedPeriod). Nova CF: evaluateProgression. Novos componentes: ProgressionGateStatus.jsx, PromotionDecisionModal.jsx. Novo Firestore: progression_log subcollection.

### DEC-020: Regressao de stage nunca automatica (20/03/2026)
**Problema:** Aluno em Stage 3 que passa meses ruins poderia ser rebaixado automaticamente, causando desmotivacao desproporcional a meses atipicos.
**Decisao:** Se aluno falha gates do stage anterior por 2 meses -> REGRESSION_WARNING (alerta ao mentor). 3 meses -> REGRESSION_ELIGIBLE (elegivel para rebaixamento). Regressao nunca eh automatica — mentor decide com justificativa. Mentor pode: rebaixar, manter com plano de acao, ou ignorar alerta.
**Impacto:** progressionGates.js (logica de regressao). evaluateProgression CF (detecta regression conditions). progression_log (registra warnings e decisoes).

## Secao 9 (Chunks) — Atualizar:

### CHUNK-09: Escopo expandido
- **Antes:** Student Onboarding & Baseline (assessment inicial)
- **Agora:** Student Onboarding & Evolution Tracking (assessment inicial + reviews mensais 3 camadas + gates de progressao + mentor journal + timeline 4D)
- **Reads adicionais:** CHUNK-04 (trades), CHUNK-05 (compliance fields), CHUNK-06 (emotional fields/TILT/REVENGE) — somente leitura
