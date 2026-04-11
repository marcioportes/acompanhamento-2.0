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

### INV-14: Versionamento do PROJECT.md
Toda modificação do PROJECT.md **DEVE**: (1) incrementar versão no header (semver), (2) adicionar entrada na tabela de histórico, (3) declarar "baseado na versão X.Y.Z" na proposta. Na abertura de sessão, comparar versão do repo com versão em contexto — divergência = arquivo stale, reler antes de agir.

### INV-15: Aprovação Obrigatória para Persistência
Toda criação de collection, subcollection, ou campo novo no Firestore exige: (1) justificativa escrita com análise de dependência conceitual, (2) parecer técnico com prós/contras das opções de modelagem, (3) aprovação explícita do Marcio. Nenhuma estrutura de dados é criada sem passar por este gate.

### INV-16: Isolamento de Sessões Paralelas via Worktree (OBRIGATÓRIO SEMPRE)
**Toda sessão de código — paralela ou não — opera DENTRO de um git worktree dedicado. Sem exceção.** Trabalho direto na working tree principal (`~/projects/acompanhamento-2.0`) é **PROIBIDO** para qualquer modificação de código. O repo principal é trunk exclusivo — só recebe merges.

**Padrão de nome (único e inequívoco):** `~/projects/issue-{NNN}`
**Comando:** `git worktree add ~/projects/issue-{NNN} -b tipo/issue-NNN-descricao`
**Remoção:** após merge confirmado — `git worktree remove ~/projects/issue-{NNN}` (passo §4.3 obrigatório)

A criação do worktree é um passo do protocolo §4.0 Abertura de Sessão e **não pode ser omitida nem adiada**. Se você está prestes a editar um arquivo de código e não está dentro de `~/projects/issue-{NNN}`, PARE — crie o worktree primeiro.

---

## REGRA DE ATIVAÇÃO AUTOMÁTICA

Quando o usuário mencionar um issue, feature, fix, debt, ou qualquer intenção de modificar código, iniciar imediatamente o protocolo 4.0 (Abertura de Sessão) do PROJECT.md sem que o usuário precise pedir. Isso inclui:

1. **Verificar versão do PROJECT.md** (`head -5 docs/PROJECT.md`) — comparar com versão em contexto. Se divergir, reler o arquivo fresh antes de prosseguir (INV-14)
2. Verificar o issue no GitHub (`gh issue view NNN`)
3. **Ler campo "Chunks necessários" no body do issue**
   - Se campo ausente: preencher antes de prosseguir (grep no código + análise de impacto → propor chunks → aguardar aprovação)
4. **Consultar Registry de Chunks** (PROJECT.md §6.3) — verificar que todos os chunks com modo ESCRITA estão AVAILABLE
   - Se algum chunk está LOCKED: **PARAR**. Notificar Marcio com "CHUNK-XX locked por issue-YYY"
   - Se chunk não existe no registry: **PARAR**. Propor novo chunk ao Marcio
5. **Registrar lock** no registry: chunk + issue + branch + data
6. **Criar worktree isolado** (INV-16 — OBRIGATÓRIO, NUNCA OMITIR): `git worktree add ~/projects/issue-{NNN} -b tipo/issue-NNN-descricao`
7. Criar/verificar arquivo de controle em `docs/dev/issues/` (dentro do worktree)
8. Executar o Gate Pré-Código antes de tocar em qualquer arquivo de código

- Se o issue **não existir** no GitHub → perguntar ao usuário se deseja criá-lo
- Se o arquivo de controle **não existir** → criá-lo a partir do template (PROJECT.md §4.0), incluindo seção 6 (Chunks)
- Se o **worktree não existir** → criá-lo imediatamente (passo 6). **Nunca começar a editar código fora do worktree.**
- **Nunca pular etapas** — o passo do worktree é tão obrigatório quanto o arquivo de controle e o lock

> **Modo leitura** de chunk não requer lock — a sessão pode consultar arquivos de qualquer chunk.
> **Modo escrita** requer lock exclusivo — apenas uma sessão por chunk.

---

## PERMISSÕES IMPLÍCITAS

**Não requerem confirmação:**
- Operações de leitura: `grep`, `cat`, `ls`, `find`, `view`, `gh issue view`, `git log/status/diff`
- Comandos de build/test: `npm install`, `npm test`, `npm run build`
- Fetch de URLs: `github.com`, `npmjs.com`, `firebase.google.com`
- Edições de arquivos durante sessão aprovada: aprovar em lote (`shift+tab`)

**Requerem confirmação explícita:**
- `git commit`, `git push`
- `firebase deploy`
- Criação/deleção de branches
- Criação de PRs
- Deleção de Cloud Functions

**Automático (sem perguntar):**
- Protocolo de encerramento de sessão (PROJECT.md §4.3): executar automaticamente quando o issue for fechado (PR mergeado, issue closed, branch deletada). Atualizar documento de issue, PROJECT.md e commitar os docs.

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
6. A feature respeita todas as INV-01 a INV-16?
7. Qual o blast radius se algo der errado?
8. Existe rollback viável?
9. Quais testes existentes podem quebrar?
10. DebugBadge está presente em todos os componentes novos/tocados?

---

## CLOUD FUNCTIONS — CUIDADOS

- Todas CFs com Claude API requerem: `secrets: ['ANTHROPIC_API_KEY']`
- **Debt crítico:** `onTradeCreated` dispara em trades IMPORTED, corrompendo PL
- ~~**Debt crítico:** Node.js 20 depreca 30/04/2026 (DT-016) + firebase-functions SDK 4.9.0 → ≥5.1.0 (DT-028)~~ RESOLVIDO v1.22.0 — Node.js 22 + SDK 5.1

| Function | Trigger | Responsabilidade |
|----------|---------|-----------------|
| `onTradeCreated` | trades create | Atualiza PL do plano, compliance stats |
| `onTradeUpdated` | trades update | Recalcula PL, compliance |
| `classifyOpenResponse` | callable | Classifica respostas abertas via API Claude |
| `generateProbingQuestions` | callable | Gera 3-5 perguntas sondagem adaptativa |
| `analyzeProbingResponse` | callable | Analisa respostas do probing |
| `generateAssessmentReport` | callable | Gera relatório completo pré-mentor |
| `checkSubscriptions` | onSchedule (8h BRT) | Detecta vencimentos, marca overdue, expira trials, sincroniza accessTier |

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
students/{id}/subscriptions → type, status, accessTier, payments subcollection (DEC-055/056)
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
| `docs/PROJECT.md` | Propor adições no documento do issue. Verificar versão (INV-14) |
| `src/App.jsx` | Delta de rotas no documento do issue |
| `functions/index.js` | Delta de exports no documento do issue |
| `firestore.rules` | Delta de rules no documento do issue |
| `package.json` | Novas deps no documento do issue |
| `src/contexts/StudentContextProvider.jsx` | Consumido por CHUNK-02, 13, 14, 15. Delta no doc do issue |
| `src/utils/compliance.js` | Tocado por #113, #114. Delta no doc do issue |
| `src/hooks/useComplianceRules.js` | Tocado por #113, #114. Delta no doc do issue |

**Protocolo de contenção para sessões paralelas:**
1. Sessão que encontrar bloqueio em shared file documenta no `issue-NNN.md`
2. Propõe delta (nunca edita direto)
3. Notifica Marcio para resolução antes de prosseguir
4. NUNCA assume que o shared file está no mesmo estado da última leitura — lê fresh

---

## CHUNKS (registro de domínios)

> Cada issue de código DEVE ter campo "Chunks necessários" no body do GitHub (DEC-052).
> Modo leitura: consulta sem lock. Modo escrita: lock exclusivo obrigatório.
> Status e locks ativos: ver PROJECT.md §6.3 (fonte de verdade).

| Chunk | Domínio | Descrição | Arquivos principais |
|-------|---------|-----------|-------------------|
| CHUNK-01 | Auth & User Management | Autenticação, login, roles, sessão | `AuthContext`, `useAuth` |
| CHUNK-02 | Student Management | Dashboard aluno, dados do estudante, sidebar | `StudentDashboard`, `students` collection |
| CHUNK-03 | Plan Management | CRUD planos, ciclos, metas, stops, state machine | `PlanManagementModal`, `plans` collection |
| CHUNK-04 | Trade Ledger | Registro trades, gateway addTrade, parciais, PL | `useTrades`, `trades` collection, `addTrade` |
| CHUNK-05 | Compliance Engine | Regras compliance, scores, config mentor | `compliance.js`, `ComplianceConfigPage` |
| CHUNK-06 | Emotional System | Scoring emocional, TILT/REVENGE, perfil | `emotionalAnalysisV2`, `useEmotionalProfile` |
| CHUNK-07 | CSV Import | Parser CSV, staging, mapeamento, validação | `CsvImport/*`, `csvStagingTrades` |
| CHUNK-08 | Mentor Feedback | Feedback por trade, chat, status revisão | `Feedback/*`, `feedbackHelpers` |
| CHUNK-09 | Student Onboarding | Assessment 4D, probing, baseline, marco zero | `Onboarding/*`, `assessment` subcollection |
| CHUNK-10 | Order Import | Import ordens, parse ProfitChart-Pro, cross-check | `OrderImport/*`, `orders` collection |
| CHUNK-11 | Behavioral Detection | Motor detecção 4 camadas — FUTURO | `behavioralDetection` |
| CHUNK-12 | Cycle Alerts | Monitoramento ciclos, alertas — FUTURO | `cycleMonitoring` |
| CHUNK-13 | Context Bar | Barra contexto Conta>Plano>Ciclo>Período, provider | `StudentContextProvider`, `ContextBar`, `useStudentContext` |
| CHUNK-14 | Onboarding Auto | Pipeline CSV→indicadores→Kelly→plano sugerido | `OnboardingWizard`, `kellyCalculator`, `planSuggester` |
| CHUNK-15 | Swing Trade | Módulo carteira, indicadores portfólio, stress test | `PortfolioManager`, `portfolioIndicators` |
| CHUNK-16 | Mentor Cockpit | Torre de Controle, Revisão Semanal, sidebar mentor | `TorreDeControle`, `ReviewManager` |
| CHUNK-17 | Prop Firm Engine | Gestão de contas prop, engine de drawdown, templates, plano de ataque | `PropFirmEngine/*`, `propFirmTemplates` collection |

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
| ~~DT-016~~ | ~~Node.js 20 depreca~~ RESOLVIDO v1.22.0 | ~~CRÍTICA~~ | ~~30/04/2026~~ |
| ~~DT-028~~ | ~~firebase-functions SDK 4.5.0 → ≥5.1.0~~ RESOLVIDO v1.22.0 | ~~CRÍTICA~~ | ~~30/04/2026~~ |
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

- **PROJECT.md versão atual:** verificar com `head -5 docs/PROJECT.md` antes de usar (INV-14)
- Assessment/diagnóstico de trader: ler `trader_evolution_framework.md`
- Decision log completo: `docs/PROJECT.md` seção 7 (DEC-001 a DEC-052)
- Template de issue: `docs/PROJECT.md` seção 4.0 (inclui seção 6 Chunks obrigatória)
- Modelo comportamental: 4D (Emotional, Financial, Operational, Maturidade) × 5 estágios (Chaos → Mastery)
- Dois tiers: Espelho self-service (KPIs + diário + gates) vs Mentoria Alpha (+ ciclos + assessment + SWOT + feedback)
- Onboarding Automatizado: CSV → indicadores → Kelly → plano sugerido (DEC-051)
- Barra de Contexto Unificado: Conta > Plano > Ciclo > Período (DEC-047)

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
