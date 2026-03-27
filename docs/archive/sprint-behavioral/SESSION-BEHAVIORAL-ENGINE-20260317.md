# SESSION: Motor de Detecção Comportamental + Sistema de Notas
## Sessão 16-17/03/2026 — Consolidação Arquitetural Completa

---

## 1. CONTEXTO E MOTIVAÇÃO

### 1.1 Problema Central

O aluno reporta trades com viés de auto-percepção (WYSIATI — Kahneman). A emoção declarada não necessariamente corresponde à emoção que governou a decisão. O campo "observação" pode conter narrativas pós-hoc racionalizando decisões emocionais. O mentor hoje depende exclusivamente do que o aluno *escolhe* revelar.

**Caso real motivador:** Aluno opera 80+ trades/dia, nunca toma stop. KPIs inflados artificialmente (aparenta performance positiva). Sem import de ordens e cross-check, o mentor não consegue detectar que o aluno está carregando risco ilimitado em cada trade — padrão Douglas de "recusar aceitar a perda definida". Os KPIs só colapsam no dia do drawdown catastrófico.

### 1.2 Proposta

Implementar um **Motor de Detecção Comportamental** em camadas que cruze campos existentes do trade (e futuramente ordens importadas) para identificar **incongruências** — o delta entre o que o aluno diz e o que os dados mostram. O sistema não acusa — levanta questões para o mentor.

### 1.3 Integração com Framework Evolutivo 4D

O motor alimenta diretamente o `trader_evolution_framework.md`:
- **Stage 1 (Caos):** sinais massivos na Camada 1 — trades sem stop, overtrading, sizing errático
- **Stage 2 (Reativo):** aluno conhece vocabulário, detectar dissonância texto × dados (Camada 3)
- **Stage 3 (Metódico):** regressões sob estresse — anomalias estatísticas (Camada 2)
- **Stage 4-5:** refinamento sutil — cortar winners, evitar setups válidos

---

## 2. DECISÕES DE SISTEMA DE NOTAS (FECHADAS)

### 2.1 Lacuna 1 — Emocional: faixa 50-64

**DECISÃO:** Criar 4º label **DEVELOPING** (50-64).

Escala final:
| Range | Label | Descrição |
|-------|-------|-----------|
| 85-100 | SAGE | Consciência plena + autocontrole |
| 65-84 | LEARNER | Consciente, precisa de estrutura |
| 50-64 | DEVELOPING | Em transição, sinais de progresso |
| <50 | FRAGILE | Alta reatividade, defensivo |

### 2.2 Lacuna 2 — Operacional: labels criados

**DECISÃO:** Criar labels para dimensão operacional (proposta aceita).

| Range | Label |
|-------|-------|
| 85-100 | MASTERY FIT |
| 70-84 | GOOD FIT |
| 50-69 | PARTIAL FIT |
| <50 | MISMATCH |

### 2.3 Lacuna 3 — Operacional: sub-dimensões normalizadas

**DECISÃO:** Preencher gaps nas sub-dimensões.

**Timeframe (corrigido):**
- Fit excelente: 85-100 (timeframe ideal para perfil)
- Fit bom: 70-84 (ajustes menores)
- Fit parcial: 50-69 (funciona mas com fricção)
- Mismatch: <50 (incompatível)

**Risk Attitude (scores definidos):**
- Conservative: 80 (disciplinado, pode subescalar)
- Moderate: 75 (balanceado)
- Aggressive: 50 (arriscado, requer guardrails)
- Nota: score ajustado por match com perfil emocional — Aggressive + Fragile = penalty

### 2.4 Lacuna 4 — Experiência: score contínuo

**DECISÃO:** Score por % de gates cumpridos do próximo stage (automático).

**Fórmula:**
```
experienceScore = stageBase + (gatesCumpridos / gatesTotal) × faixaDoStage
```

| Stage | Base | Faixa | Range Efetivo |
|-------|------|-------|---------------|
| 1 (Chaos) | 0 | 20 | 0-19.9 |
| 2 (Reactive) | 20 | 20 | 20-39.9 |
| 3 (Methodical) | 40 | 20 | 40-59.9 |
| 4 (Professional) | 60 | 20 | 60-79.9 |
| 5 (Mastery) | 80 | 20 | 80-100 |

Gates do Stage 3 (8 critérios): Emocional ≥55, Financeiro ≥70, Operacional ≥65, estratégia 8 semanas, journal ≥90%, compliance ≥95%, win rate ≥45%, RR ≥1.2.

Exemplo: Stage 2, 5 de 8 gates cumpridos → `20 + (5/8 × 20) = 32.5`

### 2.5 Lacuna 5 — Composite: labels formalizados

**DECISÃO:** Formalizar labels dos case studies.

| Range | Label | Ação |
|-------|-------|------|
| 80-100 | PROFESSIONAL TRADER | Escalar, diversificar |
| 65-79 | COMMITTED LEARNER | Refinar, preparar progressão |
| 40-64 | DEVELOPING TRADER | Estruturar, monitorar |
| <40 | AT RISK | Pausa recomendada, intervenção imediata |

### 2.6 Lacuna 6 — Assessment em 2 estágios

**DECISÃO:** Pipeline IA + Mentor.

**Estágio 1 — Questionário autoaplicável (aluno responde sozinho):**
- ~34 perguntas: mix de fechadas (5 alternativas) e abertas (texto livre)
- Alternativas de múltipla escolha com **ordem randomizada** a cada aplicação
- Pesos das alternativas NÃO visíveis para o aluno
- Respostas abertas classificadas por IA (API Claude)
- Discrepância fechada × aberta = flag de incongruência
- Tempo: 25-35 minutos

**Estágio 2 — Validação pelo mentor (entrevista 20-30 min):**
- Mentor recebe relatório pré-assessment com scores propostos
- Investiga incongruências flagadas pela IA
- Override com justificativa registrada
- Sistema guarda score_IA e score_mentor para calibração

**Randomização de alternativas:**
- As 5 opções de cada pergunta fechada são embaralhadas a cada apresentação
- O mapeamento opção→score é mantido no backend, nunca exposto ao frontend
- Impede que o aluno identifique padrão "primeira opção = melhor score"

---

## 3. TAXONOMIA DE SINAIS POR CAMPO EXISTENTE

### 3.1 Sinais Temporais

**Campos:** `openedAt`, `closedAt`, duração derivada, horário, dia da semana

| Sinal | Detecção | Threshold Sugerido | Severidade |
|-------|----------|--------------------|------------|
| **Revenge Trading** | `openedAt[n+1] - closedAt[n]` após loss | < 2 minutos | CRÍTICA |
| **Overtrading Compulsivo** | Frequência intra-dia > 3σ da média pessoal | Z-score > 3.0 | ALTA |
| **Overtrading Absoluto** | Trades/dia > threshold absoluto configurável | > 50 trades/dia (configurável por mentor) | ALTA |
| **Horário Anômalo** | Trade fora do horário do mercado declarado | Fora do range configurado | MÉDIA |
| **Clustering Temporal** | 5+ trades em 20min quando média é 2-3/sessão | > 2.5× média | ALTA |
| **Padrão Sexta/Pré-feriado** | Aumento de frequência ou risco pré-fechamento | > 1.5× média normal | MÉDIA |

### 3.2 Sinais de Sizing

**Campos:** `quantity`, `contractSize`, risco derivado vs. conta

| Sinal | Detecção | Threshold Sugerido | Severidade |
|-------|----------|--------------------|------------|
| **Escalada Pós-Loss (Martingale)** | `quantity[n] > quantity[n-1]` quando `result[n-1]` = loss | Aumento > 50% | CRÍTICA |
| **Inconsistência com Plano** | Sizing implica risco > plano definido | Risco efetivo > 1.5× planejado | ALTA |
| **Redução Pós-Win** | Quantidade diminui após sequência positiva | Redução > 30% pós-win streak | BAIXA (informativo) |

### 3.3 Sinais de Gestão de Risco

**Campos:** `stopLoss`, `takeProfit`, `result`, `exitPrice`, campos de compliance

| Sinal | Detecção | Threshold Sugerido | Severidade |
|-------|----------|--------------------|------------|
| **Stop Ausente Recorrente** | % de trades sem stop no período | > 20% dos trades | ALTA |
| **NEVER-STOP Pattern** | 0% de stops em N+ trades consecutivos | 0 stops em últimos 20+ trades | CRÍTICA |
| **Stop Movido Contra** | `exitPrice` além do `stopLoss` registrado | Qualquer ocorrência | CRÍTICA |
| **RR Efetivo < Planejado** | `avgWinnerEfetivo / avgLoserEfetivo` < RR declarado | Efetivo < 60% do planejado | ALTA |
| **Breakeven Compulsivo** | Frequência de saídas em BE > estatisticamente esperado | > 2σ acima da média | MÉDIA |
| **Cortar Winners** | % de trades fechados antes do target declarado | > 40% dos winners | ALTA |
| **KPI Inflation** | Win rate alta + stop ausente + sem max loss definido | Combinação de flags | CRÍTICA |

### 3.4 Sinais Emocionais Cruzados

**Campos:** `emotionEntry`, `emotionExit`, `result`

| Sinal | Detecção | Implicação |
|-------|----------|------------|
| **Dissociação** | Confiante → loss → "Tranquilo" | Não está processando a perda |
| **Reforço Inverso** | Ansioso → win → Eufórico | Ansiedade sendo "premiada" |
| **Alexitimia Operacional** | >90% emoções iguais | Campo emocional virou checkbox automático |
| **Entropia Baixa** | Shannon entropy < 1.0 nas últimas 20 emoções | Baixa qualidade de auto-observação |
| **Deriva Intra-Sessão** | Trajetória descendente de emoções no dia | Deterioração progressiva do estado |

### 3.5 Sinais Textuais (Campo Observação) — NLP

| Sinal | Padrão Linguístico | Implicação |
|-------|-------------------|------------|
| **Externalização** | "O mercado me tirou", "Não tinha como prever" | Stage 1 — sem agency |
| **Auto-flagelação** | "Sou burro", "Nunca vou aprender" | Ciclo shame-based destrutivo |
| **Racionalização Pós-hoc** | Justificativa elaborada em trade perdedor | Decisão emocional com narrativa construída |
| **Ausência Seletiva** | Campo vazio em losses, preenchido em wins | Evitação de confrontar perdas |
| **Contradição Texto × Dados** | "Segui o plano" + trade sem stop ou sizing errado | Gold standard de detecção |

### 3.6 Sinais de Ordens (Requer CHUNK-10)

| Sinal | Detecção | Implicação |
|-------|----------|------------|
| **Ordens Canceladas** | Ordem colocada e removida | Hesitação, medo, indecisão |
| **Ordens Modificadas** | 3+ modificações na mesma ordem | Cada modificação = evento emocional |
| **Discrepância Narrativa × Execução** | Market order com narrativa de "pullback" | Fato vs. ficção |
| **Market Order Predominante** | >70% market orders | FOMO/urgência emocional |
| **Slippage Anômalo** | Slippage > 2× benchmark | Entries impulsivas |
| **Ghost Orders** | Ordem executada sem trade correspondente | Sub-registro intencional |

### 3.7 Cross-Check KPI (NOVO — motivado pelo caso real)

| Sinal | Detecção | Severidade |
|-------|----------|------------|
| **KPI sem Stop** | Win rate > 60% AND stop_usage = 0% | CRÍTICA |
| **Volume Anômalo** | Trades/dia > 3σ de peers no mesmo mercado | ALTA |
| **Risco Ilimitado** | 0 stops + high frequency = catástrofe iminente | CRÍTICA+ |
| **P&L Irreal** | Win rate × avg_win vs. mercado = estatisticamente improvável | ALTA |
| **Drawdown Latente** | Max adverse excursion intra-trade sem stop = risco real oculto | CRÍTICA |

---

## 4. ARQUITETURA EM CAMADAS

### 4.1 Camada 1 — Regras Determinísticas (sem IA)
Custo zero. Lógica pura. Flags binários. Roda em CF ou client-side.

### 4.2 Camada 2 — Análise Estatística (sem IA)
Z-scores, tendências, anomalias. Batch. Compara aluno consigo mesmo.

### 4.3 Camada 3 — NLP sobre Campo Texto (com IA)
Análise de sentimento, externalização, contradição. API Claude. Batch ou on-demand.

### 4.4 Camada 4 — Vision sobre Screenshots (com IA)
Análise do gráfico vs. narrativa. Fase futura.

### 4.5 Output Unificado
- Behavioral Risk Score por trade
- Behavioral Trend Report por período
- Dashboard mentor com alertas priorizados
- Cross-check de KPIs com flags compostos

---

## 5. ESTADO PRÉ-ONBOARDING (Expandido)

### 5.1 State Machine do Aluno

```
LEAD (fora do sistema)
  │ Contato via canal orgânico
  ▼
CANDIDATO (pré-admissão)
  │ Ficha autopreenchida + últimos 20 trades (opcional)
  ▼
PRE_ASSESSMENT (criado no sistema, sem scores)
  │ Questionário autoaplicável (Estágio 1 — IA)
  ▼
ASSESSMENT_IN_PROGRESS (IA processou, mentor validando)
  │ Entrevista de validação (Estágio 2 — Mentor)
  ▼
ASSESSED (marco zero registrado)
  │ Baseline + roadmap gerado
  ▼
ACTIVE (acompanhamento ativo — loop de tracking)
```

### 5.2 Campo Firestore

```javascript
// students/{studentId}
{
  onboardingStatus: "lead" | "pre_assessment" | "ai_assessed" | "mentor_validated" | "active",
  // ...
}
```

### 5.3 Regra: aluno só registra trades quando status = "active"

---

## 6. DECISÕES DE PARALELISMO

### 6.1 Frentes Identificadas

| Frente | Escopo | Independência |
|--------|--------|---------------|
| **Setup Inicial / Onboarding** | Assessment 2 estágios, marco zero | Total |
| **Importação de Ordens** | Pipeline de ordens brutas, cross-check | Total |
| **Detecção Comportamental (Camada 1)** | Flags determinísticos | Parcial (beneficia de ordens) |
| **Alertas de Ciclo / Compliance** | Fechamento, feedback pendente | Parcial |

### 6.2 Sequência: Onboarding + Ordens em paralelo → Detecção + Alertas depois

### 6.3 Protocolo: CHUNK-REGISTRY com locking pessimista

---

## 7. RISCOS E MITIGAÇÕES

| Risco | Mitigação |
|-------|-----------|
| False positives na detecção | Sistema levanta questões, não acusa. Mentor decide. |
| Gaming do questionário | Alternativas randomizadas + cross-check abertas × fechadas |
| Gaming dos inputs de trade | Import de ordens torna gaming impossível (dados brutos) |
| Custo de API (Camadas 3-4) | Batch com sampling (só analisa trades com flags L1-L2) |
| KPI inflation sem stops | Cross-check composto: win rate × stop usage × frequency |
| Calibração IA vs. Mentor | Sistema guarda ambos scores para comparação longitudinal |

---

*Documento consolidado em 17/03/2026*
*Referência: trader_evolution_framework.md v1.0*
*Caso real motivador: aluno 80+ trades/dia, 0 stops, KPIs inflados*
