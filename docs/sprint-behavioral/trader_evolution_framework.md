# Framework Evolutivo de Classificação Comportamental de Traders
## Sistema de Assessment e Desenvolvimento para Acompanhamento 2.0

---

## PARTE 1: ARQUITETURA GERAL DO FRAMEWORK

### 1.1 Princípios Fundacionais

O framework opera em **quatro dimensões independentes mas correlacionadas**:

1. **Dimensão Emocional (Sistema 1 vs Sistema 2)** — Baseado em Kahneman
2. **Dimensão Financeira (Gestão de Risco)** — Prospect Theory + Behavioral Biases
3. **Dimensão Operacional (Modelo de Trading)** — Personality & Process Fit
4. **Dimensão de Experiência (Competência & Proficiência)** — Maturity Model

Cada dimensão tem:
- **Assessment Inicial** (via entrevista estruturada)
- **Score Baseline** (0-100 escala)
- **Indicadores de Progresso** (mensuráveis)
- **Pathways de Evolução** (estágios definidos)

---

## PARTE 2: DIMENSÃO 1 — EMOCIONAL

### 2.1 Fundação Teórica

Kahneman identificou dois sistemas de pensamento principais: Sistema 1 ("fast thinking") caracterizado por avaliações rápidas, pensamento subconsciente e processamento na amígdala, e Sistema 2 ("slow thinking") associado ao córtex pré-frontal, caracterizado por análise profunda.

**A chave:** Confiança é gerada pela **coerência da narrativa interna**, não pela qualidade dos dados. Kahneman observou que traders fazem churn porque contam a si mesmos histórias coerentes.

### 2.2 Modelo de Assessment — Entrevista Estruturada

**Questões Diagnósticas (30 minutos):**

#### Bloco A: Autorregulação & Consciência Emocional

1. **"Descreva sua reação emocional durante seu pior trade. Como você se sentiu nos primeiros 10 segundos? Nos próximos 10 minutos?"**
   - *Busca:* Latência de reconhecimento emocional, intensidade, duração
   - *Score:* Reconhecimento imediato + controle rápido = Alta (75+); Negação/Explosão = Baixa (<40)

2. **"Você já ignorou seus próprios sinais de stop-loss? Por quê?"**
   - *Busca:* Loss aversion manifestation, narrative override
   - *Padrão esperado:* "Esperei recovery" = Loss Aversion Bias; "Estava certo da análise" = Overconfidence
   
3. **"Qual é o tamanho máximo de drawdown que você pode tolerar psicologicamente antes de dar um break?"**
   - *Busca:* Diferença entre risk tolerance (teórico) vs. risk comfort (prático)

#### Bloco B: Padrões de Viés Emocional

4. **"Descreva um trade que você 'ganhou' mas vendeu cedo. Por que saiu?"**
   - *Busca:* Disposition Effect; Narrow Framing
   - *Scoring:* "Lucro é lucro" (System 1) = 30-50; "Análise mostrou saturação" (System 2) = 70-85

5. **"Após uma sequência de 3 perdas, qual é sua impulsão psicológica: entrar maior na próxima ou reduzir?"**
   - *Busca:* Revenge Trading Susceptibility; Hindsight Bias
   
6. **"Como você diferencia 'confiança em meu edge' de 'overconfidence'?"**
   - *Busca:* Metacognição; Ability to distinguish confidence from competence
   - *Red Flag:* "Eu sei quando estou right" (sem evidência objetiva)

#### Bloco C: Resilência & Aprendizado

7. **"Você consegue identificar 3 padrões de erros que repete? Descreva-os."**
   - *Busca:* Pattern recognition em own behavior; Accountability
   - *Score:* 3+ padrões identificados = 70+; Vago/evasivo = <40

8. **"Quando você comete um erro operacional, qual é seu primeiro pensamento?"**
   - *Busca:* Blame externalization vs. internal locus of control
   - Respostas ideais: "O que fiz errado?" (75+) vs. "O mercado me pegou" (35)

### 2.3 Mapeamento Emocional — Classificação Bipolar

**Dimensão 1: Rapidez de Reconhecimento Emocional**
- **A (Reflexo Rápido, 70-100):** Percebe emoção em <30 seg, consegue nomear
- **B (Moderado, 50-70):** Reconhece após 1-5 minutos, com reflexão
- **C (Lento, <50):** Reconhece horas depois, ou nega completamente

**Dimensão 2: Capacidade de Regulação**
- **1 (Autocontrole Alto, 70-100):** Reconhece + interrompe comportamento prejudicial
- **2 (Moderado, 50-70):** Reconhece mas precisa de mecanismos externos (breaks, rules)
- **3 (Baixo, <50):** Reconhece mas age de qualquer forma; nega mecanismos

**Dimensão 3: Locus de Controle**
- **X (Interno, 70-100):** "Eu controlo meu processo, market controla outcome"
- **Y (Misto, 50-70):** Entende teoria mas culpa market frequentemente
- **Z (Externo, <50):** "Market me controla; sou vítima de volatilidade"

### 2.4 Perfil Emocional Resultado

**Score Emocional = (Reconhecimento + Regulação + Locus) / 3**

**Profiles:**

| Profile | Reconhecimento | Regulação | Locus | Score | Característica |
|---------|---|---|---|---|---|
| **SAGE** | A | 1 | X | 85-100 | Consciência + controle = Trader fundacional sólido |
| **LEARNER** | B | 2 | X | 65-80 | Consciência presente mas precisa de structure |
| **FRAGILE** | C | 3 | Z | <50 | High emotional reactivity, defensive, blaming |

---

## PARTE 3: DIMENSÃO 2 — FINANCEIRA (GESTÃO DE RISCO)

### 3.1 Fundação Teórica

Prospect Theory mostra que investidores valorizam ganhos e perdas diferentemente e que o impacto emocional de uma perda é muito mais severo que um ganho equivalente. Kahneman ofereceu uma proposição: se tails = perde $10, quanto precisa ganhar em heads para tomar a aposta? Maioria: $20 (ratio 2:1). Mesmo com executivos bem-sucedidos.

**Implicação:** Loss aversion **não é aprendida**; é inata. Logo, deve ser **mecanicamente controlada**, não "dominada".

### 3.2 Assessment Financeiro — Entrevista & Dados

#### Bloco A: Teoria vs. Prática

1. **"Qual é sua posição size ideal por trade? (em % de account ou $ fixo)"**
   - *Esperado:* Resposta precisa e fundamentada (1% risk, 2:1 R:R, etc.)
   - *Score:* Preciso + justificado = 80+; Vago ("depends") = <50

2. **"Como você calcula position size antes de entrar?"**
   - *Busca:* Fórmula mental vs. sistemática
   - *Ideal:* (account size × risk %) / (entry - SL) = shares/lots
   - *Red Flag:* "Sinto o tamanho certo"

3. **"Se um trade vai 2% contra você em 5 minutos, o que faz?"**
   - *Busca:* Stop-loss discipline; Justification logic
   - *Ideal:* "Exit conforme plano"; *Ruim:* "Espero reverter; era corto prazo"

#### Bloco B: Dados Históricos (Last 20 Trades)

**Extrar via journal ou platform:**

- **Win Rate Calculation**
  - Fórmula: Winning trades / Total trades
  - *Expected range:* 45-65% (não correlaciona com profitabilidade se R:R for bom)

- **Average Winner vs. Average Loser**
  - *Ideal ratio:* 2:1 ou melhor (ganhos 2x perdas)
  - *Score:* >2:1 = 80+; 1.2:1 = 50; <1 = critical failure

- **Max Consecutive Losses**
  - *Pattern indicator:* 5+ em sequência = Strategy breakdown ou TILT
  - *Score:* >6 = 30; 3-4 = 60; <3 = 85

- **Max Drawdown (Peak-to-Trough)**
  - *Esperado:* <10% account para evaluation; <15% normal
  - *Score:* <5% = 85; 5-10% = 70; 10-15% = 50; >20% = critical

#### Bloco C: Comportamento Sob Pressão (Retrospectivo)

4. **"Descreva um dia em que violou sua posição size. O que causou?"**
   - *Busca:* Trigger (FOMO, revenge, overconfidence, martingale escalation)
   - *Score:* Reconhece trigger + nunca repetiu = 70+; Repete pattern = <40

5. **"Qual foi seu pior período (drawdown)? Quanto tempo levou para recuperar? Qual foi a decisão que parou?"**
   - *Busca:* Reflexão honesta; Decisão deliberada vs. acidental
   - *Ideal:* "Reduzi tamanho deliberadamente após 8% drawdown"; *Ruim:* "Mercado se recuperou"

### 3.3 Modelo de Classificação Financeira

**Dimensão 1: Risk Discipline (Mecânica)**
- **Alpha (90-100):** Sistemático, documentado, sem violações em últimos 20 trades
- **Beta (70-85):** Sistemático mas 1-2 violações; corrigidas rapidamente
- **Gamma (50-65):** Ad-hoc; violações frequentes mas consciente
- **Delta (<50):** Sem sistema visível; violações contínuas

**Dimensão 2: Loss Management (Comportamental)**
- **1 (Excellent, 85-100):** Max drawdown <5%; recuperação >3 semanas; SL sempre executado
- **2 (Good, 70-80):** Max drawdown 5-10%; recuperação consistente; <5% SL violations
- **3 (Fair, 50-70):** Max drawdown 10-15%; recuperação lenta; 10-20% SL violations
- **4 (Poor, <50):** Drawdown >20%; recuperação prolongada; frequent SL overrides

**Dimensão 3: Profit Taking (Greed Control)**
- **H (Conservative, 70-100):** Avg winner / Avg loser >2.0; Win rate <55% acceptable
- **M (Moderate, 50-70):** Ratio 1.5-2.0; Win rate 50-60% required
- **L (Aggressive, <50):** Ratio <1.5; requires >65% win rate (unsustainable)

### 3.4 Score Financeiro

**Score = (Risk Discipline × 40%) + (Loss Management × 40%) + (Profit Taking × 20%)**

| Score Range | Label | Implication |
|---|---|---|
| 85-100 | **FORTIFIED** | Ready for leverage; can scale |
| 70-84 | **SOLID** | Sustainable; needs minor refinement |
| 50-69 | **VULNERABLE** | At risk from volatility; needs guardrails |
| <50 | **CRITICAL** | High probability of ruin; must pause trading |

---

## PARTE 4: DIMENSÃO 3 — OPERACIONAL (MODELO DE TRADING)

### 4.1 Framework: Trader Personality Indicator (4D Model)

Baseado em TPI que analisa estilo de trading através de 4 dimensões: Decision Mode, Time Preference, Risk Attitude, e Emotion Control.

### 4.2 Assessment Operacional

#### Dimensão A: Decision Mode

1. **"Como você identifica um trade: por dados/lógica ou por pattern/intuição?"**
   
   - **S (Systematic, 75-100):**
     - Backtesting antes de real trading
     - Checklist antes de entry
     - Rules-based; data-driven
     - *Exemplo:* "Espero RSI <30 + break de suporte em 4H"
   
   - **D (Discretionary, 60-75):**
     - Framework claro mas ajustado por market context
     - Usa padrões reconhecidos mas flexibiliza
     - *Exemplo:* "Geralmente breakouts, mas vejo situação e ajusto tamanho"
   
   - **I (Intuitive, <60):**
     - Confia em "sensação"; charts são suporte
     - Muda estratégia frequentemente
     - *Red Flag:* "Sinto quando é certo"

#### Dimensão B: Time Preference

2. **"Qual é seu timeframe natural de conforto?"**
   
   | Timeframe | Label | Traits |
   |---|---|---|
   | Intraday (5m-1h) | **SCALP** | High activity, low per-trade risk, stress-prone |
   | Short-term (1h-1d) | **DAY** | Moderate activity, medium stress, technical-heavy |
   | Medium (2d-2w) | **SWING** | Lower activity, lower stress, mixed analysis |
   | Long (>2w) | **POSITION** | Minimal activity, lower stress, fundamental-heavy |
   
   *Scoring:* Match with lifestyle/available time:
   - Fit = 75-85
   - Mismatch (wants day but has full-time job) = <50

#### Dimensão C: Risk Attitude (Aggregated from Fin Dimension)

   | Attitude | Position Sizing | Leverage | Drawdown Tolerance | Score |
   |---|---|---|---|---|
   | **Conservative** | 0.5-1% per trade | None | <5% | High Discipline |
   | **Moderate** | 1-2% per trade | 1:2 max | 5-10% | Balanced |
   | **Aggressive** | 2-3% per trade | 1:5+ | >15% | High Risk |

#### Dimensão D: Emotion Control (Extracted from Emotional Assessment)

   - Already scored in Dimensão 1
   - Map to "Ability to follow system under stress"

### 4.3 Operative Models: 16 Combinations

**System X Timeframe X Risk X Emotion = Operative Profile**

**Exemplos:**

| Profile | Composition | Name | Ideal Strategy |
|---|---|---|---|
| **SAGE-MASTER** | S + SWING + Moderate + Sage | The Professional | Systematic swing trading, solid risk, high conviction |
| **FRAGILE-SCALPER** | I + SCALP + Aggressive + Fragile | The Gambler | High frequency, emotional, prone to blow-up |
| **LEARNER-POSITION** | D + POSITION + Conservative + Learner | The Patient Growth | Low activity, learning-oriented, needs discipline structure |

**Scoring Operacional:**
- Cada dimensão 0-100
- **Score = Average of 4D**
- Qualificador: **Fit Score** = quanto bem o profile combina com goals do trader

### 4.4 Diagnostic Output

```
OPERATIONAL PROFILE REPORT
==========================

System: SYSTEMATIC (85/100)
- Strengths: Clear entry rules, backtested
- Weakness: Overfitting to historical data

Timeframe: DAY TRADING (65/100)
- Strengths: Fits 6-hour availability
- Weakness: High stress environment; emotional profile scores only 55

Risk Attitude: MODERATE (70/100)
- Matches operational model

Emotion Control: LEARNER (62/100)
- MISMATCH FLAG: Day trading + Learner emotional = HIGH VOLATILITY RISK
- RECOMMENDATION: Reduce to SWING (lower frequency = more recovery time)

OVERALL OPERATIONAL FIT: 70/100 (GOOD, with adjustment needed)
```

---

## PARTE 5: DIMENSÃO 4 — EXPERIÊNCIA (MATURITY MODEL)

### 5.1 Framework: 5 Estágios de Maturidade

Baseado em Capability Maturity Models que medem como bem organizações/indivíduos fazem seu trabalho e sua capacidade para melhoria contínua, com níveis definidos de efetividade.

### 5.2 Os 5 Estágios

#### **STAGE 1: CHAOS (0-6 meses de trading)**

**Characteristics:**
- Sem estratégia definida; experimenta "tudo"
- Trades baseados em FOMO, tips, ou "feels right"
- Journal inconsistente ou inexistente
- Drawdowns impredizíveis; recuperação por luck

**Behavioral Indicators:**
- Strategy changes weekly
- Violates risk rules regularly
- Blames market, not self
- No post-trade analysis

**Metrics:**
- Win rate: <40% (random)
- Avg loss > Avg win
- Max drawdown: >20%
- Time to profitability: Unknown

**Assessment Questions:**
- "Como você escolhe seus trades?"
- "Você tem um plano antes de abrir a plataforma?"
- "Já manteve a mesma estratégia por 4+ semanas?"

**Score: <30/100 Maturity**

---

#### **STAGE 2: REACTIVE (6-18 meses)**

**Characteristics:**
- Embrião de sistema; regras soltas
- Strategy mudança lenta (mensal)
- Journal básico (dates, entries, exits; sem análise)
- Reações imediatas a perdas; ajustes ad-hoc
- Começar a reconhecer padrões próprios de erro

**Behavioral Indicators:**
- Mantém estratégia por 3-4 semanas, depois muda se "não funciona"
- Journaling presente mas superficial
- Reconhece alguns padrões de erro; repetição inconsistente
- Risk rules existem mas violadas sob stress

**Metrics:**
- Win rate: 45-50%
- Avg loser ≈ Avg winner (ratio ~1.0-1.2)
- Max drawdown: 12-18%
- Time in stage: 6-12 months before progression

**Assessment Questions:**
- "Quantas vezes mudou sua estratégia em 2024?"
- "Pode descrever 2 erros recorrentes?"
- "Qual foi sua maior violação de risk rules e por quê?"

**Score: 30-50/100 Maturity**

---

#### **STAGE 3: METHODICAL (18 months - 2+ years)**

**Characteristics:**
- Sistema definido, documentado, testado (backtest ou 3+ months live)
- Estratégia estável; ajustes apenas por dados
- Journal completo: entrada, exit, emoções, análise
- Reconhece triggers emocionais; implementa guardrails
- Win rate vs. R:R consciente; otimiza ratio

**Behavioral Indicators:**
- Mantém estratégia por 6+ meses; ajustes baseados em stats
- Daily journal with emotional tracking
- Identifica e evita 3+ padrões recorrentes
- Risk rules violation <2% of trades

**Metrics:**
- Win rate: 50-60%
- Avg winner / Avg loser: 1.5-2.5+
- Max drawdown: 5-12%
- Consistent monthly returns (no -X% swings)

**Assessment Questions:**
- "Como você diferencia 'ajuste em estratégia' de 'mudança estratégia'?"
- "Qual é seu processo pós-perda?"
- "Consegue descrever 3 padrões que evita?"

**Score: 50-75/100 Maturity**

---

#### **STAGE 4: PROFESSIONAL (2-5 years)**

**Characteristics:**
- Sistema robusto; testado em múltiplos market conditions
- Diversificação: múltiplas estratégias ou timeframes
- Advanced journaling: MFE/MAE, Sharpe ratio, edge identification
- Emoção sob controle; raramente viola rules
- Dados dirigem decisões; atua como gestor de capital próprio

**Behavioral Indicators:**
- Estratégia stável por 1+ anos; ajustes estratégicos apenas
- Advanced metrics tracking; predictive analysis
- Identifica e quantifica edge; conhece vencedor % vs. esperado
- Zero rule violations; automated guardrails
- Mentoring comportamental a outros

**Metrics:**
- Win rate: 55-70%
- Avg winner / Avg loser: 2.0-3.5+
- Max drawdown: <5%
- Consecutive monthly profit streaks: 8+

**Assessment Questions:**
- "Como você mediria seu edge?"
- "Qual é seu protocolo se tira 2 perdas seguidas?"
- "Como escalaria se tivesse $1M?"

**Score: 75-90/100 Maturity**

---

#### **STAGE 5: MASTERY (5+ years)**

**Characteristics:**
- Múltiplos livros de estratégias; cross-asset proficiency
- Systematic coaching capacity; documenta aprendizados
- Emoção desacoplada de outcome; foco obsessivo em processo
- Contribui knowledge back (mentoring, writing, research)
- Adaptação ao mercado sem mudança de core principles

**Behavioral Indicators:**
- Trading quase como "breathing"; executada sem stress
- Documentação de pesquisa; contínua inovação dentro framework
- Zero emotional trading incidents; responde a adversidade com dados
- Scaling: capital cresce, strategy estável, multiple income streams
- Resilience extrema: consegue se recuperar de 30% drawdown em 2-3 meses

**Metrics:**
- Win rate: 55-75% (realista; não inflated)
- Avg winner / Avg loser: 2.5-4.0+
- Max drawdown: <3%
- 5-year Sharpe: >1.5
- Compounded annual return: 15-30%+

**Assessment Questions:**
- "Como seu trading mudou nos últimos 3 anos?"
- "Qual é sua hipótese de mercado para 2026? Por quê?"
- "Qual trader você está mentorando? Progresso?"

**Score: 90-100/100 Maturity**

---

### 5.3 Indicadores Quantitativos por Stage

| Metric | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
|---|---|---|---|---|---|
| **Months in Stage** | 0-6 | 6-18 | 18-24+ | 24-60 | 60+ |
| **Strategy Consistency** | Changes weekly | Monthly | Quarterly | Annual | Adaptive only |
| **Win Rate** | <40% | 45-50% | 50-60% | 55-70% | 55-75% |
| **R:R (Avg Win/Loss)** | <1.0 | 1.0-1.2 | 1.5-2.5 | 2.0-3.5 | 2.5-4.0 |
| **Max Drawdown** | >20% | 12-18% | 5-12% | <5% | <3% |
| **Monthly Variance** | ±30% | ±20% | ±10% | ±5% | ±2% |
| **Rule Violations** | >30% | 10-20% | <5% | <1% | ~0% |
| **Recovery Time** | >3 months | 2-3 months | 4-6 weeks | 2-3 weeks | 1-2 weeks |

### 5.4 Assessment: Determinar Current Stage

**Entry Questions (10 min):**

1. **"Quando começou a tradear? E quando começou com sua estratégia atual?"**
   - *Timeline indicator*

2. **"Quantas vezes mudou de estratégia em 2024?"**
   - <1x = Stage 3+
   - 2-4x = Stage 2
   - >4x = Stage 1

3. **"Descreva seu pior mês. Qual foi máx drawdown e quanto tempo levou recuperar?"**
   - >20% + >3 months = Stage 1
   - 10-15% + 2-3 months = Stage 2
   - 5-10% + <1 month = Stage 3
   - <5% + rapid = Stage 4+

4. **"Quais são seus 3 principais erros de trading e como evita cada um?"**
   - Vago/não consegue descrever = Stage 1
   - 1-2 identificados = Stage 2
   - 3+ com mecanismos = Stage 3+

5. **"Se eu olhasse seu journal do último mês, o que encontraria? (frequência, detalhes, análise)"**
   - Não tem = Stage 1
   - Básico (dates/amounts) = Stage 2
   - Detalhado (emoções, análise) = Stage 3+
   - Advanced metrics = Stage 4+

---

## PARTE 6: MATRIZ INTEGRADA DE ASSESSMENT

### 6.1 Estrutura: "FOUR-D TRADER PROFILE"

```
┌─────────────────────────────────────────────────────────────┐
│              FOUR-D TRADER ASSESSMENT REPORT                │
│              [Student Name] — [Date]                        │
└─────────────────────────────────────────────────────────────┘

I. EMOTIONAL DIMENSION (Sistema 1-2 Balance)
   ├─ Emotion Recognition: [A/B/C] — Score 75/100
   ├─ Self-Regulation: [1/2/3] — Score 62/100
   ├─ Locus of Control: [X/Y/Z] — Score 68/100
   └─ Profile: LEARNER (68/100) | Descriptor: Conscious but needs structure

II. FINANCIAL DIMENSION (Risk Management)
   ├─ Risk Discipline: BETA — Score 72/100
   ├─ Loss Management: 2 (Good) — Score 75/100
   ├─ Profit Taking: M (Moderate) — Score 65/100
   └─ Overall Fortified: 71/100 | Status: SOLID

III. OPERATIONAL DIMENSION (Trading Model Fit)
   ├─ System: SYSTEMATIC (85/100)
   ├─ Timeframe: DAY TRADING (65/100)
   ├─ Risk Attitude: MODERATE (70/100)
   ├─ Emotion Control: LEARNER (62/100)
   └─ Operative Fit: 70/100 | MISMATCH: Day trading + Learner = Recommend Swing

IV. EXPERIENCE DIMENSION (Maturity)
   ├─ Months Trading: 14
   ├─ Identified Stage: STAGE 2-REACTIVE (45/100)
   ├─ Progression Indicators: Strategy changes 3x in 2024; inconsistent journaling
   └─ Readiness for Stage 3: 3-4 months with current discipline

═══════════════════════════════════════════════════════════════

COMPOSITE SCORE: 63.5/100

PROFILE CLASSIFICATION: "EARNEST LEARNER"
├─ Emotional: Capable of growth; needs structure
├─ Financial: Acceptable risk management; profit taking suboptimal
├─ Operational: System solid but timeframe creates mismatch
└─ Experience: Early-stage but showing consistency patterns

KEY PRIORITIES (Ranked by Impact):
1. Extend strategy duration to 8+ weeks before evaluating (Maturity progression)
2. Reduce to SWING timeframe or cut trade frequency 50% (Emotional fit)
3. Optimize profit-taking ratio from 1.2 to 1.5+ (Financial)
4. Implement mandatory 1-hour break post-loss (Emotional guardrail)

DEVELOPMENT ROADMAP:
├─ Month 1: Focus on Emotional Guardrails + Strategy Consistency
├─ Month 2-3: Optimize Risk Ratio (move to 1.5 R:R target)
├─ Month 4: Consider timeframe expansion (add swing positions)
└─ Month 5-6: Full Stage 3 Assessment

NEXT REVIEW: [Date + 30 days]
```

### 6.2 Mapeamento de Correlações

**Observação empírica (da literatura):**

- **Emotional Stability + Financial Discipline** = Progression probability +60%
- **Operational Fit (System × Timeframe × Risk)** = Stress levels -40%
- **Maturity Stage < Emotional Development** = Burnout risk +70%
- **High Financial Score + Low Emotional = False Confidence** = Account blow-up risk +50%

---

## PARTE 7: FRAMEWORKS DE EVOLUÇÃO

### 7.1 Progressão Esperada (Por Dimensão)

#### Emotional Progression

```
Chaos (C, 3, Z) → Reactive (B, 2, Y) → Methodical (A, 1, X) → Mastery

Timeline: 6-18 months (can be faster with coaching)
Bottleneck: Loss aversion + overconfidence (intra-personal, hard to change)
Leverage: External rules + journaling + mentoring
```

#### Financial Progression

```
Critical (<50) → Vulnerable (50-69) → Solid (70-84) → Fortified (85-100)

Timeline: 3-12 months
Bottleneck: Profit-taking discipline (greed management)
Leverage: Position-sizing rules + automated SL + reduced timeframes
```

#### Operational Progression

```
Intuitive (I) → Discretionary (D) → Systematic (S)
Misfit Timeframe → Matched Timeframe
Unaware of Triggers → Named 3+ Triggers

Timeline: 6-24 months
Bottleneck: Letting go of "intuition" for rule-based
Leverage: Backtesting + simulation + forced journaling
```

#### Experience Progression

```
Stage 1 (Chaos) → Stage 2 (Reactive) → Stage 3 (Methodical) → Stage 4 (Professional)

Timeline: 0-6mo → 6-18mo → 18-24mo → 24-60mo
Gate: Each stage requires 80% adherence to characteristics before progression
```

### 7.2 "Stuck Points" & Interventions

#### Stuck Point: Emotional Learner + Financial Solid + Operational Day Trading

**Problem:** Schedule stress prevents emotional regulation.

**Intervention Sequence:**
1. **Week 1-2:** Reduce trade frequency to 2-3/day max (remove FOMO)
2. **Week 3-4:** Add "mandatory break post-loss" rule
3. **Week 5-6:** Optional: transition to swing trading (1-2 trades/week)
4. **Measure:** Emotional recognition latency; rule violation frequency

**Expected Outcome:** Emotional score +15-20 points in 6 weeks

---

#### Stuck Point: High Emotional Score but Financial Vulnerable (<50 Risk Discipline)

**Problem:** Knows rules but won't follow them. Overconfidence-driven.

**Intervention Sequence:**
1. **Week 1-2:** Implement automated position sizing (broker script, no discretion)
2. **Week 3:** Mandatory review of "all violations in last month" with mentor
3. **Week 4+:** Risk escalation tied to 20+ consecutive rule-following trades
4. **Measure:** % Rule compliance; Max drawdown reduction

**Expected Outcome:** Financial score +20-25 points in 6-8 weeks

---

#### Stuck Point: Stage 2 (Reactive) but refuses to commit to single strategy

**Problem:** Hypothesis-chasing; fear of "missing edge"; novelty-seeking.

**Intervention Sequence:**
1. **Weeks 1-4:** Mandatory freeze on strategy changes
2. **Week 5:** Post-mortem: "If I had kept old strategy, would I have more money?"
3. **Week 6-8:** Design explicit "strategy graduation gate" (target metrics)
4. **Week 9+:** Only change if gate met (not "feeling")
5. **Measure:** Strategy consistency; time-in-strategy; emotional triggers for change

**Expected Outcome:** Progression to Stage 3 within 12-16 weeks (vs. perpetual Stage 2)

---

## PARTE 8: IMPLEMENTATION IN ACOMPANHAMENTO 2.0

### 8.1 Data Model (Firestore Structure)

```javascript
/students/{studentId}/assessment/
├── initial_assessment/
│   ├── timestamp: timestamp
│   ├── interviewer: string
│   ├── emotional: {
│   │   ├── recognition: [A|B|C]
│   │   ├── regulation: [1|2|3]
│   │   ├── locus: [X|Y|Z]
│   │   ├── score: number (0-100)
│   │   ├── profile: [SAGE|LEARNER|FRAGILE]
│   │   └── notes: string
│   │}
│   ├── financial: {
│   │   ├── discipline: [Alpha|Beta|Gamma|Delta]
│   │   ├── loss_management: [1|2|3|4]
│   │   ├── profit_taking: [H|M|L]
│   │   ├── score: number (0-100)
│   │   ├── status: [FORTIFIED|SOLID|VULNERABLE|CRITICAL]
│   │   ├── last_20_trades_metrics: {
│   │   │   ├── win_rate: number
│   │   │   ├── avg_winner: number
│   │   │   ├── avg_loser: number
│   │   │   ├── max_drawdown: number
│   │   │   └── max_consecutive_losses: number
│   │   │}
│   │   └── notes: string
│   │}
│   ├── operational: {
│   │   ├── decision_mode: [S|D|I]
│   │   ├── timeframe: [SCALP|DAY|SWING|POSITION]
│   │   ├── risk_attitude: [Conservative|Moderate|Aggressive]
│   │   ├── fit_score: number (0-100)
│   │   ├── mismatch_flags: array<string>
│   │   └── notes: string
│   │}
│   ├── experience: {
│   │   ├── months_trading: number
│   │   ├── stage: [1|2|3|4|5]
│   │   ├── stage_score: number (0-100)
│   │   ├── progression_likelihood: number (0-100, %)
│   │   ├── key_blockers: array<string>
│   │   └── notes: string
│   │}
│   ├── composite_score: number (0-100)
│   ├── profile_name: string (e.g., "Earnest Learner")
│   ├── development_priorities: array<{rank, priority, months_to_focus}>
│   └── next_review_date: timestamp
│}
└── ongoing_tracking/
    ├── monthly_reviews/ (subcollection, ordered by date)
    │   └── {date}/
    │       ├── emotional_update: number
    │       ├── financial_update: number
    │       ├── operational_update: number
    │       ├── experience_stage_update: [1|2|3|4|5]
    │       ├── composite_update: number
    │       ├── milestones_achieved: array<string>
    │       ├── blockers_encountered: array<string>
    │       └── mentor_notes: string
    │}
    └── progression_log/ (subcollection)
        └── {event_id}/
            ├── date: timestamp
            ├── dimension: [emotional|financial|operational|experience]
            ├── old_score: number
            ├── new_score: number
            ├── change_drivers: array<string>
            └── coaching_action: string
```

### 8.2 UI Components (React)

#### 1. Initial Assessment Interview Modal

**40-50 minutes, structured dialogue:**

```jsx
<AssessmentInterview
  studentId={studentId}
  dimensions={['emotional', 'financial', 'operational', 'experience']}
  onComplete={handleSaveAssessment}
/>
```

**Flow:**
1. Emotional Block (8 questions) → Score + Profile
2. Financial Block (5 questions + data extraction) → Score + Status
3. Operational Block (5 questions) → Fit Score + Mismatches
4. Experience Block (5 questions) → Stage + Progression

#### 2. Four-D Profile Display Card

**Shows real-time composite:**

```jsx
<TraderProfileCard
  emotional={{score: 68, profile: 'LEARNER'}}
  financial={{score: 71, status: 'SOLID'}}
  operational={{score: 70, mismatch: 'Day Trading + Learner'}}
  experience={{stage: 2, score: 45}}
  composite={63.5}
  profileName="Earnest Learner"
/>
```

**Visual:**
- 4 quadrants (one per dimension)
- Color-coded: Green (80+), Yellow (50-79), Red (<50)
- Center: composite score + profile name
- Expandable: detailed breakdown + interventions

#### 3. Development Roadmap Timeline

**Shows 6-month progression path:**

```jsx
<EvolutionRoadmap
  currentStage={stage2}
  dimensionPriorities={priorities}
  milestones={milestones}
  reviewInterval={30} // days
/>
```

**Displays:**
- Month-by-month focus areas
- Key metrics to track
- Gates for stage progression
- Linked trades/journal entries as evidence

#### 4. Ongoing Tracking Dashboard

**Monthly pulse check:**

```jsx
<MonthlyReview
  studentId={studentId}
  dimensions={['emotional', 'financial', 'operational', 'experience']}
  previousScores={{...}}
  currentMonth={month}
/>
```

**Data inputs:**
- Simple 1-min survey (emotional check-in)
- Auto-extracted from trade data (financial metrics)
- Qualitative mentor observation (operational)
- Rule compliance + journal consistency (experience)

### 8.3 Mentor Dashboard

**Key metrics to monitor:**

```jsx
<MentorProgressDashboard>
  ├── StudentRanking (by composite score, by dimension)
  ├── RiskAlerts (Emotional <50 + Trading = stop trading flag)
  ├── ProgressionReadiness (Stage 2→3 gates reached?)
  ├── BlockerTracking (students stuck >2 months)
  └── InterventionLog (coaching actions + outcomes)
</MentorProgressDashboard>
```

---

## PARTE 9: SCORING & PROGRESSION GATES

### 9.1 Composite Score Formula

```
COMPOSITE = (Emotional × 0.25) + (Financial × 0.25) + (Operational × 0.20) + (Experience × 0.30)
```

**Weights Rationale:**
- Emotional + Financial = **50%** (foundational; without these, no sustainable trading)
- Operational = **20%** (important for fit; prevents burnout)
- Experience = **30%** (captures holistic maturity; heaviest weight because reflects all others)

### 9.2 Stage Progression Gates

**Gate to Stage 3 (from Stage 2):**

✅ **Required (ALL must be met):**
1. Emotional score ≥ 55
2. Financial status ≥ SOLID (≥70)
3. Operational fit ≥ 65
4. Strategy consistency ≥ 8 consecutive weeks without change
5. Journal completeness ≥ 90% of trades documented
6. Rule compliance ≥ 95% (max 1 violation per 20 trades)
7. Win rate ≥ 45%
8. Avg Winner / Avg Loser ≥ 1.2

**Timeline:** 18-24 months from Stage 1

**Mentor Sign-off Required:** Yes

---

**Gate to Stage 4 (from Stage 3):**

✅ **Required (ALL must be met):**
1. Emotional score ≥ 75
2. Financial status = FORTIFIED (≥85)
3. Operational fit ≥ 80 (no mismatches)
4. Strategy consistency ≥ 12 consecutive months
5. Journal: Advanced metrics tracked (MFE/MAE, Sharpe)
6. Rule compliance = 100% (zero violations last 100 trades)
7. Win rate ≥ 55%
8. Avg Winner / Avg Loser ≥ 2.0
9. Max drawdown ≤ 5%
10. Monthly Sharpe ratio ≥ 1.2

**Timeline:** 24-60 months from Stage 1

**Mentor Sign-off + Peer Review Required:** Yes

---

## PARTE 10: INTERVIEW TEMPLATE (Executável)

### 10.1 Full Assessment Interview Guide (50 min)

**PRE-INTERVIEW (5 min):**
- Review any prior trades/journal data
- Prepare data extraction questions
- Set emotional tone: "This is about understanding YOU, not judging"

**SECTION 1: EMOTIONAL (15 min)**

1. **"Descreva seu pior trade emocional. O que aconteceu nos primeiros 10 segundos?"**
   - *Busca:* Recognition latency
   - *Toma nota de:* Pausas; hesitação; ou resposta rápida/clara
   
2. **"Você já ignorou seu stop-loss? Por quê?"**
   - *Busca:* Loss aversion manifestation
   
3. **"Qual é o máximo de drawdown psicológico antes de parar de tradear?"**
   - *Busca:* Real tolerance vs. teórico
   
4. **"Descreva um trade que ganhou mas vendeu muito cedo."**
   - *Busca:* Disposition effect + narrative
   
5. **"Após 3 perdas seguidas, você quer entrar maior ou reduzir?"**
   - *Busca:* Revenge trading propensity
   
6. **"Como você diferencia 'confiança' de 'overconfidence'?"**
   - *Busca:* Metacognição
   
7. **"Pode descrever 3 padrões de erros que repete?"**
   - *Busca:* Pattern recognition em próprio behavior
   
8. **"Quando comete erro operacional, qual é seu primeiro pensamento?"**
   - *Busca:* Blame externalization

**Scoring Emocional:**
- Perguntas 1, 3, 7, 8 → Reconhecimento (A/B/C)
- Perguntas 2, 4, 5 → Regulação (1/2/3)
- Pergunta 6 → Locus (X/Y/Z)
- **Cálculo:** (Média dos 3) = Emotional Score

---

**SECTION 2: FINANCIAL (15 min)**

1. **"Qual é sua posição size ideal?"**
   - *Score:* Preciso + justificado = 80+; Vago = <50

2. **"Como calcula position size antes de entrar?"**
   - *Busca:* Fórmula mecânica vs. sensação

3. **"Se um trade vai 2% contra em 5 min, o que faz?"**
   - *Busca:* Stop-loss discipline

4. **"Descreva um trade que violou posição size. Por quê?"**
   - *Busca:* Trigger pattern

5. **"Qual foi seu pior período (drawdown)? Tempo de recuperação? Decisão que parou?"**
   - *Busca:* Reflexão honesta

**Data Extraction (do journal/platform):**
- Últimos 20 trades
- Win rate
- Avg winner vs. Avg loser
- Max drawdown
- Max consecutive losses

**Scoring Financeiro:**
- Risk Discipline: Q1, Q2 + data = Alpha/Beta/Gamma/Delta
- Loss Management: Q3, Q4, Q5 + max drawdown data = 1/2/3/4
- Profit Taking: Avg winner / Avg loser = H/M/L
- **Cálculo:** Média ponderada = Financial Score

---

**SECTION 3: OPERATIONAL (12 min)**

1. **"Como você identifica um trade: por dados/lógica ou padrão/intuição?"**
   - *Score:* S=75-100; D=60-75; I=<60

2. **"Qual é seu timeframe natural?"**
   - *Score:* Match com disponibilidade = 75-85; Mismatch = <50

3. **"Qual é seu nível de risco natural?"**
   - *Busca:* Intra-personal; correlaciona com financial dimension

4. **"Se encontrasse $100K tomorrow, como mudaria trading?"**
   - *Busca:* Personality estável vs. money-dependent

5. **"Qual é sua maior limitação operacional?"**
   - *Busca:* Self-awareness de mismatches

**Scoring Operacional:**
- Decision Mode (Q1) + Timeframe (Q2) + Risk (Q3) + Emotion (from Section 1)
- **Cálculo:** Média dos 4D = Operational Fit Score

---

**SECTION 4: EXPERIENCE (8 min)**

1. **"Quando começou a tradear? Quando começou com estratégia atual?"**
   - *Timeline indicator*

2. **"Quantas vezes mudou estratégia em 2024?"**
   - <1 = Stage 3+; 2-4 = Stage 2; >4 = Stage 1

3. **"Qual foi seu pior mês? Max drawdown + tempo recuperação?"**
   - Quantitativo para stage estimation

4. **"Descreva seus 3 principais erros e como evita."**
   - Vago = Stage 1; 1-2 identificados = Stage 2; 3+ = Stage 3+

5. **"O que há no seu journal? (frequência, detalhes, análise)"**
   - Não tem = Stage 1; Básico = Stage 2; Detalhado = Stage 3+

**Scoring Experiência:**
- Montar timeline
- Usar 5 questions para triangular stage
- **Cálculo:** Stage 1-5 → Score 0-100 (Stage X score = (X/5) × 100)

---

**POST-INTERVIEW (Mentor task, 15 min):**

1. Calculate all 4 dimension scores
2. Identify mismatches + red flags
3. Develop personalized roadmap (6 months)
4. Schedule first review (30 days)
5. Document in Firestore

---

## PARTE 11: EXEMPLOS PRÁTICOS (CASE STUDIES)

### Case 1: João (Day Trader, 10 months)

**Assessment Scores:**
- Emotional: 62 (Learner)
- Financial: 68 (Vulnerable)
- Operational: 65 (Mismatch: Day trading + Learner emotional)
- Experience: 35 (Stage 2, early)

**Composite: 59 → "Earnest Learner"**

**Red Flags:**
- Max drawdown: 18%
- Win rate: 48%
- Avg loser = Avg winner (ratio 1.0)
- Strategy changed 4x in 2024
- 12% rule violations

**Development Plan (6 months):**

| Month | Focus | Target | Measure |
|---|---|---|---|
| 1 | Emotional guardrails | +5-8 points | Post-loss 1h break compliance |
| 2-3 | Profit taking optimization | +8-10 points | Avg winner/loser → 1.5 |
| 4 | Strategy freeze | +5 points | 0 strategy changes |
| 5-6 | Consider swing transition | +15-20 points (combined) | Emotional score +20; Operational fit +15 |

**Interventions:**
1. Automated position sizing (no discretion in 1% size)
2. Mandatory break post-loss (enforced by app)
3. Profit target escalation: 1:1 → 1.5:1 → 2:1 (weekly target increase)
4. Strategy consistency audit: "Why did you change? What changed in market?" (journaling prompt)

**Expected Outcome (Month 6):**
- Emotional: 70-75 (SAGE boundary)
- Financial: 75-80 (SOLID)
- Operational: 75-80 (Good fit)
- Experience: 50-55 (Stage 2-3 boundary)
- **Composite: 72-75 → "Professional Learner"**

---

### Case 2: Maria (Swing Trader, 24 months)

**Assessment Scores:**
- Emotional: 78 (Sage)
- Financial: 82 (Solid-Fortified)
- Operational: 82 (Excellent fit)
- Experience: 70 (Stage 3, mid)

**Composite: 78 → "Committed Professional"**

**Strengths:**
- Consistent strategy; 10+ months without change
- Win rate 58%; Avg winner/loser 2.1
- Max drawdown 7%
- Journal detailed; daily post-trade analysis
- <1% rule violations

**Blockers:**
- Plateau in win rate (58% = realistic ceiling for setup)
- Scaling uncertainty: "Should I increase size?"
- Edge quantification: "How do I know my edge is real?"

**Development Plan (6 months → Stage 4):**

| Month | Focus | Target | Measure |
|---|---|---|---|
| 1-2 | Edge quantification | Advanced metrics | MFE/MAE analysis; Sharpe ratio |
| 2-3 | Scaling protocol | Position sizing rules | Risk escalation gate (20-trade rule-follow) |
| 3-4 | Strategy diversification | Secondary setup | Validate 2nd strategy on 50 trades |
| 5-6 | Advanced psychology | Resilience training | 100-trade mentoring journal |

**Interventions:**
1. Calculate MFE (Maximum Favorable Excursion) for each win → identify "could have been larger"
2. Model position sizing for leverage: 1.5:1 max until Sharpe >1.5
3. Backtest 2nd strategy to same rigor as primary
4. Structured mentoring: Weekly 1:1 focused on "What's your next edge?"

**Expected Outcome (Month 6):**
- Emotional: 80+ (stable)
- Financial: 85+ (Fortified)
- Operational: 85+ (Mastery fit)
- Experience: 80+ (Stage 4 gate ready)
- **Composite: 82-85 → "Professional Trader"**

---

### Case 3: Carlos (Scalp/Day Hybrid, 4 months, Struggling)

**Assessment Scores:**
- Emotional: 38 (Fragile)
- Financial: 42 (Critical)
- Operational: 48 (Severe mismatch: Scalp + Fragile emotional)
- Experience: 15 (Stage 1)

**Composite: 36 → "Struggling Gambler"**

**Red Flags:**
- Max drawdown: 32%
- Win rate: 32%
- Avg loser 3x Avg winner (reversed ratio)
- Strategy changed 8x in 4 months
- 45%+ rule violations
- Journal: spotty, defensive, blames market
- Revenge trading after losses (evident in trade sequence)

**IMMEDIATE ACTIONS:**
1. **Stop trading (hard pause)** — not ready for real capital
2. Mandatory demo/paper trading for 4 weeks
3. Psychological assessment referral (possible external emotional issues)
4. Reduced scale: max 1 trade/day; risk 0.5% until emotional score >60

**6-Week Recovery Plan:**

| Week | Focus | Gate | Metric |
|---|---|---|---|
| 1-2 | Paper trading + journaling | Daily compliance 100% | 14/14 days logged |
| 3-4 | Pattern identification (errors) | Self-awareness | 3+ patterns documented |
| 5-6 | Emotional regulation practice | Calm under pressure | Post-loss 1h break, 100% compliance |

**Check-in (Week 6):**
- Emotional score improved to >55?
- Strategy consistency (same setup all 6 weeks)?
- Rule compliance 100%?
- If YES → Resume real trading at 50% of original scale
- If NO → Extend pause; consider mentoring adjustment or role reassessment

---

## PARTE 12: TECHNICAL IMPLEMENTATION CHECKLIST

### 12.1 Database Setup

- [ ] Create `/students/{studentId}/assessment` document structure
- [ ] Create subcollections: `ongoing_tracking/monthly_reviews`, `progression_log`
- [ ] Add composite score indexes for mentor dashboard queries
- [ ] Create view: "Students needing review (>30 days since last)"

### 12.2 UI Components

- [ ] AssessmentInterview component (50-minute flow)
- [ ] TraderProfileCard (4-quadrant visualization)
- [ ] EvolutionRoadmap (6-month timeline)
- [ ] MonthlyReview form (1-min pulse check)
- [ ] MentorProgressDashboard (ranking + alerts)

### 12.3 Calculation Engine

- [ ] Emotional score calculation (3-part average)
- [ ] Financial score calculation (weighted by discipline + loss mgmt + profit taking)
- [ ] Operational fit calculation (4D average)
- [ ] Experience stage mapper (questions → stage 1-5)
- [ ] Composite score aggregation
- [ ] Progression gate validator (all conditions checked)

### 12.4 Data Pipelines

- [ ] Auto-extraction: Last 20 trades metrics (from trade ledger)
- [ ] Monthly aggregation: Win rate, drawdown, rule compliance
- [ ] Alert generation: If Emotional <50 + Trading = risk flag

### 12.5 Mentor Tools

- [ ] Ranking view (by composite, by dimension)
- [ ] Risk alert dashboard
- [ ] Progression readiness checker
- [ ] Intervention logging (coaching actions + outcomes)
- [ ] Export: Assessment report (PDF)

### 12.6 Student UX

- [ ] Explainer: What is Four-D Profile? (help text + visuals)
- [ ] Motivation: "Your profile → Your roadmap" (personalization)
- [ ] Progress visualization: Current vs. target (6-month projection)
- [ ] Community: Compare anonymized scores (peer context)

---

## PARTE 13: MÉTRICAS DE VALIDAÇÃO

### 13.1 Assessment Reliability

**Test-Retest Validity (repeat assessment after 2 weeks):**
- Expected correlation: r > 0.80 (high consistency)
- If <0.70: Refine questions

**Inter-rater Reliability (mentor A vs. mentor B):**
- Expected: 80%+ agreement on stage classification
- If <70%: Standardize interview protocol

### 13.2 Predictive Power

**Hypothesis 1:** Emotional score > 60 + Financial score > 70 → Progression probability to Stage 3 within 12 months > 75%

**Hypothesis 2:** Composite score > 75 → Average monthly return > 5%; Sharpe > 1.0

**Hypothesis 3:** Operational fit < 65 → Burnout/quit-trading probability > 40%

**Measure quarterly; adjust framework if validation fails.**

---

## PARTE 14: CONCLUSÃO & ROADMAP

### 14.1 Implementation Timeline

| Phase | Timeline | Deliverable |
|---|---|---|
| **Phase 1** | Weeks 1-4 | Database schema + Firestore setup |
| **Phase 2** | Weeks 5-8 | Core UI components (Assessment, Profile Card) |
| **Phase 3** | Weeks 9-12 | Calculation engine + Mentor Dashboard |
| **Phase 4** | Weeks 13-16 | Integration with trade ledger + Auto-extraction |
| **Phase 5** | Weeks 17-20 | Beta: 10 students, full assessment cycle |
| **Phase 6** | Weeks 21-24 | Validation + Framework refinement |
| **Phase 7** | Week 25+ | Full rollout + ongoing monitoring |

### 14.2 Success Criteria

✅ **Assessment Adoption:**
- 100% of students complete initial 4D assessment within 1 week of onboarding
- 90%+ monthly review completion (30-day intervals)

✅ **Progression:**
- 60%+ of Stage 2 students progress to Stage 3 within 18 months
- 80%+ follow development roadmap recommendations

✅ **Outcome Improvement:**
- Students in top quartile (composite >75) show 25%+ higher profitability
- Students with operational fit >70 have 50% lower quit rate
- Burnout indicators (emotional <50 + stressed) trigger intervention within 5 days

### 14.3 Next Steps

1. **Review with stakeholders:** Validate framework against Acompanhamento 2.0 philosophy
2. **Pilot with 5 students:** 4-week assessment + feedback loop
3. **Refine questions:** Based on pilot interviews
4. **Build assessment UI:** Production-ready, mobile-friendly
5. **Train mentors:** Interview protocol + scoring standards
6. **Launch:** Phased rollout; monitor reliability metrics
7. **Iterate:** Quarterly framework reviews; adjust gates/scoring as data accumulates

---

**END OF FRAMEWORK DOCUMENT**

---

## APÊNDICE A: Referências Bibliográficas Integradas

1. **Kahneman, D. & Tversky, A. (1979).** Prospect Theory: An Analysis of Decision under Risk. *Econometrica*, 47(2), 263-292.
   - Foundation for loss aversion, framing, reference points

2. **Barberis, N. & Thaler, R. (2003).** A Survey of Behavioral Finance. *Handbook of the Economics of Finance*.
   - Limits to arbitrage, psychological biases, investor behavior

3. **Shefrin, H. (1999).** Beyond Greed and Fear: Understanding Behavioral Finance and the Psychology of Investing.
   - Mental accounting, disposition effect, trader psychology

4. **Steenbarger, B. (2006).** Enhancing Trader Performance: Proven Strategies from the Cutting Edge of Trading Psychology.
   - Edge quantification, performance coaching, trader development

5. **Freeman-Shor, N. (2015).** Trader Psychology and Performance in Financial Markets.
   - Behavioral biases specific to traders (disposition, confirmation, optimism)

6. **TPI (Trader Personality Indicator, 16Traders).** Scientific assessment of trading personality across 4 dimensions.
   - Decision Mode, Time Preference, Risk Attitude, Emotion Control

7. **Risk Type Compass (Psychological Consultancy, UK).** Risk Type and trading performance correlation.
   - Evidence of $6.4M performance increase via coaching based on Risk Type

---

*Framework Version 1.0 — March 2026*
*Designed for Acompanhamento 2.0 Mentoship Platform*
