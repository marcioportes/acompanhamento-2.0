# Protocolo — Abertura de Sessão (§4.0 + Gates Pré-Código §4.1 + Pré-Entrega §4.2)

> Protocolo obrigatório para TODA sessão que modifica código. Executa automaticamente ao mencionar issue/feature/fix/debt.

### 4.0 Abertura de Sessão (obrigatório, antes de tudo — starta automaticamente em sessões de codificação)

```
□ Ler PROJECT.md do repo (main) — verificar versão no header (INV-14)
   → Se versão diverge do que a sessão tem em contexto: PARAR, reler o arquivo fresh
□ Ler o issue no GitHub (gh issue view NNN)
□ Identificar campo "Chunks necessários" no body do issue
□ Consultar Registry de Chunks (seção 6.3) — verificar que TODOS estão AVAILABLE
   → Se algum chunk está LOCKED: PARAR. Notificar Marcio com "CHUNK-XX locked por issue-YYY"
   → Se chunk não existe no registry: PARAR. Propor novo chunk ao Marcio
□ AINDA NO MAIN: registrar locks na tabela §6.3 (chunk + issue + branch + data)
□ AINDA NO MAIN: ler `src/version.js` e reservar o próximo minor disponível (ex: v1.30.0 → reservar v1.31.0)
□ AINDA NO MAIN: commit único — "docs: registrar locks CHUNK-XX + reservar vX.Y.Z para issue-NNN"
□ Criar worktree: git worktree add ~/projects/issue-{NNN} -b tipo/issue-NNN-descricao (INV-16)
   (worktree nasce com locks e versão já commitados — zero conflito no merge)
□ **Entrar no worktree antes de prosseguir:** `cd ~/projects/issue-{NNN}`
   → Se usar modelo coord/worker (mailbox + `--resume`): a sessão coord DEVE ser aberta de dentro
     do worktree. O JSONL fica ancorado ao diretório de invocação. Coord aberto no main → listener
     no worktree não encontra a sessão ao chamar `--resume` ("No conversation found").
□ Criar arquivo docs/dev/issues/issue-NNN-descricao.md DENTRO do worktree a partir do template abaixo
□ Confirmar pwd = ~/projects/issue-{NNN}
□ Preencher seções 1 (Contexto), 2 (Acceptance Criteria), 3 (Análise de Impacto) e 6 (Chunks)
□ Só então iniciar Gate Pré-Código (seção 4.1)
```

**Regra:** sem issue no GitHub + chunks verificados + arquivo de controle em `docs/dev/issues/`, nenhuma linha de código é escrita. Se a sessão for perdida, outra sessão reconstrói o contexto completo a partir do arquivo de issue.

**Regra de chunks:** o campo "Chunks necessários" no issue do GitHub é OBRIGATÓRIO para issues de código. A sessão NÃO infere chunks — lê do issue. Se o campo estiver ausente, a sessão preenche antes de prosseguir (grep no código + análise de impacto → propõe chunks → aguarda aprovação).

**Regra de shared files:** locks e edições em shared files (PROJECT.md §6.3, etc.) são feitos e commitados no main ANTES da criação do worktree. Dentro do worktree, shared files nunca são editados diretamente — apenas deltas propostos no arquivo de controle do issue. O integrador aplica os deltas no merge.

> **Diretiva operacional para Claude Code — autorização permanente de leitura:**
> Operações de leitura completa NÃO requerem confirmação: `grep`, `cat`, `ls`, `find`, `view`,
> `gh issue view`, `git log/status/diff`, `npm test`, `npm run build`, `head`, `tail`, `wc`,
> `du`, `df`, `ps`, `free`.
>
> Parar para confirmar APENAS em operações destrutivas ou que afetem estado compartilhado:
> `commit`, `push`, `deploy`, `delete`, `rm -rf`, `git reset`, `firebase deploy`.

#### Template: `docs/dev/issues/issue-NNN-descricao.md`

```markdown
# Issue NNN — tipo: Título descritivo
> **Branch:** `tipo/issue-NNN-descricao`  
> **Milestone:** vX.Y.Z — Nome do Milestone  
> **Aberto em:** DD/MM/YYYY  
> **Status:** 🔵 Em andamento | ✅ Encerrado  
> **Versão entregue:** —

---

## 1. CONTEXTO

Descrição do problema ou feature. Por que existe. Qual o impacto.

## 2. ACCEPTANCE CRITERIA

- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | — |
| Cloud Functions afetadas | — |
| Hooks/listeners afetados | — |
| Side-effects (PL, compliance, emotional) | — |
| Blast radius | — |
| Rollback | — |

## 4. SESSÕES

### Sessão — DD/MM/YYYY

**O que foi feito:**
- Item 1
- Item 2

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| DEC-xxx | — | — |

**Arquivos tocados:**
- `path/to/file.js`

**Testes:**
- X testes novos, Y total passando

**Commits:** (listar como bloco de código)
- `hash mensagem`

**Pendências para próxima sessão:**
- Item 1

## 5. ENCERRAMENTO

**Status:** Aguardando PR | Mergeado | Cancelado

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
| CHUNK-XX | leitura / escrita | Descrição do que será tocado |

> **Modo leitura:** a sessão consulta arquivos do chunk mas não os modifica. Não requer lock.
> **Modo escrita:** a sessão modifica arquivos do chunk. Requer lock obrigatório.
```

### 4.1 Gate Pré-Código (obrigatório, nesta ordem)

```
□ Leitura completa dos arquivos relevantes (grep + view + bash) — NUNCA inferir
□ Análise de impacto: collections, CFs, hooks, side-effects, dados parciais
□ Proposta apresentada ao Marcio → AGUARDAR aprovação explícita
□ Checklist de impacto (seção 5) executado mentalmente
□ INV-17 cumprida: nível + domínio + duplicação + budget declarados (se a proposta toca UI)
□ INV-18 cumprida: spec/mockup apresentada ao Marcio e aprovada explicitamente
   → Se UI: mockup visual validado
   → Se CF/backend: schema JSON com exemplo validado
   → Se lógica: cenário de teste em linguagem natural validado
   → Se Firestore: documento de exemplo com campos/tipos/valores validado
```

### 4.2 Gate Pré-Entrega (obrigatório, antes de cada entrega)

```
□ version.js aplicado com a versão reservada na abertura (Fase 3) + build date atualizado
□ CHANGELOG (seção 10) com entrada da versão reservada
□ Testes para toda lógica nova criados e passando
□ DebugBadge em todos os componentes novos/tocados com component="NomeExato"
□ npm run lint em arquivos tocados no branch — ZERO erros `no-undef`, `no-unused-vars`
  críticos e zero regressão em regras já ativas. Origem: #162 SEV1 — um `no-undef` não
  detectado (`assessmentStudentId`) quebrou produção. Custo do item: ~5s por arquivo
□ Rodar npm run dev e confirmar no browser que telas afetadas renderizam sem erros no
  console — validar CADA contexto de consumo da tela:
    (a) aluno logado abrindo a própria tela
    (b) mentor com viewAs apontando para aluno (se aplicável)
    (c) modo override / embedded (se aplicável)
  Origem: #162 — gap de validação do contexto (a) no #102 deixou o ReferenceError passar
  ao deploy. QA tracker de sessões com dashboard do aluno deve exigir este check explícito
□ Commit via Claude Code ou git direto (commits em linha única)
□ PARAR — aguardar confirmação do Marcio
```

> **Regra de versão (Fase 3 → Gate Pré-Entrega):** a versão é reservada no main no ato de abertura da sessão (lida de `src/version.js` + próximo minor), commitada junto com os locks. A próxima sessão lê o main, vê a versão reservada, e reserva o próximo. Conflito de versão eliminado na origem — no gate pré-entrega a versão já está decidida, só aplica no `version.js` + CHANGELOG. Se a sessão da frente mergear primeiro (raro), rebase resolve a versão; se a própria sessão descobrir que precisa bumpar major, renegocia com Marcio.

