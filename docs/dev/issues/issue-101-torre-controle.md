# Issue #101 — Torre de Controle (Dashboard Mentor v2 · tela operacional)

> **Doc de controle + SSoT** da tela operacional do epic #101. Interativo.
> **Branch:** `feat/issue-101-torre-controle` · **Worktree:** `~/projects/issue-101`
> **Versão reservada:** 1.84.0 (feature=minor sobre 1.83.33, última consumida no #402) · **Chunk:** CHUNK-16 (ESCRITA)
> **Âncora visual:** `docs/dev/mentor-dashboard-v2-mockup.png`
> **Abordagem (D8, 27/08/2026):** a Torre é construída como **destino próprio** — `activeView`
> novo + item de sidebar — e ganha uma seção por fase. O overview v1 fica **intocado até a
> Fase D**. Navegação por ESTADO, não por rota: `MentorDashboard` resolve `currentView` via
> `viewMapping` (`src/pages/MentorDashboard.jsx:103`); `react-router` só é usado no onboarding
> do aluno.
> **Status:** PRÉ-ABERTURA concluída — Gate Pré-Código ok — **sem código de feature.**
> **Nota de marca:** o mockup exibe "TITCHIO ALPHA" (nome de código antigo). Implementar com a
> identidade pública **Espelho** (DEC-031) — não replicar o logo/nome do mockup.
> **PR:** NÃO usar `Closes #101` (fecharia o epic e arrastaria #103/#72/#70/#31). Fechar a
> tela no encerramento sem tocar os filhos do epic.

---

## 1. Contexto & objetivo

O Dashboard Mentor atual (`src/pages/MentorDashboard.jsx` v1.6.0) é a tela v1. A **Torre de
Controle** é a v2 (design 29/03/2026): a visão operacional **do dia** — quem precisa de ação
AGORA, por quê, e com que urgência.

- **Torre = operacional / hoje** (esta issue). "O que eu faço agora."
- **Performance (#103) = analítico / retrospectivo** (tela irmã, fora daqui): SWOT, Stop por Motivo.

Destravou porque o motor comportamental (`functions/behavior/*`, CHUNK-11 #301/#305) existe.

---

## 2. Escopo IN — a torre operacional

| # | Seção | Papel |
|---|-------|-------|
| S1 | **Header (4 tiles)** | Alunos Ativos · Alertas · Fora do Plano · Metas |
| S2 | **Prioridade do Dia** | Top-N que exigem ação HOJE + recomendação |
| S3 | **Radar de Risco** | Ranking aluno × impacto × gatilho × recência |
| S4 | **Fora do Plano** | Ranking aluno × % + regra pior + direção |
| S5 | **Stop vs Gain** | Barras semanais agregadas (turma) + liquidez |
| S6 | **Visão Rápida por Aluno** | Painel lateral: saldo/líquido, meta, DD, winrate + flags |

Sidebar: Torre · Fila de Revisão (#102 ✅) · Alunos · Assinaturas (#94 ✅) · Configurações.

---

## 3. Escopo OUT

- **SWOT da Turma** + **Stop por Motivo (donut)** → **#103 Performance** (movidos em 29/03).
- **Fechamento de Ciclo** (#72, já coberto por #259). **Template Ticker** (#70). **Preset Feedback** (#31).
- **Sem persistência nova** (INV-15): a torre é camada de leitura/agregação. Se a memória de
  cálculo exigir gravar algo, vira decisão explícita antes de codar.

---

## 4. Achado arquitetural (define o build)

**Nada da torre é pré-agregado ou persistido.** Toda métrica é recomputada on-the-fly por
aluno, a partir de `trades`/`plans` carregados individualmente. Não existe:
- agregador de turma para risco/compliance/PNL por aluno ativo;
- agregação diária de risco;
- métricas cruas (`complianceRate`, `ruleViolationRate`, `winRate`, `maxDDPercent`) top-level
  no `maturity/current` — ficam embutidas em `gates[]`/`breakdown`, teria que recalcular;
- flags TILT/REVENGE ao nível aluno — recalculadas por `analyzeEmotionsV2(trades)`.

**Mas o enabler está lá:** o cliente do mentor **já carrega `allTrades` de todos os alunos**
(`useTrades().allTrades`, hoje `getUniqueStudents()` deriva a turma disso). Somando `usePlans`,
`useSubscriptions` (collectionGroup) e `useMentorMaturityOverview`, o mentor **já tem em memória
todo o insumo**. A torre é um **fan-out client-side** que agrupa `allTrades` por aluno e reusa os
utils SSoT existentes. **Zero persistência nova no MVP.** Custo real = CPU/memoização (rodar
`analyzeEmotionsV2` + `buildPlanLedger` por aluno × N alunos por render) → exige `useMemo` forte.

**Coração de build:** 1 hook `useMentorRiskRadar(allTrades, plans, subs)` que produz, por aluno
ativo, o registro agregado que alimenta S1/S2/S3/S4/S6.

---

## 5. Memória de cálculo (campos canônicos reais)

> **Todas as Q resolvidas nos defaults (aprovado 27/07 — ver bloco 8). Nenhum ⚠️ pendente.**
> Convenção de "hoje" = trades com `date === hoje` (`entryTime.split('T')[0]`, YYYY-MM-DD).
> Multi-moeda: liquidez normalizada em R (D6); demais agregações via `aggregateTradesByCurrency`.

### MC-1 · Header "Alunos Ativos"
- **Input:** `useSubscriptions().stats.active` = `enriched.filter(s => deriveStatus(s)==='active')`.
- **Atenção:** coexistem 2 definições de "ativo" — `deriveStatus==='active'` (exclui overdue/paused)
  vs `classifyStudent`/`findActiveSub` (só exclui cancelled/expired). Torre usa a estrita (D7).
- **Ex.:** mockup = 20.

### MC-2 · Header "Alertas" (D1)
- nº de alunos com ≥1 **flag efetiva HOJE**, onde flag efetiva = `effectiveRedFlags(trade)`
  (aplica `mentorClearedViolations`) **∪** evento emocional `TILT_DETECTED`/`REVENGE_DETECTED`
  de `analyzeEmotionsV2(tradesHoje).complianceEvents`.
- **Fórmula:** `alertas = alunosAtivos.filter(a => temFlagEfetivaHoje(a)).length`. Dedup por aluno.
- **Ex.:** mockup = 5.

### MC-3 · Header "Fora do Plano" (contagem · D2)
- **Por aluno:** `foraPct = 100 - calculateComplianceRate(tradesHojeDoAluno).rate`.
- **Contagem:** alunos com `foraPct > 0` (qualquer violação efetiva hoje).
- **Ex.:** mockup = 7.

### MC-4 · Header "Metas" (D3)
- "N metas" = planos ativos com `plan.periodGoal`; "%" = média de
  `summarizeLedger(buildPlanLedger(trades,plan),plan).progressPercent` (janela = período/semana).
- **Ex.:** mockup = "12 Metas · 75%".

### MC-5 · Prioridade do Dia (Ação Imediata · D4)
- **3 gatilhos críticos:** (a) **Dia de Fúria** = `analyzeEmotionsV2` emite
  `TILT_DETECTED`/`REVENGE_DETECTED` hoje; (b) **risco no trade atual** = trade OPEN hoje com
  `riskPercent > plan.riskPerOperation` (red flag `RISCO_ACIMA_PERMITIDO`); (c) **loss diário** =
  `DAILY_LOSS_EXCEEDED` / drawdown `DAILY_LOSS_HIT`.
- **Ordenação:** por score de severidade (soma dos `EVENT_PENALTIES` das flags ativas, desc).
- **Recomendação (mapa gatilho→ação):** TILT/loss diário → "Bloquear conta / Call urgente";
  risco no trade → "Alertar no WhatsApp".
- **Ex.:** Rodrigo (3 perdas consec.) → Bloquear; Ana (risco > 2%) → Alertar.

### MC-6 · Radar de Risco (impacto · gatilho · tempo)
- **Universo:** alunos com flag efetiva hoje que NÃO entraram na Prioridade (severidade < crítica),
  OU todos com "Ver todos".
- **Impacto:** `ALTO` se score de severidade ≥ threshold_alto; senão `MÉDIO` (calibrar; proposta
  ALTO ≥ 15, MÉDIO ≥ 5 sobre soma de `EVENT_PENALTIES`).
- **Gatilho:** rótulo legível da flag dominante (`RED_FLAG_TYPES`/família do `behaviorProfile` → PT).
- **Tempo (recência):** `agora - trade.exitTime` da flag mais recente ("10 min", "2h").
- **Ex.:** Rodrigo ALTO/Estouro de Risco/10min; Ana MÉDIO/Overtrading/2h.

### MC-7 · Fora do Plano — % por aluno (ranking · D5)
- **%:** `100 - calculateComplianceRate(tradesDoAluno).rate` (janela = **semana corrente**).
- **Regra pior:** moda dos `type` em `effectiveRedFlags` (`RED_FLAG_TYPES` → rótulo PT).
- **Direção (↗/↘/—):** % da semana atual vs semana anterior.
- **Ex.:** Rodrigo 23% / Violou VWAP / ↗.

### MC-8 · Stop vs Gain (barras semanais + liquidez · D6)
- **Sem `closeReason`.** Derivar por `sign(trade.result)`: `gain` se `result>0`, `stop/loss` se
  `result<0` (breakeven `=0` fora das barras). "Sem stop formal" = `!trade.stopLoss`.
- **Barras:** por dia da semana (Seg–Sex, semana corrente), eixo = **contagem de trades**
  (verde=gains, vermelho=losses).
- **Liq:** líquido da semana em R = `Σ result / (plan.pl · riskPerOperation/100)` (normaliza moeda).
- **Ex.:** "Liq: +2.3R".

### MC-9 · Visão Rápida por Aluno (painel lateral)
- **Saldo atual:** `computeCurrentPl(plan, trades)` = `plan.pl + computeCycleBalance`.
- **Líquido (R):** `computeCycleBalance(plan, trades) / (plan.pl · riskPerOperation/100)` → "+1.4R".
- **Meta Semanal (%):** `summarizeLedger(...).progressPercent` do período (`plan.periodGoal`).
- **Drawdown Max:** `maxDDPercent` (maturity) ou `calculateDrawdownState` (prop firm) → "R$350 (3%)".
- **Winrate:** `summarizeLedger(...).winRate`.
- Todos por aluno selecionado; **reusar SSoT, não recomputar fórmula nova.**
- **Ex.:** R$ 9.870 · +1.4R · Meta 70% · DD R$350 (3%) · Winrate 53%.

---

## 6. Arquitetura proposta

- **Hook novo `useMentorRiskRadar(allTrades, plans, subs, emotionConfig)`** — agrupa `allTrades`
  por aluno, computa por aluno ativo: flags efetivas hoje, score de severidade, compliance %,
  saldo/meta/DD/winrate. `useMemo` pesado (O(alunos×trades)). Retorna
  `{ header, priority[], radar[], foraPlano[], byStudent: Map }`.
- **Reuso** (sem reinventar): `calculateComplianceRate`, `analyzeEmotionsV2`, `buildPlanLedger`+
  `summarizeLedger`, `computeCurrentPl`/`computeCycleBalance`, `aggregateBehaviorWeights`,
  `effectiveRedFlags`, `useSubscriptions.stats`, `aggregateTradesByCurrency`.
- **Componentes** por seção (glassmorphism dark). Tiles do header via SSoT `cycleMetricTiles` onde couber.
- DebugBadge `component` (INV-04) + `pb-16/pb-20` (overlay guard). Sem query nova → sem composite index.

---

## 7. Fases (decompõe em tasks depois)

Construção da tela NOVA, faseada por seção (D8). Cada fase acrescenta uma seção à Torre; o
overview v1 segue funcionando e intocado até a Fase D.

- **Fase A** — ✅ ENTREGUE 27-28/08. Aba "Torre de Controle" no Dashboard + `activeView` novo +
  `useMentorRiskRadar` + testes de agregação (INV-05) + Header S1 (MC-1..4).
  Duas correções de rota de Marcio: a Torre **não** virou item de sidebar (D8 revisada) e o
  Dashboard **não** virou a Torre — ela é aba dele, com a tela inteira, no layout do mockup.
  O hook entrega `header` + `byStudent`; `priority[]`/`radar[]`/`foraPlano[]` nascem nas fases
  que os consomem — são DERIVAÇÕES sobre `byStudent`, não passadas novas sobre os trades, então
  o motivo de D8 (não varrer os mesmos trades quatro vezes) segue respeitado.
- **Fase B** — ✅ ENTREGUE 28/08. Prioridade S2 (MC-5) + Radar S3 (MC-6). Duas adaptações de spec
  (D10, D11) e um bug de domínio corrigido: o dia é por CONTA, não por aluno.
- **Fase C** — Fora do Plano S4 (MC-7) + Stop×Gain S5 (MC-8).
- **Fase D** — Visão Rápida S6 (MC-9) + **PROMOÇÃO**: a Torre vira o destino padrão do mentor e o
  overview v1 é aposentado.
- Testes de formatação/agregação ANTES da UI em cada fase.

**Por que o hook nasce COMPLETO na Fase A**, em vez de crescer por seção: `useMentorRiskRadar`
faz **uma passada só** sobre `allTrades` produzindo `header`, `priority[]`, `radar[]`,
`foraPlano[]` e `byStudent` de uma vez. Fatiá-lo por fase significaria varrer os mesmos trades
quatro vezes ou refatorar um `useMemo` pesado a cada fase — pior nos dois casos. As seções
plugam num hook que já está pronto e testado.

**A Fase D não é polish.** Ela carrega decisão de escopo: o que fazer com os seis componentes que
moram no overview atual e **não estão no mockup** — `EquityCurve`, `CalendarHeatmap`,
`MentorPromotionAlert`, `MentorMaturityAlert`, `PendingReviewsCard`, `MentorAlerts`. Aposentar,
migrar para a Torre ou mover para o #103 é decisão a tomar, não limpeza. Não subestimar no
planejamento.

**Por que não faseamos por cima do overview atual:** a Fase A trocaria os quatro `StatCard` de
hoje (P&L Total · Win Rate · Alunos Ativos · Trades Hoje) pelos quatro tiles novos, deixando o
corpo v1 abaixo. Da A à C a tela ficaria híbrida — nem v1 coerente, nem v2 — e o face lift só
fecharia na D. Como Marcio é o único mentor, construir em destino separado não expõe ninguém à
tela incompleta.

---

## 8. Decisões (APROVADAS — travadas 27/07/2026, defaults em bloco)

- **D1 · "Alerta" (MC-2):** 1 alerta = 1 aluno com ≥1 flag efetiva HOJE (dedup por aluno). Janela = hoje.
- **D2 · Limiar "Fora do Plano" header (MC-3):** `foraPct > 0` — qualquer violação efetiva hoje conta.
- **D3 · "Metas" header (MC-4):** ~~"N metas" = planos ativos com `plan.periodGoal`; "%" = média de
  `progressPercent`~~ — **REVISADA 27/08/2026 (Marcio: "veja os tiles do extrato, eles representam o
  que é hoje, e deveríamos seguí-los").** O tile conta **estado do período**, não média de progresso.
  Duas razões: (1) `progressPercent` divide pela meta do CICLO (`planLedger.js:176`), subestimando
  entre 2x e 20x, com fator diferente por aluno — média entre eles não significa nada; (2) o extrato
  não exibe percentual de progresso, exibe Meta/Stop em dinheiro + campo Estado. Fonte = `buildPeriodState`
  (#402), o mesmo motor do card do dia do aluno. Número em destaque: quem **seguiu operando após
  meta/stop**.
- **D4 · Prioridade do Dia (MC-5):** 3 gatilhos = TILT/REVENGE hoje / risco no trade atual / loss diário.
  Mapa: TILT/loss diário → "Bloquear conta / Call urgente"; risco no trade → "Alertar no WhatsApp".
- **D5 · Janela "Fora do Plano %" (MC-7):** semana corrente.
- **D6 · Stop×Gain (MC-8):** barras = contagem de trades; liquidez em R; multi-moeda normalizada em R.
- **D7 · "aluno ativo" (MC-1):** ~~`deriveStatus==='active'` (estrito)~~ — **REVISADA 27/08/2026
  (Marcio: "acesso + assinatura viva"; "uma vez que o atrasado entra em bloqueio, ele sai do radar
  da torre").** Predicado: `getAccessStatus(student)==='active' && !student.loginBlocked &&
  classifyStudent(student, subs) !== null`. `loginBlocked` é explícito porque o bloqueio por
  inadimplência grava o campo e **não** mexe em `accessStatus` (`functions/index.js:767`) — sem ele o
  bloqueado seguiria no radar. `overdue` **permanece**: quem decide o corte é o bloqueio, não a Torre.
  Base 27/08: 68 cadastrados · 19 com acesso · 39 com assinatura viva · **12 no radar**.

- **D8 · Construção como destino próprio** (27/08/2026, **REVISADA 28/08**): a Torre é `activeView`
  novo desde a Fase A e o overview v1 fica intocado até a Fase D — isso vale. O que mudou: ela é
  **aba do Dashboard**, não item de sidebar nem substituta do Dashboard. Marcio: "o Dashboard deve
  ter uma tab da torre... para que a torre tenha o aspecto do mockup". A aba dá a tela inteira ao
  layout do mockup sem tirar o overview do lugar. Navegação por estado — sem roteador.

- **D9 · Botões de ação da Prioridade do Dia — RESOLVIDA 28/08/2026 (Marcio: "o que já existe
  funciona... o que mais precisa? Segue simples").** Caminho (a): a Torre **não ganha escopo de
  ação nem persistência**. A recomendação é texto; o que estiver ao lado é LINK para onde a ação
  já mora.
  - *Bloquear conta* → link para a ficha do aluno em Acompanhamento, onde a callable
    `setStudentLoginBlocked` já opera com confirmação, grava autor e motivo (`manual`/`auto`) e
    desabilita o login no Auth. Não se replica dentro de um card de alerta comportamental um botão
    que tira a pessoa da plataforma — e do radar da Torre.
  - *Alertar no WhatsApp* → link `wa.me/<E.164>` a partir de `student.whatsappNumber`. Dado que já
    existe e está validado: **os 12 alunos do radar têm número** (os 2 sem são cancelados). Sem
    número, o botão não aparece.
  - *Call urgente* → não vira botão. O número fica visível no card.
  - **Sem registro de "tratei este alerta"**: seria campo novo (INV-15) e a Torre é sobre hoje —
    o card sai sozinho quando o comportamento não se repete na janela. Se um dia fizer falta, o
    `whatsappState` (none/talking/waiting) já existe e não exige campo novo.

> D1..D12 viram DEC-AUTO-101-01..12 no encerramento (§4.3).
> D3 e D7 entram na versão REVISADA (27/08) — o texto travado em 27/07 não é o implementado.

---

- **D10 · A fonte do comportamento é o motor unificado, não as red flags** (28/08/2026). A spec de
  27/07 pedia `EVENT_PENALTIES` + `RED_FLAG_TYPES`; é anterior ao CHUNK-11 aterrissar. Hoje **100%
  dos 379 trades têm `behaviorProfile.families`**, com severidade normalizada (HIGH/MEDIUM/LOW),
  código canônico e rótulo PT (`BEHAVIOR_LABELS`). IMPACTO = severidade do motor (`SEVERITY_LABELS`),
  sem limiar novo: duas réguas para a mesma coisa é o começo do drift. Red flags cobrem conformidade
  com o plano; o motor cobre o comportamento, que é o assunto da Torre. Clearing do mentor
  (`canonicalCode:tradeId`) respeitado; padrão positivo nunca vira risco.
- **D11 · Janela do Radar = 7 dias; a Prioridade continua sendo de hoje** (28/08/2026). A turma tem
  12 alunos e 2 a 4 operam por dia: um Radar de hoje ficaria vazio quase sempre e o mentor perderia
  o padrão da semana. A Prioridade é sobre agir agora, então segue diária. O gatilho "loss diário"
  da D4 vem do FATO DO DIA (`buildPeriodState`: `closedBeyondStop`/`tradesAfterStop`), não da red
  flag `LOSS_DIARIO_EXCEDIDO` que o #402 revogou por acusar o trade errado.
- **D12 · O dia é por CONTA, não por aluno** (28/08/2026, achado ao medir). Wilson opera duas contas:
  em 25/08 fez −700 numa (USD) e −520 na outra (BRL). Avaliar os três trades juntos contra o stop de
  uma delas soma moedas e contas diferentes — o pecado do #267/#289. Agora cada conta tem seu estado
  de período e responde pelo próprio stop; a acusação nomeia a conta quando o aluno tem mais de uma.
  Wilson segue sinalizado em 25/08, mas pela conta certa: −700 USD contra stop de US$375, na mesma moeda.

### Achados fora do escopo (não corrigidos — decisão de Marcio)

- `useEmotionalProfile.js:85` passa `analysis.trades || null` a `calculateStudentStatus`, mas
  `analyzeEmotionsV2` **não devolve** campo `trades`: o argumento é sempre `null` e o filtro de
  violações liberadas pelo mentor (#221) nunca recebe trade. Mexer altera o score emocional de
  toda a base.
- `CalendarHeatmap.jsx` ficou **sem consumidor** e está quebrado (lê campos que o util não devolve).
  Candidato a remoção.
- `RED_FLAG` grava notificação **sem `severity`** (202 dos 235 alertas): caem como MEDIUM e a
  ordenação do painel vira "emocional primeiro". Endereçar no S3 da Fase B.

---

## 9. Chunks

- **CHUNK-16 Mentor Cockpit** — ESCRITA (lock ativo).
- CHUNK-04 Trade Ledger · CHUNK-05 Compliance · CHUNK-06 Emotional · CHUNK-11 Behavioral — LEITURA.

---

## 10. Shared Deltas (editados no MAIN na abertura)

- `src/version.js` 1.83.1 → 1.84.0 (build 20260727).
- `docs/registry/versions.md` — reserva 1.84.0.
- `docs/registry/chunks.md` — lock CHUNK-16.
- Commit `b808aa19` (main) + push. Nenhum outro shared file pendente.

## 11. Sessions

- 27/07/2026 — pré-abertura §4.0: lock+reserva no main, worktree, doc SSoT, Gate Pré-Código. Sem código.
- 27/08/2026 — reordenação das fases para construção da tela nova (D8) + D9 aberta. Correção da base da reserva (1.83.1 → 1.83.33). Sem código.
- 28/08/2026 — **Fase B entregue**: S2 Prioridade do Dia + S3 Radar de Risco, sobre o motor
  unificado do CHUNK-11 (D10), janela 7d no Radar (D11), dia por conta (D12). 84 testes na
  agregação. Medição na base: 25/08 → 2 na prioridade; 26/08 → 2 + 2 no radar; 28/08 → 0 + 3.
- 28/08/2026 — D9 resolvida (links para o que já existe; sem ação nem persistência na Torre). Fase B desbloqueada.
- 28/08/2026 — correções sobre o overview pedidas por Marcio ao ver a tela: curva de patrimônio
  removida (somava 2 moedas de 12 pessoas); `CalendarHeatmap` trocado por `TradingCalendar` em modo
  turma (o antigo lia `dayOfWeek`/`pl`, campos que `generateCalendarData` não devolve — renderizava
  grade vazia); alertas agrupados por aluno com janela de 7d (235 alertas vivos, mediana 105 dias,
  viravam "4 sandras"); lista de trades só com dia escolhido, com nomes de quem operou e o aluno
  como âncora da linha.
- 28/08/2026 — 3 defeitos de origem corrigidos no caminho: loop de render no painel de alertas
  (carimbo `new Date()` em alerta sem campo `date` + array novo de trades por render); `studentId`
  ausente em 5 pontos de entrada da ficha do aluno (abria sem os planos).
- 27/08/2026 — **Fase A entregue**: item de sidebar + `activeView` 'torre' + `mentorRiskRadar` (agregação
  pura, 41 testes) + `useMentorRiskRadar` + `TorreHeader` (S1, MC-1..4) + casca com placeholders S2..S6.
  D3 e D7 revisadas por Marcio. Medição na base real: 12 no radar; 27/08 → 2 operaram, 1 em alerta,
  33% fora do plano em 3 trades, 1 stop. Suíte 274/274 verde.
