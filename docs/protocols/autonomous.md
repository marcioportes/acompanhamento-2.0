# Protocolo — Modo Autônomo §13 (CC-Interface + Coord + Worker)

> Modo opt-in: Marcio diz "atacar #NNN em modo autônomo". Default é modo interativo (pair programming).



> Seção formalizada em 21/04/2026 (v0.25.0) após sessão de design de 5+ horas consolidando bugs 1-10, validando arquitetura 3-tier, INVs 26 amendment / 27 / 28, e arquitetura de notificação por email.
> 
> Esta seção é a SPEC TEXTUAL do modo autônomo. A implementação dos scripts python (`cc-notify-email.py`, `cc-validate-task.py`) e o refactor de `cc-worktree-start.sh` exigem issue formal própria (INV-07/09). O protocolo pode ser executado em modo degradado (email manual) enquanto os scripts não existem — o gate humano continua funcionando via RC em CC-Interface.

### 13.1 Objetivo

Executar issues do projeto em modo autônomo: Marcio dispara "atacar #NNN em modo autônomo", três sessões Claude se coordenam (Interface / Coord / Worker), PR fica pronto para review manual. Gates humanos por email. Zero polling, custo 0 quando idle.

### 13.2 Modo Autônomo vs Modo Interativo

**O modo autônomo é opt-in explícito.** O modo **padrão do projeto continua sendo o modo interativo** (§4.0 — pair programming assíncrono com coder, bundle formal INV-19 descartado em v0.22.2).

**Triggers:**
- Marcio diz "atacar #NNN em modo autônomo" (ou variante "em modo autônomo") → Fase 1 desta seção, **execução imediata**
- Qualquer outro fraseamento → modo interativo (§4.0)
- Trigger ausente → interativo. Trigger presente → autônomo. Não há terceira via "na dúvida".

**Regra de uma via — sem pushback após o trigger.** Quando o trigger explícito foi dito, a IA NÃO pode:
- (a) Sugerir interativo como alternativa
- (b) Perguntar "tem certeza", "confirma?", "prefere mesmo?"
- (c) Condicionar a uma "pré-avaliação" do issue (escopo, ambiguidade, complexidade)
- (d) Listar riscos do autônomo pra induzir reconsideração
- (e) Consultar os critérios abaixo para "validar" se autônomo é apropriado — esses critérios são guia para **Marcio** antes do trigger, não checklist da **IA** depois dele

Único impedimento aceitável para não executar Fase 1: **impossibilidade técnica concreta** (script `cc-spawn-coord.sh`/`cc-dispatch-task.sh` ausente, `~/cc-mailbox/.env` sem `EMAIL_PASSWORD`, repo em estado de merge conflict, lock CHUNK indisponível). Neste caso a IA reporta o impedimento específico e **para — não converte para interativo**. Marcio decide se desbloqueia ou cancela.

---

**Guia de uso (para Marcio antes do trigger — não consultar pela IA após):**

**Quando usar AUTÔNOMO:**
- Issue bem desambiguado (spec claro, decisões estruturais já fechadas)
- Trabalho paralelizável em tasks de 1-5 commits cada (~30-90min por task)
- Marcio quer se ausentar (noite, outro compromisso)
- Escopo mecânico (refactor, add tests, migração, bulk rename, atualização em massa)

**Quando usar INTERATIVO (§4.0):**
- Design em discovery (ambiguidade estrutural ainda não resolvida)
- Debugging com hipótese incerta
- Feature pequena (1 commit, <30min)
- Marcio disponível para pair em tempo real

**Heurística para Marcio:** se a conversa precisa de deliberação livre entre Marcio e CC, é interativo. Se pode ser reduzida a "tasks pré-especificadas + gates humanos pontuais", é autônomo. Após decidir e digitar o trigger, a IA executa — não re-deriva a decisão.

### 13.3 O Que É Universal (Aplica aos Dois Modos)

INV-27 + bloco CLAIMS + `cc-validate-task.py` **não são exclusivos do modo autônomo**. Aplicam-se sempre que CC executa tasks sem supervisão humana ativa — inclui delegações durante modo interativo ("vai implementando isso enquanto eu faço outra coisa"). No interativo, o CC roda `cc-validate-task.py` contra o próprio commit antes de relatar "pronto"; se fail → para e sinaliza.

Seção `§3.2 Decisões Autônomas` no control file do issue também é universal: registra qualquer decisão tomada pelo CC sem consulta explícita ao Marcio, independentemente do modo.

**Esses controles compartilhados NÃO diluem a diferença entre os modos.** Validator + CLAIMS + DEC-AUTO existem nos dois lados como rede de segurança contra alucinação, mas o autônomo entrega coisas que o interativo não entrega: paralelismo coord/worker, gate humano por email, ausência sustentável do Marcio, custo zero quando idle. Não usar "o interativo já roda validator" como argumento para preferir interativo após o trigger autônomo (§13.2 regra de uma via).

### 13.4 Atores

| Ator | Papel | Lifetime | Modo | TTY/RC |
|------|-------|----------|------|--------|
| **Marcio** | humano | persistente | — | celular/desktop |
| **CC-Interface** | endpoint humano; setup; desambiguação; relay de respostas | persistente em tmux durante toda a issue | interativo | ✅ TTY via tmux, RC-atachada |
| **CC-Coord** | orquestrador; despacha workers; valida entregas; decide ambiguidades autônomas; notifica humano | **efêmero — 1 ciclo por wake-up via `--resume`** | `-p` headless | ❌ |
| **CC-Worker** | executor stateless; uma task por vida | **efêmero — 1 task** | `-p` headless | ❌ |

**Invariante de vida:** Coord e Worker SEMPRE morrem após emitir seu artefato. Wake-up sempre via `claude --resume <session-id>`.

### 13.5 Canais de Comunicação

| Origem → Destino | Canal | Mecanismo |
|------------------|-------|-----------|
| Marcio ↔ CC-Interface | tmux + RC | padrão Claude Code |
| CC-Interface → CC-Coord | `coord-inbox/human-response-<N>.md` + `claude --resume <coord-id> --permission-mode auto -p "HUMAN_GATE_RESOLVED ref=<path>"` | flock 30s no `coord.lock` |
| CC-Coord → CC-Worker | `inbox/<N>.md` + listener tmux detecta arquivo novo | listener `cc-NNN` |
| CC-Worker → CC-Coord | `outbox/<N>-result.log` + `<N>-report.md` (com CLAIMS) + `claude --resume <coord-id> -p "TASK_DELIVERED N=<N>"` | flock 30s |
| CC-Coord → Marcio (gate) | email iCloud SMTP via `cc-notify-email.py` | canal primário (INV-28) |
| CC-Coord → Marcio (urgente opcional) | WhatsApp Evolution API | só se Docker up; skip silent caso contrário |

### 13.6 Ownership de Diretórios `.cc-mailbox/`

- `inbox/` — CC-Coord escreve, listener lê
- `outbox/` — CC-Worker escreve; CC-Coord lê via TASK_DELIVERED; CC-Interface lê em STOPs
- `coord-inbox/` — CC-Interface escreve; CC-Coord lê via HUMAN_GATE_RESOLVED
- `locks/coord.lock` — flock advisório, qualquer ator antes de `--resume`
- `notify-scratch/` — CC-Coord escreve scratch JSONs antes de invocar `cc-notify-email.py`
- `log/` — auditoria de emails enviados (rate limit + histórico)
- `.coord-id` — gravado pelo start script, READ-ONLY para todos (INV-26)

### 13.7 Topologia de Armazenamento

```
~/cc-mailbox/                        # GLOBAL — reutilizado por todas as issues
├── bin/
│   ├── cc-notify-email.py           # helper único de email
│   ├── cc-validate-task.py          # validator INV-27
│   ├── cc-notify-whatsapp.sh        # opcional, check Docker interno
│   └── cc-worktree-start.sh         # refactor para suportar Interface/Coord/Worker
├── log/emails.log                   # auditoria global (rate limit + histórico)
└── .env                             # EMAIL_PASSWORD iCloud

~/projects/issue-NNN/.cc-mailbox/    # POR-ISSUE — dentro do worktree
├── inbox/<N>.md                     # CC-Coord escreve, listener lê
├── outbox/<N>-result.log            # CC-Worker escreve (log curto, token-eficiente)
├── outbox/<N>-report.md             # CC-Worker escreve (report + bloco CLAIMS)
├── coord-inbox/human-response-<N>.md # CC-Interface escreve, CC-Coord lê
├── locks/coord.lock                 # flock advisório antes de qualquer --resume
├── notify-scratch/<uuid>.json       # CC-Coord escreve antes de invocar email
├── log/emails-<data>.log            # auditoria per-issue
├── .coord-id                        # session_id do CC-Coord, READ-ONLY (INV-26)
└── .coord-dir                       # worktree path absoluto, gravado pelo cc-worktree-start.sh,
                                     # READ-ONLY depois. Consumido pelo listener antes de `claude --resume`.
                                     # Mesma disciplina READ-ONLY da INV-26 (amendment v0.26.0).
                                     # Divergência main vs worktree → --resume falha silenciosa
                                     # (JSONL em project-scope errado). Bug observado na rodada #164,
                                     # MITIGADO desde #176 v0.35.0: cc-spawn-coord.sh + cc-worktree-start.sh
                                     # impõem cwd correto. Não justifica preferir interativo (§13.2).
```

### 13.8 Fluxo das 6 Fases

#### Fase 1 — Setup (NO MAIN, auto mode ON, RC OFF)

| # | Ator | Ação |
|---|------|------|
| 1 | Marcio → CC-Interface | "Atacar issue #NNN em modo autônomo" |
| 2 | CC-Interface | **Inicia execução §13.8 Fase 1 imediatamente** (sem perguntar "tem certeza" — §13.2 regra de uma via). Ativa INV-27, avisa que RC só ativa depois (informativo, não-bloqueante) |
| 3 | CC-Interface | §4.0 NO MAIN: verifica versão PROJECT.md (INV-14), `gh issue view NNN`, valida chunks §6.3 |
| 4 | CC-Interface | NO MAIN: registra locks + reserva próximo minor em `version.js` |
| 5 | CC-Interface | Commit no main: `docs: registrar locks + reservar vX.Y.Z para issue-NNN` |
| 6 | CC-Interface | `git worktree add ~/projects/issue-NNN -b tipo/issue-NNN-descricao` |
| 7 | CC-Interface | `cd worktree`, cria `docs/dev/issues/issue-NNN-*.md`, preenche §1-3, §6 |
| 8a | CC-Interface | Cria `.cc-mailbox/{inbox,outbox,coord-inbox,locks,notify-scratch,log}/` |
| 8b | CC-Interface | **Pré-condição dura: cwd = `~/projects/issue-NNN`** (herdado do passo 7). Executar do main repo invalida o session_id — JSONL fica em project-scope `-acompanhamento-2-0`, listener do worktree invocando `--resume` falha silenciosa por project-scope mismatch. Comando recomendado: `cc-spawn-coord.sh NNN <worktree> <control_file>` (#176 v0.35.0) — wrapper que impõe cwd, renderiza template, captura `COORD_SESSION_ID`. Equivalente manual: `claude --permission-mode auto --output-format json -p "<contexto>; confirme ready e morra"` → captura `coord_session_id` do JSON. Bug observado na rodada #164 está MITIGADO desde v0.35.0 — não é justificativa pra preferir interativo (§13.2 regra de uma via). |
| 8c | CC-Interface | `cc-worktree-start.sh NNN <path> <coord_session_id>` → cria tmux + grava `.coord-id` (INV-26) |
| 8d | CC-Interface | `flock -w 30 locks/coord.lock claude --resume <coord-id> --permission-mode auto -p "DISPATCH_FIRST_TASK"` → coord despacha `inbox/01.md`, morre |

#### Fase 2 — Desambiguação (gate humano único, pesado, upfront)

| # | Ator | Ação |
|---|------|------|
| 9 | CC-Interface | Varredura ativa de ambiguidades no spec |
| 10 | CC-Interface | Aplica INV-18 em bloco: cada ambiguidade = pergunta concreta com opções |
| 11 | Marcio | Responde bloco completo |
| 12 | CC-Interface | Registra em `§3.1 Decisões Antecipadas` do control file |
| 13 | CC-Interface | Re-varre spec; se restar ambiguidade → volta ao 10. **Cap operacional: máximo 3 rodadas.** Após a 3ª rodada, ambiguidades remanescentes viram DEC-AUTO no §3.2 (Coord resolve no loop autônomo via ordem de prioridade spec → PROJECT.md → padrão → menor blast radius — passo 30) — não justificam adiar Fase 3. Inflar ambiguidades pra estender Fase 2 indefinidamente é violação de §13.2 regra de uma via |
| 14 | CC-Interface | Decompõe issue em tasks usando spec desambiguada (regra: 1-5 commits, ~30-90min; micro-tasks merge na próxima — heurística, não regra dura) |
| 15-16 | CC-Interface ↔ Marcio | Plano de fases apresentado e aprovado |

#### Fase 3 — Transição

| # | Ator | Ação |
|---|------|------|
| 19 | Marcio | Ativa Remote Mode (auto mode da CC-Interface cai aqui — ok, ela já escreveu tudo) |
| 20 | CC-Interface | Idle no prompt, sem polling, token cost = 0 |

#### Fase 4 — Loop Autônomo (sem humano)

| # | Ator | Ação |
|---|------|------|
| 22 | Listener `cc-NNN` | Detecta `inbox/<N>.md` → `claude -p` headless no worktree |
| 23-25 | CC-Worker | Lê task, edita, testa, commita, grava `outbox/<N>-result.log` + `<N>-report.md` (com bloco CLAIMS — INV-27), **morre** |
| 26 | Listener | `flock -w 30 locks/coord.lock claude --resume <coord-id> --permission-mode auto -p "TASK_DELIVERED N=<N>"` |
| 27 | CC-Coord | Lê `result.log` ANTES do `report.md` (token budget — result.log é ~1KB, report.md ~20-50KB) |
| 28 | CC-Coord | Relê control file (§3.1, §3.2, plano) |
| 29 | CC-Coord | **Roda `cc-validate-task.py`** (INV-27) contra CLAIMS do worker |
| 30 | CC-Coord | Se ambiguidade nova → resolve pela ordem: spec → PROJECT.md → padrão → menor blast radius. Registra em `§3.2 Decisões Autônomas` (DEC-AUTO-NN) |
| 31 | CC-Coord | Decide: OK → `inbox/<N+1>.md` + **morre**. STOP de qualquer tipo → grava STOP-XXX no outbox + invoca `cc-notify-email.py` + **morre**. **Sempre morre.** |

#### Fase 5 — Gate Humano Excepcional (durante loop)

| # | Ator | Ação |
|---|------|------|
| 32 | Marcio | Recebe email no celular |
| 33 | Marcio | Abre Claude Code mobile, RC em CC-Interface |
| 34 | CC-Interface | Lê outbox proativamente quando Marcio digita algo, mostra STOPs |
| 35 | Marcio | Responde em **linguagem natural** ("vai com a A", "explica esse erro", "aborta") |
| 36 | CC-Interface | Interpreta intent. Registra resposta em `§4 Sessões` do control file. Escreve `coord-inbox/human-response-<N>.md` |
| 37 | CC-Interface | `flock -w 30 locks/coord.lock claude --resume <coord-id> --permission-mode auto -p "HUMAN_GATE_RESOLVED ref=<path>"` |
| 38 | CC-Coord | Acorda, lê resposta humana, ajusta plano, despacha próxima task ou aplica correção, **morre** |

#### Fase 6 — Fechamento

| # | Ator | Ação |
|---|------|------|
| 39 | CC-Coord | Última task validada → consolida `§3.2` + relatório de execução → email "FINISHED" |
| 40-42 | Marcio + CC-Interface | Revisa decisões §3.2; contestadas → revert/rebase + task corretiva (rollback **por task**, não por decisão — INV-13 + princípio de unidade indivisível) |
| 43 | CC-Interface | Atualiza control file §5; propõe deltas de PROJECT.md (CHANGELOG, DEC, DT) e `version.js` no control file |
| 44 | CC-Interface | Email "pronto para PR" |
| 45 | Marcio | Aprova → CC-Interface cria PR (com `Closes #NNN`) → Marcio merga manualmente |
| 45a | CC-Interface | **Se `§3.2` do control file tem qualquer `DEC-AUTO-NNN-XX`** → cria `.deccs-NNN.md` no main com 1 linha por DEC no formato `- **DEC-AUTO-NNN-XX** (DD/MM/YYYY): <texto>.` antes de rodar `cc-close-issue.sh`. Sem isso o script aborta no passo 3f (anti-DEC-órfã, issue #225) |
| 46 | CC-Interface | §4.3: aplica deltas no main, fecha issue, deleta branch, libera locks §6.3, `git worktree remove`, `rm -rf`, mata tmux |

### 13.9 CLAIMS + Validator (INV-27 operacional)

**Exigência de CLAIMS no briefing do worker (v0.26.0):** todo prompt gravado em `inbox/<N>.md` DEVE conter, próximo à seção de relatório, a cláusula:

> Você DEVE entregar, no `report.md`, bloco `## CLAIMS (machine-readable, do not edit)` em JSON com `commit_hash`, `tests{passed,failed,cmd}`, `files_touched`. Ausência → coord marca STOP-HALLUCINATION automaticamente.

Sem essa cláusula explícita, o worker entrega em formato livre e o validator (`cc-validate-task.py` ou equivalente manual) não tem artefato parseável. Observado na rodada #164: worker E3 entregou sem CLAIMS por omissão da Interface ao compor o briefing — validação INV-27 ficou totalmente manual (`git cat-file -e` + `vitest run`). **Mitigado desde #169 v0.30.0**: `~/cc-mailbox/templates/worker-briefing.md` impõe a cláusula CLAIMS canônica e a Interface usa o template como base. Histórico citado para contexto, não como argumento de fragilidade pós-trigger (§13.2 regra de uma via).

**Bloco CLAIMS obrigatório em todo `<N>-report.md` do worker:**

````
## CLAIMS (machine-readable, do not edit)
```json
{
  "commit_hash": "a1b2c3d",
  "tests": {"passed": 1573, "failed": 0, "cmd": "npm test"},
  "files_touched": ["src/utils/foo.js", "src/__tests__/foo.test.js"]
}
```
````

**Regra `tests: skipped`:** permitido APENAS se `files_touched` contém somente `.md` ou `docs/`. Qualquer `.js|.jsx|.ts|.tsx|.cjs|.mjs|functions/**` com `tests: skipped` → STOP-HALLUCINATION.

**`cc-validate-task.py` — 3 checks, <300ms total:**

| Check | Verifica | Falha → |
|-------|----------|---------|
| `commit_exists` | `git cat-file -e <hash>` | STOP-HALLUCINATION |
| `tests_match` | contagem declarada bate com `result.log` | STOP-HALLUCINATION |
| `files_match` | `git show --name-only <hash>` ⊆ `files_touched` declarado | STOP-HALLUCINATION |

Edge cases (símbolos, contagem de linhas, DECs/INVs citadas) caem na revisão humana no fechamento via `§3.2`. Validador é intencionalmente minimalista — cobre alucinação grave, não tuning fino.

### 13.10 Tipos de Email (Gate Humano)

```
Subject: [Espelho #NNN] <TIPO>: <título 5-8 palavras>

TIPOS:
  TEST_FAIL        — testes quebraram, coord quer orientação
  DESTRUCTIVE      — worker quer ação destrutiva, precisa aprovação
  CONFLICT         — merge conflict, shared file bloqueado
  INVARIANT        — invariante violada (INV-XX)
  HALLUCINATION    — validator pegou claim falsa
  HUMAN_GATE       — ambiguidade genuinamente nova durante loop
  FINISHED         — todas as tasks ok, pronto para revisão de §3.2
```

**Rate limit:** mesmo `(issue, type)` silenciado se enviado <4h atrás. **Sem re-envio automático** — um gate, um email. Se Marcio quer status, RC em CC-Interface e pergunta.

**Body — seção COMO RESPONDER:**
```
Abra Claude Code mobile, RC em CC-Interface (sessão tmux:cc-NNN),
fale o que quer em linguagem natural. CC-Interface entende contexto e relaya.

Exemplos:
  "vai com a A"
  "explica esse erro"
  "aborta a issue"
  "tenta de novo sem mexer no compliance"
  "olha antes o histórico de testes desse arquivo, depois decida"
```

### 13.11 Componentes a Construir (Status)

| Componente | Localização | Status |
|------------|-------------|--------|
| `cc-notify-email.py` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#169 PR #172, v0.30.0) + **EXTENDIDO** (#178 PR #179, v0.38.0) — email real via iCloud SMTP, 14 TIPOs (7 originais + 7 `WATCHDOG_CLASS_*`), rate limit default 4h com override opcional `ttl_seconds` no payload (watchdog usa 1h). Fast-follow: versionar em `scripts/` para que mods viajem junto do código consumidor |
| `cc-validate-task.py` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#169 PR #172, v0.30.0) — 3 checks §13.9 em <300ms, 12/12 pytest, 233 linhas |
| `cc-notify-whatsapp.sh` | `~/cc-mailbox/bin/` | LOW PRIORITY — canal opcional, não crítico pro loop (email iCloud é canal primário INV-28; WhatsApp fica como redundância caso Evolution API esteja de pé) |
| `cc-watchdog.sh` | `scripts/` (repo) | **IMPLEMENTADO** (#178 PR #179, v0.38.0) — loop bash 90s, 3 classes de stall + sub-caso QUOTA com retry agendado, 7 tipos de email granulares com TTL 1h, lançado por `cc-worktree-start.sh` (nohup, PID em `.watchdog-pid`), mata via `cc-worktree-stop.sh`. Opt-out `CC_WATCHDOG_DISABLE=1`. ~450 linhas. Smokes contra evidência real do #119 |
| `cc-status.sh` | `scripts/` (repo) | **IMPLEMENTADO** (#178 PR #179, v0.38.0) — visão humana agregada multi-worktree: sem arg = dashboard de todas as sessões autônomas ativas; com arg `<NNN>` = detalhe com histórico, warnings e estado do loop. ~209 linhas |
| `cc-worktree-start.sh` | `scripts/` (repo) | **REFATORADO 3-TIER** (#169 PR #172, v0.30.0) + **INTEGRAÇÃO watchdog** (#178 PR #179, v0.38.0) — pré-condição cwd=worktree, 7 dirs §13.7, `.coord-id`/`.coord-dir`/`.interface-id` READ-ONLY, `flock` no listener, lança `cc-watchdog.sh` após listener (idempotente via check de PID vivo) |
| `cc-worktree-stop.sh` | `scripts/` (repo) | **ATUALIZADO** (#178 PR #179, v0.38.0) — mata watchdog via `.watchdog-pid` antes de encerrar tmux e remover worktree |
| `~/cc-mailbox/templates/worker-briefing.md` | `~/cc-mailbox/templates/` | **IMPLEMENTADO** (#169 PR #172, v0.30.0) — cláusula CLAIMS obrigatória, formato exato do bloco JSON, regras skipped, exemplo de report |
| `~/cc-mailbox/templates/coord-briefing.md` | `~/cc-mailbox/templates/` | **IMPLEMENTADO** (#176, v0.35.0) — template canônico com placeholders (`{{issue_num}}`, `{{issue_title}}`, `{{branch}}`, `{{worktree_path}}`, `{{control_file_path}}`), cobre identidade/ciclo-de-vida/TASK_DELIVERED/DISPATCH_TASK/HUMAN_GATE_RESOLVED + resolução de ambiguidades spec→PROJECT.md→padrão→§3.2 + tipos §13.10 |
| `cc-spawn-coord.sh` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#176, v0.35.0) — wrapper §13.8 passo 8b: precondição cwd=worktree, render do template com placeholders do control file (perl escape-safe), `claude -p --output-format json`, captura `session_id`, imprime `COORD_SESSION_ID=<uuid>` parsable. Smoke OK em issue-998. |
| `cc-dispatch-task.sh` | `~/cc-mailbox/bin/` | **IMPLEMENTADO** (#176, v0.35.0) — wrapper §13.8 passos 8d/36: lê `.coord-id`/`.coord-dir`, `flock -w 30 locks/coord.lock`, `cd $COORD_DIR`, `claude --resume --permission-mode auto -p "DISPATCH_FIRST_TASK\|DISPATCH_TASK slug=...\|HUMAN_GATE_RESOLVED ref=..."`. Smoke OK em issue-998. |
| `~/cc-mailbox/.env` | `~/cc-mailbox/` | Setup manual (EMAIL_PASSWORD iCloud — senha reusada de `~/morning_call_auto/.env` via decisão operacional) |

**Status do protocolo:** **OPERACIONAL END-TO-END** a partir de v0.35.0 (#176). **Validado com rodada real** em worktree sintético `issue-997` (23/04/2026 01:32-01:35 BRT, ~3min, EMAIL_DRY_RUN=0): `cc-spawn-coord.sh` → `COORD_SESSION_ID=f88e64e6-...` → `cc-worktree-start.sh` grava RO + lança listener → `cc-dispatch-task.sh FIRST` → Coord escreve briefing completo do worker em `inbox/01-criar-scratch-file.md` → listener polling pega em ~25s → worker headless `claude -p` executa (cria arquivo, commita `cae656b2`, escreve report com CLAIMS válido `{commit_hash, tests.skipped:true, files_touched}`) → listener faz `TASK_DELIVERED` via `flock + --resume` → Coord acorda, roda `cc-validate-task.py` (exit 0 OK), atualiza control file marcando `[x]` nos critérios (side-effect benéfico não-pedido) → Coord dispara email real `[Espelho #997] FINISHED: E2E dry-run §13 concluído — todas as tasks OK` via `cc-notify-email.py` → email chega no iCloud do Marcio → Coord morre. Loop inteiro sem intervenção humana. Fast-follow: re-validação do Recovery §13.15 pós-amendment v0.26.0 (não bloqueia execução de novos issues; o protocolo de Recovery está implementado e foi validado historicamente na rodada #164).

**Fast-follows identificados nos dry-runs:**
- `cc-notify-email.py` em `EMAIL_DRY_RUN=1` não escreve em per-worktree log (só no global); assimetria trivial de 3 linhas
- Criar worktree novo a partir do `main` pós-merge #172 pega a versão refatorada do `cc-worktree-start.sh` automaticamente (nota operacional: worktrees criados ANTES do merge continuam com script antigo até recriarem)

**Política de SoT para infra autônoma duplicada (#231):** scripts que vivem em `scripts/` (repo, versionado) são canônicos. Cópias antigas em `~/cc-mailbox/bin/` (não versionadas) que existirem para os mesmos arquivos — `cc-watchdog.sh`, `cc-status.sh` — são deprecated; consumidores programáticos (ex.: `cc-worktree-start.sh:226`) apontam para `$REPO/scripts/`. Cleanup local das cópias velhas em `~/cc-mailbox/bin/` é decisão operacional do Marcio (fora do repo). Scripts que existem APENAS em `~/cc-mailbox/bin/` (`cc-notify-email.py`, `cc-validate-task.py`, `cc-spawn-coord.sh`, `cc-dispatch-task.sh`) seguem lá até fast-follow do `cc-notify-email.py:262` ser executado.

### 13.12 Decisões de Design (Bugs 1-10)

Ver histórico em `/mnt/c/000-Marcio/Temp/proto-autonomo-state.md` para o design completo. Síntese:

| Bug | Decisão |
|-----|---------|
| 1 | Coord nasce em 8b (antes do start script) via `claude -p` com captura de `session_id` do JSON |
| 2 | Modelo A — Coord SEMPRE morre após turn. Wake-up sempre via `--resume` |
| 3 | CC-Interface idle no prompt, zero polling, trigger único = Marcio digitar algo |
| 4 | `coord-inbox/` declarado + ownership definido (§13.6) |
| 5 | `flock -w 30 coord.lock` antes de todo `--resume`. Lock per-worktree. Timeout → 1 retry → email Marcio |
| 6 | CLAIMS mínimo (3 campos) + validator com 3 checks (commit, testes, arquivos). Resto cai na revisão humana em §3.2 (versão enxuta — não inflar) |
| 7 | Rate limit por `(issue, type)` em 4h no script. Sem re-envio automático de gate não resolvido |
| 8 | Task = 1-5 commits, ~30-90min. Micro-task (1 linha) merge na próxima. Heurística, não regra dura |
| 9 | `cc-notify-whatsapp.sh` faz `curl -sf localhost:8080/` interno. Exit silent se Docker off. Outros atores não sabem |
| 10 | Task = unidade indivisível. Decisões dentro da task ficam no mesmo commit. Rollback por task, não por decisão. §3.2 + PR review cobrem |

### 13.13 Notas Operacionais (Não-Invariantes)

**Prompt cache:**
- `claude -p` usa prompt cache por default; Coord/Worker não precisam de `cache_control` explícito
- Loop apertado (Worker entrega → Coord acorda em <5min): cache hit natural, economia esperada
- Gate humano longo (>5min até Marcio responder): TTL de 5min do Anthropic expira → `--resume` re-carrega transcript inteiro. Comportamento esperado, não é bug
- Entre workers: cada worker é sessão nova `claude -p`, sem cache compartilhado
- Otimização futura possível (fora do MVP): se telemetria mostrar custo alto em gates longos, avaliar `coord-state.md` condensado que `--resume` usa em vez do transcript inteiro

**Dry-runs validados (sessão de design 21/04/2026):**

| Teste | Resultado | Implicação |
|-------|-----------|-----------|
| `claude --resume <id> --permission-mode auto -p` | ✅ executa Bash sem prompt, `permission_denials: []` | Resume preserva auto mode; loop coord/worker viável |
| `claude -p` headless sem TTY | ✅ executa, mas refuse soft em writes fora de cwd | Headless funciona; modelo tem judgment próprio |
| `PushNotification` em `-p` headless | ❌ 4 tentativas, todas "user active" suppressed | PushNotification inviável como canal primário |
| Email iCloud SMTP via Python `smtplib` | ✅ enviado, chegou no celular (latência iCloud) | Canal primário validado |
| WhatsApp Evolution API | ⚠️ não testado vivo (Evolution offline no momento) | Funcional em arquitetura, requer Docker up |

### 13.14 Referência Cruzada

- **INV-25** — Outbox antes de resume (fundação do TASK_DELIVERED)
- **INV-26** — `.coord-id` e `.coord-dir` read-only, start script responsabilidade única (+ amendments v0.25.0 e v0.26.0)
- **INV-27** — Validação externa de claims (cegueira epistêmica)
- **INV-28** — Email iCloud canal primário
- **§4.0** — Protocolo padrão interativo (default do projeto)
- **§6.3** — Registry de chunks e locks (obrigatório antes de qualquer worktree)
- **§13.15** — Protocolo de Recovery de CC-Interface (única exceção ao READ-ONLY da INV-26)
- **DEC-AUTO-NN** — convenção de identificador de decisão autônoma do coord (registrada em `§3.2` do control file do issue)

### 13.15 Protocolo de Recovery de CC-Interface

> Adicionado em v0.26.0 após primeiro caso real de queda (rodada #164, 21-22/04/2026).

Quando CC-Interface morre durante a execução de um issue (crash, kill, desconexão permanente), uma nova sessão pode assumir o papel sem perder o trabalho em progresso. Passos:

| # | Ação | Observação |
|---|------|-----------|
| 1 | **Process check** da session anterior | `ps -p <old_PID>`. Se não responde → session morta, recovery autorizada |
| 2 | **JSONL scope check** | `find ~/.claude/projects -name "<old_session_id>*"`. Se project-scope ≠ worktree (bug cross-worktree — §13.7/§13.8), documentar como causa raiz e justificativa para override |
| 3 | **Nova CC-Interface spawna** | `cd ~/projects/issue-NNN && claude --permission-mode auto` — **sem `--resume`** (recovery real, não reanimação). Aplicar prompt padrão de recovery (template abaixo) |
| 4 | **Escrita excepcional** | `.coord-id` ← `$CLAUDE_SESSION_ID` da nova Interface; `.coord-dir` ← worktree absoluto. **Esta é a ÚNICA exceção à INV-26** (amendment v0.26.0) |
| 5 | **Registro obrigatório** | Nova Interface adiciona em `§3.2 Decisões Autônomas` do control file: `"RECOVERY: CC-Interface anterior <PID> morta; override de .coord-id e .coord-dir — bug cross-worktree <confirmado|não-confirmado>"` |

**Template de prompt de recovery** (colar na nova sessão após spawn):

```
Você é CC-Interface de RECUPERAÇÃO para issue #NNN.
A CC-Interface anterior morreu (PID <X>).
Reconstrua o estado a partir do filesystem — sem contexto da sessão anterior.

1. Ler docs/PROJECT.md §13 + CLAUDE.md
2. Ler docs/dev/issues/issue-NNN-*.md (control file: escopo, entregas E1..)
3. Listar .cc-mailbox/processed/ (tasks processadas) + outbox/ (reports)
4. git log --oneline main..HEAD (commits da branch)
5. Ler reports em outbox/ para confirmar o que cada worker entregou
6. Rodar npx vitest run (validação INV-27 manual enquanto scripts ausentes)
7. Atualizar .coord-id (seu $CLAUDE_SESSION_ID) + .coord-dir (worktree absoluto)
   — única exceção à INV-26 (§13.15, passo 4)
8. Registrar ação em §3.2 do control file (passo 5)

Reporte em 10 linhas:
- Entregas por fase — quais feitas, quais pendentes (base nos reports + git log)
- Próxima ação sugerida (validar, despachar pendente, ou fechar issue)
- Inconsistências entre commits e reports (INV-27 manual)
- Confirmar que atualizou .coord-id + .coord-dir
```

**Critério de sucesso da recovery:**
- Nova Interface identifica entregas sem alucinar
- Pega session_id antigo como inválido e atualiza
- Sugere ação coerente com fase real do issue (não re-despachar se tudo entregue)
- Não assume estado — verifica via filesystem

**Validação histórica:** rodada #164 — CC-Interface `5cd03bd7` morreu (kill manual após 5h40min); nova `4ec7b999` aplicou este protocolo e reconstruiu estado em ~2min (4 entregas E1/E2/E3/E5, 19 commits, 1838/1838 testes confirmados). Bug cross-worktree confirmado: JSONL antigo em `-acompanhamento-2-0`, novo em `-issue-164`.

