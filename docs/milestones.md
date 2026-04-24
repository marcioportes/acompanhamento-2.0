# Milestones — Acompanhamento 2.0



### v1.1.0 — Espelho Self-Service
**Foco:** Dois tiers (self-service + Alpha), rename externo, Node.js migration, stability fixes
**Prioridade:** CRÍTICA — migração do grupo ativo (48 alunos) em andamento
**GitHub Milestone:** `v1.1.0 - Espelho Self-Service` (12 issues)

Issues:
- `#118` arch: Barra de Contexto Unificado — Conta/Plano/Ciclo/Período persistente
- `#116` epic: Onboarding Automatizado — CSV → indicadores → Kelly → plano sugerido
- `#114` feat: Breakeven threshold configurável no compliance
- `#111` debt: Padronização de exibição de moeda em todo o sistema
- `#107` fix: CSV Import — parse silencioso quando formato não reconhecido
- `#100` epic: Espelho — Modo Self-Service (tier self-service + rename externo)
- `#93`  feat: Order Import v1.1 — Modo Criação
- `#91`  debt: Mentor editar feedback já enviado
- `#90`  fix: Screen flicker CSV staging activation
- `#64`  refactor: Dashboard Aluno — Refatorar tabela SWOT
- `#52`  epic: Gestão de Contas em Mesas Proprietárias (Prop Firms)
- `#48`  refactor: Student Emotional Detail — Reorganizar UX
- `#3`   epic: Dashboard-Aluno MVP — Redesign com contexto unificado e views reativas

Sub-tarefas (#100):
- C1: Campo `mentorshipTier` no student
- C2: UI condicional — esconder funcionalidades Alpha para self-service
- C3: Dashboard self-service — ajustes de layout
- C4: Rename externo — Espelho (title, logo, textos UI)
- C5: Custom domain — app.marcioportes.com.br

### v1.2.0 — Mentor Cockpit
**Foco:** Dashboard mentor consolidado (Torre de Controle) + revisão semanal + performance
**GitHub Milestone:** `v1.2.0 - Mentor Cockpit` (16 issues)

Épico guarda-chuva: `#101` epic: Dashboard Mentor — Torre de Controle

Issues:
- `#119` feat: Maturidade — barra de evolução por gate com progressão baseada em trades
- `#115` feat: Desvio padrão dos resultados como métrica de consistência operacional
- `#113` feat: Overtrading — detecção por clustering temporal (substituir maxTradesPerDay)
- `#112` epic: Módulo Swing Trade — Gestão de Carteira e Indicadores de Portfolio
- `#110` feat: Curva de Patrimônio — agrupamento por moeda, benchmark, guard multi-ciclo
- `#109` feat: FeedbackPage — rascunho de revisão semanal por trade
- `#108` feat: FeedbackPage — mentor override de emoção declarada pelo aluno
- `#106` feat: PlanLedgerExtract — rename, acumulado do período e resumo de trades
- `#103` feat: Performance — visão analítica retrospectiva (SWOT IA, Stop por Motivo)
- `#102` feat: Revisão Semanal — modo revisão do PlanLedgerExtract

#### #102 — Revisão Semanal: Design consolidado (02/04/2026)

**Princípio arquitetural:** a Revisão Semanal é um **modo do PlanLedgerExtract**, não uma tela separada. O extrato do plano é a fundação — os subitens são camadas ativadas em contexto de revisão.

**Evento de criação:** botão "Criar Revisão" dispara CF `createWeeklyReview` que:
1. Congela snapshot dos KPIs (WR, RR, Payoff, EV, compliance, drawdown)
2. Calcula ranking top 3 piores/melhores trades
3. Gera SWOT do aluno via chamada IA (custo controlado pelo trigger explícito)
4. Persiste tudo em `students/{id}/reviews/{reviewId}` com status `open`

**Subitens (pós-criação, preenchidos pelo mentor no frontend):**
1. Seleção de Trades — default: trades da semana. Período ajustável.
2. Comparação de Indicadores — snapshot congelado da revisão anterior vs snapshot atual (DEC-045).
3. SWOT do Aluno — gerado pela CF no momento da criação da revisão.
4. Notas de Sessões — últimas sessões fechadas + sessão aberta em andamento.
5. Takeaways — itens de ação com checkbox (completo / aberto).
6. Ranking de Trades — top 3 piores + top 3 melhores (congelados no snapshot).

**Camadas adicionais:**
7. Evolução de Maturidade — perfil 4D atual vs marco zero. Progressão/regressão via trades.
8. Navegação contextual — acesso direto à conta e plano do aluno sem sair da revisão.

**Modelo de dados (Firestore):**
```
students/{studentId}/reviews/{reviewId}
  createdAt, planId, cycleNumber, period: { start, end }
  snapshot: { wr, rr, payoff, ev, compliance, drawdown, ... }
  topTrades: { worst: [3], best: [3] }
  swot: { strengths, weaknesses, opportunities, threats }
  meetingNotes, zoomLink, zoomSummary
  takeaways: [{ text, completed: bool }]
  status: open | closed
```

**DEC-045:** Snapshots de revisão semanal são independentes do fechamento de ciclo (#72). Revisão congela indicadores parciais para comparação longitudinal semana a semana. Ciclo congela o consolidado final. Sem dependência entre eles.

- `#94`  feat: Controle de Assinaturas da Mentoria → **FECHADO** (v1.23.0)
- `#72`  epic: Fechamento de Ciclo — Apuração, Transição e Realocação
- `#70`  feat: Dashboard Mentor — Template na inclusão de Ticker
- `#45`  refactor: Dashboard Mentor — Aba "Precisam de Atenção" → **FECHADO** (absorvido pelo Ranking por Aluno, Torre de Controle)
- `#31`  feat: Dashboard Mentor — Preset de Feedback Semântico

`#1` refactor: Configurações — Upload Seed → **FECHADO** (não relevante, DEC-041)

#### Torre de Controle — Design (DEC-042, 29/03/2026)

**Header KPIs (4 cards):**
- Revisões Pendentes (trades com feedback pendente + revisados sem fechar)
- Alertas (com direção ▲▼ vs ontem)
- Fora do Plano (compliance < 80% no ciclo)
- Pendências Operacionais (staging, inativos 7d+, assessment pendente)

**Seções:**
- Ranking por Aluno: top-5 piores do dia com badges de causa (VIOLAÇÃO purple-flag, TILT/REVENGE/SEM STOP red, PÓS-META yellow)
- Ranking por Causa: causas agregadas + contagem alunos + diagnóstico coletivo no rodapé (60%+ mesma causa = alerta de mercado)
- Fora do Plano: compliance ciclo + pior regra violada (NO_STOP/RISK_EXCEEDED/RR_BELOW_MINIMUM) + evolução meta + dias em dívida
- Stop vs Gain: barras semanais agregadas da turma + badge liquidez
- Visão Rápida por Aluno: painel lateral com KPIs + flags ativas + eventos ciclo

**Sidebar Mentor:**
- Torre de Controle (operacional, diário)
- Performance (analítico, retrospectivo — #103)
- Fila de Revisão (individual — #102)
- Alunos / Assinaturas / Configurações

**Flags disponíveis para a torre (Fase A — dados existentes):**
- Compliance: NO_STOP, RISK_EXCEEDED, RR_BELOW_MINIMUM (`compliance.js`)
- Comportamental: TILT_DETECTED, REVENGE_DETECTED (`emotionalAnalysisV2.js`)
- Plano/Ciclo: META, PÓS-META, STOP, PÓS-STOP/VIOLAÇÃO (`planLedger.js`)
- Não implementadas: NO_PLAN, DAILY_LOSS_EXCEEDED, BLOCKED_EMOTION

**Fases:**
- Fase A: dados existentes (compliance, planLedger, emotionalAnalysisV2)
- Fase B: Behavioral Detection Engine (Prioridade do Dia com recomendações, futuro)

### Portal marcioportes.com.br (Maio-Junho 2026)
**Foco:** Landing page institucional + Fibonaccing + Diagnóstico Comportamental
**Documento de referência:** `docs/marcioportes_portal_v2_0.md`

Fases:
- Fase 1: Landing page MVP (Next.js, Vercel, domínio principal)
- Fase 2: Seção Fibonaccing (curadoria 100h+ conteúdo existente)
- Fase 3: Diagnóstico Comportamental público (lead magnet com IA)

---

