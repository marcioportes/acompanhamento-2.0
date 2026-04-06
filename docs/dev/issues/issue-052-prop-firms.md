# Issue 052 — epic: Gestao de Contas em Mesas Proprietarias (Prop Firms)
> **Branch:** `feature/issue-052-prop-firms`  
> **Milestone:** v1.1.0 — Espelho Self-Service  
> **Aberto em:** 01/03/2026  
> **Status:** 🔵 Em andamento  
> **Versao entregue:** —

---

## 1. CONTEXTO

Muitos alunos operam em mesas proprietarias (prop firms). Cada mesa tem regras proprias de drawdown, profit target, consistencia e payout. O sistema atual trata todas as contas como genericas — nao ha mecanismo para monitorar compliance com as regras da mesa, calcular drawdown trailing/EOD, ou alertar quando o trader esta proximo de violar limites.

**Revisao v2.0 (03/04/2026):** Apex reformulou regras significativamente em marco 2026. Secao de pesquisa no body do issue do GitHub (#52) documenta o comparativo completo e changelog de regras.

**Revisao v3.0 (05/04/2026):** Discussao com sessao master (Opus 4.6) definiu modelo semantico completo, plano de ataque personalizado, 3 camadas de alerta, e decisoes de persistencia.

### Modelo semantico — 3 camadas

**Camada 1 — Template (regras da mesa):**
`propFirmTemplates` e um catalogo. Nao muda por aluno. Cada template define: tipo de drawdown, limites, instrumentos, prazos. O mentor seleciona ao vincular uma conta. Entidade independente — collection raiz (diferente de subscriptions que e dependente).

**Camada 2 — Instancia (conta do aluno):**
Campo `propFirm` na account e a instancia — o template aplicado aquela conta especifica, com o estado runtime: peakBalance, currentDrawdownThreshold, lockLevel, fase (EVALUATION → SIM_FUNDED → LIVE), dias de trading, daily P&L, plano de ataque sugerido.

**Camada 3 — Monitoramento (engine + alertas):**
A cada trade, a engine recalcula o estado da instancia. Drawdown atualiza, daily loss atualiza, dias incrementam. Se limiar e atingido, gera flag/alerta. Paralelo ao pipeline existente (PL/compliance/emotional) — nao interfere, adiciona.

### 3 niveis de alerta (nao confundir)

| Nivel | Origem | Severidade | Exemplo |
|-------|--------|-----------|---------|
| Regra da mesa | Hard limit — viola = perde conta | Vermelho (urgente, irreversivel) | Drawdown atingido, daily loss estourado |
| Regra do plano | Soft limit — viola = compliance cai | Amarelo (corrigivel) | RR abaixo do target, trade sem stop |
| Plano de ataque | Guidance — ignora = opera sem framework | Informativo (nudge) | "Voce esta usando 3 trades hoje, plano sugere max 2" |

### Plano de ataque personalizado

O sistema sugere parametros operacionais para atacar a conta prop, calibrados pelo perfil 4D do aluno. 100% rule-based (funcao pura, sem IA, sem custo recorrente).

**Dois perfis:** conservador (prioriza sobrevivencia) e agressivo (prioriza velocidade). Binario por design — suficiente para Fase 1. Se dados mostrarem que mentores ajustam frequentemente, adicionar granularidade futura.

**Formula de calibragem:**
```javascript
// Fatores derivados do 4D
emotionalFactor = emotionalScore / 100              // 0.0 a 1.0
maturityFactor = stage / 5                           // 0.2 a 1.0
consistencyFactor = 1 - coefficientOfVariation       // CV do DEC-050

// Fator composto (media ponderada)
adjustmentFactor = (emotionalFactor * 0.4) + (maturityFactor * 0.3) + (consistencyFactor * 0.3)

// Faixas por perfil
conservativeRange = { roMin: 0.04, roMax: 0.06 }    // 4-6% do DD max
aggressiveRange   = { roMin: 0.08, roMax: 0.12 }    // 8-12% do DD max

// RO final
range = selectedProfile === 'conservative' ? conservativeRange : aggressiveRange
roPercent = range.roMin + (adjustmentFactor * (range.roMax - range.roMin))
roPerTrade = drawdownMax * roPercent
stopPerTrade = roPerTrade * (1 / rrMinimum)
dailyTarget = profitTarget / (evalDays * dayUsageFactor)
maxTradesPerDay = Math.round(dailyLossLimit / stopPerTrade)
```

**Cascata de fontes de dados:**

| Prioridade | Fonte | adjustmentFactor |
|-----------|-------|-----------------|
| 1a | Perfil 4D completo (assessment + trades) | Preciso — emotional, stage, CV reais |
| 2a | Indicadores sem 4D (trades sem assessment) | WR como proxy de maturidade, CV direto, emotional default 50 |
| 3a | Defaults (conta nova, sem historico) | Conservador: 0.3 (pessimista). Agressivo: 0.6 (moderado) |

O plano mostra de onde veio (`dataSource`) e alerta quando baseado em defaults: "Este plano e baseado em defaults — com mais trades, sera recalibrado."

**Parametros por fase da conta:**

| Parametro | EVALUATION | SIM_FUNDED | LIVE |
|-----------|-----------|------------|------|
| Prioridade | Passar avaliacao (target + regras) | Manter consistencia | Lucro real + payout |
| RO sugerido | Conservador (DD apertado, sem 2a chance) | Moderado (DD resetou) | Conforme perfil real |
| Alertas | Pressao de prazo + margem de DD | Complacencia pos-aprovacao | Payout eligibility |

### Faseamento (revisado)

| Fase | Escopo | Estimativa | Restricoes |
|------|--------|-----------|-----------|
| 1 | Templates `propFirmTemplates` + configuracao mentor + extensao `accounts` + plano de ataque rule-based | 1.5 sessoes | Sem conflito de chunks |
| 2 | Engine de drawdown (4 tipos) + CFs com transacao + daily loss + eval deadline | 1.5 sessoes | CF usa `runTransaction` para drawdown |
| 3 | Dashboard card prop + gauges + alertas mentor + tempo medio trades (universal) | 1 sessao | CHUNK-02 + CHUNK-04 (leitura) — #93 deve liberar locks antes |
| 4 | Payout tracking + qualifying days + simulador | 0.5 sessao | — |

### Decisoes arquiteturais (DEC-053 + discussao 05/04/2026)

| Decisao | Justificativa |
|---------|---------------|
| DEC-053 | Escopo revisado com regras Apex Mar/2026 |
| `propFirmTemplates` (nao `propFirmRules`) | Evita colisao semantica com compliance rules. Template e o que e — modelo pre-configurado |
| Collection raiz para templates | Entidade independente (catalogo de referencia, como tickers). Nao depende de aluno. INV-15 gate: APROVADO |
| `propFirm` inline na account | Estado runtime + plano de ataque. Account ja e container logico |
| `accounts/{id}/drawdownHistory` subcollection | Historico de drawdown cresce com cada trade — nao inflar documento da account. INV-15 gate: APROVADO |
| Plano de ataque 100% rule-based | Funcao pura deterministica. IA nao se justifica — e calculo com constraints, nao interpretacao de texto |
| Conservador/Agressivo binario | Suficiente para Fase 1. Granularidade futura se dados justificarem |
| Daily loss = soft (warning + flag + alerta) | Nao bloquear addTrade — o trade que estourou o limite precisa ser registrado |
| Drawdown usa `runTransaction` na CF | Trailing depende de read-then-write atomico do peakBalance. FieldValue.increment nao serve aqui |
| Tempo medio de trades e metrica universal | Vai nos MetricsCards para todas as contas, nao so prop. No card prop mostra com contexto |
| Eval deadline conta dias corridos | Apex conta corridos, nao dias de trading. UI deve ser explicita |

## 2. ACCEPTANCE CRITERIA

### Fase 1 — Templates, Configuracao e Plano de Ataque
- [ ] Collection `propFirmTemplates` com templates pre-configurados (Apex EOD/Intraday, MFF Starter/Core/Scale, Lucid Pro/Flex)
- [ ] Tela de configuracao de regras da mesa (mentor configura)
- [ ] Extensao do modelo `accounts` com campo `propFirm` (objeto aninhado)
- [ ] Seletor de mesa ao criar conta tipo PROP (dois niveis: firma → produto)
- [ ] Fase da conta: EVALUATION → SIM_FUNDED → LIVE → EXPIRED (transicao manual pelo mentor)
- [ ] Validacao de instrumentos restritos ao registrar trade (warning, nao bloqueio)
- [ ] Funcao pura `calculateAttackPlan(mesaRules, alunoProfile, perfil)` com cascata 4D → indicadores → defaults
- [ ] Campo `suggestedPlan` em `account.propFirm` com profile, dataSource, roPerTrade, stopPerTrade, rrMinimum, maxTradesPerDay, dailyTarget, daysToTarget, sizing
- [ ] Plano recalibra automaticamente quando novos dados 4D/indicadores ficam disponiveis
- [ ] UI mostra dataSource e alerta quando baseado em defaults
- [ ] Testes unitarios da formula de calibragem (todos os cenarios: 4D completo, indicadores only, defaults, stage 1-5, conservador/agressivo)

### Fase 2 — Engine de Drawdown
- [ ] Engine implementa 4 tipos: trailing intraday, EOD trailing, static, trailing+lock
- [ ] `peakBalance` e `currentDrawdownThreshold` atualizados via `runTransaction` (atomico)
- [ ] Deteccao de lock (safety net atingido → trail para)
- [ ] Daily loss limit com acao soft: flag `isDayPaused` + warning + alerta mentor (NAO bloqueia addTrade)
- [ ] Countdown de eval deadline (dias corridos, nao para com pausa)
- [ ] Red flags: distance to DD < 20%, consistency violada, eval deadline < 7 dias
- [ ] CF `onTradeCreated`/`onTradeUpdated` recalculam drawdown da conta prop
- [ ] Subcollection `accounts/{id}/drawdownHistory` com ponto por trade

### Fase 3 — Dashboard e Alertas
- [ ] Card de conta prop no StudentDashboard com gauges (DD, profit/target, dias restantes)
- [ ] Indicador de daily P&L vs daily loss limit (contas EOD)
- [ ] 3 niveis de alerta visual: vermelho (mesa), amarelo (plano), informativo (ataque)
- [ ] Alerta ao mentor quando aluno a <25% do drawdown
- [ ] Alerta quando consistency rule prestes a ser violada
- [ ] Tracking de trading days e payout eligibility
- [ ] Historico de drawdown (sparkline via subcollection)
- [ ] Tempo medio de trades (win/loss/overall) nos MetricsCards — universal, todas as contas
- [ ] No card prop: tempo medio com contexto ("operacoes curtas = scalping, compativel com perfil X")

### Fase 4 — Payout Tracking
- [ ] Ciclo de payout com tracking de dias lucrativos
- [ ] Qualifying days tracker (Apex: 5 dias com $100-$300 net profit)
- [ ] Calculo de payout eligibility (min days, qualifying days, min amount, consistency)
- [ ] Simulador: "Se eu sacar X, meu novo threshold sera Y"
- [ ] Registro de payouts realizados

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `propFirmTemplates` (NOVA — INV-15 APROVADO), `accounts` (escrita — campo `propFirm`), `accounts/{id}/drawdownHistory` (NOVA subcollection — INV-15 APROVADO), `trades` (leitura — validacao instrumentos) |
| Cloud Functions afetadas | `onTradeCreated` (extensao — recalcular drawdown prop via runTransaction), `onTradeUpdated` (idem) |
| Hooks/listeners afetados | `useAccounts` (novo campo propFirm), `useTrades` (warning instrumentos restritos) |
| Side-effects (PL, compliance, emotional) | Drawdown prop e paralelo ao PL existente — nao interfere. Compliance da mesa e independente do compliance do plano |
| Blast radius | MEDIO — nova collection + extensao de accounts + extensao de CFs existentes |
| Rollback | Campo `propFirm` e opcional — contas sem ele continuam funcionando. Collection `propFirmTemplates` pode ser removida sem impacto |

### 3.1 Riscos identificados pelo cross-check master

**Risco 1 — Blast radius no onTradeCreated:**
CF fica mais pesada: ler account → verificar se e prop → ler template → runTransaction para drawdown → verificar flags → criar alerta. Em batch (30 trades do Modo Criacao #93), sao 30 execucoes. Mitigacao: runTransaction garante atomicidade do peakBalance.

**Risco 2 — Race condition no drawdown trailing em batch:**
Drawdown trailing depende de leitura do peakBalance atual. Em batch, multiplas CFs concorrentes leem o mesmo valor. Mitigacao: `runTransaction` (read-then-write atomico no Firestore). Diferente do PL que usa FieldValue.increment.

**Risco 3 — Documento da account inflando:**
`propFirm` inline pode ficar grande. Mitigacao: estado runtime + plano de ataque inline, historico de drawdown como subcollection separada.

**Risco 4 — Fase 3 bloqueada por locks da #93:**
CHUNK-02 (StudentDashboard) e CHUNK-04 (trades leitura) — CHUNK-04 esta LOCKED pela #93. Fases 1-2 podem comecar sem conflito. Fase 3 aguarda liberacao.

### 3.2 Invariantes aplicaveis

| Invariante | Como se aplica |
|------------|---------------|
| INV-01 (Airlock) | Templates sao dados de configuracao, nao dados externos — OK direto |
| INV-02 (Gateway trades) | Nao escreve em trades — apenas leitura para validacao |
| INV-03 (Pipeline side-effects) | Extensao de onTradeCreated/onTradeUpdated — analise de impacto em elos downstream |
| INV-04 (DebugBadge) | Card de conta prop + tela de configuracao + plano de ataque |
| INV-05 (Testes) | Engine de drawdown (4 tipos) + formula de calibragem do plano de ataque |
| INV-10 (Verificar Firestore) | `propFirmTemplates` e collection NOVA — grep + aprovacao |
| INV-15 (Persistencia) | `propFirmTemplates` (collection raiz — APROVADO), `drawdownHistory` (subcollection — APROVADO), campo `propFirm` em accounts (inline — APROVADO) |
| INV-16 (Worktree) | Sessao deve criar worktree isolado |

### 3.3 Shared files — nao editar direto

| Arquivo | Delta necessario | Acao |
|---------|-----------------|------|
| `functions/index.js` | Extensao de onTradeCreated/onTradeUpdated para drawdown prop | Delta no doc do issue |
| `firestore.rules` | Rules para `propFirmTemplates` (mentor read/write) + `drawdownHistory` | Delta no doc do issue |
| `src/version.js` | Bump na entrega de cada fase | Propor no doc do issue |
| `docs/PROJECT.md` | Nova DEC, CHANGELOG, CHUNK-17 | Propor no doc do issue |

### 3.4 Isolamento de sessao paralela

**CHUNK-04 esta LOCKED pela #93.** Fases 1-2 nao tocam CHUNK-04 (so leitura na Fase 3). Iniciar Fases 1-2 sem conflito.
**CHUNK-02** esta AVAILABLE — mas so e necessario na Fase 3.
Se encontrar conflito com shared file: documentar aqui e notificar Marcio.

## 4. SESSOES

### Sessao — 05/04/2026 — Briefing Master (Opus 4.6)

**Tipo:** planejamento (sem codigo)

**O que foi feito:**
- Modelo semantico de 3 camadas definido (template → instancia → monitoramento)
- 3 niveis de alerta definidos (mesa = vermelho, plano = amarelo, ataque = informativo)
- Plano de ataque personalizado desenhado: 100% rule-based, calibrado por 4D, cascata de fontes
- Formula de calibragem especificada (adjustmentFactor = emotional*0.4 + maturity*0.3 + consistency*0.3)
- Cross-check profundo com 10 pontos de analise (riscos, contras, edge cases)
- Decisoes de persistencia aprovadas via INV-15 (propFirmTemplates raiz, drawdownHistory subcollection, propFirm inline)
- Renomear propFirmRules → propFirmTemplates (evitar colisao semantica com compliance rules)
- Daily loss como soft warning (nao bloqueia addTrade)
- Drawdown trailing via runTransaction (nao FieldValue.increment)
- Tempo medio de trades como metrica universal (todas as contas, nao so prop)
- Faseamento revisado com restricoes de chunks documentadas

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| — | propFirmTemplates collection raiz | Catalogo independente de alunos (como tickers). INV-15 APROVADO |
| — | drawdownHistory como subcollection de account | Historico cresce com trades — nao inflar doc account. INV-15 APROVADO |
| — | propFirm inline na account | Estado runtime + plano de ataque. Container logico correto |
| — | Plano de ataque 100% rule-based | Calculo com constraints, nao interpretacao. Funcao pura, testavel, sem custo |
| — | Conservador/Agressivo binario | Suficiente para Fase 1. Granularidade futura se justificada por dados |
| — | Daily loss soft (warning + flag) | Trade que estourou limite precisa ser registrado. Hard block cria problemas praticos |
| — | runTransaction para drawdown | Trailing exige read-then-write atomico. increment nao serve |
| — | Tempo medio universal | MetricsCards todas as contas. Card prop adiciona contexto |

**Pendencias para sessao de codigo (Claude Code):**
- Criar CHUNK-17 (Prop Firm Engine) no registry
- Criar worktree isolado (INV-16)
- Iniciar Fase 1 (templates + configuracao + plano de ataque)
- Consultar body do issue GitHub (#52) para templates detalhados das mesas

## 5. ENCERRAMENTO

**Status:** Aguardando inicio de codificacao

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] PROJECT.md atualizado (DEC, DT, CHANGELOG)
- [ ] PR aberto e mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
- [ ] Locks de chunks liberados no registry (secao 6.3)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-17 (NOVO) | escrita | Prop Firm Engine — templates, engine drawdown, plano de ataque, card prop |
| CHUNK-02 | escrita | StudentDashboard — card prop + tempo medio trades (so Fase 3) |
| CHUNK-04 | leitura | trades — validacao instrumentos restritos (so Fase 3 — LOCKED pela #93 ate liberacao) |
| CHUNK-13 | leitura | Context Bar — conta prop selecionavel |

> **CHUNK-17 — Prop Firm Engine (proposta de criacao):**
> Dominio: Gestao de contas prop, engine de drawdown, templates, plano de ataque
> Arquivos principais: `PropFirmEngine/*`, `propFirmTemplates` collection, `useAccounts` (campo propFirm), CF extensao drawdown
> Justificativa: dominio novo e isolado, nao se encaixa em chunks existentes
> **Aguarda aprovacao do Marcio para registrar no PROJECT.md**

## 7. REFERENCIA — PESQUISA E ARQUITETURA

> O body completo do issue no GitHub (#52) contem: comparativo de drawdown entre mesas, tipos de drawdown (modelo mental), modelo de dados `propFirmTemplates` e extensao de `accounts`, mockup do dashboard card, consideracoes tecnicas, e changelog de regras Apex Mar/2026.
>
> Nao duplicar aqui — consultar via `gh issue view 52`.

### 7.1 Schema — propFirm inline na account

```javascript
// accounts/{accountId} — campo propFirm adicionado
{
  // ... campos existentes (currency, balance, broker, etc.)
  
  propFirm: {
    // --- Template vinculado ---
    templateId: string,          // ref ao propFirmTemplates
    firmName: string,            // desnormalizado (ex: "Apex")
    productName: string,         // desnormalizado (ex: "EOD 50k")
    
    // --- Fase ---
    phase: string,               // 'EVALUATION' | 'SIM_FUNDED' | 'LIVE' | 'EXPIRED'
    phaseStartDate: Timestamp,
    evalDeadline: Timestamp,     // so EVALUATION — dias corridos
    
    // --- Estado runtime ---
    peakBalance: number,
    currentDrawdownThreshold: number,
    lockLevel: number | null,    // trailing+lock: nivel onde trail parou
    isDayPaused: boolean,        // daily loss atingido hoje
    tradingDays: number,         // dias com pelo menos 1 trade
    
    // --- Plano de ataque sugerido ---
    suggestedPlan: {
      profile: string,           // 'conservative' | 'aggressive'
      dataSource: string,        // '4d_full' | 'indicators' | 'defaults'
      roPerTrade: number,
      stopPerTrade: number,
      rrMinimum: number,
      maxTradesPerDay: number,
      dailyTarget: number,
      daysToTarget: number,
      bufferDays: number,
      sizing: number,
      adjustmentFactor: number,  // 0.0 a 1.0 — transparencia do calculo
      generatedAt: Timestamp
    }
  }
}

// accounts/{accountId}/drawdownHistory/{entryId}
{
  tradeId: string,
  date: string,                  // YYYY-MM-DD
  balance: number,
  peakBalance: number,
  drawdownThreshold: number,
  distanceToDD: number,          // percentual restante
  dailyPnL: number,
  createdAt: Timestamp
}
```
