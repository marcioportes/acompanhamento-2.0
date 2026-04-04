# Issue 094 — feat: Controle de Assinaturas da Mentoria
> **Branch:** `feature/issue-094-controle-assinaturas`  
> **Milestone:** v1.2.0 — Mentor Cockpit  
> **Aberto em:** 04/04/2026  
> **Status:** 🔵 Em andamento  
> **Versao entregue:** —

---

## 1. CONTEXTO

Modulo de gestao de assinaturas centralizado no dashboard do mentor. Escopo intencional: dados, status e alertas por email. Sem integracao com gateway de pagamento e sem automacao de WhatsApp nesta fase.

Entregas:
1. **Firestore** — subcollection `students/{id}/subscriptions` com subcollection `payments`
2. **Cloud Function** — `checkSubscriptions` (onSchedule, diaria 8h BRT). Detecta vencimentos proximos, atualiza status `overdue`, expira trials, sincroniza `accessTier`, envia email ao mentor
3. **Frontend** — `SubscriptionsPage` (rota mentor) com tabela, filtros por status/tipo, acoes "Registrar pagamento" e "Renovar"
4. **Card resumo** — semaforo no dashboard mentor (ativos / vencendo / inadimplentes)

Fora de escopo: gateway de pagamento, notificacao ao aluno, controle de WhatsApp.

**Fluxo operacional de criacao de assinatura:**
1. Mentor cadastra aluno no sistema (ja existe)
2. Mentor abre "Nova Assinatura" → seletor lista apenas students que NAO possuem nenhum documento na subcollection `subscriptions` (unico criterio)
3. Mentor seleciona aluno, tipo (trial/paid), plano → cria subscription
4. Aluno sai do seletor apos criacao

Email provider: `firebase/firestore-send-email@0.2.7` (ja em producao — collection `mail`).

### 1.1 Schema consolidado — `students/{id}/subscriptions/{subId}` (REVISADO)

> Refatorado de collection raiz para subcollection do student. Assinatura e entidade dependente — nunca existe sem aluno (INV-15). Decisao DEC-055.

**Campo novo no student:**
```javascript
// students/{studentId} — campo adicionado
{
  accessTier: string,   // 'alpha' | 'self_service' | 'none'
                         // Fonte de verdade para UI condicional (#100)
                         // Derivado da subscription ativa. CF checkSubscriptions mantem sincronizado
}
```

**Subscription (subcollection):**
```javascript
// students/{studentId}/subscriptions/{subscriptionId}
{
  // --- Natureza ---
  type: string,               // 'trial' | 'paid'
  plan: string,               // 'alpha' | 'self_service' (nivel de acesso que esta subscription da)

  // --- Status ---
  status: string,             // 'active' | 'pending' | 'overdue' | 'paused' | 'cancelled' | 'expired'
                               //   pending  = aguardando primeiro pagamento (so paid)
                               //   active   = em dia / trial ativo
                               //   overdue  = vencido apos gracePeriodDays (so paid)
                               //   paused   = suspensao temporaria pelo mentor
                               //   cancelled = cancelado definitivamente
                               //   expired  = periodo expirou sem renovacao / trial expirou

  // --- Trial ---
  trialEndsAt: Timestamp,     // so para type: 'trial'. CF expira automaticamente

  // --- Paid ---
  amount: number,             // so para type: 'paid'
  currency: string,           // 'BRL' | 'USD'
  endDate: Timestamp,         // data de vencimento do periodo atual
  renewalDate: Timestamp,     // proxima renovacao esperada
  lastPaymentDate: Timestamp, // atalho — evita query na subcollection payments
  gracePeriodDays: number,    // dias de tolerancia antes de marcar overdue (default: 5)

  // --- Comum ---
  startDate: Timestamp,
  notes: string,              // observacoes livres do mentor
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// students/{studentId}/subscriptions/{subId}/payments/{paymentId}
{
  date: Timestamp,
  amount: number,
  currency: string,           // 'BRL' | 'USD'
  method: string,             // 'pix' | 'transfer' | 'card' | 'other'
  reference: string,          // comprovante ou referencia
  periodStart: Timestamp,     // inicio do periodo coberto
  periodEnd: Timestamp,       // fim do periodo coberto
  registeredBy: string,       // uid do mentor
  createdAt: Timestamp
}
```

**Regra de accessTier (CF checkSubscriptions mantem sincronizado):**

| Pessoa | type | plan | status | accessTier |
|--------|------|------|--------|------------|
| Aluno pagante Alpha | paid | alpha | active | alpha |
| Aluno pagante Espelho | paid | self_service | active | self_service |
| Lead testando 30 dias | trial | alpha | active | alpha |
| Lead com trial expirado | trial | alpha | expired | none |
| VIP free lunch | — (sem subscription) | — | — | none |
| Aluno inadimplente | paid | alpha | overdue→expired | alpha (grace) → none |

**Decisoes de schema (revisao 04/04/2026):**

| Decisao | Razao |
|---------|-------|
| Subcollection em vez de collection raiz | Assinatura e entidade dependente do aluno (INV-15). Nunca existe sozinha |
| Campo `accessTier` no student | UI condicional le este campo. Derivado da subscription, sincronizado pela CF |
| `type: trial/paid` | Separa leads testando de alunos convertidos. Trial nao tem amount/cobranca |
| `trialEndsAt` | CF expira trial automaticamente e atualiza accessTier para none |
| VIP nao tem subscription | Existe como student com accessTier: none. Sem registro de assinatura |
| `studentEmail` removido da subscription | Desnecessario — dado ja existe no documento parent (student) |
| collectionGroup para queries do mentor | Listar todas as subscriptions cross-student via collectionGroup('subscriptions') |

### 1.2 Email provider — JA EM PRODUCAO

Extension `firebase/firestore-send-email@0.2.7` (`firestore-send-email`) ja instalada e operacional. Padrao de uso: CF escreve doc na collection `mail` com campos `to`, `message.subject`, `message.html` — a extension dispara o envio via Gmail.

A CF `checkSubscriptions` segue o mesmo padrao. Nao ha decisao pendente.

## 2. ACCEPTANCE CRITERIA

- [ ] Subcollection `students/{id}/subscriptions` criada com schema conforme secao 1.1
- [ ] Subcollection `payments` funcional (3 niveis: student → subscription → payment)
- [ ] Campo `accessTier` adicionado aos students existentes
- [ ] CF `checkSubscriptions` rodando as 8h BRT sem erros
- [ ] CF sincroniza `accessTier` no student baseado na subscription ativa
- [ ] CF expira trials automaticamente quando `trialEndsAt` e passado
- [ ] Status `overdue` atualizado automaticamente respeitando `gracePeriodDays`
- [ ] Email enviado apenas quando ha ocorrencias (vencimento, inadimplencia, trial expirando)
- [ ] `SubscriptionsPage` com tabela, filtros por status e tipo (trial/paid), acoes de pagamento/renovacao
- [ ] Modal "Nova Assinatura" funcional: seletor lista students sem subscription (unico criterio), tipo (trial/paid), campos conforme tipo
- [ ] Card de resumo visivel no dashboard do mentor
- [ ] Regras Firestore para `subscriptions` via collectionGroup (mentor read/write)
- [ ] DebugBadge presente na pagina e no card
- [ ] Testes cobrindo: transicao de status, grace period, trial expiration, accessTier sync

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `students/{id}/subscriptions` (nova subcollection — escrita), `students` (campo `accessTier` — escrita) |
| Cloud Functions afetadas | Nova CF `checkSubscriptions` (onSchedule). Zero impacto em CFs existentes |
| Hooks/listeners afetados | Nenhum existente — subcollection nova. Hook `useSubscriptions` usa collectionGroup |
| Side-effects (PL, compliance, emotional) | Nenhum — dominio financeiro/administrativo separado |
| Blast radius | BAIXO — subcollection nova + 1 campo no student |
| Rollback | Deletar subcollections + remover campo accessTier + remover CF + remover rota/componentes |

### 3.1 Verificacoes pre-codigo

Confirmar que `subscriptions` NAO existe no codebase atual (INV-10):
```bash
grep -rn "subscriptions\|subscription" src/ functions/
```

### 3.2 Invariantes criticas para esta sessao

| Invariante | Aplicacao neste issue |
|------------|----------------------|
| INV-04 (DebugBadge) | Em `SubscriptionsPage` e card de resumo com `component="NomeExato"` |
| INV-05 (Testes) | Transicao de status, grace period, trial expiration, accessTier sync |
| INV-07 (Autorizacao) | Schema da subcollection — aprovado |
| INV-10 (Verificar Firestore) | Confirmar que `subscriptions` nao existe antes de criar |
| **INV-15 (Persistencia)** | Toda criacao de collection/subcollection/campo exige justificativa + parecer tecnico + aprovacao do Marcio |

### 3.3 Shared files — nao editar direto (protocolo secao 6.2 PROJECT.md)

| Arquivo | Necessidade | Protocolo |
|---------|-------------|-----------|
| `src/App.jsx` | View subscriptions (ja editado) | Manter |
| `functions/index.js` | Export de `checkSubscriptions` (ja editado) | Manter |
| `firestore.rules` | Rules para subscriptions via collectionGroup (refatorar) | Delta no doc do issue |
| `src/version.js` | Bump na entrega | Propor no doc do issue |
| `docs/PROJECT.md` | INV-15, DEC-055, DEC-056, CHANGELOG | Propor no doc do issue |

### 3.4 Isolamento de sessao paralela

**NAO TOCAR** arquivos dos chunks 04, 07, 08, 10 — sessao #93 opera la.
Se encontrar conflito com shared file: documentar aqui e notificar Marcio.
**Este issue e milestone v1.2.0** (Mentor Cockpit), enquanto #93 e v1.1.0 — merges independentes.

## 4. SESSOES

### Sessao — 04/04/2026 — Briefing Master (Opus 4.6)

**Tipo:** planejamento (sem codigo)

**O que foi feito:**
- Analise comparativa Opus 4.6 vs Claude Code para definicao de sessao master
- Decisao: Opus 4.6 (chat) como coordenador/master, Claude Code como executor
- Arquivo de controle criado pelo Claude Code (protocolo INV-13)
- Chunk proposto (CHUNK-16) e verificado como AVAILABLE no registry
- Analise de impacto expandida (secao 3.1-3.4) com invariantes mapeadas
- Schema inicial proposto e consolidado
- Email provider confirmado como ja em producao

### Sessao — 04/04/2026 — Claude Code (implementacao v1 + refactor)

**Tipo:** codigo

**O que foi feito (v1 — collection raiz, SUPERSEDED):**
- SubscriptionsPage.jsx (772 linhas) com mock data, depois integrado com hook
- SubscriptionSummaryCard.jsx — card semaforo
- useSubscriptions.js — hook CRUD + listener
- checkSubscriptions.js — CF onSchedule
- subscriptions.test.js — 22 testes
- Shared files editados: App.jsx, Sidebar.jsx, MentorDashboard.jsx, functions/index.js, firestore.rules
- Ajustes de produto: Espelho (nao Self-Service), coluna Situacao, tooltips, receita ativos only, ordenacao
- Build OK, 22/22 testes

**Refactor pendente (decisao DEC-055/DEC-056):**
- Migrar de collection raiz `subscriptions` para subcollection `students/{id}/subscriptions`
- Adicionar campo `type: trial/paid` e `trialEndsAt`
- Adicionar campo `accessTier` no student
- Hook: trocar `collection(db, 'subscriptions')` para `collectionGroup('subscriptions')` em queries do mentor
- Hook: escrita via `collection(db, 'students', studentId, 'subscriptions')`
- CF: iterar por students e suas subcollections, sincronizar accessTier
- Firestore rules: regras para subcollection com collectionGroup
- Remover `studentEmail` e `studentName` da subscription (vem do parent)
- UI: adicionar filtro trial/paid, modal nova assinatura funcional (seletor de students sem subscription)
- Testes: atualizar para novo schema

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| DEC-055 | Subscriptions como subcollection de students, nao collection raiz | Assinatura e entidade dependente — nunca existe sem aluno (INV-15). Modelo reflete realidade do dominio |
| DEC-056 | Campo `type: trial/paid` + `trialEndsAt` + `accessTier` no student | Separa natureza (trial vs convertido) de nivel de acesso. VIP = student sem subscription (accessTier: none). CF sincroniza |
| — | Email via firebase-send-email extension | Ja em producao (collection `mail`). Sem decisao pendente |

## 5. ENCERRAMENTO

**Status:** Refactor em andamento (DEC-055/DEC-056)

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] PROJECT.md atualizado (INV-15, DEC-055, DEC-056, CHANGELOG)
- [ ] PR aberto e mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
- [ ] Locks de chunks liberados no registry (secao 6.3)

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-16 | escrita | Mentor Cockpit — pagina + card + subcollection subscriptions |

> **Observacoes:**
> 1. CHUNK-16 locked para issue #94 desde 04/04/2026.
> 2. Subcollection `subscriptions` dentro de students — inclusa no CHUNK-16 por ser funcionalidade exclusiva do mentor.
> 3. Email provider definido: `firebase/firestore-send-email@0.2.7` (collection `mail`, ja em producao).
> 4. Campo `accessTier` no student toca CHUNK-02 (Student Management) em modo escrita minima — apenas 1 campo. Nao requer lock full do CHUNK-02 pois nao altera logica existente.
