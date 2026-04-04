# Issue 093 — feat: Order Import v1.1 - Modo Criacao + Confronto + Deduplicacao
> **Branch:** `feature/issue-093-order-import-v1.1`  
> **Milestone:** v1.1.0 — Espelho Self-Service  
> **Aberto em:** 04/04/2026  
> **Status:** 🔵 Em andamento  
> **Versao entregue:** —

---

## 1. CONTEXTO

Follow-up do #87 (CHUNK-10 v1.0, mergeado 22/03/2026). O v1.0 importa ordens para analise comportamental (collection `orders`). O v1.1 adiciona quatro entregas:

- **V1.1a — Modo Criacao:** ordens reconstruidas sem trade correspondente geram trade via `addTrade` (INV-01/INV-02). Campos financeiros preenchidos automaticamente, campos comportamentais (emotion, setup) ficam pendentes para o aluno complementar. CFs disparam normalmente.
- **V1.1b — Modo Confronto:** ordens com trade correspondente mostram comparacao lado a lado. Divergencias destacadas. Acoes: "Aceitar como esta" (vincula correlatedTradeId) ou "Atualizar com corretora" (DELETE + CREATE via addTrade — pipeline limpo).
- **V1.1c — UI Master/Detail:** componente `TradeOrdersPanel` dentro de TradeDetailModal e FeedbackPage. Mostra ordens de entrada/saida, stop orders, canceladas.
- **V1.1d — Deduplicacao retroativa:** hash de campos-chave protege contra reimportacao do mesmo CSV.

Referencias: `docs/sprint-behavioral/BRIEF-ORDER-IMPORT-v1.1.md`, `docs/CHUNK-10-ROADMAP.md`, PR #87.

## 2. ACCEPTANCE CRITERIA

- [ ] Modo Criacao gera trades via `addTrade` a partir de operacoes reconstruidas sem trade correspondente
- [ ] Deduplicacao por `ticker + side + entryTime (+-5min) + qty` antes de criar trade
- [ ] Campos pendentes (emotionEntry, emotionExit, setup) sinalizados para complemento pelo aluno
- [ ] CFs (onTradeCreated, compliance, PL, movements) disparam normalmente para trades criados
- [ ] Modo Confronto exibe comparacao lado a lado (trade registrado vs dados corretora)
- [ ] Divergencias destacadas visualmente na comparacao
- [ ] Acao "Aceitar como esta" vincula `correlatedTradeId`
- [ ] Acao "Atualizar com corretora" faz DELETE + CREATE via `addTrade`
- [ ] Componente `TradeOrdersPanel` funcional em TradeDetailModal
- [ ] Componente `TradeOrdersPanel` funcional em FeedbackPage
- [ ] Hash de deduplicacao protege contra reimportacao de CSV
- [ ] DebugBadge em todos os componentes novos/tocados
- [ ] Testes cobrindo: criacao, deduplicacao, confronto, DELETE+CREATE

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `orders` (leitura), `trades` (escrita via addTrade), `plans` (side-effect PL) |
| Cloud Functions afetadas | `onTradeCreated` (dispara para trades criados), `onTradeUpdated` |
| Hooks/listeners afetados | `useTrades`, TradeDetailModal, FeedbackPage |
| Side-effects (PL, compliance, emotional) | PL recalculado, compliance stats atualizados para trades criados |
| Blast radius | MEDIO — trades criados sao trades reais, afetam PL e compliance |
| Rollback | DELETE dos trades criados (requer script), ordens permanecem intactas |

### 3.1 Riscos identificados pelo briefing master

**Risco 1 — PL corruption via onTradeCreated em trades importados:**
Ha registro em DT-002 de PL corrompido por CF `onTradeCreated` disparando em trades IMPORTED. Antes de codificar o Modo Criacao, a sessao DEVE verificar o estado atual da CF:
```bash
grep -n "IMPORTED\|imported\|source\|origin" functions/src/onTradeCreated.js
```
Se nao houver guard, propor campo `source: 'order_import'` no trade criado + guard na CF. Decisao arquitetural — registrar como DEC.

**Risco 2 — DELETE+CREATE no Modo Confronto:**
A acao "Atualizar com corretora" faz DELETE + CREATE via `addTrade`. Verificar:
- DELETE do trade antigo remove entradas de PL? Existe `onTradeDeleted`?
- O novo trade via `addTrade` gera PL correto sem duplicacao?

**Risco 3 — Deduplicacao cross-reference:**
O hash proposto (`ticker + side + entryTime +-5min + qty`) deve ser verificado contra o mecanismo existente no CHUNK-07 (CSV Import):
```bash
grep -rn "hash\|dedup\|duplicate" src/components/CsvImport/
```

### 3.2 Invariantes criticas para esta sessao

| Invariante | Aplicacao neste issue |
|------------|----------------------|
| INV-01 (Airlock) | Dados de `orders` NUNCA escrevem direto em `trades`. Modo Criacao reconstroi via `addTrade` |
| INV-02 (Gateway) | Toda escrita em `trades` via `addTrade` — sem excecao |
| INV-03 (Pipeline) | Trades criados disparam `onTradeCreated` → PL, compliance, emotional. Verificar que CFs lidam com trades de importacao |
| INV-04 (DebugBadge) | Em TODOS os componentes novos/tocados com `component="NomeExato"` |
| INV-05 (Testes) | Criacao, deduplicacao, confronto, DELETE+CREATE |
| INV-12 (Parciais) | `_partials` e campo array inline — NAO subcollection |

### 3.3 Shared files — nao editar direto (protocolo secao 6.2 PROJECT.md)

| Arquivo | Necessidade | Protocolo |
|---------|-------------|-----------|
| `src/App.jsx` | Nenhuma rota nova (componentes embeddados) | — |
| `functions/index.js` | Nenhuma CF nova (usa CFs existentes) | — |
| `firestore.rules` | Verificar se `orders` tem read rule adequada | Delta no doc do issue |
| `src/version.js` | Bump na entrega | Propor no doc do issue |
| `docs/PROJECT.md` | DECs e CHANGELOG | Propor no doc do issue |

### 3.4 Isolamento de sessao paralela

**NAO TOCAR** arquivos do CHUNK-16 (Mentor Cockpit) — sessao #94 opera la.
Se encontrar conflito com shared file: documentar aqui e notificar Marcio.
Proximo DEC disponivel: DEC-055 (conferir no PROJECT.md antes de propor).

## 4. SESSOES

### Sessao — 04/04/2026 — Briefing Master (Opus 4.6)

**Tipo:** planejamento (sem codigo)

**O que foi feito:**
- Analise comparativa Opus 4.6 vs Claude Code para definicao de sessao master
- Decisao: Opus 4.6 (chat) como coordenador/master, Claude Code como executor
- Arquivo de controle criado pelo Claude Code (protocolo INV-13)
- Chunks propostos e verificados como AVAILABLE no registry
- Analise de impacto expandida (secao 3.1-3.4) com riscos e invariantes mapeados
- Gate pre-codigo executado pelo Claude Code — 5 achados criticos analisados
- 4 decisoes aprovadas pelo Marcio (abaixo)

**Decisoes aprovadas (04/04/2026):**

| # | Decisao | Status | Justificativa |
|---|---------|--------|---------------|
| 1 | Campo `source: 'order_import'` nos trades criados pelo Modo Criacao | **APROVADO** | Rastreabilidade + futuro guard na CF para suprimir notificacoes bulk. Campo `origin` ja existe na collection `orders` (OrderStagingReview.jsx:118) — reutilizar padrao. Revisar funcao de notificacao NEW_TRADE (nao esta sendo recebida em lugar nenhum — oportunidade de fix) |
| 2 | Modo Confronto: DELETE + CREATE confirmado viavel | **APROVADO** | `onTradeDeleted` existe (functions/index.js:960-971), reverte PL. `onTradeCreated` recalcula. Pipeline limpo, sem duplicacao de PL |
| 3 | Deduplicacao: implementacao nova (hash ticker+side+entryTime+-5min+qty) | **APROVADO** | Zero matches para hash/dedup/duplicate em CSV Import. Mecanismo e novo, implementar from scratch |
| 4 | Gateway addTrade: **Opcao A — extrair logica core para util puro** | **APROVADO com restricoes** | Ver secao 4.1 abaixo |

### 4.1 Decisao 4 — Refactor addTrade: especificacao e protocolo de seguranca

**Contexto:** `addTrade` e um `useCallback` dentro de `useTrades.js` (linhas 197-334). E um hook React, nao funcao pura. O Modo Criacao precisa criar trades em batch a partir de ordens — usar o hook em loop e ineficiente (N escritas sequenciais + N CFs disparando em paralelo = race condition no PL).

**Opcoes analisadas:**

| Opcao | Performance | Duplicacao | Risco |
|-------|------------|------------|-------|
| (A) Extrair core para util puro | Otima (writeBatch) | Zero | Refactor medio — mas investimento correto |
| (B) Loop no hook | Ruim (N escritas seq.) | Zero | Race condition PL com 30+ trades simultaneos |
| (C) Funcao dedicada createTradeFromOrder | Boa | **Total** — drift garantido | AP-03 invertido. Mudanca no addTrade exige replicar manualmente |

**Decisao: Opcao A.** Razoes:
- Elimina trade-off performance vs duplicacao — resolve ambos
- INV-02 fica fortalecida: gateway passa a ser funcao pura testavel
- Investimento que paga dividendos: testes mais faceis, batch possivel, zero drift
- O hook `useTrades.addTrade` vira wrapper fino que chama a funcao pura

**Arquitetura alvo:**
```
src/utils/tradeGateway.js          ← funcao pura (nova)
  └── createTrade(params, deps)    ← validacao + calculo + escrita
        ├── valida plano e conta
        ├── calcula result, RR, compliance
        ├── cria doc em trades via addDoc
        ├── cria movement
        └── (opcional) upload de imagens

src/hooks/useTrades.js             ← refatorado
  └── addTrade = useCallback(...)  ← wrapper fino que chama createTrade
        └── passa estado React (plano, conta) como parametros

OrderImport (Modo Criacao)         ← novo
  └── chama createTrade com writeBatch para N trades
```

#### PROTOCOLO DE SEGURANCA OBRIGATORIO (Marcio exige cautela maxima)

**FASE 0 — Cross-check profundo ANTES de tocar codigo:**
1. Ler `useTrades.js` completo (linhas 1-final) — mapear TODAS as dependencias de estado React
2. Mapear TODOS os consumidores de `addTrade` no codebase:
```bash
grep -rn "addTrade\|useTrades" src/ --include="*.js" --include="*.jsx"
```
3. Para CADA consumidor encontrado, rastrear o fluxo completo:
   - Quais parametros passa?
   - Quais side-effects espera?
   - Qual o comportamento apos o retorno (toast, redirect, refresh)?
4. Documentar TODOS os fluxos existentes numa tabela:

| Consumidor | Arquivo | Parametros | Side-effects esperados | Comportamento pos-retorno |
|-----------|---------|------------|----------------------|--------------------------|
| (preencher pelo Claude Code) | | | | |

5. Identificar TODAS as dependencias React que precisam virar parametros:
   - Estado do contexto (plano ativo, conta selecionada)
   - Refs, callbacks, hooks internos
   - Toast/notificacao
6. Apresentar achados completos ao Marcio **ANTES** de escrever qualquer codigo

**FASE 1 — Extrair funcao pura (com rede de seguranca):**
1. Criar `src/utils/tradeGateway.js` com a logica extraida
2. **NAO MODIFICAR** `useTrades.js` ainda — a funcao pura existe em paralelo
3. Escrever testes unitarios para `tradeGateway.js` cobrindo:
   - Trade LONG com stop
   - Trade SHORT com stop
   - Trade sem stop (compliance DEC-005/DEC-006)
   - Trade com parciais (_partials — INV-12)
   - Trade com source: 'order_import'
   - Trade com valores zero/null/undefined em campos opcionais
   - Validacao de plano inexistente
   - Validacao de conta inexistente
   - Calculo de result, RR, riskPercent (DEC-007/DEC-009)
   - Criacao de movement correspondente
4. Todos os testes devem passar **ANTES** de prosseguir

**FASE 2 — Rewire do hook (ponto critico):**
1. Modificar `useTrades.addTrade` para chamar `tradeGateway.createTrade`
2. O wrapper deve passar estado React como parametros — a interface publica do hook NAO muda
3. Rodar TODOS os testes existentes:
```bash
npm test -- --run
```
4. Se QUALQUER teste quebrar: PARAR, reverter, investigar
5. Verificar manualmente que CADA consumidor mapeado na Fase 0 continua funcionando:
   - Criar trade manual (fluxo principal)
   - Criar trade via CSV Import (se usa addTrade)
   - Editar trade (se passa por addTrade)
   - Qualquer outro fluxo identificado

**FASE 3 — Modo Criacao (so apos Fase 2 estavel):**
1. Implementar `createTradeFromOrder` que usa `tradeGateway.createTrade`
2. Suporte a batch via writeBatch (se viavel com CFs — verificar se writeBatch dispara triggers)
3. Campo `source: 'order_import'` em cada trade criado
4. Testes especificos do Modo Criacao

**REGRAS INVIOLAVEIS DESTA SESSAO:**
- **NAO fazer push.** Todo push e producao. Commitar local, aguardar validacao completa
- **NAO pular fases.** Fase 0 completa antes de Fase 1. Fase 1 estavel antes de Fase 2
- **NAO assumir que funciona.** Testar cada fluxo. Se nao tem teste, nao esta validado
- **Se qualquer teste quebrar na Fase 2:** reverter imediatamente e reportar ao Marcio
- **Documentar TUDO** no arquivo de controle — se a sessao cair, a proxima reconstroi

**Sequencia recomendada de implementacao (atualizada):**
1. ~~Gate pre-codigo~~ ✅ Executado pelo Claude Code
2. **Fase 0** — cross-check profundo do addTrade (mapear consumidores, dependencias, fluxos)
3. **Fase 1** — tradeGateway.js + testes unitarios exaustivos
4. **Fase 2** — rewire do hook + regressao completa
5. Deduplicacao (V1.1d) — hash novo, from scratch
6. Modo Criacao (V1.1a) — usa tradeGateway + batch + source field
7. TradeOrdersPanel (V1.1c) — componente UI
8. Modo Confronto (V1.1b) — DELETE + CREATE via pipeline limpo
9. Gate pre-entrega: version.js + CHANGELOG + DebugBadge + testes passando
10. **NAO FAZER PUSH** — commitar local, aguardar validacao do Marcio

**Pendencias para proxima sessao (Claude Code):**
- Registrar locks dos chunks 10, 04, 08 no PROJECT.md (secao 6.3)
- Executar Fase 0 completa (cross-check do addTrade)
- Apresentar tabela de consumidores + dependencias ao Marcio antes de codificar

### Sessao — 04/04/2026 — Claude Code (Fase 0 + inicio Fase 1)

**Tipo:** investigacao + codigo

**O que foi feito:**

**Fase 0 — Cross-check profundo do addTrade (COMPLETO):**
- Leitura completa de useTrades.js (834 linhas)
- Mapeamento de 7 consumidores de addTrade (3 manuais + 4 via CSV staging)
- Mapeamento de 4 consumidores somente-leitura de useTrades
- Rastreamento completo do pipeline: addTrade → onTradeCreated → onMovementCreated
- Confirmacao: sem duplicacao de movements entre addTrade e CFs
- Confirmacao: writeBatch dispara triggers individualmente (atomicidade, nao reducao)
- Confirmacao: FieldValue.increment() garante PL e saldo corretos em batch
- Confirmacao: unico consumidor que usa retorno do addTrade e useCsvStaging.activateTrade (precisa de { id })
- Identificacao de 2 bugs pre-existentes (DTs abaixo)

**Bugs pre-existentes encontrados (registrados como DTs — NAO corrigir neste issue):**

| ID | Bug | Severidade | Justificativa para nao corrigir agora |
|----|-----|-----------|--------------------------------------|
| DT-029 | TradesJournal batch activate sem setSuspendListener — snapshots processam trades intermediarios | BAIXA | Corrigir aumenta blast radius sem necessidade. StudentDashboard ja tem o fix correto como referencia |
| DT-030 | balanceBefore/balanceAfter incorretos em movements criados em batch — cada addTrade le o "ultimo movement" mas em batch todos leem o mesmo | BAIXA (cosmetico) | Saldo final da conta correto via FieldValue.increment na CF. Afeta apenas visualizacao do extrato em movements intermediarios |

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| — | createTrade retorna { id: string, ...tradeFields } | Contrato identico ao addTrade atual. Unico consumidor que usa retorno: useCsvStaging.activateTrade (newTrade.id) |
| — | Import direto de db no tradeGateway | Singleton de src/firebase.js. Mock via vi.mock nos testes |
| — | uploadImage permanece no wrapper do hook | createTrade puro nao lida com arquivos |
| — | Modo Criacao seta AMBOS: source + importSource | source: 'order_import' (campo canonico novo) + importSource: 'order_import' (compatibilidade padrao CSV) |

## 5. ENCERRAMENTO

**Status:** Aguardando aprovacao de chunks

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
| CHUNK-10 | escrita | Dominio principal — Order Import, matching, deduplicacao |
| CHUNK-04 | escrita | TradeDetailModal (TradeOrdersPanel), gateway addTrade para criacao |
| CHUNK-07 | leitura | Referencia para mecanismo de deduplicacao hash do CSV Import |
| CHUNK-08 | escrita | FeedbackPage (TradeOrdersPanel embeddado) |

> **Pendencia:** campo "Chunks necessarios" ausente no issue GitHub. Chunks acima propostos — aguardar aprovacao do Marcio antes de registrar locks.
