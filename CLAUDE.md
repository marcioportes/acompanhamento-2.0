# CLAUDE.md — Espelho (Acompanhamento 2.0)

> Este arquivo é lido pelo Claude Code no início de cada sessão.
> Contém regras, invariantes e contexto necessários para trabalhar neste codebase.
> Para documentação completa e decision log: `docs/PROJECT.md` (SSoT do projeto).

## Projeto

**Espelho** é uma plataforma SaaS de mentoria comportamental para traders.
Codebase/repo/Firebase: "acompanhamento-2.0" (DEC-031 — nome público ≠ nome de código).
Stack: React 18 + Vite, Firebase/Firestore, Cloud Functions, Tailwind CSS, Vercel.
Testes: Vitest + jsdom. Theme: Glassmorphism dark.

## Versão Atual

Consultar `src/version.js` — é a fonte de verdade para a versão.

---

## INVARIANTES ARQUITETURAIS (INVIOLÁVEIS)

> Qualquer proposta que quebre uma invariante deve ser redesenhada. Sem exceção.

### INV-01: Airlock de Dados Externos
Dados externos (CSV, API, migração, bulk import) **NUNCA** escrevem diretamente em collections de produção (`trades`, `plans`, `accounts`). Sempre usar staging collection separada + ingestão via métodos validados (`addTrade`, `updatePlan`, etc.).

### INV-02: Gateway Único para `trades`
Toda escrita na collection `trades` **DEVE** passar por `addTrade` (ou equivalente explicitamente validado e aprovado).

### INV-03: Integridade do Pipeline de Side-Effects
O pipeline `trades → Cloud Functions → (PL, compliance, emotional scoring, mentor alerts)` é cadeia inquebrável. Qualquer mudança em um elo exige análise de impacto em todos os elos downstream.

### INV-04: DebugBadge Universal
Todo componente de UI (tela, modal, card) deve exibir `DebugBadge` com `version + build + git commit hash`. Componentes embedded: `{!embedded && <DebugBadge component="NomeExato" />}`. Prop `component` é **obrigatória**.

### INV-05: Testes como Pré-Requisito
Toda alteração de business logic exige: análise de impacto documentada + testes incrementais de regressão + bug fixes reproduzidos em teste antes do fix.

### INV-06: Formato de Datas BR
Todas as datas usam formato brasileiro (DD/MM/YYYY). Parsing prioriza BR. Semana começa na segunda-feira.

### INV-07: Autorização Antes de Codificar
Antes de codificar qualquer feature ou mudança arquitetural — especialmente Firestore, campos de status, ou Cloud Functions — a proposta deve ser apresentada e aprovada explicitamente.

### INV-08: CHANGELOG Obrigatório
Toda versão (major, minor, patch) deve ter entrada no CHANGELOG (seção 10 do PROJECT.md) antes do merge.

### INV-09: Gate Obrigatório Pré-Código e Pré-Entrega

**Pré-código (nesta ordem):**
1. Análise de impacto formal (collections, CFs, hooks, side-effects, dados parciais)
2. Proposta apresentada → AGUARDAR aprovação explícita do Marcio
3. Codificar somente após aprovação

**Pré-entrega:**
4. `version.js` atualizado
5. CHANGELOG atualizado
6. Testes criados para toda lógica nova
7. DebugBadge em todos os componentes novos/tocados com `component="NomeExato"`
8. Commit via Claude Code ou git direto (commits em linha única)
9. PARAR — aguardar confirmação do Marcio

### INV-10: Verificar Estrutura Firestore Antes de Criar/Modificar
Antes de criar qualquer collection, subcollection, campo ou estrutura nova: `grep` pelo nome nos hooks, CFs e componentes. Nunca criar estrutura nova sem aprovação explícita.

### INV-11: Nunca Priorizar Velocidade sobre Rigor
Se houver conflito entre entregar rápido e seguir as invariantes, as invariantes vencem. Sempre.

### INV-12: Parciais São Campo no Documento — NÃO Subcollection
`_partials` é um campo array dentro do documento `trades/{id}`. Não existe subcollection. Todo trade tem parciais (mínimo 1 ENTRY + 1 EXIT).

### INV-13: Rastreabilidade Obrigatória por Issue
Toda modificação de código exige:
1. Issue aberto no GitHub
2. Arquivo de controle `docs/dev/issues/issue-NNN-descricao.md` (template na seção 4.0 do PROJECT.md)
3. Branch nomeada `tipo/issue-NNN-descricao`

Sem esses três artefatos, o Gate Pré-Código **não pode ser iniciado**.

---

## DIRETRIZ CRÍTICA DE VERIFICAÇÃO

**Regra absoluta: toda afirmação verificável exige verificação prévia. Sem exceção.**

Aplica-se a:
- Fluxo de dados, origem de campos, estrutura de collections
- Estado de branches, PRs, merges, deploys
- Existência/ausência de arquivos, funções, componentes, campos
- Interpretação de outputs de terminal, screenshots, logs
- Estado de features (implementado, pendente, quebrado)
- Compatibilidade entre componentes, hooks, CFs

**Protocolo (nesta ordem):**
1. "Estou prestes a afirmar algo verificável?" → Se sim, PARAR
2. Identificar fonte de verdade (código, remote, Firestore, output)
3. Verificar com `grep` + `view` + `bash`
4. Cruzar com contexto existente (issue files, PROJECT.md)
5. Só então concluir

**Nunca inferir. Se não verificou, não afirma. Se está incerto, diz "preciso verificar" e verifica.**

---

## ANTI-PATTERNS DOCUMENTADOS

- **AP-01: Shortcut Through Production** — Escrever dados externos direto em collections de produção. CFs não distinguem origem.
- **AP-02: Patch Cascading** — Bypass causa bugs → adicionar guards em cada componente em vez de corrigir causa raiz. Cada patch é ponto de falha adicional.
- **AP-03: Optimistic Reuse** — Assumir que collection/método pode ser reaproveitado sem impact analysis. Collections têm contratos implícitos com CFs e listeners.
- **AP-04: Invariant Drift** — Receber diretrizes explícitas e ignorá-las em nome de eficiência. Entregar código sem testes, sem version.js, sem CHANGELOG, sem aguardar aprovação.
- **AP-05: Promessa Verbal Sem Execução** — Reconhecer falha (AP-04), verbalizar compromisso, e violar as mesmas regras na mesma sessão. Mais grave que AP-04 — destrói confiança.
- **AP-06: Criação de Estruturas Firestore Sem Aprovação** — Assumir como o banco funciona em vez de verificar. Nunca criar subcollections/campos/estruturas sem grep + aprovação.
- **AP-07: Inferência Superficial** — Afirmar algo sobre fluxo de dados, campos ou estado baseado em leitura parcial ou nomes de variáveis, sem rastrear fluxo real.

---

## CHECKLIST DE IMPACTO (executar mentalmente antes de qualquer proposta)

1. Quais collections são tocadas? (leitura E escrita)
2. Quais Cloud Functions disparam? (triggers onCreate/onUpdate)
3. Quais hooks/listeners são afetados? (re-renders, queries)
4. Há side-effects em PL, compliance, emotional scoring?
5. Dados parciais/inválidos podem entrar no caminho crítico?
6. A feature respeita todas as INV-01 a INV-13?
7. Qual o blast radius se algo der errado?
8. Existe rollback viável?
9. Quais testes existentes podem quebrar?
10. DebugBadge está presente em todos os componentes novos/tocados?

---

## CLOUD FUNCTIONS — CUIDADOS

- Todas CFs com Claude API requerem: `secrets: ['ANTHROPIC_API_KEY']`
- **Debt crítico:** `onTradeCreated` dispara em trades IMPORTED, corrompendo PL
- **Debt crítico:** Node.js 20 depreca 30/04/2026 (DT-016) + firebase-functions SDK 4.9.0 → ≥5.1.0 (DT-028)

| Function | Trigger | Responsabilidade |
|----------|---------|-----------------|
| `onTradeCreated` | trades create | Atualiza PL do plano, compliance stats |
| `onTradeUpdated` | trades update | Recalcula PL, compliance |
| `classifyOpenResponse` | callable | Classifica respostas abertas via API Claude |
| `generateProbingQuestions` | callable | Gera 3-5 perguntas sondagem adaptativa |
| `analyzeProbingResponse` | callable | Analisa respostas do probing |
| `generateAssessmentReport` | callable | Gera relatório completo pré-mentor |

---

## COLLECTIONS FIRESTORE

```
trades (collection principal)
├── Escritor: addTrade — GATEWAY ÚNICO (INV-02)
├── CFs: onTradeCreated, onTradeUpdated
├── Campo _partials: array INLINE no documento (INV-12) — NÃO subcollection
└── Consumers: StudentDashboard, TradingCalendar, AccountStatement,
               FeedbackPage, PlanLedgerExtract, MentorDashboard

plans → cycles, currentCycle, state machine (IN_PROGRESS→GOAL_HIT/STOP_HIT→POST_GOAL/POST_STOP)
accounts → currency, balance, broker
emotions → scoring -4..+3 normalizado 0-100, TILT/REVENGE detection
csvStagingTrades → staging CSV, nunca dispara CFs diretamente
orders → staging de ordens brutas (CHUNK-10)
students/{id}/assessment/ → questionnaire, probing, initial_assessment (CHUNK-09)
```

---

## CONVENÇÕES

### Git
- Branches: `feature/issue-NNN-descricao`, `fix/issue-NNN-descricao`, `debt/issue-NNN-descricao`, `arch/issue-NNN-descricao`
- Commits em linha única: `feat: descrição (issue #NNN)`, `fix: ...`, `debt: ...`, `docs: ...`

### Classificação de issues (prefixo no título)
`feat:` `fix:` `debt:` `arch:` `ops:` `epic:`

### Código
- `??` não `||` para segurança com valores falsy-zero
- Campo de ticker: `symbol`, não `name`
- Trade completo: emotionEntry + emotionExit + setup (stopLoss opcional)
- Firestore rules: `auth != null` como default (DEC-025)

### Testes
- Framework: Vitest + jsdom
- Localização: `src/__tests__/utils/` para novos utils
- Padrão: bug fix → reproduzir em teste → corrigir → teste passa

---

## SHARED INFRASTRUCTURE (nunca editar sem delta documentado)

| Arquivo | Protocolo |
|---------|-----------|
| `src/version.js` | Propor bump no documento do issue |
| `docs/PROJECT.md` | Propor adições no documento do issue |
| `src/App.jsx` | Delta de rotas no documento do issue |
| `functions/index.js` | Delta de exports no documento do issue |
| `firestore.rules` | Delta de rules no documento do issue |
| `package.json` | Novas deps no documento do issue |

---

## CHUNKS (registro de domínios)

| Chunk | Domínio | Arquivos principais |
|-------|---------|-------------------|
| CHUNK-01 | Auth & User Management | `AuthContext`, `useAuth` |
| CHUNK-02 | Student Management | `StudentDashboard`, `students` collection |
| CHUNK-03 | Plan Management | `PlanManagementModal`, `plans` collection |
| CHUNK-04 | Trade Ledger | `useTrades`, `trades` collection, `addTrade` |
| CHUNK-05 | Compliance Engine | `compliance.js`, `ComplianceConfigPage` |
| CHUNK-06 | Emotional System | `emotionalAnalysisV2`, `useEmotionalProfile` |
| CHUNK-07 | CSV Import | `CsvImport/*`, `csvStagingTrades` |
| CHUNK-08 | Mentor Feedback | `Feedback/*`, `feedbackHelpers` |
| CHUNK-09 | Student Onboarding | `Onboarding/*`, `assessment` subcollection |
| CHUNK-10 | Order Import | `OrderImport/*`, `orders` collection |
| CHUNK-11 | Behavioral Detection | `behavioralDetection` — FUTURO |
| CHUNK-12 | Cycle Alerts | `cycleMonitoring` — FUTURO |

---

## MILESTONES ATIVOS

### v1.1.0 — Espelho Self-Service (PRIORIDADE)
14 issues. Foco: dois tiers (self-service + Alpha), rename externo, Node.js migration, stability fixes.
Issues-chave: #100 (epic self-service), #96 (Node 20→22), #3 (Aluno Dashboard V2)

### v1.2.0 — Mentor Cockpit
10 issues. Foco: Torre de Controle (#101), Revisão Semanal (#102), Performance (#103).

---

## DÍVIDAS TÉCNICAS ATIVAS

| ID | Descrição | Prioridade | Deadline |
|----|-----------|-----------|----------|
| DT-016 | **Node.js 20 depreca** | **CRÍTICA** | **30/04/2026** |
| DT-028 | **firebase-functions SDK 4.9.0 → ≥5.1.0** | **CRÍTICA** | **30/04/2026** |
| DT-002 | Cycle transitions sem fechamento formal | ALTA | — |
| DT-027 | Rename externo UI "Acompanhamento 2.0" → "Espelho" | ALTA | Antes da comunicação |
| DT-012 | Mentor não consegue editar feedback já enviado | MÉDIA | — |
| DT-011 | Templates CSV vazam entre alunos (sem filtro studentId) | MÉDIA | — |
| DT-020 | Teclas seta alteram valores em campos preço/qty (modais) | MÉDIA | — |
| DT-022 | CF scheduled limpeza csvStagingTrades não implementada | MÉDIA | — |
| DT-008 | formatCurrency hardcoded R$ em MentorDashboard | BAIXA | — |
| DT-007 | DebugBadge duplo no ComplianceConfigPage embedded | BAIXA | — |
| DT-015 | recalculateCompliance sem writeBatch (não atômico) | BAIXA | — |
| DT-018 | FeedbackPage não reflete edições de trade em tempo real | BAIXA | — |
| DT-025 | Campos `hasPartials`/`partialsCount` legados nos docs trades | BAIXA | — |

---

## REFERÊNCIAS OBRIGATÓRIAS

- Assessment/diagnóstico de trader: ler `trader_evolution_framework.md`
- Decision log completo: `docs/PROJECT.md` seção 7 (DEC-001 a DEC-044)
- Template de issue: `docs/PROJECT.md` seção 4.0
- Modelo comportamental: 4D (Emotional, Financial, Operational, Maturidade) × 5 estágios (Chaos → Mastery)
- Dois tiers: Espelho self-service (KPIs + diário + gates) vs Mentoria Alpha (+ ciclos + assessment + SWOT + feedback)

---

## ESTRUTURA DE DOCUMENTAÇÃO

```
docs/
├── PROJECT.md                  ← SSoT do projeto (ler para contexto completo)
├── dev/
│   └── issues/
│       └── issue-NNN-*.md      ← Especificação por issue (template em PROJECT.md §4.0)
├── ops/                        ← Deploy, install, migration
└── archive/                    ← Sessões encerradas
```

GitHub é SSoT para numeração de issues — PROJECT.md reflete o GitHub, nunca o contrário (DEC-039).
