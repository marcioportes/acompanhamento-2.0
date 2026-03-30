# PROJECT.md — Acompanhamento 2.0
## Documento Mestre do Projeto · Single Source of Truth

> **Versão:** 0.1.0  
> **Criado:** 26/03/2026 — sessão de consolidação documental  
> **Fontes:** ARCHITECTURE.md, AVOID-SESSION-FAILURES.md, VERSIONING.md, CHANGELOG.md, CHUNK-REGISTRY.md  
> **Mantido por:** Marcio Portes (integrador único)

---

## COMO USAR ESTE DOCUMENTO

Este é o único documento de referência permanente do projeto. Todos os outros documentos de diretrizes, arquitetura e processo foram consolidados aqui.

**O que vive aqui:**
- Stack, infraestrutura e convenções
- Invariantes arquiteturais (regras invioláveis)
- Protocolo de sessão de desenvolvimento (gate pré-código, pré-entrega, encerramento)
- Protocolo de sessões paralelas (chunks, locks, shared files)
- Decision log (DEC-xxx)
- Dívidas técnicas ativas (DT-xxx)
- Anti-patterns documentados (AP-xxx)
- Changelog de versões
- Ferramentas do ambiente de desenvolvimento

**O que NÃO vive aqui:**
- Especificação de features → `docs/dev/issues/issue-NNN-nome.md`
- Documentação operacional (deploy, install, migration) → `docs/ops/`
- Arquivos históricos de sessões encerradas → `docs/archive/`

### Como atualizar este documento

Toda sessão de desenvolvimento que produzir uma decisão arquitetural, nova invariante, novo anti-pattern, ou mudança de versão **deve** atualizar as seções relevantes antes de encerrar. O formato de rastreabilidade é obrigatório:

```
| DEC-028 | Descrição da decisão | issue-NNN | 26/03/2026 14:30 |
```

Cada entrada deve conter: ID sequencial, descrição, issue de origem, data e hora. Isso garante que em caso de perda de contexto, seja possível reconstruir o histórico.

**Nunca** remover entradas antigas — apenas marcar como `SUPERSEDED` se uma decisão posterior a invalida.

---

## 1. STACK & INFRAESTRUTURA

| Camada | Tecnologia | Notas |
|--------|-----------|-------|
| Frontend | React 18 + Vite | SPA, glassmorphism dark theme |
| Styling | Tailwind CSS | Utility-first |
| Backend | Firebase (Firestore, Cloud Functions, Auth, Storage) | Serverless |
| Deploy | Vercel | Frontend only; Cloud Functions via Firebase CLI |
| Testes | Vitest + jsdom | Cobertura obrigatória em business logic |
| Versionamento | Git + GitHub | Issues numeradas, branches `feature/issue-NNN-descricao` |

### Ferramentas do ambiente de desenvolvimento

| Ferramenta | Versão | Uso |
|-----------|--------|-----|
| Node.js | 20.x (migrar para 22 — DT-016) | Runtime local + Cloud Functions |
| Firebase CLI | latest | Deploy de CFs e Firestore rules |
| GitHub CLI (`gh`) | 2.86.0 | Gestão de issues, PRs e milestones via script |
| PowerShell | Windows | Shell padrão — commits em linha única obrigatório |
| Obsidian | latest | Leitura e edição de `.md` — abrir repo como vault |
| Vite | 4.x | Dev server + build |

**Convenções PowerShell — obrigatórias em todos os scripts:**

1. **Execução de scripts** — PowerShell bloqueia `.ps1` por padrão (`ExecutionPolicy Restricted`). Todo script do projeto deve começar com:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
   Afeta apenas a sessão atual do terminal — sem impacto permanente no sistema.

2. **Redirecionamento de stderr** — Nunca usar `2> arquivo.txt`. O PowerShell grava em UTF-16 LE com BOM, incompatível com o git (não detecta modificações corretamente no `git status`). Usar `2>$null` para suprimir, ou `try/catch` para tratar. **Nunca redirecionar stderr para arquivo.**

3. **Commit messages** — Não suporta multiline em `git commit -m`. Sempre em linha única.

**GitHub CLI — comandos frequentes:**
```powershell
gh issue list --state open          # listar issues abertos
gh issue create --title "..." --body "..." --label "type:feat"
gh issue edit NNN --title "..." --add-label "milestone:v1.1.0"
gh issue close NNN
gh pr create --title "..." --body "..."
```

---

## 2. MILESTONES E ROADMAP

### v1.1.0 — Espelho Self-Service
**Foco:** Dois tiers (self-service + Alpha), rename externo, Node.js migration, stability fixes
**Prioridade:** CRÍTICA — migração do grupo ativo (48 alunos) em andamento
**GitHub Milestone:** `v1.1.0 - Espelho Self-Service` (14 issues)

Issues:
- `#100` epic: Espelho — Modo Self-Service (tier self-service + rename externo)
- `#96`  debt: Node.js 20→22 nas Cloud Functions (deadline 30/04/2026)
- `#93`  feat: Order Import v1.1 — Modo Criação
- `#91`  debt: Mentor editar feedback já enviado
- `#90`  fix: Screen flicker CSV staging activation
- `#89`  fix: Aluno não consegue deletar plano
- `#66`  feat: Curva de Patrimônio por moeda + curva EV planejado
- `#64`  refactor: Dashboard Aluno — Refatorar tabela SWOT
- `#55`  debt: DebugBadge duplo no ComplianceConfigPage embedded
- `#52`  epic: Gestão de Contas em Mesas Proprietárias (Prop Firms)
- `#48`  refactor: Student Emotional Detail — Reorganizar UX
- `#44`  feat: Feedback Aluno — Indicador de Trades Revisados no Sidebar
- `#19`  ops: Export/Import CSV do Firestore (backup + restore)
- `#3`   epic: Aluno Dashboard V2 — Evolução estrutural

Sub-tarefas (#100):
- C1: Campo `mentorshipTier` no student
- C2: UI condicional — esconder funcionalidades Alpha para self-service
- C3: Dashboard self-service — ajustes de layout
- C4: Rename externo — Espelho (title, logo, textos UI)
- C5: Custom domain — app.marcioportes.com.br

### v1.2.0 — Mentor Cockpit
**Foco:** Dashboard mentor consolidado (Torre de Controle) + revisão semanal + performance
**GitHub Milestone:** `v1.2.0 - Mentor Cockpit` (10 issues)

Épico guarda-chuva: `#101` epic: Dashboard Mentor — Torre de Controle

Sub-issues:
- `#103` feat: Performance — visão analítica retrospectiva (SWOT IA, Stop por Motivo)
- `#102` feat: Revisão Semanal — KPIs congelados + prep + link vídeo + resumo IA
- `#94`  feat: Controle de Assinaturas da Mentoria
- `#72`  epic: Fechamento de Ciclo — Apuração, Transição e Realocação
- `#70`  feat: Dashboard Mentor — Template na inclusão de Ticker
- `#56`  fix: Dashboard Mentor — Sidebar Badge Connection
- `#45`  refactor: Dashboard Mentor — Aba "Precisam de Atenção"
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

## 3. INVARIANTES ARQUITETURAIS

> Invariantes são regras que **NUNCA** devem ser violadas. Qualquer proposta que quebre uma invariante deve ser redesenhada antes de ser implementada.

### INV-01: Airlock de Dados Externos
Dados externos (CSV, API, migração, bulk import) **NUNCA** escrevem diretamente em collections de produção. Sempre usar staging collection separada + ingestão via métodos validados (`addTrade`, `updatePlan`, etc.).

### INV-02: Gateway Único para `trades`
Toda escrita na collection `trades` **DEVE** passar por `addTrade` (ou equivalente explicitamente validado e aprovado).

### INV-03: Integridade do Pipeline de Side-Effects
O pipeline `trades → Cloud Functions → (PL, compliance, emotional scoring, mentor alerts)` é uma cadeia inquebrável. Qualquer mudança em um elo exige análise de impacto em todos os elos downstream.

### INV-04: DebugBadge Universal
Todo componente de UI (tela, modal, card) deve exibir `DebugBadge` com `version + build + git commit hash`. Componentes embedded recebem `{!embedded && <DebugBadge component="NomeExato" />}`. **`component` prop é obrigatória** — sem ela o campo fica vazio.

### INV-05: Testes como Pré-Requisito
Toda alteração de business logic exige: análise de impacto documentada + testes incrementais de regressão + bug fixes reproduzidos em teste antes do fix.

### INV-06: Formato de Datas BR
Todas as datas usam formato brasileiro (DD/MM/YYYY). Parsing prioriza formato BR. Semana começa na segunda-feira.

### INV-07: Autorização Antes de Codificar
Antes de codificar qualquer feature ou mudança arquitetural — especialmente Firestore, campos de status, ou Cloud Functions — a proposta deve ser apresentada e aprovada explicitamente.

### INV-08: CHANGELOG Obrigatório
Toda versão (major, minor, patch) deve ter entrada no CHANGELOG (seção 10 deste documento) antes do merge.

### INV-09: Gate Obrigatório Pré-Código e Pré-Entrega

**Pré-código:**
1. Análise de impacto formal (collections, CFs, hooks, side-effects, dados parciais)
2. Proposta apresentada → AGUARDAR aprovação explícita
3. Codificar somente após aprovação

**Pré-entrega (antes de cada ZIP):**
4. `version.js` atualizado
5. CHANGELOG atualizado (seção 10 deste documento)
6. Testes criados para toda lógica nova
7. DebugBadge em todos os componentes novos/tocados com `component="NomeExato"`
8. ZIP com `Expand-Archive` + instruções git
9. PARAR e aguardar confirmação

**Claude deve listar explicitamente cada item com ✅/❌ antes de gerar o ZIP.**

### INV-10: Verificar Estrutura Firestore Antes de Criar/Modificar
Antes de criar qualquer collection, subcollection, campo ou estrutura nova: `grep` pelo nome do campo nos hooks, CF e componentes. Nunca criar estrutura nova sem aprovação explícita.

### INV-11: Nunca Priorizar Velocidade sobre Rigor
Se houver conflito entre entregar rápido e seguir as invariantes, as invariantes vencem. Sempre.

### INV-12: Parciais São Campo no Documento — NÃO Subcollection
`_partials` é um campo array dentro do documento `trades/{id}`. Não existe subcollection `trades/{id}/partials`. Todo trade tem parciais (mínimo 1 ENTRY + 1 EXIT).

---

## 4. PROTOCOLO DE SESSÃO

### 4.1 Gate Pré-Código (obrigatório, nesta ordem)

```
□ Leitura completa dos arquivos relevantes (grep + view + bash) — NUNCA inferir
□ Análise de impacto: collections, CFs, hooks, side-effects, dados parciais
□ Proposta apresentada ao Marcio → AGUARDAR aprovação explícita
□ Checklist de impacto (seção 5) executado mentalmente
```

### 4.2 Gate Pré-Entrega (obrigatório, antes de cada ZIP)

```
□ version.js atualizado com nova versão e build date
□ CHANGELOG (seção 10) com entrada da versão
□ Testes para toda lógica nova criados e passando
□ DebugBadge em todos os componentes novos/tocados com component="NomeExato"
□ ZIP com paths project-relative
□ Comando Expand-Archive fornecido
□ Instruções git fornecidas (commits em linha única)
□ PARAR — aguardar confirmação do Marcio
```

### 4.3 Protocolo de Encerramento de Sessão

Ao final de cada sessão, antes de encerrar:

1. **Atualizar `docs/dev/issues/issue-NNN-nome.md`** com:
   - Resumo do que foi feito
   - Decisões tomadas (formato DEC-xxx)
   - Arquivos tocados
   - Comandos git executados
   - Testes rodados
   - Pendências para próxima sessão

2. **Atualizar este PROJECT.md** com:
   - Novas entradas no Decision Log (seção 7)
   - Novas/resolvidas dívidas técnicas (seção 9)
   - Entrada no CHANGELOG (seção 10)

3. **Commit dos docs** junto com o código:
   ```powershell
   git add docs/PROJECT.md docs/dev/issues/issue-NNN-nome.md
   git commit -m "docs: atualizar PROJECT.md e issue-NNN sessão DD/MM/YYYY"
   ```

### 4.4 Diretriz Crítica de Verificação

**Regra absoluta: toda afirmação verificável exige verificação prévia. Sem exceção.**

Aplica-se a QUALQUER conclusão sobre o estado do projeto, incluindo mas não limitado a:

- Fluxo de dados, origem de campos, estrutura de collections
- Estado de branches, PRs, merges, deploys
- Existência ou ausência de arquivos, funções, componentes, campos
- Interpretação de outputs de terminal (git, npm, firebase, logs)
- Interpretação de screenshots, erros, stack traces
- Estado de features (implementado, pendente, quebrado)
- Compatibilidade entre componentes, hooks, CFs

**Protocolo obrigatório (nesta ordem):**

1. Classificar: "estou prestes a afirmar algo verificável?" → Se sim, PARAR
2. Identificar a fonte de verdade (código, remote, Firestore, output direto)
3. Verificar com `grep` + `view` + `bash`, ou solicitar ao Marcio o comando de verificação quando não houver acesso direto
4. Cruzar com contexto existente (issue files, instruções de integração, PROJECT.md)
5. Só então concluir

**Se o Marcio colar um output de terminal, screenshot, ou log:**
- Tratar como dado bruto, não como fato confirmado
- Cruzar com pelo menos uma fonte adicional antes de afirmar
- Se houver ambiguidade, dizer "preciso confirmar — pode rodar `<comando>`?" em vez de assumir

**Nunca inferir. Se não verificou, não afirma. Se está incerto, diz "preciso verificar" e verifica. Não existe output trivial — todo dado verificável passa pelo protocolo.**

---

## 5. CHECKLIST DE IMPACTO PARA NOVAS FEATURES

Antes de propor qualquer feature, executar mentalmente:

1. Quais collections são tocadas? (leitura E escrita)
2. Quais Cloud Functions disparam? (triggers onCreate/onUpdate)
3. Quais hooks/listeners são afetados? (re-renders, queries)
4. Há side-effects em PL, compliance, emotional scoring?
5. Dados parciais/inválidos podem entrar no caminho crítico?
6. A feature respeita todas as INV-01 a INV-12?
7. Qual o blast radius se algo der errado?
8. Existe rollback viável?
9. Quais testes existentes podem quebrar?
10. DebugBadge está presente em todos os componentes novos/tocados?

---

## 6. PROTOCOLO DE SESSÕES PARALELAS

### 6.1 Conceito

Cada frente de desenvolvimento opera em um branch isolado. Arquivos transversais (shared infrastructure) nunca são modificados diretamente — cada sessão produz um delta que o integrador (Marcio) aplica no merge.

### 6.2 Shared Infrastructure (nunca editar diretamente em sessão paralela)

| Arquivo | Tipo | Protocolo |
|---------|------|-----------|
| `src/version.js` | Versionamento | Propor bump no documento do issue |
| `docs/PROJECT.md` | Este documento | Propor adições no documento do issue |
| `src/App.jsx` | Rotas principais | Delta de rotas no documento do issue |
| `functions/index.js` | Entry point CFs | Delta de exports no documento do issue |
| `firestore.rules` | Regras de segurança | Delta de rules no documento do issue |
| `package.json` | Dependências | Novas deps no documento do issue |

### 6.3 Registry de Chunks

Chunks são conjuntos técnicos atômicos. Uma sessão faz check-out de chunks necessários; enquanto checked-out, nenhuma outra sessão toca esses arquivos.

| Chunk | Domínio | Arquivos principais | Status |
|-------|---------|-------------------|--------|
| CHUNK-01 | Auth & User Management | `AuthContext`, `useAuth` | AVAILABLE |
| CHUNK-02 | Student Management | `StudentDashboard`, `students` collection | AVAILABLE |
| CHUNK-03 | Plan Management | `PlanManagementModal`, `plans` collection | AVAILABLE |
| CHUNK-04 | Trade Ledger | `useTrades`, `trades` collection, `addTrade` | AVAILABLE |
| CHUNK-05 | Compliance Engine | `compliance.js`, `ComplianceConfigPage` | AVAILABLE |
| CHUNK-06 | Emotional System | `emotionalAnalysisV2`, `useEmotionalProfile` | AVAILABLE |
| CHUNK-07 | CSV Import | `CsvImport/*`, `csvStagingTrades` | AVAILABLE |
| CHUNK-08 | Mentor Feedback | `Feedback/*`, `feedbackHelpers` | AVAILABLE |
| CHUNK-09 | Student Onboarding | `Onboarding/*`, `assessment` subcollection | AVAILABLE |
| CHUNK-10 | Order Import | `OrderImport/*`, `orders` collection | AVAILABLE |
| CHUNK-11 | Behavioral Detection | `behavioralDetection` — FUTURO | BLOCKED |
| CHUNK-12 | Cycle Alerts | `cycleMonitoring` — FUTURO | BLOCKED |

**Locks ativos:** Nenhum no momento.

### 6.4 Checklist de Check-Out

```
□ Identificar chunks necessários
□ Verificar que todos estão AVAILABLE
□ Registrar lock nesta seção (chunk + branch + data)
□ Criar branch: git checkout -b feature/issue-NNN-descricao
□ Criar documento da sessão: docs/dev/issues/issue-NNN-descricao.md
```

### 6.5 Checklist de Check-In / Merge

```
□ Documento do issue atualizado com resumo da sessão
□ Deltas de shared files documentados no issue
□ ZIP com paths project-relative
□ Testes passando: npm test
□ PR aberto com referência ao issue
□ Merge e PR fechado
□ Issue fechado no GitHub
□ Lock liberado nesta seção
□ PROJECT.md atualizado (DEC, DT, CHANGELOG)
```

---

## 7. DECISION LOG

> Registro de decisões arquiteturais significativas. **Nunca remover entradas** — marcar como `SUPERSEDED` se inválida.
> Formato: `| ID | Decisão | Issue | Sessão | Data/Hora |`

| ID | Decisão resumida | Issue | Data |
|----|-----------------|-------|------|
| DEC-001 | CSV Import usa staging collection (csvStagingTrades) — não escreve direto em trades | #23 | 07/03/2026 |
| DEC-002 | Direção de trade inferida por buyTimestamp vs sellTimestamp (Tradovate) | #23 | 07/03/2026 |
| DEC-003 | Inferência genérica de direção no CSV — campo configurável no template | #23 | 08/03/2026 |
| DEC-004 | Locale pt-BR para todas as moedas via Intl.NumberFormat | — | 08/03/2026 |
| DEC-005 | Compliance sem stop: loss→risco retroativo, win→N/A, BE→0 | — | 10/03/2026 |
| DEC-006 | Compliance sem stop — fórmula definitiva (C1-C5) | — | 10/03/2026 |
| DEC-007 | RR assumido via plan.pl (capital base), não currentPl flutuante | — | 11/03/2026 |
| DEC-008 | Navegação contextual Feedback ↔ Extrato via flag `_fromLedgerPlanId` | — | 12/03/2026 |
| DEC-009 | riskPercent usa plan.pl como denominador primário | — | 14/03/2026 |
| DEC-010 | EV esperado e EV real — leakage = 1 - (EV_real / EV_esperado) | — | 15/03/2026 |
| DEC-011 | Layout MetricsCards em 3 painéis temáticos com tooltips diagnósticos | — | 15/03/2026 |
| DEC-012 | Payoff como indicador de saúde do edge (semáforo ≥1.5/1.0/<1.0) | — | 18/03/2026 |
| DEC-013 | Operacional 5D com emotion_control herdado do emocional | #92 | 20/03/2026 |
| DEC-014 | Cross-check inter-dimensional — 5 flags iniciais | #92 | 20/03/2026 |
| DEC-015 | Randomização de alternativas via persistência Firestore (não PRNG puro) | #92 | 20/03/2026 |
| DEC-016 | Sondagem adaptativa pós-questionário (3-5 perguntas IA, transparente) | #92 | 20/03/2026 |
| DEC-017 | Scoring mensal 3 camadas: score_trades + mentor_delta + score_final | #92 | 20/03/2026 |
| DEC-018 | Mentor aplica delta (não score absoluto) no review mensal | #92 | 20/03/2026 |
| DEC-019 | Gates de progressão hardcoded, avaliação híbrida (CF + mentor confirma) | #92 | 20/03/2026 |
| DEC-020 | Regressão de stage nunca automática — alerta + decisão do mentor | #92 | 20/03/2026 |
| DEC-021 | Stage diagnosticado por IA (pattern-matching contra framework, não fórmula) | #92 | 22/03/2026 |
| DEC-022 | Marco zero tábula rasa: gates_met=0 independente de respostas | #92 | 22/03/2026 |
| DEC-023 | Assessment acionado pelo mentor, não automático | #92 | 22/03/2026 |
| DEC-024 | Parciais são campo inline `_partials` no documento — subcollection eliminada | — | 22/03/2026 |
| DEC-025 | Firestore rules read = isAuthenticated() — simplificação de isMentor()/isOwner() | — | 23/03/2026 |
| DEC-026 | saveInitialAssessment escreve onboardingStatus: 'active' direto via updateDoc | #92 | 24/03/2026 |
| DEC-027 | Onboarding UX: BaselineReport redesenhado, IncongruenceFlags rich detail, prompt framework-aligned, rename Experiência→Maturidade | #92 | 25/03/2026 |
| DEC-028 | Consolidação documental: PROJECT.md como single source of truth, issue-NNN.md por issue ativo | — | 26/03/2026 |
| DEC-029 | Marca pessoal "Marcio Portes" como guarda-chuva — não institucional | #100 | 29/03/2026 |
| DEC-030 | "Modelo Portes" como nome público do framework comportamental (4D + TEF + maturidade) | #100 | 29/03/2026 |
| DEC-031 | "Espelho" como nome público da plataforma SaaS — codebase/repo/Firebase permanecem "acompanhamento-2.0" | #100 | 29/03/2026 |
| DEC-032 | "Mentoria Alpha" como nome do serviço premium individual (substitui "Tchio-Alpha" externamente) | #100 | 29/03/2026 |
| DEC-033 | "Diagnóstico Comportamental" como lead magnet #1 — assessment gratuito com IA baseado no Modelo Portes | #100 | 29/03/2026 |
| DEC-034 | Dois tiers: Espelho self-service (KPIs + diário + gates) e Mentoria Alpha (+ ciclos + assessment + SWOT + feedback) | #100 | 29/03/2026 |
| DEC-035 | SWOT dinâmico exclusivo Mentoria Alpha — analisa KPIs + diagnostica por gate/dimensão + prescreve evolução | #100 | 29/03/2026 |
| DEC-036 | KPIs alimentam nota de evolução por dimensão (gates) — visível para ambos tiers. SWOT interpreta e prescreve — exclusivo Alpha | #100 | 29/03/2026 |
| DEC-037 | Fibonaccing como motor de aquisição principal — 100h+ conteúdo gratuito, funil: Fibonacci → Diagnóstico → Espelho → Alpha | #100 | 29/03/2026 |
| DEC-038 | Rename externo via custom domain (app.marcioportes.com.br) + UI (title, logo) — sem refactoring de codebase | #100 | 29/03/2026 |
| DEC-039 | GitHub é SSOT para numeração de issues — PROJECT.md reflete o GitHub, nunca o contrário | — | 29/03/2026 |
| DEC-040 | Apenas 2 milestones: v1.1.0 Espelho Self-Service (prioridade) + v1.2.0 Mentor Cockpit. Student Experience absorvido pelo Espelho | — | 29/03/2026 |
| DEC-041 | #101 é épico Torre de Controle — agrupa todos os sub-issues do dashboard mentor. #1 (Upload Seed) fechado como não relevante | #101 | 29/03/2026 |
| DEC-042 | Torre de Controle: header redesenhado (4 KPIs operacionais), seções Ranking por Aluno + Ranking por Causa (dual view), SWOT e Stop por Motivo movidos para nova tela Performance (#103) | #101 | 29/03/2026 |

---

## 8. ANTI-PATTERNS DOCUMENTADOS

### AP-01: Shortcut Through Production
Escrever dados externos diretamente em collections de produção. Cloud Functions não distinguem origem — dados incompletos disparam o mesmo pipeline que dados válidos.

### AP-02: Patch Cascading
Quando um bypass causa bugs, adicionar guards em cada componente afetado em vez de corrigir a causa raiz. Cada patch é um ponto de falha adicional.

### AP-03: Optimistic Reuse
Assumir que uma collection/método pode ser reaproveitada sem análise de impacto. Collections têm contratos implícitos com CFs e listeners.

### AP-04: Invariant Drift
Claude recebe diretrizes explícitas e as ignora em nome de eficiência. Entrega código sem testes, sem version.js, sem CHANGELOG, sem aguardar aprovação.

### AP-05: Promessa Verbal Sem Execução
Claude reconhece a falha (AP-04), verbaliza compromisso de seguir invariantes, e viola as mesmas regras na mesma sessão. Mais grave que AP-04 — destrói confiança.

### AP-06: Criação de Estruturas Firestore Sem Aprovação
Claude assume como o banco funciona em vez de verificar. Nunca criar subcollections, campos ou estruturas novas sem grep no código existente + aprovação explícita.

### AP-07: Inferência Superficial
Claude afirma algo sobre fluxo de dados, origem de campos ou estado de implementação baseado em leitura parcial ou nomes de variáveis, sem rastrear o fluxo real. Regra: se não leu todos os arquivos relevantes, não afirma.

---

## 9. DÍVIDAS TÉCNICAS ATIVAS

| ID | Descrição | Prioridade | Deadline | Issue |
|----|-----------|-----------|----------|-------|
| DT-002 | Cycle transitions sem fechamento formal — PL de entrada do novo ciclo não registrado | ALTA | — | #72 |
| DT-007 | DebugBadge duplo no ComplianceConfigPage embedded | BAIXA | — | #55 |
| DT-008 | formatCurrency hardcoded R$ em MentorDashboard e labels | BAIXA | — | — |
| DT-011 | Templates CSV vazam entre alunos (sem filtro por studentId) | MÉDIA | — | — |
| DT-012 | Mentor não consegue editar feedback já enviado | MÉDIA | — | #91 |
| DT-015 | recalculateCompliance não usa writeBatch (não atômico) | BAIXA | — | — |
| DT-016 | **Cloud Functions Node.js 20 depreca 30/04/2026** | **CRÍTICA** | **30/04/2026** | — |
| DT-018 | FeedbackPage não reflete edições de trade em tempo real | BAIXA | — | — |
| DT-020 | Teclas seta alteram valores em campos de preço/qty no modal de parciais | MÉDIA | — | — |
| DT-022 | CF scheduled limpeza diária csvStagingTrades (23h) não implementada | MÉDIA | — | — |
| DT-025 | Campos `hasPartials`/`partialsCount` legados nos documentos de trades | BAIXA | — | — |
| DT-026 | ~~stageDiagnosis não gerado pelo Re-processar IA — só por handleProbingComplete~~ RESOLVIDO v1.21.4 | BAIXA | — | — |
| DT-027 | Rename externo: title, logo, textos UI de "Acompanhamento 2.0" para "Espelho" | ALTA | Antes da comunicação ao grupo | #100 |
| DT-028 | firebase-functions SDK 4.9.0 → migrar para ≥5.1.0 (companion de DT-016) | **CRÍTICA** | **30/04/2026** | — |

---

## 10. CHANGELOG

> Histórico de versões. Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
> Adicionar entradas no topo. Nunca editar entradas antigas.

### [docs] - 29/03/2026
**Sessão:** Branding, portal institucional, reestruturação de tiers
**Issue:** #100 (criação)
#### Adicionado
- `docs/dev/issues/issue-100-espelho-self-service.md` — épico modo self-service
- `docs/marcioportes_portal_v2_0.md` — documento de referência do portal institucional
- DEC-029 a DEC-038 no decision log (naming, tiers, Fibonaccing, rename, SWOT)
- Milestone v1.3.0 (Espelho Self-Service + Rename) no roadmap
- Milestone Portal marcioportes.com.br (Maio-Junho 2026) no roadmap
- DT-027 (Rename externo Espelho) e DT-028 (firebase-functions SDK) nas dívidas técnicas
#### Decisões-chave
- Marca pessoal "Marcio Portes", framework "Modelo Portes", plataforma "Espelho", mentoria "Mentoria Alpha"
- Dois tiers: self-service (KPIs + diário + gates) vs Alpha (+ ciclos + assessment + SWOT + feedback)
- SWOT dinâmico exclusivo Alpha — analisa KPIs, diagnostica por gate, prescreve evolução
- KPIs alimentam nota de evolução (gates) para ambos tiers
- Fibonaccing (100h+ conteúdo gratuito) como motor de aquisição principal
- Rename externo via custom domain + UI, sem refactoring de codebase

### [1.21.4] - 29/03/2026
**Issue:** #097 (complemento)
#### Adicionado
- Painel "Perguntas do Aprofundamento" colapsável no AIAssessmentReport (v1.3.0)
- `saveReportData` em useAssessment — persiste reportData no Firestore
- Rehydration de reportData (developmentPriorities, profileName, reportSummary) no refresh
- Etapa 3 no Re-processar IA — regenera relatório completo com developmentPriorities
#### Corrigido
- CF generateAssessmentReport: `probingData.summary.flagsResolved` (era `probingData.flagsResolved` → undefined)
- Prompt alterado para "mínimo 1, máximo 3" prioridades de desenvolvimento
#### Alterado
- Seção 4.4 do PROJECT.md reescrita: "Diretriz Crítica de Verificação" com protocolo expandido

### [1.21.3] - 28/03/2026
**Sessão:** issue-097 open responses AI report  
**Issue:** #097
#### Adicionado
- Seção "Respostas Abertas — Análise IA" no AIAssessmentReport (mentor only)
- 4 grupos colapsáveis por dimensão: texto do aluno + score IA + classificação + confiança + aiFinding + aiJustification
- Indicador "Aguardando processamento IA" para respostas não processadas
- `groupOpenResponsesByDimension` exportada para testes
- Testes unitários: `openResponsesFilter.test.js` (9 casos)

---

### [1.21.2] - 26/03/2026
**Sessão:** consolidação documental + fix labels UI  
**Issue:** #92 (pós-merge)
#### Corrigido
- Rename "Marco Zero" → "Perfil de Maturidade" em `BaselineReport` header e `Sidebar` label
- stageDiagnosis card movido para full-width (fora do grid 2×2)

---

### [1.21.1] - 25/03/2026
**Sessão:** CHUNK-09 fix guard rehydration
#### Corrigido
- Guard `if (assessmentScores) return` bloqueava rehydration de stageDiagnosis — removido
- stageDiagnosis rehydrata independentemente do estado de assessmentScores

---

### [1.21.0] - 25/03/2026
**Sessão:** CHUNK-09 fixes
#### Adicionado
- `useAssessment.saveStageDiagnosis` — persiste diagnóstico no doc `questionnaire`
- Rehydration de stageDiagnosis no useEffect ao reabrir a página
- TraderProfileCard Maturidade usa escala cromática por stage (não score numérico)

---

### [1.20.x] - 25/03/2026
**Sessão:** CHUNK-09 onboarding UX completo (v1.20.1 a v1.20.9)
#### Adicionado
- BaselineReport v2.0 — régua 4D, grid 2×2, plano do mentor
- MentorValidation v1.1 — prioridades editáveis pré-carregadas da IA
- IncongruenceFlags v2.0 — labels semânticos, master/detail, respostas reais
- Prompt classifyOpenResponse reescrito com Trader Evolution Framework completo
- Re-processar IA (questionário + probing)
- Dimensão "Experiência" renomeada para "Maturidade" em toda UI
- "Perfil de Maturidade" no sidebar do aluno (hasBaseline=true)
- stageDiagnosis persistido e rehydratado
#### Corrigido
- Fix saveInitialAssessment stale closure (DEC-026)
- Fix loop infinito AssessmentGuard

---

### [1.20.0] - 22/03/2026
**Issue:** #87 (CHUNK-10 mergeado)
#### Adicionado
- Order Import Pipeline — parse ProfitChart-Pro CSV, reconstrução de operações net-position-zero, staging review, cross-check comportamental, KPI validation

---

### [1.19.7] - Mar/2026
#### Adicionado
- Badge notificação REVIEWED no Sidebar do aluno

---

### [1.19.x] - Mar/2026
#### Adicionado
- v1.19.6: Payoff semáforo edge health, semáforo RO bidirecional, PL tricolor
- v1.19.5: Layout 3 painéis agrupados, tooltips diagnósticos, NaN guards
- v1.19.4: riskPercent usa plan.pl (DEC-009)
- v1.19.3: RR 2 decimais, resultInPoints override, status feedback no extrato
- v1.19.2: RR assumido via plan.pl (DEC-007), Guard C4 removido
- v1.19.1: Compliance sem stop (DEC-006), CSV tickerRule, PlanAuditModal
- v1.19.0: RR assumido, PlanLedgerExtract RO/RR + feedback nav

---

### [1.18.x] - Mar/2026
- v1.18.2: Fix locale pt-BR todas as moedas
- v1.18.1: Inferência direção CSV, parseNumericValue, Step 2 redesign
- v1.18.0: CSV Import v2 — staging collection, csvParser, csvMapper, csvValidator

---

### [1.17.0 e anteriores] - Jan-Mar/2026
- v1.17.0: Cycle navigation, gauge charts, period selectors
- v1.16.0: State machine plano, PlanLedgerExtract
- v1.15.0: Multi-currency, StudentDashboard partition
- v1.0-1.14: Scaffolding, 42 issues, arquitetura base, emotional system v2.0

---

## 11. MAPA DE DEPENDÊNCIAS

### Collections Firestore e consumidores

```
trades (collection principal)
├── Escritor: addTrade — GATEWAY ÚNICO (INV-02)
├── CFs: onTradeCreated, onTradeUpdated
├── Campo _partials: array INLINE no documento (INV-12) — NÃO subcollection
└── Consumers: StudentDashboard, TradingCalendar, AccountStatement, FeedbackPage,
               PlanLedgerExtract, MentorDashboard

plans → cycles, currentCycle, state machine (IN_PROGRESS→GOAL_HIT/STOP_HIT→POST_GOAL/POST_STOP)
accounts → currency, balance, broker
emotions → scoring -4..+3 normalizado 0-100, TILT/REVENGE detection
csvStagingTrades → staging CSV, nunca dispara CFs diretamente
orders → staging de ordens brutas (CHUNK-10)
students/{id}/assessment/ → questionnaire, probing, initial_assessment (CHUNK-09)
```

### Cloud Functions

| Function | Trigger | Responsabilidade |
|----------|---------|-----------------|
| `onTradeCreated` | trades create | Atualiza PL do plano, compliance stats |
| `onTradeUpdated` | trades update | Recalcula PL, compliance |
| `classifyOpenResponse` | callable | Classifica respostas abertas via API Claude |
| `generateProbingQuestions` | callable | Gera 3-5 perguntas de sondagem adaptativa |
| `analyzeProbingResponse` | callable | Analisa respostas do probing |
| `generateAssessmentReport` | callable | Gera relatório completo pré-mentor |

---

## 12. CONVENÇÕES DE DESENVOLVIMENTO

### Branches e commits
```
feature/issue-NNN-descricao   ← nova feature ou refactor
fix/issue-NNN-descricao       ← bug fix
debt/issue-NNN-descricao      ← dívida técnica
arch/issue-NNN-descricao      ← mudança arquitetural
```

Commit messages em linha única (PowerShell):
```
feat: descrição da feature (issue #NNN)
fix: descrição do fix (issue #NNN)
debt: descrição da dívida resolvida (issue #NNN)
docs: atualizar PROJECT.md sessão DD/MM/YYYY
```

### Classificação de issues (prefixo no título)
```
feat:   nova funcionalidade
fix:    correção de bug
debt:   dívida técnica / tech debt
arch:   decisão arquitetural / refactor estrutural
ops:    infra, deploy, Cloud Functions, Node.js
epic:   agrupa outros issues (não implementável diretamente)
```

### Testes
- Framework: Vitest + jsdom
- Localização: `src/__tests__/utils/` para novos utils
- Padrão: bug fix → reproduzir bug em teste → corrigir → teste passa
- Nunca regressão — testes existentes devem continuar passando

### UI
- Theme: Glassmorphism dark
- DebugBadge: obrigatório em tudo, com `component="NomeExato"`
- Datas: DD/MM/YYYY sempre
- Semana: começa na segunda-feira

---

*Documento criado em 26/03/2026 a partir da consolidação de: ARCHITECTURE.md, AVOID-SESSION-FAILURES.md, VERSIONING.md, CHANGELOG.md (parcial), CHUNK-REGISTRY.md*  
*Próxima revisão obrigatória: ao final de cada sessão de desenvolvimento*
