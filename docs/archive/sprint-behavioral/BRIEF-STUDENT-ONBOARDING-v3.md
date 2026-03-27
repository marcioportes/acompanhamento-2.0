# BRIEF-STUDENT-ONBOARDING.md
## Briefing de Sessão — Frente: Setup Inicial do Aluno
### Versão 3.2 — 20/03/2026 (Consolidado: Assessment 3 estágios + Evolution Tracking + Gates de Progressão)

---

## 1. CONTEXTO PARA A SESSÃO

Você está trabalhando no **Acompanhamento 2.0** — plataforma de mentoria de trading comportamental em React/Vite + Firebase/Firestore + Cloud Functions, deploy em Vercel.

Esta frente implementa o **ciclo completo de onboarding e acompanhamento evolutivo do aluno**: (1) questionário base autoaplicável com classificação por IA, (1.5) sondagem adaptativa gerada pela IA baseada em incongruências e hesitações, (2) validação pelo mentor em entrevista curta, (3) acompanhamento evolutivo 4D com reviews mensais, gates de progressão e timeline longitudinal. O objetivo é estabelecer o **marco zero** e acompanhar a evolução emocional e comportamental ao longo do tempo.

**Premissa de design:** O aluno tende a inflar scores operacionais e financeiros ("uso stop sempre", "processo disciplinado"). O emocional é a dimensão mais difícil de fazer gaming — especialmente nas abertas projetivas. O sistema deve cross-checar declarações operacionais/financeiras contra respostas emocionais para detectar inconsistências. O operacional declarado no assessment será confrontado com dados reais do journal após 30 dias; o emocional não tem equivalente hard — depende da qualidade do questionário + validação do mentor.

**Referência principal:** `trader_evolution_framework.md` (entregar junto)

---

## 2. CHUNK CHECK-OUT

| Chunk | Status | Permissão |
|-------|--------|-----------|
| **CHUNK-09 (Student Onboarding)** | LOCKED | ✅ CRIAR arquivos listados |
| CHUNK-02 (Student Management) | READ-ONLY | ⚠️ LER estrutura de `students`, NÃO MODIFICAR |
| CHUNK-04 (Trade Ledger) | READ-ONLY | ⚠️ LER trades para calcular métricas mensais (tradeScoreMapper), NÃO MODIFICAR |
| CHUNK-05 (Compliance) | READ-ONLY | ⚠️ LER compliance fields dos trades, NÃO MODIFICAR |
| CHUNK-06 (Emotional System) | READ-ONLY | ⚠️ LER emotional fields/TILT/REVENGE, NÃO MODIFICAR |
| Todos os demais | BLOQUEADO | ❌ NÃO TOCAR |

**Branch:** `feature/student-onboarding`

---

## 3. ARQUITETURA: ASSESSMENT EM 3 ESTÁGIOS

O assessment opera em 3 estágios sequenciais:
1. **Questionário base** (aluno sozinho, 34 perguntas fixas)
2. **Sondagem adaptativa** (IA gera 3-5 perguntas baseadas em incongruências e hesitações detectadas)
3. **Validação pelo mentor** (entrevista 20-30 min com relatório completo)

### 3.1 Estágio 1 — Questionário Base (Aluno)

O aluno responde sozinho, sem mentor. Mix de perguntas fechadas e abertas.

**Perguntas fechadas (5 alternativas):**
- Cada alternativa tem peso (score) oculto mapeado no backend
- **CRÍTICO: Ordem das alternativas RANDOMIZADA a cada apresentação**
- O mapeamento alternativa→score NUNCA é exposto ao frontend
- O array de opções é embaralhado no momento de renderizar
- **Implementação da randomização (2 abordagens aceitáveis):**
  - **Opção A (PRNG seeded):** Usar um gerador pseudo-aleatório com seed determinística (ex: hash de `sessionId + questionId`). Garante mesma ordem se aluno sair e voltar na mesma sessão. Exemplo: mulberry32 como PRNG, Fisher-Yates para shuffle.
  - **Opção B (persistência):** Na primeira renderização de cada pergunta, gerar ordem aleatória com `Math.random()`, salvar `optionOrder` no Firestore imediatamente. Se aluno retomar, usar a ordem salva. Mais simples, mais robusto para edge cases (ex: aluno troca de device).
  - **Recomendação:** Opção B é preferível para o caso de uso real. Opção A pode ser usada como fallback offline.
  - **NÃO usar:** `options.sort(() => Math.random() - 0.5)` sem persistência nem seed — produz ordem diferente a cada render.

**Perguntas abertas (texto livre):**
- Mínimo 50 caracteres para evitar respostas monossilábicas
- Classificadas por IA via Cloud Function callable (API Claude)
- IA retorna: score (0-100), classificação (ex: A/B/C), justificativa, flags de incongruência
- Prompt da IA inclui: texto do aluno + pergunta + rubrica de scoring + respostas fechadas anteriores para cross-check
- **Nota sobre prompt da CF:** A sessão deve criar o prompt template inline em `classifyOpenResponse`. O prompt deve incluir: (1) persona (avaliador comportamental de traders), (2) rubrica de scoring por sub-dimensão com exemplos de cada faixa, (3) instruções de cross-check com respostas fechadas, (4) formato de resposta esperado (JSON com score, classification, justification, flags, confidence). Modelo: `claude-sonnet-4-20250514`.

**Cross-check automático — INTRA-dimensional (fechadas vs. abertas na mesma dimensão):**
- Se resposta fechada indica score 80+ mas aberta indica externalização → flag `CLOSED_VS_OPEN`
- Se todas as fechadas são consistentemente "melhores respostas" → flag `GAMING_SUSPECT`
- Flags visíveis apenas no relatório do mentor (Estágio 2)

**Cross-check automático — INTER-dimensional (entre dimensões diferentes):**

O aluno pode declarar processo impecável (financeiro/operacional) mas revelar fragilidade nas respostas emocionais. O sistema cruza respostas entre dimensões para detectar incongruências:

| Flag | Condição | Significado |
|------|----------|-------------|
| `STOP_CLAIM_VS_BEHAVIOR` | FIN-03 (stop usage) ≥ 72 **E** EMO-07 (stop discipline) ≤ 40 | Diz que usa stop mas admite mover/cancelar |
| `PROCESS_VS_IMPULSE` | OPE-01 (decision mode) ≥ 72 **E** EMO-05 (controle pós-loss) ≤ 30 | Diz ter processo sistemático mas age impulsivamente após perdas |
| `SIZING_VS_REVENGE` | FIN-01 (position sizing) ≥ 72 **E** EMO-06 (sequência de perdas) ≤ 28 | Diz ter sizing disciplinado mas escala após perdas |
| `DISCIPLINE_VS_LOCUS` | FIN-03 (stop usage) ≥ 72 **E** EMO-09 (atribuição de causa) ≤ 40 | Diz ser disciplinado mas externaliza culpa |
| `JOURNAL_VS_AWARENESS` | OPE-04 (tracking) ≥ 70 **E** EMO-03 (identificação de padrões) ≤ 30 | Diz manter journal completo mas não identifica padrões próprios |

**Regras de implementação:**
- Cross-checks inter-dimensionais são executados APÓS todas as respostas serem coletadas (não em tempo real)
- Implementar em `incongruenceDetector.js` separado do scoring
- Flags geram sugestões automáticas de perguntas de investigação para o mentor no Estágio 2
- Extensível: novos cross-checks podem ser adicionados como regras no detector sem mudar o fluxo

### 3.2 Estágio 1.5 — Sondagem Adaptativa (IA)

**DECISÃO DE DESIGN (DEC-016, 20/03/2026):** Após o questionário base (34 perguntas), a IA analisa todas as respostas, identifica incongruências e hesitações, e gera 3-5 perguntas de aprofundamento personalizadas. O objetivo é sondar as inconsistências enquanto o aluno ainda está no contexto, produzindo material mais rico para o mentor do que uma flag fria.

**Timing:** Pós-questionário base, pré-mentor. O aluno completa as 34 perguntas, a IA processa, e apresenta as sondagens como uma fase natural de aprofundamento. Não interfere no fluxo base (que é estático e testável).

**Transparência:** O aluno vê a mensagem: *"Baseado nas suas respostas, gostaríamos de aprofundar alguns pontos."* Sabe que é personalizado mas não sabe quais respostas dispararam. Isso modela o comportamento de auto-investigação que a mentoria quer cultivar.

**Triggers para geração de sondagem:**
1. **Incongruência inter-dimensional** (delta ≥ 30 entre dimensões) — prioridade máxima
2. **Incongruência intra-dimensional** (fechada vs. aberta, delta ≥ 25) — prioridade alta
3. **Hesitação suspeita** (`responseTime` < 5s em pergunta introspectiva complexa — indica resposta sem reflexão) — prioridade média
4. **Gaming suspect** (todas as fechadas consistentemente = scores mais altos) — prioridade alta
5. **Respostas abertas rasas** (`charCount` < 80 em pergunta que pede descrição detalhada) — prioridade baixa

**Regras de geração:**
- **Mínimo 3, máximo 5 perguntas** de sondagem
- Priorizadas por: delta de incongruência (maior = mais urgente) → relevância emocional (priorizar sondagens que revelam o emocional)
- **Todas as perguntas de sondagem são abertas** (texto livre, mínimo 80 caracteres)
- Geradas via CF `generateProbingQuestions` que recebe: respostas completas + flags + responseTime data
- A IA gera: pergunta contextualizada + rubrica de classificação + qual flag está sendo investigada
- Se não houver flags suficientes (aluno consistente), gerar perguntas de aprofundamento genéricas sobre a dimensão emocional (nunca zero perguntas — o aluno não deve perceber que "passou sem flags")

**Exemplo de sondagem gerada:**

```
Flag detectada: STOP_CLAIM_VS_BEHAVIOR (FIN-03=95, EMO-07=20, delta=75)

Pergunta gerada pela IA:
"Você mencionou que usa stop em 100% dos trades e que também 
costuma cancelar o stop quando ele está perto de ser atingido. 
Me conte sobre a última vez que isso aconteceu — o que você 
estava pensando naquele momento?"

Rubrica: IA busca reconciliação honesta vs. racionalização.
- Se admite e reflete → ajustar FIN-03 score para baixo, manter EMO-07
- Se racionaliza ("era diferente, eu sabia que ia voltar") → reforça flag
- Se nega contradição → flag DEFENSIVE adicional
```

**Impacto no scoring:**
- As respostas de sondagem **NÃO alteram os scores calculados** do questionário base
- Elas geram: `probingAnalysis` com insights qualitativos para o mentor
- O mentor pode usar os insights para justificar overrides de score no Estágio 2
- Isso preserva a comparabilidade entre alunos (todos têm as mesmas 34 perguntas base)

### 3.3 Estágio 2 — Validação pelo Mentor (Entrevista 20-30 min)

Mentor recebe relatório pré-assessment:
- Scores propostos por dimensão e sub-dimensão
- Respostas do aluno (fechadas + abertas do questionário base)
- **Respostas de sondagem adaptativa + análise da IA** (quais flags motivaram cada pergunta, o que a resposta revelou)
- Justificativas da IA para cada classificação
- Flags de incongruência (intra E inter-dimensionais)
- Sugestões de perguntas de investigação adicionais baseadas nos flags restantes não resolvidos pela sondagem

Mentor pode:
- Confirmar score da IA (1 clique)
- Ajustar score com justificativa registrada
- Adicionar notas qualitativas por sub-dimensão

Sistema guarda: `score_ia`, `score_mentor`, `override_justification`, `mentor_notes`

---

## 4. FIRESTORE: ESTRUTURAS

### 4.1 Student Status (novo campo)

```javascript
// students/{studentId}
{
  onboardingStatus: "lead" | "pre_assessment" | "ai_assessed" | "probing" | "probing_complete" | "mentor_validated" | "active",
  // ... campos existentes ...
}
```

### 4.2 Questionário e Respostas

```javascript
// students/{studentId}/assessment/questionnaire
{
  startedAt: Timestamp,
  completedAt: Timestamp,
  responses: [
    {
      questionId: "EMO-01",
      dimension: "emotional",
      subDimension: "recognition",
      type: "closed",
      selectedOption: "opt-3",        // ID da opção selecionada
      optionScore: 75,                // score mapeado (backend only)
      optionOrder: ["opt-2","opt-5","opt-1","opt-3","opt-4"],  // ordem apresentada (persistida)
      responseTime: 18                // segundos para responder
    },
    {
      questionId: "EMO-05",
      dimension: "emotional",
      subDimension: "locus",
      type: "open",
      text: "Meu pior trade foi quando...",
      charCount: 245,
      aiScore: 55,
      aiClassification: "Y",          // Locus Misto
      aiJustification: "Aluno alterna entre internalização e externalização...",
      aiConfidence: 0.78
    }
  ],
  incongruenceFlags: [
    // INTRA-dimensional (fechadas vs abertas na mesma dimensão)
    {
      type: "CLOSED_VS_OPEN",
      dimension: "emotional",
      closedScore: 82,
      openScore: 48,
      delta: 34,
      description: "Fechada indica reconhecimento rápido; aberta mostra externalização"
    },
    // INTER-dimensional (entre dimensões diferentes)
    {
      type: "STOP_CLAIM_VS_BEHAVIOR",
      sourceDimension: "financial",
      sourceQuestion: "FIN-03",
      sourceScore: 95,
      targetDimension: "emotional",
      targetQuestion: "EMO-07",
      targetScore: 20,
      delta: 75,
      description: "Declara usar stop 100% mas admite cancelar frequentemente",
      suggestedInvestigation: "Pergunte: 'Me conte sobre a última vez que seu trade atingiu o stop. O que aconteceu exatamente?'"
    }
  ],
  gamingSuspect: false,               // true se todas as fechadas = scores mais altos
  aiProcessedAt: Timestamp,
  aiModelVersion: "claude-sonnet-4-20250514"
}
```

### 4.2b Sondagem Adaptativa (novo documento)

```javascript
// students/{studentId}/assessment/probing
{
  generatedAt: Timestamp,
  completedAt: Timestamp,
  triggeredBy: [                          // flags que motivaram a geração
    { type: "STOP_CLAIM_VS_BEHAVIOR", delta: 75, priority: 1 },
    { type: "GAMING_SUSPECT", priority: 2 },
    { type: "HESITATION", questionId: "EMO-01", responseTime: 3, priority: 3 }
  ],
  questions: [
    {
      probingId: "PROBE-01",
      triggeredByFlag: "STOP_CLAIM_VS_BEHAVIOR",
      sourceQuestions: ["FIN-03", "EMO-07"],  // perguntas que geraram a incongruência
      text: "Você mencionou que usa stop em 100% dos trades...",
      rubric: "IA busca reconciliação honesta vs. racionalização",
      response: {
        text: "Na verdade, quando o mercado está volátil...",
        charCount: 312,
        responseTime: 67,                   // segundos
        aiAnalysis: {
          finding: "Aluno reconhece comportamento mas racionaliza com contexto de mercado",
          flagResolution: "reinforced",     // "resolved" | "reinforced" | "inconclusive"
          emotionalInsight: "Padrão de loss aversion manifesto como 'exceção justificada'",
          confidence: 0.82
        }
      }
    }
  ],
  summary: {
    totalFlags: 4,
    flagsResolved: 1,                     // aluno esclareceu satisfatoriamente
    flagsReinforced: 2,                   // sondagem confirmou a incongruência
    flagsInconclusive: 1,                 // precisa investigação do mentor
    overallAssessment: "Padrão consistente de inflação no operacional/financeiro. Emocional revela loss aversion não reconhecida e externalização parcial.",
    mentorFocusAreas: ["Stop discipline real vs. declarada", "Locus de controle sob pressão"]
  },
  aiModelVersion: "claude-sonnet-4-20250514"
}
```

### 4.3 Assessment Final (marco zero)

```javascript
// students/{studentId}/assessment/initial_assessment
{
  timestamp: Timestamp,
  interviewer: string,                    // mentor que validou
  assessmentMethod: "three_stage_v1",      // v1 = base + probing adaptativo + mentor validation
  
  emotional: {
    recognition: { aiScore: 75, mentorScore: 70, classification: "B", notes: "" },
    regulation: { aiScore: 60, mentorScore: 65, classification: "2", notes: "" },
    locus: { aiScore: 55, mentorScore: 50, classification: "Y", notes: "" },
    score: 62,                            // média das 3 sub-dimensões (mentor scores)
    profile: "DEVELOPING",                // SAGE (85+) | LEARNER (65-84) | DEVELOPING (50-64) | FRAGILE (<50)
    notes: ""
  },
  
  financial: {
    discipline: { aiScore: 70, mentorScore: 72, classification: "Beta", notes: "" },
    loss_management: { aiScore: 65, mentorScore: 60, classification: "3", notes: "" },
    profit_taking: { aiScore: 55, mentorScore: 55, classification: "M", notes: "" },
    score: 64,                            // (discipline×0.4 + loss_mgmt×0.4 + profit×0.2) mentor scores
    status: "VULNERABLE",                 // FORTIFIED (85+) | SOLID (70-84) | VULNERABLE (50-69) | CRITICAL (<50)
    last_20_trades_metrics: {             // null se aluno não forneceu dados
      win_rate: null,
      avg_winner: null,
      avg_loser: null,
      max_drawdown: null,
      max_consecutive_losses: null,
      stop_usage_rate: null               // % de trades com stop — NOVO (motivado por caso real)
    },
    notes: ""
  },
  
  operational: {
    decision_mode: { aiScore: 72, mentorScore: 75, classification: "D", notes: "" },
    timeframe: { aiScore: 65, mentorScore: 65, classification: "DAY", notes: "" },
    strategy_fit: { aiScore: 70, mentorScore: 68, classification: "Consistent", notes: "" },
    tracking: { aiScore: 60, mentorScore: 62, classification: "Basic+", notes: "" },
    emotion_control: 62,                  // HERDADO da dim. emocional (= emotional.score)
    fit_score: 67,                        // fórmula ponderada (ver seção 6.3)
    fit_label: "PARTIAL FIT",             // MASTERY FIT (85+) | GOOD FIT (70-84) | PARTIAL FIT (50-69) | MISMATCH (<50)
    mismatch_flags: ["Day trading + DEVELOPING emotional"],
    notes: ""
  },
  
  experience: {
    months_trading: 10,
    stage: 2,
    gates_met: 3,                         // de 8 gates do próximo stage
    gates_total: 8,
    stage_score: 27.5,                    // 20 + (3/8 × 20)
    progression_likelihood: 45,
    key_blockers: ["Estratégia inconsistente", "Stop ausente"],
    notes: ""
  },
  
  composite_score: 55.4,                  // (E×0.25)+(F×0.25)+(O×0.20)+(X×0.30)
  composite_label: "DEVELOPING TRADER",   // PROFESSIONAL (80+) | COMMITTED (65-79) | DEVELOPING (40-64) | AT RISK (<40)
  profile_name: "Developing Day Trader",  // gerado pela IA baseado no perfil completo
  
  development_priorities: [
    { rank: 1, priority: "Implementar stop loss em 100% dos trades", dimension: "financial", months: 1 },
    { rank: 2, priority: "Reduzir frequência para max 20 trades/dia", dimension: "operational", months: 2 },
    { rank: 3, priority: "Journal emocional diário", dimension: "emotional", months: 3 }
  ],
  
  next_review_date: Timestamp,            // +30 dias
  
  // Calibração IA vs Mentor
  calibration: {
    emotional_delta: -3,                  // mentor - IA (negativo = mentor mais conservador)
    financial_delta: -2,
    operational_delta: +3,
    experience_delta: 0,
    average_delta: -0.5
  },
  
  // Cross-checks inter-dimensionais detectados
  inter_dimensional_flags: [
    {
      type: "STOP_CLAIM_VS_BEHAVIOR",
      sourceDimension: "financial",
      targetDimension: "emotional",
      delta: 75,
      mentorResolution: "confirmed",      // "confirmed" | "dismissed" | "adjusted"
      mentorNotes: "Aluno admitiu na entrevista que move stop ~30% das vezes"
    }
  ]
}
```

### 4.4 Review Mensal — 3 Camadas (DEC-017, DEC-018)

O review mensal é o coração do acompanhamento evolutivo. Opera em 3 camadas:
1. **score_trades:** Calculado automaticamente a partir dos trades do período
2. **mentor_delta:** Ajuste empírico do mentor sobre o score_trades (delta, não absoluto)
3. **score_final:** Blending ponderado por dimensão (pesos variáveis conforme confiabilidade das métricas)

**Pesos por dimensão:**

| Dimensão | Peso score_trades | Peso score_mentor | Justificativa |
|---|---|---|---|
| Financeiro | 0.70 | 0.30 | Métricas diretas: stop rate, drawdown, RO%, payoff |
| Operacional | 0.50 | 0.50 | Proxies parciais: aderência ao plano, frequência, journal |
| Emocional | 0.30 | 0.70 | Proxies indiretos: TILT/revenge, entropy, padrões pós-loss |
| Experiência | 0.80 | 0.20 | Gates objetivos: métricas cumpridas vs exigidas |

**Fórmula:**
```
score_mentor_abs = clamp(score_trades + mentor_delta, 0, 100)
score_final = clamp((score_trades × peso_trades) + (score_mentor_abs × peso_mentor), 0, 100)
```

**Nota sobre clamp:** Se mentor_delta faz o score estourar 100, o delta original é preservado para auditoria mas o score_final é clampado. Mentor pode ver que seu ajuste foi parcialmente absorvido.

```javascript
// students/{studentId}/assessment/ongoing_tracking/monthly_reviews/{YYYY-MM}
{
  period: "2026-04",                      // mês de referência
  reviewDate: Timestamp,                  // quando o mentor fez o review
  reviewedBy: string,                     // mentor

  // Camada 1: scores automáticos (calculados a partir dos trades do período)
  trades_scores: {
    emotional: {
      recognition: 58, regulation: 62, locus: 55,
      score: 58,
      metrics_used: {
        emotionVariety: 0.72,             // Shannon entropy
        tiltFrequency: 1,
        revengeFrequency: 0,
        postLossAvgInterval: 22,          // minutos
        sizingAfterLoss: "maintains"
      }
    },
    financial: {
      discipline: 74, loss_management: 68, profit_taking: 61,
      score: 69,
      metrics_used: {
        stopUsageRate: 0.85,
        avgRiskPercent: 1.2,
        maxDrawdown: 0.07,
        payoff: 1.4,
        winRate: 0.52,
        evLeakage: 0.18
      }
    },
    operational: {
      decision_mode: 72, timeframe: 78, strategy_fit: 70, tracking: 65,
      emotion_control: 58,               // herdado de emotional.score
      score: 69,
      metrics_used: {
        complianceRate: 0.82,
        journalCompletionRate: 0.78,
        tradingHoursCompliance: 0.91
      }
    },
    experience: {
      stage: 2,
      gates_met: 5, gates_total: 8,
      score: 32.5,
      gates_detail: [
        { id: "G3-01", met: true, value: 0.52 },
        { id: "G3-02", met: true, value: 0.92 },
        { id: "G3-03", met: true, value: 0.07 },
        { id: "G3-04", met: true, value: 58 },
        { id: "G3-05", met: true, value: 0.82 },
        { id: "G3-06", met: false, value: 0.9, threshold: 1.0 },
        { id: "G3-07", met: false, value: 3, threshold: 2 },
        { id: "G3-08", met: false, value: 1, threshold: 0 }
      ]
    },
    composite: 55.8,
    tradesAnalyzed: 147,
    periodStart: Timestamp,
    periodEnd: Timestamp
  },

  // Camada 2: delta do mentor (empírico)
  mentor_deltas: {
    emotional: { delta: +5, notes: "Progresso real em reconhecimento após coaching na semana 3" },
    financial: { delta: 0, notes: "Métricas refletem a realidade" },
    operational: { delta: -3, notes: "Journal preenchido mas superficial" },
    experience: { delta: 0, notes: "" }
  },

  // Camada 3: scores finais (blendados)
  final_scores: {
    emotional: {
      score_trades: 58,
      score_mentor_abs: 63,              // 58 + 5 = 63
      score_final: 62,                   // (58 × 0.30) + (63 × 0.70) = 61.5 → 62
      weight_trades: 0.30,
      weight_mentor: 0.70
    },
    financial: {
      score_trades: 69,
      score_mentor_abs: 69,
      score_final: 69,
      weight_trades: 0.70,
      weight_mentor: 0.30
    },
    operational: {
      score_trades: 69,
      score_mentor_abs: 66,              // 69 + (-3) = 66
      score_final: 68,                   // (69 × 0.50) + (66 × 0.50) = 67.5 → 68
      weight_trades: 0.50,
      weight_mentor: 0.50
    },
    experience: {
      score_trades: 32.5,
      score_mentor_abs: 32.5,
      score_final: 33,
      weight_trades: 0.80,
      weight_mentor: 0.20
    },
    composite: 53.2,                     // (E×0.25)+(F×0.25)+(O×0.20)+(X×0.30)
    composite_label: "DEVELOPING TRADER"
  },

  // Deltas
  delta_vs_previous: { emotional: +4, financial: +5, operational: -1, experience: +5.5, composite: +3.2 },
  delta_vs_baseline: { emotional: +0, financial: +5, operational: -1, experience: +5.5, composite: -2.2 },

  // Notas estruturadas por dimensão
  dimension_notes: {
    emotional: "Progresso em reconhecimento mas regulação frágil. Episódio TILT semana 2.",
    financial: "Stop discipline melhorando. Payoff ainda abaixo de 1.0 — ansiedade de saída.",
    operational: "Aderência boa. Journal precisa profundidade.",
    experience: "3 gates faltando para Stage 3. Payoff e TILT são bloqueios."
  },

  milestones: ["Stop usage >85%", "Zero revenge no período"],
  blockers: ["Payoff <1.0", "TILT frequency >2"],
  action_plan: "Foco 4 semanas: (1) trailing stop 50% trades, (2) pausa 30min após 2 losses consecutivos"
}
```

### 4.5 Mapeamento: Métricas de Trades → Scores 4D

Cada dimensão tem um conjunto de métricas dos trades que são convertidas em scores automáticos. As funções de mapeamento ficam em `tradeScoreMapper.js`.

**Financeiro (alta confiabilidade):**
```
discipline = f(stopUsageRate, avgRiskPercent vs plano, positionSizeConsistency)
loss_management = f(maxDrawdown, avgLoser vs RO$, maxConsecutiveLosses)
profit_taking = f(payoff, winRate contextual, evLeakage)
score = (discipline × 0.40) + (loss_management × 0.40) + (profit_taking × 0.20)
```

**Operacional (confiabilidade média):**
```
decision_mode = f(complianceRate, entryQuality)
timeframe = f(tradingHoursCompliance, avgHoldTime vs timeframe)
strategy_fit = f(tickerConcentration, strategyConsistency)
tracking = f(journalCompletionRate, feedbackEngagement)
emotion_control = emotionalScore (herdado)
score = (decision_mode × 0.25) + (timeframe × 0.20) + (strategy_fit × 0.20) + (tracking × 0.15) + (emotion_control × 0.20)
```

**Emocional (confiabilidade baixa — proxies indiretos):**
```
recognition = f(emotionVariety/Shannon entropy, emotionAccuracy vs resultado)
regulation = f(tiltFrequency, revengeFrequency, postLossInterval)
locus = f(stopComplianceTrend, sizingAfterLoss)
score = (recognition + regulation + locus) / 3
```

**Experiência (alta confiabilidade via gates):**
```
score = stageBase + (gates_met / gates_total) × 20
```

### 4.6 Progression Log

```javascript
// students/{studentId}/assessment/ongoing_tracking/progression_log/{timestamp}
{
  timestamp: Timestamp,
  action: "PROMOTE" | "HOLD" | "OVERRIDE_PROMOTE" | "OVERRIDE_HOLD" | "REGRESSION_WARNING" | "REGRESSION",
  fromStage: 2,
  toStage: 3,                            // null se HOLD
  mentor: string,

  eligibility: {
    gates_met: 8,
    gates_total: 8,
    sustained_months: 2,
    required_months: 2,
    eligible: true
  },

  justification: "Todos os gates cumpridos por 2 meses consecutivos.",

  // Para HOLD
  hold_reason: null,
  hold_action_plan: null,

  // Para OVERRIDE (promover sem gates ou reter com gates)
  override_gates_missing: null,          // ["G3-06"] se OVERRIDE_PROMOTE
  override_justification: null
}
```

### 4.7 Mentor Journal (notas livres entre reviews)

```javascript
// students/{studentId}/assessment/ongoing_tracking/mentor_journal/{timestamp}
{
  timestamp: Timestamp,
  mentor: string,
  type: "observation" | "intervention" | "concern" | "milestone",
  dimension: "emotional" | "financial" | "operational" | "experience" | "general",
  linkedTradeId: null,                   // opcional — trade que motivou a nota
  linkedPlanId: null,                    // opcional
  text: "Aluno enviou mensagem preocupado com drawdown de 6%. Boa consciência de risco mas tom ansioso.",
  tags: ["anxiety", "drawdown", "risk-awareness"],
  visibleToStudent: false                // mentor decide se aluno pode ver
}
```

### 4.8 Gates de Progressão (DEC-019, DEC-020)

Gates são definidos em `progressionGates.js` (hardcoded, versionados com o código). Avaliação híbrida: sistema calcula elegibilidade automática, mentor confirma/veta promoção.

**Fluxo:**
1. CF mensal calcula `gates_met` para o stage atual
2. Se `gates_met == gates_total` E `sustainedPeriod` cumprido → Status: `ELIGIBLE`
3. Mentor revisa: `PROMOTE` | `HOLD` | `OVERRIDE_PROMOTE` | `OVERRIDE_HOLD`
4. Decisão registrada em `progression_log`

**Regressão:** Se aluno em Stage 3 falha gates de Stage 2 por 2 meses → `REGRESSION_WARNING`. 3 meses → `REGRESSION_ELIGIBLE`. Regressão **nunca automática** — sempre via mentor.

**Gates por stage (referência):**

**Stage 1 → 2 (Fundamentals):** minMonths=1
- G2-01: journalCompletionRate ≥ 80%
- G2-02: stopUsageRate ≥ 70%
- G2-03: emotionRegistrationRate ≥ 70%
- G2-04: maxConsecutiveLosses ≤ 6
- G2-05: respeita limite diário do plano

**Stage 2 → 3 (Consistency):** minMonths=3, sustainedPeriod=2 meses
- G3-01: winRate ≥ 45%
- G3-02: stopUsageRate ≥ 90%
- G3-03: maxDrawdown ≤ 10%
- G3-04: emotionalScore ≥ 55
- G3-05: complianceRate ≥ 80%
- G3-06: payoff ≥ 1.0
- G3-07: tiltFrequency ≤ 2/mês
- G3-08: mesma estratégia no período

**Stage 3 → 4 (Proficiency):** minMonths=6, sustainedPeriod=3 meses
- G4-01: winRate ≥ 50%
- G4-02: payoff ≥ 1.5
- G4-03: maxDrawdown ≤ 8%
- G4-04: emotionalScore ≥ 65 (LEARNER+)
- G4-05: evLeakage ≤ 25%
- G4-06: zero TILT
- G4-07: zero REVENGE
- G4-08: stopUsageRate ≥ 98%

**Stage 4 → 5 (Mastery):** minMonths=12, sustainedPeriod=6 meses
- G5-01: compositeScore ≥ 80 (Professional)
- G5-02: ≥ 80% meses positivos no ano
- G5-03: Sharpe ≥ 1.0
- G5-04: emotionalScore ≥ 80 (SAGE)
- G5-05: ≥ 90% trades sem intervenção do mentor

---

## 5. CATÁLOGO DE PERGUNTAS

**Nota sobre scoring:** Algumas sub-dimensões são calculadas como média de múltiplas perguntas (ex: `recognition = média(EMO-01, EMO-02, EMO-03, aiScore(EMO-04))`), enquanto outras usam uma única pergunta como score direto (ex: `timeframe = OPE-02`, `profit_taking = FIN-04`). Isso é intencional — perguntas únicas como score direto são usadas quando a pergunta cobre a sub-dimensão inteira. A fórmula na seção 6 é a fonte da verdade.

### 5.1 Dimensão Emocional (12 perguntas: 8 fechadas + 4 abertas)

#### Reconhecimento Emocional (Fechadas: 3, Abertas: 1)

**EMO-01 [FECHADA] — Rapidez de reconhecimento:**
*"Quando você tem um trade perdedor significativo, quando você percebe que está emocionalmente afetado?"*
- Percebo imediatamente, antes mesmo de fechar o trade → **90**
- Percebo nos primeiros minutos, consigo nomear a emoção → **75**
- Percebo depois de algum tempo, geralmente no trade seguinte → **55**
- Geralmente só percebo horas depois, ao revisar o dia → **35**
- Raramente percebo; para mim é só o mercado sendo mercado → **15**

**EMO-02 [FECHADA] — Consciência de estado pré-trade:**
*"Antes de abrir um trade, com que frequência você checa conscientemente seu estado emocional?"*
- Sempre — faz parte do meu checklist → **90**
- Na maioria das vezes, especialmente após perdas → **72**
- Às vezes, quando lembro → **50**
- Raramente — foco nos gráficos, não em mim → **30**
- Nunca pensei nisso como algo relevante → **10**

**EMO-03 [FECHADA] — Identificação de padrões:**
*"Quantos padrões de erros recorrentes seus você consegue descrever com clareza?"*
- 4 ou mais, com detalhes e triggers específicos → **92**
- 3, consigo descrever bem → **75**
- 1-2, mas sem muita clareza → **50**
- Sei que erro mas não consigo definir padrões → **30**
- Não acho que tenho padrões de erro → **12**

**EMO-04 [ABERTA] — Pior trade:**
*"Descreva o que aconteceu no seu pior trade recente. O que causou a perda e como você reagiu nos primeiros minutos?"*
- IA busca: latência de reconhecimento, nomeação de emoção, externalização vs. internalização
- Cross-check com EMO-01

#### Regulação Emocional (Fechadas: 3, Abertas: 1)

**EMO-05 [FECHADA] — Controle pós-loss:**
*"Após uma perda significativa, o que você geralmente faz?"*
- Paro, analiso o trade, e só volto quando estou calmo → **88**
- Faço uma pausa curta e volto com mais cuidado → **70**
- Tento continuar normal mas percebo que opero diferente → **48**
- Fico ansioso e quero recuperar logo → **25**
- Aumento o tamanho para compensar a perda → **8**

**EMO-06 [FECHADA] — Sequência de perdas:**
*"Após 3 perdas consecutivas, qual é sua reação mais honesta?"*
- Paro no dia, sem exceção → **90**
- Reduzo tamanho e frequência → **72**
- Continuo mas com mais cautela → **50**
- Fico frustrado e quero provar que estava certo → **28**
- Entro maior na próxima para recuperar → **10**

**EMO-07 [FECHADA] — Stop loss discipline:**
*"Quando um trade atinge seu stop loss, o que acontece na maioria das vezes?"*
- Sou stopado automaticamente, sem intervenção → **92**
- Saio manualmente no nível do stop → **75**
- Às vezes movo o stop um pouco mais longe → **40**
- Frequentemente cancelo o stop quando está perto → **20**
- Não uso stop loss → **5**

**EMO-08 [ABERTA] — Comportamento sob pressão:**
*"Descreva o que acontece dentro da sua cabeça quando um trade está indo contra você e se aproxima do stop. Quais pensamentos aparecem?"*
- IA busca: regulação vs. impulsividade, aceitação vs. negação, mecanismos de coping
- Cross-check com EMO-05 e EMO-07

#### Locus de Controle (Fechadas: 2, Abertas: 2)

**EMO-09 [FECHADA] — Atribuição de causa:**
*"Quando você tem uma semana ruim de trading, a que você atribui?"*
- Erros meus de processo que posso corrigir → **90**
- Mix de erros meus e condições adversas → **65**
- Mercado estava difícil para minha estratégia → **40**
- Informações falsas ou manipulação do mercado → **20**
- Azar; não tinha como prever → **10**

**EMO-10 [FECHADA] — Confiança vs. overconfidence:**
*"Como você sabe quando está confiante demais?"*
- Tenho critérios objetivos (% de acerto, aderência ao plano) → **88**
- Quando percebo que estou ignorando sinais contrários → **68**
- Quando alguém (mentor/colega) me aponta → **45**
- Não consigo diferenciar bem — confio no meu feeling → **25**
- Nunca me considero confiante demais → **8**

**EMO-11 [ABERTA] — Externalização:**
*"Conte sobre um trade que deu errado recentemente. O que aconteceu e por que não funcionou?"*
- IA busca: linguagem de externalização vs. agency. "O mercado me pegou" vs. "Eu entrei sem setup"
- Cross-check com EMO-09

**EMO-12 [ABERTA] — Metacognição:**
*"Se eu observasse você operando por uma semana sem você saber, o que eu veria que você talvez não admita?"*
- IA busca: profundidade de auto-conhecimento, honestidade, blind spots reconhecidos
- Pergunta projetiva — dificulta gaming porque não tem "resposta certa" óbvia

### 5.2 Dimensão Financeira (8 perguntas: 5 fechadas + 3 abertas)

**FIN-01 [FECHADA] — Position sizing:**
*"Como você determina o tamanho de cada trade?"*
- Fórmula fixa baseada em % do capital e distância do stop → **90**
- % fixa do capital mas ajusto conforme convicção → **68**
- Tamanho relativamente fixo, não calculo por trade → **45**
- Vario bastante conforme a oportunidade → **25**
- Não tenho método definido → **10**

**FIN-02 [FECHADA] — Drawdown handling:**
*"Qual foi seu maior drawdown e quanto tempo levou para recuperar?"*
- <5% e recuperei em menos de 2 semanas → **90**
- 5-10% e recuperei em 1-2 meses → **70**
- 10-15% e levou 2-3 meses → **48**
- 15-25% e levou mais de 3 meses → **25**
- >25% e ainda não recuperei completamente → **10**

**FIN-03 [FECHADA] — Stop loss usage:**
*"Em que porcentagem dos seus trades você usa stop loss?"*
- 100% — é automático, faz parte do setup → **95**
- 80-99% — raramente esqueço → **72**
- 50-80% — depende do trade → **40**
- Menos de 50% → **18**
- Não uso stop loss → **5**

**FIN-04 [FECHADA] — Profit taking:**
*"Quando um trade está positivo, como você decide sair?"*
- Target pré-definido baseado em análise técnica → **85**
- Trailing stop com regras claras → **80**
- Mix de target e feeling → **55**
- Quando fico satisfeito com o lucro → **35**
- Quando fico com medo de devolver → **15**

**FIN-05 [FECHADA] — Risk/reward:**
*"Qual é a relação risco/retorno típica dos seus trades?"*
- Mínimo 1:2, frequentemente melhor → **88**
- Geralmente 1:1.5 → **65**
- Aproximadamente 1:1 → **42**
- Não calculo, mas sei que perco mais quando perco → **22**
- Não sei responder → **8**

**FIN-06 [ABERTA] — Violação de sizing:**
*"Descreva a última vez que você violou suas regras de tamanho de posição. O que causou e o que aconteceu?"*
- IA busca: trigger (FOMO, revenge, overconfidence), consequência, aprendizado
- Cross-check com FIN-01

**FIN-07 [ABERTA] — Pior drawdown:**
*"Conte em detalhe sobre seu pior período (drawdown). Como começou, o que você fez, e como parou?"*
- IA busca: decisão deliberada vs. acidental, reflexão honesta, agency
- Cross-check com FIN-02

**FIN-08 [ABERTA] — Relação com perdas:**
*"Complete a frase: 'Para mim, tomar um loss é...'"*
- IA busca: aceitação ("custo do negócio") vs. aversão ("inaceitável") vs. negação ("evitável")
- Pergunta projetiva — formato de completar frase reduz racionalização

### 5.3 Dimensão Operacional (8 perguntas: 5 fechadas + 3 abertas)

**OPE-01 [FECHADA] — Decision mode:**
*"Como você identifica uma oportunidade de trade?"*
- Checklist objetivo + sinais técnicos confirmados → **90**
- Framework técnico com ajustes por contexto → **72**
- Padrões gráficos que reconheço + confirmação de indicadores → **55**
- Mix de análise e intuição → **38**
- Feeling baseado na experiência → **15**

**OPE-02 [FECHADA] — Timeframe fit:**
*"Seu timeframe de operação combina com sua disponibilidade real de tempo?"*
- Perfeitamente — opero nos horários ideais para meu timeframe → **88**
- Bem — consigo acompanhar a maioria do tempo → **72**
- Razoável — às vezes perco oportunidades por não estar disponível → **50**
- Mal — frequentemente opero em momentos que deveria estar fazendo outra coisa → **30**
- Péssimo — meu timeframe não combina com minha vida → **12**

**OPE-03 [FECHADA] — Strategy consistency:**
*"Há quanto tempo você opera com a mesma estratégia principal?"*
- Mais de 12 meses sem mudança fundamental → **92**
- 6-12 meses, com ajustes baseados em dados → **75**
- 3-6 meses, ainda refinando → **55**
- 1-3 meses, mudei recentemente → **30**
- Mudo frequentemente, ainda buscando o que funciona → **12**

**OPE-04 [FECHADA] — Journal/tracking:**
*"O que contém seu diário de trading?"*
- Dados completos + emoções + análise pós-trade + screenshots → **90**
- Dados básicos + emoções + algumas análises → **70**
- Dados básicos (entrada, saída, resultado) → **45**
- Registro esporádico, sem consistência → **22**
- Não mantenho diário → **8**

**OPE-05 [FECHADA] — Pre-trade routine:**
*"Qual é seu processo antes de abrir a plataforma?"*
- Rotina estruturada: análise de mercado, checklist, estado emocional → **90**
- Dou uma olhada nos mercados e vejo se tem oportunidade → **55**
- Abro a plataforma e começo a operar → **20**

**OPE-06 [ABERTA] — Processo completo:**
*"Descreva passo a passo o que acontece desde o momento que você identifica uma oportunidade até clicar para entrar no trade."*
- IA busca: systematic vs. discretionary vs. intuitive; presença de checklist; hesitação
- Cross-check com OPE-01

**OPE-07 [ABERTA] — Adaptação:**
*"Quando sua estratégia passa por um período ruim (2-3 semanas sem resultado), o que você faz?"*
- IA busca: resiliência vs. strategy-hopping; uso de dados vs. reação emocional
- Cross-check com OPE-03

**OPE-08 [ABERTA] — Limitação operacional:**
*"Qual é a coisa que mais atrapalha seu trading no dia a dia? Não o mercado — algo sobre VOCÊ ou sua rotina."*
- IA busca: auto-consciência, honestidade, capacidade de identificar friction points

### 5.4 Dimensão Experiência (6 perguntas: 4 fechadas + 2 abertas)

**EXP-01 [FECHADA] — Tempo de experiência:**
*"Há quanto tempo você opera com dinheiro real?"*
- Mais de 5 anos → **85**
- 2-5 anos → **65**
- 1-2 anos → **45**
- 6-12 meses → **28**
- Menos de 6 meses → **12**

**EXP-02 [FECHADA] — Strategy changes:**
*"Quantas vezes você mudou sua estratégia principal no último ano?"*
- 0 — mesma estratégia, apenas refinamentos → **90**
- 1 vez, por motivo justificado → **72**
- 2-3 vezes → **45**
- 4+ vezes → **22**
- Não consigo definir uma "estratégia principal" → **8**

**EXP-03 [FECHADA] — Erro identification:**
*"Quantos padrões de erro recorrentes seus você consegue listar, com trigger e solução?"*
- 4+ com detalhes, triggers, e mecanismos de prevenção → **90**
- 3, consigo descrever trigger e solução → **72**
- 1-2, identifico mas não tenho solução clara → **45**
- Sei que erro mas não consigo categorizar → **22**
- Não acho que tenho erros recorrentes → **8**

**EXP-04 [FECHADA] — Métricas avançadas:**
*"Quais dessas métricas você acompanha regularmente?"*
- Win rate, RR, drawdown, Sharpe, MFE/MAE → **92**
- Win rate, RR, drawdown → **68**
- Win rate e P&L → **42**
- Só P&L total → **20**
- Não acompanho métricas → **5**

**EXP-05 [ABERTA] — Evolução:**
*"Como seu trading mudou nos últimos 6 meses? O que você faz diferente hoje?"*
- IA busca: consciência de evolução, mudanças concretas vs. vagas, direction of change

**EXP-06 [ABERTA] — Edge:**
*"Se alguém te perguntasse 'por que VOCÊ ganha dinheiro no mercado?' — o que responderia?"*
- IA busca: capacidade de articular edge; "meu edge é..." (claro) vs. "eu sou bom em..." (vago) vs. "não sei" (honesto)
- Pergunta de Stage 3+: quem não consegue responder está provavelmente em Stage 1-2

---

## 6. SCORING — FÓRMULAS DEFINITIVAS

### 6.1 Emocional
```
recognition = média(EMO-01, EMO-02, EMO-03, aiScore(EMO-04)) → override mentor
regulation  = média(EMO-05, EMO-06, EMO-07, aiScore(EMO-08)) → override mentor
locus       = média(EMO-09, EMO-10, aiScore(EMO-11), aiScore(EMO-12)) → override mentor
emotionalScore = (recognition + regulation + locus) / 3
```
Labels: SAGE (85+) | LEARNER (65-84) | DEVELOPING (50-64) | FRAGILE (<50)

### 6.2 Financeiro
```
discipline     = média(FIN-01, FIN-03, FIN-05, aiScore(FIN-06)) → override mentor
loss_mgmt      = média(FIN-02, FIN-07, aiScore(FIN-08)) → override mentor  
profit_taking  = FIN-04 → override mentor
financialScore = (discipline × 0.40) + (loss_mgmt × 0.40) + (profit_taking × 0.20)
```
Labels: FORTIFIED (85+) | SOLID (70-84) | VULNERABLE (50-69) | CRITICAL (<50)

### 6.3 Operacional (5 sub-dimensões — inclui emotion_control herdado)

**DECISÃO DE DESIGN (DEC-013, 20/03/2026):** A dimensão Operacional inclui `emotion_control` herdado da dimensão Emocional como 5ª sub-dimensão. Isso cria um cross-link estrutural: um aluno com emocional frágil não pode ter operacional excelente, refletindo a realidade de que processo disciplinado no papel desmorona sob pressão emocional. O operacional declarado no assessment será recalibrado pelos dados reais do journal após 30 dias — o emotion_control herdado garante que o marco zero não seja inflado por auto-relato otimista.

```
decision_mode   = média(OPE-01, OPE-05, aiScore(OPE-06)) → override mentor
timeframe       = OPE-02 → override mentor
strategy_fit    = OPE-03 → override mentor
tracking        = OPE-04 → override mentor
emotion_control = emotionalScore (herdado da dimensão emocional, calculado na 6.1)

operationalScore = (decision_mode × 0.25) + (timeframe × 0.20) + 
                   (strategy_fit × 0.20) + (tracking × 0.15) + 
                   (emotion_control × 0.20)
```

**Justificativa dos pesos:**
- `decision_mode` (0.25): peso maior — define se opera por processo ou intuição
- `timeframe` (0.20): desalinhamento timeframe/vida é friction operacional primário
- `strategy_fit` (0.20): consistência de estratégia indica maturidade
- `tracking` (0.15): peso menor — é o mais fácil de "resolver mecanicamente" sem profundidade
- `emotion_control` (0.20): cross-link emocional — garante que fragilidade emocional impacte o score operacional

Labels: MASTERY FIT (85+) | GOOD FIT (70-84) | PARTIAL FIT (50-69) | MISMATCH (<50)

**Nota:** `emotion_control` não tem override pelo mentor na dimensão operacional — é derivado automaticamente do `emotionalScore` já validado pelo mentor na dimensão emocional. Evita double-override.

### 6.4 Experiência
```
stage = mapeado por EXP-01 + EXP-02 + EXP-03 + EXP-04 + aiScore(EXP-05) + aiScore(EXP-06)
gates_met = count(gates cumpridos do próximo stage)
experienceScore = stageBase + (gates_met / gates_total) × 20
```
Bases: Stage 1=0, Stage 2=20, Stage 3=40, Stage 4=60, Stage 5=80

### 6.5 Composite
```
composite = (emotional × 0.25) + (financial × 0.25) + (operational × 0.20) + (experience × 0.30)
```
Labels: PROFESSIONAL TRADER (80+) | COMMITTED LEARNER (65-79) | DEVELOPING TRADER (40-64) | AT RISK (<40)

**Nota sobre dupla penalidade emocional:** O `emotionalScore` impacta o composite diretamente (peso 0.25) E indiretamente via `operationalScore` (emotion_control × 0.20 × peso operacional 0.20 = contribuição efetiva de 0.04 adicional). Isso é intencional — a contribuição efetiva total do emocional no composite é ~0.29, refletindo a premissa de que o emocional é a dimensão mais determinante e mais difícil de fazer gaming.

---

## 7. COMPONENTES REACT A CRIAR

| Componente | Responsabilidade |
|------------|-----------------|
| `src/pages/StudentOnboardingPage.jsx` | Página principal com tabs (status do aluno) |
| `src/components/Onboarding/QuestionnaireFlow.jsx` | Fluxo de questionário para o aluno |
| `src/components/Onboarding/QuestionClosed.jsx` | Pergunta fechada com 5 opções randomizadas |
| `src/components/Onboarding/QuestionOpen.jsx` | Pergunta aberta com validação de mínimo |
| `src/components/Onboarding/QuestionnaireProgress.jsx` | Barra de progresso |
| `src/components/Onboarding/ProbingQuestionsFlow.jsx` | Fluxo de sondagem adaptativa (3-5 perguntas geradas pela IA) |
| `src/components/Onboarding/ProbingIntro.jsx` | Tela de transição: "Baseado nas suas respostas, gostaríamos de aprofundar..." |
| `src/components/Onboarding/AIAssessmentReport.jsx` | Relatório pré-assessment para o mentor |
| `src/components/Onboarding/MentorValidation.jsx` | Interface de validação/override do mentor |
| `src/components/Onboarding/IncongruenceFlags.jsx` | Visualização de flags (intra + inter-dimensionais) |
| `src/components/Onboarding/TraderProfileCard.jsx` | Card visual 4-quadrantes do perfil |
| `src/components/Onboarding/BaselineReport.jsx` | Relatório final pós-validação |
| `src/components/Onboarding/MonthlyReviewForm.jsx` | Formulário de review mensal (3 camadas: trades_scores pré-calculados, delta inputs, notes por dimensão) |
| `src/components/Onboarding/TraderEvolutionTimeline.jsx` | Gráfico de evolução 4D (Recharts): 4 linhas + composite, marcadores de eventos |
| `src/components/Onboarding/ProgressionGateStatus.jsx` | Visualização de gates cumpridos/faltantes por stage |
| `src/components/Onboarding/PromotionDecisionModal.jsx` | Interface para mentor promover/reter com justificativa e override |
| `src/components/Onboarding/MentorJournalEntry.jsx` | Entrada de nota livre do mentor (observation/intervention/concern/milestone) |
| `src/components/Onboarding/MentorJournalList.jsx` | Timeline de notas do mentor por aluno, filtrável por dimensão/tipo |

### Utils

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/assessmentScoring.js` | Cálculos de score por dimensão + composite |
| `src/utils/questionRandomizer.js` | Randomização de alternativas (PRNG seeded OU persistência) |
| `src/utils/profileClassifier.js` | Classificação (SAGE/LEARNER/DEVELOPING/FRAGILE, etc.) |
| `src/utils/stageMapper.js` | Mapeamento respostas → stage + gates |
| `src/utils/incongruenceDetector.js` | Detecção de discrepância: intra-dim (fechadas × abertas) + inter-dim (entre dimensões) |
| `src/utils/probingTriggers.js` | Identifica triggers para sondagem: incongruências, hesitações, gaming, respostas rasas. Prioriza e seleciona 3-5 |
| `src/utils/progressionGates.js` | Definição de gates por stage + avaliador de elegibilidade |
| `src/utils/tradeScoreMapper.js` | Mapeamento métricas de trades → scores 4D por dimensão |
| `src/utils/evolutionCalculator.js` | Blending score_trades + mentor_delta com pesos variáveis por dimensão |

### Cloud Functions

| Função | Responsabilidade |
|--------|-----------------|
| `classifyOpenResponse` (callable) | Recebe texto + contexto, chama API Claude, retorna score + classificação + flags |
| `generateProbingQuestions` (callable) | Recebe respostas completas + flags + responseTime data, gera 3-5 perguntas de sondagem contextualizadas com rubrica |
| `analyzeProbingResponse` (callable) | Recebe resposta de sondagem + contexto original + flag investigada, retorna análise (resolved/reinforced/inconclusive) |
| `generateAssessmentReport` (callable) | Processa todas as respostas (base + sondagem), executa cross-checks, gera relatório completo pré-mentor |
| `calculateMonthlyScores` (callable) | Extrai métricas do período dos trades e calcula score_trades 4D automático |
| `evaluateProgression` (callable) | Avalia elegibilidade de promoção contra gates do stage atual |

### Hooks

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/useAssessment.js` | CRUD do assessment no Firestore |
| `src/hooks/useQuestionnaire.js` | Estado do questionário (progresso, respostas, persistência de optionOrder) |
| `src/hooks/useProbing.js` | Estado da sondagem adaptativa (geração, respostas, análise) |
| `src/hooks/useMonthlyReview.js` | Gestão de reviews mensais (3 camadas) |
| `src/hooks/useEvolutionTimeline.js` | Série temporal de scores para gráfico 4D |
| `src/hooks/useProgressionGates.js` | Estado dos gates do aluno + elegibilidade |
| `src/hooks/useMentorJournal.js` | CRUD do journal livre do mentor |

---

## 8. ESCOPO — O QUE NÃO FAZER

❌ NÃO modificar nenhum arquivo fora dos listados acima
❌ NÃO tocar em `App.jsx`, `functions/index.js`, `firestore.rules`, `version.js`, `CHANGELOG.md`
❌ NÃO modificar collections existentes (`trades`, `plans`, `users`, `students` doc fields exceto `onboardingStatus`)
❌ NÃO integrar com trade ledger (auto-extração de últimos 20 trades é fase futura)
❌ NÃO implementar detecção comportamental (CHUNK-11)

---

## 9. REQUISITOS TÉCNICOS

- React + Vite, Firebase/Firestore, Vitest + jsdom
- DebugBadge obrigatório em toda tela nova
- Datas formato brasileiro (DD/MM/YYYY)
- Testes obrigatórios para scoring, classificação, randomização, incongruência (intra E inter-dimensional)
- Cloud Function para IA usa model `claude-sonnet-4-20250514`
- Alternativas SEMPRE randomizadas — nunca ordem fixa (ver seção 3.1 para implementação)
- Git: commit messages em linha única (PowerShell)

---

## 10. ENTREGÁVEIS

1. ZIP com paths project-relative
2. MERGE-INSTRUCTIONS-onboarding.md
3. CONTINUITY-session-YYYYMMDD.md
4. Testes passando

```powershell
Expand-Archive -Path "Temp\student-onboarding.zip" -DestinationPath "." -Force
```

---

## 11. ACCEPTANCE CRITERIA

- [ ] Questionário completo: 34 perguntas (22 fechadas + 12 abertas)
- [ ] Alternativas randomizadas com persistência (não muda se aluno retomar)
- [ ] Mapeamento score oculto no backend
- [ ] Cloud Function para classificação de respostas abertas via API Claude
- [ ] Cross-check INTRA-dimensional: fechadas × abertas com flags de incongruência
- [ ] Cross-check INTER-dimensional: 5 flags (STOP_CLAIM_VS_BEHAVIOR, PROCESS_VS_IMPULSE, SIZING_VS_REVENGE, DISCIPLINE_VS_LOCUS, JOURNAL_VS_AWARENESS)
- [ ] Interface de validação do mentor com override + justificativa
- [ ] Sistema guarda score_ia e score_mentor
- [ ] Scoring automático com todas as fórmulas implementadas
- [ ] Operacional com 5 sub-dimensões (inclui emotion_control herdado)
- [ ] Fórmula operacional ponderada: 0.25 + 0.20 + 0.20 + 0.15 + 0.20
- [ ] Labels corretos: SAGE/LEARNER/DEVELOPING/FRAGILE, FORTIFIED/SOLID/VULNERABLE/CRITICAL, etc.
- [ ] Experience score contínuo por % de gates
- [ ] Composite score com pesos corretos (E×0.25 + F×0.25 + O×0.20 + X×0.30)
- [ ] TraderProfileCard visual 4-quadrantes
- [ ] State machine onboarding (lead → pre_assessment → ai_assessed → probing → probing_complete → mentor_validated → active)
- [ ] Sondagem adaptativa: 3-5 perguntas geradas pela IA baseadas em flags + hesitações
- [ ] ProbingIntro com mensagem transparente ("Baseado nas suas respostas...")
- [ ] ProbingQuestionsFlow com perguntas abertas (mínimo 80 chars)
- [ ] CF generateProbingQuestions funcional
- [ ] CF analyzeProbingResponse funcional
- [ ] Respostas de sondagem NÃO alteram scores base (apenas geram probingAnalysis)
- [ ] Relatório do mentor inclui sondagem + análise + flags resolvidos/reforçados
- [ ] DebugBadge em toda tela
- [ ] Testes unitários para scoring, classificação, randomização, incongruência (intra + inter)
- [ ] Nenhum arquivo fora do escopo modificado
- [ ] MERGE-INSTRUCTIONS completo
- [ ] **Evolution Tracking:**
- [ ] Review mensal 3 camadas: score_trades (automático) + mentor_delta + score_final (blendado)
- [ ] Pesos variáveis por dimensão: Fin 0.70/0.30, Ope 0.50/0.50, Emo 0.30/0.70, Exp 0.80/0.20
- [ ] tradeScoreMapper: métricas de trades → scores 4D para cada dimensão
- [ ] evolutionCalculator: blending com clamp [0, 100] e preservação do delta original
- [ ] TraderEvolutionTimeline: gráfico 4D baseline → reviews mensais (Recharts)
- [ ] Gates de progressão hardcoded em progressionGates.js (Stage 1→2→3→4→5)
- [ ] Avaliação híbrida: CF calcula elegibilidade, mentor confirma/veta (PROMOTE/HOLD/OVERRIDE)
- [ ] Regressão nunca automática — alerta + decisão do mentor
- [ ] ProgressionGateStatus: visualização gates cumpridos/faltantes
- [ ] PromotionDecisionModal: interface mentor com override + justificativa
- [ ] Mentor journal: notas livres entre reviews (observation/intervention/concern/milestone)
- [ ] Progression log: registro de promoções/retenções com justificativa
- [ ] CFs calculateMonthlyScores e evaluateProgression funcionais
- [ ] Testes para tradeScoreMapper, evolutionCalculator, progressionGates

---

## DECISÕES REGISTRADAS NESTE BRIEFING

| ID | Data | Decisão | Justificativa |
|----|------|---------|---------------|
| DEC-013 | 20/03/2026 | Operacional 5D com emotion_control herdado + pesos diferenciados | Cross-link emocional→operacional impede inflação por auto-relato; operacional declarado será recalibrado por dados reais do journal |
| DEC-014 | 20/03/2026 | Cross-check inter-dimensional (5 flags iniciais) | Aluno tende a inflar financeiro/operacional; cruzamento com respostas emocionais detecta incongruências |
| DEC-015 | 20/03/2026 | Randomização via persistência (Opção B preferida) | Mais robusto para retomada de sessão e troca de device |
| DEC-016 | 20/03/2026 | Sondagem adaptativa pós-questionário (Estágio 1.5), 3-5 perguntas, transparente | Sondar incongruências enquanto aluno está no contexto; transparência modela auto-investigação; scores base não são alterados para preservar comparabilidade |
| DEC-017 | 20/03/2026 | Scoring mensal 3 camadas: score_trades + mentor_delta + score_final com pesos variáveis por dimensão | Confiabilidade das métricas automáticas varia por dimensão; mentor calibra mais no emocional (0.70), menos no financeiro (0.30) |
| DEC-018 | 20/03/2026 | Mentor aplica delta (não score absoluto) no review mensal | Reduz carga cognitiva — mentor reage ao dado calculado; preserva auditabilidade (sempre se sabe quanto veio dos trades vs sentimento) |
| DEC-019 | 20/03/2026 | Gates hardcoded em progressionGates.js, avaliação híbrida (automático + mentor confirma/veta) | Gates versionados com o código para consistência; mentor tem poder de override para ambos os lados (PROMOTE/HOLD/OVERRIDE) |
| DEC-020 | 20/03/2026 | Regressão de stage nunca automática — sempre via mentor com justificativa | Evita penalização injusta por meses atípicos; mentor contextualiza antes de rebaixar |

---

*Briefing Version 3.2 — 20/03/2026*
*Chunk: CHUNK-09 (Student Onboarding & Evolution Tracking)*
*Branch: feature/student-onboarding*
*Decisões: DEC-013 a DEC-020*
*Escopo: Assessment 3 estágios + sondagem adaptativa + evolution tracking 4D + gates de progressão + mentor journal*
