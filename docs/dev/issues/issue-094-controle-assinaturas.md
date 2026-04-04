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
1. **Firestore** — nova collection `subscriptions` com subcollection `payments`
2. **Cloud Function** — `checkSubscriptions` (onSchedule, diaria 8h BRT). Detecta vencimentos proximos, atualiza status `overdue`, envia email ao mentor
3. **Frontend** — `SubscriptionsPage` (rota mentor) com tabela, filtros por status, acoes "Registrar pagamento" e "Renovar"
4. **Card resumo** — semaforo no dashboard mentor (ativos / vencendo / inadimplentes)

Fora de escopo: gateway de pagamento, notificacao ao aluno, controle de WhatsApp.

Email provider: `firebase/firestore-send-email@0.2.7` (ja em producao — collection `mail`).

### 1.1 Schema consolidado — `subscriptions` (APROVADO)

> Merge do issue GitHub + proposta do briefing master. Divergencias resolvidas em 04/04/2026.

```javascript
// subscriptions/{subscriptionId}
{
  // --- Identificacao ---
  studentId: string,          // ref ao student
  studentName: string,        // desnormalizado para listagem rapida
  studentEmail: string,       // para email de alerta (desnormalizado)

  // --- Plano ---
  plan: string,               // 'alpha' | 'self_service' (enum — DEC-034)

  // --- Status ---
  status: string,             // 'active' | 'pending' | 'overdue' | 'paused' | 'cancelled' | 'expired'
                               //   pending  = aguardando primeiro pagamento
                               //   active   = em dia
                               //   overdue  = vencido (apos gracePeriodDays)
                               //   paused   = suspensao temporaria pelo mentor
                               //   cancelled = cancelado definitivamente
                               //   expired  = periodo expirou sem renovacao

  // --- Datas ---
  startDate: Timestamp,
  endDate: Timestamp,         // data de vencimento do periodo atual
  renewalDate: Timestamp,     // proxima renovacao esperada
  lastPaymentDate: Timestamp, // atalho — evita query na subcollection payments

  // --- Financeiro ---
  amount: number,             // valor mensal
  currency: string,           // 'BRL' | 'USD'

  // --- Controle ---
  gracePeriodDays: number,    // dias de tolerancia antes de marcar overdue (default: 5)
  notes: string,              // observacoes livres do mentor

  // --- Metadata ---
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// subscriptions/{id}/payments/{paymentId}
{
  date: Timestamp,            // data do pagamento
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

**Decisoes de schema (resolucao de divergencias):**

| Campo | Decisao | Razao |
|-------|---------|-------|
| `studentEmail` | Incluido | Necessario para alertas via email |
| `whatsappNumber` | Excluido | WhatsApp fora de escopo nesta fase |
| `plan` (enum) | Enum `alpha/self_service` | Consistente com DEC-034 (dois tiers definidos) |
| `status` | Merge: 6 estados | `pending` + `paused` sao estados distintos uteis |
| `amount/currency` | Incluido na subscription | Necessario para card de resumo e pagamento parcial |
| `endDate` | Incluido | Essencial para CF calcular vencimento |
| `lastPaymentDate` | Incluido | Atalho de consulta, evita query na subcollection |
| `notes` | Incluido | Observacoes do mentor, campo simples |
| `periodStart/periodEnd` | No payment, nao na subscription | Identifica periodo coberto pelo pagamento |
| `method/reference` | Incluido no payment | Comprovante e operacionalmente necessario |

### 1.2 Email provider — JA EM PRODUCAO

Extension `firebase/firestore-send-email@0.2.7` (`firestore-send-email`) ja instalada e operacional. Padrao de uso: CF escreve doc na collection `mail` com campos `to`, `message.subject`, `message.html` — a extension dispara o envio via Gmail.

A CF `checkSubscriptions` segue o mesmo padrao. Nao ha decisao pendente.

## 2. ACCEPTANCE CRITERIA

- [ ] Collection `subscriptions` criada com schema conforme issue
- [ ] Subcollection `payments` funcional
- [ ] CF `checkSubscriptions` rodando as 8h BRT sem erros
- [ ] Status `overdue` atualizado automaticamente respeitando `gracePeriodDays`
- [ ] Email enviado apenas quando ha ocorrencias (vencimento ou inadimplencia)
- [ ] `SubscriptionsPage` com tabela, filtros e acoes de pagamento/renovacao
- [ ] Card de resumo visivel no dashboard do mentor
- [ ] Regras Firestore para `subscriptions` (mentor read/write, aluno sem acesso direto)
- [ ] DebugBadge presente na pagina e no card
- [ ] Testes cobrindo: transicao de status, logica de grace period, geracao do relatorio

## 3. ANALISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `subscriptions` (nova — escrita), `subscriptions/payments` (nova subcollection — escrita) |
| Cloud Functions afetadas | Nova CF `checkSubscriptions` (onSchedule). Zero impacto em CFs existentes |
| Hooks/listeners afetados | Nenhum existente — collection isolada |
| Side-effects (PL, compliance, emotional) | Nenhum — dominio financeiro/administrativo separado |
| Blast radius | BAIXO — collection completamente isolada, sem dependencias cruzadas |
| Rollback | Deletar collection + remover CF + remover rota/componentes |

### 3.1 Verificacoes pre-codigo

Confirmar que `subscriptions` NAO existe no codebase atual (INV-10):
```bash
grep -rn "subscriptions\|subscription" src/ functions/
```

### 3.2 Invariantes criticas para esta sessao

| Invariante | Aplicacao neste issue |
|------------|----------------------|
| INV-04 (DebugBadge) | Em `SubscriptionsPage` e card de resumo com `component="NomeExato"` |
| INV-05 (Testes) | Transicao de status, grace period, geracao de relatorio |
| INV-07 (Autorizacao) | Schema da collection e email provider — aprovar antes de codificar |
| INV-10 (Verificar Firestore) | Confirmar que `subscriptions` nao existe antes de criar |

### 3.3 Shared files — nao editar direto (protocolo secao 6.2 PROJECT.md)

| Arquivo | Necessidade | Protocolo |
|---------|-------------|-----------|
| `src/App.jsx` | Nova rota `/mentor/subscriptions` | Delta no doc do issue |
| `functions/index.js` | Export de `checkSubscriptions` | Delta no doc do issue |
| `firestore.rules` | Rules para `subscriptions` (mentor read/write, aluno sem acesso) | Delta no doc do issue |
| `src/version.js` | Bump na entrega | Propor no doc do issue |
| `docs/PROJECT.md` | DECs e CHANGELOG | Propor no doc do issue |

### 3.4 Isolamento de sessao paralela

**NAO TOCAR** arquivos dos chunks 04, 07, 08, 10 — sessao #93 opera la.
Se encontrar conflito com shared file: documentar aqui e notificar Marcio.
Proximo DEC disponivel: DEC-055 (conferir no PROJECT.md — pode ser DEC-056 se #93 registrar primeiro).
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
- Schema de `subscriptions` proposto (secao 1.1)
- Analise de email providers com recomendacao (secao 1.2)

**Decisoes tomadas:**

| ID | Decisao | Justificativa |
|----|---------|---------------|
| — | Opus 4.6 como sessao master | Trabalho cognitivo/documental. Claude Code como executor |
| — | Schema subscriptions consolidado | Merge issue GitHub + briefing master. 6 status, enum plan, email sem WhatsApp |
| — | Email via firebase-send-email extension | Ja em producao (collection `mail`). Sem decisao pendente |

**Sequencia recomendada de implementacao:**
1. Gate pre-codigo: ler codebase do mentor dashboard, propor schema completo ao Marcio
2. Schema Firestore — collection `subscriptions` + subcollection `payments` (apos aprovacao)
3. CRUD basico — `SubscriptionsPage` com tabela + formularios de registro/renovacao
4. Card resumo — semaforo no dashboard mentor
5. CF `checkSubscriptions` — logica de vencimento + grace period + atualizacao de status
6. Email — integracao com provider aprovado
7. Testes — incrementais
8. Gate pre-entrega: version.js + CHANGELOG + DebugBadge + testes passando

**Pendencias para proxima sessao (Claude Code):**
- Registrar lock do CHUNK-16 no PROJECT.md (secao 6.3)
- Executar grep de verificacao (secao 3.1) antes do gate pre-codigo

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
| CHUNK-16 | escrita | Mentor Cockpit — pagina + card + collection subscriptions |

> **Observacoes pendentes:**
> 1. Campo "Chunks necessarios" ausente no issue GitHub. Chunk acima proposto — aguardar aprovacao do Marcio antes de registrar lock.
> 2. A collection `subscriptions` e nova e isolada — incluida no escopo do CHUNK-16 por ser funcionalidade exclusiva do mentor.
> 3. Email provider definido: `firebase/firestore-send-email@0.2.7` (collection `mail`, ja em producao).
