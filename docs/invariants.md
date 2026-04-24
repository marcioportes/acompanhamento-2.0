# Invariantes Arquiteturais

> INV-01..28 — regras invioláveis. Qualquer proposta que quebre uma invariante deve ser redesenhada.



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

### INV-13: Rastreabilidade Obrigatória por Issue
Toda modificação de código exige: (1) issue aberto no GitHub, (2) arquivo de controle `docs/dev/issues/issue-NNN-descricao.md` criado a partir do template (seção 4.0), (3) branch nomeada `tipo/issue-NNN-descricao`. Sem esses três artefatos, o Gate Pré-Código não pode ser iniciado. O arquivo de issue é o documento de continuidade — se a sessão for interrompida, qualquer sessão subsequente deve conseguir retomar o trabalho exclusivamente a partir dele + PROJECT.md + código.

### INV-14: Versionamento do PROJECT.md
Toda modificação deste documento DEVE: (1) incrementar a versão no header (semver: major.minor.patch), (2) adicionar entrada na tabela de histórico de versões, (3) declarar "baseado na versão X.Y.Z" na proposta. Na abertura de sessão, a versão do repo deve ser comparada com a versão em contexto — divergência indica arquivo stale que deve ser relido antes de qualquer ação.

### INV-15: Aprovação Obrigatória para Persistência
Toda criação de collection, subcollection, ou campo novo no Firestore exige: (1) justificativa escrita com análise de dependência conceitual (a entidade existe sozinha ou depende de outra?), (2) parecer técnico com prós/contras das opções de modelagem (collection raiz vs subcollection vs field inline), (3) aprovação explícita do Marcio antes de implementar. Nenhuma estrutura de dados é criada sem passar por este gate.

### INV-16: Isolamento via Worktree — OBRIGATÓRIO SEMPRE
**Toda sessão de código opera dentro de um git worktree dedicado. Sem exceção — paralela ou não.** Editar código na working tree principal (`~/projects/acompanhamento-2.0`) é **PROIBIDO**. O repo principal é trunk exclusivo: recebe merges, nunca edições diretas.

**Padrão único e inequívoco de nome:** `~/projects/issue-{NNN}`
(nomes antigos como `acomp-{NNN}` estão **descontinuados**)

**Comando de criação (passo §4.0 obrigatório):**
```
git worktree add ~/projects/issue-{NNN} -b tipo/issue-NNN-descricao
```

**Comando de remoção (passo §4.3 obrigatório após merge — duas etapas):**
```
git worktree remove ~/projects/issue-{NNN}    # desregistra do git
rm -rf ~/projects/issue-{NNN}                 # remove diretório físico residual
```

**Gate de verificação antes de qualquer edição de código:** se `pwd` não retorna `~/projects/issue-{NNN}`, PARE — o worktree não foi criado ou você está no diretório errado. Crie/entre no worktree antes de prosseguir. A criação do worktree **não pode ser omitida nem adiada** sob nenhuma justificativa.

### INV-17: Gate de Arquitetura de Informação
Antes de propor qualquer componente de UI novo ou modificação de tela existente, a sessão DEVE declarar:

1. **Nível:** sidebar / tab / card / modal
2. **Domínio:** Dashboard / Operação / Mesa Prop / Feedback / Análise / Contas / Revisão / Config
3. **Duplicação:** se o mesmo dado já aparece em outra tela, justificar ou consolidar
4. **Budget:** se a tela destino já tem 6+ seções visíveis, remover ou colapsar algo antes de adicionar

**Mapa de domínios (slots fixos):**

| Domínio | Sidebar | O que mora | O que NÃO mora |
|---------|---------|-----------|---------------|
| Dashboard | Sim | KPIs resumo, equity curve, calendário, SWOT | Detalhes prop, payout, AI plan |
| Operação (Diário) | Sim | Registro e histórico de trades | Análises agregadas |
| Mesa Prop | Sim (condicional) | Gauges DD, alertas, payout, AI plan, sparkline | KPIs genéricos |
| Feedback | Sim | Chat mentor-aluno por trade | Shadow (mora no detalhe do trade) |
| Análise | Futuro | Dashboard emocional, evolução temporal | Registro de trades |
| Contas | Sim | CRUD contas e planos | Dados operacionais |
| Revisão | Futuro | Revisão semanal, histórico de revisões | Tudo que não é revisão |
| Config | Sim | Settings mentor, templates, compliance | Dados de aluno |

Toda feature nova declara domínio + nível. "Seção colapsável no componente X" é sinal de puxadinho — a pergunta correta é "qual tela existente deveria mostrar isso, ou precisa de tela nova?"

> Origem: auditoria de arquitetura de informação 15/04/2026 — 3 sessões paralelas mapearam telas, duplicações e puxadinhos.

### INV-18: Spec Review Gate — Validação de Entendimento Obrigatória
Nenhuma feature, Cloud Function ou modificação de UI é implementada sem validação explícita de entendimento entre o CC e Marcio. O gate NÃO é "entendi, posso codar?" — é "mostra o que você entendeu e eu confirmo".

**Protocolo obrigatório:**
1. Marcio descreve a ideia (verbal, texto, screenshot)
2. CC escreve spec/mockup e APRESENTA de volta ao Marcio
3. Marcio confronta: "é isso que eu quis dizer?" — aponta divergências
4. CC corrige até alinhar — ciclo 2-3 repete quantas vezes necessário
5. Só após confirmação explícita ("aprovado", "go", "sim") o CC codifica

**Formato da validação por tipo:**
- **UI:** mockup visual (descrição de tela com campos, layout, fluxo de navegação, onde cada dado aparece)
- **Backend / CF:** schema JSON com exemplo concreto de input E output
- **Lógica de negócio:** cenário de teste em linguagem natural ("se o aluno tem 3 trades no período com WR 66%, o acumulado do período mostra R$ 150 e o do ciclo mostra R$ 2.300")
- **Dados / Firestore:** documento de exemplo com todos os campos, tipos e valores realistas

**Anti-pattern:** CC diz "entendi" e sai codificando sem mostrar o que entendeu. Isso é VIOLAÇÃO da INV-18 — mesmo que o código resultante esteja tecnicamente correto, se não passou pelo gate de validação, deve ser revertido.

> Origem: sessão de voz 15/04/2026 — diagnóstico do gap entre descrição verbal e interpretação do modelo como causa raiz de retrabalho sistemático.

### INV-25: Outbox Antes de Resume — Padrão Coord/Worker
No modelo de orquestração coord/worker, todo output de worker é persistido em arquivo no outbox (`.cc-mailbox/outbox/`) **antes** de o coord ser invocado via `claude --resume`. O coord nunca depende de memória de processo do worker — lê sempre do outbox.

**Por que:** `claude --resume` opera com semântica at-least-once. Se o `--resume` falhar por qualquer motivo (diretório errado, rede, processo morto), o output continua acessível em disco e pode ser lido manualmente ou reprocessado. Violação — coord assumir que "sabe" o output sem reler o outbox — reintroduz exatamente as fragilidades que o padrão elimina.

**Verificação:** antes de despachar a próxima task, o coord confirma que `outbox/<task>-result.log` existe e tem conteúdo.

> Origem: lição aprendida #165 — `--resume` falhou silenciosamente por cwd incorreto; output estava no outbox e permitiu recovery manual.

### INV-26: `.coord-id` É Responsabilidade do Start Script — Coord Nunca Sobrescreve
O arquivo `.cc-mailbox/.coord-id` é gravado pelo `cc-worktree-start.sh` no momento em que o tmux listener é criado (session ID do coord passado como 3º argumento ao script). **O coord nunca escreve nesse arquivo.** O valor correto já está lá desde a criação do worktree. Sobrescrever destrói o session ID real e quebra o loop de notificação inversa.

**Regra:** o coord só grava `.cc-mailbox/.coord-dir` (caminho do worktree), e apenas se o script não o tiver criado. `.coord-id` é somente leitura para o coord.

**Amendment (v0.25.0):** `.coord-id` é READ-ONLY para **todos os atores**, incluindo CC-Coord, CC-Interface (modo autônomo — §13), e listener tmux. Somente `cc-worktree-start.sh` pode escrever, e apenas uma vez, no momento da criação do tmux.

**Amendment (v0.26.0):** a única exceção ao READ-ONLY é o **Protocolo de Recovery de CC-Interface (§13.15)**. Quando CC-Interface morre e nova sessão assume, ela pode (e deve) atualizar `.coord-id` com seu próprio session_id e `.coord-dir` com o worktree path. Fora dessa exceção e da escrita única pelo start script, qualquer ator que escreva nesses arquivos comete anti-pattern de alteração de estrutura sem aprovação. `.coord-dir` passa a ter a mesma disciplina READ-ONLY de `.coord-id` — divergência entre `.coord-dir` e worktree real causa falha silenciosa do `--resume` do listener (observado na rodada #164).

**Anti-pattern:** coord (ou qualquer outro ator) inventar ou derivar um session ID (ex: `coord-issue-NNN-taskNN`) quando `$CLAUDE_SESSION_ID` retorna vazio. O ID real foi gravado pelo start script — não tocá-lo é suficiente.

> Origem: lição aprendida #166 — coord sobrescreveu `.coord-id` com valor inventado, destruindo session ID real que já estava gravado pelo start script.

### INV-27: Validação Externa de Claims — Cegueira Epistêmica

Dados inventados em processo real (commits, contagem de testes, arquivos tocados) são falha crítica. Modelos de linguagem podem **não detectar a própria alucinação** — cegueira epistêmica no caso "não sei que não sei"; auto-declaração "não aluciei" é estatisticamente correlacionada com honestidade mas não é garantia determinística, e sob pressão o sycophancy bias pode vencer.

**Consequência:** toda claim verificável emitida por worker, coord, ou pelo próprio CC em modo interativo após delegação sem supervisão humana ativa DEVE ser externamente validada. Auto-declaração não é suficiente.

**Mecanismos obrigatórios (modo autônomo — §13):**
- Worker grava bloco `CLAIMS` estruturado em todo `<N>-report.md` do outbox (commit_hash, tests{passed,failed,cmd}, files_touched)
- Coord roda `cc-validate-task.py` em todo `TASK_DELIVERED`, antes de despachar próxima task
- Validator executa 3 checks baratos (<300ms total): commit_exists (`git cat-file -e`), tests_match (contagem declarada = `result.log`), files_match (`git show --name-only` ⊆ `files_touched`)
- Qualquer check em falha → STOP-HALLUCINATION + email humano
- `tests: skipped` permitido APENAS se `files_touched` contém somente `.md` ou `docs/`; caso contrário STOP

**Mecanismo em modo interativo:** quando CC delega/executa tasks sem supervisão (ex: "vai implementando isso"), o CC DEVE rodar `cc-validate-task.py` contra o próprio commit antes de relatar "pronto". Se fail → para e sinaliza.

> Origem: sessão de design 21/04/2026 (bugs 1-10 do protocolo autônomo). Reframe da versão inicial após discussão sobre cegueira epistêmica: o problema não é modelo desonesto, é modelo que literalmente não consegue detectar a própria invenção. Solução é verificação externa, não confiança.

### INV-28: Email iCloud É Canal Primário de Gate Humano

Notificação humana (STOP-XXX do coord autônomo para Marcio) usa **email iCloud SMTP** como canal primário, sempre. Outros canais (WhatsApp via Evolution API, push notifications) são estritamente opcionais.

**Regras:**
- Helper único: `~/cc-mailbox/bin/cc-notify-email.py` (global, reutilizado por todas as issues)
- Interface via JSON stdin com campos tipados (`type`, `issue`, `task`, `summary`, `detail`, `options`, `recommendation`)
- Rate limit por `(issue, type)`: silencia se mesmo par enviado <4h atrás
- Sem re-envio automático — um gate, um email. Se Marcio quer status, RC em CC-Interface e pergunta
- Canais opcionais (WhatsApp) usam try/except com exit silent em falha — nunca bloqueiam o loop
- SMTP iCloud via `EMAIL_PASSWORD` em `~/cc-mailbox/.env` (separado de outros .env do repositório)
- Log global em `~/cc-mailbox/log/emails.log` + per-issue em `.cc-mailbox/log/emails-<data>.log`

**Subject scaneável:** `[Espelho #<NNN>] <STOP_TYPE>: <título 5-8 palavras>`

**Tipos de gate:** `TEST_FAIL`, `DESTRUCTIVE`, `CONFLICT`, `INVARIANT`, `HALLUCINATION`, `HUMAN_GATE`, `FINISHED`.

**Body — COMO RESPONDER (linguagem natural, sem código Morse):** Marcio abre Claude Code mobile, RC na sessão tmux `cc-NNN`, fala em linguagem natural ("vai com a A", "explica esse erro", "aborta"). CC-Interface entende contexto e relaya.

> Origem: sessão de design 21/04/2026 — validação por dry-run (4 emails enviados, SMTP funcional, subject chega legível no iPhone). PushNotification inviável em `claude -p` headless (testado, sempre "user active" suppressed). WhatsApp depende de Docker/Evolution API rodando, logo não pode ser canal primário.

---

