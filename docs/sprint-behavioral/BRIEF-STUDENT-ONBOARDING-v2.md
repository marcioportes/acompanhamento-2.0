# BRIEF-STUDENT-ONBOARDING.md
## Briefing de Sessão — Frente: Setup Inicial do Aluno
### Versão 2.0 — 17/03/2026 (Atualizado: Assessment 2 estágios)

---

## 1. CONTEXTO PARA A SESSÃO

Você está trabalhando no **Acompanhamento 2.0** — plataforma de mentoria de trading comportamental em React/Vite + Firebase/Firestore + Cloud Functions, deploy em Vercel.

Esta frente implementa o **setup inicial do aluno** com assessment em 2 estágios: (1) questionário autoaplicável com classificação por IA, (2) validação pelo mentor em entrevista curta. O objetivo é estabelecer o **marco zero** para evolução emocional e comportamental.

**Referência principal:** `trader_evolution_framework.md` (entregar junto)

---

## 2. CHUNK CHECK-OUT

| Chunk | Status | Permissão |
|-------|--------|-----------|
| **CHUNK-09 (Student Onboarding)** | LOCKED | ✅ CRIAR arquivos listados |
| CHUNK-02 (Student Management) | READ-ONLY | ⚠️ LER estrutura de `students`, NÃO MODIFICAR |
| Todos os demais | BLOQUEADO | ❌ NÃO TOCAR |

**Branch:** `feature/student-onboarding`

---

## 3. ARQUITETURA: ASSESSMENT EM 2 ESTÁGIOS

### 3.1 Estágio 1 — Questionário Autoaplicável (Aluno)

O aluno responde sozinho, sem mentor. Mix de perguntas fechadas e abertas.

**Perguntas fechadas (5 alternativas):**
- Cada alternativa tem peso (score) oculto mapeado no backend
- **CRÍTICO: Ordem das alternativas RANDOMIZADA a cada apresentação**
- O mapeamento alternativa→score NUNCA é exposto ao frontend
- O array de opções é embaralhado no momento de renderizar
- Implementação: `options.sort(() => Math.random() - 0.5)` com seed estável por sessão

**Perguntas abertas (texto livre):**
- Mínimo 50 caracteres para evitar respostas monossilábicas
- Classificadas por IA via Cloud Function callable (API Claude)
- IA retorna: score (0-100), classificação (ex: A/B/C), justificativa, flags de incongruência
- Prompt da IA inclui: texto do aluno + pergunta + rubrica de scoring + respostas fechadas anteriores para cross-check

**Cross-check automático:**
- Se resposta fechada indica score 80+ mas aberta indica externalização → flag INCONGRUÊNCIA
- Se todas as fechadas são consistentemente "melhores respostas" → flag GAMING_SUSPECT
- Flags visíveis apenas no relatório do mentor (Estágio 2)

### 3.2 Estágio 2 — Validação pelo Mentor (Entrevista 20-30 min)

Mentor recebe relatório pré-assessment:
- Scores propostos por dimensão e sub-dimensão
- Respostas do aluno (fechadas + abertas)
- Justificativas da IA para cada classificação
- Flags de incongruência
- Sugestões de perguntas de investigação baseadas nos flags

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
  onboardingStatus: "lead" | "pre_assessment" | "ai_assessed" | "mentor_validated" | "active",
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
      optionOrder: ["opt-2","opt-5","opt-1","opt-3","opt-4"],  // ordem apresentada
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
    {
      type: "CLOSED_VS_OPEN",
      dimension: "emotional",
      closedScore: 82,
      openScore: 48,
      delta: 34,
      description: "Fechada indica reconhecimento rápido; aberta mostra externalização"
    }
  ],
  aiProcessedAt: Timestamp,
  aiModelVersion: "claude-sonnet-4-20250514"
}
```

### 4.3 Assessment Final (marco zero)

```javascript
// students/{studentId}/assessment/initial_assessment
{
  timestamp: Timestamp,
  interviewer: string,                    // mentor que validou
  assessmentMethod: "two_stage_v1",       // versionamento do método
  
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
    score: 64,                            // (discipline×0.4 + loss×0.4 + profit×0.2) mentor scores
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
    risk_attitude: { aiScore: 75, mentorScore: 75, classification: "Moderate", notes: "" },
    emotion_control: 62,                  // herdado da dim. emocional
    fit_score: 69,                        // média das 4
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
  }
}
```

### 4.4 Monthly Reviews e Progression Log

```javascript
// students/{studentId}/assessment/ongoing_tracking/monthly_reviews/{date}
{
  date: Timestamp,
  emotional_update: 65,
  financial_update: 68,
  operational_update: 70,
  experience_stage: 2,
  experience_gates_met: 5,
  experience_score: 32.5,                 // 20 + (5/8 × 20)
  composite_update: 58.9,
  delta_vs_baseline: {
    emotional: +3,
    financial: +4,
    operational: +1,
    experience: +5,
    composite: +3.5
  },
  milestones_achieved: ["Stop usage > 80%"],
  blockers_encountered: ["Strategy changed once"],
  mentor_notes: ""
}
```

---

## 5. CATÁLOGO DE PERGUNTAS

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

### 6.3 Operacional
```
decision_mode   = média(OPE-01, OPE-05, aiScore(OPE-06)) → override mentor
timeframe       = OPE-02 → override mentor
strategy_fit    = OPE-03 → override mentor
tracking        = OPE-04 → override mentor
operationalScore = (decision_mode + timeframe + strategy_fit + tracking) / 4
```
Labels: MASTERY FIT (85+) | GOOD FIT (70-84) | PARTIAL FIT (50-69) | MISMATCH (<50)

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

---

## 7. COMPONENTES REACT A CRIAR

| Componente | Responsabilidade |
|------------|-----------------|
| `src/pages/StudentOnboardingPage.jsx` | Página principal com tabs (status do aluno) |
| `src/components/Onboarding/QuestionnaireFlow.jsx` | Fluxo de questionário para o aluno |
| `src/components/Onboarding/QuestionClosed.jsx` | Pergunta fechada com 5 opções randomizadas |
| `src/components/Onboarding/QuestionOpen.jsx` | Pergunta aberta com validação de mínimo |
| `src/components/Onboarding/QuestionnaireProgress.jsx` | Barra de progresso |
| `src/components/Onboarding/AIAssessmentReport.jsx` | Relatório pré-assessment para o mentor |
| `src/components/Onboarding/MentorValidation.jsx` | Interface de validação/override do mentor |
| `src/components/Onboarding/IncongruenceFlags.jsx` | Visualização de flags de incongruência |
| `src/components/Onboarding/TraderProfileCard.jsx` | Card visual 4-quadrantes do perfil |
| `src/components/Onboarding/BaselineReport.jsx` | Relatório final pós-validação |
| `src/components/Onboarding/MonthlyReviewForm.jsx` | Formulário de review mensal |

### Utils

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/assessmentScoring.js` | Cálculos de score por dimensão + composite |
| `src/utils/questionRandomizer.js` | Randomização de alternativas com seed |
| `src/utils/profileClassifier.js` | Classificação (SAGE/LEARNER/DEVELOPING/FRAGILE, etc.) |
| `src/utils/stageMapper.js` | Mapeamento respostas → stage + gates |
| `src/utils/incongruenceDetector.js` | Detecção de discrepância fechadas × abertas |
| `src/utils/progressionGates.js` | Validação de gates para progressão |

### Cloud Functions

| Função | Responsabilidade |
|--------|-----------------|
| `classifyOpenResponse` (callable) | Recebe texto + contexto, chama API Claude, retorna score + classificação |
| `generateAssessmentReport` (callable) | Processa todas as respostas, gera relatório pré-assessment |

### Hooks

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/useAssessment.js` | CRUD do assessment no Firestore |
| `src/hooks/useQuestionnaire.js` | Estado do questionário (progresso, respostas) |
| `src/hooks/useMonthlyReview.js` | Gestão de reviews mensais |

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
- Testes obrigatórios para scoring, classificação, randomização, incongruência
- Cloud Function para IA usa model `claude-sonnet-4-20250514`
- Alternativas SEMPRE randomizadas — nunca ordem fixa
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
- [ ] Alternativas randomizadas a cada apresentação
- [ ] Mapeamento score oculto no backend
- [ ] Cloud Function para classificação de respostas abertas via API Claude
- [ ] Cross-check automático fechadas × abertas com flags de incongruência
- [ ] Interface de validação do mentor com override + justificativa
- [ ] Sistema guarda score_ia e score_mentor
- [ ] Scoring automático com todas as fórmulas implementadas
- [ ] Labels corretos: SAGE/LEARNER/DEVELOPING/FRAGILE, FORTIFIED/SOLID/VULNERABLE/CRITICAL, etc.
- [ ] Experience score contínuo por % de gates
- [ ] Composite score com pesos corretos
- [ ] TraderProfileCard visual 4-quadrantes
- [ ] State machine onboarding (lead → pre_assessment → ai_assessed → mentor_validated → active)
- [ ] DebugBadge em toda tela
- [ ] Testes unitários para scoring, classificação, randomização, incongruência
- [ ] Nenhum arquivo fora do escopo modificado
- [ ] MERGE-INSTRUCTIONS completo

---

*Briefing Version 2.0 — 17/03/2026*
*Chunk: CHUNK-09 (Student Onboarding & Baseline)*
*Branch: feature/student-onboarding*
*Decisões fechadas: DEVELOPING label, gates contínuo, assessment 2 estágios com randomização*
