---
name: Correção de Rota — Importação e Plano
version: 1.0.0
status: approved
baseVersion: SPEC v0.5.0 (19/04/2026)
authors: [Opus session]
reviewers: [CC session, AI reviewer externo (Sonnet fresco + Opus fresco)]
epic: "#128 (Pipeline Import — a refazer)"
---

# 1. Changelog

| Versão | Data | Mudança |
|--------|------|---------|
| 1.0.0 | 2026-04-19 | Promoção pós-R3 CLEAN-WITH-COSMETIC-FIXES da Sessão C. Zero mudanças estruturais. Correções mecânicas: **FIX-1** removido changelog duplicado (linhas 20-24 de v0.5 eram paste bug — entradas de v0.1, v0.2, v0.3 repetidas). **FIX-2** WL-04 movida de §12 para §11 (Wishlist), restabelecendo coerência semântica (§11 = Wishlist, §12 = Violações). Referência de VL-01 para "WL-04 (§11)" fica correta. Spec promovida de draft para approved. |
| 0.5.0 | 2026-04-19 | Absorção de 2 external reviews (NEEDS + NEEDS; 13 findings consolidados: 3 overlap + 7 só R1 + 3 só R2). Decisões Marcio: **HIGH-1** Opção A (INV-21/AP-10 viram invariantes ativas na v1.0; shadow inline é violação rastreada, não atenuação); **HIGH-2** fechamento de ciclo é **evento temporal determinístico pelo sistema** (vencimento do período = fato inexorável; nem mentor nem aluno disparam; tier diferencia o ritual de revisão sobre ciclo fechado, não o fechamento); Q-06 removida (não há atraso possível); **LOW-13** promoção eval→funded fecha ciclo evaluation e abre ciclo funded (ciclos distintos). Outros absorvidos: HIGH-3 qualificador "durável" em enqueue assíncrono; HIGH-4 auto-heal removido de §6.C-1 (fica em WL-01); HIGH-5 Movimento promovido a agregado canônico + §6.B-5 reescrita; MEDIUM-6 "plano retroativo" ao glossário + critério §6.B-1; MEDIUM-7 nota schema-agnostic ao glossário; MEDIUM-8 fold policy + campo crítico/não-crítico em §5.3.A; MEDIUM-9 âncora §4.0 do protocolo em §10; MEDIUM-10 FEV-12/ABR-17 inline; MEDIUM-11 critério §6.B-4 gerando sugestão suspensa; MEDIUM-12 linguagem de domínio em §6.C-1. Zero pendência estrutural. Pronta para promoção a v1.0 após aprovação. |
| 0.4.0 | 2026-04-19 | R2 da Sessão C absorvido (2 findings, zero estruturais). **G1:** §6.A-2 (Import Performance) ganha critério simétrico ao §6.A-3 — ordens em período sem plano ativo recebem mesmo tratamento (badge + bloqueio até plano retroativo). **G2:** AP-10 (§8) recebe gating simétrico a INV-21 em relação a WL-04 — AP-10 é spec-only até WL-04 completa; mesmas linhas de código que violam INV-21 violam AP-10 (gêmeos semânticos). Zero outras mudanças. Spec pronta para AI reviewer externo. |
| 0.3.0 | 2026-04-19 | R1 da Sessão C absorvido (4 findings + 1 nitpick, 312 palavras, todos aceitos). Mudanças: (a) **F-A HIGH** — `shadowBehavior` inline em `trades` (código pré-existente em `functions/analyzeShadowBehavior.js:416`, merged em v1.30.0 via #129) viola INV-21; adicionada **WL-04** como pré-requisito bloqueante para INV-21 entrar em prod (migração + backfill); (b) **F-B MEDIUM** — §6.A-3 ganha critério para Import Orders em período sem plano ativo (badge + bloqueio até criação de plano retroativo); (c) **F-C MEDIUM** — §5.3.A explicita que edit pós-criação de trade manual é enrichment append-only com `source: 'manual_edit'`; overwrite de `rawPayload` proibido sem exceção; (d) **F-D MEDIUM** — §6.A-3 e §6.A-4 trocam "dispara recálculo" por "enfileira recálculo assíncrono"; opinião é eventualmente consistente; falha de opinião nunca invalida o enrichment persistido; (e) **F-E LOW** — §6.B-3 troca "sugestão suspensa no plano ativo" por "sugestão vinculada ao plano ativo" (agnóstico de schema, preserva Q-03). |
| 0.2.0 | 2026-04-19 | Revisão Marcio (madrugada 18→19/04/2026). Correções conceituais, renomes de glossário, simplificação de INV-19, resolução de questões em aberto e adição de §11 (Wishlist). Detalhes: (a) remoção do termo "Fases de construção (1/2/3)" — substituído por **Criação de Plano** (Real/Demo ou Mesa, por tipo de conta) + **Ajuste de Plano** (manutenção contínua pós-criação); (b) **bust removido** como gatilho de ajuste (conta em bust morre); (c) **template removido** como mecanismo de Criação de Plano Mesa; (d) rename "Opção 2" → **"Snapshot de ciclo fechado"**; (e) rename "Padrão A refinado" → **"Padrão A"**; (f) rename "Event Sourcing Lite" → **"Detalhe do trade"**; (g) termo "Plano como referencial" removido do glossário (conteúdo absorvido em §4 Contexto); (h) **INV-19 simplificada** — classificação manual pela Sessão C no protocolo §4.0 de abertura, registrada no control file; dúvida = bundle-required (failsafe explícito); gatilho de reconsiderar automação = ≥3 falsos negativos documentados em 6 meses; (i) §6.B-4 **fechamento de ciclo revisado** — disparado pelo mentor na Revisão Semanal (dependência futura de #102); sistema sinaliza vencimento ao mentor na revisão; aluno não fecha ciclo; (j) enrichment **dispara recálculo** de shadow/IA (Q-05 resolvida, virou critério de aceite em §6.A); (k) Q-01 resolvida (arquivo único confirmado pela CC); (l) Q-02 resolvida e movida para §11 Wishlist (auto-heal futuro; hoje há botões manuais em Conta e Plano); (m) nova §11 Wishlist / Parking Lot. |
| 0.1.0 | 2026-04-18 | Versão inicial consolidando síntese arquitetural v2 (v1 + 4 refinarias aprovadas). Um arquivo único cobrindo Importação + Plano; split diferido para §9. INVs com numeração global (INV-19 a INV-22) e coluna "Condição de revisão" em §5.2. |

**Convenção de versão:**
- `0.x.y` enquanto draft
- `1.0.0` na primeira aprovação (R1 clean + AI reviewer clean)
- Minor bump = adição que não invalida review anterior
- Major bump = mudança que reabre R1

---

# 2. Glossário (conceitos novos desta revisão)

Termos criados ou redefinidos nesta spec. Vocabulário compartilhado entre Opus (spec) e CC (impact).

- **Gateway canônico** — ponto único de escrita em agregado canônico (`trades`, `plans`, `orders`, `movements`, `accounts`). Idempotente. Valida invariantes de agregado. Persiste fato. Dispara efeitos colaterais via CFs.
- **Porta de entrada** — superfície de UI que captura intenção/evidência e delega ao gateway. Não calcula estado derivado. Para trade: manual, import_performance, import_orders. Para plano: criação (Real/Demo ou Mesa, conforme tipo de conta) e ajuste (disparado por gatilho).
- **Staging conversacional** — superfície de decisão do aluno sobre operações reconstruídas no Import Orders. Sequência de perguntas (match / ambíguo / novo / autoliq), não kanban por status. Sistema propõe hipótese; aluno confirma, ajusta ou descarta.
- **Fato vs Opinião** — fato é propriedade objetiva do agregado (preço, tempo, qty, origem, partials). Opinião é parecer externo (shadow, IA, mentor). Fato persiste em coleção canônica; opinião em coleção separada, recalculável.
- **Detalhe do trade** — estrutura de 3 camadas dentro do documento Trade. Payload cru da porta (`rawPayload`) congelado pós-criação. Projeção canônica (`canonicalFields`) derivada e recalculável. Enrichments em array append-only com `source`, `timestamp`, `diff`, `author`. Contenção de auditoria dentro do próprio agregado (sem event store separado).
- **Origem do trade** — propriedade imutável marcada no gateway (`manual`, `import_performance`, `import_orders`). Enrichment posterior registra autoria e timestamp no array de enrichments, nunca altera origem.
- **Agregado canônico** — unidade de consistência de domínio (Trade, Plano, Conta, Ordem). Invariantes validadas no gateway, não em UI. Superfície de UI é manipulação, não dona de regra.
- **Criação de Plano** — dois caminhos mutuamente exclusivos, determinados pelo tipo de conta. Conta Real/Demo: criação livre (aluno digita propriedades). Conta Mesa: criação conforme regras da mesa (produto, instrumento, evaluation/funded). Uma vez criado, plano entra em ciclo de Ajuste.
- **Ajuste de Plano** — ciclo de manutenção contínua pós-criação. Função atômica que calcula sugestão nova a partir de histórico (Kelly + Monte Carlo + IA). Fatorada, reusável pelos gatilhos. Não pertence ao módulo de fechamento de ciclo.
- **Gatilhos de ajuste** — fechamento de ciclo (evento temporal determinístico pelo sistema), promoção evaluation → funded (Mesa; fecha ciclo evaluation e abre ciclo funded), demanda do aluno (manual; 3/mês self-service, ilimitado Alpha).
- **Sugestão suspensa** — plano sugerido persistido aguardando aceite/descarte do aluno na superfície canônica `Contas > Plano`. Não vive em popups soltos.
- **Snapshot de ciclo fechado** — no fechamento de ciclo, indicadores (WR, payoff, PF, EV, drawdown máximo) são congelados junto com snapshot do plano vigente. Ciclos anteriores preservam verdade histórica; ciclo ativo recalcula com plano corrente.
- **Reconciliação de agregados** — malha de segurança pós-gateway. Varre periodicamente agregados derivados (PL do plano, saldo da conta) comparando com o fato primário (trades). Detecta divergências causadas por falhas de CFs e reporta.
- **AutoLiq** — evento de sistema emitido pela corretora quando a conta é forçosamente liquidada (bust). Não é decisão do aluno. Em staging, recebe destaque visual distinto.
- **Padrão A** — Porta → Gateway → Fato persistido → Opinião recalculável. Distingue imutável (fato) de leitor externo (opinião).
- **Padrão B** — Agregado canônico por domínio. Cada domínio tem raiz + invariantes validadas no gateway. Superfície de operação canônica é única por agregado.
- **Plano retroativo** — plano com data de início no passado, criado para cobrir período de import histórico que não tinha cobertura de plano ativo. Não pode sobrepor plano existente (ativo ou fechado) no mesmo período.
- **Campo crítico (do trade)** — campo que afeta PL, compliance ou ciclo (price, qty, direction, time). Edit em campo crítico não é aceito via enrichment manual — exige fluxo de import_orders ou criação de novo trade.
- **Campo não-crítico (do trade)** — campo que não afeta PL, compliance ou ciclo (setup, emotion, comment). Edit aceito via enrichment com `source: 'manual_edit'`.

**Nota sobre nomes técnicos:** `rawPayload`, `canonicalFields`, `enrichments`, `source`, `timestamp`, `diff`, `author` são **termos conceituais desta spec** para facilitar comunicação entre Opus e CC. Nomes concretos de campos/coleções em Firestore são definidos pela CC no impact doc (spec-out).

---

# 3. Escopo

## 3.1 O que esta spec cobre

- Domínio (agregados, relações, invariantes, estados e transições) para Importação de trades e Plano operacional
- User stories por fluxo (Importação: manual, performance, orders; Plano: Criação Real/Demo, Criação Mesa, Ajuste)
- Critérios de aceite em linguagem de negócio
- Regras de negócio (ex: "sem plano, sem trade")
- Padrões arquiteturais formalizados (A, B)
- Anti-padrões
- Princípio de destaque visual para eventos de sistema (AutoLiq)
- Obrigatoriedade da malha de reconciliação e sua existência como classe de solução
- Propriedade arquitetural da estrutura de Detalhe do trade (3 camadas: rawPayload + canonicalFields + enrichments)

## 3.2 O que esta spec NÃO cobre (vai para o Impact Doc da Sessão C)

- Nomes de coleção, subcoleção, campo, tipo Firestore
- Nomes, triggers e payloads de Cloud Functions
- Nomes e shape de retorno de hooks React
- Nomes, props e layout de componentes UI
- Paths de arquivo, estrutura de pastas
- Cor, componente, posicionamento e mecânica visual do badge AutoLiq (princípio é spec-in; implementação é spec-out)
- Chunks, locks, versões de entrega (INV-16, §6.3 do framework operacional)
- Sequência de entrega / ordem de ataque / deltas de arquivo
- Mecanismo técnico de imutabilidade do `rawPayload` (security rule vs CF guard vs ambos)
- Configuração concreta de retry, DLQ, Cloud Scheduler
- Threshold numérico final da reconciliação (0.01 USD é referência de ordem de grandeza; calibragem e se é configurável por agregado é da C)
- Periodicidade concreta da reconciliação (03:00 BRT é referência)
- Decisão entre persistir `suggestedPlan` como subcampo do plano ativo ou subcoleção

---

# 4. Contexto e Motivação

Espelho vive da tensão entre duas superfícies: o que o aluno diz que fez e o rastro digital do que ele de fato fez na corretora. A tese central do épico é que essa distância é o objeto de análise do produto — não um subproduto, não um relatório, mas o trabalho em si.

Em produção, essa tensão está quebrada em duas frentes. Primeiro, o Import Orders (issue #93, já merged) introduziu regressão de staging bypass: dados externos estão alcançando coleções de produção sem passar pela decisão conversacional do aluno. Isso viola a invariante estrutural original de que toda superfície externa de entrada passa por staging antes de virar fato. Segundo, o módulo de Plano virou puxadinho do módulo de Mesa Prop — funções que deveriam ser reusáveis (cálculo de ajuste, snapshot de ciclo) estão soldadas em módulos chamadores, e o aluno pode editar ou criar plano em mais de uma superfície, violando a ideia de agregado com operação canônica única.

A compreensão do domínio também evoluiu. Quatro observações puxaram essa rodada: (a) Import não é conveniência — é mecanismo de confronto; entry manual sozinho permite auto-engano, import traz evidência que o aluno não pode editar post-hoc; (b) Plano não é disciplina imposta — é referencial sem o qual performance não é mensurável; (c) O campo `text` das ordens do broker (AutoLiq, Stop, Limit, Exit, multibracket) é oracle secundário que o produto estava desperdiçando; (d) A cadeia Gateway → CFs opera sob consistência eventual no Firestore — confiar 100% em event-driven sem malha de segurança gera chamadas de suporte de aluno reclamando que "o saldo não bate".

Esta spec consolida a correção arquitetural das quatro frentes. Não é feature nova — é refatoração de superfície, fatoração de funções compartilhadas, e explicitação de invariantes que estavam implícitas (e por isso sendo violadas).

---

# 5. Domínio

## 5.1 Agregados e relações

```
Conta 1:N Plano · Plano 1:N Ciclo · Ciclo 1:N Período
Plano 1:N Trade · Trade 1:N Ordem · Trade 1:N Opinião (shadow/IA/mentor)
Conta 1:1 Saldo (derivado, mantido por CF pós-gateway)
Plano 1:1 PL-ativo (derivado, mantido por CF pós-gateway)
```

**Agregados canônicos identificados:**

- **Trade** (raiz = documento trade; portas: manual, import_performance, import_orders)
- **Plano** (raiz = documento plan; portas: Criação Real/Demo, Criação Mesa, Ajuste)
- **Conta** (raiz = documento account)
- **Ordem** (raiz = documento order; entra via Import Orders, referenciada por Trade)
- **Movimento** (raiz = documento movement; entra via operações de aporte/retirada/transferência em `Contas`; toda escrita passa pelo gateway de movimento, que valida invariantes de Conta — ex: saldo não fica abaixo de Σ PLs dos planos ativos).

**Agregados derivados (mantidos por CFs pós-gateway, alvo de reconciliação):**

- Saldo da conta (derivado de trades + movimentos)
- PL ativo do plano (derivado de trades do ciclo)
- Compliance do plano (derivado de trades vs metas/stops)

**Opiniões (coleções separadas, recalculáveis):**

- Shadow (padrões comportamentais detectados)
- IA (análises, feedbacks)
- Mentor notes

## 5.2 Invariantes de agregado

Numeração global (continua sequência do PROJECT.md). Verificar na consolidação pós-aprovação se INV-01 a INV-18 estão todas ativas; esta spec adiciona INV-19 a INV-22.

| ID | Regra (resumo) | Tipo | Condição de revisão |
|----|----------------|------|---------------------|
| INV-19 | Issues classificadas como arquiteturais pela Sessão C no protocolo §4.0 (critério: toca gateway de agregado canônico, modifica invariante existente, OU afeta ≥2 agregados canônicos; em dúvida = classificar como arquitetural) requerem bundle aprovado (Spec + Impact + AI Review Log, todos integrados no control file da issue) antes da abertura de branch/lock. Classificação é manual, registrada no control file. Issues `fix:` pontuais, `debt:` isolados e `ops:` seguem INV-13 padrão. | Opinião (processo) | Aprovação explícita do Marcio. Auditoria trimestral (§5.2.1). **Gatilho para reconsiderar automação da classificação:** ≥3 falsos negativos documentados em 6 meses (issue classificada como não-arquitetural que deveria ter sido bundle). |
| INV-20 | Toda escrita em agregado canônico passa por gateway único e idempotente (hash de dedupe obrigatório). Invariantes de consistência de agregado (ex: Σ PLs ≤ saldo; plano ativo existe) são validadas no gateway, não em telas nem em CFs consumidoras. | Fato (estrutural) | Nunca — revisão exige major bump desta spec. |
| INV-21 | Coleções canônicas persistem fato; opiniões moram em coleções separadas e recalculáveis. Em agregados com enrichment (Trade), `rawPayload` é congelado na criação; enrichments são array append-only com `source`, `timestamp`, `diff`, `author`; projeção canônica (`canonicalFields`) é recalculada a cada enrichment. Nunca overwrite, nunca remoção. | Fato (estrutural) | Nunca — revisão exige major bump desta spec. |
| INV-22 | Agregados derivados que dependem de CFs pós-gateway (PL do plano, saldo da conta) têm CF de reconciliação periódica que compara fato primário (trades) com projeção e reporta divergências acima do threshold declarado. Política de auto-heal é declarada por agregado. | Fato (regra) + Opinião (threshold, periodicidade, política de auto-heal) | Regra imutável (major bump). Parâmetros revisáveis via config operacional sem reabrir spec, desde que registrados em documento de configuração versionado. |

**Regras de negócio absolutas (força de invariante, tratamento textual — não recebem número INV):**

- **"Sem plano, sem trade":** registro de trade requer plano ativo na conta. Guard em todas as portas de entrada. Validação no gateway (fail-fast antes da escrita em `trades`). Mensagem ao aluno deve pedir criação de plano explicitamente.
- **Superfície canônica única por operação de plano:** criação, edição, aceite/descarte de sugestão, visualização de histórico e snapshots acontecem apenas em `Contas > Plano`. Outras telas podem sinalizar disponibilidade; operação canônica redireciona para a superfície única. Propriedade do Padrão B + AP-11.

### 5.2.1 Auditoria trimestral de INVs (compromisso operacional)

INVs que não detectarem violação em review/PR em 3 meses consecutivos entram em revisão: candidato a remoção, fusão ou redefinição. Não é regra formal (não invalida a INV no período), é calendar operacional. Compromisso a ser registrado no PROJECT.md. Objetivo: evitar "invariante inflation".

## 5.3 Estados e transições

### 5.3.A Trade — ciclo de vida do documento (Detalhe do trade)

```
[Criação via gateway pela porta X]
   │
   ▼
┌──────────────────────────────────┐
│  rawPayload (congelado)          │
│  canonicalFields v0 (projeção)   │
│  enrichments: []                 │
└──────────────────────────────────┘
   │
   ▼
[Enrichment 1 — ex: import_orders confirma partials de trade manual]
   │
   ▼
┌──────────────────────────────────┐
│  rawPayload (inalterado)         │
│  canonicalFields v1 (reprojeção) │
│  enrichments: [{src, ts, diff, author}]
└──────────────────────────────────┘
   │
   ▼
[Enrichment N...] (append-only, nunca edita histórico)
```

**Edit pós-criação (nota adicionada em v0.3, F-C):**

Edit posterior em trade manual é aplicado como enrichment com `source: 'manual_edit'`, append em `enrichments[]`, com `author` e `timestamp` registrados. `canonicalFields` é reprojetado. **Overwrite de `rawPayload` é proibido pós-criação, sem exceção.**

**Escopo do edit manual (campo crítico vs não-crítico, v0.5 MEDIUM-8):**
- **Campo não-crítico** (setup, emotion, comment, notas): edit aceito via enrichment manual.
- **Campo crítico** (price, qty, direction, time — campos que afetam PL, compliance ou ciclo): edit manual **não é aceito**. Correção exige fluxo de import_orders (evidência da corretora) ou criação de novo trade.

**Reprojeção de `canonicalFields` (fold policy, v0.5 MEDIUM-8):**
- Fold sobre o array `enrichments[]` em ordem cronológica.
- Para cada campo afetado, a **última entrada** (timestamp mais recente) vence.
- `rawPayload` serve como base; enrichments sobrepõem campo a campo.
- Campos não tocados por nenhum enrichment permanecem com o valor do `rawPayload`.

### 5.3.B Trade — staging conversacional (Import Orders)

```
[Parse do CSV de ordens → reconstrução de operações]
        │
        ▼
[Operação detectada]
        │
        ▼
    [Proposta]  ◄── algoritmo classifica: match confiante / ambíguo / nova / autoliq
        │
        ├─── Aluno confirma ──► [Confirmada] ──► Gateway ──► Trade criado ou enriquecido
        ├─── Aluno ajusta  ────► [Proposta] (loop)
        └─── Aluno descarta ──► [Descartada] (fim; registrado para auditoria)
```

Operações classificadas como `autoliq` seguem o mesmo fluxo com badge de destaque na superfície. Mecânica idêntica, visibilidade diferente (§6.A-3).

### 5.3.C Plano — ciclo de vida

```
[Criado]
   │
   ▼
[Ativo] ◄─────────────┐
   │                  │
   ├─ Gatilho ─► [Sugestão suspensa]
   │                  │
   │            ┌─ Aceite ──► [Substituído por novo Ativo]
   │            └─ Descarte ──► (volta a Ativo)
   │
   ▼
[Ciclo fechado]
   │
   ▼
[Snapshot persistido + Ativo com plano novo ou corrente]
```

---

# 6. User Stories por Fluxo

Agrupadas em dois blocos paralelos: §6.A Importação e §6.B Plano. Cada bloco tem stories com critérios de aceite em linguagem de negócio.

## 6.A Importação

### 6.A-1 Porta Manual

> Como **aluno**, quero **registrar um trade campo a campo no formulário manual**, para **declarar minha intenção e leitura do que aconteceu**.
>
> **Critérios de aceite:**
> - Dado que tenho plano ativo na conta, quando submeto o formulário manual, então o trade é criado pelo gateway com origem `manual`.
> - Dado que não tenho plano ativo, quando tento submeter o formulário manual, então o sistema bloqueia com mensagem pedindo criação de plano.
> - Dado que submeti, quando consulto o trade, então o `rawPayload` contém o form submission original e é imutável.
> - Dado que a mesma submissão é enviada duas vezes (retry), quando o gateway processa, então apenas um trade é criado (idempotência por INV-20).

### 6.A-2 Porta Import Performance

> Como **aluno**, quero **subir o CSV de performance consolidado pela corretora**, para **ter o oracle broker sobre o resultado dos meus trades**.
>
> **Critérios de aceite:**
> - Dado que tenho plano ativo, quando faço upload do CSV de performance, então sistema apresenta operações reconstruídas em staging para confirmação.
> - Dado que confirmo uma operação, quando o gateway processa, então trade é criado com origem `import_performance` e `rawPayload` contendo a row original do CSV.
> - Dado que o CSV contém fills explodidos (múltiplos fills para um mesmo trade; caso FEV-12 da fixture PAAPEX: uma ordem de mercado virou múltiplas linhas no CSV), quando o correlator processa, então operações N×M são agrupadas corretamente antes do staging.
> - Dado que uma operação em Performance já tem trade manual correspondente, quando confirmo match, então o trade manual é enriquecido (enrichment como camada append-only, `rawPayload` do manual preservado).
> - **Dado operações do CSV de Performance em período sem plano ativo (upload histórico ou multi-período), quando staging processa, então marca com badge específico ("Sem plano vigente no período") e bloqueia confirmação; aluno deve criar plano retroativo ou ajustar vigência em `Contas > Plano` antes de confirmar.** (G1 em v0.4 — simetria com §6.A-3)

### 6.A-3 Porta Import Orders

> Como **aluno**, quero **subir o CSV cru de ordens da corretora**, para **que o sistema veja o rastro comportamental completo (ordens canceladas, stops movidos, hesitações)**.
>
> **Critérios de aceite:**
> - Dado que faço upload do CSV de orders, quando o sistema processa, então operações reconstruídas aparecem em staging conversacional (não escrita direta em `trades`).
> - Dado que o parse encontra match confiante com trade existente, quando apresenta, então pergunta explicitamente: "Minha hipótese: essas ordens são o trade X de {data/hora}. Confere?" com opção confirmar/ajustar/descartar.
> - Dado que o parse não encontra match, quando apresenta, então propõe "Nova operação detectada: {resumo}. Criar trade?" e permite aluno apontar trade existente (lista de candidatos do dia).
> - Dado que há múltiplos candidatos, quando apresenta, então lista com scores e pede seleção explícita.
> - Dado que o aluno descarta uma operação, quando processa, então sistema respeita sem pedir justificativa.
> - Dado que operações em diferentes instrumentos (ex: MNQ e NQ) ocorrem no mesmo dia, quando reconstrói, então cada ticker é segmentado independentemente (caso ABR-17 da fixture PAAPEX: bust day com operações em instrumentos distintos no mesmo dia).
> - Dado que há bloco descontínuo no CSV (gap de reset de fase), quando apresenta, então não classifica automaticamente — apenas expõe operações em staging; aluno decide caso a caso.
> - **Dado ordens em período sem plano ativo (import retroativo do histórico, gap entre ciclos), quando staging processa, então marca operações com badge específico ("Sem plano vigente no período") e bloqueia confirmação; aluno deve criar plano retroativo ou ajustar vigência em `Contas > Plano` antes de confirmar.** (F-B em v0.3)
> - **Dado que uma operação contém ordem com `text: AutoLiq`, quando apresenta em staging, então recebe badge visual distinto "Evento de sistema — AutoLiq detectado", separação visual clara de trades comuns, prerrogativa de descarte preservada ("não decide, não esconde").**
> - Dado que confirmo enrichment de trade existente via orders, quando gateway processa, então orders vira nova camada em `enrichments[]`, `rawPayload` do trade original preservado, `canonicalFields` recalculado.
> - **Dado que enrichment é persistido, quando gateway completa, então enfileira recálculo assíncrono durável de shadow e IA sobre `canonicalFields` atualizado (enfileiramento sobrevive a falha de processo; mecanismo técnico a definir pela C; opinião é eventualmente consistente com o novo fato; falha de cálculo de opinião nunca invalida o enrichment persistido).** (F-D em v0.3, HIGH-3 em v0.5)

### 6.A-4 Gateway canônico (comportamento comum a todas as portas)

> Como **arquiteto**, quero **um gateway único de escrita em `trades`**, para **garantir que toda superfície externa converge no mesmo ponto de validação e persistência**.
>
> **Critérios de aceite:**
> - Dado qualquer porta, quando chama gateway, então valida regra "sem plano, sem trade" antes de persistir.
> - Dado qualquer porta, quando chama gateway, então aplica hash de dedupe; retry não produz duplicação.
> - Dado gateway executa, quando persiste, então `rawPayload` é imutável pós-criação (garantido por mecanismo técnico a definir pela C).
> - Dado gateway persiste, quando dispara CFs (PL, compliance, movimento, saldo), então opera sob consistência eventual; reconciliação periódica (INV-22) é a malha de segurança.
> - Dado gateway persiste enrichment (não criação inicial), quando dispara CFs, então também **enfileira recálculo assíncrono durável** (enfileiramento sobrevive a falha de processo) de shadow e IA — opinião é eventualmente consistente com o novo fato; falha de cálculo de opinião nunca invalida o enrichment persistido (F-D em v0.3, HIGH-3 em v0.5).

## 6.B Plano

Plano tem dois modelos de vida ortogonais: **Criação** (nasce uma vez, por um de dois caminhos determinados pelo tipo de conta) e **Ajuste** (ciclo contínuo pós-criação, disparado por gatilhos). Eles não são fases sequenciais — são modos distintos.

### 6.B-1 Criação de Plano em conta Real/Demo

> Como **aluno em conta Real ou Demo**, quero **digitar livremente as propriedades do meu plano (PL, ciclo, período, meta, stop, RO, RR)**, para **ter referencial de performance quando ainda não tenho patrocínio estrutural (mesa)**.
>
> **Critérios de aceite:**
> - Dado que crio conta Real ou Demo, quando abro `Contas > Plano`, então posso preencher todas as propriedades livremente.
> - Dado que submeto, quando gateway persiste, então plano fica Ativo; sistema não opina sobre os valores.
> - Dado que já tenho plano ativo, quando quero trocar propriedades, então a operação acontece em `Contas > Plano` (superfície canônica única).
> - Dado que aluno faz import histórico em período sem cobertura de plano, quando cria plano retroativo em `Contas > Plano`, então o período do plano retroativo não pode sobrepor plano existente (ativo ou fechado); gateway bloqueia sobreposição com mensagem clara. Validação de Σ PLs ≤ saldo usa o saldo da data de início retroativa (não o saldo atual).

### 6.B-2 Criação de Plano em conta Mesa

> Como **aluno em conta Mesa (prop firm)**, quero **criar plano coerente com as regras da mesa (produto, instrumento, evaluation ou funded)**, para **ter referencial alinhado ao contrato com a patrocinadora**.
>
> **Critérios de aceite:**
> - Dado que crio conta Mesa, quando abro `Contas > Plano`, então posso criar plano respeitando as restrições da mesa.
> - Dado que a conta é evaluation, quando crio plano, então cálculo respeita regras de evaluation (distinto de funded). **Correção de bug vigente: hoje o cálculo não distingue evaluation de funded.**
> - Dado que a combinação é micro + agressivo, quando crio plano, então algoritmo determinístico produz plano válido. **Correção de bug vigente: hoje algoritmo quebra nessa combinação.**
> - Dado que plano Mesa é criado, então ciclo é anual (razão: conta prop é patrocinada, não tem PL próprio; ciclos mensais inutilizariam histórico; avaliação/retirada frequentemente leva mais de 1 mês).
> - Dado que conta Mesa é promovida de evaluation para funded, então ciclo evaluation é fechado (snapshot + congelamento de indicadores) e novo ciclo funded é aberto. Evaluation e funded são ciclos distintos; promoção não é ajuste intra-ciclo.

### 6.B-3 Ajuste de Plano

> Como **aluno com histórico de trades acumulado**, quero **que o sistema sugira ajustes no meu plano baseado em modelos (Kelly + Monte Carlo + IA)**, para **calibrar o referencial conforme minha performance real evolui**.
>
> **Gatilhos de Ajuste:**
> - Fechamento de ciclo — evento temporal determinístico pelo sistema (§6.B-4)
> - Promoção evaluation → funded (Mesa) — fecha ciclo evaluation e abre ciclo funded (tratado como fechamento especial em §6.B-2)
> - Demanda do aluno — manual; 3/mês self-service, ilimitado Alpha
>
> **Critérios de aceite:**
> - Dado que ocorre gatilho, quando dispara, então função atômica de ajuste calcula sugestão usando histórico de trades.
> - Dado que função de ajuste existe, quando é chamada, então não tem acoplamento com módulo de fechamento de ciclo (AP-12 previne soldagem).
> - Dado que sugestão é calculada, quando persiste, então vira sugestão suspensa vinculada ao plano ativo aguardando aceite/descarte; não é aplicada automaticamente.
> - Dado que aluno quer aceitar ou descartar sugestão, quando opera, então o faz em `Contas > Plano` (superfície canônica única).
> - Dado que aluno é self-service (não Alpha), quando pede ajuste manual, então tem cota de 3/mês; Alpha ilimitado.

### 6.B-4 Fechamento de ciclo (evento temporal determinístico pelo sistema)

> Como **sistema**, no vencimento do período do ciclo, fecho o ciclo automaticamente. Fechamento é **evento temporal inerente ao calendário do plano** — não é ação de mentor nem de aluno. Vencimento é fato inexorável; ninguém decide fechar.
>
> **Critérios de aceite:**
> - Dado que período do ciclo vence (relógio), quando sistema detecta o fim do período, então dispara fechamento automático.
> - Dado que fechamento dispara, quando executa, então indicadores do ciclo (WR, payoff, PF, EV, drawdown máximo, total trades, total PnL) são congelados.
> - Dado que fechamento dispara, quando executa, então snapshot do plano vigente é persistido (ver glossário: Snapshot de ciclo fechado).
> - Dado que fechamento dispara, quando executa, então **invoca função atômica de Ajuste (§6.B-3) e cria sugestão suspensa para o próximo ciclo, vinculada ao plano ativo, aguardando aceite em `Contas > Plano`**.
> - Dado que consulto ciclo fechado, quando leio, então valores refletem plano vigente à época.
> - Dado que consulto ciclo ativo, quando leio, então indicadores recalculam com plano corrente.
> - Dado que função de snapshot existe, quando a Revisão Semanal (#102) precisa congelar KPIs, então reusa a mesma função com parâmetro de escopo diferente (atomicidade garante reuso).
>
> **Ritual de revisão em cima do ciclo fechado (diferencia por tier):**
> - **Alpha:** mentor faz Revisão Semanal sobre o ciclo já fechado (reviewing the record, not closing it). Dependência de #102 para o ritual — mas não para o fechamento.
> - **Self-service:** aluno consulta snapshot do ciclo fechado diretamente no painel `Contas > Plano`. Sem ritual humano; verdade histórica preservada igual.
>
> O que diferencia tiers é o **ritual de revisão**, não o fechamento. Fechamento é universal e determinístico.

### 6.B-5 Invariante de conta (Σ PLs ≤ saldo)

> Como **arquiteto**, quero **garantir que soma dos PLs dos planos ativos nunca exceda o saldo da conta**, para **evitar super-alocação que invalidaria métricas de performance**.
>
> **Critérios de aceite:**
> - Dado que aluno tenta criar ou editar plano que faria Σ PLs > saldo, quando gateway valida, então bloqueia com mensagem clara.
> - Dado que movimento da conta reduz saldo abaixo de Σ PLs, quando gateway de movimento valida, então bloqueia o movimento; aluno ajusta PLs manualmente em `Contas > Plano` antes de confirmar o movimento.

### 6.B-6 Manutenção em superfície única

> Como **arquiteto**, quero **que todas as operações canônicas de plano aconteçam em `Contas > Plano`**, para **evitar duplicação de superfície (AP-11) e garantir que aluno tenha um único lugar para gerir plano**.
>
> **Critérios de aceite:**
> - Dado qualquer origem, quando aluno vai criar, editar, aceitar sugestão ou descartar, então a operação só é possível em `Contas > Plano`.
> - Dado sugestão suspensa existe, quando outras telas apresentam sinalização, então apenas sinalizam (não permitem aceite); redirecionamento para `Contas > Plano` é obrigatório.
> - Dado aluno quer ver histórico de ajustes aceitos/descartados ou snapshots de ciclos fechados, então acessa em `Contas > Plano`.

## 6.C Consistência de agregados (transversal)

### 6.C-1 Reconciliação diária

> Como **mentor**, quero **que o sistema detecte e reporte automaticamente divergências entre o fato (trades) e os agregados derivados (PL do plano, saldo da conta)**, para **evitar que aluno descubra inconsistência antes de mim**.
>
> **Critérios de aceite:**
> - Dado CF de reconciliação periódica, quando executa, então compara soma do PnL dos trades do ciclo ativo vs PL realizado do plano vs saldo atual da conta.
> - Dado divergência acima do threshold declarado, quando detecta, então registra evento em coleção de reconciliação visível ao mentor.
> - Dado divergência detectada, quando aluno consulta suas telas, então não vê o evento de reconciliação diretamente (a menos que confirmado/escalado pelo mentor) — evita ansiedade antes de diagnóstico.
> - Dado divergência detectada e aluno ou mentor aciona o recálculo manual em `Conta` ou `Plano`, quando executa, então recomputa o agregado afetado a partir dos trades e atualiza o snapshot derivado.
> - Dado ocorre falha persistente de CF crítica (PL, compliance, movimento), quando retry nativo esgota, então payload vai para DLQ e alerta é emitido.
>
> Escopo inicial: detecção + alerta + recálculo manual (botões em Conta e Plano já existentes em produção). Auto-heal automatizado é evolução futura — ver WL-01.

---

# 7. Padrões Formalizados

## Padrão A — Porta → Gateway → Fato → Opinião

**Quando aplica:** toda superfície externa que captura intenção ou evidência e precisa produzir estado canônico.

**Comportamento esperado:**
1. Porta captura input (form, upload, gatilho).
2. Porta delega ao gateway sem calcular estado derivado.
3. Gateway valida invariantes do agregado (INV-20).
4. Gateway persiste fato com origem marcada, `rawPayload` congelado (quando aplicável), idempotência garantida.
5. Gateway dispara CFs que derivam estado (PL, compliance, saldo, movimento) sob consistência eventual.
6. Leitores externos (shadow, IA, mentor) consomem fato e emitem opinião em coleções separadas.
7. Malha de reconciliação (INV-22) monitora consistência entre fato e agregados derivados.

**Variações:**
- Trade: 3 portas (manual, import_performance, import_orders) → 1 gateway → 1 coleção canônica com estrutura de Detalhe do trade (INV-21).
- Plano: 3 portas (Criação Real/Demo, Criação Mesa, Ajuste) → 1 gateway → 1 coleção canônica (sem estrutura de Detalhe; plano é substituído em ciclo novo, não enriquecido).

**Ligação com invariantes:** INV-20 (gateway canônico), INV-21 (fato vs opinião + Detalhe do trade), INV-22 (reconciliação).

## Padrão B — Agregado canônico com operação única

**Quando aplica:** todo domínio que tem raiz de consistência e múltiplas superfícies de interação.

**Comportamento esperado:**
1. Domínio tem agregado raiz com invariantes declaradas.
2. Invariantes são validadas no gateway, não em UI.
3. UI é superfície de manipulação, não dona de regra.
4. Cada operação canônica (criar, aceitar sugestão, descartar, editar) tem superfície única.
5. Outras telas podem sinalizar estado, mas não executar operação canônica — redirecionam para a superfície única.

**Variações:**
- Trade: superfície canônica = telas de trade (entry, detail, feedback).
- Plano: superfície canônica = `Contas > Plano` para todas as operações (criação, edição, aceite/descarte de sugestão, histórico, snapshots).
- Conta: superfície canônica = `Contas` (CRUD).
- Ordem: superfície canônica = tela de Import Orders + consulta via trade.

**Ligação com invariantes:** INV-20 (invariantes no gateway). Absorve o que v1 propôs como INV-24 (superfície única), formalizado aqui como propriedade arquitetural reforçada por AP-11.

---

# 8. Anti-padrões

Numeração continua sequência do PROJECT.md (AP-01 a AP-08 pré-existentes; esta spec adiciona AP-09 a AP-12).

| ID | Regra (resumo) | Tipo | Condição de revisão |
|----|----------------|------|---------------------|
| AP-09 | Cálculo em tela — UI que calcula PL, compliance, shadow, saldo ou movimento. Pertence ao gateway ou CFs pós-gateway. | Fato (estrutural) | Nunca — revisão exige major bump. |
| AP-10 | Opinião dentro do fato — persistir parecer (shadow, IA, mentor) como campo dentro de `trades` ou outra coleção canônica. Opinião tem coleção própria. | Fato (estrutural) | Nunca — revisão exige major bump. |
| AP-11 | Duplicação de superfície — mais de uma tela permitindo a mesma operação canônica (ex: aceitar sugestão de plano em dois lugares). | Fato (estrutural) | Nunca — revisão exige major bump. |
| AP-12 | Função especializada soldada em módulo chamador — função atômica reutilizável morando dentro do módulo que apenas a dispara (ex: cálculo de ajuste de plano dentro de fechamento de ciclo). Deve ser extraída. | Fato (estrutural) | Nunca — revisão exige major bump. |

**Contra-exemplos curtos:**

- **AP-09 violado:** componente de tela de trade calcula PL localmente e grava em `trades.pnl`. Correto: gateway cria trade, CF `onTradeCreated` calcula e grava PL.
- **AP-10 violado:** shadow detecta overtrading e grava `trades.shadowPatterns = [...]`. Correto: shadow grava em `shadow/{studentId}/patterns/{patternId}` referenciando o trade.
- **AP-11 violado:** tela de Mesa Prop permite aceitar sugestão de plano inline, além de `Contas > Plano`. Correto: tela de Mesa sinaliza "há sugestão" e redireciona.
- **AP-12 violado:** função `calcularAjustePlano` mora dentro de `useCycleClose.js`. Correto: função é extraída para módulo próprio e `useCycleClose` apenas a chama.

---

# 9. Questões em Aberto

## Q-01 — Split da spec em dois arquivos pós-R1 **[RESOLVIDA em v0.2]**

**Resolução:** arquivo único confirmado. CC aceitou o argumento (YAGNI em infra com solo dev; 1 arquivo = 1 reviewer pass = menos token; split pós-aprovação custa ~30 min se necessário no futuro). Questão removida do escopo ativo.

## Q-02 — Política de auto-heal da reconciliação **[RESOLVIDA e movida para §11 Wishlist em v0.2]**

**Resolução:** hoje já existem dois botões manuais de recálculo (um em Conta, outro em Plano) que atuam quando há divergência detectada. Automação total do auto-heal é evolução futura, não pendência de decisão da spec. Ver **WL-01** em §11.

## Q-03 — Persistência de `suggestedPlan` **[AGUARDANDO SESSÃO C]**

**Descrição:** Sugestão suspensa pode ser subcampo do plano ativo ou subcoleção.

**Alternativas consideradas:**
- (a) Subcampo: mais simples, basta 1 read. Limitação: apenas uma sugestão viva por vez; histórico de sugestões descartadas precisaria de outra coleção.
- (b) Subcoleção: permite histórico nativo de sugestões aceitas/descartadas. Custo: 1 read extra para listar sugestão ativa.

**Por que não decidido:** é decisão de schema Firestore (spec-out).

**Quem decide + quando:** CC no impact doc.

## Q-04 — Classificação de ordens Tradovate além de AutoLiq

**Descrição:** Campo `text` das ordens emite Tradingview, Exit, multibracket, Stop, Limit, AutoLiq, vazio. Spec trata AutoLiq explicitamente (badge). Para os demais, apenas diz "parser canônico preserva o valor no `canonicalFields`".

**Alternativas consideradas:**
- (a) Cada valor tem tratamento visual/semântico próprio em staging.
- (b) Apenas AutoLiq recebe destaque; demais são propriedade consultável mas sem UI especial.
- (c) Futuros patterns (#129) decidem por valor caso a caso.

**Por que não decidido:** não há caso de negócio explícito para destacar Stop ou Limit em staging. AutoLiq tem caso (bust). Demais podem ser adicionados em spec de dashboard emocional (#131) ou shadow patterns (#129).

**Quem decide + quando:** Marcio, quando #131 ou #129 trouxer demanda concreta.

## Q-05 — Enrichment dispara recálculo de shadow/IA **[RESOLVIDA em v0.2]**

**Resolução:** enrichment **dispara** recálculo. Acoplamento explícito. Virou critério de aceite em §6.A-3 e §6.A-4.

## Q-06 — Failsafe para ciclo com vencimento sem ação do mentor **[RESOLVIDA em v0.5]**

**Resolução:** questão deixa de existir. Fechamento de ciclo é evento temporal determinístico pelo sistema (§6.B-4 reescrita em v0.5). Vencimento é relógio, não ação humana. Não há "atraso" possível — ciclo fecha no vencimento independente de mentor ou aluno. Questão removida do escopo ativo.

---

# 10. Referências

## Sessões de origem (datas, não conteúdo)

**Referências operacionais:**
- **Protocolo §4.0 (Abertura de Sessão):** definido em `CLAUDE.md` do repositório.
- **INV-01 a INV-18:** registradas em `PROJECT.md` do repositório.
- **AP-01 a AP-08:** registradas em `PROJECT.md` do repositório.

**Histórico desta spec:**

- Sessão anterior Opus (18/04/2026): produção da síntese v1 + 4 refinarias.
- Sessão Opus (18/04/2026): integração em síntese v2 aprovada, conversão para spec v0.1.
- Sessão Opus (madrugada 18→19/04/2026, revisão Marcio): conversão para spec v0.2 após revisão linha a linha.
- Sessão C (19/04/2026): R1 técnico verificado contra código (4 findings + 1 nitpick, 312 palavras, zero bloqueios estruturais). F-A HIGH acionou WL-04 (migração shadowBehavior).
- Sessão Opus (19/04/2026): absorção R1 → spec v0.3.
- Sessão C (19/04/2026): R2 (2 findings de simetria, zero estruturais). G1 propagou critério F-B para §6.A-2; G2 replicou gating WL-04 para AP-10.
- Sessão Opus (19/04/2026): absorção R2 → spec v0.4. **Pronta para AI reviewer externo.**
- AI reviewer externo (19/04/2026): Sonnet fresco + Opus fresco retornaram NEEDS + NEEDS. 13 findings consolidados (3 overlap + 7 só R1 + 3 só R2). Matriz "dois reviewers frescos" provou valor (não são redundantes).
- Sessão Opus (19/04/2026): absorção dos external reviews → spec v0.5. Decisões de negócio: fechamento de ciclo como evento temporal determinístico; Opção A para INV-21/AP-10; promoção eval→funded fecha ciclo.

## Specs relacionadas

- `SPEC-mesa-prop-v2.md` (Sessão B, aguardando aprovação — não depende desta spec, mas compartilha Padrão B).
- `SPEC-revisao-semanal-v*.md` (Sessão A #102 — **dependência bidirecional**: §6.B-4 desta spec depende de #102 estar em produção para fechamento de ciclo funcionar conforme desenhado; #102 reusa função de snapshot de §6.B-4).

## Issues GitHub relacionadas

Listadas aqui conforme estado atual. Issues derivadas desta spec só serão criadas após aprovação do bundle (INV-19).

- **#128 (épico Pipeline Import):** esta spec é a base para refazer o épico com sub-issues alinhadas aos padrões.
- **#93 (Order Import v1.1 — já merged):** regressão de staging bypass violou INV-01. Sub-issue nova precisa reinstaurar gate.
- **#130 (Plano Sugerido):** alinha com Ajuste de Plano (§6.B-3). Precisa revisar conforme padrões desta spec.
- **#131 (Dashboard Emocional):** consumidor de opinião (shadow, AutoLiq, etc.).
- **#129 (Shadow Trade 15 patterns):** consumidor de fato para emitir opinião.
- **#102 (Revisão Semanal):** dependência crítica para §6.B-4 (fechamento de ciclo disparado pelo mentor na revisão). Ver WL-02.
- **#52 (Prop Firms):** consome AutoLiq para bust detection.

## Issues derivadas prováveis (não abrir ainda — INV-19)

- Fix staging bypass do Import Orders + detector de descontinuidade + correlator simétrico SHARED_ENTRY/SHARED_EXIT.
- Refactor: extração da função de ajuste de plano do módulo de fechamento de ciclo (AP-12).
- Fix Criação de Plano Mesa (evaluation vs funded + micro agressivo).
- **Issue separada de Reconciliação de agregados (INV-22):** prioridade alta, pós-épico #128, estimativa 2-3 dias isolados. Pode ter INV-19 bundle próprio dependendo do impact.
- Garantias de retry/DLQ em CFs críticas (PL, compliance, movimento) — pode ser parte da mesma issue de reconciliação ou irmã.

---

# 11. Wishlist / Parking Lot

Evoluções identificadas durante a revisão que não entram no escopo imediato mas ficam registradas para não se perderem. Não são questões em aberto (§9) — são itens conscientemente adiados com racional de por que esperar.

## WL-01 — Auto-heal automatizado da reconciliação

**Contexto:** INV-22 prevê reconciliação periódica detectando divergências entre fato (trades) e agregados derivados (PL do plano, saldo da conta). Hoje já existem dois botões manuais de recálculo — um em Conta, outro em Plano — que atuam quando divergência é detectada.

**Evolução desejada:** automatizar o recálculo quando CF de reconciliação detectar divergência abaixo de threshold de segurança e com causa identificável (ex: CF que falhou com payload recuperável em DLQ). Acima do threshold ou causa ambígua, mantém alerta manual.

**Pré-requisitos:**
- Threshold de segurança definido por agregado
- Taxonomia explícita de "causa identificável" (DLQ recuperável, recálculo determinístico simples, etc.)
- Idempotência garantida no recálculo automático

**Disparador para priorizar:** volume de chamadas de suporte por divergência > N/mês, OU taxa de divergências detectadas por reconciliação > M%. Até lá, botões manuais bastam.

## WL-02 — Fechamento de ciclo integrado à Revisão Semanal (#102)

**Contexto:** §6.B-4 estabelece que fechamento de ciclo é disparado pelo mentor dentro da Revisão Semanal, com sistema sinalizando vencimento no ritual de revisão. Hoje a Revisão Semanal (#102) está em construção.

**Evolução desejada:** integrar fechamento de ciclo como subproduto da Revisão Semanal, com dois comportamentos:
1. Sistema detecta ciclo vencido e sinaliza visualmente ao mentor na tela da revisão
2. Mentor dispara fechamento dentro do fluxo da revisão, atomicamente com snapshot de KPIs da semana

**Pré-requisito:** #102 (Revisão Semanal) implementada e em produção.

**Disparador para priorizar:** #102 entra em produção. Integração vira feature imediata subsequente, não opcional.

## WL-03 — Automação da classificação de issues (INV-19)

**Contexto:** INV-19 atual opera com classificação manual pela Sessão C no protocolo §4.0. Em dúvida, classifica como arquitetural (failsafe explícito).

**Evolução desejada:** classificador IA (CF `classifyIssueBundle`) analisa body da issue e retorna `requer_bundle: true/false` com justificativa. GitHub Action aplica label. Hook de merge bloqueia branch de issue classificada como `bundle-required` sem bundle linkado.

**Pré-requisito:** evidência documentada de falhas da classificação manual.

**Disparador para priorizar:** ≥3 falsos negativos documentados em 6 meses (issue classificada como não-arquitetural que deveria ter sido bundle, descoberto pós-merge).

## WL-04 — Migração de `shadowBehavior` de inline para coleção dedicada **[PLANO DE REMEDIAÇÃO DE VL-01]**

**Contexto:** Issue #129 (merged em v1.30.0) estabeleceu persistência de shadow inline no documento `trades` via `functions/analyzeShadowBehavior.js:416` (`batch.update(tradeRef, { shadowBehavior: shadow, ... })`). Consumido por `TradeDetailModal.jsx`, `FeedbackPage.jsx`, `ShadowBehaviorPanel.jsx`. Essa persistência viola INV-21 (§5.2) e AP-10 (§8) — são gêmeos semânticos: INV-21 positiva, AP-10 negativa, mesmas linhas de código violam as duas.

Descoberto em R1 pela Sessão C (19/04/2026) com verificação direta contra o código em produção. Simetria AP-10 explicitada em R2 (19/04/2026). Registrada como violação ativa rastreada em §12 VL-01.

**Tratamento (decisão Marcio na absorção dos reviews externos):** INV-21 e AP-10 entram em vigor como invariantes ativas na v1.0. Shadow inline é violação conhecida rastreada (§12 VL-01), não atenuação das invariantes. Invariantes ativas + violação rastreada > invariantes "spec-only". WL-04 é plano de remediação, não bloqueia promoção.

**Evolução necessária:**
1. Migrar persistência de `shadowBehavior` para coleção dedicada (conceitual; nome concreto é spec-out).
2. Atualizar consumidores (`TradeDetailModal`, `FeedbackPage`, `ShadowBehaviorPanel`) para ler da nova coleção.
3. Backfill dos trades existentes — script idempotente que lê campo inline, escreve na coleção dedicada, e remove o campo inline em commit separado pós-validação.
4. Remover escrita inline de `analyzeShadowBehavior.js`.

**Escopo:** issue derivada isolada do épico #128, bundle próprio (afeta gateway de `trades` + coleção shadow + 3 consumidores = ≥2 agregados → INV-19 requer bundle).

**Disparador para priorizar:** imediato pós-aprovação do bundle desta spec.

---

# 12. Violações conhecidas legadas

Invariantes ativas desta spec têm violação pré-existente em código de produção. São **registradas aqui como dívida arquitetural rastreada**, não como atenuação da invariante. Cada entrada aponta para o item de Wishlist que é o plano de remediação.

## VL-01 — `shadowBehavior` inline em `trades`

**Invariantes violadas:** INV-21 (§5.2), AP-10 (§8).

**Código afetado:**
- `functions/analyzeShadowBehavior.js:416` — escreve `shadowBehavior` via `batch.update(tradeRef, { shadowBehavior: shadow, ... })`.
- Consumidores inline: `TradeDetailModal.jsx`, `FeedbackPage.jsx`, `ShadowBehaviorPanel.jsx`.

**Origem:** Issue #129, merged em v1.30.0.

**Plano de remediação:** WL-04 (§11).

**Status:** ativa em produção na data de promoção desta spec a v1.0. INV-21 e AP-10 entram em vigor com esta violação rastreada; novas escritas de opinião em agregado canônico continuam sendo violação e devem ser bloqueadas em code review.

---

**Fim da spec v1.0.**
