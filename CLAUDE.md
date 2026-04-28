# CLAUDE.md — Espelho (Acompanhamento 2.0)

> Arquivo-índice carregado em toda sessão. Detalhes técnicos ficam em arquivos temáticos — carregue sob demanda.
> **SSoT de conteúdo:** `docs/PROJECT.md` + arquivos em `docs/*.md`, `docs/protocols/`, `docs/registry/`, `docs/templates/`.

## Projeto

**Espelho** — plataforma SaaS de mentoria comportamental para traders.
Codebase/repo/Firebase: `acompanhamento-2.0` (nome de código ≠ nome público, DEC-031).
Stack: React 18 + Vite, Firebase/Firestore, Cloud Functions, Tailwind CSS, Vercel. Testes Vitest + jsdom. Theme: Glassmorphism dark.
Versão atual: ler `src/version.js`.

---

## Invariantes (INV-01..28)

Detalhes: [`docs/invariants.md`](docs/invariants.md).

- **INV-01** — Airlock de dados externos (CSV/API nunca escreve direto em `trades`/`plans`/`accounts`)
- **INV-02** — Gateway único `addTrade` para collection `trades`
- **INV-03** — Integridade do pipeline de side-effects (trades → CFs → downstream)
- **INV-04** — DebugBadge universal (prop `component` obrigatória)
- **INV-05** — Testes como pré-requisito para business logic
- **INV-06** — Datas formato BR (DD/MM/YYYY); semana começa segunda
- **INV-07** — Autorização antes de codificar
- **INV-08** — CHANGELOG obrigatório por versão
- **INV-09** — Gate pré-código + gate pré-entrega
- **INV-10** — Verificar estrutura Firestore antes de criar/modificar
- **INV-11** — Nunca priorizar velocidade sobre rigor
- **INV-12** — Parciais são campo `_partials` inline no doc, NÃO subcollection
- **INV-13** — Rastreabilidade obrigatória por issue (issue + control file + branch)
- **INV-14** — Versionamento do PROJECT.md (semver + histórico)
- **INV-15** — Aprovação obrigatória para persistência (nova collection/subcollection/campo)
- **INV-16** — Isolamento via worktree `~/projects/issue-{NNN}` — OBRIGATÓRIO sempre
- **INV-17** — Gate de arquitetura de informação (nível/domínio/duplicação/budget)
- **INV-18** — Spec Review Gate (validar entendimento antes de codar)
- **INV-25** — Outbox antes de resume (padrão coord/worker)
- **INV-26** — `.coord-id`/`.coord-dir` READ-ONLY (start script grava; Coord nunca sobrescreve)
- **INV-27** — Validação externa de claims (cegueira epistêmica; `cc-validate-task.py` com 3 checks)
- **INV-28** — Email iCloud é canal primário de gate humano no modo autônomo

## Anti-Patterns (AP-01..08)

Detalhes: [`docs/anti-patterns.md`](docs/anti-patterns.md).

- **AP-01** Shortcut Through Production — escrever dados externos direto em prod
- **AP-02** Patch Cascading — guards em cascata em vez de fix de causa raiz
- **AP-03** Optimistic Reuse — reaproveitar collection sem impact analysis
- **AP-04** Invariant Drift — ignorar diretrizes em nome de eficiência
- **AP-05** Promessa Verbal Sem Execução — verbalizar compromisso e violar na mesma sessão
- **AP-06** Criação de Estruturas Firestore Sem Aprovação
- **AP-07** Inferência Superficial — afirmar sem rastrear fluxo real
- **AP-08** Build Verde, App Quebrada — testes passam mas app crasha em runtime

## Chunks (CHUNK-01..17)

Detalhes: [`docs/chunks.md`](docs/chunks.md). Locks ativos: [`docs/registry/chunks.md`](docs/registry/chunks.md).

Modo leitura: sem lock. Modo escrita: lock exclusivo.

CHUNK-01 Auth · CHUNK-02 Student · CHUNK-03 Plans · CHUNK-04 Trade Ledger · CHUNK-05 Compliance · CHUNK-06 Emotional · CHUNK-07 CSV Import · CHUNK-08 Mentor Feedback · CHUNK-09 Student Onboarding · CHUNK-10 Order Import · CHUNK-11 Behavioral Detection (FUTURO) · CHUNK-12 Cycle Alerts (FUTURO) · CHUNK-13 Context Bar · CHUNK-14 Onboarding Auto · CHUNK-15 Swing Trade · CHUNK-16 Mentor Cockpit · CHUNK-17 Prop Firm Engine

## Protocolos

| Fase | Arquivo |
|------|---------|
| §4.0 Abertura + §4.1 Gate Pré-Código + §4.2 Gate Pré-Entrega | [`docs/protocols/opening.md`](docs/protocols/opening.md) |
| §4.3 Encerramento + §4.4 Verificação Crítica | [`docs/protocols/closing.md`](docs/protocols/closing.md) |
| §13 Modo Autônomo (coord/worker) | [`docs/protocols/autonomous.md`](docs/protocols/autonomous.md) |
| Sessões Paralelas (chunks, shared files) | [`docs/protocols/parallel.md`](docs/protocols/parallel.md) |

## Cloud Functions & Firestore

- [`docs/cloud-functions.md`](docs/cloud-functions.md) — triggers + callables + schedule
- [`docs/firestore-schema.md`](docs/firestore-schema.md) — collections + subcollections + rules

## Decisões, Dívidas, Milestones

- [`docs/decisions.md`](docs/decisions.md) — DEC-001..090+
- [`docs/tech-debt.md`](docs/tech-debt.md) — DT ativas
- [`docs/milestones.md`](docs/milestones.md) — roadmap v1.x
- [`CHANGELOG.md`](CHANGELOG.md) — histórico de versões do produto (raiz)

---

## Modo Autônomo vs Interativo

**Default:** interativo (pair programming assíncrono).
**Trigger autônomo (opt-in):** Marcio diz literalmente **"atacar #NNN em modo autônomo"** (ou variante explícita "em modo autônomo"). Qualquer outro fraseamento → interativo.

**Regra de uma via — sem pushback após o trigger:** Se o trigger autônomo foi dito, a IA executa §13.8 Fase 1 imediatamente. NÃO pergunta "tem certeza", NÃO sugere interativo como alternativa, NÃO condiciona a uma "pré-avaliação" do issue, NÃO lista riscos pra induzir reconsideração. Único impedimento aceitável é técnico (script faltando, env quebrado, repo em estado incompatível); neste caso reporta o impedimento concreto e PARA — não converte para interativo. Os critérios "quando usar autônomo/interativo" em §13.2 são guia para Marcio antes do trigger, não checklist da IA depois dele.

Spec completa: [`docs/protocols/autonomous.md`](docs/protocols/autonomous.md).

INV-27 + CLAIMS + validator aplicam-se aos DOIS modos quando há delegação sem supervisão ativa.

---

## Regra de ativação automática

**Roteamento por trigger:**
- Marcio diz **"atacar #NNN em modo autônomo"** (ou variante explícita) → executa imediatamente [`docs/protocols/autonomous.md`](docs/protocols/autonomous.md) §13.8 Fase 1 (que reusa os passos 1-9 abaixo nos seus próprios passos 3-6).
- Qualquer outra menção a issue / feature / fix / debt / arquitetura → iniciar imediatamente o protocolo §4.0 abaixo.

A regra de uma via (CLAUDE.md "Modo Autônomo vs Interativo") vale para os dois caminhos: trigger presente → autônomo, sem perguntar; trigger ausente → interativo, sem perguntar. A IA não tenta "validar" o trigger ou sugerir o caminho contrário.

---

Ao mencionar issue / feature / fix / debt / arquitetura, iniciar imediatamente o protocolo §4.0:

1. `head -5 docs/PROJECT.md` — comparar versão com contexto (INV-14)
2. `gh issue view NNN`
3. Ler campo "Chunks necessários" no body do issue (se ausente, preencher antes de prosseguir)
4. Consultar [`docs/registry/chunks.md`](docs/registry/chunks.md) — chunks em ESCRITA devem estar AVAILABLE
5. **NO MAIN:** registrar lock + reservar próxima versão em `src/version.js` + entrada em [`docs/registry/versions.md`](docs/registry/versions.md)
6. **NO MAIN:** commit único `docs: registrar lock CHUNK-XX para issue-NNN`
7. Criar worktree: `git worktree add ~/projects/issue-{NNN} -b tipo/issue-NNN-descricao` (INV-16 — NUNCA pular)
8. Criar/verificar `docs/dev/issues/issue-NNN-*.md` usando template [`docs/templates/issue-control.md`](docs/templates/issue-control.md)
9. Executar Gate Pré-Código antes de tocar qualquer arquivo

**Regra inviolável:** shared files (PROJECT.md, CLAUDE.md, CHANGELOG.md, registry/*) editam no MAIN antes do worktree. Dentro do worktree, só deltas propostos no issue doc.

---

## Regras de economia de tokens (R1–R5)

**R1 — Limites de tamanho (hard cap):**
- `CLAUDE.md` ≤ 200 linhas
- `docs/*.md` read-cold ≤ 600 linhas
- `docs/dev/issues/issue-NNN-*.md` ≤ 400 linhas (excedente → anexo separado)
- Worker report (`.cc-mailbox/outbox/*-report.md`) ≤ 2,5KB

**R2 — Formato estrito de worker report** (formaliza em `docs/protocols/autonomous.md` §13.9):
```
TASK: NN-nome
STATUS: ok | fail
CLAIMS:
  commit: <sha>
  tests: <n passed / n failed>
  files: [lista]
DECISIONS: [DEC-AUTO-NNN-NN, ...]   # só IDs; texto em decisions.md
INVARIANTS_CHECKED: [INV-04, ...]
SHARED_FILES_UNTOUCHED: [...]
ISSUES: <blocker ou null>
HANDOFF: <1-2 linhas>
```
Sem narrativa, sem recontar diff. Campo ausente → omite.

**R3 — Decisões autônomas em arquivo próprio:** cada DEC-AUTO-NNN-NN vira 1 linha em `docs/decisions.md`. Rationale longo (>200 tokens): arquivo próprio em `docs/decisions/DEC-AUTO-NNN-NN.md` linkado. Arquivo de controle da issue só cita IDs.

**R4 — Template enxuto de issue control** ([`docs/templates/issue-control.md`](docs/templates/issue-control.md)): Context / Spec (link) / Phases / Sessions (1 linha/task) / Shared Deltas / Decisions (IDs) / Chunks. Proibido: CHANGELOG draft, rationale duplicado, narrativa de sessão.

**R5 — Separação read-hot / write-hot:** durante loop autônomo, workers NUNCA editam read-hot (invariants, anti-patterns, protocols, chunks). Write-hot (CHANGELOG, registry/*, decisions, tech-debt, milestones) edita só na Abertura/Encerramento — fora do loop. Preserva prompt cache.

---

## Permissões operacionais

Autorização permanente de leitura (sem confirmação): `grep`, `cat`, `ls`, `find`, `view`, `gh issue view`, `git log/status/diff`, `npm test`, `npm run build`, `head`, `tail`, `wc`, `du`, `df`, `ps`, `free`.

Parar para confirmar APENAS em operações destrutivas ou que afetem estado compartilhado: `commit`, `push`, `deploy`, `delete`, `rm -rf`, `git reset`, `firebase deploy`.

---

## Referências rápidas

- Assessment / framework: `docs/dev/trader_evolution_framework.md`
- Templates: `docs/templates/`
- Decision log: `docs/decisions.md`
- Convenções git/código/testes: `docs/PROJECT.md` §12 (inline)
