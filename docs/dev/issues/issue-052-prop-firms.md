# Issue 052 — epic: Gestão de Contas em Mesas Proprietárias (Prop Firms)
> **Branch:** `feature/issue-052-prop-firms`  
> **Milestone:** v1.1.0 — Espelho Self-Service  
> **Aberto em:** 01/03/2026  
> **Status:** 🔵 Em andamento  
> **Versão entregue:** —

---

## 1. CONTEXTO

Muitos alunos operam em mesas proprietárias (prop firms). Cada mesa tem regras próprias de drawdown, profit target, consistência e payout. O sistema atual trata todas as contas como genéricas — não há mecanismo para monitorar compliance com as regras da mesa, calcular drawdown trailing/EOD, ou alertar quando o trader está próximo de violar limites.

**Revisão v2.0 (03/04/2026):** Apex reformulou regras significativamente em março 2026. Seção de pesquisa no body do issue do GitHub (#52) documenta o comparativo completo e changelog de regras.

**Decisão arquitetural (DEC-053):** Escopo revisado com regras Apex Mar/2026 — campos removidos (maeRule, maxRR), campos adicionados (dailyLossAction, evalTimeLimit, bracketOrderRequired, dcaAllowed, restrictedInstruments, qualifyingDays). Templates diferenciam Apex EOD vs Intraday como produtos separados.

### Faseamento

| Fase | Escopo | Estimativa |
|------|--------|-----------|
| 1 | Templates `propFirmRules` + configuração mentor + extensão `accounts` | 1 sessão |
| 2 | Engine de drawdown (4 tipos) + CFs recalculam + daily loss + eval deadline | 1.5 sessões |
| 3 | Dashboard card prop + gauges + alertas mentor | 1 sessão |
| 4 | Payout tracking + qualifying days + simulador | 0.5 sessão |

## 2. ACCEPTANCE CRITERIA

### Fase 1 — Templates e Configuração
- [ ] Collection `propFirmRules` com templates pré-configurados (Apex EOD/Intraday, MFF Starter/Core/Scale, Lucid Pro/Flex)
- [ ] Tela de configuração de regras da mesa (mentor configura)
- [ ] Extensão do modelo `accounts` com campo `propFirm` (objeto aninhado)
- [ ] Seletor de mesa ao criar conta tipo PROP (dois níveis: firma → produto)
- [ ] Fase da conta: EVALUATION → SIM_FUNDED → LIVE (transição manual)
- [ ] Validação de instrumentos restritos ao registrar trade (warning, não bloqueio)

### Fase 2 — Engine de Drawdown
- [ ] Engine implementa 4 tipos: trailing intraday, EOD trailing, static, trailing+lock
- [ ] `peakBalance` e `currentDrawdownThreshold` atualizados a cada trade
- [ ] Detecção de lock (safety net atingido → trail para)
- [ ] Daily loss limit com ação PAUSE_DAY (Apex EOD) — flag `isDayPaused`
- [ ] Countdown de eval deadline (30 dias corridos Apex)
- [ ] Red flags: distance to DD < 20%, consistency violada, eval deadline < 7 dias
- [ ] CF `onTradeCreated`/`onTradeUpdated` recalculam drawdown da conta prop

### Fase 3 — Dashboard e Alertas
- [ ] Card de conta prop no StudentDashboard com gauges (DD, profit/target, dias restantes)
- [ ] Indicador de daily P&L vs daily loss limit (contas EOD)
- [ ] Alerta ao mentor quando aluno a <25% do drawdown
- [ ] Alerta quando consistency rule prestes a ser violada
- [ ] Tracking de trading days e payout eligibility
- [ ] Histórico de drawdown (sparkline)

### Fase 4 — Payout Tracking
- [ ] Ciclo de payout com tracking de dias lucrativos
- [ ] Qualifying days tracker (Apex: 5 dias com $100-$300 net profit)
- [ ] Cálculo de payout eligibility (min days, qualifying days, min amount, consistency)
- [ ] Simulador: "Se eu sacar X, meu novo threshold será Y"
- [ ] Registro de payouts realizados

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `propFirmRules` (NOVA — INV-15 aprovação pendente), `accounts` (escrita — campo `propFirm`), `trades` (leitura — validação instrumentos) |
| Cloud Functions afetadas | `onTradeCreated` (extensão — recalcular drawdown prop), `onTradeUpdated` (idem) |
| Hooks/listeners afetados | `useAccounts` (novo campo propFirm), `useTrades` (warning instrumentos restritos) |
| Side-effects (PL, compliance, emotional) | Drawdown prop é paralelo ao PL existente — não interfere. Compliance da mesa é independente do compliance do plano |
| Blast radius | MÉDIO — nova collection + extensão de accounts + extensão de CFs existentes |
| Rollback | Campo `propFirm` é opcional — contas sem ele continuam funcionando. Collection `propFirmRules` pode ser removida sem impacto |

### 3.1 Invariantes aplicáveis

| Invariante | Como se aplica |
|------------|---------------|
| INV-01 (Airlock) | Templates são dados de configuração, não dados externos — OK direto |
| INV-02 (Gateway trades) | Não escreve em trades — apenas leitura para validação |
| INV-03 (Pipeline side-effects) | Extensão de `onTradeCreated`/`onTradeUpdated` — análise de impacto obrigatória nos elos downstream |
| INV-04 (DebugBadge) | Card de conta prop + tela de configuração precisam de DebugBadge |
| INV-05 (Testes) | Engine de drawdown (4 tipos) requer testes unitários extensivos |
| INV-10 (Verificar Firestore) | `propFirmRules` é collection NOVA — grep + aprovação obrigatória |
| INV-15 (Persistência) | Collection `propFirmRules` + campo `propFirm` em accounts — gate INV-15 pendente |

### 3.2 Shared files — não editar direto (protocolo seção 6.2 PROJECT.md)

| Arquivo | Delta necessário | Ação |
|---------|-----------------|------|
| `functions/index.js` | Extensão de `onTradeCreated`/`onTradeUpdated` para drawdown prop | Delta no doc do issue |
| `firestore.rules` | Rules para `propFirmRules` (mentor read/write) | Delta no doc do issue |
| `src/version.js` | Bump na entrega de cada fase | Propor no doc do issue |
| `docs/PROJECT.md` | Nova DEC, CHANGELOG, eventual novo chunk | Propor no doc do issue |

## 4. SESSÕES

*(nenhuma sessão de código registrada ainda)*

## 5. ENCERRAMENTO

**Status:** Aguardando decomposição em sub-issues para implementação por fase

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] PROJECT.md atualizado (DEC, DT, CHANGELOG)
- [ ] PR aberto e mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
- [ ] Locks de chunks liberados no registry (seção 6.3)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-02 | escrita | StudentDashboard — card de conta prop |
| CHUNK-04 | leitura | trades — validação de instrumentos restritos no registro |
| CHUNK-13 | leitura | Context Bar — conta prop precisa ser selecionável |
| CHUNK-NEW | escrita | PropFirmEngine — nova engine de drawdown + templates (propor criação ao Marcio) |

> **Nota:** CHUNK-NEW precisa ser proposto e aprovado antes da implementação. Sugestão: CHUNK-17 — Prop Firm Engine.

## 7. REFERÊNCIA — PESQUISA E ARQUITETURA

> O body completo do issue no GitHub (#52) contém: comparativo de drawdown entre mesas, tipos de drawdown (modelo mental), modelo de dados `propFirmRules` e extensão de `accounts`, mockup do dashboard card, considerações técnicas, e changelog de regras Apex Mar/2026.
>
> Não duplicar aqui — consultar via `gh issue view 52`.
